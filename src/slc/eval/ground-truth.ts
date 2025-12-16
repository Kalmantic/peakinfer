/**
 * Ground Truth Framework - PeakInfer EVAL-FRAMEWORK-DESIGN
 * 
 * Defines schemas and utilities for human-labeled ground truth data
 * used to evaluate PeakInfer's correctness.
 * 
 * Per EVAL-FRAMEWORK-DESIGN Section 2:
 * - Callsite ground truth for static analysis
 * - Format detection ground truth for runtime analysis
 * - Drift ground truth for combined analysis
 */

import * as fs from 'fs';

// =============================================================================
// CALLSITE GROUND TRUTH (Static Analysis)
// =============================================================================

/**
 * Ground truth for a single callsite.
 * Human-labeled with expected provider, model, and classification.
 */
export interface CallsiteGroundTruth {
  /** Unique identifier for the callsite */
  id: string;
  /** File path relative to fixture root */
  file: string;
  /** Line number (1-based) */
  line: number;
  /** Column number (1-based) */
  column?: number;
  /** Expected provider (openai, anthropic, etc.) */
  provider: string;
  /** Expected model (gpt-4, claude-3, etc.) or null if runtime-configured */
  model: string | null;
  /** Expected framework (langchain, llamaindex, direct_sdk) */
  framework?: string;
  /** Whether this is a true LLM inference call */
  is_inference: boolean;
  /** Classification category for analysis */
  category: 'direct_sdk' | 'framework' | 'http' | 'self_hosted' | 'complex';
  /** Optional notes for labelers */
  notes?: string;
}

/**
 * Complete ground truth file for a fixture.
 */
export interface CallsiteGroundTruthFile {
  /** Fixture metadata */
  fixture: {
    name: string;
    category: string;
    version: string;
    labeled_by: string;
    labeled_at: string;
  };
  /** All expected callsites */
  callsites: CallsiteGroundTruth[];
  /** Expected count for quick validation */
  expected_count: number;
}

// =============================================================================
// FORMAT DETECTION GROUND TRUTH (Runtime Analysis)
// =============================================================================

/**
 * Ground truth for format detection.
 */
export interface FormatGroundTruth {
  /** File name */
  file: string;
  /** Expected format type */
  format_type: 'jsonl' | 'json_array' | 'csv' | 'otel' | 'jaeger' | 'zipkin' | 
               'langsmith' | 'helicone' | 'wandb' | 'litellm' | 'portkey' | 'custom';
  /** Expected field mappings (source -> target) */
  field_mappings: Record<string, string>;
  /** Expected event count */
  expected_event_count: number;
  /** Sample events for validation */
  sample_events: Array<{
    line_number: number;
    expected: {
      provider?: string;
      model?: string;
      input_tokens?: number;
      output_tokens?: number;
      latency_ms?: number;
    };
  }>;
  /** Difficulty rating */
  difficulty: 'easy' | 'medium' | 'hard';
  /** Optional notes */
  notes?: string;
}

/**
 * Complete format detection ground truth file.
 */
export interface FormatGroundTruthFile {
  /** Fixture metadata */
  fixture: {
    name: string;
    category: string;
    version: string;
    labeled_by: string;
    labeled_at: string;
  };
  /** Format detection expectations */
  detection: FormatGroundTruth;
}

// =============================================================================
// DRIFT GROUND TRUTH (Combined Analysis)
// =============================================================================

/**
 * Ground truth for drift detection.
 */
export interface DriftGroundTruth {
  /** Static callsite ID */
  callsite_id: string;
  /** Expected drift type */
  drift_type: 'none' | 'code_only' | 'runtime_only' | 'model_mismatch' | 'provider_mismatch';
  /** Expected values if mismatch */
  code_value?: {
    provider?: string;
    model?: string;
  };
  runtime_value?: {
    provider?: string;
    model?: string;
  };
  /** Expected severity */
  severity?: 'low' | 'medium' | 'high' | 'critical';
  /** Notes */
  notes?: string;
}

/**
 * Complete drift ground truth file.
 */
export interface DriftGroundTruthFile {
  /** Fixture metadata */
  fixture: {
    name: string;
    category: string;
    version: string;
    labeled_by: string;
    labeled_at: string;
  };
  /** Expected drifts */
  drifts: DriftGroundTruth[];
  /** Expected totals */
  expected: {
    total_callsites: number;
    matched: number;
    code_only: number;
    runtime_only: number;
    mismatches: number;
  };
}

// =============================================================================
// GROUND TRUTH LOADING
// =============================================================================

/**
 * Load callsite ground truth from JSON file.
 */
export function loadCallsiteGroundTruth(filePath: string): CallsiteGroundTruthFile {
  const content = fs.readFileSync(filePath, 'utf-8');
  const data = JSON.parse(content) as CallsiteGroundTruthFile;
  
  // Validate structure
  if (!data.fixture || !data.callsites || !Array.isArray(data.callsites)) {
    throw new Error(`Invalid ground truth file: ${filePath}`);
  }
  
  // Validate callsite count
  if (data.callsites.length !== data.expected_count) {
    throw new Error(
      `Ground truth count mismatch: expected ${data.expected_count}, found ${data.callsites.length}`
    );
  }
  
  return data;
}

/**
 * Load format detection ground truth from JSON file.
 */
export function loadFormatGroundTruth(filePath: string): FormatGroundTruthFile {
  const content = fs.readFileSync(filePath, 'utf-8');
  const data = JSON.parse(content) as FormatGroundTruthFile;
  
  // Validate structure
  if (!data.fixture || !data.detection) {
    throw new Error(`Invalid format ground truth file: ${filePath}`);
  }
  
  return data;
}

/**
 * Load drift ground truth from JSON file.
 */
export function loadDriftGroundTruth(filePath: string): DriftGroundTruthFile {
  const content = fs.readFileSync(filePath, 'utf-8');
  const data = JSON.parse(content) as DriftGroundTruthFile;
  
  // Validate structure
  if (!data.fixture || !data.drifts || !Array.isArray(data.drifts)) {
    throw new Error(`Invalid drift ground truth file: ${filePath}`);
  }
  
  return data;
}

// =============================================================================
// GROUND TRUTH VALIDATION HELPERS
// =============================================================================

/**
 * Check if a predicted callsite matches ground truth.
 */
export function matchesCallsiteGroundTruth(
  predicted: { file: string; line: number; provider?: string; model?: string },
  groundTruth: CallsiteGroundTruth,
  options: { strictModel?: boolean } = {}
): boolean {
  // File and line must match exactly
  if (predicted.file !== groundTruth.file || predicted.line !== groundTruth.line) {
    return false;
  }
  
  // Provider must match (case-insensitive)
  if (predicted.provider?.toLowerCase() !== groundTruth.provider.toLowerCase()) {
    return false;
  }
  
  // Model match depends on options
  if (options.strictModel && groundTruth.model !== null) {
    if (predicted.model?.toLowerCase() !== groundTruth.model.toLowerCase()) {
      return false;
    }
  }
  
  return true;
}

/**
 * Check if format detection matches ground truth.
 */
export function matchesFormatGroundTruth(
  predicted: { format: string; confidence: number },
  groundTruth: FormatGroundTruth
): boolean {
  return predicted.format === groundTruth.format_type;
}

/**
 * Check if field mappings match ground truth.
 */
export function matchesFieldMappings(
  predicted: Record<string, string>,
  groundTruth: Record<string, string>
): { matches: boolean; mismatches: string[] } {
  const mismatches: string[] = [];
  
  for (const [target, expected] of Object.entries(groundTruth)) {
    const actual = predicted[target];
    if (actual !== expected) {
      mismatches.push(`${target}: expected '${expected}', got '${actual || 'undefined'}'`);
    }
  }
  
  return {
    matches: mismatches.length === 0,
    mismatches,
  };
}

/**
 * Check if drift detection matches ground truth.
 */
export function matchesDriftGroundTruth(
  predicted: { callsite_id: string; drift_type: string },
  groundTruth: DriftGroundTruth
): boolean {
  return predicted.callsite_id === groundTruth.callsite_id &&
         predicted.drift_type === groundTruth.drift_type;
}

// =============================================================================
// FIXTURE DISCOVERY
// =============================================================================

/**
 * Discover all ground truth files in a directory.
 */
export function discoverGroundTruthFiles(
  fixturesDir: string,
  type: 'callsite' | 'format' | 'drift'
): string[] {
  const suffix = type === 'callsite' ? '.ground-truth.json' :
                 type === 'format' ? '.format-truth.json' :
                 '.drift-truth.json';
  
  const files: string[] = [];
  
  const walk = (dir: string) => {
    if (!fs.existsSync(dir)) return;
    
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = `${dir}/${entry.name}`;
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.name.endsWith(suffix)) {
        files.push(fullPath);
      }
    }
  };
  
  walk(fixturesDir);
  return files;
}

