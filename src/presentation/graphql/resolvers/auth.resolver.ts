/* eslint-disable @typescript-eslint/require-await */

// File: src/presentation/graphql/resolvers/auth.resolver.ts (FIXED)
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
import { HandleGraphQLErrors } from '../../../infrastructure/decorators/handle-error.decorator';
import { GraphQLErrorUtil } from '../../../infrastructure/utils/graphql-error.util';
import { ErrorCode } from '../../../core/errors/error-codes.enum';

@Resolver()
export class AuthResolver {
  private readonly logger = new Logger(AuthResolver.name);

  constructor(
    private readonly authService: AuthService,
    private readonly otpService: OtpService,
    private readonly smsService: SmsService,
  ) {}

  @Mutation(() => MessageResponse)
  @HandleGraphQLErrors('Đăng ký không thành công')
  async register(
    @Args('input') input: RegisterInput,
  ): Promise<MessageResponse> {
    const result = await this.authService.register(input);
    this.logger.log(`User registered: ${input.phone}`);
    return { message: result.message };
  }

  @Mutation(() => AuthResult)
  @HandleGraphQLErrors('Đăng nhập không thành công')
  async login(@Args('input') input: LoginInput): Promise<AuthResult> {
    const result = await this.authService.login(input);
    this.logger.log(`User logged in: ${input.phone}`);
    return result;
  }

  @Mutation(() => MessageResponse)
  @HandleGraphQLErrors('Không thể gửi mã OTP')
  async sendOtp(@Args('input') input: SendOtpInput): Promise<MessageResponse> {
    const { phone, type } = input;

    // Check rate limit
    const rateLimit = await this.otpService.checkRateLimit(phone, type, 5, 60);
    if (!rateLimit.allowed) {
      // 🎯 TẬN DỤNG ERROR CODE ENUM
      throw GraphQLErrorUtil.fromErrorCode(
        ErrorCode.OTP_RATE_LIMIT,
        `Bạn đã yêu cầu quá nhiều mã OTP. Vui lòng thử lại sau ${rateLimit.resetTime.toLocaleTimeString()}`,
        'phone',
        {
          remainingRequests: rateLimit.remainingRequests,
          resetTime: rateLimit.resetTime,
        },
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
      // 🎯 TẬN DỤNG ERROR CODE ENUM
      throw GraphQLErrorUtil.fromErrorCode(ErrorCode.SMS_SEND_FAILED);
    }

    this.logger.log(`OTP sent to ${phone.substring(0, 6)}***`);
    return {
      message: `Mã OTP đã được gửi thành công. Có hiệu lực trong ${expiryMinutes} phút.`,
    };
  }

  @Mutation(() => MessageResponse)
  @HandleGraphQLErrors('Xác thực số điện thoại không thành công')
  async verifyPhone(
    @Args('input') input: VerifyOtpInput,
  ): Promise<MessageResponse> {
    const result = await this.authService.verifyPhone(input);
    this.logger.log(`Phone verified: ${input.phone}`);
    return result;
  }

  @Mutation(() => MessageResponse)
  @HandleGraphQLErrors('Yêu cầu đặt lại mật khẩu không thành công')
  async forgotPassword(
    @Args('input') input: ForgotPasswordInput,
  ): Promise<MessageResponse> {
    const result = await this.authService.forgotPassword(input.phone);
    this.logger.log(`Password reset requested for: ${input.phone}`);
    return result;
  }

  @Mutation(() => MessageResponse)
  @HandleGraphQLErrors('Đặt lại mật khẩu không thành công')
  async resetPassword(
    @Args('input') input: ResetPasswordInput,
  ): Promise<MessageResponse> {
    const result = await this.authService.resetPassword(
      input.phone,
      input.otp,
      input.newPassword,
    );
    this.logger.log(`Password reset completed for: ${input.phone}`);
    return result;
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
