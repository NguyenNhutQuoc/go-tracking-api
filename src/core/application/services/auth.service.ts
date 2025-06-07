/* eslint-disable @typescript-eslint/no-unsafe-assignment */
// File: src/core/application/services/auth.service.ts
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */

import { Injectable, Inject } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { UserRepositoryInterface } from '../../domain/repositories/user.repository.interface';
import { User, UserRole, UserStatus } from '../../domain/entities/user.entity';
import {
  OtpService,
  OtpType,
} from '../../../infrastructure/services/otp/otp.service';
import { SmsService } from '../../../infrastructure/services/sms/sms.service';
import { PhoneUtil } from '../../../infrastructure/utils/phone.util';

// 🎯 ONLY IMPORT GraphQLErrorUtil and ErrorCode
import { GraphQLErrorUtil } from '../../../infrastructure/utils/graphql-error.util';
import { ErrorCode } from '../../errors/error-codes.enum';
import { GraphQLError } from 'graphql';

export const USER_REPOSITORY_TOKEN = 'UserRepositoryInterface';

export interface LoginDto {
  phone: string;
  password: string;
  organizationId?: number;
}

export interface RegisterDto {
  phone: string;
  password: string;
  fullName: string;
  email?: string;
  organizationId: number;
  role?: UserRole;
}

export interface VerifyEmailDto {
  token: string;
}

export interface VerifyOtpDto {
  phone: string;
  otp: string;
  type: OtpType;
}

export interface AuthResult {
  user: User;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface JwtPayload {
  sub: number;
  phone: string;
  organizationId: number;
  role: UserRole;
  iat?: number;
  exp?: number;
}

@Injectable()
export class AuthService {
  private readonly SALT_ROUNDS = 12;

  constructor(
    @Inject(USER_REPOSITORY_TOKEN)
    private readonly userRepository: UserRepositoryInterface,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly otpService: OtpService,
    private readonly smsService: SmsService,
  ) {}

  /**
   * Register new user with phone number
   */
  async register(
    registerDto: RegisterDto,
  ): Promise<{ user: User; message: string }> {
    try {
      const {
        phone,
        password,
        fullName,
        email,
        organizationId,
        role = UserRole.VISITOR,
      } = registerDto;

      // Validate and normalize phone
      const normalizedPhone = PhoneUtil.normalize(phone);
      if (!PhoneUtil.isValid(normalizedPhone)) {
        throw GraphQLErrorUtil.fromErrorCode(
          ErrorCode.INVALID_PHONE_NUMBER,
          'Định dạng số điện thoại không hợp lệ. Vui lòng nhập số điện thoại Việt Nam',
          'phone',
          { providedPhone: phone, normalizedPhone },
        );
      }

      // Validate password strength
      if (password.length < 8) {
        throw GraphQLErrorUtil.fromErrorCode(
          ErrorCode.WEAK_PASSWORD,
          'Mật khẩu phải có ít nhất 8 ký tự',
          'password',
          { minLength: 8, providedLength: password.length },
        );
      }

      // Validate full name
      if (!fullName || fullName.trim().length < 2) {
        throw GraphQLErrorUtil.fromErrorCode(
          ErrorCode.FIELD_TOO_SHORT,
          'Họ tên phải có ít nhất 2 ký tự',
          'fullName',
          { minLength: 2, providedLength: fullName?.length || 0 },
        );
      }

      // Check if user exists
      const existingUser = await this.userRepository.findByPhoneAndOrganization(
        normalizedPhone,
        organizationId,
      );

      if (existingUser) {
        throw GraphQLErrorUtil.fromErrorCode(
          ErrorCode.USER_ALREADY_EXISTS,
          'Số điện thoại này đã được đăng ký trong tổ chức',
          'phone',
          {
            phone: PhoneUtil.mask(normalizedPhone),
            organizationId,
            existingUserId: existingUser.id,
          },
        );
      }

      // Hash password
      const passwordHash = await this.hashPassword(password);

      // Create user
      const user = new User({
        phone: normalizedPhone,
        passwordHash,
        fullName: fullName.trim(),
        email: email?.trim(),
        organizationId,
        role,
        status: UserStatus.PENDING,
        isActive: true,
        phoneVerified: false,
        emailVerified: false,
        loginAttempts: 0,
      });

      const savedUser = await this.userRepository.create(user);

      // Send verification SMS
      await this.sendPhoneVerification(savedUser);

      return {
        user: savedUser,
        message:
          'Đăng ký thành công! Vui lòng kiểm tra tin nhắn để xác thực số điện thoại.',
      };
    } catch (error) {
      // 🎯 TẬN DỤNG UTILITY - convert any error to GraphQLError
      if (error instanceof GraphQLError) {
        throw error;
      }
      throw GraphQLErrorUtil.convert(error, 'Đăng ký không thành công');
    }
  }

  /**
   * Login with phone number
   */
  async login(loginDto: LoginDto): Promise<AuthResult> {
    try {
      const { phone, password, organizationId } = loginDto;

      // Validate input
      if (!phone || !password) {
        throw GraphQLErrorUtil.fromErrorCode(
          ErrorCode.REQUIRED_FIELD_MISSING,
          'Số điện thoại và mật khẩu là bắt buộc',
          !phone ? 'phone' : 'password',
        );
      }

      // Normalize phone
      const normalizedPhone = PhoneUtil.normalize(phone);
      if (!PhoneUtil.isValid(normalizedPhone)) {
        throw GraphQLErrorUtil.fromErrorCode(
          ErrorCode.INVALID_PHONE_NUMBER,
          'Định dạng số điện thoại không hợp lệ',
          'phone',
          { providedPhone: phone },
        );
      }

      // Find user
      const user = organizationId
        ? await this.userRepository.findByPhoneAndOrganization(
            normalizedPhone,
            organizationId,
          )
        : await this.userRepository.findByPhone(normalizedPhone);

      if (!user) {
        throw GraphQLErrorUtil.fromErrorCode(
          ErrorCode.INVALID_CREDENTIALS,
          'Số điện thoại hoặc mật khẩu không chính xác',
          'credentials',
          {
            phone: PhoneUtil.mask(normalizedPhone),
            organizationId,
            reason: 'user_not_found',
          },
        );
      }

      // Check account status
      if (!user.isActive) {
        throw GraphQLErrorUtil.fromErrorCode(
          ErrorCode.ACCOUNT_SUSPENDED,
          'Tài khoản đã bị vô hiệu hóa. Vui lòng liên hệ quản trị viên',
          'account',
          {
            userId: user.id,
            status: user.status,
            reason: 'account_inactive',
          },
        );
      }

      if (user.status === UserStatus.SUSPENDED) {
        throw GraphQLErrorUtil.fromErrorCode(
          ErrorCode.ACCOUNT_SUSPENDED,
          'Tài khoản đang bị tạm khóa. Vui lòng liên hệ quản trị viên',
          'account',
          {
            userId: user.id,
            status: user.status,
            reason: 'account_suspended',
          },
        );
      }

      // Check if account is temporarily locked
      if (user.isLocked()) {
        const unlockTime =
          user.lockedUntil?.toLocaleTimeString('vi-VN') || 'không xác định';
        throw GraphQLErrorUtil.fromErrorCode(
          ErrorCode.ACCOUNT_LOCKED,
          `Tài khoản tạm thời bị khóa do nhập sai mật khẩu quá nhiều lần. Thử lại sau ${unlockTime}`,
          'account',
          {
            userId: user.id,
            lockedUntil: user.lockedUntil,
            loginAttempts: user.loginAttempts,
          },
        );
      }

      // Check phone verification
      if (!user.phoneVerified) {
        throw GraphQLErrorUtil.fromErrorCode(
          ErrorCode.PHONE_NOT_VERIFIED,
          'Vui lòng xác thực số điện thoại trước khi đăng nhập',
          'phone',
          {
            userId: user.id,
            phone: PhoneUtil.mask(user.phone),
          },
        );
      }

      // Verify password
      const isPasswordValid = await this.verifyPassword(
        password,
        user.passwordHash,
      );

      if (!isPasswordValid) {
        // Increment login attempts
        await this.userRepository.incrementLoginAttempts(user.id);

        // Get updated user to check if now locked
        const updatedUser = await this.userRepository.findById(user.id);
        const remainingAttempts = 5 - (updatedUser?.loginAttempts || 0);

        if (remainingAttempts <= 0) {
          throw GraphQLErrorUtil.fromErrorCode(
            ErrorCode.ACCOUNT_LOCKED,
            'Tài khoản đã bị khóa tạm thời do nhập sai mật khẩu quá nhiều lần',
            'account',
            {
              userId: user.id,
              loginAttempts: updatedUser?.loginAttempts,
            },
          );
        }

        throw GraphQLErrorUtil.fromErrorCode(
          ErrorCode.INVALID_CREDENTIALS,
          `Số điện thoại hoặc mật khẩu không chính xác. Còn lại ${remainingAttempts} lần thử`,
          'password',
          {
            userId: user.id,
            remainingAttempts,
            reason: 'wrong_password',
          },
        );
      }

      // Check if user can login (additional business rules)
      if (!user.canLogin()) {
        throw GraphQLErrorUtil.fromErrorCode(
          ErrorCode.OPERATION_NOT_ALLOWED,
          'Tài khoản không thể đăng nhập trong thời điểm này',
          'account',
          {
            userId: user.id,
            status: user.status,
            reason: 'cannot_login',
          },
        );
      }

      // Successful login - reset attempts and update last login
      await this.userRepository.resetLoginAttempts(user.id);
      await this.userRepository.updateLastLogin(user.id);

      // Generate tokens
      const { accessToken, refreshToken } = await this.generateTokens(user);

      return {
        user,
        accessToken,
        refreshToken,
        expiresIn: 3600, // 1 hour
      };
    } catch (error) {
      if (error instanceof GraphQLError) {
        throw error;
      }
      throw GraphQLErrorUtil.convert(error, 'Đăng nhập không thành công');
    }
  }

  /**
   * Send phone verification OTP
   */
  async sendPhoneVerification(user: User): Promise<{ message: string }> {
    try {
      // Check rate limit
      const rateLimit = await this.otpService.checkRateLimit(
        user.phone,
        OtpType.PHONE_VERIFICATION,
        3, // max 3 requests
        60, // per 60 minutes
      );

      if (!rateLimit.allowed) {
        const resetTime = rateLimit.resetTime.toLocaleTimeString('vi-VN');
        throw GraphQLErrorUtil.fromErrorCode(
          ErrorCode.OTP_RATE_LIMIT,
          `Bạn đã yêu cầu quá nhiều mã xác thực. Vui lòng thử lại sau ${resetTime}`,
          'phone',
          {
            phone: PhoneUtil.mask(user.phone),
            remainingRequests: rateLimit.remainingRequests,
            resetTime: rateLimit.resetTime,
          },
        );
      }

      // Generate OTP
      const otp = await this.otpService.generateOtp(
        user.phone,
        OtpType.PHONE_VERIFICATION,
        15, // 15 minutes expiry
      );

      // Send SMS
      const smsSent = await this.smsService.sendOtp(
        user.phone,
        otp,
        'verification',
      );

      if (!smsSent) {
        throw GraphQLErrorUtil.fromErrorCode(
          ErrorCode.SMS_SEND_FAILED,
          'Không thể gửi tin nhắn xác thực. Vui lòng thử lại sau',
          'phone',
          {
            phone: PhoneUtil.mask(user.phone),
            userId: user.id,
            reason: 'sms_send_failed',
          },
        );
      }

      return {
        message: `Mã xác thực đã được gửi đến ${PhoneUtil.mask(user.phone)}. Mã có hiệu lực trong 15 phút.`,
      };
    } catch (error) {
      if (error instanceof GraphQLError) {
        throw error;
      }
      throw GraphQLErrorUtil.convert(error, 'Không thể gửi mã xác thực');
    }
  }

  /**
   * Verify phone with OTP
   */
  async verifyPhone(verifyOtpDto: VerifyOtpDto): Promise<{ message: string }> {
    try {
      const { phone, otp, type } = verifyOtpDto;

      // Validate input
      if (!phone || !otp) {
        throw GraphQLErrorUtil.fromErrorCode(
          ErrorCode.REQUIRED_FIELD_MISSING,
          'Số điện thoại và mã OTP là bắt buộc',
          !phone ? 'phone' : 'otp',
        );
      }

      const normalizedPhone = PhoneUtil.normalize(phone);
      if (!PhoneUtil.isValid(normalizedPhone)) {
        throw GraphQLErrorUtil.fromErrorCode(
          ErrorCode.INVALID_PHONE_NUMBER,
          'Định dạng số điện thoại không hợp lệ',
          'phone',
        );
      }

      if (otp.length !== 6) {
        throw GraphQLErrorUtil.fromErrorCode(
          ErrorCode.INVALID_INPUT_FORMAT,
          'Mã OTP phải có 6 chữ số',
          'otp',
          { expectedLength: 6, providedLength: otp.length },
        );
      }

      // Verify OTP
      const otpResult = await this.otpService.verifyOtp(
        normalizedPhone,
        type,
        otp,
      );

      if (!otpResult.success) {
        if (otpResult.message.includes('expired')) {
          throw GraphQLErrorUtil.fromErrorCode(
            ErrorCode.OTP_EXPIRED,
            'Mã OTP đã hết hạn. Vui lòng yêu cầu mã mới',
            'otp',
            { phone: PhoneUtil.mask(normalizedPhone) },
          );
        } else if (otpResult.message.includes('attempts')) {
          throw GraphQLErrorUtil.fromErrorCode(
            ErrorCode.OTP_MAX_ATTEMPTS,
            'Đã nhập sai mã OTP quá nhiều lần. Vui lòng yêu cầu mã mới',
            'otp',
            { phone: PhoneUtil.mask(normalizedPhone) },
          );
        } else if (otpResult.message.includes('not found')) {
          throw GraphQLErrorUtil.fromErrorCode(
            ErrorCode.OTP_NOT_FOUND,
            'Không tìm thấy mã OTP. Vui lòng yêu cầu mã mới',
            'otp',
            { phone: PhoneUtil.mask(normalizedPhone) },
          );
        } else {
          throw GraphQLErrorUtil.fromErrorCode(
            ErrorCode.OTP_INVALID,
            'Mã OTP không chính xác. Vui lòng kiểm tra lại',
            'otp',
            {
              phone: PhoneUtil.mask(normalizedPhone),
              reason: otpResult.message,
            },
          );
        }
      }

      // Find and update user
      const user = await this.userRepository.findByPhone(normalizedPhone);
      if (!user) {
        throw GraphQLErrorUtil.fromErrorCode(
          ErrorCode.RESOURCE_NOT_FOUND,
          'Không tìm thấy người dùng với số điện thoại này',
          'phone',
          { phone: PhoneUtil.mask(normalizedPhone) },
        );
      }

      // Update user verification status
      user.verifyPhone();
      await this.userRepository.update(user.id, user);

      return {
        message:
          'Xác thực số điện thoại thành công! Bạn có thể đăng nhập ngay bây giờ.',
      };
    } catch (error) {
      if (error instanceof GraphQLError) {
        throw error;
      }
      throw GraphQLErrorUtil.convert(
        error,
        'Xác thực số điện thoại không thành công',
      );
    }
  }

  /**
   * Forgot password
   */
  async forgotPassword(phone: string): Promise<{ message: string }> {
    try {
      if (!phone) {
        throw GraphQLErrorUtil.fromErrorCode(
          ErrorCode.REQUIRED_FIELD_MISSING,
          'Số điện thoại là bắt buộc',
          'phone',
        );
      }

      const normalizedPhone = PhoneUtil.normalize(phone);
      if (!PhoneUtil.isValid(normalizedPhone)) {
        throw GraphQLErrorUtil.fromErrorCode(
          ErrorCode.INVALID_PHONE_NUMBER,
          'Định dạng số điện thoại không hợp lệ',
          'phone',
        );
      }

      // Find user (for security, don't reveal if user exists or not)
      const user = await this.userRepository.findByPhone(normalizedPhone);

      // Always return the same message for security
      const securityMessage =
        'Nếu số điện thoại tồn tại trong hệ thống, mã đặt lại mật khẩu đã được gửi.';

      if (!user) {
        // Still return success message to prevent user enumeration
        return { message: securityMessage };
      }

      // Check rate limit
      const rateLimit = await this.otpService.checkRateLimit(
        normalizedPhone,
        OtpType.PASSWORD_RESET,
        3, // max 3 requests
        60, // per 60 minutes
      );

      if (!rateLimit.allowed) {
        throw GraphQLErrorUtil.fromErrorCode(
          ErrorCode.OTP_RATE_LIMIT,
          'Bạn đã yêu cầu quá nhiều mã đặt lại mật khẩu. Vui lòng thử lại sau',
          'phone',
          {
            phone: PhoneUtil.mask(normalizedPhone),
            resetTime: rateLimit.resetTime,
          },
        );
      }

      // Generate OTP
      const otp = await this.otpService.generateOtp(
        normalizedPhone,
        OtpType.PASSWORD_RESET,
        30, // 30 minutes expiry for password reset
      );

      // Send SMS
      const smsSent = await this.smsService.sendOtp(
        normalizedPhone,
        otp,
        'password-reset',
      );

      if (!smsSent) {
        throw GraphQLErrorUtil.fromErrorCode(
          ErrorCode.SMS_SEND_FAILED,
          'Không thể gửi tin nhắn. Vui lòng thử lại sau',
          'phone',
          {
            phone: PhoneUtil.mask(normalizedPhone),
            operation: 'password_reset',
          },
        );
      }

      return { message: securityMessage };
    } catch (error) {
      if (error instanceof GraphQLError) {
        throw error;
      }
      throw GraphQLErrorUtil.convert(
        error,
        'Yêu cầu đặt lại mật khẩu không thành công',
      );
    }
  }

  /**
   * Reset password with OTP
   */
  async resetPassword(
    phone: string,
    otp: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    try {
      // Validate input
      if (!phone || !otp || !newPassword) {
        const missingField = !phone ? 'phone' : !otp ? 'otp' : 'newPassword';
        throw GraphQLErrorUtil.fromErrorCode(
          ErrorCode.REQUIRED_FIELD_MISSING,
          'Số điện thoại, mã OTP và mật khẩu mới là bắt buộc',
          missingField,
        );
      }

      const normalizedPhone = PhoneUtil.normalize(phone);
      if (!PhoneUtil.isValid(normalizedPhone)) {
        throw GraphQLErrorUtil.fromErrorCode(
          ErrorCode.INVALID_PHONE_NUMBER,
          'Định dạng số điện thoại không hợp lệ',
          'phone',
        );
      }

      if (otp.length !== 6) {
        throw GraphQLErrorUtil.fromErrorCode(
          ErrorCode.INVALID_INPUT_FORMAT,
          'Mã OTP phải có 6 chữ số',
          'otp',
        );
      }

      if (newPassword.length < 8) {
        throw GraphQLErrorUtil.fromErrorCode(
          ErrorCode.WEAK_PASSWORD,
          'Mật khẩu mới phải có ít nhất 8 ký tự',
          'newPassword',
          { minLength: 8, providedLength: newPassword.length },
        );
      }

      // Verify OTP
      const otpResult = await this.otpService.verifyOtp(
        normalizedPhone,
        OtpType.PASSWORD_RESET,
        otp,
      );

      if (!otpResult.success) {
        if (otpResult.message.includes('expired')) {
          throw GraphQLErrorUtil.fromErrorCode(
            ErrorCode.OTP_EXPIRED,
            'Mã đặt lại mật khẩu đã hết hạn. Vui lòng yêu cầu mã mới',
            'otp',
          );
        } else {
          throw GraphQLErrorUtil.fromErrorCode(
            ErrorCode.OTP_INVALID,
            'Mã OTP không chính xác. Vui lòng kiểm tra lại',
            'otp',
          );
        }
      }

      // Find user
      const user = await this.userRepository.findByPhone(normalizedPhone);
      if (!user) {
        throw GraphQLErrorUtil.fromErrorCode(
          ErrorCode.RESOURCE_NOT_FOUND,
          'Không tìm thấy người dùng',
          'phone',
          { phone: PhoneUtil.mask(normalizedPhone) },
        );
      }

      // Hash new password
      const passwordHash = await this.hashPassword(newPassword);

      // Update user
      user.passwordHash = passwordHash;
      user.loginAttempts = 0;
      user.lockedUntil = undefined;

      await this.userRepository.update(user.id, user);

      return {
        message:
          'Đặt lại mật khẩu thành công! Bạn có thể đăng nhập với mật khẩu mới.',
      };
    } catch (error) {
      if (error instanceof GraphQLError) {
        throw error;
      }
      throw GraphQLErrorUtil.convert(
        error,
        'Đặt lại mật khẩu không thành công',
      );
    }
  }

  /**
   * Refresh token
   */
  async refreshToken(refreshToken: string): Promise<AuthResult> {
    try {
      if (!refreshToken) {
        throw GraphQLErrorUtil.fromErrorCode(
          ErrorCode.REQUIRED_FIELD_MISSING,
          'Refresh token là bắt buộc',
          'refreshToken',
        );
      }

      // Verify refresh token
      let payload: JwtPayload;
      try {
        payload = this.jwtService.verify<JwtPayload>(refreshToken);
      } catch {
        throw GraphQLErrorUtil.fromErrorCode(
          ErrorCode.TOKEN_EXPIRED,
          'Refresh token không hợp lệ hoặc đã hết hạn',
          'refreshToken',
          { reason: 'invalid_refresh_token' },
        );
      }

      // Find user
      const user = await this.userRepository.findById(payload.sub);
      if (!user) {
        throw GraphQLErrorUtil.fromErrorCode(
          ErrorCode.RESOURCE_NOT_FOUND,
          'Không tìm thấy người dùng',
          'userId',
          { userId: payload.sub },
        );
      }

      // Check if user can still login
      if (!user.canLogin()) {
        throw GraphQLErrorUtil.fromErrorCode(
          ErrorCode.INVALID_TOKEN,
          'Tài khoản không còn quyền truy cập. Vui lòng đăng nhập lại',
          'account',
          {
            userId: user.id,
            reason: 'account_status_changed',
          },
        );
      }

      // Generate new tokens
      const { accessToken, refreshToken: newRefreshToken } =
        await this.generateTokens(user);

      return {
        user,
        accessToken,
        refreshToken: newRefreshToken,
        expiresIn: 3600,
      };
    } catch (error) {
      if (error instanceof GraphQLError) {
        throw error;
      }
      throw GraphQLErrorUtil.convert(error, 'Làm mới token không thành công');
    }
  }

  /**
   * Validate JWT payload
   */
  async validateJwtPayload(payload: JwtPayload): Promise<User> {
    try {
      if (!payload || !payload.sub) {
        throw GraphQLErrorUtil.fromErrorCode(
          ErrorCode.INVALID_TOKEN,
          'Token payload không hợp lệ',
          'token',
          { reason: 'invalid_payload' },
        );
      }

      const user = await this.userRepository.findById(payload.sub);
      if (!user) {
        throw GraphQLErrorUtil.fromErrorCode(
          ErrorCode.RESOURCE_NOT_FOUND,
          'Không tìm thấy người dùng',
          'userId',
          { userId: payload.sub },
        );
      }

      if (!user.canLogin()) {
        throw GraphQLErrorUtil.fromErrorCode(
          ErrorCode.INVALID_TOKEN,
          'Tài khoản không còn quyền truy cập',
          'account',
          {
            userId: user.id,
            status: user.status,
            isActive: user.isActive,
          },
        );
      }

      return user;
    } catch (error) {
      if (error instanceof GraphQLError) {
        throw error;
      }
      throw GraphQLErrorUtil.convert(error, 'Xác thực token không thành công');
    }
  }

  // Private helper methods
  private async hashPassword(password: string): Promise<string> {
    try {
      return await bcrypt.hash(password, this.SALT_ROUNDS);
    } catch (error) {
      throw GraphQLErrorUtil.fromErrorCode(
        ErrorCode.INTERNAL_SERVER_ERROR,
        'Không thể xử lý mật khẩu',
        'password',
        { error: error.message },
      );
    }
  }

  private async verifyPassword(
    password: string,
    hashedPassword: string,
  ): Promise<boolean> {
    try {
      return await bcrypt.compare(password, hashedPassword);
    } catch (error) {
      throw GraphQLErrorUtil.fromErrorCode(
        ErrorCode.INTERNAL_SERVER_ERROR,
        'Không thể xác thực mật khẩu',
        'password',
        { error: error.message },
      );
    }
  }

  private async generateTokens(
    user: User,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    try {
      const payload: JwtPayload = {
        sub: user.id,
        phone: user.phone,
        organizationId: user.organizationId,
        role: user.role,
      };

      const [accessToken, refreshToken] = await Promise.all([
        this.jwtService.signAsync(payload, { expiresIn: '1h' }),
        this.jwtService.signAsync(payload, { expiresIn: '7d' }),
      ]);

      return { accessToken, refreshToken };
    } catch (error) {
      const errorMessage =
        typeof error === 'object' && error && 'message' in error
          ? String((error as { message?: unknown }).message)
          : String(error);

      throw GraphQLErrorUtil.fromErrorCode(
        ErrorCode.INTERNAL_SERVER_ERROR,
        'Không thể tạo token xác thực',
        'token',
        { error: errorMessage, userId: user.id },
      );
    }
  }
}
