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
  
  const [typedInput, setTypedInput] = useState('');
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const sendPayload = async (formData: FormData, isAudio: boolean) => {
    if (isAudio) {
      setStatusMessage('transcribing');
    } else {
      setStatusMessage('streaming');
    }

    try {
      const res = await fetch('/api/chat', { method: 'POST', body: formData });
      
      if (!res.ok) throw new Error('Network communication failure');

      // Check if response is JSON (e.g. error/empty_speech)
      const contentType = res.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const json = await res.json();
        if (json.error) {
          setMessages(prev => [...prev, { role: 'ai', content: json.reply || json.error }]);
          return;
        }
      }

      if (isAudio) {
        const encodedUserText = res.headers.get('x-transcribed-text');
        if (encodedUserText) {
          const userText = decodeURIComponent(encodedUserText);
          setMessages(prev => [...prev, { role: 'user', content: userText }]);
        }
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
      console.error(error);
    } finally {
      setStreamingText('');
      setStatusMessage('idle');
    }
  };

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
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        
        stream.getTracks().forEach(track => track.stop());

        const formData = new FormData();
        formData.append('audio', audioBlob);
        formData.append('sessionId', 'zenvixor-support-session');

        await sendPayload(formData, true);
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

  const handleSendText = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!typedInput.trim() || statusMessage !== 'idle') return;

    const textToSend = typedInput.trim();
    setTypedInput('');

    // Optimistically show user message
    setMessages(prev => [...prev, { role: 'user', content: textToSend }]);

    const formData = new FormData();
    formData.append('text', textToSend);
    formData.append('sessionId', 'zenvixor-support-session');

    await sendPayload(formData, false);
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
              Welcome to Zenvixor Studios. Type your question or hold the microphone below to talk about our operations.
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

      <div className="p-4 bg-gray-950 border-t border-gray-800">
        <form onSubmit={handleSendText} className="w-full flex gap-3 items-center">
          <input
            type="text"
            value={typedInput}
            onChange={(e) => setTypedInput(e.target.value)}
            disabled={statusMessage !== 'idle' && statusMessage !== 'recording'}
            placeholder={isRecording ? "Recording audio..." : "Type a message or hold the mic..."}
            className="flex-1 bg-gray-900 border border-gray-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 rounded-xl px-4 py-3 text-white placeholder-gray-500 outline-none text-sm transition-all duration-200 disabled:opacity-55"
          />
          
          <button
            type="submit"
            disabled={statusMessage !== 'idle' || !typedInput.trim()}
            className="px-5 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold transition-all duration-200 disabled:opacity-40 disabled:hover:scale-100 hover:scale-[1.02] active:scale-95 shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <span>Send</span>
            <span>✈️</span>
          </button>

          <div className="h-8 w-[1px] bg-gray-800 mx-1 flex-shrink-0" />

          <button
            type="button"
            onMouseDown={startRecording}
            onMouseUp={stopRecording}
            onTouchStart={startRecording}
            onTouchEnd={stopRecording}
            disabled={statusMessage !== 'idle' && statusMessage !== 'recording'}
            className={`px-5 py-3 rounded-xl font-semibold text-sm transition-all duration-200 transform select-none cursor-pointer flex items-center gap-2 flex-shrink-0 ${
              isRecording 
                ? 'bg-red-500 text-white scale-95 shadow-inner ring-4 ring-red-500/20 animate-pulse' 
                : 'bg-gray-800 text-gray-200 hover:bg-gray-700 hover:scale-[1.02] shadow-md border border-gray-700/50'
            } ${(statusMessage !== 'idle' && statusMessage !== 'recording') ? 'opacity-40 cursor-not-allowed' : ''}`}
            title={isRecording ? 'Release to Transcribe' : 'Hold to Speak'}
          >
            <span>🎙️</span>
            <span className="hidden sm:inline">{isRecording ? 'Release to Send' : 'Hold to Speak'}</span>
          </button>
        </form>
      </div>
    </div>
  );
};