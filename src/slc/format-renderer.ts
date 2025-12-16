/**
 * Format Detection UX Renderer - PeakInfer DD v1.3
 * 
 * Renders format detection states per the Design Document:
 * - Auto-detected (invisible success)
 * - Agent-normalized (visible but confident)
 * - Low confidence (warning)
 * - Unknown format (actionable error)
 */

import type { FormatDetection, ParseResult } from './format/schemas.js';

// =============================================================================
// FORMAT DETECTION STATE RENDERING
// =============================================================================

/**
 * Render format detection result.
 * Per DD v1.3, format detection has its own state machine.
 */
export function renderFormatDetectionState(
  result: ParseResult,
  fileName: string
): void {
  const { format, stats, confidence } = result;
  
  if (format.detected === 'unknown') {
    renderUnknownFormat(format, fileName);
  } else if (confidence < 0.6) {
    renderLowConfidence(format, fileName, stats);
  } else if (format.requiresAgent) {
    renderAgentNormalized(format, fileName, stats);
  } else {
    renderAutoDetected(format, fileName, stats);
  }
}

/**
 * Auto-detected format (invisible success)
 * User shouldn't even notice format was detected.
 */
function renderAutoDetected(
  format: FormatDetection,
  fileName: string,
  stats: ParseResult['stats']
): void {
  console.log(`Runtime (from ${fileName})`);
  console.log(`  Format: ${formatTypeName(format.detected)}`);
  console.log(`  Records: ${stats.parsedRecords.toLocaleString()}`);
  console.log('');
}

/**
 * Agent-normalized format (visible but confident)
 * User knows agent was involved, but confidence is high.
 */
function renderAgentNormalized(
  format: FormatDetection,
  fileName: string,
  stats: ParseResult['stats']
): void {
  const confLabel = format.confidence >= 0.9 ? 'high' : 
                    format.confidence >= 0.7 ? 'medium' : 'low';
  
  console.log(`Runtime (from ${fileName})`);
  console.log(`  Format: ${formatTypeName(format.detected)} (agent-inferred)`);
  console.log(`  Confidence: ${confLabel}`);
  console.log(`  Records: ${stats.parsedRecords.toLocaleString()}`);
  
  if (format.evidence.length > 0 && format.confidence < 0.9) {
    console.log('');
    console.log('  Detection evidence:');
    for (const e of format.evidence.slice(0, 3)) {
      console.log(`    - ${e}`);
    }
  }
  
  console.log('');
}

/**
 * Low confidence (warning, not error)
 * User is warned but can proceed.
 */
function renderLowConfidence(
  format: FormatDetection,
  fileName: string,
  stats: ParseResult['stats']
): void {
  console.log(`Runtime (from ${fileName})`);
  console.log(`  Format: ${formatTypeName(format.detected)} (agent-inferred)`);
  console.log(`  Confidence: low`);
  console.log('');
  console.log('  WARN: Low confidence format detection');
  
  if (stats.errors.length > 0) {
    console.log('');
    console.log('  Issues detected:');
    for (const err of stats.errors.slice(0, 3)) {
      console.log(`    - ${err}`);
    }
  }
  
  console.log('');
  console.log('  Results may be incomplete.');
  console.log(`  To provide mapping hints: peakinfer analyze ${fileName} --map field=source`);
  console.log('');
}

/**
 * Unknown format (actionable error)
 * User must take action to proceed.
 */
function renderUnknownFormat(
  format: FormatDetection,
  fileName: string
): void {
  console.log(`Error: Could not determine format for: ${fileName}`);
  console.log('');
  console.log('Tried:');
  console.log('  • JSON parsing: failed');
  console.log('  • CSV parsing: failed');
  console.log('  • Agent inference: failed (unrecognized structure)');
  console.log('');
  console.log('Supported formats:');
  console.log('  • JSONL, JSON array, CSV, TSV');
  console.log('  • OpenTelemetry, Jaeger, Zipkin');
  console.log('  • LangSmith, Helicone, W&B exports');
  console.log('');
  console.log('To manually specify format:');
  console.log(`  peakinfer analyze ${fileName} --format jsonl`);
  console.log('');
}

/**
 * Render combined mode with codebase-aware normalization
 */
export function renderCodebaseAwareFormat(
  format: FormatDetection,
  fileName: string,
  stats: ParseResult['stats'],
  codebaseHints: { loggingPatterns: number; variableNames: number }
): void {
  const confLabel = format.confidence >= 0.9 ? 'high' : 
                    format.confidence >= 0.7 ? 'medium' : 'low';
  
  console.log(`Runtime (from ${fileName})`);
  console.log(`  Format: ${formatTypeName(format.detected)} (agent-inferred with codebase context)`);
  console.log(`  Confidence: ${confLabel}`);
  console.log(`  Records: ${stats.parsedRecords.toLocaleString()}`);
  console.log('');
  console.log('  Codebase hints used:');
  if (codebaseHints.loggingPatterns > 0) {
    console.log(`    - Found ${codebaseHints.loggingPatterns} logging patterns in codebase`);
  }
  if (codebaseHints.variableNames > 0) {
    console.log(`    - Matched ${codebaseHints.variableNames} variable names`);
  }
  console.log('');
}

// =============================================================================
// PROGRESS RENDERING
// =============================================================================

/**
 * Render format detection progress
 */
export function renderFormatDetectionProgress(step: string): void {
  const steps: Record<string, string> = {
    'detecting': '1/4 Detecting format...',
    'parsing': '2/4 Parsing events...',
    'aggregating': '3/4 Aggregating metrics...',
    'building': '4/4 Building summary...',
  };
  
  const agentSteps: Record<string, string> = {
    'detecting': '1/5 Detecting format...',
    'analyzing': '2/5 Analyzing structure (agent)...',
    'mapping': '3/5 Mapping fields (agent)...',
    'parsing': '4/5 Parsing events...',
    'building': '5/5 Building summary...',
  };
  
  const combinedSteps: Record<string, string> = {
    'scanning': '1/6 Scanning files...',
    'detecting-inference': '2/6 Detecting inference points...',
    'detecting-format': '3/6 Detecting log format...',
    'mapping': '4/6 Mapping fields (using codebase context)...',
    'parsing': '5/6 Parsing events...',
    'joining': '6/6 Joining static + runtime...',
  };
  
  console.log(`  ${steps[step] || agentSteps[step] || combinedSteps[step] || step}`);
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Get human-readable format type name
 */
function formatTypeName(type: string): string {
  const names: Record<string, string> = {
    jsonl: 'JSONL',
    json_array: 'JSON Array',
    csv: 'CSV',
    tsv: 'TSV',
    otel: 'OpenTelemetry',
    jaeger: 'Jaeger',
    zipkin: 'Zipkin',
    langsmith: 'LangSmith',
    helicone: 'Helicone',
    wandb: 'Weights & Biases',
    litellm: 'LiteLLM',
    portkey: 'Portkey',
    custom: 'Custom',
    unknown: 'Unknown',
  };
  
  return names[type] || type.toUpperCase();
}

// =============================================================================
// EXPORTS
// =============================================================================

export { formatTypeName };
