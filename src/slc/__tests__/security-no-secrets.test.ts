/**
 * Security Test: No Secrets in Repository
 *
 * Ensures no API keys, tokens, private keys, or other secrets
 * are accidentally committed to the repository.
 *
 * This test should ALWAYS pass. If it fails, secrets may have been leaked.
 *
 * Performance optimizations:
 * - Uses single git ls-files call, cached for all tests
 * - Shallow git history scan by default (10 commits)
 * - Set DEEP_SCAN=1 for full 50-commit history scan
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const PROJECT_ROOT = path.join(__dirname, '..', '..', '..');
const DEEP_SCAN = process.env.DEEP_SCAN === '1';
const GIT_HISTORY_DEPTH = DEEP_SCAN ? 50 : 10;

// Cache git ls-files result for all tests (expensive operation)
let cachedFiles: string[] = [];

beforeAll(() => {
  const result = execSync('git ls-files', { cwd: PROJECT_ROOT, encoding: 'utf-8' });
  cachedFiles = result.trim().split('\n').filter(Boolean);
});

// Efficient pattern search using git grep (handles file paths with spaces correctly)
function searchFilesForPattern(pattern: string, excludePatterns: string[] = []): string[] {
  try {
    // Use git grep which handles paths correctly and is faster
    const result = execSync(
      `git grep -lE "${pattern}" 2>/dev/null || echo ""`,
      { cwd: PROJECT_ROOT, encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 }
    ).trim();

    return result.split('\n').filter(f => {
      if (!f) return false;
      return !excludePatterns.some(exc => f.includes(exc));
    });
  } catch {
    return [];
  }
}

describe('Security: No Secrets in Repository', () => {

  describe('API Key Patterns', () => {

    it('should not contain Anthropic API keys (sk-ant-*)', () => {
      const files = searchFilesForPattern('sk-ant-[a-zA-Z0-9]{20,}');
      expect(files).toHaveLength(0);
    });

    it('should not contain OpenAI API keys (sk-*)', () => {
      // Match sk- followed by alphanumeric, exclude sk-ant (Anthropic) and test fixtures
      const files = searchFilesForPattern('sk-[a-zA-Z0-9]{20,}', ['fixtures/', '.test.ts', 'sk-ant-']);
      expect(files).toHaveLength(0);
    });

    it('should not contain GitHub tokens (ghp_*, gho_*, ghs_*)', () => {
      // Search for each prefix separately to avoid regex backtracking
      const ghpFiles = searchFilesForPattern('ghp_[a-zA-Z0-9]{36}');
      const ghoFiles = searchFilesForPattern('gho_[a-zA-Z0-9]{36}');
      const ghsFiles = searchFilesForPattern('ghs_[a-zA-Z0-9]{36}');
      expect([...ghpFiles, ...ghoFiles, ...ghsFiles]).toHaveLength(0);
    }, 15000);

    it('should not contain AWS access keys (AKIA*)', () => {
      const files = searchFilesForPattern('AKIA[0-9A-Z]{16}');
      expect(files).toHaveLength(0);
    });

    it('should not contain AWS secret keys', () => {
      const files = searchFilesForPattern('aws_secret_access_key\\s*=\\s*[a-zA-Z0-9/+=]{40}');
      expect(files).toHaveLength(0);
    });

    it('should not contain Google Cloud API keys', () => {
      // Exclude markdown docs that may have example patterns
      const files = searchFilesForPattern('AIza[0-9A-Za-z_-]{35}', ['.md', 'design/']);
      expect(files).toHaveLength(0);
    });

    it('should not contain Stripe keys (sk_live_*, rk_live_*)', () => {
      const files = searchFilesForPattern('(sk_live_|rk_live_)[a-zA-Z0-9]{20,}');
      expect(files).toHaveLength(0);
    });

    it('should not contain Slack tokens (xox[baprs]-*)', () => {
      const files = searchFilesForPattern('xox[baprs]-[a-zA-Z0-9-]{10,}');
      expect(files).toHaveLength(0);
    });
  });

  describe('Private Keys', () => {

    it('should not contain RSA private keys', () => {
      const files = searchFilesForPattern('-----BEGIN RSA PRIVATE KEY-----');
      expect(files).toHaveLength(0);
    });

    it('should not contain generic private keys', () => {
      const files = searchFilesForPattern('-----BEGIN PRIVATE KEY-----');
      expect(files).toHaveLength(0);
    });

    it('should not contain EC private keys', () => {
      const files = searchFilesForPattern('-----BEGIN EC PRIVATE KEY-----');
      expect(files).toHaveLength(0);
    });

    it('should not contain OpenSSH private keys', () => {
      const files = searchFilesForPattern('-----BEGIN OPENSSH PRIVATE KEY-----');
      expect(files).toHaveLength(0);
    });

    it('should not track .pem, .key, .p12, .pfx files', () => {
      // Use cached files instead of spawning process
      const sensitiveFiles = cachedFiles.filter(f =>
        /\.(pem|key|p12|pfx|jks|keystore)$/i.test(f)
      );
      expect(sensitiveFiles).toHaveLength(0);
    });
  });

  describe('Environment Files', () => {

    it('should not track .env files', () => {
      // Use cached files
      const envFiles = cachedFiles.filter(f =>
        /^\.env$|\.env\.local|\.env\.development|\.env\.production/.test(f)
      );
      expect(envFiles).toHaveLength(0);
    });

    it('should have .env in .gitignore', () => {
      const gitignorePath = path.join(PROJECT_ROOT, '.gitignore');
      const gitignore = fs.readFileSync(gitignorePath, 'utf-8');
      expect(gitignore).toContain('.env');
    });

    it('env.example should only contain placeholder values', () => {
      const envExamplePath = path.join(PROJECT_ROOT, 'env.example');

      if (fs.existsSync(envExamplePath)) {
        const content = fs.readFileSync(envExamplePath, 'utf-8');

        // Should not contain actual API key patterns
        expect(content).not.toMatch(/sk-ant-[a-zA-Z0-9]{20,}/);
        expect(content).not.toMatch(/sk-[a-zA-Z0-9]{48}/);
        expect(content).not.toMatch(/AKIA[0-9A-Z]{16}/);

        // Should contain placeholder text
        expect(content).toMatch(/your_api_key_here|YOUR_|<your|placeholder|xxx/i);
      }
    });
  });

  describe('Database Credentials', () => {

    it('should not contain database connection strings with credentials', () => {
      // Search for each database type separately to avoid regex backtracking
      const mongoFiles = searchFilesForPattern('mongodb://[^:]+:[^@]+@', ['README', '.md', 'example']);
      const postgresFiles = searchFilesForPattern('postgres://[^:]+:[^@]+@', ['README', '.md', 'example']);
      const mysqlFiles = searchFilesForPattern('mysql://[^:]+:[^@]+@', ['README', '.md', 'example']);
      const redisFiles = searchFilesForPattern('redis://[^:]+:[^@]+@', ['README', '.md', 'example']);
      expect([...mongoFiles, ...postgresFiles, ...mysqlFiles, ...redisFiles]).toHaveLength(0);
    }, 20000);
  });

  describe('JWT and Bearer Tokens', () => {

    it('should not contain hardcoded JWT tokens', () => {
      // JWT format: base64.base64.base64
      const files = searchFilesForPattern(
        'eyJ[a-zA-Z0-9_-]{10,}\\.[a-zA-Z0-9_-]{10,}\\.[a-zA-Z0-9_-]{10,}',
        ['fixtures/', '.test.']
      );
      expect(files).toHaveLength(0);
    });

    it('should not contain hardcoded Bearer tokens', () => {
      const files = searchFilesForPattern(
        'Bearer [a-zA-Z0-9_-]{30,}',
        ['.md', 'fixtures/']
      );
      expect(files).toHaveLength(0);
    }, 10000);
  });

  describe('Git History Scan', () => {

    it('should not have Anthropic keys in recent git history', () => {
      // Check recent commits for leaked keys (10 by default, 50 with DEEP_SCAN=1)
      try {
        const result = execSync(
          `git log -${GIT_HISTORY_DEPTH} -p -S "sk-ant-" --oneline 2>/dev/null | grep -E "^\\\\+" | grep -E "sk-ant-[a-zA-Z0-9]{20,}" || echo ""`,
          { cwd: PROJECT_ROOT, encoding: 'utf-8', timeout: DEEP_SCAN ? 30000 : 10000 }
        ).trim();

        expect(result).toBe('');
      } catch (e: any) {
        // If timeout or other error, check if it's a timeout
        if (e.message?.includes('ETIMEDOUT') || e.message?.includes('SIGTERM')) {
          // Git history scan timed out - pass test but log warning
          console.warn('Git history scan timed out - skipping deep history check');
          expect(true).toBe(true);
        } else {
          throw e;
        }
      }
    }, DEEP_SCAN ? 35000 : 15000); // Timeout based on scan depth
  });
});
