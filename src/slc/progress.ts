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
// ETA TRACKER
// =============================================================================

/**
 * Options for ETA tracker configuration.
 */
export interface ETATrackerOptions {
  /** Smoothing factor for EMA (0.0-1.0, higher = more responsive) */
  smoothingFactor?: number;
  /** Initial estimate in milliseconds */
  initialEstimateMs?: number;
}

/**
 * ETA (Estimated Time of Arrival) tracker for long-running operations.
 * Uses exponential moving average for adaptive time estimates.
 * 
 * Inspired by Uber/Ola-style progress indicators.
 */
export class ETATracker {
  private startTime: number = 0;
  private totalSteps: number = 0;
  private completedSteps: number = 0;
  private stepDurations: number[] = [];
  private lastStepTime: number = 0;
  private smoothingFactor: number;
  private emaStepDuration: number = 0;
  private initialEstimateMs: number;

  constructor(options: ETATrackerOptions = {}) {
    this.smoothingFactor = options.smoothingFactor ?? 0.3;
    this.initialEstimateMs = options.initialEstimateMs ?? 60000; // 1 minute default
  }

  /**
   * Start tracking with a known number of total steps.
   */
  start(totalSteps: number): void {
    this.startTime = Date.now();
    this.totalSteps = totalSteps;
    this.completedSteps = 0;
    this.stepDurations = [];
    this.lastStepTime = this.startTime;
    this.emaStepDuration = this.initialEstimateMs / totalSteps;
  }

  /**
   * Mark a step as complete.
   */
  completeStep(): void {
    const now = Date.now();
    const stepDuration = now - this.lastStepTime;
    this.lastStepTime = now;

    this.stepDurations.push(stepDuration);
    this.completedSteps++;

    // Update EMA (Exponential Moving Average)
    if (this.completedSteps === 1) {
      this.emaStepDuration = stepDuration;
    } else {
      this.emaStepDuration = this.smoothingFactor * stepDuration + 
                             (1 - this.smoothingFactor) * this.emaStepDuration;
    }
  }

  /**
   * Update progress without completing (for partial step updates).
   */
  update(currentStep: number): void {
    // If we jumped ahead, mark intermediate steps as complete
    while (this.completedSteps < currentStep) {
      this.completeStep();
    }
  }

  /**
   * Get current ETA information.
   */
  getETA(): { remainingMs: number; formattedETA: string; progress: number; elapsed: number } {
    const elapsed = Date.now() - this.startTime;
    const remainingSteps = this.totalSteps - this.completedSteps;
    const progress = this.totalSteps > 0 ? (this.completedSteps / this.totalSteps) * 100 : 0;

    // Estimate remaining time
    let remainingMs: number;
    if (this.completedSteps === 0) {
      remainingMs = this.initialEstimateMs;
    } else {
      remainingMs = Math.round(this.emaStepDuration * remainingSteps);
    }

    // Cap at reasonable maximum (10 minutes)
    remainingMs = Math.min(remainingMs, 600000);

    return {
      remainingMs,
      formattedETA: this.formatETA(remainingMs, progress),
      progress,
      elapsed,
    };
  }

  /**
   * Format ETA as human-readable string.
   */
  private formatETA(remainingMs: number, progress: number): string {
    // If almost done, show "finishing up..."
    if (progress > 95) {
      return 'finishing up...';
    }

    // If just started, show "estimating..."
    if (progress < 5 && this.completedSteps < 2) {
      return 'estimating...';
    }

    // Format time remaining
    if (remainingMs < 10000) {
      return 'a few seconds remaining';
    } else if (remainingMs < 60000) {
      const seconds = Math.ceil(remainingMs / 1000);
      return `~${seconds}s remaining`;
    } else if (remainingMs < 3600000) {
      const minutes = Math.floor(remainingMs / 60000);
      const seconds = Math.ceil((remainingMs % 60000) / 1000);
      if (seconds > 0) {
        return `~${minutes}m ${seconds}s remaining`;
      }
      return `~${minutes}m remaining`;
    } else {
      const hours = Math.floor(remainingMs / 3600000);
      const minutes = Math.ceil((remainingMs % 3600000) / 60000);
      return `~${hours}h ${minutes}m remaining`;
    }
  }
}

// =============================================================================
// ANALYSIS PROGRESS (Uber/Ola Style)
// =============================================================================

/**
 * Analysis phase configuration.
 */
interface AnalysisPhase {
  name: string;
  icon: string;
  messages: string[];
}

/**
 * Options for analysis progress display.
 */
export interface AnalysisProgressOptions {
  /** Maximum turns expected */
  maxTurns: number;
  /** Number of files in codebase (for context) */
  fileCount?: number;
  /** Disable output (for testing) */
  silent?: boolean;
}

/**
 * Uber/Ola-style progress display for analysis operations.
 * Shows multi-line progress with ETA, phase indicators, and contextual messages.
 */
export class AnalysisProgress {
  private spinner: Ora | null = null;
  private eta: ETATracker;
  private maxTurns: number = 30;
  private currentTurn: number = 0;
  private currentActivity: string = '';
  private currentToolUse: string = '';
  private messageIndex: number = 0;
  private tipIndex: number = 0;
  private lastTipTime: number = 0;
  private updateInterval: NodeJS.Timeout | null = null;
  private silent: boolean = false;
  private fileCount: number = 0;

  /** Phase definitions with rotating messages */
  private readonly phases: AnalysisPhase[] = [
    {
      name: 'Initialization',
      icon: '[1/4]',
      messages: [
        'Warming up the AI engines...',
        'Loading pattern recognition...',
        'Preparing analysis pipeline...',
      ],
    },
    {
      name: 'Pattern Detection',
      icon: '[2/4]',
      messages: [
        'Scanning for LLM SDK imports...',
        'Detecting inference patterns...',
        'Mapping API call locations...',
        'Identifying cost optimization opportunities...',
        'Analyzing provider configurations...',
        'Tracing model usage patterns...',
      ],
    },
    {
      name: 'Stack Mapping',
      icon: '[3/4]',
      messages: [
        'Building the stack map...',
        'Connecting callsites to providers...',
        'Calculating cost distribution...',
        'Analyzing tech stack layers...',
      ],
    },
    {
      name: 'Insights',
      icon: '[4/4]',
      messages: [
        'Generating insights...',
        'Preparing your report...',
        'Almost there...',
      ],
    },
  ];

  /** Fun tips to show during analysis */
  private readonly tips: string[] = [
    'PeakInfer can detect 15+ LLM SDKs and frameworks.',
    'Use --html for a beautiful interactive report.',
    'Runtime telemetry provides even more accurate cost data.',
    'Larger codebases = more comprehensive analysis.',
    'Results are cached for faster subsequent runs.',
    'Found an issue? Report it at github.com/kalmantic/peakinfer',
  ];

  constructor() {
    this.eta = new ETATracker({
      smoothingFactor: 0.3,
      initialEstimateMs: 45000, // 45 seconds initial estimate
    });
  }

  /**
   * Start the analysis progress display.
   */
  start(options: AnalysisProgressOptions): void {
    this.maxTurns = options.maxTurns || 30;
    this.fileCount = options.fileCount || 0;
    this.silent = options.silent || false;
    this.currentTurn = 0;
    this.messageIndex = 0;
    this.tipIndex = 0;
    this.lastTipTime = Date.now();

    this.eta.start(this.maxTurns);

    if (this.silent || !process.stdout.isTTY) {
      console.log('Analyzing codebase...');
      return;
    }

    this.spinner = ora({
      spinner: 'dots',
      color: 'cyan',
      hideCursor: true,
    }).start();

    this.render();

    // Start update interval for smooth animations
    this.updateInterval = setInterval(() => {
      this.render();
    }, 500);
  }

  /**
   * Update turn progress.
   */
  updateTurn(turn: number, activity?: string): void {
    this.currentTurn = turn;
    this.eta.update(turn);
    if (activity) {
      this.currentActivity = activity;
    }
    this.render();
  }

  /**
   * Show current tool usage.
   */
  setToolUse(toolName: string, target?: string): void {
    if (target) {
      // Truncate long targets
      const maxLen = 40;
      const displayTarget = target.length > maxLen 
        ? target.substring(0, maxLen - 3) + '...' 
        : target;
      this.currentToolUse = `Using ${toolName}: ${displayTarget}`;
    } else {
      this.currentToolUse = `Using ${toolName}...`;
    }
    this.render();
  }

  /**
   * Complete progress with success.
   */
  complete(message?: string): void {
    this.stopInterval();

    // Set maxTurns to current to show 100% completion
    this.maxTurns = this.currentTurn;
    this.render(); // Final render at 100%

    if (this.silent) {
      console.log(message || 'Analysis complete');
      return;
    }

    if (this.spinner) {
      this.spinner.succeed(message || 'Analysis complete');
      this.spinner = null;
    }
  }

  /**
   * Complete progress with failure.
   */
  fail(message?: string): void {
    this.stopInterval();

    if (this.silent) {
      console.log(message || '✖ Analysis failed');
      return;
    }

    if (this.spinner) {
      this.spinner.fail(message || 'Analysis failed');
      this.spinner = null;
    }
  }

  /**
   * Stop the progress display.
   */
  stop(): void {
    this.stopInterval();
    if (this.spinner) {
      this.spinner.stop();
      this.spinner = null;
    }
  }

  /**
   * Render the progress display.
   */
  private render(): void {
    if (this.silent || !this.spinner) return;

    const phase = this.getCurrentPhase();
    const etaInfo = this.eta.getETA();
    const progressBar = this.renderProgressBar(etaInfo.progress);
    const currentMessage = this.getCurrentMessage(phase);

    // Rotate tips every 15 seconds
    const now = Date.now();
    if (now - this.lastTipTime > 15000) {
      this.tipIndex = (this.tipIndex + 1) % this.tips.length;
      this.lastTipTime = now;
    }

    // Build multi-line display
    const lines: string[] = [
      '',
      `   ${chalk.bold(`${phase.icon} ${phase.name}`)}`,
      `   |  Turn ${this.currentTurn}/${this.maxTurns} ${progressBar} ${Math.round(etaInfo.progress)}%`,
    ];

    // Show tool use if active, otherwise show rotating message
    if (this.currentToolUse) {
      lines.push(`   |  ${chalk.cyan(this.currentToolUse)}`);
    } else {
      lines.push(`   |  ${chalk.dim(currentMessage)}`);
    }

    // Show ETA
    lines.push(`   |  ${chalk.yellow(etaInfo.formattedETA)}`);

    // Show tip occasionally (without emoji)
    if (etaInfo.progress > 20 && etaInfo.progress < 80) {
      lines.push('');
      lines.push(`   ${chalk.dim('Tip: ' + this.tips[this.tipIndex])}`);
    }

    this.spinner.text = lines.join('\n');
  }

  /**
   * Get the current phase based on progress.
   */
  private getCurrentPhase(): AnalysisPhase {
    const progress = this.totalProgress();
    if (progress < 10) return this.phases[0];      // Initialization
    if (progress < 80) return this.phases[1];      // Pattern Detection
    if (progress < 95) return this.phases[2];      // Stack Mapping
    return this.phases[3];                         // Insights
  }

  /**
   * Get phase number (1-4).
   */
  private getPhaseNumber(): number {
    const progress = this.totalProgress();
    if (progress < 10) return 1;
    if (progress < 80) return 2;
    if (progress < 95) return 3;
    return 4;
  }

  /**
   * Get progress percentage.
   */
  private totalProgress(): number {
    return this.maxTurns > 0 ? (this.currentTurn / this.maxTurns) * 100 : 0;
  }

  /**
   * Get current rotating message for phase.
   */
  private getCurrentMessage(phase: AnalysisPhase): string {
    // Rotate messages every 3 seconds
    const index = Math.floor(Date.now() / 3000) % phase.messages.length;
    return phase.messages[index];
  }

  /**
   * Render a visual progress bar.
   */
  private renderProgressBar(progress: number): string {
    const width = 16;
    const filled = Math.floor((progress / 100) * width);
    const empty = width - filled;

    const filledChar = chalk.cyan('█');
    const emptyChar = chalk.dim('░');

    return filledChar.repeat(filled) + emptyChar.repeat(empty);
  }

  /**
   * Stop the update interval.
   */
  private stopInterval(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
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