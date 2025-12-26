/**
 * PeakInfer Demo Command
 *
 * Runs a pre-computed demo analysis WITHOUT requiring an API key.
 * This is the first-contact moment - must work offline.
 *
 * Per Design Doc v1.9.3:
 * - Shows the "Magic Moment" (drift detection)
 * - Works without API key
 * - Completes in under 30 seconds
 * - Always produces an alarming finding
 */
import { Command } from 'commander';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';

// Get package root directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageRoot = join(__dirname, '..', '..');

const COLORS = {
  text: '#c9d1d9',
  command: '#f0f6fc',
  info: '#8b949e',
  path: '#a5a29e',
  critical: '#991b1b',
  criticalLight: '#b91c1c',
  warning: '#d29922',
  duration: '#9e6a03',
  border: '#30363d',
  success: '#2d6a4f',
};

interface DemoData {
  version: string;
  drift: {
    detected: boolean;
    type: string;
    description: string;
    evidence: {
      code: string;
      runtime: string;
      impact: string;
      duration: string;
    };
  };
  issues: Array<{
    id: string;
    severity: string;
    category: string;
    title: string;
    description: string;
    impact: string;
    savings?: string;
    file: string;
    line: number;
    fix: {
      description: string;
      effort: string;
    };
  }>;
  summary: {
    totalInferencePoints: number;
    providers: string[];
    criticalIssues: number;
    highIssues: number;
    mediumIssues: number;
    estimatedMonthlySavings: string;
    estimatedLatencyImprovement: string;
  };
}

export function registerDemoCommand(program: Command): void {
  program
    .command('demo')
    .description('see PeakInfer in action with a sample project (no API key needed)')
    .option('--verbose', 'show additional details')
    .action(async (options: { verbose?: boolean }) => {
      await runDemo(options.verbose);
    });
}

async function runDemo(verbose?: boolean): Promise<void> {
  const startTime = Date.now();

  // Load pre-computed demo data
  const demoDataPath = join(packageRoot, 'fixtures', 'demo', 'precomputed.json');

  if (!existsSync(demoDataPath)) {
    console.error(chalk.hex(COLORS.critical)('Error: Demo data not found. Please reinstall PeakInfer.'));
    process.exit(1);
  }

  const demoData: DemoData = JSON.parse(readFileSync(demoDataPath, 'utf-8'));

  // Render the demo output
  console.log();
  console.log(chalk.hex(COLORS.border)('╔══════════════════════════════════════════════════════════════╗'));
  console.log(chalk.hex(COLORS.border)('║') + chalk.hex(COLORS.text)('              PeakInfer Demo                                  ') + chalk.hex(COLORS.border)('║'));
  console.log(chalk.hex(COLORS.border)('╚══════════════════════════════════════════════════════════════╝'));
  console.log();

  // Simulate scanning animation
  console.log(chalk.hex(COLORS.info)('Scanning demo project...'));
  await sleep(500);
  console.log(chalk.hex(COLORS.info)(`Found ${demoData.summary.totalInferencePoints} inference points`));
  await sleep(300);
  console.log();

  // THE MAGIC MOMENT - Drift Detection
  if (demoData.drift.detected) {
    console.log(chalk.hex(COLORS.criticalLight)('DRIFT DETECTED'));
    console.log();
    console.log(chalk.hex(COLORS.border)('  ┌─────────────────────────────────────────────────────────┐'));
    console.log(chalk.hex(COLORS.border)('  │') + chalk.hex(COLORS.info)(' YOUR CODE:    ') + chalk.hex(COLORS.text)(`${demoData.drift.evidence.code}`) + '                              ' + chalk.hex(COLORS.border)('│'));
    console.log(chalk.hex(COLORS.border)('  │') + chalk.hex(COLORS.info)(' RUNTIME:      ') + chalk.hex(COLORS.critical)(`${demoData.drift.evidence.runtime}`) + '          ' + chalk.hex(COLORS.border)('│'));
    console.log(chalk.hex(COLORS.border)('  │') + chalk.hex(COLORS.info)(' IMPACT:       ') + chalk.hex(COLORS.warning)(`${demoData.drift.evidence.impact}`) + '         ' + chalk.hex(COLORS.border)('│'));
    console.log(chalk.hex(COLORS.border)('  │') + chalk.hex(COLORS.info)(' BROKEN FOR:   ') + chalk.hex(COLORS.duration)(`${demoData.drift.evidence.duration}`) + '                                    ' + chalk.hex(COLORS.border)('│'));
    console.log(chalk.hex(COLORS.border)('  └─────────────────────────────────────────────────────────┘'));
    console.log();
  }

  // Summary stats
  console.log(chalk.hex(COLORS.border)('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  console.log();
  console.log(chalk.hex(COLORS.text)(`  ${demoData.summary.totalInferencePoints} inference points found`));
  console.log(chalk.hex(COLORS.text)(`  ${demoData.issues.length} issues detected`));
  console.log();

  // Top issues
  const criticalAndHigh = demoData.issues.filter(i => i.severity === 'critical' || i.severity === 'high');

  for (const issue of criticalAndHigh.slice(0, 3)) {
    const severityColor = issue.severity === 'critical'
      ? chalk.hex(COLORS.critical)
      : chalk.hex(COLORS.warning);

    console.log(`  ${severityColor(issue.severity.toUpperCase())}: ${chalk.hex(COLORS.text)(issue.title)}`);
    console.log(chalk.hex(COLORS.path)(`     ${issue.file}:${issue.line}`));
    console.log(chalk.hex(COLORS.info)(`     ${issue.description}`));
    if (issue.savings) {
      console.log(chalk.hex(COLORS.success)(`     Potential savings: ${issue.savings}`));
    }
    console.log();
  }

  // Quick wins summary
  console.log(chalk.hex(COLORS.success)('QUICK WINS:'));
  console.log(chalk.hex(COLORS.text)(`  • Estimated savings: ${demoData.summary.estimatedMonthlySavings}`));
  console.log(chalk.hex(COLORS.text)(`  • Latency improvement: ${demoData.summary.estimatedLatencyImprovement}`));
  console.log();

  // CTA
  console.log(chalk.hex(COLORS.border)('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  console.log();
  console.log(chalk.hex(COLORS.text)('  Is YOUR code like this?'));
  console.log();
  console.log(chalk.hex(COLORS.text)('  Run on your codebase:'));
  console.log(chalk.hex(COLORS.command)('    peakinfer analyze ./src'));
  console.log();
  console.log(chalk.hex(COLORS.info)('  Requires Anthropic API key. Set ANTHROPIC_API_KEY in .env'));
  console.log();

  const duration = Date.now() - startTime;
  if (verbose) {
    console.log(chalk.hex(COLORS.info)(`Demo completed in ${duration}ms`));
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
