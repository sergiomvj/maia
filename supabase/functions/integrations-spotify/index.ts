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
    .eq('provider', 'spotify')
    .single()
  if (error || !data) throw new Error('No Spotify token')
  return { user, token: data.access_token as string }
}

async function spotifyFetch(path: string, method: string, token: string, body?: any) {
  const resp = await fetch(`https://api.spotify.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (resp.status === 204) return null
  const out = await resp.json()
  if (!resp.ok) throw new Error(out?.error?.message || 'spotify_error')
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

    if (action === 'play') {
      const device_id = body.device_id as (string | undefined)
      const uri = body.uri as (string | undefined) // spotify:track:..., spotify:playlist:...
      const context_uri = body.context_uri as (string | undefined) // playlist/album context
      const uris = body.uris as (string[] | undefined)
      const query = device_id ? `?device_id=${encodeURIComponent(device_id)}` : ''
      const payload: any = {}
      if (context_uri) payload.context_uri = context_uri
      if (uri) payload.uris = [uri]
      if (uris?.length) payload.uris = uris
      await spotifyFetch(`/me/player/play${query}`, 'PUT', token, Object.keys(payload).length ? payload : undefined)
      return json({ data: { ok: true }, error: null, request_id })
    }

    if (action === 'pause') {
      const device_id = body.device_id as (string | undefined)
      const query = device_id ? `?device_id=${encodeURIComponent(device_id)}` : ''
      await spotifyFetch(`/me/player/pause${query}`, 'PUT', token)
      return json({ data: { ok: true }, error: null, request_id })
    }

    if (action === 'next') {
      const device_id = body.device_id as (string | undefined)
      const query = device_id ? `?device_id=${encodeURIComponent(device_id)}` : ''
      await spotifyFetch(`/me/player/next${query}`, 'POST', token)
      return json({ data: { ok: true }, error: null, request_id })
    }

    if (action === 'searchtrack') {
      const q = body.q as string
      const limit = Number(body.limit || 10)
      if (!q) throw new Error('Missing q')
      const url = new URL('https://api.spotify.com/v1/search')
      url.searchParams.set('q', q)
      url.searchParams.set('type', 'track')
      url.searchParams.set('limit', String(limit))
      const resp = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } })
      const out = await resp.json()
      if (!resp.ok) throw new Error(out?.error?.message || 'spotify_error')
      return json({ data: out, error: null, request_id })
    }

    return json({ data: null, error: 'Unknown action', request_id }, { status: 400 })
  } catch (e: any) {
    const msg = e?.message || 'error'
    const code = msg === 'Unauthorized' ? 401 : (msg.startsWith('No Spotify') ? 400 : 400)
    return json({ data: null, error: msg, request_id }, { status: code })
  }
})
