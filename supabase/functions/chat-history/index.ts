import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

(globalThis as any).Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const request_id = (globalThis as any).crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`

  try {
    const env = (globalThis as any).Deno.env
    const SUPABASE_URL = env.get('SUPABASE_URL') ?? env.get('SB_URL') ?? env.get('VITE_SUPABASE_URL') ?? ''
    const SUPABASE_ANON_KEY = env.get('SUPABASE_ANON_KEY') ?? env.get('SB_ANON_KEY') ?? env.get('VITE_SUPABASE_ANON_KEY') ?? ''
    const supabaseClient = createClient(
      SUPABASE_URL,
      SUPABASE_ANON_KEY,
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const { data: { user } } = await supabaseClient.auth.getUser()
    if (!user) return new Response(JSON.stringify({ data: null, error: 'Unauthorized', request_id }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const url = new URL(req.url)

    switch (req.method) {
      case 'GET': {
        const limit = Math.max(1, Math.min(Number(url.searchParams.get('limit') || '50'), 200))
        const before = url.searchParams.get('before')
        let q = supabaseClient.from('chat_history').select('*').order('created_at', { ascending: false }).limit(limit)
        if (before) q = q.lt('created_at', before)
        const { data, error } = await q
        if (error) throw error
        return new Response(JSON.stringify({ data, error: null, request_id }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      case 'POST': {
        const body = await req.json()
        const speaker = body.speaker
        const text = body.text
        if (!['user', 'maia', 'system'].includes(speaker)) throw new Error('speaker must be user|maia|system')
        if (typeof text !== 'string' || text.length === 0) throw new Error('text is required')
        const { data, error } = await supabaseClient
          .from('chat_history')
          .insert({ speaker, text })
          .select('*')
          .single()
        if (error) throw error
        return new Response(JSON.stringify({ data, error: null, request_id }), { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      default:
        return new Response('Method Not Allowed', { status: 405, headers: corsHeaders })
    }
  } catch (error) {
    return new Response(JSON.stringify({ data: null, error: (error as any).message ?? String(error), request_id }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
