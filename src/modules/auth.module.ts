// src/modules/auth.module.ts
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
import { NotificationService } from '../infrastructure/services/notification/notification.service';
import { UserDataLoaderService } from '../infrastructure/dataloader/user.dataloader';

// Resolvers
import { AuthResolver } from '../presentation/graphql/resolvers/auth.resolver';
import { UserResolver } from '../presentation/graphql/resolvers/user.resolver';

// Guards
import { JwtAuthGuard } from '../presentation/guards/jwt-auth.guard';
import { RolesGuard } from '../presentation/guards/roles.guard';

// Cache Module
import { CacheModule } from '../infrastructure/modules/cache.module';
import { JwtStrategy } from 'src/infrastructure/auth/strategies/jwt.strategy';
import { BrevoEmailService } from 'src/infrastructure/services/email/brevo-email.service';

@Module({
  imports: [
    // Import required modules
    ConfigModule,
    CacheModule,

    // TypeORM entities
    TypeOrmModule.forFeature([UserTypeormEntity, OrganizationTypeormEntity]),

    // JWT configuration
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

    // Passport configuration
    PassportModule.register({ defaultStrategy: 'jwt' }),
  ],

  providers: [
    // Repository implementations
    {
      provide: USER_REPOSITORY_TOKEN,
      useClass: UserTypeormRepository,
    },

    // Services
    AuthService,
    OtpService,
    UserDataLoaderService,

    // ✅ Email Services
    BrevoEmailService, // Add Brevo email service
    NotificationService, // Updated notification service

    // GraphQL Resolvers
    AuthResolver,
    UserResolver,

    // Guards
    JwtAuthGuard,
    RolesGuard,

    // Strategies
    JwtStrategy,
  ],

  exports: [
    // Export services that might be used in other modules
    AuthService,
    USER_REPOSITORY_TOKEN,
    JwtAuthGuard,
    RolesGuard,
    UserDataLoaderService,
    BrevoEmailService, // ✅ Export Brevo service
    NotificationService, // ✅ Export notification service
  ],
})
export class AuthModule {}
