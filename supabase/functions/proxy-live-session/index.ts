import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { GoogleGenAI, Modality, FunctionDeclaration, Type } from '@google/genai';
import OpenAI from 'openai';
import { corsHeaders } from '../_shared/cors.ts';

// --- DECRYPTION HELPERS ---
async function getKey(secret: string): Promise<CryptoKey> {
  const keyData = new TextEncoder().encode(secret);
  return await crypto.subtle.importKey('raw', keyData, { name: 'AES-GCM' }, false, ['decrypt']);
}

async function decrypt(encryptedData: string, secret: string): Promise<string> {
  const key = await getKey(secret);
  const data = new Uint8Array(atob(encryptedData).split('').map(c => c.charCodeAt(0)));
  const iv = data.slice(0, 12);
  const encrypted = data.slice(12);
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, encrypted);
  return new TextDecoder().decode(decrypted);
}

// --- AUDIO PROCESSING HELPERS (FOR OPENAI) ---
function pcmToWav(pcmData: ArrayBuffer): Blob {
  const sampleRate = 16000;
  const numChannels = 1;
  const bytesPerSample = 2; // 16-bit
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = pcmData.byteLength;
  const chunkSize = 36 + dataSize;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  // RIFF header
  view.setUint32(0, 0x52494646, false); // "RIFF"
  view.setUint32(4, chunkSize, true);
  view.setUint32(8, 0x57415645, false); // "WAVE"
  // "fmt " sub-chunk
  view.setUint32(12, 0x666d7420, false); // "fmt "
  view.setUint32(16, 16, true); // Sub-chunk size
  view.setUint16(20, 1, true); // Audio format (1 for PCM)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bytesPerSample * 8, true); // Bits per sample
  // "data" sub-chunk
  view.setUint32(36, 0x64617461, false); // "data"
  view.setUint32(40, dataSize, true);

  new Uint8Array(buffer, 44).set(new Uint8Array(pcmData));

  return new Blob([buffer], { type: 'audio/wav' });
}


// --- SHARED TOOL/FUNCTION DECLARATIONS ---
// Gemini format
const geminiFunctionDeclarations: FunctionDeclaration[] = [
    { name: 'createReminder', description: 'Creates a reminder', parameters: { type: Type.OBJECT, properties: { task: { type: Type.STRING }, dueDate: { type: Type.STRING }, dueTime: { type: Type.STRING }, priority: { type: Type.STRING } }, required: ['task'] } },
    { name: 'saveNote', description: 'Saves a note', parameters: { type: Type.OBJECT, properties: { content: { type: Type.STRING } }, required: ['content'] } },
    { name: 'searchNotes', description: 'Searches notes', parameters: { type: Type.OBJECT, properties: { query: { type: Type.STRING } }, required: ['query'] } },
    { name: 'addShoppingListItem', description: 'Adds to shopping list', parameters: { type: Type.OBJECT, properties: { item: { type: Type.STRING }, quantity: { type: Type.NUMBER } }, required: ['item'] } },
    { name: 'removeShoppingListItem', description: 'Removes from shopping list', parameters: { type: Type.OBJECT, properties: { item: { type: Type.STRING } }, required: ['item'] } },
    { name: 'getCalendarEvents', description: 'Gets calendar events', parameters: { type: Type.OBJECT, properties: { date: { type: Type.STRING } } } },
];
// OpenAI format
const openAIFunctionDeclarations: OpenAI.Chat.Completions.ChatCompletionTool[] = geminiFunctionDeclarations.map(f => ({
    type: 'function',
    function: {
        name: f.name,
        description: f.description,
        parameters: {
            type: 'object',
            properties: Object.fromEntries(Object.entries(f.parameters.properties!).map(([key, val]) => [key, { type: (val.type as string).toLowerCase(), description: val.description }])),
            required: f.parameters.required || [],
        },
    },
}));


// --- MAIN SERVER LOGIC ---
(Deno as any).serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const { socket: clientWs, response } = (Deno as any).upgradeWebSocket(req);
  
  let user: any = null;
  let apiKey: string | null = null;
  let provider: 'gemini' | 'openai' | 'anthropic' = 'gemini';
  let geminiSession: any = null;
  let openAIClient: OpenAI | null = null;
  
  let audioBuffer: Array<ArrayBuffer> = [];
  // FIX: setTimeout in Deno returns a Timeout object, not a number. Changed type to `any`.
  let silenceTimeout: any | null = null;

  const cleanup = () => {
    geminiSession?.close();
    geminiSession = null;
    openAIClient = null;
    audioBuffer = [];
    if (silenceTimeout) clearTimeout(silenceTimeout);
  };

  clientWs.onopen = () => console.log('Client WebSocket connected');

  clientWs.onmessage = async (event) => {
    const message = JSON.parse(event.data);

    if (message.type === 'auth') {
      try {
        const supabaseClient = createClient(
          (Deno as any).env.get('SUPABASE_URL') ?? '',
          (Deno as any).env.get('SUPABASE_ANON_KEY') ?? '',
          { global: { headers: { Authorization: `Bearer ${message.token}` } } }
        );

        const { data: { user: authUser } } = await supabaseClient.auth.getUser();
        if (!authUser) throw new Error('Authentication failed.');
        user = authUser;

        const serviceClient = createClient(
            (Deno as any).env.get('SUPABASE_URL') ?? '',
            (Deno as any).env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        const { data: profile, error: profileError } = await serviceClient
            .from('profiles')
            .select('encrypted_api_key, llm_provider')
            .eq('id', user.id)
            .single();
        
        if (profileError || !profile || !profile.encrypted_api_key) {
             throw new Error("API key not found. Please set it in your profile.");
        }
        
        provider = profile.llm_provider || 'gemini';
        
        const encryptionKey = (Deno as any).env.get('ENCRYPTION_KEY');
        if (!encryptionKey) throw new Error("Server config error: ENCRYPTION_KEY not set.");
        
        apiKey = await decrypt(profile.encrypted_api_key, encryptionKey);

        // --- Provider-specific setup ---
        if (provider === 'gemini') {
            const ai = new GoogleGenAI({ apiKey });
            geminiSession = await ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                callbacks: {
                    onopen: () => clientWs.send(JSON.stringify({ type: 'connectionReady' })),
                    onmessage: (msg: any) => {
                       if (msg.toolCall) {
                         for (const fc of msg.toolCall.functionCalls) { clientWs.send(JSON.stringify({ type: 'toolCall', payload: fc })); }
                       }
                       if (msg.serverContent?.inputTranscription) {
                         clientWs.send(JSON.stringify({ type: 'transcription', payload: { ...msg.serverContent.inputTranscription, speaker: 'user', kind: 'input' } }));
                       }
                       if (msg.serverContent?.outputTranscription) {
                         clientWs.send(JSON.stringify({ type: 'transcription', payload: { ...msg.serverContent.outputTranscription, speaker: 'maria', kind: 'output' } }));
                       }
                       const audioData = msg.serverContent?.modelTurn?.parts[0]?.inlineData.data;
                       if (audioData) { clientWs.send(JSON.stringify({ type: 'audio', payload: { data: audioData } })); }
                    },
                    onerror: (e: any) => clientWs.send(JSON.stringify({ type: 'error', payload: `Gemini Error: ${e.message}` })),
                    onclose: () => clientWs.close(),
                },
                config: {
                    responseModalities: [Modality.AUDIO],
                    speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
                    inputAudioTranscription: {}, outputAudioTranscription: {},
                    tools: [{ functionDeclarations: geminiFunctionDeclarations }],
                },
            });
        } else if (provider === 'openai') {
            openAIClient = new OpenAI({ apiKey });
            clientWs.send(JSON.stringify({ type: 'connectionReady' }));
        } else {
            throw new Error(`Provider "${provider}" is not yet supported.`);
        }

      } catch (error) {
        console.error('Proxy error during setup:', error);
        clientWs.send(JSON.stringify({ type: 'error', payload: error.message }));
        clientWs.close();
      }
    } else if (message.type === 'audio') {
        if (provider === 'gemini' && geminiSession) {
            geminiSession.sendRealtimeInput({ media: message.payload });
        } else if (provider === 'openai' && openAIClient) {
            // Buffer audio and process on silence
            const decoded = atob(message.payload.data);
            const buffer = new ArrayBuffer(decoded.length);
            const view = new Uint8Array(buffer);
            for (let i = 0; i < decoded.length; i++) {
                view[i] = decoded.charCodeAt(i);
            }
            audioBuffer.push(buffer);
            
            if (silenceTimeout) clearTimeout(silenceTimeout);
            silenceTimeout = setTimeout(async () => {
                if (audioBuffer.length === 0) return;
                const completeBuffer = new Blob(audioBuffer).arrayBuffer();
                audioBuffer = [];

                try {
                    const wavBlob = pcmToWav(await completeBuffer);
                    const transcription = await openAIClient!.audio.transcriptions.create({ file: new File([wavBlob], "input.wav"), model: "whisper-1" });
                    
                    clientWs.send(JSON.stringify({ type: 'transcription', payload: { text: transcription.text, speaker: 'user', isFinal: true, kind: 'input' } }));

                    const chatCompletion = await openAIClient!.chat.completions.create({
                        model: 'gpt-4o',
                        messages: [{ role: 'user', content: transcription.text }],
                        tools: openAIFunctionDeclarations,
                    });
                    
                    const responseMessage = chatCompletion.choices[0].message;
                    
                    if (responseMessage.tool_calls) {
                        for (const toolCall of responseMessage.tool_calls) {
                           // FIX: Add a type guard to ensure toolCall is a function call before accessing its properties.
                           // This handles the discriminated union type of tool_calls.
                           if (toolCall.type === 'function') {
                               const { name, arguments: args } = toolCall.function;
                               clientWs.send(JSON.stringify({ type: 'toolCall', payload: { id: toolCall.id, name, args: JSON.parse(args) } }));
                           }
                        }
                    } else if (responseMessage.content) {
                        clientWs.send(JSON.stringify({ type: 'transcription', payload: { text: responseMessage.content, speaker: 'maria', isFinal: true, kind: 'output' } }));

                        const ttsResponse = await openAIClient!.audio.speech.create({ model: "tts-1", voice: "nova", input: responseMessage.content, response_format: 'pcm' });
                        const audioBytes = new Uint8Array(await ttsResponse.arrayBuffer());
                        
                        let binary = '';
                        for (let i = 0; i < audioBytes.byteLength; i++) {
                            binary += String.fromCharCode(audioBytes[i]);
                        }
                        const base64Audio = btoa(binary);
                        clientWs.send(JSON.stringify({ type: 'audio', payload: { data: base64Audio } }));
                    }

                } catch(e) {
                     console.error("OpenAI processing error:", e);
                     clientWs.send(JSON.stringify({ type: 'error', payload: `OpenAI Error: ${e.message}` }));
                }

            }, 750); // 750ms of silence triggers processing
        }
    } else if (message.type === 'toolResponse') {
        if (provider === 'gemini' && geminiSession) {
            geminiSession.sendToolResponse(message.payload);
        }
        // NOTE: Tool response handling for OpenAI would require another call to the chat completion API with the tool result.
        // This is a more complex conversational flow and is omitted here for simplicity.
        // The client-side hook will currently execute the function, but the result isn't sent back to the OpenAI model.
    }
  };

  clientWs.onclose = () => {
    console.log('Client WebSocket disconnected');
    cleanup();
  };

  clientWs.onerror = (e) => {
    console.error('Client WebSocket error:', e);
    cleanup();
  };

  return response;
});
