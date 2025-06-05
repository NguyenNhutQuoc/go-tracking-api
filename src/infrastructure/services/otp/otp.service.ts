// src/infrastructure/services/otp/otp.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cache } from 'cache-manager';
import { Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';

export enum OtpType {
  EMAIL_VERIFICATION = 'email_verification',
  PHONE_VERIFICATION = 'phone_verification',
  PASSWORD_RESET = 'password_reset',
  LOGIN_2FA = 'login_2fa',
}

export interface OtpData {
  code: string;
  type: OtpType;
  identifier: string; // email or phone
  attempts: number;
  createdAt: Date;
  expiresAt: Date;
}

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);
  private readonly OTP_LENGTH = 6;
  private readonly MAX_ATTEMPTS = 3;

  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Generate and store OTP in Redis
   */
  async generateOtp(
    identifier: string,
    type: OtpType,
    expiryMinutes: number = 10,
  ): Promise<string> {
    // Generate 6-digit OTP
    const code = this.generateOtpCode();

    // Create OTP data
    const otpData: OtpData = {
      code,
      type,
      identifier,
      attempts: 0,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + expiryMinutes * 60 * 1000),
    };

    // Store in Redis with expiry
    const key = this.getOtpKey(identifier, type);
    await this.cacheManager.set(key, otpData, expiryMinutes * 60 * 1000);

    this.logger.log(`OTP generated for ${identifier} (${type}): ${code}`);
    return code;
  }

  /**
   * Verify OTP
   */
  async verifyOtp(
    identifier: string,
    type: OtpType,
    code: string,
  ): Promise<{ success: boolean; message: string }> {
    const key = this.getOtpKey(identifier, type);
    const otpData: OtpData | undefined | null =
      await this.cacheManager.get(key);

    if (!otpData) {
      return {
        success: false,
        message: 'OTP not found or expired',
      };
    }

    // Check if OTP is expired
    if (new Date() > otpData.expiresAt) {
      await this.cacheManager.del(key);
      return {
        success: false,
        message: 'OTP has expired',
      };
    }

    // Check attempts
    if (otpData.attempts >= this.MAX_ATTEMPTS) {
      await this.cacheManager.del(key);
      return {
        success: false,
        message: 'Maximum verification attempts exceeded',
      };
    }

    // Verify code
    if (otpData.code !== code) {
      // Increment attempts
      otpData.attempts += 1;
      await this.cacheManager.set(
        key,
        otpData,
        this.getRemainingTtl(otpData.expiresAt),
      );

      return {
        success: false,
        message: `Invalid OTP. ${this.MAX_ATTEMPTS - otpData.attempts} attempts remaining`,
      };
    }

    // Success - remove OTP from cache
    await this.cacheManager.del(key);

    this.logger.log(`OTP verified successfully for ${identifier} (${type})`);
    return {
      success: true,
      message: 'OTP verified successfully',
    };
  }

  /**
   * Check if OTP exists and is valid
   */
  async checkOtpExists(identifier: string, type: OtpType): Promise<boolean> {
    const key = this.getOtpKey(identifier, type);
    const otpData: OtpData | undefined | null =
      await this.cacheManager.get(key);

    if (!otpData) return false;

    // Check if expired
    if (new Date() > otpData.expiresAt) {
      await this.cacheManager.del(key);
      return false;
    }

    return true;
  }

  /**
   * Get OTP information (for testing or admin purposes)
   */
  async getOtpInfo(
    identifier: string,
    type: OtpType,
  ): Promise<Partial<OtpData> | null> {
    const key = this.getOtpKey(identifier, type);
    const otpData: OtpData | undefined | null =
      await this.cacheManager.get(key);

    if (!otpData) return null;

    // Return info without the actual code (for security)
    return {
      type: otpData.type,
      identifier: otpData.identifier,
      attempts: otpData.attempts,
      createdAt: otpData.createdAt,
      expiresAt: otpData.expiresAt,
    };
  }

  /**
   * Revoke/delete OTP
   */
  async revokeOtp(identifier: string, type: OtpType): Promise<boolean> {
    const key = this.getOtpKey(identifier, type);
    await this.cacheManager.del(key);
    this.logger.log(`OTP revoked for ${identifier} (${type})`);
    return true;
  }

  /**
   * Generate rate limiting key for OTP requests
   */
  async checkRateLimit(
    identifier: string,
    type: OtpType,
    maxRequests: number = 5,
    windowMinutes: number = 60,
  ): Promise<{ allowed: boolean; remainingRequests: number; resetTime: Date }> {
    const key = this.getRateLimitKey(identifier, type);
    const currentCount: number = (await this.cacheManager.get(key)) || 0;

    if (currentCount >= maxRequests) {
      const ttl = await this.cacheManager.ttl(key);
      const resetTime = new Date(Date.now() + (ttl ?? 0) * 1000);

      return {
        allowed: false,
        remainingRequests: 0,
        resetTime,
      };
    }

    // Increment counter
    const newCount = currentCount + 1;
    await this.cacheManager.set(key, newCount, windowMinutes * 60 * 1000);

    return {
      allowed: true,
      remainingRequests: maxRequests - newCount,
      resetTime: new Date(Date.now() + windowMinutes * 60 * 1000),
    };
  }

  /**
   * Private helper methods
   */
  private generateOtpCode(): string {
    const min = Math.pow(10, this.OTP_LENGTH - 1);
    const max = Math.pow(10, this.OTP_LENGTH) - 1;
    return Math.floor(Math.random() * (max - min + 1) + min).toString();
  }

  private getOtpKey(identifier: string, type: OtpType): string {
    return `otp:${type}:${identifier}`;
  }

  private getRateLimitKey(identifier: string, type: OtpType): string {
    return `otp_rate_limit:${type}:${identifier}`;
  }

  private getRemainingTtl(expiresAt: Date): number {
    const now = new Date();
    const remaining = expiresAt.getTime() - now.getTime();
    return Math.max(0, Math.floor(remaining / 1000)); // Convert to seconds
  }
}
