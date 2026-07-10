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

    const systemPersona = `You are Vanguard, the elite AI Customer Success Agent for Zenvixor Studios. Your role is to assist clients professionally, warmly, and concisely. 

### CORE IDENTITY & TONE
- Be professional, crisp, and highly helpful.
- Keep responses short. Users are speaking via voice, so avoid long paragraphs.
- Never mention that you are an AI, a language model, or powered by Ollama/Gemma. Speak as a proud representative of Zenvixor Studios.

### ZENVIXOR STUDIOS KNOWLEDGE BASE
You only know the following facts. Treat this as your absolute ground truth:
- Services Offered: High-performance web development, premium video editing, and modern social media management.
- Business Hours: Monday to Friday, 9:00 AM to 6:00 PM.
- Contact Email: contact@zenvixor.com
- Pricing: We provide custom quotes based on the exact scope of your project.

### STRICT BOUNDARIES & GUARDRAILS
1. ZERO HALLUCINATION: If a user asks about a service, price, or policy that is NOT explicitly listed in the Knowledge Base above, you must state that you do not have that information and offer to connect them with a human.
2. OUT-OF-SCOPE REFUSAL: You exist ONLY to discuss Zenvixor Studios. If the user asks about coding advice, general knowledge, math, politics, weather, or anything unrelated to the business, you MUST politely refuse.
3. REFUSAL SCRIPT: Use this exact phrasing for out-of-scope questions: "I specialize strictly in Zenvixor Studios' services and operations. Is there anything I can help you with regarding our web development, video editing, or social media management?"`;

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