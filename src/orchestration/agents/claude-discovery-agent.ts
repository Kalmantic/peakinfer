/**
 * Claude-Powered Discovery Agent
 * Uses Claude Code SDK for intelligent multi-layer inference cost analysis
 *
 * This agent orchestrates comprehensive discovery across:
 * - Application Layer: Model usage patterns, routing, caching opportunities
 * - Serving Layer: Framework detection, performance metrics, optimization potential
 * - Infrastructure Layer: GPU inventory, cost breakdown, resource utilization
 */

import Anthropic from '@anthropic-ai/sdk';
import { EnvironmentProfile } from '../../types/template.js';
import { ClaudeHelper } from '../../utils/claude-helper.js';
import * as fs from 'fs-extra';
import * as path from 'path';

interface InferenceEvent {
  id: string;
  ts: string;
  intent: string;
  provider: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  latency_ms: number;
  cost_usd: number;
  endpoint: string;
  region: string;
  tenant: string;
  quality_score?: number;
  context_length?: number;
}

interface DiscoveryContext {
  events: InferenceEvent[];
  infrastructure_configs: Record<string, any>;
  codebase_files: string[];
  collectors_available: string[];
}

interface ClaudeAnalysisResult {
  runtimes: string[];
  frameworks: string[];
  infrastructure: string[];
  gpu_detected: boolean;
  estimated_monthly_cost: number;
  key_findings: string[];
  model_usage_patterns: Array<{
    model_name: string;
    usage_frequency: number;
    context_patterns: string[];
    cost_contribution: number;
  }>;
  optimization_opportunities: Array<{
    layer: string;
    opportunity: string;
    estimated_savings: number;
    implementation_effort: string;
  }>;
  cross_layer_synergies: string[];
}

export class ClaudeDiscoveryAgent {
  /**
   * Discover environment using intelligent Claude Code SDK analysis
   * Analyzes both canonical event data and infrastructure configurations
   */
  async discover(): Promise<EnvironmentProfile> {
    console.log('  🔍 Analyzing your infrastructure with Claude...\n');

    try {
      // First, gather all discovery context data
      ClaudeHelper.showThinking('Collecting inference events and infrastructure data...');
      const context = await this.gatherDiscoveryContext();

      // Use Claude Code SDK for intelligent analysis
      ClaudeHelper.showThinking('Running multi-layer optimization analysis with Claude...');
      const claudeAnalysis = await this.analyzeWithClaude(context);

      // Build comprehensive environment profile
      const environment = this.buildEnvironmentProfile(claudeAnalysis, context);

      // Format and display analysis
      const formattedAnalysis = {
        findings: claudeAnalysis.key_findings || [],
        problems: this.identifyProblems(environment),
        solutions: this.suggestSolutions(environment),
        opportunities: claudeAnalysis.optimization_opportunities || []
      };

      ClaudeHelper.formatAnalysis('Multi-Layer Infrastructure Discovery', formattedAnalysis);

      console.log('  ✓ Runtimes:', environment.application.runtime_detected.join(', ') || 'None');
      console.log('  ✓ Frameworks:', environment.serving.frameworks_detected.join(', ') || 'None');
      console.log('  ✓ GPUs:', environment.infrastructure.gpu_inventory.length);
      console.log('  ✓ Monthly Cost:', `$${environment.infrastructure.cost_breakdown.total_monthly.toLocaleString()}`);
      console.log('  ✓ Optimization Potential:', `$${environment.infrastructure.cost_breakdown.optimization_potential.toLocaleString()}/month\n`);

      // Show cross-layer synergies
      if (claudeAnalysis.cross_layer_synergies.length > 0) {
        console.log('  🎯 Cross-Layer Optimization Opportunities:');
        claudeAnalysis.cross_layer_synergies.forEach((synergy, i) => {
          console.log(`     ${i + 1}. ${synergy}`);
        });
        console.log('');
      }

      return environment;

    } catch (error) {
      console.warn('  ⚠️  Discovery analysis encountered an issue, using fallback discovery');
      console.warn('  Error:', error instanceof Error ? error.message : String(error));

      // Fallback to heuristic discovery
      return await this.fallbackDiscovery();
    }
  }

  /**
   * Gather all discovery context from events and infrastructure configs
   */
  private async gatherDiscoveryContext(): Promise<DiscoveryContext> {
    const cwd = process.cwd();
    const context: DiscoveryContext = {
      events: [],
      infrastructure_configs: {},
      codebase_files: [],
      collectors_available: []
    };

    try {
      // Check for events.jsonl (canonical format per PRD)
      const eventsPath = path.join(cwd, 'events.jsonl');
      if (await this.fileExists(eventsPath)) {
        context.events = await this.parseEventsJsonl(eventsPath);
        ClaudeHelper.showThinking(`Loaded ${context.events.length} inference events from events.jsonl`);
      }

      // Check for infrastructure configurations
      const terraformPaths = [
        path.join(cwd, 'terraform'),
        path.join(cwd, 'terraform.tfstate'),
        path.join(cwd, '*.tf')
      ];

      for (const tfPath of terraformPaths) {
        if (await this.fileExists(tfPath)) {
          context.infrastructure_configs.terraform = await this.loadTerraformConfig(tfPath);
          context.collectors_available.push('terraform');
          break;
        }
      }

      // Check for Snowflake collector availability
      if (await this.fileExists(path.join(cwd, 'snowflake.config.json'))) {
        context.collectors_available.push('snowflake');
      }

      // Check for Databricks collector availability
      if (await this.fileExists(path.join(cwd, 'databricks.config.json'))) {
        context.collectors_available.push('databricks');
      }

      // Collect codebase files for analysis
      context.codebase_files = await this.getCodebaseFiles(cwd);

      return context;
    } catch (error) {
      console.warn('  ⚠️  Error gathering discovery context:', error instanceof Error ? error.message : String(error));
      return context;
    }
  }

  /**
   * Parse events.jsonl file and extract inference events
   */
  private async parseEventsJsonl(filePath: string): Promise<InferenceEvent[]> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const events: InferenceEvent[] = [];

      for (const line of content.split('\n')) {
        if (!line.trim()) continue;
        try {
          const event = JSON.parse(line);
          if (this.isValidInferenceEvent(event)) {
            events.push(event);
          }
        } catch {
          // Skip invalid JSON lines
        }
      }

      return events;
    } catch (error) {
      console.warn('  ⚠️  Failed to parse events.jsonl:', error instanceof Error ? error.message : String(error));
      return [];
    }
  }

  /**
   * Validate inference event matches canonical schema
   */
  private isValidInferenceEvent(obj: any): obj is InferenceEvent {
    return (
      typeof obj.id === 'string' &&
      typeof obj.ts === 'string' &&
      typeof obj.intent === 'string' &&
      typeof obj.provider === 'string' &&
      typeof obj.model === 'string' &&
      typeof obj.input_tokens === 'number' &&
      typeof obj.output_tokens === 'number' &&
      typeof obj.latency_ms === 'number' &&
      typeof obj.cost_usd === 'number' &&
      typeof obj.endpoint === 'string' &&
      typeof obj.region === 'string' &&
      typeof obj.tenant === 'string'
    );
  }

  /**
   * Load and parse Terraform configuration
   */
  private async loadTerraformConfig(tfPath: string): Promise<Record<string, any>> {
    try {
      const stats = await fs.stat(tfPath);
      if (stats.isDirectory()) {
        const tfFiles = await fs.readdir(tfPath);
        return { terraform_files: tfFiles };
      } else if (stats.isFile() && tfPath.endsWith('.tfstate')) {
        const config = await fs.readJson(tfPath);
        return { tfstate: config };
      }
      return {};
    } catch {
      return {};
    }
  }

  /**
   * Get list of codebase files for analysis
   */
  private async getCodebaseFiles(cwd: string): Promise<string[]> {
    const files: string[] = [];
    try {
      const entries = await fs.readdir(cwd, { recursive: false });
      for (const entry of entries) {
        const fullPath = path.join(cwd, entry as string);
        const stat = await fs.stat(fullPath);
        if (stat.isFile() && !entry.toString().startsWith('.')) {
          files.push(entry as string);
        }
      }
    } catch {
      // Ignore errors
    }
    return files.slice(0, 20); // Limit to first 20 files for context
  }

  /**
   * Use Claude Code SDK for intelligent analysis
   * This is the core of the discovery agent - leveraging Claude's reasoning
   */
  private async analyzeWithClaude(context: DiscoveryContext): Promise<ClaudeAnalysisResult> {
    try {
      // Prepare context summary for Claude
      const eventsSummary = this.summarizeEvents(context.events);
      const infrastructureSummary = JSON.stringify(context.infrastructure_configs, null, 2);

      const prompt = `You are the Discovery Agent in Peakinfer's multi-agent orchestration system.
Analyze this infrastructure data and generate comprehensive discovery insights.

INFERENCE EVENTS SUMMARY:
${eventsSummary}

INFRASTRUCTURE CONFIGURATIONS:
${infrastructureSummary}

AVAILABLE COLLECTORS: ${context.collectors_available.join(', ') || 'None configured'}

CODEBASE FILES: ${context.codebase_files.join(', ') || 'None found'}

Please provide a detailed analysis in JSON format covering:

1. APPLICATION LAYER:
   - Runtime libraries detected (openai, anthropic, langchain, etc.)
   - Model usage patterns and frequency
   - API call patterns and endpoints
   - Caching and routing opportunities

2. SERVING LAYER:
   - Frameworks detected (vLLM, TensorRT, SGLang, etc.)
   - Model formats and configurations
   - Performance metrics (throughput, latency, GPU utilization)
   - Quantization and batching opportunities

3. INFRASTRUCTURE LAYER:
   - GPU inventory and capacity
   - Memory analysis and utilization
   - Network topology and bandwidth
   - Cost breakdown by component
   - Spot instance and scaling opportunities

4. CROSS-LAYER OPTIMIZATION:
   - Synergies between application and serving optimizations
   - Infrastructure-serving coordination opportunities
   - End-to-end cost reduction strategies

5. ECONOMIC IMPACT:
   - Estimated monthly cost
   - Optimization opportunities with savings
   - Implementation effort assessment

Return ONLY valid JSON matching this structure:
{
  "runtimes": ["runtime1", "runtime2"],
  "frameworks": ["framework1"],
  "infrastructure": ["infra1"],
  "gpu_detected": boolean,
  "estimated_monthly_cost": number,
  "key_findings": ["finding1", "finding2"],
  "model_usage_patterns": [
    {
      "model_name": "gpt-4",
      "usage_frequency": 1000,
      "context_patterns": ["conversational"],
      "cost_contribution": 0.7
    }
  ],
  "optimization_opportunities": [
    {
      "layer": "application|serving|infrastructure",
      "opportunity": "description",
      "estimated_savings": number,
      "implementation_effort": "low|medium|high"
    }
  ],
  "cross_layer_synergies": ["synergy1", "synergy2"]
}`;

      // Initialize Anthropic SDK
      const client = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY
      });

      // Call Claude API
      const message = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      });

      // Extract response text
      let claudeResponse = '';
      for (const block of message.content) {
        if (block.type === 'text') {
          claudeResponse += block.text;
        }
      }

      // Parse Claude's response
      return this.parseClaudeResponse(claudeResponse);

    } catch (error) {
      console.warn('  ⚠️  Claude Code SDK query failed:', error instanceof Error ? error.message : String(error));
      // return this.getDefaultAnalysisResult();
      throw error;
    }
  }

  /**
   * Summarize inference events for Claude context
   */
  private summarizeEvents(events: InferenceEvent[]): string {
    if (events.length === 0) {
      return 'No inference events recorded. Use peakinfer discover to generate baseline data.';
    }

    const models = new Map<string, { count: number; total_cost: number; total_tokens: number }>();
    let totalCost = 0;
    let totalTokens = 0;

    for (const event of events) {
      const key = `${event.provider}:${event.model}`;
      const existing = models.get(key) || { count: 0, total_cost: 0, total_tokens: 0 };
      existing.count++;
      existing.total_cost += event.cost_usd;
      existing.total_tokens += event.input_tokens + event.output_tokens;
      models.set(key, existing);
      totalCost += event.cost_usd;
      totalTokens += event.input_tokens + event.output_tokens;
    }

    const summary: string[] = [
      `Total Events: ${events.length}`,
      `Total Cost: $${totalCost.toFixed(2)}`,
      `Total Tokens: ${totalTokens.toLocaleString()}`,
      `Average Cost per Event: $${(totalCost / events.length).toFixed(4)}`,
      '\nModel Breakdown:',
    ];

    for (const [model, stats] of models) {
      const avgCost = stats.total_cost / stats.count;
      summary.push(`  - ${model}: ${stats.count} calls, $${stats.total_cost.toFixed(2)} total, $${avgCost.toFixed(4)} avg`);
    }

    return summary.join('\n');
  }

  /**
   * Parse Claude's JSON response
   */
  private parseClaudeResponse(response: string): ClaudeAnalysisResult {
    try {
      // Try to extract JSON from markdown code blocks first
      let jsonMatch = response.match(/```(?:json)?\s*\n([\s\S]*?)\n```/);
      if (jsonMatch) {
        const jsonStr = jsonMatch[1].trim();
        return JSON.parse(jsonStr);
      }

      // Try to find JSON object by braces
      const startIdx = response.indexOf('{');
      const lastIdx = response.lastIndexOf('}');

      if (startIdx !== -1 && lastIdx !== -1 && lastIdx > startIdx) {
        const jsonStr = response.substring(startIdx, lastIdx + 1);
        return JSON.parse(jsonStr);
      }

      console.warn('  ⚠️  Could not find valid JSON in Claude response');
      return this.getDefaultAnalysisResult();
    } catch (error) {
      console.warn('  ⚠️  Failed to parse Claude response:', error instanceof Error ? error.message : String(error));
      return this.getDefaultAnalysisResult();
    }
  }

  /**
   * Build comprehensive environment profile from analysis
   */
  private buildEnvironmentProfile(
    claudeAnalysis: ClaudeAnalysisResult,
    context: DiscoveryContext
  ): EnvironmentProfile {
    return {
      application: {
        runtime_detected: claudeAnalysis.runtimes,
        model_usage_patterns: claudeAnalysis.model_usage_patterns,
        api_call_patterns: this.extractApiPatterns(context.events),
        context_analysis: {
          average_length: this.calculateAverageContextLength(context.events),
          distribution: this.calculateContextDistribution(context.events),
          memory_impact: 0.5,
          batching_opportunities: []
        }
      },
      serving: {
        frameworks_detected: claudeAnalysis.frameworks,
        model_formats: [],
        serving_configs: [],
        performance_metrics: {
          throughput: this.calculateThroughput(context.events),
          latency_p95: this.calculateP95Latency(context.events),
          gpu_utilization: 35,
          memory_utilization: 60,
          batch_efficiency: 4
        }
      },
      infrastructure: {
        gpu_inventory: claudeAnalysis.gpu_detected ? [
          {
            model: 'Detected GPU',
            memory_gb: 40,
            bandwidth_gbps: 2000,
            utilization: 35,
            cost_per_hour: 3.0
          }
        ] : [],
        memory_analysis: {
          total_capacity: 24,
          utilization: 60,
          bandwidth_efficiency: 0.15,
          bottlenecks: ['memory_bandwidth', 'sequential_generation']
        },
        network_topology: {
          bandwidth: 1000,
          latency: this.calculateAverageLatency(context.events),
          multi_gpu_setup: false,
          communication_overhead: 0
        },
        cost_breakdown: {
          compute_cost: claudeAnalysis.estimated_monthly_cost * 0.9,
          storage_cost: claudeAnalysis.estimated_monthly_cost * 0.07,
          network_cost: claudeAnalysis.estimated_monthly_cost * 0.03,
          total_monthly: claudeAnalysis.estimated_monthly_cost,
          optimization_potential: this.calculateOptimizationPotential(claudeAnalysis)
        }
      }
    };
  }

  /**
   * Extract API call patterns from events
   */
  private extractApiPatterns(events: InferenceEvent[]): Array<{
    endpoint: string;
    call_volume: number;
    cost_per_call: number;
    optimization_opportunities: string[];
  }> {
    const patterns = new Map<string, { count: number; total_cost: number }>();

    for (const event of events) {
      const key = event.endpoint;
      const existing = patterns.get(key) || { count: 0, total_cost: 0 };
      existing.count++;
      existing.total_cost += event.cost_usd;
      patterns.set(key, existing);
    }

    return Array.from(patterns.entries()).map(([endpoint, data]) => ({
      endpoint,
      call_volume: data.count,
      cost_per_call: data.total_cost / data.count,
      optimization_opportunities: ['model_routing', 'semantic_caching', 'request_batching']
    }));
  }

  /**
   * Calculate average context length from events
   */
  private calculateAverageContextLength(events: InferenceEvent[]): number {
    if (events.length === 0) return 2048;
    const total = events.reduce((sum, e) => sum + (e.context_length || 2048), 0);
    return Math.round(total / events.length);
  }

  /**
   * Calculate context length distribution
   */
  private calculateContextDistribution(events: InferenceEvent[]): number[] {
    if (events.length === 0) return [512, 1024, 2048, 4096];

    const lengths = events.map(e => e.context_length || 2048);
    const percentiles = [10, 25, 50, 75, 90];
    return percentiles.map(p => {
      const sorted = lengths.sort((a, b) => a - b);
      const idx = Math.floor((p / 100) * sorted.length);
      return sorted[idx] || 2048;
    });
  }

  /**
   * Calculate throughput from events
   */
  private calculateThroughput(events: InferenceEvent[]): number {
    if (events.length === 0) return 25;
    const avgLatency = this.calculateAverageLatency(events);
    return Math.round((1000 / avgLatency) * 10); // requests per second * 10
  }

  /**
   * Calculate P95 latency
   */
  private calculateP95Latency(events: InferenceEvent[]): number {
    if (events.length === 0) return 200;
    const sorted = events.map(e => e.latency_ms).sort((a, b) => a - b);
    const p95Index = Math.floor(0.95 * sorted.length);
    return sorted[p95Index] || 200;
  }

  /**
   * Calculate average latency
   */
  private calculateAverageLatency(events: InferenceEvent[]): number {
    if (events.length === 0) return 100;
    const total = events.reduce((sum, e) => sum + e.latency_ms, 0);
    return Math.round(total / events.length);
  }

  /**
   * Calculate optimization potential from opportunities
   */
  private calculateOptimizationPotential(analysis: ClaudeAnalysisResult): number {
    return analysis.optimization_opportunities.reduce((sum, opp) => sum + opp.estimated_savings, 0);
  }

  /**
   * Identify problems in the environment
   */
  private identifyProblems(environment: EnvironmentProfile): string[] {
    const problems: string[] = [];

    if (environment.application.runtime_detected.length === 0) {
      problems.push('No LLM runtime libraries detected - missing optimization opportunities');
    }

    if (environment.serving.frameworks_detected.length === 0) {
      problems.push('No serving frameworks detected - missing 2-3x inference speedup potential');
    }

    if (environment.infrastructure.gpu_inventory.length === 0) {
      problems.push('No GPU acceleration - running on CPU limits optimization potential');
    }

    if (environment.infrastructure.cost_breakdown.total_monthly > 5000) {
      problems.push(`High monthly cost ($${environment.infrastructure.cost_breakdown.total_monthly.toLocaleString()}) - significant optimization potential`);
    }

    if (environment.serving.performance_metrics.gpu_utilization < 50) {
      problems.push(`Low GPU utilization (${environment.serving.performance_metrics.gpu_utilization}%) - inefficient resource usage`);
    }

    return problems;
  }

  /**
   * Suggest solutions for identified problems
   */
  private suggestSolutions(environment: EnvironmentProfile): Array<{
    title: string;
    description: string;
    savings?: number;
    effort?: string;
  }> {
    const solutions: Array<{
      title: string;
      description: string;
      savings?: number;
      effort?: string;
    }> = [];

    if (environment.application.runtime_detected.length === 0) {
      solutions.push({
        title: 'Add LLM Runtime Libraries',
        description: 'Integrate OpenAI, Anthropic, or HuggingFace APIs to enable cost optimization',
        savings: 0,
        effort: '1-2 days'
      });
    }

    if (environment.serving.frameworks_detected.length === 0) {
      solutions.push({
        title: 'Implement Serving Framework',
        description: 'Deploy vLLM or SGLang for 2-3x inference speedup and better batching',
        savings: 1500,
        effort: '3-5 days'
      });
    }

    if (environment.infrastructure.gpu_inventory.length === 0) {
      solutions.push({
        title: 'Add GPU Infrastructure',
        description: 'Deploy NVIDIA A100 or H100 GPUs for 10-50x inference acceleration',
        savings: 0,
        effort: '1-2 weeks'
      });
    } else if (environment.serving.performance_metrics.gpu_utilization < 50) {
      solutions.push({
        title: 'Optimize GPU Utilization',
        description: 'Implement continuous batching and KV cache optimization to increase GPU efficiency',
        savings: 800,
        effort: '2-3 days'
      });
    }

    if (environment.infrastructure.cost_breakdown.total_monthly > 5000) {
      solutions.push({
        title: 'Implement Multi-Layer Optimization',
        description: 'Apply semantic caching, model routing, and serving optimizations for 20-40% cost reduction',
        savings: Math.round(environment.infrastructure.cost_breakdown.total_monthly * 0.3),
        effort: '1-2 weeks'
      });
    }

    return solutions;
  }

  /**
   * Get default analysis result (fallback)
   */
  private getDefaultAnalysisResult(): ClaudeAnalysisResult {
    return {
      runtimes: [],
      frameworks: [],
      infrastructure: [],
      gpu_detected: false,
      estimated_monthly_cost: 2150,
      key_findings: ['Environment discovery in progress'],
      model_usage_patterns: [],
      optimization_opportunities: [],
      cross_layer_synergies: []
    };
  }

  /**
   * Fallback to basic file-based discovery when Claude SDK is unavailable
   */
  private async fallbackDiscovery(): Promise<EnvironmentProfile> {
    console.log('  🔍 Performing basic file-based discovery...');

    const environment: EnvironmentProfile = {
      application: {
        runtime_detected: [],
        model_usage_patterns: [],
        api_call_patterns: [],
        context_analysis: {
          average_length: 2048,
          distribution: [512, 1024, 2048, 4096],
          memory_impact: 0.5,
          batching_opportunities: []
        }
      },
      serving: {
        frameworks_detected: [],
        model_formats: [],
        serving_configs: [],
        performance_metrics: {
          throughput: 25,
          latency_p95: 200,
          gpu_utilization: 35,
          memory_utilization: 60,
          batch_efficiency: 4
        }
      },
      infrastructure: {
        gpu_inventory: [],
        memory_analysis: {
          total_capacity: 24,
          utilization: 60,
          bandwidth_efficiency: 0.15,
          bottlenecks: ['memory_bandwidth', 'sequential_generation']
        },
        network_topology: {
          bandwidth: 1000,
          latency: 1,
          multi_gpu_setup: false,
          communication_overhead: 0
        },
        cost_breakdown: {
          compute_cost: 2000,
          storage_cost: 100,
          network_cost: 50,
          total_monthly: 2150,
          optimization_potential: 1290
        }
      }
    };

    try {
      const cwd = process.cwd();

      // Check for Python
      if (await this.fileExists(path.join(cwd, 'requirements.txt')) ||
          await this.fileExists(path.join(cwd, 'pyproject.toml'))) {
        environment.application.runtime_detected.push('python');

        const reqFile = path.join(cwd, 'requirements.txt');
        if (await this.fileExists(reqFile)) {
          const content = await fs.readFile(reqFile, 'utf-8');
          if (content.includes('openai')) environment.application.runtime_detected.push('openai');
          if (content.includes('anthropic')) environment.application.runtime_detected.push('anthropic');
          if (content.includes('transformers')) environment.serving.frameworks_detected.push('transformers');
          if (content.includes('vllm')) environment.serving.frameworks_detected.push('vllm');
        }
      }

      // Check for Node.js
      if (await this.fileExists(path.join(cwd, 'package.json'))) {
        environment.application.runtime_detected.push('nodejs');

        const packageJson = await fs.readJson(path.join(cwd, 'package.json'));
        const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

        if (deps['openai']) environment.application.runtime_detected.push('openai');
        if (deps['@anthropic-ai/sdk']) environment.application.runtime_detected.push('anthropic');
        if (deps['langchain']) environment.application.runtime_detected.push('langchain');
      }

      // Add default GPU
      environment.infrastructure.gpu_inventory.push({
        model: 'Estimated GPU',
        memory_gb: 24,
        bandwidth_gbps: 1000,
        utilization: 30,
        cost_per_hour: 2.0
      });

    } catch (error) {
      console.warn('  ⚠️  Fallback discovery error:', error instanceof Error ? error.message : String(error));
    }

    return environment;
  }

  /**
   * Check if file exists
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}
