"""
SGLang Server - Tests SGLang Runtime Detection
Patterns: @function decorator, RuntimeEndpoint, RadixAttention
"""

import sglang as sgl
from sglang import RuntimeEndpoint, set_default_backend
from typing import List, Dict, Any


# =============================================================================
# PATTERN: Basic SGLang Setup
# =============================================================================

# Initialize SGLang runtime
runtime = RuntimeEndpoint("http://localhost:30000")
set_default_backend(runtime)


# =============================================================================
# PATTERN: SGLang Function Decorator
# =============================================================================

@sgl.function
def simple_chat(s, user_message: str):
    """Simple chat completion with SGLang - should detect @sgl.function"""
    s += sgl.system("You are a helpful AI assistant.")
    s += sgl.user(user_message)
    s += sgl.assistant(sgl.gen("response", max_tokens=512))


@sgl.function
def multi_turn_chat(s, messages: List[Dict[str, str]]):
    """Multi-turn conversation with SGLang"""
    s += sgl.system("You are a helpful AI assistant.")
    
    for msg in messages:
        if msg["role"] == "user":
            s += sgl.user(msg["content"])
        else:
            s += sgl.assistant(sgl.gen("response", max_tokens=512))


# =============================================================================
# PATTERN: Parallel Generation (Fork)
# =============================================================================

@sgl.function
def parallel_generation(s, question: str, num_responses: int = 3):
    """Parallel response generation with fork - should detect batching"""
    s += sgl.system("You are a creative assistant. Provide unique perspectives.")
    s += sgl.user(question)
    
    # Fork into multiple branches for parallel generation
    forks = s.fork(num_responses)
    for i, fork in enumerate(forks):
        fork += sgl.assistant(sgl.gen(f"response_{i}", max_tokens=256, temperature=0.9))


# =============================================================================
# PATTERN: Constrained Generation
# =============================================================================

@sgl.function
def constrained_generation(s, query: str):
    """Constrained output generation"""
    s += sgl.system("You are a sentiment analyzer. Respond with only: positive, negative, or neutral.")
    s += sgl.user(f"Analyze the sentiment: {query}")
    s += sgl.assistant(sgl.gen(
        "sentiment",
        choices=["positive", "negative", "neutral"]  # Constrained choices
    ))


# =============================================================================
# PATTERN: JSON Mode Generation
# =============================================================================

@sgl.function
def json_generation(s, query: str):
    """JSON structured output generation"""
    s += sgl.system("You are a data extractor. Output valid JSON only.")
    s += sgl.user(query)
    s += sgl.assistant(sgl.gen(
        "json_output",
        max_tokens=512,
        regex=r'\{[^}]+\}'  # JSON regex constraint
    ))


# =============================================================================
# PATTERN: Chain of Thought
# =============================================================================

@sgl.function
def chain_of_thought(s, problem: str):
    """Chain of thought reasoning"""
    s += sgl.system("You are a logical reasoning assistant. Think step by step.")
    s += sgl.user(problem)
    
    # Generate reasoning steps
    s += sgl.assistant("Let me think through this step by step:\n")
    s += sgl.assistant(sgl.gen("reasoning", max_tokens=512, temperature=0.3))
    
    # Generate final answer
    s += sgl.assistant("\n\nTherefore, the answer is: ")
    s += sgl.assistant(sgl.gen("answer", max_tokens=100, temperature=0.0))


# =============================================================================
# PATTERN: RAG with SGLang
# =============================================================================

@sgl.function
def rag_generation(s, context: str, question: str):
    """RAG-style generation with context"""
    s += sgl.system("You are a helpful assistant. Answer based on the provided context only.")
    s += sgl.user(f"Context:\n{context}\n\nQuestion: {question}")
    s += sgl.assistant(sgl.gen("answer", max_tokens=512, temperature=0.2))


# =============================================================================
# PATTERN: Tool Use with SGLang
# =============================================================================

@sgl.function
def tool_use(s, query: str, available_tools: List[str]):
    """Tool selection and use"""
    tools_str = "\n".join(f"- {tool}" for tool in available_tools)
    
    s += sgl.system(f"You have access to the following tools:\n{tools_str}\n\nSelect the appropriate tool for the user's request.")
    s += sgl.user(query)
    
    # Select tool
    s += sgl.assistant("I'll use the following tool: ")
    s += sgl.assistant(sgl.gen(
        "selected_tool",
        choices=available_tools
    ))
    
    # Generate tool input
    s += sgl.assistant("\n\nTool input: ")
    s += sgl.assistant(sgl.gen("tool_input", max_tokens=256))


# =============================================================================
# PATTERN: Streaming with SGLang
# =============================================================================

async def streaming_chat(user_message: str):
    """Async streaming generation - should detect streaming pattern"""
    state = simple_chat.run(user_message=user_message, stream=True)
    
    async for chunk in state.text_iter():
        yield chunk


# =============================================================================
# PATTERN: Batch Processing
# =============================================================================

def batch_chat(messages: List[str]) -> List[str]:
    """Batch processing with SGLang - should detect batching pattern"""
    states = simple_chat.run_batch([
        {"user_message": msg} for msg in messages
    ])
    
    return [state["response"] for state in states]


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def run_simple_chat(message: str) -> str:
    """Wrapper for simple chat"""
    state = simple_chat.run(user_message=message)
    return state["response"]


def run_cot(problem: str) -> Dict[str, str]:
    """Run chain of thought and return results"""
    state = chain_of_thought.run(problem=problem)
    return {
        "reasoning": state["reasoning"],
        "answer": state["answer"]
    }


if __name__ == "__main__":
    # Test simple chat
    result = run_simple_chat("What is machine learning?")
    print(f"Result: {result}")

