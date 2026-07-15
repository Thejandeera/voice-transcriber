import os
import site
import time
import gc
import jiwer
from faster_whisper import WhisperModel
from huggingface_hub import snapshot_download

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

base_folder = "Sample-Audio"
file_pairs = [
    {"audio": os.path.join(base_folder, "A1.wav"), "text_file": os.path.join(base_folder, "T1.txt")},
    {"audio": os.path.join(base_folder, "A2.wav"), "text_file": os.path.join(base_folder, "T2.txt")},
    {"audio": os.path.join(base_folder, "A3.wav"), "text_file": os.path.join(base_folder, "T3.txt")}
]

models_to_test = ["small", "medium", "large-v3"]

repo_mapping = {
    "small": "Systran/faster-whisper-small",
    "medium": "Systran/faster-whisper-medium",
    "large-v3": "Systran/faster-whisper-large-v3"
}

print("Starting Multi-File Whisper GPU Evaluation...")
print("=" * 60)

for model_size in models_to_test:
    print(f"\n--- {model_size.upper()} MODEL ---")
    print(f"Step 1: Checking Cache / Downloading from Hugging Face...")
    
    repo_id = repo_mapping[model_size]
    model_path = snapshot_download(repo_id=repo_id, max_workers=1)
    
    print(f"-> Download verified. Files located at: {model_path}")
    print(f"Step 2: Pushing weights to GPU VRAM...")
    
    model = WhisperModel(model_path, device="cuda", compute_type="float16")
    print(f"-> GPU Initialization Complete!")
    
    if os.path.exists(file_pairs[0]["audio"]):
        try:
            print("Step 3: Performing GPU Warm-up run...")
            _ = model.transcribe(file_pairs[0]["audio"], beam_size=5)
        except Exception:
            pass
            
    print("Step 4: Executing Benchmark...")
    for pair in file_pairs:
        audio_path = pair["audio"]
        text_path = pair["text_file"]
        
        if not os.path.exists(audio_path):
            print(f"  [ERROR] Missing audio file: {audio_path}")
            continue
            
        if not os.path.exists(text_path):
            print(f"  [ERROR] Missing text file: {text_path}")
            continue
            
        with open(text_path, "r", encoding="utf-8") as f:
            reference_text = f.read().strip().lower()
            
        print(f"  -> Currently transcribing: {audio_path} (Please wait...)")
        start_time = time.perf_counter()
        
        segments, _ = model.transcribe(audio_path, beam_size=5)
        transcribed_text = " ".join([segment.text for segment in segments]).strip().lower()
        
        end_time = time.perf_counter()
        execution_ms = (end_time - start_time) * 1000
        
        wer_score = jiwer.wer(reference_text, transcribed_text)
        
        print(f"  | File: {audio_path}")
        print(f"  | Text: {transcribed_text}")
        print(f"  | Time: {execution_ms:.2f} ms | WER: {wer_score:.4f}")
        print("  " + "-" * 30)
        
    del model
    gc.collect()

print("\nEvaluation process finished.")