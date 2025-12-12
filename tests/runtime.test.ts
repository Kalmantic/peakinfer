import { describe, it, expect, beforeEach } from 'vitest';
import { parseEvents, aggregate, percentile } from '../src/runtime.js';
import { writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';

const FIXTURES_DIR = join(__dirname, 'fixtures', 'events');

// Ensure fixtures directory exists
beforeEach(() => {
  mkdirSync(FIXTURES_DIR, { recursive: true });
});

describe('runtime parser', () => {
  describe('JSONL parsing', () => {
    it('parses valid JSONL', async () => {
      const content = [
        '{"id":"1","ts":"2024-01-01T00:00:00Z","provider":"openai","model":"gpt-4o","input_tokens":100,"output_tokens":50,"latency_ms":420}',
        '{"id":"2","ts":"2024-01-01T00:01:00Z","provider":"openai","model":"gpt-4o","input_tokens":200,"output_tokens":80,"latency_ms":580}',
      ].join('\n');

      const path = join(FIXTURES_DIR, 'valid.jsonl');
      writeFileSync(path, content);

      const events = await parseEvents(path);
      expect(events.length).toBe(2);
      expect(events[0].provider).toBe('openai');
      expect(events[1].latency_ms).toBe(580);
    });
  });

  describe('JSON array parsing', () => {
    it('parses valid JSON array', async () => {
      const data = [
        { id: '1', ts: '2024-01-01T00:00:00Z', provider: 'anthropic', model: 'claude-3-sonnet-20240229', input_tokens: 150, output_tokens: 60, latency_ms: 350 },
        { id: '2', ts: '2024-01-01T00:01:00Z', provider: 'anthropic', model: 'claude-3-sonnet-20240229', input_tokens: 180, output_tokens: 90, latency_ms: 400 },
      ];

      const path = join(FIXTURES_DIR, 'valid.json');
      writeFileSync(path, JSON.stringify(data));

      const events = await parseEvents(path);
      expect(events.length).toBe(2);
      expect(events[0].provider).toBe('anthropic');
    });
  });

  describe('CSV parsing', () => {
    it('parses valid CSV', async () => {
      const content = [
        'id,ts,provider,model,input_tokens,output_tokens,latency_ms',
        '1,2024-01-01T00:00:00Z,openai,gpt-4o,100,50,420',
        '2,2024-01-01T00:01:00Z,openai,gpt-4o,200,80,580',
      ].join('\n');

      const path = join(FIXTURES_DIR, 'valid.csv');
      writeFileSync(path, content);

      const events = await parseEvents(path);
      expect(events.length).toBe(2);
      expect(events[0].input_tokens).toBe(100);
    });
  });

  describe('validation', () => {
    it('rejects missing id field', async () => {
      const content = '{"ts":"2024-01-01","provider":"openai","model":"gpt-4o","input_tokens":100,"output_tokens":50,"latency_ms":420}';
      const path = join(FIXTURES_DIR, 'missing-id.jsonl');
      writeFileSync(path, content);

      await expect(parseEvents(path)).rejects.toThrow();
    });

    it('rejects missing ts field', async () => {
      const content = '{"id":"1","provider":"openai","model":"gpt-4o","input_tokens":100,"output_tokens":50,"latency_ms":420}';
      const path = join(FIXTURES_DIR, 'missing-ts.jsonl');
      writeFileSync(path, content);

      await expect(parseEvents(path)).rejects.toThrow();
    });

    it('rejects missing provider field', async () => {
      const content = '{"id":"1","ts":"2024-01-01","model":"gpt-4o","input_tokens":100,"output_tokens":50,"latency_ms":420}';
      const path = join(FIXTURES_DIR, 'missing-provider.jsonl');
      writeFileSync(path, content);

      await expect(parseEvents(path)).rejects.toThrow();
    });

    it('rejects missing model field', async () => {
      const content = '{"id":"1","ts":"2024-01-01","provider":"openai","input_tokens":100,"output_tokens":50,"latency_ms":420}';
      const path = join(FIXTURES_DIR, 'missing-model.jsonl');
      writeFileSync(path, content);

      await expect(parseEvents(path)).rejects.toThrow();
    });

    it('rejects missing input_tokens field', async () => {
      const content = '{"id":"1","ts":"2024-01-01","provider":"openai","model":"gpt-4o","output_tokens":50,"latency_ms":420}';
      const path = join(FIXTURES_DIR, 'missing-input.jsonl');
      writeFileSync(path, content);

      await expect(parseEvents(path)).rejects.toThrow();
    });

    it('rejects missing output_tokens field', async () => {
      const content = '{"id":"1","ts":"2024-01-01","provider":"openai","model":"gpt-4o","input_tokens":100,"latency_ms":420}';
      const path = join(FIXTURES_DIR, 'missing-output.jsonl');
      writeFileSync(path, content);

      await expect(parseEvents(path)).rejects.toThrow();
    });

    it('rejects missing latency_ms field', async () => {
      const content = '{"id":"1","ts":"2024-01-01","provider":"openai","model":"gpt-4o","input_tokens":100,"output_tokens":50}';
      const path = join(FIXTURES_DIR, 'missing-latency.jsonl');
      writeFileSync(path, content);

      await expect(parseEvents(path)).rejects.toThrow();
    });

    it('rejects wrong type for latency_ms', async () => {
      const content = '{"id":"1","ts":"2024-01-01","provider":"openai","model":"gpt-4o","input_tokens":100,"output_tokens":50,"latency_ms":"fast"}';
      const path = join(FIXTURES_DIR, 'wrong-type.jsonl');
      writeFileSync(path, content);

      await expect(parseEvents(path)).rejects.toThrow();
    });

    it('accepts optional intent field', async () => {
      const content = '{"id":"1","ts":"2024-01-01T00:00:00Z","provider":"openai","model":"gpt-4o","input_tokens":100,"output_tokens":50,"latency_ms":420,"intent":"chat"}';
      const path = join(FIXTURES_DIR, 'with-intent.jsonl');
      writeFileSync(path, content);

      const events = await parseEvents(path);
      expect(events[0].intent).toBe('chat');
    });

    it('accepts optional callsite_id field', async () => {
      const content = '{"id":"1","ts":"2024-01-01T00:00:00Z","provider":"openai","model":"gpt-4o","input_tokens":100,"output_tokens":50,"latency_ms":420,"callsite_id":"cs_001"}';
      const path = join(FIXTURES_DIR, 'with-callsite.jsonl');
      writeFileSync(path, content);

      const events = await parseEvents(path);
      expect(events[0].callsite_id).toBe('cs_001');
    });
  });

  describe('percentile calculation', () => {
    it('calculates p50 correctly', () => {
      const values = [100, 200, 300, 400, 500];
      expect(percentile(values, 50)).toBe(300);
    });

    it('calculates p95 correctly', () => {
      const values = Array.from({ length: 100 }, (_, i) => (i + 1) * 10);
      expect(percentile(values, 95)).toBe(950);
    });

    it('calculates p99 correctly', () => {
      const values = Array.from({ length: 100 }, (_, i) => (i + 1) * 10);
      expect(percentile(values, 99)).toBe(990);
    });
  });

  describe('aggregation', () => {
    it('aggregates by provider', () => {
      const events = [
        { id: '1', ts: '2024-01-01', provider: 'openai' as const, model: 'gpt-4o', input_tokens: 100, output_tokens: 50, latency_ms: 420 },
        { id: '2', ts: '2024-01-01', provider: 'openai' as const, model: 'gpt-4o', input_tokens: 200, output_tokens: 80, latency_ms: 580 },
        { id: '3', ts: '2024-01-01', provider: 'anthropic' as const, model: 'claude-3', input_tokens: 150, output_tokens: 60, latency_ms: 350 },
      ];

      const summary = aggregate(events);
      expect(summary.byProvider['openai'].calls).toBe(2);
      expect(summary.byProvider['anthropic'].calls).toBe(1);
    });

    it('aggregates by model', () => {
      const events = [
        { id: '1', ts: '2024-01-01', provider: 'openai' as const, model: 'gpt-4o', input_tokens: 100, output_tokens: 50, latency_ms: 420 },
        { id: '2', ts: '2024-01-01', provider: 'openai' as const, model: 'gpt-4o-mini', input_tokens: 200, output_tokens: 80, latency_ms: 180 },
      ];

      const summary = aggregate(events);
      expect(summary.byModel['gpt-4o'].calls).toBe(1);
      expect(summary.byModel['gpt-4o-mini'].calls).toBe(1);
    });

    it('handles single event', () => {
      const events = [
        { id: '1', ts: '2024-01-01', provider: 'openai' as const, model: 'gpt-4o', input_tokens: 100, output_tokens: 50, latency_ms: 420 },
      ];

      const summary = aggregate(events);
      expect(summary.totalEvents).toBe(1);
      expect(summary.global.p50).toBe(420);
    });

    it('handles empty array', () => {
      const summary = aggregate([]);
      expect(summary.totalEvents).toBe(0);
      expect(summary.global.p50).toBe(0);
    });
  });
});
