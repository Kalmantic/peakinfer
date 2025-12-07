# PeakInfer PRD/Design Doc Update Proposal
## Inference Control Plane — Cost, Latency, Throughput

**Author:** Claude Code Assistant
**Date:** January 2025
**Status:** Proposal for Review

---

## 1. Executive Summary

Based on analysis of [InferenceMAX](https://github.com/InferenceMAX/InferenceMAX) benchmarking methodology and the existing PRD v0.95, this document proposes updates to position PeakInfer as the **Inference Control Plane** — the intelligence layer that enables engineers to make data-driven decisions across:

1. **Cost** — Normalized $/M tokens across deployment types
2. **Latency** — Time to first token, tokens/second/user (interactivity)
3. **Throughput** — Tokens/second/GPU (system capacity)

The key insight: **these three metrics form trade-offs that vary by deployment type**, and PeakInfer should surface these trade-offs to help engineers choose the optimal path.

---

## 2. The Inference Control Plane Concept

### 2.1 What is the Inference Control Plane?

The **Inference Control Plane** is the decision layer that sits above all inference infrastructure and provides:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      INFERENCE CONTROL PLANE                                 │
│                                                                              │
│   "Where should this inference request go, and what will it cost?"          │
│                                                                              │
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                    │
│   │    COST     │    │   LATENCY   │    │ THROUGHPUT  │                    │
│   │  $/M tokens │    │  tok/s/user │    │  tok/s/GPU  │                    │
│   └──────┬──────┘    └──────┬──────┘    └──────┬──────┘                    │
│          │                  │                  │                            │
│          └──────────────────┼──────────────────┘                            │
│                             │                                                │
│                    ┌────────▼────────┐                                      │
│                    │  PARETO FRONTIER │                                      │
│                    │   (Trade-offs)   │                                      │
│                    └────────┬─────────┘                                      │
│                             │                                                │
│          ┌──────────────────┼──────────────────┐                            │
│          ▼                  ▼                  ▼                            │
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                    │
│   │ Hosted APIs │    │  Platforms  │    │ Self-Hosted │                    │
│   │ OpenAI etc  │    │ Together etc│    │ vLLM on GPU │                    │
│   └─────────────┘    └─────────────┘    └─────────────┘                    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Why This Matters (Julie Zhou Lens)

**User Behavior:** Engineers need to answer: *"Should I use OpenAI, switch to Together, or self-host on vLLM?"*

**Current Pain:** This decision requires:
- Gathering pricing from 10+ sources
- Understanding throughput characteristics
- Estimating GPU costs
- Calculating break-even points

**PeakInfer Solution:** One command shows normalized comparison across all options.

---

## 3. Proposed PRD Updates

### 3.1 Update Section 1.1 (Core Vision)

**Current:**
> PeakInfer reconstructs the complete inference topology directly from code

**Proposed Addition:**
> PeakInfer is the **Inference Control Plane** — providing normalized cost, latency, and throughput comparisons across every deployment option (hosted APIs, inference platforms, self-hosted GPU). It enables data-driven decisions about where inference should run.

### 3.2 Add New Section: "The Three Pillars"

```markdown
## The Three Pillars of Inference Intelligence

PeakInfer measures and compares three fundamental metrics:

### Pillar 1: Cost (Normalized $/M tokens)
- **Hosted APIs:** Direct token pricing (input + output)
- **Platforms:** Token pricing with platform markup
- **Self-Hosted:** TCO ÷ tokens generated

### Pillar 2: Latency (tok/s/user)
- Time to first token (TTFT)
- Tokens per second per user
- P50/P95/P99 latency

### Pillar 3: Throughput (tok/s/GPU)
- Aggregate system capacity
- Tokens per GPU-hour
- Utilization efficiency

### The Trade-off Triangle
These metrics form trade-offs:
- High throughput → batch more → higher latency per user
- Low latency → smaller batches → lower GPU utilization → higher $/token
- Lowest cost may require infrastructure investment

PeakInfer surfaces these trade-offs so engineers can choose consciously.
```

### 3.3 Update Section 8.2 (Pricing Schema)

**Current:**
```
vendor
model
input_token_price
output_token_price
throughput_tokens_per_sec
gpu_hourly_cost
```

**Proposed Expansion:**
```yaml
# Pricing Schema v2 — Multi-Deployment
pricing_entry:
  # Identity
  provider: string          # openai, anthropic, together, vllm-self-hosted
  model: string             # gpt-4o, claude-3-5-sonnet, llama-3-70b
  deployment_type: enum     # hosted_api | platform | self_hosted | local

  # Cost Metrics
  input_price_per_1m: float       # $ per 1M input tokens
  output_price_per_1m: float      # $ per 1M output tokens
  blended_price_per_1m: float     # Estimated at 1:1 I/O ratio

  # For Self-Hosted: TCO Components
  tco:
    gpu_type: string              # H100, A100, L4, etc.
    gpu_hourly_rate: float        # $/hr rental or amortized
    gpu_count: int                # GPUs required
    throughput_tok_per_sec: float # At optimal batch size
    utilization_assumption: float # 0.0-1.0 (default 0.6)
    effective_cost_per_1m: float  # Calculated TCO $/M tokens

  # Performance Metrics
  performance:
    throughput_tok_per_sec: float    # System throughput
    latency_ttft_ms: float           # Time to first token
    latency_tps_per_user: float      # Per-user generation speed
    max_context_window: int          # Token limit
    max_output_tokens: int           # Generation limit

  # Metadata
  source: string            # litellm, manual, inferencemax
  last_updated: timestamp
  confidence: float         # 0.0-1.0
```

### 3.4 Update Section 9 (CLI Specification)

**Add new output section: "Deployment Comparison"**

```markdown
### Deployment Comparison (New Section)

After showing current usage, display normalized comparison:

┌─────────────────────────────────────────────────────────────────────┐
│                    DEPLOYMENT COMPARISON                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  For: llama-3-70b (currently via Together API)                     │
│                                                                     │
│  Option              $/M tokens   Latency    Throughput   Effort   │
│  ─────────────────────────────────────────────────────────────────  │
│  Together API        $0.90        ~40 tok/s  N/A          None     │
│  Fireworks API       $0.90        ~45 tok/s  N/A          None     │
│  Groq API            $0.59        ~300 tok/s N/A          None     │◀ Fastest
│  Self-host (1x H100) $0.45        ~80 tok/s  ~150 tok/s   High     │◀ Cheapest
│  Self-host (1x A100) $0.52        ~50 tok/s  ~80 tok/s    High     │
│  Self-host (1x L4)   N/A          (70B too large for 24GB)         │
│                                                                     │
│  Break-even: Self-host saves $X/mo after Y months                  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 4. Proposed Design Doc Updates

### 4.1 Update Section 3.3 (Comprehension Flow)

**Current:** Scope → Detection → Structure → Impact → Action

**Proposed:** Scope → Detection → Structure → **Comparison** → Impact → Action

The new "Comparison" step shows normalized $/token across deployment options.

### 4.2 Add Design Rationale

```markdown
## Why show Deployment Comparison?

Engineers' real question isn't "what does my inference cost?" but
"could it cost less somewhere else?"

By normalizing to $/M tokens and showing alternatives:
- Engineers can make informed migration decisions
- The value prop becomes instantly clear
- PeakInfer becomes indispensable for optimization
```

### 4.3 Update CLI Output Ordering

```
1. Header
2. Scan Summary
3. Detection Summary
4. Tech Stack (Application → Hardware)
5. StackMap
6. Deployment Comparison (NEW)
7. Pricing Summary
8. Hotspots
9. Recommended Next Actions
```

---

## 5. Technical Implementation Plan

### 5.1 New Module: `src/slc/inference-economics.ts`

```typescript
/**
 * Inference Economics Engine
 *
 * Calculates normalized $/M tokens across deployment types:
 * - Hosted APIs (pay-per-token)
 * - Inference Platforms (pay-per-token, different rates)
 * - Self-Hosted (TCO model)
 */

interface DeploymentOption {
  type: 'hosted_api' | 'platform' | 'self_hosted' | 'local';
  provider: string;
  model: string;

  // Normalized cost
  costPer1MTokens: number;

  // Performance
  throughputTokPerSec: number | null;
  latencyTokPerSecUser: number | null;

  // For self-hosted
  gpuType?: string;
  gpuCount?: number;
  gpuHourlyRate?: number;

  // Effort to implement
  implementationEffort: 'none' | 'low' | 'medium' | 'high';
}

export function calculateDeploymentOptions(
  model: string,
  currentProvider: string
): DeploymentOption[];

export function calculateSelfHostedTCO(
  model: string,
  gpuType: string,
  utilizationPercent: number
): { costPer1MTokens: number; breakEvenMonths: number };
```

### 5.2 New Module: `src/slc/gpu-pricing.ts`

```typescript
/**
 * GPU Pricing Database
 *
 * Tracks rental rates across providers + purchase prices for TCO
 */

interface GPUPricing {
  gpu: string;           // H100, A100, L4, etc.
  memory: number;        // GB

  // Rental rates ($/hr)
  rental: {
    runpod: number;
    lambda: number;
    aws: number;
    gcp: number;
    azure: number;
    modal: number;
    coreweave: number;
  };

  // Purchase price (for TCO)
  purchasePrice: number;

  // Performance characteristics
  throughputEstimates: {
    [modelSize: string]: number;  // tok/s at optimal batch
  };
}

export const GPU_PRICING: Record<string, GPUPricing>;
```

### 5.3 New Module: `src/slc/throughput-estimator.ts`

```typescript
/**
 * Throughput Estimator
 *
 * Estimates tok/s for model+GPU combinations
 * Based on InferenceMAX benchmarks and public data
 */

interface ThroughputEstimate {
  model: string;
  gpu: string;
  precision: 'fp16' | 'fp8' | 'int8' | 'int4';
  batchSize: number;

  throughputTokPerSec: number;
  latencyTokPerSecUser: number;

  source: 'inferencemax' | 'vllm_benchmarks' | 'estimated';
  confidence: number;
}

export function estimateThroughput(
  model: string,
  gpu: string,
  precision?: string
): ThroughputEstimate;
```

---

## 6. Data Sources

### 6.1 Pricing Data Sources

| Source | Data Type | Update Frequency |
|--------|-----------|------------------|
| LiteLLM | Token pricing (1000+ models) | Daily (cached 24h) |
| Cloud APIs | GPU rental rates | Weekly |
| InferenceMAX | Throughput benchmarks | Nightly |
| Manual | GPU purchase prices | Monthly |

### 6.2 Throughput Data Sources

| Source | Coverage | Reliability |
|--------|----------|-------------|
| InferenceMAX | H100, A100, MI300X | High (benchmarked) |
| vLLM benchmarks | Various GPUs | High |
| TGI benchmarks | Various GPUs | Medium |
| Estimates | Gap filling | Low (labeled) |

---

## 7. Success Criteria

### 7.1 Quantitative

- [ ] Normalized $/M token accuracy within 10% of actual
- [ ] Coverage: 50+ models × 10+ GPUs × 5+ providers
- [ ] Throughput estimates within 20% of benchmarks
- [ ] TCO calculator matches InferenceMAX methodology

### 7.2 Qualitative (Julie Zhou)

- [ ] User understands deployment trade-offs in < 30 seconds
- [ ] Comparison table is scannable without reading
- [ ] Break-even calculation is clear
- [ ] No jargon without definition
- [ ] Engineers share comparisons in Slack

---

## 8. Implementation Phases

### Phase 1: Foundation (This Sprint)
- [ ] GPU pricing database
- [ ] Throughput estimation engine
- [ ] TCO calculator
- [ ] Updated agent-analyzer prompts

### Phase 2: Integration
- [ ] Deployment comparison in CLI output
- [ ] HTML report with interactive comparison
- [ ] Cost normalization across all detected callsites

### Phase 3: Intelligence
- [ ] Break-even calculator
- [ ] Migration effort estimates
- [ ] Optimization recommendations based on comparison

---

## 9. Appendix: InferenceMAX Alignment

PeakInfer's cost model should align with InferenceMAX methodology:

| InferenceMAX Metric | PeakInfer Equivalent |
|---------------------|---------------------|
| Token throughput (tok/s/GPU) | `throughputTokPerSec` |
| Performance per dollar | `1 / costPer1MTokens` |
| Tokens per megawatt | Future: power efficiency |
| TCO per million tokens | `costPer1MTokens` for self-hosted |

Key difference: InferenceMAX benchmarks hardware. PeakInfer helps users **choose** based on their specific codebase and usage patterns.

---

## 10. Questions for Review

1. Should we show hardware recommendations (e.g., "Use H100 for 70B+ models")?
2. Should break-even include engineering time to migrate?
3. Should we track spot vs on-demand GPU pricing?
4. Should latency estimates include network latency for hosted APIs?

---

*This proposal aligns PeakInfer with the Inference Control Plane vision while maintaining Julie Zhou's design principles of clarity, behavior-first design, and invisible UI.*
