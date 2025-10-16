import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

function json(data: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(data), { ...init, headers: { 'Content-Type': 'application/json', ...corsHeaders, ...(init.headers || {}) } })
}

function envGet(name: string) {
  const env = (globalThis as any).Deno.env
  return env.get(name)
}

function getSB() {
  const env = (globalThis as any).Deno.env
  const url = env.get('SUPABASE_URL') ?? env.get('SB_URL') ?? env.get('VITE_SUPABASE_URL') ?? ''
  const anon = env.get('SUPABASE_ANON_KEY') ?? env.get('SB_ANON_KEY') ?? env.get('VITE_SUPABASE_ANON_KEY') ?? ''
  return { url, anon }
}

function baseUrl(req: Request) {
  const u = new URL(req.url)
  return `${u.protocol}//${u.host}`
}

function pathSuffix(req: Request) {
  const u = new URL(req.url)
  const parts = u.pathname.split('/')
  return parts[parts.length - 1] === 'oauth-meta' ? '' : parts[parts.length - 1]
}

function setCookie(name: string, value: string, maxAgeSec = 600) {
  return `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeSec}`
}

async function exchangeMeta(code: string, redirectUri: string, appId: string, appSecret: string) {
  const url = new URL('https://graph.facebook.com/v18.0/oauth/access_token')
  url.searchParams.set('client_id', appId)
  url.searchParams.set('client_secret', appSecret)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('code', code)
  const resp = await fetch(url.toString())
  if (!resp.ok) throw new Error(`Meta token exchange failed: ${resp.status}`)
  return await resp.json() as { access_token: string, token_type?: string, expires_in?: number }
}

(globalThis as any).Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const request_id = (globalThis as any).crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`

  try {
    const suffix = pathSuffix(req)
    const { url: SB_URL, anon: SB_ANON } = getSB()

    if (suffix === 'start') {
      const supabase = createClient(SB_URL, SB_ANON, { global: { headers: { Authorization: req.headers.get('Authorization') || '' } } })
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return json({ data: null, error: 'Unauthorized', request_id }, { status: 401 })

      const APP_ID = envGet('META_APP_ID') || ''
      const APP_SECRET = envGet('META_APP_SECRET') || ''
      if (!APP_ID || !APP_SECRET) return json({ data: null, error: 'Server not configured for Meta OAuth', request_id }, { status: 500 })

      const base = baseUrl(req)
      const redirectUri = `${base}/functions/v1/oauth-meta/callback`
      const state = (globalThis as any).crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`
      const authorizeUrl = new URL('https://www.facebook.com/v18.0/dialog/oauth')
      authorizeUrl.searchParams.set('client_id', APP_ID)
      authorizeUrl.searchParams.set('redirect_uri', redirectUri)
      authorizeUrl.searchParams.set('response_type', 'code')
      // Minimal scopes for FB Pages + IG Basic linkage; adjust as needed or via query param later
      authorizeUrl.searchParams.set('scope', 'pages_manage_posts pages_read_engagement pages_show_list instagram_basic')
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

      const APP_ID = envGet('META_APP_ID') || ''
      const APP_SECRET = envGet('META_APP_SECRET') || ''
      const base = baseUrl(req)
      const redirectUri = `${base}/functions/v1/oauth-meta/callback`
      const tok = await exchangeMeta(code, redirectUri, APP_ID, APP_SECRET)

      const expiresAt = tok.expires_in ? new Date(Date.now() + (tok.expires_in * 1000)).toISOString() : null
      const { error: upErr } = await supabase.from('oauth_tokens').upsert({
        user_id: user.id,
        provider: 'meta',
        access_token: tok.access_token,
        refresh_token: null, // Meta uses long-lived tokens and page tokens; handle later
        expires_at: expiresAt,
        scope: 'pages_manage_posts pages_read_engagement pages_show_list instagram_basic',
      })
      if (upErr) return json({ data: null, error: upErr.message, request_id }, { status: 400 })

      return json({ data: { provider: 'meta', connected: true }, error: null, request_id })
    }

    return json({ data: null, error: 'Not Found', request_id }, { status: 404 })
  } catch (e: any) {
    return json({ data: null, error: e.message ?? String(e), request_id }, { status: 400 })
  }
})
