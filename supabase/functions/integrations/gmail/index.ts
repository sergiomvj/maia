import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../../_shared/cors.ts'

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
    .select('access_token, expires_at, scope')
    .eq('user_id', user.id)
    .eq('provider', 'google')
    .single()
  if (error || !data) throw new Error('No Google token')
  return { user, token: (data.access_token as string) }
}

function toBase64Url(str: string) {
  const b64 = btoa(str)
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

(globalThis as any).Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const request_id = (globalThis as any).crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`
  try {
    if (req.method === 'GET') {
      const { token } = await getUserAndToken(req)
      const u = new URL(req.url)
      const q = u.searchParams.get('q') ?? 'is:unread'
      const maxResults = u.searchParams.get('maxResults') ?? '10'
      const url = new URL('https://gmail.googleapis.com/gmail/v1/users/me/messages')
      url.searchParams.set('q', q)
      url.searchParams.set('maxResults', maxResults)
      const resp = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } })
      const out = await resp.json()
      if (!resp.ok) return json({ data: null, error: out?.error ?? 'google_error', request_id }, { status: resp.status })
      return json({ data: out, error: null, request_id })
    }
    if (req.method === 'POST') {
      const { token } = await getUserAndToken(req)
      const body = await req.json()
      const to = body.to as string
      const subject = body.subject as string
      const text = body.text as string
      const from = body.from as (string | undefined)
      if (!to || !subject || !text) throw new Error('Missing to/subject/text')
      const raw = [
        `To: ${to}`,
        from ? `From: ${from}` : undefined,
        `Subject: ${subject}`,
        'Content-Type: text/plain; charset="UTF-8"',
        '',
        text,
      ].filter(Boolean).join('\r\n')
      const encoded = toBase64Url(raw)
      const resp = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw: encoded }),
      })
      const out = await resp.json()
      if (!resp.ok) return json({ data: null, error: out?.error ?? 'google_error', request_id }, { status: resp.status })
      return json({ data: out, error: null, request_id }, { status: 201 })
    }
    return json({ data: null, error: 'Method Not Allowed', request_id }, { status: 405 })
  } catch (e: any) {
    const msg = e?.message || 'error'
    const code = msg === 'Unauthorized' ? 401 : (msg === 'No Google token' ? 400 : 400)
    return json({ data: null, error: msg, request_id }, { status: code })
  }
})
