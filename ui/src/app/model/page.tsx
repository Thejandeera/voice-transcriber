"use client";

import { useState, useRef, useCallback } from "react";
import "./model.css";

interface AnalysisResult {
  input_text: string;
  transcribed_text: string | null;
  emotion: string;
  confidence: number;
}

// Curated emotion color map for the 28 GoEmotions labels
const EMOTION_COLORS: Record<string, { bg: string; text: string; glow: string }> = {
  admiration:     { bg: "rgba(251,191,36,0.15)",  text: "#fbbf24", glow: "0 0 24px rgba(251,191,36,0.3)" },
  amusement:      { bg: "rgba(52,211,153,0.15)",  text: "#34d399", glow: "0 0 24px rgba(52,211,153,0.3)" },
  anger:          { bg: "rgba(239,68,68,0.18)",    text: "#ef4444", glow: "0 0 24px rgba(239,68,68,0.35)" },
  annoyance:      { bg: "rgba(249,115,22,0.15)",   text: "#f97316", glow: "0 0 24px rgba(249,115,22,0.3)" },
  approval:       { bg: "rgba(34,197,94,0.15)",    text: "#22c55e", glow: "0 0 24px rgba(34,197,94,0.3)" },
  caring:         { bg: "rgba(236,72,153,0.15)",   text: "#ec4899", glow: "0 0 24px rgba(236,72,153,0.3)" },
  confusion:      { bg: "rgba(168,85,247,0.15)",   text: "#a855f7", glow: "0 0 24px rgba(168,85,247,0.3)" },
  curiosity:      { bg: "rgba(59,130,246,0.15)",   text: "#3b82f6", glow: "0 0 24px rgba(59,130,246,0.3)" },
  desire:         { bg: "rgba(244,63,94,0.15)",    text: "#f43f5e", glow: "0 0 24px rgba(244,63,94,0.3)" },
  disappointment: { bg: "rgba(107,114,128,0.15)",  text: "#9ca3af", glow: "0 0 24px rgba(107,114,128,0.3)" },
  disapproval:    { bg: "rgba(239,68,68,0.12)",    text: "#f87171", glow: "0 0 24px rgba(239,68,68,0.25)" },
  disgust:        { bg: "rgba(132,204,22,0.15)",   text: "#84cc16", glow: "0 0 24px rgba(132,204,22,0.3)" },
  embarrassment:  { bg: "rgba(251,146,60,0.15)",   text: "#fb923c", glow: "0 0 24px rgba(251,146,60,0.3)" },
  excitement:     { bg: "rgba(234,179,8,0.18)",    text: "#eab308", glow: "0 0 24px rgba(234,179,8,0.35)" },
  fear:           { bg: "rgba(168,85,247,0.18)",   text: "#c084fc", glow: "0 0 24px rgba(168,85,247,0.35)" },
  gratitude:      { bg: "rgba(45,212,191,0.15)",   text: "#2dd4bf", glow: "0 0 24px rgba(45,212,191,0.3)" },
  grief:          { bg: "rgba(75,85,99,0.18)",     text: "#9ca3af", glow: "0 0 24px rgba(75,85,99,0.3)" },
  joy:            { bg: "rgba(250,204,21,0.18)",   text: "#facc15", glow: "0 0 24px rgba(250,204,21,0.35)" },
  love:           { bg: "rgba(244,63,94,0.18)",    text: "#fb7185", glow: "0 0 24px rgba(244,63,94,0.35)" },
  nervousness:    { bg: "rgba(251,191,36,0.12)",   text: "#fcd34d", glow: "0 0 24px rgba(251,191,36,0.25)" },
  optimism:       { bg: "rgba(34,211,238,0.15)",   text: "#22d3ee", glow: "0 0 24px rgba(34,211,238,0.3)" },
  pride:          { bg: "rgba(168,85,247,0.15)",   text: "#a78bfa", glow: "0 0 24px rgba(168,85,247,0.3)" },
  realization:    { bg: "rgba(96,165,250,0.15)",   text: "#60a5fa", glow: "0 0 24px rgba(96,165,250,0.3)" },
  relief:         { bg: "rgba(52,211,153,0.18)",   text: "#6ee7b7", glow: "0 0 24px rgba(52,211,153,0.35)" },
  remorse:        { bg: "rgba(107,114,128,0.18)",  text: "#d1d5db", glow: "0 0 24px rgba(107,114,128,0.35)" },
  sadness:        { bg: "rgba(59,130,246,0.18)",   text: "#93c5fd", glow: "0 0 24px rgba(59,130,246,0.35)" },
  surprise:       { bg: "rgba(251,191,36,0.18)",   text: "#fde68a", glow: "0 0 24px rgba(251,191,36,0.35)" },
  neutral:        { bg: "rgba(148,163,184,0.12)",  text: "#94a3b8", glow: "0 0 24px rgba(148,163,184,0.25)" },
};

const DEFAULT_EMOTION_STYLE = { bg: "rgba(99,102,241,0.15)", text: "#818cf8", glow: "0 0 24px rgba(99,102,241,0.3)" };

function getEmotionStyle(emotion: string) {
  return EMOTION_COLORS[emotion.toLowerCase()] ?? DEFAULT_EMOTION_STYLE;
}

export default function ModelPage() {
  const [textInput, setTextInput] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [history, setHistory] = useState<AnalysisResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const ACCEPTED_AUDIO = ".wav,.mp3,.ogg,.webm,.m4a,.flac,.aac,.wma,.opus";

  /* ---- Drag & drop handlers ---- */
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);
  const handleDragLeave = useCallback(() => setIsDragOver(false), []);
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) { setSelectedFile(file); setError(null); }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { setSelectedFile(file); setError(null); }
  };

  const clearFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  /* ---- Submit to backend ---- */
  const handleAnalyze = async () => {
    if (!textInput.trim() && !selectedFile) {
      setError("Please enter text or upload an audio file first.");
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      if (selectedFile) formData.append("file", selectedFile);
      if (textInput.trim()) formData.append("text", textInput.trim());

      const res = await fetch("http://localhost:8001/analyze", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => null);
        throw new Error(errBody?.detail ?? `Server error ${res.status}`);
      }

      const data: AnalysisResult = await res.json();
      setResult(data);
      setHistory((prev) => [data, ...prev]);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "An unexpected error occurred.";
      setError(message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleClearAll = () => {
    setTextInput("");
    clearFile();
    setResult(null);
    setError(null);
  };

  const emotionStyle = result ? getEmotionStyle(result.emotion) : null;

  return (
    <main className="model-page">
      {/* Animated background blobs */}
      <div className="model-bg-blob model-bg-blob--1" />
      <div className="model-bg-blob model-bg-blob--2" />
      <div className="model-bg-blob model-bg-blob--3" />

      <div className="model-container">
        {/* Header */}
        <header className="model-header">
          <div className="model-header__badge">RoBERTa · 28 Emotions</div>
          <h1 className="model-header__title">Emotion Analyzer</h1>
          <p className="model-header__subtitle">
            Type a message or upload a voice file — the AI will detect the
            underlying emotion with confidence scoring.
          </p>
        </header>

        {/* Input card */}
        <section className="model-card">
          {/* Text input */}
          <label htmlFor="emotion-text-input" className="model-label">
            Text Message
          </label>
          <textarea
            id="emotion-text-input"
            className="model-textarea"
            rows={3}
            placeholder="e.g. Thank you so much for your help today, you really saved us!"
            value={textInput}
            onChange={(e) => { setTextInput(e.target.value); setError(null); }}
            disabled={isAnalyzing}
          />

          {/* Divider */}
          <div className="model-divider">
            <span className="model-divider__line" />
            <span className="model-divider__text">OR</span>
            <span className="model-divider__line" />
          </div>

          {/* File upload zone */}
          <label htmlFor="emotion-file-input" className="model-label">
            Upload Audio File
          </label>
          <div
            className={`model-dropzone ${isDragOver ? "model-dropzone--active" : ""} ${selectedFile ? "model-dropzone--has-file" : ""}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              id="emotion-file-input"
              type="file"
              accept={ACCEPTED_AUDIO}
              className="model-dropzone__input"
              onChange={handleFileSelect}
            />
            {selectedFile ? (
              <div className="model-dropzone__file-info">
                <span className="model-dropzone__file-icon">🎵</span>
                <span className="model-dropzone__file-name">{selectedFile.name}</span>
                <button
                  type="button"
                  className="model-dropzone__remove"
                  onClick={(e) => { e.stopPropagation(); clearFile(); }}
                >
                  ✕
                </button>
              </div>
            ) : (
              <>
                <span className="model-dropzone__icon">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                </span>
                <p className="model-dropzone__text">
                  Drag &amp; drop an audio file here, or <span className="model-dropzone__browse">browse</span>
                </p>
                <p className="model-dropzone__hint">WAV, MP3, OGG, WebM, M4A, FLAC, AAC</p>
              </>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="model-error">
              <span>⚠</span> {error}
            </div>
          )}

          {/* Actions */}
          <div className="model-actions">
            <button
              id="analyze-button"
              className="model-btn model-btn--primary"
              onClick={handleAnalyze}
              disabled={isAnalyzing || (!textInput.trim() && !selectedFile)}
            >
              {isAnalyzing ? (
                <>
                  <span className="model-spinner" />
                  Analyzing…
                </>
              ) : (
                "Analyze Emotion"
              )}
            </button>
            <button
              id="clear-button"
              type="button"
              className="model-btn model-btn--ghost"
              onClick={handleClearAll}
              disabled={isAnalyzing}
            >
              Clear
            </button>
          </div>
        </section>

        {/* Result card */}
        {result && emotionStyle && (
          <section
            className="model-result"
            style={{
              borderColor: emotionStyle.text,
              boxShadow: emotionStyle.glow,
            }}
          >
            <div className="model-result__header">
              <span className="model-result__tag" style={{ background: emotionStyle.bg, color: emotionStyle.text }}>
                Predicted Emotion
              </span>
            </div>

            <h2 className="model-result__emotion" style={{ color: emotionStyle.text }}>
              {result.emotion.toUpperCase()}
            </h2>

            {/* Confidence bar */}
            <div className="model-confidence">
              <div className="model-confidence__label">
                <span>Confidence</span>
                <span style={{ color: emotionStyle.text }}>{(result.confidence * 100).toFixed(1)}%</span>
              </div>
              <div className="model-confidence__track">
                <div
                  className="model-confidence__fill"
                  style={{
                    width: `${result.confidence * 100}%`,
                    background: `linear-gradient(90deg, ${emotionStyle.text}88, ${emotionStyle.text})`,
                    boxShadow: emotionStyle.glow,
                  }}
                />
              </div>
            </div>

            {/* Transcribed text (if audio was uploaded) */}
            {result.transcribed_text && (
              <div className="model-result__transcript">
                <span className="model-result__transcript-label">Transcribed Text</span>
                <p className="model-result__transcript-text">&ldquo;{result.transcribed_text}&rdquo;</p>
              </div>
            )}

            {/* Input text */}
            <div className="model-result__input-section">
              <span className="model-result__transcript-label">Analyzed Text</span>
              <p className="model-result__transcript-text">&ldquo;{result.input_text}&rdquo;</p>
            </div>
          </section>
        )}

        {/* History */}
        {history.length > 1 && (
          <section className="model-history">
            <h3 className="model-history__title">Previous Results</h3>
            <div className="model-history__list">
              {history.slice(1).map((item, idx) => {
                const style = getEmotionStyle(item.emotion);
                return (
                  <div key={idx} className="model-history__item">
                    <span className="model-history__emotion" style={{ background: style.bg, color: style.text }}>
                      {item.emotion}
                    </span>
                    <span className="model-history__confidence">{(item.confidence * 100).toFixed(1)}%</span>
                    <span className="model-history__text">{item.input_text.length > 60 ? item.input_text.slice(0, 60) + "…" : item.input_text}</span>
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
