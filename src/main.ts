import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { PrismaService } from './prisma/prisma.service';
import { ensureSuperAdmin } from './admin-auth/seed';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.init();
  const prisma = app.get(PrismaService);
  await ensureSuperAdmin(prisma);
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();