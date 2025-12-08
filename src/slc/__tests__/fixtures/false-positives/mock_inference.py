# False Positive Test: FP-003
# Mock inference classes for testing
# These should NOT be detected as real LLM callsites

from unittest.mock import Mock, MagicMock, patch
import pytest

class MockOpenAI:
    """Mock OpenAI client for testing"""
    def __init__(self):
        self.chat = Mock()
        self.chat.completions = Mock()
        self.chat.completions.create = MagicMock(return_value={
            "choices": [{"message": {"content": "mocked response"}}]
        })

class MockAnthropic:
    """Mock Anthropic client for testing"""
    def __init__(self):
        self.messages = Mock()
        self.messages.create = MagicMock(return_value={
            "content": [{"text": "mocked response"}]
        })

@pytest.fixture
def mock_openai_client():
    """Pytest fixture for mocked OpenAI"""
    with patch('openai.OpenAI') as mock:
        mock.return_value.chat.completions.create.return_value = {
            "choices": [{"message": {"content": "test"}}]
        }
        yield mock

def test_llm_integration(mock_openai_client):
    """Test using mocked client"""
    # This is test code, not production LLM usage
    response = mock_openai_client.chat.completions.create(
        model="gpt-4",
        messages=[{"role": "user", "content": "test"}]
    )
    assert response is not None

class FakeLLM:
    """Fake LLM for local testing without API calls"""
    def generate(self, prompt: str) -> str:
        return f"Fake response to: {prompt}"

    def chat(self, messages: list) -> str:
        return "Fake chat response"
