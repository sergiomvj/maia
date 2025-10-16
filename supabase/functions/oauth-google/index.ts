import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

function json(data: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(data), { ...init, headers: { 'Content-Type': 'application/json', ...corsHeaders, ...(init.headers || {}) } })
}

function getEnv(name: string): string | undefined {
  const env = (globalThis as any).Deno.env
  return env.get(name)
}

function getSupabaseKeys() {
  const env = (globalThis as any).Deno.env
  const url = env.get('SUPABASE_URL') ?? env.get('SB_URL') ?? env.get('VITE_SUPABASE_URL') ?? ''
  const anon = env.get('SUPABASE_ANON_KEY') ?? env.get('SB_ANON_KEY') ?? env.get('VITE_SUPABASE_ANON_KEY') ?? ''
  return { url, anon }
}

const DEFAULT_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.readonly',
]

function getBaseUrl(req: Request) {
  const u = new URL(req.url)
  return `${u.protocol}//${u.host}`
}

function getPathSuffix(req: Request) {
  // e.g., /functions/v1/oauth-google/start => returns 'start'
  const u = new URL(req.url)
  const parts = u.pathname.split('/')
  return parts[parts.length - 1] === 'oauth-google' ? '' : parts[parts.length - 1]
}

function setCookie(name: string, value: string, maxAgeSec = 600) {
  return `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeSec}`
}

async function exchangeCodeForTokens(code: string, redirectUri: string, clientId: string, clientSecret: string) {
  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  })
  const resp = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body })
  if (!resp.ok) throw new Error(`Google token exchange failed: ${resp.status}`)
  return await resp.json() as { access_token: string, refresh_token?: string, expires_in: number, scope?: string }
}

(globalThis as any).Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const request_id = (globalThis as any).crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`

  try {
    const suffix = getPathSuffix(req)
    const { url: SB_URL, anon: SB_ANON } = getSupabaseKeys()

    if (suffix === 'start') {
      // Require user session to bind state cookie
      const supabase = createClient(SB_URL, SB_ANON, { global: { headers: { Authorization: req.headers.get('Authorization') || '' } } })
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return json({ data: null, error: 'Unauthorized', request_id }, { status: 401 })

      const CLIENT_ID = getEnv('GOOGLE_CLIENT_ID') || ''
      const CLIENT_SECRET = getEnv('GOOGLE_CLIENT_SECRET') || ''
      if (!CLIENT_ID || !CLIENT_SECRET) return json({ data: null, error: 'Server not configured for Google OAuth', request_id }, { status: 500 })

      const base = getBaseUrl(req)
      const redirectUri = `${base}/functions/v1/oauth-google/callback`
      const scopesParam = new URL(req.url).searchParams.get('scopes')
      const scopes = (scopesParam ? scopesParam.split(' ') : DEFAULT_SCOPES).join(' ')

      const state = (globalThis as any).crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`
      const authorizeUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
      authorizeUrl.searchParams.set('client_id', CLIENT_ID)
      authorizeUrl.searchParams.set('redirect_uri', redirectUri)
      authorizeUrl.searchParams.set('response_type', 'code')
      authorizeUrl.searchParams.set('scope', scopes)
      authorizeUrl.searchParams.set('access_type', 'offline')
      authorizeUrl.searchParams.set('prompt', 'consent')
      authorizeUrl.searchParams.set('state', state)

      return new Response(null, { status: 302, headers: { Location: authorizeUrl.toString(), 'Set-Cookie': setCookie('oauth_state', state) } })
    }

    if (suffix === 'callback') {
      const u = new URL(req.url)
      const state = u.searchParams.get('state') || ''
      const code = u.searchParams.get('code') || ''
      const cookie = req.headers.get('Cookie') || ''
      const stateCookie = (cookie.match(/oauth_state=([^;]+)/) || [])[1]
      if (!state || !stateCookie || state !== stateCookie) return json({ data: null, error: 'Invalid state', request_id }, { status: 400 })

      const supabase = createClient(SB_URL, SB_ANON, { global: { headers: { Authorization: req.headers.get('Authorization') || '' } } })
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return json({ data: null, error: 'Unauthorized', request_id }, { status: 401 })

      const CLIENT_ID = getEnv('GOOGLE_CLIENT_ID') || ''
      const CLIENT_SECRET = getEnv('GOOGLE_CLIENT_SECRET') || ''
      if (!CLIENT_ID || !CLIENT_SECRET) return json({ data: null, error: 'Server not configured for Google OAuth', request_id }, { status: 500 })

      const base = getBaseUrl(req)
      const redirectUri = `${base}/functions/v1/oauth-google/callback`
      const tok = await exchangeCodeForTokens(code, redirectUri, CLIENT_ID, CLIENT_SECRET)

      const scope = tok.scope || DEFAULT_SCOPES.join(' ')
      const expiresAt = new Date(Date.now() + (tok.expires_in * 1000)).toISOString()
      const { error: upErr } = await supabase.from('oauth_tokens').upsert({
        user_id: user.id,
        provider: 'google',
        access_token: tok.access_token,
        refresh_token: tok.refresh_token ?? null,
        expires_at: expiresAt,
        scope,
      })
      if (upErr) return json({ data: null, error: upErr.message, request_id }, { status: 400 })

      return json({ data: { provider: 'google', connected: true }, error: null, request_id })
    }

    return json({ data: null, error: 'Not Found', request_id }, { status: 404 })
  } catch (e: any) {
    return json({ data: null, error: e.message ?? String(e), request_id }, { status: 400 })
  }
})
