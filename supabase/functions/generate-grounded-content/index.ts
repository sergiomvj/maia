import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { GoogleGenAI } from '@google/genai'
import { corsHeaders } from '../_shared/cors.ts'

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


// FIX: Cast Deno to any via globalThis to satisfy non-Deno type checkers.
(globalThis as any).Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { query } = await req.json()
    if (!query) {
      throw new Error('Query is required.')
    }

    // Auth and get user
    const supabaseClient = createClient(
      // FIX: Cast Deno to any via globalThis to satisfy non-Deno type checkers.
      (globalThis as any).Deno.env.get('SUPABASE_URL') ?? '',
      // FIX: Cast Deno to any via globalThis to satisfy non-Deno type checkers.
      (globalThis as any).Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )
    const { data: { user } } = await supabaseClient.auth.getUser()
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    
    // Get profile and decrypt API key
    const serviceClient = createClient(
      // FIX: Cast Deno to any via globalThis to satisfy non-Deno type checkers.
      (globalThis as any).Deno.env.get('SUPABASE_URL') ?? '',
      // FIX: Cast Deno to any via globalThis to satisfy non-Deno type checkers.
      (globalThis as any).Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    const { data: profile, error: profileError } = await serviceClient
      .from('profiles')
      .select('encrypted_api_key, llm_provider')
      .eq('id', user.id)
      .single()
      
    if (profileError || !profile || !profile.encrypted_api_key) {
      throw new Error('API key not found or user profile missing.')
    }
    
    // FIX: Cast Deno to any via globalThis to satisfy non-Deno type checkers.
    const encryptionKey = (globalThis as any).Deno.env.get('ENCRYPTION_KEY');
    if (!encryptionKey) throw new Error('Server config error: ENCRYPTION_KEY not set.');
    
    const apiKey = await decrypt(profile.encrypted_api_key, encryptionKey);

    // Call Gemini with Google Search tool
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: query,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const text = response.text;
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];

    return new Response(JSON.stringify({ text, citations: groundingChunks }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
