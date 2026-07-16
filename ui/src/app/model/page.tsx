"use client";

import { useState, useRef, useEffect } from "react";
import "./model.css";

interface AnalysisResult {
  text: string;
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

const DEFAULT_EMOTION_STYLE = { bg: "rgba(99,102,241,0.15)", text: "#818cf8", glow: "0 0 24px rgba(99,102,241,0.3)" };

function getEmotionStyle(emotion: string) {
  return EMOTION_COLORS[emotion.toLowerCase()] ?? DEFAULT_EMOTION_STYLE;
}

export default function ModelPage() {
  const [isRecording, setIsRecording] = useState(false);
  const [livePartialText, setLivePartialText] = useState("");
  const [analyzedSentences, setAnalyzedSentences] = useState<AnalysisResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  const startLiveStream = async () => {
    try {
      setError(null);
      setLivePartialText("");
      setAnalyzedSentences([]);

      wsRef.current = new WebSocket("ws://localhost:8001/live-stream");
      
      wsRef.current.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === "partial") {
          setLivePartialText(data.text);
        } else if (data.type === "analyzed") {
          setAnalyzedSentences((prev) => [...prev, data]);
          setLivePartialText(""); 
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Initialize AudioContext to extract raw PCM data (16kHz is ideal for Whisper)
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      audioContextRef.current = audioContext;
      
      const source = audioContext.createMediaStreamSource(stream);
      // Create a processor to grab chunks of audio (4096 buffer size)
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      source.connect(processor);
      processor.connect(audioContext.destination);

      processor.onaudioprocess = (e) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          // Grab the raw audio data (Float32Array)
          const float32Array = e.inputBuffer.getChannelData(0);
          
          // Convert it to Int16 (Standard raw audio format)
          const int16Array = new Int16Array(float32Array.length);
          for (let i = 0; i < float32Array.length; i++) {
            const s = Math.max(-1, Math.min(1, float32Array[i]));
            int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
          }
          
          // Send the raw binary data
          wsRef.current.send(int16Array.buffer);
        }
      };

      setIsRecording(true);

    } catch (err: any) {
      console.error("Error accessing microphone:", err);
      setError("Microphone access denied or connection failed.");
    }
  };

  const stopLiveStream = () => {
    setIsRecording(false);
    
    if (processorRef.current && audioContextRef.current) {
      processorRef.current.disconnect();
      audioContextRef.current.close();
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }

    if (wsRef.current) {
      wsRef.current.close();
    }
  };

  return (
    <main className="model-page">
      <div className="model-bg-blob model-bg-blob--1" />
      <div className="model-bg-blob model-bg-blob--2" />
      
      <div className="model-container">
        <header className="model-header">
          <div className="model-header__badge">Vanguard AI · Live Stream</div>
          <h1 className="model-header__title">Live Emotion Matrix</h1>
          <p className="model-header__subtitle">
            Speak into the microphone. Transcriptions and emotional analysis occur in real-time.
          </p>
        </header>

        <section className="model-input-section" style={{ alignItems: "center" }}>
          {error && <div className="model-error"><span>⚠</span> {error}</div>}
          
          {!isRecording ? (
             <button className="model-btn-analyze" onClick={startLiveStream} style={{ width: "100%" }}>
                Initialize Live Microphone
             </button>
          ) : (
             <button className="model-btn" onClick={stopLiveStream} style={{ background: "rgba(239,68,68,0.2)", color: "#f87171", border: "1px solid rgba(239,68,68,0.4)", width: "100%" }}>
                Stop Live Analysis
             </button>
          )}
        </section>

        {(analyzedSentences.length > 0 || livePartialText) && (
          <section className="model-result-section" style={{ minHeight: "300px" }}>
            <h3 className="model-result-title" style={{ fontSize: "1.2rem", textAlign: "left", marginBottom: "1rem" }}>Live Inference Feed</h3>
            
            <div className="model-live-feed">
              {analyzedSentences.map((block, idx) => {
                const style = getEmotionStyle(block.emotion);
                return (
                  <span 
                    key={idx} 
                    className="model-analyzed-block"
                    style={{ 
                      borderBottom: `2px solid ${style.text}`,
                      backgroundColor: style.bg,
                      color: "#e2e8f0"
                    }}
                    title={`${block.emotion.toUpperCase()} (${(block.confidence * 100).toFixed(1)}%)`}
                  >
                    {block.text}{" "}
                  </span>
                );
              })}
              
              {livePartialText && (
                <span className="model-partial-text">
                  {livePartialText}...
                </span>
              )}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}