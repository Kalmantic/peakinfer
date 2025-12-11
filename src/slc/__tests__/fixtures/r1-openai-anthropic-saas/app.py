# R1 - SaaS-Only LLM Repo
# OpenAI SDK + Anthropic SDK, CPU only

import openai
from anthropic import Anthropic

# OpenAI client setup
client = openai.OpenAI()

# Anthropic client setup
anthropic_client = Anthropic()

def chat_with_openai(prompt: str) -> str:
    """Simple OpenAI chat completion"""
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": prompt}]
    )
    return response.choices[0].message.content

def chat_with_anthropic(prompt: str) -> str:
    """Simple Anthropic chat completion"""
    message = anthropic_client.messages.create(
        model="claude-3-5-sonnet-20241022",
        max_tokens=1024,
        messages=[{"role": "user", "content": prompt}]
    )
    return message.content[0].text

def streaming_openai(prompt: str):
    """Streaming OpenAI response"""
    stream = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        stream=True
    )
    for chunk in stream:
        if chunk.choices[0].delta.content:
            yield chunk.choices[0].delta.content

def get_embedding(text: str):
    """OpenAI embedding call"""
    response = client.embeddings.create(
        model="text-embedding-3-small",
        input=text
    )
    return response.data[0].embedding
