"""
Anthropic Service - Tests Anthropic SDK Detection
Patterns: Messages API, streaming, tool use, prompt caching
"""

from anthropic import Anthropic, AsyncAnthropic
import asyncio
from typing import List, Dict, Any

# Initialize clients
client = Anthropic()
async_client = AsyncAnthropic()


# =============================================================================
# PATTERN: Basic Message Creation
# =============================================================================

def simple_message(prompt: str) -> str:
    """Basic Anthropic message - should detect claude-sonnet-4-20250514"""
    message = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1024,
        messages=[
            {"role": "user", "content": prompt}
        ]
    )
    return message.content[0].text


# =============================================================================
# PATTERN: System Prompt
# =============================================================================

def message_with_system(prompt: str, system_prompt: str) -> str:
    """Message with system prompt"""
    message = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1024,
        system=system_prompt,
        messages=[
            {"role": "user", "content": prompt}
        ]
    )
    return message.content[0].text


# =============================================================================
# PATTERN: Streaming Response
# =============================================================================

def streaming_message(prompt: str) -> str:
    """Streaming message - should detect streaming pattern"""
    full_response = ""
    
    with client.messages.stream(
        model="claude-sonnet-4-20250514",
        max_tokens=1024,
        messages=[{"role": "user", "content": prompt}]
    ) as stream:
        for text in stream.text_stream:
            full_response += text
            print(text, end="", flush=True)
    
    return full_response


# =============================================================================
# PATTERN: Prompt Caching (Beta)
# =============================================================================

def cached_message(long_context: str, query: str) -> str:
    """Prompt caching - should detect caching pattern"""
    message = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1024,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": long_context,
                        "cache_control": {"type": "ephemeral"}  # CACHING PATTERN
                    },
                    {
                        "type": "text",
                        "text": query
                    }
                ]
            }
        ]
    )
    return message.content[0].text


# =============================================================================
# PATTERN: Tool Use / Function Calling
# =============================================================================

def tool_use_example(query: str) -> Dict[str, Any]:
    """Tool use pattern - should detect tool use"""
    tools = [
        {
            "name": "get_stock_price",
            "description": "Get the current stock price for a given ticker symbol",
            "input_schema": {
                "type": "object",
                "properties": {
                    "ticker": {
                        "type": "string",
                        "description": "The stock ticker symbol, e.g. AAPL"
                    }
                },
                "required": ["ticker"]
            }
        }
    ]
    
    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1024,
        tools=tools,
        messages=[{"role": "user", "content": query}]
    )
    
    return response


# =============================================================================
# PATTERN: Haiku for Cost Optimization (Cheaper Model)
# =============================================================================

def fast_classification(text: str) -> str:
    """Using Haiku for fast, cheap classification tasks"""
    message = client.messages.create(
        model="claude-3-5-haiku-20241022",  # Cheaper model for simple tasks
        max_tokens=50,
        messages=[
            {
                "role": "user",
                "content": f"Classify this text as positive, negative, or neutral. Only respond with the classification.\n\nText: {text}"
            }
        ]
    )
    return message.content[0].text


# =============================================================================
# PATTERN: Opus for Complex Tasks (Most Capable)
# =============================================================================

def complex_analysis(document: str) -> str:
    """Using Opus for complex reasoning tasks"""
    message = client.messages.create(
        model="claude-3-opus-20240229",  # Most capable model
        max_tokens=4096,
        messages=[
            {
                "role": "user",
                "content": f"Provide a detailed analysis of this document, including key insights, potential issues, and recommendations:\n\n{document}"
            }
        ]
    )
    return message.content[0].text


# =============================================================================
# PATTERN: Async Batch Processing
# =============================================================================

async def batch_messages(prompts: List[str]) -> List[str]:
    """Async batch processing - should detect batching pattern"""
    async def single_message(prompt: str) -> str:
        response = await async_client.messages.create(
            model="claude-3-5-haiku-20241022",
            max_tokens=500,
            messages=[{"role": "user", "content": prompt}]
        )
        return response.content[0].text
    
    # BATCHING PATTERN: asyncio.gather
    tasks = [single_message(p) for p in prompts]
    results = await asyncio.gather(*tasks)
    return results


# =============================================================================
# PATTERN: Vision/Image Analysis
# =============================================================================

def analyze_image(image_base64: str, question: str) -> str:
    """Vision analysis with Claude"""
    message = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1024,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": "image/jpeg",
                            "data": image_base64,
                        },
                    },
                    {
                        "type": "text",
                        "text": question
                    }
                ],
            }
        ],
    )
    return message.content[0].text


if __name__ == "__main__":
    result = simple_message("What is machine learning?")
    print(f"Result: {result}")

