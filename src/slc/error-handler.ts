/**
 * Error Handling System — Graceful Recovery & User Guidance
 *
 * Comprehensive error handling with:
 * - Context-aware error messages
 * - Recovery suggestions
 * - Automatic retry logic
 * - Error telemetry
 *
 * Design: Defensive programming with user-friendly messaging
 */

import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// =============================================================================
// ERROR TYPES
// =============================================================================

/**
 * Base error class for PeakInfer.
 */
export class PeakInferError extends Error {
  code: string;
  suggestion?: string;
  details?: any;
  recoverable: boolean;

  constructor(message: string, code: string, options?: {
    suggestion?: string;
    details?: any;
    recoverable?: boolean;
  }) {
    super(message);
    this.name = 'PeakInferError';
    this.code = code;
    this.suggestion = options?.suggestion;
    this.details = options?.details;
    this.recoverable = options?.recoverable ?? false;
  }
}

/**
 * API-related errors.
 */
export class APIError extends PeakInferError {
  statusCode?: number;
  provider?: string;

  constructor(message: string, options?: {
    statusCode?: number;
    provider?: string;
    suggestion?: string;
    details?: any;
  }) {
    super(message, 'API_ERROR', {
      suggestion: options?.suggestion,
      details: options?.details,
      recoverable: options?.statusCode === 429 || options?.statusCode === 503,
    });
    this.statusCode = options?.statusCode;
    this.provider = options?.provider;
  }
}

/**
 * File system errors.
 */
export class FileSystemError extends PeakInferError {
  path?: string;
  operation?: string;

  constructor(message: string, options?: {
    path?: string;
    operation?: string;
    suggestion?: string;
  }) {
    super(message, 'FILESYSTEM_ERROR', {
      suggestion: options?.suggestion,
      recoverable: false,
    });
    this.path = options?.path;
    this.operation = options?.operation;
  }
}

/**
 * Configuration errors.
 */
export class ConfigurationError extends PeakInferError {
  field?: string;

  constructor(message: string, options?: {
    field?: string;
    suggestion?: string;
  }) {
    super(message, 'CONFIG_ERROR', {
      suggestion: options?.suggestion,
      recoverable: false,
    });
    this.field = options?.field;
  }
}

/**
 * Analysis errors.
 */
export class AnalysisError extends PeakInferError {
  phase?: string;
  partial?: boolean;

  constructor(message: string, options?: {
    phase?: string;
    partial?: boolean;
    suggestion?: string;
  }) {
    super(message, 'ANALYSIS_ERROR', {
      suggestion: options?.suggestion,
      recoverable: options?.partial ?? false,
    });
    this.phase = options?.phase;
    this.partial = options?.partial;
  }
}

// =============================================================================
// ERROR HANDLER
// =============================================================================

/**
 * Central error handler with recovery strategies.
 */
export class ErrorHandler {
  private static errorLog: PeakInferError[] = [];
  private static retryAttempts = new Map<string, number>();

  /**
   * Handle an error with appropriate recovery.
   */
  static async handle(error: unknown, context?: {
    operation?: string;
    critical?: boolean;
    retry?: boolean;
    maxRetries?: number;
  }): Promise<void> {
    const peakError = this.normalize(error);
    this.errorLog.push(peakError);

    // Log to error file
    await this.logError(peakError, context);

    // Display user-friendly error
    this.display(peakError);

    // Attempt recovery if possible
    if (peakError.recoverable && context?.retry) {
      const retryKey = `${peakError.code}-${context.operation}`;
      const attempts = this.retryAttempts.get(retryKey) || 0;
      const maxRetries = context.maxRetries || 3;

      if (attempts < maxRetries) {
        this.retryAttempts.set(retryKey, attempts + 1);
        console.log(chalk.yellow(`\n⟳ Retrying (attempt ${attempts + 1}/${maxRetries})...\n`));

        // Wait with exponential backoff
        await this.wait(Math.pow(2, attempts) * 1000);
        return;
      }
    }

    // Exit if critical error
    if (context?.critical) {
      process.exit(1);
    }
  }

  /**
   * Normalize various error types to PeakInferError.
   */
  static normalize(error: unknown): PeakInferError {
    if (error instanceof PeakInferError) {
      return error;
    }

    if (error instanceof Error) {
      // API rate limiting
      if (error.message.includes('rate_limit') || error.message.includes('429')) {
        return new APIError('API rate limit exceeded', {
          statusCode: 429,
          suggestion: 'Wait a few moments and try again, or reduce request frequency',
        });
      }

      // Authentication errors
      if (error.message.includes('authentication') || error.message.includes('401')) {
        return new ConfigurationError('API authentication failed', {
          field: 'ANTHROPIC_API_KEY',
          suggestion: 'Check your API key is valid and has the necessary permissions',
        });
      }

      // Network errors
      if (error.message.includes('ENOTFOUND') || error.message.includes('ETIMEDOUT')) {
        return new APIError('Network connection failed', {
          suggestion: 'Check your internet connection and try again',
        });
      }

      // File not found
      if (error.message.includes('ENOENT')) {
        const match = error.message.match(/ENOENT.*'([^']+)'/);
        const path = match ? match[1] : 'unknown';
        return new FileSystemError(`File or directory not found: ${path}`, {
          path,
          operation: 'read',
          suggestion: 'Check the file path and ensure it exists',
        });
      }

      // Permission denied
      if (error.message.includes('EACCES') || error.message.includes('EPERM')) {
        return new FileSystemError('Permission denied', {
          suggestion: 'Check file permissions or run with appropriate privileges',
        });
      }

      // Generic error
      return new PeakInferError(error.message, 'UNKNOWN_ERROR');
    }

    // String error
    if (typeof error === 'string') {
      return new PeakInferError(error, 'UNKNOWN_ERROR');
    }

    // Unknown error type
    return new PeakInferError('An unexpected error occurred', 'UNKNOWN_ERROR', {
      details: error,
    });
  }

  /**
   * Display error to user.
   */
  static display(error: PeakInferError): void {
    console.error('');

    // Error header
    const icon = error.recoverable ? '⚠️' : '❌';
    console.error(chalk.red.bold(`${icon} ${error.name}: ${error.code}`));

    // Error message
    console.error(chalk.red(error.message));

    // Suggestion
    if (error.suggestion) {
      console.error('');
      console.error(chalk.yellow('💡 Suggestion:'));
      console.error(chalk.yellow(`   ${error.suggestion}`));
    }

    // Additional details for verbose mode
    if (process.env.PEAKINFER_DEBUG === 'true' && error.details) {
      console.error('');
      console.error(chalk.dim('Debug details:'));
      console.error(chalk.dim(JSON.stringify(error.details, null, 2)));
    }

    console.error('');
  }

  /**
   * Log error to file for debugging.
   */
  static async logError(error: PeakInferError, context?: any): Promise<void> {
    const logDir = path.join(os.homedir(), '.peakinfer', 'logs');
    const logFile = path.join(logDir, 'errors.log');

    try {
      // Create log directory
      await fs.promises.mkdir(logDir, { recursive: true });

      // Prepare log entry
      const entry = {
        timestamp: new Date().toISOString(),
        code: error.code,
        message: error.message,
        suggestion: error.suggestion,
        recoverable: error.recoverable,
        context,
        stack: error.stack,
        details: error.details,
      };

      // Append to log file
      const logLine = JSON.stringify(entry) + '\n';
      await fs.promises.appendFile(logFile, logLine, 'utf-8');
    } catch {
      // Silently fail logging (don't compound errors)
    }
  }

  /**
   * Get error statistics.
   */
  static getStats(): {
    total: number;
    byCode: Record<string, number>;
    recoverable: number;
  } {
    const stats = {
      total: this.errorLog.length,
      byCode: {} as Record<string, number>,
      recoverable: 0,
    };

    for (const error of this.errorLog) {
      stats.byCode[error.code] = (stats.byCode[error.code] || 0) + 1;
      if (error.recoverable) stats.recoverable++;
    }

    return stats;
  }

  /**
   * Clear error log.
   */
  static clearLog(): void {
    this.errorLog = [];
    this.retryAttempts.clear();
  }

  /**
   * Wait helper for retry logic.
   */
  private static wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// =============================================================================
// ERROR RECOVERY STRATEGIES
// =============================================================================

/**
 * Retry with exponential backoff.
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts?: number;
    initialDelay?: number;
    maxDelay?: number;
    factor?: number;
    onRetry?: (attempt: number, delay: number) => void;
  } = {}
): Promise<T> {
  const maxAttempts = options.maxAttempts || 3;
  const initialDelay = options.initialDelay || 1000;
  const maxDelay = options.maxDelay || 30000;
  const factor = options.factor || 2;

  let lastError: any;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt === maxAttempts) {
        throw error;
      }

      const delay = Math.min(initialDelay * Math.pow(factor, attempt - 1), maxDelay);

      if (options.onRetry) {
        options.onRetry(attempt, delay);
      }

      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

/**
 * Circuit breaker pattern for API calls.
 */
export class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';

  constructor(
    private threshold: number = 5,
    private timeout: number = 60000
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check if circuit should be reset
    if (this.state === 'open' && Date.now() - this.lastFailureTime > this.timeout) {
      this.state = 'half-open';
      this.failures = 0;
    }

    // Reject if circuit is open
    if (this.state === 'open') {
      throw new APIError('Circuit breaker is open - service temporarily unavailable', {
        suggestion: 'Wait a few moments for the service to recover',
      });
    }

    try {
      const result = await fn();

      // Reset on success
      if (this.state === 'half-open') {
        this.state = 'closed';
        this.failures = 0;
      }

      return result;
    } catch (error) {
      this.failures++;
      this.lastFailureTime = Date.now();

      // Trip circuit if threshold exceeded
      if (this.failures >= this.threshold) {
        this.state = 'open';
      }

      throw error;
    }
  }

  reset(): void {
    this.failures = 0;
    this.state = 'closed';
  }
}

// =============================================================================
// ERROR CONTEXT PROVIDERS
// =============================================================================

/**
 * Provide context-aware error messages.
 */
export class ErrorContext {
  /**
   * Get suggestion based on error code and context.
   */
  static getSuggestion(code: string, context?: any): string {
    const suggestions: Record<string, string> = {
      'API_ERROR': 'Check your API key and network connection',
      'FILESYSTEM_ERROR': 'Verify file paths and permissions',
      'CONFIG_ERROR': 'Review your configuration settings',
      'ANALYSIS_ERROR': 'Try analyzing a smaller codebase or specific directory',
      'RATE_LIMIT': 'Wait a few moments or upgrade your API plan',
      'AUTH_ERROR': 'Verify your API key at https://console.anthropic.com',
      'NETWORK_ERROR': 'Check your internet connection and firewall settings',
      'PERMISSION_ERROR': 'Run with appropriate privileges or check file ownership',
      'NOT_FOUND': 'Verify the path exists and is accessible',
      'TIMEOUT': 'The operation took too long - try with a smaller scope',
    };

    return suggestions[code] || 'Please check the documentation or report an issue';
  }

  /**
   * Get recovery action based on error.
   */
  static getRecoveryAction(error: PeakInferError): string | null {
    if (error.code === 'API_ERROR' && error.recoverable) {
      return 'retry';
    }

    if (error.code === 'CONFIG_ERROR') {
      return 'reconfigure';
    }

    if (error.code === 'FILESYSTEM_ERROR' && error.details?.operation === 'write') {
      return 'change-output-dir';
    }

    return null;
  }
}

// =============================================================================
// GRACEFUL SHUTDOWN
// =============================================================================

/**
 * Handle graceful shutdown on signals.
 */
export function setupGracefulShutdown(cleanup?: () => Promise<void>): void {
  const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM', 'SIGQUIT'];

  let shutdownInProgress = false;

  const shutdown = async (signal: string) => {
    if (shutdownInProgress) return;
    shutdownInProgress = true;

    console.log(chalk.yellow(`\n\n⚠️  Received ${signal}, shutting down gracefully...`));

    try {
      if (cleanup) {
        await cleanup();
      }

      // Log error stats if any
      const stats = ErrorHandler.getStats();
      if (stats.total > 0) {
        console.log(chalk.dim(`\n📊 Error summary: ${stats.total} errors encountered`));
        for (const [code, count] of Object.entries(stats.byCode)) {
          console.log(chalk.dim(`   ${code}: ${count}`));
        }
      }

      console.log(chalk.green('\n✅ Shutdown complete\n'));
      process.exit(0);
    } catch (error) {
      console.error(chalk.red('\n❌ Error during shutdown:'), error);
      process.exit(1);
    }
  };

  for (const signal of signals) {
    process.on(signal, () => shutdown(signal));
  }

  // Handle uncaught errors
  process.on('uncaughtException', (error) => {
    console.error(chalk.red.bold('\n❌ Uncaught Exception:'));
    console.error(error);
    shutdown('uncaughtException');
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error(chalk.red.bold('\n❌ Unhandled Promise Rejection:'));
    console.error(reason);
    shutdown('unhandledRejection');
  });
}