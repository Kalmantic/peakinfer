/**
 * Import Analyzer Agent
 * Analyzes file imports to identify LLM SDKs, frameworks, and custom wrappers
 */
export interface SDK {
    name: string;
    provider: string;
    import_line: number;
    alias: string | null;
    confidence: number;
}
export interface Framework {
    name: string;
    import_line: number;
    components: string[];
    confidence: number;
}
export interface CustomWrapper {
    name: string;
    import_path: string;
    likely_purpose: string;
    needs_tracing: boolean;
    confidence: number;
}
export interface Infrastructure {
    name: string;
    type: string;
    import_line: number;
}
export interface ImportAnalyzerOutput {
    sdks: SDK[];
    frameworks: Framework[];
    custom_wrappers: CustomWrapper[];
    infrastructure: Infrastructure[];
    summary: {
        has_llm_usage: boolean;
        primary_provider: string | null;
        framework: string | null;
        complexity: 'simple' | 'moderate' | 'complex';
    };
}
export interface ImportAnalyzerInput {
    file_path: string;
    language: string;
    imports_section: string;
    full_file: string;
}
export declare function analyzeImports(input: ImportAnalyzerInput): Promise<ImportAnalyzerOutput>;
export declare class ImportAnalyzerAgent {
    name: string;
    description: string;
    execute(input: ImportAnalyzerInput): Promise<ImportAnalyzerOutput>;
}
//# sourceMappingURL=import-analyzer.d.ts.map