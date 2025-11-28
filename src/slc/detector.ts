/**
 * Detector Module — LLM-Powered Callsite Detection
 *
 * Responsibility (per Tech Design v1.1):
 * - P1: Detect callsites in code chunks (high recall)
 * - P2: Classify each callsite precisely
 *
 * Design: Thin wrapper around the SDK with retry logic.
 * All intelligence lives in prompts; validation in validator.ts.
 */

import Anthropic from '@anthropic-ai/sdk';
import { validateP1Response, validateP2Response } from './validator.js';
import type { CodeChunk, RawCallsite, ClassifiedCallsite } from './types.js';

// =============================================================================
// CONFIGURATION
// =============================================================================

/** Model for detection (cost-effective, fast) */
const MODEL = 'claude-sonnet-4-20250514';

/** Max tokens for responses */
const MAX_TOKENS = 4096;

/** Retry configuration */
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

/** Request timeout (ms) */
const TIMEOUT_MS = 30000;

// =============================================================================
// PROMPTS (Tech Design v1.1 — modular, versioned)
// Full 23-category taxonomy coverage per PRD Appendix B
// =============================================================================

/** P1: Detect callsites prompt with full taxonomy */
const P1_SYSTEM = `You are an expert code analyzer specializing in LLM/AI inference detection.
Analyze the provided code chunk and identify ALL potential LLM API callsites.

Return JSON with this exact schema:
{
  "task": "detect_callsites",
  "version": "1.0",
  "callsites": [
    {
      "id": "<unique-id>",
      "file": "<filename>",
      "startLine": <int>,
      "endLine": <int>,
      "code": "<invocation code snippet>",
      "coarseKind": "<chat|completion|embedding|image|audio|other>",
      "confidence": <0.0-1.0>
    }
  ]
}

DETECTION TAXONOMY (check ALL categories):

1. MODEL PROVIDERS (First-Party APIs):
   - OpenAI: openai SDK, ChatCompletion, Completion, Embedding, DALL-E, Whisper
   - Anthropic: anthropic SDK, messages.create, claude models
   - Google: google.generativeai, vertexai, gemini, palm
   - Meta: llama models via any provider
   - Mistral: mistral SDK, mixtral models
   - Cohere: cohere SDK, command models, embed, rerank
   - AI21: ai21 SDK, jamba, jurassic
   - DeepSeek: deepseek SDK or API calls
   - xAI: grok models

2. INFERENCE HOSTS / NEOCLOUDS:
   - Together AI: together SDK, api.together.xyz
   - Fireworks AI: fireworks SDK, api.fireworks.ai
   - Baseten: baseten SDK, Truss configs
   - Modal: modal decorator, @stub.function
   - Replicate: replicate SDK, api.replicate.com
   - Anyscale: anyscale SDK, Ray Serve
   - Groq: groq SDK, api.groq.com
   - Cerebras: cerebras SDK
   - DeepInfra: deepinfra SDK

3. HYPERSCALER ML PLATFORMS:
   - AWS Bedrock: boto3.client('bedrock-runtime')
   - AWS SageMaker: sagemaker SDK
   - GCP Vertex AI: google.cloud.aiplatform, vertexai
   - Azure OpenAI: azure.identity, openai.api_type = "azure"
   - Azure ML: azureml SDK
   - Databricks: databricks SDK, /serving-endpoints/

4. SERVING RUNTIMES:
   - vLLM: vllm imports, LLM() class, SamplingParams
   - SGLang: sglang imports, @function decorator
   - TensorRT-LLM: tensorrt_llm imports
   - TGI: text_generation SDK
   - llama.cpp: llama_cpp imports, Llama() class
   - Ollama: ollama SDK, localhost:11434
   - MLX: mlx imports, mlx_lm

5. ORCHESTRATION FRAMEWORKS:
   - LangChain: langchain imports, ChatOpenAI, LLMChain, LCEL
   - LlamaIndex: llama_index imports, VectorStoreIndex
   - Haystack: haystack imports, Pipeline
   - Semantic Kernel: semantic_kernel imports
   - AutoGen: autogen imports, AssistantAgent
   - CrewAI: crewai imports, Agent, Crew
   - DSPy: dspy imports, dspy.Predict
   - Guidance: guidance imports, @guidance decorator
   - Instructor: instructor imports
   - LiteLLM: litellm imports

6. LLM GATEWAYS:
   - LiteLLM: litellm.completion()
   - Portkey: portkey SDK, x-portkey headers
   - Helicone: helicone headers, oai.hconeai.com
   - OpenRouter: openrouter.ai endpoint
   - Martian: martian imports

7. AGENTIC/TOOL USE:
   - OpenAI Function Calling: tools parameter, function_call
   - Anthropic Tool Use: tools in messages API
   - LangGraph: langgraph imports
   - MCP: mcp imports, MCP server configs

8. EMBEDDING MODELS:
   - OpenAI: text-embedding-3-large/small, ada-002
   - Cohere: embed-english-v3, embed-multilingual
   - Voyage AI: voyage SDK
   - Jina AI: jina-embeddings
   - HuggingFace: sentence-transformers

9. VECTOR STORES (RAG indicators):
   - Pinecone, Weaviate, Milvus, Qdrant, Chroma, FAISS, pgvector

10. GUARDRAILS/SAFETY:
    - NeMo Guardrails: nemoguardrails imports
    - Guardrails AI: guardrails imports
    - Llama Guard, LLM Guard

Be thorough (high recall). Downstream validation filters false positives.
Return ONLY valid JSON, no markdown code blocks.`;

/** P2: Classify callsite prompt with full taxonomy */
const P2_SYSTEM = `You are an expert at classifying LLM inference callsites.
Given a callsite and surrounding context, determine the exact provider, model, and configuration.

Return JSON with this exact schema:
{
  "task": "classify_callsite",
  "version": "1.0",
  "callsiteId": "<id>",
  "provider": "<provider-name|null>",
  "model": "<model-name|null>",
  "framework": "<framework-name|null>",
  "runtime": "<runtime-name|null>",
  "taskKind": "<chat|completion|embedding|image|audio|rerank|other>",
  "isStreaming": <true|false|null>,
  "confidence": <0.0-1.0>,
  "reasoning": {
    "whyProvider": "<brief explanation>",
    "whyModel": "<brief explanation>"
  }
}

PROVIDER VALUES:
openai, anthropic, google, meta, mistral, cohere, ai21, deepseek, xai,
together, fireworks, baseten, modal, replicate, anyscale, groq, cerebras,
aws-bedrock, aws-sagemaker, gcp-vertex, azure-openai, databricks, other

FRAMEWORK VALUES:
langchain, llamaindex, haystack, semantic-kernel, autogen, crewai,
dspy, guidance, instructor, litellm, other, null

RUNTIME VALUES:
vllm, sglang, tensorrt-llm, tgi, llama-cpp, ollama, mlx, other, null

MODEL DETECTION:
- Look for model parameter, model_name, deployment_name
- Check environment variables referenced
- Infer from SDK patterns (e.g., ChatOpenAI defaults to gpt-3.5-turbo)
- Common models: gpt-4o, gpt-4o-mini, gpt-4-turbo, gpt-3.5-turbo,
  claude-3-5-sonnet, claude-3-opus, claude-3-haiku,
  gemini-1.5-pro, gemini-1.5-flash, llama-3-70b, mixtral-8x7b

Be precise. If uncertain, use null and lower confidence.
Return ONLY valid JSON, no markdown code blocks.`;

// =============================================================================
// DETECTOR INTERFACE
// =============================================================================

export interface ClaudeDetector {
  detectCallsites(chunk: CodeChunk): Promise<RawCallsite[]>;
  classifyCallsite(callsite: RawCallsite, context: string): Promise<ClassifiedCallsite | null>;
}

// =============================================================================
// RETRY HELPER
// =============================================================================

/**
 * Sleep for specified milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff.
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = MAX_RETRIES
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // Don't retry on auth errors
      if (lastError.message?.includes('401') || lastError.message?.includes('403')) {
        throw lastError;
      }

      // Exponential backoff
      if (attempt < maxRetries - 1) {
        await sleep(RETRY_DELAY_MS * Math.pow(2, attempt));
      }
    }
  }

  throw lastError;
}

/**
 * Extract JSON from response text (handles markdown code blocks).
 */
function extractJSON(text: string): unknown {
  // Try direct parse first
  try {
    return JSON.parse(text);
  } catch {
    // Try extracting from markdown code block
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[1].trim());
    }
    throw new Error('Failed to parse JSON response');
  }
}

// =============================================================================
// IMPLEMENTATION
// =============================================================================

/**
 * Create a Claude detector instance.
 *
 * @param apiKey - Anthropic API key (required for SLC completeness)
 * @returns ClaudeDetector instance
 * @throws Error if API key is missing
 */
export function createDetector(apiKey: string): ClaudeDetector {
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is required for PeakInfer analysis');
  }

  const client = new Anthropic({ apiKey, timeout: TIMEOUT_MS });

  return {
    /**
     * P1: Detect callsites in a code chunk.
     * Returns validated callsites with confidence >= 0.4.
     * Includes retry logic for transient failures.
     */
    async detectCallsites(chunk: CodeChunk): Promise<RawCallsite[]> {
      try {
        const response = await withRetry(async () => {
          return client.messages.create({
            model: MODEL,
            max_tokens: MAX_TOKENS,
            system: P1_SYSTEM,
            messages: [
              {
                role: 'user',
                content: `File: ${chunk.file} (${chunk.language})
Lines ${chunk.startLine}-${chunk.endLine}:

\`\`\`${chunk.language}
${chunk.content}
\`\`\``,
              },
            ],
          });
        });

        const text = response.content[0].type === 'text' ? response.content[0].text : '';
        const json = extractJSON(text);
        return validateP1Response(json);
      } catch {
        // API error or parse error — return empty (graceful degradation)
        return [];
      }
    },

    /**
     * P2: Classify a detected callsite.
     * Returns detailed classification or null if low confidence.
     * Includes retry logic for transient failures.
     */
    async classifyCallsite(
      callsite: RawCallsite,
      context: string
    ): Promise<ClassifiedCallsite | null> {
      try {
        const response = await withRetry(async () => {
          return client.messages.create({
            model: MODEL,
            max_tokens: MAX_TOKENS,
            system: P2_SYSTEM,
            messages: [
              {
                role: 'user',
                content: `Callsite ID: ${callsite.id}
File: ${callsite.file}, Lines ${callsite.startLine}-${callsite.endLine}
Code: ${callsite.code}

Surrounding context:
\`\`\`
${context}
\`\`\``,
              },
            ],
          });
        });

        const text = response.content[0].type === 'text' ? response.content[0].text : '';
        const json = extractJSON(text);
        return validateP2Response(json, callsite.file, callsite.startLine);
      } catch {
        // API error or parse error — return null (graceful degradation)
        return null;
      }
    },
  };
}
