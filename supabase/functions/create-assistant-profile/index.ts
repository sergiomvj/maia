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

// Generate a structured seed JSON for assistant persona from a free-form description
async function generateSeed(apiKey: string, description: string) {
  const ai = new GoogleGenAI({ apiKey });
  const prompt = `Create a compact JSON seed for an AI assistant persona based on the following description. 
Include: name, physical_traits, psychological_traits, social_traits, backstory, motivations, conflicts, abilities(list), style(speech, tone), guardrails, inspiration_refs, and image_brief (for image generation). 
Return only minified JSON.`;
  const res = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `${prompt}\n\nDescription:\n${description}`,
  });
  try {
    const text = res.text;
    const jsonStart = text.indexOf('{');
    const jsonEnd = text.lastIndexOf('}');
    if (jsonStart >= 0 && jsonEnd > jsonStart) {
      const jsonStr = text.slice(jsonStart, jsonEnd + 1);
      return JSON.parse(jsonStr);
    }
  } catch (_) {}
  return { description };
}

// FIX: Cast Deno to any via globalThis to satisfy non-Deno type checkers.
(globalThis as any).Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const body = await req.json();
    const { name, description, traits, backstory, motivations, conflicts, abilities } = body || {};
    if (!name || !description) throw new Error('name and description are required');

    const supabaseClient = createClient(
      (globalThis as any).Deno.env.get('SUPABASE_URL') ?? '',
      (globalThis as any).Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const service = createClient(
      (globalThis as any).Deno.env.get('SUPABASE_URL') ?? '',
      (globalThis as any).Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: profile, error: profileError } = await service
      .from('profiles')
      .select('encrypted_api_key')
      .eq('id', user.id)
      .single();
    if (profileError || !profile?.encrypted_api_key) throw new Error('API key not found for user')

    const encryptionKey = (globalThis as any).Deno.env.get('ENCRYPTION_KEY');
    if (!encryptionKey) throw new Error('ENCRYPTION_KEY not set');
    const apiKey = await decrypt(profile.encrypted_api_key, encryptionKey);

    const seed = await generateSeed(apiKey, description);

    const insert = await service
      .from('assistant_profiles')
      .insert({
        user_id: user.id,
        name,
        description,
        traits: traits ?? {},
        backstory: backstory ?? null,
        motivations: motivations ?? null,
        conflicts: conflicts ?? null,
        abilities: abilities ?? [],
        seed,
      })
      .select('*')
      .single();

    if (insert.error) throw insert.error

    return new Response(JSON.stringify({ assistant: insert.data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 })
  }
});
