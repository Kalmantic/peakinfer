/**
 * Performance Benchmark Tests
 *
 * Validates that PeakInfer meets response time requirements defined in CLAUDE.md:
 * - Static analysis (small repo): < 3s (max 5s)
 * - Static analysis (large repo): < 10s (max 15s)
 * - Runtime correlation: < 2s (max 5s)
 * - PR comment generation: < 5s (max 10s)
 *
 * These tests use mock data to avoid API dependencies.
 * For full benchmarks with real LLM calls, run: npx tsx scripts/benchmark.ts
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { performance } from 'perf_hooks';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { scan, type ScanResult } from '../../src/scanner.js';
import { parseRuntimeEvents, type RuntimeEvent } from '../../src/runtime.js';
import { computeRuntimeSummary } from '../../src/runtime.js';

const TEMP_DIR = join(__dirname, '.perf-test-temp');

// =============================================================================
// PERFORMANCE TARGETS (from CLAUDE.md)
// =============================================================================

const TARGETS = {
  scan_small: 500,       // Scanner should complete in < 500ms for small repos
  scan_large: 2000,      // Scanner should complete in < 2s for large repos
  parse_events: 500,     // Event parsing should complete in < 500ms for 1000 events
  compute_summary: 100,  // Summary computation should complete in < 100ms
};

// =============================================================================
// TEST FIXTURES
// =============================================================================

function createSmallRepo(dir: string): void {
  mkdirSync(join(dir, 'src'), { recursive: true });

  writeFileSync(join(dir, 'src', 'chat.ts'), `
import Anthropic from '@anthropic-ai/sdk';
const client = new Anthropic();
export async function chat(msg: string) {
  return client.messages.create({ model: 'claude-3-5-sonnet-20241022', max_tokens: 1024, messages: [{ role: 'user', content: msg }] });
}
`);

  writeFileSync(join(dir, 'src', 'api.py'), `
from openai import OpenAI
client = OpenAI()
def call_llm(prompt: str):
    return client.chat.completions.create(model="gpt-4o", messages=[{"role": "user", "content": prompt}])
`);
}

function createLargeRepo(dir: string): void {
  mkdirSync(join(dir, 'src/services'), { recursive: true });
  mkdirSync(join(dir, 'src/agents'), { recursive: true });

  for (let i = 0; i < 50; i++) {
    writeFileSync(join(dir, 'src/services', `service-${i}.ts`), `
import OpenAI from 'openai';
const client = new OpenAI();
export async function service${i}(input: string) {
  return client.chat.completions.create({ model: 'gpt-4o', messages: [{ role: 'user', content: input }] });
}
`);
  }

  for (let i = 0; i < 30; i++) {
    writeFileSync(join(dir, 'src/agents', `agent-${i}.py`), `
from anthropic import Anthropic
client = Anthropic()
def agent_${i}(prompt: str):
    return client.messages.create(model="claude-3-5-sonnet-20241022", max_tokens=1024, messages=[{"role": "user", "content": prompt}])
`);
  }
}

function createRuntimeEvents(count: number): RuntimeEvent[] {
  const events: RuntimeEvent[] = [];
  const models = ['gpt-4o', 'gpt-4o-mini', 'claude-3-5-sonnet-20241022'];
  const providers = ['openai', 'openai', 'anthropic'];

  for (let i = 0; i < count; i++) {
    const idx = i % models.length;
    events.push({
      id: `evt_${i.toString().padStart(6, '0')}`,
      ts: new Date(Date.now() - (count - i) * 60000).toISOString(),
      provider: providers[idx],
      model: models[idx],
      input_tokens: 100 + Math.floor(Math.random() * 500),
      output_tokens: 50 + Math.floor(Math.random() * 200),
      latency_ms: 500 + Math.floor(Math.random() * 2000),
    });
  }

  return events;
}

// =============================================================================
// TESTS
// =============================================================================

describe('Performance Benchmarks', () => {
  const smallRepo = join(TEMP_DIR, 'small');
  const largeRepo = join(TEMP_DIR, 'large');

  beforeAll(() => {
    if (existsSync(TEMP_DIR)) {
      rmSync(TEMP_DIR, { recursive: true });
    }
    mkdirSync(smallRepo, { recursive: true });
    mkdirSync(largeRepo, { recursive: true });
    createSmallRepo(smallRepo);
    createLargeRepo(largeRepo);
  });

  afterAll(() => {
    if (existsSync(TEMP_DIR)) {
      rmSync(TEMP_DIR, { recursive: true });
    }
  });

  describe('Scanner Performance', () => {
    it('scans small repo within target time', async () => {
      const start = performance.now();
      const result = await scan(smallRepo);
      const duration = performance.now() - start;

      expect(result.files.length).toBeGreaterThan(0);
      expect(duration).toBeLessThan(TARGETS.scan_small);
    });

    it('scans large repo within target time', async () => {
      const start = performance.now();
      const result = await scan(largeRepo);
      const duration = performance.now() - start;

      expect(result.files.length).toBeGreaterThanOrEqual(50);
      expect(duration).toBeLessThan(TARGETS.scan_large);
    });
  });

  describe('Runtime Event Processing Performance', () => {
    it('parses 1000 events within target time', () => {
      const events = createRuntimeEvents(1000);
      const jsonl = events.map(e => JSON.stringify(e)).join('\n');

      const start = performance.now();
      const parsed = parseRuntimeEvents(jsonl, 'jsonl');
      const duration = performance.now() - start;

      expect(parsed.events.length).toBe(1000);
      expect(duration).toBeLessThan(TARGETS.parse_events);
    });

    it('computes summary within target time', () => {
      const events = createRuntimeEvents(1000);

      const start = performance.now();
      const summary = computeRuntimeSummary(events);
      const duration = performance.now() - start;

      expect(summary.totalEvents).toBe(1000);
      expect(duration).toBeLessThan(TARGETS.compute_summary);
    });
  });

  describe('Stress Tests', () => {
    it('handles 10,000 events without memory issues', () => {
      const events = createRuntimeEvents(10000);
      const jsonl = events.map(e => JSON.stringify(e)).join('\n');

      const memBefore = process.memoryUsage().heapUsed;
      const parsed = parseRuntimeEvents(jsonl, 'jsonl');
      const summary = computeRuntimeSummary(parsed.events);
      const memAfter = process.memoryUsage().heapUsed;

      const memIncreaseMB = (memAfter - memBefore) / 1024 / 1024;

      expect(parsed.events.length).toBe(10000);
      expect(summary.totalEvents).toBe(10000);
      expect(memIncreaseMB).toBeLessThan(100); // Should use < 100MB for 10k events
    });
  });
});
