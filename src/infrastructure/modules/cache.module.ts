// src/infrastructure/modules/cache.module.ts
import { Module, Global } from '@nestjs/common';
import { CacheModule as NestCacheModule } from '@nestjs/cache-manager';
import { ConfigModule } from '@nestjs/config';
import { CacheConfig } from '../../config/cache.config';

@Global()
@Module({
  imports: [
    NestCacheModule.registerAsync({
      imports: [ConfigModule],
      useClass: CacheConfig,
    }),
  ],
  exports: [NestCacheModule],
})
export class CacheModule {}
