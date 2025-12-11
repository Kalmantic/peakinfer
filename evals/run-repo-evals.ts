#!/usr/bin/env npx tsx
/**
 * PeakInfer Real-World Repo Evaluation Suite
 *
 * Tests PeakInfer against real open source repos across all PRD layers:
 * - Application Layer: SDK usage (OpenAI, Anthropic, Together, Cerebras, etc.)
 * - Serving Layer: vLLM, TensorRT-LLM, SGLang, TGI, Ollama
 * - Infrastructure Layer: Terraform, K8s, Ray, SkyPilot
 *
 * Usage:
 *   npx tsx evals/run-repo-evals.ts                    # Run all priority 1
 *   npx tsx evals/run-repo-evals.ts --all              # Run all repos
 *   npx tsx evals/run-repo-evals.ts --layer serving    # Run serving layer only
 *   npx tsx evals/run-repo-evals.ts --repo langchain   # Run single repo
 */

import { execSync, spawnSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// Load repo config
const EVALS_DIR = path.dirname(new URL(import.meta.url).pathname);
const REPOS_CONFIG = JSON.parse(fs.readFileSync(path.join(EVALS_DIR, 'repos.json'), 'utf-8'));
const CLONE_DIR = '/tmp/peakinfer-evals';
const RESULTS_DIR = path.join(EVALS_DIR, 'results');

interface RepoConfig {
  name: string;
  url: string;
  sparse_paths?: string[];
  expected_providers?: string[];
  expected_patterns?: string[];
  serving_tech?: string;
  infra_tech?: string[];
  priority: number;
}

interface EvalResult {
  repo: string;
  layer: string;
  status: 'pass' | 'fail' | 'skip' | 'error';
  duration_ms: number;
  callsites_found: number;
  providers_detected: string[];
  patterns_detected: string[];
  cost_estimate: number | null;
  error?: string;
  assertions: {
    no_crash: boolean;
    finds_callsites: boolean;
    correct_provider: boolean;
    valid_json: boolean;
    reasonable_time: boolean;
  };
}

// Parse CLI args
const args = process.argv.slice(2);
const runAll = args.includes('--all');
const layerFilter = args.includes('--layer') ? args[args.indexOf('--layer') + 1] : null;
const repoFilter = args.includes('--repo') ? args[args.indexOf('--repo') + 1] : null;
const maxPriority = runAll ? 999 : 1;

function log(msg: string) {
  console.log(`[eval] ${msg}`);
}

function logError(msg: string) {
  console.error(`[eval] ERROR: ${msg}`);
}

/**
 * Clone repo with optional sparse checkout for large repos
 */
function cloneRepo(repo: RepoConfig): string {
  const repoDir = path.join(CLONE_DIR, repo.name);

  if (fs.existsSync(repoDir)) {
    log(`Using cached clone: ${repo.name}`);
    return repoDir;
  }

  log(`Cloning ${repo.name}...`);

  if (repo.sparse_paths && repo.sparse_paths.length > 0) {
    // Sparse checkout for large repos
    fs.mkdirSync(repoDir, { recursive: true });
    execSync(`git init`, { cwd: repoDir, stdio: 'pipe' });
    execSync(`git remote add origin ${repo.url}`, { cwd: repoDir, stdio: 'pipe' });
    execSync(`git config core.sparseCheckout true`, { cwd: repoDir, stdio: 'pipe' });

    const sparseFile = path.join(repoDir, '.git', 'info', 'sparse-checkout');
    fs.writeFileSync(sparseFile, repo.sparse_paths.join('\n'));

    execSync(`git pull --depth=1 origin main || git pull --depth=1 origin master`, {
      cwd: repoDir,
      stdio: 'pipe',
      shell: '/bin/bash',
    });
  } else {
    // Shallow clone for smaller repos
    execSync(`git clone --depth=1 ${repo.url} ${repoDir}`, { stdio: 'pipe' });
  }

  return repoDir;
}

/**
 * Run PeakInfer on a repo and capture results
 */
function runPeakInfer(repoDir: string, repo: RepoConfig): EvalResult {
  const startTime = Date.now();
  const result: EvalResult = {
    repo: repo.name,
    layer: 'unknown',
    status: 'error',
    duration_ms: 0,
    callsites_found: 0,
    providers_detected: [],
    patterns_detected: [],
    cost_estimate: null,
    assertions: {
      no_crash: false,
      finds_callsites: false,
      correct_provider: false,
      valid_json: false,
      reasonable_time: false,
    },
  };

  try {
    // Run peakinfer analyze with JSON output
    const peakinferPath = path.join(EVALS_DIR, '..', 'dist', 'slc', 'cli.js');
    const proc = spawnSync('node', [peakinferPath, 'analyze', repoDir, '--output', 'json'], {
      timeout: 120000, // 2 minute timeout
      maxBuffer: 50 * 1024 * 1024, // 50MB buffer
      encoding: 'utf-8',
    });

    result.duration_ms = Date.now() - startTime;
    result.assertions.reasonable_time = result.duration_ms < 60000;

    // Check for crash
    if (proc.status === 0 || proc.status === null) {
      result.assertions.no_crash = true;
    } else if (proc.signal === 'SIGTERM') {
      result.error = 'Timeout after 2 minutes';
      result.status = 'fail';
      return result;
    } else {
      result.error = `Exit code ${proc.status}: ${proc.stderr?.slice(0, 500)}`;
      result.status = 'fail';
      return result;
    }

    // Parse JSON output
    const stdout = proc.stdout || '';
    try {
      // Find JSON in output (might have other text before/after)
      const jsonMatch = stdout.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const json = JSON.parse(jsonMatch[0]);
        result.assertions.valid_json = true;

        // Extract results
        result.callsites_found = json.callsites?.length || 0;
        result.cost_estimate = json.pricing?.totalMonthlyEstimate || null;

        // Extract providers
        if (json.stackMap?.providers) {
          result.providers_detected = Object.keys(json.stackMap.providers);
        }

        // Check assertions
        result.assertions.finds_callsites = result.callsites_found > 0;

        if (repo.expected_providers && repo.expected_providers.length > 0) {
          const found = result.providers_detected.some((p) =>
            repo.expected_providers!.some(
              (exp) => p.toLowerCase().includes(exp.toLowerCase()) || exp.toLowerCase().includes(p.toLowerCase())
            )
          );
          result.assertions.correct_provider = found || result.callsites_found === 0;
        } else {
          result.assertions.correct_provider = true;
        }

        // Determine status
        const allPass = Object.values(result.assertions).every((v) => v);
        result.status = allPass ? 'pass' : 'fail';
      } else {
        result.assertions.valid_json = false;
        result.error = 'No JSON found in output';
        result.status = 'fail';
      }
    } catch (parseError) {
      result.assertions.valid_json = false;
      result.error = `JSON parse error: ${parseError}`;
      result.status = 'fail';
    }
  } catch (error: any) {
    result.error = error.message;
    result.status = 'error';
  }

  return result;
}

/**
 * Get all repos from config, filtered by CLI args
 */
function getReposToTest(): Array<{ repo: RepoConfig; layer: string }> {
  const repos: Array<{ repo: RepoConfig; layer: string }> = [];

  const layers = ['application_layer', 'serving_layer', 'infrastructure_layer', 'alternative_providers'];

  for (const layer of layers) {
    if (layerFilter && !layer.includes(layerFilter)) continue;

    const layerConfig = REPOS_CONFIG[layer];
    if (!layerConfig?.repos) continue;

    for (const repo of layerConfig.repos) {
      if (repoFilter && repo.name !== repoFilter) continue;
      if (repo.priority > maxPriority) continue;

      repos.push({ repo, layer });
    }
  }

  return repos;
}

/**
 * Print summary table
 */
function printSummary(results: EvalResult[]) {
  console.log('\n' + '='.repeat(80));
  console.log('PEAKINFER EVAL RESULTS');
  console.log('='.repeat(80));

  const passed = results.filter((r) => r.status === 'pass').length;
  const failed = results.filter((r) => r.status === 'fail').length;
  const errors = results.filter((r) => r.status === 'error').length;

  console.log(`\nSummary: ${passed} passed, ${failed} failed, ${errors} errors\n`);

  // Table header
  console.log(
    '%-25s %-12s %-8s %-10s %-15s %s'.replace(/%(-?\d+)s/g, (_, n) => ' '.repeat(Math.abs(parseInt(n))))
  );
  console.log(
    [
      'REPO'.padEnd(25),
      'LAYER'.padEnd(12),
      'STATUS'.padEnd(8),
      'CALLS'.padEnd(10),
      'PROVIDERS'.padEnd(15),
      'TIME',
    ].join(' ')
  );
  console.log('-'.repeat(80));

  for (const r of results) {
    const status = r.status === 'pass' ? 'PASS' : r.status === 'fail' ? 'FAIL' : 'ERR';
    const statusColor = r.status === 'pass' ? '\x1b[32m' : '\x1b[31m';
    const reset = '\x1b[0m';

    console.log(
      [
        r.repo.padEnd(25),
        r.layer.replace('_layer', '').padEnd(12),
        `${statusColor}${status}${reset}`.padEnd(8 + 9), // +9 for color codes
        String(r.callsites_found).padEnd(10),
        (r.providers_detected.slice(0, 2).join(',') || '-').padEnd(15),
        `${(r.duration_ms / 1000).toFixed(1)}s`,
      ].join(' ')
    );

    if (r.error) {
      console.log(`  └─ ${r.error.slice(0, 60)}`);
    }
  }

  console.log('\n');
}

/**
 * Main eval runner
 */
async function main() {
  log('PeakInfer Real-World Repo Evaluation');
  log(`Clone dir: ${CLONE_DIR}`);

  // Ensure directories exist
  fs.mkdirSync(CLONE_DIR, { recursive: true });
  fs.mkdirSync(RESULTS_DIR, { recursive: true });

  const reposToTest = getReposToTest();
  log(`Testing ${reposToTest.length} repos...`);

  const results: EvalResult[] = [];

  for (const { repo, layer } of reposToTest) {
    console.log(`\n${'─'.repeat(60)}`);
    log(`Testing: ${repo.name} (${layer})`);

    try {
      const repoDir = cloneRepo(repo);
      const result = runPeakInfer(repoDir, repo);
      result.layer = layer;
      results.push(result);

      const icon = result.status === 'pass' ? '✓' : result.status === 'fail' ? '✗' : '!';
      log(`${icon} ${repo.name}: ${result.status} (${result.callsites_found} callsites, ${result.duration_ms}ms)`);
    } catch (error: any) {
      logError(`Failed to test ${repo.name}: ${error.message}`);
      results.push({
        repo: repo.name,
        layer,
        status: 'error',
        duration_ms: 0,
        callsites_found: 0,
        providers_detected: [],
        patterns_detected: [],
        cost_estimate: null,
        error: error.message,
        assertions: {
          no_crash: false,
          finds_callsites: false,
          correct_provider: false,
          valid_json: false,
          reasonable_time: false,
        },
      });
    }
  }

  // Print summary
  printSummary(results);

  // Save results
  const resultsFile = path.join(RESULTS_DIR, `eval-${Date.now()}.json`);
  fs.writeFileSync(resultsFile, JSON.stringify({ timestamp: new Date().toISOString(), results }, null, 2));
  log(`Results saved to: ${resultsFile}`);

  // Exit with error if any failed
  const hasFailures = results.some((r) => r.status === 'fail' || r.status === 'error');
  process.exit(hasFailures ? 1 : 0);
}

main().catch((err) => {
  logError(err.message);
  process.exit(1);
});
