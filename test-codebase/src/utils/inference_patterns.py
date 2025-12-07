"""
Inference Patterns - Tests Pattern Detection
Patterns: Retry, Caching, Routing, Fallback, Rate Limiting
"""

import time
import hashlib
import json
import functools
from typing import Optional, Dict, Any, List, Callable
from openai import OpenAI, RateLimitError, APIError
from anthropic import Anthropic
import redis
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type
)

# Initialize clients
openai_client = OpenAI()
anthropic_client = Anthropic()

# Redis for caching
redis_client = redis.Redis(host='localhost', port=6379, db=0)


# =============================================================================
# PATTERN: Retry with Exponential Backoff (tenacity)
# =============================================================================

@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=4, max=60),
    retry=retry_if_exception_type((RateLimitError, APIError))
)
def retry_completion(prompt: str) -> str:
    """Completion with retry logic - should detect retry pattern"""
    response = openai_client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=500
    )
    return response.choices[0].message.content


# =============================================================================
# PATTERN: Manual Retry with Backoff
# =============================================================================

def manual_retry_completion(prompt: str, max_retries: int = 3) -> str:
    """Manual retry implementation - should detect retry pattern"""
    for attempt in range(max_retries):
        try:
            response = openai_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": prompt}]
            )
            return response.choices[0].message.content
        except RateLimitError as e:
            if attempt < max_retries - 1:
                wait_time = 2 ** attempt  # Exponential backoff
                print(f"Rate limited, waiting {wait_time}s before retry...")
                time.sleep(wait_time)
            else:
                raise e


# =============================================================================
# PATTERN: Redis Caching (Exact Match)
# =============================================================================

def cached_completion(prompt: str, ttl: int = 3600) -> str:
    """Completion with Redis caching - should detect caching pattern"""
    # Generate cache key from prompt hash
    cache_key = f"llm:completion:{hashlib.md5(prompt.encode()).hexdigest()}"
    
    # Check cache first
    cached_result = redis_client.get(cache_key)
    if cached_result:
        return cached_result.decode('utf-8')
    
    # Cache miss - call API
    response = openai_client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": prompt}],
        temperature=0  # Deterministic output for caching
    )
    result = response.choices[0].message.content
    
    # Store in cache with TTL
    redis_client.setex(cache_key, ttl, result)
    
    return result


# =============================================================================
# PATTERN: In-Memory LRU Cache
# =============================================================================

@functools.lru_cache(maxsize=1000)
def lru_cached_completion(prompt: str) -> str:
    """Completion with LRU cache - should detect caching pattern"""
    response = openai_client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        temperature=0
    )
    return response.choices[0].message.content


# =============================================================================
# PATTERN: Model Routing (Cost Optimization)
# =============================================================================

def route_to_model(prompt: str, task_type: str = "general") -> str:
    """Route to appropriate model based on task - should detect routing pattern"""
    
    # Task-based routing rules
    routing_rules = {
        "classification": "gpt-4o-mini",      # Fast, cheap for simple tasks
        "extraction": "gpt-4o-mini",          # Structured extraction
        "summarization": "claude-3-5-haiku-20241022",  # Good for summarization
        "analysis": "gpt-4o",                 # Complex analysis
        "coding": "claude-sonnet-4-20250514",           # Code generation
        "general": "gpt-4o-mini"              # Default to cheaper model
    }
    
    model = routing_rules.get(task_type, "gpt-4o-mini")
    
    if model.startswith("claude"):
        # Route to Anthropic
        response = anthropic_client.messages.create(
            model=model,
            max_tokens=1024,
            messages=[{"role": "user", "content": prompt}]
        )
        return response.content[0].text
    else:
        # Route to OpenAI
        response = openai_client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": prompt}]
        )
        return response.choices[0].message.content


# =============================================================================
# PATTERN: Complexity-Based Routing
# =============================================================================

def complexity_based_routing(prompt: str) -> str:
    """Route based on prompt complexity - should detect routing pattern"""
    
    # Simple heuristics for complexity
    word_count = len(prompt.split())
    has_code = any(kw in prompt.lower() for kw in ['code', 'function', 'implement', 'debug'])
    has_analysis = any(kw in prompt.lower() for kw in ['analyze', 'compare', 'evaluate', 'reasoning'])
    
    # Routing logic
    if has_code or has_analysis or word_count > 200:
        # Complex task - use powerful model
        model = "gpt-4o"
    elif word_count < 50:
        # Simple task - use fast model
        model = "gpt-4o-mini"
    else:
        # Medium complexity
        model = "gpt-4o-mini"
    
    response = openai_client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": prompt}]
    )
    return response.choices[0].message.content


# =============================================================================
# PATTERN: Fallback Chain
# =============================================================================

def fallback_completion(prompt: str) -> str:
    """Fallback to alternative provider on error - should detect fallback pattern"""
    
    # Try primary provider (OpenAI)
    try:
        response = openai_client.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": prompt}],
            timeout=30
        )
        return response.choices[0].message.content
    
    except Exception as e:
        print(f"OpenAI failed: {e}, falling back to Anthropic...")
        
        # Fallback to Anthropic
        try:
            response = anthropic_client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=1024,
                messages=[{"role": "user", "content": prompt}]
            )
            return response.content[0].text
        
        except Exception as e2:
            print(f"Anthropic also failed: {e2}")
            raise Exception("All providers failed")


# =============================================================================
# PATTERN: Multi-Provider Fallback Chain
# =============================================================================

def multi_fallback_completion(prompt: str) -> str:
    """Multiple fallback providers - should detect fallback pattern"""
    
    providers = [
        ("openai", "gpt-4o"),
        ("anthropic", "claude-sonnet-4-20250514"),
        ("openai", "gpt-4o-mini"),  # Fallback to cheaper OpenAI
        ("anthropic", "claude-3-5-haiku-20241022")  # Final fallback
    ]
    
    last_error = None
    for provider, model in providers:
        try:
            if provider == "openai":
                response = openai_client.chat.completions.create(
                    model=model,
                    messages=[{"role": "user", "content": prompt}]
                )
                return response.choices[0].message.content
            else:
                response = anthropic_client.messages.create(
                    model=model,
                    max_tokens=1024,
                    messages=[{"role": "user", "content": prompt}]
                )
                return response.content[0].text
        except Exception as e:
            last_error = e
            print(f"Provider {provider}/{model} failed: {e}")
            continue
    
    raise Exception(f"All providers failed. Last error: {last_error}")


# =============================================================================
# PATTERN: Rate Limiting
# =============================================================================

class RateLimiter:
    """Token bucket rate limiter - should detect rate limiting pattern"""
    
    def __init__(self, requests_per_minute: int = 60):
        self.requests_per_minute = requests_per_minute
        self.tokens = requests_per_minute
        self.last_refill = time.time()
    
    def wait_if_needed(self):
        """Wait if rate limit would be exceeded"""
        current_time = time.time()
        time_passed = current_time - self.last_refill
        
        # Refill tokens
        self.tokens = min(
            self.requests_per_minute,
            self.tokens + time_passed * (self.requests_per_minute / 60)
        )
        self.last_refill = current_time
        
        if self.tokens < 1:
            wait_time = (1 - self.tokens) / (self.requests_per_minute / 60)
            time.sleep(wait_time)
            self.tokens = 1
        
        self.tokens -= 1


rate_limiter = RateLimiter(requests_per_minute=60)

def rate_limited_completion(prompt: str) -> str:
    """Completion with rate limiting - should detect rate limiting pattern"""
    rate_limiter.wait_if_needed()
    
    response = openai_client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": prompt}]
    )
    return response.choices[0].message.content


# =============================================================================
# PATTERN: Circuit Breaker
# =============================================================================

class CircuitBreaker:
    """Circuit breaker pattern for API calls"""
    
    def __init__(self, failure_threshold: int = 5, recovery_time: int = 60):
        self.failure_threshold = failure_threshold
        self.recovery_time = recovery_time
        self.failures = 0
        self.last_failure_time = None
        self.is_open = False
    
    def record_failure(self):
        self.failures += 1
        self.last_failure_time = time.time()
        if self.failures >= self.failure_threshold:
            self.is_open = True
    
    def record_success(self):
        self.failures = 0
        self.is_open = False
    
    def can_execute(self) -> bool:
        if not self.is_open:
            return True
        
        # Check if recovery time has passed
        if time.time() - self.last_failure_time >= self.recovery_time:
            self.is_open = False
            return True
        
        return False


circuit_breaker = CircuitBreaker()

def circuit_breaker_completion(prompt: str) -> str:
    """Completion with circuit breaker - should detect circuit breaker pattern"""
    if not circuit_breaker.can_execute():
        raise Exception("Circuit breaker is open")
    
    try:
        response = openai_client.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": prompt}]
        )
        circuit_breaker.record_success()
        return response.choices[0].message.content
    except Exception as e:
        circuit_breaker.record_failure()
        raise e


if __name__ == "__main__":
    # Test retry
    result = retry_completion("Hello, how are you?")
    print(f"Retry result: {result}")

