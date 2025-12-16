/**
 * Scanner Module — File Discovery
 *
 * Responsibility (per Tech Design v1.1):
 * - Walk directory tree
 * - Detect languages
 * - Count files and lines
 * - Respect ignore patterns
 *
 * Design: Minimal code, single responsibility.
 * The agent handles semantic analysis; Scanner just finds files.
 */

import * as fs from 'fs';
import * as path from 'path';
import ignore from 'ignore';
import type { Language, ScanResult, ScannedFile } from './types.js';

type Ignore = ReturnType<typeof ignore>;

// =============================================================================
// CONFIGURATION
// =============================================================================

/** File extensions to language mapping */
const EXTENSION_MAP: Record<string, Language> = {
  '.py': 'python',
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.go': 'go',
  '.java': 'java',
};

/** Directories to always ignore */
const IGNORE_DIRS = new Set([
  // Package managers & dependencies
  'node_modules',
  'bower_components',
  'jspm_packages',
  '.pnpm',

  // Version control
  '.git',
  '.svn',
  '.hg',

  // Build outputs
  'dist',
  'build',
  'out',
  '.next',
  '.nuxt',
  '.output',
  '.vercel',
  '.netlify',
  '.turbo',
  '.cache',
  '.parcel-cache',

  // Python
  '__pycache__',
  '.venv',
  'venv',
  'env',
  '.env',
  '.tox',
  '.nox',
  '.pytest_cache',
  '.mypy_cache',
  '.ruff_cache',
  'site-packages',
  '*.egg-info',

  // IDE & editors
  '.idea',
  '.vscode',
  '.eclipse',
  '.settings',

  // Testing & coverage
  'coverage',
  '.nyc_output',
  'htmlcov',

  // Misc
  '.DS_Store',
  'vendor',
  'third_party',
  '.terraform',
  '.serverless',
]);

/** File patterns to ignore (checked against full relative path) */
const IGNORE_PATTERNS = [
  // Minified/bundled files
  /\.min\.js$/,
  /\.bundle\.js$/,
  /\.chunk\.js$/,
  /vendor-chunks/,

  // Source maps
  /\.map$/,

  // Generated files
  /\.generated\./,
  /\.d\.ts$/,   // TypeScript declaration files

  // Lock files
  /package-lock\.json$/,
  /yarn\.lock$/,
  /pnpm-lock\.yaml$/,

  // Config files (usually no LLM calls)
  /\.config\.(js|ts|mjs)$/,
  /next\.config\./,
  /tailwind\.config\./,
  /postcss\.config\./,
  /eslint/,
  /prettier/,

  // Test files (optional - include if you want to scan tests)
  // /\.test\./,
  // /\.spec\./,
  // /__tests__/,
];

// =============================================================================
// SCANNER IMPLEMENTATION
// =============================================================================

/**
 * Load .gitignore patterns from a directory.
 */
function loadGitignore(root: string): Ignore {
  const ig = ignore();

  // Always add our built-in ignores
  ig.add([...IGNORE_DIRS]);

  // Try to load .gitignore
  const gitignorePath = path.join(root, '.gitignore');
  if (fs.existsSync(gitignorePath)) {
    try {
      const content = fs.readFileSync(gitignorePath, 'utf-8');
      ig.add(content);
    } catch {
      // Ignore read errors
    }
  }

  return ig;
}

/**
 * Check if a file should be ignored based on patterns.
 */
function shouldIgnoreFile(relativePath: string): boolean {
  return IGNORE_PATTERNS.some(pattern => pattern.test(relativePath));
}

/**
 * Progress callback for scanning operations.
 */
export type ScanProgressCallback = (current: number, total: number, currentFile?: string) => void;

/**
 * Scan options.
 */
export interface ScanOptions {
  /** Callback for progress updates */
  onProgress?: ScanProgressCallback;
}

/**
 * Scan a directory for source files.
 *
 * @param root - Directory path to scan
 * @param options - Scan options including progress callback
 * @returns ScanResult with file inventory
 * @throws Error if path doesn't exist
 */
export async function scan(root: string, options?: ScanOptions): Promise<ScanResult> {
  const start = Date.now();

  // Validate path exists
  if (!fs.existsSync(root)) {
    throw new Error(`Path does not exist: ${root}`);
  }

  const files: ScannedFile[] = [];
  const languages: Partial<Record<Language, number>> = {};

  // Load gitignore patterns
  const ig = loadGitignore(root);

  // First pass: count total files for progress reporting
  const totalFiles = options?.onProgress ? countFiles(root, ig) : 0;

  // Track progress state
  const progressState = {
    current: 0,
    total: totalFiles,
  };

  // Recursive walk with progress reporting
  walkDir(root, root, files, languages, ig, options?.onProgress ? progressState : null, options?.onProgress);

  return {
    root,
    files,
    totalFiles: files.length,
    totalLines: files.reduce((sum, f) => sum + f.lines, 0),
    languages,
    durationMs: Date.now() - start,
  };
}

/**
 * Count total files that will be scanned (for progress reporting).
 */
function countFiles(dir: string, ig: Ignore, root?: string): number {
  const rootPath = root || dir;
  let count = 0;

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.relative(rootPath, fullPath);

      // Check gitignore patterns
      const checkPath = entry.isDirectory() ? relativePath + '/' : relativePath;
      if (ig.ignores(checkPath)) continue;

      if (entry.isDirectory()) {
        if (IGNORE_DIRS.has(entry.name)) continue;
        count += countFiles(fullPath, ig, rootPath);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name);
        const language = EXTENSION_MAP[ext];

        if (language && !shouldIgnoreFile(relativePath)) {
          count++;
        }
      }
    }
  } catch {
    // Permission denied or other error — skip silently
  }

  return count;
}

/**
 * Progress state for tracking file scanning.
 */
interface ProgressState {
  current: number;
  total: number;
}

/**
 * Recursively walk directory tree.
 * Modifies files and languages arrays in place (efficient).
 */
function walkDir(
  dir: string,
  root: string,
  files: ScannedFile[],
  languages: Partial<Record<Language, number>>,
  ig: Ignore,
  progressState: ProgressState | null = null,
  onProgress?: ScanProgressCallback
): void {
  let entries: fs.Dirent[];

  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    // Permission denied or other error — skip silently
    return;
  }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relativePath = path.relative(root, fullPath);

    // Check gitignore patterns (add trailing slash for directories)
    const checkPath = entry.isDirectory() ? relativePath + '/' : relativePath;
    if (ig.ignores(checkPath)) continue;

    if (entry.isDirectory()) {
      // Also check built-in ignore list
      if (IGNORE_DIRS.has(entry.name)) continue;
      walkDir(fullPath, root, files, languages, ig, progressState, onProgress);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name);
      const language = EXTENSION_MAP[ext];

      // Skip unknown file types
      if (!language) continue;

      // Skip files matching ignore patterns
      if (shouldIgnoreFile(relativePath)) continue;

      try {
        const content = fs.readFileSync(fullPath, 'utf-8');
        const lines = content.split('\n').length;

        files.push({
          path: relativePath,
          language,
          lines,
        });

        // Track language counts
        languages[language] = (languages[language] || 0) + 1;

        // Report progress
        if (progressState && onProgress) {
          progressState.current++;
          onProgress(progressState.current, progressState.total, relativePath);
        }
      } catch {
        // Can't read file — skip
      }
    }
  }
}
