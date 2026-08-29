import './env.js';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { toNodeHandler } from 'better-auth/node';
import { auth } from './auth/auth.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false });
  const expressApp = app.getHttpAdapter().getInstance();

  app.enableCors({
    origin: process.env.WEB_URL ?? 'http://localhost:3000',
    credentials: true,
  });

  // Mount Better Auth under /api/auth (Express 5-safe; no bare /* wildcard)
  expressApp.use('/api/auth', toNodeHandler(auth));

  // Nest 11 body parsers (avoids a direct express import)
  app.useBodyParser('json');
  app.useBodyParser('urlencoded', { extended: true });

  app.setGlobalPrefix('api/v1');

  const port = Number(process.env.API_PORT ?? 3001);
  await app.listen(port);
  console.log(`API listening on http://localhost:${port}`);
}

bootstrap().catch((error) => {
  console.error(error);
  process.exit(1);
});
