"use client";

import { useState, useRef, useCallback } from "react";
import "./model.css";

interface AnalysisResult {
  input_text: string;
  transcribed_text: string | null;
  emotion: string;
  sentiment_category: string;
  confidence: number;
}

const EMOTION_COLORS: Record<string, { bg: string; text: string; glow: string }> = {
  admiration:     { bg: "rgba(251,191,36,0.15)",  text: "#fbbf24", glow: "0 0 24px rgba(251,191,36,0.3)" },
  amusement:      { bg: "rgba(52,211,153,0.15)",  text: "#34d399", glow: "0 0 24px rgba(52,211,153,0.3)" },
  anger:          { bg: "rgba(239,68,68,0.15)",   text: "#ef4444", glow: "0 0 24px rgba(239,68,68,0.3)" },
  annoyance:      { bg: "rgba(248,113,113,0.15)", text: "#f87171", glow: "0 0 24px rgba(248,113,113,0.3)" },
  approval:       { bg: "rgba(16,185,129,0.15)",  text: "#10b981", glow: "0 0 24px rgba(16,185,129,0.3)" },
  caring:         { bg: "rgba(244,114,182,0.15)", text: "#f472b6", glow: "0 0 24px rgba(244,114,182,0.3)" },
  confusion:      { bg: "rgba(156,163,175,0.15)", text: "#9ca3af", glow: "0 0 24px rgba(156,163,175,0.3)" },
  curiosity:      { bg: "rgba(96,165,250,0.15)",  text: "#60a5fa", glow: "0 0 24px rgba(96,165,250,0.3)" },
  desire:         { bg: "rgba(236,72,153,0.15)",  text: "#ec4899", glow: "0 0 24px rgba(236,72,153,0.3)" },
  disappointment: { bg: "rgba(167,139,250,0.15)", text: "#a78bfa", glow: "0 0 24px rgba(167,139,250,0.3)" },
  disapproval:    { bg: "rgba(251,146,60,0.15)",  text: "#fb923c", glow: "0 0 24px rgba(251,146,60,0.3)" },
  disgust:        { bg: "rgba(132,204,22,0.15)",  text: "#84cc16", glow: "0 0 24px rgba(132,204,22,0.3)" },
  embarrassment:  { bg: "rgba(251,113,133,0.15)", text: "#fb7185", glow: "0 0 24px rgba(251,113,133,0.3)" },
  excitement:     { bg: "rgba(250,204,21,0.15)",  text: "#facc15", glow: "0 0 24px rgba(250,204,21,0.3)" },
  fear:           { bg: "rgba(75,85,99,0.15)",    text: "#4b5563", glow: "0 0 24px rgba(75,85,99,0.3)" },
  gratitude:      { bg: "rgba(5,150,105,0.15)",   text: "#059669", glow: "0 0 24px rgba(5,150,105,0.3)" },
  grief:          { bg: "rgba(31,41,55,0.2)",     text: "#6b7280", glow: "0 0 24px rgba(31,41,55,0.3)" },
  joy:            { bg: "rgba(253,224,71,0.15)",  text: "#fde047", glow: "0 0 24px rgba(253,224,71,0.3)" },
  love:           { bg: "rgba(225,29,72,0.15)",   text: "#e11d48", glow: "0 0 24px rgba(225,29,72,0.3)" },
  nervousness:    { bg: "rgba(217,119,6,0.15)",   text: "#d97706", glow: "0 0 24px rgba(217,119,6,0.3)" },
  optimism:       { bg: "rgba(56,189,248,0.15)",  text: "#38bdf8", glow: "0 0 24px rgba(56,189,248,0.3)" },
  pride:          { bg: "rgba(129,140,248,0.15)", text: "#818cf8", glow: "0 0 24px rgba(129,140,248,0.3)" },
  realization:    { bg: "rgba(14,165,233,0.15)",  text: "#0ea5e9", glow: "0 0 24px rgba(14,165,233,0.3)" },
  relief:         { bg: "rgba(20,184,166,0.15)",  text: "#14b8a6", glow: "0 0 24px rgba(20,184,166,0.3)" },
  remorse:        { bg: "rgba(113,113,122,0.15)", text: "#71717a", glow: "0 0 24px rgba(113,113,122,0.3)" },
  sadness:        { bg: "rgba(59,130,246,0.15)",  text: "#3b82f6", glow: "0 0 24px rgba(59,130,246,0.3)" },
  surprise:       { bg: "rgba(192,132,252,0.15)", text: "#c084fc", glow: "0 0 24px rgba(192,132,252,0.3)" },
  neutral:        { bg: "rgba(156,163,175,0.1)",  text: "#9ca3af", glow: "none" }
};

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  positive: { bg: "rgba(16, 185, 129, 0.2)", text: "#10b981" },
  negative: { bg: "rgba(239, 68, 68, 0.2)", text: "#ef4444" },
  neutral:  { bg: "rgba(156, 163, 175, 0.2)", text: "#9ca3af" }
};

const API_URL = "http://localhost:8001/analyze";

export default function EmotionPage() {
  const [inputText, setInputText] = useState("");
  const [audioFile, setAudioFile] = useState<File | null>(null);
  
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<AnalysisResult[]>([]);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const file = new File([audioBlob], "recording.webm", { type: "audio/webm" });
        setAudioFile(file);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      setError("Microphone access denied or unavailable.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setAudioFile(e.target.files[0]);
    }
  };

  const removeAudio = () => {
    setAudioFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const analyze = async () => {
    if (!inputText.trim() && !audioFile) {
      setError("Please provide either text or an audio file.");
      return;
    }

    setIsLoading(true);
    setError(null);

    const formData = new FormData();
    if (inputText.trim()) formData.append("text", inputText);
    if (audioFile) formData.append("file", audioFile);

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to analyze emotion.");
      }

      const data: AnalysisResult = await response.json();
      setResult(data);
      setHistory((prev) => [data, ...prev].slice(0, 5));
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  const getEmotionStyle = (emotionName: string) => {
    const normalized = emotionName.toLowerCase();
    return EMOTION_COLORS[normalized] || EMOTION_COLORS.neutral;
  };
  
  const getCategoryStyle = (categoryName: string) => {
    const normalized = categoryName.toLowerCase();
    return CATEGORY_COLORS[normalized] || CATEGORY_COLORS.neutral;
  };

  return (
    <main className="model-page">
      <div className="model-bg-blob model-bg-blob--1"></div>
      <div className="model-bg-blob model-bg-blob--2"></div>

      <div className="model-container">
        <header className="model-header">
          <div className="model-header__badge">Vanguard AI</div>
          <h1 className="model-header__title">Emotion Matrix</h1>
          <p className="model-header__desc">
            Dual-modal analysis engine. Powered by Whisper GPU (CUDA) and RoBERTa base.
          </p>
        </header>

        <section className="model-input-section">
          <div className="model-audio-card">
            <h3 className="model-card-title">Acoustic Input</h3>
            
            <div className="model-audio-controls">
              {!isRecording ? (
                <button className="model-btn model-btn--record" onClick={startRecording}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/>
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                    <line x1="12" y1="19" x2="12" y2="22"/>
                  </svg>
                  Initialize Microphone
                </button>
              ) : (
                <button className="model-btn model-btn--stop" onClick={stopRecording}>
                  <div className="model-recording-pulse"></div>
                  Recording [{formatTime(recordingTime)}] - Stop
                </button>
              )}

              <span className="model-audio-divider">OR</span>

              <button className="model-btn model-btn--upload" onClick={() => fileInputRef.current?.click()}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="17 8 12 3 7 8"/>
                  <line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
                Upload Audio (.wav, .mp3)
              </button>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileSelect} 
                accept="audio/*" 
                style={{ display: "none" }} 
              />
            </div>

            {audioFile && (
              <div className="model-audio-preview">
                <div className="model-audio-info">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2">
                    <path d="M9 18V5l12-2v13"/>
                    <circle cx="6" cy="18" r="3"/>
                    <circle cx="18" cy="16" r="3"/>
                  </svg>
                  <span className="model-audio-name">{audioFile.name}</span>
                </div>
                <button className="model-audio-remove" onClick={removeAudio}>✕</button>
              </div>
            )}
          </div>

          <div className="model-text-card">
            <h3 className="model-card-title">Lexical Input (Override)</h3>
            <textarea
              className="model-textarea"
              placeholder="Enter text directly, or leave blank to analyze acoustic transcription..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              rows={4}
            />
          </div>

          {error && (
            <div className="model-error">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              {error}
            </div>
          )}

          <button 
            className={`model-btn-analyze ${isLoading ? "is-loading" : ""}`}
            onClick={analyze}
            disabled={isLoading || (!inputText.trim() && !audioFile)}
          >
            {isLoading ? "Executing Inference..." : "Initialize Analysis"}
          </button>
        </section>

        {result && (
          <section className="model-result-section">
            <div className="model-result-header">
              <h2 className="model-result-title">Inference Results</h2>
            </div>
            
            <div className="model-metrics-grid">
              <div className="model-metric-card model-metric-card--primary" style={{ boxShadow: getEmotionStyle(result.emotion).glow }}>
                <span className="model-metric-label">Primary Emotion</span>
                <div className="model-metric-value" style={{ color: getEmotionStyle(result.emotion).text }}>
                  {result.emotion.toUpperCase()}
                </div>
              </div>
              
              <div className="model-metric-card">
                <span className="model-metric-label">Sentiment Category</span>
                <div 
                  className="model-metric-category" 
                  style={{ 
                    backgroundColor: getCategoryStyle(result.sentiment_category).bg,
                    color: getCategoryStyle(result.sentiment_category).text
                  }}
                >
                  {result.sentiment_category.toUpperCase()}
                </div>
              </div>
              
              <div className="model-metric-card">
                <span className="model-metric-label">Confidence Score</span>
                <div className="model-metric-value">
                  {(result.confidence * 100).toFixed(2)}<span style={{ fontSize: "1rem", color: "#6b7280" }}>%</span>
                </div>
                <div className="model-confidence-bar-bg">
                  <div 
                    className="model-confidence-bar-fill" 
                    style={{ 
                      width: `${result.confidence * 100}%`,
                      backgroundColor: getEmotionStyle(result.emotion).text
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="model-transcript-box">
              <span className="model-transcript-label">Analyzed Sequence</span>
              <p className="model-transcript-text">"{result.input_text}"</p>
              {result.transcribed_text && result.input_text !== result.transcribed_text && (
                 <p className="model-transcript-note">*Sourced via Whisper acoustic transcription</p>
              )}
            </div>
          </section>
        )}

        {history.length > 0 && (
          <section className="model-history-section">
            <h3 className="model-history-title">Recent Inferences</h3>
            <div className="model-history-list">
              {history.map((item, index) => {
                const style = getEmotionStyle(item.emotion);
                const catStyle = getCategoryStyle(item.sentiment_category);
                return (
                  <div key={index} className="model-history-item">
                    <span className="model-history__badge" style={{ background: style.bg, color: style.text }}>
                      {item.emotion}
                    </span>
                    <span className="model-history__cat" style={{ background: catStyle.bg, color: catStyle.text, fontSize: "0.7rem", padding: "2px 6px", borderRadius: "4px", marginLeft: "8px" }}>
                      {item.sentiment_category}
                    </span>
                    <span className="model-history__confidence">{(item.confidence * 100).toFixed(1)}%</span>
                    <span className="model-history__text">{item.input_text.length > 50 ? item.input_text.slice(0, 50) + "…" : item.input_text}</span>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}