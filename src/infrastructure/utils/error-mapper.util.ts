/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import {
  BaseCustomError,
  AuthenticationError,
  PhoneNotVerifiedError,
  AccountLockedError,
  ValidationError,
  PhoneValidationError,
  OtpError,
  OtpExpiredError,
  OtpRateLimitError,
  UserAlreadyExistsError,
  ResourceNotFoundError,
  SmsServiceError,
} from '../../core/errors/custom-errors';

export class ErrorMapper {
  static mapToCustomError(
    error: Error | string,
    context?: any,
  ): BaseCustomError {
    const message = typeof error === 'string' ? error : error.message;

    // Map common error patterns
    if (this.isInvalidCredentials(message)) {
      return new AuthenticationError(
        'Số điện thoại hoặc mật khẩu không chính xác',
      );
    }

    if (this.isPhoneNotVerified(message)) {
      return new PhoneNotVerifiedError(
        'Vui lòng xác thực số điện thoại trước khi đăng nhập',
      );
    }

    if (this.isAccountLocked(message)) {
      return new AccountLockedError(
        'Tài khoản tạm thời bị khóa do nhập sai mật khẩu quá nhiều lần',
      );
    }

    if (this.isInvalidPhoneNumber(message)) {
      return new PhoneValidationError(
        'Định dạng số điện thoại không hợp lệ',
        'phone',
      );
    }

    if (this.isOtpExpired(message)) {
      return new OtpExpiredError('Mã OTP đã hết hạn');
    }

    if (this.isOtpInvalid(message)) {
      return new OtpError('Mã OTP không chính xác');
    }

    if (this.isOtpRateLimit(message)) {
      return new OtpRateLimitError('Bạn đã yêu cầu quá nhiều mã OTP');
    }

    if (this.isUserAlreadyExists(message)) {
      return new UserAlreadyExistsError('Số điện thoại này đã được đăng ký');
    }

    if (this.isUserNotFound(message)) {
      return new ResourceNotFoundError('Không tìm thấy người dùng');
    }

    if (this.isSmsFailure(message)) {
      return new SmsServiceError('Không thể gửi tin nhắn SMS');
    }

    // Default validation error for unmatched patterns
    return new ValidationError(message, context?.field);
  }

  private static isInvalidCredentials(message: string): boolean {
    const patterns = [
      'invalid credentials',
      'wrong password',
      'authentication failed',
      'login failed',
    ];
    return patterns.some((pattern) => message.toLowerCase().includes(pattern));
  }

  private static isPhoneNotVerified(message: string): boolean {
    const patterns = [
      'phone not verified',
      'verify your phone',
      'phone verification required',
    ];
    return patterns.some((pattern) => message.toLowerCase().includes(pattern));
  }

  private static isAccountLocked(message: string): boolean {
    const patterns = [
      'account locked',
      'account is locked',
      'temporarily locked',
      'locked until',
    ];
    return patterns.some((pattern) => message.toLowerCase().includes(pattern));
  }

  private static isInvalidPhoneNumber(message: string): boolean {
    const patterns = [
      'invalid phone',
      'phone number format',
      'phone validation',
      'invalid vietnamese phone',
    ];
    return patterns.some((pattern) => message.toLowerCase().includes(pattern));
  }

  private static isOtpExpired(message: string): boolean {
    const patterns = ['otp expired', 'otp has expired', 'code expired'];
    return patterns.some((pattern) => message.toLowerCase().includes(pattern));
  }

  private static isOtpInvalid(message: string): boolean {
    const patterns = [
      'otp invalid',
      'invalid otp',
      'wrong otp',
      'incorrect otp',
    ];
    return patterns.some((pattern) => message.toLowerCase().includes(pattern));
  }

  private static isOtpRateLimit(message: string): boolean {
    const patterns = ['too many otp', 'rate limit', 'otp requests exceeded'];
    return patterns.some((pattern) => message.toLowerCase().includes(pattern));
  }

  private static isUserAlreadyExists(message: string): boolean {
    const patterns = [
      'user already exists',
      'phone number already',
      'already registered',
    ];
    return patterns.some((pattern) => message.toLowerCase().includes(pattern));
  }

  private static isUserNotFound(message: string): boolean {
    const patterns = ['user not found', 'user does not exist'];
    return patterns.some((pattern) => message.toLowerCase().includes(pattern));
  }

  private static isSmsFailure(message: string): boolean {
    const patterns = ['sms failed', 'failed to send sms', 'sms service error'];
    return patterns.some((pattern) => message.toLowerCase().includes(pattern));
  }
}
