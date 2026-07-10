'use client';

import { useState, useRef } from 'react';
import { ChatBubble } from '../atoms/ChatBubble';

interface MessagePayload {
  role: 'user' | 'ai';
  content: string;
}

export const ChatInterface = () => {
  const [messages, setMessages] = useState<MessagePayload[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [statusMessage, setStatusMessage] = useState<'idle' | 'recording' | 'transcribing' | 'streaming'>('idle');
  const [streamingText, setStreamingText] = useState('');
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        setStatusMessage('transcribing');
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        
        stream.getTracks().forEach(track => track.stop());

        const formData = new FormData();
        formData.append('audio', audioBlob);
        formData.append('sessionId', 'zenvixor-support-session');

        try {
          const res = await fetch('/api/chat', { method: 'POST', body: formData });
          
          if (!res.ok) throw new Error('Network communication failure');

          const encodedUserText = res.headers.get('x-transcribed-text');
          if (encodedUserText) {
            const userText = decodeURIComponent(encodedUserText);
            setMessages(prev => [...prev, { role: 'user', content: userText }]);
          }

          const reader = res.body?.getReader();
          const decoder = new TextDecoder();
          if (!reader) return;

          setStatusMessage('streaming');
          let textAccumulator = '';

          while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            textAccumulator += decoder.decode(value, { stream: true });
            setStreamingText(textAccumulator);
          }

          if (textAccumulator) {
            setMessages(prev => [...prev, { role: 'ai', content: textAccumulator }]);
          }

        } catch (error) {
        } finally {
          setStreamingText('');
          setStatusMessage('idle');
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setStatusMessage('recording');
    } catch (error) {
      setStatusMessage('idle');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  return (
    <div className="flex flex-col w-full max-w-3xl mx-auto h-[80vh] bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden shadow-2xl">
      
      <div className="px-6 py-2 bg-gray-950 border-b border-gray-800 flex items-center justify-between text-xs text-gray-400 font-mono tracking-wider">
        <span>SERVICE NODE: OLLAMA@GEMMA3</span>
        <span className="flex items-center gap-2">
          {statusMessage === 'recording' && <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />}
          {statusMessage === 'transcribing' && <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />}
          {statusMessage === 'streaming' && <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />}
          {statusMessage.toUpperCase()}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
        {messages.length === 0 && !streamingText && (
          <div className="flex-1 flex items-center justify-center text-gray-500 text-center">
            <p className="max-w-xs text-sm leading-relaxed">
              Welcome to Zenvixor Studios. Hold the microphone below to ask a question about our operations.
            </p>
          </div>
        )}

        {messages.map((msg, idx) => (
          <ChatBubble key={idx} role={msg.role} content={msg.content} />
        ))}

        {streamingText && (
          <ChatBubble role="ai" content={streamingText} />
        )}

        {statusMessage === 'transcribing' && (
          <div className="self-start bg-gray-800 text-gray-400 p-4 rounded-xl rounded-bl-sm animate-pulse text-xs tracking-wide">
            🎙️ Whisper parsing voice file...
          </div>
        )}
      </div>

      <div className="p-6 bg-gray-950 border-t border-gray-800 flex justify-center items-center">
        <button
          onMouseDown={startRecording}
          onMouseUp={stopRecording}
          onTouchStart={startRecording}
          onTouchEnd={stopRecording}
          disabled={statusMessage !== 'idle' && statusMessage !== 'recording'}
          className={`px-10 py-4 rounded-full font-bold text-white transition-all transform select-none cursor-pointer ${
            isRecording 
              ? 'bg-red-500 scale-95 shadow-inner ring-4 ring-red-500/20' 
              : 'bg-indigo-600 hover:bg-indigo-500 hover:scale-105 shadow-lg shadow-indigo-500/25'
          } ${(statusMessage !== 'idle' && statusMessage !== 'recording') ? 'opacity-40 cursor-not-allowed' : ''}`}
        >
          {isRecording ? '🎙️ Release to Transcribe' : '🎙️ Hold to Talk'}
        </button>
      </div>
    </div>
  );
};