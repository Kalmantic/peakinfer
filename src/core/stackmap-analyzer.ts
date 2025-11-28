/**
 * StackMap Analyzer - Claude-First Semantic Detection
 * Based on Technical Design Document v1.1
 * 
 * Architecture:
 * - P1: DETECT_CALLSITES - Chunk-level semantic scanning
 * - P2: CLASSIFY_CALLSITE - Deep classification
 * - P3: ESTIMATE_USAGE - Token scale inference (optional)
 * - Deterministic validation layer
 * - StackMap builder
 */

import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs-extra';
import * as path from 'path';
import { glob } from 'glob';
import ignore from 'ignore';
import { v4 as uuidv4 } from 'uuid';
import {
  StackMap,
  Callsite,
  ModelInfo,
  VendorInfo,
  RuntimeInfo,
  HardwareInfo,
  FrameworkInfo,
  PatternDetection,
  StackMapMetadata,
  Suggestion,
  AnalysisOptions,
  AnalysisProgress,
  P1DetectResponse,
  P2ClassifyResponse,
  P3EstimateResponse,
  TokenEstimate
} from '../types/stackmap.js';
import { OptimizationTemplate } from '../types/template.js';

// Prompt versions for tracking
const PROMPT_VERSION = '1.0';

// Token scale mappings
const TOKEN_SCALE_MAP: Record<string, number> = {
  tiny: 100,
  small: 500,
  medium: 2000,
  large: 8000,
  xlarge: 32000
};

// Frequency mappings (calls per month)
const FREQUENCY_MAP: Record<string, number> = {
  rare: 100,
  occasional: 1000,
  frequent: 10000,
  very_frequent: 100000,
  continuous: 1000000
};

export class StackMapAnalyzer {
  private anthropic: Anthropic;
  private model: string = 'claude-sonnet-4-5-20250929';
  private maxTokens: number = 4096;
  private verbose: boolean;

  constructor(apiKey: string, options?: { verbose?: boolean }) {
    this.anthropic = new Anthropic({ apiKey });
    this.verbose = options?.verbose || false;
  }

  private log(...args: unknown[]) {
    if (this.verbose) {
      console.log('[StackMapAnalyzer]', ...args);
    }
  }

  /**
   * Main analysis entry point
   */
  async analyze(codebasePath: string, options?: AnalysisOptions): Promise<StackMap> {
    const startTime = Date.now();
    this.log('Starting analysis of', codebasePath);

    // Scan files
    const files = await this.scanFiles(codebasePath, options?.ignorePatterns);
    this.log(`Found ${files.length} files to analyze`);

    const allCallsites: Callsite[] = [];
    const skippedFiles: { file: string; reason: string }[] = [];
    let totalLines = 0;
    const languages = new Set<string>();

    // Process files in batches
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const relativePath = path.relative(codebasePath, file);
      
      // Report progress
      if (options?.onProgress) {
        options.onProgress({
          currentFile: relativePath,
          filesProcessed: i,
          totalFiles: files.length,
          percentage: Math.round((i / files.length) * 100),
          phase: 'detecting'
        });
      }

      try {
        const content = await fs.readFile(file, 'utf-8');
        const lines = content.split('\n').length;
        totalLines += lines;

        const language = this.detectLanguage(file);
        languages.add(language);

        // Skip if file is too large
        if (content.length > 100000) {
          skippedFiles.push({ file: relativePath, reason: 'file too large' });
          continue;
        }

        // P1: Detect callsites
        const detectedCallsites = await this.detectCallsites(content, relativePath, language);
        this.log(`P1: Found ${detectedCallsites.length} potential callsites in ${relativePath}`);

        // P2: Classify each callsite with confidence > 0.3
        for (const callsite of detectedCallsites) {
          if (callsite.confidence < 0.3) continue;

          const classified = await this.classifyCallsite(callsite, content);
          if (classified.confidence >= (options?.minConfidence || 0.4)) {
            allCallsites.push(classified);
          }
        }

        // P3: Estimate usage if enabled
        if (options?.estimateUsage) {
          for (const callsite of allCallsites.filter(c => c.file === relativePath)) {
            const estimate = await this.estimateUsage(callsite, content);
            callsite.estimatedTokens = estimate;
          }
        }

      } catch (error) {
        skippedFiles.push({
          file: relativePath,
          reason: error instanceof Error ? error.message : 'parse error'
        });
      }

      // Max files limit
      if (options?.maxFiles && i >= options.maxFiles) {
        break;
      }
    }

    // Build StackMap
    const stackmap = this.buildStackMap(allCallsites, {
      filesScanned: files.length,
      linesOfCode: totalLines,
      languages: Array.from(languages),
      durationMs: Date.now() - startTime,
      skippedFiles: skippedFiles.length > 0 ? skippedFiles : undefined
    });

    this.log('Analysis complete. Callsites:', allCallsites.length);
    return stackmap;
  }

  /**
   * Scan files respecting .gitignore
   */
  private async scanFiles(codebasePath: string, ignorePatterns?: string[]): Promise<string[]> {
    // Load .gitignore
    const ig = ignore();
    const gitignorePath = path.join(codebasePath, '.gitignore');
    if (await fs.pathExists(gitignorePath)) {
      const gitignore = await fs.readFile(gitignorePath, 'utf-8');
      ig.add(gitignore);
    }

    // Add default ignores
    ig.add([
      'node_modules/**',
      '.git/**',
      'dist/**',
      'build/**',
      '.next/**',
      '__pycache__/**',
      '*.min.js',
      '*.bundle.js',
      'package-lock.json',
      'yarn.lock',
      '*.lock'
    ]);

    if (ignorePatterns) {
      ig.add(ignorePatterns);
    }

    // Scan for relevant files
    const patterns = [
      '**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx', '**/*.mjs',
      '**/*.py', '**/*.go', '**/*.java', '**/*.kt',
      '**/*.yaml', '**/*.yml', '**/*.json', '**/*.toml'
    ];

    const allFiles: string[] = [];
    for (const pattern of patterns) {
      const files = await glob(pattern, {
        cwd: codebasePath,
        absolute: true,
        ignore: ['**/node_modules/**', '**/.git/**']
      });

      for (const file of files) {
        const relative = path.relative(codebasePath, file);
        if (!ig.ignores(relative)) {
          allFiles.push(file);
        }
      }
    }

    return allFiles;
  }

  /**
   * P1: Detect Callsites - Chunk-level semantic scanning
   */
  private async detectCallsites(
    content: string,
    filePath: string,
    language: string
  ): Promise<Callsite[]> {
    // Skip non-source files (YAML, JSON might contain code snippets but aren't actual callsites)
    if (['yaml', 'json', 'toml'].includes(language)) {
      return [];
    }

    // Quick pre-filter: check if file might contain LLM calls
    const llmPatterns = [
      /openai/i, /anthropic/i, /claude/i, /gpt/i,
      /langchain/i, /llamaindex/i, /llama_index/i,
      /together/i, /fireworks/i, /groq/i, /bedrock/i,
      /chat\.completions/i, /messages\.create/i,
      /completion/i, /embed/i, /vllm/i
    ];

    const mightHaveLLMCalls = llmPatterns.some(p => p.test(content));
    if (!mightHaveLLMCalls) {
      return [];
    }

    const systemPrompt = `You are the PeakInfer Detection Agent. Your task is to identify ALL actual LLM/inference API INVOCATION callsites in code.

CRITICAL RULES:
1. ONLY detect actual API calls that invoke inference (e.g., messages.create(), chat.completions.create())
2. DO NOT detect SDK client initialization (e.g., new Anthropic(), new OpenAI()) - these are NOT callsites
3. Look for the actual model name in the code. If model is set via a variable like "this.model", look for where that variable is defined in the file

DETECTION TARGETS (from PRD taxonomy):
- Direct SDK calls: OpenAI, Anthropic, Together, Fireworks, Groq, Cohere, Bedrock
- Orchestration: LangChain, LlamaIndex, Haystack, Semantic Kernel, AutoGen, CrewAI, DSPy
- Serving runtimes: vLLM, SGLang, TensorRT-LLM, TGI, Ollama, llama.cpp
- Gateways: LiteLLM, Portkey, OpenRouter
- HTTP calls to inference APIs

OUTPUT FORMAT: Return ONLY valid JSON matching this schema:
{
  "task": "detect_callsites",
  "version": "${PROMPT_VERSION}",
  "analysis_id": "<uuid>",
  "language": "<detected language>",
  "file_path": "<file path>",
  "callsites": [
    {
      "id": "<uuid>",
      "start_line": <int>,
      "end_line": <int>,
      "invocation_code": "<the code snippet>",
      "coarse_call_kind": "direct_sdk|framework|http_api|runtime|gateway",
      "coarse_task_kind": "chat|completion|embedding|image|audio|function_call|unknown",
      "confidence": <0.0-1.0>
    }
  ]
}

IMPORTANT: Only include actual inference invocations, NOT SDK initialization.`;

    const userPrompt = `Analyze this ${language} code file for LLM inference callsites:

File: ${filePath}

\`\`\`${language}
${content.substring(0, 15000)}
\`\`\`

Return JSON with all detected callsites. If none found, return empty callsites array.`;

    try {
      const response = await this.anthropic.messages.create({
        model: this.model,
        max_tokens: this.maxTokens,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }]
      });

      const text = response.content[0];
      if (text.type !== 'text') return [];

      const parsed = this.parseJSONResponse<P1DetectResponse>(text.text);
      if (!parsed || !parsed.callsites) return [];

      return parsed.callsites.map(c => ({
        id: c.id || uuidv4(),
        file: filePath,
        line: c.start_line,
        lineEnd: c.end_line,
        code: c.invocation_code,
        provider: null,
        model: null,
        framework: null,
        runtime: null,
        taskKind: c.coarse_task_kind,
        isStreaming: null,
        patterns: [],
        confidence: c.confidence,
        language
      }));
    } catch (error) {
      this.log('P1 detection error:', error);
      return [];
    }
  }

  /**
   * P2: Classify Callsite - Deep classification
   */
  private async classifyCallsite(callsite: Callsite, fileContent: string): Promise<Callsite> {
    // Get surrounding context - expand to find class/function definitions for model resolution
    const lines = fileContent.split('\n');
    const startIdx = Math.max(0, callsite.line - 30); // Expand context to find model definitions
    const endIdx = Math.min(lines.length, callsite.lineEnd + 10);
    const context = lines.slice(startIdx, endIdx).join('\n');
    
    // Also extract the first 50 lines which often contain class properties and model definitions
    const fileHeader = lines.slice(0, 80).join('\n');

    const systemPrompt = `You are the PeakInfer Classification Agent. Precisely classify this LLM callsite.

CRITICAL: RESOLVE MODEL NAMES
If you see "this.model" or a variable, SEARCH the provided code context for where the model is defined.
Common patterns:
- "private model: string = 'claude-sonnet-4-5-20250929'" → model is "claude-sonnet-4-5-20250929"
- "this.model = 'gpt-4o'" → model is "gpt-4o"
- "model: process.env.MODEL" → model is "dynamic" (environment variable)

PROVIDER NAMES (use exact lowercase):
- "anthropic" for Anthropic (Claude models)
- "openai" for OpenAI (GPT models)
- "together" for Together AI
- "fireworks" for Fireworks AI
- "groq" for Groq
- "google" for Google (Gemini models)
- "cohere" for Cohere
- "bedrock" for AWS Bedrock

MODEL NAMES (common examples):
- Anthropic: claude-sonnet-4-5-20250929, claude-3.5-sonnet, claude-3-opus, claude-3-haiku
- OpenAI: gpt-4o, gpt-4o-mini, gpt-4-turbo, o1, o1-mini
- Google: gemini-2.0-flash, gemini-2.5-pro
- Together: llama-3-70b, mixtral-8x7b
- Groq: llama-3-70b, mixtral-8x7b

FRAMEWORK DETECTION:
- LangChain: ChatOpenAI, LLMChain, LCEL pipes
- LlamaIndex: VectorStoreIndex, ServiceContext
- DSPy: dspy.Predict, dspy.ChainOfThought
- AutoGen: AssistantAgent, UserProxyAgent

OUTPUT FORMAT: Return ONLY valid JSON:
{
  "task": "classify_callsite",
  "version": "${PROMPT_VERSION}",
  "callsite_id": "<id>",
  "provider": "<provider in lowercase>",
  "model": "<exact model name found in code, or 'dynamic' if from env var>",
  "framework": "<framework or null>",
  "runtime_or_gateway": "<runtime or null>",
  "task_kind": "chat|completion|embedding|image|audio|function_call",
  "is_streaming": true|false|null,
  "confidence": <0.0-1.0>,
  "reasoning": {
    "why_provider": "<brief explanation>",
    "why_model": "<where you found the model name in the code>"
  }
}`;

    const userPrompt = `Classify this ${callsite.language} LLM callsite:

Code:
\`\`\`${callsite.language}
${callsite.code}
\`\`\`

File Header (look for model definitions here):
\`\`\`${callsite.language}
${fileHeader}
\`\`\`

Surrounding Context:
\`\`\`${callsite.language}
${context}
\`\`\`

Callsite ID: ${callsite.id}

IMPORTANT: Search the file header and context for where the model name is defined. If you see "this.model", find the line where "this.model" or "private model" is assigned a value.`;

    try {
      const response = await this.anthropic.messages.create({
        model: this.model,
        max_tokens: this.maxTokens,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }]
      });

      const text = response.content[0];
      if (text.type !== 'text') return callsite;

      const parsed = this.parseJSONResponse<P2ClassifyResponse>(text.text);
      if (!parsed) return callsite;

      return {
        ...callsite,
        provider: parsed.provider,
        model: parsed.model,
        framework: parsed.framework,
        runtime: parsed.runtime_or_gateway,
        taskKind: parsed.task_kind || callsite.taskKind,
        isStreaming: parsed.is_streaming,
        confidence: parsed.confidence,
        reasoning: {
          whyProvider: parsed.reasoning?.why_provider,
          whyModel: parsed.reasoning?.why_model
        }
      };
    } catch (error) {
      this.log('P2 classification error:', error);
      return callsite;
    }
  }

  /**
   * P3: Estimate Usage - Token scale and frequency inference
   */
  private async estimateUsage(callsite: Callsite, fileContent: string): Promise<TokenEstimate> {
    const systemPrompt = `You are estimating token usage for an LLM callsite.

TOKEN SCALES:
- tiny: ~100 tokens (short query/response)
- small: ~500 tokens (paragraph-level)
- medium: ~2000 tokens (document chunk)
- large: ~8000 tokens (full document)
- xlarge: ~32000 tokens (long context)

FREQUENCY:
- rare: <100 calls/month
- occasional: ~1000 calls/month
- frequent: ~10000 calls/month
- very_frequent: ~100000 calls/month
- continuous: >1M calls/month

OUTPUT FORMAT: Return ONLY valid JSON:
{
  "task": "estimate_usage",
  "version": "${PROMPT_VERSION}",
  "callsite_id": "<id>",
  "frequency_kind": "rare|occasional|frequent|very_frequent|continuous",
  "input_token_scale": "tiny|small|medium|large|xlarge",
  "output_token_scale": "tiny|small|medium|large|xlarge",
  "confidence": <0.0-1.0>
}`;

    const userPrompt = `Estimate token usage for this ${callsite.provider || 'LLM'} callsite:

Code: ${callsite.code}
Model: ${callsite.model || 'unknown'}
Task: ${callsite.taskKind}

Consider: prompt construction, typical use case, whether it's in a loop, batch processing, etc.`;

    try {
      const response = await this.anthropic.messages.create({
        model: this.model,
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }]
      });

      const text = response.content[0];
      if (text.type !== 'text') return this.defaultTokenEstimate();

      const parsed = this.parseJSONResponse<P3EstimateResponse>(text.text);
      if (!parsed) return this.defaultTokenEstimate();

      return {
        inputScale: parsed.input_token_scale,
        outputScale: parsed.output_token_scale,
        frequencyKind: parsed.frequency_kind,
        estimatedInputTokens: TOKEN_SCALE_MAP[parsed.input_token_scale] * FREQUENCY_MAP[parsed.frequency_kind],
        estimatedOutputTokens: TOKEN_SCALE_MAP[parsed.output_token_scale] * FREQUENCY_MAP[parsed.frequency_kind]
      };
    } catch (error) {
      this.log('P3 estimation error:', error);
      return this.defaultTokenEstimate();
    }
  }

  private defaultTokenEstimate(): TokenEstimate {
    return {
      inputScale: 'medium',
      outputScale: 'medium',
      frequencyKind: 'frequent',
      estimatedInputTokens: 20000000,
      estimatedOutputTokens: 20000000
    };
  }

  /**
   * Normalize provider name to consistent format
   */
  private normalizeProvider(provider: string | null): string {
    if (!provider) return 'unknown';
    const normalized = provider.toLowerCase().trim();
    // Map to canonical names
    const providerMap: Record<string, string> = {
      'anthropic': 'Anthropic',
      'openai': 'OpenAI',
      'together': 'Together',
      'fireworks': 'Fireworks',
      'groq': 'Groq',
      'google': 'Google',
      'cohere': 'Cohere',
      'bedrock': 'AWS Bedrock',
      'aws': 'AWS Bedrock',
      'deepseek': 'DeepSeek',
      'mistral': 'Mistral',
    };
    return providerMap[normalized] || provider;
  }

  /**
   * Build StackMap from classified callsites
   */
  private buildStackMap(
    callsites: Callsite[],
    metadata: Omit<StackMapMetadata, 'analyzedAt' | 'version'>
  ): StackMap {
    // Normalize all callsite providers first
    const normalizedCallsites = callsites.map(cs => ({
      ...cs,
      provider: this.normalizeProvider(cs.provider)
    }));

    // Aggregate models
    const modelMap = new Map<string, ModelInfo>();
    for (const cs of normalizedCallsites) {
      const modelName = cs.model || 'unknown';
      const modelKey = `${cs.provider}:${modelName}`;
      if (!modelMap.has(modelKey)) {
        modelMap.set(modelKey, {
          name: modelName,
          provider: cs.provider || 'unknown',
          callCount: 0,
          files: [],
          estimatedTokensPerMonth: 0,
          taskKinds: []
        });
      }
      const model = modelMap.get(modelKey)!;
      model.callCount++;
      if (!model.files.includes(cs.file)) model.files.push(cs.file);
      if (!model.taskKinds.includes(cs.taskKind)) model.taskKinds.push(cs.taskKind);
      if (cs.estimatedTokens) {
        model.estimatedTokensPerMonth += (cs.estimatedTokens.estimatedInputTokens || 0) +
          (cs.estimatedTokens.estimatedOutputTokens || 0);
      }
    }

    // Aggregate vendors - use normalized provider names
    const vendorMap = new Map<string, VendorInfo>();
    for (const cs of normalizedCallsites) {
      const vendor = cs.provider || 'unknown';
      if (!vendorMap.has(vendor)) {
        vendorMap.set(vendor, {
          name: vendor,
          sdkType: cs.framework ? `via ${cs.framework}` : 'direct SDK',
          callCount: 0,
          models: [],
          files: []
        });
      }
      const v = vendorMap.get(vendor)!;
      v.callCount++;
      if (cs.model && !v.models.includes(cs.model)) v.models.push(cs.model);
      if (!v.files.includes(cs.file)) v.files.push(cs.file);
    }

    // Aggregate frameworks
    const frameworkMap = new Map<string, FrameworkInfo>();
    for (const cs of normalizedCallsites) {
      if (!cs.framework) continue;
      if (!frameworkMap.has(cs.framework)) {
        frameworkMap.set(cs.framework, {
          name: cs.framework,
          callCount: 0,
          files: []
        });
      }
      const f = frameworkMap.get(cs.framework)!;
      f.callCount++;
      if (!f.files.includes(cs.file)) f.files.push(cs.file);
    }

    // Detect patterns
    const patterns = this.detectPatterns(normalizedCallsites);

    // Infer runtimes
    const runtimes = this.inferRuntimes(normalizedCallsites);

    // Infer hardware
    const hardware = this.inferHardware(Array.from(vendorMap.values()));

    return {
      callsites: normalizedCallsites,
      models: Array.from(modelMap.values()),
      vendors: Array.from(vendorMap.values()),
      runtimes,
      hardware,
      frameworks: Array.from(frameworkMap.values()),
      patterns,
      metadata: {
        ...metadata,
        analyzedAt: new Date().toISOString(),
        version: '0.95.0',
        confidenceScores: {
          overall: this.calculateOverallConfidence(normalizedCallsites),
          callsiteDetection: normalizedCallsites.length > 0 ? normalizedCallsites.reduce((sum, c) => sum + c.confidence, 0) / normalizedCallsites.length : 0,
          modelClassification: normalizedCallsites.filter(c => c.model && c.model !== 'unknown' && c.model !== 'dynamic').length / Math.max(normalizedCallsites.length, 1),
          patternDetection: Object.values(patterns).filter(Boolean).length / 6
        }
      }
    };
  }

  /**
   * Detect patterns across callsites
   */
  private detectPatterns(callsites: Callsite[]): PatternDetection {
    const patterns: PatternDetection = {
      hasRetry: false,
      hasBatching: false,
      hasStreaming: false,
      hasCaching: false,
      hasRouting: false,
      hasFallback: false
    };

    const streamingLocations: string[] = [];
    const retryLocations: string[] = [];

    for (const cs of callsites) {
      // Streaming
      if (cs.isStreaming) {
        patterns.hasStreaming = true;
        streamingLocations.push(`${cs.file}:${cs.line}`);
      }

      // Pattern detection from code
      const code = cs.code.toLowerCase();
      if (code.includes('retry') || code.includes('backoff') || code.includes('tenacity')) {
        patterns.hasRetry = true;
        retryLocations.push(`${cs.file}:${cs.line}`);
      }
      if (code.includes('batch') || code.includes('asyncio.gather')) {
        patterns.hasBatching = true;
      }
      if (code.includes('cache') || code.includes('redis') || code.includes('gptcache')) {
        patterns.hasCaching = true;
      }
      if (code.includes('router') || code.includes('fallback') || code.includes('cascade')) {
        patterns.hasRouting = true;
      }
    }

    if (streamingLocations.length > 0) patterns.streamingLocations = streamingLocations;
    if (retryLocations.length > 0) patterns.retryLocations = retryLocations;

    return patterns;
  }

  /**
   * Infer runtimes from callsites
   */
  private inferRuntimes(callsites: Callsite[]): RuntimeInfo[] {
    const runtimes: RuntimeInfo[] = [];
    const seen = new Set<string>();

    for (const cs of callsites) {
      if (cs.runtime && !seen.has(cs.runtime)) {
        seen.add(cs.runtime);
        runtimes.push({
          name: cs.runtime,
          inferred: false,
          vendor: cs.provider || undefined
        });
      }

      // Infer from provider (use normalized names)
      const normalizedProvider = (cs.provider || '').toLowerCase();
      if (normalizedProvider && !seen.has(`inferred:${normalizedProvider}`)) {
        seen.add(`inferred:${normalizedProvider}`);
        if (normalizedProvider === 'anthropic') {
          runtimes.push({
            name: 'TensorRT-LLM (inferred)',
            inferred: true,
            vendor: 'Anthropic backend'
          });
        } else if (normalizedProvider === 'together') {
          runtimes.push({
            name: 'vLLM (inferred)',
            inferred: true,
            vendor: 'Together backend'
          });
        } else if (normalizedProvider === 'groq') {
          runtimes.push({
            name: 'LPU (inferred)',
            inferred: true,
            vendor: 'Groq LPU'
          });
        }
      }
    }

    return runtimes;
  }

  /**
   * Infer hardware from vendors
   */
  private inferHardware(vendors: VendorInfo[]): HardwareInfo[] {
    const hardware: HardwareInfo[] = [];

    for (const vendor of vendors) {
      if (vendor.name.toLowerCase() === 'anthropic') {
        hardware.push({
          type: 'NVIDIA H100 / A100',
          provider: 'Anthropic',
          inferred: true,
          source: 'vendor inference'
        });
      } else if (vendor.name.toLowerCase() === 'openai') {
        hardware.push({
          type: 'unknown (proprietary)',
          provider: 'OpenAI',
          inferred: true,
          source: 'vendor inference'
        });
      } else if (vendor.name.toLowerCase() === 'together') {
        hardware.push({
          type: 'NVIDIA H100',
          provider: 'Together',
          inferred: true,
          source: 'vendor inference'
        });
      }
    }

    return hardware;
  }

  /**
   * Calculate overall confidence
   */
  private calculateOverallConfidence(callsites: Callsite[]): number {
    if (callsites.length === 0) return 0;
    return callsites.reduce((sum, c) => sum + c.confidence, 0) / callsites.length;
  }

  /**
   * Generate suggestions by matching templates
   */
  async generateSuggestions(
    stackmap: StackMap,
    templates: OptimizationTemplate[]
  ): Promise<Suggestion[]> {
    const suggestions: Suggestion[] = [];

    // Check for missing caching
    if (!stackmap.patterns.hasCaching && stackmap.callsites.length > 0) {
      const cachingTemplate = templates.find(t =>
        t.category === 'context_optimization' ||
        t.id.includes('caching') ||
        t.name.toLowerCase().includes('cach')
      );

      suggestions.push({
        id: uuidv4(),
        location: stackmap.callsites[0] ? `${stackmap.callsites[0].file}:${stackmap.callsites[0].line}` : 'codebase',
        issue: 'No caching detected for LLM calls',
        recommendation: 'Add semantic caching for repeated prompts (Anthropic supports prompt caching)',
        templateId: cachingTemplate?.id,
        templateName: cachingTemplate?.name,
        priority: 'high',
        complexity: 'low',
        confidence: 0.9,
        expectedCostReduction: cachingTemplate?.optimization.expected_cost_reduction || '20-40%',
        effortEstimate: cachingTemplate?.optimization.effort_estimate || '1-2 days',
        implementationSteps: cachingTemplate?.implementation.automated_steps.map(s => s.name)
      });
    }

    // Check for expensive models on simple tasks
    for (const callsite of stackmap.callsites) {
      if (callsite.model?.includes('gpt-4o') && callsite.taskKind === 'chat') {
        const routingTemplate = templates.find(t =>
          t.category === 'model_routing' ||
          t.id.includes('routing')
        );

        suggestions.push({
          id: uuidv4(),
          location: `${callsite.file}:${callsite.line}`,
          issue: `${callsite.model} used - evaluate if cheaper model suffices`,
          recommendation: 'Consider gpt-4o-mini for simpler tasks, or implement model routing',
          templateId: routingTemplate?.id,
          templateName: routingTemplate?.name,
          priority: 'medium',
          complexity: 'medium',
          confidence: 0.75,
          expectedCostReduction: routingTemplate?.optimization.expected_cost_reduction || '30-50%',
          effortEstimate: routingTemplate?.optimization.effort_estimate
        });
      }
    }

    // Check for missing batching
    if (!stackmap.patterns.hasBatching && stackmap.callsites.length > 5) {
      suggestions.push({
        id: uuidv4(),
        location: 'codebase',
        issue: 'No batching detected with multiple LLM calls',
        recommendation: 'Enable batching for multiple calls (Anthropic batch API, OpenAI batch)',
        priority: 'medium',
        complexity: 'medium',
        confidence: 0.7
      });
    }

    // Check for missing retry logic
    if (!stackmap.patterns.hasRetry && stackmap.callsites.length > 0) {
      suggestions.push({
        id: uuidv4(),
        location: stackmap.callsites[0] ? `${stackmap.callsites[0].file}:${stackmap.callsites[0].line}` : 'codebase',
        issue: 'No retry logic detected',
        recommendation: 'Add exponential backoff retry for API resilience',
        priority: 'low',
        complexity: 'low',
        confidence: 0.85
      });
    }

    return suggestions;
  }

  /**
   * Parse JSON response with error handling
   */
  private parseJSONResponse<T>(text: string): T | null {
    try {
      // Try direct parse
      return JSON.parse(text);
    } catch {
      // Try extracting JSON from markdown code block
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[1]);
        } catch {
          // Fall through
        }
      }

      // Try finding JSON object
      const objectMatch = text.match(/\{[\s\S]*\}/);
      if (objectMatch) {
        try {
          return JSON.parse(objectMatch[0]);
        } catch {
          // Fall through
        }
      }

      this.log('Failed to parse JSON response:', text.substring(0, 200));
      return null;
    }
  }

  /**
   * Detect language from file extension
   */
  private detectLanguage(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const langMap: Record<string, string> = {
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.mjs': 'javascript',
      '.py': 'python',
      '.go': 'go',
      '.java': 'java',
      '.kt': 'kotlin',
      '.yaml': 'yaml',
      '.yml': 'yaml',
      '.json': 'json',
      '.toml': 'toml'
    };
    return langMap[ext] || 'unknown';
  }
}

