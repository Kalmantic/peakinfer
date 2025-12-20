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
}
/**
 * Generate PR comment markdown (CodeRabbit style).
 *
 * Structure: Header → Commits → Files → Summary → Issues → Verdict → Finishing Touches
 */
export declare function generatePRComment(data: CommentData): string;
/**
 * Generate comment for exhausted credits
 */
export declare function generateExhaustedComment(used: number, limit: number): string;
export {};
//# sourceMappingURL=comments.d.ts.map