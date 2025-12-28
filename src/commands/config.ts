/**
 * Config Commands (v1.6)
 *
 * CLI commands for managing PeakInfer configuration:
 * - set: Set a configuration value
 * - show: Display current configuration
 *
 * Configuration resolution chain:
 * CLI flags → env vars → ~/.peakinfer/config.yaml → ./peakinfer.yaml → defaults
 */

import { Command } from 'commander';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { parse as parseYAML, stringify as stringifyYAML } from 'yaml';

// =============================================================================
// CONSTANTS
// =============================================================================

const GLOBAL_CONFIG_DIR = join(homedir(), '.peakinfer');
const GLOBAL_CONFIG_FILE = join(GLOBAL_CONFIG_DIR, 'config.yaml');
const LOCAL_CONFIG_FILE = 'peakinfer.yaml';

// Allowed configuration keys
const ALLOWED_KEYS = [
  'api-key',
  'model',
  'mode',
  'verbose',
  'history-retention-days',
] as const;

type ConfigKey = typeof ALLOWED_KEYS[number];

// Internal key mapping (CLI name → config key)
const KEY_MAP: Record<string, string> = {
  'api-key': 'apiKey',
  'model': 'model',
  'mode': 'analysisMode',
  'verbose': 'verbose',
  'history-retention-days': 'historyRetentionDays',
};

// =============================================================================
// TYPES
// =============================================================================

interface ConfigFile {
  apiKey?: string;
  model?: string;
  analysisMode?: string;
  verbose?: boolean;
  historyRetentionDays?: number;
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Load global config file
 */
function loadGlobalConfig(): ConfigFile {
  if (!existsSync(GLOBAL_CONFIG_FILE)) {
    return {};
  }
  try {
    const content = readFileSync(GLOBAL_CONFIG_FILE, 'utf-8');
    return parseYAML(content) || {};
  } catch {
    return {};
  }
}

/**
 * Load local config file
 */
function loadLocalConfig(): ConfigFile {
  if (!existsSync(LOCAL_CONFIG_FILE)) {
    return {};
  }
  try {
    const content = readFileSync(LOCAL_CONFIG_FILE, 'utf-8');
    return parseYAML(content) || {};
  } catch {
    return {};
  }
}

/**
 * Save global config file
 */
function saveGlobalConfig(config: ConfigFile): void {
  mkdirSync(GLOBAL_CONFIG_DIR, { recursive: true });
  writeFileSync(GLOBAL_CONFIG_FILE, stringifyYAML(config));
}

/**
 * Save local config file
 */
function saveLocalConfig(config: ConfigFile): void {
  writeFileSync(LOCAL_CONFIG_FILE, stringifyYAML(config));
}

/**
 * Get merged configuration with resolution chain
 */
function getMergedConfig(): ConfigFile & { _sources: Record<string, string> } {
  const defaults: ConfigFile = {
    model: 'claude-sonnet-4-20250514',
    analysisMode: 'agent',
    verbose: false,
    historyRetentionDays: 90,
  };

  const local = loadLocalConfig();
  const global = loadGlobalConfig();

  // Track where each value comes from
  const sources: Record<string, string> = {};

  const result: ConfigFile = {};

  // Resolution: defaults → global → local → env
  for (const key of Object.keys(defaults) as (keyof ConfigFile)[]) {
    if (key in defaults) {
      result[key] = defaults[key] as never;
      sources[key] = 'default';
    }
    if (key in global && global[key] !== undefined) {
      result[key] = global[key] as never;
      sources[key] = 'global (~/.peakinfer/config.yaml)';
    }
    if (key in local && local[key] !== undefined) {
      result[key] = local[key] as never;
      sources[key] = 'local (./peakinfer.yaml)';
    }
  }

  // Environment variable overrides
  if (process.env.ANTHROPIC_API_KEY) {
    result.apiKey = process.env.ANTHROPIC_API_KEY;
    sources['apiKey'] = 'env (ANTHROPIC_API_KEY)';
  }
  if (process.env.PEAKINFER_MODEL) {
    result.model = process.env.PEAKINFER_MODEL;
    sources['model'] = 'env (PEAKINFER_MODEL)';
  }
  if (process.env.PEAKINFER_MODE) {
    result.analysisMode = process.env.PEAKINFER_MODE;
    sources['analysisMode'] = 'env (PEAKINFER_MODE)';
  }
  if (process.env.PEAKINFER_VERBOSE === '1' || process.env.PEAKINFER_VERBOSE === 'true') {
    result.verbose = true;
    sources['verbose'] = 'env (PEAKINFER_VERBOSE)';
  }

  return { ...result, _sources: sources };
}

/**
 * Mask sensitive values for display
 */
function maskValue(key: string, value: unknown): string {
  if (key === 'apiKey' && typeof value === 'string') {
    if (value.length > 8) {
      return value.slice(0, 4) + '...' + value.slice(-4);
    }
    return '****';
  }
  return String(value);
}

/**
 * Format config for display
 */
function displayConfig(config: ConfigFile & { _sources: Record<string, string> }): void {
  console.log('\nPeakInfer Configuration');
  console.log('═'.repeat(60));

  const { _sources, ...values } = config;

  const displayKeys: Array<{ key: keyof ConfigFile; label: string }> = [
    { key: 'apiKey', label: 'API Key' },
    { key: 'model', label: 'Model' },
    { key: 'analysisMode', label: 'Analysis Mode' },
    { key: 'verbose', label: 'Verbose' },
    { key: 'historyRetentionDays', label: 'History Retention' },
  ];

  for (const { key, label } of displayKeys) {
    const value = values[key];
    const source = _sources[key];

    if (value !== undefined) {
      const displayValue = maskValue(key, value);
      const suffix = key === 'historyRetentionDays' ? ' days' : '';
      console.log(`  ${label.padEnd(20)} ${displayValue}${suffix}`);
      console.log(`  ${''.padEnd(20)} └─ source: ${source}`);
    } else {
      console.log(`  ${label.padEnd(20)} (not set)`);
    }
  }

  console.log('');
  console.log('Resolution chain: CLI → env → global → local → defaults');
  console.log('');
}

// =============================================================================
// COMMANDS
// =============================================================================

/**
 * Register config commands
 */
export function registerConfigCommands(program: Command): void {
  const configCmd = program
    .command('config')
    .description('manage configuration');

  // Set config value
  configCmd
    .command('set')
    .description('set a configuration value')
    .argument('<key>', `configuration key (${ALLOWED_KEYS.join(', ')})`)
    .argument('<value>', 'configuration value')
    .option('--global', 'save to global config (~/.peakinfer/config.yaml)', true)
    .option('--local', 'save to local config (./peakinfer.yaml)')
    .action((key: string, value: string, options: { global?: boolean; local?: boolean }) => {
      try {
        // Validate key
        if (!ALLOWED_KEYS.includes(key as ConfigKey)) {
          console.error(`Invalid key: ${key}`);
          console.log(`\nAllowed keys: ${ALLOWED_KEYS.join(', ')}`);
          process.exit(1);
        }

        const configKey = KEY_MAP[key] || key;

        // Parse value based on key
        let parsedValue: string | number | boolean = value;
        if (key === 'verbose') {
          parsedValue = value === 'true' || value === '1';
        } else if (key === 'history-retention-days') {
          parsedValue = parseInt(value, 10);
          if (isNaN(parsedValue)) {
            console.error('history-retention-days must be a number');
            process.exit(1);
          }
        }

        // Determine target file
        const useLocal = options.local && !options.global;

        if (useLocal) {
          const config = loadLocalConfig();
          (config as Record<string, unknown>)[configKey] = parsedValue;
          saveLocalConfig(config);
          console.log(`Set ${key} = ${maskValue(configKey, parsedValue)} in ./peakinfer.yaml`);
        } else {
          const config = loadGlobalConfig();
          (config as Record<string, unknown>)[configKey] = parsedValue;
          saveGlobalConfig(config);
          console.log(`Set ${key} = ${maskValue(configKey, parsedValue)} in ~/.peakinfer/config.yaml`);
        }
      } catch (error) {
        console.error('Error:', error instanceof Error ? error.message : 'Failed to set config');
        process.exit(1);
      }
    });

  // Show config
  configCmd
    .command('show')
    .description('display current configuration')
    .action(() => {
      try {
        const config = getMergedConfig();
        displayConfig(config);
      } catch (error) {
        console.error('Error:', error instanceof Error ? error.message : 'Failed to load config');
        process.exit(1);
      }
    });
}
