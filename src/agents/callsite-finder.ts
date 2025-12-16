/**
 * Call Site Finder Agent
 * Finds all LLM inference points including indirect and wrapped calls
 */

import Anthropic from '@anthropic-ai/sdk';
import { readFileSync } from 'fs';
import { join } from 'path';
import YAML from 'yaml';
import { ImportAnalyzerOutput } from './import-analyzer.js';

// Types
export interface InferencePoint {
  id: string;
  line: number;
  column: number;
  function_context: string;
  class_context: string | null;
  call_expression: string;
  call_type: 'direct' | 'wrapper' | 'framework' | 'http';
  provider: {
    value: string;
    source: 'hardcoded' | 'env' | 'config' | 'parameter' | 'dynamic' | 'unknown';
    confidence: number;
  };
  model: {
    value: string | null;
    source: 'hardcoded' | 'env' | 'config' | 'parameter' | 'dynamic' | 'unknown';
    confidence: number;
  };
  is_async: boolean;
  in_loop: boolean;
  loop_type: 'for' | 'while' | 'map' | 'recursive' | 'none';
  estimated_calls: 'single' | 'multiple' | 'unbounded';
  needs_tracing: boolean;
  confidence: number;
}

export interface WrapperDefinition {
  name: string;
  line: number;
  wraps_provider: string | null;
  wraps_model: string | null;
  is_llm_wrapper: boolean;
  confidence: number;
}

export interface CallSiteFinderOutput {
  inference_points: InferencePoint[];
  wrapper_definitions: WrapperDefinition[];
  summary: {
    total_inference_points: number;
    direct_calls: number;
    wrapped_calls: number;
    framework_calls: number;
    providers_detected: string[];
    models_detected: string[];
    has_dynamic_routing: boolean;
  };
}

export interface CallSiteFinderInput {
  file_path: string;
  language: string;
  full_file: string;
  import_analysis: ImportAnalyzerOutput;
}

// Load prompt template
function loadPromptTemplate(): string {
  const promptPath = join(process.cwd(), 'prompts', 'callsite-finder.yaml');
  const promptContent = readFileSync(promptPath, 'utf-8');
  const prompt = YAML.parse(promptContent);
  return prompt.system;
}

// Generate unique ID
function generateId(): string {
  return 'cs_' + Math.random().toString(36).substring(2, 10);
}

// Normalize LLM output to expected format (call_sites -> inference_points)
function normalizeOutput(parsed: Record<string, unknown>, filePath: string): CallSiteFinderOutput {
  // If already in correct format, return as is
  if (Array.isArray(parsed.inference_points)) {
    return parsed as unknown as CallSiteFinderOutput;
  }

  // Convert call_sites to inference_points
  const callSites = (parsed.call_sites || []) as Array<Record<string, unknown>>;
  const inferencePoints: InferencePoint[] = callSites.map((cs, idx) => ({
    id: generateId(),
    line: (cs.line_number || cs.line || idx + 1) as number,
    column: (cs.column || 0) as number,
    function_context: (cs.function_name || cs.context || 'unknown') as string,
    class_context: (cs.class_context || null) as string | null,
    call_expression: (cs.function_name || cs.call_expression || '') as string,
    call_type: (cs.call_type || 'direct') as 'direct' | 'wrapper' | 'framework' | 'http',
    provider: {
      value: (cs.provider || 'unknown') as string,
      source: (cs.provider_source || 'hardcoded') as 'hardcoded' | 'env' | 'config' | 'parameter' | 'dynamic' | 'unknown',
      confidence: 0.9,
    },
    model: {
      value: (cs.model || null) as string | null,
      source: (cs.model_source || 'hardcoded') as 'hardcoded' | 'env' | 'config' | 'parameter' | 'dynamic' | 'unknown',
      confidence: cs.model ? 0.9 : 0.5,
    },
    is_async: (cs.is_async || false) as boolean,
    in_loop: false,
    loop_type: 'none' as const,
    estimated_calls: 'single' as const,
    needs_tracing: false,
    confidence: 0.85,
  }));

  const summary = parsed.summary as Record<string, unknown> || {};
  const providers = (summary.providers_used || []) as string[];
  const models = (summary.models_detected || []) as string[];

  return {
    inference_points: inferencePoints,
    wrapper_definitions: ((parsed.wrapper_functions || []) as Array<Record<string, unknown>>).map(wf => ({
      name: (wf.function_name || wf.name || '') as string,
      line: (wf.line_number || wf.line || 0) as number,
      wraps_provider: null,
      wraps_model: null,
      is_llm_wrapper: (wf.contains_llm_calls || false) as boolean,
      confidence: 0.8,
    })),
    summary: {
      total_inference_points: inferencePoints.length,
      direct_calls: inferencePoints.filter(p => p.call_type === 'direct').length,
      wrapped_calls: inferencePoints.filter(p => p.call_type === 'wrapper').length,
      framework_calls: inferencePoints.filter(p => p.call_type === 'framework').length,
      providers_detected: providers.length > 0 ? providers : [...new Set(inferencePoints.map(p => p.provider.value))],
      models_detected: models.length > 0 ? models : [...new Set(inferencePoints.map(p => p.model.value).filter(Boolean))] as string[],
      has_dynamic_routing: (summary.has_dynamic_routing || false) as boolean,
    },
  };
}

// Fallback analysis when no API key
function fallbackAnalysis(input: CallSiteFinderInput): CallSiteFinderOutput {
  const inferencePoints: InferencePoint[] = [];
  const lines = input.full_file.split('\n');

  // Patterns for direct LLM calls
  const callPatterns = [
    // OpenAI
    { regex: /\.chat\.completions\.create\s*\(/, provider: 'openai', type: 'direct' as const },
    { regex: /\.completions\.create\s*\(/, provider: 'openai', type: 'direct' as const },
    { regex: /\.embeddings\.create\s*\(/, provider: 'openai', type: 'direct' as const },
    // Anthropic
    { regex: /\.messages\.create\s*\(/, provider: 'anthropic', type: 'direct' as const },
    { regex: /\.completions\.create\s*\(/, provider: 'anthropic', type: 'direct' as const },
    // LangChain
    { regex: /\.invoke\s*\(/, provider: 'langchain', type: 'framework' as const },
    { regex: /\.run\s*\(/, provider: 'langchain', type: 'framework' as const },
    { regex: /\.call\s*\(/, provider: 'langchain', type: 'framework' as const },
    // LlamaIndex
    { regex: /\.query\s*\(/, provider: 'llamaindex', type: 'framework' as const },
    { regex: /\.chat\s*\(/, provider: 'llamaindex', type: 'framework' as const },
    // HTTP calls to LLM endpoints
    { regex: /requests\.post\s*\([^)]*openai\.com/, provider: 'openai', type: 'http' as const },
    { regex: /requests\.post\s*\([^)]*anthropic\.com/, provider: 'anthropic', type: 'http' as const },
    { regex: /fetch\s*\([^)]*openai\.com/, provider: 'openai', type: 'http' as const },
    // Self-hosted
    { regex: /\/v2\/models\/.*\/generate/, provider: 'triton', type: 'http' as const },
    { regex: /\/v1\/completions/, provider: 'vllm', type: 'http' as const },
    { regex: /client\.infer\s*\(/, provider: 'triton', type: 'direct' as const },
  ];

  // Model patterns
  const modelPatterns = [
    { regex: /model\s*[=:]\s*["']([^"']+)["']/, group: 1 },
    { regex: /model_name\s*[=:]\s*["']([^"']+)["']/, group: 1 },
  ];

  let currentFunction = 'module';
  let currentClass: string | null = null;
  let inLoop = false;
  let loopType: 'for' | 'while' | 'map' | 'recursive' | 'none' = 'none';

  lines.forEach((line, idx) => {
    const lineNum = idx + 1;

    // Track function context
    const funcMatch = line.match(/(?:def|function|async function)\s+(\w+)/);
    if (funcMatch) {
      currentFunction = funcMatch[1];
    }

    // Track class context
    const classMatch = line.match(/class\s+(\w+)/);
    if (classMatch) {
      currentClass = classMatch[1];
    }

    // Track loops
    if (/\bfor\b/.test(line)) {
      inLoop = true;
      loopType = 'for';
    } else if (/\bwhile\b/.test(line)) {
      inLoop = true;
      loopType = 'while';
    } else if (/\.map\s*\(/.test(line)) {
      inLoop = true;
      loopType = 'map';
    }

    // Check call patterns
    for (const pattern of callPatterns) {
      if (pattern.regex.test(line)) {
        // Extract model if present
        let modelValue: string | null = null;
        for (const mp of modelPatterns) {
          const modelMatch = line.match(mp.regex);
          if (modelMatch) {
            modelValue = modelMatch[mp.group];
            break;
          }
        }

        // Check next few lines for model if not on same line
        if (!modelValue) {
          for (let i = 1; i <= 5 && idx + i < lines.length; i++) {
            for (const mp of modelPatterns) {
              const modelMatch = lines[idx + i].match(mp.regex);
              if (modelMatch) {
                modelValue = modelMatch[mp.group];
                break;
              }
            }
            if (modelValue) break;
          }
        }

        inferencePoints.push({
          id: generateId(),
          line: lineNum,
          column: line.indexOf(line.trim()) + 1,
          function_context: currentFunction,
          class_context: currentClass,
          call_expression: line.trim(),
          call_type: pattern.type,
          provider: {
            value: pattern.provider,
            source: 'hardcoded',
            confidence: 0.8,
          },
          model: {
            value: modelValue,
            source: modelValue ? 'hardcoded' : 'unknown',
            confidence: modelValue ? 0.9 : 0.3,
          },
          is_async: /await\s/.test(line) || /async/.test(line),
          in_loop: inLoop,
          loop_type: loopType,
          estimated_calls: inLoop ? 'multiple' : 'single',
          needs_tracing: false, // Only set true for wrapper patterns
          confidence: 0.8,
        });
        break;
      }
    }
  });

  const providers = [...new Set(inferencePoints.map(p => p.provider.value))];
  const models = [...new Set(inferencePoints.map(p => p.model.value).filter(Boolean))] as string[];

  return {
    inference_points: inferencePoints,
    wrapper_definitions: [],
    summary: {
      total_inference_points: inferencePoints.length,
      direct_calls: inferencePoints.filter(p => p.call_type === 'direct').length,
      wrapped_calls: inferencePoints.filter(p => p.call_type === 'wrapper').length,
      framework_calls: inferencePoints.filter(p => p.call_type === 'framework').length,
      providers_detected: providers,
      models_detected: models,
      has_dynamic_routing: inferencePoints.some(p => p.model.source === 'dynamic'),
    },
  };
}

// Main agent function
export async function findCallSites(input: CallSiteFinderInput): Promise<CallSiteFinderOutput> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return fallbackAnalysis(input);
  }

  const client = new Anthropic({ apiKey });
  const systemPrompt = loadPromptTemplate();

  const userMessage = `Analyze the following ${input.language} file for LLM inference call sites:

File: ${input.file_path}

Import Analysis:
${JSON.stringify(input.import_analysis, null, 2)}

Source Code:
\`\`\`${input.language}
${input.full_file}
\`\`\`

Return your analysis as JSON matching the output_format schema.`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    });

    const content = response.content[0];
    if (content.type === 'text') {
      const jsonMatch = content.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        // Normalize LLM response to expected format
        return normalizeOutput(parsed, input.file_path);
      }
    }

    return fallbackAnalysis(input);
  } catch (error) {
    console.error('Call site finder error:', error);
    return fallbackAnalysis(input);
  }
}

export class CallSiteFinderAgent {
  name = 'CallSiteFinderAgent';
  description = 'Finds all LLM inference points including indirect and wrapped calls';

  async execute(input: CallSiteFinderInput): Promise<CallSiteFinderOutput> {
    return findCallSites(input);
  }
}
