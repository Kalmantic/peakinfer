import { glob } from 'glob';
import ignoreDefault from 'ignore';
import { readFileSync, existsSync, statSync } from 'fs';
import { join, relative, extname } from 'path';
import type { ScanResult, ScanCandidate } from './types.js';

// Handle ESM default import with type assertion for NodeNext resolution
const ignore = ignoreDefault as unknown as (options?: { ignorecase?: boolean }) => {
  add(patterns: string | readonly string[]): void;
  ignores(pathname: string): boolean;
};

interface IgnoreInstance {
  add(patterns: string | readonly string[]): void;
  ignores(pathname: string): boolean;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const DEFAULT_IGNORES = [
  'node_modules/**',
  'dist/**',
  '.git/**',
  '__pycache__/**',
  '*.pyc',
  '.venv/**',
  'venv/**',
  '.env/**',
  'env/**',
  '*_env/**',      // Python virtual environments (e.g., browser_use_env)
  '*_venv/**',     // Python virtual environments
  '*-env/**',      // Python virtual environments
  '*-venv/**',     // Python virtual environments
  'virtualenv/**',
  'build/**',
  'target/**',
  '.next/**',
  '.nuxt/**',
  'coverage/**',
  '.cache/**',
  '.tox/**',
  '.eggs/**',
  '*.egg-info/**',
];

// v1.9.5: Files to skip for cost optimization
const SKIP_PATTERNS = [
  // Test files
  '**/*.test.*',
  '**/*.spec.*',
  '**/__tests__/**',
  '**/test/**',
  '**/tests/**',
  '**/*.test.ts',
  '**/*.test.js',
  '**/*.spec.ts',
  '**/*.spec.js',
  '**/test_*.py',
  '**/*_test.py',
  '**/*_test.go',
  // Config files
  '**/jest.config.*',
  '**/vitest.config.*',
  '**/webpack.config.*',
  '**/rollup.config.*',
  '**/vite.config.*',
  '**/tsconfig.json',
  '**/package.json',
  '**/package-lock.json',
  '**/yarn.lock',
  '**/pnpm-lock.yaml',
  // Documentation
  '**/*.md',
  '**/docs/**',
  '**/documentation/**',
  // Generated files
  '**/generated/**',
  '**/*.generated.*',
  '**/*.d.ts',
  // Fixtures and mocks
  '**/fixtures/**',
  '**/mocks/**',
  '**/__mocks__/**',
  '**/snapshots/**',
  '**/__snapshots__/**',
];

// v1.9.5: Maximum file size in bytes (50KB)
const MAX_FILE_SIZE = 50 * 1024;

const LANGUAGE_MAP: Record<string, string> = {
  '.py': 'python',
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.go': 'go',
  '.java': 'java',
  '.kt': 'kotlin',
  '.rs': 'rust',
  '.rb': 'ruby',
  '.php': 'php',
  '.cs': 'csharp',
  '.swift': 'swift',
  '.scala': 'scala',
};

const CODE_EXTENSIONS = Object.keys(LANGUAGE_MAP);

// Patterns that indicate LLM inference calls
const INFERENCE_PATTERNS = [
  // ==========================================================================
  // OpenAI SDK
  // ==========================================================================
  /\.chat\.completions\.create\(/,
  /openai\.completions\.create\(/,
  /\.completions\.create\(/,
  // NOTE: Removed /OpenAI\(\)/ - client initialization, not an inference call
  // NOTE: Removed /AsyncOpenAI\(\)/ - client initialization, not an inference call
  /openai\.ChatCompletion\.create\(/,
  /openai\.Completion\.create\(/,
  /\.embeddings\.create\(/,  // OpenAI embeddings API

  // ==========================================================================
  // Anthropic SDK
  // ==========================================================================
  /\.messages\.create\(/,
  /anthropic\.messages\(/,
  /\.create_message\(/,
  // NOTE: Removed /Anthropic\(\)/ - client initialization, not an inference call
  // NOTE: Removed /AsyncAnthropic\(\)/ - client initialization, not an inference call
  /anthropic\.completions\(/,

  // ==========================================================================
  // Google AI / Vertex AI
  // ==========================================================================
  /\.generate_content\(/,
  /genai\.GenerativeModel\(/,
  /GenerativeModel\(/,
  /vertexai\.generative_models/,
  /aiplatform\.gapic/,

  // ==========================================================================
  // Mistral
  // ==========================================================================
  /MistralClient\(/,
  /mistral\.chat\(/,
  /mistral\.complete\(/,

  // ==========================================================================
  // Cohere
  // ==========================================================================
  /cohere\.chat\(/,
  /cohere\.generate\(/,
  /CohereClient\(/,

  // ==========================================================================
  // Together AI
  // ==========================================================================
  /together\.chat\./,
  /Together\(\)/,
  /together\.completions/,
  /together_ai/,

  // ==========================================================================
  // Fireworks AI
  // ==========================================================================
  /fireworks\.chat\./,
  /Fireworks\(/,
  /fireworks\.completions/,
  /fireworks_ai/,

  // ==========================================================================
  // Groq
  // ==========================================================================
  /groq\.chat\./,
  /Groq\(\)/,
  /groq\.completions/,

  // ==========================================================================
  // Replicate
  // ==========================================================================
  /replicate\.run\(/,
  /replicate\.predictions\.create\(/,
  /Replicate\(\)/,

  // ==========================================================================
  // Perplexity
  // ==========================================================================
  /perplexity\.chat\./,
  /PerplexityClient\(/,

  // ==========================================================================
  // AWS Bedrock
  // ==========================================================================
  /bedrock-runtime/,
  /invoke_model\(/,
  /InvokeModel/,
  /BedrockRuntime\(/,
  /bedrock\.converse\(/,

  // ==========================================================================
  // Azure OpenAI
  // ==========================================================================
  /AzureOpenAI\(/,
  /azure\.openai/,
  /openai\.azure/,

  // ==========================================================================
  // LangChain
  // ==========================================================================
  /ChatOpenAI\(/,
  /ChatAnthropic\(/,
  /ChatGoogleGenerativeAI\(/,
  /ChatMistralAI\(/,
  /ChatCohere\(/,
  /ChatGroq\(/,
  /ChatFireworks\(/,
  /ChatTogether\(/,
  /ChatBedrock\(/,
  /ChatVertexAI\(/,
  /ChatOllama\(/,
  /LLMChain\(/,
  /ConversationChain\(/,

  // ==========================================================================
  // LlamaIndex
  // ==========================================================================
  /llama_index\.llms/,
  /OpenAILike\(/,
  /Ollama\(/,
  /LlamaCPP\(/,

  // ==========================================================================
  // DSPy Framework
  // ==========================================================================
  /dspy\.Predict\(/,
  /dspy\.ChainOfThought\(/,
  /dspy\.ProgramOfThought\(/,
  /dspy\.ReAct\(/,
  /dspy\.Retrieve\(/,
  /dspy\.generate\(/,
  /dspy\.forward\(/,
  /\.forward\(.*question/,  // DSPy module forward calls with question param

  // ==========================================================================
  // vLLM (Self-hosted)
  // ==========================================================================
  /vllm\.generate/,
  /vllm\.LLM\(/,
  /from vllm import/,
  /vllm\.SamplingParams/,
  /vllm\.AsyncLLMEngine/,
  /vllm\.entrypoints/,
  /\/v1\/completions/,  // OpenAI-compatible endpoint

  // ==========================================================================
  // SGLang (Self-hosted)
  // ==========================================================================
  /sglang\.generate/,
  /sglang\.Engine\(/,
  /from sglang import/,
  /sglang\.RuntimeEndpoint/,
  /sglang\.function/,
  /sglang\.gen\(/,

  // ==========================================================================
  // TGI - Text Generation Inference (Self-hosted)
  // ==========================================================================
  /text-generation-inference/,
  /InferenceClient\(/,
  /huggingface_hub\.inference/,
  /text_generation\(/,
  /HuggingFaceEndpoint\(/,
  /tgi\.generate/,

  // ==========================================================================
  // Ollama (Local inference)
  // ==========================================================================
  /ollama\.generate/,
  /ollama\.chat/,
  /ollama\.create\(/,
  /ollama\.pull\(/,
  /from ollama import/,
  /Ollama\(\)/,
  /localhost:11434/,  // Default Ollama port
  /127\.0\.0\.1:11434/,

  // ==========================================================================
  // llama.cpp / llama-cpp-python (Bare metal)
  // ==========================================================================
  /llama_cpp/,
  /Llama\(/,
  /llama\.generate/,
  /llama\.create_completion/,
  /llama\.create_chat_completion/,
  /from llama_cpp import/,
  /LlamaCpp\(/,

  // ==========================================================================
  // Transformers / HuggingFace (Bare metal)
  // ==========================================================================
  /pipeline\("text-generation"/,
  /pipeline\('text-generation'/,
  /AutoModelForCausalLM/,
  /AutoModelForSeq2SeqLM/,
  /\.generate\(input_ids/,
  /transformers\.pipeline/,
  /model\.generate\(/,

  // ==========================================================================
  // GGUF / GGML models
  // ==========================================================================
  /\.gguf/,
  /\.ggml/,
  /ctransformers/,
  /CTransformers\(/,

  // ==========================================================================
  // ExLlama / ExLlamaV2 (Bare metal, GPU optimized)
  // ==========================================================================
  /exllama/,
  /ExLlama/,
  /exllamav2/,
  /ExLlamaV2/,

  // ==========================================================================
  // Generic patterns (conservative - only match with LLM context)
  // ==========================================================================
  // NOTE: Removed overly generic patterns that cause false positives:
  // - /\.invoke\(/ - too generic, matches any invoke method
  // - /\.generate\(/ - too generic, matches generators, UUIDs, etc.
  // - /\.chat\(/ - too generic, matches any chat method
  // - /llm\./i - case-insensitive, matches "film.", variable names
  // - /\.llm\(/ - too generic without context
  // - /LLM\(/ - only keep if clearly a class instantiation
  /\.ainvoke\(/,  // LangChain async invoke - specific enough
  /\.complete\(/,  // Usually LLM-specific
  /ChatModel\(/,   // Usually LLM-specific class
  /completion_tokens/,  // OpenAI response field
  /prompt_tokens/,      // OpenAI response field
];

// =============================================================================
// HELPERS
// =============================================================================

function detectLanguage(filePath: string): string {
  const ext = extname(filePath).toLowerCase();
  return LANGUAGE_MAP[ext] || 'unknown';
}

function countLines(content: string): number {
  if (!content) return 0;
  return content.split('\n').filter(line => line.trim().length > 0).length;
}

function loadGitignore(root: string, skipOptimization = true): IgnoreInstance {
  const ig = ignore();

  // Add default ignores
  ig.add(DEFAULT_IGNORES);

  // v1.9.5: Add cost optimization skip patterns
  if (skipOptimization) {
    ig.add(SKIP_PATTERNS);
  }

  // Load .gitignore if exists
  const gitignorePath = join(root, '.gitignore');
  if (existsSync(gitignorePath)) {
    try {
      const content = readFileSync(gitignorePath, 'utf-8');
      ig.add(content);
    } catch {
      // Ignore errors reading .gitignore
    }
  }

  return ig;
}

function findCandidatesInContent(filePath: string, content: string): ScanCandidate[] {
  const candidates: ScanCandidate[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    for (const pattern of INFERENCE_PATTERNS) {
      if (pattern.test(line)) {
        candidates.push({
          file: filePath,
          line: i + 1, // 1-indexed
          snippet: line.trim().slice(0, 100), // First 100 chars
        });
        break; // Only one candidate per line
      }
    }
  }

  return candidates;
}

// =============================================================================
// PUBLIC API
// =============================================================================

export interface ScanOptions {
  /** Skip test files, configs, etc. for cost optimization (default: true) */
  skipOptimization?: boolean;
  /** Maximum file size in bytes (default: 50KB) */
  maxFileSize?: number;
  /** Include files even if no inference patterns found */
  includeAll?: boolean;
}

export async function scan(root: string, options: ScanOptions = {}): Promise<ScanResult> {
  const {
    skipOptimization = true,
    maxFileSize = MAX_FILE_SIZE,
    includeAll = false,
  } = options;

  // Validate directory exists
  if (!existsSync(root)) {
    throw new Error(`Directory not found: ${root}`);
  }

  const stat = statSync(root);
  if (!stat.isDirectory()) {
    throw new Error(`Not a directory: ${root}`);
  }

  const ig = loadGitignore(root, skipOptimization);

  // Build glob pattern for code files
  const patterns = CODE_EXTENSIONS.map(ext => `**/*${ext}`);

  // Find all matching files
  const absolutePaths = await glob(patterns, {
    cwd: root,
    absolute: true,
    nodir: true,
    dot: false,
  });

  // Process files
  const files: ScanResult['files'] = [];
  const candidates: ScanCandidate[] = [];
  const languageSet = new Set<string>();

  let skippedLargeFiles = 0;
  let skippedByPattern = 0;

  for (const absPath of absolutePaths) {
    const relPath = relative(root, absPath);

    // Check against ignore patterns
    if (ig.ignores(relPath)) {
      skippedByPattern++;
      continue;
    }

    try {
      // v1.9.5: Check file size before reading
      const fileStat = statSync(absPath);
      if (fileStat.size > maxFileSize) {
        skippedLargeFiles++;
        continue;
      }

      const content = readFileSync(absPath, 'utf-8');
      const language = detectLanguage(absPath);
      const loc = countLines(content);

      // Find inference call candidates
      const fileCandidates = findCandidatesInContent(relPath, content);

      // v1.9.5: Only include files with candidates (unless includeAll)
      if (includeAll || fileCandidates.length > 0) {
        files.push({
          path: relPath,
          language,
          loc,
        });

        languageSet.add(language);
        candidates.push(...fileCandidates);
      }
    } catch {
      // Skip files that can't be read
    }
  }

  // Calculate summary
  const totalLoc = files.reduce((sum, f) => sum + f.loc, 0);

  return {
    root,
    files,
    candidates,
    summary: {
      totalFiles: files.length,
      totalLoc,
      languages: Array.from(languageSet).sort(),
      totalCandidates: candidates.length,
      // v1.9.5: Cost optimization stats
      skippedLargeFiles,
      skippedByPattern,
    },
  };
}
