import { corsHeaders } from '../_shared/cors.ts'

function json(data: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(data), { ...init, headers: { 'Content-Type': 'application/json', ...corsHeaders, ...(init.headers || {}) } })
}

function env(name: string) {
  return (globalThis as any).Deno.env.get(name)
}

async function searchGooglePlaces(q: string, lat?: number, lng?: number, limit = 5) {
  const key = env('GOOGLE_MAPS_API_KEY')
  if (!key) throw new Error('Missing GOOGLE_MAPS_API_KEY')
  const url = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json')
  url.searchParams.set('query', q)
  if (lat != null && lng != null) {
    url.searchParams.set('location', `${lat},${lng}`)
    url.searchParams.set('radius', '5000') // 5km padrão
  }
  url.searchParams.set('key', key)
  const resp = await fetch(url.toString())
  const out = await resp.json()
  if (!resp.ok) throw new Error(out?.error_message || 'google_places_error')
  const items = (out.results || []).slice(0, limit).map((r: any) => ({
    id: r.place_id,
    name: r.name,
    address: r.formatted_address,
    location: r.geometry?.location,
    rating: r.rating,
    types: r.types,
    url: `https://www.google.com/maps/place/?q=place_id:${r.place_id}`,
  }))
  return { provider: 'google', items }
}

async function searchMapbox(q: string, lat?: number, lng?: number, limit = 5) {
  const token = env('MAPBOX_ACCESS_TOKEN')
  if (!token) throw new Error('Missing MAPBOX_ACCESS_TOKEN')
  const proximity = (lat != null && lng != null) ? `${lng},${lat}` : undefined
  const url = new URL(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json`)
  url.searchParams.set('access_token', token)
  url.searchParams.set('limit', String(limit))
  if (proximity) url.searchParams.set('proximity', proximity)
  const resp = await fetch(url.toString())
  const out = await resp.json()
  if (!resp.ok) throw new Error(out?.message || 'mapbox_error')
  const items = (out.features || []).map((f: any) => ({
    id: f.id,
    name: f.text,
    address: f.place_name,
    location: { lat: f.center?.[1], lng: f.center?.[0] },
    types: f.place_type,
    url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(f.place_name)}`,
  }))
  return { provider: 'mapbox', items }
}

(globalThis as any).Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const request_id = (globalThis as any).crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`
  try {
    if (req.method !== 'GET') return json({ data: null, error: 'Method Not Allowed', request_id }, { status: 405 })
    const u = new URL(req.url)
    const q = u.searchParams.get('q') || ''
    const limit = Number(u.searchParams.get('limit') || '5')
    const lat = u.searchParams.get('lat') ? Number(u.searchParams.get('lat')) : undefined
    const lng = u.searchParams.get('lng') ? Number(u.searchParams.get('lng')) : undefined
    if (!q) return json({ data: null, error: 'Missing q', request_id }, { status: 400 })

    const provider = (env('PLACES_PROVIDER') || env('MAPS_PROVIDER') || 'google').toLowerCase()
    const data = provider === 'mapbox'
      ? await searchMapbox(q, lat, lng, limit)
      : await searchGooglePlaces(q, lat, lng, limit)

    return json({ data, error: null, request_id })
  } catch (e: any) {
    return json({ data: null, error: e?.message || 'error', request_id }, { status: 400 })
  }
})
