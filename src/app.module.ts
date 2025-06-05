// src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseConfig } from './config/database.config';
import { EnvConfig } from './config/env.config';
import { graphqlConfig } from './config/graphql.config';

// Import the new modules
import { AuthModule } from './modules/auth.module';
import { CacheModule } from './infrastructure/modules/cache.module';

// Import GraphQL scalars
import { DateScalar } from './infrastructure/graphql/scalars/date.scalar';
import { CoordinatesScalar } from './infrastructure/graphql/scalars/coordinates.scalar';

@Module({
  imports: [
    // Config module - phải load đầu tiên
    ConfigModule.forRoot({
      isGlobal: true, // Làm cho ConfigService có thể inject ở mọi nơi
      load: [EnvConfig], // Load các configuration
      envFilePath: ['.env.local', '.env'], // Tự động load file .env
    }),

    // Cache module (Redis) - load trước khi sử dụng
    CacheModule,

    // TypeORM configuration
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useClass: DatabaseConfig,
    }),

    // GraphQL configuration
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      ...graphqlConfig,
    }),

    // Authentication module với tất cả các tính năng auth
    AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService, DateScalar, CoordinatesScalar],
})
export class AppModule {}
