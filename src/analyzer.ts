import { readFileSync } from 'fs';
import { join } from 'path';
import type { ScanResult, Callsite, Patterns, Provider } from './types.js';
import { createHash } from 'crypto';

// =============================================================================
// CONSTANTS
// =============================================================================

const PROVIDER_PATTERNS: Record<string, RegExp[]> = {
  openai: [
    /openai/i,
    /OpenAI\s*\(/,
    /from\s+['"]openai['"]/,
  ],
  anthropic: [
    /anthropic/i,
    /Anthropic\s*\(/,
    /from\s+['"]@anthropic-ai/,
  ],
  google: [
    /google\.generative/i,
    /genai\./,
    /from\s+['"]@google\/generative/,
  ],
  together: [
    /together/i,
    /Together\s*\(/,
    /from\s+['"]together/,
  ],
  fireworks: [
    /fireworks/i,
    /Fireworks\s*\(/,
  ],
  groq: [
    /groq/i,
    /Groq\s*\(/,
  ],
  mistral: [
    /mistral/i,
    /Mistral\s*\(/,
  ],
  cohere: [
    /cohere/i,
    /Cohere\s*\(/,
  ],
  replicate: [
    /replicate/i,
    /Replicate\s*\(/,
  ],
  aws_bedrock: [
    /bedrock/i,
    /BedrockRuntime/,
  ],
  azure: [
    /azure.*openai/i,
    /AzureOpenAI/,
  ],
};

const MODEL_PATTERNS: RegExp[] = [
  /model\s*[=:]\s*['"]([^'"]+)['"]/i,
  /model_name\s*[=:]\s*['"]([^'"]+)['"]/i,
  /modelId\s*[=:]\s*['"]([^'"]+)['"]/i,
  /model_id\s*[=:]\s*['"]([^'"]+)['"]/i,
  /['"]model['"]\s*:\s*['"]([^'"]+)['"]/i,
];

const PATTERN_DETECTORS: Record<keyof Patterns, RegExp[]> = {
  streaming: [
    /stream\s*[=:]\s*true/i,
    /stream:\s*true/i,
    /\.stream\s*\(/,
    /createStream/i,
    /streamChat/i,
    /for\s+await\s*\(/,
    /async\s+for/,
  ],
  batching: [
    /batch/i,
    /Promise\.all/,
    /Promise\.allSettled/,
    /\.map\s*\(\s*async/,
    /concurrent/i,
    /parallel/i,
  ],
  retries: [
    /retry/i,
    /retries/i,
    /max_retries/i,
    /maxRetries/i,
    /tenacity/i,
    /backoff/i,
    /attempt/i,
  ],
  caching: [
    /cache/i,
    /cached/i,
    /memoize/i,
    /lru_cache/,
    /@cache/,
    /redis/i,
  ],
  fallback: [
    /fallback/i,
    /catch\s*\(/,
    /\.catch\s*\(/,
    /try\s*{/,
    /except\s*:/,
    /on_error/i,
    /error.*handler/i,
  ],
};

// =============================================================================
// HELPERS
// =============================================================================

function generateCallsiteId(file: string, line: number): string {
  const hash = createHash('sha256')
    .update(`${file}:${line}`)
    .digest('hex')
    .slice(0, 8);
  return `cs_${hash}`;
}

function extractContext(content: string, line: number, windowSize: number = 10): string {
  const lines = content.split('\n');
  const start = Math.max(0, line - windowSize);
  const end = Math.min(lines.length, line + windowSize);
  return lines.slice(start, end).join('\n');
}

function detectProvider(context: string, fileContent: string): string | undefined {
  // Check context first, then full file for imports
  for (const [provider, patterns] of Object.entries(PROVIDER_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(context) || pattern.test(fileContent)) {
        return provider;
      }
    }
  }
  return undefined;
}

function detectModel(context: string): string | undefined {
  for (const pattern of MODEL_PATTERNS) {
    const match = context.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  return undefined;
}

function detectPatterns(context: string): Patterns {
  const patterns: Patterns = {};

  for (const [pattern, regexes] of Object.entries(PATTERN_DETECTORS)) {
    for (const regex of regexes) {
      if (regex.test(context)) {
        patterns[pattern as keyof Patterns] = true;
        break;
      }
    }
  }

  return patterns;
}

function calculateConfidence(
  hasProvider: boolean,
  hasModel: boolean,
  patternCount: number
): number {
  let confidence = 0.3; // Base confidence for matching inference keywords

  if (hasProvider) confidence += 0.3;
  if (hasModel) confidence += 0.25;
  if (patternCount > 0) confidence += 0.05 * Math.min(patternCount, 3);

  return Math.min(confidence, 1.0);
}

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Analyze scan results to extract semantic information from callsites
 */
export async function analyze(scanResult: ScanResult): Promise<Callsite[]> {
  const callsites: Callsite[] = [];
  const fileContents = new Map<string, string>();

  // Read file contents using absolute paths
  for (const file of scanResult.files) {
    try {
      const absPath = join(scanResult.root, file.path);
      fileContents.set(file.path, readFileSync(absPath, 'utf-8'));
    } catch {
      // Skip files that can't be read
      continue;
    }
  }

  // Process each candidate
  for (const candidate of scanResult.candidates) {
    const content = fileContents.get(candidate.file);
    if (!content) continue;

    const context = extractContext(content, candidate.line);
    const provider = detectProvider(context, content);
    const model = detectModel(context);
    const patterns = detectPatterns(context);

    const patternCount = Object.values(patterns).filter(Boolean).length;
    const confidence = calculateConfidence(!!provider, !!model, patternCount);

    // Cast provider to the Provider type or null
    const typedProvider: Provider | null = provider as Provider | null ?? null;

    callsites.push({
      id: generateCallsiteId(candidate.file, candidate.line),
      file: candidate.file,
      line: candidate.line,
      provider: typedProvider,
      model: model ?? null,
      framework: null,
      runtime: null,
      patterns,
      confidence,
    });
  }

  // Sort by confidence descending
  callsites.sort((a, b) => b.confidence - a.confidence);

  return callsites;
}

/**
 * Re-analyze a single file (for incremental updates)
 */
export async function analyzeFile(filePath: string, content: string, lines: number[]): Promise<Callsite[]> {
  const callsites: Callsite[] = [];

  for (const line of lines) {
    const context = extractContext(content, line);
    const provider = detectProvider(context, content);
    const model = detectModel(context);
    const patterns = detectPatterns(context);

    const patternCount = Object.values(patterns).filter(Boolean).length;
    const confidence = calculateConfidence(!!provider, !!model, patternCount);

    // Cast provider to the Provider type or null
    const typedProvider: Provider | null = provider as Provider | null ?? null;

    callsites.push({
      id: generateCallsiteId(filePath, line),
      file: filePath,
      line,
      provider: typedProvider,
      model: model ?? null,
      framework: null,
      runtime: null,
      patterns,
      confidence,
    });
  }

  return callsites;
}
