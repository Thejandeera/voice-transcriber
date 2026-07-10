# ⚙️ Technical Architecture & Engineering Decisions

**Ecosystem:** Distributed (Next.js, FastAPI, Redis, Ollama)

This document outlines the internal mechanics, data flow, and engineering rationale behind the Vanguard Voice AI architecture. The system is designed as a decoupled, event-driven pipeline to ensure scalability, fault isolation, and low-latency local inference.

---

## 1. The Transcription Microservice (FastAPI + faster-whisper)

**How it works:**
This is an isolated Python process that does one thing: converts binary audio into text. It exposes a single POST endpoint (`/transcribe`). When it receives a `.webm` file, it saves it to a temporary buffer on the disk, feeds the file path to the Whisper model, extracts the text, deletes the audio file to prevent storage leaks, and returns a JSON response.

**Why we use it:**

- **FastAPI:** The Python ecosystem is mandatory for running modern AI/ML models. FastAPI is chosen over Flask or Django because it is built on ASGI (Asynchronous Server Gateway Interface), meaning it can handle multiple concurrent network requests without blocking the thread.
- **faster-whisper (over standard Whisper):** Standard OpenAI Whisper relies heavily on PyTorch and is optimized for NVIDIA CUDA. Since this runs on consumer hardware (AMD CPU), `faster-whisper` uses the CTranslate2 engine with `INT8 quantization`. This compresses the model's memory footprint and allows it to run blazing fast on standard CPU cores without freezing the system.

## 2. The AI Generation Engine (Ollama)

**How it works:**
Ollama is a lightweight framework that wraps `llama.cpp`. It loads the `gemma3:4b` weights directly into system memory and exposes a local REST API (usually on port 11434). It waits for a prompt payload, calculates the next most likely token based on the neural network, and streams those tokens back one by one.

**Why we use it:**

- **Data Privacy & Cost:** By running inference locally, Zenvixor Studios retains 100% data sovereignty over client conversations. There are zero API costs and no rate limits.
- **Vercel AI SDK Compatibility:** Ollama natively supports Server-Sent Events (SSE). This allows our Next.js backend to pipe the AI's thoughts token-by-token directly to the frontend, drastically reducing perceived latency. The user reads the first word while the AI is still generating the tenth.

## 3. The State Memory Store (Redis + Docker)

**How it works:**
Large Language Models (LLMs) are completely stateless; they have no memory of the previous prompt. To have a continuous conversation, we must send the entire chat history to the LLM every single time. Redis is an in-memory, NoSQL key-value database. We store the chat history array as a JSON string, keyed to a specific `sessionId`.

**Why we use it:**

- **RAM-Speed I/O:** Reading/writing to a traditional database (like PostgreSQL) for every single chat message adds unnecessary disk I/O latency. Redis stores everything in RAM, meaning context retrieval happens in less than a millisecond.
- **Automated TTL (Time-To-Live):** We use Redis's `EX 3600` flag. This tells Redis to automatically destroy the chat history after 1 hour of inactivity. This prevents memory leaks and ensures old customer sessions don't permanently consume server RAM.
- **Dockerized Isolation:** Running Redis in a Docker container ensures that our database layer is portable, easily deployable in CI/CD pipelines, and doesn't conflict with local Windows registry or system files.

## 4. The Orchestrator (Next.js API Gateway)

**How it works:**
The Next.js backend route (`/api/chat`) is the central nervous system. It receives the raw audio from the frontend, acts as a reverse proxy to send the audio to FastAPI, retrieves the history from Redis, formulates the final prompt, queries Ollama, and pipes the streaming response back to the client.

**Why we use it:**

- **Security & CORS:** If the browser tried to talk to FastAPI and Ollama directly, it would trigger massive CORS (Cross-Origin Resource Sharing) security blocks. By passing everything through the Next.js API, the browser only talks to its own server, keeping the architecture secure and the external microservice ports hidden from the public internet.
- **Pipeline Management:** It allows us to inject the Zenvixor "System Persona" securely on the server side, where malicious users cannot inspect or manipulate the prompt via their browser console.

---

## 🔄 The Complete Data Flow Lifecycle

Here is the exact step-by-step pipeline of a single voice interaction:

1. **Capture:** The user presses the button on the React frontend. The browser's `MediaRecorder` API captures raw hardware mic data and encodes it into a `.webm` audio Blob.
2. **Ingress:** The Blob is wrapped in a `FormData` object and POSTed to the Next.js API Gateway (`/api/chat`).
3. **Delegation (Audio):** The Gateway pauses, extracts the Blob, and POSTs it over localhost to the FastAPI microservice (`/transcribe`).
4. **Processing (STT):** FastAPI writes the Blob to disk, `faster-whisper` decodes the audio to text, deletes the file, and returns the text string to the Gateway.
5. **State Retrieval:** The Gateway takes the text and queries the Redis container for `chat:{sessionId}` to get the previous conversation history.
6. **Prompt Assembly:** The Gateway pushes the new text into the history array. If it's a new session, it secretly prepends the Zenvixor System Guardrails.
7. **Delegation (LLM):** The Gateway sends the assembled context array to Ollama's local port.
8. **Egress (Streaming):** Ollama begins generating the response. The Gateway catches this output and uses the Vercel AI SDK to open a Server-Sent Events (SSE) stream back to the React frontend.
9. **UI Rendering:** The React frontend parses the incoming stream chunks and dynamically updates the DOM, creating the typing effect for the user.
10. **State Persistence:** Once Ollama finishes generating the final token, the Gateway appends the complete AI response to the history array and overwrites the old Redis key with the new state.
