import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { z } from 'https://esm.sh/zod@3.23.8'

// Schemas
const ReminderPostSchema = z.object({
  task: z.string().min(1, 'task is required'),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  due_time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  priority: z.enum(['High','Medium','Low']).optional(),
  is_completed: z.boolean().optional(),
})

const ReminderPutSchema = z.object({
  task: z.string().min(1).optional(),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  due_time: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  priority: z.enum(['High','Medium','Low']).optional(),
  is_completed: z.boolean().optional(),
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
        // Optional filters: completed, limit
        const completed = url.searchParams.get('completed')
        let q = supabaseClient.from('reminders').select('*').order('created_at', { ascending: false })
        if (completed === 'true') q = q.eq('is_completed', true)
        if (completed === 'false') q = q.eq('is_completed', false)
        const limit = Number(url.searchParams.get('limit') || '100')
        if (!Number.isNaN(limit)) q = q.limit(Math.max(1, Math.min(limit, 200)))
        const { data, error } = await q
        if (error) throw error
        return new Response(JSON.stringify({ data, error: null, request_id }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      case 'POST': {
        const parsed = ReminderPostSchema.parse(await req.json())
        const insert = {
          task: parsed.task,
          due_date: parsed.due_date ?? null,
          due_time: parsed.due_time ?? null,
          priority: parsed.priority ?? 'Medium',
          is_completed: Boolean(parsed.is_completed ?? false),
        }
        const { data, error } = await supabaseClient.from('reminders').insert(insert).select('*').single()
        if (error) throw error
        return new Response(JSON.stringify({ data, error: null, request_id }), { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      case 'PUT': {
        if (!id) throw new Error('id query param is required')
        const parsed = ReminderPutSchema.parse(await req.json())
        const patch: Record<string, unknown> = {}
        if (parsed.task !== undefined) patch.task = parsed.task
        if (parsed.due_date !== undefined) patch.due_date = parsed.due_date
        if (parsed.due_time !== undefined) patch.due_time = parsed.due_time
        if (parsed.priority !== undefined) patch.priority = parsed.priority
        if (parsed.is_completed !== undefined) patch.is_completed = parsed.is_completed
        const { data, error } = await supabaseClient.from('reminders').update(patch).eq('id', id).select('*').single()
        if (error) throw error
        return new Response(JSON.stringify({ data, error: null, request_id }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      case 'DELETE': {
        if (!id) throw new Error('id query param is required')
        const { error } = await supabaseClient.from('reminders').delete().eq('id', id)
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
