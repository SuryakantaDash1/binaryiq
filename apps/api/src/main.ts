import 'reflect-metadata';

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';

import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { AppConfigService } from './config/config.service';

async function bootstrap(): Promise<void> {
  // rawBody: webhook signatures are computed over the exact bytes received.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });
  const config = app.get(AppConfigService);
  const logger = new Logger('Bootstrap');

  // Real client IP for audit logs, consent records and per-IP rate limiting.
  app.set('trust proxy', config.get('TRUST_PROXY'));
  app.disable('x-powered-by');
  app.useBodyParser('json', { limit: '100kb' });
  app.useBodyParser('urlencoded', { extended: true, limit: '100kb' });

  app.setGlobalPrefix('v1');
  app.use(cookieParser());
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter(config.get('NODE_ENV') === 'development'));

  // Only our own web app may call the API with credentials (refresh cookies).
  const allowed = new Set(
    (config.get('CORS_ORIGINS') || config.get('WEB_URL'))
      .split(',')
      .map((o) => o.trim().replace(/\/$/, ''))
      .filter(Boolean),
  );
  app.enableCors({
    origin: (origin, cb) => cb(null, !origin || allowed.has(origin)),
    credentials: true,
  });
  app.enableShutdownHooks();

  const port = config.get('PORT');
  await app.listen(port);
  logger.log(`API listening on http://localhost:${port}/v1`);
}

void bootstrap();
