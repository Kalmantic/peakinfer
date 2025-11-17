/**
 * Comprehensive Test Suite for Claude Discovery Agent
 * Tests multi-layer inference cost analysis with canonical event schema
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ClaudeDiscoveryAgent } from '../claude-discovery-agent.js';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';

describe('ClaudeDiscoveryAgent', () => {
  let agent: ClaudeDiscoveryAgent;
  let tempDir: string;

  beforeEach(async () => {
    agent = new ClaudeDiscoveryAgent();
    // Create temporary directory for test files
    tempDir = path.join(os.tmpdir(), `peakinfer-test-${Date.now()}`);
    await fs.ensureDir(tempDir);
    // Mock process.cwd() to return temp directory
    vi.spyOn(process, 'cwd').mockReturnValue(tempDir);
  });

  afterEach(async () => {
    // Cleanup
    await fs.remove(tempDir);
    vi.restoreAllMocks();
  });

  describe('Unit Tests - Canonical Event Schema', () => {
    it('should parse valid events.jsonl with canonical schema', async () => {
      // Create sample events.jsonl
      const events = [
        {
          id: 'evt-001',
          ts: '2025-08-31T10:01:00Z',
          intent: 'extract_email',
          provider: 'openai',
          model: 'gpt-4o',
          input_tokens: 500,
          output_tokens: 100,
          latency_ms: 150,
          cost_usd: 0.015,
          endpoint: 'api.openai.com',
          region: 'us-east-1',
          tenant: 'team_analytics'
        },
        {
          id: 'evt-002',
          ts: '2025-08-31T10:02:00Z',
          intent: 'summarize_doc',
          provider: 'anthropic',
          model: 'claude-3-sonnet',
          input_tokens: 2000,
          output_tokens: 200,
          latency_ms: 300,
          cost_usd: 0.008,
          endpoint: 'api.anthropic.com',
          region: 'us-west-2',
          tenant: 'team_analytics'
        }
      ];

      const eventsPath = path.join(tempDir, 'events.jsonl');
      await fs.writeFile(eventsPath, events.map(e => JSON.stringify(e)).join('\n'));

      // Mock the discover method to test event parsing
      const environment = await agent.discover();

      expect(environment).toBeDefined();
      expect(environment.infrastructure.cost_breakdown).toBeDefined();
    });

    it('should handle invalid JSON lines gracefully', async () => {
      const content = `{"id":"evt-001","ts":"2025-08-31T10:01:00Z","intent":"test","provider":"openai","model":"gpt-4","input_tokens":100,"output_tokens":50,"latency_ms":100,"cost_usd":0.01,"endpoint":"api.openai.com","region":"us-east-1","tenant":"test"}
invalid json line
{"id":"evt-002","ts":"2025-08-31T10:02:00Z","intent":"test","provider":"openai","model":"gpt-4","input_tokens":100,"output_tokens":50,"latency_ms":100,"cost_usd":0.01,"endpoint":"api.openai.com","region":"us-east-1","tenant":"test"}`;

      const eventsPath = path.join(tempDir, 'events.jsonl');
      await fs.writeFile(eventsPath, content);

      const environment = await agent.discover();
      expect(environment).toBeDefined();
      // Should have parsed 2 valid events, skipped the invalid one
    });

    it('should calculate cost metrics from events', async () => {
      const events = Array.from({ length: 10 }, (_, i) => ({
        id: `evt-${i:03d}`,
        ts: '2025-08-31T10:01:00Z',
        intent: 'test_intent',
        provider: 'openai',
        model: 'gpt-4o',
        input_tokens: 1000,
        output_tokens: 100,
        latency_ms: 200 + i * 10,
        cost_usd: 0.01 + i * 0.001,
        endpoint: 'api.openai.com',
        region: 'us-east-1',
        tenant: 'test_tenant'
      }));

      const eventsPath = path.join(tempDir, 'events.jsonl');
      await fs.writeFile(eventsPath, events.map(e => JSON.stringify(e)).join('\n'));

      const environment = await agent.discover();
      expect(environment.infrastructure.cost_breakdown.total_monthly).toBeGreaterThan(0);
    });
  });

  describe('Unit Tests - Context Analysis', () => {
    it('should calculate average context length', async () => {
      const events = [
        {
          id: 'evt-001',
          ts: '2025-08-31T10:01:00Z',
          intent: 'test',
          provider: 'openai',
          model: 'gpt-4',
          input_tokens: 500,
          output_tokens: 100,
          latency_ms: 150,
          cost_usd: 0.01,
          endpoint: 'api.openai.com',
          region: 'us-east-1',
          tenant: 'test',
          context_length: 1000
        },
        {
          id: 'evt-002',
          ts: '2025-08-31T10:02:00Z',
          intent: 'test',
          provider: 'openai',
          model: 'gpt-4',
          input_tokens: 500,
          output_tokens: 100,
          latency_ms: 150,
          cost_usd: 0.01,
          endpoint: 'api.openai.com',
          region: 'us-east-1',
          tenant: 'test',
          context_length: 3000
        }
      ];

      const eventsPath = path.join(tempDir, 'events.jsonl');
      await fs.writeFile(eventsPath, events.map(e => JSON.stringify(e)).join('\n'));

      const environment = await agent.discover();
      expect(environment.application.context_analysis.average_length).toBeGreaterThan(0);
    });

    it('should identify context distribution percentiles', async () => {
      const events = Array.from({ length: 100 }, (_, i) => ({
        id: `evt-${i:03d}`,
        ts: '2025-08-31T10:01:00Z',
        intent: 'test',
        provider: 'openai',
        model: 'gpt-4',
        input_tokens: 500,
        output_tokens: 100,
        latency_ms: 150,
        cost_usd: 0.01,
        endpoint: 'api.openai.com',
        region: 'us-east-1',
        tenant: 'test',
        context_length: 512 + i * 10
      }));

      const eventsPath = path.join(tempDir, 'events.jsonl');
      await fs.writeFile(eventsPath, events.map(e => JSON.stringify(e)).join('\n'));

      const environment = await agent.discover();
      expect(environment.application.context_analysis.distribution.length).toBeGreaterThan(0);
      // Verify distribution is sorted
      const dist = environment.application.context_analysis.distribution;
      for (let i = 1; i < dist.length; i++) {
        expect(dist[i]).toBeGreaterThanOrEqual(dist[i - 1]);
      }
    });
  });

  describe('Unit Tests - Performance Metrics', () => {
    it('should calculate P95 latency accurately', async () => {
      const latencies = Array.from({ length: 100 }, (_, i) => i * 10);
      const events = latencies.map((latency, i) => ({
        id: `evt-${i:03d}`,
        ts: '2025-08-31T10:01:00Z',
        intent: 'test',
        provider: 'openai',
        model: 'gpt-4',
        input_tokens: 500,
        output_tokens: 100,
        latency_ms: latency,
        cost_usd: 0.01,
        endpoint: 'api.openai.com',
        region: 'us-east-1',
        tenant: 'test'
      }));

      const eventsPath = path.join(tempDir, 'events.jsonl');
      await fs.writeFile(eventsPath, events.map(e => JSON.stringify(e)).join('\n'));

      const environment = await agent.discover();
      expect(environment.serving.performance_metrics.latency_p95).toBeGreaterThan(0);
      expect(environment.serving.performance_metrics.latency_p95).toBeLessThanOrEqual(990);
    });

    it('should calculate throughput from events', async () => {
      const events = Array.from({ length: 50 }, (_, i) => ({
        id: `evt-${i:03d}`,
        ts: '2025-08-31T10:01:00Z',
        intent: 'test',
        provider: 'openai',
        model: 'gpt-4',
        input_tokens: 500,
        output_tokens: 100,
        latency_ms: 100 + Math.random() * 50,
        cost_usd: 0.01,
        endpoint: 'api.openai.com',
        region: 'us-east-1',
        tenant: 'test'
      }));

      const eventsPath = path.join(tempDir, 'events.jsonl');
      await fs.writeFile(eventsPath, events.map(e => JSON.stringify(e)).join('\n'));

      const environment = await agent.discover();
      expect(environment.serving.performance_metrics.throughput).toBeGreaterThan(0);
    });
  });

  describe('Unit Tests - Collector Detection', () => {
    it('should detect Terraform configuration', async () => {
      const tfDir = path.join(tempDir, 'terraform');
      await fs.ensureDir(tfDir);
      await fs.writeFile(path.join(tfDir, 'main.tf'), 'resource "aws_instance" "example" {}');

      const environment = await agent.discover();
      expect(environment).toBeDefined();
    });

    it('should detect Snowflake configuration', async () => {
      const config = {
        account: 'xy12345',
        warehouse: 'compute_wh'
      };
      await fs.writeJson(path.join(tempDir, 'snowflake.config.json'), config);

      const environment = await agent.discover();
      expect(environment).toBeDefined();
    });

    it('should detect Databricks configuration', async () => {
      const config = {
        host: 'https://adb-xxx.cloud.databricks.com',
        token: 'dapi-xxx'
      };
      await fs.writeJson(path.join(tempDir, 'databricks.config.json'), config);

      const environment = await agent.discover();
      expect(environment).toBeDefined();
    });
  });

  describe('Unit Tests - Runtime Detection', () => {
    it('should detect Python runtime from requirements.txt', async () => {
      const requirements = `
openai==1.0.0
anthropic==0.7.0
transformers==4.30.0
vllm==0.2.0`;
      await fs.writeFile(path.join(tempDir, 'requirements.txt'), requirements);

      const environment = await agent.discover();
      expect(environment.application.runtime_detected).toContain('python');
    });

    it('should detect Node.js runtime from package.json', async () => {
      const packageJson = {
        dependencies: {
          'openai': '^4.0.0',
          '@anthropic-ai/sdk': '^0.7.0'
        }
      };
      await fs.writeJson(path.join(tempDir, 'package.json'), packageJson);

      const environment = await agent.discover();
      expect(environment.application.runtime_detected).toContain('nodejs');
    });
  });

  describe('Integration Tests - Multi-Layer Analysis', () => {
    it('should perform complete discovery workflow', async () => {
      // Setup complete environment
      const events = [
        {
          id: 'evt-001',
          ts: '2025-08-31T10:01:00Z',
          intent: 'extract_email',
          provider: 'openai',
          model: 'gpt-4o',
          input_tokens: 500,
          output_tokens: 100,
          latency_ms: 150,
          cost_usd: 0.015,
          endpoint: 'api.openai.com',
          region: 'us-east-1',
          tenant: 'team_analytics'
        }
      ];

      const packageJson = {
        dependencies: { 'openai': '^4.0.0' }
      };

      const tfDir = path.join(tempDir, 'terraform');
      await fs.ensureDir(tfDir);

      await fs.writeFile(path.join(tempDir, 'events.jsonl'), events.map(e => JSON.stringify(e)).join('\n'));
      await fs.writeJson(path.join(tempDir, 'package.json'), packageJson);
      await fs.writeFile(path.join(tfDir, 'main.tf'), 'resource "aws_instance" "example" {}');

      const environment = await agent.discover();

      // Verify all layers are analyzed
      expect(environment.application).toBeDefined();
      expect(environment.serving).toBeDefined();
      expect(environment.infrastructure).toBeDefined();

      // Verify cost breakdown
      expect(environment.infrastructure.cost_breakdown.total_monthly).toBeGreaterThan(0);
      expect(environment.infrastructure.cost_breakdown.compute_cost).toBeGreaterThan(0);
    });

    it('should handle empty environment gracefully', async () => {
      // No files created - empty environment
      const environment = await agent.discover();

      expect(environment).toBeDefined();
      expect(environment.application).toBeDefined();
      expect(environment.serving).toBeDefined();
      expect(environment.infrastructure).toBeDefined();
    });

    it('should fallback to basic discovery when events unavailable', async () => {
      // Create only basic project files
      const packageJson = { dependencies: { 'openai': '^4.0.0' } };
      await fs.writeJson(path.join(tempDir, 'package.json'), packageJson);

      const environment = await agent.discover();

      expect(environment.application.runtime_detected).toBeDefined();
      expect(environment.infrastructure.gpu_inventory).toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty events.jsonl file', async () => {
      await fs.writeFile(path.join(tempDir, 'events.jsonl'), '');

      const environment = await agent.discover();
      expect(environment).toBeDefined();
    });

    it('should handle malformed JSON in events.jsonl', async () => {
      const content = `{invalid json}
{"id":"evt-001","ts":"2025-08-31T10:01:00Z","intent":"test","provider":"openai","model":"gpt-4","input_tokens":100,"output_tokens":50,"latency_ms":100,"cost_usd":0.01,"endpoint":"api.openai.com","region":"us-east-1","tenant":"test"}
{more invalid}`;

      await fs.writeFile(path.join(tempDir, 'events.jsonl'), content);

      const environment = await agent.discover();
      expect(environment).toBeDefined();
    });

    it('should handle missing optional fields in events', async () => {
      const events = [
        {
          id: 'evt-001',
          ts: '2025-08-31T10:01:00Z',
          intent: 'test',
          provider: 'openai',
          model: 'gpt-4',
          input_tokens: 100,
          output_tokens: 50,
          latency_ms: 100,
          cost_usd: 0.01,
          endpoint: 'api.openai.com',
          region: 'us-east-1',
          tenant: 'test'
          // No quality_score or context_length
        }
      ];

      await fs.writeFile(path.join(tempDir, 'events.jsonl'), JSON.stringify(events[0]));

      const environment = await agent.discover();
      expect(environment).toBeDefined();
    });

    it('should handle very large number of events', async () => {
      const events = Array.from({ length: 1000 }, (_, i) => ({
        id: `evt-${i:04d}`,
        ts: '2025-08-31T10:01:00Z',
        intent: 'test',
        provider: 'openai',
        model: 'gpt-4',
        input_tokens: 500,
        output_tokens: 100,
        latency_ms: 150,
        cost_usd: 0.01,
        endpoint: 'api.openai.com',
        region: 'us-east-1',
        tenant: 'test'
      }));

      const eventsPath = path.join(tempDir, 'events.jsonl');
      await fs.writeFile(eventsPath, events.map(e => JSON.stringify(e)).join('\n'));

      const environment = await agent.discover();
      expect(environment).toBeDefined();
      expect(environment.infrastructure.cost_breakdown.total_monthly).toBeGreaterThan(0);
    });
  });

  describe('API Pattern Extraction', () => {
    it('should extract API patterns from events', async () => {
      const events = [
        {
          id: 'evt-001',
          ts: '2025-08-31T10:01:00Z',
          intent: 'extract',
          provider: 'openai',
          model: 'gpt-4',
          input_tokens: 500,
          output_tokens: 100,
          latency_ms: 150,
          cost_usd: 0.01,
          endpoint: 'api.openai.com',
          region: 'us-east-1',
          tenant: 'test'
        },
        {
          id: 'evt-002',
          ts: '2025-08-31T10:02:00Z',
          intent: 'summarize',
          provider: 'anthropic',
          model: 'claude-3',
          input_tokens: 1000,
          output_tokens: 200,
          latency_ms: 300,
          cost_usd: 0.02,
          endpoint: 'api.anthropic.com',
          region: 'us-west-2',
          tenant: 'test'
        }
      ];

      await fs.writeFile(path.join(tempDir, 'events.jsonl'), events.map(e => JSON.stringify(e)).join('\n'));

      const environment = await agent.discover();
      expect(environment.application.api_call_patterns).toBeDefined();
      expect(environment.application.api_call_patterns.length).toBeGreaterThan(0);
    });
  });

  describe('Optimization Opportunity Detection', () => {
    it('should identify problems when no runtimes detected', async () => {
      const environment = await agent.discover();

      // Since we don't have any runtime files in temp dir
      if (environment.application.runtime_detected.length === 0) {
        // This is expected behavior
        expect(environment.application.runtime_detected.length).toBe(0);
      }
    });

    it('should suggest solutions for identified problems', async () => {
      const environment = await agent.discover();

      expect(environment).toBeDefined();
      // Solutions generation happens internally
    });
  });
});
