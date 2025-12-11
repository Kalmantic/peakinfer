# R14 - Model Routing and Intent Classification
# Semantic Router, Intent Classification, Model Selection, Dynamic Routing

from openai import OpenAI
from anthropic import Anthropic
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain_anthropic import ChatAnthropic
from semantic_router import Route, RouteLayer
from semantic_router.encoders import OpenAIEncoder
import numpy as np
from typing import List, Dict, Callable, Optional
import json

# Initialize clients
openai_client = OpenAI()
anthropic_client = Anthropic()

# Semantic Router
def semantic_router_classify(query: str) -> str:
    """Semantic Router for intent classification"""
    encoder = OpenAIEncoder()

    # Define routes
    coding_route = Route(
        name="coding",
        utterances=[
            "write code",
            "debug this",
            "fix the bug",
            "implement function",
            "code review"
        ]
    )

    analysis_route = Route(
        name="analysis",
        utterances=[
            "analyze this data",
            "summarize the report",
            "what are the trends",
            "explain the results"
        ]
    )

    creative_route = Route(
        name="creative",
        utterances=[
            "write a story",
            "create content",
            "brainstorm ideas",
            "generate creative"
        ]
    )

    # Create route layer
    route_layer = RouteLayer(
        encoder=encoder,
        routes=[coding_route, analysis_route, creative_route]
    )

    result = route_layer(query)
    return result.name if result else "general"

def semantic_router_with_llm(query: str) -> str:
    """Route to appropriate LLM based on intent"""
    intent = semantic_router_classify(query)

    model_map = {
        "coding": "gpt-4o",
        "analysis": "claude-3-5-sonnet-20241022",
        "creative": "gpt-4o",
        "general": "gpt-4o-mini"
    }

    model = model_map.get(intent, "gpt-4o-mini")

    if "claude" in model:
        response = anthropic_client.messages.create(
            model=model,
            max_tokens=4096,
            messages=[{"role": "user", "content": query}]
        )
        return response.content[0].text
    else:
        response = openai_client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": query}]
        )
        return response.choices[0].message.content

# LLM-based Intent Classification
def llm_intent_classifier(query: str) -> str:
    """Use LLM for intent classification"""
    response = openai_client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {
                "role": "system",
                "content": """Classify the user's intent into one of these categories:
                - coding: Programming, debugging, code review
                - analysis: Data analysis, summarization, research
                - creative: Writing, brainstorming, content creation
                - factual: Questions about facts, definitions
                - conversational: Casual chat, greetings

                Return only the category name."""
            },
            {"role": "user", "content": query}
        ],
        max_tokens=20
    )
    return response.choices[0].message.content.strip().lower()

# Cost-based Router
class CostBasedRouter:
    """Route based on cost optimization"""

    def __init__(self):
        self.client = OpenAI()
        self.anthropic = Anthropic()

        # Simplified pricing ($/1M tokens)
        self.pricing = {
            "gpt-4o": {"input": 2.50, "output": 10.00},
            "gpt-4o-mini": {"input": 0.15, "output": 0.60},
            "claude-3-5-sonnet-20241022": {"input": 3.00, "output": 15.00},
            "claude-3-5-haiku-20241022": {"input": 0.80, "output": 4.00}
        }

    def estimate_complexity(self, query: str) -> str:
        """Estimate query complexity"""
        response = self.client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": "Rate the complexity of this query: low, medium, or high. Return only the rating."
                },
                {"role": "user", "content": query}
            ],
            max_tokens=10
        )
        return response.choices[0].message.content.strip().lower()

    def route(self, query: str) -> str:
        """Route to cheapest suitable model"""
        complexity = self.estimate_complexity(query)

        if complexity == "low":
            model = "gpt-4o-mini"
        elif complexity == "medium":
            model = "claude-3-5-haiku-20241022"
        else:
            model = "gpt-4o"

        if "claude" in model:
            response = self.anthropic.messages.create(
                model=model,
                max_tokens=4096,
                messages=[{"role": "user", "content": query}]
            )
            return response.content[0].text
        else:
            response = self.client.chat.completions.create(
                model=model,
                messages=[{"role": "user", "content": query}]
            )
            return response.choices[0].message.content

# Quality-based Router
class QualityBasedRouter:
    """Route based on quality requirements"""

    def __init__(self):
        self.client = OpenAI()
        self.anthropic = Anthropic()

    def route(self, query: str, quality: str = "high") -> str:
        """Route based on quality level"""
        model_tiers = {
            "highest": "gpt-4o",
            "high": "claude-3-5-sonnet-20241022",
            "medium": "gpt-4o-mini",
            "low": "gpt-4o-mini"
        }

        model = model_tiers.get(quality, "gpt-4o")

        if "claude" in model:
            response = self.anthropic.messages.create(
                model=model,
                max_tokens=4096,
                messages=[{"role": "user", "content": query}]
            )
            return response.content[0].text
        else:
            response = self.client.chat.completions.create(
                model=model,
                messages=[{"role": "user", "content": query}]
            )
            return response.choices[0].message.content

# Latency-based Router
class LatencyBasedRouter:
    """Route based on latency requirements"""

    def __init__(self):
        self.client = OpenAI()
        self.anthropic = Anthropic()

        # Approximate latency rankings (lower = faster)
        self.latency_rank = {
            "gpt-4o-mini": 1,
            "claude-3-5-haiku-20241022": 2,
            "gpt-4o": 3,
            "claude-3-5-sonnet-20241022": 4
        }

    def route(self, query: str, max_latency_ms: int = 1000) -> str:
        """Route to fastest model meeting latency requirement"""
        # Select model based on latency requirement
        if max_latency_ms < 500:
            model = "gpt-4o-mini"
        elif max_latency_ms < 1000:
            model = "claude-3-5-haiku-20241022"
        else:
            model = "gpt-4o"

        if "claude" in model:
            response = self.anthropic.messages.create(
                model=model,
                max_tokens=4096,
                messages=[{"role": "user", "content": query}]
            )
            return response.content[0].text
        else:
            response = self.client.chat.completions.create(
                model=model,
                messages=[{"role": "user", "content": query}]
            )
            return response.choices[0].message.content

# Cascade Router
class CascadeRouter:
    """Cascade through models from cheap to expensive"""

    def __init__(self):
        self.client = OpenAI()
        self.anthropic = Anthropic()
        self.models = ["gpt-4o-mini", "gpt-4o"]

    def _evaluate_response(self, response: str, query: str) -> bool:
        """Evaluate if response is satisfactory"""
        eval_response = self.client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": "Is this a complete and accurate response? Answer yes or no."
                },
                {
                    "role": "user",
                    "content": f"Query: {query}\n\nResponse: {response}"
                }
            ],
            max_tokens=10
        )
        return "yes" in eval_response.choices[0].message.content.lower()

    def route(self, query: str) -> str:
        """Cascade through models until satisfactory response"""
        for model in self.models:
            response = self.client.chat.completions.create(
                model=model,
                messages=[{"role": "user", "content": query}]
            )
            result = response.choices[0].message.content

            if self._evaluate_response(result, query):
                return result

        # Final fallback
        return result

# A/B Test Router
class ABTestRouter:
    """A/B test different models"""

    def __init__(self, model_a: str, model_b: str, split: float = 0.5):
        self.client = OpenAI()
        self.anthropic = Anthropic()
        self.model_a = model_a
        self.model_b = model_b
        self.split = split

    def route(self, query: str) -> Dict:
        """Route based on A/B split"""
        import random

        model = self.model_a if random.random() < self.split else self.model_b

        if "claude" in model:
            response = self.anthropic.messages.create(
                model=model,
                max_tokens=4096,
                messages=[{"role": "user", "content": query}]
            )
            result = response.content[0].text
        else:
            response = self.client.chat.completions.create(
                model=model,
                messages=[{"role": "user", "content": query}]
            )
            result = response.choices[0].message.content

        return {
            "model": model,
            "variant": "A" if model == self.model_a else "B",
            "response": result
        }
