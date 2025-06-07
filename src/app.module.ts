import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseConfig } from './config/database.config';
import { EnvConfig } from './config/env.config';
import { graphqlConfig } from './config/graphql.config';

// Import modules
import { AuthModule } from './modules/auth.module';
import { CacheModule } from './infrastructure/modules/cache.module';

// Import GraphQL scalars
import { DateScalar } from './infrastructure/graphql/scalars/date.scalar';
import { CoordinatesScalar } from './infrastructure/graphql/scalars/coordinates.scalar';

// Import DataLoader plugin
import { DataLoaderPlugin } from './infrastructure/graphql/plugins/dataloader.plugin';

// IMPORTANT: Only use GlobalErrorFilter for HTTP, not GraphQL
import { GlobalErrorFilter } from './infrastructure/filters/global-error.filter';
import { ErrorLoggingInterceptor } from './infrastructure/interceptor/error-loging.interceptor';

@Module({
  imports: [
    // Config module
    ConfigModule.forRoot({
      isGlobal: true,
      load: [EnvConfig],
      envFilePath: ['.env.local', '.env'],
    }),

    // Cache module (Redis)
    CacheModule,

    // TypeORM configuration
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useClass: DatabaseConfig,
    }),

    // GraphQL configuration với error handling riêng
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      ...graphqlConfig,
      // Add DataLoader plugin here instead of in config
      plugins: [new DataLoaderPlugin()],
    }),

    // Authentication module
    AuthModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    DateScalar,
    CoordinatesScalar,

    // IMPORTANT: Global filter chỉ áp dụng cho HTTP, không cho GraphQL
    // GraphQL sẽ dùng formatError trong config
    {
      provide: APP_FILTER,
      useClass: GlobalErrorFilter,
    },

    {
      provide: APP_INTERCEPTOR,
      useClass: ErrorLoggingInterceptor,
    },
  ],
})
export class AppModule {}
