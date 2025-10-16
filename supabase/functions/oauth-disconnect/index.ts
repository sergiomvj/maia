import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

function json(data: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(data), { ...init, headers: { 'Content-Type': 'application/json', ...corsHeaders, ...(init.headers || {}) } })
}

function getSB() {
  const env = (globalThis as any).Deno.env
  const url = env.get('SUPABASE_URL') ?? env.get('SB_URL') ?? env.get('VITE_SUPABASE_URL') ?? ''
  const anon = env.get('SUPABASE_ANON_KEY') ?? env.get('SB_ANON_KEY') ?? env.get('VITE_SUPABASE_ANON_KEY') ?? ''
  return { url, anon }
}

(globalThis as any).Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const request_id = (globalThis as any).crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`
  try {
    if (req.method !== 'DELETE') return json({ data: null, error: 'Method Not Allowed', request_id }, { status: 405 })
    const { url: SB_URL, anon: SB_ANON } = getSB()
    const supabase = createClient(SB_URL, SB_ANON, { global: { headers: { Authorization: req.headers.get('Authorization') || '' } } })
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return json({ data: null, error: 'Unauthorized', request_id }, { status: 401 })

    const body = await req.json().catch(() => ({})) as { provider?: string }
    const provider = (body.provider || '').toLowerCase()
    if (!provider) return json({ data: null, error: 'Missing provider', request_id }, { status: 400 })

    const { error } = await supabase
      .from('oauth_tokens')
      .delete()
      .eq('user_id', user.id)
      .eq('provider', provider)

    if (error) throw error

    return json({ data: { ok: true, provider }, error: null, request_id })
  } catch (e: any) {
    return json({ data: null, error: e?.message || 'error', request_id }, { status: 400 })
  }
})
