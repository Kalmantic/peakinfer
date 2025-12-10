# R13 - Memory and Context Management
# MemGPT, Zep, LangChain Memory, Conversation History, Long-term Memory

from openai import OpenAI
from anthropic import Anthropic
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain_anthropic import ChatAnthropic
from langchain.memory import ConversationBufferMemory, ConversationSummaryMemory
from langchain.memory import VectorStoreRetrieverMemory
from langchain_community.vectorstores import FAISS
from langchain.chains import ConversationChain
import requests
from typing import List, Dict, Optional
import json

# Initialize clients
openai_client = OpenAI()
anthropic_client = Anthropic()

# Basic Conversation Memory with OpenAI
class ConversationMemory:
    """Simple conversation memory implementation"""

    def __init__(self, model: str = "gpt-4o"):
        self.client = OpenAI()
        self.model = model
        self.messages: List[Dict] = []
        self.system_prompt = "You are a helpful assistant with memory of our conversation."

    def chat(self, user_message: str) -> str:
        self.messages.append({"role": "user", "content": user_message})

        response = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": self.system_prompt},
                *self.messages
            ]
        )

        assistant_message = response.choices[0].message.content
        self.messages.append({"role": "assistant", "content": assistant_message})

        return assistant_message

    def clear(self):
        self.messages = []

# LangChain Conversation Memory
def langchain_buffer_memory_chat(query: str, memory: ConversationBufferMemory) -> str:
    """LangChain with buffer memory"""
    llm = ChatOpenAI(model="gpt-4o", temperature=0)

    chain = ConversationChain(
        llm=llm,
        memory=memory,
        verbose=False
    )

    return chain.predict(input=query)

def langchain_summary_memory_chat(query: str) -> str:
    """LangChain with summary memory"""
    llm = ChatOpenAI(model="gpt-4o", temperature=0)
    summarizer = ChatOpenAI(model="gpt-4o-mini", temperature=0)

    memory = ConversationSummaryMemory(
        llm=summarizer,
        return_messages=True
    )

    chain = ConversationChain(
        llm=llm,
        memory=memory,
        verbose=False
    )

    return chain.predict(input=query)

def langchain_vector_memory_chat(query: str, embeddings: OpenAIEmbeddings) -> str:
    """LangChain with vector store memory"""
    vectorstore = FAISS.from_texts(
        ["Initial context"],
        embeddings
    )

    memory = VectorStoreRetrieverMemory(
        retriever=vectorstore.as_retriever(search_kwargs={"k": 5})
    )

    llm = ChatOpenAI(model="gpt-4o", temperature=0)

    chain = ConversationChain(
        llm=llm,
        memory=memory,
        verbose=False
    )

    return chain.predict(input=query)

# Zep Memory
class ZepMemoryClient:
    """Zep long-term memory client"""

    def __init__(self, zep_url: str = "http://localhost:8000"):
        self.zep_url = zep_url
        self.client = OpenAI()

    def add_memory(self, session_id: str, messages: List[Dict]) -> None:
        """Add messages to Zep memory"""
        requests.post(
            f"{self.zep_url}/api/v1/sessions/{session_id}/memory",
            json={"messages": messages}
        )

    def get_memory(self, session_id: str, last_n: int = 10) -> List[Dict]:
        """Retrieve memory from Zep"""
        response = requests.get(
            f"{self.zep_url}/api/v1/sessions/{session_id}/memory",
            params={"lastn": last_n}
        )
        return response.json().get("messages", [])

    def search_memory(self, session_id: str, query: str) -> List[Dict]:
        """Search memory with semantic search"""
        response = requests.post(
            f"{self.zep_url}/api/v1/sessions/{session_id}/search",
            json={"text": query, "search_type": "similarity"}
        )
        return response.json().get("results", [])

    def chat_with_memory(self, session_id: str, user_message: str) -> str:
        """Chat with Zep memory context"""
        # Get relevant memory
        memory = self.get_memory(session_id)
        search_results = self.search_memory(session_id, user_message)

        # Build context
        memory_context = "\n".join([m["content"] for m in memory[-5:]])
        relevant_context = "\n".join([r["content"] for r in search_results[:3]])

        system_prompt = f"""You have access to conversation history and relevant memories.

Recent conversation:
{memory_context}

Relevant memories:
{relevant_context}
"""

        response = self.client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message}
            ]
        )

        result = response.choices[0].message.content

        # Save to memory
        self.add_memory(session_id, [
            {"role": "user", "content": user_message},
            {"role": "assistant", "content": result}
        ])

        return result

# MemGPT-style Hierarchical Memory
class HierarchicalMemory:
    """MemGPT-style hierarchical memory system"""

    def __init__(self):
        self.client = OpenAI()
        self.embeddings = OpenAIEmbeddings()

        # Memory tiers
        self.working_memory: List[Dict] = []  # Current context
        self.archival_memory: List[Dict] = []  # Long-term storage
        self.recall_memory: List[Dict] = []    # Recently accessed

        self.working_memory_limit = 10

    def _summarize(self, messages: List[Dict]) -> str:
        """Summarize messages for archival"""
        content = "\n".join([m["content"] for m in messages])

        response = self.client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{
                "role": "user",
                "content": f"Summarize this conversation concisely:\n{content}"
            }]
        )
        return response.choices[0].message.content

    def _archive_old_memory(self):
        """Archive old working memory"""
        if len(self.working_memory) > self.working_memory_limit:
            old_messages = self.working_memory[:-self.working_memory_limit]
            summary = self._summarize(old_messages)

            self.archival_memory.append({
                "type": "summary",
                "content": summary,
                "messages": old_messages
            })

            self.working_memory = self.working_memory[-self.working_memory_limit:]

    def _retrieve_relevant(self, query: str, k: int = 3) -> List[str]:
        """Retrieve relevant archival memories"""
        if not self.archival_memory:
            return []

        # Use embeddings for semantic search
        query_embedding = self.embeddings.embed_query(query)

        # Simplified: return recent archival memories
        return [m["content"] for m in self.archival_memory[-k:]]

    def chat(self, user_message: str) -> str:
        """Chat with hierarchical memory"""
        self._archive_old_memory()

        # Retrieve relevant memories
        relevant = self._retrieve_relevant(user_message)

        # Build context
        memory_context = ""
        if relevant:
            memory_context = "Relevant past context:\n" + "\n".join(relevant) + "\n\n"

        messages = [
            {"role": "system", "content": f"{memory_context}You are a helpful assistant with long-term memory."},
            *self.working_memory,
            {"role": "user", "content": user_message}
        ]

        response = self.client.chat.completions.create(
            model="gpt-4o",
            messages=messages
        )

        result = response.choices[0].message.content

        # Update working memory
        self.working_memory.append({"role": "user", "content": user_message})
        self.working_memory.append({"role": "assistant", "content": result})

        return result

# Anthropic with Conversation Context
def anthropic_with_memory(messages: List[Dict], new_message: str) -> str:
    """Anthropic Claude with conversation memory"""
    messages.append({"role": "user", "content": new_message})

    response = anthropic_client.messages.create(
        model="claude-3-5-sonnet-20241022",
        max_tokens=4096,
        system="You are a helpful assistant that remembers our conversation.",
        messages=messages
    )

    result = response.content[0].text
    messages.append({"role": "assistant", "content": result})

    return result

# Context Window Management
class ContextWindowManager:
    """Manage context window with smart truncation"""

    def __init__(self, max_tokens: int = 128000):
        self.client = OpenAI()
        self.max_tokens = max_tokens
        self.messages: List[Dict] = []

    def _estimate_tokens(self, text: str) -> int:
        """Estimate token count"""
        return len(text) // 4

    def _get_total_tokens(self) -> int:
        """Get total tokens in messages"""
        return sum(self._estimate_tokens(m["content"]) for m in self.messages)

    def _truncate_if_needed(self):
        """Truncate old messages if context is too long"""
        while self._get_total_tokens() > self.max_tokens * 0.8 and len(self.messages) > 2:
            # Summarize and remove old messages
            old_messages = self.messages[:2]
            summary = f"[Summary of earlier: {old_messages[0]['content'][:100]}...]"
            self.messages = [{"role": "system", "content": summary}] + self.messages[2:]

    def chat(self, user_message: str) -> str:
        self.messages.append({"role": "user", "content": user_message})
        self._truncate_if_needed()

        response = self.client.chat.completions.create(
            model="gpt-4o",
            messages=self.messages
        )

        result = response.choices[0].message.content
        self.messages.append({"role": "assistant", "content": result})

        return result
