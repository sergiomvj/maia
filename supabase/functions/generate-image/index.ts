import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { GoogleGenAI } from '@google/genai'
import OpenAI from 'openai';
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
    const { prompt, negativePrompt } = await req.json()
    if (!prompt) {
      throw new Error('A prompt is required to generate an image.')
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

    let imageData: string | undefined = '';

    if (profile.llm_provider === 'gemini') {
        const ai = new GoogleGenAI({ apiKey });
        const response = await ai.models.generateImages({
            model: 'imagen-4.0-generate-001',
            prompt: prompt,
            config: {
              numberOfImages: 1,
              negativePrompt: negativePrompt,
            },
        });
        imageData = response.generatedImages[0]?.image.imageBytes;
    } else if (profile.llm_provider === 'openai') {
        const openai = new OpenAI({ apiKey });
        const finalPrompt = negativePrompt ? `${prompt}. Avoid the following: ${negativePrompt}.` : prompt;
        const response = await openai.images.generate({
            model: "dall-e-3",
            prompt: finalPrompt,
            n: 1,
            size: "1024x1024",
            response_format: 'b64_json',
        });
        imageData = response.data[0]?.b64_json;
    } else {
        throw new Error(`Image generation is not supported for the provider: ${profile.llm_provider}`);
    }

    if (!imageData) {
        throw new Error("The image generation API did not return an image.");
    }

    return new Response(JSON.stringify({ imageData }), {
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