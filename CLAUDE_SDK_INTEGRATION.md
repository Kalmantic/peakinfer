# Claude SDK Integration Guide

**Status**: ✅ Fully Integrated
**Claude Model**: `claude-sonnet-4-5-20250929`
**SDK**: `@anthropic-ai/claude-code`

---

## 🤖 Overview

TokenOp ab Claude Code SDK se fully integrated hai! Jab bhi koi command run karega, Claude automatically:

1. ✅ **Infrastructure analyze karega**
2. ✅ **Problems identify karega**
3. ✅ **Solutions suggest karega**
4. ✅ **Beautiful formatted response dikhayega**

---

## 🔑 Setup: Claude API Key

### Step 1: API Key Lena

Claude API key yahan se milega:
👉 **https://console.anthropic.com/**

### Step 2: API Key Set Karna

#### Option A: Environment Variable (Recommended)

```bash
# Terminal me set karo
export ANTHROPIC_API_KEY="sk-ant-your-api-key-here"

# Permanent ke liye ~/.bashrc ya ~/.zshrc me add karo
echo 'export ANTHROPIC_API_KEY="sk-ant-your-api-key-here"' >> ~/.bashrc
source ~/.bashrc
```

#### Option B: Interactive Prompt

Agar environment me key nahi hai, toh CLI automatically puchega:

```bash
node dist/cli.js discover

⚠️  Claude API Key Required

TokenOp uses Claude Code SDK for intelligent optimization.
Get your API key from: https://console.anthropic.com/

Enter your Anthropic API key: sk-ant-...
```

---

## 🎨 Beautiful Response Format

### Problem/Solution Format

Jab bhi CLI run hoga, Claude beautiful format me problem aur solution dikhayega:

```
═══════════════════════════════════════════════════════════
  🤖 Claude Analysis: Infrastructure Discovery
═══════════════════════════════════════════════════════════

🔴 Problems Identified:

  1. No LLM runtime libraries detected - missing optimization opportunities
  2. No serving frameworks detected - missing 2-3x inference speedup potential
  3. High monthly cost ($5,000) - significant optimization potential

🔍 Key Findings:

  1. Application layer not optimized for LLM workloads
  2. Missing GPU acceleration opportunities
  3. Inefficient resource utilization

✅ Suggested Solutions:

  1. Add LLM Runtime Libraries
     Integrate OpenAI, Anthropic, or HuggingFace APIs to enable cost optimization
     💰 Potential Savings: $0/month
     🔧 Effort: 1-2 days

  2. Implement Serving Framework
     Deploy vLLM or SGLang for 2-3x inference speedup and better batching
     💰 Potential Savings: $1,500/month
     🔧 Effort: 3-5 days

  3. Implement Multi-Layer Optimization
     Apply semantic caching, model routing, and serving optimizations for 20-40% cost reduction
     💰 Potential Savings: $1,500/month
     🔧 Effort: 1-2 weeks

💡 Recommendations:

  • Start with serving framework implementation for quick wins
  • Add semantic caching to reduce API calls by 30-50%
  • Optimize GPU utilization with continuous batching

═══════════════════════════════════════════════════════════
```

### Detailed Problem/Solution Pairs

Har specific problem ke liye detailed solution:

```
📌 Problem Detected:
  No serving framework detected (vLLM, TensorRT, SGLang)

✨ Suggested Solution:
  Implement vLLM or SGLang for 2-3x inference speedup and better GPU utilization

💰 Cost Impact: $500-2000/month savings
⏱️  Implementation Time: 3-5 days
🔧 Complexity: Medium
```

---

## 🚀 Claude Integration in Commands

### 1. `tokenop discover`

**What Claude Does**:
- Analyzes your codebase using Read, Glob, Bash, Grep tools
- Detects runtimes (Python, Node.js, OpenAI, HuggingFace)
- Identifies serving frameworks (vLLM, TensorRT, Transformers)
- Finds GPUs and infrastructure
- Estimates monthly costs
- **Provides problems + solutions**

**Example Usage**:
```bash
node dist/cli.js discover

# Claude will:
# 1. Scan your codebase
# 2. Identify problems
# 3. Suggest solutions
# 4. Show beautiful formatted output
```

**Claude's Analysis Includes**:
- ✅ Runtime detection
- ✅ Framework detection
- ✅ Cost estimation
- ✅ Problem identification
- ✅ Solution suggestions
- ✅ Implementation effort estimates

---

### 2. `tokenop profile`

**What Claude Does**:
- Semantic clustering of prompts (not just keywords!)
- Intent pattern recognition
- Cost breakdown analysis
- Representative sample generation

**Example**:
```bash
node dist/cli.js profile --events examples/events.jsonl

# Claude will:
# 1. Analyze prompt patterns semantically
# 2. Group similar intents
# 3. Identify cost drivers
# 4. Suggest optimizations per intent
```

---

### 3. `tokenop plan`

**What Claude Does**:
- Creates intelligent optimization strategy
- Prioritizes based on ROI
- Considers policy constraints
- Suggests execution order

**Example**:
```bash
node dist/cli.js plan --constraints examples/policy.yaml

# Claude will:
# 1. Load policy constraints
# 2. Match templates to environment
# 3. Create prioritized plan
# 4. Estimate savings and effort
```

---

### 4. `tokenop orchestrate` (All-in-One)

**What Claude Does**:
- Runs all 6 stages automatically
- Provides continuous analysis
- Shows progress with beautiful formatting
- Generates comprehensive final report

**Example**:
```bash
node dist/cli.js orchestrate \
  --workload examples/events.jsonl \
  --policy examples/policy.yaml \
  --dry-run

# Claude will:
# 1. Discover infrastructure (with problems/solutions)
# 2. Profile workload (with semantic clustering)
# 3. Load policy
# 4. Create optimization plan
# 5. Execute optimizations
# 6. Generate audit report with recommendations
```

---

## 🎯 Claude's Intelligence Features

### 1. **Semantic Understanding**

Claude doesn't just match keywords - it understands meaning:

```typescript
// Regular clustering: "summarize doc" != "create summary"
// Claude clustering: Both are "document_summarization" intent ✅
```

### 2. **Context-Aware Recommendations**

Claude considers your entire stack:

- Application layer (APIs, libraries)
- Serving layer (frameworks, configs)
- Infrastructure layer (GPUs, cloud)

### 3. **Economic Analysis**

Claude calculates:
- Cost savings potential
- Implementation effort
- ROI and payback period
- Risk assessment

### 4. **Problem-Solution Mapping**

Har problem ke liye actionable solution:

| Problem | Solution | Savings | Effort |
|---------|----------|---------|--------|
| No serving framework | Deploy vLLM | $1,500/mo | 3-5 days |
| Low GPU utilization | Optimize batching | $800/mo | 2-3 days |
| High API costs | Add semantic caching | $2,000/mo | 1 week |

---

## 🔧 Technical Details

### Claude Model Configuration

```typescript
const claudeQuery = query({
  prompt: analysisPrompt,
  options: {
    model: 'claude-sonnet-4-5-20250929',  // Latest Claude Sonnet
    maxTurns: 5,                           // Multi-turn conversation
    cwd: process.cwd(),                    // Access to codebase
    allowedTools: [                        // Tools Claude can use
      'Read',    // Read files
      'Glob',    // Find files by pattern
      'Bash',    // Run shell commands
      'Grep'     // Search file contents
    ]
  }
});
```

### Response Processing

```typescript
// Claude returns structured JSON
interface ClaudeAnalysis {
  runtimes: string[];              // Detected runtimes
  frameworks: string[];            // Detected frameworks
  infrastructure: string[];        // Infrastructure components
  gpu_detected: boolean;           // GPU availability
  estimated_monthly_cost: number;  // Cost estimate
  key_findings: string[];          // Important findings
}

// We format it beautifully
ClaudeHelper.formatAnalysis('Infrastructure Discovery', analysis);
```

### Error Handling

```typescript
try {
  // Try Claude analysis
  const analysis = await claude.analyze();
  showBeautifulResponse(analysis);
} catch (error) {
  // Fallback to heuristic analysis
  console.warn('Claude discovery failed, using fallback');
  const fallback = await heuristicDiscovery();
}
```

---

## 📊 Example Complete Flow

```bash
# User runs command
$ node dist/cli.js discover

# TokenOp checks API key
✓ Claude API key found

# Claude starts analyzing
🤖 TokenOp: Environment Discovery
Stage 1: Multi-agent infrastructure discovery

⠋ Running Claude Discovery Agent...
  💭 Claude: Analyzing your LLM infrastructure...

# Claude shows analysis
═══════════════════════════════════════════════════════════
  🤖 Claude Analysis: Infrastructure Discovery
═══════════════════════════════════════════════════════════

🔴 Problems Identified:
  1. No serving frameworks detected
  2. High monthly cost ($5,000)

✅ Suggested Solutions:
  1. Implement vLLM - $1,500/month savings
  2. Add semantic caching - $2,000/month savings

💡 Recommendations:
  • Start with serving framework
  • Monitor GPU utilization
  • Apply multi-layer optimization

═══════════════════════════════════════════════════════════

# Specific problem/solution pairs
📌 Problem Detected:
  No serving framework detected (vLLM, TensorRT, SGLang)

✨ Suggested Solution:
  Implement vLLM for 2-3x inference speedup

💰 Cost Impact: $500-2000/month savings
⏱️  Implementation Time: 3-5 days
🔧 Complexity: Medium

# Summary
✓ Runtimes: openai, anthropic
✓ Frameworks: None
✓ GPUs: 0
✓ Monthly Cost: $5,000

🚀 Next Steps:
  └ tokenop profile --events events.jsonl
  └ tokenop plan --constraints policy.yaml
```

---

## 🎓 For Developers

### Adding Claude to New Agents

```typescript
import { query } from '@anthropic-ai/claude-code';
import { ClaudeHelper } from '../../utils/claude-helper.js';

class MyNewAgent {
  async analyze() {
    // Check API key
    await ClaudeHelper.ensureApiKey();

    // Call Claude
    const claudeQuery = query({
      prompt: 'Your analysis prompt here',
      options: {
        model: 'claude-sonnet-4-5-20250929',
        maxTurns: 5,
        allowedTools: ['Read', 'Glob', 'Bash', 'Grep']
      }
    });

    // Process response
    let response = '';
    for await (const message of claudeQuery) {
      if (message.type === 'assistant') {
        response += message.message.content[0].text;
      }
    }

    // Show beautiful output
    ClaudeHelper.formatAnalysis('My Analysis', parsed);
  }
}
```

### Custom Formatting

```typescript
// Problem/Solution pair
ClaudeHelper.formatProblemSolution(
  'Your problem description',
  'Your solution description',
  {
    cost_impact: '$500/month savings',
    implementation_time: '2 days',
    complexity: 'Low'
  }
);

// Optimization opportunity
ClaudeHelper.formatOptimization({
  name: 'vLLM Migration',
  description: 'Move from Transformers to vLLM',
  current_state: 'Using HuggingFace Transformers',
  proposed_state: 'Using vLLM with continuous batching',
  savings_monthly: 1500,
  implementation_effort: '3-5 days',
  confidence: 0.85
});
```

---

## ✅ Summary

### What You Get

1. **✅ API Key Management**: Automatic checking and prompting
2. **✅ Intelligent Analysis**: Claude analyzes your entire stack
3. **✅ Problem Identification**: Finds issues automatically
4. **✅ Solution Suggestions**: Actionable recommendations
5. **✅ Beautiful Formatting**: Problem/solution pairs with details
6. **✅ Cost Estimates**: Savings potential for each solution
7. **✅ Effort Estimates**: Implementation time for each fix

### How It Works

```
User runs command
    ↓
Check API key (prompt if needed)
    ↓
Claude analyzes codebase (using Read/Glob/Bash/Grep)
    ↓
Identify problems in infrastructure
    ↓
Suggest solutions with cost/effort
    ↓
Format beautifully with colors
    ↓
Show to user with next steps
```

---

## 🎉 Example Output

Yeh hai actual output jo user dekhega:

```
$ node dist/cli.js discover

⚠️  Claude API Key Required
Enter your Anthropic API key: sk-ant-***
✓ API key validated successfully

🔍 TokenOp: Environment Discovery

  💭 Claude: Analyzing your LLM infrastructure...

═══════════════════════════════════════════════════════════
  🤖 Claude Analysis: Infrastructure Discovery
═══════════════════════════════════════════════════════════

🔴 Problems Identified:
  1. No LLM runtime libraries detected
  2. No serving frameworks detected
  3. No GPU acceleration

✅ Suggested Solutions:
  1. Add LLM Runtime Libraries
     💰 Potential Savings: Enable optimization
     🔧 Effort: 1-2 days

  2. Implement Serving Framework
     💰 Potential Savings: $1,500/month
     🔧 Effort: 3-5 days

  3. Add GPU Infrastructure
     💰 Potential Savings: Enable acceleration
     🔧 Effort: 1-2 weeks

💡 Recommendations:
  • Start with serving framework for quick wins
  • Add semantic caching next
  • Consider GPU infrastructure for scale

═══════════════════════════════════════════════════════════

✓ Environment discovery complete
✓ Discovery results saved to discovered.yaml

🚀 Next Steps:
  └ tokenop profile --events events.jsonl
  └ tokenop plan --constraints policy.yaml
  └ tokenop run --plan optimization-plan.yaml
```

---

**Perfect!** 🎉

Ab TokenOp fully Claude-powered hai with beautiful problem/solution formatting! 🚀
