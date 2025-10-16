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

async function igGetUserId(token: string) {
  const me = await fetch(`https://graph.facebook.com/v18.0/me/accounts?access_token=${encodeURIComponent(token)}`)
  const meOut = await me.json()
  if (!me.ok) throw new Error(meOut?.error?.message || 'meta_account_error')
  const page = meOut?.data?.[0]
  if (!page?.id) throw new Error('No connected FB Page found')
  const ig = await fetch(`https://graph.facebook.com/v18.0/${page.id}?fields=instagram_business_account&access_token=${encodeURIComponent(token)}`)
  const igOut = await ig.json()
  if (!ig.ok) throw new Error(igOut?.error?.message || 'meta_ig_error')
  const igUserId = igOut?.instagram_business_account?.id
  if (!igUserId) throw new Error('No Instagram business account linked')
  return igUserId as string
}

async function igPostPhoto(token: string, igUserId: string, imageUrl: string, caption?: string) {
  const containerResp = await fetch(`https://graph.facebook.com/v18.0/${igUserId}/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ image_url: imageUrl, caption: caption || '', access_token: token })
  })
  const containerOut = await containerResp.json()
  if (!containerResp.ok) throw new Error(containerOut?.error?.message || 'instagram_container_error')
  const creationId = containerOut.id
  const publishResp = await fetch(`https://graph.facebook.com/v18.0/${igUserId}/media_publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ creation_id: creationId, access_token: token })
  })
  const publishOut = await publishResp.json()
  if (!publishResp.ok) throw new Error(publishOut?.error?.message || 'instagram_publish_error')
  return publishOut
}

(globalThis as any).Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const request_id = (globalThis as any).crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`
  try {
    if (req.method !== 'POST') return json({ data: null, error: 'Method Not Allowed', request_id }, { status: 405 })
    const { token } = await getUserAndToken(req)
    const body = await req.json()
    const action = (body.action as string || '').toLowerCase()

    if (action === 'postinstagramphoto') {
      const image_url = body.image_url as string
      const caption = body.caption as (string | undefined)
      if (!image_url) throw new Error('Missing image_url')
      const igUserId = await igGetUserId(token)
      const out = await igPostPhoto(token, igUserId, image_url, caption)
      return json({ data: out, error: null, request_id }, { status: 201 })
    }

    return json({ data: null, error: 'Unknown action', request_id }, { status: 400 })
  } catch (e: any) {
    const msg = e?.message || 'error'
    const code = msg === 'Unauthorized' ? 401 : (msg.startsWith('No Meta') ? 400 : 400)
    return json({ data: null, error: msg, request_id }, { status: code })
  }
})
