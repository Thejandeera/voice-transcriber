import chromadb

def main():
    # Connect to your Dockerized ChromaDB
    client = chromadb.HttpClient(host="localhost", port=8001)
    
    # Get your specific collection
    collection = client.get_collection(name="zenvixor_services")
    
    # Check how many chunks are in the database
    count = collection.count()
    print(f"\nTotal chunks stored: {count}")
    
    # 'Peek' at the first 3 chunks
    results = collection.peek(limit=9)
    
    print("\n--- PEEKING AT THE FIRST 3 CHUNKS ---")
    for i in range(len(results['documents'])):
        print(f"\nCHUNK {i + 1}:")
        print(f"TEXT: {results['documents'][i]}")
        # We only print the first 5 numbers of the vector, otherwise it fills your screen!
        print(f"VECTOR (First 5 dimensions): {results['embeddings'][i][:5]} ...")
        print("-" * 50)

if __name__ == "__main__":
    main()