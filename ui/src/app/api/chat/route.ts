import { NextResponse } from 'next/server';
import { redis } from '@/lib/redis';
import { streamText } from 'ai';
import { createOllama } from 'ai-sdk-ollama';

const ollama = createOllama({
  baseURL: 'http://localhost:11434',
});

const FASTAPI_URL = 'http://127.0.0.1:8000/transcribe';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const audioBlob = formData.get('audio') as Blob;
    const sessionId = formData.get('sessionId') as string || 'default-session';

    if (!audioBlob) {
      return NextResponse.json({ error: 'No audio provided' }, { status: 400 });
    }

    const fastApiFormData = new FormData();
    fastApiFormData.append('file', audioBlob, 'voice.webm');

    const transcriptionRes = await fetch(FASTAPI_URL, {
      method: 'POST',
      body: fastApiFormData,
    });
    
    const transcriptionData = await transcriptionRes.json();
    const userText = transcriptionData.text;

    if (!userText || userText.trim() === "") {
      return NextResponse.json({ 
        error: 'empty_speech', 
        reply: "I couldn't hear anything. Please press the microphone and try speaking again." 
      });
    }

    const historyRaw = await redis.get(`chat:${sessionId}`);
    let history = historyRaw ? JSON.parse(historyRaw) : [];

    history = history.filter((msg: { role: string }) => msg.role !== 'system');
    history.push({ role: 'user', content: userText });

    const systemPersona = 'You are an elite customer support agent for Zenvixor Studios, specializing in high-performance web development, premium video editing, and modern social media management. Keep your responses crisp, direct, professional, and strictly limited to business offerings.';

    const result = streamText({
      model: ollama('gemma3:4b') as any, 
      system: systemPersona,
      messages: history,     
      onFinish: async (event) => {
        history.push({ role: 'assistant', content: event.text });
        await redis.set(`chat:${sessionId}`, JSON.stringify(history), 'EX', 3600);
      }
    });

    const streamResponse = result.toTextStreamResponse();
    streamResponse.headers.set('x-transcribed-text', encodeURIComponent(userText));
    
    return streamResponse;

  } catch (error) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}