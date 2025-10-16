import { corsHeaders } from '../_shared/cors.ts'

function json(data: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(data), { ...init, headers: { 'Content-Type': 'application/json', ...corsHeaders, ...(init.headers || {}) } })
}

function env(name: string) {
  return (globalThis as any).Deno.env.get(name)
}

async function searchBing(q: string, count: number, lang?: string) {
  const key = env('AZURE_BING_SEARCH_KEY')
  if (!key) throw new Error('Missing AZURE_BING_SEARCH_KEY')
  const url = new URL('https://api.bing.microsoft.com/v7.0/search')
  url.searchParams.set('q', q)
  url.searchParams.set('count', String(count))
  if (lang) url.searchParams.set('setLang', lang)
  const resp = await fetch(url.toString(), { headers: { 'Ocp-Apim-Subscription-Key': key } })
  const out = await resp.json()
  if (!resp.ok) throw new Error(out?.error?.message || 'bing_error')
  const items = (out.webPages?.value || []).map((it: any) => ({ title: it.name, link: it.url, snippet: it.snippet }))
  return { provider: 'bing', items }
}

async function searchGoogleCSE(q: string, count: number, lang?: string) {
  const key = env('GOOGLE_CSE_API_KEY') || env('GOOGLE_API_KEY')
  const cx = env('GOOGLE_CSE_CX')
  if (!key || !cx) throw new Error('Missing GOOGLE_API_KEY or GOOGLE_CSE_CX')
  const url = new URL('https://www.googleapis.com/customsearch/v1')
  url.searchParams.set('key', key)
  url.searchParams.set('cx', cx)
  url.searchParams.set('q', q)
  url.searchParams.set('num', String(Math.min(count, 10)))
  if (lang) url.searchParams.set('lr', `lang_${lang}`)
  const resp = await fetch(url.toString())
  const out = await resp.json()
  if (!resp.ok) throw new Error(out?.error?.message || 'google_cse_error')
  const items = (out.items || []).map((it: any) => ({ title: it.title, link: it.link, snippet: it.snippet }))
  return { provider: 'google_cse', items }
}

(globalThis as any).Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const request_id = (globalThis as any).crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`
  try {
    if (req.method !== 'GET') return json({ data: null, error: 'Method Not Allowed', request_id }, { status: 405 })
    const u = new URL(req.url)
    const q = u.searchParams.get('q') || ''
    const count = Number(u.searchParams.get('num') || '5')
    const lang = u.searchParams.get('lang') || undefined
    if (!q) return json({ data: null, error: 'Missing q', request_id }, { status: 400 })

    const provider = (env('WEB_SEARCH_PROVIDER') || 'bing').toLowerCase()
    const data = provider === 'google_cse'
      ? await searchGoogleCSE(q, count, lang)
      : await searchBing(q, count, lang)

    return json({ data, error: null, request_id })
  } catch (e: any) {
    return json({ data: null, error: e?.message || 'error', request_id }, { status: 400 })
  }
})
