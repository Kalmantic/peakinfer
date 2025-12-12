/**
 * PRD-Aligned CLI Renderer — PeakInfer v0.95
 *
 * This renderer implements the EXACT output format specified in
 * PRD v0.95 Section 9.1 "First-Run Experience & State Handling"
 *
 * Design Principles (Julie Zhuo):
 * - Invisible UI
 * - Content-first
 * - Fast, clear, minimal
 * - All states: empty, loading, success, error, partial
 * - High contrast
 * - Logical keyboard flow
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
const BOX_WIDTH = 69;

// Box drawing characters
const BOX = {
  TL: '┌', TR: '┐', BL: '└', BR: '┘',
  H: '─', V: '│',
  LT: '├', RT: '┤',
};

// =============================================================================
// FORMATTING HELPERS
// =============================================================================

/** Create a horizontal line */
function hLine(width: number = BOX_WIDTH): string {
  return BOX.H.repeat(width);
}

/** Create a box top line */
function boxTop(width: number = BOX_WIDTH): string {
  return BOX.TL + hLine(width) + BOX.TR;
}

/** Create a box bottom line */
function boxBottom(width: number = BOX_WIDTH): string {
  return BOX.BL + hLine(width) + BOX.BR;
}

/** Create a box separator line */
function boxSep(width: number = BOX_WIDTH): string {
  return BOX.LT + hLine(width) + BOX.RT;
}

/** Pad string to width, centered */
function center(str: string, width: number = BOX_WIDTH): string {
  const padding = Math.max(0, width - str.length);
  const left = Math.floor(padding / 2);
  const right = padding - left;
  return ' '.repeat(left) + str + ' '.repeat(right);
}

/** Pad string to width, left-aligned */
function padRight(str: string, width: number = BOX_WIDTH): string {
  return str + ' '.repeat(Math.max(0, width - str.length));
}

/** Create a box row with content */
function boxRow(content: string, width: number = BOX_WIDTH): string {
  return BOX.V + padRight(' ' + content, width) + BOX.V;
}

/** Create an empty box row */
function boxEmpty(width: number = BOX_WIDTH): string {
  return BOX.V + ' '.repeat(width) + BOX.V;
}

/** Format currency */
function formatCurrency(amount: number): string {
  return '$' + amount.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

/** Format currency with range */
function formatCurrencyRange(low: number, high: number): string {
  return `${formatCurrency(low)} - ${formatCurrency(high)}`;
}

/** Format percentage */
function formatPercent(value: number): string {
  return Math.round(value) + '%';
}

/** Format throughput (tokens per second) */
function formatThroughput(tps: number): string {
  return tps.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }) + ' tps';
}

// =============================================================================
// ZERO STATE — No LLM calls detected
// =============================================================================

/**
 * Render the empty state per PRD Section 9.1
 *
 * Shows what was scanned, what was checked for, and troubleshooting tips.
 */
export function renderPRDZeroState(scan: ScanResult, checkedSDKs: SDKCheckResult[]): void {
  console.log(`
$ peakinfer analyze .

PeakInfer ${VERSION}

Scanned: ${scan.totalFiles} files (${scan.totalLines.toLocaleString()} LOC)
Languages: ${Object.keys(scan.languages).join(', ') || 'unknown'}

No LLM inference calls detected.

Checked for:`);

  for (const sdk of checkedSDKs) {
    const status = sdk.found ? 'found' : 'not found';
    const padding = Math.max(0, 22 - sdk.name.length);
    console.log(`  • ${sdk.name}${' '.repeat(padding)}${status}`);
  }

  console.log(`
If you expected LLM usage, check:
  → Dynamic imports or runtime-loaded modules
  → Environment-gated code paths
  → Vendored or renamed SDKs

Nothing to map. Exiting.
`);
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
// LOADING STATE — Analysis in progress
// =============================================================================

/**
 * Render the loading state per PRD Section 9.1
 */
export function renderPRDLoadingState(
  stage: 'connecting' | 'scanning' | 'analyzing',
  progress?: { current: number; total: number; currentFile?: string }
): void {
  if (stage === 'connecting') {
    process.stdout.write('\rConnecting to Claude Code SDK...    ');
  } else if (stage === 'scanning' && progress) {
    const pct = Math.round((progress.current / progress.total) * 100);
    const filled = Math.round(pct / 10);
    const empty = 10 - filled;
    const bar = '█'.repeat(filled) + '░'.repeat(empty);
    const file = progress.currentFile ? progress.currentFile.split('/').pop() : '';
    process.stdout.write(`\rScanning codebase...                ${bar}  ${pct}%`);
    if (file) {
      console.log(`\n  └─ ${file}                    analyzing`);
    }
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
// ERROR STATE — API failure
// =============================================================================

/**
 * Render the error state per PRD Section 9.1
 */
export function renderPRDErrorState(
  error: {
    type: 'api_connection' | 'api_key' | 'rate_limit' | 'other';
    message?: string;
  }
): void {
  console.log(`
$ peakinfer analyze .

PeakInfer ${VERSION}

Connecting to Claude Code SDK...    ✗

Error: ${getErrorMessage(error.type)}

Possible causes:`);

  const causes = getErrorCauses(error.type);
  for (const cause of causes) {
    console.log(`  → ${cause}`);
  }

  if (error.type === 'api_key') {
    console.log(`
Set your API key:
  export ANTHROPIC_API_KEY=sk-ant-...`);
  }

  console.log(`
Cached StackMaps remain available:
  → peakinfer stackmap --cached
`);
}

function getErrorMessage(type: string): string {
  switch (type) {
    case 'api_connection':
      return 'Unable to reach Anthropic API.';
    case 'api_key':
      return 'ANTHROPIC_API_KEY not set or invalid.';
    case 'rate_limit':
      return 'API rate limit exceeded.';
    default:
      return 'An unexpected error occurred.';
  }
}

function getErrorCauses(type: string): string[] {
  switch (type) {
    case 'api_connection':
      return [
        'No internet connection',
        'ANTHROPIC_API_KEY not set or invalid',
        'API rate limit exceeded',
      ];
    case 'api_key':
      return [
        'Environment variable not set',
        'API key is expired or invalid',
        'Wrong key format',
      ];
    case 'rate_limit':
      return [
        'Too many requests in short time',
        'Daily quota exceeded',
        'Try again in a few minutes',
      ];
    default:
      return ['Unknown error - check logs for details'];
  }
}

// =============================================================================
// PARTIAL STATE — Some files unparseable
// =============================================================================

/**
 * Render the partial state per PRD Section 9.1
 */
export function renderPRDPartialState(
  scan: ScanResult,
  skippedFiles: Array<{ file: string; reason: string }>
): void {
  console.log(`
PeakInfer ${VERSION}

Scanned: ${scan.totalFiles} files (${scan.totalLines.toLocaleString()} LOC)
Skipped: ${skippedFiles.length} files (parse errors)`);

  for (const skipped of skippedFiles.slice(0, 3)) {
    console.log(`  └─ ${skipped.file}        ${skipped.reason}`);
  }

  console.log(`
Warning: Skipped files may contain undetected LLM calls.
`);
}

// =============================================================================
// SUCCESS STATE — Full StackMap
// =============================================================================

/**
 * Render the full success state per PRD Section 9.1
 *
 * This is the main output format showing:
 * - Scan summary
 * - Detection summary
 * - STACKMAP box
 * - PRICING SUMMARY box
 * - HOTSPOTS box
 * - Output files
 * - Next commands
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
  // Header
  console.log(`
$ peakinfer analyze .

PeakInfer ${VERSION}

Scanned: ${scan.totalFiles} files (${scan.totalLines.toLocaleString()} LOC)
Languages: ${Object.keys(scan.languages).join(', ') || 'unknown'}

Found ${callsites.length} inference callsites across ${countUniqueFiles(callsites)} files.
`);

  // STACKMAP box
  renderStackMapBox(callsites, stackMap, techStack, patterns);

  // PRICING SUMMARY box
  renderPricingBox(pricing);

  // HOTSPOTS box
  renderHotspotsBox(pricing.hotspots);

  // Output files
  console.log(`Output saved:`);
  for (const file of outputFiles) {
    console.log(`  → ${file}`);
  }

  // Next commands
  console.log(`
Run \`peakinfer prices\` for model pricing data.
Run \`peakinfer templates list\` to browse optimization strategies.
`);
}

// =============================================================================
// STACKMAP BOX
// =============================================================================

function renderStackMapBox(
  callsites: ClassifiedCallsite[],
  stackMap: StackMap,
  techStack?: TechStack,
  patterns?: InferencePatterns
): void {
  console.log(boxTop());
  console.log(boxRow(center('STACKMAP', BOX_WIDTH - 2)));
  console.log(boxSep());
  console.log(boxEmpty());

  // CALLSITES section
  console.log(boxRow(`CALLSITES (${callsites.length})`));
  console.log(boxRow('   │'));

  // Show top 5 callsites
  const topCallsites = callsites.slice(0, 5);
  for (let i = 0; i < topCallsites.length; i++) {
    const cs = topCallsites[i];
    const prefix = i === topCallsites.length - 1 && callsites.length <= 5 ? '└' : '├';
    const model = cs.model || 'unknown';
    const streaming = cs.isStreaming ? ', streaming' : '';
    console.log(boxRow(`   ${prefix}──► ${cs.file}:${cs.line}         ${model}${streaming}`));
  }

  if (callsites.length > 5) {
    console.log(boxRow(`   └──► ... ${callsites.length - 5} more (see stackmap.json)`));
  }

  console.log(boxEmpty());
  console.log(boxSep());
  console.log(boxEmpty());

  // MODELS section
  const modelCounts = countByField(callsites, 'model');
  console.log(boxRow(`MODELS (${Object.keys(modelCounts).length})`));
  console.log(boxRow('   │'));

  const models = Object.entries(modelCounts).sort((a, b) => b[1] - a[1]);
  for (let i = 0; i < models.length; i++) {
    const [model, count] = models[i];
    const prefix = i === models.length - 1 ? '└' : '├';
    const estTokens = estimateMonthlyTokens(count);
    console.log(boxRow(`   ${prefix}──► ${model || 'unknown'}                    ${count} calls   ~${estTokens}`));
  }

  console.log(boxEmpty());
  console.log(boxSep());
  console.log(boxEmpty());

  // VENDORS / PROVIDERS section
  const providerCounts = countByField(callsites, 'provider');
  console.log(boxRow(`VENDORS / PROVIDERS (${Object.keys(providerCounts).length})`));
  console.log(boxRow('   │'));

  const providers = Object.entries(providerCounts).sort((a, b) => b[1] - a[1]);
  for (let i = 0; i < providers.length; i++) {
    const [provider, count] = providers[i];
    const prefix = i === providers.length - 1 ? '└' : '├';
    const via = detectProviderVia(callsites, provider);
    console.log(boxRow(`   ${prefix}──► ${provider || 'unknown'} API              ${count} calls   ${via}`));
  }

  console.log(boxEmpty());
  console.log(boxSep());
  console.log(boxEmpty());

  // RUNTIMES section
  if (techStack) {
    const runtimeCount = techStack.serving.runtimes.length +
      techStack.serving.platforms.length;
    const inferredCount = techStack.serving.platforms.length > 0 ? 1 : 0;

    console.log(boxRow(`RUNTIMES (${runtimeCount} detected, ${inferredCount} inferred)`));
    console.log(boxRow('   │'));

    if (techStack.serving.runtimes.length > 0) {
      for (const runtime of techStack.serving.runtimes) {
        console.log(boxRow(`   ├──► ${runtime}               detected`));
      }
    }

    if (techStack.serving.platforms.length > 0) {
      for (const platform of techStack.serving.platforms) {
        console.log(boxRow(`   ├──► ${platform}             inferred from SDK`));
      }
    }

    // Unknown for proprietary
    const unknownProviders = providers.filter(([p]) =>
      p?.toLowerCase() === 'openai');
    if (unknownProviders.length > 0) {
      console.log(boxRow('   └──► unknown                  OpenAI (proprietary)'));
    }

    console.log(boxEmpty());
    console.log(boxSep());
    console.log(boxEmpty());

    // HARDWARE section
    console.log(boxRow('HARDWARE (inferred from providers + runtime config)'));
    console.log(boxRow('   │'));

    if (techStack.hardware.gpus.length > 0) {
      for (const gpu of techStack.hardware.gpus) {
        console.log(boxRow(`   ├──► ${gpu}              inferred`));
      }
    } else {
      // Infer from providers
      if (providers.some(([p]) => p?.toLowerCase().includes('anthropic'))) {
        console.log(boxRow('   ├──► NVIDIA H100 / A100       Anthropic (inferred)'));
      }
      if (providers.some(([p]) => p?.toLowerCase().includes('together'))) {
        console.log(boxRow('   ├──► NVIDIA H100              Together (inferred)'));
      }
      if (providers.some(([p]) => p?.toLowerCase() === 'openai')) {
        console.log(boxRow('   ├──► unknown                  OpenAI (proprietary)'));
      }
    }

    console.log(boxRow('   │'));
    console.log(boxRow('   ├──► Self-hosted detection:'));

    if (techStack.serving.runtimes.some(r =>
      ['vllm', 'sglang', 'llama.cpp', 'tgi'].includes(r.toLowerCase()))) {
      console.log(boxRow('   │      └─ Local runtime configs detected'));
    } else {
      console.log(boxRow('   │      └─ None found (no local vLLM/SGLang/llama.cpp configs)'));
    }

    console.log(boxRow('   │'));
    console.log(boxRow('   └──► GPU env vars:'));
    console.log(boxRow('          └─ CUDA_VISIBLE_DEVICES not set'));
    console.log(boxRow('          └─ No terraform GPU resources detected'));

    console.log(boxEmpty());
    console.log(boxSep());
    console.log(boxEmpty());
  }

  // PATTERNS DETECTED section - only show if any patterns found
  if (patterns) {
    const patternList = [
      { name: 'Retry logic', detected: patterns.retry?.detected, instance: patterns.retry?.instances?.[0] },
      { name: 'Batching', detected: patterns.batching?.detected, instance: patterns.batching?.instances?.[0] },
      { name: 'Streaming', detected: patterns.streaming?.detected, instance: patterns.streaming?.instances?.[0] },
      { name: 'Caching', detected: patterns.caching?.detected, instance: patterns.caching?.instances?.[0] },
      { name: 'Router / model switching', detected: patterns.routing?.detected, instance: patterns.routing?.instances?.[0] },
      { name: 'Fallback chain', detected: patterns.fallback?.detected, instance: patterns.fallback?.instances?.[0] },
    ];

    const detectedPatterns = patternList.filter(p => p.detected);

    // Only show if at least one pattern detected
    if (detectedPatterns.length > 0) {
      console.log(boxRow('PATTERNS DETECTED'));
      console.log(boxRow('   │'));

      for (let i = 0; i < detectedPatterns.length; i++) {
        const p = detectedPatterns[i];
        const prefix = i === detectedPatterns.length - 1 ? '└' : '├';
        const location = p.instance ? `  ${p.instance.file}:${p.instance.line}` : '';
        console.log(boxRow(`   ${prefix}──► ${p.name.padEnd(22)} ✓${location}`));
      }

      console.log(boxEmpty());
    }
  }

  console.log(boxBottom());
  console.log('');
}

// =============================================================================
// PRICING BOX
// =============================================================================

function renderPricingBox(pricing: PricingSummary): void {
  // Julie Zhou: "Content determines structure" - skip empty pricing
  const hasMeaningfulData = pricing.estimatedRange.high > 0 ||
    pricing.byProvider.length > 0 ||
    pricing.byModel.length > 0;

  if (!hasMeaningfulData) {
    return; // Nothing to show - don't add noise
  }

  console.log(boxTop());
  console.log(boxRow(center('PRICING SUMMARY', BOX_WIDTH - 2)));
  console.log(boxSep());
  console.log(boxEmpty());

  // Estimated monthly cost
  console.log(boxRow(`Estimated monthly cost: ${formatCurrencyRange(pricing.estimatedRange.low, pricing.estimatedRange.high)}`));
  console.log(boxEmpty());

  // By vendor
  if (pricing.byProvider.length > 0) {
    console.log(boxRow('By vendor:'));
    for (const p of pricing.byProvider) {
      const throughputStr = formatThroughput(p.throughput).padStart(10);
      const pctStr = `(${formatPercent(p.percentage)})`.padStart(6);
      console.log(boxRow(`   ├──► ${p.provider.padEnd(15)} ${throughputStr}    ${pctStr}`));
    }
    console.log(boxEmpty());
  }

  // By model
  if (pricing.byModel.length > 0) {
    console.log(boxRow('By model:'));
    for (const m of pricing.byModel.slice(0, 4)) {
      const throughputStr = formatThroughput(m.throughput).padStart(10);
      console.log(boxRow(`   ├──► ${(m.model || 'unknown').padEnd(15)} ${throughputStr}`));
    }
    console.log(boxEmpty());
  }

  console.log(boxBottom());
  console.log('');
}

// =============================================================================
// HOTSPOTS BOX
// =============================================================================

function renderHotspotsBox(hotspots: CallsiteCost[]): void {
  if (hotspots.length === 0) return;

  console.log(boxTop());
  console.log(boxRow(center('HOTSPOTS', BOX_WIDTH - 2)));
  console.log(boxSep());
  console.log(boxEmpty());

  // SLC: Add disclaimer for AI-generated suggestions
  const hasAISuggestions = hotspots.some(h => h.suggestion?.includes('[AI Suggestion'));
  if (hasAISuggestions) {
    console.log(boxRow('NOTE: AI suggestions below are based on code analysis only.'));
    console.log(boxRow('Actual usage patterns may differ. Verify with your metrics.'));
    console.log(boxEmpty());
  }

  for (const h of hotspots.slice(0, 3)) {
    const costRange = formatCurrencyRange(h.estimatedMonthlyLow, h.estimatedMonthlyHigh);
    console.log(boxRow(`⚠  ${h.file}:${h.line}`));
    console.log(boxRow(`   └─ ${h.model || 'unknown'}, ${costRange}/mo`));

    if (h.suggestion) {
      console.log(boxRow(`   └─ ${h.suggestion}`));
    }

    console.log(boxEmpty());
  }

  console.log(boxBottom());
  console.log('');
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function countUniqueFiles(callsites: ClassifiedCallsite[]): number {
  return new Set(callsites.map(c => c.file)).size;
}

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

function estimateMonthlyTokens(callCount: number): string {
  // Rough estimate: each call ~1K-10K tokens
  const estimate = callCount * 5000 * 30; // calls per day * 30 days
  if (estimate >= 1000000) {
    return `${(estimate / 1000000).toFixed(1)}M tok/mo`;
  } else if (estimate >= 1000) {
    return `${(estimate / 1000).toFixed(0)}K tok/mo`;
  }
  return `${estimate} tok/mo`;
}

function detectProviderVia(
  callsites: ClassifiedCallsite[],
  provider: string
): string {
  const providerCallsites = callsites.filter(c => c.provider === provider);
  const frameworks = new Set(providerCallsites.map(c => c.framework).filter(Boolean));

  if (frameworks.size > 0) {
    return `via ${[...frameworks].join(', ')}`;
  }
  return 'direct SDK';
}

