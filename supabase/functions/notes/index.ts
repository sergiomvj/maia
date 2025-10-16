import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { z } from 'https://esm.sh/zod@3.23.8'

const NotePostSchema = z.object({
  content: z.string().min(1, 'content is required'),
})

(globalThis as any).Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const request_id = (globalThis as any).crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`
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
    const id = url.searchParams.get('id') || undefined

    switch (req.method) {
      case 'GET': {
        const limit = Number(url.searchParams.get('limit') || '100')
        const { data, error } = await supabaseClient
          .from('notes')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(Math.max(1, Math.min(Number.isNaN(limit) ? 100 : limit, 200)))
        if (error) throw error
        return new Response(JSON.stringify({ data, error: null, request_id }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      case 'POST': {
        const parsed = NotePostSchema.parse(await req.json())
        const insert = { content: parsed.content }
        const { data, error } = await supabaseClient.from('notes').insert(insert).select('*').single()
        if (error) throw error
        // Optional: upsert embedding via RPC if available
        try {
          const env = (globalThis as any).Deno.env
          const OPENAI_API_KEY = env.get('OPENAI_API_KEY') ?? env.get('VITE_OPENAI_API_KEY') ?? ''
          if (OPENAI_API_KEY && data?.id && data?.content) {
            const resp = await fetch('https://api.openai.com/v1/embeddings', {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ model: 'text-embedding-3-small', input: data.content })
            })
            if (resp.ok) {
              const ej = await resp.json()
              const embedding = ej?.data?.[0]?.embedding as number[] | undefined
              if (Array.isArray(embedding) && embedding.length > 0) {
                await supabaseClient.rpc('upsert_note_embedding', {
                  p_note_id: data.id,
                  p_content: data.content,
                  p_embedding: embedding,
                })
              }
            }
          }
        } catch (_) { /* non-fatal embedding failure */ }
        return new Response(JSON.stringify({ data, error: null, request_id }), { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      case 'DELETE': {
        if (!id) throw new Error('id query param is required')
        const { error } = await supabaseClient.from('notes').delete().eq('id', id)
        if (error) throw error
        return new Response(JSON.stringify({ data: null, error: null, request_id }), { status: 204, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      default:
        return new Response('Method Not Allowed', { status: 405, headers: corsHeaders })
    }
  } catch (error) {
    const request_id = (globalThis as any).crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`
    return new Response(JSON.stringify({ data: null, error: (error as any).message ?? String(error), request_id }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
