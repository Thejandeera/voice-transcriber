# Autonomous Business Intake Agent (Support Sync)

An elite, fully local, voice-to-voice AI customer success agent built for businesses. It uses a distributed microservice architecture to capture user audio, transcribe it in real time, retrieve factual business data through a Retrieval-Augmented Generation (RAG) pipeline, maintain conversational memory, and generate context-aware streaming responses using local large language models (LLMs).

---

# 🧠 Architectural Overview & Workflow

The platform is designed around a decoupled architecture where each responsibility is handled by an independent service.

## 1. Client Interface (Next.js & Browser Native)

- The user holds a button on the web interface.
- The browser's native `MediaRecorder` API captures microphone input.
- Audio is packaged as a `.webm` Blob.
- The recorded audio is sent to the API Gateway.

---

## 2. API Gateway (Next.js Edge/Node)

The Next.js backend acts as the orchestrator for the entire pipeline.

Its responsibilities include:

- Receiving recorded audio
- Forwarding audio to the transcription service
- Querying the vector database
- Retrieving conversation memory
- Sending prompts to the local LLM
- Streaming responses back to the frontend
- Persisting updated conversation history

---

## 3. Transcription Microservice (FastAPI + Whisper)

The Gateway forwards the audio to an isolated Python service running `faster-whisper`.

Workflow:

1. Receive binary audio
2. Convert speech to text
3. Return transcription to the Gateway

---

## 4. Vector Retrieval & Guardrails (ChromaDB + Nomic)

The transcribed text is converted into embeddings using Ollama's `nomic-embed-text` model.

The Gateway then:

- Queries the local ChromaDB instance
- Retrieves the most relevant business knowledge
- Measures similarity using vector distance

### Guardrail

If the returned distance exceeds the configured threshold:

```
DISTANCE_THRESHOLD = 450
```

the request is considered outside the business knowledge scope.

Instead of allowing the LLM to answer, the Gateway immediately returns a predefined refusal response to prevent hallucinations.

---

## 5. Memory Retrieval (Redis)

The Gateway checks Redis for any conversation history associated with the current session.

This enables:

- Multi-turn conversations
- Context awareness
- Session continuity

---

## 6. LLM Generation (Ollama)

The following inputs are combined:

- Current transcription
- Retrieved business context
- Previous conversation history
- System prompt/persona

These are sent to the local Ollama model:

```
gemma3:4b
```

---

## 7. Streaming & State Persistence

The generated response is streamed back to the frontend using the Vercel AI SDK.

After generation completes:

- Updated conversation history is saved to Redis
- Session expiration timer is refreshed

---

# 🛠️ Tech Stack

## Frontend

- Next.js (App Router)
- React
- Tailwind CSS

## API Gateway / Orchestration

- Next.js Server Routes
- Vercel AI SDK

## Memory

- Redis (Docker)
- ioredis

## Vector Database

- ChromaDB (Docker)
- chromadb JavaScript Client

## Speech-to-Text

- Python
- FastAPI
- faster-whisper
- python-multipart

## Knowledge Base Ingestion

- Python
- LangChain
- PyPDF

## Local AI Models

- Ollama
- gemma3:4b
- nomic-embed-text

## Environment Management

- npm
- uv

---

# ⚙️ Prerequisites

Before running the project, install the following:

- Node.js
- npm
- Python 3.11+
- uv
- Docker Desktop
- Ollama

---

# 🚀 Installation & Setup Guide

## 1. Install the AI Models (Ollama)

Ensure Ollama is running.

Pull the required models:

```bash
ollama pull gemma3:4b
ollama pull nomic-embed-text
```

---

## 2. Start Redis & ChromaDB

Run Redis:

```bash
docker run --name business-redis -p 6379:6379 -d redis:alpine
```

Run ChromaDB:

```bash
docker run -d \
--name business-chroma \
-p 8001:8000 \
-v business-chroma-data:/chroma/chroma \
chromadb/chroma
```

---

## 3. Configure the Python Backend

Navigate to the backend directory.

Create a virtual environment:

```bash
uv python pin 3.11
uv venv
```

Activate it (Windows):

```bash
.\.venv\Scripts\activate
```

Install dependencies:

```bash
uv pip install fastapi uvicorn faster-whisper python-multipart langchain pypdf chromadb
```

---

## 4. Ingest the Knowledge Base

Create a folder named:

```
knowledge_base/
```

Place all business PDFs inside it.

Run:

```bash
python ingest.py
```

This process:

- Reads PDFs
- Splits documents into chunks
- Generates embeddings
- Stores them in ChromaDB

---

## 5. Configure the Next.js Application

Navigate to the UI directory.

Install dependencies:

```bash
cd ui
npm install
npm install ai ai-sdk-ollama ioredis chromadb
```

---

# 🏃 Running the Application

Three services must run simultaneously.

---

## Terminal 1 — Start Docker Services

```bash
docker start business-redis business-chroma
```

---

## Terminal 2 — Start the FastAPI Server

```bash
.\.venv\Scripts\activate

python -m uvicorn main:app
```

Runs on:

```
http://127.0.0.1:8000
```

---

## Terminal 3 — Start Next.js

```bash
cd ui

npm run dev
```

Runs on:

```
http://localhost:3000
```

Open:

```
http://localhost:3000
```

to interact with the application.

---

# 💾 Memory System (Redis)

Large Language Models are stateless.

Redis provides fast, temporary session storage.

## Initialization

The Gateway queries Redis using a unique session ID.

---

## Appending Messages

Each user message is appended to the conversation history.

---

## AI Processing

The complete history is sent to the LLM so it can maintain conversational context.

---

## Persistence

After streaming completes:

- Updated history is serialized
- Saved back into Redis
- Expiration is refreshed

Example:

```
EX 3600
```

This automatically deletes inactive sessions after one hour.

---

# 🛡️ Retrieval-Augmented Generation (RAG) & Guardrails

To minimize hallucinations, the system relies on a restricted retrieval pipeline.

## Query Optimization

Very short queries (less than 30 characters) are automatically expanded with business-related context before embedding generation.

This improves retrieval quality.

---

## Similarity Search

ChromaDB returns the closest document matches along with vector distance scores.

---

## Distance Threshold

```
DISTANCE_THRESHOLD = 450
```

- Distance ≤ 450 → Relevant business context
- Distance > 450 → Outside supported scope

---

## Hard Short-Circuit

If the similarity score exceeds the threshold:

1. The Gateway skips the LLM entirely.
2. A predefined refusal message is returned.
3. Hallucinations are prevented.
4. Responses remain limited to verified business knowledge.

---

# 📌 Overall Request Flow

```text
Browser
    │
    ▼
MediaRecorder
    │
    ▼
Next.js API Gateway
    │
    ├──────────────► FastAPI (Whisper)
    │                     │
    │                     ▼
    │               Transcribed Text
    │
    ├──────────────► ChromaDB
    │                     │
    │                     ▼
    │             Relevant Business Context
    │
    ├──────────────► Redis
    │                     │
    │                     ▼
    │            Conversation History
    │
    ├──────────────► Ollama (gemma3:4b)
    │                     │
    │                     ▼
    │            Streaming Response
    │
    ▼
Next.js Client
```
