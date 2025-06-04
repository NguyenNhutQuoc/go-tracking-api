// src/config/database.config.ts
import { Injectable } from '@nestjs/common';
import { TypeOrmModuleOptions, TypeOrmOptionsFactory } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { join } from 'path';

@Injectable()
export class DatabaseConfig implements TypeOrmOptionsFactory {
  constructor(private configService: ConfigService) {}

  createTypeOrmOptions(): TypeOrmModuleOptions {
    return {
      type: 'postgres',
      host: this.configService.get<string>('app.database.host'),
      port: this.configService.get<number>('app.database.port'),
      username: this.configService.get<string>('app.database.username'),
      password: this.configService.get<string>('app.database.password'),
      database: this.configService.get<string>('app.database.database'),
      entities: [
        join(
          __dirname,
          '../infrastructure/database/typeorm/entities/*.typeorm-entity{.ts,.js}',
        ),
      ],
      migrations: [
        join(
          __dirname,
          '../infrastructure/database/typeorm/migrations/*{.ts,.js}',
        ),
      ],
      synchronize:
        this.configService.get<string>('app.nodeEnv') === 'development',
      logging: this.configService.get<string>('app.nodeEnv') === 'development',
      ssl: this.configService.get<string>('app.nodeEnv') === 'production',
    };
  }
}
