/**
 * Agent-Based Analyzer — Claude Code SDK Powered
 *
 * Uses the Claude Agent SDK to intelligently analyze codebases.
 * Instead of scanning every file, Claude decides what to look at.
 *
 * This is the "Claude Code init" style approach:
 * - Send file tree to Claude
 * - Claude uses tools (glob, grep, read) to explore
 * - Returns structured analysis in 2-3 API calls
 */

import { query, type SDKMessage, type SDKResultMessage } from '@anthropic-ai/claude-agent-sdk';
import * as path from 'path';
import * as fs from 'fs';
import type { ClassifiedCallsite, StackMap, PricingSummary, TechStack } from './types.js';
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
  totalCostUsd: number;
  durationMs: number;
}

export interface AgentAnalysisOptions {
  /** Maximum turns for the agent (default: 10) */
  maxTurns?: number;
  /** Show progress messages */
  onProgress?: (message: string) => void;
  /** Abort signal */
  abortController?: AbortController;
}

// =============================================================================
// PROMPT TEMPLATE
// =============================================================================

const ANALYSIS_PROMPT = `You are analyzing a codebase to find all LLM/AI API callsites AND map the complete inference tech stack.

Your task:
1. Find every place in the codebase that makes calls to LLM providers
2. Identify the full tech stack from Application layer down to Hardware

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

## Your approach:

1. Use Glob to find source files (*.ts, *.js, *.py, *.go, *.java) and config files (*.yaml, *.json, *.toml, Dockerfile, requirements.txt, package.json)
2. Use Grep to search for LLM-related imports, cloud services, and infrastructure patterns
3. Read relevant files to extract details
4. Check for infrastructure configs (terraform, docker, k8s manifests)

## Output format:

Return a JSON object with TWO fields:

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
      "code": "<the actual code snippet>"
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
  }
}

Provider values: openai, anthropic, google, mistral, cohere, together, fireworks, groq, aws-bedrock, gcp-vertex, azure-openai, databricks, vllm, langchain, llamaindex, litellm, other

If you can't determine exact values, use empty arrays. Set hardware.estimated=true if GPUs are inferred from platform/runtime rather than explicit config.

Be thorough but efficient. Use grep to narrow down before reading files.

Return ONLY the JSON object at the end, no markdown code blocks.`;

// =============================================================================
// MAIN ANALYZER
// =============================================================================

/**
 * Analyze a codebase using the Claude Agent SDK.
 *
 * This is much faster than the file-by-file approach because:
 * 1. Claude decides what files to look at
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

  onProgress?.('Starting agent analysis...');

  let resultText = '';
  let totalCost = 0;

  try {
    // Use the Claude Agent SDK to analyze
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
        // Extract text content from assistant message
        const textContent = (message.message.content as Array<{ type: string; text?: string }>)
          .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
          .map((c) => c.text)
          .join('');

        if (textContent) {
          onProgress?.('Claude is analyzing...');
        }
      } else if (message.type === 'result') {
        if (message.subtype === 'success') {
          resultText = message.result;
          totalCost = message.total_cost_usd;
          onProgress?.(`Analysis complete (cost: $${totalCost.toFixed(4)})`);
        } else {
          // Handle error subtypes: error_during_execution, error_max_turns, error_max_budget_usd
          const errorResult = message as {
            subtype: string;
            errors?: string[];
            total_cost_usd: number;
          };
          const errorMessages = errorResult.errors?.join(', ') || `Analysis stopped: ${errorResult.subtype}`;
          throw new Error(errorMessages);
        }
      }
    }

    // Parse the result (now includes techStack)
    const { callsites, techStack } = parseResultWithTechStack(resultText, root);

    // Initialize pricing engine (fetches real-time data from LiteLLM)
    onProgress?.('Loading pricing data...');
    await initPricingEngine();

    // Build derived data structures
    const stackMap = buildStackMap(callsites, root);
    const pricing = calculatePricing(callsites);

    return {
      callsites,
      stackMap,
      pricing,
      techStack,
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

/**
 * Parse result containing both callsites and techStack.
 */
function parseResultWithTechStack(resultText: string, root: string): { callsites: ClassifiedCallsite[]; techStack: TechStack } {
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
          return { callsites, techStack: getEmptyTechStack() };
        }
        console.error('Could not find JSON in result:', resultText.slice(0, 500));
        return { callsites: [], techStack: getEmptyTechStack() };
      }
    }

    // Handle new format: { callsites: [...], techStack: {...} }
    if (json && typeof json === 'object' && 'callsites' in json) {
      const result = json as { callsites?: unknown[]; techStack?: unknown };
      const callsites = Array.isArray(result.callsites) ? parseCallsitesArray(result.callsites) : [];
      const techStack = parseTechStack(result.techStack);
      return { callsites, techStack };
    }

    // Handle old format: just an array of callsites
    if (Array.isArray(json)) {
      return { callsites: parseCallsitesArray(json), techStack: getEmptyTechStack() };
    }

    console.error('Unexpected result format:', json);
    return { callsites: [], techStack: getEmptyTechStack() };
  } catch (error) {
    console.error('Failed to parse result:', error);
    return { callsites: [], techStack: getEmptyTechStack() };
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

  const { callsites, techStack } = parseResultWithTechStack(resultText, root);

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
      totalCostUsd: totalCost,
      durationMs: Date.now() - startTime,
    },
  };
}
