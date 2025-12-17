"""
LangChain Agent - Tests Orchestration Framework Detection
Patterns: LLMChain, RAG, Agents, Memory, Chains
"""

from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain_anthropic import ChatAnthropic
from langchain_community.vectorstores import Chroma, FAISS
from langchain.chains import LLMChain, RetrievalQA, ConversationalRetrievalChain
from langchain.prompts import ChatPromptTemplate, PromptTemplate
from langchain.memory import ConversationBufferMemory, ConversationSummaryMemory
from langchain.agents import AgentExecutor, create_openai_tools_agent
from langchain.tools import Tool
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnablePassthrough
from typing import List, Dict, Any


# =============================================================================
# PATTERN: Basic LLM Chain
# =============================================================================

# Initialize LLMs
openai_llm = ChatOpenAI(model="gpt-4o", temperature=0.7)
anthropic_llm = ChatAnthropic(model="claude-sonnet-4-20250514")

# Basic prompt template
prompt_template = ChatPromptTemplate.from_messages([
    ("system", "You are a helpful assistant that provides concise answers."),
    ("user", "{question}")
])

# Simple chain
simple_chain = prompt_template | openai_llm | StrOutputParser()


def ask_question(question: str) -> str:
    """Simple LLM chain invocation"""
    return simple_chain.invoke({"question": question})


# =============================================================================
# PATTERN: RAG (Retrieval Augmented Generation)
# =============================================================================

# Embeddings for RAG
embeddings = OpenAIEmbeddings(model="text-embedding-3-small")

def create_rag_chain(documents: List[str]) -> RetrievalQA:
    """Create a RAG chain with vector store"""
    # Create vector store from documents
    vectorstore = Chroma.from_texts(
        texts=documents,
        embedding=embeddings
    )
    
    # Create retriever
    retriever = vectorstore.as_retriever(search_kwargs={"k": 3})
    
    # Create RAG chain
    rag_chain = RetrievalQA.from_chain_type(
        llm=openai_llm,
        chain_type="stuff",
        retriever=retriever,
        return_source_documents=True
    )
    
    return rag_chain


# =============================================================================
# PATTERN: Conversational Memory
# =============================================================================

# Memory for conversation history
memory = ConversationBufferMemory(
    memory_key="chat_history",
    return_messages=True
)

def create_conversational_chain():
    """Chain with conversation memory - should detect memory pattern"""
    prompt = ChatPromptTemplate.from_messages([
        ("system", "You are a helpful assistant. Use the conversation history to provide context-aware responses."),
        ("placeholder", "{chat_history}"),
        ("user", "{question}")
    ])
    
    chain = LLMChain(
        llm=openai_llm,
        prompt=prompt,
        memory=memory,
        verbose=True
    )
    
    return chain


# =============================================================================
# PATTERN: Agent with Tools
# =============================================================================

def search_tool(query: str) -> str:
    """Mock search tool"""
    return f"Search results for: {query}"

def calculator_tool(expression: str) -> str:
    """Mock calculator tool"""
    try:
        result = eval(expression)
        return str(result)
    except:
        return "Error evaluating expression"

# Define tools
tools = [
    Tool(
        name="Search",
        func=search_tool,
        description="Search the web for information"
    ),
    Tool(
        name="Calculator",
        func=calculator_tool,
        description="Perform mathematical calculations"
    )
]

def create_agent():
    """Create an agent with tools - should detect agent pattern"""
    prompt = ChatPromptTemplate.from_messages([
        ("system", "You are a helpful assistant with access to tools."),
        ("user", "{input}"),
        ("placeholder", "{agent_scratchpad}")
    ])
    
    agent = create_openai_tools_agent(
        llm=openai_llm,
        tools=tools,
        prompt=prompt
    )
    
    agent_executor = AgentExecutor(
        agent=agent,
        tools=tools,
        verbose=True
    )
    
    return agent_executor


# =============================================================================
# PATTERN: LCEL (LangChain Expression Language)
# =============================================================================

def create_lcel_chain():
    """Modern LCEL chain syntax"""
    template = """Answer the question based on the following context:
    
    Context: {context}
    
    Question: {question}
    
    Answer:"""
    
    prompt = PromptTemplate.from_template(template)
    
    # LCEL chain composition
    chain = (
        {"context": RunnablePassthrough(), "question": RunnablePassthrough()}
        | prompt
        | anthropic_llm
        | StrOutputParser()
    )
    
    return chain


# =============================================================================
# PATTERN: Multiple Model Chain (Routing)
# =============================================================================

def create_routing_chain():
    """Chain that routes between models - should detect routing pattern"""
    # Fast model for simple queries
    fast_llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
    
    # Powerful model for complex queries
    powerful_llm = ChatAnthropic(model="claude-sonnet-4-20250514")
    
    def route_query(query: str) -> Any:
        """Route query to appropriate model based on complexity"""
        # Simple heuristic: longer queries go to more powerful model
        if len(query.split()) > 50:
            return powerful_llm
        return fast_llm
    
    return route_query


# =============================================================================
# PATTERN: Document Processing Chain
# =============================================================================

def create_document_chain():
    """Chain for document processing with map-reduce"""
    from langchain.chains.summarize import load_summarize_chain
    
    # Map-reduce chain for long documents
    chain = load_summarize_chain(
        llm=openai_llm,
        chain_type="map_reduce",
        verbose=True
    )
    
    return chain


if __name__ == "__main__":
    # Test simple chain
    result = ask_question("What is LangChain?")
    print(f"Result: {result}")

