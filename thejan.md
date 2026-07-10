# 🎙️ Vanguard: Autonomous Business Intake Agent (Support Sync)

Vanguard is an elite, fully local, voice-to-voice AI customer success agent built for Zenvixor Studios. It utilizes a distributed microservice architecture to capture user audio, transcribe it in real-time, maintain conversational memory, and generate context-aware streaming responses using local LLMs.

---

## 🧠 Architectural Overview & Workflow

This platform operates by completely decoupling the audio capture, transcription, memory, and AI generation into distinct layers:

1. **Client Interface (Next.js & Browser Native):** The user holds a button on the UI. The browser's native `MediaRecorder` API captures the hardware microphone and packages the audio into a `.webm` Blob.
2. **API Gateway (Next.js Edge/Node):** The Next.js backend receives the audio Blob and orchestrates the workflow.
3. **Transcription Microservice (FastAPI + Whisper):** The Gateway forwards the binary audio to an isolated Python server running `faster-whisper`. The audio is converted to text and returned to the Gateway.
4. **Memory Retrieval (Redis):** The Gateway checks the local Redis database for any existing conversation history linked to the user's session.
5. **LLM Generation (Ollama):** The newly transcribed text, the historical context, and the strict Zenvixor System Persona are sent to a local Ollama instance (`gemma3:4b`).
6. **Streaming & State Persistence:** The Vercel AI SDK streams the text response back to the UI chunk-by-chunk. Once complete, the Gateway saves the updated conversation history back into Redis.

---

## 🛠️ Tech Stack

- **Frontend:** Next.js (App Router), React, Tailwind CSS
- **API Gateway / Orchestration:** Next.js Serverless Routes, Vercel AI SDK
- **Memory / State Management:** Redis (Docker), `ioredis`
- **Transcription Engine:** Python, FastAPI, `faster-whisper`, `python-multipart`
- **LLM Engine:** Ollama (`gemma3:4b`)
- **Environment Management:** `uv` (Python), `npm` (Node)

---

## ⚙️ Prerequisites

Before starting, ensure you have the following installed on your machine:

- [Node.js & npm](https://nodejs.org/)
- [Python 3.11+](https://www.python.org/) & [`uv` package manager](https://github.com/astral-sh/uv)
- [Docker Desktop](https://www.docker.com/) (For Redis)
- [Ollama](https://ollama.com/)

---

## 🚀 Installation & Setup Guide

### 1. Set Up the AI Engine (Ollama)

Ensure Ollama is running and pull the required model:

```bash
ollama run gemma3:4b
```

### 2. Set Up the Memory Store (Redis)

We use Docker to run a lightweight, isolated Redis instance without cluttering the host system.

```bash
docker run --name vanguard-redis -p 6379:6379 -d redis:alpine
```

_(To verify it is running, use `docker ps`.)_

### 3. Set Up the Transcription Microservice (Python)

Navigate to the Python backend directory and set up the isolated environment:

```bash
# Initialize uv virtual environment
uv python pin 3.11
uv venv
.\.venv\Scripts\activate

# Install dependencies
uv pip install fastapi uvicorn faster-whisper python-multipart
```

### 4. Set Up the Client & Gateway (Next.js)

Navigate to the `ui` directory and install the Node dependencies:

```bash
cd ui
npm install
npm install ai ai-sdk-ollama ioredis
```

---

## 🏃‍♂️ Running the Application

To boot up the full Vanguard ecosystem, you need to run three separate services concurrently.

### Terminal 1: Ensure Redis is running

```bash
docker start vanguard-redis
```

### Terminal 2: Start the FastAPI Transcriber

```bash
# From your python backend folder
.\.venv\Scripts\activate
uvicorn main:app
```

_(Runs on http://127.0.0.1:8000)_

### Terminal 3: Start the Next.js App

```bash
# From your /ui folder
npm run dev
```

_(Runs on http://localhost:3000)_

Navigate to http://localhost:3000 in your browser. Hold the microphone button, ask a question about Zenvixor Studios, and interact with the agent!

---

## 💾 How the Memory System (Redis) Works

LLMs are inherently stateless. To create a conversational agent, we must maintain a running log of the interaction. We use Redis for fast, ephemeral session storage.

- **Initialization:** When a user sends their first voice message, the Next.js API Gateway queries Redis using a unique `sessionId`.
- **Context Injection:** If the history is empty, the system injects the System Persona (business details, boundaries, and rules) at index `0` of the array.
- **Appending:** The user's transcribed text is pushed to the array as:

```javascript
{ role: 'user', content: '...' }
```

- **AI Processing:** The entire array is sent to Ollama so it remembers what was said 5 minutes ago.
- **Persistence:** After Ollama finishes streaming the reply, the AI's response is appended to the array. The array is serialized via `JSON.stringify()` and saved back to Redis with an expiration flag (`EX 3600`), ensuring old chat sessions automatically delete themselves after 1 hour to save memory.
