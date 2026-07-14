# RoBERTa Emotion Model Integration

This document explains how to run the **Emotion Analysis Microservice** — a standalone FastAPI server that combines **Whisper** (speech-to-text) with **RoBERTa** (emotion detection) to analyze the emotional tone of voice recordings or text messages.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   Next.js Frontend                      │
│               localhost:3000/model                      │
│                                                         │
│   ┌─────────────┐         ┌──────────────────────┐      │
│   │  Text Input  │         │  Audio File Upload   │      │
│   └──────┬──────┘         └──────────┬───────────┘      │
│          └──────────┬───────────────┘                    │
│                     ▼                                    │
│            POST /analyze                                │
│         (localhost:8001)                                 │
└─────────────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│           Emotion Analysis Microservice                 │
│              emotion_router.py : 8001                   │
│                                                         │
│   ┌──────────────────┐    ┌───────────────────────┐     │
│   │  Whisper (base)   │──▶│  RoBERTa GoEmotions   │     │
│   │  Audio → Text     │    │  Text → Emotion       │     │
│   └──────────────────┘    └───────────────────────┘     │
│                                                         │
│   Returns: { emotion, confidence, transcribed_text }    │
└─────────────────────────────────────────────────────────┘
```

---

## Prerequisites

Make sure these are installed in the **server virtual environment**:

```bash
cd server
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # macOS / Linux

pip install transformers torch faster-whisper
```

> **Note:** `torch` is a large package (~2 GB). The first install will take several minutes.

---

## How to Run

### 1. Start the Emotion Analysis Server (Port 8001)

```bash
cd server
.venv\Scripts\activate
python -m uvicorn emotion_router:app --port 8001
```

On first startup, the server will:
1. Load the **Whisper base** model into memory (for audio transcription)
2. Download and load **SamLowe/roberta-base-go_emotions** (~500 MB on first run, cached afterwards)
3. Print `Emotion Analysis Microservice Ready on Port 8001` when ready

### 2. Start the Existing Transcription Server (Port 8000)

This is the original Whisper-only server — keep it running as before:

```bash
cd server
.venv\Scripts\activate
python -m uvicorn main:app
```

### 3. Start the Next.js Frontend (Port 3000)

```bash
cd ui
npm run dev
```

### 4. Open the Emotion Analyzer Page

Navigate to: **http://localhost:3000/model** to see the sentiment analysis.

---

## API Reference

### `POST http://localhost:8001/analyze`

**Content-Type:** `multipart/form-data`

| Field  | Type           | Required | Description                                          |
|--------|----------------|----------|------------------------------------------------------|
| `file` | File (audio)   | No       | Audio file to transcribe (wav, mp3, ogg, webm, etc.) |
| `text` | String (form)  | No       | Text message to analyze directly                     |

> At least one of `file` or `text` must be provided. If both are provided, the audio transcription takes priority.

**Response (200):**

```json
{
  "status": "success",
  "transcribed_text": "Thank you so much for your help today",
  "input_text": "Thank you so much for your help today",
  "emotion": "gratitude",
  "confidence": 0.9712
}
```

- `transcribed_text` — Only populated when an audio file was uploaded; `null` for text-only requests
- `input_text` — The actual text that was analyzed by RoBERTa
- `emotion` — One of 28 GoEmotions labels (see below)
- `confidence` — Model confidence score between 0 and 1

---

## Supported Emotions (28 Labels)

The RoBERTa model (`SamLowe/roberta-base-go_emotions`) classifies text into one of these 28 emotions:

| Category       | Emotions                                              |
|----------------|-------------------------------------------------------|
| **Positive**   | admiration, amusement, approval, caring, excitement, gratitude, joy, love, optimism, pride, relief |
| **Negative**   | anger, annoyance, disappointment, disapproval, disgust, embarrassment, fear, grief, nervousness, remorse, sadness |
| **Ambiguous**  | confusion, curiosity, desire, realization, surprise   |
| **Baseline**   | neutral                                               |

---

## Supported Audio Formats

The upload zone accepts:
- `.wav`
- `.mp3`
- `.ogg`
- `.webm`
- `.m4a`
- `.flac`
- `.aac`
- `.wma`
- `.opus`

---

## File Structure

```
server/
├── main.py              # Original Whisper transcription server (port 8000) — UNCHANGED
├── emotion_router.py    # NEW — Emotion analysis server (port 8001)
└── .venv/

ui/src/app/
├── page.tsx             # Original home page — UNCHANGED
├── layout.tsx           # Root layout — UNCHANGED
└── model/
    ├── page.tsx         # NEW — /model route page
    └── model.css        # NEW — Emotion analyzer styles
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `ModuleNotFoundError: No module named 'transformers'` | Run `pip install transformers torch` in the server venv |
| Server hangs on startup | First-time model download can take 2-5 minutes. Check terminal for progress |
| CORS errors in browser console | Make sure `emotion_router.py` is running on port 8001 |
| Audio file not transcribing | Ensure the file is a valid audio format, not corrupted |
| Low confidence scores | RoBERTa works best with English text. Very short inputs may produce lower confidence |
