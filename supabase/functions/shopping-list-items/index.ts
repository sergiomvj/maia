import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { z } from 'https://esm.sh/zod@3.23.8'

const ItemPostSchema = z.object({
  item: z.string().min(1, 'item is required'),
  quantity: z.number().int().positive().optional(),
  is_collected: z.boolean().optional(),
})

const ItemPutSchema = z.object({
  item: z.string().min(1).optional(),
  quantity: z.number().int().positive().optional(),
  is_collected: z.boolean().optional(),
}).refine(obj => Object.keys(obj).length > 0, { message: 'No fields to update' })

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
        const collected = url.searchParams.get('collected')
        let q = supabaseClient.from('shopping_list_items').select('*').order('created_at', { ascending: false })
        if (collected === 'true') q = q.eq('is_collected', true)
        if (collected === 'false') q = q.eq('is_collected', false)
        const limit = Number(url.searchParams.get('limit') || '100')
        if (!Number.isNaN(limit)) q = q.limit(Math.max(1, Math.min(limit, 200)))
        const { data, error } = await q
        if (error) throw error
        return new Response(JSON.stringify({ data, error: null, request_id }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      case 'POST': {
        const parsed = ItemPostSchema.parse(await req.json())
        const insert = {
          item: parsed.item,
          quantity: typeof parsed.quantity === 'number' ? parsed.quantity : 1,
          is_collected: Boolean(parsed.is_collected ?? false),
        }
        const { data, error } = await supabaseClient.from('shopping_list_items').insert(insert).select('*').single()
        if (error) throw error
        return new Response(JSON.stringify({ data, error: null, request_id }), { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      case 'PUT': {
        if (!id) throw new Error('id query param is required')
        const parsed = ItemPutSchema.parse(await req.json())
        const patch: Record<string, unknown> = {}
        if (parsed.item !== undefined) patch.item = parsed.item
        if (parsed.quantity !== undefined) patch.quantity = parsed.quantity
        if (parsed.is_collected !== undefined) patch.is_collected = parsed.is_collected
        const { data, error } = await supabaseClient.from('shopping_list_items').update(patch).eq('id', id).select('*').single()
        if (error) throw error
        return new Response(JSON.stringify({ data, error: null, request_id }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      case 'DELETE': {
        if (!id) throw new Error('id query param is required')
        const { error } = await supabaseClient.from('shopping_list_items').delete().eq('id', id)
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
