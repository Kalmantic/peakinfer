# R9 - Guardrails and Safety
# NeMo Guardrails, Guardrails AI, Content Moderation, Safety Filters

from openai import OpenAI
from anthropic import Anthropic
from nemoguardrails import RailsConfig, LLMRails
from guardrails import Guard
from guardrails.hub import ToxicLanguage, PIIFilter, RegexMatch
from langchain_openai import ChatOpenAI
import json

# Initialize clients
openai_client = OpenAI()
anthropic_client = Anthropic()

# OpenAI Moderation API
def openai_moderation_check(text: str) -> dict:
    """Check content with OpenAI Moderation API"""
    response = openai_client.moderations.create(input=text)
    return {
        "flagged": response.results[0].flagged,
        "categories": response.results[0].categories.model_dump()
    }

def safe_completion_with_moderation(prompt: str) -> str:
    """Generate completion with pre and post moderation"""
    # Pre-check input
    input_check = openai_moderation_check(prompt)
    if input_check["flagged"]:
        return "Input flagged for policy violation"

    # Generate response
    response = openai_client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": prompt}]
    )
    output = response.choices[0].message.content

    # Post-check output
    output_check = openai_moderation_check(output)
    if output_check["flagged"]:
        return "Response flagged for policy violation"

    return output

# NeMo Guardrails
def nemo_guardrails_chat(query: str, rails_config_path: str) -> str:
    """NeMo Guardrails protected chat"""
    config = RailsConfig.from_path(rails_config_path)
    rails = LLMRails(config)

    response = rails.generate(messages=[{
        "role": "user",
        "content": query
    }])

    return response["content"]

def nemo_with_custom_rails(query: str) -> str:
    """NeMo with inline rails configuration"""
    yaml_config = """
    models:
      - type: main
        engine: openai
        model: gpt-4o

    rails:
      input:
        flows:
          - check jailbreak
          - check toxicity
      output:
        flows:
          - check hallucination
          - check factual accuracy
    """

    colang_content = """
    define user express greeting
        "hello"
        "hi"
        "hey"

    define bot express greeting
        "Hello! How can I help you today?"

    define flow greeting
        user express greeting
        bot express greeting
    """

    config = RailsConfig.from_content(
        yaml_content=yaml_config,
        colang_content=colang_content
    )
    rails = LLMRails(config)

    return rails.generate(messages=[{"role": "user", "content": query}])["content"]

# Guardrails AI
def guardrails_validated_output(prompt: str) -> dict:
    """Generate output with Guardrails AI validation"""
    guard = Guard().use_many(
        ToxicLanguage(threshold=0.8, on_fail="exception"),
        PIIFilter(on_fail="fix"),
        RegexMatch(regex=r"^[^<>]*$", on_fail="reask")
    )

    response = openai_client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": prompt}]
    )

    validated = guard.validate(response.choices[0].message.content)
    return {
        "output": validated.validated_output,
        "validation_passed": validated.validation_passed
    }

def guardrails_structured_output(prompt: str, output_schema: dict) -> dict:
    """Generate structured output with Guardrails AI"""
    from guardrails import Guard
    from pydantic import BaseModel

    class ResponseSchema(BaseModel):
        summary: str
        confidence: float
        sources: list[str]

    guard = Guard.from_pydantic(ResponseSchema)

    raw_response = openai_client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": prompt}]
    )

    validated = guard.validate(raw_response.choices[0].message.content)
    return validated.validated_output

# Anthropic Constitutional AI Style
def anthropic_with_critique(prompt: str) -> str:
    """Anthropic response with self-critique"""
    # Initial response
    initial = anthropic_client.messages.create(
        model="claude-3-5-sonnet-20241022",
        max_tokens=2048,
        messages=[{"role": "user", "content": prompt}]
    )

    # Self-critique
    critique_prompt = f"""Review this response for:
    1. Factual accuracy
    2. Potential harms
    3. Bias
    4. Completeness

    Original response: {initial.content[0].text}

    Provide a revised response if needed."""

    revised = anthropic_client.messages.create(
        model="claude-3-5-sonnet-20241022",
        max_tokens=2048,
        messages=[{"role": "user", "content": critique_prompt}]
    )

    return revised.content[0].text

# Custom Content Filter
def content_filter_pipeline(text: str) -> dict:
    """Multi-stage content filtering pipeline"""
    # Stage 1: OpenAI moderation
    mod_result = openai_moderation_check(text)

    # Stage 2: PII detection via LLM
    pii_check = openai_client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{
            "role": "system",
            "content": "Detect any PII in the text. Return JSON with 'has_pii' boolean and 'pii_types' array."
        }, {
            "role": "user",
            "content": text
        }],
        response_format={"type": "json_object"}
    )
    pii_result = json.loads(pii_check.choices[0].message.content)

    return {
        "moderation": mod_result,
        "pii": pii_result,
        "safe": not mod_result["flagged"] and not pii_result.get("has_pii", False)
    }

# Rate Limited Safe Client
class SafeOpenAIClient:
    """OpenAI client with built-in guardrails"""

    def __init__(self):
        self.client = OpenAI()
        self.max_tokens = 4096
        self.blocked_topics = ["illegal", "harmful"]

    def generate(self, prompt: str) -> str:
        # Pre-check
        if any(topic in prompt.lower() for topic in self.blocked_topics):
            return "Request blocked by content policy"

        # Moderation check
        mod = self.client.moderations.create(input=prompt)
        if mod.results[0].flagged:
            return "Content flagged by moderation"

        # Generate with limits
        response = self.client.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=self.max_tokens
        )

        return response.choices[0].message.content
