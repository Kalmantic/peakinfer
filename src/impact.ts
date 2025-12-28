import type { Insight, ImpactEstimate, StackLayer, ImpactType, EffortLevel } from './types.js';

// =============================================================================
// CONSTANTS - Default Impact Estimates
// =============================================================================

// Model pricing per 1M tokens (input/output average)
const MODEL_PRICING: Record<string, number> = {
  'gpt-4': 45.0,
  'gpt-4o': 7.5,
  'gpt-4-turbo': 20.0,
  'gpt-3.5-turbo': 1.0,
  'gpt-4o-mini': 0.3,
  'claude-3-opus': 37.5,
  'claude-3-sonnet': 9.0,
  'claude-3-haiku': 0.625,
  'claude-3.5-sonnet': 9.0,
  'gemini-pro': 0.5,
  'gemini-1.5-pro': 3.5,
  'gemini-1.5-flash': 0.35,
};

// Default impact estimates by optimization pattern
interface PatternImpact {
  layer: StackLayer;
  impactType: ImpactType;
  impactPercent: number;
  effort: EffortLevel;
  description: string;
}

const PATTERN_IMPACTS: Record<string, PatternImpact> = {
  // Application Layer - Code Patterns
  'model-downgrade': {
    layer: 'application',
    impactType: 'cost',
    impactPercent: 70,
    effort: 'low',
    description: 'Use cheaper model for simple tasks',
  },
  'add-caching': {
    layer: 'application',
    impactType: 'cost',
    impactPercent: 40,
    effort: 'medium',
    description: 'Cache repeated similar prompts',
  },
  'add-batching': {
    layer: 'application',
    impactType: 'throughput',
    impactPercent: 60,
    effort: 'medium',
    description: 'Batch multiple requests together',
  },
  'enable-streaming': {
    layer: 'application',
    impactType: 'latency',
    impactPercent: 70,
    effort: 'low',
    description: 'Enable streaming for better TTFT',
  },
  'add-retry': {
    layer: 'application',
    impactType: 'throughput',
    impactPercent: 15,
    effort: 'low',
    description: 'Add retry with exponential backoff',
  },
  'connection-pooling': {
    layer: 'application',
    impactType: 'latency',
    impactPercent: 20,
    effort: 'low',
    description: 'Reuse HTTP connections',
  },

  // Model Layer - Model Selection
  'gpt4-to-gpt35': {
    layer: 'model',
    impactType: 'cost',
    impactPercent: 97,
    effort: 'low',
    description: 'GPT-4 → GPT-3.5-turbo (45x cheaper)',
  },
  'gpt4-to-gpt4o-mini': {
    layer: 'model',
    impactType: 'cost',
    impactPercent: 99,
    effort: 'low',
    description: 'GPT-4 → GPT-4o-mini (150x cheaper)',
  },
  'opus-to-haiku': {
    layer: 'model',
    impactType: 'cost',
    impactPercent: 98,
    effort: 'low',
    description: 'Claude Opus → Haiku (60x cheaper)',
  },
  'sonnet-to-haiku': {
    layer: 'model',
    impactType: 'cost',
    impactPercent: 93,
    effort: 'low',
    description: 'Claude Sonnet → Haiku (14x cheaper)',
  },

  // Runtime Layer - Inference Engines
  'use-vllm': {
    layer: 'runtime',
    impactType: 'throughput',
    impactPercent: 300,
    effort: 'high',
    description: 'Deploy with vLLM for 3-4x throughput',
  },
  'use-sglang': {
    layer: 'runtime',
    impactType: 'latency',
    impactPercent: 50,
    effort: 'high',
    description: 'Use SGLang for optimized batching',
  },
  'use-tgi': {
    layer: 'runtime',
    impactType: 'throughput',
    impactPercent: 200,
    effort: 'high',
    description: 'Deploy with TGI for 2-3x throughput',
  },
  'continuous-batching': {
    layer: 'runtime',
    impactType: 'throughput',
    impactPercent: 150,
    effort: 'medium',
    description: 'Enable continuous batching',
  },
  'speculative-decoding': {
    layer: 'runtime',
    impactType: 'latency',
    impactPercent: 40,
    effort: 'high',
    description: 'Use speculative decoding for faster generation',
  },

  // Hardware Layer - GPU/Hosting (v1.8: renamed from infrastructure)
  'dedicated-gpu': {
    layer: 'hardware',
    impactType: 'cost',
    impactPercent: 60,
    effort: 'high',
    description: 'Self-host on dedicated GPUs vs API',
  },
  'spot-instances': {
    layer: 'hardware',
    impactType: 'cost',
    impactPercent: 70,
    effort: 'medium',
    description: 'Use spot/preemptible instances',
  },
  'regional-deployment': {
    layer: 'hardware',
    impactType: 'latency',
    impactPercent: 30,
    effort: 'low',
    description: 'Deploy closer to users',
  },
  'autoscaling': {
    layer: 'hardware',
    impactType: 'cost',
    impactPercent: 40,
    effort: 'medium',
    description: 'Implement autoscaling for variable load',
  },
};

// =============================================================================
// IMPACT DETECTION
// =============================================================================

/**
 * Detect which optimization pattern an insight matches
 */
function detectPattern(insight: Insight): string | null {
  const headline = insight.headline.toLowerCase();
  const evidence = insight.evidence.toLowerCase();
  const combined = `${headline} ${evidence}`;

  // Model downgrade patterns
  if (combined.includes('gpt-4') && (combined.includes('gpt-3.5') || combined.includes('cheaper'))) {
    if (combined.includes('gpt-4o-mini') || combined.includes('mini')) {
      return 'gpt4-to-gpt4o-mini';
    }
    return 'gpt4-to-gpt35';
  }
  if (combined.includes('opus') && combined.includes('haiku')) {
    return 'opus-to-haiku';
  }
  if (combined.includes('sonnet') && combined.includes('haiku')) {
    return 'sonnet-to-haiku';
  }
  if (combined.includes('expensive model') || combined.includes('overkill') ||
      combined.includes('over-specification') || combined.includes('simple task')) {
    return 'model-downgrade';
  }

  // Application patterns
  if (combined.includes('streaming') && (combined.includes('enable') || combined.includes('missing') || combined.includes('no streaming'))) {
    return 'enable-streaming';
  }
  if (combined.includes('batch') && (combined.includes('missing') || combined.includes('opportunity') || combined.includes('no batch'))) {
    return 'add-batching';
  }
  if (combined.includes('cach') && (combined.includes('missing') || combined.includes('opportunity') || combined.includes('no cach'))) {
    return 'add-caching';
  }
  if (combined.includes('retry') && (combined.includes('missing') || combined.includes('no retry'))) {
    return 'add-retry';
  }
  if (combined.includes('connection') && combined.includes('pool')) {
    return 'connection-pooling';
  }

  // Runtime patterns
  if (combined.includes('vllm')) {
    return 'use-vllm';
  }
  if (combined.includes('sglang')) {
    return 'use-sglang';
  }
  if (combined.includes('tgi') || combined.includes('text generation inference')) {
    return 'use-tgi';
  }
  if (combined.includes('continuous batch')) {
    return 'continuous-batching';
  }
  if (combined.includes('speculative')) {
    return 'speculative-decoding';
  }

  // Infrastructure patterns
  if (combined.includes('dedicated') && combined.includes('gpu')) {
    return 'dedicated-gpu';
  }
  if (combined.includes('spot') || combined.includes('preemptible')) {
    return 'spot-instances';
  }
  if (combined.includes('region') && combined.includes('deploy')) {
    return 'regional-deployment';
  }
  if (combined.includes('autoscal')) {
    return 'autoscaling';
  }

  return null;
}

/**
 * Estimate annual cost savings based on detected model usage
 * Assumes 1M tokens/day as baseline
 */
function estimateAnnualSavings(
  currentModel: string | null,
  recommendedModel: string | null,
  dailyTokensMillions: number = 1
): number | undefined {
  if (!currentModel || !recommendedModel) return undefined;

  const currentPrice = MODEL_PRICING[currentModel.toLowerCase()] || MODEL_PRICING['gpt-4'];
  const newPrice = MODEL_PRICING[recommendedModel.toLowerCase()] || MODEL_PRICING['gpt-3.5-turbo'];

  const dailySavings = (currentPrice - newPrice) * dailyTokensMillions;
  return Math.round(dailySavings * 365);
}

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Estimate impact for a single insight
 */
export function estimateImpact(insight: Insight): ImpactEstimate | null {
  const pattern = detectPattern(insight);

  if (!pattern || !PATTERN_IMPACTS[pattern]) {
    // Default estimate based on category
    return getDefaultEstimate(insight);
  }

  const patternImpact = PATTERN_IMPACTS[pattern];

  return {
    layer: patternImpact.layer,
    impactType: patternImpact.impactType,
    estimatedImpactPercent: patternImpact.impactPercent,
    effort: patternImpact.effort,
    confidence: 0.7,
    assumptions: patternImpact.description,
  };
}

/**
 * Get default impact estimate based on insight category
 */
function getDefaultEstimate(insight: Insight): ImpactEstimate | null {
  const categoryDefaults: Record<string, Partial<ImpactEstimate>> = {
    'cost': { layer: 'application', impactType: 'cost', estimatedImpactPercent: 20, effort: 'medium' },
    'latency': { layer: 'application', impactType: 'latency', estimatedImpactPercent: 30, effort: 'medium' },
    'throughput': { layer: 'application', impactType: 'throughput', estimatedImpactPercent: 25, effort: 'medium' },
    'reliability': { layer: 'application', impactType: 'throughput', estimatedImpactPercent: 15, effort: 'low' },
    'waste': { layer: 'application', impactType: 'cost', estimatedImpactPercent: 25, effort: 'low' },
  };

  const defaults = categoryDefaults[insight.category];
  if (!defaults) return null;

  return {
    layer: defaults.layer as StackLayer,
    impactType: defaults.impactType as ImpactType,
    estimatedImpactPercent: defaults.estimatedImpactPercent || 20,
    effort: defaults.effort as EffortLevel || 'medium',
    confidence: 0.5,
  };
}

/**
 * Add impact estimates to all insights
 */
export function enrichInsightsWithImpact(insights: Insight[]): Insight[] {
  return insights.map(insight => {
    if (insight.impact) return insight; // Already has impact

    const impact = estimateImpact(insight);
    return impact ? { ...insight, impact } : insight;
  });
}

/**
 * Stack ranking summary
 */
export interface StackRanking {
  layer: StackLayer;
  totalImpactPercent: number;
  insightCount: number;
  avgEffort: EffortLevel;
  topInsights: Insight[];
}

export interface ImpactSummary {
  totalPotentialImpact: {
    costReductionPercent: number;
    latencyReductionPercent: number;
    throughputGainPercent: number;
  };
  stackRanking: StackRanking[];
  quickWins: Insight[]; // High impact, low effort
  strategicChanges: Insight[]; // High impact, high effort
  prioritizedList: Insight[]; // All insights sorted by impact
}

/**
 * Generate comprehensive impact summary with stack ranking
 */
export function generateImpactSummary(insights: Insight[]): ImpactSummary {
  const enriched = enrichInsightsWithImpact(insights);

  // Calculate totals by impact type
  const costInsights = enriched.filter(i => i.impact?.impactType === 'cost');
  const latencyInsights = enriched.filter(i => i.impact?.impactType === 'latency');
  const throughputInsights = enriched.filter(i => i.impact?.impactType === 'throughput');

  const avgImpact = (items: Insight[]) => {
    if (items.length === 0) return 0;
    const total = items.reduce((sum, i) => sum + (i.impact?.estimatedImpactPercent || 0), 0);
    return Math.round(total / items.length);
  };

  // Group by layer
  const layerGroups = new Map<StackLayer, Insight[]>();
  for (const insight of enriched) {
    const layer = insight.impact?.layer || 'application';
    const existing = layerGroups.get(layer) || [];
    existing.push(insight);
    layerGroups.set(layer, existing);
  }

  // Build stack ranking
  const stackRanking: StackRanking[] = [];
  const layerOrder: StackLayer[] = ['application', 'api', 'gateway', 'runtime', 'model', 'hardware'];

  for (const layer of layerOrder) {
    const layerInsights = layerGroups.get(layer) || [];
    if (layerInsights.length === 0) continue;

    const totalImpact = layerInsights.reduce(
      (sum, i) => sum + (i.impact?.estimatedImpactPercent || 0), 0
    );

    // Calculate average effort
    const effortScores = layerInsights.map(i => {
      const e = i.impact?.effort || 'medium';
      return e === 'low' ? 1 : e === 'medium' ? 2 : 3;
    });
    const avgEffortScore = effortScores.reduce((a, b) => a + b, 0) / effortScores.length;
    const avgEffort: EffortLevel = avgEffortScore < 1.5 ? 'low' : avgEffortScore < 2.5 ? 'medium' : 'high';

    stackRanking.push({
      layer,
      totalImpactPercent: totalImpact,
      insightCount: layerInsights.length,
      avgEffort,
      topInsights: layerInsights
        .sort((a, b) => (b.impact?.estimatedImpactPercent || 0) - (a.impact?.estimatedImpactPercent || 0))
        .slice(0, 3),
    });
  }

  // Sort stack ranking by total impact
  stackRanking.sort((a, b) => b.totalImpactPercent - a.totalImpactPercent);

  // Identify quick wins (high impact, low effort)
  const quickWins = enriched
    .filter(i => i.impact && i.impact.estimatedImpactPercent >= 40 && i.impact.effort === 'low')
    .sort((a, b) => (b.impact?.estimatedImpactPercent || 0) - (a.impact?.estimatedImpactPercent || 0));

  // Identify strategic changes (high impact, high effort)
  const strategicChanges = enriched
    .filter(i => i.impact && i.impact.estimatedImpactPercent >= 50 && i.impact.effort === 'high')
    .sort((a, b) => (b.impact?.estimatedImpactPercent || 0) - (a.impact?.estimatedImpactPercent || 0));

  // Prioritized list: sort by impact/effort ratio
  const prioritizedList = [...enriched]
    .filter(i => i.impact)
    .sort((a, b) => {
      const effortMultiplier = (e: EffortLevel | undefined) =>
        e === 'low' ? 3 : e === 'medium' ? 2 : 1;
      const scoreA = (a.impact?.estimatedImpactPercent || 0) * effortMultiplier(a.impact?.effort);
      const scoreB = (b.impact?.estimatedImpactPercent || 0) * effortMultiplier(b.impact?.effort);
      return scoreB - scoreA;
    });

  return {
    totalPotentialImpact: {
      costReductionPercent: avgImpact(costInsights),
      latencyReductionPercent: avgImpact(latencyInsights),
      throughputGainPercent: avgImpact(throughputInsights),
    },
    stackRanking,
    quickWins,
    strategicChanges,
    prioritizedList,
  };
}

/**
 * Format impact summary as text for CLI output
 * Julie Zhou design: "Headroom" terminology, intuitive metrics
 *
 * Key principle: Output should be understandable without narration
 */
export function formatImpactSummary(summary: ImpactSummary): string {
  const lines: string[] = [];

  // Stack ranking by layer - show avg improvement per layer
  lines.push('\x1b[2mBy Layer\x1b[0m');
  for (let i = 0; i < summary.stackRanking.length; i++) {
    const rank = summary.stackRanking[i];
    const layerName = rank.layer.charAt(0).toUpperCase() + rank.layer.slice(1);
    const avgImpact = Math.round(rank.totalImpactPercent / rank.insightCount);
    lines.push(`  ${i + 1}. ${layerName.padEnd(14)} ~${avgImpact}% avg  (${rank.insightCount} items)`);
  }

  // Quick wins - high value, low effort (actionable now)
  // Deduplicate by templateId+headline to avoid repetitive suggestions
  if (summary.quickWins.length > 0) {
    const seen = new Set<string>();
    const uniqueWins = summary.quickWins.filter(insight => {
      const key = `${insight.templateId || ''}:${insight.headline}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 3);

    if (uniqueWins.length > 0) {
      lines.push('');
      lines.push('\x1b[2mQuick Wins\x1b[0m');
      for (const insight of uniqueWins) {
        const pct = insight.impact?.estimatedImpactPercent || 0;
        const type = insight.impact?.impactType || 'improvement';
        const typeLabel = type === 'cost' ? 'cost reduction' : type === 'latency' ? 'latency reduction' : type;
        // Use assumptions if available (more actionable), otherwise headline
        const recommendation = insight.impact?.assumptions || insight.headline;
        lines.push(`  [!] ${recommendation} (${pct}% ${typeLabel})`);
      }
    }
  }

  // Strategic changes - high value, high effort
  // Deduplicate similarly
  if (summary.strategicChanges.length > 0) {
    const seen = new Set<string>();
    const uniqueStrategic = summary.strategicChanges.filter(insight => {
      const key = `${insight.templateId || ''}:${insight.headline}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 2);

    if (uniqueStrategic.length > 0) {
      lines.push('');
      lines.push('\x1b[2mStrategic\x1b[0m');
      for (const insight of uniqueStrategic) {
        const pct = insight.impact?.estimatedImpactPercent || 0;
        const type = insight.impact?.impactType || 'improvement';
        const typeLabel = type === 'cost' ? 'cost reduction' : type === 'latency' ? 'latency reduction' : type;
        const recommendation = insight.impact?.assumptions || insight.headline;
        lines.push(`  [+] ${recommendation} (${pct}% ${typeLabel})`);
      }
    }
  }

  return lines.join('\n');
}
