from fastapi import FastAPI
from RealtimeSTT import AudioToTextRecorder

# 1. Initialize the FastAPI application
app = FastAPI(title="Voice Transcriber API")

# We will store our recorder here so it loads once when the server starts
recorder = None

@app.on_event("startup")
def load_model():
    global recorder
    print("🎙️ Initializing AI Model... Please wait.")
    recorder = AudioToTextRecorder(
        model="base",             
        device="cpu",             
        compute_type="int8"       
    )
    print("✅ System Ready! Server is actively listening.")

@app.get("/")
def home():
    return {"message": "Welcome to the Voice Transcriber API. Go to /transcribe to record."}

@app.get("/transcribe")
def transcribe_audio():
    """
    When someone visits this endpoint, the server will listen to the mic,
    process the speech, and return the text.
    """
    print("Listening for speech...")
    # This will block and listen to the server's microphone until you stop speaking
    text = recorder.text() 
    return {"status": "success", "transcribed_text": text}