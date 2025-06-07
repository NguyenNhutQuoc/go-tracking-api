import { IStandardError, IErrorResponse } from './error.interface';
import { ErrorCode, ErrorCategory, ErrorSeverity } from './error-codes.enum';

export abstract class BaseCustomError extends Error {
  abstract code: ErrorCode;
  abstract category: ErrorCategory;
  abstract severity: ErrorSeverity;
  abstract statusCode: number;
  abstract suggestion?: string;
  abstract retryable: boolean;

  public traceId?: string;
  public field?: string;
  public details?: Record<string, any>;
  public timestamp: Date;

  constructor(message: string, details?: Record<string, any>) {
    super(message);
    this.name = this.constructor.name;
    this.timestamp = new Date();
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }

  toStandardError(): IStandardError {
    return {
      code: this.code,
      message: this.message,
      category: this.category,
      severity: this.severity,
      timestamp: this.timestamp,
      traceId: this.traceId,
      field: this.field,
      details: this.details,
      suggestion: this.suggestion,
      retryable: this.retryable,
      statusCode: this.statusCode,
    };
  }

  toErrorResponse(): IErrorResponse {
    return {
      success: false,
      error: this.toStandardError(),
    };
  }
}

// AUTHENTICATION ERRORS
export class AuthenticationError extends BaseCustomError {
  code = ErrorCode.INVALID_CREDENTIALS;
  category = ErrorCategory.AUTHENTICATION;
  severity = ErrorSeverity.MEDIUM;
  statusCode = 401;
  retryable = true;
  suggestion = 'Vui lòng kiểm tra lại thông tin đăng nhập';
}

export class AccountLockedError extends BaseCustomError {
  code = ErrorCode.ACCOUNT_LOCKED;
  category = ErrorCategory.AUTHENTICATION;
  severity = ErrorSeverity.HIGH;
  statusCode = 423;
  retryable = false;
  suggestion = 'Tài khoản tạm thời bị khóa. Vui lòng thử lại sau 30 phút';
}

export class PhoneNotVerifiedError extends BaseCustomError {
  code = ErrorCode.PHONE_NOT_VERIFIED;
  category = ErrorCategory.AUTHENTICATION;
  severity = ErrorSeverity.MEDIUM;
  statusCode = 403;
  retryable = false;
  suggestion = 'Vui lòng xác thực số điện thoại trước khi đăng nhập';
}

// VALIDATION ERRORS
export class ValidationError extends BaseCustomError {
  code = ErrorCode.INVALID_INPUT_FORMAT;
  category = ErrorCategory.VALIDATION;
  severity = ErrorSeverity.LOW;
  statusCode = 400;
  retryable = true;
  suggestion = 'Vui lòng kiểm tra lại định dạng dữ liệu nhập vào';

  constructor(message: string, field?: string, details?: Record<string, any>) {
    super(message, details);
    this.field = field;
  }
}

export class PhoneValidationError extends ValidationError {
  code = ErrorCode.INVALID_PHONE_NUMBER;
  suggestion = 'Số điện thoại phải có định dạng: +84xxxxxxxxx hoặc 0xxxxxxxxx';
}

// OTP ERRORS
export class OtpError extends BaseCustomError {
  code = ErrorCode.OTP_INVALID;
  category = ErrorCategory.BUSINESS;
  severity = ErrorSeverity.MEDIUM;
  statusCode = 400;
  retryable = true;
  suggestion = 'Vui lòng kiểm tra lại mã OTP';
}

export class OtpExpiredError extends OtpError {
  code = ErrorCode.OTP_EXPIRED;
  retryable = false;
  suggestion = 'Mã OTP đã hết hạn. Vui lòng yêu cầu mã mới';
}

export class OtpRateLimitError extends OtpError {
  code = ErrorCode.OTP_RATE_LIMIT;
  severity = ErrorSeverity.HIGH;
  statusCode = 429;
  retryable = false;
  suggestion = 'Bạn đã yêu cầu quá nhiều mã OTP. Vui lòng thử lại sau';
}

// BUSINESS ERRORS
export class BusinessError extends BaseCustomError {
  code = ErrorCode.OPERATION_NOT_ALLOWED;
  category = ErrorCategory.BUSINESS;
  severity = ErrorSeverity.MEDIUM;
  statusCode = 422;
  retryable = false;
  suggestion = 'Thao tác này không được phép trong tình huống hiện tại';
}

export class UserAlreadyExistsError extends BusinessError {
  code = ErrorCode.USER_ALREADY_EXISTS;
  statusCode = 409;
  suggestion =
    'Số điện thoại này đã được đăng ký. Vui lòng sử dụng số khác hoặc đăng nhập';
}

export class ResourceNotFoundError extends BusinessError {
  code = ErrorCode.RESOURCE_NOT_FOUND;
  statusCode = 404;
  suggestion = 'Không tìm thấy dữ liệu yêu cầu';
}

// SYSTEM ERRORS
export class SystemError extends BaseCustomError {
  code = ErrorCode.INTERNAL_SERVER_ERROR;
  category = ErrorCategory.SYSTEM;
  severity = ErrorSeverity.CRITICAL;
  statusCode = 500;
  retryable = true;
  suggestion = 'Hệ thống đang gặp sự cố. Vui lòng thử lại sau ít phút';
}

export class SmsServiceError extends SystemError {
  code = ErrorCode.SMS_SEND_FAILED;
  severity = ErrorSeverity.HIGH;
  suggestion = 'Không thể gửi SMS. Vui lòng kiểm tra số điện thoại và thử lại';
}
