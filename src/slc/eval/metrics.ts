/**
 * Evaluation Metrics - PeakInfer EVAL-FRAMEWORK-DESIGN.md
 * 
 * Core metrics for measuring correctness against ground truth.
 * 
 * Metrics:
 * - Precision: TP / (TP + FP) - "Of what we found, how much is correct?"
 * - Recall: TP / (TP + FN) - "Of what exists, how much did we find?"
 * - F1: Harmonic mean of precision and recall
 * - Confidence Calibration: Does confidence match actual accuracy?
 */

// =============================================================================
// QUALITY GATES (for run-evaluation.ts compatibility)
// =============================================================================

export const STATIC_ANALYSIS_GATES = {
  precision: 0.95,
  recall: 0.90,
  f1: 0.92,
  ece: 0.10,
  providerAccuracy: 0.95,
  modelAccuracy: 0.85,
};

export const FORMAT_DETECTION_GATES = {
  formatAccuracy: 0.95,
  formatTypeAccuracy: 0.95,
  mappingAccuracy: 0.85,
  fieldMappingAccuracy: 0.85,
  extractionCorrectness: 0.85,
  ece: 0.15,
};

export function generateEvaluationReport(
  staticResults: Array<{ fixtureId: string; precision: number; recall: number; f1: number }>,
  formatResults: Array<{ fixtureId: string; formatAccuracy: number; mappingAccuracy: number }>
): string {
  const lines: string[] = [
    'PEAKINFER EVALUATION REPORT',
    '='.repeat(50),
    '',
    'Static Analysis Results:',
  ];
  
  for (const r of staticResults) {
    lines.push(`  ${r.fixtureId}: P=${(r.precision*100).toFixed(1)}% R=${(r.recall*100).toFixed(1)}% F1=${(r.f1*100).toFixed(1)}%`);
  }
  
  lines.push('');
  lines.push('Format Detection Results:');
  
  for (const r of formatResults) {
    lines.push(`  ${r.fixtureId}: Format=${(r.formatAccuracy*100).toFixed(1)}% Mapping=${(r.mappingAccuracy*100).toFixed(1)}%`);
  }
  
  return lines.join('\n');
}

// =============================================================================
// CORE METRICS
// =============================================================================

/**
 * Basic confusion matrix values.
 */
export interface ConfusionMatrix {
  /** True positives - correctly identified */
  tp: number;
  
  /** False positives - incorrectly identified */
  fp: number;
  
  /** True negatives - correctly rejected */
  tn: number;
  
  /** False negatives - incorrectly missed */
  fn: number;
}

/**
 * Standard classification metrics.
 */
export interface ClassificationMetrics {
  /** Precision: TP / (TP + FP) */
  precision: number;
  
  /** Recall: TP / (TP + FN) */
  recall: number;
  
  /** F1 Score: 2 * (precision * recall) / (precision + recall) */
  f1: number;
  
  /** Accuracy: (TP + TN) / (TP + TN + FP + FN) */
  accuracy: number;
  
  /** Total predictions */
  total: number;
  
  /** Confusion matrix */
  confusion: ConfusionMatrix;
}

/**
 * Calculate classification metrics from confusion matrix.
 */
export function calculateMetrics(confusion: ConfusionMatrix): ClassificationMetrics {
  const { tp, fp, tn, fn } = confusion;
  
  const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
  const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
  const f1 = precision + recall > 0 ? 2 * (precision * recall) / (precision + recall) : 0;
  const total = tp + fp + tn + fn;
  const accuracy = total > 0 ? (tp + tn) / total : 0;
  
  return {
    precision,
    recall,
    f1,
    accuracy,
    total,
    confusion,
  };
}

// =============================================================================
// CONFIDENCE CALIBRATION
// =============================================================================

/**
 * A single calibration bucket.
 */
export interface CalibrationBucket {
  /** Confidence range start */
  rangeStart: number;
  
  /** Confidence range end */
  rangeEnd: number;
  
  /** Number of predictions in this bucket */
  count: number;
  
  /** Average confidence in this bucket */
  avgConfidence: number;
  
  /** Actual accuracy (fraction correct) */
  actualAccuracy: number;
  
  /** Calibration error: |avgConfidence - actualAccuracy| */
  error: number;
}

/**
 * Full calibration report.
 */
export interface CalibrationReport {
  /** Calibration buckets */
  buckets: CalibrationBucket[];
  
  /** Expected Calibration Error (ECE) */
  ece: number;
  
  /** Maximum Calibration Error (MCE) */
  mce: number;
  
  /** Overall accuracy */
  accuracy: number;
  
  /** Average confidence */
  avgConfidence: number;
  
  /** Total predictions */
  totalPredictions: number;
  
  /** Is the model well-calibrated? */
  isCalibrated: boolean;
  
  /** Calibration assessment */
  assessment: 'excellent' | 'good' | 'fair' | 'poor';
}

/**
 * Prediction with confidence and ground truth.
 */
export interface PredictionWithConfidence {
  /** Prediction identifier */
  id: string;
  
  /** Predicted value */
  predicted: unknown;
  
  /** Model confidence (0-1) */
  confidence: number;
  
  /** Actual/ground truth value */
  actual: unknown;
  
  /** Whether prediction was correct */
  isCorrect: boolean;
}

/**
 * Calculate calibration metrics for predictions.
 * 
 * Per EVAL-FRAMEWORK-DESIGN.md Section 4.4:
 * - Bucket predictions by confidence
 * - Compare avg confidence to actual accuracy
 * - Calculate ECE and MCE
 */
export function calculateCalibration(
  predictions: PredictionWithConfidence[],
  numBuckets = 10
): CalibrationReport {
  if (predictions.length === 0) {
    return {
      buckets: [],
      ece: 0,
      mce: 0,
      accuracy: 0,
      avgConfidence: 0,
      totalPredictions: 0,
      isCalibrated: false,
      assessment: 'poor',
    };
  }
  
  const bucketSize = 1.0 / numBuckets;
  const buckets: CalibrationBucket[] = [];
  
  // Initialize buckets
  for (let i = 0; i < numBuckets; i++) {
    buckets.push({
      rangeStart: i * bucketSize,
      rangeEnd: (i + 1) * bucketSize,
      count: 0,
      avgConfidence: 0,
      actualAccuracy: 0,
      error: 0,
    });
  }
  
  // Assign predictions to buckets
  const bucketPredictions: PredictionWithConfidence[][] = Array.from(
    { length: numBuckets },
    () => []
  );
  
  for (const pred of predictions) {
    const bucketIdx = Math.min(
      Math.floor(pred.confidence * numBuckets),
      numBuckets - 1
    );
    bucketPredictions[bucketIdx].push(pred);
  }
  
  // Calculate bucket metrics
  let totalEce = 0;
  let maxError = 0;
  
  for (let i = 0; i < numBuckets; i++) {
    const preds = bucketPredictions[i];
    const bucket = buckets[i];
    
    bucket.count = preds.length;
    
    if (preds.length > 0) {
      bucket.avgConfidence = preds.reduce((sum, p) => sum + p.confidence, 0) / preds.length;
      bucket.actualAccuracy = preds.filter(p => p.isCorrect).length / preds.length;
      bucket.error = Math.abs(bucket.avgConfidence - bucket.actualAccuracy);
      
      // Weighted contribution to ECE
      totalEce += (bucket.count / predictions.length) * bucket.error;
      maxError = Math.max(maxError, bucket.error);
    }
  }
  
  const totalCorrect = predictions.filter(p => p.isCorrect).length;
  const accuracy = totalCorrect / predictions.length;
  const avgConfidence = predictions.reduce((sum, p) => sum + p.confidence, 0) / predictions.length;
  
  // Determine calibration quality
  let assessment: CalibrationReport['assessment'];
  if (totalEce < 0.05) {
    assessment = 'excellent';
  } else if (totalEce < 0.10) {
    assessment = 'good';
  } else if (totalEce < 0.20) {
    assessment = 'fair';
  } else {
    assessment = 'poor';
  }
  
  return {
    buckets: buckets.filter(b => b.count > 0),
    ece: totalEce,
    mce: maxError,
    accuracy,
    avgConfidence,
    totalPredictions: predictions.length,
    isCalibrated: totalEce < 0.10,
    assessment,
  };
}

// =============================================================================
// STATIC ANALYSIS EVALUATION
// =============================================================================

/**
 * Ground truth for static analysis evaluation.
 * Per EVAL-FRAMEWORK-DESIGN.md Section 2.
 */
export interface StaticAnalysisGroundTruth {
  /** Fixture identifier */
  fixtureId: string;
  
  /** Path to fixture */
  fixturePath: string;
  
  /** Expected callsites */
  callsites: Array<{
    file: string;
    line: number;
    provider: string;
    model: string | null;
    pattern?: string;
    notes?: string;
    category?: string;
  }>;
  
  /** Non-callsites (negative examples) */
  nonCallsites: Array<{
    file: string;
    line: number;
    reason: string;
  }>;
}

/**
 * Static analysis prediction.
 */
export interface StaticAnalysisPrediction {
  file: string;
  line: number;
  provider?: string | null;
  model?: string | null;
  confidence: number;
}

/**
 * Evaluate static analysis predictions against ground truth.
 * Returns an interface compatible with both new and legacy (run-evaluation.ts) usage.
 */
export function evaluateStaticAnalysis(
  predictions: StaticAnalysisPrediction[],
  groundTruth: StaticAnalysisGroundTruth | StaticAnalysisGroundTruth['callsites'],
  options: { lineToleranceThreshold?: number; locationTolerance?: number } = {}
): {
  metrics: ClassificationMetrics;
  calibration: CalibrationReport;
  details: {
    truePositives: Array<{ pred: StaticAnalysisPrediction; gt: StaticAnalysisGroundTruth['callsites'][0] }>;
    falsePositives: StaticAnalysisPrediction[];
    falseNegatives: StaticAnalysisGroundTruth['callsites'];
  };
  // Legacy compatibility properties (for run-evaluation.ts)
  overall: { precision: number; recall: number; f1: number };
  providerAccuracy: number;
  modelAccuracy: number;
  passesGates: boolean;
  byCategory: Map<string, { precision: number; recall: number; f1: number }>;
} {
  // Handle both new (groundTruth object) and legacy (callsites array) input
  const callsites: StaticAnalysisGroundTruth['callsites'] = Array.isArray(groundTruth)
    ? groundTruth
    : groundTruth.callsites;
  
  const nonCallsites: StaticAnalysisGroundTruth['nonCallsites'] = Array.isArray(groundTruth)
    ? []
    : groundTruth.nonCallsites || [];
  
  const lineTolerance = options.lineToleranceThreshold ?? options.locationTolerance ?? 3;
  const matchedGt = new Set<number>();
  const truePositives: Array<{ pred: StaticAnalysisPrediction; gt: StaticAnalysisGroundTruth['callsites'][0] }> = [];
  const falsePositives: StaticAnalysisPrediction[] = [];
  const calibrationPredictions: PredictionWithConfidence[] = [];
  let providerCorrect = 0;
  let modelCorrect = 0;
  
  // Match predictions to ground truth
  for (const pred of predictions) {
    let matched = false;
    
    for (let i = 0; i < callsites.length; i++) {
      if (matchedGt.has(i)) continue;
      
      const gt = callsites[i];
      
      // Match by file and line (with tolerance)
      if (
        pred.file.endsWith(gt.file) &&
        Math.abs(pred.line - gt.line) <= lineTolerance
      ) {
        truePositives.push({ pred, gt });
        matchedGt.add(i);
        matched = true;
        
        // Track provider and model accuracy
        if (pred.provider?.toLowerCase() === gt.provider?.toLowerCase()) {
          providerCorrect++;
        }
        if (pred.model?.toLowerCase() === gt.model?.toLowerCase()) {
          modelCorrect++;
        }
        
        calibrationPredictions.push({
          id: `${pred.file}:${pred.line}`,
          predicted: pred,
          confidence: pred.confidence,
          actual: gt,
          isCorrect: true,
        });
        
        break;
      }
    }
    
    // Check if prediction is in non-callsites (definite false positive)
    if (!matched) {
      const isNonCallsite = nonCallsites.some(
        nc => pred.file.endsWith(nc.file) && Math.abs(pred.line - nc.line) <= lineTolerance
      );
      
      falsePositives.push(pred);
      
      calibrationPredictions.push({
        id: `${pred.file}:${pred.line}`,
        predicted: pred,
        confidence: pred.confidence,
        actual: null,
        isCorrect: false,
      });
    }
  }
  
  // Find false negatives (unmatched ground truth)
  const falseNegatives = callsites.filter((_, i) => !matchedGt.has(i));
  
  // Calculate metrics
  const confusion: ConfusionMatrix = {
    tp: truePositives.length,
    fp: falsePositives.length,
    tn: nonCallsites.length, // Assuming we correctly didn't flag these
    fn: falseNegatives.length,
  };
  
  const metrics = calculateMetrics(confusion);
  const calibration = calculateCalibration(calibrationPredictions);
  
  // Calculate provider and model accuracy
  const providerAccuracy = truePositives.length > 0 ? providerCorrect / truePositives.length : 0;
  const modelAccuracy = truePositives.length > 0 ? modelCorrect / truePositives.length : 0;
  
  // Check quality gates
  const passesGates = 
    metrics.precision >= STATIC_ANALYSIS_GATES.precision &&
    metrics.recall >= STATIC_ANALYSIS_GATES.recall &&
    metrics.f1 >= STATIC_ANALYSIS_GATES.f1;
  
  // Group by category (pattern) for legacy compatibility
  const byCategory = new Map<string, { precision: number; recall: number; f1: number }>();
  const categoryTp = new Map<string, number>();
  const categoryTotal = new Map<string, number>();
  
  for (const tp of truePositives) {
    const pattern = tp.gt.pattern || 'unknown';
    categoryTp.set(pattern, (categoryTp.get(pattern) || 0) + 1);
    categoryTotal.set(pattern, (categoryTotal.get(pattern) || 0) + 1);
  }
  
  for (const [pattern, tp] of categoryTp) {
    const total = categoryTotal.get(pattern) || 0;
    const prec = total > 0 ? tp / total : 0;
    byCategory.set(pattern, { precision: prec, recall: prec, f1: prec });
  }
  
  return {
    metrics,
    calibration,
    details: {
      truePositives,
      falsePositives,
      falseNegatives,
    },
    // Legacy compatibility
    overall: {
      precision: metrics.precision,
      recall: metrics.recall,
      f1: metrics.f1,
    },
    providerAccuracy,
    modelAccuracy,
    passesGates,
    byCategory,
  };
}

// =============================================================================
// FORMAT DETECTION EVALUATION
// =============================================================================

/**
 * Ground truth for format detection evaluation.
 * Per EVAL-FRAMEWORK-DESIGN.md Section 7.
 */
export interface FormatDetectionGroundTruth {
  /** Fixture identifier */
  fixtureId: string;
  
  /** Path to fixture file */
  formatFile: string;
  
  /** Expected format detection */
  expected: {
    format: string;
    confidence: number;
  };
  
  /** Expected field mappings */
  fieldMappings: Array<{
    targetField: string;
    sourceExpression: string;
    confidence: number;
  }>;
  
  /** Sample extracted values for validation */
  sampleExtractedValues?: Record<string, unknown[]>;
}

/**
 * Format detection prediction.
 */
export interface FormatDetectionPrediction {
  format: string;
  confidence: number;
  mappings: Array<{
    targetField: string;
    sourceExpression: string;
    confidence: number;
  }>;
}

/**
 * Evaluate format detection predictions.
 * Supports both single prediction and array of predictions (for run-evaluation.ts compatibility).
 */
export function evaluateFormatDetection(
  prediction: FormatDetectionPrediction | Array<{ file: string; detectedFormat: string; fieldMappings: Record<string, string>; extractedEvents: Record<string, unknown>[]; confidence: number }>,
  groundTruth: FormatDetectionGroundTruth | FormatDetectionGroundTruth[]
): {
  formatAccuracy: number;
  mappingAccuracy: number;
  overallAccuracy: number;
  calibration: CalibrationReport;
  details: {
    formatCorrect: boolean;
    correctMappings: string[];
    incorrectMappings: string[];
    missingMappings: string[];
  };
  // Legacy compatibility
  formatTypeAccuracy: number;
  fieldMappingAccuracy: number;
  extractionCorrectness: number;
  passesGates: boolean;
} {
  // Handle legacy array input
  if (Array.isArray(prediction)) {
    // Convert legacy format to new format for first prediction
    const legacyPred = prediction[0];
    if (legacyPred) {
      const convertedPred: FormatDetectionPrediction = {
        format: legacyPred.detectedFormat,
        confidence: legacyPred.confidence,
        mappings: Object.entries(legacyPred.fieldMappings).map(([target, source]) => ({
          targetField: target,
          sourceExpression: source,
          confidence: legacyPred.confidence,
        })),
      };
      prediction = convertedPred;
    } else {
      prediction = { format: 'unknown', confidence: 0, mappings: [] };
    }
  }
  
  // Handle legacy array ground truth
  if (Array.isArray(groundTruth)) {
    groundTruth = groundTruth[0] || {
      fixtureId: 'unknown',
      formatFile: '',
      expected: { format: 'unknown', confidence: 0 },
      fieldMappings: [],
    };
  }
  // Check format detection
  const formatCorrect = prediction.format === groundTruth.expected.format;
  
  // Check field mappings
  const correctMappings: string[] = [];
  const incorrectMappings: string[] = [];
  const matchedGt = new Set<string>();
  
  for (const predMapping of prediction.mappings) {
    const gtMapping = groundTruth.fieldMappings.find(
      m => m.targetField === predMapping.targetField
    );
    
    if (gtMapping) {
      matchedGt.add(gtMapping.targetField);
      
      // Check if source expression matches (flexible matching)
      const sourceMatches = normalizeSourceExpression(predMapping.sourceExpression) ===
        normalizeSourceExpression(gtMapping.sourceExpression);
      
      if (sourceMatches) {
        correctMappings.push(predMapping.targetField);
    } else {
        incorrectMappings.push(predMapping.targetField);
      }
    } else {
      incorrectMappings.push(predMapping.targetField);
    }
  }
  
  // Find missing mappings
  const missingMappings = groundTruth.fieldMappings
    .filter(m => !matchedGt.has(m.targetField))
    .map(m => m.targetField);
  
  // Calculate metrics
  const formatAccuracy = formatCorrect ? 1 : 0;
  const totalExpectedMappings = groundTruth.fieldMappings.length;
  const mappingAccuracy = totalExpectedMappings > 0
    ? correctMappings.length / totalExpectedMappings
    : 0;
  const overallAccuracy = (formatAccuracy + mappingAccuracy) / 2;
  
  // Build calibration predictions
  const calibrationPredictions: PredictionWithConfidence[] = [
    {
      id: 'format',
      predicted: prediction.format,
      confidence: prediction.confidence,
      actual: groundTruth.expected.format,
      isCorrect: formatCorrect,
    },
    ...prediction.mappings.map(m => ({
      id: `mapping:${m.targetField}`,
      predicted: m.sourceExpression,
      confidence: m.confidence,
      actual: groundTruth.fieldMappings.find(gt => gt.targetField === m.targetField)?.sourceExpression,
      isCorrect: correctMappings.includes(m.targetField),
    })),
  ];
  
  const calibration = calculateCalibration(calibrationPredictions);
  
  // Calculate extraction correctness (for legacy compatibility)
  const extractionCorrectness = mappingAccuracy;
  
  // Check quality gates
  const passesGates = 
    formatAccuracy >= FORMAT_DETECTION_GATES.formatTypeAccuracy &&
    mappingAccuracy >= FORMAT_DETECTION_GATES.fieldMappingAccuracy;
  
  return {
    formatAccuracy,
    mappingAccuracy,
    overallAccuracy,
    calibration,
    details: {
      formatCorrect,
      correctMappings,
      incorrectMappings,
      missingMappings,
    },
    // Legacy compatibility
    formatTypeAccuracy: formatAccuracy,
    fieldMappingAccuracy: mappingAccuracy,
    extractionCorrectness,
    passesGates,
  };
}

/**
 * Normalize source expression for comparison.
 */
function normalizeSourceExpression(expr: string): string {
  return expr
    .toLowerCase()
    .replace(/^\$\./, '')
    .replace(/\s+/g, '')
    .replace(/['"]/g, '');
}

// =============================================================================
// DRIFT DETECTION EVALUATION
// =============================================================================

/**
 * Ground truth for drift detection evaluation.
 * Per EVAL-FRAMEWORK-DESIGN.md Section 5.
 */
export interface DriftDetectionGroundTruth {
  /** Fixture identifier */
  fixtureId: string;
  
  /** Path to static analysis fixture */
  staticFixturePath: string;
  
  /** Path to runtime events fixture */
  runtimeFixturePath: string;
  
  /** Expected drift signals */
  expectedDrift: Array<{
    type: 'code_only' | 'runtime_only' | 'model_mismatch' | 'provider_mismatch' | 'pattern_mismatch';
    file?: string;
    line?: number;
    codeValue?: string;
    runtimeValue?: string;
    description: string;
    severity: 'error' | 'warning' | 'info';
  }>;
  
  /** Expected no-drift cases (matched callsites) */
  expectedMatches: Array<{
    callsiteFile: string;
    callsiteLine: number;
    eventCount: number;
  }>;
}

/**
 * Drift detection prediction.
 */
export interface DriftDetectionPrediction {
  drift: Array<{
    type: string;
    file?: string;
    line?: number;
    codeValue?: string;
    runtimeValue?: string;
    description: string;
    severity: string;
  }>;
  matches: Array<{
    callsiteFile: string;
    callsiteLine: number;
    eventCount: number;
  }>;
  joinStats: {
    totalCallsites: number;
    totalEvents: number;
    matchedCallsites: number;
    matchedEvents: number;
  };
}

/**
 * Evaluate drift detection predictions against ground truth.
 */
export function evaluateDriftDetection(
  prediction: DriftDetectionPrediction,
  groundTruth: DriftDetectionGroundTruth
): {
  metrics: ClassificationMetrics;
  calibration: CalibrationReport;
  details: {
    truePositiveDrifts: Array<{ pred: DriftDetectionPrediction['drift'][0]; gt: DriftDetectionGroundTruth['expectedDrift'][0] }>;
    falsePositiveDrifts: DriftDetectionPrediction['drift'];
    falsNegativeDrifts: DriftDetectionGroundTruth['expectedDrift'];
    matchAccuracy: number;
  };
  driftRecall: number;
  driftPrecision: number;
  joinAccuracy: number;
  passesGates: boolean;
} {
  const matchedGt = new Set<number>();
  const truePositiveDrifts: Array<{ pred: DriftDetectionPrediction['drift'][0]; gt: DriftDetectionGroundTruth['expectedDrift'][0] }> = [];
  const falsePositiveDrifts: DriftDetectionPrediction['drift'] = [];
  
  // Match predicted drifts to ground truth
  for (const pred of prediction.drift) {
    let matched = false;
    
    for (let i = 0; i < groundTruth.expectedDrift.length; i++) {
      if (matchedGt.has(i)) continue;
      
      const gt = groundTruth.expectedDrift[i];
      
      // Match by type and location (if available)
      const typeMatches = pred.type === gt.type;
      const locationMatches = !gt.file || (
        pred.file?.endsWith(gt.file) &&
        (!gt.line || Math.abs((pred.line || 0) - gt.line) <= 3)
      );
      
      if (typeMatches && locationMatches) {
        truePositiveDrifts.push({ pred, gt });
        matchedGt.add(i);
        matched = true;
        break;
      }
    }
    
    if (!matched) {
      falsePositiveDrifts.push(pred);
    }
  }
  
  // Find false negative drifts
  const falseNegativeDrifts = groundTruth.expectedDrift.filter((_, i) => !matchedGt.has(i));
  
  // Calculate drift metrics
  const driftPrecision = prediction.drift.length > 0
    ? truePositiveDrifts.length / prediction.drift.length
    : 1;
  const driftRecall = groundTruth.expectedDrift.length > 0
    ? truePositiveDrifts.length / groundTruth.expectedDrift.length
    : 1;
  
  // Calculate match accuracy
  const expectedMatchCount = groundTruth.expectedMatches.length;
  const matchedMatchCount = prediction.matches.filter(pm =>
    groundTruth.expectedMatches.some(em =>
      pm.callsiteFile.endsWith(em.callsiteFile) &&
      Math.abs(pm.callsiteLine - em.callsiteLine) <= 3
    )
  ).length;
  const matchAccuracy = expectedMatchCount > 0 ? matchedMatchCount / expectedMatchCount : 1;
  
  // Calculate join accuracy
  const joinAccuracy = matchAccuracy;
  
  // Build confusion matrix
  const confusion: ConfusionMatrix = {
    tp: truePositiveDrifts.length,
    fp: falsePositiveDrifts.length,
    tn: matchedMatchCount, // Correctly identified matches
    fn: falseNegativeDrifts.length,
  };
  
  const metrics = calculateMetrics(confusion);
  
  // Build calibration (using drift confidence if available)
  const calibrationPredictions: PredictionWithConfidence[] = prediction.drift.map(d => ({
    id: `drift:${d.type}:${d.file}:${d.line}`,
    predicted: d,
    confidence: 0.8, // Default confidence
    actual: groundTruth.expectedDrift.find(gt => gt.type === d.type),
    isCorrect: truePositiveDrifts.some(tp => tp.pred === d),
  }));
  
  const calibration = calculateCalibration(calibrationPredictions);
  
  // Check quality gates
  const passesGates = 
    driftPrecision >= DEFAULT_QUALITY_GATES.drift.minPrecision &&
    driftRecall >= DEFAULT_QUALITY_GATES.drift.minRecall;
  
  return {
    metrics,
    calibration,
    details: {
      truePositiveDrifts,
      falsePositiveDrifts,
      falsNegativeDrifts: falseNegativeDrifts,
      matchAccuracy,
    },
    driftRecall,
    driftPrecision,
    joinAccuracy,
    passesGates,
  };
}

// =============================================================================
// QUALITY GATES
// =============================================================================

/**
 * Quality gate thresholds.
 * Per PRD v1.3 Section 15.
 */
export interface QualityGates {
  static: {
    minPrecision: number;
    minRecall: number;
    minF1: number;
    maxEce: number;
  };
  format: {
    minFormatAccuracy: number;
    minMappingAccuracy: number;
    maxEce: number;
  };
  drift: {
    minPrecision: number;
    minRecall: number;
  };
}

/**
 * Default quality gates from PRD v1.3.
 */
export const DEFAULT_QUALITY_GATES: QualityGates = {
  static: {
    minPrecision: 0.95,
    minRecall: 0.90,
    minF1: 0.92,
    maxEce: 0.10,
  },
  format: {
    minFormatAccuracy: 0.95,
    minMappingAccuracy: 0.85,
    maxEce: 0.15,
  },
  drift: {
    minPrecision: 0.90,
    minRecall: 0.85,
  },
};

/**
 * Check if metrics pass quality gates.
 */
export function checkQualityGates(
  metrics: ClassificationMetrics,
  calibration: CalibrationReport,
  gates: QualityGates['static'] | QualityGates['format']
): {
  passed: boolean;
  failures: string[];
} {
  const failures: string[] = [];
  
  if ('minPrecision' in gates && metrics.precision < gates.minPrecision) {
    failures.push(`Precision ${(metrics.precision * 100).toFixed(1)}% below threshold ${(gates.minPrecision * 100).toFixed(1)}%`);
  }
  
  if ('minRecall' in gates && metrics.recall < gates.minRecall) {
    failures.push(`Recall ${(metrics.recall * 100).toFixed(1)}% below threshold ${(gates.minRecall * 100).toFixed(1)}%`);
  }
  
  if ('minF1' in gates && metrics.f1 < gates.minF1) {
    failures.push(`F1 ${(metrics.f1 * 100).toFixed(1)}% below threshold ${(gates.minF1 * 100).toFixed(1)}%`);
  }
  
  if ('maxEce' in gates && calibration.ece > gates.maxEce) {
    failures.push(`ECE ${(calibration.ece * 100).toFixed(1)}% exceeds threshold ${(gates.maxEce * 100).toFixed(1)}%`);
  }
  
  return {
    passed: failures.length === 0,
    failures,
  };
}
