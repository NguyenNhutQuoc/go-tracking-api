import { ErrorCategory, ErrorCode, ErrorSeverity } from './error-codes.enum';

export interface IStandardError {
  code: ErrorCode;
  message: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  timestamp: Date;
  traceId?: string;
  field?: string; // For validation errors
  details?: Record<string, any>;
  suggestion?: string; // User-friendly suggestion
  retryable?: boolean;
  statusCode: number;
}

export interface IErrorResponse {
  success: false;
  error: IStandardError;
  path?: string;
  method?: string;
  userAgent?: string;
}
