# False Positive Test: FP-005
# Static prompt templates - no inference
# These should NOT be detected as LLM callsites

from string import Template
from jinja2 import Environment, FileSystemLoader

# Static prompt templates
SYSTEM_PROMPT = """You are a helpful assistant.
Please respond to the user's query professionally."""

CHAT_TEMPLATE = """
<|system|>
{system_prompt}
<|user|>
{user_message}
<|assistant|>
"""

# Python string template
USER_PROMPT_TEMPLATE = Template("""
Given the following context:
$context

Answer this question: $question

Format: $format
""")

def format_prompt(context: str, question: str) -> str:
    """Format prompt from template"""
    return USER_PROMPT_TEMPLATE.substitute(
        context=context,
        question=question,
        format="JSON"
    )

# Jinja2 templates
env = Environment(loader=FileSystemLoader('templates'))

def render_prompt(template_name: str, **kwargs) -> str:
    """Render Jinja2 prompt template"""
    template = env.get_template(template_name)
    return template.render(**kwargs)

# Prompt storage
PROMPTS = {
    "summarize": "Summarize the following text: {text}",
    "translate": "Translate to {language}: {text}",
    "extract": "Extract {entity_type} from: {text}",
}

class PromptBuilder:
    """Build prompts without making API calls"""
    def __init__(self):
        self.messages = []

    def add_system(self, content: str):
        self.messages.append({"role": "system", "content": content})
        return self

    def add_user(self, content: str):
        self.messages.append({"role": "user", "content": content})
        return self

    def build(self) -> list:
        return self.messages.copy()
