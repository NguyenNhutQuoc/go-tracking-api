import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

// Entities
import { UserTypeormEntity } from '../infrastructure/database/typeorm/entities/user.typeorm-entity';
import { OrganizationTypeormEntity } from '../infrastructure/database/typeorm/entities/organization.typeorm-entity';

// Repositories
import { UserTypeormRepository } from '../infrastructure/database/typeorm/repositories/user.typeorm-repository';

// Services
import {
  AuthService,
  USER_REPOSITORY_TOKEN,
} from '../core/application/services/auth.service';
import { OtpService } from '../infrastructure/services/otp/otp.service';
import { SmsService } from '../infrastructure/services/sms/sms.service';
import { UserDataLoaderService } from '../infrastructure/dataloader/user.dataloader';

// Resolvers
import { AuthResolver } from '../presentation/graphql/resolvers/auth.resolver';
import { UserResolver } from '../presentation/graphql/resolvers/user.resolver';

// Guards & Strategies
import { JwtAuthGuard } from '../presentation/guards/jwt-auth.guard';
import { RolesGuard } from '../presentation/guards/roles.guard';
import { JwtStrategy } from '../infrastructure/auth/strategies/jwt.strategy';

// Cache Module
import { CacheModule } from '../infrastructure/modules/cache.module';

@Module({
  imports: [
    ConfigModule,
    CacheModule,
    TypeOrmModule.forFeature([UserTypeormEntity, OrganizationTypeormEntity]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>(
          'JWT_SECRET',
          'your-super-secret-jwt-key',
        ),
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRY', '1h'),
        },
      }),
      inject: [ConfigService],
    }),
    PassportModule.register({ defaultStrategy: 'jwt' }),
  ],
  providers: [
    // Repository
    {
      provide: USER_REPOSITORY_TOKEN,
      useClass: UserTypeormRepository,
    },

    // Services
    AuthService,
    OtpService,
    SmsService,
    UserDataLoaderService,

    // Resolvers
    AuthResolver,
    UserResolver,

    // Guards & Strategies
    JwtAuthGuard,
    RolesGuard,
    JwtStrategy,
  ],
  exports: [
    AuthService,
    USER_REPOSITORY_TOKEN,
    JwtAuthGuard,
    RolesGuard,
    UserDataLoaderService,
    SmsService,
  ],
})
export class AuthModule {}
