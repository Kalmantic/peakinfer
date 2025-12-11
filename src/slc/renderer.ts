/**
 * CLI Renderer Module — Terminal Output
 *
 * Responsibility (per Design Doc):
 * - 5 UX States: Zero, Loading, Error, Partial, Success
 * - Indentation-only hierarchy (no ASCII boxes)
 * - Lowercase preferred
 * - StackMap before Pricing (structure before impact)
 *
 * Design: Julie Zhou principles — clarity, invisible UI.
 */

import type { AnalysisResult, AnalysisError, ScanResult, StackMap, StackMapNode, PricingSummary, CallsiteCost, TechStack } from './types.js';

// =============================================================================
// FORMATTING HELPERS
// =============================================================================

/** Format currency with commas and decimals */
export function formatCurrency(amount: number): string {
  return '$' + amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Indentation helper */
const indent = (level: number): string => '  '.repeat(level);

// =============================================================================
// ZERO STATE — No callsites found
// =============================================================================

/**
 * Render the zero state (no callsites detected).
 * Per Design Doc: friendly, helpful, not alarming.
 */
export function renderZeroState(root: string): void {
  console.log('');
  console.log('peakinfer');
  console.log(indent(1) + root);
  console.log('');
  console.log(indent(1) + 'no llm callsites detected');
  console.log('');
  console.log(indent(1) + 'this could mean:');
  console.log(indent(2) + '• no ai/llm code in this directory');
  console.log(indent(2) + '• callsites use unsupported patterns');
  console.log(indent(2) + '• code is in unsupported languages');
  console.log('');
}

// =============================================================================
// LOADING STATE — In progress
// =============================================================================

/**
 * Render the loading state (analysis in progress).
 * Per Design Doc: narrated progress, show what's happening.
 * Uses carriage return for in-place updates (single line).
 */
export function renderLoadingState(root: string, message: string): void {
  // Clear line and write progress (TTY-aware)
  if (process.stdout.isTTY) {
    process.stdout.write(`\r\x1b[K  ${message}`);
  } else {
    console.log(`peakinfer ${root}: ${message}`);
  }
}

/**
 * Clear the loading state line.
 * Call before rendering final output.
 */
export function clearLoadingState(): void {
  if (process.stdout.isTTY) {
    process.stdout.write('\r\x1b[K');
  }
}

// =============================================================================
// ERROR STATE — Something went wrong
// =============================================================================

/**
 * Render the error state (analysis failed).
 * Per Design Doc: actionable, clear what to do next.
 */
export function renderErrorState(error: AnalysisError): void {
  console.log('');
  console.log('peakinfer error');
  console.log('');
  console.log(indent(1) + `[${error.code}] ${error.message}`);
  console.log('');
  console.log(indent(1) + 'suggestion:');
  console.log(indent(2) + error.suggestion);
  console.log('');
}

// =============================================================================
// PARTIAL STATE — Incomplete results
// =============================================================================

/**
 * Render the partial state (some results, some failures).
 * Per Design Doc: show what worked, warn about what didn't.
 */
export function renderPartialState(result: AnalysisResult): void {
  console.log('');
  console.log('peakinfer (partial results)');
  console.log('');

  if (result.warnings) {
    console.log(indent(1) + 'warning:');
    for (const w of result.warnings) {
      console.log(indent(2) + '• ' + w);
    }
    console.log('');
  }

  if (result.stackMap) {
    renderStackMapSummary(result.stackMap);
  }
}

// =============================================================================
// SUCCESS STATE — Full results
// =============================================================================

/**
 * Render the success state (complete analysis).
 * Per Design Doc: StackMap first, then Pricing.
 */
export function renderSuccessState(
  scan: ScanResult,
  stackMap: StackMap,
  pricing: PricingSummary,
  techStack?: TechStack,
  outputFiles: string[] = []
): void {
  console.log('');
  console.log('peakinfer');
  console.log(indent(1) + scan.root);
  console.log('');

  // Scan summary
  console.log(indent(1) + 'scanned:');
  console.log(indent(2) + `${scan.totalFiles} files, ${scan.totalLines} lines`);
  console.log(indent(2) + `languages: ${Object.keys(scan.languages).join(', ')}`);
  console.log('');

  // Tech Stack (full inference stack)
  if (techStack) {
    renderTechStack(techStack);
  }

  // StackMap (structure before impact)
  renderStackMapSummary(stackMap);
  renderStackMapTree(stackMap);

  // Pricing (impact after structure)
  renderPricingSummary(pricing);

  // Output files
  if (outputFiles.length > 0) {
    console.log(indent(1) + 'output files:');
    for (const file of outputFiles) {
      console.log(indent(2) + file);
    }
    console.log('');
  }

  // Next actions
  renderNextActions(pricing);
}

/**
 * Render next action suggestions.
 * Per Design Doc: actionable, show what to do next.
 */
function renderNextActions(pricing: PricingSummary): void {
  console.log(indent(1) + 'next steps:');

  // High-cost optimization suggestion
  if (pricing.estimatedRange.high > 100) {
    console.log(indent(2) + '• review optimization suggestions above to reduce costs');
  }

  // Most expensive model suggestion
  if (pricing.mostExpensiveModel) {
    console.log(indent(2) + `• evaluate if ${pricing.mostExpensiveModel} can be replaced with a cheaper model`);
  }

  // Always suggest running analysis periodically
  console.log(indent(2) + '• re-run after code changes to track impact');
  console.log(indent(2) + '• see output files for detailed data');
  console.log('');
}

// =============================================================================
// TECH STACK RENDERING
// =============================================================================

/**
 * Render tech stack from Application → Hardware.
 */
function renderTechStack(techStack: TechStack): void {
  const { application, serving, infrastructure, hardware } = techStack;

  // Check if any layer has content
  const hasApp = application.frameworks.length > 0 || application.sdks.length > 0 || application.patterns.length > 0;
  const hasServing = serving.runtimes.length > 0 || serving.gateways.length > 0 || serving.platforms.length > 0;
  const hasInfra = infrastructure.cloud.length > 0 || infrastructure.compute.length > 0 || infrastructure.orchestration.length > 0;
  const hasHardware = hardware.gpus.length > 0 || hardware.accelerators.length > 0;

  if (!hasApp && !hasServing && !hasInfra && !hasHardware) {
    return; // Skip if no tech stack detected
  }

  console.log(indent(1) + 'tech stack:');

  // Application Layer
  if (hasApp) {
    console.log(indent(2) + '┌─ application');
    if (application.frameworks.length > 0) {
      console.log(indent(2) + '│  frameworks: ' + application.frameworks.join(', '));
    }
    if (application.sdks.length > 0) {
      console.log(indent(2) + '│  sdks: ' + application.sdks.join(', '));
    }
    if (application.patterns.length > 0) {
      console.log(indent(2) + '│  patterns: ' + application.patterns.join(', '));
    }
  }

  // Serving Layer
  if (hasServing) {
    console.log(indent(2) + '├─ serving');
    if (serving.runtimes.length > 0) {
      console.log(indent(2) + '│  runtimes: ' + serving.runtimes.join(', '));
    }
    if (serving.gateways.length > 0) {
      console.log(indent(2) + '│  gateways: ' + serving.gateways.join(', '));
    }
    if (serving.platforms.length > 0) {
      console.log(indent(2) + '│  platforms: ' + serving.platforms.join(', '));
    }
  }

  // Infrastructure Layer
  if (hasInfra) {
    console.log(indent(2) + '├─ infrastructure');
    if (infrastructure.cloud.length > 0) {
      console.log(indent(2) + '│  cloud: ' + infrastructure.cloud.join(', '));
    }
    if (infrastructure.compute.length > 0) {
      console.log(indent(2) + '│  compute: ' + infrastructure.compute.join(', '));
    }
    if (infrastructure.orchestration.length > 0) {
      console.log(indent(2) + '│  orchestration: ' + infrastructure.orchestration.join(', '));
    }
  }

  // Hardware Layer
  if (hasHardware) {
    const estLabel = hardware.estimated ? ' (estimated)' : '';
    console.log(indent(2) + '└─ hardware' + estLabel);
    if (hardware.gpus.length > 0) {
      console.log(indent(2) + '   gpus: ' + hardware.gpus.join(', '));
    }
    if (hardware.accelerators.length > 0) {
      console.log(indent(2) + '   accelerators: ' + hardware.accelerators.join(', '));
    }
  } else {
    console.log(indent(2) + '└─ hardware: not detected');
  }

  console.log('');
}

// =============================================================================
// STACKMAP RENDERING
// =============================================================================

/**
 * Render StackMap summary.
 */
function renderStackMapSummary(stackMap: StackMap): void {
  const { summary } = stackMap;

  console.log(indent(1) + 'callsites:');
  console.log(indent(2) + `${summary.totalCallsites} found`);
  console.log(indent(2) + `providers: ${summary.providers.join(', ') || 'none'}`);
  console.log(indent(2) + `models: ${summary.models.join(', ') || 'none'}`);
  console.log('');
}

/**
 * Render StackMap tree with indentation.
 */
function renderStackMapTree(stackMap: StackMap): void {
  if (stackMap.tree.length === 0) return;

  console.log(indent(1) + 'stackmap:');
  for (const node of stackMap.tree) {
    renderNode(node, 2);
  }
  console.log('');
}

/**
 * Render a single node recursively.
 */
function renderNode(node: StackMapNode, level: number): void {
  if (node.type === 'directory') {
    console.log(indent(level) + node.name + '/');
    if (node.children) {
      for (const child of node.children) {
        renderNode(child, level + 1);
      }
    }
  } else {
    console.log(indent(level) + node.name);
    if (node.callsites) {
      for (const cs of node.callsites) {
        const model = cs.model || 'unknown';
        console.log(indent(level + 1) + `line ${cs.line}: ${cs.provider} ${model}`);
      }
    }
  }
}

// =============================================================================
// PRICING RENDERING
// =============================================================================

/**
 * Render pricing summary with hotspot suggestions.
 */
function renderPricingSummary(pricing: PricingSummary): void {
  console.log(indent(1) + 'estimated monthly cost:');
  console.log(indent(2) + `${formatCurrency(pricing.estimatedRange.low)} - ${formatCurrency(pricing.estimatedRange.high)}`);
  console.log('');

  if (pricing.byProvider.length > 0) {
    console.log(indent(1) + 'by provider:');
    for (const p of pricing.byProvider) {
      console.log(indent(2) + `${p.provider}: ${p.throughput.toLocaleString()} tps (${p.percentage}%)`);
    }
    console.log('');
  }

  if (pricing.mostExpensiveModel) {
    console.log(indent(1) + `most expensive: ${pricing.mostExpensiveModel}`);
    console.log('');
  }

  // Render hotspot suggestions (top 3 with suggestions)
  const hotspotsWithSuggestions = pricing.hotspots.filter((h: CallsiteCost) => h.suggestion).slice(0, 3);
  if (hotspotsWithSuggestions.length > 0) {
    console.log(indent(1) + 'optimization suggestions:');
    for (const h of hotspotsWithSuggestions) {
      console.log(indent(2) + `${h.file}:${h.line} (${h.model})`);
      console.log(indent(3) + `→ ${h.suggestion}`);
    }
    console.log('');
  }
}
