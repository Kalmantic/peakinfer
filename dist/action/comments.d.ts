/**
 * PR Comment Generation (v1.6)
 *
 * Generates markdown PR comments aligned with CLI UX and DD v1.6.
 * Structure: Summary → Issues → Verdict
 * Design: Clean, accessible, text labels not colors.
 */
import type { Insight } from '../types.js';
interface CommentData {
    results: {
        inferenceMap?: {
            callsites: unknown[];
            summary: {
                totalCallsites: number;
                providers: string[];
                models: string[];
            };
        };
        insights?: Insight[];
        runtime?: {
            global?: {
                p95: number;
            };
        };
        joined?: {
            drift?: unknown[];
        };
    };
    baseline: unknown | null;
    status: 'pass' | 'warning' | 'fail';
    regressions: string[];
    newIssues: Insight[];
    changedFiles: string[];
    credits?: {
        used: number;
        limit: number;
        remaining: number;
    };
    repoContext?: {
        owner: string;
        repo: string;
        sha: string;
        baseSha?: string;
        prNumber?: number;
    };
    hasRuntime?: boolean;
    runtimeEventCount?: number;
    authorsByFile?: Map<string, string[]>;
}
/**
 * Author attribution for viral PR mentions.
 * Maps files to their commit authors for @mention generation.
 */
export interface FileAuthors {
    file: string;
    authors: string[];
    issueCount: number;
}
/**
 * Generate PR comment markdown (CodeRabbit style).
 *
 * Structure: Header → Commits → Files → Summary → Issues → Verdict → Finishing Touches
 */
export declare function generatePRComment(data: CommentData): string;
/**
 * Generate comment for exhausted credits
 * Updated per Business Model v1.9.3 - credit packs
 * v2.0: Added unanalyzedCount to show gap (how many inference points weren't analyzed)
 */
export declare function generateExhaustedComment(used: number, limit: number, unanalyzedCount?: number): string;
export {};
//# sourceMappingURL=comments.d.ts.map