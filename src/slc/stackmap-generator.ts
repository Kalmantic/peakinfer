/**
 * StackMap Knowledge Graph Generator
 *
 * This module generates the StackMapKG - the core defensibility asset that:
 * 1. Captures topology data (no source code, just patterns)
 * 2. Calculates maturity/diversity scores
 * 3. Generates anonymous stackId for deduplication
 * 4. Stores to local history for future training data
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import {
  StackMapKG,
  ProviderStats,
  SDKInfo,
  PatternStats,
  ScaleMetrics,
  MaturityScores,
  FeedbackData,
  HistoryIndex,
  HistoryEntry,
  InferencePatterns,
  Language,
} from './types.js';

const PEAKINFER_VERSION = '0.95.0';
const HISTORY_DIR = path.join(process.env.HOME || '~', '.peakinfer', 'history');
const HISTORY_INDEX_FILE = path.join(HISTORY_DIR, 'index.json');

// =============================================================================
// STACKID GENERATION (Anonymous, hash-based)
// =============================================================================

/**
 * Generate anonymous stackId from topology fingerprint
 * This ensures same codebase gets same ID without exposing any code
 */
export function generateStackId(
  providers: string[],
  models: string[],
  sdks: string[],
  patterns: string[],
  callsiteCount: number
): string {
  // Create a deterministic fingerprint from topology
  const fingerprint = JSON.stringify({
    providers: providers.sort(),
    models: models.sort(),
    sdks: sdks.sort(),
    patterns: patterns.sort(),
    scale: Math.floor(callsiteCount / 5) * 5, // Round to nearest 5 for privacy
  });

  // Generate SHA-256 hash and take first 16 chars
  const hash = crypto.createHash('sha256').update(fingerprint).digest('hex');
  return `pi_${hash.substring(0, 16)}`;
}

// =============================================================================
// SCORE CALCULATIONS
// =============================================================================

/**
 * Calculate pattern maturity score (0-100)
 * Higher = more resilience/optimization patterns implemented
 */
export function calculatePatternMaturity(patterns: PatternStats): number {
  const weights = {
    retry: 15,      // Essential for reliability
    caching: 20,    // Key for performance optimization
    routing: 15,    // Important for flexibility
    batching: 10,   // Good for throughput
    streaming: 10,  // Good for UX
    fallback: 20,   // Critical for reliability
    guardrails: 10, // Important for safety
  };

  let score = 0;
  if (patterns.retry.detected) score += weights.retry;
  if (patterns.caching.detected) score += weights.caching;
  if (patterns.routing.detected) score += weights.routing;
  if (patterns.batching.detected) score += weights.batching;
  if (patterns.streaming.detected) score += weights.streaming;
  if (patterns.fallback.detected) score += weights.fallback;
  if (patterns.guardrails.detected) score += weights.guardrails;

  return score;
}

/**
 * Calculate provider diversity score (0-1)
 * Higher = less vendor lock-in risk
 * Uses normalized entropy calculation
 */
export function calculateProviderDiversity(providers: ProviderStats[]): number {
  if (providers.length === 0) return 0;
  if (providers.length === 1) return 0; // Single provider = no diversity

  const total = providers.reduce((sum, p) => sum + p.callsiteCount, 0);
  if (total === 0) return 0;

  // Calculate Shannon entropy
  let entropy = 0;
  for (const provider of providers) {
    const p = provider.callsiteCount / total;
    if (p > 0) {
      entropy -= p * Math.log2(p);
    }
  }

  // Normalize by max possible entropy (log2 of provider count)
  const maxEntropy = Math.log2(providers.length);
  return maxEntropy > 0 ? entropy / maxEntropy : 0;
}

/**
 * Calculate resilience score (0-100)
 * Based on retry, fallback, and caching patterns
 */
export function calculateResilienceScore(patterns: PatternStats): number {
  let score = 0;

  // Retry patterns (0-40)
  if (patterns.retry.detected) {
    score += 25;
    if (patterns.retry.types.includes('exponential_backoff')) score += 10;
    if (patterns.retry.types.includes('circuit_breaker')) score += 5;
  }

  // Fallback patterns (0-35)
  if (patterns.fallback.detected) {
    score += 20;
    if (patterns.fallback.types.includes('provider_fallback')) score += 10;
    if (patterns.fallback.types.includes('model_fallback')) score += 5;
  }

  // Caching (0-25)
  if (patterns.caching.detected) {
    score += 15;
    if (patterns.caching.types.includes('semantic')) score += 10;
  }

  return Math.min(100, score);
}

/**
 * Calculate performance optimization readiness (0-100)
 * Based on patterns that enable performance gains
 */
export function calculatePerformanceOptimizationReadiness(
  patterns: PatternStats,
  providerDiversity: number
): number {
  let score = 0;

  // Caching reduces redundant calls (0-30)
  if (patterns.caching.detected) {
    score += 20;
    if (patterns.caching.types.includes('semantic')) score += 10;
  }

  // Routing enables model selection (0-25)
  if (patterns.routing.detected) {
    score += 15;
    if (patterns.routing.types.includes('performance_based')) score += 10;
  }

  // Batching improves throughput efficiency (0-15)
  if (patterns.batching.detected) score += 15;

  // Provider diversity enables switching (0-30)
  score += Math.round(providerDiversity * 30);

  return Math.min(100, score);
}

// =============================================================================
// STACKMAP KG GENERATION
// =============================================================================

export interface AnalysisData {
  // From agent analysis
  callsites: Array<{
    file: string;
    line: number;
    provider: string;
    model?: string;
  }>;
  sdks: string[];
  patterns: InferencePatterns;

  // From scan
  totalFiles: number;
  totalLines: number;
  languages: Record<string, number>;
  primaryLanguage: Language;

  // From pricing
  estimatedMonthlyThroughput: { low: number; high: number };
}

/**
 * Generate StackMapKG from analysis results
 */
export function generateStackMapKG(
  analysisData: AnalysisData,
  analyzedPath: string
): StackMapKG {
  // Build provider stats
  const providerMap = new Map<string, ProviderStats>();
  const allModels = new Set<string>();

  for (const callsite of analysisData.callsites) {
    const provider = callsite.provider || 'unknown';
    const model = callsite.model || 'unknown';

    allModels.add(model);

    if (!providerMap.has(provider)) {
      providerMap.set(provider, {
        name: provider,
        callsiteCount: 0,
        modelDistribution: {},
        patterns: [],
      });
    }

    const stats = providerMap.get(provider)!;
    stats.callsiteCount++;
    stats.modelDistribution[model] = (stats.modelDistribution[model] || 0) + 1;
  }

  const providers = Array.from(providerMap.values());

  // Build SDK info
  const sdks: SDKInfo[] = analysisData.sdks.map(sdk => ({
    name: sdk,
    wrapperType: inferWrapperType(sdk),
  }));

  // Build pattern stats
  const patternStats: PatternStats = {
    retry: {
      detected: analysisData.patterns.retry.detected,
      count: analysisData.patterns.retry.instances.length,
      types: analysisData.patterns.retry.type ? [analysisData.patterns.retry.type] : [],
    },
    caching: {
      detected: analysisData.patterns.caching.detected,
      count: analysisData.patterns.caching.instances.length,
      types: analysisData.patterns.caching.type ? [analysisData.patterns.caching.type] : [],
    },
    routing: {
      detected: analysisData.patterns.routing.detected,
      count: analysisData.patterns.routing.instances.length,
      types: analysisData.patterns.routing.type ? [analysisData.patterns.routing.type] : [],
    },
    batching: {
      detected: analysisData.patterns.batching.detected,
      count: analysisData.patterns.batching.instances.length,
      types: analysisData.patterns.batching.type ? [analysisData.patterns.batching.type] : [],
    },
    streaming: {
      detected: analysisData.patterns.streaming.detected,
      count: analysisData.patterns.streaming.instances.length,
      types: analysisData.patterns.streaming.type ? [analysisData.patterns.streaming.type] : [],
    },
    fallback: {
      detected: analysisData.patterns.fallback.detected,
      count: analysisData.patterns.fallback.instances.length,
      types: analysisData.patterns.fallback.type ? [analysisData.patterns.fallback.type] : [],
    },
    guardrails: {
      detected: analysisData.patterns.guardrails.detected,
      count: analysisData.patterns.guardrails.instances.length,
      types: analysisData.patterns.guardrails.type ? [analysisData.patterns.guardrails.type] : [],
    },
  };

  // Calculate scores
  const patternMaturity = calculatePatternMaturity(patternStats);
  const providerDiversity = calculateProviderDiversity(providers);
  const resilienceScore = calculateResilienceScore(patternStats);
  const performanceOptimizationReadiness = calculatePerformanceOptimizationReadiness(patternStats, providerDiversity);

  // Generate stackId
  const detectedPatterns: string[] = [];
  if (patternStats.retry.detected) detectedPatterns.push('retry');
  if (patternStats.caching.detected) detectedPatterns.push('caching');
  if (patternStats.routing.detected) detectedPatterns.push('routing');
  if (patternStats.batching.detected) detectedPatterns.push('batching');
  if (patternStats.streaming.detected) detectedPatterns.push('streaming');
  if (patternStats.fallback.detected) detectedPatterns.push('fallback');
  if (patternStats.guardrails.detected) detectedPatterns.push('guardrails');

  const stackId = generateStackId(
    providers.map(p => p.name),
    Array.from(allModels),
    analysisData.sdks,
    detectedPatterns,
    analysisData.callsites.length
  );

  // Estimate monthly tokens (rough: assume 1000 tokens/call, 1000 calls/day per callsite)
  const estimatedMonthlyTokens = analysisData.callsites.length * 1000 * 1000 * 30;

  const stackMapKG: StackMapKG = {
    stackId,
    peakinferVersion: PEAKINFER_VERSION,
    generatedAt: new Date().toISOString(),

    topology: {
      providers,
      sdks,
      patterns: patternStats,
      primaryLanguage: analysisData.primaryLanguage,
      languages: analysisData.languages,
    },

    scale: {
      totalCallsites: analysisData.callsites.length,
      uniqueModels: allModels.size,
      uniqueProviders: providers.length,
      estimatedMonthlyTokens,
      estimatedMonthlyThroughput: (analysisData.estimatedMonthlyThroughput.low + analysisData.estimatedMonthlyThroughput.high) / 2,
      repoFiles: analysisData.totalFiles,
      repoLOC: analysisData.totalLines,
    },

    scores: {
      patternMaturity,
      providerDiversity: Math.round(providerDiversity * 100) / 100,
      resilienceScore,
      performanceOptimizationReadiness,
    },

    pricingSnapshot: {
      date: new Date().toISOString().split('T')[0],
      estimatedMonthlyThroughput: analysisData.estimatedMonthlyThroughput,
      topProviderLatencies: providers
        .sort((a, b) => b.callsiteCount - a.callsiteCount)
        .slice(0, 3)
        .map(p => ({
          provider: p.name,
          avgLatencyMs: Math.round(100 / (p.callsiteCount || 1)),  // Approximate latency based on usage
        })),
    },
  };

  return stackMapKG;
}

// =============================================================================
// LOCAL HISTORY STORAGE
// =============================================================================

/**
 * Ensure history directory exists
 */
function ensureHistoryDir(): void {
  if (!fs.existsSync(HISTORY_DIR)) {
    fs.mkdirSync(HISTORY_DIR, { recursive: true });
  }
}

/**
 * Load history index
 */
export function loadHistoryIndex(): HistoryIndex {
  ensureHistoryDir();

  if (fs.existsSync(HISTORY_INDEX_FILE)) {
    try {
      const content = fs.readFileSync(HISTORY_INDEX_FILE, 'utf-8');
      return JSON.parse(content);
    } catch {
      // Corrupted index, start fresh
    }
  }

  return {
    version: '1.0',
    lastUpdated: new Date().toISOString(),
    entries: [],
  };
}

/**
 * Save history index
 */
function saveHistoryIndex(index: HistoryIndex): void {
  ensureHistoryDir();
  index.lastUpdated = new Date().toISOString();
  fs.writeFileSync(HISTORY_INDEX_FILE, JSON.stringify(index, null, 2));
}

/**
 * Save StackMapKG to local history
 */
export function saveToHistory(
  stackMapKG: StackMapKG,
  analyzedPath: string,
  recommendations?: unknown
): void {
  ensureHistoryDir();

  const stackDir = path.join(HISTORY_DIR, stackMapKG.stackId);
  if (!fs.existsSync(stackDir)) {
    fs.mkdirSync(stackDir, { recursive: true });
  }

  // Save stackmap
  fs.writeFileSync(
    path.join(stackDir, 'stackmap.json'),
    JSON.stringify(stackMapKG, null, 2)
  );

  // Save recommendations if provided
  if (recommendations) {
    fs.writeFileSync(
      path.join(stackDir, 'recommendations.json'),
      JSON.stringify(recommendations, null, 2)
    );
  }

  // Create feedback stub
  const feedbackStub: FeedbackData = {
    stackId: stackMapKG.stackId,
    sessionId: `session_${Date.now()}`,
    updatedAt: new Date().toISOString(),
    signals: [],
  };
  fs.writeFileSync(
    path.join(stackDir, 'feedback.json'),
    JSON.stringify(feedbackStub, null, 2)
  );

  // Update index
  const index = loadHistoryIndex();
  const existingIdx = index.entries.findIndex(e => e.stackId === stackMapKG.stackId);

  const entry: HistoryEntry = {
    stackId: stackMapKG.stackId,
    path: analyzedPath,
    analyzedAt: stackMapKG.generatedAt,
    peakinferVersion: stackMapKG.peakinferVersion,
    summary: {
      callsites: stackMapKG.scale.totalCallsites,
      providers: stackMapKG.topology.providers.map(p => p.name),
      estimatedMonthlyThroughput: stackMapKG.pricingSnapshot?.estimatedMonthlyThroughput || { low: 0, high: 0 },
      patternMaturity: stackMapKG.scores.patternMaturity,
    },
  };

  if (existingIdx >= 0) {
    index.entries[existingIdx] = entry;
  } else {
    index.entries.unshift(entry); // Most recent first
  }

  // Keep only last 100 entries
  index.entries = index.entries.slice(0, 100);

  saveHistoryIndex(index);
}

/**
 * Get history entry by stackId
 */
export function getHistoryEntry(stackId: string): {
  stackmap: StackMapKG;
  recommendations?: unknown;
  feedback: FeedbackData;
} | null {
  const stackDir = path.join(HISTORY_DIR, stackId);

  if (!fs.existsSync(stackDir)) {
    return null;
  }

  try {
    const stackmap = JSON.parse(
      fs.readFileSync(path.join(stackDir, 'stackmap.json'), 'utf-8')
    );

    let recommendations;
    const recsPath = path.join(stackDir, 'recommendations.json');
    if (fs.existsSync(recsPath)) {
      recommendations = JSON.parse(fs.readFileSync(recsPath, 'utf-8'));
    }

    const feedback = JSON.parse(
      fs.readFileSync(path.join(stackDir, 'feedback.json'), 'utf-8')
    );

    return { stackmap, recommendations, feedback };
  } catch {
    return null;
  }
}

// =============================================================================
// HELPERS
// =============================================================================

function inferWrapperType(sdk: string): SDKInfo['wrapperType'] {
  const sdkLower = sdk.toLowerCase();
  if (sdkLower.includes('litellm')) return 'litellm';
  if (sdkLower.includes('langchain')) return 'langchain';
  if (sdkLower.includes('llamaindex') || sdkLower.includes('llama_index')) return 'llamaindex';
  if (sdkLower.includes('haystack')) return 'haystack';
  if (sdkLower.includes('dspy')) return 'dspy';
  if (['openai', 'anthropic', 'google', 'cohere', 'mistral'].some(p => sdkLower.includes(p))) return 'direct';
  return 'custom';
}
