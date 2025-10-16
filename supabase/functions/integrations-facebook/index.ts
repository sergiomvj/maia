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

async function getUserAndToken(req: Request) {
  const { url: SB_URL, anon: SB_ANON } = getSB()
  const supabase = createClient(SB_URL, SB_ANON, { global: { headers: { Authorization: req.headers.get('Authorization') || '' } } })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')
  const { data, error } = await supabase
    .from('oauth_tokens')
    .select('access_token')
    .eq('user_id', user.id)
    .eq('provider', 'meta')
    .single()
  if (error || !data) throw new Error('No Meta token')
  return { user, token: data.access_token as string }
}

async function fbPostFeed(token: string, message: string, link?: string, pageId?: string) {
  const id = pageId || 'me'
  const url = new URL(`https://graph.facebook.com/v18.0/${id}/feed`)
  url.searchParams.set('access_token', token)
  url.searchParams.set('message', message)
  if (link) url.searchParams.set('link', link)
  const resp = await fetch(url.toString(), { method: 'POST' })
  const out = await resp.json()
  if (!resp.ok) throw new Error(out?.error?.message || 'facebook_error')
  return out
}

(globalThis as any).Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const request_id = (globalThis as any).crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`
  try {
    if (req.method !== 'POST') return json({ data: null, error: 'Method Not Allowed', request_id }, { status: 405 })
    const { token } = await getUserAndToken(req)
    const body = await req.json()
    const action = (body.action as string || '').toLowerCase()

    if (action === 'post') {
      const message = body.message as string
      const link = body.link as (string | undefined)
      const page_id = body.page_id as (string | undefined)
      if (!message) throw new Error('Missing message')
      const out = await fbPostFeed(token, message, link, page_id)
      return json({ data: out, error: null, request_id }, { status: 201 })
    }

    return json({ data: null, error: 'Unknown action', request_id }, { status: 400 })
  } catch (e: any) {
    const msg = e?.message || 'error'
    const code = msg === 'Unauthorized' ? 401 : (msg.startsWith('No Meta') ? 400 : 400)
    return json({ data: null, error: msg, request_id }, { status: code })
  }
})
