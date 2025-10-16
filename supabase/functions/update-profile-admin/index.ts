import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

async function getKey(secret: string): Promise<CryptoKey> {
  const keyData = new TextEncoder().encode(secret);
  return await crypto.subtle.importKey('raw', keyData, { name: 'AES-GCM' }, false, ['encrypt']);
}

async function encrypt(plaintext: string, secret: string): Promise<string> {
  const key = await getKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder().encode(plaintext);
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc);
  const out = new Uint8Array(iv.length + (cipher as ArrayBuffer).byteLength);
  out.set(iv, 0);
  out.set(new Uint8Array(cipher as ArrayBuffer), iv.length);
  return btoa(String.fromCharCode(...out));
}

(globalThis as any).Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: corsHeaders })

  try {
    const body = await req.json();
    const { llm_provider, api_key_plain, privacidade, assistente } = body || {};

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

    // Update provider and API key (encrypted)
    const profilePatch: any = {}
    if (llm_provider !== undefined) profilePatch.llm_provider = llm_provider
    if (api_key_plain) {
      const encryptionKey = (globalThis as any).Deno.env.get('ENCRYPTION_KEY');
      if (!encryptionKey) throw new Error('ENCRYPTION_KEY not set')
      profilePatch.encrypted_api_key = await encrypt(api_key_plain, encryptionKey)
    }
    if (Object.keys(profilePatch).length > 0) {
      const { error: upErr } = await service.from('profiles').update(profilePatch).eq('id', user.id)
      if (upErr) throw upErr
    }

    // Upsert preferences subset (privacidade/assistente)
    if (privacidade !== undefined || assistente !== undefined) {
      const { error: prefErr } = await service
        .from('profiles_preferences')
        .upsert({ user_id: user.id, privacidade, assistente }, { onConflict: 'user_id' })
      if (prefErr) throw prefErr
    }

    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as any).message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 })
  }
});
