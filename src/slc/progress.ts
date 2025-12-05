/**
 * Progress Indicator System — Clean Terminal UI
 *
 * Julie Zhou principles:
 * - Clarity over cleverness
 * - Invisible UI (doesn't get in the way)
 * - Progressive disclosure
 * - Emotional design (delight in details)
 */

import ora, { Ora } from 'ora';
import chalk from 'chalk';
import { EventEmitter } from 'events';

// =============================================================================
// TYPES
// =============================================================================

export interface ProgressOptions {
  /** Initial message */
  message?: string;
  /** Show elapsed time */
  showTime?: boolean;
  /** Enable colored output */
  color?: boolean;
  /** Spinner style */
  spinner?: string;
  /** Silent mode (no output) */
  silent?: boolean;
}

export interface ProgressStep {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'success' | 'warning' | 'error' | 'skipped';
  duration?: number;
  message?: string;
  details?: string[];
}

export interface ProgressMetrics {
  startTime: number;
  endTime?: number;
  totalSteps: number;
  completedSteps: number;
  failedSteps: number;
  warnings: string[];
  errors: string[];
}

// =============================================================================
// PROGRESS MANAGER
// =============================================================================

/**
 * Clean, modern progress indicator system.
 * Supports spinners, progress bars, and step tracking.
 */
export class ProgressManager extends EventEmitter {
  private spinner: Ora | null = null;
  private steps: Map<string, ProgressStep> = new Map();
  private metrics: ProgressMetrics;
  private options: ProgressOptions;
  private currentStep: string | null = null;
  private stepStartTime: number = 0;

  constructor(options: ProgressOptions = {}) {
    super();
    this.options = {
      showTime: true,
      color: true,
      spinner: 'dots',
      silent: false,
      ...options,
    };

    this.metrics = {
      startTime: Date.now(),
      totalSteps: 0,
      completedSteps: 0,
      failedSteps: 0,
      warnings: [],
      errors: [],
    };

    if (!this.options.silent && process.stdout.isTTY) {
      this.spinner = ora({
        spinner: this.options.spinner as any,
        color: 'blue',
        hideCursor: true,
      });
    }
  }

  /**
   * Start a new progress session.
   */
  start(message?: string): void {
    if (this.options.silent) return;

    this.metrics.startTime = Date.now();
    const msg = message || 'Initializing...';

    if (this.spinner) {
      this.spinner.start(this.formatMessage(msg));
    } else {
      console.log(this.formatMessage(msg));
    }

    this.emit('start', { message: msg });
  }

  /**
   * Update current progress message.
   */
  update(message: string, details?: string[]): void {
    if (this.options.silent) return;

    const formatted = this.formatMessage(message, details);

    if (this.spinner) {
      this.spinner.text = formatted;
    } else {
      console.log(formatted);
    }

    this.emit('update', { message, details });
  }

  /**
   * Start a new step.
   */
  startStep(id: string, name: string): void {
    if (this.currentStep) {
      this.completeStep(this.currentStep, 'success');
    }

    const step: ProgressStep = {
      id,
      name,
      status: 'running',
    };

    this.steps.set(id, step);
    this.currentStep = id;
    this.stepStartTime = Date.now();
    this.metrics.totalSteps++;

    this.update(`${name}...`);
    this.emit('step-start', step);
  }

  /**
   * Complete current step.
   */
  completeStep(id: string, status: ProgressStep['status'] = 'success', message?: string): void {
    const step = this.steps.get(id);
    if (!step) return;

    step.status = status;
    step.duration = Date.now() - this.stepStartTime;
    step.message = message;

    if (status === 'success') {
      this.metrics.completedSteps++;
      if (this.spinner && !this.options.silent) {
        this.spinner.succeed(this.formatStepComplete(step));
      }
    } else if (status === 'error') {
      this.metrics.failedSteps++;
      if (message) this.metrics.errors.push(message);
      if (this.spinner && !this.options.silent) {
        this.spinner.fail(this.formatStepComplete(step));
      }
    } else if (status === 'warning') {
      if (message) this.metrics.warnings.push(message);
      if (this.spinner && !this.options.silent) {
        this.spinner.warn(this.formatStepComplete(step));
      }
    } else if (status === 'skipped') {
      if (this.spinner && !this.options.silent) {
        this.spinner.info(this.formatStepComplete(step));
      }
    }

    this.currentStep = null;
    this.emit('step-complete', step);
  }

  /**
   * Add a warning message.
   */
  warn(message: string): void {
    this.metrics.warnings.push(message);

    if (this.options.silent) return;

    if (this.spinner) {
      this.spinner.warn(chalk.yellow(message));
      // Restart spinner for next operation
      this.spinner.start();
    } else {
      console.log(chalk.yellow(`⚠ ${message}`));
    }

    this.emit('warning', { message });
  }

  /**
   * Add an error message.
   */
  error(message: string): void {
    this.metrics.errors.push(message);

    if (this.options.silent) return;

    if (this.spinner) {
      this.spinner.fail(chalk.red(message));
    } else {
      console.error(chalk.red(`✖ ${message}`));
    }

    this.emit('error', { message });
  }

  /**
   * Successfully complete the entire progress.
   */
  succeed(message?: string): void {
    if (this.currentStep) {
      this.completeStep(this.currentStep, 'success');
    }

    this.metrics.endTime = Date.now();
    const duration = this.metrics.endTime - this.metrics.startTime;

    if (!this.options.silent) {
      const finalMsg = message || 'Complete';
      const formatted = this.formatFinalMessage(finalMsg, duration);

      if (this.spinner) {
        this.spinner.succeed(formatted);
      } else {
        console.log(chalk.green(`✔ ${formatted}`));
      }
    }

    this.emit('complete', this.metrics);
  }

  /**
   * Fail the entire progress.
   */
  fail(message?: string): void {
    if (this.currentStep) {
      this.completeStep(this.currentStep, 'error');
    }

    this.metrics.endTime = Date.now();

    if (!this.options.silent) {
      const finalMsg = message || 'Failed';

      if (this.spinner) {
        this.spinner.fail(chalk.red(finalMsg));
      } else {
        console.error(chalk.red(`✖ ${finalMsg}`));
      }
    }

    this.emit('fail', this.metrics);
  }

  /**
   * Stop spinner without success/fail state.
   */
  stop(): void {
    if (this.spinner) {
      this.spinner.stop();
    }
    this.emit('stop', this.metrics);
  }

  /**
   * Clear spinner line.
   */
  clear(): void {
    if (this.spinner) {
      this.spinner.clear();
    }
  }

  /**
   * Get current metrics.
   */
  getMetrics(): ProgressMetrics {
    return { ...this.metrics };
  }

  // =============================================================================
  // FORMATTING HELPERS
  // =============================================================================

  private formatMessage(message: string, details?: string[]): string {
    let formatted = message;

    if (this.options.showTime) {
      const elapsed = this.formatDuration(Date.now() - this.metrics.startTime);
      formatted = `${message} ${chalk.dim(`[${elapsed}]`)}`;
    }

    if (details && details.length > 0) {
      formatted += chalk.dim(` (${details.join(', ')})`);
    }

    return formatted;
  }

  private formatStepComplete(step: ProgressStep): string {
    let message = step.name;

    if (step.message) {
      message += ` - ${step.message}`;
    }

    if (this.options.showTime && step.duration) {
      message += chalk.dim(` [${this.formatDuration(step.duration)}]`);
    }

    return message;
  }

  private formatFinalMessage(message: string, duration: number): string {
    if (this.options.showTime) {
      return `${message} ${chalk.dim(`[${this.formatDuration(duration)}]`)}`;
    }
    return message;
  }

  private formatDuration(ms: number): string {
    if (ms < 1000) {
      return `${ms}ms`;
    } else if (ms < 60000) {
      return `${(ms / 1000).toFixed(1)}s`;
    } else {
      const minutes = Math.floor(ms / 60000);
      const seconds = ((ms % 60000) / 1000).toFixed(0);
      return `${minutes}m ${seconds}s`;
    }
  }
}

// =============================================================================
// PROGRESS BAR
// =============================================================================

/**
 * Terminal progress bar for file operations.
 */
export class ProgressBar {
  private total: number;
  private current: number = 0;
  private width: number;
  private label: string;
  private lastRender: string = '';

  constructor(total: number, options: { width?: number; label?: string } = {}) {
    this.total = total;
    this.width = options.width || 40;
    this.label = options.label || 'Progress';
  }

  /**
   * Update progress.
   */
  update(current: number, message?: string): void {
    this.current = Math.min(current, this.total);
    this.render(message);
  }

  /**
   * Increment progress by 1.
   */
  increment(message?: string): void {
    this.update(this.current + 1, message);
  }

  /**
   * Render the progress bar.
   */
  private render(message?: string): void {
    if (!process.stdout.isTTY) return;

    const percent = Math.floor((this.current / this.total) * 100);
    const filled = Math.floor((this.current / this.total) * this.width);
    const empty = this.width - filled;

    const bar = chalk.cyan('█').repeat(filled) + chalk.gray('░').repeat(empty);
    const percentStr = `${percent}%`.padStart(4);
    const countStr = `${this.current}/${this.total}`;

    let output = `${this.label}: ${bar} ${percentStr} ${chalk.dim(countStr)}`;
    if (message) {
      output += ` ${chalk.dim(message)}`;
    }

    // Clear previous line and write new one
    process.stdout.write('\r\x1b[K' + output);
    this.lastRender = output;

    // New line when complete
    if (this.current >= this.total) {
      process.stdout.write('\n');
    }
  }

  /**
   * Clear the progress bar.
   */
  clear(): void {
    if (process.stdout.isTTY) {
      process.stdout.write('\r\x1b[K');
    }
  }
}

// =============================================================================
// ANIMATED MESSAGES
// =============================================================================

/**
 * Animated status messages for long-running operations.
 */
export class AnimatedMessage {
  private messages: string[];
  private interval: NodeJS.Timeout | null = null;
  private currentIndex: number = 0;
  private spinner: Ora | null = null;

  constructor(messages: string[]) {
    this.messages = messages;
  }

  /**
   * Start rotating through messages.
   */
  start(intervalMs: number = 3000): void {
    if (!process.stdout.isTTY) {
      console.log(this.messages[0]);
      return;
    }

    this.spinner = ora({
      spinner: 'dots',
      text: this.messages[0],
    }).start();

    this.interval = setInterval(() => {
      this.currentIndex = (this.currentIndex + 1) % this.messages.length;
      if (this.spinner) {
        this.spinner.text = this.messages[this.currentIndex];
      }
    }, intervalMs);
  }

  /**
   * Stop animation.
   */
  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    if (this.spinner) {
      this.spinner.stop();
    }
  }

  /**
   * Stop with success.
   */
  succeed(message?: string): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    if (this.spinner) {
      this.spinner.succeed(message || 'Complete');
    }
  }

  /**
   * Stop with failure.
   */
  fail(message?: string): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    if (this.spinner) {
      this.spinner.fail(message || 'Failed');
    }
  }
}

// =============================================================================
// FACTORY FUNCTIONS
// =============================================================================

/**
 * Create a simple spinner for quick operations.
 */
export function createSpinner(message: string): Ora | null {
  if (!process.stdout.isTTY) {
    console.log(message);
    return null;
  }
  return ora(message).start();
}

/**
 * Create a progress manager with sensible defaults.
 */
export function createProgress(options?: ProgressOptions): ProgressManager {
  return new ProgressManager(options);
}

/**
 * Create a progress bar.
 */
export function createProgressBar(total: number, label?: string): ProgressBar {
  return new ProgressBar(total, { label });
}

/**
 * Create animated messages.
 */
export function createAnimatedMessage(messages: string[]): AnimatedMessage {
  return new AnimatedMessage(messages);
}

// =============================================================================
// THEME & STYLING
// =============================================================================

/**
 * Consistent color themes for different message types.
 */
export const theme = {
  // Status colors
  success: chalk.green,
  error: chalk.red,
  warning: chalk.yellow,
  info: chalk.blue,
  muted: chalk.dim,

  // Element colors
  primary: chalk.cyan,
  secondary: chalk.magenta,
  accent: chalk.yellow,

  // Semantic colors
  provider: chalk.cyan,
  model: chalk.yellow,
  file: chalk.blue,
  cost: chalk.green,

  // Formatting
  bold: chalk.bold,
  dim: chalk.dim,
  italic: chalk.italic,
  underline: chalk.underline,
};

/**
 * Format helpers for consistent output.
 */
export const format = {
  /**
   * Format a file path with line number.
   */
  fileLine: (file: string, line?: number): string => {
    if (line !== undefined) {
      return `${theme.file(file)}:${theme.muted(line.toString())}`;
    }
    return theme.file(file);
  },

  /**
   * Format a cost value.
   */
  cost: (amount: number): string => {
    return theme.cost(`$${amount.toFixed(2)}`);
  },

  /**
   * Format a percentage.
   */
  percentage: (value: number): string => {
    return `${value.toFixed(1)}%`;
  },

  /**
   * Format a count with label.
   */
  count: (count: number, label: string): string => {
    const plural = count !== 1 ? 's' : '';
    return `${theme.bold(count.toString())} ${label}${plural}`;
  },

  /**
   * Format a model/provider combo.
   */
  modelProvider: (provider: string, model: string): string => {
    return `${theme.provider(provider)}/${theme.model(model)}`;
  },

  /**
   * Format a key-value pair.
   */
  keyValue: (key: string, value: string): string => {
    return `${theme.muted(key + ':')} ${value}`;
  },

  /**
   * Format a bullet list.
   */
  bulletList: (items: string[], indent: number = 0): string => {
    const prefix = ' '.repeat(indent);
    return items.map(item => `${prefix}• ${item}`).join('\n');
  },

  /**
   * Format a numbered list.
   */
  numberedList: (items: string[], indent: number = 0): string => {
    const prefix = ' '.repeat(indent);
    return items.map((item, i) => `${prefix}${i + 1}. ${item}`).join('\n');
  },
};