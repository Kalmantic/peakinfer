import type { Callsite, InferenceEvent, JoinedOutput } from './types.js';
export interface DriftThresholds {
    /** Percentage threshold for streaming drift (0-100). Default: 50 */
    streamingDriftPercent: number;
    /** Minimum events before flagging retry/fallback drift. Default: 10 */
    minEventsForPatternDrift: number;
}
export declare function join(callsites: Callsite[], events: InferenceEvent[]): JoinedOutput;
