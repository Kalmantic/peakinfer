# False Positive Test: FP-002
# SDK imported but unused
# These should NOT be detected as LLM callsites

import openai  # Imported but never used
from anthropic import Anthropic  # Imported but never used
import groq  # Imported but never used

# Regular Python code that doesn't use LLM
def calculate_sum(a: int, b: int) -> int:
    """Simple math function"""
    return a + b

def process_data(data: list) -> list:
    """Data processing without any LLM"""
    return [x * 2 for x in data]

class DataProcessor:
    """Class that imports but doesn't use LLM SDKs"""
    def __init__(self):
        self.data = []

    def add(self, item):
        self.data.append(item)

    def get_all(self):
        return self.data

# Comment mentioning OpenAI but no actual usage
# TODO: Add OpenAI integration later
# client.chat.completions.create() <- this is in a comment
