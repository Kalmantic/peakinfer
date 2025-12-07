/**
 * StackMap Builder Module Tests (TDD)
 *
 * Per PRD v0.95 and Tech Design v1.1:
 * - Build hierarchical tree from classified callsites
 * - Group by directory → file → callsites
 * - Generate summary (total callsites, providers, models)
 */

import { describe, it, expect } from 'vitest';
import { buildStackMap } from '../stackmap';
import type { ClassifiedCallsite, StackMap } from '../types';

describe('StackMap Builder', () => {
  describe('buildStackMap()', () => {
    it('should return empty stackmap for empty callsites', () => {
      const result = buildStackMap([], '/project');

      expect(result.root).toBe('/project');
      expect(result.tree).toHaveLength(0);
      expect(result.summary.totalCallsites).toBe(0);
      expect(result.summary.providers).toEqual([]);
      expect(result.summary.models).toEqual([]);
    });

    it('should build tree with single file', () => {
      const callsites: ClassifiedCallsite[] = [
        {
          id: 'cs-001',
          file: 'app.py',
          line: 10,
          provider: 'openai',
          model: 'gpt-4o',
          framework: null,
          runtime: null,
          taskKind: 'chat',
          isStreaming: false,
          confidence: 0.9,
          reasoning: { whyProvider: 'x', whyModel: 'y' },
        },
      ];

      const result = buildStackMap(callsites, '/project');

      expect(result.tree).toHaveLength(1);
      expect(result.tree[0].name).toBe('app.py');
      expect(result.tree[0].type).toBe('file');
      expect(result.tree[0].callsites).toHaveLength(1);
      expect(result.tree[0].callsites![0].provider).toBe('openai');
    });

    it('should build nested tree for files in subdirectories', () => {
      const callsites: ClassifiedCallsite[] = [
        {
          id: 'cs-001',
          file: 'src/services/api.py',
          line: 20,
          provider: 'openai',
          model: 'gpt-4o',
          framework: null,
          runtime: null,
          taskKind: 'chat',
          isStreaming: false,
          confidence: 0.9,
          reasoning: { whyProvider: 'x', whyModel: 'y' },
        },
      ];

      const result = buildStackMap(callsites, '/project');

      expect(result.tree).toHaveLength(1);
      expect(result.tree[0].name).toBe('src');
      expect(result.tree[0].type).toBe('directory');
      expect(result.tree[0].children).toHaveLength(1);
      expect(result.tree[0].children![0].name).toBe('services');
      expect(result.tree[0].children![0].children![0].name).toBe('api.py');
    });

    it('should group multiple callsites in same file', () => {
      const callsites: ClassifiedCallsite[] = [
        {
          id: 'cs-001',
          file: 'app.py',
          line: 10,
          provider: 'openai',
          model: 'gpt-4o',
          framework: null,
          runtime: null,
          taskKind: 'chat',
          isStreaming: false,
          confidence: 0.9,
          reasoning: { whyProvider: 'x', whyModel: 'y' },
        },
        {
          id: 'cs-002',
          file: 'app.py',
          line: 25,
          provider: 'anthropic',
          model: 'claude-3-sonnet',
          framework: null,
          runtime: null,
          taskKind: 'chat',
          isStreaming: true,
          confidence: 0.85,
          reasoning: { whyProvider: 'a', whyModel: 'b' },
        },
      ];

      const result = buildStackMap(callsites, '/project');

      expect(result.tree).toHaveLength(1);
      expect(result.tree[0].callsites).toHaveLength(2);
      expect(result.tree[0].callsites![0].line).toBe(10);
      expect(result.tree[0].callsites![1].line).toBe(25);
    });

    it('should generate summary with unique providers', () => {
      const callsites: ClassifiedCallsite[] = [
        {
          id: 'cs-001',
          file: 'a.py',
          line: 1,
          provider: 'openai',
          model: 'gpt-4o',
          framework: null,
          runtime: null,
          taskKind: 'chat',
          isStreaming: false,
          confidence: 0.9,
          reasoning: { whyProvider: 'x', whyModel: 'y' },
        },
        {
          id: 'cs-002',
          file: 'b.py',
          line: 1,
          provider: 'openai',  // Same provider
          model: 'gpt-4o-mini',
          framework: null,
          runtime: null,
          taskKind: 'chat',
          isStreaming: false,
          confidence: 0.9,
          reasoning: { whyProvider: 'x', whyModel: 'y' },
        },
        {
          id: 'cs-003',
          file: 'c.py',
          line: 1,
          provider: 'anthropic',
          model: 'claude-3-sonnet',
          framework: null,
          runtime: null,
          taskKind: 'chat',
          isStreaming: false,
          confidence: 0.9,
          reasoning: { whyProvider: 'x', whyModel: 'y' },
        },
      ];

      const result = buildStackMap(callsites, '/project');

      expect(result.summary.totalCallsites).toBe(3);
      expect(result.summary.providers).toHaveLength(2);
      expect(result.summary.providers).toContain('openai');
      expect(result.summary.providers).toContain('anthropic');
    });

    it('should generate summary with unique models', () => {
      const callsites: ClassifiedCallsite[] = [
        {
          id: 'cs-001',
          file: 'a.py',
          line: 1,
          provider: 'openai',
          model: 'gpt-4o',
          framework: null,
          runtime: null,
          taskKind: 'chat',
          isStreaming: false,
          confidence: 0.9,
          reasoning: { whyProvider: 'x', whyModel: 'y' },
        },
        {
          id: 'cs-002',
          file: 'b.py',
          line: 1,
          provider: 'openai',
          model: 'gpt-4o',  // Same model
          framework: null,
          runtime: null,
          taskKind: 'chat',
          isStreaming: false,
          confidence: 0.9,
          reasoning: { whyProvider: 'x', whyModel: 'y' },
        },
      ];

      const result = buildStackMap(callsites, '/project');

      expect(result.summary.models).toHaveLength(1);
      expect(result.summary.models).toContain('gpt-4o');
    });

    it('should handle null models in summary', () => {
      const callsites: ClassifiedCallsite[] = [
        {
          id: 'cs-001',
          file: 'a.py',
          line: 1,
          provider: 'openai',
          model: null,  // Unknown model
          framework: null,
          runtime: null,
          taskKind: 'chat',
          isStreaming: false,
          confidence: 0.9,
          reasoning: { whyProvider: 'x', whyModel: 'y' },
        },
      ];

      const result = buildStackMap(callsites, '/project');

      expect(result.summary.models).toHaveLength(0);  // null models excluded
    });

    it('should sort callsites by line number within file', () => {
      const callsites: ClassifiedCallsite[] = [
        {
          id: 'cs-002',
          file: 'app.py',
          line: 50,
          provider: 'openai',
          model: 'gpt-4o',
          framework: null,
          runtime: null,
          taskKind: 'chat',
          isStreaming: false,
          confidence: 0.9,
          reasoning: { whyProvider: 'x', whyModel: 'y' },
        },
        {
          id: 'cs-001',
          file: 'app.py',
          line: 10,  // Earlier line
          provider: 'anthropic',
          model: 'claude-3-sonnet',
          framework: null,
          runtime: null,
          taskKind: 'chat',
          isStreaming: false,
          confidence: 0.9,
          reasoning: { whyProvider: 'x', whyModel: 'y' },
        },
      ];

      const result = buildStackMap(callsites, '/project');

      expect(result.tree[0].callsites![0].line).toBe(10);
      expect(result.tree[0].callsites![1].line).toBe(50);
    });

    it('should generate pattern string for callsites', () => {
      const callsites: ClassifiedCallsite[] = [
        {
          id: 'cs-001',
          file: 'app.py',
          line: 10,
          provider: 'openai',
          model: 'gpt-4o',
          framework: 'langchain',
          runtime: null,
          taskKind: 'chat',
          isStreaming: false,
          confidence: 0.9,
          reasoning: { whyProvider: 'x', whyModel: 'y' },
        },
      ];

      const result = buildStackMap(callsites, '/project');

      // Pattern should describe the callsite
      expect(result.tree[0].callsites![0].pattern).toContain('openai');
    });
  });
});
