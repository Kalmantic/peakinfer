/**
 * CLI Renderer Module Tests (TDD)
 *
 * Per Design Doc (Julie Zhou principles):
 * - 5 UX States: Zero, Loading, Error, Partial, Success
 * - Indentation-only hierarchy (no ASCII boxes)
 * - Lowercase preferred
 * - StackMap before Pricing
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  renderZeroState,
  renderLoadingState,
  renderErrorState,
  renderPartialState,
  renderSuccessState,
  formatCurrency,
} from '../renderer';
import type { AnalysisResult, ScanResult, StackMap, PricingSummary } from '../types';

describe('CLI Renderer', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let output: string[];

  beforeEach(() => {
    output = [];
    consoleSpy = vi.spyOn(console, 'log').mockImplementation((...args) => {
      output.push(args.join(' '));
    });
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe('renderZeroState()', () => {
    it('should render friendly message when no callsites found', () => {
      renderZeroState('/project');

      expect(output.join('\n')).toContain('no llm callsites detected');
    });

    it('should show the scanned path', () => {
      renderZeroState('/my/project');

      expect(output.join('\n')).toContain('/my/project');
    });

    it('should suggest common reasons', () => {
      renderZeroState('/project');

      const text = output.join('\n');
      expect(text).toMatch(/this could mean/i);
    });
  });

  describe('renderLoadingState()', () => {
    it('should show scanning progress', () => {
      renderLoadingState('/project', 'scanning files');

      expect(output.join('\n')).toContain('scanning');
    });

    it('should be able to show file being analyzed', () => {
      renderLoadingState('/project', 'analyzing src/app.py');

      expect(output.join('\n')).toContain('src/app.py');
    });
  });

  describe('renderErrorState()', () => {
    it('should render error message', () => {
      renderErrorState({
        code: 'API_KEY_MISSING',
        message: 'ANTHROPIC_API_KEY not set',
        suggestion: 'export ANTHROPIC_API_KEY=...',
      });

      const text = output.join('\n');
      expect(text).toContain('error');
      expect(text).toContain('ANTHROPIC_API_KEY');
    });

    it('should show suggestion for fixing', () => {
      renderErrorState({
        code: 'INVALID_PATH',
        message: 'Path does not exist',
        suggestion: 'Check the path and try again',
      });

      expect(output.join('\n')).toContain('try again');
    });

    it('should include error code', () => {
      renderErrorState({
        code: 'NO_FILES',
        message: 'No source files found',
        suggestion: 'Check directory contains supported files',
      });

      expect(output.join('\n')).toContain('NO_FILES');
    });
  });

  describe('renderPartialState()', () => {
    it('should show partial results with warning', () => {
      const result: AnalysisResult = {
        state: 'partial',
        warnings: ['Some files could not be analyzed'],
        stackMap: {
          root: '/project',
          tree: [],
          summary: { totalCallsites: 2, providers: ['openai'], models: ['gpt-4o'] },
        },
      };

      renderPartialState(result);

      const text = output.join('\n');
      expect(text).toContain('partial');
      expect(text).toContain('warning');
    });
  });

  describe('renderSuccessState()', () => {
    const mockScan: ScanResult = {
      root: '/project',
      files: [
        { path: 'app.py', language: 'python', lines: 100 },
        { path: 'utils.ts', language: 'typescript', lines: 50 },
      ],
      totalFiles: 2,
      totalLines: 150,
      languages: { python: 1, typescript: 1 },
      durationMs: 123,
    };

    const mockStackMap: StackMap = {
      root: '/project',
      tree: [
        {
          name: 'app.py',
          path: 'app.py',
          type: 'file',
          callsites: [
            { line: 10, pattern: 'openai.chat', provider: 'openai', model: 'gpt-4o' },
            { line: 25, pattern: 'anthropic.chat', provider: 'anthropic', model: 'claude-3-sonnet' },
          ],
        },
      ],
      summary: {
        totalCallsites: 2,
        providers: ['anthropic', 'openai'],
        models: ['claude-3-sonnet', 'gpt-4o'],
      },
    };

    const mockPricing: PricingSummary = {
      estimatedRange: { low: 10, high: 100 },
      mostExpensiveModel: 'gpt-4o',
      byProvider: [
        { provider: 'openai', throughput: 60, percentage: 60 },
        { provider: 'anthropic', throughput: 40, percentage: 40 },
      ],
      byModel: [
        { model: 'gpt-4o', throughput: 60 },
        { model: 'claude-3-sonnet', throughput: 40 },
      ],
      hotspots: [],
    };

    it('should render summary header', () => {
      renderSuccessState(mockScan, mockStackMap, mockPricing);

      const text = output.join('\n');
      expect(text).toContain('peakinfer');
      expect(text).toContain('/project');
    });

    it('should show scan statistics', () => {
      renderSuccessState(mockScan, mockStackMap, mockPricing);

      const text = output.join('\n');
      expect(text).toContain('2');  // files
      expect(text).toContain('150'); // lines
    });

    it('should list providers found', () => {
      renderSuccessState(mockScan, mockStackMap, mockPricing);

      const text = output.join('\n');
      expect(text).toContain('openai');
      expect(text).toContain('anthropic');
    });

    it('should show StackMap before pricing (per Design Doc)', () => {
      renderSuccessState(mockScan, mockStackMap, mockPricing);

      const text = output.join('\n');
      const stackmapIndex = text.indexOf('callsites');
      const pricingIndex = text.indexOf('estimated');

      // StackMap section should come before pricing
      expect(stackmapIndex).toBeLessThan(pricingIndex);
    });

    it('should render callsites with indentation (no boxes)', () => {
      renderSuccessState(mockScan, mockStackMap, mockPricing);

      const text = output.join('\n');
      // Should use spaces for hierarchy, not box characters
      expect(text).not.toContain('│');
      expect(text).not.toContain('├');
      expect(text).not.toContain('└');
      expect(text).not.toContain('═');
    });

    it('should show pricing range', () => {
      renderSuccessState(mockScan, mockStackMap, mockPricing);

      const text = output.join('\n');
      expect(text).toContain('$10');
      expect(text).toContain('$100');
    });

    it('should use lowercase style', () => {
      renderSuccessState(mockScan, mockStackMap, mockPricing);

      const text = output.join('\n');
      // Check for lowercase keywords (per Design Doc)
      expect(text).toMatch(/callsites|providers|models|estimated/);
    });
  });

  describe('formatCurrency()', () => {
    it('should format small amounts', () => {
      expect(formatCurrency(1.5)).toBe('$1.50');
    });

    it('should format larger amounts', () => {
      expect(formatCurrency(1234.56)).toBe('$1,234.56');
    });

    it('should format zero', () => {
      expect(formatCurrency(0)).toBe('$0.00');
    });

    it('should handle decimals correctly', () => {
      expect(formatCurrency(10.1)).toBe('$10.10');
    });
  });
});
