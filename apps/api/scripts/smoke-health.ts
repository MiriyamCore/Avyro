import '../src/env.js';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module.js';

async function main() {
  const app = await NestFactory.create(AppModule, { logger: false, bodyParser: true });
  app.setGlobalPrefix('api/v1');
  await app.listen(3011);
  const res = await fetch('http://127.0.0.1:3011/api/v1/health');
  const body = await res.json();
  console.log(body);
  if (body.status !== 'ok') {
    process.exitCode = 1;
  }
  await app.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
