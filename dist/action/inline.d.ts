/**
 * Inline PR Comments (v1.6)
 *
 * Posts inline comments with suggested fixes on specific files/lines.
 * Design: User clicks "Apply suggestion" → fixed. No copy-paste.
 * Throttled to max 5 comments per PR (focus on top issues).
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