import os
import shutil
import warnings
import site
import re
import time
import sys
import io
import wave
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from faster_whisper import WhisperModel
from transformers import pipeline

os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"
os.environ["TOKENIZERS_PARALLELISM"] = "false"
warnings.filterwarnings("ignore")

venv_base = sys.prefix
site_packages_path = os.path.join(venv_base, "Lib", "site-packages")
cublas_bin = os.path.join(site_packages_path, "nvidia", "cublas", "bin")
cudnn_bin = os.path.join(site_packages_path, "nvidia", "cudnn", "bin")

if os.path.exists(cublas_bin):
    os.environ["PATH"] = cublas_bin + os.pathsep + os.environ["PATH"]
    os.add_dll_directory(cublas_bin)

if os.path.exists(cudnn_bin):
    os.environ["PATH"] = cudnn_bin + os.pathsep + os.environ["PATH"]
    os.add_dll_directory(cudnn_bin)

app = FastAPI(title="Emotion Analysis Microservice")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

whisper_model = None
roberta_model = None

def categorize_emotion(emotion: str, score: float) -> str:
    positive_emotions = {"admiration", "amusement", "approval", "caring", "desire", "excitement", "gratitude", "joy", "love", "optimism", "pride", "relief"}
    negative_emotions = {"anger", "annoyance", "disappointment", "disapproval", "disgust", "embarrassment", "fear", "grief", "nervousness", "remorse", "sadness"}

    if emotion in positive_emotions:
        return "positive" if score >= 0.60 else "neutral"
    elif emotion in negative_emotions:
        return "negative" if score >= 0.70 else "neutral"
    else:
        return "positive" if emotion == "surprise" and score >= 0.80 else "neutral"

@app.on_event("startup")
def load_models():
    global whisper_model, roberta_model
    # Switched to SMALL model for ultra-low latency real-time transcription
    whisper_model = WhisperModel("small", device="cuda", compute_type="int8_float16")
    roberta_model = pipeline("text-classification", model="SamLowe/roberta-base-go_emotions")

def predict_emotion(text: str) -> dict:
    result = roberta_model(text, truncation=True, max_length=512)[0]
    return {"label": result["label"], "score": round(result["score"], 4)}

@app.websocket("/live-stream")
async def live_stream(websocket: WebSocket):
    await websocket.accept()
    analyzed_sentences = set()
    raw_audio_buffer = bytearray()
    
    temp_file = f"temp_{id(websocket)}.wav" # Note: Changed to .wav
    
    # We will process audio every 2 seconds to avoid overloading Whisper
    chunk_timer = time.time() 

    try:
        while True:
            # Receive the raw Int16 audio data from the browser
            chunk = await websocket.receive_bytes()
            raw_audio_buffer.extend(chunk)
            
            # Process the buffer every 2 seconds
            if time.time() - chunk_timer > 2.0:
                if len(raw_audio_buffer) == 0:
                    continue
                    
                # Wrap the raw data in a proper WAV container
                with wave.open(temp_file, 'wb') as wav_file:
                    wav_file.setnchannels(1)      # Mono
                    wav_file.setsampwidth(2)      # 2 bytes per sample (Int16)
                    wav_file.setframerate(16000)  # 16kHz (Standard for Whisper)
                    wav_file.writeframes(raw_audio_buffer)

                try:
                    segments, _ = whisper_model.transcribe(temp_file, beam_size=5, vad_filter=True)
                    full_transcript = " ".join([segment.text for segment in segments]).strip()

                    if full_transcript:
                        sentences = re.split(r'(?<=[.!?]) +', full_transcript)
                        partial_text = ""
                        
                        for sentence in sentences:
                            sentence = sentence.strip()
                            if not sentence: continue
                            
                            if re.search(r'[.!?]$', sentence):
                                if sentence not in analyzed_sentences:
                                    emotion_data = predict_emotion(sentence)
                                    sentiment = categorize_emotion(emotion_data["label"], emotion_data["score"])
                                    
                                    await websocket.send_json({
                                        "type": "analyzed",
                                        "text": sentence,
                                        "emotion": emotion_data["label"],
                                        "sentiment_category": sentiment,
                                        "confidence": emotion_data["score"]
                                    })
                                    analyzed_sentences.add(sentence)
                                    # Clear the buffer so we don't re-transcribe old audio
                                    raw_audio_buffer.clear()
                            else:
                                partial_text = sentence

                        if partial_text:
                            await websocket.send_json({
                                "type": "partial",
                                "text": partial_text
                            })

                except Exception as e:
                    pass 
                
                # Reset the timer
                chunk_timer = time.time()
                
                # Fail-safe: If the buffer gets older than 15 seconds without a sentence break, clear it
                if len(raw_audio_buffer) > (16000 * 2 * 15): 
                    raw_audio_buffer.clear()

    except WebSocketDisconnect:
        print("Client disconnected.")
    finally:
        if os.path.exists(temp_file):
            os.remove(temp_file)