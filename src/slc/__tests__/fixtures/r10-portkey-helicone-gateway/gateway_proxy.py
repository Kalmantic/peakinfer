# R10 - API Gateways and Proxies
# LiteLLM Proxy, Kong AI Gateway, AWS API Gateway, Portkey, Martian

from openai import OpenAI
import litellm
from litellm import completion, Router
import requests
import boto3
from typing import Optional

# LiteLLM Direct Usage
def litellm_completion(prompt: str, model: str = "gpt-4o") -> str:
    """Direct LiteLLM completion"""
    response = completion(
        model=model,
        messages=[{"role": "user", "content": prompt}]
    )
    return response.choices[0].message.content

def litellm_multi_provider(prompt: str) -> dict:
    """LiteLLM with multiple providers"""
    results = {}

    # OpenAI
    results["openai"] = completion(
        model="gpt-4o",
        messages=[{"role": "user", "content": prompt}]
    ).choices[0].message.content

    # Anthropic via LiteLLM
    results["anthropic"] = completion(
        model="claude-3-5-sonnet-20241022",
        messages=[{"role": "user", "content": prompt}]
    ).choices[0].message.content

    # Together AI via LiteLLM
    results["together"] = completion(
        model="together_ai/meta-llama/Llama-3.3-70B-Instruct-Turbo",
        messages=[{"role": "user", "content": prompt}]
    ).choices[0].message.content

    return results

# LiteLLM Proxy (OpenAI-compatible endpoint)
def litellm_proxy_completion(prompt: str, proxy_url: str = "http://localhost:8000") -> str:
    """Use LiteLLM Proxy as OpenAI-compatible gateway"""
    client = OpenAI(
        api_key="sk-proxy-key",
        base_url=f"{proxy_url}/v1"
    )

    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": prompt}]
    )
    return response.choices[0].message.content

# LiteLLM Router with Load Balancing
def litellm_router_completion(prompt: str) -> str:
    """LiteLLM Router with load balancing"""
    router = Router(
        model_list=[
            {
                "model_name": "gpt-4",
                "litellm_params": {
                    "model": "gpt-4o",
                    "api_key": "sk-xxx"
                }
            },
            {
                "model_name": "gpt-4",
                "litellm_params": {
                    "model": "azure/gpt-4",
                    "api_key": "azure-key",
                    "api_base": "https://xxx.openai.azure.com"
                }
            },
            {
                "model_name": "gpt-4",
                "litellm_params": {
                    "model": "gpt-4o",
                    "api_key": "sk-yyy"
                }
            }
        ],
        routing_strategy="least-busy"
    )

    response = router.completion(
        model="gpt-4",
        messages=[{"role": "user", "content": prompt}]
    )
    return response.choices[0].message.content

# Kong AI Gateway
def kong_gateway_completion(prompt: str, kong_url: str) -> str:
    """Kong AI Gateway proxied request"""
    response = requests.post(
        f"{kong_url}/ai-proxy/chat/completions",
        headers={
            "Authorization": "Bearer kong-api-key",
            "Content-Type": "application/json"
        },
        json={
            "model": "gpt-4o",
            "messages": [{"role": "user", "content": prompt}]
        }
    )
    return response.json()["choices"][0]["message"]["content"]

# AWS API Gateway + Lambda
def aws_gateway_completion(prompt: str, api_id: str, region: str = "us-east-1") -> str:
    """AWS API Gateway backed inference"""
    client = boto3.client('apigateway', region_name=region)

    # Invoke via API Gateway
    response = requests.post(
        f"https://{api_id}.execute-api.{region}.amazonaws.com/prod/inference",
        headers={"x-api-key": "aws-api-key"},
        json={"prompt": prompt, "model": "gpt-4o"}
    )
    return response.json()["response"]

# Portkey AI Gateway
def portkey_completion(prompt: str) -> str:
    """Portkey AI Gateway for observability and routing"""
    client = OpenAI(
        api_key="sk-xxx",
        base_url="https://api.portkey.ai/v1",
        default_headers={
            "x-portkey-api-key": "portkey-api-key",
            "x-portkey-provider": "openai"
        }
    )

    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": prompt}]
    )
    return response.choices[0].message.content

def portkey_with_fallback(prompt: str) -> str:
    """Portkey with automatic fallback"""
    client = OpenAI(
        api_key="sk-xxx",
        base_url="https://api.portkey.ai/v1",
        default_headers={
            "x-portkey-api-key": "portkey-api-key",
            "x-portkey-config": '{"strategy": {"mode": "fallback"}, "targets": [{"provider": "openai"}, {"provider": "anthropic"}]}'
        }
    )

    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": prompt}]
    )
    return response.choices[0].message.content

# Martian Gateway
def martian_model_router(prompt: str) -> str:
    """Martian intelligent model routing"""
    response = requests.post(
        "https://api.withmartian.com/v1/chat/completions",
        headers={
            "Authorization": "Bearer martian-api-key",
            "Content-Type": "application/json"
        },
        json={
            "model": "router",
            "messages": [{"role": "user", "content": prompt}],
            "router_config": {
                "max_cost": 0.01,
                "min_quality": 0.9
            }
        }
    )
    return response.json()["choices"][0]["message"]["content"]

# Custom Gateway with Caching
class CachingGateway:
    """Custom gateway with response caching"""

    def __init__(self, cache_ttl: int = 3600):
        self.client = OpenAI()
        self.cache = {}
        self.cache_ttl = cache_ttl

    def complete(self, prompt: str, model: str = "gpt-4o") -> str:
        cache_key = f"{model}:{hash(prompt)}"

        if cache_key in self.cache:
            return self.cache[cache_key]

        response = self.client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": prompt}]
        )
        result = response.choices[0].message.content

        self.cache[cache_key] = result
        return result

# Unified Gateway Interface
class UnifiedGateway:
    """Unified interface to multiple gateways"""

    def __init__(self, gateway: str = "direct"):
        self.gateway = gateway
        self.client = OpenAI()

    def complete(self, prompt: str, model: str = "gpt-4o") -> str:
        if self.gateway == "litellm":
            return litellm_completion(prompt, model)
        elif self.gateway == "portkey":
            return portkey_completion(prompt)
        else:
            response = self.client.chat.completions.create(
                model=model,
                messages=[{"role": "user", "content": prompt}]
            )
            return response.choices[0].message.content
