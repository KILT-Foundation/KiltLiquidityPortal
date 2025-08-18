/**
 * PRODUCTION-GRADE Error Handling and Monitoring
 * Comprehensive error handling for production deployment
 */

export interface ErrorContext {
  endpoint: string;
  method: string;
  userId?: number;
  userAddress?: string;
  timestamp: Date;
  requestId?: string;
}

export interface ProductionError {
  error: unknown;
  context: ErrorContext;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export class ProductionErrorHandler {
  private static instance: ProductionErrorHandler;
  private errorLog: ProductionError[] = [];
  private maxLogSize = 1000;

  static getInstance(): ProductionErrorHandler {
    if (!ProductionErrorHandler.instance) {
      ProductionErrorHandler.instance = new ProductionErrorHandler();
    }
    return ProductionErrorHandler.instance;
  }

  /**
   * Handle and log production errors with context
   */
  handleError(error: unknown, context: ErrorContext, severity: 'low' | 'medium' | 'high' | 'critical' = 'medium'): string {
    const productionError: ProductionError = {
      error,
      context: {
        ...context,
        timestamp: new Date()
      },
      severity
    };

    // Add to error log
    this.errorLog.push(productionError);
    
    // Keep log size manageable
    if (this.errorLog.length > this.maxLogSize) {
      this.errorLog = this.errorLog.slice(-this.maxLogSize);
    }

    // Log to console with appropriate level
    const errorMessage = this.formatErrorMessage(productionError);
    
    switch (severity) {
      case 'critical':
        console.error('🚨 CRITICAL ERROR:', errorMessage);
        break;
      case 'high':
        console.error('❌ HIGH PRIORITY ERROR:', errorMessage);
        break;
      case 'medium':
        console.warn('⚠️ MEDIUM PRIORITY ERROR:', errorMessage);
        break;
      case 'low':
        console.log('ℹ️ LOW PRIORITY ERROR:', errorMessage);
        break;
    }

    return this.getPublicErrorMessage(error, severity);
  }

  /**
   * Format error message for logging
   */
  private formatErrorMessage(productionError: ProductionError): string {
    const { error, context } = productionError;
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    return `${context.method} ${context.endpoint} - ${errorMessage} - User: ${context.userAddress || context.userId || 'unknown'} - Time: ${context.timestamp.toISOString()}`;
  }

  /**
   * Get user-friendly error message (never expose internal details)
   */
  private getPublicErrorMessage(error: unknown, severity: 'low' | 'medium' | 'high' | 'critical'): string {
    // Never expose internal error details to users
    switch (severity) {
      case 'critical':
        return 'A critical system error occurred. Please try again later.';
      case 'high':
        return 'An error occurred while processing your request. Please try again.';
      case 'medium':
        return 'Unable to complete the request. Please try again.';
      case 'low':
        return 'Request completed with minor issues.';
      default:
        return 'An unexpected error occurred.';
    }
  }

  /**
   * Get error statistics for monitoring
   */
  getErrorStats(): {
    total: number;
    bySeverity: Record<string, number>;
    recentErrors: number;
    topEndpoints: Array<{ endpoint: string; count: number }>;
  } {
    const total = this.errorLog.length;
    const recentErrors = this.errorLog.filter(e => 
      (new Date().getTime() - e.context.timestamp.getTime()) < 3600000 // Last hour
    ).length;

    const bySeverity = this.errorLog.reduce((acc, error) => {
      acc[error.severity] = (acc[error.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const endpointCounts = this.errorLog.reduce((acc, error) => {
      acc[error.context.endpoint] = (acc[error.context.endpoint] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const topEndpoints = Object.entries(endpointCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([endpoint, count]) => ({ endpoint, count }));

    return {
      total,
      bySeverity,
      recentErrors,
      topEndpoints
    };
  }

  /**
   * Clear error log (for maintenance)
   */
  clearErrorLog(): void {
    this.errorLog = [];
  }
}

export const productionErrorHandler = ProductionErrorHandler.getInstance();

/**
 * Express middleware for production error handling
 */
export function withProductionErrorHandling(endpoint: string, method: string) {
  return (req: any, res: any, next: any) => {
    const originalJson = res.json;
    const originalStatus = res.status;
    
    // Override json method to catch errors
    res.json = function(data: any) {
      if (data?.error && res.statusCode >= 400) {
        const context: ErrorContext = {
          endpoint,
          method,
          userId: req.params?.userId ? parseInt(req.params.userId) : undefined,
          userAddress: req.params?.userAddress || req.params?.address,
          timestamp: new Date()
        };
        
        const severity = res.statusCode >= 500 ? 'high' : 'medium';
        productionErrorHandler.handleError(data.error, context, severity);
      }
      
      return originalJson.call(this, data);
    };
    
    next();
  };
}