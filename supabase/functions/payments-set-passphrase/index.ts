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

async function hashArgon2id(plain: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const res = await argon2.hash({
    pass: plain,
    salt,
    type: argon2.ArgonType.Argon2id,
    time: 3,
    mem: 64 * 1024, // 64MB
    hashLen: 32,
    parallelism: 1,
  })
  return res.encoded as string
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

    const body = await req.json().catch(() => ({})) as { passphrase?: string, duress_passphrase?: string }
    const passphrase = (body.passphrase || '').trim()
    const duress = (body.duress_passphrase || '').trim()
    if (!passphrase || passphrase.length < 6) return json({ data: null, error: 'passphrase_min_length', request_id }, { status: 400 })

    const pass_hash = await hashArgon2id(passphrase)
    const duress_hash = duress ? await hashArgon2id(duress) : null

    const { error } = await supabase.from('payment_security').upsert({ user_id: user.id, passphrase_hash: pass_hash, duress_hash }, { onConflict: 'user_id' })
    if (error) throw error

    return json({ data: { ok: true }, error: null, request_id }, { status: 201 })
  } catch (e: any) {
    return json({ data: null, error: e?.message || 'error', request_id }, { status: 400 })
  }
})
