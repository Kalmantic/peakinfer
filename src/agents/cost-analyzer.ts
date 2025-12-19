/**
 * Cost Analyzer Agent
 * Analyzes cost profile for each LLM inference point
 */

import Anthropic from '@anthropic-ai/sdk';
import { readFileSync } from 'fs';
import { join } from 'path';
import YAML from 'yaml';
import { InferencePoint } from './callsite-finder.js';
import { getModelCost, classifyModelCost, loadPricing, PricingTier } from '../costs.js';

// Types
export interface CostOptimization {
  type: 'model_downgrade' | 'reduce_tokens' | 'add_caching' | 'batch_requests' | 'limit_context';
  description: string;
  current_cost: string;
  optimized_cost: string;
  savings_percent: number;
  effort: 'low' | 'medium' | 'high';
  sample_change: string | null;
}

export interface CostProfile {
  inference_point_id: string;
  line: number;
  model_analysis: {
    model: string;
    tier: 'premium' | 'standard' | 'budget' | 'unknown';
    pricing: {
      input_per_1m: number;
      output_per_1m: number;
    };
    is_overqualified: boolean;
    reason: string | null;
  };
  token_estimates: {
    input: { min: number; typical: number; max: number; basis: string };
    output: { min: number; typical: number; max: number; basis: string };
    has_few_shot: boolean;
    few_shot_tokens: number;
    has_rag_context: boolean;
    rag_context_estimate: number;
  };
  call_frequency: {
    pattern: 'single' | 'per_request' | 'loop' | 'recursive' | 'batch';
    multiplier: number | null;
    loop_bound: 'bounded' | 'unbounded' | 'unknown';
    estimated_calls_per_invocation: number;
  };
  cost_estimate: {
    per_call_min: number;
    per_call_typical: number;
    per_call_max: number;
    currency: string;
  };
  cost_risk: {
    level: 'low' | 'medium' | 'high' | 'critical';
    factors: string[];
    unbounded_growth: boolean;
    context_accumulation: boolean;
  };
  optimizations: CostOptimization[];
  confidence: number;
}

export interface CostAnalyzerOutput {
  cost_profiles: CostProfile[];
  summary: {
    total_inference_points: number;
    estimated_cost_per_1k_calls: number;
    highest_cost_point: string | null;
    optimization_potential_percent: number;
  };
}

export interface CostAnalyzerInput {
  inference_points: InferencePoint[];
  code_contexts: Map<string, string>; // id -> code context
  file_path: string;
}

// Ensure model is a valid string
function normalizeModel(model: unknown): string {
  if (typeof model === 'string') return model;
  if (model === null || model === undefined) return 'unknown';
  if (typeof model === 'object' && model !== null) {
    // Handle cases where LLM returns { name: 'model' } or { value: 'model' }
    const obj = model as Record<string, unknown>;
    if (typeof obj.name === 'string') return obj.name;
    if (typeof obj.value === 'string') return obj.value;
  }
  return String(model) || 'unknown';
}

// Model tier classification using LiteLLM pricing
function getModelTier(model: unknown): 'premium' | 'standard' | 'budget' | 'unknown' {
  const normalizedModel = normalizeModel(model);
  const tier = classifyModelCost(normalizedModel);
  switch (tier) {
    case 'expensive': return 'premium';
    case 'moderate': return 'standard';
    case 'cheap': return 'budget';
    case 'unknown': return 'unknown';
  }
}

// Get model pricing from LiteLLM cache
function getModelPricing(model: unknown): { input_per_1m: number; output_per_1m: number } {
  const normalizedModel = normalizeModel(model);
  const cost = getModelCost(normalizedModel);
  return {
    input_per_1m: cost.input,
    output_per_1m: cost.output,
  };
}

// Load prompt template
function loadPromptTemplate(): string {
  const promptPath = join(process.cwd(), 'prompts', 'cost-analyzer.yaml');
  const promptContent = readFileSync(promptPath, 'utf-8');
  const prompt = YAML.parse(promptContent);
  return prompt.system;
}

// Fallback analysis (note: pricing should be loaded before calling this)
function fallbackAnalysis(input: CostAnalyzerInput): CostAnalyzerOutput {
  const costProfiles: CostProfile[] = [];

  for (const point of input.inference_points) {
    const model = normalizeModel(point.model?.value);
    const tier = getModelTier(model);
    const pricing = getModelPricing(model);

    // Estimate tokens based on code patterns
    const codeContext = input.code_contexts.get(point.id) || '';
    const hasSystemPrompt = /system|instruction/i.test(codeContext);
    const hasFewShot = /example|few.?shot/i.test(codeContext);
    const hasRag = /context|document|retrieve/i.test(codeContext);

    const baseInputTokens = hasSystemPrompt ? 500 : 100;
    const fewShotTokens = hasFewShot ? 1000 : 0;
    const ragTokens = hasRag ? 2000 : 0;

    const inputMin = baseInputTokens;
    const inputTypical = baseInputTokens + fewShotTokens + (ragTokens / 2);
    const inputMax = baseInputTokens + fewShotTokens + ragTokens;

    const outputMin = 50;
    const outputTypical = 200;
    const outputMax = 1000;

    // Calculate costs
    const costMin = (inputMin * pricing.input_per_1m / 1_000_000) + (outputMin * pricing.output_per_1m / 1_000_000);
    const costTypical = (inputTypical * pricing.input_per_1m / 1_000_000) + (outputTypical * pricing.output_per_1m / 1_000_000);
    const costMax = (inputMax * pricing.input_per_1m / 1_000_000) + (outputMax * pricing.output_per_1m / 1_000_000);

    // Determine call frequency
    const callPattern = point.in_loop ? 'loop' : 'single';
    const multiplier = point.in_loop ? 10 : 1;
    const loopBound = point.loop_type === 'recursive' ? 'unbounded' : 'bounded';

    // Assess cost risk
    const riskFactors: string[] = [];
    let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';

    if (tier === 'premium') {
      riskFactors.push('Using premium model');
      riskLevel = 'medium';
    }
    if (point.in_loop) {
      riskFactors.push('Called in loop');
      riskLevel = riskLevel === 'medium' ? 'high' : 'medium';
    }
    if (loopBound === 'unbounded') {
      riskFactors.push('Unbounded iteration');
      riskLevel = 'critical';
    }
    if (hasRag) {
      riskFactors.push('RAG context injection');
    }

    // Generate optimizations
    const optimizations: CostOptimization[] = [];

    if (tier === 'premium') {
      optimizations.push({
        type: 'model_downgrade',
        description: `Consider using a standard model instead of ${model}`,
        current_cost: `$${costTypical.toFixed(4)}/call`,
        optimized_cost: `$${(costTypical * 0.1).toFixed(4)}/call`,
        savings_percent: 90,
        effort: 'low',
        sample_change: `model="${model.replace('gpt-4', 'gpt-4o-mini').replace('opus', 'haiku')}"`,
      });
    }

    if (!codeContext.includes('cache')) {
      optimizations.push({
        type: 'add_caching',
        description: 'Add response caching for repeated prompts',
        current_cost: `$${(costTypical * multiplier).toFixed(4)}/invocation`,
        optimized_cost: `$${(costTypical * multiplier * 0.3).toFixed(4)}/invocation`,
        savings_percent: 70,
        effort: 'medium',
        sample_change: null,
      });
    }

    costProfiles.push({
      inference_point_id: point.id,
      line: point.line,
      model_analysis: {
        model,
        tier,
        pricing,
        is_overqualified: tier === 'premium' && outputTypical < 100,
        reason: tier === 'premium' && outputTypical < 100 ? 'Premium model used for short outputs' : null,
      },
      token_estimates: {
        input: { min: inputMin, typical: inputTypical, max: inputMax, basis: 'Code pattern analysis' },
        output: { min: outputMin, typical: outputTypical, max: outputMax, basis: 'Default estimate' },
        has_few_shot: hasFewShot,
        few_shot_tokens: fewShotTokens,
        has_rag_context: hasRag,
        rag_context_estimate: ragTokens,
      },
      call_frequency: {
        pattern: callPattern,
        multiplier,
        loop_bound: loopBound,
        estimated_calls_per_invocation: multiplier,
      },
      cost_estimate: {
        per_call_min: costMin,
        per_call_typical: costTypical,
        per_call_max: costMax,
        currency: 'USD',
      },
      cost_risk: {
        level: riskLevel,
        factors: riskFactors,
        unbounded_growth: loopBound === 'unbounded',
        context_accumulation: hasRag,
      },
      optimizations,
      confidence: 0.7,
    });
  }

  const totalCostPer1k = costProfiles.reduce((sum, p) => sum + p.cost_estimate.per_call_typical * 1000, 0);
  const highestCost = costProfiles.sort((a, b) => b.cost_estimate.per_call_typical - a.cost_estimate.per_call_typical)[0];

  return {
    cost_profiles: costProfiles,
    summary: {
      total_inference_points: costProfiles.length,
      estimated_cost_per_1k_calls: totalCostPer1k,
      highest_cost_point: highestCost ? `${input.file_path}:${highestCost.line}` : null,
      optimization_potential_percent: costProfiles.some(p => p.model_analysis.tier === 'premium') ? 80 : 20,
    },
  };
}

// Main agent function - uses batch processing for efficiency
export async function analyzeCosts(input: CostAnalyzerInput): Promise<CostAnalyzerOutput> {
  // Load LiteLLM pricing data
  await loadPricing();

  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey || input.inference_points.length === 0) {
    return fallbackAnalysis(input);
  }

  const client = new Anthropic({ apiKey });
  const systemPrompt = loadPromptTemplate();

  // Build batch request with all inference points
  const pointsData = input.inference_points.map((point, idx) => {
    const codeContext = input.code_contexts.get(point.id) || '';
    return `
## Inference Point ${idx + 1} (ID: ${point.id})
- File: ${input.file_path}
- Line: ${point.line}
- Provider: ${point.provider.value}
- Model: ${point.model.value || 'unknown'}

Code Context:
\`\`\`
${codeContext}
\`\`\``;
  }).join('\n\n');

  const userMessage = `Analyze the cost profile for these ${input.inference_points.length} LLM inference points:

${pointsData}

Return a JSON array of cost_profile objects, one for each inference point in order.
Format: { "cost_profiles": [ {...}, {...}, ... ] }`;

  let profiles: CostProfile[] = [];

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    });

    const content = response.content[0];
    if (content.type === 'text') {
      // Try to parse as array
      const jsonMatch = content.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const profilesArray = parsed.cost_profiles || parsed.profiles || (Array.isArray(parsed) ? parsed : [parsed]);

        if (Array.isArray(profilesArray)) {
          for (let i = 0; i < input.inference_points.length; i++) {
            const profile = profilesArray[i];
            if (profile?.cost_estimate?.per_call_typical !== undefined) {
              // Ensure inference_point_id is set correctly
              profile.inference_point_id = input.inference_points[i].id;
              profile.line = input.inference_points[i].line;
              profiles.push(profile as CostProfile);
            } else {
              // Fallback for this specific point
              const fallback = fallbackAnalysis({ ...input, inference_points: [input.inference_points[i]] });
              profiles.push(...fallback.cost_profiles);
            }
          }
        }
      }
    }
  } catch (error) {
    console.error(`Cost analysis batch error:`, error);
  }

  // If batch failed or incomplete, use fallback for remaining points
  if (profiles.length < input.inference_points.length) {
    const analyzedIds = new Set(profiles.map(p => p.inference_point_id));
    const missingPoints = input.inference_points.filter(p => !analyzedIds.has(p.id));
    if (missingPoints.length > 0) {
      const fallback = fallbackAnalysis({ ...input, inference_points: missingPoints });
      profiles.push(...fallback.cost_profiles);
    }
  }

  const totalCostPer1k = profiles.reduce((sum, p) => sum + (p.cost_estimate?.per_call_typical ?? 0) * 1000, 0);
  const sortedProfiles = [...profiles].sort((a, b) =>
    (b.cost_estimate?.per_call_typical ?? 0) - (a.cost_estimate?.per_call_typical ?? 0));
  const highestCost = sortedProfiles[0];

  return {
    cost_profiles: profiles,
    summary: {
      total_inference_points: profiles.length,
      estimated_cost_per_1k_calls: totalCostPer1k,
      highest_cost_point: highestCost ? `${input.file_path}:${highestCost.line}` : null,
      optimization_potential_percent: profiles.some(p => p.model_analysis?.tier === 'premium') ? 80 : 20,
    },
  };
}

export class CostAnalyzerAgent {
  name = 'CostAnalyzerAgent';
  description = 'Analyzes cost profile for each LLM inference point';

  async execute(input: CostAnalyzerInput): Promise<CostAnalyzerOutput> {
    return analyzeCosts(input);
  }
}
