import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

(globalThis as any).Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'GET') return new Response('Method Not Allowed', { status: 405, headers: corsHeaders })

  try {
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

    const [profileRes, prefsRes] = await Promise.all([
      service.from('profiles').select('id, llm_provider, encrypted_api_key').eq('id', user.id).single(),
      service.from('profiles_preferences').select('privacidade, assistente').eq('user_id', user.id).maybeSingle(),
    ])

    if (profileRes.error) throw profileRes.error

    const apiKeySet = !!profileRes.data?.encrypted_api_key
    const payload = {
      llm_provider: profileRes.data?.llm_provider ?? null,
      api_key_set: apiKeySet,
      privacidade: prefsRes.data?.privacidade ?? null,
      assistente: prefsRes.data?.assistente ?? null,
    }

    return new Response(JSON.stringify(payload), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as any).message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 })
  }
});
