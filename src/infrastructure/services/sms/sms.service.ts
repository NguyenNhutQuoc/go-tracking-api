import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PhoneUtil } from '../../utils/phone.util';

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  constructor(private readonly configService: ConfigService) {}

  // eslint-disable-next-line @typescript-eslint/require-await
  async sendSms(
    phone: string,
    message: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const normalizedPhone = PhoneUtil.normalize(phone);

      if (!PhoneUtil.isValid(normalizedPhone)) {
        return { success: false, error: 'Invalid phone number' };
      }

      const smsEnabled = this.configService.get<boolean>('SMS_ENABLED', false);

      if (!smsEnabled) {
        // Development mode - just log
        this.logger.log(
          `📱 SMS to ${PhoneUtil.mask(normalizedPhone)}: ${message}`,
        );
        return { success: true };
      }

      // TODO: Integrate with real SMS provider (eSMS, VietGuys, etc.)
      // For now, simulate success
      this.logger.log(`📱 Sending SMS to ${PhoneUtil.mask(normalizedPhone)}`);

      return { success: true };
    } catch (error) {
      this.logger.error('Failed to send SMS:', error);
      const errorMessage =
        error && typeof error === 'object' && 'message' in error
          ? String((error as { message: unknown }).message)
          : 'Unknown error';
      return { success: false, error: errorMessage };
    }
  }

  async sendOtp(
    phone: string,
    otp: string,
    purpose: 'verification' | 'password-reset' | 'login-2fa',
  ): Promise<boolean> {
    const messages: Record<
      'verification' | 'password-reset' | 'login-2fa',
      string
    > = {
      verification: `GoTracking: Ma xac thuc cua ban la ${otp}. Co hieu luc trong 15 phut.`,
      'password-reset': `GoTracking: Ma dat lai mat khau: ${otp}. Co hieu luc trong 30 phut.`,
      'login-2fa': `GoTracking: Ma dang nhap: ${otp}. Co hieu luc trong 5 phut.`,
    };

    const message = messages[purpose] ?? `GoTracking: Ma OTP cua ban la ${otp}`;
    const result = await this.sendSms(phone, message);

    return result.success;
  }
}
