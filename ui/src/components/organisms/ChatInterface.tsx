'use client';

import { useState, useRef } from 'react';
import { ChatBubble } from '../atoms/ChatBubble';

export const ChatInterface = () => {
  const [messages, setMessages] = useState<{role: 'user'|'ai', content: string}[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
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
        setIsProcessing(true);
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        
        // Stop all tracks to release the mic
        stream.getTracks().forEach(track => track.stop());

        // Send to Next.js Backend
        const formData = new FormData();
        formData.append('audio', audioBlob);
        formData.append('sessionId', 'user-session-123'); // In production, generate a UUID

        try {
          const res = await fetch('/api/chat', { method: 'POST', body: formData });
          const data = await res.json();
          
          if (data.userText && data.aiReply) {
            setMessages(prev => [
              ...prev, 
              { role: 'user', content: data.userText },
              { role: 'ai', content: data.aiReply }
            ]);
          }
        } catch (error) {
          console.error("Error communicating with backend:", error);
        } finally {
          setIsProcessing(false);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error("Microphone access denied:", error);
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
      {/* Chat History Area */}
      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
        {messages.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            <p>Tap the microphone and start speaking to the agent...</p>
          </div>
        ) : (
          messages.map((msg, idx) => <ChatBubble key={idx} role={msg.role} content={msg.content} />)
        )}
        {isProcessing && (
          <div className="self-start bg-gray-800 text-gray-400 p-4 rounded-xl rounded-bl-sm animate-pulse">
            Agent is thinking...
          </div>
        )}
      </div>

      {/* Control Area */}
      <div className="p-6 bg-gray-950 border-t border-gray-800 flex justify-center">
        <button
          onMouseDown={startRecording}
          onMouseUp={stopRecording}
          onTouchStart={startRecording}
          onTouchEnd={stopRecording}
          disabled={isProcessing}
          className={`px-8 py-4 rounded-full font-bold text-white transition-all transform select-none ${
            isRecording 
              ? 'bg-red-500 scale-95 shadow-inner' 
              : 'bg-indigo-600 hover:bg-indigo-500 hover:scale-105 shadow-lg shadow-indigo-500/25'
          } ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {isRecording ? '🎙️ Release to Send' : '🎙️ Hold to Speak'}
        </button>
      </div>
    </div>
  );
};