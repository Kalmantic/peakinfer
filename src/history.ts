/**
 * History Storage Module (v1.5)
 *
 * Enables persistent storage of analysis runs for:
 * - Historical comparison (Feature 2)
 * - Deploy-time prediction (Feature 3)
 *
 * Directory structure:
 *   .peakinfer/
 *   └── history/
 *       ├── index.json       # Global index of all runs
 *       └── <runId>/         # Individual run storage
 *           ├── manifest.json
 *           ├── inference-map.json
 *           └── analysis.json
 */

import { createHash, randomUUID } from 'crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, rmSync } from 'fs';
import { join, resolve } from 'path';
import type {
  HistoryManifest,
  HistoryIndex,
  AnalysisType,
  InferenceMap,
  Insight,
  JoinedOutput,
  RuntimeSummary,
} from './types.js';
import { VERSION } from './version.js';

// =============================================================================
// CONSTANTS
// =============================================================================

const HISTORY_DIR = '.peakinfer/history';
const INDEX_FILE = 'index.json';
const HISTORY_VERSION = '1.0';

// =============================================================================
// TYPES
// =============================================================================

export interface AnalysisData {
  inferenceMap?: InferenceMap;
  insights?: Insight[];
  joined?: JoinedOutput;
  runtime?: RuntimeSummary;
}

export interface SaveRunOptions {
  path: string;
  analysisType: AnalysisType;
  data: AnalysisData;
  durationMs?: number;
  htmlPath?: string;
  pdfPath?: string;
}

export interface LoadedRun {
  manifest: HistoryManifest;
  data: AnalysisData;
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Get the history directory path (relative to cwd or specified base)
 */
export function getHistoryDir(baseDir: string = '.'): string {
  return join(baseDir, HISTORY_DIR);
}

/**
 * Create a deterministic hash from a normalized path.
 * Used for efficient lookup of runs for a specific project.
 */
export function hashPath(path: string): string {
  const normalized = resolve(path).toLowerCase();
  return createHash('sha256').update(normalized).digest('hex').slice(0, 12);
}

/**
 * Generate a unique run ID (timestamp-based for chronological ordering)
 */
function generateHistoryRunId(): string {
  const timestamp = Date.now().toString(36); // Base36 timestamp
  const random = randomUUID().slice(0, 8);   // Short random suffix
  return `${timestamp}-${random}`;
}

/**
 * Ensure directory exists
 */
function ensureDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

/**
 * Write JSON file with pretty printing
 */
function writeJSON(filePath: string, data: unknown): void {
  writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

/**
 * Read JSON file safely
 */
function readJSON<T>(filePath: string): T | null {
  try {
    if (!existsSync(filePath)) return null;
    const content = readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

// =============================================================================
// INDEX MANAGEMENT
// =============================================================================

/**
 * Load the history index
 */
function loadIndex(historyDir: string): HistoryIndex {
  const indexPath = join(historyDir, INDEX_FILE);
  const existing = readJSON<HistoryIndex>(indexPath);

  if (existing) {
    return existing;
  }

  // Return empty index
  return {
    version: HISTORY_VERSION,
    lastUpdated: new Date().toISOString(),
    runs: [],
  };
}

/**
 * Save the history index
 */
function saveIndex(historyDir: string, index: HistoryIndex): void {
  ensureDir(historyDir);
  const indexPath = join(historyDir, INDEX_FILE);
  index.lastUpdated = new Date().toISOString();
  writeJSON(indexPath, index);
}

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Save an analysis run to history.
 * Returns the run ID for reference.
 */
export function saveRun(options: SaveRunOptions, baseDir: string = '.'): string {
  const historyDir = getHistoryDir(baseDir);
  const runId = generateHistoryRunId();
  const runDir = join(historyDir, runId);
  const pathHash = hashPath(options.path);

  ensureDir(runDir);

  // Calculate summary metrics
  const inferencePointCount = options.data.inferenceMap?.callsites?.length ?? 0;
  const eventCount = options.data.runtime?.totalEvents;
  const driftCount = options.data.joined?.drift?.length;
  const insightCount = options.data.insights?.length;

  // Track saved artifacts
  const artifacts: HistoryManifest['artifacts'] = {};

  // Save inference map
  if (options.data.inferenceMap) {
    const fileName = 'inference-map.json';
    writeJSON(join(runDir, fileName), options.data.inferenceMap);
    artifacts.inferenceMap = fileName;
  }

  // Save full analysis data
  const analysisFileName = 'analysis.json';
  writeJSON(join(runDir, analysisFileName), options.data);
  artifacts.analysis = analysisFileName;

  // Record report paths if provided
  if (options.htmlPath) {
    artifacts.html = options.htmlPath;
  }
  if (options.pdfPath) {
    artifacts.pdf = options.pdfPath;
  }

  // Create manifest
  const manifest: HistoryManifest = {
    runId,
    timestamp: new Date().toISOString(),
    path: resolve(options.path),
    pathHash,
    analysisType: options.analysisType,
    version: VERSION,
    inferencePointCount,
    eventCount,
    driftCount,
    insightCount,
    durationMs: options.durationMs,
    artifacts,
  };

  // Save manifest
  writeJSON(join(runDir, 'manifest.json'), manifest);

  // Update index
  const index = loadIndex(historyDir);
  index.runs.push({
    runId,
    timestamp: manifest.timestamp,
    pathHash,
    analysisType: options.analysisType,
    inferencePointCount,
  });
  saveIndex(historyDir, index);

  return runId;
}

/**
 * Load a specific run by ID.
 */
export function loadRun(runId: string, baseDir: string = '.'): LoadedRun | null {
  const historyDir = getHistoryDir(baseDir);
  const runDir = join(historyDir, runId);

  // Load manifest
  const manifest = readJSON<HistoryManifest>(join(runDir, 'manifest.json'));
  if (!manifest) {
    return null;
  }

  // Load analysis data
  const data = readJSON<AnalysisData>(join(runDir, 'analysis.json')) ?? {};

  return { manifest, data };
}

/**
 * List all runs for a specific path (or all runs if no path specified).
 * Returns runs sorted by timestamp (most recent first).
 */
export function listRuns(path?: string, baseDir: string = '.'): HistoryManifest[] {
  const historyDir = getHistoryDir(baseDir);
  const index = loadIndex(historyDir);

  // Filter by path hash if specified
  const pathHash = path ? hashPath(path) : null;
  const filteredRuns = pathHash
    ? index.runs.filter(r => r.pathHash === pathHash)
    : index.runs;

  // Load full manifests for filtered runs
  const manifests: HistoryManifest[] = [];
  for (const run of filteredRuns) {
    const runDir = join(historyDir, run.runId);
    const manifest = readJSON<HistoryManifest>(join(runDir, 'manifest.json'));
    if (manifest) {
      manifests.push(manifest);
    }
  }

  // Sort by timestamp descending (most recent first)
  manifests.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return manifests;
}

/**
 * Get the most recent run for a path.
 * Returns null if no history exists.
 */
export function getLatestRun(path: string, baseDir: string = '.'): LoadedRun | null {
  const runs = listRuns(path, baseDir);

  if (runs.length === 0) {
    return null;
  }

  // First run is most recent (already sorted)
  return loadRun(runs[0].runId, baseDir);
}

/**
 * Prune old runs, keeping only the most recent N runs per path.
 * Returns the number of runs deleted.
 */
export function pruneHistory(keepCount: number = 10, baseDir: string = '.'): number {
  const historyDir = getHistoryDir(baseDir);
  const index = loadIndex(historyDir);

  // Group runs by pathHash
  const runsByPath = new Map<string, typeof index.runs>();
  for (const run of index.runs) {
    const existing = runsByPath.get(run.pathHash) ?? [];
    existing.push(run);
    runsByPath.set(run.pathHash, existing);
  }

  // Find runs to delete
  const runsToDelete: string[] = [];
  for (const [, runs] of runsByPath) {
    // Sort by timestamp descending
    runs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Mark excess runs for deletion
    if (runs.length > keepCount) {
      for (let i = keepCount; i < runs.length; i++) {
        runsToDelete.push(runs[i].runId);
      }
    }
  }

  // Delete run directories
  for (const runId of runsToDelete) {
    const runDir = join(historyDir, runId);
    if (existsSync(runDir)) {
      rmSync(runDir, { recursive: true });
    }
  }

  // Update index to remove deleted runs
  if (runsToDelete.length > 0) {
    const deleteSet = new Set(runsToDelete);
    index.runs = index.runs.filter(r => !deleteSet.has(r.runId));
    saveIndex(historyDir, index);
  }

  return runsToDelete.length;
}

/**
 * Delete a specific run by ID.
 * Returns true if the run was deleted, false if not found.
 */
export function deleteRun(runId: string, baseDir: string = '.'): boolean {
  const historyDir = getHistoryDir(baseDir);
  const runDir = join(historyDir, runId);

  // Check if run exists
  if (!existsSync(runDir)) {
    return false;
  }

  // Delete the run directory
  rmSync(runDir, { recursive: true });

  // Update the index
  const index = loadIndex(historyDir);
  const originalLength = index.runs.length;
  index.runs = index.runs.filter(r => r.runId !== runId);

  if (index.runs.length < originalLength) {
    saveIndex(historyDir, index);
  }

  return true;
}

/**
 * Clear all history (delete everything).
 * Returns the number of runs deleted.
 */
export function clearAllHistory(baseDir: string = '.'): number {
  const historyDir = getHistoryDir(baseDir);
  const index = loadIndex(historyDir);
  const count = index.runs.length;

  // Delete all run directories
  for (const run of index.runs) {
    const runDir = join(historyDir, run.runId);
    if (existsSync(runDir)) {
      rmSync(runDir, { recursive: true });
    }
  }

  // Reset the index
  const emptyIndex: HistoryIndex = {
    version: HISTORY_VERSION,
    lastUpdated: new Date().toISOString(),
    runs: [],
  };
  saveIndex(historyDir, emptyIndex);

  return count;
}
