import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cache } from 'cache-manager';
import { Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';

export enum OtpType {
  PHONE_VERIFICATION = 'phone_verification',
  PASSWORD_RESET = 'password_reset',
  LOGIN_2FA = 'login_2fa',
}

export interface OtpData {
  code: string;
  type: OtpType;
  phone: string;
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

  async generateOtp(
    phone: string,
    type: OtpType,
    expiryMinutes: number = 15,
  ): Promise<string> {
    const code = this.generateCode();

    const otpData: OtpData = {
      code,
      type,
      phone,
      attempts: 0,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + expiryMinutes * 60 * 1000),
    };

    const key = this.getOtpKey(phone, type);
    await this.cacheManager.set(key, otpData, expiryMinutes * 60 * 1000);

    console.log(`OTP generated for key: ${key}`);

    this.logger.log(
      `OTP generated for ${phone.substring(0, 6)}***${phone.substring(phone.length - 3)}`,
    );
    return code;
  }

  async verifyOtp(
    phone: string,
    type: OtpType,
    code: string,
  ): Promise<{ success: boolean; message: string }> {
    const key = this.getOtpKey(phone, type);
    console.log(`Verifying OTP for key: ${key}`);
    console.log(await this.cacheManager.get(key));
    const otpData: OtpData | null = await this.cacheManager.get(key);

    if (!otpData) {
      return { success: false, message: 'OTP not found or expired' };
    }

    if (new Date() > otpData.expiresAt) {
      await this.cacheManager.del(key);
      return { success: false, message: 'OTP has expired' };
    }

    if (otpData.attempts >= this.MAX_ATTEMPTS) {
      await this.cacheManager.del(key);
      return {
        success: false,
        message: 'Maximum verification attempts exceeded',
      };
    }

    if (otpData.code !== code) {
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

    await this.cacheManager.del(key);
    this.logger.log(
      `OTP verified successfully for ${phone.substring(0, 6)}***`,
    );

    return { success: true, message: 'OTP verified successfully' };
  }

  async checkRateLimit(
    phone: string,
    type: OtpType,
    maxRequests: number = 5,
    windowMinutes: number = 60,
  ): Promise<{ allowed: boolean; remainingRequests: number; resetTime: Date }> {
    const key = this.getRateLimitKey(phone, type);
    const currentCount: number = (await this.cacheManager.get(key)) || 0;

    if (currentCount >= maxRequests) {
      const ttl = await this.cacheManager.ttl(key);
      const resetTime = new Date(Date.now() + (ttl || 0) * 1000);
      return { allowed: false, remainingRequests: 0, resetTime };
    }

    const newCount = currentCount + 1;
    await this.cacheManager.set(key, newCount, windowMinutes * 60 * 1000);

    return {
      allowed: true,
      remainingRequests: maxRequests - newCount,
      resetTime: new Date(Date.now() + windowMinutes * 60 * 1000),
    };
  }

  private generateCode(): string {
    const min = Math.pow(10, this.OTP_LENGTH - 1);
    const max = Math.pow(10, this.OTP_LENGTH) - 1;
    return Math.floor(Math.random() * (max - min + 1) + min).toString();
  }

  private getOtpKey(phone: string, type: OtpType): string {
    return `otp:${type}:${phone}`;
  }

  private getRateLimitKey(phone: string, type: OtpType): string {
    return `otp_rate_limit:${type}:${phone}`;
  }

  private getRemainingTtl(expiresAt: Date): number {
    const remaining = expiresAt.getTime() - Date.now();
    return Math.max(0, Math.floor(remaining / 1000));
  }
}
