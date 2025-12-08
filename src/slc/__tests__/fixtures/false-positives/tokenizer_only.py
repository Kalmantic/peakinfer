# False Positive Test: FP-004
# Tokenizers only - no inference
# These should NOT be detected as LLM callsites

import tiktoken
from transformers import AutoTokenizer

# OpenAI tokenizer
enc = tiktoken.get_encoding("cl100k_base")
enc_gpt4 = tiktoken.encoding_for_model("gpt-4")

def count_tokens_tiktoken(text: str) -> int:
    """Count tokens using tiktoken"""
    return len(enc.encode(text))

def count_gpt4_tokens(text: str) -> int:
    """Count GPT-4 tokens"""
    return len(enc_gpt4.encode(text))

# HuggingFace tokenizer
tokenizer = AutoTokenizer.from_pretrained("meta-llama/Llama-3.1-8B")

def count_tokens_hf(text: str) -> int:
    """Count tokens using HuggingFace tokenizer"""
    return len(tokenizer.encode(text))

def truncate_to_limit(text: str, max_tokens: int = 4096) -> str:
    """Truncate text to token limit"""
    tokens = tokenizer.encode(text)
    if len(tokens) > max_tokens:
        tokens = tokens[:max_tokens]
    return tokenizer.decode(tokens)

def estimate_cost(text: str, price_per_1m: float) -> float:
    """Estimate cost without making API call"""
    num_tokens = count_tokens_tiktoken(text)
    return (num_tokens / 1_000_000) * price_per_1m

class TokenCounter:
    """Token counting utility"""
    def __init__(self, model: str = "gpt-4"):
        self.enc = tiktoken.encoding_for_model(model)

    def count(self, text: str) -> int:
        return len(self.enc.encode(text))
