import { Resolver, Mutation, Args, Query } from '@nestjs/graphql';
import { UseGuards, Logger } from '@nestjs/common';
import { AuthService } from '../../../core/application/services/auth.service';
import {
  OtpService,
  OtpType,
} from '../../../infrastructure/services/otp/otp.service';
import { SmsService } from '../../../infrastructure/services/sms/sms.service';
import {
  LoginInput,
  RegisterInput,
  VerifyOtpInput,
  ForgotPasswordInput,
  ResetPasswordInput,
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
    private readonly smsService: SmsService,
  ) {}

  @Mutation(() => MessageResponse)
  async register(
    @Args('input') input: RegisterInput,
  ): Promise<MessageResponse> {
    try {
      const result = await this.authService.register(input);
      this.logger.log(`User registered: ${input.phone}`);
      return { message: result.message };
    } catch (error) {
      this.logger.error(
        `Registration failed for ${input.phone}: ${error.message}`,
      );
      throw error;
    }
  }

  @Mutation(() => AuthResult)
  async login(@Args('input') input: LoginInput): Promise<AuthResult> {
    try {
      const result = await this.authService.login(input);
      this.logger.log(`User logged in: ${input.phone}`);
      return result;
    } catch (error) {
      this.logger.error(`Login failed for ${input.phone}: ${error.message}`);
      throw error;
    }
  }

  @Mutation(() => MessageResponse)
  async sendOtp(@Args('input') input: SendOtpInput): Promise<MessageResponse> {
    try {
      const { phone, type } = input;

      // Check rate limit
      const rateLimit = await this.otpService.checkRateLimit(
        phone,
        type,
        5,
        60,
      );
      if (!rateLimit.allowed) {
        throw new Error(
          `Too many OTP requests. Try again after ${rateLimit.resetTime.toLocaleTimeString()}`,
        );
      }

      // Generate OTP
      const expiryMinutes =
        type === OtpType.LOGIN_2FA
          ? 5
          : type === OtpType.PASSWORD_RESET
            ? 30
            : 15;
      const otp = await this.otpService.generateOtp(phone, type, expiryMinutes);

      // Send SMS
      const purpose =
        type === OtpType.PHONE_VERIFICATION
          ? 'verification'
          : type === OtpType.PASSWORD_RESET
            ? 'password-reset'
            : 'login-2fa';

      const smsSent = await this.smsService.sendOtp(phone, otp, purpose);

      if (!smsSent) {
        throw new Error('Failed to send SMS');
      }

      this.logger.log(`OTP sent to ${phone.substring(0, 6)}***`);
      return {
        message: `OTP sent successfully. Valid for ${expiryMinutes} minutes.`,
      };
    } catch (error) {
      this.logger.error(
        `Failed to send OTP to ${input.phone}: ${error.message}`,
      );
      throw error;
    }
  }

  @Mutation(() => MessageResponse)
  async verifyPhone(
    @Args('input') input: VerifyOtpInput,
  ): Promise<MessageResponse> {
    try {
      const result = await this.authService.verifyPhone(input);
      this.logger.log(`Phone verified: ${input.phone}`);
      return result;
    } catch (error) {
      this.logger.error(
        `Phone verification failed for ${input.phone}: ${error.message}`,
      );
      throw error;
    }
  }

  @Mutation(() => MessageResponse)
  async forgotPassword(
    @Args('input') input: ForgotPasswordInput,
  ): Promise<MessageResponse> {
    try {
      const result = await this.authService.forgotPassword(input.phone);
      this.logger.log(`Password reset requested for: ${input.phone}`);
      return result;
    } catch (error) {
      this.logger.error(
        `Password reset request failed for ${input.phone}: ${error.message}`,
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
        input.phone,
        input.otp,
        input.newPassword,
      );
      this.logger.log(`Password reset completed for: ${input.phone}`);
      return result;
    } catch (error) {
      this.logger.error(
        `Password reset failed for ${input.phone}: ${error.message}`,
      );
      throw error;
    }
  }

  @Query(() => RateLimitInfo)
  async checkOtpRateLimit(
    @Args('phone') phone: string,
    @Args('type', { type: () => OtpType }) type: OtpType,
  ): Promise<RateLimitInfo> {
    return this.otpService.checkRateLimit(phone, type);
  }

  @Query(() => MessageResponse)
  @UseGuards(JwtAuthGuard)
  async whoAmI(@CurrentUser() user: User): Promise<MessageResponse> {
    return {
      message: `Hello ${user.fullName}, you are logged in as ${user.role} with phone ${user.phone}`,
    };
  }
}
