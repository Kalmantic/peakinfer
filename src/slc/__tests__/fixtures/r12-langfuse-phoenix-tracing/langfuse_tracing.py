# R12 - Langfuse Observability
# Detection: langfuse SDK, Langfuse callbacks, observe decorator

from langfuse import Langfuse
from langfuse.decorators import observe, langfuse_context
from langfuse.openai import OpenAI as LangfuseOpenAI
from langfuse.callback import CallbackHandler
from openai import OpenAI
from anthropic import Anthropic
from langchain_openai import ChatOpenAI
from langchain_anthropic import ChatAnthropic
import os

# ============================================================================
# LANGFUSE CLIENT INITIALIZATION
# ============================================================================

langfuse = Langfuse(
    public_key=os.environ.get("LANGFUSE_PUBLIC_KEY"),
    secret_key=os.environ.get("LANGFUSE_SECRET_KEY"),
    host=os.environ.get("LANGFUSE_HOST", "https://cloud.langfuse.com")
)

# ============================================================================
# LANGFUSE WRAPPED OPENAI CLIENT
# ============================================================================

# Auto-instrumented OpenAI client
langfuse_openai = LangfuseOpenAI()

def langfuse_wrapped_chat(prompt: str, model: str = "gpt-4o") -> str:
    """Langfuse-wrapped OpenAI client - automatic tracing"""
    response = langfuse_openai.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": prompt}]
    )
    return response.choices[0].message.content

def langfuse_wrapped_completion(prompt: str, model: str = "gpt-3.5-turbo-instruct") -> str:
    """Langfuse-wrapped OpenAI completion"""
    response = langfuse_openai.completions.create(
        model=model,
        prompt=prompt,
        max_tokens=500
    )
    return response.choices[0].text

# ============================================================================
# LANGFUSE OBSERVE DECORATOR
# ============================================================================

@observe()
def traced_llm_call(prompt: str, model: str = "gpt-4o") -> str:
    """Function traced with @observe decorator"""
    client = OpenAI()
    response = client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": prompt}]
    )
    return response.choices[0].message.content

@observe(name="classification_chain")
def traced_classification_chain(query: str) -> dict:
    """Multi-step chain with Langfuse tracing"""
    # Step 1: Classify the query
    classification = traced_llm_call(
        f"Classify this query into one of: question, command, statement: {query}",
        model="gpt-4o-mini"
    )

    # Step 2: Process based on classification
    response = traced_llm_call(
        f"You classified this as '{classification}'. Now respond to: {query}",
        model="gpt-4o"
    )

    return {
        "classification": classification,
        "response": response
    }

@observe(as_type="generation")
def traced_generation(prompt: str) -> str:
    """Trace as generation type for token tracking"""
    client = OpenAI()
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": prompt}]
    )

    # Update observation with usage data
    langfuse_context.update_current_observation(
        usage={
            "input": response.usage.prompt_tokens,
            "output": response.usage.completion_tokens,
            "total": response.usage.total_tokens
        },
        model="gpt-4o"
    )

    return response.choices[0].message.content

# ============================================================================
# LANGFUSE WITH LANGCHAIN
# ============================================================================

def langchain_with_langfuse_callback(query: str) -> str:
    """LangChain with Langfuse callback handler"""
    handler = CallbackHandler(
        public_key=os.environ.get("LANGFUSE_PUBLIC_KEY"),
        secret_key=os.environ.get("LANGFUSE_SECRET_KEY")
    )

    llm = ChatOpenAI(
        model="gpt-4o",
        temperature=0,
        callbacks=[handler]
    )

    response = llm.invoke(query)
    handler.flush()

    return response.content

def langchain_anthropic_langfuse(query: str) -> str:
    """LangChain Anthropic with Langfuse tracing"""
    handler = CallbackHandler()

    llm = ChatAnthropic(
        model="claude-3-5-sonnet-20241022",
        callbacks=[handler]
    )

    response = llm.invoke(query)
    handler.flush()

    return response.content

# ============================================================================
# LANGFUSE MANUAL TRACING
# ============================================================================

def manual_trace_with_span(prompt: str) -> str:
    """Manual trace creation with spans"""
    trace = langfuse.trace(
        name="manual_inference",
        user_id="user_123",
        metadata={"source": "api"}
    )

    # Create a span for the LLM call
    span = trace.span(
        name="openai_call",
        input={"prompt": prompt}
    )

    client = OpenAI()
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": prompt}]
    )

    # End span with output
    span.end(
        output={"response": response.choices[0].message.content},
        metadata={
            "model": "gpt-4o",
            "tokens": {
                "prompt": response.usage.prompt_tokens,
                "completion": response.usage.completion_tokens
            }
        }
    )

    # Create generation for cost tracking
    trace.generation(
        name="gpt-4o-generation",
        model="gpt-4o",
        input=prompt,
        output=response.choices[0].message.content,
        usage={
            "input": response.usage.prompt_tokens,
            "output": response.usage.completion_tokens
        }
    )

    return response.choices[0].message.content

def manual_trace_rag_pipeline(query: str, documents: list) -> str:
    """RAG pipeline with Langfuse tracing"""
    trace = langfuse.trace(
        name="rag_pipeline",
        input={"query": query}
    )

    # Retrieval span
    retrieval_span = trace.span(name="retrieval")
    context = "\n".join(documents[:3])  # Simulate retrieval
    retrieval_span.end(output={"retrieved_docs": len(documents)})

    # Generation span
    generation_span = trace.span(name="generation")

    client = OpenAI()
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": f"Context:\n{context}"},
            {"role": "user", "content": query}
        ]
    )

    generation_span.end(
        output={"response": response.choices[0].message.content},
        metadata={"model": "gpt-4o"}
    )

    # Track generation for cost
    trace.generation(
        name="rag_generation",
        model="gpt-4o",
        usage={
            "input": response.usage.prompt_tokens,
            "output": response.usage.completion_tokens
        }
    )

    return response.choices[0].message.content

# ============================================================================
# LANGFUSE SCORES AND EVALUATION
# ============================================================================

@observe()
def traced_with_scoring(prompt: str) -> str:
    """Traced call with quality scoring"""
    response = traced_llm_call(prompt, model="gpt-4o")

    # Add score to current trace
    langfuse_context.score_current_trace(
        name="quality",
        value=0.9,
        comment="High quality response"
    )

    return response

def batch_evaluation(prompts: list[str]) -> list[str]:
    """Batch inference with Langfuse tracking"""
    results = []

    for i, prompt in enumerate(prompts):
        trace = langfuse.trace(
            name=f"batch_item_{i}",
            input={"prompt": prompt, "batch_index": i}
        )

        client = OpenAI()
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}]
        )

        trace.generation(
            name="batch_generation",
            model="gpt-4o-mini",
            input=prompt,
            output=response.choices[0].message.content,
            usage={
                "input": response.usage.prompt_tokens,
                "output": response.usage.completion_tokens
            }
        )

        results.append(response.choices[0].message.content)

    # Flush all traces
    langfuse.flush()

    return results

# ============================================================================
# LANGFUSE WITH ANTHROPIC
# ============================================================================

@observe()
def traced_anthropic_call(prompt: str) -> str:
    """Trace Anthropic calls with Langfuse"""
    client = Anthropic()

    message = client.messages.create(
        model="claude-3-5-sonnet-20241022",
        max_tokens=1024,
        messages=[{"role": "user", "content": prompt}]
    )

    # Update with usage
    langfuse_context.update_current_observation(
        usage={
            "input": message.usage.input_tokens,
            "output": message.usage.output_tokens
        },
        model="claude-3-5-sonnet-20241022"
    )

    return message.content[0].text

# Usage example
if __name__ == "__main__":
    # Wrapped client
    result = langfuse_wrapped_chat("What is Langfuse?")
    print(f"Wrapped response: {result}")

    # Decorated function
    result = traced_llm_call("Explain observability", model="gpt-4o")
    print(f"Traced response: {result}")

    # Chain
    result = traced_classification_chain("How do I use Langfuse?")
    print(f"Chain result: {result}")

    # Ensure all traces are sent
    langfuse.flush()
