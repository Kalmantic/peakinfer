/**
 * Specialized Agents for PeakInfer
 *
 * From DESIGN.md v2.0 Section 2.1:
 * - DiscoveryAgent: Scan and discover inference points
 * - AnalyzerAgent: Semantic classification with tool-limited analysis
 * - JoinerAgent: Correlate static + runtime truth
 * - InsightAgent: Generate findings from templates
 *
 * From Autonomous Agent Architecture Patterns v0.1:
 * - Two-pass execution (description → tool resolution → execute)
 * - Filesystem-based context with pointers
 * - Callback-driven architecture
 */

import { z } from 'zod';
import { createConstrainedRegistry, type ToolRegistry } from '../tools/index.js';
import { scan } from '../scanner.js';
import { analyze as analyzeCallsites } from '../analyzer.js';
import { join as joinData } from '../joiner.js';
import { evaluate } from '../insights.js';
import { ENVELOPES } from '../envelopes.js';
import type { ScanResult, Callsite, InferenceEvent, JoinedOutput, Insight, InsightTemplate } from '../types.js';

// =============================================================================
// AGENT INTERFACE (from Patterns v0.1 Section 4)
// =============================================================================

export interface AgentInput {
  description: string;
  context?: Record<string, unknown>;
}

export interface AgentOutput<T> {
  result: T;
  toolsUsed: string[];
  contextPointer?: string;
}

export interface BaseAgent<TInput, TOutput> {
  name: string;
  description: string;
  tools: ToolRegistry;
  execute: (input: TInput) => Promise<AgentOutput<TOutput>>;
}

// =============================================================================
// CONTEXT POINTER (from Patterns v0.1 Section 3.4)
// =============================================================================

export interface ContextPointer {
  id: string;
  filepath: string;
  agentName: string;
  description: string;
  sizeBytes: number;
  createdAt: string;
}

// =============================================================================
// DISCOVERY AGENT - Scan and discover inference points
// =============================================================================

export interface DiscoveryInput {
  root: string;
}

export interface DiscoveryOutput {
  scanResult: ScanResult;
  candidateFiles: string[];
}

export const DiscoveryAgent: BaseAgent<DiscoveryInput, DiscoveryOutput> = {
  name: 'discovery',
  description: 'Scan repository and discover potential inference points',
  tools: createConstrainedRegistry(),

  async execute(input: DiscoveryInput): Promise<AgentOutput<DiscoveryOutput>> {
    const toolsUsed: string[] = [];

    // Use constrained tools: Glob to find files
    const globResult = await this.tools.execute('glob', {
      pattern: '**/*.{ts,js,py,go,java}',
      cwd: input.root,
      ignore: ['**/node_modules/**', '**/dist/**', '**/.git/**', '**/__pycache__/**'],
    }) as { files: string[]; count: number };
    toolsUsed.push('glob');

    // Wrap existing scanner for full analysis
    const scanResult = await scan(input.root);

    // Identify candidate files likely containing inference
    const inferencePatterns = /openai|anthropic|llm|chat|completion|embedding|claude|gpt/i;
    const candidateFiles = globResult.files.filter(f => inferencePatterns.test(f));

    return {
      result: { scanResult, candidateFiles },
      toolsUsed,
    };
  },
};

// =============================================================================
// ANALYZER AGENT - Semantic classification
// =============================================================================

export interface AnalyzerInput {
  scanResult: ScanResult;
  onProgress?: (data: { percent: number; currentFile?: string }) => void;
}

export interface AnalyzerOutput {
  callsites: Callsite[];
  llmInsights: unknown[];
}

export const AnalyzerAgent: BaseAgent<AnalyzerInput, AnalyzerOutput> = {
  name: 'analyzer',
  description: 'Analyze code and classify inference patterns',
  tools: createConstrainedRegistry(),

  async execute(input: AnalyzerInput): Promise<AgentOutput<AnalyzerOutput>> {
    const toolsUsed: string[] = ['read']; // Uses read internally

    // Wrap existing analyzer (already uses LLM)
    // Pass through onProgress callback for visual progress bar during analysis
    const result = await analyzeCallsites(input.scanResult, {
      onProgress: input.onProgress,
    });

    return {
      result: {
        callsites: result.callsites,
        llmInsights: result.insights,
      },
      toolsUsed,
    };
  },
};

// =============================================================================
// JOINER AGENT - Correlate static + runtime
// =============================================================================

export interface JoinerInput {
  callsites: Callsite[];
  events: InferenceEvent[];
}

export interface JoinerOutput {
  joined: JoinedOutput;
}

export const JoinerAgent: BaseAgent<JoinerInput, JoinerOutput> = {
  name: 'joiner',
  description: 'Correlate static callsites with runtime events',
  tools: createConstrainedRegistry(),

  async execute(input: JoinerInput): Promise<AgentOutput<JoinerOutput>> {
    // Wrap existing joiner
    const joined = joinData(input.callsites, input.events);

    return {
      result: { joined },
      toolsUsed: [],
    };
  },
};

// =============================================================================
// INSIGHT AGENT - Generate findings from templates
// =============================================================================

export interface InsightInput {
  data: JoinedOutput | { callsites: Callsite[] };
  templates: InsightTemplate[];
}

export interface InsightOutput {
  insights: Insight[];
}

export const InsightAgent: BaseAgent<InsightInput, InsightOutput> = {
  name: 'insight',
  description: 'Evaluate templates and generate performance insights',
  tools: createConstrainedRegistry(),

  async execute(input: InsightInput): Promise<AgentOutput<InsightOutput>> {
    // Wrap existing insight evaluator
    const insights = evaluate(input.data, input.templates, ENVELOPES);

    return {
      result: { insights },
      toolsUsed: [],
    };
  },
};

// =============================================================================
// AGENT REGISTRY
// =============================================================================

export const AGENTS = {
  discovery: DiscoveryAgent,
  analyzer: AnalyzerAgent,
  joiner: JoinerAgent,
  insight: InsightAgent,
} as const;

export type AgentName = keyof typeof AGENTS;
