/**
 * Core Module Exports - PeakInfer TDD v1.3
 * 
 * This module provides TDD-compliant exports while delegating to the
 * actual implementations in src/slc/.
 * 
 * TDD v1.3 Module Mapping:
 * - src/core/scan/scanner.ts → src/slc/scanner.ts
 * - src/core/static/analyzer.ts → src/slc/agent-analyzer.ts
 * - src/core/format/normalizer.ts → src/slc/format/normalizer.ts
 * - src/core/join/joiner.ts → src/slc/join/joiner.ts
 * - src/core/insights/engine.ts → src/slc/insights/engine.ts
 */

// Re-export from slc modules using TDD-compliant names

// Scanner (TDD: src/core/scan/)
export { scan } from '../slc/scanner.js';

// Format Normalizer (TDD: src/core/format/)
export {
  detectFormat,
  normalizeEventsFile,
  normalizeWithCodebaseContext,
  normalizeWithAgent,
  type NormalizerOptions,
  type AgentNormalizerConfig,
  type AgentNormalizationResult,
} from '../slc/format/index.js';

// Join Engine (TDD: src/core/join/)
export {
  joinStaticAndRuntime,
  detectDrift,
  type JoinOptions,
  type JoinResult,
  type DriftReport,
  type DriftDetectionOptions,
} from '../slc/join/index.js';

// Insights Engine (TDD: src/core/insights/)
export {
  generateInsights,
  type Insight,
  type InsightReport,
  type InsightContext,
  type InsightSeverity,
  type InsightCategory,
} from '../slc/insights/index.js';

// Pricing (TDD: src/core/tradeoffs/)
export { calculatePricing } from '../slc/pricing.js';

// Profiler (TDD: src/core/runtime/)
export { profileEvents, type ProfileOptions, type ProfileResult } from '../slc/profiler.js';

// Types
export type {
  Callsite,
  ClassifiedCallsite,
  JoinedInference,
  DriftSignal,
  DriftType,
  UsageStats,
  CombinedAnalysisResult,
  InferencePatterns,
  PricingSummary,
  TechStack,
  ScanResult,
  StackMap,
  AnalysisState,
  AnalysisResult,
} from '../slc/types.js';

