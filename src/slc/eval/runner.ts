/**
 * Evaluation Runner - PeakInfer EVAL-FRAMEWORK-DESIGN.md
 * 
 * Runs evaluations against ground truth fixtures.
 * Used by `npm run eval` to measure correctness.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';
import {
  evaluateStaticAnalysis,
  evaluateFormatDetection,
  evaluateDriftDetection,
  calculateCalibration,
  checkQualityGates,
  DEFAULT_QUALITY_GATES,
  type StaticAnalysisGroundTruth,
  type StaticAnalysisPrediction,
  type FormatDetectionGroundTruth,
  type FormatDetectionPrediction,
  type DriftDetectionGroundTruth,
  type DriftDetectionPrediction,
  type ClassificationMetrics,
  type CalibrationReport,
} from './metrics.js';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Single evaluation result.
 */
export interface EvalResult {
  /** Fixture identifier */
  fixtureId: string;
  
  /** Evaluation type */
  type: 'static' | 'format' | 'drift';
  
  /** Whether quality gates passed */
  passed: boolean;
  
  /** Classification metrics */
  metrics: ClassificationMetrics;
  
  /** Calibration report */
  calibration: CalibrationReport;
  
  /** Quality gate failures */
  failures: string[];
  
  /** Execution time in ms */
  durationMs: number;
  
  /** Additional details */
  details: Record<string, unknown>;
}

/**
 * Full evaluation report.
 */
export interface EvalReport {
  /** Timestamp */
  timestamp: string;
  
  /** Total evaluations */
  totalEvaluations: number;
  
  /** Passed evaluations */
  passed: number;
  
  /** Failed evaluations */
  failed: number;
  
  /** Overall pass rate */
  passRate: number;
  
  /** Aggregate metrics */
  aggregateMetrics: {
    avgPrecision: number;
    avgRecall: number;
    avgF1: number;
    avgEce: number;
  };
  
  /** Individual results */
  results: EvalResult[];
  
  /** Summary by type */
  byType: Record<string, {
    total: number;
    passed: number;
    failed: number;
    avgF1: number;
  }>;
  
  /** Total execution time */
  totalDurationMs: number;
}

/**
 * Evaluation options.
 */
export interface EvalOptions {
  /** Ground truth directory */
  groundTruthDir: string;
  
  /** Fixtures directory */
  fixturesDir: string;
  
  /** Quality gates to use */
  qualityGates?: typeof DEFAULT_QUALITY_GATES;
  
  /** Filter by fixture pattern */
  fixturePattern?: string;
  
  /** Filter by type */
  typeFilter?: 'static' | 'format' | 'drift';
  
  /** Output format */
  outputFormat?: 'json' | 'table' | 'summary';
}

// =============================================================================
// GROUND TRUTH LOADING
// =============================================================================

/**
 * Load ground truth files from directory.
 */
export function loadGroundTruth(
  dir: string,
  type: 'static' | 'format' | 'drift'
): Array<StaticAnalysisGroundTruth | FormatDetectionGroundTruth | DriftDetectionGroundTruth> {
  const groundTruth: Array<StaticAnalysisGroundTruth | FormatDetectionGroundTruth | DriftDetectionGroundTruth> = [];
  
  const typeDir = path.join(dir, type);
  if (!fs.existsSync(typeDir)) {
    return groundTruth;
  }
  
  const files = fs.readdirSync(typeDir).filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));
  
  for (const file of files) {
    try {
      const content = fs.readFileSync(path.join(typeDir, file), 'utf-8');
      const parsed = yaml.parse(content);
      groundTruth.push(parsed);
    } catch (error) {
      console.warn(`Failed to load ground truth ${file}:`, error);
    }
  }
  
  return groundTruth;
}

// =============================================================================
// EVALUATION RUNNER
// =============================================================================

/**
 * Run static analysis evaluation.
 */
async function runStaticEval(
  predictions: StaticAnalysisPrediction[],
  groundTruth: StaticAnalysisGroundTruth,
  qualityGates: typeof DEFAULT_QUALITY_GATES
): Promise<EvalResult> {
  const startTime = Date.now();
  
  const result = evaluateStaticAnalysis(predictions, groundTruth);
  const gateCheck = checkQualityGates(result.metrics, result.calibration, qualityGates.static);
  
  return {
    fixtureId: groundTruth.fixtureId,
    type: 'static',
    passed: gateCheck.passed,
    metrics: result.metrics,
    calibration: result.calibration,
    failures: gateCheck.failures,
    durationMs: Date.now() - startTime,
    details: {
      truePositives: result.details.truePositives.length,
      falsePositives: result.details.falsePositives.length,
      falseNegatives: result.details.falseNegatives.length,
    },
  };
}

/**
 * Run format detection evaluation.
 */
async function runFormatEval(
  prediction: FormatDetectionPrediction,
  groundTruth: FormatDetectionGroundTruth,
  qualityGates: typeof DEFAULT_QUALITY_GATES
): Promise<EvalResult> {
  const startTime = Date.now();
  
  const result = evaluateFormatDetection(prediction, groundTruth);
  
  // Convert format-specific metrics to ClassificationMetrics
  const metrics: ClassificationMetrics = {
    precision: result.mappingAccuracy,
    recall: result.mappingAccuracy,
    f1: result.overallAccuracy,
    accuracy: result.overallAccuracy,
    total: groundTruth.fieldMappings.length + 1,
    confusion: {
      tp: result.details.correctMappings.length + (result.details.formatCorrect ? 1 : 0),
      fp: result.details.incorrectMappings.length + (result.details.formatCorrect ? 0 : 1),
      tn: 0,
      fn: result.details.missingMappings.length,
    },
  };
  
  const failures: string[] = [];
  if (result.formatAccuracy < qualityGates.format.minFormatAccuracy) {
    failures.push(`Format detection failed`);
  }
  if (result.mappingAccuracy < qualityGates.format.minMappingAccuracy) {
    failures.push(`Mapping accuracy ${(result.mappingAccuracy * 100).toFixed(1)}% below threshold`);
  }
  if (result.calibration.ece > qualityGates.format.maxEce) {
    failures.push(`ECE ${(result.calibration.ece * 100).toFixed(1)}% exceeds threshold`);
  }
  
  return {
    fixtureId: groundTruth.fixtureId,
    type: 'format',
    passed: failures.length === 0,
    metrics,
    calibration: result.calibration,
    failures,
    durationMs: Date.now() - startTime,
    details: result.details,
  };
}

/**
 * Run drift detection evaluation.
 */
async function runDriftEval(
  prediction: DriftDetectionPrediction,
  groundTruth: DriftDetectionGroundTruth,
  qualityGates: typeof DEFAULT_QUALITY_GATES
): Promise<EvalResult> {
  const startTime = Date.now();
  
  const result = evaluateDriftDetection(prediction, groundTruth);
  
  const failures: string[] = [];
  if (result.driftPrecision < qualityGates.drift.minPrecision) {
    failures.push(`Drift precision ${(result.driftPrecision * 100).toFixed(1)}% below threshold`);
  }
  if (result.driftRecall < qualityGates.drift.minRecall) {
    failures.push(`Drift recall ${(result.driftRecall * 100).toFixed(1)}% below threshold`);
  }
  
  return {
    fixtureId: groundTruth.fixtureId,
    type: 'drift',
    passed: failures.length === 0,
    metrics: result.metrics,
    calibration: result.calibration,
    failures,
    durationMs: Date.now() - startTime,
    details: {
      driftPrecision: result.driftPrecision,
      driftRecall: result.driftRecall,
      joinAccuracy: result.joinAccuracy,
      truePositiveDrifts: result.details.truePositiveDrifts.length,
      falsePositiveDrifts: result.details.falsePositiveDrifts.length,
      falseNegativeDrifts: result.details.falsNegativeDrifts.length,
    },
  };
}

/**
 * Run full evaluation suite.
 */
export async function runEvaluations(
  options: EvalOptions,
  getPredictions: (groundTruth: StaticAnalysisGroundTruth | FormatDetectionGroundTruth | DriftDetectionGroundTruth) => Promise<StaticAnalysisPrediction[] | FormatDetectionPrediction | DriftDetectionPrediction>
): Promise<EvalReport> {
  const startTime = Date.now();
  const qualityGates = options.qualityGates || DEFAULT_QUALITY_GATES;
  const results: EvalResult[] = [];
  
  // Load ground truth
  const types: Array<'static' | 'format' | 'drift'> = options.typeFilter
    ? [options.typeFilter]
    : ['static', 'format', 'drift'];
  
  for (const type of types) {
    const groundTruths = loadGroundTruth(options.groundTruthDir, type);
    
    for (const gt of groundTruths) {
      // Filter by pattern if specified
      if (options.fixturePattern && !gt.fixtureId.includes(options.fixturePattern)) {
        continue;
      }
      
      try {
        const predictions = await getPredictions(gt);
        
        let result: EvalResult;
        if (type === 'static') {
          result = await runStaticEval(
            predictions as StaticAnalysisPrediction[],
            gt as StaticAnalysisGroundTruth,
            qualityGates
          );
        } else if (type === 'format') {
          result = await runFormatEval(
            predictions as FormatDetectionPrediction,
            gt as FormatDetectionGroundTruth,
            qualityGates
          );
        } else if (type === 'drift') {
          result = await runDriftEval(
            predictions as DriftDetectionPrediction,
            gt as DriftDetectionGroundTruth,
            qualityGates
          );
        } else {
          continue;
        }
        
        results.push(result);
      } catch (error) {
        console.error(`Failed to evaluate ${gt.fixtureId}:`, error);
        
        // Add failed result
        results.push({
          fixtureId: gt.fixtureId,
          type,
          passed: false,
          metrics: { precision: 0, recall: 0, f1: 0, accuracy: 0, total: 0, confusion: { tp: 0, fp: 0, tn: 0, fn: 0 } },
          calibration: { buckets: [], ece: 0, mce: 0, accuracy: 0, avgConfidence: 0, totalPredictions: 0, isCalibrated: false, assessment: 'poor' },
          failures: [`Evaluation error: ${error instanceof Error ? error.message : 'Unknown'}`],
          durationMs: 0,
          details: {},
        });
      }
    }
  }
  
  // Calculate aggregate metrics
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  
  const avgPrecision = results.length > 0
    ? results.reduce((sum, r) => sum + r.metrics.precision, 0) / results.length
    : 0;
  const avgRecall = results.length > 0
    ? results.reduce((sum, r) => sum + r.metrics.recall, 0) / results.length
    : 0;
  const avgF1 = results.length > 0
    ? results.reduce((sum, r) => sum + r.metrics.f1, 0) / results.length
    : 0;
  const avgEce = results.length > 0
    ? results.reduce((sum, r) => sum + r.calibration.ece, 0) / results.length
    : 0;
  
  // Group by type
  const byType: EvalReport['byType'] = {};
  for (const type of types) {
    const typeResults = results.filter(r => r.type === type);
    if (typeResults.length > 0) {
      byType[type] = {
        total: typeResults.length,
        passed: typeResults.filter(r => r.passed).length,
        failed: typeResults.filter(r => !r.passed).length,
        avgF1: typeResults.reduce((sum, r) => sum + r.metrics.f1, 0) / typeResults.length,
      };
    }
  }
  
  return {
    timestamp: new Date().toISOString(),
    totalEvaluations: results.length,
    passed,
    failed,
    passRate: results.length > 0 ? passed / results.length : 0,
    aggregateMetrics: {
      avgPrecision,
      avgRecall,
      avgF1,
      avgEce,
    },
    results,
    byType,
    totalDurationMs: Date.now() - startTime,
  };
}

/**
 * Format evaluation report for output.
 */
export function formatReport(report: EvalReport, format: 'json' | 'table' | 'summary' = 'summary'): string {
  if (format === 'json') {
    return JSON.stringify(report, null, 2);
  }
  
  if (format === 'summary') {
    const lines: string[] = [
      '',
      '='.repeat(60),
      'PEAKINFER EVALUATION REPORT',
      '='.repeat(60),
      '',
      `Timestamp: ${report.timestamp}`,
      `Duration: ${report.totalDurationMs}ms`,
      '',
      `Total: ${report.totalEvaluations} | Passed: ${report.passed} | Failed: ${report.failed}`,
      `Pass Rate: ${(report.passRate * 100).toFixed(1)}%`,
      '',
      '--- Aggregate Metrics ---',
      `Precision: ${(report.aggregateMetrics.avgPrecision * 100).toFixed(1)}%`,
      `Recall: ${(report.aggregateMetrics.avgRecall * 100).toFixed(1)}%`,
      `F1: ${(report.aggregateMetrics.avgF1 * 100).toFixed(1)}%`,
      `ECE: ${(report.aggregateMetrics.avgEce * 100).toFixed(1)}%`,
      '',
    ];
    
    if (Object.keys(report.byType).length > 0) {
      lines.push('--- By Type ---');
      for (const [type, data] of Object.entries(report.byType)) {
        lines.push(`${type}: ${data.passed}/${data.total} passed (F1: ${(data.avgF1 * 100).toFixed(1)}%)`);
      }
      lines.push('');
    }
    
    // Show failures
    const failures = report.results.filter(r => !r.passed);
    if (failures.length > 0) {
      lines.push('--- Failures ---');
      for (const f of failures.slice(0, 10)) {
        lines.push(`${f.fixtureId}: ${f.failures.join(', ')}`);
      }
      if (failures.length > 10) {
        lines.push(`... and ${failures.length - 10} more`);
      }
      lines.push('');
    }
    
    lines.push('='.repeat(60));
    
    return lines.join('\n');
  }
  
  // Table format
  const lines: string[] = [
    '',
    'Fixture'.padEnd(30) + 'Type'.padEnd(10) + 'P'.padEnd(6) + 'R'.padEnd(6) + 'F1'.padEnd(6) + 'ECE'.padEnd(6) + 'Status',
    '-'.repeat(80),
  ];
  
  for (const r of report.results) {
    const status = r.passed ? '✓ PASS' : '✗ FAIL';
    lines.push(
      r.fixtureId.slice(0, 28).padEnd(30) +
      r.type.padEnd(10) +
      `${(r.metrics.precision * 100).toFixed(0)}%`.padEnd(6) +
      `${(r.metrics.recall * 100).toFixed(0)}%`.padEnd(6) +
      `${(r.metrics.f1 * 100).toFixed(0)}%`.padEnd(6) +
      `${(r.calibration.ece * 100).toFixed(0)}%`.padEnd(6) +
      status
    );
  }
  
  lines.push('-'.repeat(80));
  lines.push(`TOTAL: ${report.passed}/${report.totalEvaluations} passed (${(report.passRate * 100).toFixed(0)}%)`);
  
  return lines.join('\n');
}

