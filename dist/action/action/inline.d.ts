/**
 * Inline PR Comments (v1.6)
 *
 * Posts inline comments with suggested fixes on specific files/lines.
 * Design aligned with DD v1.6: Clean, text labels, no emoji clutter.
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