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
    .eq('provider', 'notion')
    .single()
  if (error || !data) throw new Error('No Notion token')
  return { user, token: data.access_token as string }
}

async function notionFetch(path: string, method: string, token: string, body?: any) {
  const resp = await fetch(`https://api.notion.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Notion-Version': '2022-06-28',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const out = await resp.json()
  if (!resp.ok) throw new Error(out?.message || out?.error || 'notion_error')
  return out
}

(globalThis as any).Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const request_id = (globalThis as any).crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`
  try {
    const u = new URL(req.url)
    if (req.method !== 'POST') return json({ data: null, error: 'Method Not Allowed', request_id }, { status: 405 })
    const { token } = await getUserAndToken(req)
    const body = await req.json()
    const action = (body.action as string || '').toLowerCase()

    if (action === 'createpage') {
      const parent = body.parent_id ? { page_id: body.parent_id } : (body.database_id ? { database_id: body.database_id } : null)
      if (!parent) throw new Error('Missing parent_id or database_id')
      const title = body.title || 'Untitled'
      const properties = body.properties ?? (parent.hasOwnProperty('database_id') ? { Name: { title: [{ text: { content: title } }] } } : {})
      const payload = { parent, properties, ...(body.children ? { children: body.children } : {}), ...(parent.hasOwnProperty('page_id') ? { title: [{ type: 'text', text: { content: title } }] } : {}) }
      const out = await notionFetch('/pages', 'POST', token, payload)
      return json({ data: out, error: null, request_id }, { status: 201 })
    }

    if (action === 'appendblock') {
      const block_id = body.block_id as string
      const children = body.children as any[]
      if (!block_id || !children?.length) throw new Error('Missing block_id or children')
      const out = await notionFetch(`/blocks/${block_id}/children`, 'PATCH', token, { children })
      return json({ data: out, error: null, request_id })
    }

    return json({ data: null, error: 'Unknown action', request_id }, { status: 400 })
  } catch (e: any) {
    const msg = e?.message || 'error'
    const code = msg === 'Unauthorized' ? 401 : (msg.startsWith('No Notion') ? 400 : 400)
    return json({ data: null, error: msg, request_id }, { status: code })
  }
})
