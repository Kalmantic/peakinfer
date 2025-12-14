/**
 * Agent-based Semantic Analyzer for PeakInfer
 *
 * Uses Claude's tool use capability for multi-step code analysis:
 * 1. Read source files
 * 2. Extract patterns and variable assignments
 * 3. Trace variable definitions to resolve model names
 * 4. Identify actual LLM callsites (not client initialization)
 */

import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';
import { readFileSync, existsSync } from 'fs';
import { join, relative } from 'path';
import { glob } from 'glob';
import type { ScanResult, Callsite, Provider, Patterns } from './types.js';
import { createHash } from 'crypto';
import { loadPrompt, getDefaultPrompt, loadConfig, getConfiguredModel } from './templates.js';

// =============================================================================
// TYPES
// =============================================================================

interface AgentCallsite {
  file: string;
  line: number;
  provider: string | null;
  model: string | null;
  framework: string | null;
  patterns: Partial<Patterns>;
  confidence: number;
  reasoning: string;
}

interface AgentInsight {
  severity: 'critical' | 'warning' | 'info';
  category: string;
  headline: string;
  evidence: string;
  location: string;
  recommendation?: string;
}

interface AgentAnalysisResult {
  callsites: AgentCallsite[];
  insights: AgentInsight[];
}

interface ToolResult {
  type: 'tool_result';
  tool_use_id: string;
  content: string;
}

// =============================================================================
// TOOLS DEFINITION
// =============================================================================

const AGENT_TOOLS: Anthropic.Tool[] = [
  {
    name: 'read_file',
    description: 'Read the contents of a source code file. Use this to examine code in detail.',
    input_schema: {
      type: 'object' as const,
      properties: {
        file_path: {
          type: 'string',
          description: 'Relative path to the file from project root',
        },
      },
      required: ['file_path'],
    },
  },
  {
    name: 'search_pattern',
    description: 'Search for a regex pattern across all source files. Returns matching lines with file and line number.',
    input_schema: {
      type: 'object' as const,
      properties: {
        pattern: {
          type: 'string',
          description: 'Regex pattern to search for (e.g., "dspy\\.LM\\(" or "model\\s*=")',
        },
        file_filter: {
          type: 'string',
          description: 'Optional glob pattern to filter files (e.g., "*.py" or "*.ts")',
        },
      },
      required: ['pattern'],
    },
  },
  {
    name: 'trace_variable',
    description: 'Find where a variable is defined or assigned in a file. Useful for tracing model names.',
    input_schema: {
      type: 'object' as const,
      properties: {
        file_path: {
          type: 'string',
          description: 'File to search in',
        },
        variable_name: {
          type: 'string',
          description: 'Variable name to trace (e.g., "model", "lm", "client")',
        },
      },
      required: ['file_path', 'variable_name'],
    },
  },
  {
    name: 'report_callsites',
    description: 'Report discovered LLM callsites. Call this when you have identified callsites with their details.',
    input_schema: {
      type: 'object' as const,
      properties: {
        callsites: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              file: { type: 'string', description: 'File path' },
              line: { type: 'number', description: 'Line number of the actual inference call' },
              provider: { type: 'string', description: 'Provider: openai, anthropic, google, etc.' },
              model: { type: 'string', description: 'Exact model name as found in code' },
              framework: { type: 'string', description: 'Framework: dspy, langchain, llamaindex, or null' },
              reasoning: { type: 'string', description: 'Brief explanation of how you identified this' },
            },
            required: ['file', 'line', 'provider', 'reasoning'],
          },
          description: 'Array of identified callsites',
        },
      },
      required: ['callsites'],
    },
  },
];

// =============================================================================
// TOOL EXECUTION
// =============================================================================

class AgentToolExecutor {
  private projectRoot: string;
  private fileContents: Map<string, string>;
  private reportedCallsites: AgentCallsite[] = [];

  constructor(projectRoot: string, fileContents: Map<string, string>) {
    this.projectRoot = projectRoot;
    this.fileContents = fileContents;
  }

  async execute(toolName: string, toolInput: Record<string, unknown>): Promise<string> {
    switch (toolName) {
      case 'read_file':
        return this.readFile(toolInput.file_path as string);

      case 'search_pattern':
        return this.searchPattern(
          toolInput.pattern as string,
          toolInput.file_filter as string | undefined
        );

      case 'trace_variable':
        return this.traceVariable(
          toolInput.file_path as string,
          toolInput.variable_name as string
        );

      case 'report_callsites':
        return this.reportCallsites(toolInput.callsites as AgentCallsite[]);

      default:
        return `Unknown tool: ${toolName}`;
    }
  }

  private readFile(filePath: string): string {
    // Try from cache first
    if (this.fileContents.has(filePath)) {
      const content = this.fileContents.get(filePath)!;
      // Add line numbers for easier reference
      const numbered = content.split('\n')
        .map((line, i) => `${i + 1}: ${line}`)
        .join('\n');
      return numbered.slice(0, 8000); // Limit size
    }

    // Try reading from disk
    const absPath = join(this.projectRoot, filePath);
    if (existsSync(absPath)) {
      try {
        const content = readFileSync(absPath, 'utf-8');
        const numbered = content.split('\n')
          .map((line, i) => `${i + 1}: ${line}`)
          .join('\n');
        return numbered.slice(0, 8000);
      } catch (e) {
        return `Error reading file: ${e}`;
      }
    }

    return `File not found: ${filePath}`;
  }

  private searchPattern(pattern: string, fileFilter?: string): string {
    const results: string[] = [];
    const regex = new RegExp(pattern, 'gi');

    for (const [filePath, content] of this.fileContents) {
      // Apply file filter if provided
      if (fileFilter && !filePath.match(new RegExp(fileFilter.replace('*', '.*')))) {
        continue;
      }

      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (regex.test(lines[i])) {
          results.push(`${filePath}:${i + 1}: ${lines[i].trim().slice(0, 100)}`);
          if (results.length >= 20) break; // Limit results
        }
      }
      if (results.length >= 20) break;
    }

    return results.length > 0
      ? results.join('\n')
      : 'No matches found';
  }

  private traceVariable(filePath: string, variableName: string): string {
    const content = this.fileContents.get(filePath);
    if (!content) {
      return `File not found: ${filePath}`;
    }

    const results: string[] = [];
    const lines = content.split('\n');

    // Look for assignments and definitions
    const patterns = [
      new RegExp(`\\b${variableName}\\s*=\\s*(.+)`, 'g'),
      new RegExp(`\\bconst\\s+${variableName}\\s*=\\s*(.+)`, 'g'),
      new RegExp(`\\blet\\s+${variableName}\\s*=\\s*(.+)`, 'g'),
      new RegExp(`\\bvar\\s+${variableName}\\s*=\\s*(.+)`, 'g'),
      new RegExp(`\\bdef\\s+.*${variableName}.*:`, 'g'), // Python function param
      new RegExp(`${variableName}\\s*:\\s*(.+)`, 'g'), // Type annotation or dict key
    ];

    for (let i = 0; i < lines.length; i++) {
      for (const pattern of patterns) {
        if (pattern.test(lines[i])) {
          results.push(`Line ${i + 1}: ${lines[i].trim()}`);
          break;
        }
      }
    }

    return results.length > 0
      ? `Found ${results.length} references to "${variableName}":\n${results.join('\n')}`
      : `No definitions found for "${variableName}"`;
  }

  private reportCallsites(callsites: AgentCallsite[]): string {
    for (const cs of callsites) {
      this.reportedCallsites.push({
        file: cs.file,
        line: cs.line,
        provider: cs.provider || null,
        model: cs.model || null,
        framework: cs.framework || null,
        patterns: {},
        confidence: 0.9, // High confidence since agent verified
        reasoning: cs.reasoning,
      });
    }
    return `Recorded ${callsites.length} callsites. Total: ${this.reportedCallsites.length}`;
  }

  getReportedCallsites(): AgentCallsite[] {
    return this.reportedCallsites;
  }
}

// =============================================================================
// AGENT LOOP
// =============================================================================

const AGENT_SYSTEM_PROMPT = `You are an expert code analyst specializing in identifying LLM/AI inference points in source code.

Your task is to analyze code and find ALL actual LLM inference points with accurate provider and model information.

## CRITICAL RULES

### What IS an inference point (DO report these):
- client.chat.completions.create() - OpenAI API call
- client.messages.create() - Anthropic API call
- client.embeddings.create() - OpenAI embeddings call
- predictor(question=...) - DSPy module invocation (after dspy.Predict/ChainOfThought)
- chain.invoke() - LangChain invocation
- llm.generate() - Direct generation calls

### What is NOT an inference point (DO NOT report these):
- Client initialization: openai.OpenAI(), anthropic.Anthropic()
- Import statements
- Variable assignments: model = "gpt-4o"
- Class/function definitions
- DSPy Predict/ChainOfThought creation (only report the invocation)

### Model Extraction Rules:
1. Look at the model= parameter in the function call
2. Trace variables back to their definitions
3. For DSPy: find dspy.LM("provider/model") and extract the model part
4. Return the FULL exact model name (e.g., "gpt-4o-mini" not "gpt-4")

### Framework Detection:
- DSPy: look for dspy imports, dspy.Predict, dspy.ChainOfThought
- LangChain: look for langchain imports, ChatOpenAI, LLMChain
- LlamaIndex: look for llama_index imports

## WORKFLOW

1. Use search_pattern to find potential inference point locations
2. Use read_file to examine the code in detail
3. Use trace_variable to find where models/clients are defined
4. Use report_callsites to report your findings

Be thorough but precise. Only report actual inference points, not initialization or configuration.`;

export async function analyzeWithAgent(
  scanResult: ScanResult,
  options: { verbose?: boolean; maxIterations?: number } = {}
): Promise<AgentAnalysisResult> {
  // Load configuration
  const config = loadConfig();
  const { verbose = config.agent.verbose, maxIterations = config.agent.max_iterations } = options;

  // Check for API key
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY required for agent analysis');
  }

  const client = new Anthropic();

  // Build file contents map
  const fileContents = new Map<string, string>();
  for (const file of scanResult.files) {
    try {
      const absPath = join(scanResult.root, file.path);
      fileContents.set(file.path, readFileSync(absPath, 'utf-8'));
    } catch {
      // Skip unreadable files
    }
  }

  const toolExecutor = new AgentToolExecutor(scanResult.root, fileContents);

  // Build initial task with candidate info
  const candidateInfo = scanResult.candidates
    .map(c => `- ${c.file}:${c.line}: ${c.snippet}`)
    .join('\n');

  const fileList = scanResult.files.map(f => f.path).join('\n');

  const initialTask = `Analyze this codebase to identify all LLM inference callsites.

## Files in project:
${fileList}

## Candidate locations (from regex scan):
${candidateInfo}

## Instructions:
1. Start by examining the candidate files
2. For each candidate, determine if it's a real callsite or false positive
3. Look for callsites that the regex might have missed (especially framework calls)
4. Trace variable assignments to find exact model names
5. Report all confirmed callsites using the report_callsites tool

Begin your analysis.`;

  const messages: Anthropic.MessageParam[] = [
    { role: 'user', content: initialTask },
  ];

  // Agentic loop
  let iteration = 0;

  while (iteration < maxIterations) {
    iteration++;

    if (verbose) {
      console.log(`[agent] Iteration ${iteration}/${maxIterations}`);
    }

    // Get models from config
    const primaryModel = getConfiguredModel('agent', false);
    const fallbackModel = getConfiguredModel('agent', true);

    // Try primary model first, fall back if unavailable
    let response: Anthropic.Message;
    try {
      response = await client.messages.create({
        model: primaryModel,
        max_tokens: 4096,
        system: AGENT_SYSTEM_PROMPT,
        tools: AGENT_TOOLS,
        messages,
      });
    } catch (error) {
      // Fallback to secondary model if primary unavailable
      if (verbose) {
        console.log(`[agent] ${primaryModel} unavailable, using ${fallbackModel}`);
      }
      response = await client.messages.create({
        model: fallbackModel,
        max_tokens: 4096,
        system: AGENT_SYSTEM_PROMPT,
        tools: AGENT_TOOLS,
        messages,
      });
    }

    // Add assistant response to history
    messages.push({
      role: 'assistant',
      content: response.content,
    });

    // Check if done
    if (response.stop_reason === 'end_turn') {
      if (verbose) {
        console.log('[agent] Analysis complete');
      }
      break;
    }

    // Process tool calls
    if (response.stop_reason === 'tool_use') {
      const toolResults: ToolResult[] = [];

      for (const block of response.content) {
        if (block.type === 'tool_use') {
          if (verbose) {
            console.log(`[agent] Tool: ${block.name}`);
          }

          const result = await toolExecutor.execute(
            block.name,
            block.input as Record<string, unknown>
          );

          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: result,
          });
        }
      }

      messages.push({
        role: 'user',
        content: toolResults,
      });
    }
  }

  // Get reported callsites
  const callsites = toolExecutor.getReportedCallsites();

  return {
    callsites,
    insights: [], // Agent could also report insights in future
  };
}

// =============================================================================
// INTEGRATION HELPER
// =============================================================================

function generateCallsiteId(file: string, line: number): string {
  const hash = createHash('sha256')
    .update(`${file}:${line}`)
    .digest('hex')
    .slice(0, 8);
  return `cs_${hash}`;
}

/**
 * Convert agent results to standard Callsite format
 */
export function convertAgentCallsites(agentCallsites: AgentCallsite[]): Callsite[] {
  return agentCallsites.map(ac => ({
    id: generateCallsiteId(ac.file, ac.line),
    file: ac.file,
    line: ac.line,
    provider: ac.provider as Provider | null,
    model: ac.model,
    framework: ac.framework,
    runtime: null,
    patterns: ac.patterns as Patterns,
    confidence: ac.confidence,
  }));
}
