import { glob } from 'glob';
import ignoreDefault from 'ignore';
import { readFileSync, existsSync, statSync } from 'fs';
import { join, relative, extname } from 'path';
import type { ScanResult, ScanCandidate } from './types.js';

// Handle ESM default import with type assertion for NodeNext resolution
const ignore = ignoreDefault as unknown as (options?: { ignorecase?: boolean }) => {
  add(patterns: string | readonly string[]): void;
  ignores(pathname: string): boolean;
};

interface IgnoreInstance {
  add(patterns: string | readonly string[]): void;
  ignores(pathname: string): boolean;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const DEFAULT_IGNORES = [
  'node_modules/**',
  'dist/**',
  '.git/**',
  '__pycache__/**',
  '*.pyc',
  '.venv/**',
  'venv/**',
  '.env/**',
  'env/**',
  'build/**',
  'target/**',
  '.next/**',
  '.nuxt/**',
  'coverage/**',
];

const LANGUAGE_MAP: Record<string, string> = {
  '.py': 'python',
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.go': 'go',
  '.java': 'java',
  '.kt': 'kotlin',
  '.rs': 'rust',
  '.rb': 'ruby',
  '.php': 'php',
  '.cs': 'csharp',
  '.swift': 'swift',
  '.scala': 'scala',
};

const CODE_EXTENSIONS = Object.keys(LANGUAGE_MAP);

// Patterns that indicate LLM inference calls
const INFERENCE_PATTERNS = [
  // OpenAI
  /\.chat\.completions\.create\(/,
  /openai\.completions\.create\(/,
  /\.completions\.create\(/,
  // Anthropic
  /\.messages\.create\(/,
  /anthropic\.messages\(/,
  /\.create_message\(/,
  // Google
  /\.generate_content\(/,
  /genai\.GenerativeModel\(/,
  // Generic
  /\.invoke\(/,
  /\.ainvoke\(/,
  /\.generate\(/,
  /\.complete\(/,
  /\.chat\(/,
  /llm\./i,
  /\.llm\(/,
  // LangChain
  /ChatOpenAI\(/,
  /ChatAnthropic\(/,
  /ChatGoogleGenerativeAI\(/,
  // Together/Fireworks/Groq
  /together\.chat\./,
  /fireworks\.chat\./,
  /groq\.chat\./,
  // Self-hosted
  /vllm\.generate/,
  /sglang\.generate/,
  /ollama\.generate/,
  /ollama\.chat/,
];

// =============================================================================
// HELPERS
// =============================================================================

function detectLanguage(filePath: string): string {
  const ext = extname(filePath).toLowerCase();
  return LANGUAGE_MAP[ext] || 'unknown';
}

function countLines(content: string): number {
  if (!content) return 0;
  return content.split('\n').filter(line => line.trim().length > 0).length;
}

function loadGitignore(root: string): IgnoreInstance {
  const ig = ignore();

  // Add default ignores
  ig.add(DEFAULT_IGNORES);

  // Load .gitignore if exists
  const gitignorePath = join(root, '.gitignore');
  if (existsSync(gitignorePath)) {
    try {
      const content = readFileSync(gitignorePath, 'utf-8');
      ig.add(content);
    } catch {
      // Ignore errors reading .gitignore
    }
  }

  return ig;
}

function findCandidatesInContent(filePath: string, content: string): ScanCandidate[] {
  const candidates: ScanCandidate[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    for (const pattern of INFERENCE_PATTERNS) {
      if (pattern.test(line)) {
        candidates.push({
          file: filePath,
          line: i + 1, // 1-indexed
          snippet: line.trim().slice(0, 100), // First 100 chars
        });
        break; // Only one candidate per line
      }
    }
  }

  return candidates;
}

// =============================================================================
// PUBLIC API
// =============================================================================

export async function scan(root: string): Promise<ScanResult> {
  // Validate directory exists
  if (!existsSync(root)) {
    throw new Error(`Directory not found: ${root}`);
  }

  const stat = statSync(root);
  if (!stat.isDirectory()) {
    throw new Error(`Not a directory: ${root}`);
  }

  const ig = loadGitignore(root);

  // Build glob pattern for code files
  const patterns = CODE_EXTENSIONS.map(ext => `**/*${ext}`);

  // Find all matching files
  const absolutePaths = await glob(patterns, {
    cwd: root,
    absolute: true,
    nodir: true,
    dot: false,
  });

  // Process files
  const files: ScanResult['files'] = [];
  const candidates: ScanCandidate[] = [];
  const languageSet = new Set<string>();

  for (const absPath of absolutePaths) {
    const relPath = relative(root, absPath);

    // Check against ignore patterns
    if (ig.ignores(relPath)) {
      continue;
    }

    try {
      const content = readFileSync(absPath, 'utf-8');
      const language = detectLanguage(absPath);
      const loc = countLines(content);

      files.push({
        path: relPath,
        language,
        loc,
      });

      languageSet.add(language);

      // Find inference call candidates
      const fileCandidates = findCandidatesInContent(relPath, content);
      candidates.push(...fileCandidates);
    } catch {
      // Skip files that can't be read
    }
  }

  // Calculate summary
  const totalLoc = files.reduce((sum, f) => sum + f.loc, 0);

  return {
    root,
    files,
    candidates,
    summary: {
      totalFiles: files.length,
      totalLoc,
      languages: Array.from(languageSet).sort(),
      totalCandidates: candidates.length,
    },
  };
}
