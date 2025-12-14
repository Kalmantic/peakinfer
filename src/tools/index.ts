/**
 * Tool definitions for agent-driven analysis
 *
 * From Autonomous Agent Architecture Patterns v0.1:
 * - Schema-first design using Zod
 * - Tool registry pattern for LLM tool resolution
 *
 * From DESIGN.md v2.0 Section 2.4:
 * - Agent analysis constrained to: Glob -> Grep -> Read
 * - Returns structured JSON (validated)
 * - No unbounded tool access
 */

import { z } from 'zod';
import { globSync } from 'glob';
import { readFileSync, existsSync, statSync } from 'fs';

// =============================================================================
// TOOL INTERFACE (from Patterns v0.1 Section 7.1)
// =============================================================================

export interface Tool<TInput, TOutput> {
  name: string;
  description: string;
  inputSchema: z.ZodSchema<TInput>;
  outputSchema: z.ZodSchema<TOutput>;
  execute: (input: TInput) => Promise<TOutput>;
}

// =============================================================================
// GLOB TOOL - File pattern matching
// =============================================================================

const GlobInputSchema = z.object({
  pattern: z.string().describe('Glob pattern to match files'),
  cwd: z.string().optional().describe('Working directory'),
  ignore: z.array(z.string()).optional().describe('Patterns to ignore'),
});

const GlobOutputSchema = z.object({
  files: z.array(z.string()),
  count: z.number(),
});

export const GlobTool: Tool<z.infer<typeof GlobInputSchema>, z.infer<typeof GlobOutputSchema>> = {
  name: 'glob',
  description: 'Find files matching a glob pattern',
  inputSchema: GlobInputSchema,
  outputSchema: GlobOutputSchema,
  execute: async (input) => {
    const files = globSync(input.pattern, {
      cwd: input.cwd || process.cwd(),
      ignore: input.ignore || ['**/node_modules/**', '**/dist/**', '**/.git/**'],
      nodir: true,
    });
    return { files, count: files.length };
  },
};

// =============================================================================
// GREP TOOL - Content search
// =============================================================================

const GrepInputSchema = z.object({
  pattern: z.string().describe('Regex pattern to search'),
  files: z.array(z.string()).describe('Files to search in'),
  maxMatches: z.number().optional().describe('Max matches per file'),
});

const GrepMatchSchema = z.object({
  file: z.string(),
  line: z.number(),
  content: z.string(),
});

const GrepOutputSchema = z.object({
  matches: z.array(GrepMatchSchema),
  totalMatches: z.number(),
});

export const GrepTool: Tool<z.infer<typeof GrepInputSchema>, z.infer<typeof GrepOutputSchema>> = {
  name: 'grep',
  description: 'Search for pattern in files',
  inputSchema: GrepInputSchema,
  outputSchema: GrepOutputSchema,
  execute: async (input) => {
    const matches: z.infer<typeof GrepMatchSchema>[] = [];
    const regex = new RegExp(input.pattern, 'gi');
    const maxMatches = input.maxMatches || 100;

    for (const file of input.files) {
      if (!existsSync(file)) continue;
      try {
        const content = readFileSync(file, 'utf-8');
        const lines = content.split('\n');
        for (let i = 0; i < lines.length && matches.length < maxMatches; i++) {
          if (regex.test(lines[i])) {
            matches.push({ file, line: i + 1, content: lines[i].trim().slice(0, 200) });
          }
          regex.lastIndex = 0;
        }
      } catch {
        // Skip unreadable files
      }
    }
    return { matches, totalMatches: matches.length };
  },
};

// =============================================================================
// READ TOOL - File reading
// =============================================================================

const ReadInputSchema = z.object({
  file: z.string().describe('File path to read'),
  maxLines: z.number().optional().describe('Max lines to read'),
  startLine: z.number().optional().describe('Start from line number'),
});

const ReadOutputSchema = z.object({
  content: z.string(),
  lines: z.number(),
  truncated: z.boolean(),
});

export const ReadTool: Tool<z.infer<typeof ReadInputSchema>, z.infer<typeof ReadOutputSchema>> = {
  name: 'read',
  description: 'Read file contents',
  inputSchema: ReadInputSchema,
  outputSchema: ReadOutputSchema,
  execute: async (input) => {
    if (!existsSync(input.file)) {
      return { content: '', lines: 0, truncated: false };
    }

    const stat = statSync(input.file);
    if (stat.size > 1_000_000) {
      // File too large, read partial
      const content = readFileSync(input.file, 'utf-8');
      const lines = content.split('\n');
      const start = input.startLine || 0;
      const maxLines = input.maxLines || 500;
      const slice = lines.slice(start, start + maxLines);
      return {
        content: slice.join('\n'),
        lines: slice.length,
        truncated: lines.length > start + maxLines,
      };
    }

    const content = readFileSync(input.file, 'utf-8');
    const lines = content.split('\n');
    const start = input.startLine || 0;
    const maxLines = input.maxLines || lines.length;
    const slice = lines.slice(start, start + maxLines);

    return {
      content: slice.join('\n'),
      lines: slice.length,
      truncated: lines.length > start + maxLines,
    };
  },
};

// =============================================================================
// TOOL REGISTRY (from Patterns v0.1 Section 7.3)
// =============================================================================

export class ToolRegistry {
  private tools = new Map<string, Tool<unknown, unknown>>();

  register<TInput, TOutput>(tool: Tool<TInput, TOutput>): void {
    this.tools.set(tool.name, tool as Tool<unknown, unknown>);
  }

  get(name: string): Tool<unknown, unknown> | undefined {
    return this.tools.get(name);
  }

  async execute(name: string, args: unknown): Promise<unknown> {
    const tool = this.tools.get(name);
    if (!tool) throw new Error(`Tool not found: ${name}`);

    const validated = tool.inputSchema.parse(args);
    return tool.execute(validated);
  }

  getSchemaPrompt(): string {
    const schemas: string[] = [];
    for (const tool of this.tools.values()) {
      schemas.push(`- ${tool.name}: ${tool.description}`);
    }
    return schemas.join('\n');
  }

  list(): string[] {
    return Array.from(this.tools.keys());
  }
}

// =============================================================================
// CONSTRAINED REGISTRY (DESIGN.md v2.0 Section 2.4)
// =============================================================================

export function createConstrainedRegistry(): ToolRegistry {
  const registry = new ToolRegistry();
  registry.register(GlobTool);
  registry.register(GrepTool);
  registry.register(ReadTool);
  return registry;
}

// Default constrained tools for agents
export const AGENT_TOOLS = [GlobTool, GrepTool, ReadTool];
