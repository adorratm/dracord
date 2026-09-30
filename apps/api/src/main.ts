import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

function parseCorsOrigins(raw: string | undefined): string[] {
  const defaults = [
    'http://localhost:3000',
    'http://localhost:3001',
    'https://dracord.com.tr',
    'https://www.dracord.com.tr',
    'https://admin.dracord.com.tr',
  ];
  if (!raw?.trim()) {
    return defaults;
  }
  return raw.split(',').map((o) => o.trim()).filter(Boolean);
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  // Nginx / Caddy terminate TLS — required for secure cookies + correct OAuth URLs
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableCors({
    origin: parseCorsOrigins(config.get<string>('CORS_ORIGINS')),
    credentials: true,
  });

  // Rolling deploy / SIGTERM için graceful shutdown
  app.enableShutdownHooks();

  const port = config.get<number>('PORT') ?? 4000;
  await app.listen(port);
  console.log(`Dracord API listening on http://localhost:${port}`);
}

void bootstrap();
