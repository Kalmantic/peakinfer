import { describe, it, expect, beforeAll } from 'vitest';
import { scan } from '../src/scanner.js';
import { join } from 'path';

const FIXTURES_DIR = join(__dirname, 'fixtures', 'repos');

describe('scanner', () => {
  describe('file discovery', () => {
    it('finds Python files', async () => {
      const result = await scan(join(FIXTURES_DIR, 'self-hosted-vllm'));
      const pyFiles = result.files.filter(f => f.language === 'python');
      expect(pyFiles.length).toBeGreaterThan(0);
    });

    it('finds TypeScript files', async () => {
      const result = await scan(join(FIXTURES_DIR, 'saas-anthropic'));
      const tsFiles = result.files.filter(f => f.language === 'typescript');
      expect(tsFiles.length).toBeGreaterThan(0);
    });

    it('finds JavaScript files', async () => {
      const result = await scan(join(FIXTURES_DIR, 'saas-openai'));
      const jsFiles = result.files.filter(f => f.language === 'javascript');
      expect(jsFiles.length).toBeGreaterThan(0);
    });
  });

  describe('ignores', () => {
    it('ignores node_modules by default', async () => {
      const result = await scan(join(FIXTURES_DIR, 'saas-openai'));
      const nodeModules = result.files.filter(f => f.path.includes('node_modules'));
      expect(nodeModules.length).toBe(0);
    });

    it('ignores dist by default', async () => {
      const result = await scan(join(FIXTURES_DIR, 'saas-openai'));
      const dist = result.files.filter(f => f.path.includes('/dist/'));
      expect(dist.length).toBe(0);
    });

    it('ignores .git by default', async () => {
      const result = await scan(join(FIXTURES_DIR, 'saas-openai'));
      const git = result.files.filter(f => f.path.includes('.git/'));
      expect(git.length).toBe(0);
    });
  });

  describe('line counting', () => {
    it('counts lines of code per file', async () => {
      const result = await scan(join(FIXTURES_DIR, 'self-hosted-vllm'));
      for (const file of result.files) {
        expect(file.loc).toBeGreaterThan(0);
      }
    });
  });

  describe('language detection', () => {
    it('detects language from .py extension', async () => {
      const result = await scan(join(FIXTURES_DIR, 'self-hosted-vllm'));
      const pyFile = result.files.find(f => f.path.endsWith('.py'));
      expect(pyFile?.language).toBe('python');
    });

    it('detects language from .ts extension', async () => {
      const result = await scan(join(FIXTURES_DIR, 'saas-anthropic'));
      const tsFile = result.files.find(f => f.path.endsWith('.ts'));
      expect(tsFile?.language).toBe('typescript');
    });

    it('detects language from .js extension', async () => {
      const result = await scan(join(FIXTURES_DIR, 'saas-openai'));
      const jsFile = result.files.find(f => f.path.endsWith('.js'));
      expect(jsFile?.language).toBe('javascript');
    });
  });

  describe('summary', () => {
    it('returns correct totalFiles', async () => {
      const result = await scan(join(FIXTURES_DIR, 'hybrid-router'));
      expect(result.summary.totalFiles).toBe(result.files.length);
    });

    it('returns correct totalLoc', async () => {
      const result = await scan(join(FIXTURES_DIR, 'hybrid-router'));
      const sumLoc = result.files.reduce((sum, f) => sum + f.loc, 0);
      expect(result.summary.totalLoc).toBe(sumLoc);
    });

    it('returns languages list', async () => {
      const result = await scan(join(FIXTURES_DIR, 'hybrid-router'));
      expect(result.summary.languages).toContain('python');
    });
  });

  describe('edge cases', () => {
    it('returns empty result for empty directory', async () => {
      const result = await scan(join(FIXTURES_DIR, 'empty'));
      expect(result.files.length).toBe(0);
      expect(result.summary.totalFiles).toBe(0);
      expect(result.summary.totalLoc).toBe(0);
    });

    it('throws for non-existent directory', async () => {
      await expect(scan('/non/existent/path')).rejects.toThrow();
    });
  });

  describe('result structure', () => {
    it('includes root path', async () => {
      const path = join(FIXTURES_DIR, 'hybrid-router');
      const result = await scan(path);
      expect(result.root).toBe(path);
    });

    it('files have relative paths', async () => {
      const result = await scan(join(FIXTURES_DIR, 'hybrid-router'));
      for (const file of result.files) {
        expect(file.path.startsWith('/')).toBe(false);
      }
    });
  });
});
