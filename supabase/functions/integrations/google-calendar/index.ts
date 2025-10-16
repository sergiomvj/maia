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
  return { user, token: data.access_token as string }
}

(globalThis as any).Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const request_id = (globalThis as any).crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`
  try {
    if (req.method === 'GET') {
      const { token } = await getUserAndToken(req)
      const u = new URL(req.url)
      const timeMin = u.searchParams.get('timeMin') ?? new Date().toISOString()
      const timeMax = u.searchParams.get('timeMax') ?? new Date(Date.now() + 7*24*3600*1000).toISOString()
      const maxResults = u.searchParams.get('maxResults') ?? '20'
      const url = new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events')
      url.searchParams.set('timeMin', timeMin)
      url.searchParams.set('timeMax', timeMax)
      url.searchParams.set('singleEvents', 'true')
      url.searchParams.set('orderBy', 'startTime')
      url.searchParams.set('maxResults', maxResults)
      const resp = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } })
      const out = await resp.json()
      if (!resp.ok) return json({ data: null, error: out?.error ?? 'google_error', request_id }, { status: resp.status })
      return json({ data: out, error: null, request_id })
    }
    if (req.method === 'POST') {
      const { token } = await getUserAndToken(req)
      const body = await req.json()
      const event = {
        summary: body.summary ?? body.title ?? 'Event',
        description: body.description ?? '',
        start: { dateTime: body.start, timeZone: body.timeZone ?? 'UTC' },
        end: { dateTime: body.end, timeZone: body.timeZone ?? 'UTC' },
      }
      const resp = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(event)
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
