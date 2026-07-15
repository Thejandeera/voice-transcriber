import os
import shutil
import warnings
import site
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from faster_whisper import WhisperModel
from transformers import pipeline

os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"
os.environ["TOKENIZERS_PARALLELISM"] = "false"
warnings.filterwarnings("ignore")

try:
    for site_packages in site.getsitepackages():
        cudnn_path = os.path.join(site_packages, "nvidia", "cudnn", "bin")
        cublas_path = os.path.join(site_packages, "nvidia", "cublas", "bin")
        if os.path.exists(cudnn_path):
            os.add_dll_directory(cudnn_path)
        if os.path.exists(cublas_path):
            os.add_dll_directory(cublas_path)
except Exception:
    pass

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
    positive_emotions = {
        "admiration", "amusement", "approval", "caring", "desire", 
        "excitement", "gratitude", "joy", "love", "optimism", "pride", "relief"
    }
    
    negative_emotions = {
        "anger", "annoyance", "disappointment", "disapproval", "disgust", 
        "embarrassment", "fear", "grief", "nervousness", "remorse", "sadness"
    }
    
    neutral_or_ambiguous = {
        "confusion", "curiosity", "realization", "surprise", "neutral"
    }

    if emotion in positive_emotions:
        if score >= 0.60:
            return "positive"
        else:
            return "neutral"
            
    elif emotion in negative_emotions:
        if score >= 0.70:
            return "negative"
        else:
            return "neutral"
            
    else:
        if emotion == "surprise" and score >= 0.80:
            return "positive"
        return "neutral"

@app.on_event("startup")
def load_models():
    global whisper_model, roberta_model

    whisper_model = WhisperModel(
        model_size_or_path="medium", 
        device="cuda",
        compute_type="float16"
    )

    roberta_model = pipeline(
        "text-classification",
        model="SamLowe/roberta-base-go_emotions",
    )

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
        temp_path = f"temp_emotion_{file.filename}"
        try:
            with open(temp_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)

            transcribed_text = transcribe_audio(temp_path)

            if not transcribed_text:
                raise HTTPException(
                    status_code=400,
                    detail="Could not extract any speech from the audio file.",
                )
            input_text = transcribed_text

        except HTTPException:
            raise
        except Exception as e:
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

    emotion_result = predict_emotion(input_text)
    raw_emotion = emotion_result["label"]
    confidence_score = emotion_result["score"]
    
    bucketed_sentiment = categorize_emotion(raw_emotion, confidence_score)

    return {
        "status": "success",
        "transcribed_text": transcribed_text,
        "input_text": input_text,
        "emotion": raw_emotion,
        "sentiment_category": bucketed_sentiment,
        "confidence": confidence_score,
    }