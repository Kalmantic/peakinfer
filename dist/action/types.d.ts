import { z } from 'zod';
export declare const Provider: z.ZodEnum<["openai", "anthropic", "google", "cohere", "mistral", "bedrock", "azure_openai", "together", "fireworks", "groq", "replicate", "perplexity", "vllm", "sglang", "tgi", "ollama", "llamacpp", "unknown"]>;
export declare const Severity: z.ZodEnum<["critical", "warning", "info"]>;
export declare const Category: z.ZodEnum<["cost", "latency", "drift", "reliability", "waste", "throughput", "security", "best-practice"]>;
export declare const Patterns: z.ZodObject<{
    streaming: z.ZodOptional<z.ZodBoolean>;
    batching: z.ZodOptional<z.ZodBoolean>;
    retries: z.ZodOptional<z.ZodBoolean>;
    caching: z.ZodOptional<z.ZodBoolean>;
    fallback: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    streaming?: boolean | undefined;
    batching?: boolean | undefined;
    retries?: boolean | undefined;
    caching?: boolean | undefined;
    fallback?: boolean | undefined;
}, {
    streaming?: boolean | undefined;
    batching?: boolean | undefined;
    retries?: boolean | undefined;
    caching?: boolean | undefined;
    fallback?: boolean | undefined;
}>;
export declare const Callsite: z.ZodObject<{
    id: z.ZodString;
    file: z.ZodString;
    line: z.ZodNumber;
    provider: z.ZodNullable<z.ZodEnum<["openai", "anthropic", "google", "cohere", "mistral", "bedrock", "azure_openai", "together", "fireworks", "groq", "replicate", "perplexity", "vllm", "sglang", "tgi", "ollama", "llamacpp", "unknown"]>>;
    model: z.ZodNullable<z.ZodString>;
    framework: z.ZodNullable<z.ZodString>;
    runtime: z.ZodNullable<z.ZodString>;
    patterns: z.ZodObject<{
        streaming: z.ZodOptional<z.ZodBoolean>;
        batching: z.ZodOptional<z.ZodBoolean>;
        retries: z.ZodOptional<z.ZodBoolean>;
        caching: z.ZodOptional<z.ZodBoolean>;
        fallback: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        streaming?: boolean | undefined;
        batching?: boolean | undefined;
        retries?: boolean | undefined;
        caching?: boolean | undefined;
        fallback?: boolean | undefined;
    }, {
        streaming?: boolean | undefined;
        batching?: boolean | undefined;
        retries?: boolean | undefined;
        caching?: boolean | undefined;
        fallback?: boolean | undefined;
    }>;
    confidence: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    id: string;
    model: string | null;
    runtime: string | null;
    confidence: number;
    file: string;
    line: number;
    provider: "unknown" | "openai" | "anthropic" | "google" | "cohere" | "mistral" | "bedrock" | "azure_openai" | "together" | "fireworks" | "groq" | "replicate" | "perplexity" | "vllm" | "sglang" | "tgi" | "ollama" | "llamacpp" | null;
    framework: string | null;
    patterns: {
        streaming?: boolean | undefined;
        batching?: boolean | undefined;
        retries?: boolean | undefined;
        caching?: boolean | undefined;
        fallback?: boolean | undefined;
    };
}, {
    id: string;
    model: string | null;
    runtime: string | null;
    confidence: number;
    file: string;
    line: number;
    provider: "unknown" | "openai" | "anthropic" | "google" | "cohere" | "mistral" | "bedrock" | "azure_openai" | "together" | "fireworks" | "groq" | "replicate" | "perplexity" | "vllm" | "sglang" | "tgi" | "ollama" | "llamacpp" | null;
    framework: string | null;
    patterns: {
        streaming?: boolean | undefined;
        batching?: boolean | undefined;
        retries?: boolean | undefined;
        caching?: boolean | undefined;
        fallback?: boolean | undefined;
    };
}>;
export declare const ScanCandidate: z.ZodObject<{
    file: z.ZodString;
    line: z.ZodNumber;
    snippet: z.ZodString;
}, "strip", z.ZodTypeAny, {
    file: string;
    line: number;
    snippet: string;
}, {
    file: string;
    line: number;
    snippet: string;
}>;
export declare const ScannedFile: z.ZodObject<{
    path: z.ZodString;
    language: z.ZodString;
    loc: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    path: string;
    loc: number;
    language: string;
}, {
    path: string;
    loc: number;
    language: string;
}>;
export declare const ScanResult: z.ZodObject<{
    root: z.ZodString;
    files: z.ZodArray<z.ZodObject<{
        path: z.ZodString;
        language: z.ZodString;
        loc: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        path: string;
        loc: number;
        language: string;
    }, {
        path: string;
        loc: number;
        language: string;
    }>, "many">;
    candidates: z.ZodArray<z.ZodObject<{
        file: z.ZodString;
        line: z.ZodNumber;
        snippet: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        file: string;
        line: number;
        snippet: string;
    }, {
        file: string;
        line: number;
        snippet: string;
    }>, "many">;
    summary: z.ZodObject<{
        totalFiles: z.ZodNumber;
        totalLoc: z.ZodNumber;
        languages: z.ZodArray<z.ZodString, "many">;
        totalCandidates: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        totalFiles: number;
        totalLoc: number;
        languages: string[];
        totalCandidates: number;
    }, {
        totalFiles: number;
        totalLoc: number;
        languages: string[];
        totalCandidates: number;
    }>;
}, "strip", z.ZodTypeAny, {
    summary: {
        totalFiles: number;
        totalLoc: number;
        languages: string[];
        totalCandidates: number;
    };
    root: string;
    files: {
        path: string;
        loc: number;
        language: string;
    }[];
    candidates: {
        file: string;
        line: number;
        snippet: string;
    }[];
}, {
    summary: {
        totalFiles: number;
        totalLoc: number;
        languages: string[];
        totalCandidates: number;
    };
    root: string;
    files: {
        path: string;
        loc: number;
        language: string;
    }[];
    candidates: {
        file: string;
        line: number;
        snippet: string;
    }[];
}>;
export declare const InferenceMap: z.ZodObject<{
    version: z.ZodString;
    root: z.ZodString;
    generatedAt: z.ZodString;
    metadata: z.ZodOptional<z.ZodObject<{
        absolutePath: z.ZodString;
        promptId: z.ZodOptional<z.ZodString>;
        promptVersion: z.ZodOptional<z.ZodString>;
        templatesVersion: z.ZodOptional<z.ZodString>;
        llmProvider: z.ZodOptional<z.ZodString>;
        llmModel: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        absolutePath: string;
        promptId?: string | undefined;
        promptVersion?: string | undefined;
        templatesVersion?: string | undefined;
        llmProvider?: string | undefined;
        llmModel?: string | undefined;
    }, {
        absolutePath: string;
        promptId?: string | undefined;
        promptVersion?: string | undefined;
        templatesVersion?: string | undefined;
        llmProvider?: string | undefined;
        llmModel?: string | undefined;
    }>>;
    summary: z.ZodObject<{
        totalCallsites: z.ZodNumber;
        providers: z.ZodArray<z.ZodString, "many">;
        models: z.ZodArray<z.ZodString, "many">;
        patterns: z.ZodRecord<z.ZodString, z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        patterns: Record<string, number>;
        totalCallsites: number;
        providers: string[];
        models: string[];
    }, {
        patterns: Record<string, number>;
        totalCallsites: number;
        providers: string[];
        models: string[];
    }>;
    callsites: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        file: z.ZodString;
        line: z.ZodNumber;
        provider: z.ZodNullable<z.ZodEnum<["openai", "anthropic", "google", "cohere", "mistral", "bedrock", "azure_openai", "together", "fireworks", "groq", "replicate", "perplexity", "vllm", "sglang", "tgi", "ollama", "llamacpp", "unknown"]>>;
        model: z.ZodNullable<z.ZodString>;
        framework: z.ZodNullable<z.ZodString>;
        runtime: z.ZodNullable<z.ZodString>;
        patterns: z.ZodObject<{
            streaming: z.ZodOptional<z.ZodBoolean>;
            batching: z.ZodOptional<z.ZodBoolean>;
            retries: z.ZodOptional<z.ZodBoolean>;
            caching: z.ZodOptional<z.ZodBoolean>;
            fallback: z.ZodOptional<z.ZodBoolean>;
        }, "strip", z.ZodTypeAny, {
            streaming?: boolean | undefined;
            batching?: boolean | undefined;
            retries?: boolean | undefined;
            caching?: boolean | undefined;
            fallback?: boolean | undefined;
        }, {
            streaming?: boolean | undefined;
            batching?: boolean | undefined;
            retries?: boolean | undefined;
            caching?: boolean | undefined;
            fallback?: boolean | undefined;
        }>;
        confidence: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        id: string;
        model: string | null;
        runtime: string | null;
        confidence: number;
        file: string;
        line: number;
        provider: "unknown" | "openai" | "anthropic" | "google" | "cohere" | "mistral" | "bedrock" | "azure_openai" | "together" | "fireworks" | "groq" | "replicate" | "perplexity" | "vllm" | "sglang" | "tgi" | "ollama" | "llamacpp" | null;
        framework: string | null;
        patterns: {
            streaming?: boolean | undefined;
            batching?: boolean | undefined;
            retries?: boolean | undefined;
            caching?: boolean | undefined;
            fallback?: boolean | undefined;
        };
    }, {
        id: string;
        model: string | null;
        runtime: string | null;
        confidence: number;
        file: string;
        line: number;
        provider: "unknown" | "openai" | "anthropic" | "google" | "cohere" | "mistral" | "bedrock" | "azure_openai" | "together" | "fireworks" | "groq" | "replicate" | "perplexity" | "vllm" | "sglang" | "tgi" | "ollama" | "llamacpp" | null;
        framework: string | null;
        patterns: {
            streaming?: boolean | undefined;
            batching?: boolean | undefined;
            retries?: boolean | undefined;
            caching?: boolean | undefined;
            fallback?: boolean | undefined;
        };
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    summary: {
        patterns: Record<string, number>;
        totalCallsites: number;
        providers: string[];
        models: string[];
    };
    callsites: {
        id: string;
        model: string | null;
        runtime: string | null;
        confidence: number;
        file: string;
        line: number;
        provider: "unknown" | "openai" | "anthropic" | "google" | "cohere" | "mistral" | "bedrock" | "azure_openai" | "together" | "fireworks" | "groq" | "replicate" | "perplexity" | "vllm" | "sglang" | "tgi" | "ollama" | "llamacpp" | null;
        framework: string | null;
        patterns: {
            streaming?: boolean | undefined;
            batching?: boolean | undefined;
            retries?: boolean | undefined;
            caching?: boolean | undefined;
            fallback?: boolean | undefined;
        };
    }[];
    root: string;
    version: string;
    generatedAt: string;
    metadata?: {
        absolutePath: string;
        promptId?: string | undefined;
        promptVersion?: string | undefined;
        templatesVersion?: string | undefined;
        llmProvider?: string | undefined;
        llmModel?: string | undefined;
    } | undefined;
}, {
    summary: {
        patterns: Record<string, number>;
        totalCallsites: number;
        providers: string[];
        models: string[];
    };
    callsites: {
        id: string;
        model: string | null;
        runtime: string | null;
        confidence: number;
        file: string;
        line: number;
        provider: "unknown" | "openai" | "anthropic" | "google" | "cohere" | "mistral" | "bedrock" | "azure_openai" | "together" | "fireworks" | "groq" | "replicate" | "perplexity" | "vllm" | "sglang" | "tgi" | "ollama" | "llamacpp" | null;
        framework: string | null;
        patterns: {
            streaming?: boolean | undefined;
            batching?: boolean | undefined;
            retries?: boolean | undefined;
            caching?: boolean | undefined;
            fallback?: boolean | undefined;
        };
    }[];
    root: string;
    version: string;
    generatedAt: string;
    metadata?: {
        absolutePath: string;
        promptId?: string | undefined;
        promptVersion?: string | undefined;
        templatesVersion?: string | undefined;
        llmProvider?: string | undefined;
        llmModel?: string | undefined;
    } | undefined;
}>;
export declare const InferenceEvent: z.ZodObject<{
    id: z.ZodString;
    ts: z.ZodString;
    provider: z.ZodEnum<["openai", "anthropic", "google", "cohere", "mistral", "bedrock", "azure_openai", "together", "fireworks", "groq", "replicate", "perplexity", "vllm", "sglang", "tgi", "ollama", "llamacpp", "unknown"]>;
    model: z.ZodString;
    input_tokens: z.ZodNumber;
    output_tokens: z.ZodNumber;
    latency_ms: z.ZodNumber;
    intent: z.ZodOptional<z.ZodString>;
    callsite_id: z.ZodOptional<z.ZodString>;
    streaming: z.ZodOptional<z.ZodBoolean>;
    ttft_ms: z.ZodOptional<z.ZodNumber>;
    batch_size: z.ZodOptional<z.ZodNumber>;
    batch_id: z.ZodOptional<z.ZodString>;
    cached: z.ZodOptional<z.ZodBoolean>;
    retry_count: z.ZodOptional<z.ZodNumber>;
    fallback_used: z.ZodOptional<z.ZodBoolean>;
    original_model: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    id: string;
    model: string;
    provider: "unknown" | "openai" | "anthropic" | "google" | "cohere" | "mistral" | "bedrock" | "azure_openai" | "together" | "fireworks" | "groq" | "replicate" | "perplexity" | "vllm" | "sglang" | "tgi" | "ollama" | "llamacpp";
    ts: string;
    input_tokens: number;
    output_tokens: number;
    latency_ms: number;
    streaming?: boolean | undefined;
    intent?: string | undefined;
    callsite_id?: string | undefined;
    ttft_ms?: number | undefined;
    batch_size?: number | undefined;
    batch_id?: string | undefined;
    cached?: boolean | undefined;
    retry_count?: number | undefined;
    fallback_used?: boolean | undefined;
    original_model?: string | undefined;
}, {
    id: string;
    model: string;
    provider: "unknown" | "openai" | "anthropic" | "google" | "cohere" | "mistral" | "bedrock" | "azure_openai" | "together" | "fireworks" | "groq" | "replicate" | "perplexity" | "vllm" | "sglang" | "tgi" | "ollama" | "llamacpp";
    ts: string;
    input_tokens: number;
    output_tokens: number;
    latency_ms: number;
    streaming?: boolean | undefined;
    intent?: string | undefined;
    callsite_id?: string | undefined;
    ttft_ms?: number | undefined;
    batch_size?: number | undefined;
    batch_id?: string | undefined;
    cached?: boolean | undefined;
    retry_count?: number | undefined;
    fallback_used?: boolean | undefined;
    original_model?: string | undefined;
}>;
export declare const ProviderStats: z.ZodObject<{
    calls: z.ZodNumber;
    tokens_in: z.ZodNumber;
    tokens_out: z.ZodNumber;
    latency_p50: z.ZodNumber;
    latency_p95: z.ZodNumber;
    latency_p99: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    calls: number;
    tokens_in: number;
    tokens_out: number;
    latency_p50: number;
    latency_p95: number;
    latency_p99: number;
}, {
    calls: number;
    tokens_in: number;
    tokens_out: number;
    latency_p50: number;
    latency_p95: number;
    latency_p99: number;
}>;
export declare const RuntimeSummary: z.ZodObject<{
    totalEvents: z.ZodNumber;
    byProvider: z.ZodRecord<z.ZodString, z.ZodObject<{
        calls: z.ZodNumber;
        tokens_in: z.ZodNumber;
        tokens_out: z.ZodNumber;
        latency_p50: z.ZodNumber;
        latency_p95: z.ZodNumber;
        latency_p99: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        calls: number;
        tokens_in: number;
        tokens_out: number;
        latency_p50: number;
        latency_p95: number;
        latency_p99: number;
    }, {
        calls: number;
        tokens_in: number;
        tokens_out: number;
        latency_p50: number;
        latency_p95: number;
        latency_p99: number;
    }>>;
    byModel: z.ZodRecord<z.ZodString, z.ZodObject<{
        calls: z.ZodNumber;
        tokens_in: z.ZodNumber;
        tokens_out: z.ZodNumber;
        latency_p50: z.ZodNumber;
        latency_p95: z.ZodNumber;
        latency_p99: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        calls: number;
        tokens_in: number;
        tokens_out: number;
        latency_p50: number;
        latency_p95: number;
        latency_p99: number;
    }, {
        calls: number;
        tokens_in: number;
        tokens_out: number;
        latency_p50: number;
        latency_p95: number;
        latency_p99: number;
    }>>;
    global: z.ZodObject<{
        p50: z.ZodNumber;
        p95: z.ZodNumber;
        p99: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        p50: number;
        p95: number;
        p99: number;
    }, {
        p50: number;
        p95: number;
        p99: number;
    }>;
}, "strip", z.ZodTypeAny, {
    totalEvents: number;
    byProvider: Record<string, {
        calls: number;
        tokens_in: number;
        tokens_out: number;
        latency_p50: number;
        latency_p95: number;
        latency_p99: number;
    }>;
    byModel: Record<string, {
        calls: number;
        tokens_in: number;
        tokens_out: number;
        latency_p50: number;
        latency_p95: number;
        latency_p99: number;
    }>;
    global: {
        p50: number;
        p95: number;
        p99: number;
    };
}, {
    totalEvents: number;
    byProvider: Record<string, {
        calls: number;
        tokens_in: number;
        tokens_out: number;
        latency_p50: number;
        latency_p95: number;
        latency_p99: number;
    }>;
    byModel: Record<string, {
        calls: number;
        tokens_in: number;
        tokens_out: number;
        latency_p50: number;
        latency_p95: number;
        latency_p99: number;
    }>;
    global: {
        p50: number;
        p95: number;
        p99: number;
    };
}>;
export declare const UsageStats: z.ZodObject<{
    calls: z.ZodNumber;
    tokens_in: z.ZodNumber;
    tokens_out: z.ZodNumber;
    latency_p50: z.ZodNumber;
    latency_p95: z.ZodNumber;
    latency_p99: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    calls: number;
    tokens_in: number;
    tokens_out: number;
    latency_p50: number;
    latency_p95: number;
    latency_p99: number;
}, {
    calls: number;
    tokens_in: number;
    tokens_out: number;
    latency_p50: number;
    latency_p95: number;
    latency_p99: number;
}>;
export declare const DriftSignal: z.ZodObject<{
    type: z.ZodEnum<["codeOnly", "runtimeOnly", "mismatch", "patternDrift"]>;
    provider: z.ZodOptional<z.ZodString>;
    model: z.ZodOptional<z.ZodString>;
    callsiteId: z.ZodOptional<z.ZodString>;
    message: z.ZodString;
}, "strip", z.ZodTypeAny, {
    message: string;
    type: "codeOnly" | "runtimeOnly" | "mismatch" | "patternDrift";
    model?: string | undefined;
    provider?: string | undefined;
    callsiteId?: string | undefined;
}, {
    message: string;
    type: "codeOnly" | "runtimeOnly" | "mismatch" | "patternDrift";
    model?: string | undefined;
    provider?: string | undefined;
    callsiteId?: string | undefined;
}>;
export declare const EnrichedCallsite: z.ZodObject<{
    id: z.ZodString;
    file: z.ZodString;
    line: z.ZodNumber;
    provider: z.ZodNullable<z.ZodEnum<["openai", "anthropic", "google", "cohere", "mistral", "bedrock", "azure_openai", "together", "fireworks", "groq", "replicate", "perplexity", "vllm", "sglang", "tgi", "ollama", "llamacpp", "unknown"]>>;
    model: z.ZodNullable<z.ZodString>;
    framework: z.ZodNullable<z.ZodString>;
    runtime: z.ZodNullable<z.ZodString>;
    patterns: z.ZodObject<{
        streaming: z.ZodOptional<z.ZodBoolean>;
        batching: z.ZodOptional<z.ZodBoolean>;
        retries: z.ZodOptional<z.ZodBoolean>;
        caching: z.ZodOptional<z.ZodBoolean>;
        fallback: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        streaming?: boolean | undefined;
        batching?: boolean | undefined;
        retries?: boolean | undefined;
        caching?: boolean | undefined;
        fallback?: boolean | undefined;
    }, {
        streaming?: boolean | undefined;
        batching?: boolean | undefined;
        retries?: boolean | undefined;
        caching?: boolean | undefined;
        fallback?: boolean | undefined;
    }>;
    confidence: z.ZodNumber;
} & {
    usage: z.ZodOptional<z.ZodObject<{
        calls: z.ZodNumber;
        tokens_in: z.ZodNumber;
        tokens_out: z.ZodNumber;
        latency_p50: z.ZodNumber;
        latency_p95: z.ZodNumber;
        latency_p99: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        calls: number;
        tokens_in: number;
        tokens_out: number;
        latency_p50: number;
        latency_p95: number;
        latency_p99: number;
    }, {
        calls: number;
        tokens_in: number;
        tokens_out: number;
        latency_p50: number;
        latency_p95: number;
        latency_p99: number;
    }>>;
}, "strip", z.ZodTypeAny, {
    id: string;
    model: string | null;
    runtime: string | null;
    confidence: number;
    file: string;
    line: number;
    provider: "unknown" | "openai" | "anthropic" | "google" | "cohere" | "mistral" | "bedrock" | "azure_openai" | "together" | "fireworks" | "groq" | "replicate" | "perplexity" | "vllm" | "sglang" | "tgi" | "ollama" | "llamacpp" | null;
    framework: string | null;
    patterns: {
        streaming?: boolean | undefined;
        batching?: boolean | undefined;
        retries?: boolean | undefined;
        caching?: boolean | undefined;
        fallback?: boolean | undefined;
    };
    usage?: {
        calls: number;
        tokens_in: number;
        tokens_out: number;
        latency_p50: number;
        latency_p95: number;
        latency_p99: number;
    } | undefined;
}, {
    id: string;
    model: string | null;
    runtime: string | null;
    confidence: number;
    file: string;
    line: number;
    provider: "unknown" | "openai" | "anthropic" | "google" | "cohere" | "mistral" | "bedrock" | "azure_openai" | "together" | "fireworks" | "groq" | "replicate" | "perplexity" | "vllm" | "sglang" | "tgi" | "ollama" | "llamacpp" | null;
    framework: string | null;
    patterns: {
        streaming?: boolean | undefined;
        batching?: boolean | undefined;
        retries?: boolean | undefined;
        caching?: boolean | undefined;
        fallback?: boolean | undefined;
    };
    usage?: {
        calls: number;
        tokens_in: number;
        tokens_out: number;
        latency_p50: number;
        latency_p95: number;
        latency_p99: number;
    } | undefined;
}>;
export declare const JoinedOutput: z.ZodObject<{
    callsites: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        file: z.ZodString;
        line: z.ZodNumber;
        provider: z.ZodNullable<z.ZodEnum<["openai", "anthropic", "google", "cohere", "mistral", "bedrock", "azure_openai", "together", "fireworks", "groq", "replicate", "perplexity", "vllm", "sglang", "tgi", "ollama", "llamacpp", "unknown"]>>;
        model: z.ZodNullable<z.ZodString>;
        framework: z.ZodNullable<z.ZodString>;
        runtime: z.ZodNullable<z.ZodString>;
        patterns: z.ZodObject<{
            streaming: z.ZodOptional<z.ZodBoolean>;
            batching: z.ZodOptional<z.ZodBoolean>;
            retries: z.ZodOptional<z.ZodBoolean>;
            caching: z.ZodOptional<z.ZodBoolean>;
            fallback: z.ZodOptional<z.ZodBoolean>;
        }, "strip", z.ZodTypeAny, {
            streaming?: boolean | undefined;
            batching?: boolean | undefined;
            retries?: boolean | undefined;
            caching?: boolean | undefined;
            fallback?: boolean | undefined;
        }, {
            streaming?: boolean | undefined;
            batching?: boolean | undefined;
            retries?: boolean | undefined;
            caching?: boolean | undefined;
            fallback?: boolean | undefined;
        }>;
        confidence: z.ZodNumber;
    } & {
        usage: z.ZodOptional<z.ZodObject<{
            calls: z.ZodNumber;
            tokens_in: z.ZodNumber;
            tokens_out: z.ZodNumber;
            latency_p50: z.ZodNumber;
            latency_p95: z.ZodNumber;
            latency_p99: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            calls: number;
            tokens_in: number;
            tokens_out: number;
            latency_p50: number;
            latency_p95: number;
            latency_p99: number;
        }, {
            calls: number;
            tokens_in: number;
            tokens_out: number;
            latency_p50: number;
            latency_p95: number;
            latency_p99: number;
        }>>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        model: string | null;
        runtime: string | null;
        confidence: number;
        file: string;
        line: number;
        provider: "unknown" | "openai" | "anthropic" | "google" | "cohere" | "mistral" | "bedrock" | "azure_openai" | "together" | "fireworks" | "groq" | "replicate" | "perplexity" | "vllm" | "sglang" | "tgi" | "ollama" | "llamacpp" | null;
        framework: string | null;
        patterns: {
            streaming?: boolean | undefined;
            batching?: boolean | undefined;
            retries?: boolean | undefined;
            caching?: boolean | undefined;
            fallback?: boolean | undefined;
        };
        usage?: {
            calls: number;
            tokens_in: number;
            tokens_out: number;
            latency_p50: number;
            latency_p95: number;
            latency_p99: number;
        } | undefined;
    }, {
        id: string;
        model: string | null;
        runtime: string | null;
        confidence: number;
        file: string;
        line: number;
        provider: "unknown" | "openai" | "anthropic" | "google" | "cohere" | "mistral" | "bedrock" | "azure_openai" | "together" | "fireworks" | "groq" | "replicate" | "perplexity" | "vllm" | "sglang" | "tgi" | "ollama" | "llamacpp" | null;
        framework: string | null;
        patterns: {
            streaming?: boolean | undefined;
            batching?: boolean | undefined;
            retries?: boolean | undefined;
            caching?: boolean | undefined;
            fallback?: boolean | undefined;
        };
        usage?: {
            calls: number;
            tokens_in: number;
            tokens_out: number;
            latency_p50: number;
            latency_p95: number;
            latency_p99: number;
        } | undefined;
    }>, "many">;
    codeOnly: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        file: z.ZodString;
        line: z.ZodNumber;
        provider: z.ZodNullable<z.ZodEnum<["openai", "anthropic", "google", "cohere", "mistral", "bedrock", "azure_openai", "together", "fireworks", "groq", "replicate", "perplexity", "vllm", "sglang", "tgi", "ollama", "llamacpp", "unknown"]>>;
        model: z.ZodNullable<z.ZodString>;
        framework: z.ZodNullable<z.ZodString>;
        runtime: z.ZodNullable<z.ZodString>;
        patterns: z.ZodObject<{
            streaming: z.ZodOptional<z.ZodBoolean>;
            batching: z.ZodOptional<z.ZodBoolean>;
            retries: z.ZodOptional<z.ZodBoolean>;
            caching: z.ZodOptional<z.ZodBoolean>;
            fallback: z.ZodOptional<z.ZodBoolean>;
        }, "strip", z.ZodTypeAny, {
            streaming?: boolean | undefined;
            batching?: boolean | undefined;
            retries?: boolean | undefined;
            caching?: boolean | undefined;
            fallback?: boolean | undefined;
        }, {
            streaming?: boolean | undefined;
            batching?: boolean | undefined;
            retries?: boolean | undefined;
            caching?: boolean | undefined;
            fallback?: boolean | undefined;
        }>;
        confidence: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        id: string;
        model: string | null;
        runtime: string | null;
        confidence: number;
        file: string;
        line: number;
        provider: "unknown" | "openai" | "anthropic" | "google" | "cohere" | "mistral" | "bedrock" | "azure_openai" | "together" | "fireworks" | "groq" | "replicate" | "perplexity" | "vllm" | "sglang" | "tgi" | "ollama" | "llamacpp" | null;
        framework: string | null;
        patterns: {
            streaming?: boolean | undefined;
            batching?: boolean | undefined;
            retries?: boolean | undefined;
            caching?: boolean | undefined;
            fallback?: boolean | undefined;
        };
    }, {
        id: string;
        model: string | null;
        runtime: string | null;
        confidence: number;
        file: string;
        line: number;
        provider: "unknown" | "openai" | "anthropic" | "google" | "cohere" | "mistral" | "bedrock" | "azure_openai" | "together" | "fireworks" | "groq" | "replicate" | "perplexity" | "vllm" | "sglang" | "tgi" | "ollama" | "llamacpp" | null;
        framework: string | null;
        patterns: {
            streaming?: boolean | undefined;
            batching?: boolean | undefined;
            retries?: boolean | undefined;
            caching?: boolean | undefined;
            fallback?: boolean | undefined;
        };
    }>, "many">;
    runtimeOnly: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        ts: z.ZodString;
        provider: z.ZodEnum<["openai", "anthropic", "google", "cohere", "mistral", "bedrock", "azure_openai", "together", "fireworks", "groq", "replicate", "perplexity", "vllm", "sglang", "tgi", "ollama", "llamacpp", "unknown"]>;
        model: z.ZodString;
        input_tokens: z.ZodNumber;
        output_tokens: z.ZodNumber;
        latency_ms: z.ZodNumber;
        intent: z.ZodOptional<z.ZodString>;
        callsite_id: z.ZodOptional<z.ZodString>;
        streaming: z.ZodOptional<z.ZodBoolean>;
        ttft_ms: z.ZodOptional<z.ZodNumber>;
        batch_size: z.ZodOptional<z.ZodNumber>;
        batch_id: z.ZodOptional<z.ZodString>;
        cached: z.ZodOptional<z.ZodBoolean>;
        retry_count: z.ZodOptional<z.ZodNumber>;
        fallback_used: z.ZodOptional<z.ZodBoolean>;
        original_model: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        model: string;
        provider: "unknown" | "openai" | "anthropic" | "google" | "cohere" | "mistral" | "bedrock" | "azure_openai" | "together" | "fireworks" | "groq" | "replicate" | "perplexity" | "vllm" | "sglang" | "tgi" | "ollama" | "llamacpp";
        ts: string;
        input_tokens: number;
        output_tokens: number;
        latency_ms: number;
        streaming?: boolean | undefined;
        intent?: string | undefined;
        callsite_id?: string | undefined;
        ttft_ms?: number | undefined;
        batch_size?: number | undefined;
        batch_id?: string | undefined;
        cached?: boolean | undefined;
        retry_count?: number | undefined;
        fallback_used?: boolean | undefined;
        original_model?: string | undefined;
    }, {
        id: string;
        model: string;
        provider: "unknown" | "openai" | "anthropic" | "google" | "cohere" | "mistral" | "bedrock" | "azure_openai" | "together" | "fireworks" | "groq" | "replicate" | "perplexity" | "vllm" | "sglang" | "tgi" | "ollama" | "llamacpp";
        ts: string;
        input_tokens: number;
        output_tokens: number;
        latency_ms: number;
        streaming?: boolean | undefined;
        intent?: string | undefined;
        callsite_id?: string | undefined;
        ttft_ms?: number | undefined;
        batch_size?: number | undefined;
        batch_id?: string | undefined;
        cached?: boolean | undefined;
        retry_count?: number | undefined;
        fallback_used?: boolean | undefined;
        original_model?: string | undefined;
    }>, "many">;
    drift: z.ZodArray<z.ZodObject<{
        type: z.ZodEnum<["codeOnly", "runtimeOnly", "mismatch", "patternDrift"]>;
        provider: z.ZodOptional<z.ZodString>;
        model: z.ZodOptional<z.ZodString>;
        callsiteId: z.ZodOptional<z.ZodString>;
        message: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        message: string;
        type: "codeOnly" | "runtimeOnly" | "mismatch" | "patternDrift";
        model?: string | undefined;
        provider?: string | undefined;
        callsiteId?: string | undefined;
    }, {
        message: string;
        type: "codeOnly" | "runtimeOnly" | "mismatch" | "patternDrift";
        model?: string | undefined;
        provider?: string | undefined;
        callsiteId?: string | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    drift: {
        message: string;
        type: "codeOnly" | "runtimeOnly" | "mismatch" | "patternDrift";
        model?: string | undefined;
        provider?: string | undefined;
        callsiteId?: string | undefined;
    }[];
    callsites: {
        id: string;
        model: string | null;
        runtime: string | null;
        confidence: number;
        file: string;
        line: number;
        provider: "unknown" | "openai" | "anthropic" | "google" | "cohere" | "mistral" | "bedrock" | "azure_openai" | "together" | "fireworks" | "groq" | "replicate" | "perplexity" | "vllm" | "sglang" | "tgi" | "ollama" | "llamacpp" | null;
        framework: string | null;
        patterns: {
            streaming?: boolean | undefined;
            batching?: boolean | undefined;
            retries?: boolean | undefined;
            caching?: boolean | undefined;
            fallback?: boolean | undefined;
        };
        usage?: {
            calls: number;
            tokens_in: number;
            tokens_out: number;
            latency_p50: number;
            latency_p95: number;
            latency_p99: number;
        } | undefined;
    }[];
    codeOnly: {
        id: string;
        model: string | null;
        runtime: string | null;
        confidence: number;
        file: string;
        line: number;
        provider: "unknown" | "openai" | "anthropic" | "google" | "cohere" | "mistral" | "bedrock" | "azure_openai" | "together" | "fireworks" | "groq" | "replicate" | "perplexity" | "vllm" | "sglang" | "tgi" | "ollama" | "llamacpp" | null;
        framework: string | null;
        patterns: {
            streaming?: boolean | undefined;
            batching?: boolean | undefined;
            retries?: boolean | undefined;
            caching?: boolean | undefined;
            fallback?: boolean | undefined;
        };
    }[];
    runtimeOnly: {
        id: string;
        model: string;
        provider: "unknown" | "openai" | "anthropic" | "google" | "cohere" | "mistral" | "bedrock" | "azure_openai" | "together" | "fireworks" | "groq" | "replicate" | "perplexity" | "vllm" | "sglang" | "tgi" | "ollama" | "llamacpp";
        ts: string;
        input_tokens: number;
        output_tokens: number;
        latency_ms: number;
        streaming?: boolean | undefined;
        intent?: string | undefined;
        callsite_id?: string | undefined;
        ttft_ms?: number | undefined;
        batch_size?: number | undefined;
        batch_id?: string | undefined;
        cached?: boolean | undefined;
        retry_count?: number | undefined;
        fallback_used?: boolean | undefined;
        original_model?: string | undefined;
    }[];
}, {
    drift: {
        message: string;
        type: "codeOnly" | "runtimeOnly" | "mismatch" | "patternDrift";
        model?: string | undefined;
        provider?: string | undefined;
        callsiteId?: string | undefined;
    }[];
    callsites: {
        id: string;
        model: string | null;
        runtime: string | null;
        confidence: number;
        file: string;
        line: number;
        provider: "unknown" | "openai" | "anthropic" | "google" | "cohere" | "mistral" | "bedrock" | "azure_openai" | "together" | "fireworks" | "groq" | "replicate" | "perplexity" | "vllm" | "sglang" | "tgi" | "ollama" | "llamacpp" | null;
        framework: string | null;
        patterns: {
            streaming?: boolean | undefined;
            batching?: boolean | undefined;
            retries?: boolean | undefined;
            caching?: boolean | undefined;
            fallback?: boolean | undefined;
        };
        usage?: {
            calls: number;
            tokens_in: number;
            tokens_out: number;
            latency_p50: number;
            latency_p95: number;
            latency_p99: number;
        } | undefined;
    }[];
    codeOnly: {
        id: string;
        model: string | null;
        runtime: string | null;
        confidence: number;
        file: string;
        line: number;
        provider: "unknown" | "openai" | "anthropic" | "google" | "cohere" | "mistral" | "bedrock" | "azure_openai" | "together" | "fireworks" | "groq" | "replicate" | "perplexity" | "vllm" | "sglang" | "tgi" | "ollama" | "llamacpp" | null;
        framework: string | null;
        patterns: {
            streaming?: boolean | undefined;
            batching?: boolean | undefined;
            retries?: boolean | undefined;
            caching?: boolean | undefined;
            fallback?: boolean | undefined;
        };
    }[];
    runtimeOnly: {
        id: string;
        model: string;
        provider: "unknown" | "openai" | "anthropic" | "google" | "cohere" | "mistral" | "bedrock" | "azure_openai" | "together" | "fireworks" | "groq" | "replicate" | "perplexity" | "vllm" | "sglang" | "tgi" | "ollama" | "llamacpp";
        ts: string;
        input_tokens: number;
        output_tokens: number;
        latency_ms: number;
        streaming?: boolean | undefined;
        intent?: string | undefined;
        callsite_id?: string | undefined;
        ttft_ms?: number | undefined;
        batch_size?: number | undefined;
        batch_id?: string | undefined;
        cached?: boolean | undefined;
        retry_count?: number | undefined;
        fallback_used?: boolean | undefined;
        original_model?: string | undefined;
    }[];
}>;
export declare const TemplateCondition: z.ZodObject<{
    field: z.ZodString;
    op: z.ZodEnum<["eq", "neq", "gt", "lt", "gte", "lte", "exists", "in", "ratio_gt", "ratio_lt", "has_pattern"]>;
    value: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodArray<z.ZodString, "many">]>>;
    compare_to: z.ZodOptional<z.ZodString>;
    pattern: z.ZodOptional<z.ZodString>;
    count_gt: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    field: string;
    op: "eq" | "neq" | "gt" | "lt" | "gte" | "lte" | "exists" | "in" | "ratio_gt" | "ratio_lt" | "has_pattern";
    value?: string | number | boolean | string[] | undefined;
    pattern?: string | undefined;
    compare_to?: string | undefined;
    count_gt?: number | undefined;
}, {
    field: string;
    op: "eq" | "neq" | "gt" | "lt" | "gte" | "lte" | "exists" | "in" | "ratio_gt" | "ratio_lt" | "has_pattern";
    value?: string | number | boolean | string[] | undefined;
    pattern?: string | undefined;
    compare_to?: string | undefined;
    count_gt?: number | undefined;
}>;
export declare const InsightTemplate: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    version: z.ZodString;
    category: z.ZodEnum<["cost", "latency", "drift", "reliability", "waste", "throughput", "security", "best-practice"]>;
    severity: z.ZodEnum<["critical", "warning", "info"]>;
    match: z.ZodObject<{
        scope: z.ZodEnum<["callsite", "joined", "global", "envelope"]>;
        conditions: z.ZodArray<z.ZodObject<{
            field: z.ZodString;
            op: z.ZodEnum<["eq", "neq", "gt", "lt", "gte", "lte", "exists", "in", "ratio_gt", "ratio_lt", "has_pattern"]>;
            value: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodArray<z.ZodString, "many">]>>;
            compare_to: z.ZodOptional<z.ZodString>;
            pattern: z.ZodOptional<z.ZodString>;
            count_gt: z.ZodOptional<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            field: string;
            op: "eq" | "neq" | "gt" | "lt" | "gte" | "lte" | "exists" | "in" | "ratio_gt" | "ratio_lt" | "has_pattern";
            value?: string | number | boolean | string[] | undefined;
            pattern?: string | undefined;
            compare_to?: string | undefined;
            count_gt?: number | undefined;
        }, {
            field: string;
            op: "eq" | "neq" | "gt" | "lt" | "gte" | "lte" | "exists" | "in" | "ratio_gt" | "ratio_lt" | "has_pattern";
            value?: string | number | boolean | string[] | undefined;
            pattern?: string | undefined;
            compare_to?: string | undefined;
            count_gt?: number | undefined;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        scope: "global" | "callsite" | "joined" | "envelope";
        conditions: {
            field: string;
            op: "eq" | "neq" | "gt" | "lt" | "gte" | "lte" | "exists" | "in" | "ratio_gt" | "ratio_lt" | "has_pattern";
            value?: string | number | boolean | string[] | undefined;
            pattern?: string | undefined;
            compare_to?: string | undefined;
            count_gt?: number | undefined;
        }[];
    }, {
        scope: "global" | "callsite" | "joined" | "envelope";
        conditions: {
            field: string;
            op: "eq" | "neq" | "gt" | "lt" | "gte" | "lte" | "exists" | "in" | "ratio_gt" | "ratio_lt" | "has_pattern";
            value?: string | number | boolean | string[] | undefined;
            pattern?: string | undefined;
            compare_to?: string | undefined;
            count_gt?: number | undefined;
        }[];
    }>;
    output: z.ZodObject<{
        headline: z.ZodString;
        evidence: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        headline: string;
        evidence: string;
    }, {
        headline: string;
        evidence: string;
    }>;
    defaults: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    id: string;
    severity: "critical" | "warning" | "info";
    category: "cost" | "latency" | "drift" | "reliability" | "waste" | "throughput" | "security" | "best-practice";
    match: {
        scope: "global" | "callsite" | "joined" | "envelope";
        conditions: {
            field: string;
            op: "eq" | "neq" | "gt" | "lt" | "gte" | "lte" | "exists" | "in" | "ratio_gt" | "ratio_lt" | "has_pattern";
            value?: string | number | boolean | string[] | undefined;
            pattern?: string | undefined;
            compare_to?: string | undefined;
            count_gt?: number | undefined;
        }[];
    };
    version: string;
    name: string;
    output: {
        headline: string;
        evidence: string;
    };
    defaults?: Record<string, number> | undefined;
}, {
    id: string;
    severity: "critical" | "warning" | "info";
    category: "cost" | "latency" | "drift" | "reliability" | "waste" | "throughput" | "security" | "best-practice";
    match: {
        scope: "global" | "callsite" | "joined" | "envelope";
        conditions: {
            field: string;
            op: "eq" | "neq" | "gt" | "lt" | "gte" | "lte" | "exists" | "in" | "ratio_gt" | "ratio_lt" | "has_pattern";
            value?: string | number | boolean | string[] | undefined;
            pattern?: string | undefined;
            compare_to?: string | undefined;
            count_gt?: number | undefined;
        }[];
    };
    version: string;
    name: string;
    output: {
        headline: string;
        evidence: string;
    };
    defaults?: Record<string, number> | undefined;
}>;
export declare const StackLayer: z.ZodEnum<["application", "model", "runtime", "infrastructure"]>;
export declare const ImpactType: z.ZodEnum<["cost", "latency", "throughput"]>;
export declare const EffortLevel: z.ZodEnum<["low", "medium", "high"]>;
export declare const ImpactEstimate: z.ZodObject<{
    layer: z.ZodEnum<["application", "model", "runtime", "infrastructure"]>;
    impactType: z.ZodEnum<["cost", "latency", "throughput"]>;
    estimatedImpactPercent: z.ZodNumber;
    effort: z.ZodEnum<["low", "medium", "high"]>;
    annualSavingsUSD: z.ZodOptional<z.ZodNumber>;
    latencyReductionMs: z.ZodOptional<z.ZodNumber>;
    throughputGainPercent: z.ZodOptional<z.ZodNumber>;
    confidence: z.ZodOptional<z.ZodNumber>;
    assumptions: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    layer: "application" | "model" | "runtime" | "infrastructure";
    impactType: "cost" | "latency" | "throughput";
    estimatedImpactPercent: number;
    effort: "high" | "medium" | "low";
    annualSavingsUSD?: number | undefined;
    latencyReductionMs?: number | undefined;
    throughputGainPercent?: number | undefined;
    confidence?: number | undefined;
    assumptions?: string | undefined;
}, {
    layer: "application" | "model" | "runtime" | "infrastructure";
    impactType: "cost" | "latency" | "throughput";
    estimatedImpactPercent: number;
    effort: "high" | "medium" | "low";
    annualSavingsUSD?: number | undefined;
    latencyReductionMs?: number | undefined;
    throughputGainPercent?: number | undefined;
    confidence?: number | undefined;
    assumptions?: string | undefined;
}>;
export declare const Insight: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    severity: z.ZodEnum<["critical", "warning", "info"]>;
    category: z.ZodEnum<["cost", "latency", "drift", "reliability", "waste", "throughput", "security", "best-practice"]>;
    templateId: z.ZodOptional<z.ZodString>;
    headline: z.ZodString;
    evidence: z.ZodString;
    location: z.ZodOptional<z.ZodString>;
    recommendation: z.ZodOptional<z.ZodString>;
    source: z.ZodOptional<z.ZodEnum<["template", "llm"]>>;
    impact: z.ZodOptional<z.ZodObject<{
        layer: z.ZodEnum<["application", "model", "runtime", "infrastructure"]>;
        impactType: z.ZodEnum<["cost", "latency", "throughput"]>;
        estimatedImpactPercent: z.ZodNumber;
        effort: z.ZodEnum<["low", "medium", "high"]>;
        annualSavingsUSD: z.ZodOptional<z.ZodNumber>;
        latencyReductionMs: z.ZodOptional<z.ZodNumber>;
        throughputGainPercent: z.ZodOptional<z.ZodNumber>;
        confidence: z.ZodOptional<z.ZodNumber>;
        assumptions: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        layer: "application" | "model" | "runtime" | "infrastructure";
        impactType: "cost" | "latency" | "throughput";
        estimatedImpactPercent: number;
        effort: "high" | "medium" | "low";
        annualSavingsUSD?: number | undefined;
        latencyReductionMs?: number | undefined;
        throughputGainPercent?: number | undefined;
        confidence?: number | undefined;
        assumptions?: string | undefined;
    }, {
        layer: "application" | "model" | "runtime" | "infrastructure";
        impactType: "cost" | "latency" | "throughput";
        estimatedImpactPercent: number;
        effort: "high" | "medium" | "low";
        annualSavingsUSD?: number | undefined;
        latencyReductionMs?: number | undefined;
        throughputGainPercent?: number | undefined;
        confidence?: number | undefined;
        assumptions?: string | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    severity: "critical" | "warning" | "info";
    category: "cost" | "latency" | "drift" | "reliability" | "waste" | "throughput" | "security" | "best-practice";
    headline: string;
    evidence: string;
    id?: string | undefined;
    templateId?: string | undefined;
    location?: string | undefined;
    recommendation?: string | undefined;
    source?: "template" | "llm" | undefined;
    impact?: {
        layer: "application" | "model" | "runtime" | "infrastructure";
        impactType: "cost" | "latency" | "throughput";
        estimatedImpactPercent: number;
        effort: "high" | "medium" | "low";
        annualSavingsUSD?: number | undefined;
        latencyReductionMs?: number | undefined;
        throughputGainPercent?: number | undefined;
        confidence?: number | undefined;
        assumptions?: string | undefined;
    } | undefined;
}, {
    severity: "critical" | "warning" | "info";
    category: "cost" | "latency" | "drift" | "reliability" | "waste" | "throughput" | "security" | "best-practice";
    headline: string;
    evidence: string;
    id?: string | undefined;
    templateId?: string | undefined;
    location?: string | undefined;
    recommendation?: string | undefined;
    source?: "template" | "llm" | undefined;
    impact?: {
        layer: "application" | "model" | "runtime" | "infrastructure";
        impactType: "cost" | "latency" | "throughput";
        estimatedImpactPercent: number;
        effort: "high" | "medium" | "low";
        annualSavingsUSD?: number | undefined;
        latencyReductionMs?: number | undefined;
        throughputGainPercent?: number | undefined;
        confidence?: number | undefined;
        assumptions?: string | undefined;
    } | undefined;
}>;
export declare const PerformanceEnvelope: z.ZodObject<{
    ttft_p50_ms: z.ZodNumber;
    ttft_p95_ms: z.ZodNumber;
    tps_median: z.ZodNumber;
    tps_peak: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    ttft_p50_ms: number;
    ttft_p95_ms: number;
    tps_median: number;
    tps_peak: number;
}, {
    ttft_p50_ms: number;
    ttft_p95_ms: number;
    tps_median: number;
    tps_peak: number;
}>;
export declare const TaskType: z.ZodEnum<["scan", "analyze", "parse_events", "join", "load_templates", "generate_insights", "render", "generate_html", "generate_pdf", "save_artifacts", "save_history", "compare", "predict", "counterfactuals"]>;
export declare const PlannedTask: z.ZodObject<{
    id: z.ZodNumber;
    type: z.ZodEnum<["scan", "analyze", "parse_events", "join", "load_templates", "generate_insights", "render", "generate_html", "generate_pdf", "save_artifacts", "save_history", "compare", "predict", "counterfactuals"]>;
    description: z.ZodString;
    depends_on: z.ZodOptional<z.ZodArray<z.ZodNumber, "many">>;
}, "strip", z.ZodTypeAny, {
    id: number;
    type: "join" | "scan" | "analyze" | "parse_events" | "load_templates" | "generate_insights" | "render" | "generate_html" | "generate_pdf" | "save_artifacts" | "save_history" | "compare" | "predict" | "counterfactuals";
    description: string;
    depends_on?: number[] | undefined;
}, {
    id: number;
    type: "join" | "scan" | "analyze" | "parse_events" | "load_templates" | "generate_insights" | "render" | "generate_html" | "generate_pdf" | "save_artifacts" | "save_history" | "compare" | "predict" | "counterfactuals";
    description: string;
    depends_on?: number[] | undefined;
}>;
export declare const ExecutionPlan: z.ZodObject<{
    mode: z.ZodEnum<["static", "runtime", "combined"]>;
    tasks: z.ZodArray<z.ZodObject<{
        id: z.ZodNumber;
        type: z.ZodEnum<["scan", "analyze", "parse_events", "join", "load_templates", "generate_insights", "render", "generate_html", "generate_pdf", "save_artifacts", "save_history", "compare", "predict", "counterfactuals"]>;
        description: z.ZodString;
        depends_on: z.ZodOptional<z.ZodArray<z.ZodNumber, "many">>;
    }, "strip", z.ZodTypeAny, {
        id: number;
        type: "join" | "scan" | "analyze" | "parse_events" | "load_templates" | "generate_insights" | "render" | "generate_html" | "generate_pdf" | "save_artifacts" | "save_history" | "compare" | "predict" | "counterfactuals";
        description: string;
        depends_on?: number[] | undefined;
    }, {
        id: number;
        type: "join" | "scan" | "analyze" | "parse_events" | "load_templates" | "generate_insights" | "render" | "generate_html" | "generate_pdf" | "save_artifacts" | "save_history" | "compare" | "predict" | "counterfactuals";
        description: string;
        depends_on?: number[] | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    mode: "runtime" | "static" | "combined";
    tasks: {
        id: number;
        type: "join" | "scan" | "analyze" | "parse_events" | "load_templates" | "generate_insights" | "render" | "generate_html" | "generate_pdf" | "save_artifacts" | "save_history" | "compare" | "predict" | "counterfactuals";
        description: string;
        depends_on?: number[] | undefined;
    }[];
}, {
    mode: "runtime" | "static" | "combined";
    tasks: {
        id: number;
        type: "join" | "scan" | "analyze" | "parse_events" | "load_templates" | "generate_insights" | "render" | "generate_html" | "generate_pdf" | "save_artifacts" | "save_history" | "compare" | "predict" | "counterfactuals";
        description: string;
        depends_on?: number[] | undefined;
    }[];
}>;
export declare const TaskResult: z.ZodObject<{
    taskId: z.ZodNumber;
    status: z.ZodEnum<["success", "failed", "skipped"]>;
    error: z.ZodOptional<z.ZodString>;
    durationMs: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    status: "skipped" | "success" | "failed";
    taskId: number;
    durationMs: number;
    error?: string | undefined;
}, {
    status: "skipped" | "success" | "failed";
    taskId: number;
    durationMs: number;
    error?: string | undefined;
}>;
export type Provider = z.infer<typeof Provider>;
export type Severity = z.infer<typeof Severity>;
export type Category = z.infer<typeof Category>;
export type Patterns = z.infer<typeof Patterns>;
export type CallsitePatterns = Patterns;
export type Callsite = z.infer<typeof Callsite>;
export type ScanCandidate = z.infer<typeof ScanCandidate>;
export type ScannedFile = z.infer<typeof ScannedFile>;
export type ScanResult = z.infer<typeof ScanResult>;
export type InferenceMap = z.infer<typeof InferenceMap>;
export type InferenceEvent = z.infer<typeof InferenceEvent>;
export type ProviderStats = z.infer<typeof ProviderStats>;
export type RuntimeSummary = z.infer<typeof RuntimeSummary>;
export type UsageStats = z.infer<typeof UsageStats>;
export type DriftSignal = z.infer<typeof DriftSignal>;
export type EnrichedCallsite = z.infer<typeof EnrichedCallsite>;
export type JoinedOutput = z.infer<typeof JoinedOutput>;
export type TemplateCondition = z.infer<typeof TemplateCondition>;
export type InsightTemplate = z.infer<typeof InsightTemplate>;
export type StackLayer = z.infer<typeof StackLayer>;
export type ImpactType = z.infer<typeof ImpactType>;
export type EffortLevel = z.infer<typeof EffortLevel>;
export type ImpactEstimate = z.infer<typeof ImpactEstimate>;
export type Insight = z.infer<typeof Insight>;
export type PerformanceEnvelope = z.infer<typeof PerformanceEnvelope>;
export type TaskType = z.infer<typeof TaskType>;
export type PlannedTask = z.infer<typeof PlannedTask>;
export type ExecutionPlan = z.infer<typeof ExecutionPlan>;
export type TaskResult = z.infer<typeof TaskResult>;
/**
 * Supported format types for runtime event files.
 * Direct-parse formats are handled without LLM, agent-normalized formats require semantic analysis.
 */
export declare const FormatType: z.ZodEnum<["jsonl", "json_array", "csv", "tsv", "otel", "jaeger", "zipkin", "langsmith", "helicone", "wandb", "litellm", "portkey", "custom_json", "custom_text", "unknown"]>;
/**
 * Extraction strategy for a field mapping.
 */
export declare const ExtractionType: z.ZodEnum<["direct", "jsonpath", "column", "regex", "computed", "constant"]>;
/**
 * Transformation to apply after extraction.
 */
export declare const TransformType: z.ZodEnum<["none", "unix_ms_to_iso", "unix_s_to_iso", "unix_nano_to_iso", "duration_to_ms", "parse_int", "parse_float", "lowercase", "provider_normalize"]>;
/**
 * Field mapping from source format to InferenceEvent schema.
 */
export declare const FieldMapping: z.ZodObject<{
    target: z.ZodString;
    source_path: z.ZodString;
    extraction_type: z.ZodEnum<["direct", "jsonpath", "column", "regex", "computed", "constant"]>;
    transform: z.ZodDefault<z.ZodOptional<z.ZodEnum<["none", "unix_ms_to_iso", "unix_s_to_iso", "unix_nano_to_iso", "duration_to_ms", "parse_int", "parse_float", "lowercase", "provider_normalize"]>>>;
    confidence: z.ZodNumber;
    evidence: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    confidence: number;
    target: string;
    source_path: string;
    extraction_type: "regex" | "direct" | "jsonpath" | "column" | "computed" | "constant";
    transform: "none" | "unix_ms_to_iso" | "unix_s_to_iso" | "unix_nano_to_iso" | "duration_to_ms" | "parse_int" | "parse_float" | "lowercase" | "provider_normalize";
    evidence?: string | undefined;
}, {
    confidence: number;
    target: string;
    source_path: string;
    extraction_type: "regex" | "direct" | "jsonpath" | "column" | "computed" | "constant";
    evidence?: string | undefined;
    transform?: "none" | "unix_ms_to_iso" | "unix_s_to_iso" | "unix_nano_to_iso" | "duration_to_ms" | "parse_int" | "parse_float" | "lowercase" | "provider_normalize" | undefined;
}>;
/**
 * Result of format detection.
 */
export declare const FormatDetectionResult: z.ZodObject<{
    format_type: z.ZodEnum<["jsonl", "json_array", "csv", "tsv", "otel", "jaeger", "zipkin", "langsmith", "helicone", "wandb", "litellm", "portkey", "custom_json", "custom_text", "unknown"]>;
    confidence: z.ZodNumber;
    evidence: z.ZodString;
    sample_size: z.ZodNumber;
    requires_agent: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    evidence: string;
    confidence: number;
    format_type: "unknown" | "jsonl" | "json_array" | "csv" | "tsv" | "otel" | "jaeger" | "zipkin" | "langsmith" | "helicone" | "wandb" | "litellm" | "portkey" | "custom_json" | "custom_text";
    sample_size: number;
    requires_agent: boolean;
}, {
    evidence: string;
    confidence: number;
    format_type: "unknown" | "jsonl" | "json_array" | "csv" | "tsv" | "otel" | "jaeger" | "zipkin" | "langsmith" | "helicone" | "wandb" | "litellm" | "portkey" | "custom_json" | "custom_text";
    sample_size: number;
    requires_agent: boolean;
}>;
/**
 * Complete normalization result with field mappings.
 */
export declare const NormalizationResult: z.ZodObject<{
    detection: z.ZodObject<{
        format_type: z.ZodEnum<["jsonl", "json_array", "csv", "tsv", "otel", "jaeger", "zipkin", "langsmith", "helicone", "wandb", "litellm", "portkey", "custom_json", "custom_text", "unknown"]>;
        confidence: z.ZodNumber;
        evidence: z.ZodString;
        sample_size: z.ZodNumber;
        requires_agent: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        evidence: string;
        confidence: number;
        format_type: "unknown" | "jsonl" | "json_array" | "csv" | "tsv" | "otel" | "jaeger" | "zipkin" | "langsmith" | "helicone" | "wandb" | "litellm" | "portkey" | "custom_json" | "custom_text";
        sample_size: number;
        requires_agent: boolean;
    }, {
        evidence: string;
        confidence: number;
        format_type: "unknown" | "jsonl" | "json_array" | "csv" | "tsv" | "otel" | "jaeger" | "zipkin" | "langsmith" | "helicone" | "wandb" | "litellm" | "portkey" | "custom_json" | "custom_text";
        sample_size: number;
        requires_agent: boolean;
    }>;
    mappings: z.ZodArray<z.ZodObject<{
        target: z.ZodString;
        source_path: z.ZodString;
        extraction_type: z.ZodEnum<["direct", "jsonpath", "column", "regex", "computed", "constant"]>;
        transform: z.ZodDefault<z.ZodOptional<z.ZodEnum<["none", "unix_ms_to_iso", "unix_s_to_iso", "unix_nano_to_iso", "duration_to_ms", "parse_int", "parse_float", "lowercase", "provider_normalize"]>>>;
        confidence: z.ZodNumber;
        evidence: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        confidence: number;
        target: string;
        source_path: string;
        extraction_type: "regex" | "direct" | "jsonpath" | "column" | "computed" | "constant";
        transform: "none" | "unix_ms_to_iso" | "unix_s_to_iso" | "unix_nano_to_iso" | "duration_to_ms" | "parse_int" | "parse_float" | "lowercase" | "provider_normalize";
        evidence?: string | undefined;
    }, {
        confidence: number;
        target: string;
        source_path: string;
        extraction_type: "regex" | "direct" | "jsonpath" | "column" | "computed" | "constant";
        evidence?: string | undefined;
        transform?: "none" | "unix_ms_to_iso" | "unix_s_to_iso" | "unix_nano_to_iso" | "duration_to_ms" | "parse_int" | "parse_float" | "lowercase" | "provider_normalize" | undefined;
    }>, "many">;
    unmapped_fields: z.ZodArray<z.ZodString, "many">;
    warnings: z.ZodArray<z.ZodString, "many">;
    audit: z.ZodObject<{
        normalized_at: z.ZodString;
        agent_used: z.ZodBoolean;
        codebase_context_used: z.ZodBoolean;
        llm_model: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        normalized_at: string;
        agent_used: boolean;
        codebase_context_used: boolean;
        llm_model?: string | undefined;
    }, {
        normalized_at: string;
        agent_used: boolean;
        codebase_context_used: boolean;
        llm_model?: string | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    detection: {
        evidence: string;
        confidence: number;
        format_type: "unknown" | "jsonl" | "json_array" | "csv" | "tsv" | "otel" | "jaeger" | "zipkin" | "langsmith" | "helicone" | "wandb" | "litellm" | "portkey" | "custom_json" | "custom_text";
        sample_size: number;
        requires_agent: boolean;
    };
    mappings: {
        confidence: number;
        target: string;
        source_path: string;
        extraction_type: "regex" | "direct" | "jsonpath" | "column" | "computed" | "constant";
        transform: "none" | "unix_ms_to_iso" | "unix_s_to_iso" | "unix_nano_to_iso" | "duration_to_ms" | "parse_int" | "parse_float" | "lowercase" | "provider_normalize";
        evidence?: string | undefined;
    }[];
    unmapped_fields: string[];
    warnings: string[];
    audit: {
        normalized_at: string;
        agent_used: boolean;
        codebase_context_used: boolean;
        llm_model?: string | undefined;
    };
}, {
    detection: {
        evidence: string;
        confidence: number;
        format_type: "unknown" | "jsonl" | "json_array" | "csv" | "tsv" | "otel" | "jaeger" | "zipkin" | "langsmith" | "helicone" | "wandb" | "litellm" | "portkey" | "custom_json" | "custom_text";
        sample_size: number;
        requires_agent: boolean;
    };
    mappings: {
        confidence: number;
        target: string;
        source_path: string;
        extraction_type: "regex" | "direct" | "jsonpath" | "column" | "computed" | "constant";
        evidence?: string | undefined;
        transform?: "none" | "unix_ms_to_iso" | "unix_s_to_iso" | "unix_nano_to_iso" | "duration_to_ms" | "parse_int" | "parse_float" | "lowercase" | "provider_normalize" | undefined;
    }[];
    unmapped_fields: string[];
    warnings: string[];
    audit: {
        normalized_at: string;
        agent_used: boolean;
        codebase_context_used: boolean;
        llm_model?: string | undefined;
    };
}>;
/**
 * Options for format normalization.
 */
export declare const NormalizationOptions: z.ZodObject<{
    format_hint: z.ZodOptional<z.ZodEnum<["jsonl", "json_array", "csv", "tsv", "otel", "jaeger", "zipkin", "langsmith", "helicone", "wandb", "litellm", "portkey", "custom_json", "custom_text", "unknown"]>>;
    field_hints: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    lenient: z.ZodOptional<z.ZodBoolean>;
    strict: z.ZodOptional<z.ZodBoolean>;
    codebase_context: z.ZodOptional<z.ZodAny>;
}, "strip", z.ZodTypeAny, {
    format_hint?: "unknown" | "jsonl" | "json_array" | "csv" | "tsv" | "otel" | "jaeger" | "zipkin" | "langsmith" | "helicone" | "wandb" | "litellm" | "portkey" | "custom_json" | "custom_text" | undefined;
    field_hints?: Record<string, string> | undefined;
    lenient?: boolean | undefined;
    strict?: boolean | undefined;
    codebase_context?: any;
}, {
    format_hint?: "unknown" | "jsonl" | "json_array" | "csv" | "tsv" | "otel" | "jaeger" | "zipkin" | "langsmith" | "helicone" | "wandb" | "litellm" | "portkey" | "custom_json" | "custom_text" | undefined;
    field_hints?: Record<string, string> | undefined;
    lenient?: boolean | undefined;
    strict?: boolean | undefined;
    codebase_context?: any;
}>;
export type FormatType = z.infer<typeof FormatType>;
export type ExtractionType = z.infer<typeof ExtractionType>;
export type TransformType = z.infer<typeof TransformType>;
export type FieldMapping = z.infer<typeof FieldMapping>;
export type FormatDetectionResult = z.infer<typeof FormatDetectionResult>;
export type NormalizationResult = z.infer<typeof NormalizationResult>;
export type NormalizationOptions = z.infer<typeof NormalizationOptions>;
/**
 * Analysis type for categorizing runs.
 */
export declare const AnalysisType: z.ZodEnum<["static", "runtime", "combined"]>;
/**
 * History manifest for tracking analysis runs over time.
 * Distinct from runid.ts RunManifest which focuses on caching/resumability.
 * This schema enables historical comparison and deploy-time prediction features.
 */
export declare const HistoryManifest: z.ZodObject<{
    runId: z.ZodString;
    timestamp: z.ZodString;
    path: z.ZodString;
    pathHash: z.ZodString;
    analysisType: z.ZodEnum<["static", "runtime", "combined"]>;
    version: z.ZodString;
    inferencePointCount: z.ZodNumber;
    eventCount: z.ZodOptional<z.ZodNumber>;
    driftCount: z.ZodOptional<z.ZodNumber>;
    insightCount: z.ZodOptional<z.ZodNumber>;
    durationMs: z.ZodOptional<z.ZodNumber>;
    artifacts: z.ZodOptional<z.ZodObject<{
        inferenceMap: z.ZodOptional<z.ZodString>;
        analysis: z.ZodOptional<z.ZodString>;
        html: z.ZodOptional<z.ZodString>;
        pdf: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        analysis?: string | undefined;
        inferenceMap?: string | undefined;
        html?: string | undefined;
        pdf?: string | undefined;
    }, {
        analysis?: string | undefined;
        inferenceMap?: string | undefined;
        html?: string | undefined;
        pdf?: string | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    path: string;
    timestamp: string;
    version: string;
    runId: string;
    pathHash: string;
    analysisType: "runtime" | "static" | "combined";
    inferencePointCount: number;
    durationMs?: number | undefined;
    eventCount?: number | undefined;
    driftCount?: number | undefined;
    insightCount?: number | undefined;
    artifacts?: {
        analysis?: string | undefined;
        inferenceMap?: string | undefined;
        html?: string | undefined;
        pdf?: string | undefined;
    } | undefined;
}, {
    path: string;
    timestamp: string;
    version: string;
    runId: string;
    pathHash: string;
    analysisType: "runtime" | "static" | "combined";
    inferencePointCount: number;
    durationMs?: number | undefined;
    eventCount?: number | undefined;
    driftCount?: number | undefined;
    insightCount?: number | undefined;
    artifacts?: {
        analysis?: string | undefined;
        inferenceMap?: string | undefined;
        html?: string | undefined;
        pdf?: string | undefined;
    } | undefined;
}>;
/**
 * Index of all historical runs for a project path.
 * Stored at .peakinfer/history/index.json
 */
export declare const HistoryIndex: z.ZodObject<{
    version: z.ZodString;
    lastUpdated: z.ZodString;
    runs: z.ZodArray<z.ZodObject<{
        runId: z.ZodString;
        timestamp: z.ZodString;
        pathHash: z.ZodString;
        analysisType: z.ZodEnum<["static", "runtime", "combined"]>;
        inferencePointCount: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        timestamp: string;
        runId: string;
        pathHash: string;
        analysisType: "runtime" | "static" | "combined";
        inferencePointCount: number;
    }, {
        timestamp: string;
        runId: string;
        pathHash: string;
        analysisType: "runtime" | "static" | "combined";
        inferencePointCount: number;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    version: string;
    runs: {
        timestamp: string;
        runId: string;
        pathHash: string;
        analysisType: "runtime" | "static" | "combined";
        inferencePointCount: number;
    }[];
    lastUpdated: string;
}, {
    version: string;
    runs: {
        timestamp: string;
        runId: string;
        pathHash: string;
        analysisType: "runtime" | "static" | "combined";
        inferencePointCount: number;
    }[];
    lastUpdated: string;
}>;
export type AnalysisType = z.infer<typeof AnalysisType>;
export type HistoryManifest = z.infer<typeof HistoryManifest>;
export type HistoryIndex = z.infer<typeof HistoryIndex>;
/**
 * Change type for tracking what changed between runs.
 */
export declare const ChangeType: z.ZodEnum<["added", "removed", "modified"]>;
/**
 * A single field change within an inference point.
 */
export declare const FieldChange: z.ZodObject<{
    field: z.ZodString;
    before: z.ZodUnknown;
    after: z.ZodUnknown;
}, "strip", z.ZodTypeAny, {
    field: string;
    before?: unknown;
    after?: unknown;
}, {
    field: string;
    before?: unknown;
    after?: unknown;
}>;
/**
 * An inference point that changed between runs.
 */
export declare const ChangedInferencePoint: z.ZodObject<{
    point: z.ZodObject<{
        id: z.ZodString;
        file: z.ZodString;
        line: z.ZodNumber;
        provider: z.ZodNullable<z.ZodEnum<["openai", "anthropic", "google", "cohere", "mistral", "bedrock", "azure_openai", "together", "fireworks", "groq", "replicate", "perplexity", "vllm", "sglang", "tgi", "ollama", "llamacpp", "unknown"]>>;
        model: z.ZodNullable<z.ZodString>;
        framework: z.ZodNullable<z.ZodString>;
        runtime: z.ZodNullable<z.ZodString>;
        patterns: z.ZodObject<{
            streaming: z.ZodOptional<z.ZodBoolean>;
            batching: z.ZodOptional<z.ZodBoolean>;
            retries: z.ZodOptional<z.ZodBoolean>;
            caching: z.ZodOptional<z.ZodBoolean>;
            fallback: z.ZodOptional<z.ZodBoolean>;
        }, "strip", z.ZodTypeAny, {
            streaming?: boolean | undefined;
            batching?: boolean | undefined;
            retries?: boolean | undefined;
            caching?: boolean | undefined;
            fallback?: boolean | undefined;
        }, {
            streaming?: boolean | undefined;
            batching?: boolean | undefined;
            retries?: boolean | undefined;
            caching?: boolean | undefined;
            fallback?: boolean | undefined;
        }>;
        confidence: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        id: string;
        model: string | null;
        runtime: string | null;
        confidence: number;
        file: string;
        line: number;
        provider: "unknown" | "openai" | "anthropic" | "google" | "cohere" | "mistral" | "bedrock" | "azure_openai" | "together" | "fireworks" | "groq" | "replicate" | "perplexity" | "vllm" | "sglang" | "tgi" | "ollama" | "llamacpp" | null;
        framework: string | null;
        patterns: {
            streaming?: boolean | undefined;
            batching?: boolean | undefined;
            retries?: boolean | undefined;
            caching?: boolean | undefined;
            fallback?: boolean | undefined;
        };
    }, {
        id: string;
        model: string | null;
        runtime: string | null;
        confidence: number;
        file: string;
        line: number;
        provider: "unknown" | "openai" | "anthropic" | "google" | "cohere" | "mistral" | "bedrock" | "azure_openai" | "together" | "fireworks" | "groq" | "replicate" | "perplexity" | "vllm" | "sglang" | "tgi" | "ollama" | "llamacpp" | null;
        framework: string | null;
        patterns: {
            streaming?: boolean | undefined;
            batching?: boolean | undefined;
            retries?: boolean | undefined;
            caching?: boolean | undefined;
            fallback?: boolean | undefined;
        };
    }>;
    changes: z.ZodArray<z.ZodObject<{
        field: z.ZodString;
        before: z.ZodUnknown;
        after: z.ZodUnknown;
    }, "strip", z.ZodTypeAny, {
        field: string;
        before?: unknown;
        after?: unknown;
    }, {
        field: string;
        before?: unknown;
        after?: unknown;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    point: {
        id: string;
        model: string | null;
        runtime: string | null;
        confidence: number;
        file: string;
        line: number;
        provider: "unknown" | "openai" | "anthropic" | "google" | "cohere" | "mistral" | "bedrock" | "azure_openai" | "together" | "fireworks" | "groq" | "replicate" | "perplexity" | "vllm" | "sglang" | "tgi" | "ollama" | "llamacpp" | null;
        framework: string | null;
        patterns: {
            streaming?: boolean | undefined;
            batching?: boolean | undefined;
            retries?: boolean | undefined;
            caching?: boolean | undefined;
            fallback?: boolean | undefined;
        };
    };
    changes: {
        field: string;
        before?: unknown;
        after?: unknown;
    }[];
}, {
    point: {
        id: string;
        model: string | null;
        runtime: string | null;
        confidence: number;
        file: string;
        line: number;
        provider: "unknown" | "openai" | "anthropic" | "google" | "cohere" | "mistral" | "bedrock" | "azure_openai" | "together" | "fireworks" | "groq" | "replicate" | "perplexity" | "vllm" | "sglang" | "tgi" | "ollama" | "llamacpp" | null;
        framework: string | null;
        patterns: {
            streaming?: boolean | undefined;
            batching?: boolean | undefined;
            retries?: boolean | undefined;
            caching?: boolean | undefined;
            fallback?: boolean | undefined;
        };
    };
    changes: {
        field: string;
        before?: unknown;
        after?: unknown;
    }[];
}>;
/**
 * Result of comparing two analysis runs.
 * Enables "what changed" insights for pre-deploy validation.
 */
export declare const ComparisonResult: z.ZodObject<{
    baseRunId: z.ZodString;
    baseTimestamp: z.ZodString;
    currentRunId: z.ZodString;
    currentTimestamp: z.ZodString;
    added: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        file: z.ZodString;
        line: z.ZodNumber;
        provider: z.ZodNullable<z.ZodEnum<["openai", "anthropic", "google", "cohere", "mistral", "bedrock", "azure_openai", "together", "fireworks", "groq", "replicate", "perplexity", "vllm", "sglang", "tgi", "ollama", "llamacpp", "unknown"]>>;
        model: z.ZodNullable<z.ZodString>;
        framework: z.ZodNullable<z.ZodString>;
        runtime: z.ZodNullable<z.ZodString>;
        patterns: z.ZodObject<{
            streaming: z.ZodOptional<z.ZodBoolean>;
            batching: z.ZodOptional<z.ZodBoolean>;
            retries: z.ZodOptional<z.ZodBoolean>;
            caching: z.ZodOptional<z.ZodBoolean>;
            fallback: z.ZodOptional<z.ZodBoolean>;
        }, "strip", z.ZodTypeAny, {
            streaming?: boolean | undefined;
            batching?: boolean | undefined;
            retries?: boolean | undefined;
            caching?: boolean | undefined;
            fallback?: boolean | undefined;
        }, {
            streaming?: boolean | undefined;
            batching?: boolean | undefined;
            retries?: boolean | undefined;
            caching?: boolean | undefined;
            fallback?: boolean | undefined;
        }>;
        confidence: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        id: string;
        model: string | null;
        runtime: string | null;
        confidence: number;
        file: string;
        line: number;
        provider: "unknown" | "openai" | "anthropic" | "google" | "cohere" | "mistral" | "bedrock" | "azure_openai" | "together" | "fireworks" | "groq" | "replicate" | "perplexity" | "vllm" | "sglang" | "tgi" | "ollama" | "llamacpp" | null;
        framework: string | null;
        patterns: {
            streaming?: boolean | undefined;
            batching?: boolean | undefined;
            retries?: boolean | undefined;
            caching?: boolean | undefined;
            fallback?: boolean | undefined;
        };
    }, {
        id: string;
        model: string | null;
        runtime: string | null;
        confidence: number;
        file: string;
        line: number;
        provider: "unknown" | "openai" | "anthropic" | "google" | "cohere" | "mistral" | "bedrock" | "azure_openai" | "together" | "fireworks" | "groq" | "replicate" | "perplexity" | "vllm" | "sglang" | "tgi" | "ollama" | "llamacpp" | null;
        framework: string | null;
        patterns: {
            streaming?: boolean | undefined;
            batching?: boolean | undefined;
            retries?: boolean | undefined;
            caching?: boolean | undefined;
            fallback?: boolean | undefined;
        };
    }>, "many">;
    removed: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        file: z.ZodString;
        line: z.ZodNumber;
        provider: z.ZodNullable<z.ZodEnum<["openai", "anthropic", "google", "cohere", "mistral", "bedrock", "azure_openai", "together", "fireworks", "groq", "replicate", "perplexity", "vllm", "sglang", "tgi", "ollama", "llamacpp", "unknown"]>>;
        model: z.ZodNullable<z.ZodString>;
        framework: z.ZodNullable<z.ZodString>;
        runtime: z.ZodNullable<z.ZodString>;
        patterns: z.ZodObject<{
            streaming: z.ZodOptional<z.ZodBoolean>;
            batching: z.ZodOptional<z.ZodBoolean>;
            retries: z.ZodOptional<z.ZodBoolean>;
            caching: z.ZodOptional<z.ZodBoolean>;
            fallback: z.ZodOptional<z.ZodBoolean>;
        }, "strip", z.ZodTypeAny, {
            streaming?: boolean | undefined;
            batching?: boolean | undefined;
            retries?: boolean | undefined;
            caching?: boolean | undefined;
            fallback?: boolean | undefined;
        }, {
            streaming?: boolean | undefined;
            batching?: boolean | undefined;
            retries?: boolean | undefined;
            caching?: boolean | undefined;
            fallback?: boolean | undefined;
        }>;
        confidence: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        id: string;
        model: string | null;
        runtime: string | null;
        confidence: number;
        file: string;
        line: number;
        provider: "unknown" | "openai" | "anthropic" | "google" | "cohere" | "mistral" | "bedrock" | "azure_openai" | "together" | "fireworks" | "groq" | "replicate" | "perplexity" | "vllm" | "sglang" | "tgi" | "ollama" | "llamacpp" | null;
        framework: string | null;
        patterns: {
            streaming?: boolean | undefined;
            batching?: boolean | undefined;
            retries?: boolean | undefined;
            caching?: boolean | undefined;
            fallback?: boolean | undefined;
        };
    }, {
        id: string;
        model: string | null;
        runtime: string | null;
        confidence: number;
        file: string;
        line: number;
        provider: "unknown" | "openai" | "anthropic" | "google" | "cohere" | "mistral" | "bedrock" | "azure_openai" | "together" | "fireworks" | "groq" | "replicate" | "perplexity" | "vllm" | "sglang" | "tgi" | "ollama" | "llamacpp" | null;
        framework: string | null;
        patterns: {
            streaming?: boolean | undefined;
            batching?: boolean | undefined;
            retries?: boolean | undefined;
            caching?: boolean | undefined;
            fallback?: boolean | undefined;
        };
    }>, "many">;
    changed: z.ZodArray<z.ZodObject<{
        point: z.ZodObject<{
            id: z.ZodString;
            file: z.ZodString;
            line: z.ZodNumber;
            provider: z.ZodNullable<z.ZodEnum<["openai", "anthropic", "google", "cohere", "mistral", "bedrock", "azure_openai", "together", "fireworks", "groq", "replicate", "perplexity", "vllm", "sglang", "tgi", "ollama", "llamacpp", "unknown"]>>;
            model: z.ZodNullable<z.ZodString>;
            framework: z.ZodNullable<z.ZodString>;
            runtime: z.ZodNullable<z.ZodString>;
            patterns: z.ZodObject<{
                streaming: z.ZodOptional<z.ZodBoolean>;
                batching: z.ZodOptional<z.ZodBoolean>;
                retries: z.ZodOptional<z.ZodBoolean>;
                caching: z.ZodOptional<z.ZodBoolean>;
                fallback: z.ZodOptional<z.ZodBoolean>;
            }, "strip", z.ZodTypeAny, {
                streaming?: boolean | undefined;
                batching?: boolean | undefined;
                retries?: boolean | undefined;
                caching?: boolean | undefined;
                fallback?: boolean | undefined;
            }, {
                streaming?: boolean | undefined;
                batching?: boolean | undefined;
                retries?: boolean | undefined;
                caching?: boolean | undefined;
                fallback?: boolean | undefined;
            }>;
            confidence: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            id: string;
            model: string | null;
            runtime: string | null;
            confidence: number;
            file: string;
            line: number;
            provider: "unknown" | "openai" | "anthropic" | "google" | "cohere" | "mistral" | "bedrock" | "azure_openai" | "together" | "fireworks" | "groq" | "replicate" | "perplexity" | "vllm" | "sglang" | "tgi" | "ollama" | "llamacpp" | null;
            framework: string | null;
            patterns: {
                streaming?: boolean | undefined;
                batching?: boolean | undefined;
                retries?: boolean | undefined;
                caching?: boolean | undefined;
                fallback?: boolean | undefined;
            };
        }, {
            id: string;
            model: string | null;
            runtime: string | null;
            confidence: number;
            file: string;
            line: number;
            provider: "unknown" | "openai" | "anthropic" | "google" | "cohere" | "mistral" | "bedrock" | "azure_openai" | "together" | "fireworks" | "groq" | "replicate" | "perplexity" | "vllm" | "sglang" | "tgi" | "ollama" | "llamacpp" | null;
            framework: string | null;
            patterns: {
                streaming?: boolean | undefined;
                batching?: boolean | undefined;
                retries?: boolean | undefined;
                caching?: boolean | undefined;
                fallback?: boolean | undefined;
            };
        }>;
        changes: z.ZodArray<z.ZodObject<{
            field: z.ZodString;
            before: z.ZodUnknown;
            after: z.ZodUnknown;
        }, "strip", z.ZodTypeAny, {
            field: string;
            before?: unknown;
            after?: unknown;
        }, {
            field: string;
            before?: unknown;
            after?: unknown;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        point: {
            id: string;
            model: string | null;
            runtime: string | null;
            confidence: number;
            file: string;
            line: number;
            provider: "unknown" | "openai" | "anthropic" | "google" | "cohere" | "mistral" | "bedrock" | "azure_openai" | "together" | "fireworks" | "groq" | "replicate" | "perplexity" | "vllm" | "sglang" | "tgi" | "ollama" | "llamacpp" | null;
            framework: string | null;
            patterns: {
                streaming?: boolean | undefined;
                batching?: boolean | undefined;
                retries?: boolean | undefined;
                caching?: boolean | undefined;
                fallback?: boolean | undefined;
            };
        };
        changes: {
            field: string;
            before?: unknown;
            after?: unknown;
        }[];
    }, {
        point: {
            id: string;
            model: string | null;
            runtime: string | null;
            confidence: number;
            file: string;
            line: number;
            provider: "unknown" | "openai" | "anthropic" | "google" | "cohere" | "mistral" | "bedrock" | "azure_openai" | "together" | "fireworks" | "groq" | "replicate" | "perplexity" | "vllm" | "sglang" | "tgi" | "ollama" | "llamacpp" | null;
            framework: string | null;
            patterns: {
                streaming?: boolean | undefined;
                batching?: boolean | undefined;
                retries?: boolean | undefined;
                caching?: boolean | undefined;
                fallback?: boolean | undefined;
            };
        };
        changes: {
            field: string;
            before?: unknown;
            after?: unknown;
        }[];
    }>, "many">;
    metrics: z.ZodObject<{
        totalBefore: z.ZodNumber;
        totalAfter: z.ZodNumber;
        addedCount: z.ZodNumber;
        removedCount: z.ZodNumber;
        changedCount: z.ZodNumber;
        netChange: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        totalBefore: number;
        totalAfter: number;
        addedCount: number;
        removedCount: number;
        changedCount: number;
        netChange: number;
    }, {
        totalBefore: number;
        totalAfter: number;
        addedCount: number;
        removedCount: number;
        changedCount: number;
        netChange: number;
    }>;
    insightDeltas: z.ZodOptional<z.ZodObject<{
        newCritical: z.ZodNumber;
        resolvedCritical: z.ZodNumber;
        newWarnings: z.ZodNumber;
        resolvedWarnings: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        newCritical: number;
        resolvedCritical: number;
        newWarnings: number;
        resolvedWarnings: number;
    }, {
        newCritical: number;
        resolvedCritical: number;
        newWarnings: number;
        resolvedWarnings: number;
    }>>;
}, "strip", z.ZodTypeAny, {
    baseRunId: string;
    baseTimestamp: string;
    currentRunId: string;
    currentTimestamp: string;
    added: {
        id: string;
        model: string | null;
        runtime: string | null;
        confidence: number;
        file: string;
        line: number;
        provider: "unknown" | "openai" | "anthropic" | "google" | "cohere" | "mistral" | "bedrock" | "azure_openai" | "together" | "fireworks" | "groq" | "replicate" | "perplexity" | "vllm" | "sglang" | "tgi" | "ollama" | "llamacpp" | null;
        framework: string | null;
        patterns: {
            streaming?: boolean | undefined;
            batching?: boolean | undefined;
            retries?: boolean | undefined;
            caching?: boolean | undefined;
            fallback?: boolean | undefined;
        };
    }[];
    removed: {
        id: string;
        model: string | null;
        runtime: string | null;
        confidence: number;
        file: string;
        line: number;
        provider: "unknown" | "openai" | "anthropic" | "google" | "cohere" | "mistral" | "bedrock" | "azure_openai" | "together" | "fireworks" | "groq" | "replicate" | "perplexity" | "vllm" | "sglang" | "tgi" | "ollama" | "llamacpp" | null;
        framework: string | null;
        patterns: {
            streaming?: boolean | undefined;
            batching?: boolean | undefined;
            retries?: boolean | undefined;
            caching?: boolean | undefined;
            fallback?: boolean | undefined;
        };
    }[];
    changed: {
        point: {
            id: string;
            model: string | null;
            runtime: string | null;
            confidence: number;
            file: string;
            line: number;
            provider: "unknown" | "openai" | "anthropic" | "google" | "cohere" | "mistral" | "bedrock" | "azure_openai" | "together" | "fireworks" | "groq" | "replicate" | "perplexity" | "vllm" | "sglang" | "tgi" | "ollama" | "llamacpp" | null;
            framework: string | null;
            patterns: {
                streaming?: boolean | undefined;
                batching?: boolean | undefined;
                retries?: boolean | undefined;
                caching?: boolean | undefined;
                fallback?: boolean | undefined;
            };
        };
        changes: {
            field: string;
            before?: unknown;
            after?: unknown;
        }[];
    }[];
    metrics: {
        totalBefore: number;
        totalAfter: number;
        addedCount: number;
        removedCount: number;
        changedCount: number;
        netChange: number;
    };
    insightDeltas?: {
        newCritical: number;
        resolvedCritical: number;
        newWarnings: number;
        resolvedWarnings: number;
    } | undefined;
}, {
    baseRunId: string;
    baseTimestamp: string;
    currentRunId: string;
    currentTimestamp: string;
    added: {
        id: string;
        model: string | null;
        runtime: string | null;
        confidence: number;
        file: string;
        line: number;
        provider: "unknown" | "openai" | "anthropic" | "google" | "cohere" | "mistral" | "bedrock" | "azure_openai" | "together" | "fireworks" | "groq" | "replicate" | "perplexity" | "vllm" | "sglang" | "tgi" | "ollama" | "llamacpp" | null;
        framework: string | null;
        patterns: {
            streaming?: boolean | undefined;
            batching?: boolean | undefined;
            retries?: boolean | undefined;
            caching?: boolean | undefined;
            fallback?: boolean | undefined;
        };
    }[];
    removed: {
        id: string;
        model: string | null;
        runtime: string | null;
        confidence: number;
        file: string;
        line: number;
        provider: "unknown" | "openai" | "anthropic" | "google" | "cohere" | "mistral" | "bedrock" | "azure_openai" | "together" | "fireworks" | "groq" | "replicate" | "perplexity" | "vllm" | "sglang" | "tgi" | "ollama" | "llamacpp" | null;
        framework: string | null;
        patterns: {
            streaming?: boolean | undefined;
            batching?: boolean | undefined;
            retries?: boolean | undefined;
            caching?: boolean | undefined;
            fallback?: boolean | undefined;
        };
    }[];
    changed: {
        point: {
            id: string;
            model: string | null;
            runtime: string | null;
            confidence: number;
            file: string;
            line: number;
            provider: "unknown" | "openai" | "anthropic" | "google" | "cohere" | "mistral" | "bedrock" | "azure_openai" | "together" | "fireworks" | "groq" | "replicate" | "perplexity" | "vllm" | "sglang" | "tgi" | "ollama" | "llamacpp" | null;
            framework: string | null;
            patterns: {
                streaming?: boolean | undefined;
                batching?: boolean | undefined;
                retries?: boolean | undefined;
                caching?: boolean | undefined;
                fallback?: boolean | undefined;
            };
        };
        changes: {
            field: string;
            before?: unknown;
            after?: unknown;
        }[];
    }[];
    metrics: {
        totalBefore: number;
        totalAfter: number;
        addedCount: number;
        removedCount: number;
        changedCount: number;
        netChange: number;
    };
    insightDeltas?: {
        newCritical: number;
        resolvedCritical: number;
        newWarnings: number;
        resolvedWarnings: number;
    } | undefined;
}>;
export type ChangeType = z.infer<typeof ChangeType>;
export type FieldChange = z.infer<typeof FieldChange>;
export type ChangedInferencePoint = z.infer<typeof ChangedInferencePoint>;
export type ComparisonResult = z.infer<typeof ComparisonResult>;
/**
 * Risk level for predictions.
 */
export declare const RiskLevel: z.ZodEnum<["high", "medium", "low", "neutral"]>;
/**
 * Impact direction for a prediction factor.
 */
export declare const ImpactDirection: z.ZodEnum<["positive", "negative", "neutral"]>;
/**
 * A factor contributing to a latency prediction.
 */
export declare const PredictionFactor: z.ZodObject<{
    name: z.ZodString;
    impact: z.ZodEnum<["positive", "negative", "neutral"]>;
    description: z.ZodString;
    weight: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    impact: "neutral" | "positive" | "negative";
    description: string;
    name: string;
    weight?: number | undefined;
}, {
    impact: "neutral" | "positive" | "negative";
    description: string;
    name: string;
    weight?: number | undefined;
}>;
/**
 * Latency percentile values.
 */
export declare const LatencyPercentiles: z.ZodObject<{
    p50: z.ZodNumber;
    p95: z.ZodNumber;
    p99: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    p50: number;
    p95: number;
    p99: number;
}, {
    p50: number;
    p95: number;
    p99: number;
}>;
/**
 * Prediction for a single inference point.
 * Surfaces potential performance risks before deployment.
 */
export declare const InferencePointPrediction: z.ZodObject<{
    inferencePointId: z.ZodString;
    location: z.ZodString;
    provider: z.ZodOptional<z.ZodString>;
    model: z.ZodOptional<z.ZodString>;
    currentLatency: z.ZodOptional<z.ZodObject<{
        p50: z.ZodNumber;
        p95: z.ZodNumber;
        p99: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        p50: number;
        p95: number;
        p99: number;
    }, {
        p50: number;
        p95: number;
        p99: number;
    }>>;
    predictedLatency: z.ZodObject<{
        p50: z.ZodNumber;
        p95: z.ZodNumber;
        p99: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        p50: number;
        p95: number;
        p99: number;
    }, {
        p50: number;
        p95: number;
        p99: number;
    }>;
    risk: z.ZodEnum<["high", "medium", "low", "neutral"]>;
    riskScore: z.ZodNumber;
    factors: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        impact: z.ZodEnum<["positive", "negative", "neutral"]>;
        description: z.ZodString;
        weight: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        impact: "neutral" | "positive" | "negative";
        description: string;
        name: string;
        weight?: number | undefined;
    }, {
        impact: "neutral" | "positive" | "negative";
        description: string;
        name: string;
        weight?: number | undefined;
    }>, "many">;
    confidence: z.ZodEnum<["high", "medium", "low"]>;
    confidenceReason: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    location: string;
    confidence: "high" | "medium" | "low";
    inferencePointId: string;
    predictedLatency: {
        p50: number;
        p95: number;
        p99: number;
    };
    risk: "high" | "medium" | "low" | "neutral";
    riskScore: number;
    factors: {
        impact: "neutral" | "positive" | "negative";
        description: string;
        name: string;
        weight?: number | undefined;
    }[];
    model?: string | undefined;
    provider?: string | undefined;
    currentLatency?: {
        p50: number;
        p95: number;
        p99: number;
    } | undefined;
    confidenceReason?: string | undefined;
}, {
    location: string;
    confidence: "high" | "medium" | "low";
    inferencePointId: string;
    predictedLatency: {
        p50: number;
        p95: number;
        p99: number;
    };
    risk: "high" | "medium" | "low" | "neutral";
    riskScore: number;
    factors: {
        impact: "neutral" | "positive" | "negative";
        description: string;
        name: string;
        weight?: number | undefined;
    }[];
    model?: string | undefined;
    provider?: string | undefined;
    currentLatency?: {
        p50: number;
        p95: number;
        p99: number;
    } | undefined;
    confidenceReason?: string | undefined;
}>;
/**
 * Summary of all predictions.
 */
export declare const PredictionSummary: z.ZodObject<{
    totalPoints: z.ZodNumber;
    highRiskCount: z.ZodNumber;
    mediumRiskCount: z.ZodNumber;
    lowRiskCount: z.ZodNumber;
    averageP95: z.ZodNumber;
    worstP95: z.ZodNumber;
    budgetExceeded: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    totalPoints: number;
    highRiskCount: number;
    mediumRiskCount: number;
    lowRiskCount: number;
    averageP95: number;
    worstP95: number;
    budgetExceeded?: boolean | undefined;
}, {
    totalPoints: number;
    highRiskCount: number;
    mediumRiskCount: number;
    lowRiskCount: number;
    averageP95: number;
    worstP95: number;
    budgetExceeded?: boolean | undefined;
}>;
/**
 * Full prediction result for deploy-time analysis.
 */
export declare const PredictionResult: z.ZodObject<{
    predictions: z.ZodArray<z.ZodObject<{
        inferencePointId: z.ZodString;
        location: z.ZodString;
        provider: z.ZodOptional<z.ZodString>;
        model: z.ZodOptional<z.ZodString>;
        currentLatency: z.ZodOptional<z.ZodObject<{
            p50: z.ZodNumber;
            p95: z.ZodNumber;
            p99: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            p50: number;
            p95: number;
            p99: number;
        }, {
            p50: number;
            p95: number;
            p99: number;
        }>>;
        predictedLatency: z.ZodObject<{
            p50: z.ZodNumber;
            p95: z.ZodNumber;
            p99: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            p50: number;
            p95: number;
            p99: number;
        }, {
            p50: number;
            p95: number;
            p99: number;
        }>;
        risk: z.ZodEnum<["high", "medium", "low", "neutral"]>;
        riskScore: z.ZodNumber;
        factors: z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            impact: z.ZodEnum<["positive", "negative", "neutral"]>;
            description: z.ZodString;
            weight: z.ZodOptional<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            impact: "neutral" | "positive" | "negative";
            description: string;
            name: string;
            weight?: number | undefined;
        }, {
            impact: "neutral" | "positive" | "negative";
            description: string;
            name: string;
            weight?: number | undefined;
        }>, "many">;
        confidence: z.ZodEnum<["high", "medium", "low"]>;
        confidenceReason: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        location: string;
        confidence: "high" | "medium" | "low";
        inferencePointId: string;
        predictedLatency: {
            p50: number;
            p95: number;
            p99: number;
        };
        risk: "high" | "medium" | "low" | "neutral";
        riskScore: number;
        factors: {
            impact: "neutral" | "positive" | "negative";
            description: string;
            name: string;
            weight?: number | undefined;
        }[];
        model?: string | undefined;
        provider?: string | undefined;
        currentLatency?: {
            p50: number;
            p95: number;
            p99: number;
        } | undefined;
        confidenceReason?: string | undefined;
    }, {
        location: string;
        confidence: "high" | "medium" | "low";
        inferencePointId: string;
        predictedLatency: {
            p50: number;
            p95: number;
            p99: number;
        };
        risk: "high" | "medium" | "low" | "neutral";
        riskScore: number;
        factors: {
            impact: "neutral" | "positive" | "negative";
            description: string;
            name: string;
            weight?: number | undefined;
        }[];
        model?: string | undefined;
        provider?: string | undefined;
        currentLatency?: {
            p50: number;
            p95: number;
            p99: number;
        } | undefined;
        confidenceReason?: string | undefined;
    }>, "many">;
    summary: z.ZodObject<{
        totalPoints: z.ZodNumber;
        highRiskCount: z.ZodNumber;
        mediumRiskCount: z.ZodNumber;
        lowRiskCount: z.ZodNumber;
        averageP95: z.ZodNumber;
        worstP95: z.ZodNumber;
        budgetExceeded: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        totalPoints: number;
        highRiskCount: number;
        mediumRiskCount: number;
        lowRiskCount: number;
        averageP95: number;
        worstP95: number;
        budgetExceeded?: boolean | undefined;
    }, {
        totalPoints: number;
        highRiskCount: number;
        mediumRiskCount: number;
        lowRiskCount: number;
        averageP95: number;
        worstP95: number;
        budgetExceeded?: boolean | undefined;
    }>;
    targetP95: z.ZodOptional<z.ZodNumber>;
    generatedAt: z.ZodString;
    basedOnRuns: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    summary: {
        totalPoints: number;
        highRiskCount: number;
        mediumRiskCount: number;
        lowRiskCount: number;
        averageP95: number;
        worstP95: number;
        budgetExceeded?: boolean | undefined;
    };
    generatedAt: string;
    predictions: {
        location: string;
        confidence: "high" | "medium" | "low";
        inferencePointId: string;
        predictedLatency: {
            p50: number;
            p95: number;
            p99: number;
        };
        risk: "high" | "medium" | "low" | "neutral";
        riskScore: number;
        factors: {
            impact: "neutral" | "positive" | "negative";
            description: string;
            name: string;
            weight?: number | undefined;
        }[];
        model?: string | undefined;
        provider?: string | undefined;
        currentLatency?: {
            p50: number;
            p95: number;
            p99: number;
        } | undefined;
        confidenceReason?: string | undefined;
    }[];
    basedOnRuns: number;
    targetP95?: number | undefined;
}, {
    summary: {
        totalPoints: number;
        highRiskCount: number;
        mediumRiskCount: number;
        lowRiskCount: number;
        averageP95: number;
        worstP95: number;
        budgetExceeded?: boolean | undefined;
    };
    generatedAt: string;
    predictions: {
        location: string;
        confidence: "high" | "medium" | "low";
        inferencePointId: string;
        predictedLatency: {
            p50: number;
            p95: number;
            p99: number;
        };
        risk: "high" | "medium" | "low" | "neutral";
        riskScore: number;
        factors: {
            impact: "neutral" | "positive" | "negative";
            description: string;
            name: string;
            weight?: number | undefined;
        }[];
        model?: string | undefined;
        provider?: string | undefined;
        currentLatency?: {
            p50: number;
            p95: number;
            p99: number;
        } | undefined;
        confidenceReason?: string | undefined;
    }[];
    basedOnRuns: number;
    targetP95?: number | undefined;
}>;
export type RiskLevel = z.infer<typeof RiskLevel>;
export type ImpactDirection = z.infer<typeof ImpactDirection>;
export type PredictionFactor = z.infer<typeof PredictionFactor>;
export type LatencyPercentiles = z.infer<typeof LatencyPercentiles>;
export type InferencePointPrediction = z.infer<typeof InferencePointPrediction>;
export type PredictionSummary = z.infer<typeof PredictionSummary>;
export type PredictionResult = z.infer<typeof PredictionResult>;
/**
 * Type of counterfactual optimization scenario.
 */
export declare const CounterfactualType: z.ZodEnum<["model_swap", "batch_optimization", "cache_addition", "provider_change", "streaming_enable"]>;
/**
 * Current and proposed state for a counterfactual.
 */
export declare const CounterfactualState: z.ZodObject<{
    model: z.ZodOptional<z.ZodString>;
    provider: z.ZodOptional<z.ZodString>;
    pattern: z.ZodOptional<z.ZodString>;
    estimatedLatency: z.ZodNumber;
    estimatedCost: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    estimatedLatency: number;
    estimatedCost: number;
    model?: string | undefined;
    pattern?: string | undefined;
    provider?: string | undefined;
}, {
    estimatedLatency: number;
    estimatedCost: number;
    model?: string | undefined;
    pattern?: string | undefined;
    provider?: string | undefined;
}>;
/**
 * Impact assessment for a counterfactual.
 */
export declare const CounterfactualImpact: z.ZodObject<{
    latencyDelta: z.ZodNumber;
    latencyDeltaPercent: z.ZodNumber;
    costDelta: z.ZodNumber;
    costDeltaPercent: z.ZodNumber;
    tradeoffs: z.ZodArray<z.ZodString, "many">;
}, "strip", z.ZodTypeAny, {
    latencyDelta: number;
    latencyDeltaPercent: number;
    costDelta: number;
    costDeltaPercent: number;
    tradeoffs: string[];
}, {
    latencyDelta: number;
    latencyDeltaPercent: number;
    costDelta: number;
    costDeltaPercent: number;
    tradeoffs: string[];
}>;
/**
 * A single counterfactual "what if" scenario.
 * Shows the road not taken and its potential impact.
 */
export declare const Counterfactual: z.ZodObject<{
    id: z.ZodString;
    type: z.ZodEnum<["model_swap", "batch_optimization", "cache_addition", "provider_change", "streaming_enable"]>;
    headline: z.ZodString;
    description: z.ZodString;
    currentState: z.ZodObject<{
        model: z.ZodOptional<z.ZodString>;
        provider: z.ZodOptional<z.ZodString>;
        pattern: z.ZodOptional<z.ZodString>;
        estimatedLatency: z.ZodNumber;
        estimatedCost: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        estimatedLatency: number;
        estimatedCost: number;
        model?: string | undefined;
        pattern?: string | undefined;
        provider?: string | undefined;
    }, {
        estimatedLatency: number;
        estimatedCost: number;
        model?: string | undefined;
        pattern?: string | undefined;
        provider?: string | undefined;
    }>;
    proposedState: z.ZodObject<{
        model: z.ZodOptional<z.ZodString>;
        provider: z.ZodOptional<z.ZodString>;
        pattern: z.ZodOptional<z.ZodString>;
        estimatedLatency: z.ZodNumber;
        estimatedCost: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        estimatedLatency: number;
        estimatedCost: number;
        model?: string | undefined;
        pattern?: string | undefined;
        provider?: string | undefined;
    }, {
        estimatedLatency: number;
        estimatedCost: number;
        model?: string | undefined;
        pattern?: string | undefined;
        provider?: string | undefined;
    }>;
    impact: z.ZodObject<{
        latencyDelta: z.ZodNumber;
        latencyDeltaPercent: z.ZodNumber;
        costDelta: z.ZodNumber;
        costDeltaPercent: z.ZodNumber;
        tradeoffs: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        latencyDelta: number;
        latencyDeltaPercent: number;
        costDelta: number;
        costDeltaPercent: number;
        tradeoffs: string[];
    }, {
        latencyDelta: number;
        latencyDeltaPercent: number;
        costDelta: number;
        costDeltaPercent: number;
        tradeoffs: string[];
    }>;
    confidence: z.ZodEnum<["high", "medium", "low"]>;
    confidenceReason: z.ZodOptional<z.ZodString>;
    affectedPoints: z.ZodArray<z.ZodString, "many">;
    effort: z.ZodEnum<["low", "medium", "high"]>;
}, "strip", z.ZodTypeAny, {
    id: string;
    headline: string;
    effort: "high" | "medium" | "low";
    confidence: "high" | "medium" | "low";
    type: "model_swap" | "batch_optimization" | "cache_addition" | "provider_change" | "streaming_enable";
    impact: {
        latencyDelta: number;
        latencyDeltaPercent: number;
        costDelta: number;
        costDeltaPercent: number;
        tradeoffs: string[];
    };
    description: string;
    currentState: {
        estimatedLatency: number;
        estimatedCost: number;
        model?: string | undefined;
        pattern?: string | undefined;
        provider?: string | undefined;
    };
    proposedState: {
        estimatedLatency: number;
        estimatedCost: number;
        model?: string | undefined;
        pattern?: string | undefined;
        provider?: string | undefined;
    };
    affectedPoints: string[];
    confidenceReason?: string | undefined;
}, {
    id: string;
    headline: string;
    effort: "high" | "medium" | "low";
    confidence: "high" | "medium" | "low";
    type: "model_swap" | "batch_optimization" | "cache_addition" | "provider_change" | "streaming_enable";
    impact: {
        latencyDelta: number;
        latencyDeltaPercent: number;
        costDelta: number;
        costDeltaPercent: number;
        tradeoffs: string[];
    };
    description: string;
    currentState: {
        estimatedLatency: number;
        estimatedCost: number;
        model?: string | undefined;
        pattern?: string | undefined;
        provider?: string | undefined;
    };
    proposedState: {
        estimatedLatency: number;
        estimatedCost: number;
        model?: string | undefined;
        pattern?: string | undefined;
        provider?: string | undefined;
    };
    affectedPoints: string[];
    confidenceReason?: string | undefined;
}>;
/**
 * Summary of counterfactual opportunities.
 */
export declare const CounterfactualSummary: z.ZodObject<{
    totalOpportunities: z.ZodNumber;
    maxLatencySavingsMs: z.ZodNumber;
    maxLatencySavingsPercent: z.ZodNumber;
    maxCostSavings: z.ZodNumber;
    maxCostSavingsPercent: z.ZodNumber;
    byType: z.ZodRecord<z.ZodString, z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    totalOpportunities: number;
    maxLatencySavingsMs: number;
    maxLatencySavingsPercent: number;
    maxCostSavings: number;
    maxCostSavingsPercent: number;
    byType: Record<string, number>;
}, {
    totalOpportunities: number;
    maxLatencySavingsMs: number;
    maxLatencySavingsPercent: number;
    maxCostSavings: number;
    maxCostSavingsPercent: number;
    byType: Record<string, number>;
}>;
/**
 * Full counterfactual analysis result.
 */
export declare const CounterfactualResult: z.ZodObject<{
    counterfactuals: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        type: z.ZodEnum<["model_swap", "batch_optimization", "cache_addition", "provider_change", "streaming_enable"]>;
        headline: z.ZodString;
        description: z.ZodString;
        currentState: z.ZodObject<{
            model: z.ZodOptional<z.ZodString>;
            provider: z.ZodOptional<z.ZodString>;
            pattern: z.ZodOptional<z.ZodString>;
            estimatedLatency: z.ZodNumber;
            estimatedCost: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            estimatedLatency: number;
            estimatedCost: number;
            model?: string | undefined;
            pattern?: string | undefined;
            provider?: string | undefined;
        }, {
            estimatedLatency: number;
            estimatedCost: number;
            model?: string | undefined;
            pattern?: string | undefined;
            provider?: string | undefined;
        }>;
        proposedState: z.ZodObject<{
            model: z.ZodOptional<z.ZodString>;
            provider: z.ZodOptional<z.ZodString>;
            pattern: z.ZodOptional<z.ZodString>;
            estimatedLatency: z.ZodNumber;
            estimatedCost: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            estimatedLatency: number;
            estimatedCost: number;
            model?: string | undefined;
            pattern?: string | undefined;
            provider?: string | undefined;
        }, {
            estimatedLatency: number;
            estimatedCost: number;
            model?: string | undefined;
            pattern?: string | undefined;
            provider?: string | undefined;
        }>;
        impact: z.ZodObject<{
            latencyDelta: z.ZodNumber;
            latencyDeltaPercent: z.ZodNumber;
            costDelta: z.ZodNumber;
            costDeltaPercent: z.ZodNumber;
            tradeoffs: z.ZodArray<z.ZodString, "many">;
        }, "strip", z.ZodTypeAny, {
            latencyDelta: number;
            latencyDeltaPercent: number;
            costDelta: number;
            costDeltaPercent: number;
            tradeoffs: string[];
        }, {
            latencyDelta: number;
            latencyDeltaPercent: number;
            costDelta: number;
            costDeltaPercent: number;
            tradeoffs: string[];
        }>;
        confidence: z.ZodEnum<["high", "medium", "low"]>;
        confidenceReason: z.ZodOptional<z.ZodString>;
        affectedPoints: z.ZodArray<z.ZodString, "many">;
        effort: z.ZodEnum<["low", "medium", "high"]>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        headline: string;
        effort: "high" | "medium" | "low";
        confidence: "high" | "medium" | "low";
        type: "model_swap" | "batch_optimization" | "cache_addition" | "provider_change" | "streaming_enable";
        impact: {
            latencyDelta: number;
            latencyDeltaPercent: number;
            costDelta: number;
            costDeltaPercent: number;
            tradeoffs: string[];
        };
        description: string;
        currentState: {
            estimatedLatency: number;
            estimatedCost: number;
            model?: string | undefined;
            pattern?: string | undefined;
            provider?: string | undefined;
        };
        proposedState: {
            estimatedLatency: number;
            estimatedCost: number;
            model?: string | undefined;
            pattern?: string | undefined;
            provider?: string | undefined;
        };
        affectedPoints: string[];
        confidenceReason?: string | undefined;
    }, {
        id: string;
        headline: string;
        effort: "high" | "medium" | "low";
        confidence: "high" | "medium" | "low";
        type: "model_swap" | "batch_optimization" | "cache_addition" | "provider_change" | "streaming_enable";
        impact: {
            latencyDelta: number;
            latencyDeltaPercent: number;
            costDelta: number;
            costDeltaPercent: number;
            tradeoffs: string[];
        };
        description: string;
        currentState: {
            estimatedLatency: number;
            estimatedCost: number;
            model?: string | undefined;
            pattern?: string | undefined;
            provider?: string | undefined;
        };
        proposedState: {
            estimatedLatency: number;
            estimatedCost: number;
            model?: string | undefined;
            pattern?: string | undefined;
            provider?: string | undefined;
        };
        affectedPoints: string[];
        confidenceReason?: string | undefined;
    }>, "many">;
    summary: z.ZodObject<{
        totalOpportunities: z.ZodNumber;
        maxLatencySavingsMs: z.ZodNumber;
        maxLatencySavingsPercent: z.ZodNumber;
        maxCostSavings: z.ZodNumber;
        maxCostSavingsPercent: z.ZodNumber;
        byType: z.ZodRecord<z.ZodString, z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        totalOpportunities: number;
        maxLatencySavingsMs: number;
        maxLatencySavingsPercent: number;
        maxCostSavings: number;
        maxCostSavingsPercent: number;
        byType: Record<string, number>;
    }, {
        totalOpportunities: number;
        maxLatencySavingsMs: number;
        maxLatencySavingsPercent: number;
        maxCostSavings: number;
        maxCostSavingsPercent: number;
        byType: Record<string, number>;
    }>;
    generatedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    summary: {
        totalOpportunities: number;
        maxLatencySavingsMs: number;
        maxLatencySavingsPercent: number;
        maxCostSavings: number;
        maxCostSavingsPercent: number;
        byType: Record<string, number>;
    };
    counterfactuals: {
        id: string;
        headline: string;
        effort: "high" | "medium" | "low";
        confidence: "high" | "medium" | "low";
        type: "model_swap" | "batch_optimization" | "cache_addition" | "provider_change" | "streaming_enable";
        impact: {
            latencyDelta: number;
            latencyDeltaPercent: number;
            costDelta: number;
            costDeltaPercent: number;
            tradeoffs: string[];
        };
        description: string;
        currentState: {
            estimatedLatency: number;
            estimatedCost: number;
            model?: string | undefined;
            pattern?: string | undefined;
            provider?: string | undefined;
        };
        proposedState: {
            estimatedLatency: number;
            estimatedCost: number;
            model?: string | undefined;
            pattern?: string | undefined;
            provider?: string | undefined;
        };
        affectedPoints: string[];
        confidenceReason?: string | undefined;
    }[];
    generatedAt: string;
}, {
    summary: {
        totalOpportunities: number;
        maxLatencySavingsMs: number;
        maxLatencySavingsPercent: number;
        maxCostSavings: number;
        maxCostSavingsPercent: number;
        byType: Record<string, number>;
    };
    counterfactuals: {
        id: string;
        headline: string;
        effort: "high" | "medium" | "low";
        confidence: "high" | "medium" | "low";
        type: "model_swap" | "batch_optimization" | "cache_addition" | "provider_change" | "streaming_enable";
        impact: {
            latencyDelta: number;
            latencyDeltaPercent: number;
            costDelta: number;
            costDeltaPercent: number;
            tradeoffs: string[];
        };
        description: string;
        currentState: {
            estimatedLatency: number;
            estimatedCost: number;
            model?: string | undefined;
            pattern?: string | undefined;
            provider?: string | undefined;
        };
        proposedState: {
            estimatedLatency: number;
            estimatedCost: number;
            model?: string | undefined;
            pattern?: string | undefined;
            provider?: string | undefined;
        };
        affectedPoints: string[];
        confidenceReason?: string | undefined;
    }[];
    generatedAt: string;
}>;
export type CounterfactualType = z.infer<typeof CounterfactualType>;
export type CounterfactualState = z.infer<typeof CounterfactualState>;
export type CounterfactualImpact = z.infer<typeof CounterfactualImpact>;
export type Counterfactual = z.infer<typeof Counterfactual>;
export type CounterfactualSummary = z.infer<typeof CounterfactualSummary>;
export type CounterfactualResult = z.infer<typeof CounterfactualResult>;
