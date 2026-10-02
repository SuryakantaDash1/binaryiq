import { createHmac, createVerify, timingSafeEqual } from 'node:crypto';

import {
  Injectable,
  Logger,
  SetMetadata,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import { AppConfigService } from '../../config/config.service';
import { UnauthenticatedException } from '../exceptions/domain.exception';

export type WebhookProvider = 'twilio' | 'sendgrid' | 'fcm' | 'paypal';
const WEBHOOK_PROVIDER_KEY = 'webhookProvider';
const MAX_SKEW_MS = 5 * 60 * 1000;

/** Marks a route as a provider webhook; pair with @UseGuards(WebhookSignatureGuard). */
export const WebhookFrom = (provider: WebhookProvider): MethodDecorator & ClassDecorator =>
  SetMetadata(WEBHOOK_PROVIDER_KEY, provider);

type RawRequest = Request & { rawBody?: Buffer };

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/**
 * Verifies webhook signatures. Fails closed: if a provider's verification secret
 * isn't configured, its webhook is rejected — unauthenticated callers must never
 * be able to mark payouts complete, refund points or delete push tokens.
 */
@Injectable()
export class WebhookSignatureGuard implements CanActivate {
  private readonly logger = new Logger(WebhookSignatureGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly config: AppConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const provider = this.reflector.get<WebhookProvider | undefined>(WEBHOOK_PROVIDER_KEY, context.getHandler());
    const req = context.switchToHttp().getRequest<RawRequest>();
    // Any error (bad PEM, network failure, malformed header) counts as a failed check.
    const ok = provider ? await (async () => this.verify(provider, req))().catch(() => false) : false;
    if (!ok) {
      this.logger.warn(`Rejected ${provider ?? 'unknown'} webhook (missing config or bad signature)`);
      throw new UnauthenticatedException('Invalid webhook signature');
    }
    return true;
  }

  private verify(provider: WebhookProvider, req: RawRequest): Promise<boolean> | boolean {
    switch (provider) {
      case 'twilio':
        return this.verifyTwilio(req);
      case 'sendgrid':
        return this.verifySendgrid(req);
      case 'fcm':
        return this.verifyFcm(req);
      case 'paypal':
        return this.verifyPaypal(req);
    }
  }

  /** X-Twilio-Signature = base64(HMAC-SHA1(authToken, fullUrl + sorted key/value pairs)). */
  private verifyTwilio(req: RawRequest): boolean {
    const token = this.config.get('TWILIO_AUTH_TOKEN');
    const sig = req.header('x-twilio-signature');
    if (!token || !sig) return false;
    const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
    const params = (req.body ?? {}) as Record<string, unknown>;
    const data = Object.keys(params)
      .sort()
      .reduce((acc, k) => acc + k + String(params[k]), url);
    const expected = createHmac('sha1', token).update(data, 'utf8').digest('base64');
    return safeEqual(sig, expected);
  }

  /** SendGrid signed event webhook: ECDSA P-256 over timestamp + raw body. */
  private verifySendgrid(req: RawRequest): boolean {
    const key = this.config.get('SENDGRID_WEBHOOK_VERIFICATION_KEY');
    const sig = req.header('x-twilio-email-event-webhook-signature');
    const ts = req.header('x-twilio-email-event-webhook-timestamp');
    if (!key || !sig || !ts || !req.rawBody) return false;
    if (Math.abs(Date.now() - Number(ts) * 1000) > MAX_SKEW_MS) return false;
    const pem = `-----BEGIN PUBLIC KEY-----\n${key}\n-----END PUBLIC KEY-----`;
    const verifier = createVerify('sha256');
    verifier.update(ts + req.rawBody.toString('utf8'));
    return verifier.verify(pem, sig, 'base64');
  }

  /** FCM has no native webhook signing — our relay must send a shared secret header. */
  private verifyFcm(req: RawRequest): boolean {
    const secret = this.config.get('FCM_WEBHOOK_SECRET');
    const given = req.header('x-webhook-secret');
    return !!secret && !!given && safeEqual(given, secret);
  }

  /** PayPal: ask PayPal to verify the transmission (requires API credentials + webhook id). */
  private async verifyPaypal(req: RawRequest): Promise<boolean> {
    const clientId = this.config.get('PAYPAL_CLIENT_ID');
    const clientSecret = this.config.get('PAYPAL_CLIENT_SECRET');
    const webhookId = this.config.get('PAYPAL_WEBHOOK_ID');
    const base = this.config.get('PAYPAL_API_BASE');
    if (!clientId || !clientSecret || !webhookId) return false;

    const transmissionTime = req.header('paypal-transmission-time');
    if (!transmissionTime || Math.abs(Date.now() - Date.parse(transmissionTime)) > MAX_SKEW_MS) return false;

    const tokenRes = await fetch(`${base}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });
    if (!tokenRes.ok) return false;
    const { access_token: accessToken } = (await tokenRes.json()) as { access_token?: string };
    if (!accessToken) return false;

    const verifyRes = await fetch(`${base}/v1/notifications/verify-webhook-signature`, {
      method: 'POST',
      headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        auth_algo: req.header('paypal-auth-algo'),
        cert_url: req.header('paypal-cert-url'),
        transmission_id: req.header('paypal-transmission-id'),
        transmission_sig: req.header('paypal-transmission-sig'),
        transmission_time: transmissionTime,
        webhook_id: webhookId,
        webhook_event: req.body,
      }),
    });
    if (!verifyRes.ok) return false;
    const { verification_status: status } = (await verifyRes.json()) as { verification_status?: string };
    return status === 'SUCCESS';
  }
}
