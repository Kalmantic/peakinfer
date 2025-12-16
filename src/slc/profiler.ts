/**
 * Runtime Telemetry Profiler
 *
 * Analyzes runtime events files to provide accurate cost analysis
 * and optimization recommendations. Supports multiple formats:
 * - JSONL, JSON Array, CSV, TSV (direct parse)
 * - OpenTelemetry, Jaeger, LangSmith, Helicone (adapter-based)
 *
 * PRD v1.3: Flexible runtime format support with agent-based normalization
 */

import * as fs from 'fs';
import * as path from 'path';
import type {
  InferenceEvent,
  EventAggregation,
  ProviderStats,
  ModelStats,
  IntentStats,
} from '../types/events.js';
import {
  normalizeEventsFile,
  type NormalizerOptions,
  type FormatType,
  type ParseResult,
  type FormatDetection,
} from './format/index.js';

// =============================================================================
// TYPES
// =============================================================================

export interface ProfileResult {
  summary: EventAggregation;
  hotspots: Hotspot[];
  optimizations: OptimizationSuggestion[];
  workloadClusters: WorkloadCluster[];
  monthlyProjection: MonthlyProjection;
  /** Format detection info (v1.3) */
  formatInfo?: FormatDetection;
}

export interface Hotspot {
  model: string;
  provider: string;
  intent: string;
  totalCost: number;
  callCount: number;
  avgLatency: number;
  costPercentage: number;
}

export interface OptimizationSuggestion {
  type: 'model_swap' | 'caching' | 'batching' | 'routing' | 'provider_switch';
  description: string;
  estimatedSavings: number;
  estimatedSavingsPercent: number;
  effort: 'low' | 'medium' | 'high';
  affectedIntents: string[];
}

export interface WorkloadCluster {
  name: string;
  intents: string[];
  dominantModel: string;
  avgTokens: number;
  totalCost: number;
  suggestedOptimization: string;
}

export interface MonthlyProjection {
  currentMonthly: number;
  projectedMonthly: number;
  withOptimizations: number;
  savingsPercent: number;
  byProvider: Record<string, number>;
  byModel: Record<string, number>;
}

export interface ProfileOptions {
  clusterMethod?: 'semantic' | 'cost' | 'latency';
  timeRange?: { start: Date; end: Date };
  minCostThreshold?: number;
  /** v1.3: Manually specify format */
  format?: FormatType;
  /** v1.3: Custom field mappings */
  fieldMappings?: Array<{ targetField: string; sourceExpression: string }>;
  /** v1.3: Allow low-confidence normalizations */
  lenient?: boolean;
  /** v1.3: Progress callback */
  onProgress?: (message: string) => void;
}

// =============================================================================
// MAIN PROFILER
// =============================================================================

/**
 * Parse and analyze runtime events file.
 * v1.3: Supports multiple formats with automatic detection.
 */
export async function profileEvents(
  eventsPath: string,
  options: ProfileOptions = {}
): Promise<ProfileResult> {
  const { onProgress } = options;
  
  // Use the new format normalization pipeline (v1.3)
  onProgress?.('Detecting and parsing events file...');
  
  const parseResult = await normalizeEventsFile(eventsPath, {
    format: options.format,
    lenient: options.lenient,
    skipErrors: true,
    onProgress,
  });
  
  const events = parseResult.events;

  if (events.length === 0) {
    const formatInfo = parseResult.format;
    throw new Error(
      `No events found in file. ` +
      `Format detected: ${formatInfo.detected} (confidence: ${(formatInfo.confidence * 100).toFixed(0)}%). ` +
      (parseResult.stats.errors.length > 0 
        ? `Errors: ${parseResult.stats.errors.slice(0, 3).join('; ')}`
        : '')
    );
  }
  
  onProgress?.(`Parsed ${events.length} events (format: ${parseResult.format.detected})`);

  // Filter by time range if specified
  const filteredEvents = options.timeRange
    ? events.filter(e => {
        const ts = new Date(e.ts);
        return ts >= options.timeRange!.start && ts <= options.timeRange!.end;
      })
    : events;

  // Aggregate events
  onProgress?.('Aggregating metrics...');
  const summary = aggregateEvents(filteredEvents);

  // Find hotspots (highest cost areas)
  const hotspots = findHotspots(filteredEvents, summary.total_cost);

  // Generate optimization suggestions
  const optimizations = generateOptimizations(filteredEvents, hotspots);

  // Cluster workloads by intent
  const workloadClusters = clusterWorkloads(filteredEvents, options.clusterMethod || 'cost');

  // Project monthly costs
  const monthlyProjection = projectMonthlyCosts(filteredEvents, optimizations);

  return {
    summary,
    hotspots,
    optimizations,
    workloadClusters,
    monthlyProjection,
    formatInfo: parseResult.format,
  };
}

// =============================================================================
// PARSING (v1.3: Moved to format/normalizer.ts)
// =============================================================================

// NOTE: Event parsing is now handled by the format normalization pipeline.
// See src/slc/format/normalizer.ts for the implementation.
// Supported formats: JSONL, JSON Array, CSV, TSV, OpenTelemetry, Jaeger,
// LangSmith, Helicone, and custom formats with agent inference.

// =============================================================================
// AGGREGATION
// =============================================================================

/**
 * Aggregate events into summary statistics
 */
function aggregateEvents(events: InferenceEvent[]): EventAggregation {
  const byProvider: Record<string, ProviderStats> = {};
  const byModel: Record<string, ModelStats> = {};
  const byIntent: Record<string, IntentStats> = {};

  let totalCost = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalLatency = 0;

  for (const event of events) {
    totalCost += event.cost_usd || 0;
    totalInputTokens += event.input_tokens || 0;
    totalOutputTokens += event.output_tokens || 0;
    totalLatency += event.latency_ms || 0;

    // By provider
    if (!byProvider[event.provider]) {
      byProvider[event.provider] = { count: 0, cost: 0, avg_latency: 0, models: [] };
    }
    byProvider[event.provider].count++;
    byProvider[event.provider].cost += event.cost_usd || 0;
    byProvider[event.provider].avg_latency += event.latency_ms || 0;
    if (!byProvider[event.provider].models.includes(event.model)) {
      byProvider[event.provider].models.push(event.model);
    }

    // By model
    if (!byModel[event.model]) {
      byModel[event.model] = { count: 0, cost: 0, avg_input_tokens: 0, avg_output_tokens: 0, avg_latency: 0 };
    }
    byModel[event.model].count++;
    byModel[event.model].cost += event.cost_usd || 0;
    byModel[event.model].avg_input_tokens += event.input_tokens || 0;
    byModel[event.model].avg_output_tokens += event.output_tokens || 0;
    byModel[event.model].avg_latency += event.latency_ms || 0;

    // By intent
    const intent = event.intent || 'unknown';
    if (!byIntent[intent]) {
      byIntent[intent] = { count: 0, cost: 0, avg_tokens: 0, providers_used: [], optimization_opportunities: [] };
    }
    byIntent[intent].count++;
    byIntent[intent].cost += event.cost_usd || 0;
    byIntent[intent].avg_tokens += (event.input_tokens || 0) + (event.output_tokens || 0);
    if (!byIntent[intent].providers_used.includes(event.provider)) {
      byIntent[intent].providers_used.push(event.provider);
    }
  }

  // Calculate averages
  for (const provider in byProvider) {
    byProvider[provider].avg_latency /= byProvider[provider].count;
  }
  for (const model in byModel) {
    byModel[model].avg_input_tokens /= byModel[model].count;
    byModel[model].avg_output_tokens /= byModel[model].count;
    byModel[model].avg_latency /= byModel[model].count;
  }
  for (const intent in byIntent) {
    byIntent[intent].avg_tokens /= byIntent[intent].count;
  }

  // Time range
  const timestamps = events.map(e => new Date(e.ts).getTime());
  const timeRange = {
    start: new Date(Math.min(...timestamps)).toISOString(),
    end: new Date(Math.max(...timestamps)).toISOString(),
  };

  return {
    total_events: events.length,
    total_cost: totalCost,
    total_input_tokens: totalInputTokens,
    total_output_tokens: totalOutputTokens,
    avg_latency_ms: events.length > 0 ? totalLatency / events.length : 0,
    by_provider: byProvider,
    by_model: byModel,
    by_intent: byIntent,
    time_range: timeRange,
  };
}

// =============================================================================
// HOTSPOT DETECTION
// =============================================================================

/**
 * Find highest cost areas
 */
function findHotspots(events: InferenceEvent[], totalCost: number): Hotspot[] {
  // Group by model + intent
  const groups: Record<string, InferenceEvent[]> = {};

  for (const event of events) {
    const key = `${event.model}|${event.provider}|${event.intent || 'unknown'}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(event);
  }

  // Calculate hotspots
  const hotspots: Hotspot[] = [];

  for (const key in groups) {
    const [model, provider, intent] = key.split('|');
    const groupEvents = groups[key];
    const groupCost = groupEvents.reduce((sum, e) => sum + (e.cost_usd || 0), 0);
    const avgLatency = groupEvents.reduce((sum, e) => sum + (e.latency_ms || 0), 0) / groupEvents.length;

    hotspots.push({
      model,
      provider,
      intent,
      totalCost: groupCost,
      callCount: groupEvents.length,
      avgLatency,
      costPercentage: totalCost > 0 ? (groupCost / totalCost) * 100 : 0,
    });
  }

  // Sort by cost descending
  return hotspots.sort((a, b) => b.totalCost - a.totalCost);
}

// =============================================================================
// OPTIMIZATION SUGGESTIONS
// =============================================================================

// Model cost tiers ($ per 1M tokens, approximate)
const MODEL_COSTS: Record<string, { input: number; output: number; tier: string }> = {
  'gpt-4o': { input: 5.0, output: 15.0, tier: 'premium' },
  'gpt-4o-mini': { input: 0.15, output: 0.6, tier: 'balanced' },
  'gpt-4-turbo': { input: 10.0, output: 30.0, tier: 'premium' },
  'gpt-3.5-turbo': { input: 0.5, output: 1.5, tier: 'economy' },
  'claude-3-opus': { input: 15.0, output: 75.0, tier: 'premium' },
  'claude-3-sonnet': { input: 3.0, output: 15.0, tier: 'balanced' },
  'claude-3-haiku': { input: 0.25, output: 1.25, tier: 'economy' },
  'claude-3-5-sonnet': { input: 3.0, output: 15.0, tier: 'balanced' },
  'gemini-1.5-pro': { input: 3.5, output: 10.5, tier: 'balanced' },
  'gemini-1.5-flash': { input: 0.075, output: 0.3, tier: 'economy' },
  'llama-3.1-70b': { input: 0.9, output: 0.9, tier: 'economy' },
  'llama-3.1-8b': { input: 0.05, output: 0.05, tier: 'budget' },
  'mistral-7b': { input: 0.05, output: 0.05, tier: 'budget' },
};

/**
 * Generate optimization suggestions based on hotspots
 */
function generateOptimizations(
  events: InferenceEvent[],
  hotspots: Hotspot[]
): OptimizationSuggestion[] {
  const suggestions: OptimizationSuggestion[] = [];
  const totalCost = events.reduce((sum, e) => sum + (e.cost_usd || 0), 0);

  for (const hotspot of hotspots.slice(0, 10)) {
    // Skip if already a budget model
    const modelInfo = findModelInfo(hotspot.model);
    if (modelInfo?.tier === 'budget') continue;

    // Model swap suggestion
    if (modelInfo?.tier === 'premium' && hotspot.costPercentage > 10) {
      const cheaperModel = suggestCheaperModel(hotspot.model, hotspot.intent);
      if (cheaperModel) {
        const savingsPercent = calculateSavingsPercent(hotspot.model, cheaperModel);
        suggestions.push({
          type: 'model_swap',
          description: `Switch ${hotspot.model} to ${cheaperModel} for "${hotspot.intent}" tasks`,
          estimatedSavings: hotspot.totalCost * (savingsPercent / 100),
          estimatedSavingsPercent: savingsPercent,
          effort: 'low',
          affectedIntents: [hotspot.intent],
        });
      }
    }

    // Caching suggestion for repeated intents
    const intentEvents = events.filter(e => e.intent === hotspot.intent);
    if (intentEvents.length > 50 && hotspot.costPercentage > 5) {
      suggestions.push({
        type: 'caching',
        description: `Implement semantic caching for "${hotspot.intent}" (${intentEvents.length} calls)`,
        estimatedSavings: hotspot.totalCost * 0.3, // Assume 30% cache hit rate
        estimatedSavingsPercent: 30,
        effort: 'medium',
        affectedIntents: [hotspot.intent],
      });
    }

    // Batching suggestion for high-volume, low-latency tolerance
    if (hotspot.callCount > 100 && hotspot.avgLatency < 5000) {
      suggestions.push({
        type: 'batching',
        description: `Batch requests for "${hotspot.intent}" (${hotspot.callCount} calls)`,
        estimatedSavings: hotspot.totalCost * 0.15, // Assume 15% savings from batching
        estimatedSavingsPercent: 15,
        effort: 'medium',
        affectedIntents: [hotspot.intent],
      });
    }
  }

  // Provider switch suggestion
  const providerCosts: Record<string, number> = {};
  for (const event of events) {
    providerCosts[event.provider] = (providerCosts[event.provider] || 0) + (event.cost_usd || 0);
  }

  if (providerCosts['openai'] > totalCost * 0.5) {
    suggestions.push({
      type: 'provider_switch',
      description: 'Consider Groq or Together.ai for Llama models (10-100x cheaper)',
      estimatedSavings: providerCosts['openai'] * 0.5,
      estimatedSavingsPercent: 50,
      effort: 'medium',
      affectedIntents: Object.keys(events.reduce((acc, e) => {
        if (e.provider === 'openai') acc[e.intent] = true;
        return acc;
      }, {} as Record<string, boolean>)),
    });
  }

  // Sort by estimated savings
  return suggestions.sort((a, b) => b.estimatedSavings - a.estimatedSavings);
}

function findModelInfo(model: string): { input: number; output: number; tier: string } | null {
  // Direct match
  if (MODEL_COSTS[model]) return MODEL_COSTS[model];

  // Fuzzy match
  const normalizedModel = model.toLowerCase();
  for (const [key, value] of Object.entries(MODEL_COSTS)) {
    if (normalizedModel.includes(key.toLowerCase().split('-')[0])) {
      return value;
    }
  }
  return null;
}

function suggestCheaperModel(currentModel: string, intent: string): string | null {
  const current = findModelInfo(currentModel);
  if (!current) return null;

  // Simple task intents that don't need premium models
  const simpleTasks = ['extraction', 'classification', 'summarization', 'translation', 'embedding'];
  const isSimple = simpleTasks.some(t => intent.toLowerCase().includes(t));

  if (current.tier === 'premium') {
    if (isSimple) {
      return 'gemini-1.5-flash or claude-3-haiku';
    }
    return 'gpt-4o-mini or claude-3-5-sonnet';
  }

  if (current.tier === 'balanced' && isSimple) {
    return 'gemini-1.5-flash or llama-3.1-8b';
  }

  return null;
}

function calculateSavingsPercent(fromModel: string, toModel: string): number {
  // Rough estimates based on pricing tiers
  const tierSavings: Record<string, Record<string, number>> = {
    premium: { balanced: 70, economy: 90, budget: 95 },
    balanced: { economy: 70, budget: 90 },
    economy: { budget: 50 },
  };

  const from = findModelInfo(fromModel);
  if (!from) return 0;

  // Estimate based on suggested models
  if (toModel.includes('flash') || toModel.includes('haiku')) {
    return tierSavings[from.tier]?.economy || 50;
  }
  if (toModel.includes('mini') || toModel.includes('sonnet')) {
    return tierSavings[from.tier]?.balanced || 30;
  }
  if (toModel.includes('llama') || toModel.includes('mistral')) {
    return tierSavings[from.tier]?.budget || 70;
  }

  return 30;
}

// =============================================================================
// WORKLOAD CLUSTERING
// =============================================================================

/**
 * Cluster workloads by intent/cost/latency
 */
function clusterWorkloads(
  events: InferenceEvent[],
  method: 'semantic' | 'cost' | 'latency'
): WorkloadCluster[] {
  // Group by intent
  const intentGroups: Record<string, InferenceEvent[]> = {};
  for (const event of events) {
    const intent = event.intent || 'unknown';
    if (!intentGroups[intent]) intentGroups[intent] = [];
    intentGroups[intent].push(event);
  }

  const clusters: WorkloadCluster[] = [];

  for (const [intent, intentEvents] of Object.entries(intentGroups)) {
    // Find dominant model
    const modelCounts: Record<string, number> = {};
    for (const e of intentEvents) {
      modelCounts[e.model] = (modelCounts[e.model] || 0) + 1;
    }
    const dominantModel = Object.entries(modelCounts)
      .sort((a, b) => b[1] - a[1])[0]?.[0] || 'unknown';

    // Calculate stats
    const avgTokens = intentEvents.reduce((sum, e) =>
      sum + (e.input_tokens || 0) + (e.output_tokens || 0), 0) / intentEvents.length;
    const totalCost = intentEvents.reduce((sum, e) => sum + (e.cost_usd || 0), 0);

    // Suggest optimization
    let suggestedOptimization = 'No immediate optimization needed';
    const modelInfo = findModelInfo(dominantModel);

    if (modelInfo?.tier === 'premium' && avgTokens < 1000) {
      suggestedOptimization = 'Short prompts with premium model - consider cheaper alternative';
    } else if (totalCost > 10 && intentEvents.length > 100) {
      suggestedOptimization = 'High volume - implement caching or batching';
    } else if (modelInfo?.tier === 'budget') {
      suggestedOptimization = 'Already optimized with budget model';
    }

    clusters.push({
      name: intent,
      intents: [intent],
      dominantModel,
      avgTokens,
      totalCost,
      suggestedOptimization,
    });
  }

  // Sort by cost
  return clusters.sort((a, b) => b.totalCost - a.totalCost);
}

// =============================================================================
// MONTHLY PROJECTION
// =============================================================================

/**
 * Project monthly costs with and without optimizations
 */
function projectMonthlyCosts(
  events: InferenceEvent[],
  optimizations: OptimizationSuggestion[]
): MonthlyProjection {
  if (events.length === 0) {
    return {
      currentMonthly: 0,
      projectedMonthly: 0,
      withOptimizations: 0,
      savingsPercent: 0,
      byProvider: {},
      byModel: {},
    };
  }

  // Calculate time span
  const timestamps = events.map(e => new Date(e.ts).getTime());
  const timeSpanMs = Math.max(...timestamps) - Math.min(...timestamps);
  const timeSpanHours = Math.max(timeSpanMs / (1000 * 60 * 60), 1); // At least 1 hour

  // Total cost in sample period
  const sampleCost = events.reduce((sum, e) => sum + (e.cost_usd || 0), 0);

  // Project to monthly (720 hours)
  const projectedMonthly = (sampleCost / timeSpanHours) * 720;

  // Calculate savings from optimizations
  const totalSavings = optimizations.reduce((sum, o) => sum + o.estimatedSavings, 0);
  const monthlySavings = (totalSavings / timeSpanHours) * 720;
  const withOptimizations = Math.max(0, projectedMonthly - monthlySavings);

  // By provider
  const byProvider: Record<string, number> = {};
  for (const event of events) {
    byProvider[event.provider] = (byProvider[event.provider] || 0) + (event.cost_usd || 0);
  }
  for (const provider in byProvider) {
    byProvider[provider] = (byProvider[provider] / timeSpanHours) * 720;
  }

  // By model
  const byModel: Record<string, number> = {};
  for (const event of events) {
    byModel[event.model] = (byModel[event.model] || 0) + (event.cost_usd || 0);
  }
  for (const model in byModel) {
    byModel[model] = (byModel[model] / timeSpanHours) * 720;
  }

  return {
    currentMonthly: projectedMonthly,
    projectedMonthly,
    withOptimizations,
    savingsPercent: projectedMonthly > 0 ? ((projectedMonthly - withOptimizations) / projectedMonthly) * 100 : 0,
    byProvider,
    byModel,
  };
}

// =============================================================================
// EXPORTS
// =============================================================================

export {
  aggregateEvents,
  findHotspots,
  generateOptimizations,
  clusterWorkloads,
  projectMonthlyCosts,
};
