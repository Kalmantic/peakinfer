import { mkdirSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import type { InferenceMap, Insight, JoinedOutput, RuntimeSummary } from './types.js';

// =============================================================================
// CONSTANTS
// =============================================================================

const OUTPUT_DIR = '.peakinfer';

// =============================================================================
// TYPES
// =============================================================================

export interface ArtifactData {
  inferenceMap?: InferenceMap;
  insights?: Insight[];
  joined?: JoinedOutput;
  runtime?: RuntimeSummary;
  html?: string;
}

// =============================================================================
// HELPERS
// =============================================================================

function ensureDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function writeJSON(filePath: string, data: unknown): void {
  writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Save all analysis artifacts to .peakinfer/ directory
 */
export function saveArtifacts(data: ArtifactData, outputDir: string = OUTPUT_DIR): string[] {
  const savedFiles: string[] = [];

  ensureDir(outputDir);

  // 1. InferenceMap - the core output
  if (data.inferenceMap) {
    const filePath = join(outputDir, 'inferencemap.json');
    writeJSON(filePath, data.inferenceMap);
    savedFiles.push(filePath);
  }

  // 2. Insights - the findings
  if (data.insights) {
    const filePath = join(outputDir, 'insights.json');
    writeJSON(filePath, data.insights);
    savedFiles.push(filePath);
  }

  // 3. Joined data - static + runtime correlation
  if (data.joined) {
    const filePath = join(outputDir, 'joined.json');
    writeJSON(filePath, data.joined);
    savedFiles.push(filePath);
  }

  // 4. Runtime summary - aggregated metrics
  if (data.runtime) {
    const filePath = join(outputDir, 'runtime.json');
    writeJSON(filePath, data.runtime);
    savedFiles.push(filePath);
  }

  // 5. HTML report
  if (data.html) {
    const filePath = join(outputDir, 'report.html');
    writeFileSync(filePath, data.html, 'utf-8');
    savedFiles.push(filePath);
  }

  return savedFiles;
}

/**
 * Get the output directory path
 */
export function getOutputDir(): string {
  return OUTPUT_DIR;
}

/**
 * Check if artifacts exist from a previous run
 */
export function artifactsExist(outputDir: string = OUTPUT_DIR): boolean {
  return existsSync(join(outputDir, 'inferencemap.json'));
}
