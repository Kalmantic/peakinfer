# R7 - Orchestration + RAG
# LangChain, DSPy, LlamaIndex, Pinecone, Qdrant, pgvector

from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain_anthropic import ChatAnthropic
from langchain_community.vectorstores import Pinecone, Qdrant
from langchain.chains import RetrievalQA
from langchain.text_splitter import RecursiveCharacterTextSplitter

import dspy
from llama_index.core import VectorStoreIndex, SimpleDirectoryReader
from llama_index.vector_stores.qdrant import QdrantVectorStore
from llama_index.embeddings.openai import OpenAIEmbedding

import pinecone
from qdrant_client import QdrantClient
import psycopg2

# LangChain setup
llm_openai = ChatOpenAI(model="gpt-4o", temperature=0)
llm_anthropic = ChatAnthropic(model="claude-3-5-sonnet-20241022")
embeddings = OpenAIEmbeddings(model="text-embedding-3-small")

# DSPy setup
dspy_lm = dspy.LM("openai/gpt-4o")
dspy.configure(lm=dspy_lm)

# Vector DB clients
pinecone_client = pinecone.Pinecone()
qdrant_client = QdrantClient(url="http://localhost:6333")

def langchain_rag_pipeline(query: str, index_name: str) -> str:
    """LangChain RAG with Pinecone"""
    vectorstore = Pinecone.from_existing_index(
        index_name=index_name,
        embedding=embeddings
    )
    qa_chain = RetrievalQA.from_chain_type(
        llm=llm_openai,
        chain_type="stuff",
        retriever=vectorstore.as_retriever(search_kwargs={"k": 5})
    )
    return qa_chain.invoke(query)["result"]

def langchain_qdrant_rag(query: str, collection: str) -> str:
    """LangChain RAG with Qdrant"""
    vectorstore = Qdrant(
        client=qdrant_client,
        collection_name=collection,
        embeddings=embeddings
    )
    qa_chain = RetrievalQA.from_chain_type(
        llm=llm_anthropic,
        chain_type="stuff",
        retriever=vectorstore.as_retriever()
    )
    return qa_chain.invoke(query)["result"]

class DSPyRAG(dspy.Module):
    """DSPy RAG module"""
    def __init__(self, retriever):
        super().__init__()
        self.retriever = retriever
        self.generate = dspy.ChainOfThought("context, question -> answer")

    def forward(self, question):
        context = self.retriever(question)
        return self.generate(context=context, question=question)

def llamaindex_rag(query: str, data_dir: str) -> str:
    """LlamaIndex RAG pipeline"""
    documents = SimpleDirectoryReader(data_dir).load_data()
    index = VectorStoreIndex.from_documents(documents)
    query_engine = index.as_query_engine()
    return query_engine.query(query).response

def llamaindex_qdrant_rag(query: str, collection: str) -> str:
    """LlamaIndex with Qdrant vector store"""
    vector_store = QdrantVectorStore(
        client=qdrant_client,
        collection_name=collection
    )
    index = VectorStoreIndex.from_vector_store(vector_store)
    query_engine = index.as_query_engine()
    return query_engine.query(query).response

def pgvector_search(query: str, conn_string: str) -> list:
    """pgvector similarity search"""
    conn = psycopg2.connect(conn_string)
    cur = conn.cursor()

    # Get embedding for query
    query_embedding = embeddings.embed_query(query)

    # Vector similarity search
    cur.execute("""
        SELECT content, embedding <=> %s::vector AS distance
        FROM documents
        ORDER BY distance
        LIMIT 5
    """, (query_embedding,))

    results = cur.fetchall()
    conn.close()
    return results
