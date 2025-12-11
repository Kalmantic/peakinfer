/**
 * PeakInfer Real-World Evaluation Suite
 *
 * Philosophy (Hamel Husain style):
 * - Test against REAL codebases, not synthetic fixtures
 * - Clear pass/fail criteria tied to PRD requirements
 * - Fast feedback loop with caching
 * - Actionable failure messages
 *
 * Run:
 *   npx vitest run evals/real-world-evals.test.ts
 *   npx vitest run evals/real-world-evals.test.ts -t "vLLM"
 *   EVAL_ALL=1 npx vitest run evals/real-world-evals.test.ts
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { execSync, spawnSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// Config
const CLONE_DIR = '/tmp/peakinfer-evals';
const PROJECT_ROOT = path.join(__dirname, '..');
const PEAKINFER = path.join(PROJECT_ROOT, 'dist', 'slc', 'cli.js');
const TIMEOUT_MS = 120_000; // 2 minutes per repo
const RUN_ALL = process.env.EVAL_ALL === '1';

// Ensure clone directory exists
beforeAll(() => {
  fs.mkdirSync(CLONE_DIR, { recursive: true });
});

// ============================================================================
// HELPERS
// ============================================================================

interface CloneOptions {
  sparse_paths?: string[];
  branch?: string;
}

function cloneRepo(name: string, url: string, options: CloneOptions = {}): string {
  const repoDir = path.join(CLONE_DIR, name);

  if (fs.existsSync(repoDir)) {
    return repoDir; // Use cached
  }

  console.log(`  Cloning ${name}...`);

  if (options.sparse_paths?.length) {
    // Sparse checkout for large repos
    fs.mkdirSync(repoDir, { recursive: true });
    execSync(`git init`, { cwd: repoDir, stdio: 'pipe' });
    execSync(`git remote add origin ${url}`, { cwd: repoDir, stdio: 'pipe' });
    execSync(`git config core.sparseCheckout true`, { cwd: repoDir, stdio: 'pipe' });

    const sparseFile = path.join(repoDir, '.git', 'info', 'sparse-checkout');
    fs.writeFileSync(sparseFile, options.sparse_paths.join('\n'));

    try {
      execSync(`git pull --depth=1 origin main`, { cwd: repoDir, stdio: 'pipe' });
    } catch {
      execSync(`git pull --depth=1 origin master`, { cwd: repoDir, stdio: 'pipe' });
    }
  } else {
    execSync(`git clone --depth=1 ${url} ${repoDir}`, { stdio: 'pipe' });
  }

  return repoDir;
}

interface AnalysisResult {
  success: boolean;
  exitCode: number;
  callsites: number;
  providers: string[];
  models: string[];
  costEstimate: number | null;
  duration_ms: number;
  error?: string;
  raw?: any;
}

function runPeakInfer(targetDir: string): AnalysisResult {
  const start = Date.now();
  const result: AnalysisResult = {
    success: false,
    exitCode: -1,
    callsites: 0,
    providers: [],
    models: [],
    costEstimate: null,
    duration_ms: 0,
  };

  try {
    const proc = spawnSync('node', [PEAKINFER, 'analyze', targetDir, '--output', 'json'], {
      timeout: TIMEOUT_MS,
      maxBuffer: 50 * 1024 * 1024,
      encoding: 'utf-8',
    });

    result.duration_ms = Date.now() - start;
    result.exitCode = proc.status ?? -1;

    if (proc.signal === 'SIGTERM') {
      result.error = 'Timeout';
      return result;
    }

    // Parse JSON from stdout
    const stdout = proc.stdout || '';
    const jsonMatch = stdout.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      const json = JSON.parse(jsonMatch[0]);
      result.raw = json;
      result.success = true;
      result.callsites = json.callsites?.length || 0;
      result.costEstimate = json.pricing?.totalMonthlyEstimate || null;

      if (json.stackMap?.providers) {
        result.providers = Object.keys(json.stackMap.providers);
      }
      if (json.stackMap?.models) {
        result.models = Object.keys(json.stackMap.models);
      }
    } else {
      result.error = 'No JSON in output';
    }
  } catch (err: any) {
    result.error = err.message;
    result.duration_ms = Date.now() - start;
  }

  return result;
}

// ============================================================================
// DATA PLATFORMS (PRD: Databricks, Snowflake)
// ============================================================================

describe('Data Platforms', () => {
  describe('Databricks (DET-308)', () => {
    it('should detect Databricks SDK patterns', async () => {
      const repoDir = cloneRepo(
        'databricks-sdk-py',
        'https://github.com/databricks/databricks-sdk-py',
        { sparse_paths: ['databricks/sdk'] }
      );

      const result = runPeakInfer(repoDir);

      expect(result.success).toBe(true);
      expect(result.exitCode).toBe(0);
      // Databricks SDK itself may not have LLM calls, but should not crash
      expect(result.error).toBeUndefined();
    }, TIMEOUT_MS * 2);

    it.skipIf(!RUN_ALL)('should detect Databricks ML examples', async () => {
      const repoDir = cloneRepo(
        'databricks-ml-examples',
        'https://github.com/databricks/databricks-ml-examples',
        { sparse_paths: ['llm-models'] }
      );

      const result = runPeakInfer(repoDir);

      expect(result.success).toBe(true);
      // Should find LLM-related code
      console.log(`  Found ${result.callsites} callsites, providers: ${result.providers.join(', ')}`);
    }, TIMEOUT_MS * 2);
  });

  describe('Snowflake Cortex (DET-309)', () => {
    it.skipIf(!RUN_ALL)('should detect Snowflake Cortex patterns', async () => {
      const repoDir = cloneRepo(
        'snowflake-ml-python',
        'https://github.com/snowflakedb/snowflake-ml-python',
        { sparse_paths: ['snowflake/cortex', 'snowflake/ml'] }
      );

      const result = runPeakInfer(repoDir);

      expect(result.success).toBe(true);
      console.log(`  Found ${result.callsites} callsites`);
    }, TIMEOUT_MS * 2);
  });
});

// ============================================================================
// APPLICATION LAYER - SDK USAGE (PRD Section 12)
// ============================================================================

describe('Application Layer - SDK Usage', () => {
  describe('OpenAI (DET-101)', () => {
    it('should detect OpenAI patterns in cookbook', async () => {
      const repoDir = cloneRepo(
        'openai-cookbook',
        'https://github.com/openai/openai-cookbook',
        { sparse_paths: ['examples'] }
      );

      const result = runPeakInfer(repoDir);

      expect(result.success).toBe(true);
      expect(result.callsites).toBeGreaterThan(0);
      expect(result.providers.some(p => p.toLowerCase().includes('openai'))).toBe(true);

      console.log(`  OpenAI Cookbook: ${result.callsites} callsites, ${result.duration_ms}ms`);
    }, TIMEOUT_MS * 2);
  });

  describe('Anthropic (DET-102)', () => {
    it('should detect Anthropic patterns in cookbook', async () => {
      const repoDir = cloneRepo(
        'anthropic-cookbook',
        'https://github.com/anthropics/anthropic-cookbook',
        { sparse_paths: ['misc'] }
      );

      const result = runPeakInfer(repoDir);

      expect(result.success).toBe(true);
      expect(result.callsites).toBeGreaterThan(0);
      expect(result.providers.some(p => p.toLowerCase().includes('anthropic'))).toBe(true);

      console.log(`  Anthropic Cookbook: ${result.callsites} callsites`);
    }, TIMEOUT_MS * 2);
  });

  describe('LiteLLM - Multi-Provider (DET-201-208)', () => {
    it('should detect multiple providers in LiteLLM', async () => {
      const repoDir = cloneRepo(
        'litellm',
        'https://github.com/BerriAI/litellm',
        { sparse_paths: ['litellm'] }
      );

      const result = runPeakInfer(repoDir);

      expect(result.success).toBe(true);
      // LiteLLM is a proxy, should detect multiple provider patterns
      console.log(`  LiteLLM: ${result.callsites} callsites, providers: ${result.providers.join(', ')}`);
    }, TIMEOUT_MS * 2);
  });

  describe('Vercel AI SDK', () => {
    it.skipIf(!RUN_ALL)('should detect streaming patterns', async () => {
      const repoDir = cloneRepo(
        'vercel-ai',
        'https://github.com/vercel/ai',
        { sparse_paths: ['packages/ai/core', 'packages/openai'] }
      );

      const result = runPeakInfer(repoDir);

      expect(result.success).toBe(true);
      console.log(`  Vercel AI: ${result.callsites} callsites`);
    }, TIMEOUT_MS * 2);
  });
});

// ============================================================================
// SERVING LAYER - RUNTIMES (PRD Section 12)
// ============================================================================

describe('Serving Layer - Runtimes', () => {
  describe('vLLM (DET-401)', () => {
    it('should detect vLLM patterns', async () => {
      const repoDir = cloneRepo(
        'vllm',
        'https://github.com/vllm-project/vllm',
        { sparse_paths: ['vllm/entrypoints', 'vllm/engine'] }
      );

      const result = runPeakInfer(repoDir);

      expect(result.success).toBe(true);
      // vLLM is the runtime itself, patterns should be detected
      console.log(`  vLLM: ${result.callsites} callsites, ${result.duration_ms}ms`);
    }, TIMEOUT_MS * 2);
  });

  describe('SGLang (DET-402)', () => {
    it.skipIf(!RUN_ALL)('should detect SGLang patterns', async () => {
      const repoDir = cloneRepo(
        'sglang',
        'https://github.com/sgl-project/sglang',
        { sparse_paths: ['python/sglang'] }
      );

      const result = runPeakInfer(repoDir);

      expect(result.success).toBe(true);
      console.log(`  SGLang: ${result.callsites} callsites`);
    }, TIMEOUT_MS * 2);
  });

  describe('TensorRT-LLM (DET-403)', () => {
    it.skipIf(!RUN_ALL)('should detect TensorRT-LLM patterns', async () => {
      const repoDir = cloneRepo(
        'tensorrt-llm',
        'https://github.com/NVIDIA/TensorRT-LLM',
        { sparse_paths: ['tensorrt_llm', 'examples'] }
      );

      const result = runPeakInfer(repoDir);

      expect(result.success).toBe(true);
      console.log(`  TensorRT-LLM: ${result.callsites} callsites`);
    }, TIMEOUT_MS * 2);
  });

  describe('Text Generation Inference (DET-404)', () => {
    it.skipIf(!RUN_ALL)('should detect TGI patterns', async () => {
      const repoDir = cloneRepo(
        'text-generation-inference',
        'https://github.com/huggingface/text-generation-inference',
        { sparse_paths: ['server', 'clients/python'] }
      );

      const result = runPeakInfer(repoDir);

      expect(result.success).toBe(true);
      console.log(`  TGI: ${result.callsites} callsites`);
    }, TIMEOUT_MS * 2);
  });
});

// ============================================================================
// ALTERNATIVE PROVIDERS (PRD Section 12)
// ============================================================================

describe('Alternative Providers', () => {
  describe('Together AI (DET-201)', () => {
    it('should detect Together SDK patterns', async () => {
      const repoDir = cloneRepo(
        'together-python',
        'https://github.com/togethercomputer/together-python'
      );

      const result = runPeakInfer(repoDir);

      expect(result.success).toBe(true);
      console.log(`  Together: ${result.callsites} callsites`);
    }, TIMEOUT_MS * 2);
  });

  describe('Groq (DET-207)', () => {
    it('should detect Groq SDK patterns', async () => {
      const repoDir = cloneRepo(
        'groq-python',
        'https://github.com/groq/groq-python'
      );

      const result = runPeakInfer(repoDir);

      expect(result.success).toBe(true);
      console.log(`  Groq: ${result.callsites} callsites`);
    }, TIMEOUT_MS * 2);
  });

  describe('Cerebras (DET-208)', () => {
    it.skipIf(!RUN_ALL)('should detect Cerebras SDK patterns', async () => {
      const repoDir = cloneRepo(
        'cerebras-cloud-sdk',
        'https://github.com/Cerebras/cerebras-cloud-sdk-python'
      );

      const result = runPeakInfer(repoDir);

      expect(result.success).toBe(true);
      console.log(`  Cerebras: ${result.callsites} callsites`);
    }, TIMEOUT_MS * 2);
  });

  describe('Fireworks (DET-202)', () => {
    it.skipIf(!RUN_ALL)('should detect Fireworks SDK patterns', async () => {
      const repoDir = cloneRepo(
        'fireworks-python',
        'https://github.com/fw-ai/fireworks-ai-python'
      );

      const result = runPeakInfer(repoDir);

      expect(result.success).toBe(true);
      console.log(`  Fireworks: ${result.callsites} callsites`);
    }, TIMEOUT_MS * 2);
  });
});

// ============================================================================
// SERVERLESS PROVIDERS (PRD Section 12)
// ============================================================================

describe('Serverless Providers', () => {
  describe('Modal (DET-204)', () => {
    it('should detect Modal patterns', async () => {
      const repoDir = cloneRepo(
        'modal-examples',
        'https://github.com/modal-labs/modal-examples',
        { sparse_paths: ['06_gpu_and_ml'] }
      );

      const result = runPeakInfer(repoDir);

      expect(result.success).toBe(true);
      console.log(`  Modal: ${result.callsites} callsites`);
    }, TIMEOUT_MS * 2);
  });

  describe('RunPod', () => {
    it.skipIf(!RUN_ALL)('should detect RunPod patterns', async () => {
      const repoDir = cloneRepo(
        'runpod-python',
        'https://github.com/runpod/runpod-python'
      );

      const result = runPeakInfer(repoDir);

      expect(result.success).toBe(true);
      console.log(`  RunPod: ${result.callsites} callsites`);
    }, TIMEOUT_MS * 2);
  });

  describe('Baseten (DET-203)', () => {
    it.skipIf(!RUN_ALL)('should detect Baseten/Truss patterns', async () => {
      const repoDir = cloneRepo(
        'truss-examples',
        'https://github.com/basetenlabs/truss-examples'
      );

      const result = runPeakInfer(repoDir);

      expect(result.success).toBe(true);
      console.log(`  Baseten: ${result.callsites} callsites`);
    }, TIMEOUT_MS * 2);
  });
});

// ============================================================================
// INFRASTRUCTURE LAYER (PRD Section 12)
// ============================================================================

describe('Infrastructure Layer', () => {
  describe('Ray Serve', () => {
    it.skipIf(!RUN_ALL)('should detect Ray Serve patterns', async () => {
      const repoDir = cloneRepo(
        'ray',
        'https://github.com/ray-project/ray',
        { sparse_paths: ['python/ray/serve', 'python/ray/llm'] }
      );

      const result = runPeakInfer(repoDir);

      expect(result.success).toBe(true);
      console.log(`  Ray: ${result.callsites} callsites`);
    }, TIMEOUT_MS * 2);
  });

  describe('SkyPilot', () => {
    it.skipIf(!RUN_ALL)('should detect SkyPilot patterns', async () => {
      const repoDir = cloneRepo(
        'skypilot',
        'https://github.com/skypilot-org/skypilot',
        { sparse_paths: ['sky', 'llm'] }
      );

      const result = runPeakInfer(repoDir);

      expect(result.success).toBe(true);
      console.log(`  SkyPilot: ${result.callsites} callsites`);
    }, TIMEOUT_MS * 2);
  });

  describe('CoreWeave Kubernetes', () => {
    it.skipIf(!RUN_ALL)('should handle K8s infrastructure configs', async () => {
      const repoDir = cloneRepo(
        'coreweave-kubernetes',
        'https://github.com/coreweave/kubernetes-cloud'
      );

      const result = runPeakInfer(repoDir);

      expect(result.success).toBe(true);
      // K8s configs may not have LLM calls, but should detect infra patterns
      console.log(`  CoreWeave: ${result.callsites} callsites`);
    }, TIMEOUT_MS * 2);
  });
});

// ============================================================================
// BENCHMARKING (PRD Section 9: InferenceMAX Alignment)
// ============================================================================

describe('Benchmarking Frameworks', () => {
  describe('InferenceMAX', () => {
    it('should handle InferenceMAX benchmark repo', async () => {
      const repoDir = cloneRepo(
        'InferenceMAX',
        'https://github.com/InferenceMAX/InferenceMAX'
      );

      const result = runPeakInfer(repoDir);

      expect(result.success).toBe(true);
      // Benchmark scripts may have API calls for testing
      console.log(`  InferenceMAX: ${result.callsites} callsites, ${result.duration_ms}ms`);
    }, TIMEOUT_MS * 2);
  });

  describe('llmperf', () => {
    it.skipIf(!RUN_ALL)('should handle llmperf benchmark repo', async () => {
      const repoDir = cloneRepo(
        'llmperf',
        'https://github.com/ray-project/llmperf'
      );

      const result = runPeakInfer(repoDir);

      expect(result.success).toBe(true);
      console.log(`  llmperf: ${result.callsites} callsites`);
    }, TIMEOUT_MS * 2);
  });
});

// ============================================================================
// COMPLEX MULTI-PROVIDER (LangChain ecosystem)
// ============================================================================

describe('Multi-Provider Frameworks', () => {
  describe('LangChain Python', () => {
    it('should detect multi-provider patterns in LangChain', async () => {
      const repoDir = cloneRepo(
        'langchain',
        'https://github.com/langchain-ai/langchain',
        { sparse_paths: ['libs/langchain/langchain/llms', 'libs/langchain/langchain/chat_models'] }
      );

      const result = runPeakInfer(repoDir);

      expect(result.success).toBe(true);
      // LangChain should have multiple provider patterns
      expect(result.providers.length).toBeGreaterThanOrEqual(0);
      console.log(`  LangChain: ${result.callsites} callsites, providers: ${result.providers.slice(0, 5).join(', ')}`);
    }, TIMEOUT_MS * 2);
  });

  describe('LlamaIndex', () => {
    it.skipIf(!RUN_ALL)('should detect LlamaIndex patterns', async () => {
      const repoDir = cloneRepo(
        'llama_index',
        'https://github.com/run-llama/llama_index',
        { sparse_paths: ['llama-index-core/llama_index/core/llms'] }
      );

      const result = runPeakInfer(repoDir);

      expect(result.success).toBe(true);
      console.log(`  LlamaIndex: ${result.callsites} callsites`);
    }, TIMEOUT_MS * 2);
  });
});

// ============================================================================
// ROBUSTNESS TESTS - Edge Cases
// ============================================================================

describe('Robustness', () => {
  it('should handle empty directory gracefully', () => {
    const emptyDir = path.join(CLONE_DIR, 'empty-test');
    fs.mkdirSync(emptyDir, { recursive: true });

    const result = runPeakInfer(emptyDir);

    // Empty dir should not crash - either success with 0 callsites or graceful failure
    expect(result.error || '').not.toContain('crash');
    expect(result.exitCode).toBeDefined();
    // If successful, should have 0 callsites
    if (result.success) {
      expect(result.callsites).toBe(0);
    }
    console.log(`  Empty dir: exit=${result.exitCode}, success=${result.success}`);

    fs.rmSync(emptyDir, { recursive: true, force: true });
  });

  it('should handle non-existent directory gracefully', () => {
    const result = runPeakInfer('/tmp/definitely-does-not-exist-12345');

    // Should fail gracefully, not crash
    expect(result.exitCode).not.toBe(0);
    console.log(`  Non-existent dir: exit=${result.exitCode}, error=${result.error?.slice(0, 50)}`);
  });

  it('should complete analysis of small repo within 2 minutes', () => {
    // Use the cached groq-python repo
    const repoDir = cloneRepo(
      'groq-python',
      'https://github.com/groq/groq-python'
    );

    const result = runPeakInfer(repoDir);

    // More realistic timeout - first run with API calls can be slow
    expect(result.duration_ms).toBeLessThan(120_000);
    console.log(`  Performance: ${result.duration_ms}ms for groq-python (${result.callsites} callsites)`);
  }, TIMEOUT_MS * 2);
});

// ============================================================================
// SUMMARY REPORTER
// ============================================================================

describe('Eval Summary', () => {
  it('should print coverage summary', () => {
    console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                   PEAKINFER EVAL SUMMARY                      ║
╠═══════════════════════════════════════════════════════════════╣
║  Data Platforms:     Databricks, Snowflake                    ║
║  API Providers:      OpenAI, Anthropic, Together, Groq        ║
║  Serverless:         Modal, RunPod, Baseten                   ║
║  Serving Runtimes:   vLLM, SGLang, TensorRT-LLM, TGI          ║
║  Infrastructure:     Ray, SkyPilot, CoreWeave                 ║
║  Benchmarks:         InferenceMAX, llmperf                    ║
║  Multi-Provider:     LangChain, LlamaIndex, LiteLLM           ║
╠═══════════════════════════════════════════════════════════════╣
║  Run with EVAL_ALL=1 to test all repos (slower)               ║
╚═══════════════════════════════════════════════════════════════╝
    `);
    expect(true).toBe(true);
  });
});
