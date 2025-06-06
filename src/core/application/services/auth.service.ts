/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/require-await */
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
import { SmsService } from '../../../infrastructure/services/sms/sms.service';
import { PhoneUtil } from '../../../infrastructure/utils/phone.util';

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
    const {
      phone,
      password,
      fullName,
      email,
      organizationId,
      role = UserRole.VISITOR,
    } = registerDto;

    // Normalize phone
    const normalizedPhone = PhoneUtil.normalize(phone);

    if (!PhoneUtil.isValid(normalizedPhone)) {
      throw new BadRequestException('Invalid phone number format');
    }

    // Check if user exists
    const existingUser = await this.userRepository.findByPhoneAndOrganization(
      normalizedPhone,
      organizationId,
    );

    if (existingUser) {
      throw new ConflictException('User with this phone number already exists');
    }

    // Hash password
    const passwordHash = await this.hashPassword(password);

    // Create user
    const user = new User({
      phone: normalizedPhone,
      passwordHash,
      fullName,
      email,
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
      message: 'User registered successfully. Please verify your phone number.',
    };
  }

  /**
   * Login with phone number
   */
  async login(loginDto: LoginDto): Promise<AuthResult> {
    const { phone, password, organizationId } = loginDto;

    // Normalize phone
    const normalizedPhone = PhoneUtil.normalize(phone);

    // Find user
    const user = organizationId
      ? await this.userRepository.findByPhoneAndOrganization(
          normalizedPhone,
          organizationId,
        )
      : await this.userRepository.findByPhone(normalizedPhone);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if user can login
    if (!user.canLogin()) {
      if (user.isLocked()) {
        throw new UnauthorizedException('Account is temporarily locked');
      }
      if (!user.phoneVerified) {
        throw new UnauthorizedException(
          'Please verify your phone number first',
        );
      }
      throw new UnauthorizedException('Account access denied');
    }

    // Verify password
    const isPasswordValid = await this.verifyPassword(
      password,
      user.passwordHash,
    );
    if (!isPasswordValid) {
      await this.userRepository.incrementLoginAttempts(user.id);
      throw new UnauthorizedException('Invalid credentials');
    }

    // Update login info
    await this.userRepository.resetLoginAttempts(user.id);
    await this.userRepository.updateLastLogin(user.id);

    // Generate tokens
    const { accessToken, refreshToken } = await this.generateTokens(user);

    return {
      user,
      accessToken,
      refreshToken,
      expiresIn: 3600,
    };
  }

  /**
   * Send phone verification OTP
   */
  async sendPhoneVerification(user: User): Promise<{ message: string }> {
    // Check rate limit
    const rateLimit = await this.otpService.checkRateLimit(
      user.phone,
      OtpType.PHONE_VERIFICATION,
      3,
      60,
    );

    if (!rateLimit.allowed) {
      throw new BadRequestException(
        `Too many verification requests. Try again after ${rateLimit.resetTime.toLocaleTimeString()}`,
      );
    }

    // Generate OTP
    const otp = await this.otpService.generateOtp(
      user.phone,
      OtpType.PHONE_VERIFICATION,
      15,
    );

    console.log(`Generated OTP for ${user.phone}: ${otp}`); // For debugging, remove in production

    // Send SMS
    const smsSent = await this.smsService.sendOtp(
      user.phone,
      otp,
      'verification',
    );

    if (!smsSent) {
      throw new BadRequestException('Failed to send verification SMS');
    }

    return { message: 'Verification SMS sent successfully' };
  }

  /**
   * Verify phone with OTP
   */
  async verifyPhone(verifyOtpDto: VerifyOtpDto): Promise<{ message: string }> {
    const { phone, otp, type } = verifyOtpDto;

    const normalizedPhone = PhoneUtil.normalize(phone);

    // Verify OTP
    const otpResult = await this.otpService.verifyOtp(
      normalizedPhone,
      type,
      otp,
    );
    if (!otpResult.success) {
      throw new BadRequestException(otpResult.message);
    }

    // Find and update user
    const user = await this.userRepository.findByPhone(normalizedPhone);
    if (!user) {
      throw new BadRequestException('User not found');
    }

    user.verifyPhone();
    await this.userRepository.update(user.id, user);

    return { message: 'Phone verified successfully' };
  }

  /**
   * Forgot password
   */
  async forgotPassword(phone: string): Promise<{ message: string }> {
    const normalizedPhone = PhoneUtil.normalize(phone);

    // Find user (don't reveal if exists)
    const user = await this.userRepository.findByPhone(normalizedPhone);

    if (!user) {
      return {
        message:
          'If the phone number exists, a password reset code has been sent',
      };
    }

    // Check rate limit
    const rateLimit = await this.otpService.checkRateLimit(
      normalizedPhone,
      OtpType.PASSWORD_RESET,
      3,
      60,
    );

    if (!rateLimit.allowed) {
      throw new BadRequestException(
        `Too many password reset requests. Try again later.`,
      );
    }

    // Generate OTP
    const otp = await this.otpService.generateOtp(
      normalizedPhone,
      OtpType.PASSWORD_RESET,
      30,
    );

    // Send SMS
    await this.smsService.sendOtp(normalizedPhone, otp, 'password-reset');

    return {
      message:
        'If the phone number exists, a password reset code has been sent',
    };
  }

  /**
   * Reset password with OTP
   */
  async resetPassword(
    phone: string,
    otp: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    const normalizedPhone = PhoneUtil.normalize(phone);

    // Verify OTP
    const otpResult = await this.otpService.verifyOtp(
      normalizedPhone,
      OtpType.PASSWORD_RESET,
      otp,
    );
    if (!otpResult.success) {
      throw new BadRequestException(otpResult.message);
    }

    // Find user
    const user = await this.userRepository.findByPhone(normalizedPhone);
    if (!user) {
      throw new BadRequestException('User not found');
    }

    // Hash new password
    const passwordHash = await this.hashPassword(newPassword);

    // Update user
    user.passwordHash = passwordHash;
    user.loginAttempts = 0;
    user.lockedUntil = undefined;

    await this.userRepository.update(user.id, user);

    return { message: 'Password reset successfully' };
  }

  /**
   * Refresh token
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
   * Validate JWT payload
   */
  async validateJwtPayload(payload: JwtPayload): Promise<User> {
    const user = await this.userRepository.findById(payload.sub);

    if (!user || !user.canLogin()) {
      throw new UnauthorizedException('User not found or inactive');
    }

    return user;
  }

  // Private methods
  private async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.SALT_ROUNDS);
  }

  private async verifyPassword(
    password: string,
    hashedPassword: string,
  ): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
  }

  private async generateTokens(
    user: User,
  ): Promise<{ accessToken: string; refreshToken: string }> {
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
  }
}
