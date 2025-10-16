import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import * as argon2 from 'https://esm.sh/argon2-browser@1.18.0'

function json(data: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(data), { ...init, headers: { 'Content-Type': 'application/json', ...corsHeaders, ...(init.headers || {}) } })
}

function getSB() {
  const env = (globalThis as any).Deno.env
  const url = env.get('SUPABASE_URL') ?? env.get('SB_URL') ?? env.get('VITE_SUPABASE_URL') ?? ''
  const anon = env.get('SUPABASE_ANON_KEY') ?? env.get('SB_ANON_KEY') ?? env.get('VITE_SUPABASE_ANON_KEY') ?? ''
  return { url, anon }
}

async function verifyArgon2id(encodedHash: string, plain: string) {
  try {
    const ok = await argon2.verify({ pass: plain, encoded: encodedHash })
    return ok === true
  } catch {
    return false
  }
}

// Simple in-memory rate limiter per user (best-effort; stateless edge)
const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX = 5
const attempts = new Map<string, { windowStart: number, count: number }>()

function checkRateLimit(userId: string) {
  const now = Date.now()
  const cur = attempts.get(userId)
  if (!cur || now - cur.windowStart > RATE_LIMIT_WINDOW_MS) {
    attempts.set(userId, { windowStart: now, count: 1 })
    return true
  }
  cur.count += 1
  return cur.count <= RATE_LIMIT_MAX
}

(globalThis as any).Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const request_id = (globalThis as any).crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`
  try {
    if (req.method !== 'POST') return json({ data: null, error: 'Method Not Allowed', request_id }, { status: 405 })

    const { url: SB_URL, anon: SB_ANON } = getSB()
    const supabase = createClient(SB_URL, SB_ANON, { global: { headers: { Authorization: req.headers.get('Authorization') || '' } } })
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return json({ data: null, error: 'Unauthorized', request_id }, { status: 401 })

    if (!checkRateLimit(user.id)) {
      await supabase.from('payment_auth_audit').insert({ user_id: user.id, outcome: 'failure', reason: 'rate_limit' })
      return json({ data: null, error: 'rate_limited', request_id }, { status: 429 })
    }

    const body = await req.json().catch(() => ({})) as { passphrase?: string }
    const passphrase = (body.passphrase || '').trim()
    if (!passphrase) return json({ data: null, error: 'missing_passphrase', request_id }, { status: 400 })

    const { data: sec, error } = await supabase
      .from('payment_security')
      .select('passphrase_hash, duress_hash')
      .eq('user_id', user.id)
      .single()
    if (error || !sec) return json({ data: null, error: 'not_configured', request_id }, { status: 400 })

    const isNormal = sec.passphrase_hash ? await verifyArgon2id(sec.passphrase_hash, passphrase) : false
    const isDuress = !isNormal && sec.duress_hash ? await verifyArgon2id(sec.duress_hash, passphrase) : false

    if (isNormal) {
      await supabase.from('payment_auth_audit').insert({ user_id: user.id, outcome: 'success' })
      return json({ data: { authorized: true, duress: false }, error: null, request_id })
    }
    if (isDuress) {
      await supabase.from('payment_auth_audit').insert({ user_id: user.id, outcome: 'duress' })
      return json({ data: { authorized: false, duress: true }, error: null, request_id })
    }

    await supabase.from('payment_auth_audit').insert({ user_id: user.id, outcome: 'failure', reason: 'invalid_passphrase' })
    return json({ data: { authorized: false, duress: false }, error: 'invalid_passphrase', request_id }, { status: 401 })
  } catch (e: any) {
    return json({ data: null, error: e?.message || 'error', request_id }, { status: 400 })
  }
})
