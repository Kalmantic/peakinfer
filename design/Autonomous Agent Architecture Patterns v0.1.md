

Here is your document **cleanly formatted for Google Docs** — with **proper heading hierarchy**, consistent spacing, clean page-break-friendly blocks, and styles that Google Docs interprets well.  
 You can **copy–paste directly** into a Doc and it will render cleanly.

---

# **Autonomous Agent Architecture Patterns**

### **Design Document: Lessons from Production AI Agents**

**Version:** 0.1  
 **Date:** December 2025  
 **Status:** Reference Document  
 **Source:** Analysis of Dexter Financial Research Agent [https://github.com/virattt/dexter](https://github.com/virattt/dexter) 

---

## **1\. Overview**

This document captures production-proven architecture patterns for building autonomous AI agents capable of complex, multi-step tasks. These patterns distill design decisions that improve scalability, maintainability, and user experience.

---

# **2\. Core Architecture Pattern: Two-Pass Execution**

## **2.1 The Problem with Single-Pass**

Traditional agent architectures:

```
Query -> LLM decides tool -> Execute -> LLM decides next tool -> ... -> Answer
```

**Issues:**

* LLM must understand all tools upfront

* Any tool changes require prompt rewrites

* Error cascades are common

* Parallelization is hard

* Debugging is opaque

---

## **2.2 Two-Pass Solution**

```
Pass 1: Planning (WHAT to do)
  Query -> LLM generates task descriptions → Execution Plan

Pass 2: Execution (HOW to do it)
  For each task:
    Description → LLM resolves to tool call → Execute → Save result
```

---

## **2.3 Benefits**

| Aspect | Single-Pass | Two-Pass |
| ----- | ----- | ----- |
| Tool Coupling | Tight | Loose |
| Parallelization | Difficult | Natural |
| Error Isolation | Poor | Good |
| Tool Changes | Prompt rewrites | Update registry only |
| Debugging | Hard | Clear phases |

---

## **2.4 Implementation Structure**

```ts
interface ExecutionPlan {
  queryId: string;
  tasks: PlannedTask[];
}

interface PlannedTask {
  id: number;
  description: string;
  subTasks: PlannedSubTask[];
}

interface PlannedSubTask {
  id: number;
  description: string; // No tool specified
}

interface ResolvedSubTask extends PlannedSubTask {
  toolName: string;
  toolArgs: Record<string, unknown>;
  status: 'pending' | 'running' | 'completed' | 'failed';
  resultPath?: string;
}
```

---

# **3\. Filesystem-Based Context Management**

## **3.1 The Memory Problem**

Agents executing many tools generate:

* Large outputs (KB–MB)

* Irrelevant partial results

* Growing in-memory state

* Long-session instability

---

## **3.2 Solution: Save to Disk, Load on Demand**

```
Tool Output → Save File → Return Pointer
                            |
                            v
                  LLM selects relevant pointers
                            |
                            v
                   Load only those files
```

---

## **3.3 Directory Structure**

```
.agent/
  context/
    <tool>_<queryId>_<hash>.json
  history/
    <queryId>.json
    index.json
  cache/
    <promptHash>.json
  config/
    settings.json
```

---

## **3.4 Context Pointer Pattern**

```ts
interface ContextPointer {
  id: number;
  filepath: string;
  toolName: string;
  toolDescription: string;
  args: Record<string, unknown>;
  queryId: string;
  sizeBytes: number;
  createdAt: string;
}
```

---

## **3.5 LLM-Based Context Selection**

```ts
async function selectRelevantContexts(query, pointers) {
  const prompt = `
Given the query, select which tool outputs are relevant.

Query: "${query}"

Available outputs:
${pointers.map(p => `[${p.id}] ${p.toolName}: ${p.toolDescription}`).join('\n')}

Format: {"ids":[0,2,5]}
  `;

  const response = await callLlm(prompt, { outputSchema: SelectionSchema });
  return pointers.filter(p => response.ids.includes(p.id));
}
```

---

## **3.6 Benefits**

* Scales to **hundreds** of tool calls

* Persistent across sessions

* Debuggable via raw files

* Efficient memory footprint

---

# **4\. Callback-Driven Architecture**

## **4.1 The Coupling Problem**

Bad pattern:

```ts
console.log('Planning...');       // UI leaking into core logic
progressBar.update();
```

---

## **4.2 Solution: Callbacks**

```ts
interface AgentCallbacks {
  onQueryStart?: (query, queryId) => void;
  onQueryComplete?: (queryId, success) => void;

  onPlanningStart?: () => void;
  onTasksPlanned?: (tasks) => void;

  onTaskStart?: (taskId) => void;
  onSubTaskStart?: (taskId, subTaskId, toolName) => void;
  onSubTaskComplete?: (taskId, subTaskId, success) => void;
  onTaskComplete?: (taskId) => void;

  onAnswerStream?: (stream) => void;

  onError?: (error, phase) => void;
}
```

---

## **4.3 Agent Implementation**

```ts
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
    } catch (e) {
      this.callbacks.onError?.(e, 'execution');
      this.callbacks.onQueryComplete?.(queryId, false);
    }
  }
}
```

---

# **5\. Streaming Results**

## **5.1 Why Stream?**

| Aspect | Batch | Streaming |
| ----- | ----- | ----- |
| Time to first token | Late | Immediate |
| Perceived latency | High | Low |
| Interruptible | No | Yes |
| Memory | High | Low |

---

## **5.2 Streaming Pattern**

```ts
async function* generateAnswer(query, contexts) {
  const prompt = buildPrompt(query, contexts);
  const stream = await llm.stream({ messages: [{ role: 'user', content: prompt }] });

  for await (const chunk of stream) {
    if (chunk.type === 'text_delta') yield chunk.text;
  }
}
```

---

# **6\. Message History Management**

## **6.1 The Token Problem**

Full past conversation is expensive.  
 Solution: **Summarize \+ Select**.

---

## **6.2 Implementation**

```ts
interface HistoryEntry {
  queryId: string;
  query: string;
  answer: string;
  summary: string;
  timestamp: string;
}
```

Only summaries (\~50 tokens) are used for selection.

---

# **7\. Tool System Design**

## **7.1 Tool Definition Pattern**

```ts
interface Tool<TInput, TOutput> {
  name: string;
  description: string;
  inputSchema: ZodSchema<TInput>;
  outputSchema: ZodSchema<TOutput>;
  execute: (input: TInput) => Promise<TOutput>;
}
```

---

## **7.2 Schema-First Design**

Clean, self-documenting tools using Zod.

---

## **7.3 Tool Registry**

```ts
class ToolRegistry {
  register(tool) { ... }
  get(name) { ... }
  execute(name, args) { ... }
  getSchemaPrompt() { ... }
}
```

---

# **8\. Error Handling Patterns**

* Retry with exponential backoff

* Graceful degradation

* Error callbacks

---

# **9\. LLM Integration Patterns**

Supports:

* Anthropic

* OpenAI

* Google

With:

* Structured Output (Zod)

* Streaming wrappers

---

# **10\. Testing Patterns**

* Full mock strategy

* Callback verification

* Integration tests with real models

---

# **11\. Configuration Pattern**

Use Zod:

```ts
const ConfigSchema = z.object({
  model: z.string().default('claude-sonnet-4'),
  contextDir: z.string().default('.agent/context'),
  parallelToolCalls: z.number().default(5),
  retryAttempts: z.number().default(3),
});
```

---

# **12\. Summary: Key Takeaways**

## **Architecture Decisions**

| Decision | Recommendation | Why |
| ----- | ----- | ----- |
| Execution Model | Two-Pass | Decouples planning from tool calls |
| Context Storage | Filesystem | Scalable \+ persistent \+ debuggable |
| UI Integration | Callbacks | Zero coupling |
| Output Delivery | Streaming | Best UX |
| History | Summaries | Token-efficient |

---

## **Code Quality Principles**

1. Strong typing

2. Single responsibility

3. Dependency injection

4. Graceful degradation

5. Observability everywhere

---

## **Anti-Patterns**

* Single-pass tool selection

* Loading everything into memory

* UI coupled to agent internals

* Full chat history injection

* No retries

* Sync-only execution

---

## **References**

* Dexter Financial Research Agent

* LangChain Agent Architectures

* Claude Code SDK

* React Ink Terminal UI

---

If you want, I can also:  
 ✅ Create a **Google Docs stylesheet** with heading presets  
 ✅ Add **diagrams** (architecture, flow, sequence)  
 ✅ Convert this into a **GitHub-ready markdown README** or **Notion template**

Would you like those?

