/**
 * Call Site Finder Agent
 * Finds all LLM inference points including indirect and wrapped calls
 */
import { ImportAnalyzerOutput } from './import-analyzer.js';
export interface InferencePoint {
    id: string;
    line: number;
    column: number;
    function_context: string;
    class_context: string | null;
    call_expression: string;
    call_type: 'direct' | 'wrapper' | 'framework' | 'http';
    provider: {
        value: string;
        source: 'hardcoded' | 'env' | 'config' | 'parameter' | 'dynamic' | 'unknown';
        confidence: number;
    };
    model: {
        value: string | null;
        source: 'hardcoded' | 'env' | 'config' | 'parameter' | 'dynamic' | 'unknown';
        confidence: number;
    };
    is_async: boolean;
    in_loop: boolean;
    loop_type: 'for' | 'while' | 'map' | 'recursive' | 'none';
    estimated_calls: 'single' | 'multiple' | 'unbounded';
    needs_tracing: boolean;
    confidence: number;
}
export interface WrapperDefinition {
    name: string;
    line: number;
    wraps_provider: string | null;
    wraps_model: string | null;
    is_llm_wrapper: boolean;
    confidence: number;
}
export interface CallSiteFinderOutput {
    inference_points: InferencePoint[];
    wrapper_definitions: WrapperDefinition[];
    summary: {
        total_inference_points: number;
        direct_calls: number;
        wrapped_calls: number;
        framework_calls: number;
        providers_detected: string[];
        models_detected: string[];
        has_dynamic_routing: boolean;
    };
}
export interface CallSiteFinderInput {
    file_path: string;
    language: string;
    full_file: string;
    import_analysis: ImportAnalyzerOutput;
}
export declare function findCallSites(input: CallSiteFinderInput): Promise<CallSiteFinderOutput>;
export declare class CallSiteFinderAgent {
    name: string;
    description: string;
    execute(input: CallSiteFinderInput): Promise<CallSiteFinderOutput>;
}
//# sourceMappingURL=callsite-finder.d.ts.map