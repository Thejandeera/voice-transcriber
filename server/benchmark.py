import os
import time
import gc
import jiwer
from faster_whisper import WhisperModel

file_pairs = [
    {"audio": "A1.wav", "text_file": "T1.txt"},
    {"audio": "A2.wav", "text_file": "T2.txt"},
    {"audio": "A3.wav", "text_file": "T3.txt"}
]

models_to_test = ["small", "medium", "large-v3"]

print("Starting Multi-File Whisper GPU Evaluation...")
print("=" * 60)

for model_size in models_to_test:
    print(f"\nInitializing model: {model_size.upper()}")
    model = WhisperModel(model_size, device="cuda", compute_type="float16")
    
    if os.path.exists(file_pairs[0]["audio"]):
        try:
            _ = model.transcribe(file_pairs[0]["audio"], beam_size=5)
        except Exception:
            pass
            
    for pair in file_pairs:
        audio_path = pair["audio"]
        text_path = pair["text_file"]
        
        if not os.path.exists(audio_path) or not os.path.exists(text_path):
            print(f"Missing file error: {audio_path} or {text_path} not found.")
            continue
            
        with open(text_path, "r", encoding="utf-8") as f:
            reference_text = f.read().strip().lower()
            
        start_time = time.perf_counter()
        
        segments, _ = model.transcribe(audio_path, beam_size=5)
        transcribed_text = " ".join([segment.text for segment in segments]).strip().lower()
        
        end_time = time.perf_counter()
        execution_ms = (end_time - start_time) * 1000
        
        wer_score = jiwer.wer(reference_text, transcribed_text)
        
        print(f"Model: {model_size.upper()} | File: {audio_path}")
        print(f"Transcribed: {transcribed_text}")
        print(f"Latency:     {execution_ms:.2f} ms")
        print(f"WER Score:   {wer_score:.4f}")
        print("-" * 40)
        
    del model
    gc.collect()

print("\nEvaluation process finished.")