import type { ExecutionPlan, PlannedTask, TaskResult, ScanResult, Callsite, InferenceEvent, JoinedOutput, Insight, RuntimeSummary, InferenceMap } from './types.js';
import { type ImpactSummary } from './impact.js';
import type { ComparisonResult, PredictionResult, CounterfactualResult } from './types.js';
import { type StaticAnalysisOutput } from './agents/index.js';
export interface AgentOptions {
    path: string;
    events?: string;
    eventsUrl?: string;
    html?: boolean;
    pdf?: boolean;
    open?: boolean;
    out?: string;
    offline?: boolean;
    verbose?: boolean;
    noCache?: boolean;
    formatHint?: string;
    fieldHints?: Record<string, string>;
    lenient?: boolean;
    strict?: boolean;
    redact?: boolean;
    noHistory?: boolean;
    compare?: boolean;
    compareRunId?: string;
    predict?: boolean;
    targetP95?: number;
}
export type ProgressPhase = 'scanning' | 'analyzing' | 'profiling' | 'parsing' | 'correlating' | 'generating';
export interface ProgressData {
    phase: ProgressPhase;
    detail?: string;
    percent?: number;
    currentFile?: string;
}
export interface AgentCallbacks {
    onPlanReady?: (plan: ExecutionPlan) => void;
    onTaskStart?: (task: PlannedTask) => void;
    onTaskComplete?: (task: PlannedTask, result: TaskResult) => void;
    onProgress?: (data: ProgressData) => void;
    onComplete?: (results: AgentResults) => void;
    onError?: (error: Error) => void;
    onResumed?: (runId: string) => void;
    onPartial?: (warnings: string[]) => void;
}
export interface AgentResults {
    mode: 'static' | 'runtime' | 'combined';
    runId: string;
    resumed: boolean;
    scanResult?: ScanResult;
    callsites?: Callsite[];
    events?: InferenceEvent[];
    runtimeSummary?: RuntimeSummary;
    joined?: JoinedOutput;
    insights: Insight[];
    impactSummary?: ImpactSummary;
    inferenceMap?: InferenceMap;
    staticAnalysis?: StaticAnalysisOutput;
    comparison?: ComparisonResult;
    prediction?: PredictionResult;
    counterfactuals?: CounterfactualResult;
    htmlPath?: string;
    pdfPath?: string;
    warnings?: string[];
}
export interface PlanResult {
    plan: ExecutionPlan;
    runId: string;
    canResume: boolean;
    runDir: string;
}
export declare function plan(opts: AgentOptions): PlanResult;
export declare class Agent {
    private callbacks;
    constructor(callbacks?: AgentCallbacks);
    run(opts: AgentOptions): Promise<AgentResults>;
}
