/**
 * Pricing Fetcher Module — Real-time Pricing from LiteLLM
 *
 * Fetches and caches pricing data from LiteLLM's GitHub repository.
 * Falls back to static data when network is unavailable.
 *
 * Source: https://github.com/BerriAI/litellm/blob/main/model_prices_and_context_window.json
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// =============================================================================
// TYPES
// =============================================================================

/** LiteLLM model entry structure */
export interface LiteLLMModelEntry {
  litellm_provider?: string;
  input_cost_per_token?: number;
  output_cost_per_token?: number;
  max_input_tokens?: number;
  max_output_tokens?: number;
  max_tokens?: number;
  mode?: string;
  supports_vision?: boolean;
  supports_function_calling?: boolean;
}

/** Normalized pricing entry for PeakInfer */
export interface NormalizedPricing {
  provider: string;
  model: string;
  inputPer1M: number;
  outputPer1M: number;
  maxInputTokens?: number;
  maxOutputTokens?: number;
}

/** Cache metadata */
interface CacheMetadata {
  fetchedAt: number;
  version: string;
}

// =============================================================================
// CONFIGURATION
// =============================================================================

const LITELLM_PRICING_URL =
  'https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json';

const CACHE_DIR = path.join(os.homedir(), '.peakinfer');
const CACHE_FILE = path.join(CACHE_DIR, 'pricing-cache.json');
const CACHE_META_FILE = path.join(CACHE_DIR, 'pricing-meta.json');

/** Cache TTL: 24 hours (prices don't change that frequently) */
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/** Fetch timeout: 10 seconds */
const FETCH_TIMEOUT_MS = 10000;

// =============================================================================
// PROVIDER MAPPING
// =============================================================================

/** Map LiteLLM provider names to our normalized provider names */
const PROVIDER_MAPPING: Record<string, string> = {
  // Direct API providers
  openai: 'openai',
  anthropic: 'anthropic',
  google: 'google',
  'vertex_ai-language-models': 'gcp-vertex',
  'vertex_ai-vision-models': 'gcp-vertex',
  'vertex_ai-anthropic_models': 'gcp-vertex',
  vertex_ai: 'gcp-vertex',
  cohere: 'cohere',
  cohere_chat: 'cohere',
  mistral: 'mistral',
  groq: 'groq',
  together_ai: 'together',
  fireworks_ai: 'fireworks',
  deepinfra: 'deepinfra',
  perplexity: 'perplexity',
  replicate: 'replicate',
  anyscale: 'anyscale',

  // Cloud providers
  bedrock: 'aws-bedrock',
  'bedrock-chat': 'aws-bedrock',
  bedrock_converse: 'aws-bedrock',
  sagemaker: 'aws-sagemaker',
  sagemaker_chat: 'aws-sagemaker',
  azure: 'azure-openai',
  azure_ai: 'azure-openai',
  azure_text: 'azure-openai',

  // Inference platforms
  databricks: 'databricks',
  ai21: 'ai21',
  nlp_cloud: 'nlp-cloud',
  aleph_alpha: 'aleph-alpha',
  cloudflare: 'cloudflare',
  voyage: 'voyage',
  text_completion_codestral: 'mistral',
  codestral: 'mistral',
};

// =============================================================================
// MODEL NAME NORMALIZATION
// =============================================================================

/**
 * Normalize model name for matching.
 * Handles variations like:
 * - "gpt-4o-2024-05-13" → "gpt-4o"
 * - "claude-3-5-sonnet-20241022" → "claude-3-5-sonnet"
 * - "gemini-1.5-pro-latest" → "gemini-1.5-pro"
 */
export function normalizeModelName(model: string): string {
  if (!model) return 'unknown';

  let normalized = model.toLowerCase().trim();

  // Remove date suffixes (YYYY-MM-DD or YYYYMMDD patterns)
  normalized = normalized.replace(/-\d{4}-\d{2}-\d{2}$/, '');
  normalized = normalized.replace(/-\d{8}$/, '');
  normalized = normalized.replace(/@\d{8}$/, '');

  // Remove version suffixes
  normalized = normalized.replace(/-v\d+:\d+$/, '');
  normalized = normalized.replace(/:v\d+$/, '');
  normalized = normalized.replace(/-latest$/, '');
  normalized = normalized.replace(/-preview$/, '');

  // Remove provider prefixes commonly added
  normalized = normalized.replace(/^azure\//, '');
  normalized = normalized.replace(/^openai\//, '');
  normalized = normalized.replace(/^anthropic\//, '');
  normalized = normalized.replace(/^google\//, '');
  normalized = normalized.replace(/^bedrock\//, '');
  normalized = normalized.replace(/^vertex_ai\//, '');

  // Normalize common model family names
  const modelFamilies: Array<[RegExp, string]> = [
    // OpenAI
    [/^gpt-4o-mini/, 'gpt-4o-mini'],
    [/^gpt-4o/, 'gpt-4o'],
    [/^gpt-4-turbo/, 'gpt-4-turbo'],
    [/^gpt-4-32k/, 'gpt-4-32k'],
    [/^gpt-4/, 'gpt-4'],
    [/^gpt-3\.5-turbo/, 'gpt-3.5-turbo'],
    [/^o1-mini/, 'o1-mini'],
    [/^o1-preview/, 'o1-preview'],
    [/^o1$/, 'o1'],

    // Anthropic (Claude 4.x - newest)
    [/^claude-sonnet-4-5/, 'claude-sonnet-4-5'],
    [/^claude-opus-4-5/, 'claude-opus-4-5'],
    [/^claude-sonnet-4/, 'claude-sonnet-4'],
    [/^claude-opus-4/, 'claude-opus-4'],
    // Anthropic (Claude 3.x)
    [/^claude-3-5-sonnet/, 'claude-3-5-sonnet'],
    [/^claude-3-5-haiku/, 'claude-3-5-haiku'],
    [/^claude-3-opus/, 'claude-3-opus'],
    [/^claude-3-sonnet/, 'claude-3-sonnet'],
    [/^claude-3-haiku/, 'claude-3-haiku'],
    [/^claude-2\.1/, 'claude-2.1'],
    [/^claude-2/, 'claude-2'],

    // Google
    [/^gemini-2\.0-flash/, 'gemini-2.0-flash'],
    [/^gemini-1\.5-pro/, 'gemini-1.5-pro'],
    [/^gemini-1\.5-flash/, 'gemini-1.5-flash'],
    [/^gemini-1\.0-pro/, 'gemini-1.0-pro'],
    [/^gemini-pro/, 'gemini-pro'],

    // Mistral
    [/^mistral-large/, 'mistral-large'],
    [/^mistral-medium/, 'mistral-medium'],
    [/^mistral-small/, 'mistral-small'],
    [/^mixtral-8x22b/, 'mixtral-8x22b'],
    [/^mixtral-8x7b/, 'mixtral-8x7b'],

    // Cohere
    [/^command-r-plus/, 'command-r-plus'],
    [/^command-r$/, 'command-r'],
    [/^command-light/, 'command-light'],
    [/^command$/, 'command'],

    // Llama
    [/^llama-3\.2/, 'llama-3.2'],
    [/^llama-3\.1/, 'llama-3.1'],
    [/^llama-3/, 'llama-3'],
    [/^llama-2/, 'llama-2'],
  ];

  for (const [pattern, replacement] of modelFamilies) {
    if (pattern.test(normalized)) {
      return replacement;
    }
  }

  return normalized;
}

// =============================================================================
// CACHING
// =============================================================================

/**
 * Ensure cache directory exists.
 */
function ensureCacheDir(): void {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
}

/**
 * Check if cache is valid (exists and not expired).
 */
function isCacheValid(): boolean {
  try {
    if (!fs.existsSync(CACHE_META_FILE) || !fs.existsSync(CACHE_FILE)) {
      return false;
    }

    const meta: CacheMetadata = JSON.parse(fs.readFileSync(CACHE_META_FILE, 'utf-8'));
    const age = Date.now() - meta.fetchedAt;
    return age < CACHE_TTL_MS;
  } catch {
    return false;
  }
}

/**
 * Read pricing from cache.
 */
function readCache(): Record<string, LiteLLMModelEntry> | null {
  try {
    if (!fs.existsSync(CACHE_FILE)) {
      return null;
    }
    return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
  } catch {
    return null;
  }
}

/**
 * Write pricing to cache.
 */
function writeCache(data: Record<string, LiteLLMModelEntry>): void {
  try {
    ensureCacheDir();
    fs.writeFileSync(CACHE_FILE, JSON.stringify(data), 'utf-8');
    const meta: CacheMetadata = {
      fetchedAt: Date.now(),
      version: '1.0',
    };
    fs.writeFileSync(CACHE_META_FILE, JSON.stringify(meta), 'utf-8');
  } catch {
    // Silently fail on cache write errors
  }
}

// =============================================================================
// FETCHING
// =============================================================================

/**
 * Fetch pricing data from LiteLLM GitHub.
 */
async function fetchLiteLLMPricing(): Promise<Record<string, LiteLLMModelEntry> | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const response = await fetch(LITELLM_PRICING_URL, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'PeakInfer/1.0',
      },
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data as Record<string, LiteLLMModelEntry>;
  } catch {
    return null;
  }
}

// =============================================================================
// MAIN API
// =============================================================================

/** In-memory pricing lookup after loading */
let pricingLookup: Map<string, NormalizedPricing> | null = null;

/**
 * Initialize pricing data.
 * Fetches from LiteLLM or uses cache.
 * Returns true if pricing data is available.
 */
export async function initializePricing(): Promise<boolean> {
  // Try cache first
  if (isCacheValid()) {
    const cached = readCache();
    if (cached) {
      pricingLookup = buildLookup(cached);
      return true;
    }
  }

  // Fetch from LiteLLM
  const fetched = await fetchLiteLLMPricing();
  if (fetched) {
    writeCache(fetched);
    pricingLookup = buildLookup(fetched);
    return true;
  }

  // Try stale cache as fallback
  const staleCache = readCache();
  if (staleCache) {
    pricingLookup = buildLookup(staleCache);
    return true;
  }

  // No data available
  return false;
}

/** Provider priority for model matching (prefer direct API over cloud variants) */
const PROVIDER_PRIORITY: Record<string, number> = {
  // Direct API providers (highest priority)
  openai: 100,
  anthropic: 100,
  google: 100,
  cohere: 100,
  mistral: 100,
  groq: 95,
  together: 90,
  fireworks: 90,
  deepinfra: 85,
  perplexity: 85,
  replicate: 80,
  anyscale: 80,

  // Cloud providers (lower priority - usually more expensive)
  'aws-bedrock': 50,
  'aws-sagemaker': 45,
  'azure-openai': 50,
  'gcp-vertex': 50,
  databricks: 40,

  // Unknown
  unknown: 0,
};

/**
 * Build lookup map from LiteLLM data.
 * Prefers direct API providers over cloud marketplace variants.
 */
function buildLookup(data: Record<string, LiteLLMModelEntry>): Map<string, NormalizedPricing> {
  const lookup = new Map<string, NormalizedPricing>();
  const bestPriority = new Map<string, number>(); // Track best priority per model

  for (const [modelKey, entry] of Object.entries(data)) {
    // Skip entries without pricing
    if (!entry.input_cost_per_token && !entry.output_cost_per_token) {
      continue;
    }

    // Determine provider
    let provider = entry.litellm_provider || 'unknown';
    provider = PROVIDER_MAPPING[provider] || provider;

    // Get provider priority
    const priority = PROVIDER_PRIORITY[provider] || 30;

    // Extract model name (remove provider prefix if present)
    let model = modelKey;
    if (modelKey.includes('/')) {
      model = modelKey.split('/').slice(1).join('/');
    }

    // Normalize model name for consistent lookup
    const normalizedModel = normalizeModelName(model);

    // Convert per-token to per-1M tokens
    const inputPer1M = (entry.input_cost_per_token || 0) * 1_000_000;
    const outputPer1M = (entry.output_cost_per_token || 0) * 1_000_000;

    // Store both original and normalized keys for lookup flexibility
    const pricing: NormalizedPricing = {
      provider,
      model: normalizedModel,
      inputPer1M,
      outputPer1M,
      maxInputTokens: entry.max_input_tokens,
      maxOutputTokens: entry.max_output_tokens || entry.max_tokens,
    };

    // Only update if this is a higher priority provider for this model
    const currentPriority = bestPriority.get(normalizedModel) || -1;
    if (priority > currentPriority) {
      lookup.set(normalizedModel, pricing);
      bestPriority.set(normalizedModel, priority);
    }

    // Always store by original key for exact matches (useful for provider-specific lookups)
    lookup.set(modelKey.toLowerCase(), pricing);
  }

  return lookup;
}

/**
 * Get pricing for a model.
 * Uses normalized model name matching.
 */
export function getPricing(model: string): NormalizedPricing | null {
  if (!pricingLookup) {
    return null;
  }

  // Try exact match first
  const exactMatch = pricingLookup.get(model.toLowerCase());
  if (exactMatch) {
    return exactMatch;
  }

  // Try normalized match
  const normalized = normalizeModelName(model);
  return pricingLookup.get(normalized) || null;
}

/**
 * Get all available models.
 */
export function getAvailableModels(): string[] {
  if (!pricingLookup) {
    return [];
  }
  return Array.from(new Set(Array.from(pricingLookup.values()).map((p) => p.model)));
}

/**
 * Get pricing stats.
 */
export function getPricingStats(): { totalModels: number; providers: string[]; cacheAge: string } {
  const models = pricingLookup ? pricingLookup.size : 0;
  const providers = pricingLookup
    ? Array.from(new Set(Array.from(pricingLookup.values()).map((p) => p.provider)))
    : [];

  let cacheAge = 'no cache';
  try {
    if (fs.existsSync(CACHE_META_FILE)) {
      const meta: CacheMetadata = JSON.parse(fs.readFileSync(CACHE_META_FILE, 'utf-8'));
      const ageMs = Date.now() - meta.fetchedAt;
      const ageHours = Math.round(ageMs / (60 * 60 * 1000));
      cacheAge = ageHours < 1 ? 'fresh' : `${ageHours}h ago`;
    }
  } catch {
    // ignore
  }

  return { totalModels: models, providers, cacheAge };
}
