/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-unsafe-return */
// src/core/application/services/auth.service.ts
import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
  Inject,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { UserRepositoryInterface } from '../../domain/repositories/user.repository.interface';
import { User, UserRole, UserStatus } from '../../domain/entities/user.entity';
import {
  OtpService,
  OtpType,
} from '../../../infrastructure/services/otp/otp.service';
import { NotificationService } from '../../../infrastructure/services/notification/notification.service';

// ✅ Define token constant for consistency
export const USER_REPOSITORY_TOKEN = 'UserRepositoryInterface';

export interface LoginDto {
  email: string;
  password: string;
  organizationId?: number;
}

export interface RegisterDto {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
  organizationId: number;
  role?: UserRole;
}

export interface VerifyEmailDto {
  token: string;
}

export interface VerifyOtpDto {
  email: string;
  otp: string;
  type: OtpType;
}

export interface ResetPasswordDto {
  token: string;
  newPassword: string;
}

export interface ForgotPasswordDto {
  email: string;
  organizationId?: number;
}

export interface AuthResult {
  user: User;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface JwtPayload {
  sub: number; // user ID
  email: string;
  organizationId: number;
  role: UserRole;
  iat?: number;
  exp?: number;
}

@Injectable()
export class AuthService {
  private readonly SALT_ROUNDS = 12;
  private readonly JWT_EXPIRY = '1h';
  private readonly REFRESH_TOKEN_EXPIRY = '7d';

  constructor(
    @Inject(USER_REPOSITORY_TOKEN)
    private readonly userRepository: UserRepositoryInterface,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly otpService: OtpService,
    private readonly notificationService: NotificationService,
  ) {}

  /**
   * User Registration
   */
  async register(
    registerDto: RegisterDto,
  ): Promise<{ user: User; message: string }> {
    const {
      email,
      password,
      fullName,
      phone,
      organizationId,
      role = UserRole.VISITOR,
    } = registerDto;

    // Check if user already exists
    const existingUser = await this.userRepository.findByEmailAndOrganization(
      email,
      organizationId,
    );
    if (existingUser) {
      throw new ConflictException(
        'User with this email already exists in the organization',
      );
    }

    // Hash password
    const passwordHash = await this.hashPassword(password);

    // Create user
    const user = new User({
      email,
      passwordHash,
      fullName,
      phone,
      organizationId,
      role,
      status: UserStatus.PENDING,
      isActive: true,
      emailVerified: false,
      phoneVerified: false,
      loginAttempts: 0,
    });

    const savedUser = await this.userRepository.create(user);

    // Send email verification
    await this.sendEmailVerification(savedUser);

    return {
      user: savedUser,
      message:
        'User registered successfully. Please check your email for verification.',
    };
  }

  /**
   * User Login
   */
  async login(loginDto: LoginDto): Promise<AuthResult> {
    const { email, password, organizationId } = loginDto;

    // Find user
    const user = organizationId
      ? await this.userRepository.findByEmailAndOrganization(
          email,
          organizationId,
        )
      : await this.userRepository.findByEmail(email);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if user can login
    if (!user.canLogin()) {
      if (user.isLocked()) {
        throw new UnauthorizedException(
          'Account is temporarily locked due to too many failed login attempts',
        );
      }
      if (!user.emailVerified) {
        throw new UnauthorizedException(
          'Please verify your email before logging in',
        );
      }
      if (user.status !== UserStatus.ACTIVE) {
        throw new UnauthorizedException('Account is not active');
      }
      throw new UnauthorizedException('Account access denied');
    }

    // Verify password
    const isPasswordValid = await this.verifyPassword(
      password,
      user.passwordHash,
    );
    if (!isPasswordValid) {
      // Increment login attempts
      await this.userRepository.incrementLoginAttempts(user.id);
      throw new UnauthorizedException('Invalid credentials');
    }

    // Reset login attempts and update last login
    await this.userRepository.resetLoginAttempts(user.id);
    await this.userRepository.updateLastLogin(user.id);

    // Generate tokens
    const { accessToken, refreshToken } = await this.generateTokens(user);

    return {
      user,
      accessToken,
      refreshToken,
      expiresIn: 3600, // 1 hour in seconds
    };
  }

  /**
   * Send Email Verification
   */
  async sendEmailVerification(user: User): Promise<{ message: string }> {
    // Check rate limit
    const rateLimit = await this.otpService.checkRateLimit(
      user.email,
      OtpType.EMAIL_VERIFICATION,
      3, // Max 3 requests
      60, // Per hour
    );

    if (!rateLimit.allowed) {
      throw new BadRequestException(
        `Too many verification requests. Try again after ${rateLimit.resetTime.toLocaleTimeString()}`,
      );
    }

    // Generate OTP
    const otp = await this.otpService.generateOtp(
      user.email,
      OtpType.EMAIL_VERIFICATION,
      15, // 15 minutes expiry
    );

    // Send email
    const emailSent = await this.notificationService.sendEmail(
      user.email,
      'Verify Your Email - GoTracking',
      `Hello ${user.fullName},\n\nYour email verification code is: ${otp}\n\nThis code will expire in 15 minutes.\n\nBest regards,\nGoTracking Team`,
    );

    if (!emailSent) {
      throw new BadRequestException('Failed to send verification email');
    }

    return {
      message: 'Verification email sent successfully',
    };
  }

  /**
   * Verify Email with OTP
   */
  async verifyEmail(verifyOtpDto: VerifyOtpDto): Promise<{ message: string }> {
    const { email, otp, type } = verifyOtpDto;

    // Verify OTP
    const otpResult = await this.otpService.verifyOtp(email, type, otp);
    if (!otpResult.success) {
      throw new BadRequestException(otpResult.message);
    }

    // Find user and update email verification status
    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      throw new BadRequestException('User not found');
    }

    user.verifyEmail();
    if (user.status === UserStatus.PENDING) {
      user.status = UserStatus.ACTIVE;
    }

    await this.userRepository.update(user.id, user);

    return {
      message: 'Email verified successfully',
    };
  }

  /**
   * Forgot Password
   */
  async forgotPassword(
    forgotPasswordDto: ForgotPasswordDto,
  ): Promise<{ message: string }> {
    const { email, organizationId } = forgotPasswordDto;

    // Find user
    const user = organizationId
      ? await this.userRepository.findByEmailAndOrganization(
          email,
          organizationId,
        )
      : await this.userRepository.findByEmail(email);

    // Always return success message (don't reveal if email exists)
    if (!user) {
      return {
        message: 'If the email exists, a password reset link has been sent',
      };
    }

    // Check rate limit
    const rateLimit = await this.otpService.checkRateLimit(
      user.email,
      OtpType.PASSWORD_RESET,
      3, // Max 3 requests
      60, // Per hour
    );

    if (!rateLimit.allowed) {
      throw new BadRequestException(
        `Too many password reset requests. Try again after ${rateLimit.resetTime.toLocaleTimeString()}`,
      );
    }

    // Generate OTP
    const otp = await this.otpService.generateOtp(
      user.email,
      OtpType.PASSWORD_RESET,
      30, // 30 minutes expiry
    );

    // Send email
    await this.notificationService.sendEmail(
      user.email,
      'Password Reset - GoTracking',
      `Hello ${user.fullName},\n\nYour password reset code is: ${otp}\n\nThis code will expire in 30 minutes.\n\nIf you didn't request this, please ignore this email.\n\nBest regards,\nGoTracking Team`,
    );

    return {
      message: 'If the email exists, a password reset link has been sent',
    };
  }

  /**
   * Reset Password with OTP
   */
  async resetPassword(
    email: string,
    otp: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    // Verify OTP
    const otpResult = await this.otpService.verifyOtp(
      email,
      OtpType.PASSWORD_RESET,
      otp,
    );
    if (!otpResult.success) {
      throw new BadRequestException(otpResult.message);
    }

    // Find user
    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      throw new BadRequestException('User not found');
    }

    // Hash new password
    const passwordHash = await this.hashPassword(newPassword);

    // Update user
    user.passwordHash = passwordHash;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    user.loginAttempts = 0;
    user.lockedUntil = undefined;

    await this.userRepository.update(user.id, user);

    return {
      message: 'Password reset successfully',
    };
  }

  /**
   * Refresh Token
   */
  async refreshToken(refreshToken: string): Promise<AuthResult> {
    try {
      const payload = this.jwtService.verify<JwtPayload>(refreshToken);
      const user = await this.userRepository.findById(payload.sub);

      if (!user || !user.canLogin()) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const { accessToken, refreshToken: newRefreshToken } =
        await this.generateTokens(user);

      return {
        user,
        accessToken,
        refreshToken: newRefreshToken,
        expiresIn: 3600,
      };
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  /**
   * Validate JWT Payload
   */
  async validateJwtPayload(payload: JwtPayload): Promise<User> {
    const user = await this.userRepository.findById(payload.sub);

    if (!user || !user.canLogin()) {
      throw new UnauthorizedException('User not found or inactive');
    }

    return user;
  }

  /**
   * Private helper methods
   */
  private async hashPassword(password: string): Promise<string> {
    return bcrypt.hashSync(password, this.SALT_ROUNDS);
  }

  private async verifyPassword(
    password: string,
    hashedPassword: string,
  ): Promise<boolean> {
    console.log('Verifying password:', password, hashedPassword);
    console.log(
      'Hashed password:',
      await bcrypt.compareSync(password, hashedPassword),
    );
    return bcrypt.compareSync(password, hashedPassword);
  }

  private async generateTokens(
    user: User,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      organizationId: user.organizationId,
      role: user.role,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        expiresIn: this.JWT_EXPIRY,
      }),
      this.jwtService.signAsync(payload, {
        expiresIn: this.REFRESH_TOKEN_EXPIRY,
      }),
    ]);

    return { accessToken, refreshToken };
  }
}
