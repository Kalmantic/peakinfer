# R2 - Mixed API + Neocloud
# OpenAI + Anthropic APIs + Together/Baseten endpoints

import openai
from anthropic import Anthropic
import requests
import os

# SaaS clients
openai_client = openai.OpenAI()
anthropic_client = Anthropic()

# Neocloud endpoints
TOGETHER_API_KEY = os.getenv("TOGETHER_API_KEY")
BASETEN_API_KEY = os.getenv("BASETEN_API_KEY")

def chat_openai(prompt: str) -> str:
    """OpenAI API call"""
    response = openai_client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": prompt}]
    )
    return response.choices[0].message.content

def chat_anthropic(prompt: str) -> str:
    """Anthropic API call"""
    message = anthropic_client.messages.create(
        model="claude-3-5-sonnet-20241022",
        max_tokens=1024,
        messages=[{"role": "user", "content": prompt}]
    )
    return message.content[0].text

def chat_together(prompt: str) -> str:
    """Together AI endpoint - vLLM runtime"""
    response = requests.post(
        "https://api.together.xyz/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {TOGETHER_API_KEY}",
            "Content-Type": "application/json"
        },
        json={
            "model": "meta-llama/Llama-3.1-70B-Instruct-Turbo",
            "messages": [{"role": "user", "content": prompt}]
        }
    )
    return response.json()["choices"][0]["message"]["content"]

def chat_baseten(prompt: str) -> str:
    """Baseten endpoint - TGI runtime"""
    response = requests.post(
        "https://model-abc123.api.baseten.co/production/predict",
        headers={
            "Authorization": f"Api-Key {BASETEN_API_KEY}",
            "Content-Type": "application/json"
        },
        json={
            "prompt": prompt,
            "max_tokens": 1024
        }
    )
    return response.json()["output"]

def inference_router(prompt: str, complexity: str) -> str:
    """Route to different providers based on complexity"""
    if complexity == "simple":
        return chat_together(prompt)  # Cheaper
    elif complexity == "medium":
        return chat_anthropic(prompt)
    else:
        return chat_openai(prompt)  # Most capable
