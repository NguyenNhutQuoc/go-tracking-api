import { GraphQLError } from 'graphql';
import { BaseCustomError } from '../../core/errors/custom-errors';
import {
  ErrorCode,
  ErrorCategory,
  ErrorSeverity,
} from '../../core/errors/error-codes.enum';

export class GraphQLErrorUtil {
  /**
   * Convert BaseCustomError to GraphQLError while preserving all metadata
   */
  static fromCustomError(error: BaseCustomError): GraphQLError {
    return new GraphQLError(error.suggestion || error.message, {
      extensions: {
        code: error.code,
        category: error.category,
        severity: error.severity,
        suggestion: error.suggestion,
        retryable: error.retryable,
        field: error.field,
        details: error.details,
        traceId: error.traceId,
        timestamp: error.timestamp.toISOString(),
        statusCode: error.statusCode,
      },
    });
  }

  /**
   * Create GraphQLError from error code enum with default messages
   */
  static fromErrorCode(
    code: ErrorCode,
    customMessage?: string,
    field?: string,
    details?: Record<string, any>,
  ): GraphQLError {
    const errorInfo = this.getErrorInfo(code);

    return new GraphQLError(customMessage || errorInfo.message, {
      extensions: {
        code,
        category: errorInfo.category,
        severity: errorInfo.severity,
        suggestion: errorInfo.suggestion,
        retryable: errorInfo.retryable,
        field,
        details,
        timestamp: new Date().toISOString(),
        statusCode: errorInfo.statusCode,
      },
    });
  }

  /**
   * Smart error conversion - automatically detects error type
   */
  static convert(error: unknown, fallbackMessage?: string): GraphQLError {
    // Already a GraphQLError
    if (error instanceof GraphQLError) {
      return error;
    }

    // Custom error - use utility
    if (error instanceof BaseCustomError) {
      return this.fromCustomError(error);
    }

    // Error with message - try to map by message pattern
    if (error instanceof Error) {
      const mappedCode = this.mapMessageToErrorCode(error.message);
      if (mappedCode) {
        return this.fromErrorCode(mappedCode, error.message);
      }
    }

    // Fallback
    return this.fromErrorCode(
      ErrorCode.INTERNAL_SERVER_ERROR,
      fallbackMessage ||
        (error instanceof Error
          ? error.message
          : 'Đã xảy ra lỗi không xác định'),
    );
  }

  /**
   * Map error messages to error codes using patterns
   */
  private static mapMessageToErrorCode(message: string): ErrorCode | null {
    const lowerMessage = message.toLowerCase();

    // Authentication patterns
    if (
      lowerMessage.includes('credentials') ||
      lowerMessage.includes('mật khẩu không chính xác')
    ) {
      return ErrorCode.INVALID_CREDENTIALS;
    }
    if (
      lowerMessage.includes('phone not verified') ||
      lowerMessage.includes('xác thực số điện thoại')
    ) {
      return ErrorCode.PHONE_NOT_VERIFIED;
    }
    if (lowerMessage.includes('locked') || lowerMessage.includes('bị khóa')) {
      return ErrorCode.ACCOUNT_LOCKED;
    }

    // Validation patterns
    if (
      lowerMessage.includes('invalid phone') ||
      lowerMessage.includes('số điện thoại không hợp lệ')
    ) {
      return ErrorCode.INVALID_PHONE_NUMBER;
    }
    if (
      lowerMessage.includes('weak password') ||
      lowerMessage.includes('mật khẩu yếu')
    ) {
      return ErrorCode.WEAK_PASSWORD;
    }

    // Business logic patterns
    if (
      lowerMessage.includes('already exists') ||
      lowerMessage.includes('đã được đăng ký')
    ) {
      return ErrorCode.USER_ALREADY_EXISTS;
    }
    if (
      lowerMessage.includes('not found') ||
      lowerMessage.includes('không tìm thấy')
    ) {
      return ErrorCode.RESOURCE_NOT_FOUND;
    }

    // OTP patterns
    if (
      lowerMessage.includes('otp expired') ||
      lowerMessage.includes('mã đã hết hạn')
    ) {
      return ErrorCode.OTP_EXPIRED;
    }
    if (
      lowerMessage.includes('otp invalid') ||
      lowerMessage.includes('mã không chính xác')
    ) {
      return ErrorCode.OTP_INVALID;
    }
    if (
      lowerMessage.includes('rate limit') ||
      lowerMessage.includes('quá nhiều yêu cầu')
    ) {
      return ErrorCode.OTP_RATE_LIMIT;
    }

    return null;
  }

  /**
   * Get comprehensive error information from error code
   */
  private static getErrorInfo(code: ErrorCode): {
    message: string;
    category: ErrorCategory;
    severity: ErrorSeverity;
    suggestion: string;
    retryable: boolean;
    statusCode: number;
  } {
    const errorMap = {
      // Authentication Errors
      [ErrorCode.INVALID_CREDENTIALS]: {
        message: 'Thông tin đăng nhập không chính xác',
        category: ErrorCategory.AUTHENTICATION,
        severity: ErrorSeverity.MEDIUM,
        suggestion: 'Vui lòng kiểm tra lại thông tin đăng nhập',
        retryable: true,
        statusCode: 401,
      },
      [ErrorCode.USER_NOT_FOUND]: {
        message: 'Không tìm thấy người dùng',
        category: ErrorCategory.AUTHENTICATION,
        severity: ErrorSeverity.MEDIUM,
        suggestion: 'Vui lòng kiểm tra lại thông tin đăng nhập',
        retryable: true,
        statusCode: 401,
      },
      [ErrorCode.ACCOUNT_LOCKED]: {
        message: 'Tài khoản tạm thời bị khóa',
        category: ErrorCategory.AUTHENTICATION,
        severity: ErrorSeverity.HIGH,
        suggestion: 'Tài khoản tạm thời bị khóa. Vui lòng thử lại sau 30 phút',
        retryable: false,
        statusCode: 423,
      },
      [ErrorCode.PHONE_NOT_VERIFIED]: {
        message: 'Số điện thoại chưa được xác thực',
        category: ErrorCategory.AUTHENTICATION,
        severity: ErrorSeverity.MEDIUM,
        suggestion: 'Vui lòng xác thực số điện thoại trước khi đăng nhập',
        retryable: false,
        statusCode: 403,
      },
      [ErrorCode.ACCOUNT_SUSPENDED]: {
        message: 'Tài khoản đã bị tạm khóa',
        category: ErrorCategory.AUTHENTICATION,
        severity: ErrorSeverity.HIGH,
        suggestion: 'Tài khoản đã bị tạm khóa. Vui lòng liên hệ quản trị viên',
        retryable: false,
        statusCode: 403,
      },
      [ErrorCode.ACCOUNT_NOT_ALLOWED]: {
        message: 'Tài khoản không được phép truy cập',
        category: ErrorCategory.AUTHENTICATION,
        severity: ErrorSeverity.HIGH,
        suggestion: 'Tài khoản này không được phép truy cập vào hệ thống',
        retryable: false,
        statusCode: 403,
      },

      [ErrorCode.INVALID_TOKEN]: {
        message: 'Token không hợp lệ',
        category: ErrorCategory.AUTHENTICATION,
        severity: ErrorSeverity.MEDIUM,
        suggestion: 'Vui lòng đăng nhập lại',
        retryable: false,
        statusCode: 401,
      },
      [ErrorCode.TOKEN_EXPIRED]: {
        message: 'Token đã hết hạn',
        category: ErrorCategory.AUTHENTICATION,
        severity: ErrorSeverity.MEDIUM,
        suggestion: 'Vui lòng đăng nhập lại',
        retryable: false,
        statusCode: 401,
      },
      [ErrorCode.INSUFFICIENT_PERMISSIONS]: {
        message: 'Không có quyền truy cập',
        category: ErrorCategory.PERMISSION,
        severity: ErrorSeverity.HIGH,
        suggestion: 'Bạn không có quyền thực hiện thao tác này',
        retryable: false,
        statusCode: 403,
      },

      // Validation Errors
      [ErrorCode.INVALID_PHONE_NUMBER]: {
        message: 'Định dạng số điện thoại không hợp lệ',
        category: ErrorCategory.VALIDATION,
        severity: ErrorSeverity.MEDIUM,
        suggestion:
          'Số điện thoại phải có định dạng: +84xxxxxxxxx hoặc 0xxxxxxxxx',
        retryable: true,
        statusCode: 400,
      },
      [ErrorCode.INVALID_EMAIL]: {
        message: 'Định dạng email không hợp lệ',
        category: ErrorCategory.VALIDATION,
        severity: ErrorSeverity.MEDIUM,
        suggestion: 'Vui lòng nhập đúng định dạng email',
        retryable: true,
        statusCode: 400,
      },
      [ErrorCode.WEAK_PASSWORD]: {
        message: 'Mật khẩu quá yếu',
        category: ErrorCategory.VALIDATION,
        severity: ErrorSeverity.MEDIUM,
        suggestion:
          'Mật khẩu phải có ít nhất 8 ký tự, bao gồm chữ hoa, chữ thường và số',
        retryable: true,
        statusCode: 400,
      },
      [ErrorCode.REQUIRED_FIELD_MISSING]: {
        message: 'Thiếu thông tin bắt buộc',
        category: ErrorCategory.VALIDATION,
        severity: ErrorSeverity.MEDIUM,
        suggestion: 'Vui lòng điền đầy đủ thông tin bắt buộc',
        retryable: true,
        statusCode: 400,
      },
      [ErrorCode.INVALID_INPUT_FORMAT]: {
        message: 'Định dạng dữ liệu không hợp lệ',
        category: ErrorCategory.VALIDATION,
        severity: ErrorSeverity.MEDIUM,
        suggestion: 'Vui lòng kiểm tra lại định dạng dữ liệu nhập vào',
        retryable: true,
        statusCode: 400,
      },
      [ErrorCode.FIELD_TOO_LONG]: {
        message: 'Dữ liệu quá dài',
        category: ErrorCategory.VALIDATION,
        severity: ErrorSeverity.MEDIUM,
        suggestion: 'Vui lòng rút ngắn nội dung',
        retryable: true,
        statusCode: 400,
      },
      [ErrorCode.FIELD_TOO_SHORT]: {
        message: 'Dữ liệu quá ngắn',
        category: ErrorCategory.VALIDATION,
        severity: ErrorSeverity.MEDIUM,
        suggestion: 'Vui lòng nhập đủ độ dài yêu cầu',
        retryable: true,
        statusCode: 400,
      },

      // OTP Errors
      [ErrorCode.OTP_EXPIRED]: {
        message: 'Mã OTP đã hết hạn',
        category: ErrorCategory.BUSINESS,
        severity: ErrorSeverity.MEDIUM,
        suggestion: 'Mã OTP đã hết hạn. Vui lòng yêu cầu mã mới',
        retryable: false,
        statusCode: 400,
      },
      [ErrorCode.OTP_INVALID]: {
        message: 'Mã OTP không chính xác',
        category: ErrorCategory.BUSINESS,
        severity: ErrorSeverity.MEDIUM,
        suggestion: 'Vui lòng kiểm tra lại mã OTP',
        retryable: true,
        statusCode: 400,
      },
      [ErrorCode.OTP_MAX_ATTEMPTS]: {
        message: 'Đã nhập sai mã OTP quá nhiều lần',
        category: ErrorCategory.BUSINESS,
        severity: ErrorSeverity.HIGH,
        suggestion: 'Đã nhập sai quá nhiều lần. Vui lòng yêu cầu mã mới',
        retryable: false,
        statusCode: 429,
      },
      [ErrorCode.OTP_NOT_FOUND]: {
        message: 'Không tìm thấy mã OTP',
        category: ErrorCategory.BUSINESS,
        severity: ErrorSeverity.MEDIUM,
        suggestion: 'Vui lòng yêu cầu mã OTP mới',
        retryable: false,
        statusCode: 404,
      },
      [ErrorCode.OTP_RATE_LIMIT]: {
        message: 'Đã yêu cầu quá nhiều mã OTP',
        category: ErrorCategory.BUSINESS,
        severity: ErrorSeverity.HIGH,
        suggestion: 'Bạn đã yêu cầu quá nhiều mã OTP. Vui lòng thử lại sau',
        retryable: false,
        statusCode: 429,
      },

      // Business Logic Errors
      [ErrorCode.USER_ALREADY_EXISTS]: {
        message: 'Người dùng đã tồn tại',
        category: ErrorCategory.BUSINESS,
        severity: ErrorSeverity.MEDIUM,
        suggestion:
          'Số điện thoại này đã được đăng ký. Vui lòng sử dụng số khác hoặc đăng nhập',
        retryable: false,
        statusCode: 409,
      },
      [ErrorCode.ORGANIZATION_NOT_FOUND]: {
        message: 'Không tìm thấy tổ chức',
        category: ErrorCategory.BUSINESS,
        severity: ErrorSeverity.MEDIUM,
        suggestion: 'Không tìm thấy tổ chức. Vui lòng kiểm tra lại',
        retryable: false,
        statusCode: 404,
      },
      [ErrorCode.RESOURCE_NOT_FOUND]: {
        message: 'Không tìm thấy dữ liệu',
        category: ErrorCategory.BUSINESS,
        severity: ErrorSeverity.MEDIUM,
        suggestion: 'Không tìm thấy dữ liệu yêu cầu',
        retryable: false,
        statusCode: 404,
      },
      [ErrorCode.PERMISSION_DENIED]: {
        message: 'Không có quyền',
        category: ErrorCategory.PERMISSION,
        severity: ErrorSeverity.HIGH,
        suggestion: 'Bạn không có quyền thực hiện thao tác này',
        retryable: false,
        statusCode: 403,
      },
      [ErrorCode.QUOTA_EXCEEDED]: {
        message: 'Đã vượt quá giới hạn',
        category: ErrorCategory.BUSINESS,
        severity: ErrorSeverity.HIGH,
        suggestion:
          'Đã vượt quá giới hạn sử dụng. Vui lòng nâng cấp gói dịch vụ',
        retryable: false,
        statusCode: 429,
      },
      [ErrorCode.OPERATION_NOT_ALLOWED]: {
        message: 'Thao tác không được phép',
        category: ErrorCategory.BUSINESS,
        severity: ErrorSeverity.MEDIUM,
        suggestion: 'Thao tác này không được phép trong tình huống hiện tại',
        retryable: false,
        statusCode: 422,
      },

      // System Errors
      [ErrorCode.DATABASE_ERROR]: {
        message: 'Lỗi cơ sở dữ liệu',
        category: ErrorCategory.SYSTEM,
        severity: ErrorSeverity.CRITICAL,
        suggestion: 'Hệ thống đang gặp sự cố. Vui lòng thử lại sau ít phút',
        retryable: true,
        statusCode: 500,
      },
      [ErrorCode.EXTERNAL_SERVICE_ERROR]: {
        message: 'Lỗi dịch vụ bên ngoài',
        category: ErrorCategory.SYSTEM,
        severity: ErrorSeverity.HIGH,
        suggestion: 'Dịch vụ bên ngoài gặp sự cố. Vui lòng thử lại sau',
        retryable: true,
        statusCode: 502,
      },
      [ErrorCode.SMS_SEND_FAILED]: {
        message: 'Không thể gửi tin nhắn',
        category: ErrorCategory.SYSTEM,
        severity: ErrorSeverity.HIGH,
        suggestion:
          'Không thể gửi SMS. Vui lòng kiểm tra số điện thoại và thử lại',
        retryable: true,
        statusCode: 502,
      },
      [ErrorCode.EMAIL_SEND_FAILED]: {
        message: 'Không thể gửi email',
        category: ErrorCategory.SYSTEM,
        severity: ErrorSeverity.HIGH,
        suggestion:
          'Không thể gửi email. Vui lòng kiểm tra địa chỉ email và thử lại',
        retryable: true,
        statusCode: 502,
      },
      [ErrorCode.CACHE_ERROR]: {
        message: 'Lỗi cache',
        category: ErrorCategory.SYSTEM,
        severity: ErrorSeverity.MEDIUM,
        suggestion: 'Lỗi bộ nhớ đệm. Vui lòng thử lại',
        retryable: true,
        statusCode: 500,
      },

      // Generic Errors
      [ErrorCode.INTERNAL_SERVER_ERROR]: {
        message: 'Lỗi hệ thống',
        category: ErrorCategory.SYSTEM,
        severity: ErrorSeverity.CRITICAL,
        suggestion: 'Hệ thống đang gặp sự cố. Vui lòng thử lại sau ít phút',
        retryable: true,
        statusCode: 500,
      },
      [ErrorCode.BAD_REQUEST]: {
        message: 'Yêu cầu không hợp lệ',
        category: ErrorCategory.VALIDATION,
        severity: ErrorSeverity.MEDIUM,
        suggestion: 'Vui lòng kiểm tra lại dữ liệu đầu vào',
        retryable: true,
        statusCode: 400,
      },
      [ErrorCode.UNKNOWN_ERROR]: {
        message: 'Lỗi không xác định',
        category: ErrorCategory.SYSTEM,
        severity: ErrorSeverity.CRITICAL,
        suggestion:
          'Đã xảy ra lỗi không xác định. Vui lòng liên hệ hỗ trợ kỹ thuật',
        retryable: true,
        statusCode: 500,
      },
    };

    return (errorMap[code] || errorMap[ErrorCode.UNKNOWN_ERROR]) as {
      message: string;
      category: ErrorCategory;
      severity: ErrorSeverity;
      suggestion: string;
      retryable: boolean;
      statusCode: number;
    };
  }
}
