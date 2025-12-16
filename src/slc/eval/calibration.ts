/**
 * Calibration Framework - PeakInfer EVAL-FRAMEWORK-DESIGN
 * 
 * Ensures predicted confidence scores align with actual accuracy.
 * Computes ECE (Expected Calibration Error) and MCE (Maximum Calibration Error).
 * 
 * Quality Gate (per EVAL-FRAMEWORK-DESIGN):
 *   Calibration Error (ECE) ≤ 0.1
 */

// =============================================================================
// TYPES
// =============================================================================

export interface CalibrationSample {
  /** Predicted confidence score (0-1) */
  confidence: number;
  /** Whether the prediction was correct (true/false) */
  correct: boolean;
  /** Optional identifier for the sample */
  id?: string;
  /** Optional category for stratified analysis */
  category?: string;
}

export interface CalibrationBin {
  /** Bin index (0-9 for 10 bins) */
  binIndex: number;
  /** Lower bound of confidence range */
  lowerBound: number;
  /** Upper bound of confidence range */
  upperBound: number;
  /** Average confidence in this bin */
  avgConfidence: number;
  /** Average accuracy in this bin */
  avgAccuracy: number;
  /** Number of samples in this bin */
  count: number;
  /** Gap between confidence and accuracy (|avgConfidence - avgAccuracy|) */
  gap: number;
}

export interface CalibrationResult {
  /** Expected Calibration Error - weighted average of bin gaps */
  ece: number;
  /** Maximum Calibration Error - largest bin gap */
  mce: number;
  /** Per-bin breakdown */
  bins: CalibrationBin[];
  /** Total samples analyzed */
  totalSamples: number;
  /** Overall accuracy */
  overallAccuracy: number;
  /** Average confidence */
  averageConfidence: number;
  /** Whether calibration passes quality gate (ECE ≤ 0.1) */
  passesGate: boolean;
  /** Calibration diagnosis */
  diagnosis: 'well-calibrated' | 'overconfident' | 'underconfident';
}

export interface StratifiedCalibrationResult {
  /** Overall calibration result */
  overall: CalibrationResult;
  /** Per-category calibration results */
  byCategory: Map<string, CalibrationResult>;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const NUM_BINS = 10;
const ECE_THRESHOLD = 0.1; // Quality gate from EVAL-FRAMEWORK-DESIGN

// =============================================================================
// CALIBRATION COMPUTATION
// =============================================================================

/**
 * Compute calibration metrics from a set of samples.
 * Uses binned calibration: divides confidence into 10 equal-width bins,
 * computes accuracy within each bin, and measures deviation from perfect calibration.
 */
export function computeCalibration(samples: CalibrationSample[]): CalibrationResult {
  if (samples.length === 0) {
    return {
      ece: 0,
      mce: 0,
      bins: [],
      totalSamples: 0,
      overallAccuracy: 0,
      averageConfidence: 0,
      passesGate: true,
      diagnosis: 'well-calibrated',
    };
  }
  
  // Initialize bins
  const bins: CalibrationBin[] = [];
  for (let i = 0; i < NUM_BINS; i++) {
    bins.push({
      binIndex: i,
      lowerBound: i / NUM_BINS,
      upperBound: (i + 1) / NUM_BINS,
      avgConfidence: 0,
      avgAccuracy: 0,
      count: 0,
      gap: 0,
    });
  }
  
  // Assign samples to bins
  const binSamples: CalibrationSample[][] = bins.map(() => []);
  
  for (const sample of samples) {
    // Clamp confidence to [0, 1]
    const conf = Math.max(0, Math.min(1, sample.confidence));
    // Bin index (0-9), handle edge case of conf=1.0
    const binIdx = conf === 1.0 ? NUM_BINS - 1 : Math.floor(conf * NUM_BINS);
    binSamples[binIdx].push(sample);
  }
  
  // Compute per-bin statistics
  for (let i = 0; i < NUM_BINS; i++) {
    const binData = binSamples[i];
    if (binData.length > 0) {
      bins[i].count = binData.length;
      bins[i].avgConfidence = binData.reduce((sum, s) => sum + s.confidence, 0) / binData.length;
      bins[i].avgAccuracy = binData.filter(s => s.correct).length / binData.length;
      bins[i].gap = Math.abs(bins[i].avgConfidence - bins[i].avgAccuracy);
    }
  }
  
  // Compute ECE (Expected Calibration Error)
  // ECE = sum over bins of (bin_count / total) * |accuracy - confidence|
  let ece = 0;
  for (const bin of bins) {
    if (bin.count > 0) {
      ece += (bin.count / samples.length) * bin.gap;
    }
  }
  
  // Compute MCE (Maximum Calibration Error)
  const mce = Math.max(...bins.filter(b => b.count > 0).map(b => b.gap), 0);
  
  // Overall statistics
  const overallAccuracy = samples.filter(s => s.correct).length / samples.length;
  const averageConfidence = samples.reduce((sum, s) => sum + s.confidence, 0) / samples.length;
  
  // Diagnosis
  let diagnosis: 'well-calibrated' | 'overconfident' | 'underconfident';
  if (ece <= ECE_THRESHOLD) {
    diagnosis = 'well-calibrated';
  } else if (averageConfidence > overallAccuracy) {
    diagnosis = 'overconfident';
  } else {
    diagnosis = 'underconfident';
  }
  
  return {
    ece,
    mce,
    bins,
    totalSamples: samples.length,
    overallAccuracy,
    averageConfidence,
    passesGate: ece <= ECE_THRESHOLD,
    diagnosis,
  };
}

/**
 * Compute calibration metrics stratified by category.
 */
export function computeStratifiedCalibration(
  samples: CalibrationSample[]
): StratifiedCalibrationResult {
  const overall = computeCalibration(samples);
  
  // Group by category
  const byCategory = new Map<string, CalibrationSample[]>();
  for (const sample of samples) {
    const category = sample.category || 'unknown';
    if (!byCategory.has(category)) {
      byCategory.set(category, []);
    }
    byCategory.get(category)!.push(sample);
  }
  
  // Compute per-category calibration
  const categoryResults = new Map<string, CalibrationResult>();
  for (const [category, categorySamples] of byCategory) {
    categoryResults.set(category, computeCalibration(categorySamples));
  }
  
  return {
    overall,
    byCategory: categoryResults,
  };
}

// =============================================================================
// CALIBRATION VISUALIZATION
// =============================================================================

/**
 * Generate ASCII reliability diagram (calibration curve).
 */
export function generateReliabilityDiagram(result: CalibrationResult): string {
  const lines: string[] = [];
  const height = 10;
  const width = 50;
  
  lines.push('Reliability Diagram (Calibration Curve)');
  lines.push('═'.repeat(width));
  lines.push('');
  lines.push('Accuracy');
  lines.push('  1.0 ┤' + '─'.repeat(width - 6));
  
  // Build the plot
  for (let row = height - 1; row >= 0; row--) {
    const rowValue = row / height;
    const nextRowValue = (row + 1) / height;
    
    let line = rowValue.toFixed(1).padStart(4) + ' │';
    
    // Perfect calibration line (diagonal)
    const diagonalX = Math.floor(rowValue * (width - 6));
    
    // Plot bins
    const plotChars: string[] = new Array(width - 6).fill(' ');
    
    // Add diagonal reference line
    for (let x = 0; x < width - 6; x++) {
      const expectedAcc = x / (width - 7);
      if (Math.abs(expectedAcc - rowValue) < 0.05) {
        plotChars[x] = '·';
      }
    }
    
    // Add bin markers
    for (const bin of result.bins) {
      if (bin.count > 0) {
        const x = Math.floor(bin.avgConfidence * (width - 7));
        if (bin.avgAccuracy >= rowValue && bin.avgAccuracy < nextRowValue) {
          plotChars[x] = '█';
        }
      }
    }
    
    line += plotChars.join('');
    lines.push(line);
  }
  
  lines.push('  0.0 └' + '─'.repeat(width - 6));
  lines.push('      0.0' + ' '.repeat(width - 14) + '1.0');
  lines.push('         Confidence');
  lines.push('');
  lines.push(`ECE: ${(result.ece * 100).toFixed(1)}%  MCE: ${(result.mce * 100).toFixed(1)}%  ` +
    `Status: ${result.passesGate ? '✓ PASS' : '✗ FAIL'}`);
  
  return lines.join('\n');
}

/**
 * Generate calibration report summary.
 */
export function generateCalibrationReport(result: CalibrationResult): string {
  const lines: string[] = [];
  
  lines.push('Calibration Report');
  lines.push('═'.repeat(50));
  lines.push('');
  lines.push(`Total samples:      ${result.totalSamples}`);
  lines.push(`Overall accuracy:   ${(result.overallAccuracy * 100).toFixed(1)}%`);
  lines.push(`Average confidence: ${(result.averageConfidence * 100).toFixed(1)}%`);
  lines.push('');
  lines.push(`ECE (Expected):     ${(result.ece * 100).toFixed(2)}%  ${result.ece <= ECE_THRESHOLD ? '✓' : '✗'}`);
  lines.push(`MCE (Maximum):      ${(result.mce * 100).toFixed(2)}%`);
  lines.push(`Quality Gate:       ${result.passesGate ? 'PASS' : 'FAIL'} (threshold: ${ECE_THRESHOLD * 100}%)`);
  lines.push(`Diagnosis:          ${result.diagnosis}`);
  lines.push('');
  lines.push('Per-Bin Breakdown:');
  lines.push('─'.repeat(50));
  lines.push('Bin Range       Samples  Confidence  Accuracy    Gap');
  
  for (const bin of result.bins) {
    if (bin.count > 0) {
      const range = `[${bin.lowerBound.toFixed(1)}-${bin.upperBound.toFixed(1)})`.padEnd(12);
      const samples = bin.count.toString().padStart(7);
      const conf = (bin.avgConfidence * 100).toFixed(1).padStart(10) + '%';
      const acc = (bin.avgAccuracy * 100).toFixed(1).padStart(9) + '%';
      const gap = (bin.gap * 100).toFixed(1).padStart(6) + '%';
      lines.push(`${range} ${samples}  ${conf}  ${acc}  ${gap}`);
    }
  }
  
  return lines.join('\n');
}

// =============================================================================
// CALIBRATION TEST HELPERS
// =============================================================================

/**
 * Convert static analysis results to calibration samples.
 */
export function staticAnalysisToCalibrationSamples(
  predictions: Array<{ confidence: number; predicted: unknown; actual: unknown }>,
  matcher: (predicted: unknown, actual: unknown) => boolean
): CalibrationSample[] {
  return predictions.map((p, i) => ({
    id: `static_${i}`,
    confidence: p.confidence,
    correct: matcher(p.predicted, p.actual),
    category: 'static_analysis',
  }));
}

/**
 * Convert format detection results to calibration samples.
 */
export function formatDetectionToCalibrationSamples(
  predictions: Array<{ confidence: number; predictedFormat: string; actualFormat: string }>
): CalibrationSample[] {
  return predictions.map((p, i) => ({
    id: `format_${i}`,
    confidence: p.confidence,
    correct: p.predictedFormat === p.actualFormat,
    category: 'format_detection',
  }));
}

/**
 * Convert field mapping results to calibration samples.
 */
export function fieldMappingToCalibrationSamples(
  predictions: Array<{ confidence: number; predictedMapping: Record<string, string>; actualMapping: Record<string, string> }>
): CalibrationSample[] {
  return predictions.map((p, i) => {
    // Field mapping is correct if all required fields map correctly
    const requiredFields = ['provider', 'model', 'input_tokens', 'output_tokens'];
    const correct = requiredFields.every(field => 
      p.predictedMapping[field] === p.actualMapping[field]
    );
    
    return {
      id: `mapping_${i}`,
      confidence: p.confidence,
      correct,
      category: 'field_mapping',
    };
  });
}

// =============================================================================
// EXPORTS
// =============================================================================

export { ECE_THRESHOLD };

