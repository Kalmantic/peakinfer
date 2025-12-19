/**
 * PR Comment Generation (v1.6)
 *
 * Generates markdown PR comments with verdict-first UX.
 * Design principle: User decides in 5 seconds, acts in 30.
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
}
/**
 * Generate PR comment markdown with minimal summary UX (Option A).
 *
 * Design: Verdict only, details in inline comments.
 * - Summary shows ONLY verdict + issue count
 * - User goes to "Files changed" tab for inline suggestions
 * - Click "Apply suggestion" in GitHub's native UI
 */
export declare function generatePRComment(data: CommentData): string;
/**
 * Generate comment for exhausted credits
 */
export declare function generateExhaustedComment(used: number, limit: number): string;
export {};
//# sourceMappingURL=comments.d.ts.map