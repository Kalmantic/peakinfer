/**
 * Evaluation Module - PeakInfer EVAL-FRAMEWORK-DESIGN.md
 * 
 * Correctness measurement using human-labeled ground truth.
 */

// Legacy exports (for run-evaluation.ts compatibility)
export { evaluateStaticAnalysis, evaluateFormatDetection } from './metrics.js';
export { STATIC_ANALYSIS_GATES, FORMAT_DETECTION_GATES, generateEvaluationReport } from './metrics.js';

// New metrics types
export type { 
  ConfusionMatrix, 
  ClassificationMetrics, 
  CalibrationBucket, 
  CalibrationReport,
  PredictionWithConfidence,
  StaticAnalysisGroundTruth,
  StaticAnalysisPrediction,
  FormatDetectionGroundTruth,
  FormatDetectionPrediction,
  QualityGates,
} from './metrics.js';

export { 
  calculateMetrics, 
  calculateCalibration,
  checkQualityGates,
  DEFAULT_QUALITY_GATES,
} from './metrics.js';

// Evaluation runner (new)
export * from './runner.js';

// Calibration (existing)
export * from './calibration.js';

// Ground truth (existing)
export * from './ground-truth.js';
