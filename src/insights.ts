import type {
  Insight,
  InsightTemplate,
  TemplateCondition,
  Callsite,
  EnrichedCallsite,
  JoinedOutput,
  PerformanceEnvelope,
} from './types.js';
import { getEnvelope, getThroughputPercent } from './envelopes.js';
import { getModelCost, calculateCost } from './costs.js';

// =============================================================================
// TYPES
// =============================================================================

interface EvaluationContext {
  callsites?: Callsite[] | EnrichedCallsite[];
  joined?: JoinedOutput;
  envelopes?: Record<string, PerformanceEnvelope>;
}

interface GlobalStats {
  totalCost: number;
  costByCallsite: Map<string, number>;
  top_callsite_cost_percent: number;
  top_callsite_id: string;
  top_callsite_model: string;
  top_callsite_location: string;
}

// =============================================================================
// HELPERS
// =============================================================================

function getNestedValue(obj: unknown, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

function evaluateCondition(condition: TemplateCondition, context: Record<string, unknown>): boolean {
  const fieldValue = getNestedValue(context, condition.field);

  switch (condition.op) {
    case 'eq':
      return fieldValue === condition.value;

    case 'neq':
      return fieldValue !== condition.value;

    case 'gt':
      return typeof fieldValue === 'number' && typeof condition.value === 'number' && fieldValue > condition.value;

    case 'lt':
      return typeof fieldValue === 'number' && typeof condition.value === 'number' && fieldValue < condition.value;

    case 'gte':
      return typeof fieldValue === 'number' && typeof condition.value === 'number' && fieldValue >= condition.value;

    case 'lte':
      return typeof fieldValue === 'number' && typeof condition.value === 'number' && fieldValue <= condition.value;

    case 'exists':
      return fieldValue !== null && fieldValue !== undefined;

    case 'in':
      return Array.isArray(condition.value) && condition.value.includes(fieldValue as string);

    case 'ratio_gt': {
      if (!condition.compare_to || typeof condition.value !== 'number') return false;
      const compareValue = getNestedValue(context, condition.compare_to);
      if (typeof fieldValue !== 'number' || typeof compareValue !== 'number' || compareValue === 0) return false;
      return (fieldValue / compareValue) > condition.value;
    }

    case 'ratio_lt': {
      if (!condition.compare_to || typeof condition.value !== 'number') return false;
      const compareValue = getNestedValue(context, condition.compare_to);
      if (typeof fieldValue !== 'number' || typeof compareValue !== 'number' || compareValue === 0) return false;
      return (fieldValue / compareValue) < condition.value;
    }

    case 'has_pattern': {
      if (!condition.pattern || !Array.isArray(fieldValue)) return false;
      const pattern = condition.pattern.toLowerCase();
      const matchCount = (fieldValue as Callsite[]).filter(c =>
        c.patterns.fallback === true ||
        c.file.toLowerCase().includes(pattern)
      ).length;
      return condition.count_gt !== undefined ? matchCount > condition.count_gt : matchCount > 0;
    }

    default:
      return false;
  }
}

function interpolate(template: string, vars: Record<string, unknown>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const value = vars[key];
    if (value === undefined || value === null) return `{{${key}}}`;
    if (typeof value === 'number') {
      return Number.isInteger(value) ? value.toString() : value.toFixed(1);
    }
    return String(value);
  });
}

function computeGlobalStats(callsites: EnrichedCallsite[]): GlobalStats {
  const costByCallsite = new Map<string, number>();
  let totalCost = 0;

  for (const cs of callsites) {
    if (cs.usage) {
      const cost = calculateCost(cs.model || 'unknown', cs.usage.tokens_in, cs.usage.tokens_out);
      costByCallsite.set(cs.id, cost);
      totalCost += cost;
    }
  }

  let topId = '';
  let topCost = 0;
  for (const [id, cost] of costByCallsite) {
    if (cost > topCost) {
      topCost = cost;
      topId = id;
    }
  }

  const topCallsite = callsites.find(c => c.id === topId);

  return {
    totalCost,
    costByCallsite,
    top_callsite_cost_percent: totalCost > 0 ? Math.round((topCost / totalCost) * 100) : 0,
    top_callsite_id: topId,
    top_callsite_model: topCallsite?.model || 'unknown',
    top_callsite_location: topCallsite ? `${topCallsite.file}:${topCallsite.line}` : '',
  };
}

// =============================================================================
// PUBLIC API
// =============================================================================

export function evaluate(
  data: JoinedOutput | { callsites: Callsite[] | EnrichedCallsite[] },
  templates: InsightTemplate[],
  envelopes: Record<string, PerformanceEnvelope> = {}
): Insight[] {
  const insights: Insight[] = [];

  const callsites = 'callsites' in data ? data.callsites : [];
  const joined = 'codeOnly' in data ? data as JoinedOutput : null;
  const globalStats = computeGlobalStats(callsites as EnrichedCallsite[]);

  for (const template of templates) {
    const { match, output, severity, category, id } = template;

    switch (match.scope) {
      case 'callsite': {
        // Evaluate against each callsite
        for (const callsite of callsites) {
          const enriched = callsite as EnrichedCallsite;
          const usage = enriched.usage;

          // Build context with computed fields for condition evaluation
          const context = {
            ...callsite,
            globalStats,
            // Computed fields needed by templates
            avg_tokens: usage ? Math.round(usage.tokens_out / usage.calls) : 0,
            avg_tokens_in: usage ? Math.round(usage.tokens_in / usage.calls) : 0,
            input_output_ratio: usage && usage.tokens_out > 0
              ? Math.round(usage.tokens_in / usage.tokens_out)
              : 0,
          };
          const allMatch = match.conditions.every(c => evaluateCondition(c, context));

          if (allMatch) {
            const vars: Record<string, unknown> = {
              ...callsite,
              location: `${callsite.file}:${callsite.line}`,
              // Latency metrics
              ratio: usage
                ? (usage.latency_p99 / usage.latency_p50).toFixed(1)
                : 'N/A',
              p50: usage?.latency_p50,
              p95: usage?.latency_p95,
              p99: usage?.latency_p99,
              // Token metrics
              tokens_in: usage?.tokens_in || 0,
              tokens_out: usage?.tokens_out || 0,
              calls: usage?.calls || 0,
              avg_tokens: usage
                ? Math.round(usage.tokens_out / usage.calls)
                : 0,
              avg_tokens_in: usage
                ? Math.round(usage.tokens_in / usage.calls)
                : 0,
              // Input/output ratio for prompt bloat detection
              input_output_ratio: usage && usage.tokens_out > 0
                ? Math.round(usage.tokens_in / usage.tokens_out)
                : 0,
            };

            insights.push({
              severity,
              category,
              templateId: id,
              headline: interpolate(output.headline, vars),
              evidence: interpolate(output.evidence, vars),
              location: `${callsite.file}:${callsite.line}`,
              source: 'template',
            });
          }
        }
        break;
      }

      case 'joined': {
        if (!joined) continue;

        const context = {
          codeOnly: joined.codeOnly,
          runtimeOnly: joined.runtimeOnly,
          drift: joined.drift,
          'codeOnly.length': joined.codeOnly.length,
          'runtimeOnly.length': joined.runtimeOnly.length,
        };

        const allMatch = match.conditions.every(c => evaluateCondition(c, context));

        if (allMatch) {
          const vars: Record<string, unknown> = {
            count: joined.codeOnly.length,
            locations: joined.codeOnly
              .slice(0, 3)
              .map(c => `${c.file}:${c.line}`)
              .join(', ') + (joined.codeOnly.length > 3 ? '...' : ''),
          };

          insights.push({
            severity,
            category,
            templateId: id,
            headline: interpolate(output.headline, vars),
            evidence: interpolate(output.evidence, vars),
            source: 'template',
          });
        }
        break;
      }

      case 'global': {
        const context = globalStats as unknown as Record<string, unknown>;
        const allMatch = match.conditions.every(c => evaluateCondition(c, context));

        if (allMatch) {
          const vars: Record<string, unknown> = {
            percent: globalStats.top_callsite_cost_percent,
            model: globalStats.top_callsite_model,
            location: globalStats.top_callsite_location,
          };

          insights.push({
            severity,
            category,
            templateId: id,
            headline: interpolate(output.headline, vars),
            evidence: interpolate(output.evidence, vars),
            location: globalStats.top_callsite_location,
            source: 'template',
          });
        }
        break;
      }

      case 'envelope': {
        // Evaluate against each callsite with envelope comparison
        for (const callsite of callsites) {
          const enriched = callsite as EnrichedCallsite;
          if (!enriched.usage || !callsite.model) continue;

          const envelope = getEnvelope(callsite.model);
          if (!envelope) continue;

          // Calculate actual TPS (tokens per second)
          const avgLatencySec = enriched.usage.latency_p50 / 1000;
          const avgOutputTokens = enriched.usage.tokens_out / enriched.usage.calls;
          const actualTps = avgLatencySec > 0 ? avgOutputTokens / avgLatencySec : 0;

          const context = {
            actual_tps: actualTps,
            envelope,
            'envelope.tps_median': envelope.tps_median,
            'envelope.tps_peak': envelope.tps_peak,
          };

          const allMatch = match.conditions.every(c => evaluateCondition(c, context));

          if (allMatch) {
            const percent = getThroughputPercent(callsite.model, actualTps) || 0;
            const vars: Record<string, unknown> = {
              percent,
              model: callsite.model,
              actual: actualTps.toFixed(0),
              reference: envelope.tps_median,
              location: `${callsite.file}:${callsite.line}`,
            };

            insights.push({
              severity,
              category,
              templateId: id,
              headline: interpolate(output.headline, vars),
              evidence: interpolate(output.evidence, vars),
              location: `${callsite.file}:${callsite.line}`,
              source: 'template',
            });
          }
        }
        break;
      }
    }
  }

  // Sort by severity: critical > warning > info
  const severityOrder = { critical: 0, warning: 1, info: 2 };
  insights.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return insights;
}
