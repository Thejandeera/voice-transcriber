import os
import shutil
import warnings
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from faster_whisper import WhisperModel
from transformers import pipeline

os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"
os.environ["TOKENIZERS_PARALLELISM"] = "false"
warnings.filterwarnings("ignore")

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


@app.on_event("startup")
def load_models():
    global whisper_model, roberta_model

    print("Loading Whisper AI into memory...")
    whisper_model = WhisperModel(
        model_size_or_path="base",
        device="cpu",
        compute_type="int8"
    )
    print("Whisper model loaded.")

    print("Loading RoBERTa emotion model (SamLowe/roberta-base-go_emotions)...")
    roberta_model = pipeline(
        "text-classification",
        model="SamLowe/roberta-base-go_emotions",
    )
    print("RoBERTa model loaded.")
    print("Emotion Analysis Microservice Ready on Port 8001")


def transcribe_audio(file_path: str) -> str:
    segments, _ = whisper_model.transcribe(file_path, beam_size=5)
    return " ".join([segment.text for segment in segments]).strip()


def predict_emotion(text: str) -> dict:
    result = roberta_model(text, truncation=True, max_length=512)[0]
    return {"label": result["label"], "score": round(result["score"], 4)}


@app.post("/analyze")
async def analyze_emotion(
    file: UploadFile | None = File(None),
    text: str | None = Form(None),
):
    input_text = None
    transcribed_text = None

   
    if file and file.filename:
        print(f"Received audio file: {file.filename}")
        temp_path = f"temp_emotion_{file.filename}"
        try:
            with open(temp_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)

            print("Transcribing audio with Whisper...")
            transcribed_text = transcribe_audio(temp_path)
            print(f"Transcribed: {transcribed_text}")

            if not transcribed_text:
                raise HTTPException(
                    status_code=400,
                    detail="Could not extract any speech from the audio file.",
                )
            input_text = transcribed_text

        except HTTPException:
            raise
        except Exception as e:
            print(f"Error processing audio: {str(e)}")
            raise HTTPException(status_code=500, detail="Audio transcription failed.")
        finally:
            if os.path.exists(temp_path):
                os.remove(temp_path)

    if text and text.strip():
      
        if input_text is None:
            input_text = text.strip()

    if not input_text:
        raise HTTPException(
            status_code=400,
            detail="Please provide either an audio file or a text message.",
        )

   
    print(f"Running RoBERTa inference on: {input_text[:80]}...")
    emotion_result = predict_emotion(input_text)
    print(f"Predicted: {emotion_result['label']} ({emotion_result['score']})")

    return {
        "status": "success",
        "transcribed_text": transcribed_text,
        "input_text": input_text,
        "emotion": emotion_result["label"],
        "confidence": emotion_result["score"],
    }
