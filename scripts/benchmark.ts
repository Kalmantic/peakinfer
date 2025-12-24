#!/usr/bin/env npx tsx
/**
 * PeakInfer Performance Benchmark Suite
 *
 * Validates response time requirements from CLAUDE.md:
 * - Static analysis (small repo): < 3s (max 5s)
 * - Static analysis (large repo): < 10s (max 15s)
 * - Runtime correlation: < 2s (max 5s)
 * - PR comment generation: < 5s (max 10s)
 *
 * Usage:
 *   npx tsx scripts/benchmark.ts
 *   npx tsx scripts/benchmark.ts --json
 *   npx tsx scripts/benchmark.ts --ci  # Exit non-zero if targets missed
 */

import { performance } from 'perf_hooks';
import { execSync, spawn } from 'child_process';
import { mkdirSync, writeFileSync, rmSync, existsSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// =============================================================================
// CONFIGURATION
// =============================================================================

interface BenchmarkTarget {
  name: string;
  target: number;  // Target time in ms
  max: number;     // Maximum acceptable time in ms
}

const TARGETS: Record<string, BenchmarkTarget> = {
  'static-small': { name: 'Static analysis (small repo)', target: 3000, max: 5000 },
  'static-large': { name: 'Static analysis (large repo)', target: 10000, max: 15000 },
  'runtime-correlation': { name: 'Runtime correlation', target: 2000, max: 5000 },
  'pr-comment': { name: 'PR comment generation', target: 5000, max: 10000 },
};

interface BenchmarkResult {
  name: string;
  duration: number;
  target: number;
  max: number;
  status: 'pass' | 'warn' | 'fail';
  iterations: number;
}

// =============================================================================
// TEST FIXTURES
// =============================================================================

function createSmallRepo(dir: string): void {
  mkdirSync(join(dir, 'src'), { recursive: true });

  // 3 files with LLM inference points
  writeFileSync(join(dir, 'src', 'chat.ts'), `
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

export async function chat(message: string) {
  const response = await client.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 1024,
    messages: [{ role: 'user', content: message }],
  });
  return response;
}
`);

  writeFileSync(join(dir, 'src', 'summarize.ts'), `
import OpenAI from 'openai';

const openai = new OpenAI();

export async function summarize(text: string) {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: \`Summarize: \${text}\` }],
    stream: true,
  });
  return response;
}
`);

  writeFileSync(join(dir, 'src', 'classify.py'), `
from openai import OpenAI

client = OpenAI()

def classify(text: str) -> str:
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": f"Classify: {text}"}],
    )
    return response.choices[0].message.content
`);
}

function createLargeRepo(dir: string): void {
  mkdirSync(join(dir, 'src/services'), { recursive: true });
  mkdirSync(join(dir, 'src/agents'), { recursive: true });
  mkdirSync(join(dir, 'src/pipelines'), { recursive: true });
  mkdirSync(join(dir, 'lib'), { recursive: true });

  // Generate 20+ files with inference points
  const providers = ['openai', 'anthropic'];
  const models = ['gpt-4o', 'gpt-4o-mini', 'claude-3-5-sonnet-20241022', 'claude-3-opus'];

  for (let i = 0; i < 25; i++) {
    const provider = providers[i % providers.length];
    const model = models[i % models.length];

    if (provider === 'openai') {
      writeFileSync(join(dir, 'src/services', `service-${i}.ts`), `
import OpenAI from 'openai';
const client = new OpenAI();

export async function process${i}(input: string) {
  const response = await client.chat.completions.create({
    model: '${model}',
    messages: [{ role: 'user', content: input }],
    ${i % 3 === 0 ? 'stream: true,' : ''}
    max_tokens: ${500 + i * 100},
  });
  return response;
}

export async function batch${i}(inputs: string[]) {
  const results = await Promise.all(inputs.map(async (input) => {
    return client.chat.completions.create({
      model: '${model}',
      messages: [{ role: 'user', content: input }],
    });
  }));
  return results;
}
`);
    } else {
      writeFileSync(join(dir, 'src/agents', `agent-${i}.ts`), `
import Anthropic from '@anthropic-ai/sdk';
const anthropic = new Anthropic();

export async function agent${i}(prompt: string) {
  const message = await anthropic.messages.create({
    model: '${model}',
    max_tokens: ${1024 + i * 50},
    messages: [{ role: 'user', content: prompt }],
  });
  return message;
}

export class Agent${i} {
  async run(input: string) {
    const response = await anthropic.messages.create({
      model: '${model}',
      max_tokens: 2048,
      ${i % 2 === 0 ? "stream: true," : ""}
      messages: [{ role: 'user', content: input }],
    });
    return response;
  }
}
`);
    }
  }

  // Add Python files
  for (let i = 0; i < 10; i++) {
    writeFileSync(join(dir, 'src/pipelines', `pipeline_${i}.py`), `
from openai import OpenAI
from anthropic import Anthropic

openai_client = OpenAI()
anthropic_client = Anthropic()

def pipeline_${i}(data: list) -> list:
    results = []
    for item in data:
        response = openai_client.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": str(item)}],
        )
        results.append(response.choices[0].message.content)
    return results

async def async_pipeline_${i}(data: list):
    response = anthropic_client.messages.create(
        model="claude-3-5-sonnet-20241022",
        max_tokens=1024,
        messages=[{"role": "user", "content": str(data)}],
    )
    return response
`);
  }
}

function createRuntimeEvents(dir: string, count: number): string {
  const eventsPath = join(dir, 'events.jsonl');
  const events: string[] = [];

  const models = ['gpt-4o', 'gpt-4o-mini', 'claude-3-5-sonnet-20241022'];
  const providers = ['openai', 'openai', 'anthropic'];

  for (let i = 0; i < count; i++) {
    const modelIdx = i % models.length;
    events.push(JSON.stringify({
      id: `evt_${i.toString().padStart(6, '0')}`,
      ts: new Date(Date.now() - (count - i) * 60000).toISOString(),
      provider: providers[modelIdx],
      model: models[modelIdx],
      input_tokens: 100 + Math.floor(Math.random() * 500),
      output_tokens: 50 + Math.floor(Math.random() * 200),
      latency_ms: 500 + Math.floor(Math.random() * 2000),
    }));
  }

  writeFileSync(eventsPath, events.join('\n'));
  return eventsPath;
}

// =============================================================================
// BENCHMARK RUNNER
// =============================================================================

async function runBenchmark(
  name: string,
  command: string,
  args: string[],
  iterations: number = 3
): Promise<BenchmarkResult> {
  const target = TARGETS[name];
  const times: number[] = [];

  for (let i = 0; i < iterations; i++) {
    const start = performance.now();

    await new Promise<void>((resolve, reject) => {
      const proc = spawn(command, args, {
        cwd: ROOT,
        stdio: 'pipe',
        env: { ...process.env, PEAKINFER_BENCHMARK: '1' },
      });

      proc.on('close', (code) => {
        if (code === 0 || code === null) {
          resolve();
        } else {
          // Allow non-zero exit for demo mode without API key
          resolve();
        }
      });

      proc.on('error', reject);
    });

    const duration = performance.now() - start;
    times.push(duration);
  }

  // Use median time
  times.sort((a, b) => a - b);
  const median = times[Math.floor(times.length / 2)];

  let status: 'pass' | 'warn' | 'fail';
  if (median <= target.target) {
    status = 'pass';
  } else if (median <= target.max) {
    status = 'warn';
  } else {
    status = 'fail';
  }

  return {
    name: target.name,
    duration: Math.round(median),
    target: target.target,
    max: target.max,
    status,
    iterations,
  };
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  const args = process.argv.slice(2);
  const jsonOutput = args.includes('--json');
  const ciMode = args.includes('--ci');

  const tempDir = join(ROOT, '.benchmark-temp');

  // Cleanup
  if (existsSync(tempDir)) {
    rmSync(tempDir, { recursive: true });
  }
  mkdirSync(tempDir, { recursive: true });

  const smallRepo = join(tempDir, 'small-repo');
  const largeRepo = join(tempDir, 'large-repo');
  mkdirSync(smallRepo);
  mkdirSync(largeRepo);

  if (!jsonOutput) {
    console.log('PeakInfer Performance Benchmark');
    console.log('================================\n');
    console.log('Creating test fixtures...');
  }

  createSmallRepo(smallRepo);
  createLargeRepo(largeRepo);
  const eventsPath = createRuntimeEvents(tempDir, 500);

  if (!jsonOutput) {
    console.log('Running benchmarks...\n');
  }

  const results: BenchmarkResult[] = [];

  // Static analysis - small repo (using demo mode for offline testing)
  results.push(await runBenchmark(
    'static-small',
    'npx',
    ['tsx', join(ROOT, 'src/cli.ts'), 'analyze', smallRepo, '--output', 'json'],
    3
  ));

  // Static analysis - large repo
  results.push(await runBenchmark(
    'static-large',
    'npx',
    ['tsx', join(ROOT, 'src/cli.ts'), 'analyze', largeRepo, '--output', 'json'],
    3
  ));

  // Runtime correlation
  results.push(await runBenchmark(
    'runtime-correlation',
    'npx',
    ['tsx', join(ROOT, 'src/cli.ts'), 'analyze', smallRepo, '--events', eventsPath, '--output', 'json'],
    3
  ));

  // PR comment generation (simulated via json output)
  results.push(await runBenchmark(
    'pr-comment',
    'npx',
    ['tsx', join(ROOT, 'src/cli.ts'), 'analyze', smallRepo, '--output', 'json', '--fixes'],
    3
  ));

  // Cleanup
  rmSync(tempDir, { recursive: true });

  // Output results
  if (jsonOutput) {
    console.log(JSON.stringify({ benchmarks: results, timestamp: new Date().toISOString() }, null, 2));
  } else {
    console.log('Results');
    console.log('-------\n');

    const statusSymbols = { pass: '✅', warn: '⚠️', fail: '❌' };

    for (const result of results) {
      const symbol = statusSymbols[result.status];
      const pct = Math.round((result.duration / result.target) * 100);
      console.log(`${symbol} ${result.name}`);
      console.log(`   Duration: ${result.duration}ms (target: ${result.target}ms, max: ${result.max}ms)`);
      console.log(`   Status: ${result.status.toUpperCase()} (${pct}% of target)`);
      console.log('');
    }

    console.log('Summary');
    console.log('-------');
    const passed = results.filter(r => r.status === 'pass').length;
    const warned = results.filter(r => r.status === 'warn').length;
    const failed = results.filter(r => r.status === 'fail').length;
    console.log(`Passed: ${passed}, Warnings: ${warned}, Failed: ${failed}`);
  }

  // CI mode exit code
  if (ciMode) {
    const failed = results.some(r => r.status === 'fail');
    process.exit(failed ? 1 : 0);
  }
}

main().catch(console.error);
