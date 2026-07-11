import os
from langchain_community.document_loaders import PyPDFDirectoryLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.embeddings import OllamaEmbeddings
from langchain_community.vectorstores import Chroma
import chromadb

KNOWLEDGE_BASE_DIR = "../knowledge_base"
CHROMA_HOST = "localhost"
CHROMA_PORT = 8001
COLLECTION_NAME = "zenvixor_services"

def main():
    os.makedirs(KNOWLEDGE_BASE_DIR, exist_ok=True)
    
    loader = PyPDFDirectoryLoader(KNOWLEDGE_BASE_DIR)
    documents = loader.load()
    
    if not documents:
        print("Error: No PDF files found in the knowledge_base directory.")
        return

    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=500,
        chunk_overlap=50
    )
    
    chunks = text_splitter.split_documents(documents)
    print(f"Extracted and split into {len(chunks)} text chunks.")

    embeddings = OllamaEmbeddings(
        model="nomic-embed-text",
        base_url="http://localhost:11434"
    )

    chroma_client = chromadb.HttpClient(host=CHROMA_HOST, port=CHROMA_PORT)

    Chroma.from_documents(
        documents=chunks,
        embedding=embeddings,
        client=chroma_client,
        collection_name=COLLECTION_NAME
    )

    print("Successfully vectorized and stored all chunks in ChromaDB!")

if __name__ == "__main__":
    main()