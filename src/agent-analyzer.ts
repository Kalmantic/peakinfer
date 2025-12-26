/**
 * Agent-based Semantic Analyzer for PeakInfer
 *
 * Uses Claude Agent SDK (per TDD v1.9.3) for multi-step code analysis:
 * 1. Read source files
 * 2. Extract patterns and variable assignments
 * 3. Trace variable definitions to resolve model names
 * 4. Identify actual LLM callsites (not client initialization)
 *
 * Architecture: Claude Agent SDK = Engine, TypeScript = Glue (per TDD §1)
 */

import 'dotenv/config';
import { query, tool, createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk';
import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import type { ScanResult, Callsite, Provider, Patterns } from './types.js';
import { createHash } from 'crypto';
import { loadPrompt, loadConfig, getConfiguredModel } from './templates.js';

// Type for MCP tool result
type ToolResult = { content: Array<{ type: 'text'; text: string }> };

// Load agent system prompt from YAML (with hardcoded fallback)
function getAgentSystemPrompt(): string {
  const prompt = loadPrompt('agent-analyzer');
  if (prompt) {
    return prompt.prompt;
  }
  // Fallback to hardcoded prompt if YAML not available
  return `You are an expert code analyst specializing in identifying LLM/AI inference points in source code.

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
}

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

// =============================================================================
// TOOL CONTEXT (shared state for tool execution)
// =============================================================================

interface ToolContext {
  projectRoot: string;
  fileContents: Map<string, string>;
  reportedCallsites: AgentCallsite[];
}

// =============================================================================
// MCP TOOLS USING CLAUDE AGENT SDK
// =============================================================================

/**
 * Helper to create ToolResult from string
 */
function makeToolResult(text: string): ToolResult {
  return {
    content: [{ type: 'text', text }],
  };
}

/**
 * Create MCP server with analysis tools using Claude Agent SDK
 */
function createAnalysisMcpServer(ctx: ToolContext) {
  // Tool: read_file - Read source code file contents
  const readFileTool = tool(
    'read_file',
    'Read the contents of a source code file. Use this to examine code in detail.',
    {
      file_path: z.string().describe('Relative path to the file from project root'),
    },
    async ({ file_path }): Promise<ToolResult> => {
      // Try from cache first
      if (ctx.fileContents.has(file_path)) {
        const content = ctx.fileContents.get(file_path)!;
        const numbered = content.split('\n')
          .map((line, i) => `${i + 1}: ${line}`)
          .join('\n');
        return makeToolResult(numbered.slice(0, 8000)); // Limit size
      }

      // Try reading from disk
      const absPath = join(ctx.projectRoot, file_path);
      if (existsSync(absPath)) {
        try {
          const content = readFileSync(absPath, 'utf-8');
          const numbered = content.split('\n')
            .map((line, i) => `${i + 1}: ${line}`)
            .join('\n');
          return makeToolResult(numbered.slice(0, 8000));
        } catch (e) {
          return makeToolResult(`Error reading file: ${e}`);
        }
      }

      return makeToolResult(`File not found: ${file_path}`);
    }
  );

  // Tool: search_pattern - Search for regex patterns across files
  const searchPatternTool = tool(
    'search_pattern',
    'Search for a regex pattern across all source files. Returns matching lines with file and line number.',
    {
      pattern: z.string().describe('Regex pattern to search for (e.g., "dspy\\.LM\\(" or "model\\s*=")'),
      file_filter: z.string().optional().describe('Optional glob pattern to filter files (e.g., "*.py" or "*.ts")'),
    },
    async ({ pattern, file_filter }): Promise<ToolResult> => {
      const results: string[] = [];
      const regex = new RegExp(pattern, 'gi');

      for (const [filePath, content] of ctx.fileContents) {
        // Apply file filter if provided
        if (file_filter && !filePath.match(new RegExp(file_filter.replace('*', '.*')))) {
          continue;
        }

        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
          if (regex.test(lines[i])) {
            results.push(`${filePath}:${i + 1}: ${lines[i].trim().slice(0, 100)}`);
            if (results.length >= 20) break;
          }
        }
        if (results.length >= 20) break;
      }

      return makeToolResult(results.length > 0 ? results.join('\n') : 'No matches found');
    }
  );

  // Tool: trace_variable - Find variable definitions and assignments
  const traceVariableTool = tool(
    'trace_variable',
    'Find where a variable is defined or assigned in a file. Useful for tracing model names.',
    {
      file_path: z.string().describe('File to search in'),
      variable_name: z.string().describe('Variable name to trace (e.g., "model", "lm", "client")'),
    },
    async ({ file_path, variable_name }): Promise<ToolResult> => {
      const content = ctx.fileContents.get(file_path);
      if (!content) {
        return makeToolResult(`File not found: ${file_path}`);
      }

      const results: string[] = [];
      const lines = content.split('\n');

      // Look for assignments and definitions
      const patterns = [
        new RegExp(`\\b${variable_name}\\s*=\\s*(.+)`, 'g'),
        new RegExp(`\\bconst\\s+${variable_name}\\s*=\\s*(.+)`, 'g'),
        new RegExp(`\\blet\\s+${variable_name}\\s*=\\s*(.+)`, 'g'),
        new RegExp(`\\bvar\\s+${variable_name}\\s*=\\s*(.+)`, 'g'),
        new RegExp(`\\bdef\\s+.*${variable_name}.*:`, 'g'),
        new RegExp(`${variable_name}\\s*:\\s*(.+)`, 'g'),
      ];

      for (let i = 0; i < lines.length; i++) {
        for (const p of patterns) {
          if (p.test(lines[i])) {
            results.push(`Line ${i + 1}: ${lines[i].trim()}`);
            break;
          }
        }
      }

      return makeToolResult(
        results.length > 0
          ? `Found ${results.length} references to "${variable_name}":\n${results.join('\n')}`
          : `No definitions found for "${variable_name}"`
      );
    }
  );

  // Tool: report_callsites - Report discovered LLM callsites
  const reportCallsitesTool = tool(
    'report_callsites',
    'Report discovered LLM callsites. Call this when you have identified callsites with their details.',
    {
      callsites: z.array(z.object({
        file: z.string().describe('File path'),
        line: z.number().describe('Line number of the actual inference call'),
        provider: z.string().describe('Provider: openai, anthropic, google, etc.'),
        model: z.string().optional().describe('Exact model name as found in code'),
        framework: z.string().optional().describe('Framework: dspy, langchain, llamaindex, or null'),
        reasoning: z.string().describe('Brief explanation of how you identified this'),
      })).describe('Array of identified callsites'),
    },
    async ({ callsites }): Promise<ToolResult> => {
      for (const cs of callsites) {
        ctx.reportedCallsites.push({
          file: cs.file,
          line: cs.line,
          provider: cs.provider || null,
          model: cs.model || null,
          framework: cs.framework || null,
          patterns: {},
          confidence: 0.9,
          reasoning: cs.reasoning,
        });
      }
      return makeToolResult(`Recorded ${callsites.length} callsites. Total: ${ctx.reportedCallsites.length}`);
    }
  );

  // Create MCP server with all tools
  return createSdkMcpServer({
    name: 'peakinfer-analyzer',
    version: '1.0.0',
    tools: [readFileTool, searchPatternTool, traceVariableTool, reportCallsitesTool],
  });
}

// =============================================================================
// AGENT LOOP USING CLAUDE AGENT SDK
// =============================================================================

// AGENT_SYSTEM_PROMPT is now loaded from prompts/agent-analyzer.yaml via getAgentSystemPrompt()

/**
 * Extract text content from SDK messages
 */
function extractTextFromMessages(messages: SDKMessage[]): string {
  let text = '';
  for (const msg of messages) {
    if (msg.type === 'assistant' && msg.message?.content) {
      for (const block of msg.message.content) {
        if (block.type === 'text') {
          text += block.text;
        }
      }
    }
  }
  return text;
}

export async function analyzeWithAgent(
  scanResult: ScanResult,
  options: { verbose?: boolean; maxIterations?: number } = {}
): Promise<AgentAnalysisResult> {
  // Load configuration
  const config = loadConfig();
  const { verbose = config.agent.verbose } = options;

  // Check for API key
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY required for agent analysis');
  }

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

  // Create tool context for shared state
  const ctx: ToolContext = {
    projectRoot: scanResult.root,
    fileContents,
    reportedCallsites: [],
  };

  // Create MCP server with analysis tools
  const mcpServer = createAnalysisMcpServer(ctx);

  // Build initial task with candidate info
  const candidateInfo = scanResult.candidates
    .map(c => `- ${c.file}:${c.line}: ${c.snippet}`)
    .join('\n');

  const fileList = scanResult.files.map(f => f.path).join('\n');

  const prompt = `Analyze this codebase to identify all LLM inference callsites.

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

  if (verbose) {
    console.log('[agent] Starting Claude Agent SDK analysis...');
  }

  // Get model from config
  const model = getConfiguredModel('agent', false);

  try {
    // Use Claude Agent SDK query() function with MCP server
    const agentQuery = query({
      prompt,
      options: {
        systemPrompt: getAgentSystemPrompt(),
        model,
        mcpServers: {
          'peakinfer-analyzer': mcpServer,
        },
        permissionMode: 'default',
        cwd: scanResult.root,
      },
    });

    // Collect all messages from the agent
    const messages: SDKMessage[] = [];
    for await (const message of agentQuery) {
      messages.push(message);

      if (verbose && message.type === 'assistant') {
        // Log tool usage for debugging
        if (message.message?.content) {
          for (const block of message.message.content) {
            if (block.type === 'tool_use') {
              console.log(`[agent] Tool: ${block.name}`);
            }
          }
        }
      }
    }

    if (verbose) {
      console.log('[agent] Analysis complete');
      console.log(`[agent] Found ${ctx.reportedCallsites.length} callsites`);
    }

    return {
      callsites: ctx.reportedCallsites,
      insights: [],
    };
  } catch (error) {
    // If primary model fails, try fallback
    const fallbackModel = getConfiguredModel('agent', true);

    if (verbose) {
      console.log(`[agent] ${model} failed, trying ${fallbackModel}`);
    }

    const agentQuery = query({
      prompt,
      options: {
        systemPrompt: getAgentSystemPrompt(),
        model: fallbackModel,
        mcpServers: {
          'peakinfer-analyzer': mcpServer,
        },
        permissionMode: 'default',
        cwd: scanResult.root,
      },
    });

    for await (const message of agentQuery) {
      if (verbose && message.type === 'assistant') {
        if (message.message?.content) {
          for (const block of message.message.content) {
            if (block.type === 'tool_use') {
              console.log(`[agent] Tool: ${block.name}`);
            }
          }
        }
      }
    }

    if (verbose) {
      console.log('[agent] Analysis complete (fallback)');
    }

    return {
      callsites: ctx.reportedCallsites,
      insights: [],
    };
  }
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
