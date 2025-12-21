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
export interface Tool<TInput, TOutput> {
    name: string;
    description: string;
    inputSchema: z.ZodSchema<TInput>;
    outputSchema: z.ZodSchema<TOutput>;
    execute: (input: TInput) => Promise<TOutput>;
}
declare const GlobInputSchema: z.ZodObject<{
    pattern: z.ZodString;
    cwd: z.ZodOptional<z.ZodString>;
    ignore: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    pattern: string;
    cwd?: string | undefined;
    ignore?: string[] | undefined;
}, {
    pattern: string;
    cwd?: string | undefined;
    ignore?: string[] | undefined;
}>;
declare const GlobOutputSchema: z.ZodObject<{
    files: z.ZodArray<z.ZodString, "many">;
    count: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    files: string[];
    count: number;
}, {
    files: string[];
    count: number;
}>;
export declare const GlobTool: Tool<z.infer<typeof GlobInputSchema>, z.infer<typeof GlobOutputSchema>>;
declare const GrepInputSchema: z.ZodObject<{
    pattern: z.ZodString;
    files: z.ZodArray<z.ZodString, "many">;
    maxMatches: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    files: string[];
    pattern: string;
    maxMatches?: number | undefined;
}, {
    files: string[];
    pattern: string;
    maxMatches?: number | undefined;
}>;
declare const GrepOutputSchema: z.ZodObject<{
    matches: z.ZodArray<z.ZodObject<{
        file: z.ZodString;
        line: z.ZodNumber;
        content: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        file: string;
        content: string;
        line: number;
    }, {
        file: string;
        content: string;
        line: number;
    }>, "many">;
    totalMatches: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    matches: {
        file: string;
        content: string;
        line: number;
    }[];
    totalMatches: number;
}, {
    matches: {
        file: string;
        content: string;
        line: number;
    }[];
    totalMatches: number;
}>;
export declare const GrepTool: Tool<z.infer<typeof GrepInputSchema>, z.infer<typeof GrepOutputSchema>>;
declare const ReadInputSchema: z.ZodObject<{
    file: z.ZodString;
    maxLines: z.ZodOptional<z.ZodNumber>;
    startLine: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    file: string;
    startLine?: number | undefined;
    maxLines?: number | undefined;
}, {
    file: string;
    startLine?: number | undefined;
    maxLines?: number | undefined;
}>;
declare const ReadOutputSchema: z.ZodObject<{
    content: z.ZodString;
    lines: z.ZodNumber;
    truncated: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    content: string;
    lines: number;
    truncated: boolean;
}, {
    content: string;
    lines: number;
    truncated: boolean;
}>;
export declare const ReadTool: Tool<z.infer<typeof ReadInputSchema>, z.infer<typeof ReadOutputSchema>>;
export declare class ToolRegistry {
    private tools;
    register<TInput, TOutput>(tool: Tool<TInput, TOutput>): void;
    get(name: string): Tool<unknown, unknown> | undefined;
    execute(name: string, args: unknown): Promise<unknown>;
    getSchemaPrompt(): string;
    list(): string[];
}
export declare function createConstrainedRegistry(): ToolRegistry;
export declare const AGENT_TOOLS: (Tool<{
    pattern: string;
    cwd?: string | undefined;
    ignore?: string[] | undefined;
}, {
    files: string[];
    count: number;
}> | Tool<{
    files: string[];
    pattern: string;
    maxMatches?: number | undefined;
}, {
    matches: {
        file: string;
        content: string;
        line: number;
    }[];
    totalMatches: number;
}> | Tool<{
    file: string;
    startLine?: number | undefined;
    maxLines?: number | undefined;
}, {
    content: string;
    lines: number;
    truncated: boolean;
}>)[];
export {};
//# sourceMappingURL=index.d.ts.map