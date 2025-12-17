/**
 * Historical Comparison Module (v1.5)
 *
 * Compares current analysis with previous runs to surface:
 * - New inference points (pre-deploy validation)
 * - Removed inference points (cleanup validation)
 * - Changed configurations (drift detection)
 *
 * Enables tracking changes over time for informed deployment decisions.
 */

import type {
  Callsite,
  Insight,
  ComparisonResult,
  ChangedInferencePoint,
  FieldChange,
  HistoryManifest,
} from './types.js';
import { getLatestRun, loadRun, type LoadedRun } from './history.js';

// =============================================================================
// TYPES
// =============================================================================

export interface CompareOptions {
  /** Specific run ID to compare against (default: latest) */
  baseRunId?: string;
  /** Include insight comparison (default: true) */
  compareInsights?: boolean;
}

export interface AnalysisSnapshot {
  runId: string;
  timestamp: string;
  callsites: Callsite[];
  insights?: Insight[];
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Create a unique key for an inference point based on file:line.
 * Used for matching inference points across runs.
 */
function getCallsiteKey(callsite: Callsite): string {
  return `${callsite.file}:${callsite.line}`;
}

/**
 * Compare two values for equality (deep comparison for objects).
 */
function valuesEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return a === b;
  if (typeof a !== typeof b) return false;
  if (typeof a === 'object') {
    return JSON.stringify(a) === JSON.stringify(b);
  }
  return false;
}

/**
 * Find changes between two inference points.
 */
function findCallsiteChanges(before: Callsite, after: Callsite): FieldChange[] {
  const changes: FieldChange[] = [];
  const fieldsToCompare: (keyof Callsite)[] = [
    'provider', 'model', 'framework', 'runtime', 'confidence'
  ];

  for (const field of fieldsToCompare) {
    if (!valuesEqual(before[field], after[field])) {
      changes.push({
        field,
        before: before[field],
        after: after[field],
      });
    }
  }

  // Compare patterns object
  const patternKeys = new Set([
    ...Object.keys(before.patterns || {}),
    ...Object.keys(after.patterns || {}),
  ]);

  for (const pattern of patternKeys) {
    const beforeVal = (before.patterns as Record<string, unknown>)?.[pattern];
    const afterVal = (after.patterns as Record<string, unknown>)?.[pattern];
    if (!valuesEqual(beforeVal, afterVal)) {
      changes.push({
        field: `patterns.${pattern}`,
        before: beforeVal,
        after: afterVal,
      });
    }
  }

  return changes;
}

/**
 * Compare insights between runs to find new/resolved issues.
 */
function compareInsights(
  baseInsights: Insight[],
  currentInsights: Insight[]
): { newCritical: number; resolvedCritical: number; newWarnings: number; resolvedWarnings: number } {
  const baseIds = new Set(baseInsights.map(i => i.id || `${i.headline}:${i.location}`));
  const currentIds = new Set(currentInsights.map(i => i.id || `${i.headline}:${i.location}`));

  // New insights (in current but not in base)
  const newInsights = currentInsights.filter(i => {
    const id = i.id || `${i.headline}:${i.location}`;
    return !baseIds.has(id);
  });

  // Resolved insights (in base but not in current)
  const resolvedInsights = baseInsights.filter(i => {
    const id = i.id || `${i.headline}:${i.location}`;
    return !currentIds.has(id);
  });

  return {
    newCritical: newInsights.filter(i => i.severity === 'critical').length,
    resolvedCritical: resolvedInsights.filter(i => i.severity === 'critical').length,
    newWarnings: newInsights.filter(i => i.severity === 'warning').length,
    resolvedWarnings: resolvedInsights.filter(i => i.severity === 'warning').length,
  };
}

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Compare two analysis snapshots.
 */
export function compareSnapshots(
  baseline: AnalysisSnapshot,
  current: AnalysisSnapshot,
  options: CompareOptions = {}
): ComparisonResult {
  const { compareInsights: shouldCompareInsights = true } = options;

  // Build lookup maps
  const baseMap = new Map<string, Callsite>();
  for (const cs of baseline.callsites) {
    baseMap.set(getCallsiteKey(cs), cs);
  }

  const currentMap = new Map<string, Callsite>();
  for (const cs of current.callsites) {
    currentMap.set(getCallsiteKey(cs), cs);
  }

  // Find added, removed, and changed inference points
  const added: Callsite[] = [];
  const removed: Callsite[] = [];
  const changed: ChangedInferencePoint[] = [];

  // Check current callsites against baseline
  for (const [key, currentCs] of currentMap) {
    const baseCs = baseMap.get(key);
    if (!baseCs) {
      // New inference point
      added.push(currentCs);
    } else {
      // Check for changes
      const changes = findCallsiteChanges(baseCs, currentCs);
      if (changes.length > 0) {
        changed.push({ point: currentCs, changes });
      }
    }
  }

  // Check for removed callsites
  for (const [key, baseCs] of baseMap) {
    if (!currentMap.has(key)) {
      removed.push(baseCs);
    }
  }

  // Build result
  const result: ComparisonResult = {
    baseRunId: baseline.runId,
    baseTimestamp: baseline.timestamp,
    currentRunId: current.runId,
    currentTimestamp: current.timestamp,
    added,
    removed,
    changed,
    metrics: {
      totalBefore: baseline.callsites.length,
      totalAfter: current.callsites.length,
      addedCount: added.length,
      removedCount: removed.length,
      changedCount: changed.length,
      netChange: added.length - removed.length,
    },
  };

  // Add insight deltas if requested
  if (shouldCompareInsights && baseline.insights && current.insights) {
    result.insightDeltas = compareInsights(baseline.insights, current.insights);
  }

  return result;
}

/**
 * Compare current analysis with the latest historical run for a path.
 * Returns null if no history exists.
 */
export async function compareWithLatest(
  path: string,
  current: AnalysisSnapshot,
  options: CompareOptions = {}
): Promise<ComparisonResult | null> {
  // Get latest historical run
  const latestRun = getLatestRun(path);
  if (!latestRun) {
    return null;
  }

  // Build baseline snapshot from historical data
  const baseline: AnalysisSnapshot = {
    runId: latestRun.manifest.runId,
    timestamp: latestRun.manifest.timestamp,
    callsites: latestRun.data.inferenceMap?.callsites || [],
    insights: latestRun.data.insights,
  };

  return compareSnapshots(baseline, current, options);
}

/**
 * Compare current analysis with a specific historical run.
 * Returns null if the run doesn't exist.
 */
export async function compareWithRun(
  runId: string,
  current: AnalysisSnapshot,
  options: CompareOptions = {}
): Promise<ComparisonResult | null> {
  // Load specific run
  const historicalRun = loadRun(runId);
  if (!historicalRun) {
    return null;
  }

  // Build baseline snapshot
  const baseline: AnalysisSnapshot = {
    runId: historicalRun.manifest.runId,
    timestamp: historicalRun.manifest.timestamp,
    callsites: historicalRun.data.inferenceMap?.callsites || [],
    insights: historicalRun.data.insights,
  };

  return compareSnapshots(baseline, current, options);
}

/**
 * Format a comparison result as a human-readable summary.
 * Provides concise, actionable summary for pre-deploy review.
 */
export function formatComparisonSummary(comparison: ComparisonResult): string {
  const lines: string[] = [];

  // Header with delta
  const delta = comparison.metrics.netChange;
  const deltaStr = delta > 0 ? `+${delta}` : delta.toString();
  lines.push(`Comparing with run from ${new Date(comparison.baseTimestamp).toLocaleDateString()}`);
  lines.push(`Inference points: ${comparison.metrics.totalBefore} → ${comparison.metrics.totalAfter} (${deltaStr})`);
  lines.push('');

  // Changes summary
  if (comparison.metrics.addedCount > 0) {
    lines.push(`  + ${comparison.metrics.addedCount} new inference point${comparison.metrics.addedCount !== 1 ? 's' : ''}`);
  }
  if (comparison.metrics.removedCount > 0) {
    lines.push(`  - ${comparison.metrics.removedCount} removed inference point${comparison.metrics.removedCount !== 1 ? 's' : ''}`);
  }
  if (comparison.metrics.changedCount > 0) {
    lines.push(`  ~ ${comparison.metrics.changedCount} modified inference point${comparison.metrics.changedCount !== 1 ? 's' : ''}`);
  }

  // Insight deltas (if available)
  if (comparison.insightDeltas) {
    const { newCritical, resolvedCritical, newWarnings, resolvedWarnings } = comparison.insightDeltas;
    if (newCritical > 0) {
      lines.push(`  ! ${newCritical} new critical issue${newCritical !== 1 ? 's' : ''}`);
    }
    if (resolvedCritical > 0) {
      lines.push(`  ✓ ${resolvedCritical} critical issue${resolvedCritical !== 1 ? 's' : ''} resolved`);
    }
    if (newWarnings > 0) {
      lines.push(`  ! ${newWarnings} new warning${newWarnings !== 1 ? 's' : ''}`);
    }
    if (resolvedWarnings > 0) {
      lines.push(`  ✓ ${resolvedWarnings} warning${resolvedWarnings !== 1 ? 's' : ''} resolved`);
    }
  }

  // No changes case
  if (comparison.metrics.addedCount === 0 &&
      comparison.metrics.removedCount === 0 &&
      comparison.metrics.changedCount === 0) {
    lines.push('  No changes detected');
  }

  return lines.join('\n');
}

/**
 * Check if comparison has significant changes that warrant attention.
 * Used to highlight important changes in the output.
 */
export function hasSignificantChanges(comparison: ComparisonResult): boolean {
  // Any added/removed/changed inference points are significant
  if (comparison.metrics.addedCount > 0 ||
      comparison.metrics.removedCount > 0 ||
      comparison.metrics.changedCount > 0) {
    return true;
  }

  // New critical insights are significant
  if (comparison.insightDeltas?.newCritical && comparison.insightDeltas.newCritical > 0) {
    return true;
  }

  return false;
}
