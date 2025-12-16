/**
 * Import Analyzer Agent
 * Analyzes file imports to identify LLM SDKs, frameworks, and custom wrappers
 */

import Anthropic from '@anthropic-ai/sdk';
import { readFileSync } from 'fs';
import { join } from 'path';
import YAML from 'yaml';

// Types
export interface SDK {
  name: string;
  provider: string;
  import_line: number;
  alias: string | null;
  confidence: number;
}

export interface Framework {
  name: string;
  import_line: number;
  components: string[];
  confidence: number;
}

export interface CustomWrapper {
  name: string;
  import_path: string;
  likely_purpose: string;
  needs_tracing: boolean;
  confidence: number;
}

export interface Infrastructure {
  name: string;
  type: string;
  import_line: number;
}

export interface ImportAnalyzerOutput {
  sdks: SDK[];
  frameworks: Framework[];
  custom_wrappers: CustomWrapper[];
  infrastructure: Infrastructure[];
  summary: {
    has_llm_usage: boolean;
    primary_provider: string | null;
    framework: string | null;
    complexity: 'simple' | 'moderate' | 'complex';
  };
}

export interface ImportAnalyzerInput {
  file_path: string;
  language: string;
  imports_section: string;
  full_file: string;
}

// Load prompt template
function loadPromptTemplate(): string {
  const promptPath = join(process.cwd(), 'prompts', 'import-analyzer.yaml');
  const promptContent = readFileSync(promptPath, 'utf-8');
  const prompt = YAML.parse(promptContent);
  return prompt.system;
}

// Fallback analysis when no API key
function fallbackAnalysis(input: ImportAnalyzerInput): ImportAnalyzerOutput {
  const sdks: SDK[] = [];
  const frameworks: Framework[] = [];
  const lines = input.full_file.split('\n');

  // Regex patterns for common LLM imports
  const sdkPatterns = [
    { regex: /import\s+openai|from\s+openai/i, provider: 'openai', name: 'openai' },
    { regex: /import\s+anthropic|from\s+anthropic/i, provider: 'anthropic', name: 'anthropic' },
    { regex: /from\s+cohere/i, provider: 'cohere', name: 'cohere' },
    { regex: /from\s+google\.generativeai|import\s+google\.generativeai/i, provider: 'google', name: 'google-generativeai' },
    { regex: /from\s+azure\.ai\.openai|@azure\/openai/i, provider: 'azure', name: 'azure-openai' },
    { regex: /from\s+boto3.*bedrock|@aws-sdk\/client-bedrock/i, provider: 'bedrock', name: 'aws-bedrock' },
    { regex: /from\s+ollama|import\s+ollama/i, provider: 'ollama', name: 'ollama' },
    { regex: /from\s+vllm|import\s+vllm/i, provider: 'vllm', name: 'vllm' },
    { regex: /tritonclient|from\s+triton/i, provider: 'triton', name: 'triton' },
    { regex: /tensorrt_llm/i, provider: 'tensorrt', name: 'tensorrt-llm' },
  ];

  const frameworkPatterns = [
    { regex: /from\s+langchain|import\s+langchain/i, name: 'langchain' },
    { regex: /from\s+llama_index|import\s+llama_index|from\s+llamaindex/i, name: 'llamaindex' },
    { regex: /from\s+dspy|import\s+dspy/i, name: 'dspy' },
    { regex: /from\s+haystack/i, name: 'haystack' },
    { regex: /from\s+semantic_kernel/i, name: 'semantic_kernel' },
    { regex: /from\s+autogen/i, name: 'autogen' },
    { regex: /from\s+crewai/i, name: 'crewai' },
  ];

  lines.forEach((line, idx) => {
    const lineNum = idx + 1;

    // Check SDK patterns
    for (const pattern of sdkPatterns) {
      if (pattern.regex.test(line)) {
        sdks.push({
          name: pattern.name,
          provider: pattern.provider,
          import_line: lineNum,
          alias: null,
          confidence: 0.9,
        });
        break;
      }
    }

    // Check framework patterns
    for (const pattern of frameworkPatterns) {
      if (pattern.regex.test(line)) {
        frameworks.push({
          name: pattern.name,
          import_line: lineNum,
          components: [],
          confidence: 0.9,
        });
        break;
      }
    }
  });

  const primaryProvider = sdks.length > 0 ? sdks[0].provider : null;
  const framework = frameworks.length > 0 ? frameworks[0].name : null;

  return {
    sdks,
    frameworks,
    custom_wrappers: [],
    infrastructure: [],
    summary: {
      has_llm_usage: sdks.length > 0 || frameworks.length > 0,
      primary_provider: primaryProvider,
      framework,
      complexity: frameworks.length > 0 ? 'moderate' : 'simple',
    },
  };
}

// Main agent function
export async function analyzeImports(input: ImportAnalyzerInput): Promise<ImportAnalyzerOutput> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return fallbackAnalysis(input);
  }

  const client = new Anthropic({ apiKey });
  const systemPrompt = loadPromptTemplate();

  const userMessage = `Analyze the following ${input.language} file for LLM-related imports:

File: ${input.file_path}

\`\`\`${input.language}
${input.full_file}
\`\`\`

Return your analysis as JSON matching the output_format schema.`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    });

    const content = response.content[0];
    if (content.type === 'text') {
      // Extract JSON from response
      const jsonMatch = content.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]) as ImportAnalyzerOutput;
      }
    }

    return fallbackAnalysis(input);
  } catch (error) {
    console.error('Import analyzer error:', error);
    return fallbackAnalysis(input);
  }
}

export class ImportAnalyzerAgent {
  name = 'ImportAnalyzerAgent';
  description = 'Analyzes file imports to identify LLM SDKs, frameworks, and custom wrappers';

  async execute(input: ImportAnalyzerInput): Promise<ImportAnalyzerOutput> {
    return analyzeImports(input);
  }
}
