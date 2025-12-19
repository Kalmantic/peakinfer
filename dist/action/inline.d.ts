/**
 * Inline PR Comments (v1.6 - Option A)
 *
 * With Option A, the summary comment is minimal (verdict only).
 * All details are in inline comments on specific files/lines.
 *
 * Design: User goes to "Files changed" tab, sees issues in context,
 * clicks "Apply suggestion" → fixed. No copy-paste.
 */
import type { Insight } from '../types.js';
type Octokit = any;
type Context = any;
/**
 * Post inline comments on PR files
 *
 * Returns count of posted and omitted comments
 */
export declare function postInlineComments(octokit: Octokit, context: Context, insights: Insight[]): Promise<{
    posted: number;
    omitted: number;
}>;
export {};
//# sourceMappingURL=inline.d.ts.map