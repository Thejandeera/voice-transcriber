import { NextResponse } from 'next/server';
import { redis } from '@/lib/redis';
import ollama from 'ollama';

const FASTAPI_URL = 'http://127.0.0.1:8000/transcribe';

export async function POST(req: Request) {
  try {
    // 1. Receive data from the frontend
    const formData = await req.formData();
    const audioBlob = formData.get('audio') as Blob;
    const sessionId = formData.get('sessionId') as string || 'default-session';

    if (!audioBlob) {
      return NextResponse.json({ error: 'No audio provided' }, { status: 400 });
    }

    // 2. Forward the audio file to your FastAPI microservice
    const fastApiFormData = new FormData();
    fastApiFormData.append('file', audioBlob, 'voice.webm');

    const transcriptionRes = await fetch(FASTAPI_URL, {
      method: 'POST',
      body: fastApiFormData,
    });
    
    const transcriptionData = await transcriptionRes.json();
    const userText = transcriptionData.text;

    if (!userText) {
      return NextResponse.json({ reply: "I didn't quite catch that." });
    }

    // 3. Retrieve conversation history from Redis
    const historyRaw = await redis.get(`chat:${sessionId}`);
    let history = historyRaw ? JSON.parse(historyRaw) : [];

    // 4. Inject the System Persona if it's a new conversation
    if (history.length === 0) {
      history.push({
        role: 'system',
        content: 'You are a highly professional customer support agent for Zenvixor Studios, a startup focused on web development, video editing, and social media management. Keep answers concise, helpful, and strictly related to the business.'
      });
    }

    // Append the user's transcribed text
    history.push({ role: 'user', content: userText });

    // 5. Query Ollama with the full context
    const response = await ollama.chat({
      model: 'llama3.2:1b', // Ensure this matches your local model
      messages: history,
    });
    
    const aiReply = response.message.content;

    // Append AI reply to history
    history.push({ role: 'assistant', content: aiReply });

    // 6. Save the updated history back to Redis (Expires in 1 hour)
    await redis.set(`chat:${sessionId}`, JSON.stringify(history), 'EX', 3600);

    // 7. Return the data to the UI
    return NextResponse.json({ userText, aiReply });

  } catch (error) {
    console.error("Gateway Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}