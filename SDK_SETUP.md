# Anthropic SDK Setup Guide for Peakinfer

## What We Fixed

The original code was trying to use `@anthropic-ai/claude-code` which is the **Claude Code terminal tool**, not the **Anthropic AI SDK for API calls**. We fixed this by:

1. **Replaced old package** → `@anthropic-ai/claude-code` ❌ → `@anthropic-ai/sdk` ✅
2. **Updated all agent imports** across 5 files to use the proper Anthropic SDK
3. **Rewrote API calls** to use the standard `client.messages.create()` pattern

## Installation & Setup

### Step 1: Dependencies Already Installed

The `package.json` now has the correct dependency:

```json
{
  "dependencies": {
    "@anthropic-ai/sdk": "^0.20.4"
  }
}
```

Install with:
```bash
npm install
# or
yarn install
```

### Step 2: Set Your Anthropic API Key

Get your API key from: **https://console.anthropic.com/**

**Option A: Environment Variable (Recommended)**
```bash
export ANTHROPIC_API_KEY="sk-ant-..."
```

**Option B: Interactive Prompt**
The CLI will prompt for your key if not found in environment.

**Option C: Verify Your Key**
```bash
echo $ANTHROPIC_API_KEY
# Should output: sk-ant-...
```

## How the Anthropic SDK Works

### Initialization

```typescript
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});
```

### Making API Calls

```typescript
const message = await client.messages.create({
  model: 'claude-3-5-sonnet-20241022',
  max_tokens: 2048,
  messages: [
    {
      role: 'user',
      content: 'Your prompt here'
    }
  ]
});

// Extract response
for (const block of message.content) {
  if (block.type === 'text') {
    console.log(block.text);
  }
}
```

### Key Parameters

| Parameter | Example | Description |
|-----------|---------|-------------|
| `model` | `claude-3-5-sonnet-20241022` | AI model to use |
| `max_tokens` | `2048` | Maximum response length |
| `messages` | `[{role, content}]` | Conversation history |
| `system` | (optional) | System prompt for context |

## Available Claude Models

Use these model IDs in your code:

| Model | ID | Use Case |
|-------|-----|----------|
| Claude 3.5 Sonnet | `claude-3-5-sonnet-20241022` | **Recommended** - Best balance of speed/quality |
| Claude 3 Opus | `claude-3-opus-20250219` | Complex reasoning tasks |
| Claude 3 Haiku | `claude-3-haiku-20250307` | Fast, lightweight responses |

Current Peakinfer uses: **`claude-3-5-sonnet-20241022`**

## Testing Your Setup

### Quick Test

```bash
# Set your real API key
export ANTHROPIC_API_KEY="sk-ant-..."

# Run discover command
node dist/cli.js discover --output discovered.yaml
```

### Test with Sample Data

```bash
# Create sample events
cat > events.jsonl << 'EOF'
{"id":"evt-001","ts":"2025-11-14T10:00:00Z","intent":"extract_email","provider":"openai","model":"gpt-4o","input_tokens":500,"output_tokens":100,"latency_ms":150,"cost_usd":0.015,"endpoint":"api.openai.com","region":"us-east-1","tenant":"team_analytics"}
{"id":"evt-002","ts":"2025-11-14T10:01:00Z","intent":"summarize_doc","provider":"anthropic","model":"claude-3-sonnet","input_tokens":2000,"output_tokens":200,"latency_ms":300,"cost_usd":0.008,"endpoint":"api.anthropic.com","region":"us-west-2","tenant":"team_analytics"}
EOF

# Run discovery
node dist/cli.js discover --input-dir . --output discovered.yaml
```

## Error Handling

### Common Errors & Solutions

**Error**: `401 authentication_error: invalid x-api-key`
```
Solution: Your API key is wrong or not set
  1. Get key from https://console.anthropic.com/
  2. Run: export ANTHROPIC_API_KEY="sk-ant-..."
  3. Test: echo $ANTHROPIC_API_KEY
```

**Error**: `Cannot find module '@anthropic-ai/sdk'`
```
Solution: Dependencies not installed
  1. Run: npm install
  2. Or: npm install @anthropic-ai/sdk@^0.20.4
```

**Error**: `Claude Code SDK query failed`
```
Solution: Handled gracefully - uses fallback analysis
  - Check internet connection
  - Verify API key is valid
  - Check API rate limits
```

## SDK Integration in Peakinfer

### Files Using SDK

| File | Purpose |
|------|---------|
| `src/orchestration/agents/claude-discovery-agent.ts` | Infrastructure discovery |
| `src/orchestration/agents/auditor-agent.ts` | Results auditing |
| `src/orchestration/agents/workload-profiler-agent.ts` | Workload clustering |
| `src/orchestration/multi-agent-orchestrator.ts` | Agent coordination |

### How It Works

Each agent uses the same pattern:

```typescript
1. Import SDK:    import Anthropic from '@anthropic-ai/sdk'
2. Initialize:    const client = new Anthropic({apiKey})
3. Call API:      const message = await client.messages.create({...})
4. Parse:         Extract text from message.content blocks
5. Fallback:      On error, use heuristic results
```

## Cost Optimization Tips

### Token Usage

- `claude-3-5-sonnet` input tokens: **$3 per 1M**
- `claude-3-5-sonnet` output tokens: **$15 per 1M**

### Optimize Your Usage

```typescript
// ✅ Good - limiting tokens
const message = await client.messages.create({
  model: 'claude-3-5-sonnet-20241022',
  max_tokens: 1024,  // Not huge like 4000
  messages: [...]
});

// ❌ Bad - unlimited context
const message = await client.messages.create({
  model: 'claude-3-5-sonnet-20241022',
  max_tokens: 4096,  // Use only if needed
  messages: [...]
});
```

## Full Example

```typescript
import Anthropic from '@anthropic-ai/sdk';

async function analyzeInfrastructure() {
  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY
  });

  const prompt = `Analyze this infrastructure for optimization opportunities:
  - 1000 GPT-4 calls/day costing $50/day
  - Latency: 2.5 seconds average
  - Batch size: 1

  Suggest one optimization.`;

  const message = await client.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 500,
    messages: [
      {
        role: 'user',
        content: prompt
      }
    ]
  });

  for (const block of message.content) {
    if (block.type === 'text') {
      console.log('Claude suggests:', block.text);
    }
  }
}

analyzeInfrastructure().catch(console.error);
```

## Next Steps

1. ✅ Get API key from https://console.anthropic.com/
2. ✅ Set environment variable: `export ANTHROPIC_API_KEY="sk-ant-..."`
3. ✅ Build project: `npm run build`
4. ✅ Run discovery: `node dist/cli.js discover`
5. ✅ Explore all commands: `node dist/cli.js --help`

## Resources

- **Anthropic SDK Docs**: https://github.com/anthropics/anthropic-sdk-js
- **Claude API Docs**: https://docs.anthropic.com/
- **Peakinfer Docs**: See `QUICKSTART.md` and `design/` folder

## Troubleshooting

### Import Errors

If you see: `Cannot find module '@anthropic-ai/sdk'`
```bash
npm ls @anthropic-ai/sdk
npm install @anthropic-ai/sdk@^0.20.4 --save-exact
```

### Build Errors

If TypeScript complains about types:
```bash
npm install --save-dev @types/node
npm run build
```

### Runtime Errors

If the CLI crashes when calling Claude:
```bash
# Check your API key is valid
curl https://api.anthropic.com/v1/models \
  -H "x-api-key: $ANTHROPIC_API_KEY" | head
```

## Support

For issues:
1. Check ANTHROPIC_API_KEY is set: `echo $ANTHROPIC_API_KEY`
2. Verify key format: must start with `sk-ant-`
3. Test API: Run discover command with valid key
4. Check fallback works: Remove key and run again
