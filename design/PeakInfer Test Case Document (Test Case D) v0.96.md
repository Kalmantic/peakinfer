

---

---

# **PeakInfer SLC v1 – MASTER TEST DOCUMENT**

**Product:** PeakInfer
**Scope:** CLI-only Simple-Lovable-Complete v1
**PRD Source:** v0.96
**Test Philosophy:** Systems-grade infra validation
**Author:** Hamel Hussain
**Last Updated:** December 2025

---

---

# **1\. Testing Objectives**

PeakInfer succeeds only if its outputs are:

1. **Correct**

2. **Verifiable**

3. **Stable**

4. **Signal-dense (low noise)**

5. **Actionable**

Therefore testing targets **five pillars**:

| Pillar | Core Question |
| ----- | ----- |
| **Truth** | Is detection & pricing factually correct? |
| **Trust** | Can a human verify the claims quickly? |
| **Signal Quality** | Are false positives nearly zero? |
| **Stability** | Do minor code edits avoid noisy StackMap diffs? |
| **Impact** | Do recommendations lead to measurable cost savings or performance improvement? |

---

---

# **2\. Test Environments**

PeakInfer analysis is static \+ semantic but must infer intended infrastructure accurately.
We therefore require targeted environments for simulating inference topology intent.

---

## **2.1 Execution Environments**

### **E1 — Local CPU Development**

* No GPU present

* OpenAI & Anthropic APIs only

* Purpose:

  * Baseline detection

  * Ensure no GPU runtime hallucinations

---

### **E2 — Local GPU Development**

* Single local NVIDIA GPU (e.g., RTX 4090\)

* Self-hosted runtimes:

  * vLLM

  * llama.cpp

* CUDA environment variables present

**Purpose**

* GPU detection accuracy

* Runtime detection correctness

---

### **E3 — Neocloud GPU Hosts**

Providers:

* Baseten

* Together

* Fireworks

* Modal

* Beam

GPU types via configs:

* H100

* A100

* L40S

**Purpose**

* Provider classification

* Runtime inference mapping (vLLM, TGI)

* GPU type inference from infra config

---

### **E4 — Hyperscalers**

Services:

* AWS Bedrock \+ Inferentia

* GCP Vertex \+ TPU

* Azure OpenAI

**Purpose**

* Platform detection

* Accelerator inference (Inferentia, TPU)

---

### **E5 — Exotic Hardware**

Accelerators:

* Cerebras WSE

* Groq LPU

* AMD MI300

**Purpose**

* Validate non-NVIDIA detection paths

---

---

# **3\. Canonical Test Repositories**

Each repo is a gold-standard fixture expressing a targeted inference architecture.

---

### **R1 — SaaS-Only LLM Repo**

* OpenAI SDK \+ Anthropic SDK

* CPU only

**Tests**

* Callsite detection

* Vendor identification

* Pricing SaaS calculations

* Empty hardware inference

---

### **R2 — Mixed API \+ Neocloud**

* OpenAI \+ Anthropic APIs

* Baseten or Together endpoints

* vLLM or TGI configs

**Tests**

* Provider classification

* Runtime inference

* GPU type inference

* Pricing deltas across vendors

---

### **R3 — Self-Hosted GPU**

* vLLM, SGLang, llama.cpp

* K8s manifests showing NVIDIA GPU resource claims

**Tests**

* Runtime detection

* Hardware detection

* GPU-based pricing calculations

---

### **R4 — Hyperscaler ML**

* AWS Bedrock

* GCP Vertex/TPU

* Azure OpenAI

**Tests**

* Platform mapping

* Hardware inference

---

### **R5 — Exotic Accelerators**

* Cerebras & Groq SDKs

* AMD ROCm configs

**Tests**

* Correct accelerator classification

* Alternate pricing models applied

---

### **R6 — Quantization & Optimization**

* Includes:

  * FP8, INT4, GGUF, EXL2

  * FlashAttention, prefix caching, speculative decoding

**Tests**

* Quantization detection

* Throughput adjustments applied to pricing

---

### **R7 — Orchestration \+ RAG**

* LangChain, DSPy, LlamaIndex

* Pinecone, Qdrant, pgvector

**Tests**

* Framework detection

* Vector DB classification

* Embed vs completion pricing breakdown

---

### **R8 — Agentic AI & Tool Use** *(NEW)*

* MCP (Model Context Protocol) servers
* OpenAI Function Calling patterns
* Anthropic Tool Use
* LangGraph workflows
* AutoGen, CrewAI agents
* Composio, E2B, Browserbase integrations

**Tests**

* Tool use pattern detection
* Agent framework identification
* Multi-step workflow mapping
* Function calling vs tool use distinction

---

### **R9 — Guardrails & Safety** *(NEW)*

* NVIDIA NeMo Guardrails configs
* Guardrails AI RAIL specs
* Llama Guard integration
* Presidio PII detection
* Content moderation endpoints

**Tests**

* Guardrail framework detection
* Input/output guardrail classification
* PII detection pattern recognition
* Safety layer cost attribution

---

### **R10 — LLM Gateways** *(NEW)*

* LiteLLM proxy configs
* Portkey routing rules
* Helicone logging headers
* OpenRouter endpoints
* Kong AI Gateway configs

**Tests**

* Gateway detection (not direct SDK)
* Load balancing pattern recognition
* Fallback chain identification
* Virtual key management detection

---

### **R11 — Fine-tuning & PEFT** *(NEW)*

* LoRA/QLoRA adapter configs
* Axolotl training recipes
* Unsloth optimization patterns
* OpenAI/Anthropic fine-tuning API calls
* Predibase LoRAX configs

**Tests**

* PEFT method detection (LoRA, QLoRA, DoRA)
* Fine-tuning platform identification
* Adapter loading pattern recognition
* Base model vs adapter cost separation

---

### **R12 — Observability & LLMOps** *(NEW)*

* Langfuse `@observe` decorators
* LangSmith tracing configs
* Weights & Biases Weave integration
* OpenLLMetry instrumentation
* Datadog LLM monitoring

**Tests**

* Observability tool detection
* Tracing pattern recognition
* Cost attribution correctness
* No false positives on logging-only code

---

### **R13 — Context & Memory** *(NEW)*

* Mem0 memory SDK
* Zep long-term memory
* LangChain memory classes
* MemGPT/Letta patterns
* Redis/PostgreSQL conversation storage

**Tests**

* Memory framework detection
* Context management pattern recognition
* Token counting logic detection
* Sliding window implementation identification

---

### **R14 — Multi-Provider Routing** *(NEW)*

* Martian router configs
* RouteLLM implementations
* Unify AI routing
* Custom cost-based routing logic
* A/B testing model selection
* Cascade routing patterns

**Tests**

* Router framework detection
* Routing logic classification (cost/latency/quality)
* Fallback chain mapping
* Multi-model cost aggregation

---

### **R15 — MoE & Advanced Architectures** *(NEW)*

* Mixtral configs with expert routing
* DeepSeek-V3 MoE patterns
* Llama 4 hybrid architecture
* Jamba SSM configs
* Multi-modal (GPT-4V, Claude 3 Vision) usage

**Tests**

* MoE architecture detection
* Active vs total parameter cost calculation
* SSM model identification
* Multi-modal input detection

---

---

---

# **4\. CLI FUNCTIONAL TESTS**

| ID | Case | Pass |
| ----- | ----- | ----- |
| CLI-001 | `--help` | All commands listed |
| CLI-002 | `--version` | Valid output |
| CLI-010 | `analyze .` | Executes flow |
| CLI-011 | `stackmap` | ASCII \+ JSON generated |
| CLI-012 | `pricing` | Cost summary |
| CLI-013 | `diff` | StackMap delta |
| CLI-014 | `analyze . --output json` | JSON output format *(NEW)* |
| CLI-015 | `stackmap --cached` | Offline cached view *(NEW)* |

Runs: All repos, all environments

---

---

# **4.1 CLI State Handling Tests** *(NEW)*

Testing all 5 UX states per PRD Section 9.1.

---

### **Empty State**

| ID | Test | Expected Output |
| ----- | ----- | ----- |
| STATE-001 | Repo with no LLM code | "No LLM inference calls detected" message |
| STATE-002 | Empty state checklist | Lists SDKs checked (OpenAI, Anthropic, LangChain, etc.) |
| STATE-003 | Empty state suggestions | Shows guidance for dynamic imports, env-gated paths |
| STATE-004 | Empty state exit | Clean exit code 0, "Nothing to map. Exiting." |

---

### **Loading State**

| ID | Test | Expected Output |
| ----- | ----- | ----- |
| STATE-010 | Progress indicator | Progress bar with percentage shown |
| STATE-011 | Current file display | Shows file currently being analyzed |
| STATE-012 | SDK connection | "Connecting to Claude Code SDK... ✓" |
| STATE-013 | Incremental progress | Progress updates as files are processed |

---

### **Partial State**

| ID | Test | Expected Output |
| ----- | ----- | ----- |
| STATE-020 | Parse errors reported | "Skipped: N files (parse errors)" |
| STATE-021 | Error details shown | File path + specific error (syntax error, unsupported feature) |
| STATE-022 | Warning message | "Warning: Skipped files may contain undetected LLM calls" |
| STATE-023 | Continues to success | Still produces StackMap for parseable files |

---

### **Error State**

| ID | Test | Expected Output |
| ----- | ----- | ----- |
| STATE-030 | API unreachable | "Error: Unable to reach Anthropic API" |
| STATE-031 | Possible causes listed | Network, API key, rate limit suggestions |
| STATE-032 | API key guidance | "Set your API key: export ANTHROPIC_API_KEY=sk-ant-..." |
| STATE-033 | Cached fallback | "Cached StackMaps remain available: → peakinfer stackmap --cached" |
| STATE-034 | Exit code | Non-zero exit code on error |

---

### **Success State**

| ID | Test | Expected Output |
| ----- | ----- | ----- |
| STATE-040 | Summary line | "Found N inference callsites across M files" |
| STATE-041 | Full StackMap ASCII | Complete ASCII diagram rendered |
| STATE-042 | Estimated cost range | "Estimated monthly cost: $X - $Y" |
| STATE-043 | Hotspots listed | Top cost hotspots with file:line |
| STATE-044 | Output files saved | "Output saved: → stackmap.json → pricing.json" |
| STATE-045 | Next steps | Suggests `peakinfer pricing --detailed` |

Gate: All 5 states render correctly without crash

---

---

---

# **4.2 StackMap Output Structure Tests** *(NEW)*

Validates all sections of StackMap output per PRD Section 9.

---

### **CALLSITES Section**

| ID | Test | Validation |
| ----- | ----- | ----- |
| OUT-001 | Callsite count | Total matches detected callsites |
| OUT-002 | File:line format | `src/path/file.py:47` format correct |
| OUT-003 | Model attribution | Each callsite shows model name |
| OUT-004 | Streaming flag | Shows "streaming" or "batched" where applicable |
| OUT-005 | Truncation indicator | "... N more (see stackmap.json)" for >5 callsites |

---

### **MODELS Section**

| ID | Test | Validation |
| ----- | ----- | ----- |
| OUT-010 | Model list | All unique models listed |
| OUT-011 | Call count | Accurate count per model |
| OUT-012 | Token estimate | Monthly token estimate shown (e.g., "~2.4M tok/mo") |
| OUT-013 | Model grouping | Models grouped by provider |

---

### **VENDORS/PROVIDERS Section**

| ID | Test | Validation |
| ----- | ----- | ----- |
| OUT-020 | Provider list | All detected providers listed |
| OUT-021 | Call count per provider | Accurate aggregation |
| OUT-022 | SDK type | Shows "direct SDK" vs "via LangChain" etc. |

---

### **RUNTIMES Section**

| ID | Test | Validation |
| ----- | ----- | ----- |
| OUT-030 | Runtime list | Detected runtimes (vLLM, TGI, llama.cpp) |
| OUT-031 | Detected vs inferred | Labels distinguish detected from inferred |
| OUT-032 | Version info | Shows version where detectable |
| OUT-033 | Unknown handling | "unknown" for proprietary (OpenAI) backends |

---

### **HARDWARE Section**

| ID | Test | Validation |
| ----- | ----- | ----- |
| OUT-040 | GPU list | Inferred GPUs listed |
| OUT-041 | Provider mapping | Shows which provider uses which GPU |
| OUT-042 | Self-hosted detection | Reports local vLLM/SGLang/llama.cpp configs |
| OUT-043 | GPU env vars | Reports CUDA_VISIBLE_DEVICES status |
| OUT-044 | Terraform detection | Reports GPU resources from .tf files |

---

### **PATTERNS DETECTED Section**

| ID | Test | Validation |
| ----- | ----- | ----- |
| OUT-050 | Pattern checklist | All 6 patterns listed with ✓/✗ |
| OUT-051 | Retry logic | Detected with file:line reference |
| OUT-052 | Batching | Detected with file:line reference |
| OUT-053 | Streaming | Detected with file:line reference |
| OUT-054 | Caching | Detected or "not detected" |
| OUT-055 | Router/model switching | Detected or "not detected" |
| OUT-056 | Fallback chain | Detected or "not detected" |

---

### **PRICING SUMMARY Section**

| ID | Test | Validation |
| ----- | ----- | ----- |
| OUT-060 | Cost range | "Estimated monthly cost: $X - $Y" |
| OUT-061 | By vendor breakdown | Vendor costs with percentages |
| OUT-062 | By model breakdown | Model costs listed |
| OUT-063 | Pricing deltas | Shows "↓12% since Oct 2025" style changes |

---

### **ALTERNATIVE PRICING Section**

| ID | Test | Validation |
| ----- | ----- | ----- |
| OUT-070 | Alternative providers | Same model, different providers listed |
| OUT-071 | Savings percentage | Shows "↓24%" style savings |
| OUT-072 | Self-hosted option | Includes self-hosted estimate with assumptions |
| OUT-073 | Cloud alternatives | AWS Bedrock, GCP Vertex alternatives shown |

---

### **HOTSPOTS Section**

| ID | Test | Validation |
| ----- | ----- | ----- |
| OUT-080 | Hotspot list | Top cost hotspots with ⚠ indicator |
| OUT-081 | File:line reference | Exact location shown |
| OUT-082 | Cost estimate | Monthly cost per hotspot |
| OUT-083 | Suggestion | Actionable suggestion per hotspot |
| OUT-084 | Missing pattern suggestions | "No caching detected" → suggest semantic cache |

Gate: All sections render with correct structure

---

---

---

# **4.3 Output File Generation Tests** *(NEW)*

| ID | Test | Validation |
| ----- | ----- | ----- |
| FILE-001 | stackmap.json created | File exists after successful analyze |
| FILE-002 | pricing.json created | File exists after successful analyze |
| FILE-003 | stackmap.json valid JSON | Parses without error |
| FILE-004 | pricing.json valid JSON | Parses without error |
| FILE-005 | stackmap.json schema | Matches StackMap TypeScript interface |
| FILE-006 | pricing.json schema | Matches PricingSummary TypeScript interface |
| FILE-007 | Callsites in JSON | All detected callsites present |
| FILE-008 | Models in JSON | All models with pricing data |
| FILE-009 | JSON round-trip | `diff` command can read generated JSON |
| FILE-010 | Overwrite behavior | Re-running analyze updates files |

Gate: Both JSON files valid and complete

---

---

---

# **5\. Detection Test Suite**

---

### **Callsite Capture**

| ID | Detection |
| ----- | ----- |
| DET-001 | SDK calls across languages |
| DET-002 | HTTP inference endpoints |
| DET-003 | Model name resolution |
| DET-004 | Streaming detection |
| DET-005 | Batching detection |
| DET-006 | Tool usage detection |
| DET-007 | Retry/backoff detection |
| DET-008 | Embedding detection |

---

### **Extended Detection Tests** *(NEW)*

Per PRD Appendix B — 23 categories, 500+ targets.

---

#### **Model Provider Detection**

| ID | Provider | Test |
| ----- | ----- | ----- |
| DET-101 | OpenAI | gpt-4o, gpt-4o-mini, o1, o3, embeddings |
| DET-102 | Anthropic | claude-sonnet-4-20250514, claude-3.5-sonnet, claude-3-opus |
| DET-103 | Google | gemini-2.0-flash, gemini-2.5-pro, palm-2 |
| DET-104 | Meta | llama-4-scout, llama-3.3-70b, code-llama |
| DET-105 | Mistral | mistral-large-2, mixtral-8x22b, codestral |
| DET-106 | Cohere | command-r-plus, embed-v3, rerank-v3 |
| DET-107 | DeepSeek | deepseek-v3, deepseek-r1 |
| DET-108 | xAI | grok-2, grok-3 |
| DET-109 | AI21 | jamba-1.5-large |
| DET-110 | Amazon | titan-text, nova-pro |
| DET-111 | Alibaba | qwen-2.5-72b, qwen-3-235b |

---

#### **Inference Host Detection**

| ID | Provider | Detection Signal |
| ----- | ----- | ----- |
| DET-201 | Together AI | `together` SDK, `api.together.xyz` |
| DET-202 | Fireworks AI | `fireworks` SDK, `api.fireworks.ai` |
| DET-203 | Baseten | `baseten` SDK, Truss configs |
| DET-204 | Modal | `modal` decorator, `@stub.function` |
| DET-205 | Replicate | `replicate` SDK |
| DET-206 | Anyscale | `anyscale` SDK, Ray Serve |
| DET-207 | Groq Cloud | `groq` SDK |
| DET-208 | Cerebras Cloud | `cerebras` SDK |
| DET-209 | DeepInfra | `deepinfra` SDK |
| DET-210 | Perplexity | `perplexity` SDK |

---

#### **Hyperscaler Platform Detection**

| ID | Platform | Detection Signal |
| ----- | ----- | ----- |
| DET-301 | AWS Bedrock | `boto3.client('bedrock-runtime')` |
| DET-302 | AWS SageMaker | `sagemaker` SDK |
| DET-303 | AWS Inferentia | `neuron` SDK, `inf2` instances |
| DET-304 | GCP Vertex AI | `google.cloud.aiplatform` |
| DET-305 | GCP TPU | `TPU_NAME` env var, `jax.devices('tpu')` |
| DET-306 | Azure OpenAI | `openai.api_type = "azure"` |
| DET-307 | Azure ML | `azureml` SDK |
| DET-308 | Databricks | `databricks` SDK, `/serving-endpoints/` |
| DET-309 | Snowflake Cortex | `snowflake.cortex` |

---

#### **Serving Runtime Detection**

| ID | Runtime | Detection Signal |
| ----- | ----- | ----- |
| DET-401 | vLLM | `vllm` imports, `LLM()` class |
| DET-402 | SGLang | `sglang` imports, `@function` decorator |
| DET-403 | TensorRT-LLM | `tensorrt_llm` imports |
| DET-404 | TGI | `text_generation` SDK |
| DET-405 | llama.cpp | `llama_cpp` imports, `.gguf` files |
| DET-406 | Ollama | `ollama` SDK, `localhost:11434` |
| DET-407 | MLX | `mlx` imports, `mlx_lm` |
| DET-408 | ExLlamaV2 | `exllamav2` imports |
| DET-409 | Triton | `tritonclient`, `model_repository/` |
| DET-410 | LocalAI | `localhost:8080` LocalAI patterns |

---

#### **Hardware Detection**

| ID | Hardware | Detection Signal |
| ----- | ----- | ----- |
| DET-501 | NVIDIA H100 | Instance types, `nvidia.com/gpu` |
| DET-502 | NVIDIA A100 | Instance types, Terraform configs |
| DET-503 | NVIDIA L40S | Cloud configs |
| DET-504 | NVIDIA T4 | Instance types |
| DET-505 | AMD MI300X | ROCm configs |
| DET-506 | Google TPU v5 | TPU configs |
| DET-507 | AWS Inferentia | `inf2` instance types |
| DET-508 | Groq LPU | `groq` SDK |
| DET-509 | Cerebras WSE | `cerebras` SDK |

---

#### **Orchestration Framework Detection**

| ID | Framework | Detection Signal |
| ----- | ----- | ----- |
| DET-601 | LangChain | `langchain` imports, `ChatOpenAI` |
| DET-602 | LlamaIndex | `llama_index` imports |
| DET-603 | Haystack | `haystack` imports |
| DET-604 | DSPy | `dspy` imports, `dspy.Predict` |
| DET-605 | AutoGen | `autogen` imports |
| DET-606 | CrewAI | `crewai` imports |
| DET-607 | Semantic Kernel | `semantic_kernel` imports |
| DET-608 | LiteLLM | `litellm` imports |
| DET-609 | Instructor | `instructor` imports |
| DET-610 | Guidance | `guidance` imports |

---

#### **Pattern Detection**

| ID | Pattern | Detection Signal |
| ----- | ----- | ----- |
| DET-701 | Exponential backoff | `tenacity`, `backoff` decorators |
| DET-702 | Circuit breaker | `circuitbreaker` patterns |
| DET-703 | Client-side batching | `asyncio.gather()`, batch loops |
| DET-704 | Continuous batching | vLLM config flags |
| DET-705 | SSE streaming | `stream=True`, async iteration |
| DET-706 | Semantic caching | `gptcache`, embedding similarity |
| DET-707 | Prompt caching | Anthropic `cache_control` |
| DET-708 | Cost-based routing | Model selection by complexity |
| DET-709 | Cascade routing | Try cheap → fallback expensive |
| DET-710 | Fallback chains | Provider fallback patterns |

---

### **Validation Gates**

| Metric | Required |
| ----- | ----- |
| Recall | ≥ 90% |
| Precision | ≥ 97% |

---

---

---

# **6\. False-Positive Fracture Tests**

Testing trust integrity.

| ID | Scenario |
| ----- | ----- |
| FP-001 | OpenAI-like HTTP to non-LLM endpoints → must NOT detect |
| FP-002 | SDK imported but unused → must NOT detect |
| FP-003 | Mock inference classes → must NOT detect |
| FP-004 | Tokenizers only → must NOT detect |
| FP-005 | Static prompt templates → must NOT detect |
| FP-006 | Test fixtures with LLM patterns → must NOT detect *(NEW)* |
| FP-007 | Documentation/README code examples → must NOT detect *(NEW)* |
| FP-008 | Commented-out LLM code → must NOT detect *(NEW)* |
| FP-009 | LLM-related logging/metrics only → must NOT detect *(NEW)* |
| FP-010 | Training-only code (no inference) → must NOT detect *(NEW)* |

Gate: **Precision ≥97%**

---

---

---

# **7\. StackMap Graph Validation**

| ID | Check |
| ----- | ----- |
| MAP-001 | Proper node types |
| MAP-002 | Correct edges (model→vendor, runtime→hardware) |
| MAP-003 | Cross-language aggregation |
| MAP-004 | No duplicate nodes |
| MAP-005 | Hardware inference matches infra config |
| MAP-006 | Provider→model relationships accurate *(NEW)* |
| MAP-007 | Framework→SDK relationships mapped *(NEW)* |
| MAP-008 | Gateway→provider relationships captured *(NEW)* |
| MAP-009 | Cost roll-up aggregation correct *(NEW)* |
| MAP-010 | Callsite→pattern associations accurate *(NEW)* |

---

---

---

# **8\. Trust & Verification Tests**

Ensures outputs earn credibility, not blind faith.

| ID | Test |
| ----- | ----- |
| TRUST-001 | User manually verifies hotspot ≤2 minutes |
| TRUST-002 | CLI exposes source evidence |
| TRUST-003 | Diff justification readable |
| TRUST-004 | Pricing math transparent |
| TRUST-005 | File:line references clickable/navigable *(NEW)* |
| TRUST-006 | Model name matches actual code string *(NEW)* |
| TRUST-007 | Token estimates show calculation basis *(NEW)* |
| TRUST-008 | Alternative pricing shows assumptions *(NEW)* |

Gate: ≥95% user verification success

---

---

---

# **9\. Workflow Stability**

Detects noisy regression issues.

| ID | Scenario |
| ----- | ----- |
| STAB-001 | Rename files only → no change |
| STAB-002 | Format code → no diff |
| STAB-003 | Move directories → identity preserved |
| STAB-004 | Change variable names → no diff |
| STAB-005 | Upgrade SDK minor version → only metadata changes |
| STAB-006 | Add unrelated code → no diff to existing callsites *(NEW)* |
| STAB-007 | Reorder imports → no diff *(NEW)* |
| STAB-008 | Add comments to LLM code → no diff *(NEW)* |

Gate: ≥99% noise-free diffs

---

---

---

# **10\. Pricing Delta Engine Tests**

---

### **Accuracy**

| ID | Case |
| ----- | ----- |
| PRC-001 | SaaS pricing math |
| PRC-002 | GPU hourly costing |
| PRC-003 | Alternative vendor comparisons |
| PRC-004 | MoE pricing discounts |
| PRC-005 | Quantization throughput adjustments |

---

### **Extended Pricing Tests** *(NEW)*

| ID | Case | Validation |
| ----- | ----- | ----- |
| PRC-020 | Cost per callsite | Individual callsite costs calculated |
| PRC-021 | Cost per model | Aggregated model costs accurate |
| PRC-022 | Cost per provider | Provider-level aggregation |
| PRC-023 | Input vs output token pricing | Separate rates applied correctly |
| PRC-024 | Batch API pricing | Discounted batch rates applied |
| PRC-025 | Prompt caching pricing | Cached token discounts applied |
| PRC-026 | Context window pricing | Long-context surcharges applied |
| PRC-027 | GPU hourly vs token pricing | Self-hosted GPU costs calculated |
| PRC-028 | Spot vs on-demand | Spot pricing alternatives shown |
| PRC-029 | Reserved instance pricing | RI savings calculated |
| PRC-030 | Multi-region pricing | Regional price differences shown |

---

### **Freshness**

| ID | Check |
| ----- | ----- |
| PRC-010 | Pricing data ≤7 days old |
| PRC-011 | Offline pricing → cache warning |
| PRC-012 | Pricing delta percentage shown *(NEW)* |
| PRC-013 | Last sync timestamp displayed *(NEW)* |

---

Gate: Pricing error ≤10%

---

---

---

# **11\. Optimization Impact Validation**

Do recommendations matter?

| ID | Scenario |
| ----- | ----- |
| IMP-001 | Cheaper model suggestion yields ≥15% projected savings |
| IMP-002 | Batching recommendation reduces cost/user |
| IMP-003 | Caching suggestion increases throughput |
| IMP-004 | Router change preserves quality |
| IMP-005 | Quantization suggestion shows memory/throughput tradeoff *(NEW)* |
| IMP-006 | Self-hosted suggestion includes break-even analysis *(NEW)* |
| IMP-007 | Provider switch suggestion shows migration complexity *(NEW)* |
| IMP-008 | Prompt caching suggestion shows eligible callsites *(NEW)* |

Gate: ≥75% recommendations actionable

---

---

---

# **12\. Dependency & Failure Tests**

| ID | Scenario | Expected |
| ----- | ----- | ----- |
| FAIL-001 | Missing API key | Clear error message with setup instructions |
| FAIL-002 | Invalid API key | "Invalid API key" error, not generic failure |
| FAIL-003 | Rate limited | Retry guidance, backoff suggestion |
| FAIL-004 | Claude SDK crash | Graceful error, no stack trace to user |
| FAIL-005 | Network offline | Offline mode guidance, cached data suggestion |
| FAIL-006 | Very large repo (200k+ LOC) | Completes within SLA or shows progress |
| FAIL-007 | Binary files in repo | Skips gracefully, no crash |
| FAIL-008 | Circular imports | Handles without infinite loop |
| FAIL-009 | Malformed code files | Skips with parse error message |
| FAIL-010 | Permission denied on files | Skips with clear message |

Expected:

* graceful errors

* clear guidance

* no hang/crash

---

---

---

# **13\. Security & Privacy Validation**

Based on PRD guarantees

| ID | Test | Validation |
| ----- | ----- | ----- |
| SEC-001 | No telemetry outside Anthropic | Network traffic inspection |
| SEC-002 | No repo data stored remotely | File system inspection |
| SEC-003 | Secrets redacted from output | API keys not in stackmap.json |
| SEC-004 | Files remain local | No uploads detected |
| SEC-005 | Prompts never logged | Log file inspection |
| SEC-006 | .env files not sent to API | Code inspection *(NEW)* |
| SEC-007 | Credentials in code redacted | Output sanitization *(NEW)* |
| SEC-008 | No PII in outputs | PII pattern matching *(NEW)* |

---

---

---

# **14\. Performance Benchmarks**

| ID | Repo Size | SLA | Validation |
| ----- | ----- | ----- | ----- |
| PERF-001 | 10k LOC | <60s | Timer validation |
| PERF-002 | 50k LOC | <150s | Timer validation |
| PERF-003 | 200k LOC | <240s | Timer validation |
| PERF-004 | RAM peak | <500MB | Memory profiling |
| PERF-005 | Cold start | <5s to first output *(NEW)* | Timer validation |
| PERF-006 | Incremental analysis | <30s for small changes *(NEW)* | Timer validation |

---

---

---

# **15\. Offline Mode Tests** *(NEW)*

Per PRD Section 6.2 — Offline Capability

| ID | Test | Validation |
| ----- | ----- | ----- |
| OFFLINE-001 | `stackmap --cached` | Shows last generated StackMap |
| OFFLINE-002 | Cached pricing display | Shows cached pricing with timestamp |
| OFFLINE-003 | Stale data warning | "Pricing data is X days old" |
| OFFLINE-004 | No API required for cached view | Works without network |
| OFFLINE-005 | Cache location | Stored in expected directory |
| OFFLINE-006 | Cache invalidation | Old cache replaced on new analysis |

Gate: Cached StackMaps accessible without API

---

---

---

# **16\. GitHub Action Tests** *(NEW)*

Per PRD Section 10 — SLC v2 Preview

| ID | Test | Validation |
| ----- | ----- | ----- |
| GHA-001 | PR comment generated | StackMap changes posted to PR |
| GHA-002 | Pricing delta in comment | Shows cost changes |
| GHA-003 | Model change detection | New/removed models highlighted |
| GHA-004 | Router regression alert | Warns on routing changes |
| GHA-005 | Suggestion diff | Shows new suggestions |
| GHA-006 | Reject regressions flag | Blocks PR on cost regression (optional) |
| GHA-007 | Minimal permissions | Only needs read + PR comment |
| GHA-008 | Secrets handling | API key from GitHub secrets |

Gate: GitHub Action functional for SLC v2

---

---

---

# **17\. Analyzer Feature Tests** *(NEW)*

Per PRD Section 6.1 — Functional Requirements

| ID | Feature | Validation |
| ----- | ----- | ----- |
| FEAT-001 | Token shape inference | Estimates input/output token distribution |
| FEAT-002 | Prompt template analysis | Detects static vs dynamic prompts |
| FEAT-003 | Chunking/pagination detection | Identifies document chunking patterns |
| FEAT-004 | Routing logic detection | Finds model selection code |
| FEAT-005 | Multi-language parsing | TS, Python, Go, Java all work |
| FEAT-006 | Config file analysis | Reads .env, .yaml, .json configs |
| FEAT-007 | Terraform parsing | Extracts GPU types from .tf files |
| FEAT-008 | K8s manifest parsing | Reads nvidia.com/gpu requests |
| FEAT-009 | Docker compose parsing | Extracts GPU reservations |

Gate: All PRD Section 6.1 features functional

---

---

---

# **18\. SLC Compliance Tests** *(NEW)*

Per PRD Section 2.3 & 5.1 — Jason Cohen SLC Principles

These tests validate PeakInfer adheres to Simple-Lovable-Complete philosophy.

---

### **SLC Core Principles**

| ID | Principle | Test | Validation |
| ----- | ----- | ----- | ----- |
| SLC-001 | Single command | `peakinfer analyze .` works | No config required |
| SLC-002 | No cloud login | No authentication prompts | Works without account |
| SLC-003 | No config files | First run works without setup | Only API key env var needed |
| SLC-004 | No telemetry | Zero outbound except Anthropic | Network inspection |
| SLC-005 | No dashboards | CLI-only interface | No web UI required |
| SLC-006 | No platform dependencies | Works on Mac/Linux/Windows | Cross-platform test |
| SLC-007 | Local-only storage | StackMaps saved locally | No cloud sync |
| SLC-008 | Zero ML training | No model downloads/training | Quick startup |

---

### **SLC User Experience**

| ID | Test | Expected | Validation |
| ----- | ----- | ----- | ----- |
| SLC-010 | First-run experience | Works immediately with API key | No onboarding wizard |
| SLC-011 | Time to value | First StackMap in <60s | Timer validation |
| SLC-012 | Learning curve | Understand output in <2 min | User testing |
| SLC-013 | Zero configuration | Default settings optimal | No tuning needed |
| SLC-014 | Predictable behavior | Same input → same output | Determinism test |
| SLC-015 | Clear error messages | Actionable guidance on failure | Error message audit |

---

### **SLC Scope Boundaries**

| ID | Feature | In SLC v1? | Test |
| ----- | ----- | ----- | ----- |
| SLC-020 | CLI analyzer | ✅ Yes | Core functionality |
| SLC-021 | StackMap generation | ✅ Yes | MAP-* tests |
| SLC-022 | Pricing overlay | ✅ Yes | PRC-* tests |
| SLC-023 | ASCII diagrams | ✅ Yes | OUT-* tests |
| SLC-024 | JSON export | ✅ Yes | FILE-* tests |
| SLC-025 | Offline cached view | ✅ Yes | OFFLINE-* tests |
| SLC-026 | GitHub Action | ❌ SLC v2 | Not required for v1 |
| SLC-027 | Web dashboard | ❌ Post-SLC | Not in v1 |
| SLC-028 | Team features | ❌ Post-SLC | Not in v1 |
| SLC-029 | Auto-remediation | ❌ Post-SLC | Not in v1 |
| SLC-030 | Custom model | ❌ v3+ | Not in v1 |

---

### **SLC Quality Gates**

| Gate | Requirement | Test Method |
| ----- | ----- | ----- |
| **Simple** | Single command, no setup | SLC-001 to SLC-008 |
| **Lovable** | Delightful first experience | SLC-010 to SLC-015 |
| **Complete** | Full analysis without gaps | Detection recall ≥90% |

Gate: All SLC principles validated

---

---

---

# **19\. Regression Pipeline**

Triggered on every commit:

✅ Detection recall/precision suite
✅ False-positive fractures
✅ Stability diff tests
✅ Pricing math verification
✅ Trust sampling tests
✅ Performance regression benchmark
✅ Telemetry watchdog tests
✅ State handling tests *(NEW)*
✅ Output structure validation *(NEW)*
✅ JSON schema validation *(NEW)*

---

---

---

# **19\. Ship Gates**

Release blocked if any fail:

* Recall <90%

* Precision <97%

* Pricing error >10%

* Noise >1%

* Trust verification <95%

* CLI SLA miss

* Any telemetry detected

* JSON output invalid *(NEW)*

* Any CLI state crashes *(NEW)*

* Cached mode fails *(NEW)*

---

---

---

# **20\. Test Implementation Checklist** *(NEW)*

Tracking implementation status:

| Section | Tests | Implemented | Passing |
| ----- | ----- | ----- | ----- |
| 4. CLI Functional | 8 | ☐ | ☐ |
| 4.1 State Handling | 20 | ☐ | ☐ |
| 4.2 Output Structure | 35 | ☐ | ☐ |
| 4.3 File Generation | 10 | ☐ | ☐ |
| 5. Detection Suite | 70+ | ☐ | ☐ |
| 6. False-Positive | 10 | ☐ | ☐ |
| 7. StackMap Validation | 10 | ☐ | ☐ |
| 8. Trust Tests | 8 | ☐ | ☐ |
| 9. Stability | 8 | ☐ | ☐ |
| 10. Pricing | 20 | ☐ | ☐ |
| 11. Impact | 8 | ☐ | ☐ |
| 12. Failure Handling | 10 | ☐ | ☐ |
| 13. Security | 8 | ☐ | ☐ |
| 14. Performance | 6 | ☐ | ☐ |
| 15. Offline Mode | 6 | ☐ | ☐ |
| 16. GitHub Action | 8 | ☐ | ☐ |
| 17. Analyzer Features | 9 | ☐ | ☐ |
| **TOTAL** | **~250** | ☐ | ☐ |

---

---

---

# **✅ FINAL SIGNOFF CHECKLIST**

Before release:

* Detection meets thresholds (≥90% recall, ≥97% precision)

* StackMap accuracy validated

* Pricing delta verified (≤10% error)

* Trust tests pass (≥95% verification)

* Stability tests pass (≥99% noise-free)

* Optimization impact meets gate (≥75% actionable)

* Privacy guarantees validated

* All 5 CLI states render correctly *(NEW)*

* JSON outputs valid and complete *(NEW)*

* Offline mode functional *(NEW)*

* All PRD Section 6.1 features working *(NEW)*

**All must be green.**

---

---

---

