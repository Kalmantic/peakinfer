/**
 * Join Engine Module - PeakInfer TDD v1.3
 * 
 * Correlates static code analysis with runtime events.
 * Detects drift between code intent and runtime reality.
 */

export {
  joinStaticAndRuntime,
  computeUsageStats,
  detectMismatchDrift,
  detectPatternMismatch,
  type JoinOptions,
  type JoinResult,
} from './joiner.js';

export { detectDrift, type DriftDetectionOptions, type DriftReport } from './drift.js';

