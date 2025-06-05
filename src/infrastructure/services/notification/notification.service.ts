/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
// src/infrastructure/services/notification/notification.service.ts - COMPLETE VERSION
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BrevoEmailService } from '../email/brevo-email.service';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly brevoEmailService: BrevoEmailService,
  ) {}

  async sendEmail(to: string, subject: string, body: string): Promise<boolean> {
    try {
      // Check if email is enabled
      const emailEnabled = this.configService.get<boolean>(
        'OTP_EMAIL_ENABLED',
        true,
      );
      if (!emailEnabled) {
        this.logger.warn('Email sending is disabled');
        return false;
      }

      // For development/testing
      const testMode = this.configService.get<boolean>(
        'EMAIL_TEST_MODE',
        false,
      );
      const testRecipient = this.configService.get<string>(
        'EMAIL_TEST_RECIPIENT',
      );

      const finalRecipient = testMode && testRecipient ? testRecipient : to;

      if (testMode) {
        this.logger.log(
          `📧 TEST MODE: Email would be sent to ${to}, redirecting to ${finalRecipient}`,
        );
      }

      // Use Brevo service to send email
      const result = await this.brevoEmailService.sendEmail(
        finalRecipient,
        subject,
        this.convertTextToHtml(body), // Convert plain text to basic HTML
        body, // Keep original as text content
      );

      if (result.success) {
        this.logger.log(`✅ Email sent successfully to ${finalRecipient}`);
        return true;
      } else {
        this.logger.error(
          `❌ Failed to send email to ${finalRecipient}: ${result.error}`,
        );
        return false;
      }
    } catch (error) {
      this.logger.error('❌ Error sending email:', error);
      return false;
    }
  }

  async sendOtpEmail(
    to: string,
    fullName: string,
    otp: string,
    type: 'email_verification' | 'password_reset' | 'login_2fa',
    expiryMinutes: number = 15,
  ): Promise<boolean> {
    try {
      const result = await this.brevoEmailService.sendOtpEmail(
        to,
        fullName,
        otp,
        type,
        expiryMinutes,
      );

      if (result.success) {
        this.logger.log(`✅ OTP email (${type}) sent successfully to ${to}`);
        return true;
      } else {
        this.logger.error(
          `❌ Failed to send OTP email to ${to}: ${result.error}`,
        );
        return false;
      }
    } catch (error) {
      this.logger.error(`❌ Error sending OTP email to ${to}:`, error);
      return false;
    }
  }

  async sendWelcomeEmail(
    to: string,
    fullName: string,
    organizationName: string,
    role: string,
  ): Promise<boolean> {
    try {
      const welcomeEnabled = this.configService.get<boolean>(
        'WELCOME_EMAIL_ENABLED',
        true,
      );
      if (!welcomeEnabled) {
        this.logger.log('Welcome email is disabled');
        return true; // Return true to not block user registration
      }

      const result = await this.brevoEmailService.sendWelcomeEmail(
        to,
        fullName,
        organizationName,
        role,
      );

      if (result.success) {
        this.logger.log(`✅ Welcome email sent successfully to ${to}`);
        return true;
      } else {
        this.logger.error(
          `❌ Failed to send welcome email to ${to}: ${result.error}`,
        );
        return false;
      }
    } catch (error) {
      this.logger.error(`❌ Error sending welcome email to ${to}:`, error);
      return false;
    }
  }

  async sendNotificationEmail(
    to: string,
    fullName: string,
    title: string,
    message: string,
    actionUrl?: string,
    actionText?: string,
  ): Promise<boolean> {
    try {
      const result = await this.brevoEmailService.sendNotificationEmail(
        to,
        fullName,
        title,
        message,
        actionUrl,
        actionText,
      );

      if (result.success) {
        this.logger.log(`✅ Notification email sent successfully to ${to}`);
        return true;
      } else {
        this.logger.error(
          `❌ Failed to send notification email to ${to}: ${result.error}`,
        );
        return false;
      }
    } catch (error) {
      this.logger.error(`❌ Error sending notification email to ${to}:`, error);
      return false;
    }
  }

  async sendPushNotification(
    userId: string,
    title: string,
    body: string,
    data?: Record<string, any>,
  ): Promise<boolean> {
    // Placeholder implementation for push notifications
    // This would integrate with Firebase, OneSignal, etc.
    try {
      this.logger.log(`📱 Push notification sent to user ${userId}: ${title}`);

      // Simulate API call delay
      await new Promise((resolve) => setTimeout(resolve, 100));

      // For now, just log the notification
      console.log(
        `Push Notification:
        User: ${userId}
        Title: ${title}
        Body: ${body}
        Data:`,
        data,
      );

      return true;
    } catch (error) {
      this.logger.error('❌ Error sending push notification:', error);
      return false;
    }
  }

  async sendSMS(phoneNumber: string, message: string): Promise<boolean> {
    // Placeholder implementation for SMS
    // This would integrate with Twilio, AWS SNS, etc.
    try {
      this.logger.log(`📱 SMS sent to ${phoneNumber}: ${message}`);

      // Simulate API call delay
      await new Promise((resolve) => setTimeout(resolve, 100));

      // For now, just log the SMS
      console.log(`SMS:
        Phone: ${phoneNumber}
        Message: ${message}`);

      return true;
    } catch (error) {
      this.logger.error('❌ Error sending SMS:', error);
      return false;
    }
  }

  // Helper method to convert plain text to basic HTML
  private convertTextToHtml(text: string): string {
    return text
      .replace(/\n/g, '<br>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>');
  }

  // Health check for email service
  async checkEmailHealth(): Promise<{
    status: string;
    provider: string;
    details: any;
  }> {
    try {
      const accountInfo = await this.brevoEmailService.getAccountInfo();
      const quota = await this.brevoEmailService.checkQuota();

      return {
        status: accountInfo.success ? 'healthy' : 'unhealthy',
        provider: 'Brevo',
        details: {
          account: accountInfo.success,
          quota: quota,
          remainingCredits: quota.remainingQuota,
          totalCredits: quota.totalQuota,
        },
      };
    } catch (error: unknown) {
      let errorMessage = 'Unknown error';
      if (
        error &&
        typeof error === 'object' &&
        'message' in error &&
        typeof (error as { message?: unknown }).message === 'string'
      ) {
        errorMessage = (error as { message: string }).message;
      }
      return {
        status: 'unhealthy',
        provider: 'Brevo',
        details: { error: errorMessage },
      };
    }
  }
}
