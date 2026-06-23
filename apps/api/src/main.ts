import 'dotenv/config'; // load .env before any provider constructor reads process.env
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // The Next.js frontend (default :3000) calls this API (:3001).
  app.enableCors({
    origin: process.env.WEB_ORIGIN ?? 'http://localhost:3000',
  });

  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  console.log(`API listening on http://localhost:${port}`);
}
void bootstrap();
