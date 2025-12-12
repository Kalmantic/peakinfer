/**
 * PRD-Aligned CLI Renderer — PeakInfer v1.0
 *
 * Design Document v1.0 Section 6 "CLI Interaction Design"
 *
 * Core insight (DD Section 1):
 *   "The user's goal is not to run PeakInfer.
 *    The user's goal is to stop guessing."
 *
 * Design Principles (Julie Zhou):
 * - Behavior First: Help developers understand their LLM usage
 * - Clarity Over Cleverness: Human language, not jargon
 * - Content-Driven Layout: Hierarchy via spacing (not decoration)
 * - Invisible UI: The insight stays, the interface disappears
 *
 * Copy philosophy: Talk like a helpful colleague, not a database report.
 */

import type {
  ScanResult,
  StackMap,
  PricingSummary,
  TechStack,
  ClassifiedCallsite,
  InferencePatterns,
  CallsiteCost,
} from './types.js';

// =============================================================================
// CONSTANTS
// =============================================================================

const VERSION = 'v1.0';

// Indentation helper (DD: hierarchy via spacing)
const indent = (level: number): string => '  '.repeat(level);

// =============================================================================
// FORMATTING HELPERS
// =============================================================================

/** Format currency */
function formatCurrency(amount: number): string {
  return '$' + amount.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

/** Format currency with range */
function formatCurrencyRange(low: number, high: number): string {
  if (low === high) return formatCurrency(low);
  return `${formatCurrency(low)} – ${formatCurrency(high)}`;
}

/** Format number with commas */
function formatNumber(n: number): string {
  return n.toLocaleString('en-US');
}

// =============================================================================
// ZERO STATE — No LLM calls found (DD Section 7.1)
// =============================================================================

/**
 * Render the empty state per DD Section 7.1
 *
 * "Must feel helpful, not empty."
 */
export function renderPRDZeroState(scan: ScanResult, checkedSDKs: SDKCheckResult[]): void {
  console.log('');
  console.log(`PeakInfer ${VERSION}`);
  console.log('');

  // What we looked at
  console.log(`Scanned ${formatNumber(scan.totalFiles)} files (~${formatNumber(scan.totalLines)} lines)`);
  console.log(`Languages: ${Object.keys(scan.languages).join(', ') || 'unknown'}`);
  console.log('');

  // The finding
  console.log('No LLM calls found.');
  console.log('');

  // What we checked for
  console.log('Looked for:');
  for (const sdk of checkedSDKs) {
    const status = sdk.found ? 'found' : 'not found';
    console.log(indent(1) + `${sdk.name.padEnd(30)} ${status}`);
  }
  console.log('');

  // Helpful next steps
  console.log('If you expected to see LLM calls:');
  console.log(indent(1) + '→ Check if they\'re behind custom wrappers or clients');
  console.log(indent(1) + '→ Check for dynamic imports or conditional code paths');
  console.log(indent(1) + '→ Run with --verbose to see what we\'re scanning');
  console.log('');
}

/** SDK check result for zero state */
export interface SDKCheckResult {
  name: string;
  found: boolean;
}

/** Default SDKs to check */
export const DEFAULT_SDK_CHECKS: SDKCheckResult[] = [
  { name: 'OpenAI SDK', found: false },
  { name: 'Anthropic SDK', found: false },
  { name: 'LangChain', found: false },
  { name: 'LlamaIndex', found: false },
  { name: 'vLLM', found: false },
  { name: 'Direct HTTP to inference APIs', found: false },
];

// =============================================================================
// LOADING STATE (DD Section 6.4)
// =============================================================================

/**
 * Render the loading state per DD Section 6.4
 *
 * "Progress should be phase-based (not noisy per-file spam)"
 */
export function renderPRDLoadingState(
  stage: 'connecting' | 'scanning' | 'analyzing',
  progress?: { current: number; total: number; currentFile?: string }
): void {
  if (stage === 'connecting') {
    process.stdout.write('\rConnecting...');
  } else if (stage === 'scanning' && progress) {
    const pct = Math.round((progress.current / progress.total) * 100);
    process.stdout.write(`\rScanning... ${pct}%`);
  }
}

/** Mark loading stage as complete */
export function renderPRDLoadingComplete(stage: string): void {
  process.stdout.write(`\r${stage}    ✓\n`);
}

/** Mark loading stage as failed */
export function renderPRDLoadingFailed(stage: string): void {
  process.stdout.write(`\r${stage}    ✗\n`);
}

// =============================================================================
// ERROR STATE (DD Section 7.3)
// =============================================================================

/**
 * Render the error state per DD Section 7.3
 *
 * "What's wrong, where, and what to do"
 */
export function renderPRDErrorState(
  error: {
    type: 'api_connection' | 'api_key' | 'rate_limit' | 'other';
    message?: string;
  }
): void {
  console.log('');
  console.log(`PeakInfer ${VERSION}`);
  console.log('');
  console.log(`Error: ${getErrorMessage(error.type)}`);
  console.log('');

  console.log('Possible causes:');
  const causes = getErrorCauses(error.type);
  for (const cause of causes) {
    console.log(indent(1) + `→ ${cause}`);
  }

  if (error.type === 'api_key') {
    console.log('');
    console.log('To fix this:');
    console.log(indent(1) + 'export ANTHROPIC_API_KEY=sk-ant-...');
  }

  console.log('');
  console.log('You can still view your last analysis:');
  console.log(indent(1) + '→ peakinfer analyze . --cached');
  console.log('');
}

function getErrorMessage(type: string): string {
  switch (type) {
    case 'api_connection':
      return 'Can\'t reach Anthropic API';
    case 'api_key':
      return 'API key missing or invalid';
    case 'rate_limit':
      return 'Rate limit exceeded (try again in a few minutes)';
    default:
      return 'Something went wrong';
  }
}

function getErrorCauses(type: string): string[] {
  switch (type) {
    case 'api_connection':
      return [
        'No internet connection',
        'API key not set',
        'Anthropic API is down',
      ];
    case 'api_key':
      return [
        'ANTHROPIC_API_KEY environment variable not set',
        'Key is expired or revoked',
        'Key format is wrong (should start with sk-ant-)',
      ];
    case 'rate_limit':
      return [
        'Too many requests too fast',
        'Daily quota used up',
      ];
    default:
      return ['Check the error message above'];
  }
}

// =============================================================================
// PARTIAL STATE (DD Section 7.2)
// =============================================================================

/**
 * Render the partial state per DD Section 7.2
 *
 * "Partial is common in real repos. Treat it as normal."
 */
export function renderPRDPartialState(
  scan: ScanResult,
  skippedFiles: Array<{ file: string; reason: string }>
): void {
  console.log('');
  console.log(`PeakInfer ${VERSION}`);
  console.log('');
  console.log('Partial results (some files couldn\'t be parsed)');
  console.log(indent(1) + `Scanned: ${scan.totalFiles - skippedFiles.length} of ${scan.totalFiles} files`);
  console.log(indent(1) + `Skipped: ${skippedFiles.length} files`);
  console.log('');

  if (skippedFiles.length > 0) {
    console.log('Skipped files:');
    for (const skipped of skippedFiles.slice(0, 3)) {
      console.log(indent(1) + skipped.file);
      console.log(indent(2) + `(${skipped.reason})`);
    }
    if (skippedFiles.length > 3) {
      console.log(indent(1) + `... and ${skippedFiles.length - 3} more`);
    }
    console.log('');
  }

  console.log('Results are still valid for the files we could parse.');
  console.log('');
}

// =============================================================================
// SUCCESS STATE (DD Section 6 - Full CLI Spec)
// =============================================================================

/**
 * Render the full success state per DD Section 6
 *
 * Fixed output order:
 * 1. Header
 * 2. What we scanned
 * 3. What we found (summary)
 * 4. Where your LLM calls are (InferenceMap)
 * 5. What it costs
 * 6. How to optimize
 * 7. What's next
 */
export function renderPRDSuccessState(
  scan: ScanResult,
  callsites: ClassifiedCallsite[],
  stackMap: StackMap,
  pricing: PricingSummary,
  techStack?: TechStack,
  patterns?: InferencePatterns,
  outputFiles: string[] = []
): void {
  // 1. HEADER
  console.log('');
  console.log(`PeakInfer ${VERSION}`);
  console.log('');

  // 2. WHAT WE SCANNED (Scope)
  console.log(`Scanned ${formatNumber(scan.totalFiles)} files (~${formatNumber(scan.totalLines)} lines)`);
  console.log(`Languages: ${Object.keys(scan.languages).join(', ') || 'unknown'}`);
  console.log('');

  // 3. WHAT WE FOUND (Summary)
  const providerCounts = countByField(callsites, 'provider');
  const modelCounts = countByField(callsites, 'model');
  const patternList = formatPatterns(patterns);

  console.log(`Found ${callsites.length} LLM call${callsites.length === 1 ? '' : 's'}`);
  console.log(indent(1) + `Providers: ${formatCounts(providerCounts)}`);
  console.log(indent(1) + `Models: ${formatCounts(modelCounts)}`);
  if (patternList) {
    console.log(indent(1) + `Patterns: ${patternList}`);
  }
  console.log('');

  // 4. WHERE YOUR LLM CALLS ARE (InferenceMap preview)
  renderInferenceMap(callsites);

  // 5. WHAT IT COSTS
  renderCostEstimate(pricing);

  // 6. HOW TO OPTIMIZE (Recommendations)
  renderOptimizations(pricing.hotspots);

  // 7. WHAT'S NEXT
  if (outputFiles.length > 0) {
    console.log('Saved');
    for (const file of outputFiles) {
      console.log(indent(1) + file);
    }
    console.log('');
  }

  console.log('Next');
  console.log(indent(1) + '→ peakinfer models              see model performance benchmarks');
  console.log(indent(1) + '→ peakinfer analyze . --html    generate shareable report');
  console.log('');
}

// =============================================================================
// WHERE YOUR LLM CALLS ARE (InferenceMap)
// =============================================================================

/**
 * Show where LLM calls live in the codebase.
 * Developer-friendly: file paths and line numbers they can click.
 */
function renderInferenceMap(callsites: ClassifiedCallsite[]): void {
  if (callsites.length === 0) return;

  console.log('Where your LLM calls are');

  // Group by file for cleaner display
  const byFile = new Map<string, ClassifiedCallsite[]>();
  for (const cs of callsites) {
    if (!byFile.has(cs.file)) {
      byFile.set(cs.file, []);
    }
    byFile.get(cs.file)!.push(cs);
  }

  // Show up to 5 files
  const files = [...byFile.entries()].slice(0, 5);
  for (const [file, fileCallsites] of files) {
    console.log(indent(1) + file);
    for (const cs of fileCallsites.slice(0, 3)) {
      const model = cs.model || 'unknown model';
      const streaming = cs.isStreaming ? ', streaming' : '';
      console.log(indent(2) + `L${cs.line}: ${cs.provider || 'unknown'} → ${model}${streaming}`);
    }
    if (fileCallsites.length > 3) {
      console.log(indent(2) + `+ ${fileCallsites.length - 3} more`);
    }
  }

  if (byFile.size > 5) {
    console.log(indent(1) + `+ ${byFile.size - 5} more files (see peakinfer-stackmap.json)`);
  }

  console.log('');
}

// =============================================================================
// WHAT IT COSTS
// =============================================================================

/**
 * Show estimated costs in plain English.
 */
function renderCostEstimate(pricing: PricingSummary): void {
  // Skip if no meaningful pricing data
  if (pricing.estimatedRange.high <= 0) return;

  console.log('Estimated monthly cost');
  console.log(indent(1) + formatCurrencyRange(pricing.estimatedRange.low, pricing.estimatedRange.high) + '/month');

  // Show breakdown by provider if multiple
  if (pricing.byProvider.length > 1) {
    console.log('');
    for (const p of pricing.byProvider) {
      const pct = Math.round(p.percentage);
      console.log(indent(1) + `${p.provider}: ${pct}% of usage`);
    }
  }

  // Flag the expensive one
  if (pricing.mostExpensiveModel) {
    console.log('');
    console.log(indent(1) + `Highest cost: ${pricing.mostExpensiveModel}`);
  }

  console.log('');
}

// =============================================================================
// HOW TO OPTIMIZE
// =============================================================================

/**
 * Show actionable optimization suggestions.
 * Developer-friendly: specific files, specific suggestions.
 */
function renderOptimizations(hotspots: CallsiteCost[]): void {
  // Filter to hotspots with actual suggestions
  const withSuggestions = hotspots.filter(h => h.suggestion);
  if (withSuggestions.length === 0) return;

  console.log('Quick wins');

  for (const h of withSuggestions.slice(0, 3)) {
    const cost = formatCurrencyRange(h.estimatedMonthlyLow, h.estimatedMonthlyHigh);
    console.log(indent(1) + `${h.file}:${h.line}`);
    console.log(indent(2) + `Currently: ${h.model || 'unknown'} (${cost}/mo)`);
    console.log(indent(2) + `→ ${h.suggestion}`);
    console.log('');
  }
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function countByField(
  callsites: ClassifiedCallsite[],
  field: 'model' | 'provider' | 'framework'
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const cs of callsites) {
    const value = cs[field] || 'unknown';
    counts[value] = (counts[value] || 0) + 1;
  }
  return counts;
}

function formatCounts(counts: Record<string, number>): string {
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return 'none';
  return entries.map(([name, count]) => `${name} (${count})`).join(', ');
}

function formatPatterns(patterns?: InferencePatterns): string | null {
  if (!patterns) return null;

  const detected: string[] = [];

  if (patterns.streaming?.detected) detected.push('streaming');
  if (patterns.retry?.detected) detected.push('retries');
  if (patterns.batching?.detected) detected.push('batching');
  if (patterns.caching?.detected) detected.push('caching');
  if (patterns.routing?.detected) detected.push('routing');
  if (patterns.fallback?.detected) detected.push('fallbacks');

  return detected.length > 0 ? detected.join(', ') : null;
}
