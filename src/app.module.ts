import { CacheModule } from '@nestjs/cache-manager';
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RedisMockStore } from './cache/redis-mock.store';
import { AdminAuthModule } from './admin-auth/admin-auth.module';
import { AuthModule } from './auth/auth.module';
import { DataModule } from './data/data.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    PrismaModule,
    CacheModule.registerAsync({
      isGlobal: true,
      useFactory: () => ({
        stores: [new RedisMockStore()],
        ttl: 60_000,
      }),
    }),
    AuthModule,
    AdminAuthModule,
    DataModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}