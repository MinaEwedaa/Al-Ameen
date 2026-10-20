import { AppError } from '../errors/AppError';
import type { ClientErrorCode, ErrorCode } from './api.types';

export class ApiError extends AppError {
  constructor(
    message: string,
    code: ErrorCode | ClientErrorCode,
    statusCode?: number,
    public readonly retryAfter?: number,
  ) {
    super(message, code, statusCode);
    this.name = 'ApiError';
  }
}