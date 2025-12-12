/**
 * Agent-Based Analyzer
 *
 * Uses AI agents to intelligently analyze codebases.
 * Instead of scanning every file, the agent decides what to look at.
 *
 * Approach:
 * - Send file tree to agent
 * - Agent uses tools (glob, grep, read) to explore
 * - Returns structured analysis in 2-3 API calls
 */

import { query, type SDKMessage, type SDKResultMessage } from '@anthropic-ai/claude-agent-sdk';
import * as path from 'path';
import * as fs from 'fs';
import type { ClassifiedCallsite, StackMap, PricingSummary, TechStack, InferencePatterns, PatternInstance } from './types.js';
import { buildStackMap } from './stackmap.js';
import { calculatePricing, initPricingEngine } from './pricing.js';

// =============================================================================
// TYPES
// =============================================================================

export interface AgentAnalysisResult {
  callsites: ClassifiedCallsite[];
  stackMap: StackMap;
  pricing: PricingSummary;
  techStack: TechStack;
  patterns: InferencePatterns;
  totalCostUsd: number;
  durationMs: number;
}

/**
 * Progress event types for rich progress reporting.
 */
export interface AnalysisProgressEvent {
  /** Event type */
  type: 'start' | 'turn' | 'tool_use' | 'tool_result' | 'complete' | 'error';
  /** Current turn number */
  turn?: number;
  /** Maximum turns */
  maxTurns?: number;
  /** Tool name being used (Glob, Grep, Read) */
  toolName?: string;
  /** Target of the tool (file pattern, search term, etc.) */
  toolTarget?: string;
  /** Human-readable message */
  message?: string;
  /** Cost so far in USD */
  costSoFar?: number;
}

export interface AgentAnalysisOptions {
  /** Maximum turns for the agent (default: 10) */
  maxTurns?: number;
  /** Show progress messages (enhanced to support rich events) */
  onProgress?: (event: AnalysisProgressEvent | string) => void;
  /** Abort signal */
  abortController?: AbortController;
}

// =============================================================================
// PROMPT TEMPLATE
// =============================================================================

const ANALYSIS_PROMPT = `You are analyzing a codebase to find all LLM/AI API callsites, map the complete inference tech stack, AND detect inference patterns.

Your task:
1. Find every place in the codebase that makes calls to LLM providers
2. Identify the full tech stack from Application layer down to Hardware
3. Detect inference patterns (retry, batching, streaming, caching, routing, fallback, guardrails)
4. Provide AGNOSTIC optimization suggestions. Do not bias towards the current provider. If a task is simple (e.g. summarization, extraction), suggest cheaper alternatives like Llama-3, Gemini Flash, or Claude Haiku.

## What to look for:

**APPLICATION LAYER:**
- Orchestration Frameworks: LangChain, LlamaIndex, Haystack, AutoGen, CrewAI, DSPy, Semantic Kernel
- SDKs: openai, anthropic, google-generativeai, cohere, mistralai, together, groq
- Patterns: RAG, agents, chains, prompt templates, memory, retrieval

**SERVING LAYER:**
- Runtimes: vLLM, SGLang, TensorRT-LLM, TGI (text-generation-inference), llama.cpp, Ollama, MLX, llama-cpp-python
- Gateways: LiteLLM, Portkey, Helicone, OpenRouter
- Platforms: Together AI, Fireworks AI, Groq, Replicate, Baseten, Modal, Anyscale, RunPod

**INFRASTRUCTURE LAYER:**
- Cloud AI: AWS Bedrock, AWS SageMaker, GCP Vertex AI, Azure OpenAI, Azure ML, Databricks
- Compute: EC2, GCE, Lambda, Cloud Run, ECS, GKE, AKS
- Orchestration: Kubernetes, Docker, Ray, Modal, Sky Pilot

**HARDWARE LAYER (infer from context):**
- NVIDIA GPUs: H100, A100, A10G, L4, T4, V100, RTX 4090
- Cloud Accelerators: AWS Inferentia, AWS Trainium, Google TPU
- Look for: GPU requirements in configs, instance types, runtime flags

**INFERENCE PATTERNS TO DETECT:**
- Retry: tenacity, backoff, @retry decorators, exponential backoff, max_retries, circuit breakers
- Batching: asyncio.gather, batch parameter, concurrent.futures, parallel requests
- Streaming: stream=True, SSE, for chunk in response, async iteration
- Caching: redis, memcached, gptcache, semantic cache, lru_cache, prompt caching, cache_control
- Routing: model selection logic, router, cascade patterns, A/B testing, cost-based selection
- Fallback: try/except with alternative provider, fallback_model, on_fail handlers
- Guardrails: nemoguardrails, guardrails-ai, llm_guard, content moderation, PII detection, input validation

## Your approach:

1. Use Glob to find source files (*.ts, *.js, *.py, *.go, *.java) and config files (*.yaml, *.json, *.toml, Dockerfile, requirements.txt, package.json)
2. Use Grep to search for LLM-related imports, cloud services, infrastructure patterns, AND inference patterns
3. Read relevant files to extract details
4. Check for infrastructure configs (terraform, docker, k8s manifests)

## Output format:

Return a JSON object with THREE fields:

{
  "callsites": [
    {
      "id": "<unique-id>",
      "file": "<relative-path>",
      "line": <line-number>,
      "provider": "<provider-name or null>",
      "model": "<model-name or null>",
      "framework": "<framework-name or null>",
      "runtime": "<runtime if detected or null>",
      "taskKind": "<chat|completion|embedding|image|audio|other>",
      "confidence": <0.0-1.0>,
      "code": "<the actual code snippet>",
      "optimizationSuggestion": "<specific advice based on task complexity. Suggest the cheapest viable model regardless of provider (e.g. 'switch to Llama-3-8b or Gemini Flash for this simple task')>"
    }
  ],
  "techStack": {
    "application": {
      "frameworks": ["langchain", "llamaindex"],
      "sdks": ["openai", "anthropic"],
      "patterns": ["RAG", "agents"]
    },
    "serving": {
      "runtimes": ["vLLM"],
      "gateways": ["LiteLLM"],
      "platforms": ["Together AI", "Groq"]
    },
    "infrastructure": {
      "cloud": ["AWS Bedrock", "GCP Vertex"],
      "compute": ["EC2", "Lambda"],
      "orchestration": ["Kubernetes", "Docker"]
    },
    "hardware": {
      "gpus": ["A100", "H100"],
      "accelerators": [],
      "estimated": true
    }
  },
  "patterns": {
    "retry": {
      "detected": true,
      "instances": [{"file": "src/llm.py", "line": 45}],
      "type": "exponential_backoff"
    },
    "batching": {
      "detected": false,
      "instances": []
    },
    "streaming": {
      "detected": true,
      "instances": [{"file": "src/chat.py", "line": 89}],
      "type": "sse"
    },
    "caching": {
      "detected": false,
      "instances": []
    },
    "routing": {
      "detected": false,
      "instances": []
    },
    "fallback": {
      "detected": true,
      "instances": [{"file": "src/llm.py", "line": 78}],
      "type": "provider_fallback"
    },
    "guardrails": {
      "detected": false,
      "instances": []
    }
  }
}

Provider values: openai, anthropic, google, mistral, cohere, together, fireworks, groq, aws-bedrock, gcp-vertex, azure-openai, databricks, vllm, langchain, llamaindex, litellm, other

Pattern types:
- retry: exponential_backoff, fixed_delay, circuit_breaker, tenacity, other
- batching: client_side, server_side, continuous, offline_batch_api, other
- streaming: sse, websocket, chunked, other
- caching: exact_match, semantic, kv_cache, prompt_caching, disk, other
- routing: static, cost_based, latency_based, quality_based, cascade, ab_test, other
- fallback: provider_fallback, model_fallback, graceful_degradation, other
- guardrails: input_validation, output_validation, pii_detection, content_moderation, nemo, guardrails_ai, other

If you can't determine exact values, use empty arrays. Set hardware.estimated=true if GPUs are inferred from platform/runtime rather than explicit config.

Be thorough but efficient. Use grep to narrow down before reading files.

Return ONLY the JSON object at the end, no markdown code blocks.`;

// =============================================================================
// MAIN ANALYZER
// =============================================================================

/**
 * Analyze a codebase using AI agents.
 *
 * This is much faster than the file-by-file approach because:
 * 1. The agent decides what files to look at
 * 2. Uses grep/glob to narrow down candidates
 * 3. Only reads relevant files
 * 4. Single coherent analysis instead of per-file
 */
export async function analyzeWithAgent(
  targetPath: string,
  options: AgentAnalysisOptions = {}
): Promise<AgentAnalysisResult> {
  const startTime = Date.now();
  const root = path.resolve(targetPath);

  // Validate path exists
  if (!fs.existsSync(root)) {
    throw new Error(`Path does not exist: ${root}`);
  }

  const { maxTurns = 10, onProgress, abortController } = options;

  // Helper to emit progress events (supports both string and object format)
  const emitProgress = (event: AnalysisProgressEvent | string) => {
    onProgress?.(event);
  };

  emitProgress({ type: 'start', maxTurns, message: 'Starting agent analysis...' });

  let resultText = '';
  let totalCost = 0;
  let currentTurn = 0;

  try {
    // Use the agent SDK to analyze
    for await (const message of query({
      prompt: ANALYSIS_PROMPT,
      options: {
        cwd: root,
        allowedTools: ['Read', 'Grep', 'Glob'],
        permissionMode: 'bypassPermissions',
        maxTurns,
        abortController,
        model: 'claude-sonnet-4-5-20250929',
        // Pass through relevant environment variables
        env: {
          ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
          HOME: process.env.HOME,
          PATH: process.env.PATH,
        },
      },
    })) {
      // Handle different message types
      if (message.type === 'assistant') {
        currentTurn++;
        
        // Emit turn progress
        emitProgress({ 
          type: 'turn', 
          turn: currentTurn, 
          maxTurns,
          message: 'analyzing...'
        });

        // Extract tool uses from assistant message
        const toolUses = (message.message.content as Array<{ type: string; name?: string; input?: unknown }>)
          .filter((c): c is { type: 'tool_use'; name: string; input: unknown } => c.type === 'tool_use');

        // Emit tool use events
        for (const tool of toolUses) {
          let toolTarget: string | undefined;
          
          // Extract target info based on tool type
          if (tool.input && typeof tool.input === 'object') {
            const input = tool.input as Record<string, unknown>;
            if (tool.name === 'Glob' && typeof input.pattern === 'string') {
              toolTarget = input.pattern;
            } else if (tool.name === 'Grep' && typeof input.pattern === 'string') {
              toolTarget = input.pattern;
            } else if (tool.name === 'Read' && typeof input.file_path === 'string') {
              // Show just the filename for Read
              const filePath = input.file_path as string;
              toolTarget = filePath.split('/').pop() || filePath;
            }
          }

          emitProgress({
            type: 'tool_use',
            turn: currentTurn,
            maxTurns,
            toolName: tool.name,
            toolTarget,
          });
        }
      } else if (message.type === 'result') {
        if (message.subtype === 'success') {
          resultText = message.result;
          totalCost = message.total_cost_usd;
          emitProgress({ 
            type: 'complete', 
            turn: currentTurn, 
            maxTurns,
            costSoFar: totalCost,
            message: `Analysis complete (cost: $${totalCost.toFixed(4)})`
          });
        } else {
          // Handle error subtypes: error_during_execution, error_max_turns, error_max_budget_usd
          const errorResult = message as {
            subtype: string;
            errors?: string[];
            total_cost_usd: number;
            result?: string;
          };

          // If we have partial results despite the error, try to use them
          if (errorResult.result && errorResult.subtype === 'error_max_turns') {
            resultText = errorResult.result;
            totalCost = errorResult.total_cost_usd;
            emitProgress({ 
              type: 'complete', 
              turn: currentTurn, 
              maxTurns,
              costSoFar: totalCost,
              message: `Analysis hit turn limit but has partial results (cost: $${totalCost.toFixed(4)})`
            });
            // Don't throw - continue with partial results
          } else {
            const errorMessages = errorResult.errors?.join(', ') || `Analysis stopped: ${errorResult.subtype}`;

            emitProgress({ 
              type: 'error', 
              turn: currentTurn, 
              maxTurns,
              message: errorMessages 
            });

            // Provide more helpful error messages based on subtype
            if (errorResult.subtype === 'error_max_turns') {
              throw new Error(`Analysis exceeded max turns (${maxTurns}). Try running on a smaller directory or increase timeout.`);
            } else if (errorResult.subtype === 'error_max_budget_usd') {
              throw new Error('Analysis exceeded budget limit.');
            } else {
              throw new Error(errorMessages);
            }
          }
        }
      }
    }

    // Parse the result (now includes techStack and patterns)
    const { callsites, techStack, patterns } = parseResultWithTechStack(resultText, root);

    // Initialize pricing engine (fetches real-time data from LiteLLM)
    emitProgress({ type: 'turn', turn: currentTurn, maxTurns, message: 'Loading pricing data...' });
    await initPricingEngine();

    // Build derived data structures
    const stackMap = buildStackMap(callsites, root);
    const pricing = calculatePricing(callsites);

    return {
      callsites,
      stackMap,
      pricing,
      techStack,
      patterns,
      totalCostUsd: totalCost,
      durationMs: Date.now() - startTime,
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Analysis was cancelled');
    }
    // Re-throw with more context if it's a generic error
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Analysis failed: ${String(error)}`);
  }
}

// =============================================================================
// RESULT PARSING
// =============================================================================

/** Default empty tech stack */
function getEmptyTechStack(): TechStack {
  return {
    application: { frameworks: [], sdks: [], patterns: [] },
    serving: { runtimes: [], gateways: [], platforms: [] },
    infrastructure: { cloud: [], compute: [], orchestration: [] },
    hardware: { gpus: [], accelerators: [], estimated: true },
  };
}

/** Default empty patterns */
function getEmptyPatterns(): InferencePatterns {
  return {
    retry: { detected: false, instances: [] },
    batching: { detected: false, instances: [] },
    streaming: { detected: false, instances: [] },
    caching: { detected: false, instances: [] },
    routing: { detected: false, instances: [] },
    fallback: { detected: false, instances: [] },
    guardrails: { detected: false, instances: [] },
  };
}

/**
 * Parse result containing callsites, techStack, and patterns.
 */
function parseResultWithTechStack(resultText: string, root: string): { callsites: ClassifiedCallsite[]; techStack: TechStack; patterns: InferencePatterns } {
  try {
    let json: unknown;

    // First try direct parse
    try {
      json = JSON.parse(resultText);
    } catch {
      // Try to find JSON object in the text
      const jsonMatch = resultText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        json = JSON.parse(jsonMatch[0]);
      } else {
        // Fallback: try to find just an array (old format)
        const arrayMatch = resultText.match(/\[[\s\S]*\]/);
        if (arrayMatch) {
          const callsites = parseCallsitesArray(JSON.parse(arrayMatch[0]));
          return { callsites, techStack: getEmptyTechStack(), patterns: getEmptyPatterns() };
        }
        console.error('Could not find JSON in result:', resultText.slice(0, 500));
        return { callsites: [], techStack: getEmptyTechStack(), patterns: getEmptyPatterns() };
      }
    }

    // Handle new format: { callsites: [...], techStack: {...}, patterns: {...} }
    if (json && typeof json === 'object' && 'callsites' in json) {
      const result = json as { callsites?: unknown[]; techStack?: unknown; patterns?: unknown };
      const callsites = Array.isArray(result.callsites) ? parseCallsitesArray(result.callsites) : [];
      const techStack = parseTechStack(result.techStack);
      const patterns = parsePatterns(result.patterns);
      return { callsites, techStack, patterns };
    }

    // Handle old format: just an array of callsites
    if (Array.isArray(json)) {
      return { callsites: parseCallsitesArray(json), techStack: getEmptyTechStack(), patterns: getEmptyPatterns() };
    }

    console.error('Unexpected result format:', json);
    return { callsites: [], techStack: getEmptyTechStack(), patterns: getEmptyPatterns() };
  } catch (error) {
    console.error('Failed to parse result:', error);
    return { callsites: [], techStack: getEmptyTechStack(), patterns: getEmptyPatterns() };
  }
}

/**
 * Parse callsites array.
 */
function parseCallsitesArray(items: unknown[]): ClassifiedCallsite[] {
  return items
    .filter((item): item is Record<string, unknown> =>
      item !== null && typeof item === 'object'
    )
    .map((item, index) => {
      const reasoning = item.reasoning as Record<string, unknown> | undefined;
      return {
        id: String(item.id || `callsite-${index}`),
        file: String(item.file || ''),
        line: Number(item.line) || 0,
        provider: item.provider ? String(item.provider) : null,
        model: item.model ? String(item.model) : null,
        framework: item.framework ? String(item.framework) : null,
        runtime: item.runtime ? String(item.runtime) : null,
        taskKind: String(item.taskKind || 'other'),
        isStreaming: item.isStreaming === true ? true : item.isStreaming === false ? false : null,
        confidence: Number(item.confidence) || 0.5,
        reasoning: {
          whyProvider: String(reasoning?.whyProvider || item.code || ''),
          whyModel: String(reasoning?.whyModel || ''),
        },
        optimizationSuggestion: item.optimizationSuggestion ? String(item.optimizationSuggestion) : undefined,
      };
    })
    .filter((cs) => cs.file && cs.line > 0);
}

/**
 * Parse tech stack from result.
 */
function parseTechStack(raw: unknown): TechStack {
  const empty = getEmptyTechStack();
  if (!raw || typeof raw !== 'object') return empty;

  const ts = raw as Record<string, unknown>;

  const parseStringArray = (obj: unknown, key: string): string[] => {
    if (!obj || typeof obj !== 'object') return [];
    const arr = (obj as Record<string, unknown>)[key];
    if (!Array.isArray(arr)) return [];
    return arr.filter((x): x is string => typeof x === 'string');
  };

  return {
    application: {
      frameworks: parseStringArray(ts.application, 'frameworks'),
      sdks: parseStringArray(ts.application, 'sdks'),
      patterns: parseStringArray(ts.application, 'patterns'),
    },
    serving: {
      runtimes: parseStringArray(ts.serving, 'runtimes'),
      gateways: parseStringArray(ts.serving, 'gateways'),
      platforms: parseStringArray(ts.serving, 'platforms'),
    },
    infrastructure: {
      cloud: parseStringArray(ts.infrastructure, 'cloud'),
      compute: parseStringArray(ts.infrastructure, 'compute'),
      orchestration: parseStringArray(ts.infrastructure, 'orchestration'),
    },
    hardware: {
      gpus: parseStringArray(ts.hardware, 'gpus'),
      accelerators: parseStringArray(ts.hardware, 'accelerators'),
      estimated: (ts.hardware as Record<string, unknown>)?.estimated !== false,
    },
  };
}

/**
 * Parse inference patterns from result.
 */
function parsePatterns(raw: unknown): InferencePatterns {
  const empty = getEmptyPatterns();
  if (!raw || typeof raw !== 'object') return empty;

  const p = raw as Record<string, unknown>;

  const parsePattern = (patternData: unknown): { detected: boolean; instances: PatternInstance[]; type?: string } => {
    if (!patternData || typeof patternData !== 'object') {
      return { detected: false, instances: [] };
    }

    const pd = patternData as Record<string, unknown>;
    const detected = pd.detected === true;
    const instances: PatternInstance[] = [];

    if (Array.isArray(pd.instances)) {
      for (const inst of pd.instances) {
        if (inst && typeof inst === 'object') {
          const i = inst as Record<string, unknown>;
          if (typeof i.file === 'string' && typeof i.line === 'number') {
            instances.push({
              file: i.file,
              line: i.line,
              code: typeof i.code === 'string' ? i.code : undefined,
            });
          }
        }
      }
    }

    return {
      detected,
      instances,
      type: typeof pd.type === 'string' ? pd.type : undefined,
    };
  };

  return {
    retry: parsePattern(p.retry) as InferencePatterns['retry'],
    batching: parsePattern(p.batching) as InferencePatterns['batching'],
    streaming: parsePattern(p.streaming) as InferencePatterns['streaming'],
    caching: parsePattern(p.caching) as InferencePatterns['caching'],
    routing: parsePattern(p.routing) as InferencePatterns['routing'],
    fallback: parsePattern(p.fallback) as InferencePatterns['fallback'],
    guardrails: parsePattern(p.guardrails) as InferencePatterns['guardrails'],
  };
}

// =============================================================================
// STREAMING VARIANT (for real-time updates)
// =============================================================================

/**
 * Analyze with real-time streaming updates.
 * Yields progress messages as the agent works.
 */
export async function* analyzeWithAgentStreaming(
  targetPath: string,
  options: Omit<AgentAnalysisOptions, 'onProgress'> = {}
): AsyncGenerator<{ type: 'progress' | 'result'; data: string | AgentAnalysisResult }> {
  const startTime = Date.now();
  const root = path.resolve(targetPath);

  if (!fs.existsSync(root)) {
    throw new Error(`Path does not exist: ${root}`);
  }

  const { maxTurns = 10, abortController } = options;

  yield { type: 'progress', data: 'Starting agent analysis...' };

  let resultText = '';
  let totalCost = 0;

  for await (const message of query({
    prompt: ANALYSIS_PROMPT,
    options: {
      cwd: root,
      allowedTools: ['Read', 'Grep', 'Glob'],
      permissionMode: 'bypassPermissions',
      maxTurns,
      abortController,
      model: 'claude-sonnet-4-5-20250929',
      // Pass through relevant environment variables
      env: {
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
        HOME: process.env.HOME,
        PATH: process.env.PATH,
      },
    },
  })) {
    if (message.type === 'assistant') {
      // Check for tool use
      const toolUses = (message.message.content as Array<{ type: string; name?: string }>).filter(
        (c): c is { type: 'tool_use'; name: string } => c.type === 'tool_use'
      );

      for (const tool of toolUses) {
        yield { type: 'progress', data: `Using ${tool.name}...` };
      }
    } else if (message.type === 'result' && message.subtype === 'success') {
      resultText = message.result;
      totalCost = message.total_cost_usd;
    }
  }

  const { callsites, techStack, patterns } = parseResultWithTechStack(resultText, root);

  // Initialize pricing engine for streaming variant too
  await initPricingEngine();

  const stackMap = buildStackMap(callsites, root);
  const pricing = calculatePricing(callsites);

  yield {
    type: 'result',
    data: {
      callsites,
      stackMap,
      pricing,
      techStack,
      patterns,
      totalCostUsd: totalCost,
      durationMs: Date.now() - startTime,
    },
  };
}
