/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance, AxiosStatic } from 'axios';
const axiosTyped: AxiosStatic = axios;

export interface EmailTemplate {
  subject: string;
  htmlContent: string;
  textContent?: string;
}

export interface EmailRecipient {
  email: string;
  name?: string;
}

export interface EmailAttachment {
  name: string;
  content: string; // Base64 encoded
  url?: string;
}

export interface SendEmailOptions {
  to: EmailRecipient[];
  cc?: EmailRecipient[];
  bcc?: EmailRecipient[];
  subject: string;
  htmlContent?: string;
  textContent?: string;
  templateId?: number;
  params?: Record<string, any>;
  attachments?: EmailAttachment[];
  tags?: string[];
  headers?: Record<string, string>;
}

export interface EmailResponse {
  success: boolean;
  messageId?: string;
  error?: string;
  details?: any;
}

@Injectable()
export class BrevoEmailService {
  private readonly logger = new Logger(BrevoEmailService.name);
  private readonly apiClient: AxiosInstance;
  private readonly fromEmail: string;
  private readonly fromName: string;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('BREVO_API_KEY');
    this.fromEmail = this.configService.get<string>(
      'BREVO_FROM_EMAIL',
      'noreply@gotracking.com',
    );
    this.fromName = this.configService.get<string>(
      'BREVO_FROM_NAME',
      'GoTracking System',
    );

    if (!apiKey) {
      this.logger.error('❌ BREVO_API_KEY not found in environment variables');
      throw new Error('BREVO_API_KEY is required');
    }

    this.apiClient = axiosTyped.create({
      baseURL: 'https://api.brevo.com/v3',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'api-key': apiKey,
      },
      timeout: 10000, // 10 seconds timeout
    });

    // Add request/response interceptors for logging
    this.apiClient.interceptors.request.use(
      (config) => {
        this.logger.debug(
          `📧 Sending email via Brevo: ${config.method?.toUpperCase()} ${config.url}`,
        );
        return config;
      },
      (error) => {
        this.logger.error('❌ Brevo request error:', error);
        return Promise.reject(
          error instanceof Error ? error : new Error(String(error)),
        );
      },
    );

    this.apiClient.interceptors.response.use(
      (response) => {
        this.logger.debug(
          `✅ Brevo response: ${response.status} ${response.statusText}`,
        );
        return response;
      },
      (error) => {
        this.logger.error('❌ Brevo API error:', {
          status: error.response?.status,
          data: error.response?.data,
          message: error.message,
        });
        return Promise.reject(
          error instanceof Error ? error : new Error(String(error)),
        );
      },
    );

    this.logger.log(
      `✅ Brevo Email Service initialized with sender: ${this.fromName} <${this.fromEmail}>`,
    );
  }

  /**
   * Send a simple email
   */
  async sendEmail(
    to: string | EmailRecipient,
    subject: string,
    htmlContent: string,
    textContent?: string,
  ): Promise<EmailResponse> {
    const recipient: EmailRecipient =
      typeof to === 'string' ? { email: to } : to;

    return this.sendAdvancedEmail({
      to: [recipient],
      subject,
      htmlContent,
      textContent,
    });
  }

  /**
   * Send advanced email with full options
   */
  async sendAdvancedEmail(options: SendEmailOptions): Promise<EmailResponse> {
    try {
      const payload: Record<string, unknown> = {
        sender: {
          name: this.fromName,
          email: this.fromEmail,
        },
        to: options.to,
        cc: options.cc,
        bcc: options.bcc,
        subject: options.subject,
        htmlContent: options.htmlContent,
        textContent: options.textContent,
        templateId: options.templateId,
        params: options.params,
        attachment: options.attachments,
        tags: options.tags,
        headers: options.headers,
      };

      // Remove undefined fields
      Object.keys(payload).forEach(
        (key) => payload[key] === undefined && delete payload[key],
      );

      const response = await this.apiClient.post('/smtp/email', payload);

      this.logger.log(
        `✅ Email sent successfully to ${options.to.map((r) => r.email).join(', ')}`,
      );

      return {
        success: true,
        messageId: response.data?.messageId,
        details: response.data,
      };
    } catch (error) {
      this.logger.error('❌ Failed to send email:', {
        error: error.message,
        response: error.response?.data,
        recipients: options.to.map((r) => r.email),
      });

      return {
        success: false,
        error: error.response?.data?.message || error.message,
        details: error.response?.data,
      };
    }
  }

  /**
   * Send email using Brevo template
   */
  async sendTemplateEmail(
    to: string | EmailRecipient,
    templateId: number,
    params: Record<string, any>,
    options?: Partial<SendEmailOptions>,
  ): Promise<EmailResponse> {
    const recipient: EmailRecipient =
      typeof to === 'string' ? { email: to } : to;

    return this.sendAdvancedEmail({
      to: [recipient],
      templateId,
      params,
      subject: '', // Will be overridden by template
      ...options,
    });
  }

  /**
   * Send OTP email
   */
  async sendOtpEmail(
    to: string,
    fullName: string,
    otp: string,
    type: 'email_verification' | 'password_reset' | 'login_2fa',
    expiryMinutes: number = 15,
  ): Promise<EmailResponse> {
    const templates = {
      email_verification: {
        subject: '📧 Xác thực email - GoTracking',
        html: this.getEmailVerificationTemplate(fullName, otp, expiryMinutes),
      },
      password_reset: {
        subject: '🔐 Đặt lại mật khẩu - GoTracking',
        html: this.getPasswordResetTemplate(fullName, otp, expiryMinutes),
      },
      login_2fa: {
        subject: '🔒 Mã xác thực đăng nhập - GoTracking',
        html: this.getLoginOtpTemplate(fullName, otp, expiryMinutes),
      },
    };

    const template = templates[type];

    return this.sendEmail(
      { email: to, name: fullName },
      template.subject,
      template.html,
      this.getTextContent(fullName, otp, type, expiryMinutes),
    );
  }

  /**
   * Send welcome email
   */
  async sendWelcomeEmail(
    to: string,
    fullName: string,
    organizationName: string,
    role: string,
  ): Promise<EmailResponse> {
    const subject = `🎉 Chào mừng đến với ${organizationName} - GoTracking`;
    const htmlContent = this.getWelcomeTemplate(
      fullName,
      organizationName,
      role,
    );

    return this.sendEmail({ email: to, name: fullName }, subject, htmlContent);
  }

  /**
   * Send notification email
   */
  async sendNotificationEmail(
    to: string,
    fullName: string,
    title: string,
    message: string,
    actionUrl?: string,
    actionText?: string,
  ): Promise<EmailResponse> {
    const htmlContent = this.getNotificationTemplate(
      fullName,
      title,
      message,
      actionUrl,
      actionText,
    );

    return this.sendEmail({ email: to, name: fullName }, title, htmlContent);
  }

  /**
   * Get account info from Brevo
   */
  async getAccountInfo(): Promise<any> {
    try {
      const response = await this.apiClient.get('/account');
      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      this.logger.error('❌ Failed to get Brevo account info:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Check email sending quota
   */
  async checkQuota(): Promise<{ remainingQuota: number; totalQuota: number }> {
    try {
      const response = await this.apiClient.get('/account');
      const plan = response.data?.plan || {};

      return {
        remainingQuota: plan.remainingCredits || 0,
        totalQuota: plan.creditsLimit || 0,
      };
    } catch (error) {
      this.logger.error('❌ Failed to check quota:', error);
      return { remainingQuota: 0, totalQuota: 0 };
    }
  }

  /**
   * HTML Email Templates
   */
  private getEmailVerificationTemplate(
    fullName: string,
    otp: string,
    expiryMinutes: number,
  ): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Xác thực email</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; margin: 0; padding: 20px; background-color: #f4f4f4; }
        .container { max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 0 10px rgba(0,0,0,0.1); }
        .header { text-align: center; color: #2c3e50; margin-bottom: 30px; }
        .otp-box { background: #e3f2fd; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0; }
        .otp-code { font-size: 32px; font-weight: bold; color: #1976d2; letter-spacing: 8px; }
        .warning { background: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #ffc107; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎢 GoTracking - Xác thực Email</h1>
        </div>
        
        <p>Xin chào <strong>${fullName}</strong>,</p>
        
        <p>Cảm ơn bạn đã đăng ký tài khoản GoTracking! Để hoàn tất quá trình đăng ký, vui lòng sử dụng mã xác thực dưới đây:</p>
        
        <div class="otp-box">
            <div class="otp-code">${otp}</div>
            <p>Mã xác thực của bạn</p>
        </div>
        
        <div class="warning">
            <strong>⏰ Lưu ý quan trọng:</strong>
            <ul>
                <li>Mã này sẽ hết hạn sau <strong>${expiryMinutes} phút</strong></li>
                <li>Không chia sẻ mã này với bất kỳ ai</li>
                <li>Nếu bạn không yêu cầu xác thực này, vui lòng bỏ qua email</li>
            </ul>
        </div>
        
        <p>Sau khi xác thực thành công, bạn có thể đăng nhập và sử dụng đầy đủ các tính năng của GoTracking.</p>
        
        <div class="footer">
            <p>Đội ngũ GoTracking<br>
            Email: support@gotracking.com<br>
            Website: https://gotracking.com</p>
        </div>
    </div>
</body>
</html>`;
  }

  private getPasswordResetTemplate(
    fullName: string,
    otp: string,
    expiryMinutes: number,
  ): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Đặt lại mật khẩu</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; margin: 0; padding: 20px; background-color: #f4f4f4; }
        .container { max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 0 10px rgba(0,0,0,0.1); }
        .header { text-align: center; color: #d32f2f; margin-bottom: 30px; }
        .otp-box { background: #ffebee; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0; border: 2px solid #f44336; }
        .otp-code { font-size: 32px; font-weight: bold; color: #d32f2f; letter-spacing: 8px; }
        .security-notice { background: #e8f5e8; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #4caf50; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔐 GoTracking - Đặt lại mật khẩu</h1>
        </div>
        
        <p>Xin chào <strong>${fullName}</strong>,</p>
        
        <p>Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn. Sử dụng mã xác thực dưới đây để tạo mật khẩu mới:</p>
        
        <div class="otp-box">
            <div class="otp-code">${otp}</div>
            <p>Mã đặt lại mật khẩu</p>
        </div>
        
        <div class="security-notice">
            <strong>🛡️ Bảo mật tài khoản:</strong>
            <ul>
                <li>Mã này chỉ có hiệu lực trong <strong>${expiryMinutes} phút</strong></li>
                <li>Sau khi đặt lại, hãy chọn mật khẩu mạnh và không chia sẻ với ai</li>
                <li>Nếu bạn không yêu cầu đặt lại mật khẩu, hãy liên hệ ngay với chúng tôi</li>
            </ul>
        </div>
        
        <p>Để bảo vệ tài khoản, chúng tôi khuyến nghị bạn:</p>
        <ul>
            <li>Sử dụng mật khẩu có ít nhất 8 ký tự</li>
            <li>Kết hợp chữ hoa, chữ thường, số và ký tự đặc biệt</li>
            <li>Không sử dụng thông tin cá nhân dễ đoán</li>
        </ul>
        
        <div class="footer">
            <p>Đội ngũ GoTracking<br>
            Email: support@gotracking.com<br>
            Hotline: 1900-xxx-xxx</p>
        </div>
    </div>
</body>
</html>`;
  }

  private getLoginOtpTemplate(
    fullName: string,
    otp: string,
    expiryMinutes: number,
  ): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Mã xác thực đăng nhập</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; margin: 0; padding: 20px; background-color: #f4f4f4; }
        .container { max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 0 10px rgba(0,0,0,0.1); }
        .header { text-align: center; color: #ff9800; margin-bottom: 30px; }
        .otp-box { background: #fff8e1; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0; border: 2px solid #ff9800; }
        .otp-code { font-size: 32px; font-weight: bold; color: #e65100; letter-spacing: 8px; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔒 GoTracking - Xác thực đăng nhập</h1>
        </div>
        
        <p>Xin chào <strong>${fullName}</strong>,</p>
        
        <p>Mã xác thực 2 lớp cho phiên đăng nhập của bạn:</p>
        
        <div class="otp-box">
            <div class="otp-code">${otp}</div>
            <p>Nhập mã này để hoàn tất đăng nhập</p>
        </div>
        
        <p><strong>Thời gian hiệu lực:</strong> ${expiryMinutes} phút</p>
        
        <p>Nếu bạn không thực hiện đăng nhập này, vui lòng bỏ qua email hoặc liên hệ với chúng tôi ngay.</p>
        
        <div class="footer">
            <p>Đội ngũ GoTracking<br>
            Hệ thống bảo mật tự động</p>
        </div>
    </div>
</body>
</html>`;
  }

  private getWelcomeTemplate(
    fullName: string,
    organizationName: string,
    role: string,
  ): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Chào mừng đến với GoTracking</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; margin: 0; padding: 20px; background-color: #f4f4f4; }
        .container { max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 0 10px rgba(0,0,0,0.1); }
        .header { text-align: center; color: #4caf50; margin-bottom: 30px; }
        .welcome-box { background: linear-gradient(135deg, #4caf50, #2e7d32); color: white; padding: 30px; border-radius: 10px; text-align: center; margin: 20px 0; }
        .features { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎉 Chào mừng đến với GoTracking!</h1>
        </div>
        
        <div class="welcome-box">
            <h2>Xin chào ${fullName}!</h2>
            <p>Chúc mừng bạn đã trở thành ${role} của <strong>${organizationName}</strong></p>
        </div>
        
        <p>Tài khoản của bạn đã được kích hoạt thành công. Bạn có thể bắt đầu sử dụng hệ thống GoTracking ngay bây giờ!</p>
        
        <div class="features">
            <h3>🚀 Những gì bạn có thể làm:</h3>
            <ul>
                <li>📍 Theo dõi vị trí thời gian thực</li>
                <li>📊 Xem thống kê và báo cáo</li>
                <li>🗺️ Điều hướng trong tòa nhà</li>
                <li>🔔 Nhận thông báo quan trọng</li>
                <li>👥 Quản lý người dùng (nếu là Admin)</li>
            </ul>
        </div>
        
        <p>Nếu bạn cần hỗ trợ, đừng ngần ngại liên hệ với chúng tôi!</p>
        
        <div class="footer">
            <p>Đội ngũ GoTracking<br>
            Email: support@gotracking.com<br>
            Website: https://gotracking.com</p>
        </div>
    </div>
</body>
</html>`;
  }

  private getNotificationTemplate(
    fullName: string,
    title: string,
    message: string,
    actionUrl?: string,
    actionText?: string,
  ): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; margin: 0; padding: 20px; background-color: #f4f4f4; }
        .container { max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 0 10px rgba(0,0,0,0.1); }
        .header { text-align: center; color: #2196f3; margin-bottom: 30px; }
        .message-box { background: #e3f2fd; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .action-button { display: inline-block; background: #2196f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📢 ${title}</h1>
        </div>
        
        <p>Xin chào <strong>${fullName}</strong>,</p>
        
        <div class="message-box">
            <p>${message}</p>
        </div>
        
        ${
          actionUrl && actionText
            ? `
        <div style="text-align: center;">
            <a href="${actionUrl}" class="action-button">${actionText}</a>
        </div>
        `
            : ''
        }
        
        <div class="footer">
            <p>Đội ngũ GoTracking<br>
            Hệ thống thông báo tự động</p>
        </div>
    </div>
</body>
</html>`;
  }

  private getTextContent(
    fullName: string,
    otp: string,
    type: 'email_verification' | 'password_reset' | 'login_2fa',
    expiryMinutes: number,
  ): string {
    const messages: Record<
      'email_verification' | 'password_reset' | 'login_2fa',
      string
    > = {
      email_verification: `Xin chào ${fullName}, mã xác thực email của bạn là: ${otp}. Mã có hiệu lực trong ${expiryMinutes} phút.`,
      password_reset: `Xin chào ${fullName}, mã đặt lại mật khẩu của bạn là: ${otp}. Mã có hiệu lực trong ${expiryMinutes} phút.`,
      login_2fa: `Xin chào ${fullName}, mã xác thực đăng nhập của bạn là: ${otp}. Mã có hiệu lực trong ${expiryMinutes} phút.`,
    };

    return messages[type] ?? `Mã xác thực của bạn là: ${otp}`;
  }
}
