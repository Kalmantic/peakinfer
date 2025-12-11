/**
 * PRD Renderer Tests
 *
 * Verifies CLI output matches PRD v0.95 Section 9.1 specifications.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  renderPRDZeroState,
  renderPRDSuccessState,
  renderPRDErrorState,
  DEFAULT_SDK_CHECKS,
} from '../prd-renderer.js';
import type {
  ScanResult,
  ClassifiedCallsite,
  StackMap,
  PricingSummary,
  TechStack,
  InferencePatterns,
} from '../types.js';

// Mock console.log to capture output
let consoleOutput: string[] = [];
const originalLog = console.log;

beforeEach(() => {
  consoleOutput = [];
  console.log = (...args: any[]) => {
    consoleOutput.push(args.join(' '));
  };
});

afterEach(() => {
  console.log = originalLog;
});

describe('PRD Zero State', () => {
  const mockScan: ScanResult = {
    root: '/test/project',
    files: [],
    totalFiles: 847,
    totalLines: 12340,
    languages: { python: 500, typescript: 347 },
    durationMs: 1234,
  };

  it('should show version header', () => {
    renderPRDZeroState(mockScan, DEFAULT_SDK_CHECKS);
    const output = consoleOutput.join('\n');
    expect(output).toContain('PeakInfer v0.95');
  });

  it('should show scan summary', () => {
    renderPRDZeroState(mockScan, DEFAULT_SDK_CHECKS);
    const output = consoleOutput.join('\n');
    expect(output).toContain('Scanned: 847 files');
    expect(output).toContain('12,340 LOC');
    expect(output).toContain('Languages: python, typescript');
  });

  it('should show "Checked for:" list', () => {
    renderPRDZeroState(mockScan, DEFAULT_SDK_CHECKS);
    const output = consoleOutput.join('\n');
    expect(output).toContain('Checked for:');
    expect(output).toContain('OpenAI SDK');
    expect(output).toContain('Anthropic SDK');
    expect(output).toContain('LangChain');
    expect(output).toContain('not found');
  });

  it('should show troubleshooting tips', () => {
    renderPRDZeroState(mockScan, DEFAULT_SDK_CHECKS);
    const output = consoleOutput.join('\n');
    expect(output).toContain('If you expected LLM usage');
    expect(output).toContain('Dynamic imports');
    expect(output).toContain('Environment-gated code paths');
  });
});

describe('PRD Success State', () => {
  const mockScan: ScanResult = {
    root: '/test/project',
    files: [],
    totalFiles: 847,
    totalLines: 12340,
    languages: { python: 500, typescript: 347 },
    durationMs: 1234,
  };

  const mockCallsites: ClassifiedCallsite[] = [
    {
      id: '1',
      file: 'src/agents/summarizer.py',
      line: 47,
      provider: 'OpenAI',
      model: 'gpt-4o',
      framework: null,
      runtime: null,
      taskKind: 'chat',
      isStreaming: true,
      confidence: 0.95,
      reasoning: { whyProvider: 'SDK', whyModel: 'explicit' },
    },
    {
      id: '2',
      file: 'src/pipelines/extract.py',
      line: 112,
      provider: 'Anthropic',
      model: 'claude-3-5-sonnet',
      framework: null,
      runtime: null,
      taskKind: 'chat',
      isStreaming: false,
      confidence: 0.92,
      reasoning: { whyProvider: 'SDK', whyModel: 'explicit' },
    },
  ];

  const mockStackMap: StackMap = {
    root: '/test/project',
    tree: [],
    summary: {
      totalCallsites: 2,
      providers: ['OpenAI', 'Anthropic'],
      models: ['gpt-4o', 'claude-3-5-sonnet'],
    },
  };

  const mockPricing: PricingSummary = {
    estimatedRange: { low: 1240, high: 1870 },
    mostExpensiveModel: 'gpt-4o',
    byProvider: [
      { provider: 'OpenAI', throughput: 1200, percentage: 76 },
      { provider: 'Anthropic', throughput: 380, percentage: 24 },
    ],
    byModel: [
      { model: 'gpt-4o', throughput: 1200 },
      { model: 'claude-3-5-sonnet', throughput: 380 },
    ],
    hotspots: [
      {
        file: 'src/agents/summarizer.py',
        line: 47,
        model: 'gpt-4o',
        estimatedMonthlyLow: 720,
        estimatedMonthlyHigh: 980,
        suggestion: 'evaluate gpt-4o-mini for this use case',
      },
    ],
  };

  it('should show STACKMAP box', () => {
    renderPRDSuccessState(mockScan, mockCallsites, mockStackMap, mockPricing);
    const output = consoleOutput.join('\n');
    expect(output).toContain('STACKMAP');
    expect(output).toContain('┌');
    expect(output).toContain('└');
  });

  it('should show CALLSITES section', () => {
    renderPRDSuccessState(mockScan, mockCallsites, mockStackMap, mockPricing);
    const output = consoleOutput.join('\n');
    expect(output).toContain('CALLSITES');
    expect(output).toContain('src/agents/summarizer.py:47');
  });

  it('should show MODELS section', () => {
    renderPRDSuccessState(mockScan, mockCallsites, mockStackMap, mockPricing);
    const output = consoleOutput.join('\n');
    expect(output).toContain('MODELS');
    expect(output).toContain('gpt-4o');
    expect(output).toContain('claude-3-5-sonnet');
  });

  it('should show VENDORS / PROVIDERS section', () => {
    renderPRDSuccessState(mockScan, mockCallsites, mockStackMap, mockPricing);
    const output = consoleOutput.join('\n');
    expect(output).toContain('VENDORS / PROVIDERS');
    expect(output).toContain('OpenAI');
    expect(output).toContain('Anthropic');
  });

  it('should show PRICING SUMMARY box', () => {
    renderPRDSuccessState(mockScan, mockCallsites, mockStackMap, mockPricing);
    const output = consoleOutput.join('\n');
    expect(output).toContain('PRICING SUMMARY');
    expect(output).toContain('Estimated monthly cost');
    expect(output).toContain('$1,240');
  });

  it('should show HOTSPOTS box', () => {
    renderPRDSuccessState(mockScan, mockCallsites, mockStackMap, mockPricing);
    const output = consoleOutput.join('\n');
    expect(output).toContain('HOTSPOTS');
    expect(output).toContain('⚠');
    expect(output).toContain('src/agents/summarizer.py:47');
    // SLC: Suggestions are now rendered directly (with optional [AI Suggestion] prefix from pricing.ts)
    expect(output).toContain('evaluate gpt-4o-mini');
  });

  it('should show next commands', () => {
    renderPRDSuccessState(mockScan, mockCallsites, mockStackMap, mockPricing);
    const output = consoleOutput.join('\n');
    // SLC: Only suggest commands that actually exist and are complete
    expect(output).toContain('peakinfer prices');
    expect(output).toContain('peakinfer templates list');
  });
});

describe('PRD Error State', () => {
  it('should show API connection error', () => {
    renderPRDErrorState({ type: 'api_connection' });
    const output = consoleOutput.join('\n');
    expect(output).toContain('Unable to reach Anthropic API');
    expect(output).toContain('Possible causes');
    expect(output).toContain('No internet connection');
  });

  it('should show API key error with setup instructions', () => {
    renderPRDErrorState({ type: 'api_key' });
    const output = consoleOutput.join('\n');
    expect(output).toContain('ANTHROPIC_API_KEY');
    expect(output).toContain('export ANTHROPIC_API_KEY=sk-ant');
  });

  it('should show cached StackMaps available', () => {
    renderPRDErrorState({ type: 'api_connection' });
    const output = consoleOutput.join('\n');
    expect(output).toContain('Cached StackMaps remain available');
    expect(output).toContain('peakinfer stackmap --cached');
  });
});

