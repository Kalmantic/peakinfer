/**
 * SLC Cleanup Sprint Tests
 *
 * Tests for the SLC (Simple, Lovable, Complete) cleanup implementation:
 * - Cache module for offline viewing
 * - Simplified command structure
 * - No "coming soon" anti-patterns
 *
 * Design Philosophy (Julie Zhou):
 * - Every feature should be complete or not exist
 * - Never break user trust with placeholder promises
 * - Respect user's time with clear feedback
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import {
  writeCacheSync,
  readCacheSync,
  getCacheAge,
  formatCacheTimestamp,
  cacheExists,
  clearCache,
  type CachedAnalysis,
} from '../cache.js';

const PROJECT_ROOT = path.join(__dirname, '..', '..', '..');
const TEST_DIR = path.join(PROJECT_ROOT, 'test-cache-temp');

describe('SLC Cleanup Sprint', () => {
  describe('Cache Module', () => {
    beforeEach(() => {
      // Create test directory
      if (!fs.existsSync(TEST_DIR)) {
        fs.mkdirSync(TEST_DIR, { recursive: true });
      }
    });

    afterEach(() => {
      // Cleanup test directory
      if (fs.existsSync(TEST_DIR)) {
        fs.rmSync(TEST_DIR, { recursive: true, force: true });
      }
    });

    it('should write and read cache correctly', () => {
      const testData = {
        targetPath: TEST_DIR,
        callsites: [
          {
            id: 'test-1',
            file: 'test.ts',
            line: 10,
            provider: 'anthropic',
            model: 'claude-3-sonnet',
            confidence: 0.95,
          },
        ],
        stackMap: {
          providers: { anthropic: 1 },
          models: { 'claude-3-sonnet': 1 },
          files: { 'test.ts': 1 },
        },
        pricing: {
          totalMonthlyEstimate: 100,
          breakdown: [],
        },
      };

      writeCacheSync(TEST_DIR, testData);
      const cached = readCacheSync(TEST_DIR);

      expect(cached).not.toBeNull();
      expect(cached?.callsites).toHaveLength(1);
      expect(cached?.callsites[0].provider).toBe('anthropic');
      expect(cached?.timestamp).toBeDefined();
      expect(cached?.version).toBeDefined();
    });

    it('should return null when cache does not exist', () => {
      const nonExistentPath = path.join(TEST_DIR, 'non-existent');
      const cached = readCacheSync(nonExistentPath);
      expect(cached).toBeNull();
    });

    it('should correctly report cache existence', () => {
      expect(cacheExists(TEST_DIR)).toBe(false);

      writeCacheSync(TEST_DIR, {
        targetPath: TEST_DIR,
        callsites: [],
        stackMap: { providers: {}, models: {}, files: {} },
        pricing: { totalMonthlyEstimate: 0, breakdown: [] },
      });

      expect(cacheExists(TEST_DIR)).toBe(true);
    });

    it('should clear cache correctly', () => {
      writeCacheSync(TEST_DIR, {
        targetPath: TEST_DIR,
        callsites: [],
        stackMap: { providers: {}, models: {}, files: {} },
        pricing: { totalMonthlyEstimate: 0, breakdown: [] },
      });

      expect(cacheExists(TEST_DIR)).toBe(true);
      const cleared = clearCache(TEST_DIR);
      expect(cleared).toBe(true);
      expect(cacheExists(TEST_DIR)).toBe(false);
    });

    it('should format cache age correctly', () => {
      const now = new Date();

      // Just now
      const justNow: CachedAnalysis = {
        timestamp: now.toISOString(),
        version: '0.95.0',
        targetPath: TEST_DIR,
        callsites: [],
        stackMap: { providers: {}, models: {}, files: {} },
        pricing: { totalMonthlyEstimate: 0, breakdown: [] },
      };
      expect(getCacheAge(justNow)).toBe('just now');

      // 5 minutes ago
      const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000);
      const minutesOld: CachedAnalysis = {
        ...justNow,
        timestamp: fiveMinAgo.toISOString(),
      };
      expect(getCacheAge(minutesOld)).toBe('5 minutes ago');

      // 2 hours ago
      const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
      const hoursOld: CachedAnalysis = {
        ...justNow,
        timestamp: twoHoursAgo.toISOString(),
      };
      expect(getCacheAge(hoursOld)).toBe('2 hours ago');

      // 3 days ago
      const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
      const daysOld: CachedAnalysis = {
        ...justNow,
        timestamp: threeDaysAgo.toISOString(),
      };
      expect(getCacheAge(daysOld)).toBe('3 days ago');
    });

    it('should format timestamp for display', () => {
      const cached: CachedAnalysis = {
        timestamp: '2025-12-10T14:30:00.000Z',
        version: '0.95.0',
        targetPath: TEST_DIR,
        callsites: [],
        stackMap: { providers: {}, models: {}, files: {} },
        pricing: { totalMonthlyEstimate: 0, breakdown: [] },
      };

      const formatted = formatCacheTimestamp(cached);
      // Should contain date components
      expect(formatted).toContain('Dec');
      expect(formatted).toContain('10');
      expect(formatted).toContain('2025');
    });
  });

  describe('No "Coming Soon" Anti-Pattern', () => {
    it('should not contain "coming soon" text in source files', () => {
      const result = execSync(
        `git ls-files "*.ts" | xargs grep -il "coming soon" 2>/dev/null || echo ""`,
        { cwd: PROJECT_ROOT, encoding: 'utf-8' }
      ).trim();

      // Filter out test files (this test file is allowed to mention it)
      const files = result
        .split('\n')
        .filter((f) => f && !f.includes('.test.ts') && !f.includes('__tests__'));

      expect(files).toHaveLength(0);
    });

    it('should not contain "feature will be available" promises', () => {
      const result = execSync(
        `git ls-files "*.ts" | xargs grep -il "will be available" 2>/dev/null || echo ""`,
        { cwd: PROJECT_ROOT, encoding: 'utf-8' }
      ).trim();

      const files = result
        .split('\n')
        .filter((f) => f && !f.includes('.test.ts') && !f.includes('__tests__'));

      expect(files).toHaveLength(0);
    });
  });

  describe('Simplified Command Structure', () => {
    // Cache CLI outputs to avoid spawning multiple processes
    // Note: 'recommend' is now an alias for 'analyze', so it's not simplified
    const simplifiedCommands = ['discover', 'profile', 'plan', 'report'];
    const commandOutputs: Map<string, string> = new Map();
    let helpOutput = '';

    beforeEach(() => {
      // Only run once, cache results
      if (commandOutputs.size === 0) {
        for (const cmd of simplifiedCommands) {
          try {
            const output = execSync(`node dist/slc/cli.js ${cmd} 2>&1`, {
              cwd: PROJECT_ROOT,
              encoding: 'utf-8',
            });
            commandOutputs.set(cmd, output);
          } catch (e: any) {
            commandOutputs.set(cmd, e.stdout || e.stderr || '');
          }
        }
        helpOutput = execSync(`node dist/slc/cli.js --help 2>&1`, {
          cwd: PROJECT_ROOT,
          encoding: 'utf-8',
        });
      }
    });

    it('should show friendly message for simplified commands', () => {
      for (const cmd of simplifiedCommands) {
        const output = commandOutputs.get(cmd) || '';
        expect(output).toContain('simplified');
        expect(output).toContain('peakinfer analyze');
      }
    });

    it('should list only core commands in help', () => {
      // Should show core commands
      expect(helpOutput).toContain('analyze');
      expect(helpOutput).toContain('benchmark');
      expect(helpOutput).toContain('templates');

      // Should show --cached option
      expect(helpOutput).toContain('--cached');
    });
  });

  describe('Cache Integration', () => {
    it('should show helpful message when no cache exists', () => {
      const testPath = path.join(PROJECT_ROOT, 'test-no-cache-exists');

      // Ensure no cache
      if (fs.existsSync(testPath)) {
        fs.rmSync(testPath, { recursive: true, force: true });
      }
      fs.mkdirSync(testPath, { recursive: true });

      try {
        const output = execSync(`node dist/slc/cli.js analyze ${testPath} --cached 2>&1`, {
          cwd: PROJECT_ROOT,
          encoding: 'utf-8',
        });

        expect(output).toContain('No cached analysis');
        expect(output).toContain('peakinfer analyze');
      } catch (e: any) {
        const output = e.stdout || e.stderr || '';
        expect(output).toContain('No cached analysis');
      } finally {
        fs.rmSync(testPath, { recursive: true, force: true });
      }
    });
  });
});
