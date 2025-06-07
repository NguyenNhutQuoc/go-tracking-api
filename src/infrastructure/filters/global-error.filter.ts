/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-enum-comparison */

// File: src/infrastructure/filters/global-error.filter.ts (SIMPLIFIED - HTTP ONLY)

import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

import { BaseCustomError } from '../../core/errors/custom-errors';
import {
  ErrorCode,
  ErrorCategory,
  ErrorSeverity,
} from '../../core/errors/error-codes.enum';

@Catch()
export class GlobalErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalErrorFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    // ONLY handle HTTP context - GraphQL handled by formatError
    console.log('GlobalErrorFilter caught an exception:', exception);
    console.log('BaseCustomError:', exception instanceof BaseCustomError);
    if (host.getType() === 'http') {
      this.handleHttpError(exception, host);
    }
    // For GraphQL, let it pass through to formatError in config
  }

  private handleHttpError(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const traceId = uuidv4();

    this.logError(exception, traceId, request);

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    const errorResponse: any = {
      success: false,
      error: {
        code: ErrorCode.INTERNAL_SERVER_ERROR,
        message: 'Đã xảy ra lỗi hệ thống',
        category: ErrorCategory.SYSTEM,
        severity: ErrorSeverity.CRITICAL,
        suggestion: 'Vui lòng thử lại sau ít phút',
        retryable: true,
        traceId,
        timestamp: new Date().toISOString(),
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      },
      path: request.url,
      method: request.method,
    };

    console.log(
      `🔴 Error occurred: ${exception instanceof BaseCustomError ? exception.message : 'Unknown error'}`,
    );
    console.log(`Trace ID: ${traceId}`);

    // Handle custom errors
    if (exception instanceof BaseCustomError) {
      statusCode = exception.statusCode;
      errorResponse.error = exception.toStandardError();
      errorResponse.error.traceId = traceId;
    }
    // Handle HTTP exceptions
    else if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const httpResponse = exception.getResponse();

      let message = 'Đã xảy ra lỗi';
      if (typeof httpResponse === 'string') {
        message = httpResponse;
      } else if (typeof httpResponse === 'object') {
        const responseObj = httpResponse as any;
        message = responseObj.message || responseObj.error || message;
      }

      errorResponse.error = {
        code: this.mapHttpStatusToErrorCode(statusCode),
        message,
        category: this.mapHttpStatusToCategory(statusCode),
        severity: this.mapHttpStatusToSeverity(statusCode),
        suggestion: this.getHttpErrorSuggestion(statusCode, message),
        retryable: this.isHttpErrorRetryable(statusCode),
        traceId,
        timestamp: new Date().toISOString(),
        statusCode,
      };
    }

    response.status(statusCode).json(errorResponse);
  }

  private logError(exception: unknown, traceId: string, request?: any): void {
    const logContext = {
      traceId,
      path: request?.url,
      method: request?.method,
      userAgent: request?.get?.('User-Agent'),
      userId: request?.user?.id,
      organizationId: request?.user?.organizationId,
      errorType: exception?.constructor?.name,
    };

    if (exception instanceof BaseCustomError) {
      this.logger.log(
        `🔵 HTTP ${exception.severity.toUpperCase()}: ${exception.code} - ${exception.message}`,
        logContext,
      );
    } else if (exception instanceof HttpException) {
      const status = exception.getStatus();
      this.logger.warn(`🟡 HTTP ${status}: ${exception.message}`, logContext);
    } else {
      const message =
        exception instanceof Error ? exception.message : 'Unknown error';
      this.logger.error(
        `🔴 HTTP UNKNOWN: ${message}`,
        exception instanceof Error ? exception.stack : undefined,
        logContext,
      );
    }
  }

  // Helper methods (same as before)
  private mapHttpStatusToErrorCode(status: number): ErrorCode {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return ErrorCode.BAD_REQUEST;
      case HttpStatus.UNAUTHORIZED:
        return ErrorCode.INVALID_TOKEN;
      case HttpStatus.FORBIDDEN:
        return ErrorCode.INSUFFICIENT_PERMISSIONS;
      case HttpStatus.NOT_FOUND:
        return ErrorCode.RESOURCE_NOT_FOUND;
      case HttpStatus.CONFLICT:
        return ErrorCode.USER_ALREADY_EXISTS;
      case HttpStatus.UNPROCESSABLE_ENTITY:
        return ErrorCode.INVALID_INPUT_FORMAT;
      case HttpStatus.TOO_MANY_REQUESTS:
        return ErrorCode.OTP_RATE_LIMIT;
      default:
        return ErrorCode.INTERNAL_SERVER_ERROR;
    }
  }

  private mapHttpStatusToCategory(status: number): ErrorCategory {
    if (status === HttpStatus.UNAUTHORIZED || status === HttpStatus.FORBIDDEN) {
      return ErrorCategory.AUTHENTICATION;
    }
    if (status >= 400 && status < 500) {
      return ErrorCategory.VALIDATION;
    }
    return ErrorCategory.SYSTEM;
  }

  private mapHttpStatusToSeverity(status: number): ErrorSeverity {
    if (status >= 500) return ErrorSeverity.CRITICAL;
    if (status === HttpStatus.TOO_MANY_REQUESTS) return ErrorSeverity.HIGH;
    if (status >= 400) return ErrorSeverity.MEDIUM;
    return ErrorSeverity.LOW;
  }

  private getHttpErrorSuggestion(status: number, message?: string): string {
    if (message) {
      const lowerMessage = message.toLowerCase();
      if (lowerMessage.includes('phone'))
        return 'Vui lòng kiểm tra lại định dạng số điện thoại';
      if (lowerMessage.includes('password'))
        return 'Vui lòng kiểm tra lại mật khẩu';
      if (lowerMessage.includes('email'))
        return 'Vui lòng kiểm tra lại địa chỉ email';
    }

    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return 'Vui lòng kiểm tra lại dữ liệu đầu vào';
      case HttpStatus.UNAUTHORIZED:
        return 'Vui lòng đăng nhập lại';
      case HttpStatus.FORBIDDEN:
        return 'Bạn không có quyền thực hiện thao tác này';
      case HttpStatus.NOT_FOUND:
        return 'Không tìm thấy dữ liệu yêu cầu';
      case HttpStatus.CONFLICT:
        return 'Dữ liệu đã tồn tại trong hệ thống';
      case HttpStatus.TOO_MANY_REQUESTS:
        return 'Bạn đã thực hiện quá nhiều yêu cầu. Vui lòng thử lại sau';
      default:
        return 'Hệ thống đang gặp sự cố. Vui lòng thử lại sau ít phút';
    }
  }

  private isHttpErrorRetryable(status: number): boolean {
    return status >= 500 || status === HttpStatus.TOO_MANY_REQUESTS;
  }
}
