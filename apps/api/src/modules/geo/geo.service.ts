import { Injectable, Logger } from '@nestjs/common';

import { RedisService } from '../../redis/redis.service';

const PINCODE_API = 'https://api.postalpincode.in/pincode/';
const CACHE_TTL_SECONDS = 7 * 24 * 60 * 60;
const FETCH_TIMEOUT_MS = 5_000;

export interface PincodeArea {
  name: string;
}

/**
 * Indian PIN code → post-office names. Proxied so visitors' browsers don't send
 * their IP to the third-party lookup service; only PIN codes ever leave our server.
 */
@Injectable()
export class GeoService {
  private readonly logger = new Logger(GeoService.name);

  constructor(private readonly redis: RedisService) {}

  async lookupPincode(pin: string): Promise<PincodeArea[]> {
    const key = `geo:pincode:${pin}`;
    const cached = await this.redis.instance.get(key);
    if (cached) return JSON.parse(cached) as PincodeArea[];

    let areas: PincodeArea[];
    try {
      const res = await fetch(`${PINCODE_API}${pin}`, {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        redirect: 'error',
      });
      if (!res.ok) return [];
      const data = (await res.json()) as Array<{ PostOffice?: Array<{ Name?: unknown }> | null }>;
      areas = (data?.[0]?.PostOffice ?? [])
        .map((o) => (typeof o.Name === 'string' ? o.Name.trim().slice(0, 100) : ''))
        .filter(Boolean)
        .slice(0, 20)
        .map((name) => ({ name }));
    } catch (err) {
      this.logger.warn(`PIN code lookup failed: ${err instanceof Error ? err.name : 'unknown'}`);
      return [];
    }

    await this.redis.instance.set(key, JSON.stringify(areas), 'EX', CACHE_TTL_SECONDS);
    return areas;
  }
}
