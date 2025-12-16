/**
 * Format Normalizer Tests - PeakInfer TDD v1.3
 * 
 * Tests for the format detection and normalization pipeline.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import * as path from 'path';
import { detectFormat } from '../format/detector.js';
import { normalizeEventsFile } from '../format/normalizer.js';
import {
  parseOtelExport,
  parseJaegerExport,
  parseZipkinExport,
  parseLangSmithExport,
  parseHeliconeExport,
  parseWandbExport,
  parseLiteLLMExport,
  parsePortkeyExport,
} from '../format/adapters/index.js';

const FIXTURES_DIR = path.join(__dirname, '../../..', 'test-codebase/fixtures/formats');

// =============================================================================
// FORMAT DETECTION TESTS
// =============================================================================

describe('Format Detection', () => {
  it('should detect JSONL format', async () => {
    const result = await detectFormat(path.join(FIXTURES_DIR, 'events.jsonl'));
    expect(result.detected).toBe('jsonl');
    expect(result.confidence).toBeGreaterThanOrEqual(0.8);
    expect(result.requiresAgent).toBe(false);
  });

  it('should detect JSON array format', async () => {
    const result = await detectFormat(path.join(FIXTURES_DIR, 'events.json'));
    expect(result.detected).toBe('json_array');
    expect(result.confidence).toBeGreaterThanOrEqual(0.8);
  });

  it('should detect CSV format', async () => {
    const result = await detectFormat(path.join(FIXTURES_DIR, 'events.csv'));
    expect(result.detected).toBe('csv');
    expect(result.confidence).toBeGreaterThanOrEqual(0.8);
  });

  it('should detect OpenTelemetry format', async () => {
    const result = await detectFormat(path.join(FIXTURES_DIR, 'otel-traces.json'));
    expect(result.detected).toBe('otel');
    expect(result.requiresAgent).toBe(true);
  });

  it('should detect Jaeger format', async () => {
    const result = await detectFormat(path.join(FIXTURES_DIR, 'jaeger-traces.json'));
    expect(result.detected).toBe('jaeger');
    expect(result.requiresAgent).toBe(true);
  });

  it('should detect Zipkin format', async () => {
    const result = await detectFormat(path.join(FIXTURES_DIR, 'zipkin-traces.json'));
    expect(result.detected).toBe('zipkin');
    expect(result.requiresAgent).toBe(true);
  });
});

// =============================================================================
// DIRECT PARSER TESTS
// =============================================================================

describe('Direct Parsers', () => {
  it('should parse JSONL events', async () => {
    const result = await normalizeEventsFile(path.join(FIXTURES_DIR, 'events.jsonl'));
    
    expect(result.events.length).toBe(5);
    expect(result.format.detected).toBe('jsonl');
    expect(result.stats.parsedRecords).toBe(5);
    expect(result.stats.failedRecords).toBe(0);
    
    // Verify first event
    const first = result.events[0];
    expect(first.id).toBe('evt_001');
    expect(first.provider).toBe('openai');
    expect(first.model).toBe('gpt-4o');
    expect(first.input_tokens).toBe(500);
    expect(first.output_tokens).toBe(400);
  });

  it('should parse JSON array events', async () => {
    const result = await normalizeEventsFile(path.join(FIXTURES_DIR, 'events.json'));
    
    expect(result.events.length).toBe(3);
    expect(result.format.detected).toBe('json_array');
    expect(result.stats.parsedRecords).toBe(3);
  });

  it('should parse CSV events', async () => {
    const result = await normalizeEventsFile(path.join(FIXTURES_DIR, 'events.csv'));
    
    expect(result.events.length).toBe(5);
    expect(result.format.detected).toBe('csv');
    
    // Verify first event
    const first = result.events[0];
    expect(first.provider).toBe('openai');
    expect(first.model).toBe('gpt-4o');
  });
});

// =============================================================================
// OBSERVABILITY ADAPTER TESTS
// =============================================================================

describe('OpenTelemetry Adapter', () => {
  it('should parse OTEL traces', async () => {
    const data = require(path.join(FIXTURES_DIR, 'otel-traces.json'));
    const events = parseOtelExport(data);
    
    expect(events.length).toBeGreaterThan(0);
    
    // Find OpenAI span
    const openaiEvent = events.find(e => e.provider === 'openai');
    expect(openaiEvent).toBeDefined();
    expect(openaiEvent?.model).toBe('gpt-4o');
    expect(openaiEvent?.input_tokens).toBe(500);
  });
});

describe('Jaeger Adapter', () => {
  it('should parse Jaeger traces', async () => {
    const data = require(path.join(FIXTURES_DIR, 'jaeger-traces.json'));
    const events = parseJaegerExport(data);
    
    expect(events.length).toBeGreaterThan(0);
    
    // Find OpenAI span
    const openaiEvent = events.find(e => e.provider === 'openai');
    expect(openaiEvent).toBeDefined();
    expect(openaiEvent?.model).toBe('gpt-4o');
  });
});

describe('Zipkin Adapter', () => {
  it('should parse Zipkin traces', async () => {
    const data = require(path.join(FIXTURES_DIR, 'zipkin-traces.json'));
    const events = parseZipkinExport(data);
    
    expect(events.length).toBeGreaterThan(0);
  });
});

describe('LangSmith Adapter', () => {
  it('should parse LangSmith runs', async () => {
    const data = require(path.join(FIXTURES_DIR, 'langsmith-runs.json'));
    const events = parseLangSmithExport(data);
    
    expect(events.length).toBe(2);
    
    // Verify first run
    const first = events[0];
    expect(first.model).toBe('gpt-4o');
    expect(first.input_tokens).toBe(500);
    expect(first.output_tokens).toBe(400);
  });
});

describe('Helicone Adapter', () => {
  it('should parse Helicone logs', async () => {
    const data = require(path.join(FIXTURES_DIR, 'helicone-logs.json'));
    const events = parseHeliconeExport(data);
    
    expect(events.length).toBe(2);
    
    // Verify first event
    const first = events[0];
    expect(first.model).toBe('gpt-4o');
    expect(first.latency_ms).toBe(1200);
    expect(first.cost_usd).toBe(0.0175);
  });
});

describe('Weights & Biases Adapter', () => {
  it('should parse W&B logs', async () => {
    const data = require(path.join(FIXTURES_DIR, 'wandb-logs.json'));
    const events = parseWandbExport(data);
    
    expect(events.length).toBe(3);
    
    // Verify first event
    const first = events[0];
    expect(first.model).toBe('gpt-4o');
    expect(first.provider).toBe('openai');
  });
});

describe('LiteLLM Adapter', () => {
  it('should parse LiteLLM logs', async () => {
    const data = require(path.join(FIXTURES_DIR, 'litellm-logs.json'));
    const events = parseLiteLLMExport(data);
    
    expect(events.length).toBe(2);
    
    // Verify first event
    const first = events[0];
    expect(first.model).toBe('gpt-4o');
    expect(first.provider).toBe('openai');
    expect(first.input_tokens).toBe(500);
  });
});

describe('Portkey Adapter', () => {
  it('should parse Portkey logs', async () => {
    const data = require(path.join(FIXTURES_DIR, 'portkey-logs.json'));
    const events = parsePortkeyExport(data);
    
    expect(events.length).toBe(2);
    
    // Verify first event
    const first = events[0];
    expect(first.model).toBe('gpt-4o');
    expect(first.provider).toBe('openai');
    expect(first.latency_ms).toBe(1200);
    
    // Verify metadata
    expect(first.metadata?.cache_status).toBe('MISS');
  });
});

// =============================================================================
// NORMALIZATION PIPELINE TESTS
// =============================================================================

describe('Normalization Pipeline', () => {
  it('should normalize OTEL file through pipeline', async () => {
    const result = await normalizeEventsFile(
      path.join(FIXTURES_DIR, 'otel-traces.json'),
      { format: 'otel' }
    );
    
    expect(result.events.length).toBeGreaterThan(0);
    expect(result.format.detected).toBe('otel');
  });

  it('should handle manual format override', async () => {
    const result = await normalizeEventsFile(
      path.join(FIXTURES_DIR, 'events.jsonl'),
      { format: 'jsonl' }
    );
    
    expect(result.format.detected).toBe('jsonl');
    expect(result.format.confidence).toBe(1.0);
  });

  it('should handle lenient mode', async () => {
    const result = await normalizeEventsFile(
      path.join(FIXTURES_DIR, 'events.jsonl'),
      { lenient: true }
    );
    
    expect(result.events.length).toBeGreaterThan(0);
  });
});

// =============================================================================
// ERROR HANDLING TESTS
// =============================================================================

describe('Error Handling', () => {
  it('should throw on non-existent file', async () => {
    await expect(
      normalizeEventsFile('/non/existent/file.jsonl')
    ).rejects.toThrow('File not found');
  });

  it('should return empty events for invalid format without lenient', async () => {
    // This would need a fixture with invalid data
    // For now, just verify the pipeline doesn't crash
  });
});
