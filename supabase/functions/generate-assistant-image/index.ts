import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
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
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const body = await req.json();
    const { assistant_id, prompt_override } = body || {};
    if (!assistant_id) throw new Error('assistant_id is required');

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

    // Load assistant and guard ownership
    const { data: assistant, error: assistantErr } = await service
      .from('assistant_profiles')
      .select('id, user_id, name, description, seed, traits')
      .eq('id', assistant_id)
      .single();
    if (assistantErr || !assistant) throw new Error('assistant not found');
    if (assistant.user_id !== user.id) throw new Error('forbidden');

    // Resolve API key (OpenAI) from user profile
    const { data: profile, error: profileError } = await service
      .from('profiles')
      .select('encrypted_api_key')
      .eq('id', user.id)
      .single();
    if (profileError || !profile?.encrypted_api_key) throw new Error('API key not found for user')

    const encryptionKey = (globalThis as any).Deno.env.get('ENCRYPTION_KEY');
    if (!encryptionKey) throw new Error('ENCRYPTION_KEY not set');
    const apiKey = await decrypt(profile.encrypted_api_key, encryptionKey);

    // Build image prompt from seed
    const seed = assistant.seed || {};
    const imageBrief = prompt_override || seed.image_brief || `${assistant.name}, ${assistant.description}`;
    const style = seed?.style?.visual ? `, style: ${seed.style.visual}` : '';
    const finalPrompt = `${imageBrief}${style}`.slice(0, 1000);

    // Call OpenAI Images API via fetch (avoids import issues)
    const resp = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-image-1',
        prompt: finalPrompt,
        size: '1024x1024',
        n: 1,
      })
    });
    const json = await resp.json();
    if (!resp.ok) throw new Error(json?.error?.message || 'Image generation failed');
    const imageUrl = json?.data?.[0]?.url as string | undefined;
    if (!imageUrl) throw new Error('No image url received');

    // Persist image url and snapshot seed
    await service.from('assistant_image_seeds').insert({ assistant_id, seed });
    const { data: updated, error: upErr } = await service
      .from('assistant_profiles')
      .update({ image_url: imageUrl })
      .eq('id', assistant_id)
      .select('*')
      .single();
    if (upErr) throw upErr;

    return new Response(JSON.stringify({ image_url: imageUrl, assistant: updated }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 })
  }
});
