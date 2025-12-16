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

const VERSION = 'v0.95';
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
 * Render the full success state per DD v1.3 Section 6.1
 *
 * Output order is NON-NEGOTIABLE (DD v1.3):
 * 1. Header
 * 2. Progress (handled by progress manager)
 * 3. FINDINGS (insights - primary value) ← VALUE FIRST
 * 4. SCOPE (what was analyzed - trust context)
 * 5. Runtime (if events provided)
 * 6. Drift (if combined analysis)
 * 7. Artifacts saved + next steps
 *
 * This "value-first" ordering improves perceived usefulness.
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
  // 1. HEADER — Brief, factual
  console.log(`
PeakInfer ${VERSION}
`);

  // 3. FINDINGS — The value, shown first per DD v1.3 "value-first" ordering
  // Findings come BEFORE scope so users see insights immediately
  console.log(`FINDINGS`);
  console.log(`────────────────────────────────────────────────────────────────────────`);
  
  // Quick summary of what was found
  const uniqueModels = [...new Set(callsites.map(c => c.model).filter(Boolean))];
  const uniqueProviders = [...new Set(callsites.map(c => c.provider).filter(Boolean))];
  
  console.log(`  ${callsites.length} inference points detected`);
  console.log(`  ${uniqueProviders.length} providers: ${uniqueProviders.slice(0, 4).join(', ')}${uniqueProviders.length > 4 ? '...' : ''}`);
  console.log(`  ${uniqueModels.length} models: ${uniqueModels.slice(0, 3).join(', ')}${uniqueModels.length > 3 ? '...' : ''}`);
  console.log('');

  // HOTSPOTS — Show these as primary findings
  if (pricing.hotspots && pricing.hotspots.length > 0) {
    console.log(`  Cost hotspots:`);
    for (const h of pricing.hotspots.slice(0, 3)) {
      const costRange = formatCurrencyRange(h.estimatedMonthlyLow, h.estimatedMonthlyHigh);
      console.log(`    ⚠ ${h.file}:${h.line} — ${h.model || '(runtime-configured)'} — ${costRange}/mo`);
      if (h.suggestion) {
        console.log(`      └─ ${h.suggestion}`);
      }
    }
    console.log('');
  }

  // Patterns detected as findings
  if (patterns) {
    const detectedPatterns: string[] = [];
    if (patterns.streaming?.detected) detectedPatterns.push('streaming');
    if (patterns.batching?.detected) detectedPatterns.push('batching');
    if (patterns.retry?.detected) detectedPatterns.push('retry');
    if (patterns.caching?.detected) detectedPatterns.push('caching');
    if (patterns.routing?.detected) detectedPatterns.push('routing');
    if (patterns.fallback?.detected) detectedPatterns.push('fallback');
    
    if (detectedPatterns.length > 0) {
      console.log(`  Patterns: ${detectedPatterns.join(', ')}`);
    } else {
      console.log(`  Patterns: none detected (consider adding retry, batching, caching)`);
    }
    console.log('');
  }

  // Estimated cost summary
  console.log(`  Estimated monthly: ${formatCurrencyRange(pricing.estimatedRange.low, pricing.estimatedRange.high)}`);
  console.log('');

  // 4. SCOPE — Trust context (after findings)
  console.log(`SCOPE`);
  console.log(`────────────────────────────────────────────────────────────────────────`);
  console.log(`  Files scanned: ${scan.totalFiles}`);
  console.log(`  Lines of code: ${scan.totalLines.toLocaleString()}`);
  console.log(`  Languages: ${Object.keys(scan.languages).join(', ') || 'unknown'}`);
  console.log(`  Root: ${scan.root}`);
  console.log('');

  // Detailed STACKMAP box (for those who want it)
  renderStackMapBox(callsites, stackMap, techStack, patterns);

  // Detailed PRICING box
  renderPricingBox(pricing);

  // 7. Artifacts saved + next steps
  console.log(`SAVED`);
  console.log(`────────────────────────────────────────────────────────────────────────`);
  for (const file of outputFiles) {
    console.log(`  ${file}`);
  }
  console.log('');

  console.log(`NEXT`);
  console.log(`────────────────────────────────────────────────────────────────────────`);
  console.log(`  peakinfer analyze . --events <logs.jsonl>   compare code vs runtime`);
  console.log(`  peakinfer pricing --detailed                GPU-level cost modeling`);
  console.log(`  peakinfer diff old.json new.json            track changes over time`);
  console.log('');
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
  const FILE_COL_WIDTH = 45; // Fixed width for file:line column
  for (let i = 0; i < topCallsites.length; i++) {
    const cs = topCallsites[i];
    const prefix = i === topCallsites.length - 1 && callsites.length <= 5 ? '└' : '├';
    const model = cs.model || '(runtime-configured)';
    // Truncate long file paths and pad for alignment
    const fileLoc = `${cs.file}:${cs.line}`.slice(0, FILE_COL_WIDTH - 1);
    const paddedLoc = fileLoc.padEnd(FILE_COL_WIDTH);
    console.log(boxRow(`   ${prefix}──► ${paddedLoc} ${model}`));
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
  const MODEL_COL_WIDTH = 32; // Fixed width for model name column
  for (let i = 0; i < models.length; i++) {
    const [model, count] = models[i];
    const prefix = i === models.length - 1 ? '└' : '├';
    const estTokens = estimateMonthlyTokens(count);
    // Truncate long model names and pad for alignment
    const modelName = (model || '(runtime-configured)').slice(0, MODEL_COL_WIDTH - 1);
    const paddedModel = modelName.padEnd(MODEL_COL_WIDTH);
    const countStr = `${count} calls`.padEnd(10);
    console.log(boxRow(`   ${prefix}──► ${paddedModel} ${countStr} ~${estTokens}`));
  }

  console.log(boxEmpty());
  console.log(boxSep());
  console.log(boxEmpty());

  // VENDORS / PROVIDERS section
  const providerCounts = countByField(callsites, 'provider');
  console.log(boxRow(`VENDORS / PROVIDERS (${Object.keys(providerCounts).length})`));
  console.log(boxRow('   │'));

  const providers = Object.entries(providerCounts).sort((a, b) => b[1] - a[1]);
  const PROVIDER_COL_WIDTH = 20; // Fixed width for provider name column
  for (let i = 0; i < providers.length; i++) {
    const [provider, count] = providers[i];
    const prefix = i === providers.length - 1 ? '└' : '├';
    const via = detectProviderVia(callsites, provider);
    const providerName = `${provider || 'other'} API`.slice(0, PROVIDER_COL_WIDTH - 1);
    const paddedProvider = providerName.padEnd(PROVIDER_COL_WIDTH);
    const countStr = `${count} calls`.padEnd(10);
    console.log(boxRow(`   ${prefix}──► ${paddedProvider} ${countStr} ${via}`));
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

  // PATTERNS DETECTED section
  if (patterns) {
    console.log(boxRow('PATTERNS DETECTED'));
    console.log(boxRow('   │'));

    const patternList = [
      { name: 'Retry logic', detected: patterns.retry?.detected, instance: patterns.retry?.instances?.[0] },
      { name: 'Batching', detected: patterns.batching?.detected, instance: patterns.batching?.instances?.[0] },
      { name: 'Streaming', detected: patterns.streaming?.detected, instance: patterns.streaming?.instances?.[0] },
      { name: 'Caching', detected: patterns.caching?.detected, instance: patterns.caching?.instances?.[0] },
      { name: 'Router / model switching', detected: patterns.routing?.detected, instance: patterns.routing?.instances?.[0] },
      { name: 'Fallback chain', detected: patterns.fallback?.detected, instance: patterns.fallback?.instances?.[0] },
    ];

    for (let i = 0; i < patternList.length; i++) {
      const p = patternList[i];
      const prefix = i === patternList.length - 1 ? '└' : '├';
      const check = p.detected ? '✓' : '✗';
      const location = p.detected && p.instance ? `  ${p.instance.file}:${p.instance.line}` : '  not detected';
      console.log(boxRow(`   ${prefix}──► ${p.name.padEnd(22)} ${check}${location}`));
    }

    console.log(boxEmpty());
  }

  console.log(boxBottom());
  console.log('');
}

// =============================================================================
// PRICING BOX
// =============================================================================

function renderPricingBox(pricing: PricingSummary): void {
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
      const costStr = formatCurrency(p.cost).padStart(10);
      const pctStr = `(${formatPercent(p.percentage)})`.padStart(6);
      console.log(boxRow(`   ├──► ${p.provider.padEnd(15)} ${costStr}    ${pctStr}`));
    }
    console.log(boxEmpty());
  }

  // By model
  if (pricing.byModel.length > 0) {
    console.log(boxRow('By model:'));
    for (const m of pricing.byModel.slice(0, 4)) {
      const costStr = formatCurrency(m.cost).padStart(10);
      console.log(boxRow(`   ├──► ${(m.model || 'unknown').padEnd(15)} ${costStr}`));
    }
    console.log(boxEmpty());
  }

  // Pricing deltas (placeholder - would need historical data)
  console.log(boxRow('Pricing deltas (since last sync):'));
  console.log(boxRow('   └──► Prices current as of this analysis'));
  console.log(boxEmpty());

  console.log(boxSep());
  console.log(boxEmpty());

  // ALTERNATIVE PRICING section
  console.log(boxRow('ALTERNATIVE PRICING (same models, different providers)'));
  console.log(boxRow('   │'));
  console.log(boxRow('   ├──► Run `peakinfer pricing --detailed` for live model pricing'));
  console.log(boxRow('   └──► Use `peakinfer diff old.json new.json` to track changes'));
  console.log(boxEmpty());

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

  for (const h of hotspots.slice(0, 3)) {
    const costRange = formatCurrencyRange(h.estimatedMonthlyLow, h.estimatedMonthlyHigh);
    console.log(boxRow(`⚠  ${h.file}:${h.line}`));
    console.log(boxRow(`   └─ ${h.model || '(runtime-configured)'}, ${costRange}/mo`));

    if (h.suggestion) {
      console.log(boxRow(`   └─ Suggestion: ${h.suggestion}`));
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
    const value = cs[field] || (field === 'model' ? '(runtime-configured)' : 'other');
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

