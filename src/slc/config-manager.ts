/**
 * Configuration Management System
 *
 * Handles:
 * - User preferences
 * - API keys (secure storage)
 * - Project-specific settings
 * - Global defaults
 * - Environment variables
 *
 * Design: Layered configuration with precedence
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import chalk from 'chalk';
import { ConfigurationError } from './error-handler.js';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Configuration schema.
 */
export interface PeakInferConfig {
  // API Configuration
  api: {
    anthropicKey?: string;
    openaiKey?: string;
    baseUrl?: string;
    timeout?: number;
    maxRetries?: number;
  };

  // Analysis Settings
  analysis: {
    defaultPath?: string;
    includePatterns?: string[];
    excludePatterns?: string[];
    maxFileSize?: number;
    maxFiles?: number;
    followSymlinks?: boolean;
  };

  // Output Settings
  output: {
    format?: 'json' | 'html' | 'markdown' | 'all';
    directory?: string;
    autoOpen?: boolean;
    verbose?: boolean;
    silent?: boolean;
  };

  // Optimization Settings
  optimization: {
    prioritization?: 'cost' | 'latency' | 'balanced';
    riskTolerance?: 'low' | 'medium' | 'high';
    autoApply?: boolean;
    dryRun?: boolean;
  };

  // Collector Settings
  collectors: {
    enabled?: string[];
    snowflake?: {
      account?: string;
      warehouse?: string;
      database?: string;
    };
    databricks?: {
      workspace?: string;
      token?: string;
    };
    terraform?: {
      statePath?: string;
    };
  };

  // Template Settings
  templates: {
    directory?: string;
    autoUpdate?: boolean;
    trusted?: string[];
  };

  // Telemetry Settings
  telemetry: {
    enabled?: boolean;
    anonymous?: boolean;
    endpoint?: string;
  };

  // UI Settings
  ui: {
    theme?: 'auto' | 'light' | 'dark';
    color?: boolean;
    spinner?: string;
    progressBar?: boolean;
  };
}

/**
 * Configuration source priority (higher number = higher priority).
 */
export enum ConfigSource {
  DEFAULTS = 0,
  GLOBAL = 1,
  PROJECT = 2,
  ENVIRONMENT = 3,
  CLI_ARGS = 4,
}

// =============================================================================
// CONFIGURATION MANAGER
// =============================================================================

/**
 * Central configuration management.
 */
export class ConfigManager {
  private static instance: ConfigManager;
  private config: PeakInferConfig;
  private sources: Map<ConfigSource, Partial<PeakInferConfig>> = new Map();
  private configPaths: {
    global: string;
    project: string;
    env: string;
  };

  private constructor() {
    this.configPaths = {
      global: path.join(os.homedir(), '.peakinfer', 'config.json'),
      project: path.join(process.cwd(), '.peakinfer.json'),
      env: path.join(process.cwd(), '.env.peakinfer'),
    };

    this.config = this.getDefaults();
    this.loadAllConfigs();
  }

  /**
   * Get singleton instance.
   */
  static getInstance(): ConfigManager {
    if (!this.instance) {
      this.instance = new ConfigManager();
    }
    return this.instance;
  }

  /**
   * Get default configuration.
   */
  private getDefaults(): PeakInferConfig {
    return {
      api: {
        timeout: 120000,
        maxRetries: 3,
      },
      analysis: {
        defaultPath: '.',
        includePatterns: ['**/*.py', '**/*.ts', '**/*.js', '**/*.go', '**/*.java'],
        excludePatterns: ['**/node_modules/**', '**/venv/**', '**/.git/**', '**/dist/**', '**/build/**'],
        maxFileSize: 1024 * 1024 * 10, // 10MB
        maxFiles: 10000,
        followSymlinks: false,
      },
      output: {
        format: 'json',
        directory: '.',
        autoOpen: false,
        verbose: false,
        silent: false,
      },
      optimization: {
        prioritization: 'cost',
        riskTolerance: 'medium',
        autoApply: false,
        dryRun: true,
      },
      collectors: {
        enabled: ['codebase'],
      },
      templates: {
        autoUpdate: true,
        trusted: [],
      },
      telemetry: {
        enabled: false,
        anonymous: true,
      },
      ui: {
        theme: 'auto',
        color: true,
        spinner: 'dots',
        progressBar: true,
      },
    };
  }

  /**
   * Load all configuration sources.
   */
  private loadAllConfigs(): void {
    // Load in priority order
    this.sources.set(ConfigSource.DEFAULTS, this.getDefaults());
    this.sources.set(ConfigSource.GLOBAL, this.loadGlobalConfig());
    this.sources.set(ConfigSource.PROJECT, this.loadProjectConfig());
    this.sources.set(ConfigSource.ENVIRONMENT, this.loadEnvironmentConfig());

    // Merge configurations
    this.mergeConfigs();
  }

  /**
   * Load global configuration.
   */
  private loadGlobalConfig(): Partial<PeakInferConfig> {
    try {
      if (fs.existsSync(this.configPaths.global)) {
        const content = fs.readFileSync(this.configPaths.global, 'utf-8');
        return JSON.parse(content);
      }
    } catch (error) {
      console.warn(chalk.yellow(`Warning: Failed to load global config: ${error}`));
    }
    return {};
  }

  /**
   * Load project configuration.
   */
  private loadProjectConfig(): Partial<PeakInferConfig> {
    try {
      if (fs.existsSync(this.configPaths.project)) {
        const content = fs.readFileSync(this.configPaths.project, 'utf-8');
        return JSON.parse(content);
      }
    } catch (error) {
      console.warn(chalk.yellow(`Warning: Failed to load project config: ${error}`));
    }
    return {};
  }

  /**
   * Load environment configuration.
   */
  private loadEnvironmentConfig(): Partial<PeakInferConfig> {
    const config: Partial<PeakInferConfig> = {
      api: {},
      analysis: {},
      output: {},
      optimization: {},
      collectors: {},
      templates: {},
      telemetry: {},
      ui: {},
    };

    // Map environment variables to config
    const envMappings: Record<string, (value: string) => void> = {
      'ANTHROPIC_API_KEY': (v) => config.api!.anthropicKey = v,
      'OPENAI_API_KEY': (v) => config.api!.openaiKey = v,
      'PEAKINFER_API_TIMEOUT': (v) => config.api!.timeout = parseInt(v, 10),
      'PEAKINFER_MAX_RETRIES': (v) => config.api!.maxRetries = parseInt(v, 10),
      'PEAKINFER_OUTPUT_FORMAT': (v) => config.output!.format = v as any,
      'PEAKINFER_OUTPUT_DIR': (v) => config.output!.directory = v,
      'PEAKINFER_AUTO_OPEN': (v) => config.output!.autoOpen = v === 'true',
      'PEAKINFER_VERBOSE': (v) => config.output!.verbose = v === 'true',
      'PEAKINFER_SILENT': (v) => config.output!.silent = v === 'true',
      'PEAKINFER_PRIORITIZATION': (v) => config.optimization!.prioritization = v as any,
      'PEAKINFER_RISK_TOLERANCE': (v) => config.optimization!.riskTolerance = v as any,
      'PEAKINFER_DRY_RUN': (v) => config.optimization!.dryRun = v === 'true',
      'PEAKINFER_TELEMETRY': (v) => config.telemetry!.enabled = v === 'true',
      'PEAKINFER_COLOR': (v) => config.ui!.color = v === 'true',
      'NO_COLOR': (v) => config.ui!.color = false, // Standard NO_COLOR env var
    };

    for (const [envVar, setter] of Object.entries(envMappings)) {
      const value = process.env[envVar];
      if (value !== undefined) {
        setter(value);
      }
    }

    // Load .env.peakinfer file if exists
    if (fs.existsSync(this.configPaths.env)) {
      try {
        const content = fs.readFileSync(this.configPaths.env, 'utf-8');
        const lines = content.split('\n');

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith('#')) {
            const [key, ...valueParts] = trimmed.split('=');
            const value = valueParts.join('=').replace(/^["']|["']$/g, '');
            if (envMappings[key]) {
              envMappings[key](value);
            }
          }
        }
      } catch (error) {
        console.warn(chalk.yellow(`Warning: Failed to load .env.peakinfer: ${error}`));
      }
    }

    return config;
  }

  /**
   * Merge configurations based on priority.
   */
  private mergeConfigs(): void {
    // Start with defaults
    this.config = { ...this.getDefaults() };

    // Apply each source in priority order
    const sortedSources = Array.from(this.sources.entries())
      .sort((a, b) => a[0] - b[0]);

    for (const [, sourceConfig] of sortedSources) {
      this.config = this.deepMerge(this.config, sourceConfig);
    }
  }

  /**
   * Deep merge configuration objects.
   */
  private deepMerge(target: any, source: any): any {
    const result = { ...target };

    for (const key in source) {
      if (source[key] === undefined) continue;

      if (typeof source[key] === 'object' && source[key] !== null && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(result[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }

    return result;
  }

  /**
   * Get current configuration.
   */
  get(): PeakInferConfig {
    return { ...this.config };
  }

  /**
   * Get specific configuration value.
   */
  getValue<T = any>(path: string): T | undefined {
    const parts = path.split('.');
    let current: any = this.config;

    for (const part of parts) {
      if (current === undefined || current === null) {
        return undefined;
      }
      current = current[part];
    }

    return current as T;
  }

  /**
   * Set configuration value.
   */
  setValue(path: string, value: any, source: ConfigSource = ConfigSource.CLI_ARGS): void {
    const parts = path.split('.');
    let current: any = this.sources.get(source) || {};

    // Build nested structure
    for (let i = 0; i < parts.length - 1; i++) {
      if (!current[parts[i]]) {
        current[parts[i]] = {};
      }
      current = current[parts[i]];
    }

    current[parts[parts.length - 1]] = value;

    // Re-merge configs
    this.mergeConfigs();
  }

  /**
   * Save configuration to file.
   */
  async save(scope: 'global' | 'project' = 'global'): Promise<void> {
    const configPath = scope === 'global' ? this.configPaths.global : this.configPaths.project;
    const configDir = path.dirname(configPath);

    // Create directory if needed
    if (!fs.existsSync(configDir)) {
      await fs.promises.mkdir(configDir, { recursive: true });
    }

    // Get config to save (exclude defaults and environment)
    const configToSave = this.sources.get(
      scope === 'global' ? ConfigSource.GLOBAL : ConfigSource.PROJECT
    ) || {};

    // Write config file
    await fs.promises.writeFile(
      configPath,
      JSON.stringify(configToSave, null, 2),
      'utf-8'
    );
  }

  /**
   * Validate configuration.
   */
  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check required API key
    if (!this.config.api.anthropicKey && !process.env.ANTHROPIC_API_KEY) {
      errors.push('Missing Anthropic API key (set ANTHROPIC_API_KEY environment variable)');
    }

    // Check output directory exists
    if (this.config.output.directory && !fs.existsSync(this.config.output.directory)) {
      errors.push(`Output directory does not exist: ${this.config.output.directory}`);
    }

    // Check template directory if specified
    if (this.config.templates.directory && !fs.existsSync(this.config.templates.directory)) {
      errors.push(`Template directory does not exist: ${this.config.templates.directory}`);
    }

    // Validate enum values
    const validFormats = ['json', 'html', 'markdown', 'all'];
    if (this.config.output.format && !validFormats.includes(this.config.output.format)) {
      errors.push(`Invalid output format: ${this.config.output.format}`);
    }

    const validPriorities = ['cost', 'latency', 'balanced'];
    if (this.config.optimization.prioritization && !validPriorities.includes(this.config.optimization.prioritization)) {
      errors.push(`Invalid prioritization: ${this.config.optimization.prioritization}`);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Reset configuration to defaults.
   */
  reset(): void {
    this.sources.clear();
    this.config = this.getDefaults();
    this.loadAllConfigs();
  }

  /**
   * Export configuration for debugging.
   */
  export(): {
    merged: PeakInferConfig;
    sources: Record<string, Partial<PeakInferConfig>>;
  } {
    const sourceConfigs: Record<string, Partial<PeakInferConfig>> = {};

    for (const [source, config] of this.sources) {
      sourceConfigs[ConfigSource[source]] = config;
    }

    return {
      merged: this.config,
      sources: sourceConfigs,
    };
  }
}

// =============================================================================
// CONFIGURATION HELPERS
// =============================================================================

/**
 * Get configuration value with fallback.
 */
export function getConfig<T = any>(path: string, defaultValue?: T): T {
  const manager = ConfigManager.getInstance();
  const value = manager.getValue<T>(path);
  return value !== undefined ? value : defaultValue!;
}

/**
 * Set configuration value.
 */
export function setConfig(path: string, value: any): void {
  const manager = ConfigManager.getInstance();
  manager.setValue(path, value);
}

/**
 * Validate current configuration.
 */
export function validateConfig(): void {
  const manager = ConfigManager.getInstance();
  const { valid, errors } = manager.validate();

  if (!valid) {
    throw new ConfigurationError('Invalid configuration', {
      suggestion: errors.join('\n'),
    });
  }
}

/**
 * Load configuration with validation.
 */
export function loadConfig(): PeakInferConfig {
  const manager = ConfigManager.getInstance();
  validateConfig();
  return manager.get();
}

/**
 * Save current configuration.
 */
export async function saveConfig(scope: 'global' | 'project' = 'global'): Promise<void> {
  const manager = ConfigManager.getInstance();
  await manager.save(scope);
}

// =============================================================================
// CLI CONFIGURATION COMMANDS
// =============================================================================

/**
 * Show current configuration.
 */
export function showConfig(format: 'table' | 'json' = 'table'): void {
  const manager = ConfigManager.getInstance();
  const exported = manager.export();

  if (format === 'json') {
    console.log(JSON.stringify(exported, null, 2));
    return;
  }

  console.log(chalk.bold.cyan('\n📋 PeakInfer Configuration\n'));

  // Show merged config
  console.log(chalk.bold('Current Configuration:'));
  console.log(chalk.dim('─'.repeat(50)));

  const config = exported.merged;
  const sections = [
    { name: 'API', data: config.api },
    { name: 'Analysis', data: config.analysis },
    { name: 'Output', data: config.output },
    { name: 'Optimization', data: config.optimization },
    { name: 'UI', data: config.ui },
  ];

  for (const section of sections) {
    console.log(chalk.cyan(`\n${section.name}:`));
    for (const [key, value] of Object.entries(section.data)) {
      if (value !== undefined) {
        const displayValue = key.toLowerCase().includes('key') ? '***' : JSON.stringify(value);
        console.log(`  ${key}: ${chalk.yellow(displayValue)}`);
      }
    }
  }

  // Show source information
  console.log(chalk.bold('\n\nConfiguration Sources:'));
  console.log(chalk.dim('─'.repeat(50)));

  const sourcePriority = [
    'CLI_ARGS',
    'ENVIRONMENT',
    'PROJECT',
    'GLOBAL',
    'DEFAULTS',
  ];

  for (const source of sourcePriority) {
    const hasConfig = Object.keys(exported.sources[source] || {}).length > 0;
    const icon = hasConfig ? '✓' : '✗';
    const color = hasConfig ? chalk.green : chalk.dim;
    console.log(color(`  ${icon} ${source}`));
  }

  console.log();
}

/**
 * Reset configuration to defaults.
 */
export function resetConfig(scope: 'all' | 'global' | 'project' = 'all'): void {
  const manager = ConfigManager.getInstance();

  if (scope === 'all' || scope === 'global') {
    const globalPath = path.join(os.homedir(), '.peakinfer', 'config.json');
    if (fs.existsSync(globalPath)) {
      fs.unlinkSync(globalPath);
      console.log(chalk.green(`✓ Removed global config: ${globalPath}`));
    }
  }

  if (scope === 'all' || scope === 'project') {
    const projectPath = path.join(process.cwd(), '.peakinfer.json');
    if (fs.existsSync(projectPath)) {
      fs.unlinkSync(projectPath);
      console.log(chalk.green(`✓ Removed project config: ${projectPath}`));
    }
  }

  manager.reset();
  console.log(chalk.green('\n✓ Configuration reset to defaults\n'));
}