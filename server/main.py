import os
import shutil
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from faster_whisper import WhisperModel


app = FastAPI(title="Whisper Transcription Microservice")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


model = None


@app.on_event("startup")
def load_whisper_model():
    global model
    print("🎙️ Loading Whisper AI into memory...")
    
    
    model = WhisperModel(
        model_size_or_path="base",
        device="cpu",
        compute_type="int8"
    )
    print("✅ Transcription Microservice Ready on Port 8000")


@app.post("/transcribe")
async def transcribe_audio_file(file: UploadFile = File(...)):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No valid file uploaded.")

    print(f"📥 Received file: {file.filename}")
    temp_file_path = f"temp_{file.filename}"
    
    try:
       
        with open(temp_file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        print("🧠 Processing audio with Whisper...")
        
        
        segments, info = model.transcribe(temp_file_path, beam_size=5)
        
       
        transcribed_text = " ".join([segment.text for segment in segments])
        
        print(f"✅ Transcribed: {transcribed_text.strip()}")
        
        return {
            "status": "success", 
            "text": transcribed_text.strip()
        }
        
    except Exception as e:
        print(f"❌ Error processing audio: {str(e)}")
        raise HTTPException(status_code=500, detail="Transcription failed on the server.")
        
    finally:
        
        if os.path.exists(temp_file_path):
            os.remove(temp_file_path)
            print("🧹 Cleaned up temporary audio file.")