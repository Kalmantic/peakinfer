# PeakInfer v1.6 Implementation Document

**Product:** PeakInfer
**Organization:** Kalmantic AI Labs
**Version:** 1.6
**Date:** 19 December 2025
**Status:** Implementation Complete (Dashboard Partial)

---

## Executive Summary

PeakInfer v1.6 is a multi-surface LLM inference analysis product with:
- **CLI Tool** - BYOK (Bring Your Own Key) analysis
- **GitHub Action** - Managed service with PR comments
- **Hosted API** - peakinfer.com with credit-based billing
- **Website** - Marketing site with Stripe payments

**Goal:** Make PeakInfer "the tool developers can't imagine merging a PR without."

---

## System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           PeakInfer Ecosystem                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌──────────────┐     ┌──────────────┐     ┌──────────────────────────┐   │
│   │     CLI      │     │GitHub Action │     │    Hosted Service        │   │
│   │   (BYOK)     │     │  (Managed)   │     │   peakinfer.com          │   │
│   └──────┬───────┘     └──────┬───────┘     └────────────┬─────────────┘   │
│          │                    │                          │                 │
│          │                    │    POST /api/analyze     │                 │
│          │                    └──────────────────────────┤                 │
│          │                                               │                 │
│          ▼                                               ▼                 │
│   ┌──────────────────────────────────────────────────────────────────┐    │
│   │              Multi-Agent 4D Analysis Engine                       │    │
│   │  ┌─────────┐ ┌─────────┐ ┌────────────┐ ┌─────────────┐          │    │
│   │  │  Cost   │ │ Latency │ │ Throughput │ │ Reliability │          │    │
│   │  │ Analyzer│ │ Analyzer│ │  Analyzer  │ │  Analyzer   │          │    │
│   │  └─────────┘ └─────────┘ └────────────┘ └─────────────┘          │    │
│   │                    ▼                                              │    │
│   │         StaticAnalysisOrchestrator                               │    │
│   │         (Unified Single-Call per File)                           │    │
│   └──────────────────────────────────────────────────────────────────┘    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Repository Structure

### 1. CLI Repository (`peakinfer`)
**Location:** `github.com/Kalmantic/peakinfer`

```
src/
├── cli.ts                 # Entry point, argument parsing
├── agent.ts               # Two-pass execution orchestrator
├── types.ts               # TypeScript types & Zod schemas
│
├── agents/                # Multi-Agent 4D Analysis
│   ├── static-orchestrator.ts   # Unified single-call (60% faster)
│   ├── cost-analyzer.ts         # Model cost profiling
│   ├── latency-analyzer.ts      # Streaming, caching patterns
│   ├── throughput-analyzer.ts   # Batching, rate limits
│   └── reliability-analyzer.ts  # Retries, fallbacks, timeouts
│
├── history.ts             # Run history storage (.peakinfer/history/)
├── comparison.ts          # Historical diff (--compare)
├── prediction.ts          # Deploy-time latency prediction (--predict)
├── counterfactuals.ts     # What-if optimization scenarios
│
├── scanner.ts             # Static code analysis (regex + AST)
├── runtime.ts             # Runtime event parsing (JSONL)
├── joiner.ts              # Static + Runtime correlation (drift)
├── insights.ts            # Insight generation
│
├── renderer.ts            # Terminal output formatting
├── html.ts                # HTML report generation
├── pdf.ts                 # PDF report generation
│
├── commands/              # Subcommands
│   ├── ci.ts              # CI/CD integration
│   ├── config.ts          # Configuration management
│   ├── export.ts          # Export formats (JSON, Prometheus)
│   ├── history.ts         # History management
│   ├── template.ts        # Template management
│   └── whatif.ts          # Interactive counterfactuals
│
└── action/                # GitHub Action code
    ├── index.ts           # Action entry point
    ├── comments.ts        # PR comment generation
    ├── inline.ts          # Inline code comments
    ├── baseline.ts        # Baseline comparison
    └── diff.ts            # Changed file detection
```

### 2. Hosted Service (`peakinfer-site`)
**Location:** `github.com/Kalmantic/peakinfer-site`

```
app/
├── page.tsx               # Homepage
├── pricing/page.tsx       # Pricing page
├── dashboard/page.tsx     # Dashboard (static currently)
│
├── api/
│   ├── analyze/route.ts   # Main analysis endpoint
│   │
│   ├── credits/
│   │   ├── check/route.ts   # GET /api/credits/check?orgId=xxx
│   │   └── deduct/route.ts  # POST /api/credits/deduct
│   │
│   └── stripe/
│       ├── checkout/route.ts  # Stripe checkout session
│       ├── webhook/route.ts   # Stripe webhooks
│       └── portal/route.ts    # Customer portal
│
lib/
├── db.ts                  # Database functions (Vercel Postgres)
├── schema.sql             # Database schema
│
└── agents/
    ├── types.ts           # Type definitions
    └── static-orchestrator.ts  # Same as CLI
```

### 3. Demo Repository (`peakinfer-demo`)
**Location:** `github.com/Kalmantic/peakinfer-demo`

```
src/
└── ai_service.py          # Demo file with LLM issues

.github/workflows/
└── peakinfer.yml          # GitHub Action workflow
```

---

## Component Details

### 1. CLI Tool

#### Commands

```bash
# Basic analysis
peakinfer analyze ./src

# With history comparison
peakinfer analyze ./src --compare

# Deploy-time prediction
peakinfer analyze ./src --predict --target-p95 2000

# Full analysis with HTML report
peakinfer analyze ./src --compare --predict --html --open

# History management
peakinfer history list
peakinfer history show <run-id>
peakinfer history prune --keep 10

# What-if scenarios
peakinfer whatif --model gpt-4o-mini
peakinfer whatif --streaming --batch-size 10

# Export
peakinfer export --format prometheus
peakinfer export --format json > results.json

# CI mode
peakinfer ci ./src --baseline baseline.json
```

#### Data Flow

```
User runs: peakinfer analyze ./src --compare --predict
                    │
                    ▼
┌─────────────────────────────────────────────────────────┐
│ 1. PLANNING PHASE                                        │
│    - Glob files (*.py, *.ts, *.js, etc.)                │
│    - Load previous run for comparison                    │
│    - Display task plan to user                          │
└─────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────┐
│ 2. ANALYSIS PHASE (per file)                            │
│    StaticAnalysisOrchestrator.analyze()                 │
│    - Single LLM call per file                           │
│    - Returns: inferencePoints[], 4D profiles, insights  │
└─────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────┐
│ 3. POST-PROCESSING                                       │
│    - Generate predictions (prediction.ts)               │
│    - Generate counterfactuals (counterfactuals.ts)      │
│    - Compare with baseline (comparison.ts)              │
│    - Save to history (history.ts)                       │
└─────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────┐
│ 4. OUTPUT                                                │
│    - Terminal: renderer.ts                              │
│    - HTML: html.ts (--html)                             │
│    - PDF: pdf.ts (--pdf)                                │
│    - JSON: stdout (--json)                              │
└─────────────────────────────────────────────────────────┘
```

---

### 2. GitHub Action

#### Configuration

```yaml
# action.yml
name: 'PeakInfer'
description: 'LLM inference performance analysis'

inputs:
  path:
    description: 'Path to analyze'
    default: './src'
  github-token:
    description: 'GitHub token for PR comments'
    required: true
  inline-comments:
    description: 'Post inline comments on PR'
    default: 'true'
  fail-on-regression:
    description: 'Fail if performance regressions detected'
    default: 'false'

outputs:
  status:
    description: 'Analysis status (pass/warning/fail)'
  inference-points:
    description: 'Number of inference points found'
  summary:
    description: 'JSON summary of analysis'

runs:
  using: 'node20'
  main: 'dist/action/index.js'
```

#### Action Flow

```
PR Opened/Updated
        │
        ▼
┌───────────────────────────────────────────────┐
│ 1. CHECKOUT & SETUP                           │
│    - actions/checkout@v4                      │
│    - actions/setup-node@v4 (node 20)          │
└───────────────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────────┐
│ 2. COLLECT FILES                              │
│    - Find *.py, *.ts, *.js in path            │
│    - Read file contents                       │
│    - Build JSON payload                       │
└───────────────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────────┐
│ 3. CALL HOSTED API                            │
│    POST https://peakinfer.com/api/analyze     │
│    {                                          │
│      orgId: "github-org-name",                │
│      files: [{ path, content }],              │
│      repo: "owner/repo",                      │
│      prNumber: 123                            │
│    }                                          │
└───────────────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────────┐
│ 4. PROCESS RESPONSE                           │
│    - Check credits (402 = exhausted)          │
│    - Parse analysis results                   │
│    - Detect regressions vs baseline           │
└───────────────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────────┐
│ 5. POST COMMENTS                              │
│    - PR summary comment (comments.ts)         │
│    - Inline comments on critical issues       │
│    - Credit usage display                     │
└───────────────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────────┐
│ 6. SET OUTPUTS & EXIT                         │
│    - status: pass/warning/fail                │
│    - inference-points: count                  │
│    - Exit code: 0/1/2                         │
└───────────────────────────────────────────────┘
```

#### PR Comment UX (v2.0 - Verdict First)

**Design Principles** (Julie Zhou behavior-first):
- Verdict first: User knows in 5 seconds if PR needs attention
- One top issue: User acts on one thing at a time
- Progressive disclosure: Details collapsed for power users
- Action-oriented: Inline suggestions user can apply with one click

**Verdict Logic:**
```
≥2 critical        → 🔴 Changes Requested
1 critical OR >5   → 🟡 Review Recommended
1-5 warnings       → 🟢 Mostly Good
0 issues           → ✅ Safe to Merge
```

**Comment Format:**
```markdown
## PeakInfer Analysis

**🟡 Review Recommended** — 2 issues need attention before merge

| | |
|---|---|
| **Top Issue** | Missing error handling in LLM calls |
| **Location** | `src/api/chat.ts:45` |
| **Why it matters** | Unhandled API failures will crash the service |

<details>
<summary>See all 7 issues</summary>

**Critical** (2)
- Missing error handling in LLM calls — `src/api/chat.ts:45`
- Unbounded retry without backoff — `src/api/retry.ts:23`

**Warning** (5)
- Premium model used for simple task — `src/llm/classify.ts:12`
- Sequential calls could be parallelized — `src/batch/process.ts:67`
- _...3 more_
</details>

---
**Commands:** `/fix 1` · `/dismiss 2` · `/fix all` · `/peakinfer`

<sub>See inline comments for suggested fixes</sub>
<sub>Generated by PeakInfer</sub>
```

---

### 2.5. PR Comment Interactive Flow

#### Current vs Ideal Design Comparison

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        CURRENT IMPLEMENTATION (v1.6)                        │
└─────────────────────────────────────────────────────────────────────────────┘

    PR Created/Updated
           │
           ▼
    ┌──────────────┐     ┌──────────────────────────────────────┐
    │    Post      │     │  ## PeakInfer Analysis               │
    │   Summary    │────▶│  **🟡 Review Recommended**           │
    │   Comment    │     │  Top Issue: Missing error handling   │
    │              │     │  <details>See all 7 issues</details> │
    └──────┬───────┘     │  Commands: /fix 1 · /dismiss 2       │
           │             └──────────────────────────────────────┘
           ▼
    ┌──────────────┐     ┌──────────────────────────────────────┐
    │    Post      │     │  **Missing error handling**          │
    │   Inline     │────▶│  ```suggestion                       │
    │  Comments    │     │  try { ... } catch { ... }           │
    │   (max 5)    │     │  ```                                 │
    └──────────────┘     └──────────────────────────────────────┘
                                        │
                         User clicks "Apply suggestion" or
                         comments "/fix 1" to apply fix
                                        │
                                        ▼
                              ┌───────────────────┐
                              │  Commit created   │
                              │  Re-run analysis  │
                              └───────────────────┘
```

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         IDEAL DESIGN (v2.0 Future)                          │
└─────────────────────────────────────────────────────────────────────────────┘

    PR Created/Updated
           │
           ▼
    ┌──────────────────────────────────────────────────────────────────────┐
    │                     SINGLE INTERACTIVE COMMENT                        │
    │                                                                       │
    │  ## PeakInfer Analysis                                               │
    │                                                                       │
    │  **🟡 Review Recommended** — 7 issues found, 5 have fixes            │
    │                                                                       │
    │  ┌─────────────────────────────────────────────────────────────────┐ │
    │  │ ISSUE 1 of 7                                          [Critical]│ │
    │  │                                                                 │ │
    │  │ **Missing error handling in LLM calls**                         │ │
    │  │ `src/api/chat.ts:45`                                           │ │
    │  │                                                                 │ │
    │  │ ```diff                                                         │ │
    │  │ - const response = await openai.chat(...)                       │ │
    │  │ + try {                                                         │ │
    │  │ +   const response = await openai.chat(...)                     │ │
    │  │ + } catch (error) {                                             │ │
    │  │ +   throw new LLMError('Failed', { cause: error });             │ │
    │  │ + }                                                             │ │
    │  │ ```                                                             │ │
    │  │                                                                 │ │
    │  │  [✓ Accept Fix]  [✗ Dismiss]  [◀ Prev]  [Next ▶]               │ │
    │  └─────────────────────────────────────────────────────────────────┘ │
    │                                                                       │
    │  Progress: ○○○○○○○  (0/7 resolved)                                   │
    │  [Accept All Fixes]  [Re-run Analysis]                               │
    └──────────────────────────────────────────────────────────────────────┘
           │
           │ User clicks [✓ Accept Fix] or [Accept All]
           ▼
    ┌──────────────────────────────────────────────────────────────────────┐
    │  ## PeakInfer Analysis                                               │
    │  **✅ Ready to Merge** — All issues resolved                         │
    │  Progress: ●●●●●●●  (7/7 resolved)                                   │
    │  **5 fixes applied** • 1 commit created                             │
    └──────────────────────────────────────────────────────────────────────┘
```

#### Feature Comparison

| Feature | Current (v1.6) | Ideal (v2.0) |
|---------|----------------|--------------|
| Verdict at glance | ✅ Yes | ✅ Yes |
| See all issues | ✅ Collapsed | ✅ Carousel |
| Accept fix | ✅ Per-file (inline) or `/fix N` | ✅ In-place buttons |
| Dismiss issue | ✅ `/dismiss N` | ✅ Button |
| Batch accept | ✅ `/fix all` | ✅ Button |
| Progress tracking | ⚠️ Via re-run | ✅ Live progress bar |
| Re-run trigger | ✅ `/peakinfer` | ✅ Button |

#### Command System (Current Implementation)

The comment command system enables users to interact without leaving GitHub:

| Command | Action |
|---------|--------|
| `/peakinfer` | Re-run analysis |
| `/fix 1` | Apply fix for issue #1 |
| `/fix all` | Apply all available fixes |
| `/dismiss 2` | Mark issue #2 as "won't fix" |

**Workflow:**
```
1. User comments: /fix 1
2. Workflow triggers on issue_comment
3. Action reads PR state, applies fix
4. Commit created on PR branch
5. Action posts confirmation reply
6. New analysis triggered by push
```

#### Implementation Requirements

**Current (v1.6) - GitHub Action only:**
- Comment parsing in `src/action/commands.ts`
- State stored in hidden comment (`<!-- peakinfer-state:...-->`)
- Workflow triggers on `issue_comment`

**Ideal (v2.0) - Requires GitHub App:**
- Webhook endpoint for button clicks
- Database for real-time state
- Dynamic comment updates via API

---

### 3. Hosted API (`peakinfer.com`)

#### API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/analyze` | POST | Run 4D analysis on files |
| `/api/credits/check` | GET | Check credit balance |
| `/api/credits/deduct` | POST | Deduct credits |
| `/api/stripe/checkout` | GET/POST | Create Stripe checkout |
| `/api/stripe/webhook` | POST | Handle Stripe events |
| `/api/stripe/portal` | POST | Customer billing portal |

#### Database Schema

```sql
-- Organizations (GitHub orgs)
CREATE TABLE organizations (
  id SERIAL PRIMARY KEY,
  github_org_id VARCHAR(255) UNIQUE NOT NULL,
  plan VARCHAR(50) DEFAULT 'free',  -- 'free' | 'pro'
  stripe_customer_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Monthly credit usage
CREATE TABLE credit_usage (
  id SERIAL PRIMARY KEY,
  org_id INTEGER REFERENCES organizations(id),
  month VARCHAR(7) NOT NULL,        -- '2024-12'
  used INTEGER DEFAULT 0,
  limit_amount INTEGER DEFAULT 300, -- 300 free, 500 pro
  UNIQUE(org_id, month)
);

-- Analysis run history
CREATE TABLE analysis_runs (
  id SERIAL PRIMARY KEY,
  org_id INTEGER REFERENCES organizations(id),
  repo VARCHAR(255),
  pr_number INTEGER,
  inference_points INTEGER,
  insights JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### Credit Flow

```
GitHub Action triggers
        │
        ▼
┌─────────────────────────────────────┐
│ 1. Check Credits                    │
│    GET /api/credits/check?orgId=X   │
│    Returns: { hasCredits, used,     │
│              limit, remaining }     │
└─────────────────────────────────────┘
        │
        ├── No credits → 402 Exhausted
        │
        ▼ Has credits
┌─────────────────────────────────────┐
│ 2. Run Analysis                     │
│    POST /api/analyze                │
│    Uses master ANTHROPIC_API_KEY    │
└─────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────┐
│ 3. Deduct Credit                    │
│    POST /api/credits/deduct         │
│    { orgId, amount: 1 }             │
└─────────────────────────────────────┘
        │
        ▼
    Return results + credit info
```

#### Billing Flow

```
User clicks "Upgrade to Pro"
        │
        ▼
GET /api/stripe/checkout
        │
        ▼
Redirect to Stripe Checkout
        │
        ▼
User completes payment
        │
        ▼
POST /api/stripe/webhook
  event: checkout.session.completed
        │
        ▼
Update org.plan = 'pro'
Update credit_usage.limit_amount = 500
        │
        ▼
Redirect to /dashboard?upgraded=true
```

---

### 4. Website Pages

#### Homepage (`/`)

```
┌─────────────────────────────────────────────────────────┐
│ Nav: PeakInfer | Problem | How It Works | Pricing       │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Your inference isn't performing at its peak            │
│                                                         │
│  Code says streaming is enabled. Runtime shows 0%       │
│  streams. That drift is why your p95 is 2.4s not 400ms. │
│                                                         │
│  [See Your Numbers]   30 seconds. Zero config.          │
│                                                         │
│  npm install -g @kalmantic/peakinfer                    │
│                                                         │
├─────────────────────────────────────────────────────────┤
│ What teams discover in their first scan                 │
│ ┌─────────────┐ ┌─────────────┐                         │
│ │ 90% cost    │ │ 5x latency  │                         │
│ │ waste       │ │ bloat       │                         │
│ └─────────────┘ └─────────────┘                         │
│ ┌─────────────┐ ┌─────────────┐                         │
│ │ Zero error  │ │ Sequential  │                         │
│ │ handling    │ │ bottlenecks │                         │
│ └─────────────┘ └─────────────┘                         │
├─────────────────────────────────────────────────────────┤
│ 30 seconds to see everything                            │
│ 1. Scan your code    peakinfer analyze ./src            │
│ 2. See what's wrong  7 inference points, 39 issues      │
│ 3. Fix before ship   uses: kalmantic/peakinfer@v1       │
└─────────────────────────────────────────────────────────┘
```

#### Pricing Page (`/pricing`)

```
┌─────────────────────────────────────────────────────────┐
│ Simple pricing. Generous free tier.                     │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────────────┐  ┌──────────────────┐            │
│  │ Free             │  │ Pro   RECOMMENDED│            │
│  │ $0/month         │  │ $20/user/month   │            │
│  │                  │  │                  │            │
│  │ ✓ 300 credits    │  │ ✓ 500 credits    │            │
│  │ ✓ Full features  │  │ ✓ Overage $0.05  │            │
│  │ ✓ 30-day history │  │ ✓ 90-day history │            │
│  │                  │  │ ✓ Email support  │            │
│  │ [Get Started]    │  │ [Upgrade to Pro] │            │
│  └──────────────────┘  └──────────────────┘            │
└─────────────────────────────────────────────────────────┘
```

#### Dashboard (`/dashboard`)

```
┌─────────────────────────────────────────────────────────┐
│ Dashboard                                               │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐       │
│  │ Credits     │ │ Plan        │ │ Analyses    │       │
│  │ 45/300      │ │ Free        │ │ 12          │       │
│  └─────────────┘ └─────────────┘ └─────────────┘       │
│                                                         │
│  Recent Analyses                                        │
│  ┌─────────────────────────────────────────────────┐   │
│  │ Repository    │ PR   │ Status │ Date           │   │
│  │ acme/backend  │ #142 │ PASS   │ Dec 18, 2025   │   │
│  │ acme/backend  │ #141 │ WARN   │ Dec 17, 2025   │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  Settings                                               │
│  [Connect GitHub]  [Manage Billing]                     │
└─────────────────────────────────────────────────────────┘
```

---

## Implementation Status

### Summary Table

| Component | Status | Completeness |
|-----------|--------|--------------|
| **CLI: 4D Analysis** | DONE | 100% |
| **CLI: History Storage** | DONE | 100% |
| **CLI: Historical Comparison** | DONE | 100% |
| **CLI: Deploy-Time Prediction** | DONE | 100% |
| **CLI: Counterfactual Insights** | DONE | 100% |
| **CLI: HTML/PDF Reports** | DONE | 100% |
| **CLI: Unified Single-Call** | DONE | 100% |
| **CLI: Commands** | DONE | 100% |
| **API: /analyze (4D)** | DONE | 100% |
| **API: /credits/check** | DONE | 100% |
| **API: /credits/deduct** | DONE | 100% |
| **API: /stripe/checkout** | DONE | 100% |
| **API: /stripe/webhook** | DONE | 100% |
| **API: Database** | DONE | 100% |
| **Action: PR Comments** | DONE | 100% |
| **Action: Inline Comments** | DONE | 100% |
| **Action: Credit Checking** | DONE | 100% |
| **Action: Baseline Comparison** | DONE | 100% |
| **Website: Homepage** | DONE | 100% |
| **Website: Pricing Page** | DONE | 100% |
| **Website: Dashboard** | PARTIAL | 30% |

### Pending Work

1. **Dashboard Data Integration** (HIGH PRIORITY)
   - Dashboard shows static mockup data
   - Needs real credit fetching from DB
   - Needs real analysis history display
   - Needs GitHub OAuth for org connection

---

## Demo URLs

| Demo | URL/Command |
|------|-------------|
| **CLI** | `peakinfer analyze .` |
| **API** | `https://www.peakinfer.com/api/analyze` |
| **GitHub Action** | [PR #2](https://github.com/Kalmantic/peakinfer-demo/pull/2) |
| **Website** | https://www.peakinfer.com |
| **Pricing** | https://www.peakinfer.com/pricing |
| **Dashboard** | https://www.peakinfer.com/dashboard |
| **Credits API** | `GET /api/credits/check?orgId=xxx` |

---

## Environment Variables

### CLI (User's machine)
```bash
ANTHROPIC_API_KEY=sk-ant-...  # User's own key (BYOK)
```

### Hosted Service (Vercel)
```bash
# Anthropic (Master key for managed service)
ANTHROPIC_API_KEY=sk-ant-...

# Database
POSTGRES_URL=postgres://...

# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRO_PRICE_ID=price_...

# App
NEXT_PUBLIC_BASE_URL=https://www.peakinfer.com
```

---

## Key Files Reference

### CLI Repository
| File | Purpose |
|------|---------|
| `src/agent.ts` | Two-pass execution orchestrator |
| `src/agents/static-orchestrator.ts` | Unified single-call analysis |
| `src/history.ts` | Run history storage |
| `src/comparison.ts` | Historical comparison |
| `src/prediction.ts` | Deploy-time predictions |
| `src/counterfactuals.ts` | What-if scenarios |
| `src/action/comments.ts` | PR comment generation |
| `src/action/inline.ts` | Inline code comments |
| `action.yml` | GitHub Action definition |

### Website Repository
| File | Purpose |
|------|---------|
| `app/api/analyze/route.ts` | Main analysis endpoint |
| `app/api/credits/check/route.ts` | Credit balance check |
| `app/api/stripe/checkout/route.ts` | Stripe checkout |
| `app/api/stripe/webhook/route.ts` | Stripe webhooks |
| `lib/db.ts` | Database functions |
| `lib/agents/static-orchestrator.ts` | Analysis engine |
| `app/page.tsx` | Homepage |
| `app/pricing/page.tsx` | Pricing page |
| `app/dashboard/page.tsx` | Dashboard |

---

## Testing

### CLI Test
```bash
peakinfer analyze /tmp/peakinfer-demo/src
```

### API Test
```bash
curl -X POST https://www.peakinfer.com/api/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "orgId": "test-org",
    "files": [{
      "path": "test.py",
      "content": "import openai\nclient = openai.OpenAI()\nresponse = client.chat.completions.create(model=\"gpt-4\", messages=[])"
    }]
  }'
```

### Credits Test
```bash
curl "https://www.peakinfer.com/api/credits/check?orgId=Kalmantic"
```

### GitHub Action Test
1. Go to https://github.com/Kalmantic/peakinfer-demo
2. Create a PR with changes to `src/ai_service.py`
3. Action will run and post comment

---

## Reference Documents

| Document | Purpose |
|----------|---------|
| PeakInfer PRD v1.6.md | Product requirements |
| PeakInfer DD v1.6.md | Design document |
| PeakInfer TDD v1.6.md | Technical design |
| PeakInfer Strategy v1.6.md | Competitive positioning |
| PeakInfer Business Model v1.6.md | Pricing, unit economics |

---

**Last Updated:** 19 December 2025
**Maintained By:** Kalmantic AI Labs
