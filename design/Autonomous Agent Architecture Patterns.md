# Autonomous Agent Architecture Patterns

## Design Document: Lessons from Production AI Agents

**Version**: 1.0
**Date**: December 2024
**Status**: Reference Document
**Source**: Analysis of Dexter Financial Research Agent

---

## 1. Overview

This document captures proven architecture patterns for building autonomous AI agents that perform complex, multi-step tasks. These patterns are derived from analyzing production-grade agent implementations and distill the key design decisions that enable scalability, maintainability, and excellent user experience.

---

## 2. Core Architecture Pattern: Two-Pass Execution

### 2.1 The Problem with Single-Pass

Traditional agent architectures use a single pass:
```
Query -> LLM decides tool -> Execute -> LLM decides next tool -> ... -> Answer
```

**Issues**:
- LLM must understand all tools upfront
- Tool changes require prompt rewrites
- Errors in tool selection cascade through execution
- Hard to parallelize

### 2.2 Two-Pass Solution

```
Pass 1: Planning (What to do)
  Query -> LLM generates task descriptions -> Execution Plan

Pass 2: Execution (How to do it)
  For each task:
    Description -> LLM resolves to tool call -> Execute -> Save result
```

### 2.3 Benefits

| Aspect | Single-Pass | Two-Pass |
|--------|-------------|----------|
| Tool coupling | Tight | Loose |
| Parallelization | Difficult | Natural |
| Error isolation | Poor | Good |
| Tool changes | Requires prompt changes | Just update tool registry |
| Debugging | Hard to trace | Clear phases |

### 2.4 Implementation Structure

```typescript
// Planning Pass Output
interface ExecutionPlan {
  queryId: string;
  tasks: PlannedTask[];
}

interface PlannedTask {
  id: number;
  description: string;      // Human-readable goal
  subTasks: PlannedSubTask[];
}

interface PlannedSubTask {
  id: number;
  description: string;      // What data to fetch (NO tool specified)
}

// Execution Pass Resolution
interface ResolvedSubTask extends PlannedSubTask {
  toolName: string;
  toolArgs: Record<string, unknown>;
  status: 'pending' | 'running' | 'completed' | 'failed';
  resultPath?: string;
}
```

---

## 3. Filesystem-Based Context Management

### 3.1 The Memory Problem

Agents that execute multiple tools accumulate data:
- Tool outputs can be large (KB to MB)
- Not all outputs are relevant to final answer
- Memory grows linearly with tool calls
- Long sessions become impractical

### 3.2 Solution: Save to Disk, Load on Demand

```
Execute Tool -> Save to Filesystem -> Create Lightweight Pointer
                                              |
                                              v
                              Select Relevant Pointers (LLM)
                                              |
                                              v
                              Load Only Selected Data
```

### 3.3 Directory Structure Pattern

```
.agent/
├── context/                    # Tool outputs
│   ├── <tool>_<queryId>_<hash>.json
│   └── ...
├── history/                    # Conversation history
│   ├── <queryId>.json
│   └── index.json
├── cache/                      # LLM response cache
│   └── <promptHash>.json
└── config/                     # Settings
    └── settings.json
```

### 3.4 Context Pointer Pattern

Instead of storing full results in memory:

```typescript
interface ContextPointer {
  id: number;
  filepath: string;           // Where data is stored
  toolName: string;           // Which tool produced it
  toolDescription: string;    // Human-readable summary
  args: Record<string, unknown>;
  queryId: string;            // Links to specific query
  sizeBytes: number;          // For memory estimation
  createdAt: string;
}
```

### 3.5 LLM-Based Context Selection

```typescript
async function selectRelevantContexts(
  query: string,
  pointers: ContextPointer[]
): Promise<ContextPointer[]> {
  const prompt = `
Given the query, select which tool outputs are relevant.

Query: "${query}"

Available outputs:
${pointers.map(p => `[${p.id}] ${p.toolName}: ${p.toolDescription}`).join('\n')}

Return IDs of relevant outputs.
Format: {"ids": [0, 2, 5]}
`;

  const response = await callLlm(prompt, { outputSchema: SelectionSchema });
  return pointers.filter(p => response.ids.includes(p.id));
}
```

### 3.6 Benefits

- **Scalability**: Handle hundreds of tool calls
- **Persistence**: Results available across sessions
- **Debuggability**: Inspect saved files directly
- **Efficiency**: Only load what's needed

---

## 4. Callback-Driven Architecture

### 4.1 The Coupling Problem

Tight coupling between agent logic and UI:
```typescript
// Bad: Agent knows about UI
class Agent {
  async run(query: string) {
    console.log('Planning...');           // UI in agent
    const plan = await this.plan(query);
    this.progressBar.update(50);          // UI in agent
    // ...
  }
}
```

### 4.2 Solution: Event Callbacks

```typescript
interface AgentCallbacks {
  // Lifecycle
  onQueryStart?: (query: string, queryId: string) => void;
  onQueryComplete?: (queryId: string, success: boolean) => void;

  // Planning
  onPlanningStart?: () => void;
  onTasksPlanned?: (tasks: PlannedTask[]) => void;

  // Execution
  onTaskStart?: (taskId: number) => void;
  onSubTaskStart?: (taskId: number, subTaskId: number, toolName: string) => void;
  onSubTaskComplete?: (taskId: number, subTaskId: number, success: boolean) => void;
  onTaskComplete?: (taskId: number) => void;

  // Output
  onAnswerStream?: (stream: AsyncGenerator<string>) => void;

  // Errors
  onError?: (error: Error, phase: string) => void;
}
```

### 4.3 Agent Implementation

```typescript
class Agent {
  constructor(private callbacks: AgentCallbacks = {}) {}

  async run(query: string) {
    const queryId = generateId();
    this.callbacks.onQueryStart?.(query, queryId);

    try {
      this.callbacks.onPlanningStart?.();
      const plan = await this.plan(query);
      this.callbacks.onTasksPlanned?.(plan.tasks);

      for (const task of plan.tasks) {
        this.callbacks.onTaskStart?.(task.id);
        await this.executeTask(task);
        this.callbacks.onTaskComplete?.(task.id);
      }

      const stream = await this.generateAnswer(query);
      this.callbacks.onAnswerStream?.(stream);

      this.callbacks.onQueryComplete?.(queryId, true);
    } catch (error) {
      this.callbacks.onError?.(error, 'execution');
      this.callbacks.onQueryComplete?.(queryId, false);
    }
  }
}
```

### 4.4 UI Integration Examples

**CLI (React + Ink)**:
```typescript
const callbacks: AgentCallbacks = {
  onTasksPlanned: (tasks) => setState({ tasks }),
  onSubTaskComplete: (tid, sid, ok) => updateStatus(tid, sid, ok),
  onAnswerStream: (s) => setStream(s),
};
```

**Web (React)**:
```typescript
const callbacks: AgentCallbacks = {
  onTasksPlanned: (tasks) => dispatch({ type: 'TASKS_PLANNED', tasks }),
  onAnswerStream: (s) => streamToComponent(s),
};
```

**Logging**:
```typescript
const callbacks: AgentCallbacks = {
  onSubTaskStart: (t, s, tool) => logger.info(`Starting ${tool}`),
  onError: (e, phase) => logger.error(`Error in ${phase}`, e),
};
```

### 4.5 Benefits

- **Decoupling**: Agent logic is UI-agnostic
- **Testability**: Mock callbacks for unit tests
- **Flexibility**: Same agent, different UIs
- **Observability**: Easy to add logging/metrics

---

## 5. Streaming Results

### 5.1 Why Stream?

| Aspect | Batch | Streaming |
|--------|-------|-----------|
| Time to first token | Full generation time | Immediate |
| Perceived latency | High | Low |
| Interruptibility | None | Can stop early |
| Memory | Full response in memory | Chunked |

### 5.2 Implementation Pattern

```typescript
async function* generateAnswer(
  query: string,
  contexts: LoadedContext[]
): AsyncGenerator<string> {
  const prompt = buildPrompt(query, contexts);

  const stream = await llm.stream({
    messages: [{ role: 'user', content: prompt }],
  });

  for await (const chunk of stream) {
    if (chunk.type === 'text_delta') {
      yield chunk.text;
    }
  }
}

// Consumer
async function consumeStream(stream: AsyncGenerator<string>): Promise<string> {
  let full = '';
  for await (const chunk of stream) {
    process.stdout.write(chunk);  // Real-time display
    full += chunk;
  }
  return full;
}
```

### 5.3 Callback Integration

```typescript
interface AgentCallbacks {
  onAnswerStream?: (stream: AsyncGenerator<string>) => void;
}

// Agent
const stream = generateAnswer(query, contexts);
this.callbacks.onAnswerStream?.(stream);

// UI consumes at its own pace
for await (const chunk of stream) {
  appendToDisplay(chunk);
}
```

---

## 6. Message History Management

### 6.1 The Token Problem

Full conversation history grows unbounded:
```
Turn 1: 500 tokens
Turn 2: 500 + 500 = 1000 tokens
Turn 3: 1000 + 500 = 1500 tokens
...
Turn 10: 5000+ tokens just for history
```

### 6.2 Solution: Summarize and Select

```
Save Turn:
  Query + Answer -> LLM Summary -> Store all three

Load for New Query:
  Summaries -> LLM selects relevant -> Load only selected
```

### 6.3 Implementation

```typescript
interface HistoryEntry {
  queryId: string;
  query: string;
  answer: string;
  summary: string;      // LLM-generated, ~50 tokens
  timestamp: string;
}

class MessageHistory {
  async save(queryId: string, query: string, answer: string): Promise<void> {
    const summary = await this.summarize(query, answer);
    await this.store({ queryId, query, answer, summary, timestamp: now() });
  }

  async getRelevant(currentQuery: string, max: number = 3): Promise<HistoryEntry[]> {
    const all = await this.loadAll();

    const prompt = `
Current query: "${currentQuery}"

Previous conversations:
${all.map((e, i) => `[${i}] ${e.summary}`).join('\n')}

Which previous conversations are relevant? Return up to ${max} IDs.
`;

    const selected = await callLlm(prompt, { outputSchema: SelectionSchema });
    return all.filter((_, i) => selected.ids.includes(i));
  }

  private async summarize(query: string, answer: string): Promise<string> {
    return callLlm(`Summarize in one sentence:\nQ: ${query}\nA: ${answer}`);
  }
}
```

### 6.4 Benefits

- **Token Efficiency**: ~50 tokens per turn instead of full history
- **Relevance**: Only include what matters for current query
- **Scalability**: Handle long conversations without bloat

---

## 7. Tool System Design

### 7.1 Tool Definition Pattern

```typescript
interface Tool<TInput, TOutput> {
  name: string;
  description: string;
  inputSchema: ZodSchema<TInput>;
  outputSchema: ZodSchema<TOutput>;
  execute: (input: TInput) => Promise<TOutput>;
}
```

### 7.2 Schema-First Design

```typescript
const searchTool: Tool<SearchInput, SearchOutput> = {
  name: 'search',
  description: 'Search documents by query',

  inputSchema: z.object({
    query: z.string().describe('Search query'),
    limit: z.number().default(10).describe('Max results'),
    filters: z.object({
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
    }).optional(),
  }),

  outputSchema: z.object({
    results: z.array(z.object({
      id: z.string(),
      title: z.string(),
      snippet: z.string(),
      score: z.number(),
    })),
    totalCount: z.number(),
  }),

  execute: async (input) => {
    // Implementation
  },
};
```

### 7.3 Tool Schema in Prompts

Generate tool documentation for LLM:

```typescript
function formatToolsForPrompt(tools: Tool<any, any>[]): string {
  return tools.map(t => `
- ${t.name}: ${t.description}
  Parameters:
${formatZodSchema(t.inputSchema)}
`).join('\n');
}

// Output:
// - search: Search documents by query
//   Parameters:
//     - query: string (required) - Search query
//     - limit: number (default: 10) - Max results
//     - filters: object (optional)
//       - dateFrom: string (optional)
//       - dateTo: string (optional)
```

### 7.4 Tool Registry

```typescript
class ToolRegistry {
  private tools = new Map<string, Tool<any, any>>();

  register(tool: Tool<any, any>): void {
    this.tools.set(tool.name, tool);
  }

  get(name: string): Tool<any, any> | undefined {
    return this.tools.get(name);
  }

  async execute(name: string, args: unknown): Promise<unknown> {
    const tool = this.tools.get(name);
    if (!tool) throw new Error(`Unknown tool: ${name}`);

    const validated = tool.inputSchema.parse(args);
    return tool.execute(validated);
  }

  getSchemaPrompt(): string {
    return formatToolsForPrompt([...this.tools.values()]);
  }
}
```

---

## 8. Error Handling Patterns

### 8.1 Retry with Exponential Backoff

```typescript
async function withRetry<T>(
  fn: () => Promise<T>,
  options: { maxAttempts?: number; baseDelayMs?: number } = {}
): Promise<T> {
  const { maxAttempts = 3, baseDelayMs = 500 } = options;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxAttempts - 1) throw error;
      await sleep(baseDelayMs * Math.pow(2, attempt));
    }
  }
  throw new Error('Unreachable');
}
```

### 8.2 Graceful Degradation

```typescript
async function selectContexts(query: string, pointers: ContextPointer[]) {
  try {
    return await llmSelectContexts(query, pointers);
  } catch (error) {
    // Fallback: return all (less efficient but works)
    console.warn('Selection failed, using all contexts');
    return pointers;
  }
}
```

### 8.3 Error Callbacks

```typescript
interface AgentCallbacks {
  onError?: (error: Error, phase: string) => void;
  onWarning?: (message: string) => void;
}

// Usage
try {
  await executeTool(tool, args);
} catch (error) {
  this.callbacks.onError?.(error, 'tool_execution');
  // Decide: retry, skip, or fail
}
```

---

## 9. LLM Integration Patterns

### 9.1 Multi-Provider Support

```typescript
type ModelProvider = 'anthropic' | 'openai' | 'google';

function getProvider(model: string): ModelProvider {
  if (model.startsWith('claude')) return 'anthropic';
  if (model.startsWith('gpt') || model.startsWith('o1')) return 'openai';
  if (model.startsWith('gemini')) return 'google';
  throw new Error(`Unknown model: ${model}`);
}

async function callLlm(prompt: string, options: LlmOptions): Promise<string> {
  const provider = getProvider(options.model);

  switch (provider) {
    case 'anthropic':
      return callAnthropic(prompt, options);
    case 'openai':
      return callOpenAI(prompt, options);
    case 'google':
      return callGoogle(prompt, options);
  }
}
```

### 9.2 Structured Output with Zod

```typescript
async function callLlmStructured<T>(
  prompt: string,
  schema: ZodSchema<T>,
  options: LlmOptions
): Promise<T> {
  const response = await callLlm(prompt, {
    ...options,
    responseFormat: 'json',
  });

  const parsed = JSON.parse(response);
  return schema.parse(parsed);
}

// Usage
const plan = await callLlmStructured(
  planningPrompt,
  ExecutionPlanSchema,
  { model: 'claude-sonnet-4-5-20250929' }
);
```

### 9.3 Streaming Wrapper

```typescript
async function* callLlmStream(
  prompt: string,
  options: LlmOptions
): AsyncGenerator<string> {
  const provider = getProvider(options.model);

  switch (provider) {
    case 'anthropic': {
      const stream = await anthropic.messages.stream({...});
      for await (const event of stream) {
        if (event.type === 'content_block_delta') {
          yield event.delta.text;
        }
      }
      break;
    }
    // ... other providers
  }
}
```

---

## 10. Testing Patterns

### 10.1 Mocking Strategy

```typescript
// Mock all external dependencies
jest.mock('./llm');
jest.mock('./tools');
jest.mock('./context');

describe('Agent', () => {
  beforeEach(() => {
    mockCallLlm.mockReset();
    mockExecuteTool.mockReset();
  });

  it('plans tasks correctly', async () => {
    mockCallLlm.mockResolvedValueOnce({ tasks: [mockTask] });

    const callbacks = createMockCallbacks();
    const agent = new Agent({ callbacks });

    await agent.run('Test query');

    expect(callbacks.onTasksPlanned).toHaveBeenCalledWith([mockTask]);
  });
});
```

### 10.2 Callback Verification

```typescript
function createMockCallbacks(): AgentCallbacks {
  return {
    onQueryStart: jest.fn(),
    onTasksPlanned: jest.fn(),
    onSubTaskStart: jest.fn(),
    onSubTaskComplete: jest.fn(),
    onAnswerStream: jest.fn(),
    onError: jest.fn(),
  };
}

it('fires callbacks in correct order', async () => {
  const callbacks = createMockCallbacks();
  const agent = new Agent({ callbacks });

  await agent.run('Query');

  expect(callbacks.onQueryStart).toHaveBeenCalledBefore(callbacks.onTasksPlanned);
  expect(callbacks.onTasksPlanned).toHaveBeenCalledBefore(callbacks.onSubTaskStart);
});
```

### 10.3 Integration Tests

```typescript
describe('Agent Integration', () => {
  it('handles real query end-to-end', async () => {
    const agent = new Agent({ model: 'claude-sonnet-4-5-20250929' });

    let answer = '';
    const stream = await agent.run('Simple test query');
    for await (const chunk of stream) {
      answer += chunk;
    }

    expect(answer).toBeTruthy();
    expect(answer.length).toBeGreaterThan(0);
  });
});
```

---

## 11. Configuration Pattern

```typescript
const ConfigSchema = z.object({
  // LLM
  model: z.string().default('claude-sonnet-4-5-20250929'),
  maxTokens: z.number().default(4096),
  temperature: z.number().default(0),

  // Context
  contextDir: z.string().default('.agent/context'),
  maxContextsPerQuery: z.number().default(20),

  // History
  historyDir: z.string().default('.agent/history'),
  maxHistoryEntries: z.number().default(100),

  // Execution
  parallelToolCalls: z.number().default(5),
  toolTimeoutMs: z.number().default(30000),
  retryAttempts: z.number().default(3),

  // Features
  streamingEnabled: z.boolean().default(true),
  verboseMode: z.boolean().default(false),
});

type Config = z.infer<typeof ConfigSchema>;
```

---

## 12. Summary: Key Takeaways

### Architecture Decisions

| Decision | Recommendation | Rationale |
|----------|---------------|-----------|
| Execution model | Two-pass | Decouples planning from tool resolution |
| Context storage | Filesystem | Scales, persists, debuggable |
| UI integration | Callbacks | Decouples agent from presentation |
| Output delivery | Streaming | Better UX, interruptible |
| History management | Summarize + Select | Token efficient |

### Code Quality Principles

1. **Strong Typing**: Use Zod for runtime validation + TypeScript
2. **Single Responsibility**: One class/function per concern
3. **Dependency Injection**: No global state, explicit dependencies
4. **Graceful Degradation**: Fallbacks for non-critical failures
5. **Observability**: Rich callbacks for monitoring

### Anti-Patterns to Avoid

- Tight coupling between agent and UI
- Loading all context into memory
- Including full conversation history
- Single-pass tool resolution
- Synchronous-only execution
- No retry logic for API calls

---

## References

- Dexter Financial Research Agent
- LangChain Agent Architectures
- Claude Code SDK Documentation
- React Ink for Terminal UIs
