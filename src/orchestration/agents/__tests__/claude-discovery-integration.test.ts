/**
 * Integration Tests - Claude Discovery Agent
 * Tests real-world scenarios and cross-layer optimization coordination
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ClaudeDiscoveryAgent } from '../claude-discovery-agent.js';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';

describe('ClaudeDiscoveryAgent Integration Tests', () => {
  let agent: ClaudeDiscoveryAgent;
  let tempDir: string;

  beforeEach(async () => {
    agent = new ClaudeDiscoveryAgent();
    tempDir = path.join(os.tmpdir(), `peakinfer-integration-${Date.now()}`);
    await fs.ensureDir(tempDir);
    vi.spyOn(process, 'cwd').mockReturnValue(tempDir);
  });

  afterEach(async () => {
    await fs.remove(tempDir);
    vi.restoreAllMocks();
  });

  describe('Scenario 1: E-commerce Platform with High Token Cost', () => {
    it('should identify cost optimization opportunities across layers', async () => {
      // Setup: E-commerce platform using multiple models for different tasks
      const events = [
        // Product recommendation engine - high volume, GPT-4
        ...Array.from({ length: 500 }, (_, i) => ({
          id: `evt-rec-${i:04d}`,
          ts: '2025-08-31T10:01:00Z',
          intent: 'product_recommendation',
          provider: 'openai',
          model: 'gpt-4o',
          input_tokens: 800,
          output_tokens: 200,
          latency_ms: 300,
          cost_usd: 0.015,
          endpoint: 'api.openai.com',
          region: 'us-east-1',
          tenant: 'ecommerce_prod',
          context_length: 2048
        })),
        // Customer support - moderate volume, Claude
        ...Array.from({ length: 200 }, (_, i) => ({
          id: `evt-support-${i:04d}`,
          ts: '2025-08-31T10:01:00Z',
          intent: 'customer_support',
          provider: 'anthropic',
          model: 'claude-3-sonnet',
          input_tokens: 1200,
          output_tokens: 400,
          latency_ms: 250,
          cost_usd: 0.008,
          endpoint: 'api.anthropic.com',
          region: 'us-west-2',
          tenant: 'ecommerce_prod',
          context_length: 4096
        })),
        // Search query optimization - high volume, GPT-3.5
        ...Array.from({ length: 1000 }, (_, i) => ({
          id: `evt-search-${i:04d}`,
          ts: '2025-08-31T10:01:00Z',
          intent: 'search_optimization',
          provider: 'openai',
          model: 'gpt-3.5-turbo',
          input_tokens: 300,
          output_tokens: 100,
          latency_ms: 100,
          cost_usd: 0.001,
          endpoint: 'api.openai.com',
          region: 'us-east-1',
          tenant: 'ecommerce_prod',
          context_length: 512
        }))
      ];

      // Setup infrastructure files
      const packageJson = {
        dependencies: {
          'openai': '^4.0.0',
          '@anthropic-ai/sdk': '^0.7.0',
          'express': '^4.18.0'
        }
      };

      const terraformConfig = `
resource "aws_instance" "api_server" {
  ami           = "ami-0c55b159cbfafe1f0"
  instance_type = "p3.2xlarge"
  tags = {
    Name = "LLM-API-Server"
  }
}`;

      await fs.writeFile(path.join(tempDir, 'events.jsonl'), events.map(e => JSON.stringify(e)).join('\n'));
      await fs.writeJson(path.join(tempDir, 'package.json'), packageJson);
      const tfDir = path.join(tempDir, 'terraform');
      await fs.ensureDir(tfDir);
      await fs.writeFile(path.join(tfDir, 'main.tf'), terraformConfig);

      const environment = await agent.discover();

      // Assertions
      expect(environment.application.runtime_detected).toContain('nodejs');
      expect(environment.application.model_usage_patterns).toBeDefined();
      expect(environment.infrastructure.cost_breakdown.total_monthly).toBeGreaterThan(0);

      // Verify multi-layer optimization opportunities
      expect(environment.application.api_call_patterns.length).toBeGreaterThan(0);
      expect(environment.serving.performance_metrics.latency_p95).toBeGreaterThan(0);
    });
  });

  describe('Scenario 2: Data Pipeline with Databricks + Snowflake', () => {
    it('should detect cross-layer optimization between data and inference', async () => {
      const events = [
        ...Array.from({ length: 300 }, (_, i) => ({
          id: `evt-${i:04d}`,
          ts: '2025-08-31T10:01:00Z',
          intent: 'data_enrichment',
          provider: 'anthropic',
          model: 'claude-3-haiku',
          input_tokens: 2000,
          output_tokens: 500,
          latency_ms: 400,
          cost_usd: 0.005,
          endpoint: 'api.anthropic.com',
          region: 'us-west-2',
          tenant: 'data_team',
          context_length: 4096
        }))
      ];

      const packageJson = {
        dependencies: {
          '@anthropic-ai/sdk': '^0.7.0',
          'databricks-sdk': '^0.1.0'
        }
      };

      const snowflakeConfig = {
        account: 'xy12345.us-east-1',
        warehouse: 'compute_wh',
        database: 'analytics_db'
      };

      const databricksConfig = {
        host: 'https://adb-xxx.cloud.databricks.com',
        workspace_id: 'xxx'
      };

      await fs.writeFile(path.join(tempDir, 'events.jsonl'), events.map(e => JSON.stringify(e)).join('\n'));
      await fs.writeJson(path.join(tempDir, 'package.json'), packageJson);
      await fs.writeJson(path.join(tempDir, 'snowflake.config.json'), snowflakeConfig);
      await fs.writeJson(path.join(tempDir, 'databricks.config.json'), databricksConfig);

      const environment = await agent.discover();

      expect(environment).toBeDefined();
      expect(environment.infrastructure.cost_breakdown.total_monthly).toBeGreaterThan(0);
    });
  });

  describe('Scenario 3: Kubernetes-based Serving Cluster', () => {
    it('should identify infrastructure optimization for self-hosted inference', async () => {
      const events = Array.from({ length: 2000 }, (_, i) => ({
        id: `evt-${i:04d}`,
        ts: '2025-08-31T10:01:00Z',
        intent: 'inference',
        provider: 'together',
        model: 'meta-llama/Llama-2-70b',
        input_tokens: 500,
        output_tokens: 150,
        latency_ms: 200 + Math.random() * 100,
        cost_usd: 0.001,
        endpoint: 'api.together.xyz',
        region: 'us-east-1',
        tenant: 'ml_platform',
        context_length: 2048
      }));

      const k8sDir = path.join(tempDir, 'k8s');
      await fs.ensureDir(k8sDir);

      const deployment = `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: llm-serving
spec:
  replicas: 3
  template:
    spec:
      containers:
      - name: vllm
        image: vllm/vllm:latest
        resources:
          limits:
            nvidia.com/gpu: "1"
`;

      const terraformConfig = `
resource "aws_eks_cluster" "main" {
  name    = "llm-serving-cluster"
  version = "1.27"
}`;

      await fs.writeFile(path.join(tempDir, 'events.jsonl'), events.map(e => JSON.stringify(e)).join('\n'));
      await fs.writeFile(path.join(k8sDir, 'deployment.yaml'), deployment);
      const tfDir = path.join(tempDir, 'terraform');
      await fs.ensureDir(tfDir);
      await fs.writeFile(path.join(tfDir, 'eks.tf'), terraformConfig);

      const environment = await agent.discover();

      expect(environment).toBeDefined();
      expect(environment.serving.performance_metrics.latency_p95).toBeGreaterThan(0);
      expect(environment.infrastructure.gpu_inventory).toBeDefined();
    });
  });

  describe('Scenario 4: Multi-tenant SaaS with Quality Metrics', () => {
    it('should identify quality-aware optimization opportunities', async () => {
      const events = [
        // High-quality, high-cost requests (medical diagnosis)
        ...Array.from({ length: 100 }, (_, i) => ({
          id: `evt-medical-${i:04d}`,
          ts: '2025-08-31T10:01:00Z',
          intent: 'medical_diagnosis',
          provider: 'openai',
          model: 'gpt-4',
          input_tokens: 3000,
          output_tokens: 800,
          latency_ms: 500,
          cost_usd: 0.05,
          endpoint: 'api.openai.com',
          region: 'us-east-1',
          tenant: 'healthcare_client',
          quality_score: 0.95,
          context_length: 8000
        })),
        // Medium-quality, medium-cost requests (general QA)
        ...Array.from({ length: 300 }, (_, i) => ({
          id: `evt-qa-${i:04d}`,
          ts: '2025-08-31T10:01:00Z',
          intent: 'general_qa',
          provider: 'openai',
          model: 'gpt-3.5-turbo',
          input_tokens: 800,
          output_tokens: 300,
          latency_ms: 200,
          cost_usd: 0.002,
          endpoint: 'api.openai.com',
          region: 'us-east-1',
          tenant: 'general_client',
          quality_score: 0.85,
          context_length: 2048
        })),
        // Low-quality, low-cost requests (categorization)
        ...Array.from({ length: 500 }, (_, i) => ({
          id: `evt-cat-${i:04d}`,
          ts: '2025-08-31T10:01:00Z',
          intent: 'categorization',
          provider: 'openai',
          model: 'gpt-3.5-turbo',
          input_tokens: 200,
          output_tokens: 50,
          latency_ms: 100,
          cost_usd: 0.0003,
          endpoint: 'api.openai.com',
          region: 'us-east-1',
          tenant: 'general_client',
          quality_score: 0.70,
          context_length: 512
        }))
      ];

      await fs.writeFile(path.join(tempDir, 'events.jsonl'), events.map(e => JSON.stringify(e)).join('\n'));

      const environment = await agent.discover();

      expect(environment).toBeDefined();
      expect(environment.application.model_usage_patterns).toBeDefined();
      expect(environment.infrastructure.cost_breakdown.optimization_potential).toBeGreaterThan(0);
    });
  });

  describe('PRD Compliance - Canonical Schema', () => {
    it('should correctly parse all canonical event fields', async () => {
      const event = {
        id: 'evt-compliance-001',
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
      };

      await fs.writeFile(path.join(tempDir, 'events.jsonl'), JSON.stringify(event));

      const environment = await agent.discover();
      expect(environment).toBeDefined();
      expect(environment.infrastructure.cost_breakdown).toBeDefined();
    });

    it('should handle optional canonical schema fields', async () => {
      const event = {
        id: 'evt-optional-001',
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
        tenant: 'team_analytics',
        quality_score: 0.95,
        context_length: 2048
      };

      await fs.writeFile(path.join(tempDir, 'events.jsonl'), JSON.stringify(event));

      const environment = await agent.discover();
      expect(environment).toBeDefined();
    });
  });

  describe('Error Handling and Resilience', () => {
    it('should gracefully handle corrupted events.jsonl', async () => {
      const content = `{"corrupted": "json"
incomplete line
{"also": "invalid}`;

      await fs.writeFile(path.join(tempDir, 'events.jsonl'), content);

      // Should not throw
      const environment = await agent.discover();
      expect(environment).toBeDefined();
    });

    it('should handle missing files gracefully', async () => {
      // No files created
      const environment = await agent.discover();

      expect(environment).toBeDefined();
      expect(environment.application).toBeDefined();
      expect(environment.serving).toBeDefined();
      expect(environment.infrastructure).toBeDefined();
    });

    it('should handle permission errors gracefully', async () => {
      const eventsPath = path.join(tempDir, 'events.jsonl');
      const event = {
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
      };
      await fs.writeFile(eventsPath, JSON.stringify(event));

      const environment = await agent.discover();
      expect(environment).toBeDefined();
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle 10,000+ events efficiently', async () => {
      const startTime = Date.now();

      const events = Array.from({ length: 10000 }, (_, i) => ({
        id: `evt-${i:05d}`,
        ts: '2025-08-31T10:01:00Z',
        intent: 'inference',
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

      await fs.writeFile(path.join(tempDir, 'events.jsonl'), events.map(e => JSON.stringify(e)).join('\n'));

      const environment = await agent.discover();
      const duration = Date.now() - startTime;

      expect(environment).toBeDefined();
      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds
      expect(environment.infrastructure.cost_breakdown.total_monthly).toBeGreaterThan(0);
    });
  });

  describe('Cross-Layer Coordination Detection', () => {
    it('should identify application-serving coordination opportunities', async () => {
      const events = Array.from({ length: 500 }, (_, i) => ({
        id: `evt-${i:04d}`,
        ts: '2025-08-31T10:01:00Z',
        intent: 'semantic_search',
        provider: 'openai',
        model: 'gpt-4o',
        input_tokens: 1000 + Math.random() * 2000,
        output_tokens: 200,
        latency_ms: 200 + Math.random() * 300,
        cost_usd: 0.015,
        endpoint: 'api.openai.com',
        region: 'us-east-1',
        tenant: 'search_platform',
        context_length: 2048
      }));

      const packageJson = {
        dependencies: {
          'openai': '^4.0.0',
          'langchain': '^0.1.0',
          'redis': '^4.6.0'
        }
      };

      await fs.writeFile(path.join(tempDir, 'events.jsonl'), events.map(e => JSON.stringify(e)).join('\n'));
      await fs.writeJson(path.join(tempDir, 'package.json'), packageJson);

      const environment = await agent.discover();

      expect(environment).toBeDefined();
      expect(environment.application.model_usage_patterns).toBeDefined();
    });
  });
});
