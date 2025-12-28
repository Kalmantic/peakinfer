import { describe, it, expect } from 'vitest';
import { join } from '../src/joiner.js';
import type { Callsite, InferenceEvent } from '../src/types.js';

const makeCallsite = (overrides: Partial<Callsite> = {}): Callsite => ({
  id: 'cs_001',
  file: 'src/chat.py',
  line: 42,
  provider: 'openai',
  model: 'gpt-4o',
  framework: null,
  runtime: null,
  patterns: {},
  confidence: 0.9,
  ...overrides,
});

const makeEvent = (overrides: Partial<InferenceEvent> = {}): InferenceEvent => ({
  id: 'evt_001',
  ts: '2024-01-01T00:00:00Z',
  provider: 'openai',
  model: 'gpt-4o',
  input_tokens: 100,
  output_tokens: 50,
  latency_ms: 420,
  ...overrides,
});

describe('joiner', () => {
  describe('matching', () => {
    it('matches callsite to events by provider+model', () => {
      const callsites = [makeCallsite()];
      const events = [
        makeEvent({ id: '1', latency_ms: 420 }),
        makeEvent({ id: '2', latency_ms: 580 }),
      ];

      const result = join(callsites, events);
      expect(result.callsites[0].usage).toBeDefined();
      expect(result.callsites[0].usage?.calls).toBe(2);
    });

    it('matches by callsite_id when present', () => {
      const callsites = [
        makeCallsite({ id: 'cs_001', model: 'gpt-4o' }),
        makeCallsite({ id: 'cs_002', model: 'gpt-4o-mini' }),
      ];
      const events = [
        makeEvent({ id: '1', callsite_id: 'cs_002', latency_ms: 180 }),
        makeEvent({ id: '2', callsite_id: 'cs_002', latency_ms: 220 }),
      ];

      const result = join(callsites, events);
      expect(result.callsites[0].usage).toBeUndefined(); // cs_001 has no events
      expect(result.callsites[1].usage?.calls).toBe(2); // cs_002 has 2 events
    });

    it('prefers callsite_id over provider+model', () => {
      const callsites = [
        makeCallsite({ id: 'cs_001', provider: 'openai', model: 'gpt-4o' }),
        makeCallsite({ id: 'cs_002', provider: 'openai', model: 'gpt-4o' }),
      ];
      const events = [
        makeEvent({ id: '1', provider: 'openai', model: 'gpt-4o', callsite_id: 'cs_002' }),
      ];

      const result = join(callsites, events);
      expect(result.callsites[0].usage).toBeUndefined();
      expect(result.callsites[1].usage?.calls).toBe(1);
    });
  });

  describe('usage stats', () => {
    it('calculates usage stats for matched callsites', () => {
      const callsites = [makeCallsite()];
      const events = [
        makeEvent({ id: '1', input_tokens: 100, output_tokens: 50, latency_ms: 300 }),
        makeEvent({ id: '2', input_tokens: 200, output_tokens: 80, latency_ms: 400 }),
        makeEvent({ id: '3', input_tokens: 150, output_tokens: 60, latency_ms: 500 }),
      ];

      const result = join(callsites, events);
      const usage = result.callsites[0].usage!;

      expect(usage.calls).toBe(3);
      expect(usage.tokens_in).toBe(450);
      expect(usage.tokens_out).toBe(190);
      expect(usage.latency_p50).toBe(400);
    });
  });

  describe('drift detection', () => {
    it('identifies codeOnly callsites', () => {
      const callsites = [
        makeCallsite({ id: 'cs_001', provider: 'openai', model: 'gpt-4o' }),
        makeCallsite({ id: 'cs_002', provider: 'anthropic', model: 'claude-3-opus' }),
      ];
      const events = [
        makeEvent({ provider: 'openai', model: 'gpt-4o' }),
      ];

      const result = join(callsites, events);
      expect(result.codeOnly.length).toBe(1);
      expect(result.codeOnly[0].id).toBe('cs_002');
    });

    it('identifies runtimeOnly events', () => {
      const callsites = [makeCallsite({ provider: 'openai', model: 'gpt-4o' })];
      const events = [
        makeEvent({ provider: 'openai', model: 'gpt-4o' }),
        makeEvent({ provider: 'anthropic', model: 'claude-3-opus' }),
      ];

      const result = join(callsites, events);
      expect(result.runtimeOnly.length).toBe(1);
      expect(result.runtimeOnly[0].provider).toBe('anthropic');
    });

    it('generates drift signal for codeOnly', () => {
      const callsites = [makeCallsite({ provider: 'anthropic', model: 'claude-3-opus' })];
      const events: InferenceEvent[] = [];

      const result = join(callsites, events);
      expect(result.drift.length).toBe(1);
      expect(result.drift[0].type).toBe('codeOnly');
    });

    it('generates drift signal for runtimeOnly', () => {
      const callsites: Callsite[] = [];
      const events = [makeEvent()];

      const result = join(callsites, events);
      expect(result.drift.length).toBe(1);
      expect(result.drift[0].type).toBe('runtimeOnly');
    });
  });

  describe('edge cases', () => {
    it('handles empty callsites', () => {
      const result = join([], [makeEvent()]);
      expect(result.callsites.length).toBe(0);
      expect(result.runtimeOnly.length).toBe(1);
    });

    it('handles empty events', () => {
      const result = join([makeCallsite()], []);
      expect(result.callsites.length).toBe(1);
      expect(result.callsites[0].usage).toBeUndefined();
      expect(result.codeOnly.length).toBe(1);
    });

    it('handles multiple callsites with same provider+model', () => {
      const callsites = [
        makeCallsite({ id: 'cs_001', file: 'a.py' }),
        makeCallsite({ id: 'cs_002', file: 'b.py' }),
      ];
      const events = [
        makeEvent({ id: '1', latency_ms: 400 }),
        makeEvent({ id: '2', latency_ms: 500 }),
      ];

      const result = join(callsites, events);
      // Both callsites should have usage (events distributed)
      expect(result.callsites[0].usage).toBeDefined();
      expect(result.callsites[1].usage).toBeDefined();
    });
  });
});
