import { Request, Response, NextFunction } from 'express';

export interface ApiError extends Error {
  statusCode?: number;
  code?: string;
  details?: any;
  retryable?: boolean;
}

/**
 * Enhanced Error Handler with categorized error types
 */
export class ErrorHandler {
  // Blockchain connectivity errors
  static createBlockchainError(message: string, details?: any): ApiError {
    const error = new Error(message) as ApiError;
    error.statusCode = 503;
    error.code = 'BLOCKCHAIN_ERROR';
    error.details = details;
    error.retryable = true;
    return error;
  }

  // Database errors
  static createDatabaseError(message: string, details?: any): ApiError {
    const error = new Error(message) as ApiError;
    error.statusCode = 500;
    error.code = 'DATABASE_ERROR';
    error.details = details;
    error.retryable = false;
    return error;
  }

  // Validation errors
  static createValidationError(message: string, details?: any): ApiError {
    const error = new Error(message) as ApiError;
    error.statusCode = 400;
    error.code = 'VALIDATION_ERROR';
    error.details = details;
    error.retryable = false;
    return error;
  }

  // Rate limiting errors
  static createRateLimitError(message: string = 'Too many requests'): ApiError {
    const error = new Error(message) as ApiError;
    error.statusCode = 429;
    error.code = 'RATE_LIMIT_ERROR';
    error.retryable = true;
    return error;
  }

  // External API errors
  static createExternalApiError(service: string, message: string, details?: any): ApiError {
    const error = new Error(`${service}: ${message}`) as ApiError;
    error.statusCode = 502;
    error.code = 'EXTERNAL_API_ERROR';
    error.details = { service, ...details };
    error.retryable = true;
    return error;
  }

  // Generic server errors
  static createServerError(message: string, details?: any): ApiError {
    const error = new Error(message) as ApiError;
    error.statusCode = 500;
    error.code = 'SERVER_ERROR';
    error.details = details;
    error.retryable = false;
    return error;
  }
}

/**
 * Enhanced middleware for error handling with detailed logging
 */
export function enhancedErrorHandler(
  error: ApiError,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Log error with context
  const errorContext = {
    timestamp: new Date().toISOString(),
    method: req.method,
    url: req.url,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    error: {
      message: error.message,
      code: error.code,
      statusCode: error.statusCode,
      stack: error.stack,
      details: error.details
    }
  };

  console.error('API Error:', JSON.stringify(errorContext, null, 2));

  // Determine response based on error type
  const statusCode = error.statusCode || 500;
  const isProduction = process.env.NODE_ENV === 'production';

  // Base error response
  const errorResponse: any = {
    success: false,
    error: {
      code: error.code || 'UNKNOWN_ERROR',
      message: error.message,
      timestamp: new Date().toISOString(),
      retryable: error.retryable || false
    }
  };

  // Add details for non-production environments
  if (!isProduction) {
    errorResponse.error.details = error.details;
    errorResponse.error.stack = error.stack;
    errorResponse.debug = {
      method: req.method,
      url: req.url,
      params: req.params,
      query: req.query
    };
  }

  // Add retry information for retryable errors
  if (error.retryable) {
    errorResponse.error.retryAfter = getRetryDelay(error.code);
    errorResponse.error.maxRetries = getMaxRetries(error.code);
  }

  // Send structured error response
  res.status(statusCode).json(errorResponse);
}

/**
 * Async error wrapper for route handlers
 */
export function asyncHandler(fn: Function) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Circuit breaker for external services
 */
export class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';

  constructor(
    private maxFailures = 5,
    private timeout = 60000, // 1 minute
    private retryTimeout = 30000 // 30 seconds
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime >= this.retryTimeout) {
        this.state = 'HALF_OPEN';
      } else {
        throw ErrorHandler.createExternalApiError(
          'Circuit Breaker',
          'Service temporarily unavailable'
        );
      }
    }

    try {
      const result = await Promise.race([
        operation(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Operation timeout')), this.timeout)
        )
      ]);

      // Success - reset circuit breaker
      if (this.state === 'HALF_OPEN') {
        this.state = 'CLOSED';
        this.failures = 0;
      }

      return result;
    } catch (error) {
      this.failures++;
      this.lastFailureTime = Date.now();

      if (this.failures >= this.maxFailures) {
        this.state = 'OPEN';
      }

      throw error;
    }
  }

  getStatus() {
    return {
      state: this.state,
      failures: this.failures,
      lastFailureTime: this.lastFailureTime
    };
  }
}

/**
 * Request timeout middleware
 */
export function requestTimeout(timeoutMs = 30000) {
  return (req: Request, res: Response, next: NextFunction) => {
    const timeout = setTimeout(() => {
      if (!res.headersSent) {
        const error = ErrorHandler.createServerError('Request timeout');
        next(error);
      }
    }, timeoutMs);

    res.on('finish', () => clearTimeout(timeout));
    res.on('close', () => clearTimeout(timeout));
    
    next();
  };
}

/**
 * Helper functions
 */
function getRetryDelay(errorCode?: string): number {
  switch (errorCode) {
    case 'BLOCKCHAIN_ERROR':
      return 5000; // 5 seconds
    case 'EXTERNAL_API_ERROR':
      return 10000; // 10 seconds
    case 'RATE_LIMIT_ERROR':
      return 60000; // 1 minute
    default:
      return 30000; // 30 seconds
  }
}

function getMaxRetries(errorCode?: string): number {
  switch (errorCode) {
    case 'BLOCKCHAIN_ERROR':
      return 3;
    case 'EXTERNAL_API_ERROR':
      return 2;
    case 'RATE_LIMIT_ERROR':
      return 1;
    default:
      return 2;
  }
}

/**
 * Global uncaught error handlers
 */
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  // Log to external service in production
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Log to external service in production
});