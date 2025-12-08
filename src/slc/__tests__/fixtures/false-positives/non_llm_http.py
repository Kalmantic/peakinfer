# False Positive Test: FP-001
# OpenAI-like HTTP endpoints to non-LLM services
# These should NOT be detected as LLM callsites

import requests
import httpx

# Weather API with similar structure to OpenAI
def get_weather(city: str):
    """HTTP call that looks like OpenAI but isn't"""
    response = requests.post(
        "https://api.weather.com/v1/chat/completions",  # Similar URL pattern
        headers={"Authorization": "Bearer weather-api-key"},
        json={
            "model": "weather-v2",  # Has model field
            "messages": [{"role": "user", "content": f"Weather in {city}"}]
        }
    )
    return response.json()

# Database API with completion-like endpoint
def query_database(query: str):
    """Database query API with similar patterns"""
    response = httpx.post(
        "https://api.mydb.io/completions",
        json={
            "prompt": query,  # Has prompt field
            "max_tokens": 100  # Has max_tokens field
        }
    )
    return response.json()

# Analytics API
def get_analytics(metric: str):
    """Analytics with chat-like endpoint"""
    client = httpx.Client()
    response = client.post(
        "https://analytics.internal.com/v1/chat",
        json={"input": metric, "model": "analytics-model-v1"}
    )
    return response.json()

# Internal microservice
class ChatService:
    """Internal chat service (not LLM)"""
    def __init__(self):
        self.base_url = "https://chat.mycompany.com"

    def send_message(self, message: str):
        return requests.post(
            f"{self.base_url}/messages/create",
            json={"content": message, "model": "standard"}
        )
