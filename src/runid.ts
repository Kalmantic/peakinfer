import { createHash } from 'crypto';
import { existsSync, readFileSync, statSync, readdirSync } from 'fs';
import { join } from 'path';
import type { InferenceMap, Insight, JoinedOutput, RuntimeSummary } from './types.js';
import { VERSION } from './version.js';

// =============================================================================
// TYPES
// =============================================================================

export interface RunInputs {
  repoRoot?: string;
  eventsPath?: string;
  offline?: boolean;
}

export interface RunManifest {
  runId: string;
  version: string;
  createdAt: string;
  inputs: {
    repoRoot?: string;
    repoHash?: string;
    eventsPath?: string;
    eventsHash?: string;
    offline: boolean;
  };
  artifacts: string[];
  status: 'complete' | 'partial' | 'failed';
}

export interface CachedArtifacts {
  inferenceMap?: InferenceMap;
  insights?: Insight[];
  joined?: JoinedOutput;
  runtime?: RuntimeSummary;
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Hash a file's content for change detection
 */
function hashFile(filePath: string): string {
  try {
    const content = readFileSync(filePath, 'utf-8');
    return createHash('sha256').update(content).digest('hex').slice(0, 16);
  } catch {
    return 'missing';
  }
}

/**
 * Hash a directory structure (file paths + sizes + mtimes)
 * This is fast and detects most changes without reading all file contents
 */
function hashDirectory(dirPath: string, maxDepth: number = 5): string {
  const hash = createHash('sha256');

  function walk(dir: string, depth: number): void {
    if (depth > maxDepth) return;

    try {
      const entries = readdirSync(dir, { withFileTypes: true });
      entries.sort((a, b) => a.name.localeCompare(b.name));

      for (const entry of entries) {
        const fullPath = join(dir, entry.name);

        // Skip common non-code directories
        if (entry.isDirectory()) {
          if (['node_modules', 'dist', '.git', '__pycache__', '.peakinfer', '.venv', 'venv'].includes(entry.name)) {
            continue;
          }
          walk(fullPath, depth + 1);
        } else {
          // Only hash source files
          if (/\.(ts|tsx|js|jsx|py|go|java|rs|rb|php|cs)$/.test(entry.name)) {
            try {
              const stat = statSync(fullPath);
              hash.update(`${fullPath}:${stat.size}:${stat.mtimeMs}`);
            } catch {
              // Skip files we can't stat
            }
          }
        }
      }
    } catch {
      // Skip directories we can't read
    }
  }

  walk(dirPath, 0);
  return hash.digest('hex').slice(0, 16);
}

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Generate a deterministic run ID based on inputs
 *
 * runId = hash(version, repoHash?, eventsHash?, offline)
 *
 * This ensures:
 * - Same inputs = same runId = can resume
 * - Changed inputs = new runId = fresh analysis
 */
export function generateRunId(inputs: RunInputs): string {
  const hash = createHash('sha256');

  // Version ensures cache invalidation on tool updates
  hash.update(`v:${VERSION}`);

  // Hash repo structure if provided
  if (inputs.repoRoot && existsSync(inputs.repoRoot)) {
    const repoHash = hashDirectory(inputs.repoRoot);
    hash.update(`repo:${repoHash}`);
  }

  // Hash events file if provided
  if (inputs.eventsPath && existsSync(inputs.eventsPath)) {
    const eventsHash = hashFile(inputs.eventsPath);
    hash.update(`events:${eventsHash}`);
  }

  // Offline mode affects template loading
  hash.update(`offline:${inputs.offline ?? false}`);

  return hash.digest('hex').slice(0, 12);
}

/**
 * Get the run directory path
 */
export function getRunDir(baseDir: string, runId: string): string {
  return join(baseDir, 'runs', runId);
}

/**
 * Create run manifest
 */
export function createManifest(
  runId: string,
  inputs: RunInputs,
  artifacts: string[],
  status: 'complete' | 'partial' | 'failed'
): RunManifest {
  return {
    runId,
    version: VERSION,
    createdAt: new Date().toISOString(),
    inputs: {
      repoRoot: inputs.repoRoot,
      repoHash: inputs.repoRoot && existsSync(inputs.repoRoot)
        ? hashDirectory(inputs.repoRoot)
        : undefined,
      eventsPath: inputs.eventsPath,
      eventsHash: inputs.eventsPath && existsSync(inputs.eventsPath)
        ? hashFile(inputs.eventsPath)
        : undefined,
      offline: inputs.offline ?? false,
    },
    artifacts,
    status,
  };
}

/**
 * Load run manifest if it exists
 */
export function loadManifest(runDir: string): RunManifest | null {
  const manifestPath = join(runDir, 'manifest.json');

  if (!existsSync(manifestPath)) {
    return null;
  }

  try {
    const content = readFileSync(manifestPath, 'utf-8');
    return JSON.parse(content) as RunManifest;
  } catch {
    return null;
  }
}

/**
 * Check if a run can be resumed (all artifacts exist and inputs haven't changed)
 */
export function canResume(runDir: string, inputs: RunInputs): boolean {
  const manifest = loadManifest(runDir);

  if (!manifest) {
    return false;
  }

  // Check status
  if (manifest.status !== 'complete') {
    return false;
  }

  // Check version match
  if (manifest.version !== VERSION) {
    return false;
  }

  // Verify input hashes still match
  if (inputs.repoRoot && existsSync(inputs.repoRoot)) {
    const currentRepoHash = hashDirectory(inputs.repoRoot);
    if (currentRepoHash !== manifest.inputs.repoHash) {
      return false;
    }
  }

  if (inputs.eventsPath && existsSync(inputs.eventsPath)) {
    const currentEventsHash = hashFile(inputs.eventsPath);
    if (currentEventsHash !== manifest.inputs.eventsHash) {
      return false;
    }
  }

  // Verify all artifacts exist
  for (const artifact of manifest.artifacts) {
    if (!existsSync(join(runDir, artifact))) {
      return false;
    }
  }

  return true;
}

/**
 * Load cached artifacts from a previous run
 */
export function loadCachedArtifacts(runDir: string): CachedArtifacts {
  const artifacts: CachedArtifacts = {};

  const files = [
    { name: 'inferencemap.json', key: 'inferenceMap' },
    { name: 'insights.json', key: 'insights' },
    { name: 'joined.json', key: 'joined' },
    { name: 'runtime.json', key: 'runtime' },
  ] as const;

  for (const file of files) {
    const filePath = join(runDir, file.name);
    if (existsSync(filePath)) {
      try {
        const content = readFileSync(filePath, 'utf-8');
        (artifacts as Record<string, unknown>)[file.key] = JSON.parse(content);
      } catch {
        // Skip corrupted files
      }
    }
  }

  return artifacts;
}
