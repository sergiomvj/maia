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

    switch (req.method) {
      case 'GET': {
        const { data, error } = await supabaseClient
          .from('profiles')
          .select('id, full_name, llm_provider, language')
          .eq('id', user.id)
          .single()
        if (error) throw error
        return new Response(JSON.stringify({ data, error: null, request_id }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      case 'PUT': {
        const body = await req.json()
        const patch: Record<string, unknown> = {}
        if (typeof body.full_name === 'string') patch.full_name = body.full_name
        if (typeof body.llm_provider === 'string') patch.llm_provider = body.llm_provider
        if (typeof body.language === 'string') patch.language = body.language // e.g., 'pt-BR' | 'en' | 'es'
        const { data, error } = await supabaseClient
          .from('profiles')
          .update(patch)
          .eq('id', user.id)
          .select('id, full_name, llm_provider, language')
          .single()
        if (error) throw error
        return new Response(JSON.stringify({ data, error: null, request_id }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
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
