import { readFileSync } from 'fs';
import { join } from 'path';
import Anthropic from '@anthropic-ai/sdk';
import type { ScanResult, Callsite, Patterns, Provider } from './types.js';
import { createHash } from 'crypto';
import { loadPrompt, getDefaultPrompt, type AnalysisPrompt } from './templates.js';

// =============================================================================
// CONSTANTS
// =============================================================================

const LLM_BATCH_SIZE = 5; // Process files in batches for efficiency
const MAX_CONTEXT_CHARS = 4000; // Max chars per file to send to LLM

// Fallback regex patterns (used when LLM unavailable)
const PROVIDER_PATTERNS: Record<string, RegExp[]> = {
  openai: [/openai/i, /OpenAI\s*\(/, /from\s+['"]openai['"]/],
  anthropic: [/anthropic/i, /Anthropic\s*\(/, /from\s+['"]@anthropic-ai/],
  google: [/google\.generative/i, /genai\./, /from\s+['"]@google\/generative/],
  together: [/together/i, /Together\s*\(/, /from\s+['"]together/],
  fireworks: [/fireworks/i, /Fireworks\s*\(/],
  groq: [/groq/i, /Groq\s*\(/],
  mistral: [/mistral/i, /Mistral\s*\(/],
  cohere: [/cohere/i, /Cohere\s*\(/],
  replicate: [/replicate/i, /Replicate\s*\(/],
  aws_bedrock: [/bedrock/i, /BedrockRuntime/],
  azure: [/azure.*openai/i, /AzureOpenAI/],
  vllm: [/vllm/i, /from\s+vllm/, /LLM\s*\(/],
  sglang: [/sglang/i, /SGLang/],
  ollama: [/ollama/i, /Ollama\s*\(/],
};

const MODEL_PATTERNS: RegExp[] = [
  /model\s*[=:]\s*['"]([^'"]+)['"]/i,
  /model_name\s*[=:]\s*['"]([^'"]+)['"]/i,
  /modelId\s*[=:]\s*['"]([^'"]+)['"]/i,
];

const PATTERN_DETECTORS: Record<keyof Patterns, RegExp[]> = {
  streaming: [/stream\s*[=:]\s*true/i, /\.stream\s*\(/, /for\s+await\s*\(/],
  batching: [/batch/i, /Promise\.all/, /\.map\s*\(\s*async/],
  retries: [/retry/i, /max_retries/i, /backoff/i],
  caching: [/cache/i, /memoize/i, /redis/i],
  fallback: [/fallback/i, /\.catch\s*\(/, /except\s*:/],
};

// =============================================================================
// TYPES
// =============================================================================

interface LLMCallsite {
  line: number;
  provider: string | null;
  model: string | null;
  framework: string | null;
  patterns: {
    streaming?: boolean;
    batching?: boolean;
    retries?: boolean;
    caching?: boolean;
    fallback?: boolean;
  };
  confidence: number;
  reasoning: string;
}

// LLM-generated impact estimate
export interface LLMImpactEstimate {
  layer: 'application' | 'model' | 'runtime' | 'infrastructure';
  impactType: 'cost' | 'latency' | 'throughput';
  estimatedImpactPercent: number;
  effort: 'low' | 'medium' | 'high';
}

// LLM-generated semantic insight (exported for use by agent)
export interface LLMInsight {
  severity: 'critical' | 'warning' | 'info';
  category: 'cost' | 'latency' | 'reliability' | 'waste' | 'security' | 'best-practice' | 'throughput';
  headline: string;
  evidence: string;
  location: string; // file:line
  recommendation?: string;
  impact?: LLMImpactEstimate; // LLM-generated impact estimate
}

interface LLMAnalysisResult {
  callsites: LLMCallsite[];
  insights: LLMInsight[];
}

interface AnalyzeOptions {
  useLLM?: boolean;
  verbose?: boolean;
  promptId?: string; // ID of the analysis prompt to use (defaults to 'peak-performance')
}

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

function truncateContent(content: string): string {
  if (content.length <= MAX_CONTEXT_CHARS) return content;
  return content.slice(0, MAX_CONTEXT_CHARS) + '\n// ... truncated ...';
}

// =============================================================================
// LLM ANALYSIS
// =============================================================================

const ANALYSIS_PROMPT = `You are an expert at analyzing code to identify LLM inference usage and potential issues.

Analyze the following code and:

## PART 1: Identify LLM Usage
For each LLM API call, extract:
- line: The line number where the call is made
- provider: MUST be one of: openai, anthropic, google, together, fireworks, groq, mistral, cohere, replicate, aws_bedrock, azure, vllm, sglang, ollama, unknown
- model: The model name if specified (e.g., "gpt-4o", "claude-3-opus")
- framework: langchain, llamaindex, dspy, or null
- patterns: streaming, batching, retries, caching, fallback (true/false)
- confidence: 0.0 to 1.0
- reasoning: Brief explanation

## PART 2: Generate Insights
Identify potential issues, anti-patterns, or improvements.

IMPORTANT - Use these EXACT values:
- severity: MUST be one of: "critical", "warning", "info"
- category: MUST be one of: "cost", "latency", "reliability", "waste", "security", "best-practice"

Issues to look for:
- Missing error handling for LLM calls (reliability)
- Hardcoded API keys or secrets (security)
- Inefficient patterns - no batching, no streaming (latency)
- Model selection issues - overpowered model for simple tasks (cost)
- Missing retries for production code (reliability)
- Cost optimization opportunities (cost)

Return ONLY valid JSON:
{
  "callsites": [
    {
      "line": 42,
      "provider": "openai",
      "model": "gpt-4o",
      "framework": null,
      "patterns": {"streaming": true, "batching": false, "retries": true, "caching": false, "fallback": true},
      "confidence": 0.95,
      "reasoning": "Direct OpenAI API call"
    }
  ],
  "insights": [
    {
      "severity": "warning",
      "category": "reliability",
      "headline": "No retry logic for LLM call",
      "evidence": "The API call at line 42 has no retry handling - LLM APIs can fail transiently",
      "location": "src/chat.py:42",
      "recommendation": "Add exponential backoff retry logic"
    }
  ]
}

If no issues found, return empty arrays: {"callsites": [], "insights": []}`;

interface LLMAnalysisOutput {
  callsitesByFile: Map<string, LLMCallsite[]>;
  insights: LLMInsight[];
}

// Normalize LLM insights to valid values
function normalizeInsight(insight: LLMInsight): LLMInsight {
  // Normalize severity
  const severityMap: Record<string, 'critical' | 'warning' | 'info'> = {
    error: 'critical',
    high: 'critical',
    medium: 'warning',
    low: 'info',
  };
  const severity = severityMap[insight.severity] || insight.severity;

  // Normalize category
  const categoryMap: Record<string, 'cost' | 'latency' | 'reliability' | 'waste' | 'security' | 'best-practice'> = {
    cost_optimization: 'cost',
    performance: 'latency',
    efficiency: 'waste',
    error_handling: 'reliability',
    'error-handling': 'reliability',
  };
  const category = categoryMap[insight.category] || insight.category;

  return {
    ...insight,
    severity: severity as 'critical' | 'warning' | 'info',
    category: category as 'cost' | 'latency' | 'reliability' | 'waste' | 'security' | 'best-practice',
  };
}

async function analyzewithLLM(
  files: Array<{ path: string; content: string; candidateLines: number[] }>,
  client: Anthropic,
  analysisPrompt: string
): Promise<LLMAnalysisOutput> {
  const callsitesByFile = new Map<string, LLMCallsite[]>();
  const allInsights: LLMInsight[] = [];

  // Process in batches
  for (let i = 0; i < files.length; i += LLM_BATCH_SIZE) {
    const batch = files.slice(i, i + LLM_BATCH_SIZE);

    const fileContents = batch.map(f => {
      const truncated = truncateContent(f.content);
      return `=== FILE: ${f.path} ===\nCandidate lines: ${f.candidateLines.join(', ')}\n\n${truncated}`;
    }).join('\n\n');

    try {
      const response = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        messages: [
          {
            role: 'user',
            content: `${analysisPrompt}\n\n${fileContents}`,
          },
        ],
      });

      // Extract JSON from response
      const text = response.content[0].type === 'text' ? response.content[0].text : '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as LLMAnalysisResult;

        // Map callsites back to files
        for (const callsite of parsed.callsites) {
          for (const file of batch) {
            if (file.candidateLines.includes(callsite.line)) {
              const existing = callsitesByFile.get(file.path) || [];
              existing.push(callsite);
              callsitesByFile.set(file.path, existing);
              break;
            }
          }
        }

        // Collect insights (normalized to valid values)
        if (parsed.insights && Array.isArray(parsed.insights)) {
          allInsights.push(...parsed.insights.map(normalizeInsight));
        }
      }
    } catch (error) {
      // Continue with regex fallback for this batch
      const errMsg = error instanceof Error ? error.message : String(error);
      console.warn(`[analyzer] LLM analysis failed for batch, using fallback: ${errMsg}`);
    }
  }

  return { callsitesByFile, insights: allInsights };
}

// =============================================================================
// REGEX FALLBACK
// =============================================================================

function detectProviderRegex(context: string, fileContent: string): string | undefined {
  for (const [provider, patterns] of Object.entries(PROVIDER_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(context) || pattern.test(fileContent)) {
        return provider;
      }
    }
  }
  return undefined;
}

function detectModelRegex(context: string): string | undefined {
  for (const pattern of MODEL_PATTERNS) {
    const match = context.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  return undefined;
}

function detectPatternsRegex(context: string): Patterns {
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
  let confidence = 0.3;
  if (hasProvider) confidence += 0.3;
  if (hasModel) confidence += 0.25;
  if (patternCount > 0) confidence += 0.05 * Math.min(patternCount, 3);
  return Math.min(confidence, 1.0);
}

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Result of analyzing scan results
 */
export interface AnalyzeResult {
  callsites: Callsite[];
  insights: LLMInsight[];
}

/**
 * Analyze scan results to extract semantic information from callsites.
 * Uses LLM for semantic analysis when ANTHROPIC_API_KEY is available,
 * falls back to regex patterns otherwise.
 *
 * Returns both callsites AND LLM-generated semantic insights (phase 1).
 * Template-based insights are generated separately (phase 2).
 */
export async function analyze(
  scanResult: ScanResult,
  options: AnalyzeOptions = {}
): Promise<AnalyzeResult> {
  const { useLLM = true, promptId } = options;
  const callsites: Callsite[] = [];
  const llmInsights: LLMInsight[] = [];
  const fileContents = new Map<string, string>();

  // Load analysis prompt (from YAML config or fallback)
  let analysisPromptText = ANALYSIS_PROMPT; // Fallback to hardcoded prompt
  if (promptId) {
    const customPrompt = loadPrompt(promptId);
    if (customPrompt) {
      analysisPromptText = customPrompt.prompt;
    } else {
      console.warn(`[analyzer] Prompt '${promptId}' not found, using default`);
    }
  } else {
    // Try to load default peak-performance prompt
    try {
      const defaultPrompt = getDefaultPrompt();
      analysisPromptText = defaultPrompt.prompt;
    } catch {
      // Use hardcoded fallback if prompts directory doesn't exist
    }
  }

  // Read file contents
  for (const file of scanResult.files) {
    try {
      const absPath = join(scanResult.root, file.path);
      fileContents.set(file.path, readFileSync(absPath, 'utf-8'));
    } catch {
      continue;
    }
  }

  // Group candidates by file
  const candidatesByFile = new Map<string, number[]>();
  for (const candidate of scanResult.candidates) {
    const existing = candidatesByFile.get(candidate.file) || [];
    existing.push(candidate.line);
    candidatesByFile.set(candidate.file, existing);
  }

  // Try LLM analysis if API key available
  let llmOutput: LLMAnalysisOutput | null = null;

  if (useLLM && process.env.ANTHROPIC_API_KEY) {
    try {
      const client = new Anthropic();
      const filesToAnalyze = Array.from(candidatesByFile.entries())
        .filter(([path]) => fileContents.has(path))
        .map(([path, lines]) => ({
          path,
          content: fileContents.get(path)!,
          candidateLines: lines,
        }));

      if (filesToAnalyze.length > 0) {
        llmOutput = await analyzewithLLM(filesToAnalyze, client, analysisPromptText);
        // Collect LLM-generated insights (phase 1)
        llmInsights.push(...llmOutput.insights);
      }
    } catch (error) {
      console.warn('[analyzer] LLM initialization failed, using regex fallback');
    }
  }

  // Process each candidate
  for (const candidate of scanResult.candidates) {
    const content = fileContents.get(candidate.file);
    if (!content) continue;

    // Check if we have LLM results for this file/line
    const llmCallsites = llmOutput?.callsitesByFile.get(candidate.file);
    const llmMatch = llmCallsites?.find(c => c.line === candidate.line);

    if (llmMatch) {
      // Use LLM results
      const typedProvider: Provider | null = llmMatch.provider as Provider | null;

      callsites.push({
        id: generateCallsiteId(candidate.file, candidate.line),
        file: candidate.file,
        line: candidate.line,
        provider: typedProvider,
        model: llmMatch.model,
        framework: llmMatch.framework,
        runtime: null,
        patterns: llmMatch.patterns,
        confidence: llmMatch.confidence,
      });
    } else {
      // Fallback to regex analysis
      const context = extractContext(content, candidate.line);
      const provider = detectProviderRegex(context, content);
      const model = detectModelRegex(context);
      const patterns = detectPatternsRegex(context);

      const patternCount = Object.values(patterns).filter(Boolean).length;
      const confidence = calculateConfidence(!!provider, !!model, patternCount);

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
  }

  // Sort by confidence descending
  callsites.sort((a, b) => b.confidence - a.confidence);

  return { callsites, insights: llmInsights };
}

/**
 * Re-analyze a single file (for incremental updates)
 */
export async function analyzeFile(
  filePath: string,
  content: string,
  lines: number[],
  options: AnalyzeOptions = {}
): Promise<AnalyzeResult> {
  const { useLLM = true, promptId } = options;
  const callsites: Callsite[] = [];
  const llmInsights: LLMInsight[] = [];

  // Load analysis prompt (from YAML config or fallback)
  let analysisPromptText = ANALYSIS_PROMPT;
  if (promptId) {
    const customPrompt = loadPrompt(promptId);
    if (customPrompt) {
      analysisPromptText = customPrompt.prompt;
    }
  } else {
    try {
      const defaultPrompt = getDefaultPrompt();
      analysisPromptText = defaultPrompt.prompt;
    } catch {
      // Use hardcoded fallback
    }
  }

  // Try LLM analysis
  let llmCallsites: LLMCallsite[] = [];

  if (useLLM && process.env.ANTHROPIC_API_KEY) {
    try {
      const client = new Anthropic();
      const output = await analyzewithLLM(
        [{ path: filePath, content, candidateLines: lines }],
        client,
        analysisPromptText
      );
      llmCallsites = output.callsitesByFile.get(filePath) || [];
      llmInsights.push(...output.insights);
    } catch {
      // Fall through to regex
    }
  }

  for (const line of lines) {
    const llmMatch = llmCallsites.find(c => c.line === line);

    if (llmMatch) {
      const typedProvider: Provider | null = llmMatch.provider as Provider | null;

      callsites.push({
        id: generateCallsiteId(filePath, line),
        file: filePath,
        line,
        provider: typedProvider,
        model: llmMatch.model,
        framework: llmMatch.framework,
        runtime: null,
        patterns: llmMatch.patterns,
        confidence: llmMatch.confidence,
      });
    } else {
      // Regex fallback
      const context = extractContext(content, line);
      const provider = detectProviderRegex(context, content);
      const model = detectModelRegex(context);
      const patterns = detectPatternsRegex(context);

      const patternCount = Object.values(patterns).filter(Boolean).length;
      const confidence = calculateConfidence(!!provider, !!model, patternCount);

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
  }

  return { callsites, insights: llmInsights };
}
