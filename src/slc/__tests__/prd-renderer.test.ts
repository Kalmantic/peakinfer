/**
 * PRD Renderer Tests
 *
 * Verifies CLI output matches Design Document v1.0 Section 6 specifications.
 *
 * Design principles:
 * - Developer-friendly copy (talk like a helpful colleague)
 * - Content-Driven Layout (hierarchy via spacing, not boxes)
 * - Invisible UI (insight stays, interface disappears)
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
    expect(output).toContain('PeakInfer v1.0');
  });

  it('should show what we scanned in plain English', () => {
    renderPRDZeroState(mockScan, DEFAULT_SDK_CHECKS);
    const output = consoleOutput.join('\n');
    // Developer-friendly: "Scanned X files (~Y lines)"
    expect(output).toContain('Scanned 847 files');
    expect(output).toContain('12,340');
    expect(output).toContain('Languages: python, typescript');
  });

  it('should show "Looked for:" list', () => {
    renderPRDZeroState(mockScan, DEFAULT_SDK_CHECKS);
    const output = consoleOutput.join('\n');
    expect(output).toContain('Looked for:');
    expect(output).toContain('OpenAI SDK');
    expect(output).toContain('Anthropic SDK');
    expect(output).toContain('LangChain');
    expect(output).toContain('not found');
  });

  it('should show helpful troubleshooting tips', () => {
    renderPRDZeroState(mockScan, DEFAULT_SDK_CHECKS);
    const output = consoleOutput.join('\n');
    // Developer-friendly tips
    expect(output).toContain('If you expected to see LLM calls');
    expect(output).toContain('custom wrappers');
    expect(output).toContain('dynamic imports');
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

  it('should show "Found X LLM calls" in plain English', () => {
    renderPRDSuccessState(mockScan, mockCallsites, mockStackMap, mockPricing);
    const output = consoleOutput.join('\n');
    expect(output).toContain('Found 2 LLM calls');
  });

  it('should show where LLM calls are with file:line format', () => {
    renderPRDSuccessState(mockScan, mockCallsites, mockStackMap, mockPricing);
    const output = consoleOutput.join('\n');
    expect(output).toContain('Where your LLM calls are');
    expect(output).toContain('src/agents/summarizer.py');
    expect(output).toContain('L47');
  });

  it('should show models and providers', () => {
    renderPRDSuccessState(mockScan, mockCallsites, mockStackMap, mockPricing);
    const output = consoleOutput.join('\n');
    expect(output).toContain('gpt-4o');
    expect(output).toContain('claude-3-5-sonnet');
    expect(output).toContain('OpenAI');
    expect(output).toContain('Anthropic');
  });

  it('should show estimated monthly cost', () => {
    renderPRDSuccessState(mockScan, mockCallsites, mockStackMap, mockPricing);
    const output = consoleOutput.join('\n');
    expect(output).toContain('Estimated monthly cost');
    expect(output).toContain('$1,240');
    expect(output).toContain('/month');
  });

  it('should show Quick wins with actionable suggestions', () => {
    renderPRDSuccessState(mockScan, mockCallsites, mockStackMap, mockPricing);
    const output = consoleOutput.join('\n');
    expect(output).toContain('Quick wins');
    expect(output).toContain('src/agents/summarizer.py:47');
    expect(output).toContain('evaluate gpt-4o-mini');
  });

  it('should show next steps', () => {
    renderPRDSuccessState(mockScan, mockCallsites, mockStackMap, mockPricing);
    const output = consoleOutput.join('\n');
    expect(output).toContain('Next');
    expect(output).toContain('peakinfer models');
    expect(output).toContain('peakinfer analyze . --html');
  });
});

describe('PRD Error State', () => {
  it('should show API connection error in plain English', () => {
    renderPRDErrorState({ type: 'api_connection' });
    const output = consoleOutput.join('\n');
    expect(output).toContain('Can\'t reach Anthropic API');
    expect(output).toContain('Possible causes');
    expect(output).toContain('No internet connection');
  });

  it('should show API key error with fix instructions', () => {
    renderPRDErrorState({ type: 'api_key' });
    const output = consoleOutput.join('\n');
    expect(output).toContain('API key missing or invalid');
    expect(output).toContain('To fix this');
    expect(output).toContain('export ANTHROPIC_API_KEY=sk-ant');
  });

  it('should show how to view cached analysis', () => {
    renderPRDErrorState({ type: 'api_connection' });
    const output = consoleOutput.join('\n');
    expect(output).toContain('view your last analysis');
    expect(output).toContain('peakinfer analyze . --cached');
  });
});
