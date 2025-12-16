/**
 * Insight Engine - PeakInfer TDD v1.3
 * 
 * Generates findings from analysis results using evaluation templates.
 * Per DD v1.3: Insights generate "aha" moments - findings that reveal hidden truth.
 * 
 * Insight Copy Formula (DD v1.3):
 * - "Your streaming is fake"
 * - "Your fallback has never fired"
 * - "You're at 34% of achievable throughput"
 * - "6 inference points with high p95 latency"
 */

import type { 
  Callsite,
  ClassifiedCallsite,
  JoinedInference,
  DriftSignal,
  InferencePatterns,
  PricingSummary,
  TechStack,
} from '../types.js';
import type { InferenceEvent } from '../../types/events.js';

// =============================================================================
// TYPES
// =============================================================================

export type InsightSeverity = 'critical' | 'warning' | 'info' | 'opportunity';

export type InsightCategory = 
  | 'cost'           // Cost optimization opportunities
  | 'performance'    // Latency, throughput issues
  | 'reliability'    // Fallback, retry issues
  | 'drift'          // Code vs runtime drift
  | 'pattern'        // Pattern-related findings
  | 'configuration'; // Misconfiguration

export interface Insight {
  /** Unique identifier */
  id: string;
  
  /** Category of insight */
  category: InsightCategory;
  
  /** Severity level */
  severity: InsightSeverity;
  
  /** Short, punchy headline (DD v1.3 copy formula) */
  headline: string;
  
  /** Detailed description */
  description: string;
  
  /** Affected files/callsites */
  affected: Array<{
    file: string;
    line?: number;
    callsiteId?: string;
  }>;
  
  /** Quantified impact (optional) */
  impact?: {
    value: number;
    unit: string;
    direction: 'increase' | 'decrease';
  };
  
  /** Suggested action */
  action?: string;
  
  /** Evidence supporting this insight */
  evidence: string[];
}

export interface InsightReport {
  /** All insights generated */
  insights: Insight[];
  
  /** Summary by category */
  byCategory: Record<InsightCategory, number>;
  
  /** Summary by severity */
  bySeverity: Record<InsightSeverity, number>;
  
  /** Overall optimization potential */
  potentialOptimization?: {
    costReduction: number;    // Percentage
    latencyReduction: number; // Percentage
    reliabilityGain: number;  // Percentage
  };
}

export interface InsightContext {
  /** Static analysis callsites */
  callsites?: ClassifiedCallsite[] | Callsite[];
  
  /** Runtime events (if available) */
  events?: InferenceEvent[];
  
  /** Joined analysis (if available) */
  joined?: JoinedInference;
  
  /** Detected patterns */
  patterns?: InferencePatterns;
  
  /** Pricing summary */
  pricing?: PricingSummary;
  
  /** Tech stack */
  techStack?: TechStack;
}

// =============================================================================
// MAIN INSIGHT GENERATOR
// =============================================================================

/**
 * Generate insights from analysis results.
 */
export function generateInsights(context: InsightContext): InsightReport {
  const insights: Insight[] = [];
  
  // ==========================================================================
  // Cost-related insights
  // ==========================================================================
  if (context.pricing) {
    const costInsights = generateCostInsights(context);
    insights.push(...costInsights);
  }
  
  // ==========================================================================
  // Drift-related insights (requires joined analysis)
  // ==========================================================================
  if (context.joined) {
    const driftInsights = generateDriftInsights(context.joined);
    insights.push(...driftInsights);
  }
  
  // ==========================================================================
  // Pattern-related insights
  // ==========================================================================
  if (context.patterns) {
    const patternInsights = generatePatternInsights(context);
    insights.push(...patternInsights);
  }
  
  // ==========================================================================
  // Performance insights (requires runtime events)
  // ==========================================================================
  if (context.events && context.events.length > 0) {
    const perfInsights = generatePerformanceInsights(context.events);
    insights.push(...perfInsights);
  }
  
  // ==========================================================================
  // Build summary
  // ==========================================================================
  const byCategory: Record<InsightCategory, number> = {
    cost: 0,
    performance: 0,
    reliability: 0,
    drift: 0,
    pattern: 0,
    configuration: 0,
  };
  
  const bySeverity: Record<InsightSeverity, number> = {
    critical: 0,
    warning: 0,
    info: 0,
    opportunity: 0,
  };
  
  for (const insight of insights) {
    byCategory[insight.category]++;
    bySeverity[insight.severity]++;
  }
  
  // Calculate potential optimization
  const potentialOptimization = calculateOptimizationPotential(insights);
  
  return {
    insights,
    byCategory,
    bySeverity,
    potentialOptimization,
  };
}

// =============================================================================
// COST INSIGHTS
// =============================================================================

function generateCostInsights(context: InsightContext): Insight[] {
  const insights: Insight[] = [];
  const { pricing, callsites } = context;
  
  if (!pricing) return insights;
  
  // Check for expensive model that could be swapped
  if (pricing.hotspots && pricing.hotspots.length > 0) {
    const topHotspot = pricing.hotspots[0];
    
    // GPT-4 to GPT-4o-mini opportunity
    if (topHotspot.model?.includes('gpt-4') && !topHotspot.model?.includes('mini')) {
      insights.push({
        id: 'cost-model-swap-gpt4',
        category: 'cost',
        severity: 'opportunity',
        headline: `GPT-4 → GPT-4o-mini could reduce costs ~99%`,
        description: `${pricing.hotspots.filter(h => h.model?.includes('gpt-4') && !h.model?.includes('mini')).length} inference points use GPT-4 which costs ~150x more than GPT-4o-mini. For many use cases, the quality difference is minimal.`,
        affected: pricing.hotspots
          .filter(h => h.model?.includes('gpt-4') && !h.model?.includes('mini'))
          .map(h => ({ file: h.file, line: h.line })),
        impact: {
          value: 99,
          unit: '%',
          direction: 'decrease',
        },
        action: 'Evaluate if GPT-4o-mini meets quality requirements for these callsites',
        evidence: [
          `${pricing.hotspots.filter(h => h.model?.includes('gpt-4')).length} callsites using GPT-4`,
          'GPT-4o-mini is ~150x cheaper per token',
        ],
      });
    }
    
    // Claude 3.5 Sonnet to Haiku opportunity
    if (topHotspot.model?.includes('claude') && topHotspot.model?.includes('sonnet')) {
      insights.push({
        id: 'cost-model-swap-claude',
        category: 'cost',
        severity: 'opportunity',
        headline: `Claude Sonnet → Haiku could reduce costs ~90%`,
        description: `Claude 3.5 Sonnet is premium pricing. For simpler tasks, Claude 3 Haiku offers similar capabilities at ~10x lower cost.`,
        affected: pricing.hotspots
          .filter(h => h.model?.includes('sonnet'))
          .map(h => ({ file: h.file, line: h.line })),
        impact: {
          value: 90,
          unit: '%',
          direction: 'decrease',
        },
        action: 'Review if Claude Haiku meets requirements for simpler tasks',
        evidence: [
          `${pricing.hotspots.filter(h => h.model?.includes('sonnet')).length} callsites using Claude Sonnet`,
        ],
      });
    }
  }
  
  // Cost concentration insight
  if (pricing.byModel && pricing.byModel.length > 0) {
    const topModel = pricing.byModel[0];
    const totalCost = pricing.byModel.reduce((sum, m) => sum + m.cost, 0);
    const topModelPct = totalCost > 0 ? (topModel.cost / totalCost) * 100 : 0;
    
    if (topModelPct > 70) {
      insights.push({
        id: 'cost-concentration',
        category: 'cost',
        severity: 'info',
        headline: `${topModelPct.toFixed(0)}% of cost concentrated in ${topModel.model}`,
        description: `A single model dominates your inference spend. This creates both optimization opportunity and vendor risk.`,
        affected: [],
        evidence: [
          `${topModel.model}: ${topModelPct.toFixed(0)}% of total cost`,
          `Total models in use: ${pricing.byModel.length}`,
        ],
      });
    }
  }
  
  return insights;
}

// =============================================================================
// DRIFT INSIGHTS
// =============================================================================

function generateDriftInsights(joined: JoinedInference): Insight[] {
  const insights: Insight[] = [];
  
  // Dead code insight
  if (joined.codeOnly.length > 0) {
    insights.push({
      id: 'drift-dead-code',
      category: 'drift',
      severity: joined.codeOnly.length > 3 ? 'warning' : 'info',
      headline: `${joined.codeOnly.length} inference point(s) never exercised`,
      description: `These callsites exist in code but were never observed at runtime. They may be dead code, behind feature flags, or untested paths.`,
      affected: joined.codeOnly.map(c => ({
        file: c.file,
        line: c.line,
        callsiteId: c.id,
      })),
      action: 'Review if these callsites are needed or if tests are missing',
      evidence: joined.codeOnly.slice(0, 3).map(c => `${c.file}:${c.line} (${c.provider}/${c.model})`),
    });
  }
  
  // Shadow traffic insight
  if (joined.runtimeOnly.length > 0) {
    const totalShadowCalls = joined.runtimeOnly.reduce((sum, r) => sum + r.callCount, 0);
    
    insights.push({
      id: 'drift-shadow-traffic',
      category: 'drift',
      severity: 'warning',
      headline: `${joined.runtimeOnly.length} provider/model combo(s) not found in code`,
      description: `These were observed at runtime but couldn't be traced to code. This often indicates dynamic provider selection or incomplete code scanning.`,
      affected: [],
      evidence: joined.runtimeOnly.slice(0, 3).map(r => 
        `${r.provider}/${r.model}: ${r.callCount} calls, $${r.totalCost.toFixed(2)}`
      ),
      action: 'Review dynamic provider selection or expand code scan scope',
    });
  }
  
  // Mismatch insights from drift signals
  const modelMismatches = joined.drift.filter(d => d.type === 'model_mismatch');
  if (modelMismatches.length > 0) {
    insights.push({
      id: 'drift-model-mismatch',
      category: 'drift',
      severity: 'warning',
      headline: `${modelMismatches.length} model mismatch(es) between code and runtime`,
      description: `Code specifies one model but runtime shows another. This could be environment-specific config or a deployment issue.`,
      affected: modelMismatches
        .filter(d => d.file)
        .map(d => ({ file: d.file!, line: d.line })),
      evidence: modelMismatches.slice(0, 3).map(d => 
        `${d.file}:${d.line} - code: ${d.codeValue}, runtime: ${d.runtimeValue}`
      ),
    });
  }
  
  return insights;
}

// =============================================================================
// PATTERN INSIGHTS
// =============================================================================

function generatePatternInsights(context: InsightContext): Insight[] {
  const insights: Insight[] = [];
  const { patterns, joined } = context;
  
  if (!patterns) return insights;
  
  // Streaming without evidence
  if (patterns.streaming?.detected && joined) {
    const streamingDrifts = joined.drift.filter(d => 
      d.type === 'pattern_mismatch' && d.description.toLowerCase().includes('streaming')
    );
    
    if (streamingDrifts.length > 0) {
      insights.push({
        id: 'pattern-fake-streaming',
        category: 'pattern',
        severity: 'warning',
        headline: 'Your streaming may be fake',
        description: 'Code shows streaming patterns but runtime latency suggests responses are not actually streamed. This could be proxy buffering or disabled streaming.',
        affected: patterns.streaming.instances.map(i => ({ file: i.file, line: i.line })),
        evidence: streamingDrifts[0].evidence,
        action: 'Check proxy/gateway configuration and verify stream=True is reaching the provider',
      });
    }
  }
  
  // Fallback never fired
  if (patterns.fallback?.detected && joined) {
    const fallbackDrifts = joined.drift.filter(d =>
      d.type === 'pattern_mismatch' && d.description.toLowerCase().includes('fallback')
    );
    
    if (fallbackDrifts.length > 0) {
      insights.push({
        id: 'pattern-fallback-untested',
        category: 'reliability',
        severity: 'info',
        headline: 'Your fallback has never fired',
        description: 'Fallback logic exists in code but only one provider was observed at runtime. Your fallback path is untested in production.',
        affected: patterns.fallback.instances.map(i => ({ file: i.file, line: i.line })),
        evidence: fallbackDrifts[0].evidence,
        action: 'Consider testing fallback with synthetic failures or chaos engineering',
      });
    }
  }
  
  // No retry pattern detected but should have
  if (!patterns.retry?.detected) {
    insights.push({
      id: 'pattern-no-retry',
      category: 'reliability',
      severity: 'info',
      headline: 'No retry pattern detected',
      description: 'LLM API calls are inherently unreliable. Consider adding retry logic with exponential backoff.',
      affected: [],
      evidence: ['No tenacity, backoff, or retry patterns found'],
      action: 'Add retry logic using tenacity, backoff, or similar library',
    });
  }
  
  return insights;
}

// =============================================================================
// PERFORMANCE INSIGHTS
// =============================================================================

function generatePerformanceInsights(events: InferenceEvent[]): Insight[] {
  const insights: Insight[] = [];
  
  if (events.length < 10) return insights;
  
  // High p95 latency
  const latencies = events.map(e => e.latency_ms || 0).filter(l => l > 0).sort((a, b) => a - b);
  const p95 = latencies[Math.floor(latencies.length * 0.95)] || 0;
  const p50 = latencies[Math.floor(latencies.length * 0.5)] || 0;
  
  if (p95 > 5000) { // > 5 seconds
    insights.push({
      id: 'perf-high-p95',
      category: 'performance',
      severity: 'warning',
      headline: `p95 latency is ${(p95 / 1000).toFixed(1)}s`,
      description: `5% of requests take over ${(p95 / 1000).toFixed(1)} seconds. This may indicate timeout risks or poor user experience.`,
      affected: [],
      impact: {
        value: p95,
        unit: 'ms',
        direction: 'decrease',
      },
      evidence: [
        `p50: ${(p50 / 1000).toFixed(1)}s`,
        `p95: ${(p95 / 1000).toFixed(1)}s`,
        `p95/p50 ratio: ${(p95 / p50).toFixed(1)}x`,
      ],
    });
  }
  
  // High latency variance
  if (p95 / p50 > 5) {
    insights.push({
      id: 'perf-latency-variance',
      category: 'performance',
      severity: 'info',
      headline: `High latency variance (${(p95 / p50).toFixed(1)}x spread)`,
      description: `p95 is ${(p95 / p50).toFixed(1)}x higher than p50. This indicates inconsistent response times - could be caused by retry storms, cold starts, or variable request complexity.`,
      affected: [],
      evidence: [
        `p50: ${p50}ms, p95: ${p95}ms`,
        'High variance often indicates batching opportunities',
      ],
    });
  }
  
  return insights;
}

// =============================================================================
// HELPERS
// =============================================================================

function calculateOptimizationPotential(insights: Insight[]): InsightReport['potentialOptimization'] {
  let costReduction = 0;
  let latencyReduction = 0;
  let reliabilityGain = 0;
  
  for (const insight of insights) {
    if (insight.category === 'cost' && insight.impact?.unit === '%') {
      costReduction = Math.max(costReduction, insight.impact.value);
    }
    if (insight.category === 'performance' && insight.impact) {
      latencyReduction = Math.max(latencyReduction, 20); // Conservative estimate
    }
    if (insight.category === 'reliability') {
      reliabilityGain += 5; // Each reliability insight adds potential
    }
  }
  
  return {
    costReduction,
    latencyReduction,
    reliabilityGain: Math.min(reliabilityGain, 30),
  };
}

