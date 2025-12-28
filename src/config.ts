/**
 * Config Module (v1.6)
 *
 * Central configuration resolution for PeakInfer.
 * Resolution chain: CLI flags → env vars → global config → local config → defaults
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { parse as parseYAML } from 'yaml';

// =============================================================================
// CONSTANTS
// =============================================================================

const GLOBAL_CONFIG_DIR = join(homedir(), '.peakinfer');
const GLOBAL_CONFIG_FILE = join(GLOBAL_CONFIG_DIR, 'config.yaml');
const LOCAL_CONFIG_FILE = 'peakinfer.yaml';

// =============================================================================
// TYPES
// =============================================================================

export interface PeakInferConfig {
  apiKey?: string;
  provider: 'anthropic';
  model: string;
  analysisMode: 'agent' | 'llm' | 'regex';
  maxFileSize: number;
  historyRetentionDays: number;
  verbose: boolean;
}

export interface ConfigOverrides {
  apiKey?: string;
  model?: string;
  analysisMode?: string;
  verbose?: boolean;
}

interface ConfigFile {
  apiKey?: string;
  model?: string;
  analysisMode?: string;
  verbose?: boolean;
  maxFileSize?: number;
  historyRetentionDays?: number;
}

// =============================================================================
// DEFAULTS
// =============================================================================

const DEFAULT_CONFIG: PeakInferConfig = {
  provider: 'anthropic',
  model: 'claude-sonnet-4-20250514',
  analysisMode: 'agent',
  maxFileSize: 1048576, // 1MB
  historyRetentionDays: 90,
  verbose: false,
};

// =============================================================================
// LOADERS
// =============================================================================

/**
 * Load global config from ~/.peakinfer/config.yaml
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
 * Load local config from ./peakinfer.yaml
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
 * Get API key from environment variables
 */
function getEnvApiKey(): string | undefined {
  // Check ANTHROPIC_API_KEY (Claude Agent SDK)
  if (process.env.ANTHROPIC_API_KEY) {
    return process.env.ANTHROPIC_API_KEY;
  }
  // Generic fallback
  return process.env.PEAKINFER_API_KEY;
}

/**
 * Get model from environment
 */
function getEnvModel(): string | undefined {
  return process.env.PEAKINFER_MODEL;
}

// =============================================================================
// RESOLUTION
// =============================================================================

/**
 * Resolve configuration from all sources.
 * Priority: CLI overrides → env vars → global config → local config → defaults
 */
export function resolveConfig(overrides: ConfigOverrides = {}): PeakInferConfig {
  const local = loadLocalConfig();
  const global = loadGlobalConfig();

  // Start with defaults
  const config: PeakInferConfig = { ...DEFAULT_CONFIG };

  // Layer 1: Local config file (./peakinfer.yaml)
  if (local.model) config.model = local.model;
  if (local.analysisMode) config.analysisMode = local.analysisMode as PeakInferConfig['analysisMode'];
  if (local.verbose !== undefined) config.verbose = local.verbose;
  if (local.maxFileSize) config.maxFileSize = local.maxFileSize;
  if (local.historyRetentionDays) config.historyRetentionDays = local.historyRetentionDays;
  if (local.apiKey) config.apiKey = local.apiKey;

  // Layer 2: Global config file (~/.peakinfer/config.yaml)
  if (global.model) config.model = global.model;
  if (global.analysisMode) config.analysisMode = global.analysisMode as PeakInferConfig['analysisMode'];
  if (global.verbose !== undefined) config.verbose = global.verbose;
  if (global.maxFileSize) config.maxFileSize = global.maxFileSize;
  if (global.historyRetentionDays) config.historyRetentionDays = global.historyRetentionDays;
  if (global.apiKey) config.apiKey = global.apiKey;

  // Layer 3: Environment variables
  const envApiKey = getEnvApiKey();
  const envModel = getEnvModel();
  const envVerbose = process.env.PEAKINFER_VERBOSE;

  if (envApiKey) config.apiKey = envApiKey;
  if (envModel) config.model = envModel;
  if (envVerbose === '1' || envVerbose === 'true') config.verbose = true;

  // Layer 4: CLI overrides (highest priority)
  if (overrides.apiKey) config.apiKey = overrides.apiKey;
  if (overrides.model) config.model = overrides.model;
  if (overrides.analysisMode) config.analysisMode = overrides.analysisMode as PeakInferConfig['analysisMode'];
  if (overrides.verbose !== undefined) config.verbose = overrides.verbose;

  return config;
}

/**
 * Get the resolved API key (convenience function)
 */
export function getApiKey(): string | undefined {
  return resolveConfig().apiKey;
}

/**
 * Check if API key is configured
 */
export function hasApiKey(): boolean {
  return !!getApiKey();
}

/**
 * Get config file paths for reference
 */
export function getConfigPaths(): { global: string; local: string } {
  return {
    global: GLOBAL_CONFIG_FILE,
    local: LOCAL_CONFIG_FILE,
  };
}
