# **PeakInfer Product Requirements Document (PRD) v1.0**

**Performance-First, Truth-Oriented Specification**

**Product:** PeakInfer  
**Organization:** Kalmantic AI Labs  
**Version:** 1.0  
**Date:** December 2025  
**Author:** Thiyagarajan Maruthavanan

---

## **Document Purpose**

This PRD defines **what PeakInfer must do, must not do, and must guarantee** as a product.

It establishes:

* the problem being solved  
* the behavioral contract with users  
* the environments PeakInfer supports  
* the quality and correctness guarantees  
* explicit non-goals and boundaries

This document **does not** describe implementation details, algorithms, fixtures, benchmarks, or test matrices. Those are defined elsewhere.

---

# **1\. The Problem (Why This Exists)**

Teams building with LLMs cannot reliably determine whether their inference systems are operating **near achievable peak performance**.

They lack clear, trustworthy answers to:

* Where inference actually occurs in the code  
* Which providers, models, and runtimes are in use  
* Which performance-critical patterns are active  
* Whether runtime behavior matches code intent  
* Where performance headroom is being wasted or dominated

Today, teams rely on:

* manual code inspection  
* partial dashboards  
* tribal knowledge  
* guesswork

PeakInfer exists to replace guesswork with **ground truth and performance clarity**.

---

# **2\. Canonical Job To Be Done**

**When I inherit, audit, or optimize a codebase that uses LLMs, I need to understand how inference behaves and whether it is operating near its achievable peak under real constraints, so I can make correct engineering decisions.**

PeakInfer is not hired to optimize automatically.  
PeakInfer is hired to **reveal performance reality**.

---

# **3\. What PeakInfer Is — and Is Not**

### **PeakInfer Is**

* a codebase intelligence tool  
* a system of record for inference behavior  
* deterministic and auditable  
* artifact-producing  
* usable offline (for runtime analysis)

### **PeakInfer Is Not**

* an IDE assistant  
* an observability platform  
* a real-time monitoring system  
* a model host  
* an auto-optimization engine

The CLI is the product.  
The artifacts are the value.

---

# **4\. Supported Operating Environments (Normative)**

PeakInfer guarantees correct and deterministic outputs across the following **environment classes**:

1. **SaaS API Inference**  
   * Direct model APIs  
   * Proxy-based routing  
   * Streaming, retries, fallbacks  
2. **Hosted Self-Inference**  
   * Model servers (e.g., vLLM, TGI, SGLang)  
   * Cloud GPU infrastructure  
   * HTTP or RPC endpoints  
3. **Bare-Metal / On-Prem Inference**  
   * Single-node or multi-GPU systems  
   * No cloud assumptions  
   * Explicit runtime configuration  
4. **Hybrid and Transitional Systems**  
   * Mixed SaaS and hosted inference  
   * Gradual migrations  
   * Canary or shadow traffic  
5. **Mixed Evidence Inputs**  
   * Static code only  
   * Runtime events only  
   * Combined static \+ runtime analysis

These guarantees apply regardless of provider, framework, or deployment model.

---

# **5\. Input Trust Model**

PeakInfer treats all inputs as **potentially incomplete or conflicting**.

* **Static code analysis** reflects *declared intent*  
* **Runtime events** reflect *observed behavior*  
* Neither input is assumed authoritative  
* Conflicts are surfaced explicitly, not resolved silently

PeakInfer never invents inference paths to “fill gaps.”

---

# **6\. Core Capabilities**

## **6.1 Static Code Analysis**

**Command**

```
peakinfer analyze .
```

**Behavior**

* Scans supported languages  
* Performs semantic (not regex-based) analysis  
* Detects LLM inference points  
* Identifies providers, models, patterns, and runtime signals  
* Produces a canonical inference topology artifact

**Requirements**

* Internet access  
* LLM API key (for semantic analysis)

**Privacy**

* Code is sent only for analysis  
* No telemetry is sent to Kalmantic  
* Outputs remain local

---

## **6.2 Runtime Events Analysis (Offline)**

**Command**

```
peakinfer analyze events.jsonl
```

**Behavior**

* Processes user-supplied runtime events  
* Fully offline  
* No API keys required

**Outputs**

* Provider and model usage  
* Latency distributions  
* Token counts  
* Throughput signals

PeakInfer does not collect runtime data.  
It only analyzes what the user provides.

---

## **6.3 Combined Analysis (Static \+ Runtime)**

**Command**

```
peakinfer analyze ./src --events production.jsonl
```

**Behavior**

* Correlates declared intent with observed behavior  
* Performs **drift detection**

**Drift Signals**

* Code paths never exercised  
* Runtime behavior unseen in code  
* Model or provider mismatches  
* Pattern mismatches (e.g., batching declared, absent at runtime)

Conflicts are surfaced, not reconciled.

---

# **7\. Performance Trade-Off Analysis**

PeakInfer does **not** optimize cost.

Cost and pricing signals exist **only** to explain performance trade-offs and dominated configurations.

PeakInfer evaluates:

* latency-bound vs throughput-bound systems  
* dominated configurations  
* unreachable performance states  
* wasted performance headroom

Outputs explain **why** a system is constrained, not what action to take.

---

# **8\. Reference Data Sources (Inputs, Not Features)**

## **8.1 Inference Benchmark References**

Public inference benchmarks are used to define **reference performance envelopes**.

They establish:

* what is achievable  
* what is dominated  
* what is unrealistic

Benchmarks are references, not promises.

---

## **8.2 Pricing Normalization**

Normalized pricing schemas may be used internally to interpret trade-offs consistently.

Pricing data is:

* internal only  
* non-authoritative  
* never surfaced as a primary product feature

---

# **9\. Output Artifacts**

PeakInfer produces deterministic, auditable artifacts:

1. **InferenceMap (StackMap)**  
   Canonical machine-readable inference topology  
2. **Performance Gap Summary**  
   Clear explanation of constraints and dominated states  
3. **Optional HTML Report**  
   Human-readable, shareable summary

Artifacts are stable across runs given identical inputs.

---

# **10\. Determinism & Reproducibility Guarantees**

* Identical inputs produce identical outputs  
* Cached reference data ensures stability  
* Non-determinism is bounded and surfaced explicitly

PeakInfer is suitable for CI, audits, and regression testing.

---

# **11\. Failure Philosophy**

PeakInfer prefers:

* explicit failure over silent misclassification  
* partial results over fabricated completeness  
* warnings over assumptions

PeakInfer must **never** invent:

* inference paths  
* providers  
* models  
* performance characteristics

---

# **12\. Interpretation Boundary**

PeakInfer:

* describes states  
* surfaces constraints  
* explains trade-offs

PeakInfer does **not**:

* choose architectures  
* route traffic  
* rewrite code  
* enforce decisions

Humans decide.  
PeakInfer clarifies.

---

# **13\. Security & Malformed Inputs**

* Inputs are treated as untrusted  
* Schemas are validated strictly  
* Ambiguity is surfaced, not inferred  
* Obfuscated or malformed inputs may reduce coverage but never produce false certainty

---

# **14\. Explicit Non-Goals**

PeakInfer explicitly does **not**:

* provide real-time monitoring  
* perform automatic remediation  
* host or proxy models  
* act as a vendor arbitration layer  
* optimize for cost as a primary objective

---

# **15\. Quality Bars**

PeakInfer must satisfy:

* ≥90% inference point detection in supported languages  
* near-zero false positives for providers/models  
* strict schema validation  
* \<60s analysis for 10k LOC  
* deterministic outputs  
* explainable failures

---

# **16\. Roadmap Discipline**

### **v1 (This Document)**

* Static analysis  
* Offline runtime analysis  
* Combined drift detection  
* Performance trade-off analysis

No telemetry.  
No auto-optimization.  
No proprietary model.

### **v2**

* Team workflows  
* CI integrations  
* Historical comparisons

### **v3 (Deferred)**

* Specialized inference intelligence model  
  *Only after data compounding and PMF.*

---

# **17\. Installation**

```
npm install -g @kalmantic/peakinfer
export ANTHROPIC_API_KEY=your-key
peakinfer analyze .
```

---

# **18\. The Honest Take**

PeakInfer does one thing exceptionally well:

**It tells you whether your inference system is operating near its achievable peak — and why it isn’t.**

It is a flashlight, not a lever.

If you want automation, dashboards, or magic, this is not that product.  
If you want truth, this is.

---

**Simple. Lovable. Complete.**  
Not minimum.

