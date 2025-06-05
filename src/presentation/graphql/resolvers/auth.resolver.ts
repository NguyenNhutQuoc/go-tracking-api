/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
// src/presentation/graphql/resolvers/auth.resolver.ts
import { Resolver, Mutation, Args, Context, Query } from '@nestjs/graphql';
import { UseGuards, Logger } from '@nestjs/common';
import { AuthService } from '../../../core/application/services/auth.service';
import {
  OtpService,
  OtpType,
} from '../../../infrastructure/services/otp/otp.service';
import {
  LoginInput,
  RegisterInput,
  VerifyOtpInput,
  ForgotPasswordInput,
  ResetPasswordInput,
  RefreshTokenInput,
  SendOtpInput,
} from '../inputs/user.input';
import {
  AuthResult,
  MessageResponse,
  RateLimitInfo,
} from '../types/user.types';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';
import { CurrentUser } from '../../decorators/current-user.decorator';
import { User } from '../../../core/domain/entities/user.entity';

@Resolver()
export class AuthResolver {
  private readonly logger = new Logger(AuthResolver.name);

  constructor(
    private readonly authService: AuthService,
    private readonly otpService: OtpService,
  ) {}

  @Mutation(() => MessageResponse)
  async register(
    @Args('input') input: RegisterInput,
  ): Promise<MessageResponse> {
    try {
      const result = await this.authService.register(input);
      this.logger.log(`User registered: ${input.email}`);
      return { message: result.message };
    } catch (error) {
      this.logger.error(
        `Registration failed for ${input.email}: ${error.message}`,
      );
      throw error;
    }
  }

  @Mutation(() => AuthResult)
  async login(
    @Args('input') input: LoginInput,
    @Context() context: any,
  ): Promise<AuthResult> {
    try {
      const result = await this.authService.login(input);

      // Log successful login
      this.logger.log(`User logged in: ${input.email}`);

      // You can add the user to context for future use
      context.user = result.user;

      return result;
    } catch (error) {
      this.logger.error(`Login failed for ${input.email}: ${error.message}`);
      throw error;
    }
  }

  @Mutation(() => MessageResponse)
  async sendEmailVerification(
    @Args('input') input: SendOtpInput,
  ): Promise<MessageResponse> {
    try {
      // Check if it's email verification request
      if (input.type !== OtpType.EMAIL_VERIFICATION) {
        throw new Error('Invalid OTP type for email verification');
      }

      // Check rate limit
      const rateLimit = await this.otpService.checkRateLimit(
        input.email,
        input.type,
        3, // Max 3 requests
        60, // Per hour
      );

      if (!rateLimit.allowed) {
        throw new Error(
          `Too many verification requests. Try again after ${rateLimit.resetTime.toLocaleTimeString()}`,
        );
      }

      // Generate and send OTP (this will be handled by the auth service)
      // For now, we'll generate OTP directly
      await this.otpService.generateOtp(
        input.email,
        input.type,
        15, // 15 minutes
      );

      this.logger.log(`Email verification OTP sent to: ${input.email}`);

      return { message: 'Verification email sent successfully' };
    } catch (error) {
      this.logger.error(
        `Failed to send email verification to ${input.email}: ${error.message}`,
      );
      throw error;
    }
  }

  @Mutation(() => MessageResponse)
  async verifyEmail(
    @Args('input') input: VerifyOtpInput,
  ): Promise<MessageResponse> {
    try {
      const result = await this.authService.verifyEmail(input);
      this.logger.log(`Email verified for: ${input.email}`);
      return result;
    } catch (error) {
      this.logger.error(
        `Email verification failed for ${input.email}: ${error.message}`,
      );
      throw error;
    }
  }

  @Mutation(() => MessageResponse)
  async forgotPassword(
    @Args('input') input: ForgotPasswordInput,
  ): Promise<MessageResponse> {
    try {
      const result = await this.authService.forgotPassword(input);
      this.logger.log(`Password reset requested for: ${input.email}`);
      return result;
    } catch (error) {
      this.logger.error(
        `Password reset request failed for ${input.email}: ${error.message}`,
      );
      throw error;
    }
  }

  @Mutation(() => MessageResponse)
  async resetPassword(
    @Args('input') input: ResetPasswordInput,
  ): Promise<MessageResponse> {
    try {
      const result = await this.authService.resetPassword(
        input.email,
        input.otp,
        input.newPassword,
      );
      this.logger.log(`Password reset completed for: ${input.email}`);
      return result;
    } catch (error) {
      this.logger.error(
        `Password reset failed for ${input.email}: ${error.message}`,
      );
      throw error;
    }
  }

  @Mutation(() => AuthResult)
  async refreshToken(
    @Args('input') input: RefreshTokenInput,
  ): Promise<AuthResult> {
    try {
      const result = await this.authService.refreshToken(input.refreshToken);
      this.logger.log(`Token refreshed for user: ${result.user.email}`);
      return result;
    } catch (error) {
      this.logger.error(`Token refresh failed: ${error.message}`);
      throw error;
    }
  }

  @Query(() => RateLimitInfo)
  async checkOtpRateLimit(
    @Args('email') email: string,
    @Args('type', { type: () => OtpType }) type: OtpType,
  ): Promise<RateLimitInfo> {
    const rateLimit = await this.otpService.checkRateLimit(email, type);
    return rateLimit;
  }

  @Query(() => MessageResponse)
  @UseGuards(JwtAuthGuard)
  // eslint-disable-next-line @typescript-eslint/require-await
  async whoAmI(@CurrentUser() user: User): Promise<MessageResponse> {
    return {
      message: `Hello ${user.fullName}, you are logged in as ${user.role} in organization ${user.organizationId}`,
    };
  }

  //   @Mutation(() => MessageResponse)
  //   @UseGuards(JwtAuthGuard)
  //   async logout(@CurrentUser() user: User): Promise<MessageResponse> {
  //     // In a more advanced implementation, you might want to:
  //     // 1. Blacklist the current token
  //     // 2. Clear any session data
  //     // 3. Log the logout event

  //     this.logger.log(`User logged out: ${user.email}`);
  //     return { message: 'Logged out successfully' };
  //   }

  @Mutation(() => MessageResponse)
  async sendOtp(@Args('input') input: SendOtpInput): Promise<MessageResponse> {
    try {
      // Check rate limit
      const rateLimit = await this.otpService.checkRateLimit(
        input.email,
        input.type,
        5, // Max 5 requests
        60, // Per hour
      );

      if (!rateLimit.allowed) {
        throw new Error(
          `Too many OTP requests. Try again after ${rateLimit.resetTime.toLocaleTimeString()}`,
        );
      }

      // Generate OTP based on type
      let expiryMinutes = 15; // Default 15 minutes
      if (input.type === OtpType.PASSWORD_RESET) {
        expiryMinutes = 30; // 30 minutes for password reset
      } else if (input.type === OtpType.LOGIN_2FA) {
        expiryMinutes = 5; // 5 minutes for 2FA
      }

      await this.otpService.generateOtp(input.email, input.type, expiryMinutes);

      this.logger.log(`OTP generated for ${input.email} (${input.type})`);

      return {
        message: `OTP sent successfully. It will expire in ${expiryMinutes} minutes.`,
      };
    } catch (error) {
      this.logger.error(
        `Failed to send OTP to ${input.email}: ${error.message}`,
      );
      throw error;
    }
  }
}
