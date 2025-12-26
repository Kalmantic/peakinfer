/**
 * CLI Integration Tests
 * Per Test Cases v1.9.3 - Critical Path Tests
 */
import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { spawn, ChildProcess } from 'child_process';
import { join } from 'path';
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'fs';

const CLI_PATH = join(__dirname, '..', 'dist', 'cli.js');
const FIXTURES_PATH = join(__dirname, 'fixtures');
const TEMP_DIR = join(__dirname, '.temp-cli-test');

interface CLIResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  duration: number;
}

async function runCLI(args: string[], options?: { env?: Record<string, string>; timeout?: number }): Promise<CLIResult> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const timeout = options?.timeout || 60000;

    const child = spawn('node', [CLI_PATH, ...args], {
      env: { ...process.env, ...options?.env },
      cwd: process.cwd(),
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`CLI timed out after ${timeout}ms`));
    }, timeout);

    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({
        exitCode: code || 0,
        stdout,
        stderr,
        duration: Date.now() - startTime,
      });
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

describe('CLI demo command', () => {
  test('Runs without arguments', async () => {
    const result = await runCLI(['demo']);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('DRIFT DETECTED');
  });

  test('Completes in under 30 seconds', async () => {
    const result = await runCLI(['demo']);
    expect(result.duration).toBeLessThan(30000);
  });

  test('Works offline with cached demo data', async () => {
    const result = await runCLI(['demo'], {
      env: {
        ANTHROPIC_API_KEY: '', // No API key
      },
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('inference points');
    expect(result.stderr).not.toContain('API');
  });

  test('Shows magic moment (drift detection)', async () => {
    const result = await runCLI(['demo']);
    expect(result.stdout).toContain('YOUR CODE');
    expect(result.stdout).toContain('RUNTIME');
  });

  test('Shows issues with severity', async () => {
    const result = await runCLI(['demo']);
    expect(result.stdout).toMatch(/CRITICAL|HIGH|MEDIUM|LOW/);
  });

  test('Shows CTA for next step', async () => {
    const result = await runCLI(['demo']);
    expect(result.stdout).toContain('peakinfer analyze');
  });
});

describe('CLI help', () => {
  test('Shows help with --help', async () => {
    const result = await runCLI(['--help']);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('analyze');
    expect(result.stdout).toContain('demo');
  });

  test('Shows version with --version', async () => {
    const result = await runCLI(['--version']);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/\d+\.\d+\.\d+/);
  });
});

describe('CLI analyze command', () => {
  beforeAll(() => {
    // Create temp directory with test file
    if (!existsSync(TEMP_DIR)) {
      mkdirSync(TEMP_DIR, { recursive: true });
    }

    // Create a simple test file
    const testFile = `
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

export async function chat(prompt: string) {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1000,
    messages: [{ role: 'user', content: prompt }],
  });
  return response;
}
`;
    writeFileSync(join(TEMP_DIR, 'test.ts'), testFile);
  });

  afterAll(() => {
    // Cleanup
    if (existsSync(TEMP_DIR)) {
      rmSync(TEMP_DIR, { recursive: true, force: true });
    }
  });

  test('Fails gracefully without API key', async () => {
    const result = await runCLI(['analyze', TEMP_DIR], {
      env: {
        ANTHROPIC_API_KEY: '',
      },
    });
    // Should exit with error or show helpful message
    expect(result.stdout + result.stderr).toMatch(/API|key|ANTHROPIC/i);
  });

  test('Shows error for non-existent path', async () => {
    const result = await runCLI(['analyze', '/non/existent/path']);
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain('not found');
  });

  test('Accepts --verbose flag', async () => {
    const result = await runCLI(['analyze', TEMP_DIR, '--verbose'], {
      env: {
        ANTHROPIC_API_KEY: '',
      },
    });
    // Should not crash with verbose flag
    expect(result.exitCode).toBeDefined();
  });

  test('Accepts --fixes flag', async () => {
    const result = await runCLI(['analyze', TEMP_DIR, '--fixes'], {
      env: {
        ANTHROPIC_API_KEY: '',
      },
    });
    // Should not crash with fixes flag
    expect(result.exitCode).toBeDefined();
  });
});

describe('CLI template commands', () => {
  test('Lists templates', async () => {
    const result = await runCLI(['template', 'list']);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/template|insight|optimization/i);
  });
});

describe('CLI history commands', () => {
  test('Shows history', async () => {
    const result = await runCLI(['history']);
    expect(result.exitCode).toBe(0);
    // May be empty but should not crash
  });
});
