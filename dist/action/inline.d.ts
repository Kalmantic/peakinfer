/**
 * Inline PR Comments (v1.6)
 *
 * Posts inline comments on specific files/lines in PRs.
 * Throttled to max 10 comments per PR.
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