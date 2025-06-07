/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { BaseCustomError } from '../../core/errors/custom-errors';

@Injectable()
export class ErrorLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ErrorLoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const gqlContext = GqlExecutionContext.create(context);
    const info = gqlContext.getInfo();
    const args = gqlContext.getArgs();
    const req = gqlContext.getContext()?.req;

    return next.handle().pipe(
      catchError((error) => {
        // 🎯 TẬN DỤNG CUSTOM ERROR PROPERTIES để log chi tiết
        if (error instanceof BaseCustomError) {
          this.logger.log(
            `🔍 ${error.severity.toUpperCase()} ${error.code}: ${error.message}`,
            {
              operation: info?.fieldName,
              category: error.category,
              field: error.field,
              details: error.details,
              traceId: error.traceId,
              userId: req?.user?.id,
              args: this.sanitizeArgs(args),
            },
          );
        } else {
          this.logger.error(
            `🚨 Unhandled error in ${info?.fieldName}: ${error.message}`,
            error.stack,
            {
              operation: info?.fieldName,
              args: this.sanitizeArgs(args),
              userId: req?.user?.id,
            },
          );
        }

        return throwError(() => error);
      }),
    );
  }

  private sanitizeArgs(args: any): any {
    // Remove sensitive data from logs
    const sanitized = { ...args };
    if (sanitized.input?.password) {
      sanitized.input.password = '[REDACTED]';
    }
    if (sanitized.input?.otp) {
      sanitized.input.otp = '[REDACTED]';
    }
    return sanitized;
  }
}
