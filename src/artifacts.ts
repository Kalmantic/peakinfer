import { mkdirSync, writeFileSync, existsSync, readFileSync, symlinkSync, unlinkSync } from 'fs';
import { join, relative } from 'path';
import type { InferenceMap, Insight, JoinedOutput, RuntimeSummary } from './types.js';
import { generateRunId, getRunDir, createManifest, canResume, loadCachedArtifacts, type RunInputs, type RunManifest } from './runid.js';

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

export interface SaveOptions {
  runId?: string;
  inputs?: RunInputs;
  projectName?: string;  // For human-friendly report naming
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Convert project name to a URL/file-safe slug
 * Julie Zhou: Human-friendly naming for shareability
 */
function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')  // Replace non-alphanumeric with underscore
    .replace(/^_+|_+$/g, '')      // Trim leading/trailing underscores
    .substring(0, 50);            // Limit length
}

function ensureDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function writeJSON(filePath: string, data: unknown): void {
  writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

function updateLatestSymlink(baseDir: string, runId: string): void {
  const latestPath = join(baseDir, 'latest');
  const targetPath = join('runs', runId);

  try {
    // Remove existing symlink
    if (existsSync(latestPath)) {
      unlinkSync(latestPath);
    }
    // Create new symlink
    symlinkSync(targetPath, latestPath);
  } catch {
    // Symlinks may not work on all systems (e.g., Windows without admin)
    // Fallback: write a text file with the run ID
    writeFileSync(latestPath, runId, 'utf-8');
  }
}

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Save all analysis artifacts to .peakinfer/runs/<runId>/ directory
 * Also maintains backward compatibility with root-level artifacts
 */
export function saveArtifacts(
  data: ArtifactData,
  outputDir: string = OUTPUT_DIR,
  options: SaveOptions = {}
): string[] {
  const savedFiles: string[] = [];
  const artifactNames: string[] = [];

  // Determine run directory
  let runDir = outputDir;
  if (options.runId) {
    runDir = getRunDir(outputDir, options.runId);
  }

  ensureDir(runDir);

  // 1. InferenceMap - the core output
  if (data.inferenceMap) {
    const filePath = join(runDir, 'inferencemap.json');
    writeJSON(filePath, data.inferenceMap);
    savedFiles.push(filePath);
    artifactNames.push('inferencemap.json');
  }

  // 2. Insights - the findings
  if (data.insights) {
    const filePath = join(runDir, 'insights.json');
    writeJSON(filePath, data.insights);
    savedFiles.push(filePath);
    artifactNames.push('insights.json');
  }

  // 3. Joined data - static + runtime correlation
  if (data.joined) {
    const filePath = join(runDir, 'joined.json');
    writeJSON(filePath, data.joined);
    savedFiles.push(filePath);
    artifactNames.push('joined.json');
  }

  // 4. Runtime summary - aggregated metrics
  if (data.runtime) {
    const filePath = join(runDir, 'runtime.json');
    writeJSON(filePath, data.runtime);
    savedFiles.push(filePath);
    artifactNames.push('runtime.json');
  }

  // 5. HTML report - human-friendly naming for shareability
  // Julie Zhou: "Reports exist to enable sharing, not exploration"
  const reportFileName = options.projectName
    ? `${toSlug(options.projectName)}_peakinfer_report.html`
    : 'report.html';

  if (data.html) {
    const filePath = join(runDir, reportFileName);
    writeFileSync(filePath, data.html, 'utf-8');
    savedFiles.push(filePath);
    artifactNames.push(reportFileName);
  }

  // 6. Save manifest if runId provided
  if (options.runId && options.inputs) {
    const manifest = createManifest(options.runId, options.inputs, artifactNames, 'complete');
    const manifestPath = join(runDir, 'manifest.json');
    writeJSON(manifestPath, manifest);

    // Update latest symlink
    updateLatestSymlink(outputDir, options.runId);
  }

  // 7. Also save to root level for backward compatibility
  if (options.runId && runDir !== outputDir) {
    ensureDir(outputDir);
    if (data.inferenceMap) {
      writeJSON(join(outputDir, 'inferencemap.json'), data.inferenceMap);
    }
    if (data.insights) {
      writeJSON(join(outputDir, 'insights.json'), data.insights);
    }
    if (data.joined) {
      writeJSON(join(outputDir, 'joined.json'), data.joined);
    }
    if (data.runtime) {
      writeJSON(join(outputDir, 'runtime.json'), data.runtime);
    }
    if (data.html) {
      writeFileSync(join(outputDir, reportFileName), data.html, 'utf-8');
    }
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

/**
 * Check if a run can be resumed with cached artifacts
 */
export function checkResumable(inputs: RunInputs, outputDir: string = OUTPUT_DIR): {
  canResume: boolean;
  runId: string;
  runDir: string;
} {
  const runId = generateRunId(inputs);
  const runDir = getRunDir(outputDir, runId);

  return {
    canResume: canResume(runDir, inputs),
    runId,
    runDir,
  };
}

/**
 * Load artifacts from a previous run
 */
export function loadArtifacts(runDir: string): ArtifactData {
  return loadCachedArtifacts(runDir);
}

/**
 * Get a new run ID for given inputs
 */
export { generateRunId } from './runid.js';
