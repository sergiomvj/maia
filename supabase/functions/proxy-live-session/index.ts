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
    // Core Features
    { name: 'createReminder', description: "Creates a reminder with a task, and optional due date, due time, and priority ('High', 'Medium', or 'Low').", parameters: { type: Type.OBJECT, properties: { task: { type: Type.STRING }, dueDate: { type: Type.STRING }, dueTime: { type: Type.STRING }, priority: { type: Type.STRING } }, required: ['task'] } },
    { name: 'saveNote', description: 'Saves a note', parameters: { type: Type.OBJECT, properties: { content: { type: Type.STRING } }, required: ['content'] } },
    { name: 'addShoppingListItem', description: 'Adds to shopping list', parameters: { type: Type.OBJECT, properties: { item: { type: Type.STRING }, quantity: { type: Type.NUMBER } }, required: ['item'] } },
    { name: 'removeShoppingListItem', description: 'Removes from shopping list', parameters: { type: Type.OBJECT, properties: { item: { type: Type.STRING } }, required: ['item'] } },

    // Real-Time Information
    { name: 'getWeather', description: "Gets the current weather for a specific city.", parameters: { type: Type.OBJECT, properties: { city: { type: Type.STRING, description: "The city, e.g., San Francisco" } }, required: ['city'] } },
    { name: 'getLatestNews', description: "Gets the latest news headlines for a given topic.", parameters: { type: Type.OBJECT, properties: { topic: { type: Type.STRING, description: "The news topic, e.g., technology" } }, required: ['topic'] } },
    { name: 'performWebSearch', description: "Performs a web search for a given query when information is not otherwise known.", parameters: { type: Type.OBJECT, properties: { query: { type: Type.STRING, description: "The search query" } }, required: ['query'] } },
    
    // Creative
    { name: 'generateImage', description: "Generates an image based on a user's prompt. Can also accept a negative prompt to specify what to avoid.", parameters: { type: Type.OBJECT, properties: { prompt: { type: Type.STRING, description: "A detailed description of the image to generate." }, negativePrompt: { type: Type.STRING, description: "A description of what to avoid in the image." } }, required: ['prompt'] } },

    // Smart Home
    { name: 'controlSmartDevice', description: "Controls a smart home device.", parameters: { type: Type.OBJECT, properties: { deviceName: { type: Type.STRING, description: "The name of the device, e.g., living room lights" }, action: { type: Type.STRING, description: "The action to perform: 'on', 'off', or 'toggle'" }, setting: { type: Type.STRING, description: "Optional setting to change, e.g., brightness" }, value: { type: Type.STRING, description: "Optional value for the setting, e.g., 50%" } }, required: ['deviceName', 'action'] } },

    // App Integration
    { name: 'createCalendarEvent', description: "Creates a new event in the user's calendar.", parameters: { type: Type.OBJECT, properties: { title: { type: Type.STRING }, date: { type: Type.STRING, description: "Date of the event, e.g., 2024-08-15" }, time: { type: Type.STRING, description: "Time of the event, e.g., 14:30" }, durationMinutes: { type: Type.NUMBER, description: "Duration of the event in minutes" }, description: { type: Type.STRING, description: "Optional description for the event" } }, required: ['title', 'date', 'time'] } },
    { name: 'sendEmail', description: "Sends an email to a recipient.", parameters: { type: Type.OBJECT, properties: { recipient: { type: Type.STRING, description: "Email address of the recipient" }, subject: { type: Type.STRING }, body: { type: Type.STRING } }, required: ['recipient', 'subject', 'body'] } },
    { name: 'sendSlackMessage', description: "Sends a message to a Slack channel.", parameters: { type: Type.OBJECT, properties: { channel: { type: Type.STRING, description: "The Slack channel name, e.g., #general" }, message: { type: Type.STRING } }, required: ['channel', 'message'] } },

    // E-commerce
    { name: 'findProductPrice', description: "Finds the price of a product online.", parameters: { type: Type.OBJECT, properties: { productName: { type: Type.STRING } }, required: ['productName'] } },
    { name: 'orderPizza', description: "Orders a pizza for delivery.", parameters: { type: Type.OBJECT, properties: { size: { type: Type.STRING, description: "Size of the pizza: 'small', 'medium', or 'large'" }, toppings: { type: Type.ARRAY, items: { type: Type.STRING } }, address: { type: Type.STRING, description: "Delivery address" } }, required: ['size', 'toppings', 'address'] } },

    // Business Data
    { name: 'getSalesData', description: "Retrieves sales data for a specified period.", parameters: { type: Type.OBJECT, properties: { timePeriod: { type: Type.STRING, description: "The period: 'daily', 'weekly', or 'quarterly'" } }, required: ['timePeriod'] } },
    { name: 'getSupportTicket', description: "Retrieves a customer support ticket by its ID.", parameters: { type: Type.OBJECT, properties: { ticketId: { type: Type.STRING } }, required: ['ticketId'] } },
];

// OpenAI format
const openAIFunctionDeclarations: OpenAI.Chat.Completions.ChatCompletionTool[] = geminiFunctionDeclarations.map(f => ({
    type: 'function',
    function: {
        name: f.name,
        description: f.description,
        parameters: {
            type: 'object',
            // FIX: Cast `val` to `any` to work around incorrect type inference.
            properties: Object.fromEntries(Object.entries(f.parameters.properties!).map(([key, val]) => [key, { type: ((val as any).type as string).toLowerCase(), description: (val as any).description }])),
            required: f.parameters.required || [],
        },
    },
}));


// --- MAIN SERVER LOGIC ---
// FIX: Cast Deno to any via globalThis to satisfy non-Deno type checkers.
(globalThis as any).Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // FIX: Cast Deno to any via globalThis to satisfy non-Deno type checkers.
  const { socket: clientWs, response } = (globalThis as any).Deno.upgradeWebSocket(req);
  
  let user: any = null;
  let apiKey: string | null = null;
  let provider: 'gemini' | 'openai' | 'anthropic' = 'gemini';
  let geminiSession: any = null;
  let openAIClient: OpenAI | null = null;
  let serviceClient: ReturnType<typeof createClient> | null = null;
  
  let audioBuffer: Array<ArrayBuffer> = [];
  // FIX: setTimeout in Deno returns a Timeout object, not a number. Changed type to `any`.
  let silenceTimeout: any | null = null;
  // --- Hardening state ---
  let heartbeatInterval: any | null = null;
  let lastPongAt = Date.now();
  let rateWindowStart = Date.now();
  let rateCount = 0;
  const RATE_LIMIT_PER_MINUTE = 120; // messages/minute
  const IDLE_TIMEOUT_MS = 30_000; // 30s without pong
  const SEND_BUFFER_LIMIT = 2_000_000; // ~2MB buffered amount threshold
  // --- Session budget ---
  const env = (globalThis as any).Deno.env;
  const SESSION_START_TS = Date.now();
  let sessionMessageCount = 0;
  const LIVE_SESSION_MAX_MINUTES = Number(env.get('LIVE_SESSION_MAX_MINUTES') || 10);
  const LIVE_SESSION_MAX_MESSAGES = Number(env.get('LIVE_SESSION_MAX_MESSAGES') || 500);

  const cleanup = () => {
    geminiSession?.close();
    geminiSession = null;
    openAIClient = null;
    audioBuffer = [];
    if (silenceTimeout) clearTimeout(silenceTimeout);
    if (heartbeatInterval) clearInterval(heartbeatInterval);
  };

  const session_id = ((globalThis as any).crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`);
  let messagesIn = 0;
  let messagesOut = 0;
  let audioBytesIn = 0;
  let audioBytesOut = 0;
  let closeReason: string | null = null;
  let authToken: string | null = null;
  let userLanguageCode: 'pt' | 'en' | 'es' = 'pt';
  let ttsVoice: string = 'nova';

  const logEvent = (event: string, extra: Record<string, unknown> = {}) => {
    const duration_ms = Date.now() - SESSION_START_TS;
    const payload = {
      event,
      session_id,
      user_id_hash: user?.id ? user.id.substring(0, 8) : null,
      duration_ms,
      messages_in: messagesIn,
      messages_out: messagesOut,
      audio_bytes_in: audioBytesIn,
      audio_bytes_out: audioBytesOut,
      ...extra,
    };
    console.log(JSON.stringify(payload));
  };

  clientWs.onopen = () => { logEvent('ws_open'); };

  clientWs.onmessage = async (event) => {
    const message = JSON.parse(event.data);
    messagesIn++;

    // --- Rate limiting (simple token bucket reset per minute) ---
    const now = Date.now();
    if (now - rateWindowStart >= 60_000) {
      rateWindowStart = now;
      rateCount = 0;
    }
    rateCount++;
    if (rateCount > RATE_LIMIT_PER_MINUTE) {
      try { clientWs.send(JSON.stringify({ type: 'error', payload: 'rate_limit_exceeded' })); } catch {}
      return; // drop excess messages within window
    }

    // --- Session budget checks ---
    sessionMessageCount++;
    const elapsedMs = now - SESSION_START_TS;
    if (sessionMessageCount > LIVE_SESSION_MAX_MESSAGES || elapsedMs > LIVE_SESSION_MAX_MINUTES * 60_000) {
      try { clientWs.send(JSON.stringify({ type: 'error', payload: 'budget_exceeded' })); } catch {}
      clientWs.close();
      return;
    }

    if (message.type === 'auth') {
      try {
        const env = (globalThis as any).Deno.env;
        const SUPABASE_URL = env.get('SUPABASE_URL') ?? env.get('SB_URL') ?? env.get('VITE_SUPABASE_URL') ?? '';
        const SUPABASE_ANON_KEY = env.get('SUPABASE_ANON_KEY') ?? env.get('SB_ANON_KEY') ?? env.get('VITE_SUPABASE_ANON_KEY') ?? '';
        authToken = message.token || null;
        const supabaseClient = createClient(
          SUPABASE_URL,
          SUPABASE_ANON_KEY,
          { global: { headers: { Authorization: `Bearer ${message.token}` } } }
        );

        const { data: { user: authUser } } = await supabaseClient.auth.getUser();
        if (!authUser) throw new Error('Authentication failed.');
        user = authUser;

        // Resolve user language preference
        try {
          const service = createClient(SUPABASE_URL, env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
          const { data: prof } = await service.from('profiles').select('language').eq('id', user.id).maybeSingle();
          const lang = (prof?.language || '').toLowerCase();
          if (lang.startsWith('en')) userLanguageCode = 'en';
          else if (lang.startsWith('es')) userLanguageCode = 'es';
          else userLanguageCode = 'pt';
          // Choose a TTS voice by language (heuristic)
          ttsVoice = userLanguageCode === 'en' ? 'alloy' : userLanguageCode === 'es' ? 'alloy' : 'nova';
        } catch {}

        const SUPABASE_SERVICE_ROLE_KEY = env.get('SUPABASE_SERVICE_ROLE_KEY') ?? env.get('SB_SERVICE_ROLE_KEY') ?? env.get('VITE_SUPABASE_SERVICE_ROLE_KEY') ?? '';
        serviceClient = createClient(
            SUPABASE_URL,
            SUPABASE_SERVICE_ROLE_KEY
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
        
        // FIX: Cast Deno to any via globalThis to satisfy non-Deno type checkers.
        const encryptionKey = (globalThis as any).Deno.env.get('ENCRYPTION_KEY');
        if (!encryptionKey) throw new Error("Server config error: ENCRYPTION_KEY not set.");
        
        apiKey = await decrypt(profile.encrypted_api_key, encryptionKey);

        // --- Provider-specific setup ---
        if (provider === 'gemini') {
            const ai = new GoogleGenAI({ apiKey });
            geminiSession = await ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                callbacks: {
                    onopen: () => clientWs.send(JSON.stringify({ type: 'connectionReady' })),
                    onmessage: async (msg: any) => {
                       if (msg.toolCall) {
                         for (const fc of msg.toolCall.functionCalls) { clientWs.send(JSON.stringify({ type: 'toolCall', payload: fc })); }
                       }
                       if (msg.serverContent?.inputTranscription) {
                         const payload = { ...msg.serverContent.inputTranscription, speaker: 'user', kind: 'input' };
                         clientWs.send(JSON.stringify({ type: 'transcription', payload }));
                         try {
                           if (payload.isFinal && serviceClient && user?.id && payload.text) {
                             await serviceClient.from('chat_history').insert({ user_id: user.id, speaker: 'user', text: payload.text });
                           }
                         } catch (e) { /* swallow logging errors */ }
                       }
                       if (msg.serverContent?.outputTranscription) {
                         const payload = { ...msg.serverContent.outputTranscription, speaker: 'maia', kind: 'output' };
                         clientWs.send(JSON.stringify({ type: 'transcription', payload }));
                         try {
                           if (payload.isFinal && serviceClient && user?.id && payload.text) {
                             await serviceClient.from('chat_history').insert({ user_id: user.id, speaker: 'maia', text: payload.text, meta: { session_id, provider } });
                           }
                         } catch (e) { /* swallow logging errors */ }
                       }
                       const audioData = msg.serverContent?.modelTurn?.parts[0]?.inlineData.data;
                       if (audioData) {
                         // Backpressure guard
                         if (!(clientWs as any).bufferedAmount || (clientWs as any).bufferedAmount < SEND_BUFFER_LIMIT) {
                           const msg = JSON.stringify({ type: 'audio', payload: { data: audioData } });
                           audioBytesOut += (audioData?.length || 0);
                           messagesOut++;
                           clientWs.send(msg);
                         }
                       }
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
        } else if (provider === 'anthropic') {
            // Reuse OpenAI client for Whisper (ASR) and TTS while using Anthropic for text responses
            openAIClient = new OpenAI({ apiKey });
            clientWs.send(JSON.stringify({ type: 'connectionReady' }));
        } else {
            throw new Error(`Provider "${provider}" is not yet supported.`);
        }

        // --- Start heartbeat after successful auth ---
        lastPongAt = Date.now();
        if (heartbeatInterval) clearInterval(heartbeatInterval);
        heartbeatInterval = setInterval(() => {
          try {
            // Check idle timeout first
            if (Date.now() - lastPongAt > IDLE_TIMEOUT_MS) {
              try { clientWs.send(JSON.stringify({ type: 'error', payload: 'idle_timeout' })); } catch {}
              clientWs.close();
              return;
            }
            // Backpressure: avoid sending if buffer too large
            if ((clientWs as any).bufferedAmount && (clientWs as any).bufferedAmount > SEND_BUFFER_LIMIT) {
              // Skip ping to let buffer drain
              return;
            }
            clientWs.send(JSON.stringify({ type: 'ping', ts: Date.now() }));
          } catch {
            // Ignore ping errors
          }
        }, 15_000);

      } catch (error) {
        console.error('Proxy error during setup:', error);
        clientWs.send(JSON.stringify({ type: 'error', payload: error.message }));
        clientWs.close();
      }
    } else if (message.type === 'pong') {
        lastPongAt = Date.now();
        return;
    } else if (message.type === 'audio') {
        if (provider === 'gemini' && geminiSession) {
            geminiSession.sendRealtimeInput({ media: message.payload });
        } else if ((provider === 'openai' || provider === 'anthropic') && openAIClient) {
            // Buffer audio and process on silence
            const decoded = atob(message.payload.data);
            const buffer = new ArrayBuffer(decoded.length);
            const view = new Uint8Array(buffer);
            for (let i = 0; i < decoded.length; i++) {
                view[i] = decoded.charCodeAt(i);
            }
            audioBytesIn += decoded.length;
            audioBuffer.push(buffer);
            
            if (silenceTimeout) clearTimeout(silenceTimeout);
            silenceTimeout = setTimeout(async () => {
                if (audioBuffer.length === 0) return;
                const completeBuffer = new Blob(audioBuffer).arrayBuffer();
                audioBuffer = [];

                try {
                    const wavBlob = pcmToWav(await completeBuffer);
                    const transcription = await openAIClient!.audio.transcriptions.create({ file: new File([wavBlob], "input.wav"), model: "whisper-1", language: userLanguageCode });

                    clientWs.send(JSON.stringify({ type: 'transcription', payload: { text: transcription.text, speaker: 'user', isFinal: true, kind: 'input' } }));
                    try {
                      if (serviceClient && user?.id && transcription.text) {
                        await serviceClient.from('chat_history').insert({ user_id: user.id, speaker: 'user', text: transcription.text, meta: { session_id, provider } });
                      }
                    } catch (_) {}

                    let finalText = '';
                    if (provider === 'openai') {
                        const chatCompletion = await openAIClient!.chat.completions.create({
                            model: 'gpt-4o',
                            messages: [{ role: 'user', content: transcription.text }],
                            tools: openAIFunctionDeclarations,
                        });
                        const responseMessage = chatCompletion.choices[0].message;
                        if (responseMessage.tool_calls) {
                            for (const toolCall of responseMessage.tool_calls) {
                              if (toolCall.type === 'function') {
                                  const { name, arguments: args } = toolCall.function;
                                  clientWs.send(JSON.stringify({ type: 'toolCall', payload: { id: toolCall.id, name, args: JSON.parse(args) } }));
                              }
                            }
                        } else if (responseMessage.content) {
                            finalText = responseMessage.content as string;
                        }
                    } else {
                        // Anthropic call via fetch
                        const anthropicResp = await fetch('https://api.anthropic.com/v1/messages', {
                          method: 'POST',
                          headers: {
                            'content-type': 'application/json',
                            'x-api-key': apiKey!,
                            'anthropic-version': '2023-06-01',
                          },
                          body: JSON.stringify({
                            model: 'claude-3-5-sonnet-latest',
                            max_tokens: 600,
                            messages: [{ role: 'user', content: transcription.text }],
                          })
                        });
                        const anthropicJson = await anthropicResp.json();
                        if (!anthropicResp.ok) throw new Error(anthropicJson?.error?.message || 'Anthropic Error');
                        finalText = anthropicJson?.content?.[0]?.text || '';
                    }

                    if (finalText) {
                        try {
                          if (serviceClient && user?.id) {
                            await serviceClient.from('chat_history').insert({ user_id: user.id, speaker: 'maia', text: finalText, meta: { session_id, provider } });
                          }
                        } catch (_) {}
                        if (!(clientWs as any).bufferedAmount || (clientWs as any).bufferedAmount < SEND_BUFFER_LIMIT) {
                          const msg = JSON.stringify({ type: 'transcription', payload: { text: finalText, speaker: 'maia', isFinal: true, kind: 'output' } });
                          messagesOut++;
                          clientWs.send(msg);
                        }
                        const ttsResponse = await openAIClient!.audio.speech.create({ model: 'tts-1', voice: ttsVoice, input: finalText, response_format: 'pcm' });
                        const audioBytes = new Uint8Array(await ttsResponse.arrayBuffer());
                        let binary = '';
                        for (let i = 0; i < audioBytes.byteLength; i++) { binary += String.fromCharCode(audioBytes[i]); }
                        const base64Audio = btoa(binary);
                        if (!(clientWs as any).bufferedAmount || (clientWs as any).bufferedAmount < SEND_BUFFER_LIMIT) {
                          const msg = JSON.stringify({ type: 'audio', payload: { data: base64Audio } });
                          audioBytesOut += base64Audio.length;
                          messagesOut++;
                          clientWs.send(msg);
                        }
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
    } else if (message.type === 'toolExec') {
        try {
          const env = (globalThis as any).Deno.env;
          const SUPABASE_URL = env.get('SUPABASE_URL') ?? '';
          const base = `${new URL(SUPABASE_URL).origin}/functions/v1`;
          const { provider: toolProv, action, payload } = message.payload || {};
          const res = await fetch(`${base}/plugins-dispatch`, {
            method: 'POST',
            headers: { 'content-type': 'application/json', Authorization: `Bearer ${authToken || ''}` },
            body: JSON.stringify({ provider: toolProv, action, payload }),
          });
          const json = await res.json();
          if (!res.ok) throw new Error(json?.error || 'tool_exec_failed');
          if (!(clientWs as any).bufferedAmount || (clientWs as any).bufferedAmount < SEND_BUFFER_LIMIT) {
            clientWs.send(JSON.stringify({ type: 'toolResult', payload: { ok: true, result: json?.result, name: `${toolProv}.${action}` } }));
            messagesOut++;
          }
          try { if (serviceClient && user?.id) await serviceClient.from('chat_history').insert({ user_id: user.id, speaker: 'maia', text: `[tool:${toolProv}.${action}]`, meta: { session_id, provider, tool: { name: `${toolProv}.${action}`, ok: true } } }); } catch {}
        } catch (e: any) {
          try { clientWs.send(JSON.stringify({ type: 'toolResult', payload: { ok: false, error: e.message } })); } catch {}
          try { if (serviceClient && user?.id) await serviceClient.from('chat_history').insert({ user_id: user.id, speaker: 'maia', text: `[tool:error] ${e.message}`, meta: { session_id, provider, tool: { ok: false } } }); } catch {}
        }
    }
  };

  clientWs.onclose = () => {
    logEvent('ws_close', { reason: closeReason || 'client_closed' });
    cleanup();
  };

  clientWs.onerror = (e) => {
    closeReason = 'ws_error';
    console.error('Client WebSocket error:', e);
    logEvent('ws_error');
    cleanup();
  };

  return response;
});