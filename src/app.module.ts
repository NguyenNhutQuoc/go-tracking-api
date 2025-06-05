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
import { UserResolver } from './presentation/graphql/resolvers/demo.resolver';
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
  ],
  controllers: [AppController],
  providers: [AppService, UserResolver, DateScalar, CoordinatesScalar],
})
export class AppModule {}
