import os
import sys
import time

venv_base = sys.prefix
site_packages = os.path.join(venv_base, "Lib", "site-packages")
cublas_bin = os.path.join(site_packages, "nvidia", "cublas", "bin")
cudnn_bin = os.path.join(site_packages, "nvidia", "cudnn", "bin")

print(f"Checking for cuBLAS at: {cublas_bin}")
if os.path.exists(cublas_bin):
    os.environ["PATH"] = cublas_bin + os.pathsep + os.environ["PATH"]
    os.add_dll_directory(cublas_bin)
    print("-> cuBLAS loaded successfully.")
else:
    print("-> CRITICAL WARNING: cuBLAS folder not found in .venv!")

print(f"Checking for cuDNN at: {cudnn_bin}")
if os.path.exists(cudnn_bin):
    os.environ["PATH"] = cudnn_bin + os.pathsep + os.environ["PATH"]
    os.add_dll_directory(cudnn_bin)
    print("-> cuDNN loaded successfully.")
else:
    print("-> CRITICAL WARNING: cuDNN folder not found in .venv!")

print("Loading WhisperModel...")
from faster_whisper import WhisperModel

model = WhisperModel("Systran/faster-whisper-small", device="cuda", compute_type="int8_float16")

audio_file = r"Sample-Audio\A1.wav"
print(f"Starting transcription of {audio_file}...")

start_time = time.perf_counter()
segments, _ = model.transcribe(audio_file, beam_size=5)
text = " ".join([segment.text for segment in segments])
end_time = time.perf_counter()

print("=" * 40)
print(f"DONE! It took: {end_time - start_time:.2f} seconds")
print(f"Text Preview: {text[:100]}...")