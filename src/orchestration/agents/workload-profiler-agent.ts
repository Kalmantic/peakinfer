/**
 * Workload Profiler Agent
 * Clusters prompts semantically and creates representative samples
 */

import { query, type Query } from '@anthropic-ai/claude-code';
import { EnvironmentProfile } from '../../types/template.js';
import { WorkloadProfile, ClusteredIntent, RepresentativeSample } from '../multi-agent-orchestrator.js';
import * as fs from 'fs-extra';

export class WorkloadProfilerAgent {
  /**
   * Profile workload by clustering prompts and identifying patterns
   */
  async profileWorkload(
    workloadDataPath?: string,
    environment?: EnvironmentProfile
  ): Promise<WorkloadProfile> {
    console.log('  📊 Analyzing workload patterns...\n');

    // Load workload data
    const events = await this.loadWorkloadData(workloadDataPath);

    if (events.length === 0) {
      console.log('  ⚠️  No workload data found, using synthetic profile\n');
      return this.createSyntheticProfile(environment);
    }

    console.log(`  ✓ Loaded ${events.length.toLocaleString()} inference events`);

    // Use Claude to cluster prompts semantically
    const clusteredIntents = await this.clusterPrompts(events);

    console.log(`  ✓ Identified ${clusteredIntents.length} intent clusters`);

    // Generate representative samples
    const representativeSamples = await this.generateRepresentativeSamples(clusteredIntents);

    console.log(`  ✓ Generated ${representativeSamples.length} representative samples`);

    // Calculate cost breakdown
    const costBreakdown = this.calculateCostBreakdown(events, clusteredIntents);

    return {
      total_requests: events.length,
      clustered_intents: clusteredIntents,
      representative_samples: representativeSamples,
      cost_breakdown: costBreakdown
    };
  }

  /**
   * Load workload data from JSONL file
   */
  private async loadWorkloadData(workloadDataPath?: string): Promise<InferenceEvent[]> {
    if (!workloadDataPath) {
      // Look for default workload files
      const defaultPaths = [
        'events.jsonl',
        'workload.jsonl',
        'inference_events.jsonl',
        'data/events.jsonl'
      ];

      for (const defaultPath of defaultPaths) {
        if (await fs.pathExists(defaultPath)) {
          workloadDataPath = defaultPath;
          break;
        }
      }
    }

    if (!workloadDataPath || !(await fs.pathExists(workloadDataPath))) {
      return [];
    }

    try {
      const content = await fs.readFile(workloadDataPath, 'utf-8');
      const lines = content.trim().split('\n');
      const events: InferenceEvent[] = [];

      for (const line of lines) {
        try {
          const event = JSON.parse(line);
          events.push(event);
        } catch {
          // Skip invalid lines
        }
      }

      return events;
    } catch (error) {
      console.warn('  ⚠️  Failed to load workload data:', error instanceof Error ? error.message : String(error));
      return [];
    }
  }

  /**
   * Cluster prompts using Claude's semantic understanding
   */
  private async clusterPrompts(events: InferenceEvent[]): Promise<ClusteredIntent[]> {
    // Sample prompts for clustering (limit to prevent token overflow)
    const sampleSize = Math.min(100, events.length);
    const sampledEvents = this.sampleEvents(events, sampleSize);

    const prompts = sampledEvents
      .map(e => e.prompt || e.intent || '')
      .filter(p => p.length > 0)
      .slice(0, 50); // Max 50 for clustering

    if (prompts.length === 0) {
      // Fallback to intent-based clustering
      return this.clusterByIntent(events);
    }

    const clusteringPrompt = `You are a data scientist analyzing LLM inference workloads.

Given these sample prompts, identify semantic clusters/intent patterns:

${prompts.map((p, i) => `${i + 1}. "${p.substring(0, 100)}..."`).join('\n')}

Provide a JSON response with cluster analysis:
{
  "clusters": [
    {
      "intent_name": "document_summarization",
      "description": "Summarizing long documents",
      "sample_prompts": ["prompt1", "prompt2"],
      "estimated_frequency": 0.3
    }
  ]
}

Return only the JSON, no explanation.`;

    try {
      let claudeResponse = '';

      const claudeQuery: Query = query({
        prompt: clusteringPrompt,
        options: {
          model: 'claude-sonnet-4-5-20250929',
          maxTurns: 3,
        }
      });

      for await (const message of claudeQuery) {
        if (message.type === 'assistant') {
          const content = message.message.content;
          for (const block of content) {
            if (block.type === 'text') {
              claudeResponse += block.text;
            }
          }
        }
      }

      const analysis = this.parseClaudeResponse(claudeResponse);

      if (analysis.clusters && Array.isArray(analysis.clusters)) {
        return analysis.clusters.map((cluster: any) => ({
          intent_name: cluster.intent_name || 'unknown',
          sample_count: Math.round(events.length * (cluster.estimated_frequency || 0.1)),
          avg_tokens: this.calculateAvgTokens(events),
          cost_contribution: cluster.estimated_frequency || 0.1,
          representative_prompts: cluster.sample_prompts || []
        }));
      }

    } catch (error) {
      console.warn('  ⚠️  Claude clustering failed, using fallback');
    }

    // Fallback to intent-based clustering
    return this.clusterByIntent(events);
  }

  /**
   * Fallback: cluster by intent field
   */
  private clusterByIntent(events: InferenceEvent[]): ClusteredIntent[] {
    const intentMap = new Map<string, InferenceEvent[]>();

    for (const event of events) {
      const intent = event.intent || 'unknown';
      if (!intentMap.has(intent)) {
        intentMap.set(intent, []);
      }
      intentMap.get(intent)!.push(event);
    }

    const clusters: ClusteredIntent[] = [];

    for (const [intent, intentEvents] of intentMap.entries()) {
      clusters.push({
        intent_name: intent,
        sample_count: intentEvents.length,
        avg_tokens: this.calculateAvgTokens(intentEvents),
        cost_contribution: intentEvents.length / events.length,
        representative_prompts: intentEvents
          .slice(0, 3)
          .map(e => e.prompt || e.intent || '')
          .filter(p => p.length > 0)
      });
    }

    return clusters.sort((a, b) => b.sample_count - a.sample_count);
  }

  /**
   * Generate representative samples for testing
   */
  private async generateRepresentativeSamples(
    clusters: ClusteredIntent[]
  ): Promise<RepresentativeSample[]> {
    const samples: RepresentativeSample[] = [];

    for (const cluster of clusters) {
      // Take top prompts from each cluster
      const numSamples = Math.min(3, cluster.representative_prompts.length);

      for (let i = 0; i < numSamples; i++) {
        samples.push({
          intent: cluster.intent_name,
          prompt: cluster.representative_prompts[i] || `Sample ${cluster.intent_name} prompt`,
          expected_output_length: cluster.avg_tokens,
          frequency: cluster.sample_count
        });
      }
    }

    return samples;
  }

  /**
   * Calculate cost breakdown by intent
   */
  private calculateCostBreakdown(
    events: InferenceEvent[],
    clusters: ClusteredIntent[]
  ): Record<string, number> {
    const breakdown: Record<string, number> = {};

    for (const cluster of clusters) {
      const clusterCost = cluster.sample_count * cluster.avg_tokens * 0.00001; // Rough estimate
      breakdown[cluster.intent_name] = clusterCost;
    }

    return breakdown;
  }

  /**
   * Create synthetic profile when no workload data available
   */
  private createSyntheticProfile(environment?: EnvironmentProfile): WorkloadProfile {
    const clusters: ClusteredIntent[] = [
      {
        intent_name: 'conversational',
        sample_count: 500,
        avg_tokens: 1500,
        cost_contribution: 0.4,
        representative_prompts: [
          'Help me understand this concept',
          'What is the best approach for this problem?',
          'Can you explain this in simple terms?'
        ]
      },
      {
        intent_name: 'document_analysis',
        sample_count: 300,
        avg_tokens: 3000,
        cost_contribution: 0.35,
        representative_prompts: [
          'Summarize this document',
          'Extract key information from this text',
          'Analyze the sentiment of this document'
        ]
      },
      {
        intent_name: 'code_generation',
        sample_count: 200,
        avg_tokens: 2000,
        cost_contribution: 0.25,
        representative_prompts: [
          'Write a function to do X',
          'Help me debug this code',
          'Optimize this implementation'
        ]
      }
    ];

    const samples: RepresentativeSample[] = clusters.flatMap(cluster =>
      cluster.representative_prompts.map(prompt => ({
        intent: cluster.intent_name,
        prompt,
        expected_output_length: cluster.avg_tokens,
        frequency: cluster.sample_count
      }))
    );

    return {
      total_requests: 1000,
      clustered_intents: clusters,
      representative_samples: samples,
      cost_breakdown: {
        conversational: 300,
        document_analysis: 450,
        code_generation: 250
      }
    };
  }

  /**
   * Sample events uniformly
   */
  private sampleEvents(events: InferenceEvent[], sampleSize: number): InferenceEvent[] {
    if (events.length <= sampleSize) return events;

    const step = Math.floor(events.length / sampleSize);
    const sampled: InferenceEvent[] = [];

    for (let i = 0; i < events.length; i += step) {
      sampled.push(events[i]);
      if (sampled.length >= sampleSize) break;
    }

    return sampled;
  }

  /**
   * Calculate average tokens
   */
  private calculateAvgTokens(events: InferenceEvent[]): number {
    if (events.length === 0) return 1500;

    const totalTokens = events.reduce(
      (sum, e) => sum + (e.input_tokens || 0) + (e.output_tokens || 0),
      0
    );

    return Math.round(totalTokens / events.length);
  }

  /**
   * Parse Claude's JSON response
   */
  private parseClaudeResponse(response: string): any {
    try {
      const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/) ||
                       response.match(/```\n([\s\S]*?)\n```/) ||
                       response.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        const jsonStr = jsonMatch[1] || jsonMatch[0];
        return JSON.parse(jsonStr);
      }

      return JSON.parse(response);
    } catch {
      return { clusters: [] };
    }
  }
}

/**
 * Inference Event Schema
 */
interface InferenceEvent {
  id?: string;
  ts?: string;
  intent?: string;
  prompt?: string;
  provider?: string;
  model?: string;
  input_tokens?: number;
  output_tokens?: number;
  latency_ms?: number;
  cost_usd?: number;
  endpoint?: string;
  region?: string;
  tenant?: string;
}
