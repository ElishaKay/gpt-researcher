from gpt_researcher.context.compression import ContextCompressor
from langchain_community.vectorstores import FAISS
from langchain_community.embeddings import OpenAIEmbeddings
from langchain_core.documents import Document

# PGVector
from gpt_researcher import GPTResearcher
from sqlalchemy.ext.asyncio import create_async_engine
from langchain_postgres import PGVector
from langchain_postgres.vectorstores import PGVector
from langchain_openai import OpenAIEmbeddings

import os


class VectorAgent:
    def __init__(self):
        self.vector_store = None

    async def save_to_vector_store(self, documents):
        # Manually create an async engine using asyncpg
        async_engine = create_async_engine(
            os.environ.get('PGVECTOR_CONNECTION_STRING'), 
            echo=True  # Enable logging for troubleshooting
        )

        embeddings = OpenAIEmbeddings()
        #  self.vector_store = FAISS.from_documents(documents, embeddings)

        # Use the async engine in the PGVector initialization
        vector_store = PGVector.from_existing_index(
            use_jsonb=True,
            embedding=embeddings,
            connection=os.environ.get('PGVECTOR_CONNECTION_STRING'),
            collection_name='dev-team',
            async_mode=True,
            async_engine=async_engine  # Pass the created async engine here
        )

        # Save documents to the vector store asynchronously
        for doc, embedding in zip(documents, embeddings):
            await vector_store.add_documents(documents=[doc.page_content], embeddings=[embedding], metadatas=[doc.metadata])

        return vector_store

    async def compress_context(self, query, documents):
        embeddings = OpenAIEmbeddings()
        compressor = ContextCompressor(documents, embeddings)
        compressed_context = await compressor.async_get_context(query)
        return compressed_context