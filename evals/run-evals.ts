/**
 * PeakInfer Detection Evals
 *
 * Compares Claude-based detection against human-labeled ground truth.
 * Measures: Precision, Recall, F1, False Positive Rate
 *
 * Usage: npx tsx evals/run-evals.ts
 */

import { readFileSync, readdirSync, writeFileSync, existsSync } from 'fs';
import { join, basename } from 'path';
import { parse as parseYaml } from 'yaml';
import { execSync } from 'child_process';

interface GroundTruthCallsite {
  line: number;
  function: string;
  type: string;
  provider: string;
  model: string;
  sdk: string;
  confidence: number;
}

interface GroundTruth {
  fixture: string;
  description: string;
  total_callsites: number;
  callsites: GroundTruthCallsite[];
  non_callsites?: { line: number; reason: string }[];
  false_positive_traps?: { line: number; function: string; reason: string }[];
}

interface DetectedCallsite {
  file: string;
  line: number;
  type: string;
  provider?: string;
  model?: string;
  confidence: number;
}

interface EvalResult {
  fixture: string;
  ground_truth_count: number;
  detected_count: number;
  true_positives: number;
  false_positives: number;
  false_negatives: number;
  precision: number;
  recall: number;
  f1: number;
  details: {
    matched: { gt_line: number; detected_line: number }[];
    missed: number[];  // Lines in ground truth not detected
    extra: number[];   // Lines detected but not in ground truth
  };
}

interface EvalSummary {
  timestamp: string;
  model_version: string;
  total_fixtures: number;
  results: EvalResult[];
  aggregate: {
    total_ground_truth: number;
    total_detected: number;
    total_true_positives: number;
    total_false_positives: number;
    total_false_negatives: number;
    macro_precision: number;
    macro_recall: number;
    macro_f1: number;
    micro_precision: number;
    micro_recall: number;
    micro_f1: number;
  };
}

const GROUND_TRUTH_DIR = join(__dirname, 'ground-truth');
const FIXTURES_DIR = join(__dirname, '../src/slc/__tests__/fixtures');
const RESULTS_FILE = join(__dirname, 'eval-results.json');

function loadGroundTruth(yamlPath: string): GroundTruth {
  const content = readFileSync(yamlPath, 'utf-8');
  return parseYaml(content) as GroundTruth;
}

async function runDetection(fixturePath: string): Promise<DetectedCallsite[]> {
  try {
    // Run the CLI detector on the fixture
    const result = execSync(
      `node dist/slc/cli.js detect "${fixturePath}" --json 2>/dev/null`,
      { encoding: 'utf-8', timeout: 120000 }
    );

    const output = JSON.parse(result);
    return output.callsites || [];
  } catch (error) {
    // If detection fails or returns non-JSON, return empty
    console.warn(`  Detection failed for ${fixturePath}`);
    return [];
  }
}

function evaluateDetection(
  groundTruth: GroundTruth,
  detected: DetectedCallsite[]
): EvalResult {
  const gtLines = new Set(groundTruth.callsites.map(c => c.line));
  const detectedLines = new Set(detected.map(c => c.line));

  // True positives: detected AND in ground truth
  const truePositives = [...detectedLines].filter(l => gtLines.has(l));

  // False positives: detected but NOT in ground truth
  const falsePositives = [...detectedLines].filter(l => !gtLines.has(l));

  // False negatives: in ground truth but NOT detected
  const falseNegatives = [...gtLines].filter(l => !detectedLines.has(l));

  const tp = truePositives.length;
  const fp = falsePositives.length;
  const fn = falseNegatives.length;

  const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
  const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
  const f1 = precision + recall > 0 ? 2 * (precision * recall) / (precision + recall) : 0;

  return {
    fixture: groundTruth.fixture,
    ground_truth_count: groundTruth.total_callsites,
    detected_count: detected.length,
    true_positives: tp,
    false_positives: fp,
    false_negatives: fn,
    precision: Math.round(precision * 1000) / 1000,
    recall: Math.round(recall * 1000) / 1000,
    f1: Math.round(f1 * 1000) / 1000,
    details: {
      matched: truePositives.map(l => ({ gt_line: l, detected_line: l })),
      missed: falseNegatives,
      extra: falsePositives
    }
  };
}

function calculateAggregate(results: EvalResult[]): EvalSummary['aggregate'] {
  const totals = results.reduce(
    (acc, r) => ({
      gt: acc.gt + r.ground_truth_count,
      det: acc.det + r.detected_count,
      tp: acc.tp + r.true_positives,
      fp: acc.fp + r.false_positives,
      fn: acc.fn + r.false_negatives,
      precision_sum: acc.precision_sum + r.precision,
      recall_sum: acc.recall_sum + r.recall,
      f1_sum: acc.f1_sum + r.f1
    }),
    { gt: 0, det: 0, tp: 0, fp: 0, fn: 0, precision_sum: 0, recall_sum: 0, f1_sum: 0 }
  );

  const n = results.length;
  const microPrecision = totals.tp + totals.fp > 0 ? totals.tp / (totals.tp + totals.fp) : 0;
  const microRecall = totals.tp + totals.fn > 0 ? totals.tp / (totals.tp + totals.fn) : 0;
  const microF1 = microPrecision + microRecall > 0
    ? 2 * (microPrecision * microRecall) / (microPrecision + microRecall)
    : 0;

  return {
    total_ground_truth: totals.gt,
    total_detected: totals.det,
    total_true_positives: totals.tp,
    total_false_positives: totals.fp,
    total_false_negatives: totals.fn,
    macro_precision: Math.round((totals.precision_sum / n) * 1000) / 1000,
    macro_recall: Math.round((totals.recall_sum / n) * 1000) / 1000,
    macro_f1: Math.round((totals.f1_sum / n) * 1000) / 1000,
    micro_precision: Math.round(microPrecision * 1000) / 1000,
    micro_recall: Math.round(microRecall * 1000) / 1000,
    micro_f1: Math.round(microF1 * 1000) / 1000
  };
}

function printResults(summary: EvalSummary): void {
  console.log('\n' + '═'.repeat(70));
  console.log('  📊 PEAKINFER DETECTION EVALS');
  console.log('═'.repeat(70));
  console.log(`  Timestamp: ${summary.timestamp}`);
  console.log(`  Fixtures evaluated: ${summary.total_fixtures}`);
  console.log('═'.repeat(70));

  // Per-fixture table
  console.log('\n┌─────────────────────────────┬───────┬───────┬───────┬───────┬───────┬───────┐');
  console.log('│ Fixture                     │ GT    │ Det   │ TP    │ FP    │ FN    │ F1    │');
  console.log('├─────────────────────────────┼───────┼───────┼───────┼───────┼───────┼───────┤');

  for (const r of summary.results) {
    const name = r.fixture.substring(0, 27).padEnd(27);
    const gt = r.ground_truth_count.toString().padStart(5);
    const det = r.detected_count.toString().padStart(5);
    const tp = r.true_positives.toString().padStart(5);
    const fp = r.false_positives.toString().padStart(5);
    const fn = r.false_negatives.toString().padStart(5);
    const f1 = r.f1.toFixed(2).padStart(5);
    console.log(`│ ${name} │${gt} │${det} │${tp} │${fp} │${fn} │${f1} │`);
  }

  console.log('└─────────────────────────────┴───────┴───────┴───────┴───────┴───────┴───────┘');

  // Aggregate metrics
  const agg = summary.aggregate;
  console.log('\n📈 AGGREGATE METRICS:');
  console.log('─'.repeat(50));
  console.log(`  Micro Precision: ${(agg.micro_precision * 100).toFixed(1)}%`);
  console.log(`  Micro Recall:    ${(agg.micro_recall * 100).toFixed(1)}%`);
  console.log(`  Micro F1:        ${(agg.micro_f1 * 100).toFixed(1)}%`);
  console.log('─'.repeat(50));
  console.log(`  Macro Precision: ${(agg.macro_precision * 100).toFixed(1)}%`);
  console.log(`  Macro Recall:    ${(agg.macro_recall * 100).toFixed(1)}%`);
  console.log(`  Macro F1:        ${(agg.macro_f1 * 100).toFixed(1)}%`);
  console.log('─'.repeat(50));

  // Quality assessment
  const f1 = agg.micro_f1;
  let grade: string;
  if (f1 >= 0.95) grade = '🏆 EXCELLENT';
  else if (f1 >= 0.85) grade = '✅ GOOD';
  else if (f1 >= 0.70) grade = '⚠️  NEEDS IMPROVEMENT';
  else grade = '❌ FAILING';

  console.log(`\n  Overall Grade: ${grade} (F1 = ${(f1 * 100).toFixed(1)}%)`);
  console.log('═'.repeat(70) + '\n');
}

async function main() {
  console.log('\n🔍 Running PeakInfer Detection Evals...\n');

  // Check if ground truth files exist
  if (!existsSync(GROUND_TRUTH_DIR)) {
    console.error('❌ Ground truth directory not found:', GROUND_TRUTH_DIR);
    process.exit(1);
  }

  const groundTruthFiles = readdirSync(GROUND_TRUTH_DIR)
    .filter(f => f.endsWith('.yaml'));

  if (groundTruthFiles.length === 0) {
    console.error('❌ No ground truth files found');
    process.exit(1);
  }

  console.log(`Found ${groundTruthFiles.length} ground truth files\n`);

  const results: EvalResult[] = [];

  for (const gtFile of groundTruthFiles) {
    const gtPath = join(GROUND_TRUTH_DIR, gtFile);
    const gt = loadGroundTruth(gtPath);

    const fixturePath = join(FIXTURES_DIR, gt.fixture);

    if (!existsSync(fixturePath)) {
      console.warn(`⚠️  Fixture not found: ${gt.fixture}`);
      continue;
    }

    console.log(`Evaluating: ${gt.fixture}`);
    console.log(`  Ground truth: ${gt.total_callsites} callsites`);

    const detected = await runDetection(fixturePath);
    console.log(`  Detected: ${detected.length} callsites`);

    const result = evaluateDetection(gt, detected);
    results.push(result);

    console.log(`  F1: ${(result.f1 * 100).toFixed(1)}%\n`);
  }

  const summary: EvalSummary = {
    timestamp: new Date().toISOString(),
    model_version: 'claude-3-5-sonnet-20241022',
    total_fixtures: results.length,
    results,
    aggregate: calculateAggregate(results)
  };

  // Save results
  writeFileSync(RESULTS_FILE, JSON.stringify(summary, null, 2));
  console.log(`💾 Results saved to: ${RESULTS_FILE}`);

  // Print summary
  printResults(summary);

  // Exit with error if F1 below threshold
  if (summary.aggregate.micro_f1 < 0.70) {
    console.error('❌ Eval failed: F1 score below 70% threshold');
    process.exit(1);
  }
}

main().catch(console.error);
