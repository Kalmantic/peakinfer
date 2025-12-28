from openai import OpenAI
from anthropic import Anthropic
import os

openai_client = OpenAI()
anthropic_client = Anthropic()

PROVIDER = os.getenv("LLM_PROVIDER", "openai")

def route_completion(prompt: str, use_cache: bool = True) -> str:
    if PROVIDER == "anthropic":
        return _anthropic_completion(prompt)
    return _openai_completion(prompt)

def _openai_completion(prompt: str) -> str:
    response = openai_client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": prompt}],
        stream=True
    )
    return response.choices[0].message.content

def _anthropic_completion(prompt: str) -> str:
    response = anthropic_client.messages.create(
        model="claude-3-sonnet-20240229",
        max_tokens=1024,
        messages=[{"role": "user", "content": prompt}]
    )
    return response.content[0].text

def with_fallback(prompt: str) -> str:
    try:
        return _openai_completion(prompt)
    except Exception:
        return _anthropic_completion(prompt)
