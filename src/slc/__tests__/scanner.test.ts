/**
 * Scanner Module Tests (TDD)
 *
 * Tests the file scanning functionality per PRD v0.95:
 * - Walk directory tree
 * - Detect languages
 * - Count files and lines
 * - Respect ignore patterns
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { scan } from '../scanner';
import type { ScanResult } from '../types';

describe('Scanner', () => {
  let testDir: string;

  // Create temp directory with test files before each test
  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'peakinfer-test-'));
  });

  // Clean up temp directory after each test
  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  // Helper to create test files
  const createFile = (relativePath: string, content: string) => {
    const fullPath = path.join(testDir, relativePath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content);
  };

  describe('scan()', () => {
    it('should return empty result for empty directory', async () => {
      const result = await scan(testDir);

      expect(result.totalFiles).toBe(0);
      expect(result.totalLines).toBe(0);
      expect(result.files).toHaveLength(0);
    });

    it('should detect Python files', async () => {
      createFile('app.py', 'print("hello")\nprint("world")');

      const result = await scan(testDir);

      expect(result.totalFiles).toBe(1);
      expect(result.files[0].language).toBe('python');
      expect(result.files[0].lines).toBe(2);
    });

    it('should detect TypeScript files', async () => {
      createFile('app.ts', 'const x = 1;\nconst y = 2;\nconst z = 3;');

      const result = await scan(testDir);

      expect(result.totalFiles).toBe(1);
      expect(result.files[0].language).toBe('typescript');
      expect(result.files[0].lines).toBe(3);
    });

    it('should detect JavaScript files', async () => {
      createFile('app.js', 'let a = 1;');

      const result = await scan(testDir);

      expect(result.files[0].language).toBe('javascript');
    });

    it('should scan nested directories', async () => {
      createFile('src/services/api.py', 'import openai');
      createFile('src/utils/helpers.ts', 'export const x = 1;');
      createFile('lib/client.js', 'const c = require("x")');

      const result = await scan(testDir);

      expect(result.totalFiles).toBe(3);
      expect(result.languages.python).toBe(1);
      expect(result.languages.typescript).toBe(1);
      expect(result.languages.javascript).toBe(1);
    });

    it('should ignore node_modules by default', async () => {
      createFile('app.ts', 'const x = 1;');
      createFile('node_modules/pkg/index.js', 'module.exports = {}');

      const result = await scan(testDir);

      expect(result.totalFiles).toBe(1);
      expect(result.files[0].path).toBe('app.ts');
    });

    it('should ignore .git directory', async () => {
      createFile('app.py', 'x = 1');
      createFile('.git/config', '[core]');

      const result = await scan(testDir);

      expect(result.totalFiles).toBe(1);
    });

    it('should ignore dist and build directories', async () => {
      createFile('src/app.ts', 'const x = 1;');
      createFile('dist/app.js', 'var x = 1;');
      createFile('build/output.js', 'var y = 2;');

      const result = await scan(testDir);

      expect(result.totalFiles).toBe(1);
      expect(result.files[0].path).toBe('src/app.ts');
    });

    it('should count total lines correctly', async () => {
      createFile('a.py', 'line1\nline2\nline3');       // 3 lines
      createFile('b.ts', 'line1\nline2');              // 2 lines

      const result = await scan(testDir);

      expect(result.totalLines).toBe(5);
    });

    it('should return relative paths', async () => {
      createFile('src/deep/nested/file.py', 'x = 1');

      const result = await scan(testDir);

      expect(result.files[0].path).toBe('src/deep/nested/file.py');
    });

    it('should track scan duration', async () => {
      createFile('app.py', 'x = 1');

      const result = await scan(testDir);

      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('should handle files with no extension as unknown', async () => {
      createFile('Makefile', 'all: build');
      createFile('app.py', 'x = 1');

      const result = await scan(testDir);

      // Should only pick up known languages, skip unknown
      expect(result.totalFiles).toBe(1);
    });

    it('should detect Go files', async () => {
      createFile('main.go', 'package main\nfunc main() {}');

      const result = await scan(testDir);

      expect(result.files[0].language).toBe('go');
    });

    it('should detect Java files', async () => {
      createFile('App.java', 'public class App {}');

      const result = await scan(testDir);

      expect(result.files[0].language).toBe('java');
    });
  });

  describe('error handling', () => {
    it('should throw for non-existent path', async () => {
      await expect(scan('/nonexistent/path')).rejects.toThrow();
    });

    it('should handle permission errors gracefully', async () => {
      // This test is platform-specific, skip if can't set permissions
      if (process.platform === 'win32') return;

      createFile('readable.py', 'x = 1');
      const unreadableDir = path.join(testDir, 'unreadable');
      fs.mkdirSync(unreadableDir);
      fs.writeFileSync(path.join(unreadableDir, 'secret.py'), 'y = 2');
      fs.chmodSync(unreadableDir, 0o000);

      try {
        const result = await scan(testDir);
        // Should still return the readable file
        expect(result.totalFiles).toBeGreaterThanOrEqual(1);
      } finally {
        // Restore permissions for cleanup
        fs.chmodSync(unreadableDir, 0o755);
      }
    });
  });
});
