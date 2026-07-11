import { NextResponse } from 'next/server';
import { redis } from '@/lib/redis';
import { streamText } from 'ai';
import { createOllama } from 'ai-sdk-ollama';
import { ChromaClient } from 'chromadb';

const ollama = createOllama({
  baseURL: 'http://localhost:11434',
});

// const chroma = new ChromaClient({ path: "http://localhost:8001" });
const FASTAPI_URL = 'http://127.0.0.1:8000/transcribe';

const chroma = new ChromaClient({ host: "localhost", port: 8001 });

async function getRelevantContext(userText: string) {
  try {
    const embedResponse = await fetch('http://localhost:11434/api/embeddings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        model: 'nomic-embed-text', 
        prompt: userText 
      })
    });
    
    const embedData = await embedResponse.json();
    const queryVector = embedData.embedding;

    const collection = await chroma.getCollection({ name: "zenvixor_services" });
    const results = await collection.query({
      queryEmbeddings: [queryVector],
      nResults: 3,
    });

    const distances = results.distances?.[0] || [];
    const documents = results.documents?.[0] || [];
    
    let validContext = "";
    
    // We can bump this slightly to 1.4 to account for Whisper mishearing words
    const DISTANCE_THRESHOLD = 1.4; 

    // ADDED: Console log to help you debug the actual math scores!
    console.log("Transcribed Text:", userText);
    console.log("Vector Distances:", distances);

    // FIXED: Strict TypeScript null checks
    for (let i = 0; i < distances.length; i++) {
      const dist = distances[i];
      const doc = documents[i];

      if (dist !== null && dist !== undefined && doc !== null && doc !== undefined) {
        if (dist < DISTANCE_THRESHOLD) {
          validContext += doc + "\n\n";
        }
      }
    }

    return validContext.trim();
  } catch (error) {
    console.error("RAG Error:", error);
    return "";
  }
}

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

    const retrievedDocs = await getRelevantContext(userText);

    let systemPersona = `You are Vanguard, the elite AI Customer Success Agent for Zenvixor Studios. Your role is to assist clients professionally and concisely.`;

    if (retrievedDocs) {
      systemPersona += `\n\n### BUSINESS CONTEXT\nUse the following retrieved company documents to answer the user's question. \nCRITICAL RULE: You must base your answer strictly on the text below. Do not invent pricing, services, or facts. \nIf the answer cannot be found in this text, say exactly: "I do not have that specific information on hand, let me connect you with a human agent."\n\n---\n${retrievedDocs}\n---`;
    } else {
      systemPersona += `\n\n### BUSINESS CONTEXT\nNo relevant company documents were found for this query. \nCRITICAL RULE: You must politely inform the user that this topic is outside your current knowledge base and offer to connect them with a human agent. Do not attempt to answer the question.`;
    }

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