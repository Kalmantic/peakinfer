"""
OpenAI Service - Tests OpenAI SDK Detection
Patterns: Chat completion, embeddings, streaming, function calling
"""

from openai import OpenAI, AsyncOpenAI
import asyncio
from typing import List, Dict, Any
import json

# Initialize clients
client = OpenAI()
async_client = AsyncOpenAI()


# =============================================================================
# PATTERN: Basic Chat Completion
# =============================================================================

def simple_chat(prompt: str) -> str:
    """Basic chat completion - should detect gpt-4o model"""
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": "You are a helpful assistant."},
            {"role": "user", "content": prompt}
        ],
        max_tokens=500,
        temperature=0.7
    )
    return response.choices[0].message.content


# =============================================================================
# PATTERN: Streaming Response
# =============================================================================

def streaming_chat(prompt: str) -> str:
    """Streaming chat completion - should detect streaming pattern"""
    full_response = ""
    stream = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        stream=True  # STREAMING PATTERN
    )
    
    for chunk in stream:
        if chunk.choices[0].delta.content is not None:
            full_response += chunk.choices[0].delta.content
            print(chunk.choices[0].delta.content, end="", flush=True)
    
    return full_response


# =============================================================================
# PATTERN: Function Calling / Tool Use
# =============================================================================

def function_calling_example(query: str) -> Dict[str, Any]:
    """Function calling pattern - should detect tool use"""
    tools = [
        {
            "type": "function",
            "function": {
                "name": "get_weather",
                "description": "Get the current weather in a location",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "location": {"type": "string"},
                        "unit": {"type": "string", "enum": ["celsius", "fahrenheit"]}
                    },
                    "required": ["location"]
                }
            }
        }
    ]
    
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": query}],
        tools=tools,
        tool_choice="auto"
    )
    
    return response.choices[0].message


# =============================================================================
# PATTERN: Embeddings
# =============================================================================

def get_embeddings(texts: List[str]) -> List[List[float]]:
    """Embeddings generation - should detect embedding model"""
    response = client.embeddings.create(
        model="text-embedding-3-small",  # Cost-effective embedding model
        input=texts
    )
    return [e.embedding for e in response.data]


def get_large_embeddings(texts: List[str]) -> List[List[float]]:
    """Large embeddings - more expensive model"""
    response = client.embeddings.create(
        model="text-embedding-3-large",  # More expensive
        input=texts,
        dimensions=1024  # Reduced dimensions for cost savings
    )
    return [e.embedding for e in response.data]


# =============================================================================
# PATTERN: Async Batching
# =============================================================================

async def batch_completions(prompts: List[str]) -> List[str]:
    """Async batch processing - should detect batching pattern"""
    async def single_completion(prompt: str) -> str:
        response = await async_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=200
        )
        return response.choices[0].message.content
    
    # BATCHING PATTERN: asyncio.gather
    tasks = [single_completion(p) for p in prompts]
    results = await asyncio.gather(*tasks)
    return results


# =============================================================================
# PATTERN: JSON Mode
# =============================================================================

def structured_output(prompt: str) -> dict:
    """JSON mode output - structured generation"""
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": prompt}],
        response_format={"type": "json_object"}
    )
    return json.loads(response.choices[0].message.content)


# =============================================================================
# PATTERN: Vision Model
# =============================================================================

def analyze_image(image_url: str, question: str) -> str:
    """Vision model usage - should detect multimodal"""
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": question},
                    {"type": "image_url", "image_url": {"url": image_url}}
                ]
            }
        ],
        max_tokens=500
    )
    return response.choices[0].message.content


# =============================================================================
# Cost Tracking
# =============================================================================

def track_usage(response) -> Dict[str, int]:
    """Extract token usage for cost tracking"""
    return {
        "prompt_tokens": response.usage.prompt_tokens,
        "completion_tokens": response.usage.completion_tokens,
        "total_tokens": response.usage.total_tokens
    }


if __name__ == "__main__":
    # Test simple chat
    result = simple_chat("What is the capital of France?")
    print(f"Simple chat result: {result}")

