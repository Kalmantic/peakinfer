import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parse as parseYAML } from 'yaml';
import { InsightTemplate, OptimizationTemplate } from './types.js';

// =============================================================================
// CONSTANTS
// =============================================================================

const TEMPLATES_REPO = 'https://raw.githubusercontent.com/Kalmantic/peakinfer_templates/main';
const MANIFEST_URL = `${TEMPLATES_REPO}/insights/manifest.json`;
const CACHE_DIR = '.peakinfer/cache/templates';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// Get bundled templates directory (relative to this file)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const BUNDLED_DIR = join(__dirname, '..', 'templates');
const OPTIMIZATIONS_DIR = join(__dirname, '..', 'templates', 'optimizations');
const PROMPTS_DIR = join(__dirname, '..', 'prompts');

// =============================================================================
// TYPES
// =============================================================================

interface Manifest {
  version: string;
  templates: string[];
  updated: string;
}

interface CacheMeta {
  fetchedAt: number;
  version: string;
}

/**
 * Analysis prompt configuration loaded from YAML
 * Used for LLM-based code analysis with configurable focus areas
 */
export interface AnalysisPrompt {
  id: string;
  name: string;
  version: string;
  description: string;
  prompt: string;
  categories: string[];
  defaults?: {
    expensive_models?: string[];
    cheap_models?: string[];
    latency_critical_threshold_ms?: number;
    batch_opportunity_threshold?: number;
  };
}

// =============================================================================
// HELPERS
// =============================================================================

function getCacheDir(): string {
  return join(process.cwd(), CACHE_DIR);
}

function getCacheMetaPath(): string {
  return join(getCacheDir(), 'meta.json');
}

function isCacheValid(): boolean {
  const metaPath = getCacheMetaPath();
  if (!existsSync(metaPath)) return false;

  try {
    const meta: CacheMeta = JSON.parse(readFileSync(metaPath, 'utf-8'));
    return Date.now() - meta.fetchedAt < CACHE_TTL_MS;
  } catch {
    return false;
  }
}

function findYamlFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];

  const results: string[] = [];
  const entries = readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findYamlFiles(fullPath));
    } else if (entry.name.endsWith('.yaml')) {
      results.push(fullPath);
    }
  }

  return results;
}

function loadCachedTemplates(): InsightTemplate[] {
  const cacheDir = getCacheDir();
  if (!existsSync(cacheDir)) return [];

  const templates: InsightTemplate[] = [];
  const files = findYamlFiles(cacheDir);

  for (const file of files) {
    try {
      const content = readFileSync(file, 'utf-8');
      const parsed = parseYAML(content);
      const validated = InsightTemplate.parse(parsed);
      templates.push(validated);
    } catch {
      // Skip invalid templates
    }
  }

  return templates;
}

function loadBundledTemplates(): InsightTemplate[] {
  if (!existsSync(BUNDLED_DIR)) return [];

  const templates: InsightTemplate[] = [];
  const files = readdirSync(BUNDLED_DIR).filter(f => f.endsWith('.yaml'));

  for (const file of files) {
    try {
      const content = readFileSync(join(BUNDLED_DIR, file), 'utf-8');
      const parsed = parseYAML(content);
      const validated = InsightTemplate.parse(parsed);
      templates.push(validated);
    } catch {
      // Skip invalid templates
    }
  }

  return templates;
}

async function fetchManifest(): Promise<Manifest | null> {
  try {
    const response = await fetch(MANIFEST_URL);
    if (!response.ok) return null;
    return await response.json() as Manifest;
  } catch {
    return null;
  }
}

async function fetchTemplate(templatePath: string): Promise<string | null> {
  try {
    // Templates are now in insights/{category}/{name}.yaml
    const url = `${TEMPLATES_REPO}/insights/${templatePath}`;
    const response = await fetch(url);
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  }
}

function saveToCache(templates: Map<string, string>, version: string): void {
  const cacheDir = getCacheDir();
  mkdirSync(cacheDir, { recursive: true });

  // Save each template (handle nested paths like cost/prompt-bloat.yaml)
  for (const [name, content] of templates) {
    const filePath = join(cacheDir, name);
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, content);
  }

  // Save meta
  const meta: CacheMeta = {
    fetchedAt: Date.now(),
    version,
  };
  writeFileSync(getCacheMetaPath(), JSON.stringify(meta, null, 2));
}

// =============================================================================
// PUBLIC API
// =============================================================================

export interface LoadOptions {
  offline?: boolean;
}

export async function loadTemplates(opts: LoadOptions = {}): Promise<InsightTemplate[]> {
  // If offline mode, skip remote fetch
  if (opts.offline) {
    const cached = loadCachedTemplates();
    if (cached.length > 0) return cached;
    return loadBundledTemplates();
  }

  // Check cache validity
  if (isCacheValid()) {
    const cached = loadCachedTemplates();
    if (cached.length > 0) return cached;
  }

  // Try to fetch from remote
  const manifest = await fetchManifest();
  if (manifest) {
    const templateContents = new Map<string, string>();
    const templates: InsightTemplate[] = [];

    for (const templatePath of manifest.templates) {
      const content = await fetchTemplate(templatePath);
      if (content) {
        templateContents.set(templatePath, content);
        try {
          const parsed = parseYAML(content);
          const validated = InsightTemplate.parse(parsed);
          templates.push(validated);
        } catch {
          // Skip invalid templates
        }
      }
    }

    if (templates.length > 0) {
      saveToCache(templateContents, manifest.version);
      return templates;
    }
  }

  // Fall back to stale cache
  const cached = loadCachedTemplates();
  if (cached.length > 0) {
    console.warn('[templates] Using stale cache');
    return cached;
  }

  // Fall back to bundled templates
  console.warn('[templates] Using bundled templates');
  return loadBundledTemplates();
}

/**
 * Get a single template by ID
 */
export async function getTemplate(id: string, opts: LoadOptions = {}): Promise<InsightTemplate | null> {
  const templates = await loadTemplates(opts);
  return templates.find(t => t.id === id) || null;
}

/**
 * Clear template cache
 */
export function clearCache(): void {
  const cacheDir = getCacheDir();
  if (existsSync(cacheDir)) {
    const files = readdirSync(cacheDir);
    for (const file of files) {
      const filePath = join(cacheDir, file);
      try {
        readFileSync(filePath); // Check if readable
        writeFileSync(filePath, ''); // Clear content
      } catch {
        // Skip
      }
    }
  }
}

// =============================================================================
// OPTIMIZATION TEMPLATES API (v1.8 - Inference Squeeze Guide)
// =============================================================================

/**
 * Load bundled optimization templates from templates/optimizations/
 * These are community optimization runbooks with implementation steps
 */
export function loadOptimizationTemplates(): OptimizationTemplate[] {
  if (!existsSync(OPTIMIZATIONS_DIR)) return [];

  const templates: OptimizationTemplate[] = [];
  const files = readdirSync(OPTIMIZATIONS_DIR).filter(f => f.endsWith('.yaml'));

  for (const file of files) {
    try {
      const content = readFileSync(join(OPTIMIZATIONS_DIR, file), 'utf-8');
      const parsed = parseYAML(content);
      const validated = OptimizationTemplate.parse(parsed);
      templates.push(validated);
    } catch (err) {
      // Skip invalid templates but log for debugging
      console.warn(`[templates] Failed to load optimization template ${file}:`, err);
    }
  }

  return templates;
}

/**
 * Get a single optimization template by ID
 */
export function getOptimizationTemplate(id: string): OptimizationTemplate | null {
  const templates = loadOptimizationTemplates();
  return templates.find(t => t.id === id) || null;
}

// =============================================================================
// ANALYSIS PROMPTS API
// =============================================================================

/**
 * Load an analysis prompt by ID from the prompts directory
 * @param id - Prompt ID (e.g., 'peak-performance')
 * @returns AnalysisPrompt or null if not found
 */
export function loadPrompt(id: string): AnalysisPrompt | null {
  const promptPath = join(PROMPTS_DIR, `${id}.yaml`);

  if (!existsSync(promptPath)) {
    return null;
  }

  try {
    const content = readFileSync(promptPath, 'utf-8');
    const parsed = parseYAML(content) as AnalysisPrompt;

    // Validate required fields
    if (!parsed.id || !parsed.prompt) {
      console.warn(`[prompts] Invalid prompt file: ${promptPath} (missing id or prompt)`);
      return null;
    }

    return parsed;
  } catch (err) {
    console.warn(`[prompts] Failed to load prompt ${id}:`, err);
    return null;
  }
}

/**
 * List all available analysis prompts
 * @returns Array of prompt IDs
 */
export function listPrompts(): string[] {
  if (!existsSync(PROMPTS_DIR)) {
    return [];
  }

  try {
    const files = readdirSync(PROMPTS_DIR).filter(f => f.endsWith('.yaml'));
    return files.map(f => f.replace('.yaml', ''));
  } catch {
    return [];
  }
}

/**
 * Get the default analysis prompt (peak-performance)
 * @returns AnalysisPrompt
 * @throws Error if default prompt not found
 */
export function getDefaultPrompt(): AnalysisPrompt {
  const prompt = loadPrompt('peak-performance');
  if (!prompt) {
    throw new Error('[prompts] Default prompt "peak-performance" not found. Ensure prompts/peak-performance.yaml exists.');
  }
  return prompt;
}

// =============================================================================
// CONFIGURATION API
// =============================================================================

const CONFIG_DIR = join(__dirname, '..', 'config');

/**
 * PeakInfer configuration schema
 */
export interface PeakInferConfig {
  id: string;
  version: string;
  description: string;
  analysis: {
    mode: 'agent' | 'llm' | 'regex';
    cascade: boolean;
  };
  models: {
    agent: {
      primary: string;
      fallback: string;
    };
    llm: {
      primary: string;
      fallback: string;
    };
  };
  agent: {
    max_iterations: number;
    verbose: boolean;
  };
  scanner: {
    extensions: string[];
    max_file_size: number;
    ignore: string[];
  };
  output: {
    format: 'json' | 'yaml' | 'markdown';
    include_confidence: boolean;
    min_confidence: number;
  };
}

// Default configuration (used as fallback)
const DEFAULT_CONFIG: PeakInferConfig = {
  id: 'peakinfer',
  version: '1.0',
  description: 'Default PeakInfer configuration',
  analysis: {
    mode: 'agent',
    cascade: true,
  },
  models: {
    agent: {
      primary: 'claude-opus-4-5-20251101',
      fallback: 'claude-sonnet-4-20250514',
    },
    llm: {
      primary: 'claude-sonnet-4-20250514',
      fallback: 'claude-sonnet-4-20250514',
    },
  },
  agent: {
    max_iterations: 15,
    verbose: false,
  },
  scanner: {
    extensions: ['.py', '.ts', '.tsx', '.js', '.jsx'],
    max_file_size: 1048576,
    ignore: ['node_modules', '.git', '__pycache__', '.venv', 'venv', 'dist', 'build'],
  },
  output: {
    format: 'json',
    include_confidence: true,
    min_confidence: 0.5,
  },
};

// Cached config
let cachedConfig: PeakInferConfig | null = null;

/**
 * Load PeakInfer configuration from config/peakinfer.yaml
 * Environment variables override file settings:
 *   - PEAKINFER_MODE: analysis mode (agent, llm, regex)
 *   - PEAKINFER_MODEL: primary model override
 *   - PEAKINFER_VERBOSE: enable verbose output
 * @returns PeakInferConfig
 */
export function loadConfig(): PeakInferConfig {
  // Return cached config if available
  if (cachedConfig) {
    return cachedConfig;
  }

  let config: PeakInferConfig = { ...DEFAULT_CONFIG };

  // Try to load from config file
  const configPath = join(CONFIG_DIR, 'peakinfer.yaml');
  if (existsSync(configPath)) {
    try {
      const content = readFileSync(configPath, 'utf-8');
      const parsed = parseYAML(content) as Partial<PeakInferConfig>;

      // Deep merge with defaults
      config = deepMerge(
        DEFAULT_CONFIG as unknown as Record<string, unknown>,
        parsed as unknown as Record<string, unknown>
      ) as unknown as PeakInferConfig;
    } catch (err) {
      console.warn('[config] Failed to load config file, using defaults:', err);
    }
  }

  // Apply environment variable overrides
  if (process.env.PEAKINFER_MODE) {
    const mode = process.env.PEAKINFER_MODE.toLowerCase();
    if (['agent', 'llm', 'regex'].includes(mode)) {
      config.analysis.mode = mode as 'agent' | 'llm' | 'regex';
    }
  }

  if (process.env.PEAKINFER_MODEL) {
    config.models.agent.primary = process.env.PEAKINFER_MODEL;
    config.models.llm.primary = process.env.PEAKINFER_MODEL;
  }

  if (process.env.PEAKINFER_VERBOSE === '1' || process.env.PEAKINFER_VERBOSE === 'true') {
    config.agent.verbose = true;
  }

  // Cache the config
  cachedConfig = config;

  return config;
}

/**
 * Get the configured model for a given analysis type
 * @param type - 'agent' or 'llm'
 * @param fallback - whether to return fallback model
 * @returns model name
 */
export function getConfiguredModel(type: 'agent' | 'llm', fallback: boolean = false): string {
  const config = loadConfig();
  const models = config.models[type];
  return fallback ? models.fallback : models.primary;
}

/**
 * Get the configured analysis mode
 * @returns analysis mode
 */
export function getConfiguredMode(): 'agent' | 'llm' | 'regex' {
  const config = loadConfig();
  return config.analysis.mode;
}

/**
 * Check if cascade fallback is enabled
 * @returns true if cascade is enabled
 */
export function isCascadeEnabled(): boolean {
  const config = loadConfig();
  return config.analysis.cascade;
}

/**
 * Deep merge two objects
 */
function deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> {
  const result = { ...target };

  for (const key of Object.keys(source)) {
    if (source[key] !== undefined) {
      if (
        typeof source[key] === 'object' &&
        source[key] !== null &&
        !Array.isArray(source[key]) &&
        typeof target[key] === 'object' &&
        target[key] !== null
      ) {
        result[key] = deepMerge(
          target[key] as Record<string, unknown>,
          source[key] as Record<string, unknown>
        );
      } else {
        result[key] = source[key];
      }
    }
  }

  return result;
}
