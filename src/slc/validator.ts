/**
 * Validator Module — Claude Output Validation
 *
 * Responsibility (per Tech Design v1.1):
 * - Claude outputs are validated, not trusted
 * - JSON schema validation
 * - Confidence filtering (< 0.4 rejected)
 * - Provider/model normalization
 *
 * Design: Defensive validation, permissive input handling.
 */

import type { RawCallsite, ClassifiedCallsite } from './types.js';

// =============================================================================
// CONFIGURATION
// =============================================================================

/** Minimum confidence threshold (Tech Design v1.1: default 0.4) */
const MIN_CONFIDENCE = 0.4;

/** Provider name normalization map */
const PROVIDER_ALIASES: Record<string, string> = {
  'open_ai': 'openai',
  'open-ai': 'openai',
  'gpt': 'openai',
  'claude': 'anthropic',
  'gemini': 'google',
};

// =============================================================================
// P1 RESPONSE VALIDATION
// =============================================================================

/**
 * Validate P1 (detect_callsites) response from Claude.
 * Filters low-confidence and malformed entries.
 *
 * @param raw - Raw response from Claude (untrusted)
 * @returns Array of validated RawCallsite objects
 */
export function validateP1Response(raw: unknown): RawCallsite[] {
  // Handle null/undefined
  if (!raw || typeof raw !== 'object') {
    return [];
  }

  const response = raw as Record<string, unknown>;

  // Must have callsites array
  if (!Array.isArray(response.callsites)) {
    return [];
  }

  return response.callsites
    .filter(isValidRawCallsite)
    .filter((c) => c.confidence >= MIN_CONFIDENCE);
}

/**
 * Type guard for RawCallsite validation.
 * Checks all required fields are present and correctly typed.
 */
function isValidRawCallsite(entry: unknown): entry is RawCallsite {
  if (!entry || typeof entry !== 'object') return false;

  const e = entry as Record<string, unknown>;

  return (
    typeof e.id === 'string' &&
    typeof e.file === 'string' &&
    typeof e.startLine === 'number' &&
    typeof e.endLine === 'number' &&
    typeof e.code === 'string' &&
    typeof e.coarseKind === 'string' &&
    typeof e.confidence === 'number'
  );
}

// =============================================================================
// P2 RESPONSE VALIDATION
// =============================================================================

/**
 * Validate P2 (classify_callsite) response from Claude.
 * Normalizes provider names and applies confidence filter.
 *
 * @param raw - Raw response from Claude (untrusted)
 * @param file - Source file path (for enrichment)
 * @param line - Source line number (for enrichment)
 * @returns ClassifiedCallsite or null if invalid/low-confidence
 */
export function validateP2Response(
  raw: unknown,
  file: string,
  line: number
): ClassifiedCallsite | null {
  // Handle null/undefined
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const r = raw as Record<string, unknown>;

  // Check required fields
  if (
    typeof r.callsiteId !== 'string' ||
    typeof r.confidence !== 'number' ||
    !r.reasoning ||
    typeof r.reasoning !== 'object'
  ) {
    return null;
  }

  // Confidence filter
  if (r.confidence < MIN_CONFIDENCE) {
    return null;
  }

  const reasoning = r.reasoning as Record<string, unknown>;

  return {
    id: r.callsiteId,
    file,
    line,
    provider: normalizeProvider(r.provider as string | null | undefined),
    model: typeof r.model === 'string' ? r.model : null,
    framework: typeof r.framework === 'string' ? r.framework : null,
    runtime: typeof r.runtime === 'string' ? r.runtime : null,
    taskKind: typeof r.taskKind === 'string' ? r.taskKind : 'unknown',
    isStreaming: typeof r.isStreaming === 'boolean' ? r.isStreaming : null,
    confidence: r.confidence,
    reasoning: {
      whyProvider: typeof reasoning.whyProvider === 'string' ? reasoning.whyProvider : '',
      whyModel: typeof reasoning.whyModel === 'string' ? reasoning.whyModel : '',
    },
  };
}

// =============================================================================
// PROVIDER NORMALIZATION
// =============================================================================

/**
 * Normalize provider names to canonical form.
 * Handles common variations and aliases.
 *
 * @param provider - Raw provider string (may be null/undefined)
 * @returns Normalized provider name or null
 */
export function normalizeProvider(provider: string | null | undefined): string | null {
  if (provider === null || provider === undefined) {
    return null;
  }

  // Lowercase first
  const lower = provider.toLowerCase();

  // Check aliases
  if (PROVIDER_ALIASES[lower]) {
    return PROVIDER_ALIASES[lower];
  }

  return lower;
}
