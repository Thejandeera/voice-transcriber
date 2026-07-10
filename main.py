import os
import shutil
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from RealtimeSTT import AudioToTextRecorder


app = FastAPI(title="Whisper Transcription Microservice")


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


recorder = None

# 3. Model Loading on Startup
@app.on_event("startup")
def load_whisper_model():
    global recorder
    print("🎙️ Loading Whisper AI into memory...")
    # We keep your specific AMD CPU optimizations here
    recorder = AudioToTextRecorder(
        model="base",
        device="cpu",
        compute_type="int8"
    )
    print("✅ Transcription Microservice Ready on Port 8000")

# 4. The Main Endpoint
@app.post("/transcribe")
async def transcribe_audio_file(file: UploadFile = File(...)):
    """
    Receives an audio blob, saves it to disk, transcribes it, and deletes the file.
    """
   
    if not file.filename:
        raise HTTPException(status_code=400, detail="No valid file uploaded.")

    print(f"📥 Received file: {file.filename}")
    

    temp_file_path = f"temp_{file.filename}"
    
    try:
      
        with open(temp_file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        print("🧠 Processing audio with Whisper...")
        
       
        transcribed_text = recorder.text(temp_file_path)
        
        print(f"✅ Transcribed: {transcribed_text}")
        
     
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