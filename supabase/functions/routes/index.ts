import { corsHeaders } from '../_shared/cors.ts'

function json(data: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(data), { ...init, headers: { 'Content-Type': 'application/json', ...corsHeaders, ...(init.headers || {}) } })
}

function env(name: string) {
  return (globalThis as any).Deno.env.get(name)
}

type LatLng = { lat: number, lng: number }

type RouteBody = {
  origin: LatLng | string
  destination: LatLng | string
  waypoints?: Array<LatLng | string>
  mode?: 'driving' | 'walking' | 'bicycling' | 'transit'
}

function normalizeCoord(p: LatLng | string): string {
  if (typeof p === 'string') return p
  return `${p.lat},${p.lng}`
}

async function googleDirections(body: RouteBody) {
  const key = env('GOOGLE_MAPS_API_KEY')
  if (!key) throw new Error('Missing GOOGLE_MAPS_API_KEY')
  const url = new URL('https://maps.googleapis.com/maps/api/directions/json')
  url.searchParams.set('origin', normalizeCoord(body.origin))
  url.searchParams.set('destination', normalizeCoord(body.destination))
  if (body.waypoints?.length) url.searchParams.set('waypoints', body.waypoints.map(normalizeCoord).join('|'))
  if (body.mode) url.searchParams.set('mode', body.mode)
  url.searchParams.set('key', key)
  const resp = await fetch(url.toString())
  const out = await resp.json()
  if (!resp.ok || out.status !== 'OK') throw new Error(out?.error_message || out?.status || 'google_directions_error')
  // Map to a compact result
  const route = out.routes?.[0]
  const leg = route?.legs?.[0]
  return {
    provider: 'google',
    distance_meters: leg?.distance?.value,
    duration_seconds: leg?.duration?.value,
    summary: route?.summary,
    polyline: route?.overview_polyline?.points,
    legs: out.routes?.[0]?.legs?.map((l: any) => ({
      start_address: l.start_address,
      end_address: l.end_address,
      distance_meters: l.distance?.value,
      duration_seconds: l.duration?.value,
    })) || [],
  }
}

async function mapboxDirections(body: RouteBody) {
  const token = env('MAPBOX_ACCESS_TOKEN')
  if (!token) throw new Error('Missing MAPBOX_ACCESS_TOKEN')
  const profileMap: Record<string, string> = { driving: 'driving', walking: 'walking', bicycling: 'cycling', transit: 'driving' }
  const profile = profileMap[body.mode || 'driving'] || 'driving'
  // Mapbox expects lng,lat order
  const toLngLat = (p: LatLng | string) => {
    if (typeof p === 'string') return p
    return `${p.lng},${p.lat}`
  }
  const parts = [toLngLat(body.origin)]
  if (body.waypoints?.length) parts.push(...body.waypoints.map(toLngLat))
  parts.push(toLngLat(body.destination))
  const coords = parts.join(';')
  const url = new URL(`https://api.mapbox.com/directions/v5/mapbox/${profile}/${coords}`)
  url.searchParams.set('access_token', token)
  url.searchParams.set('geometries', 'polyline6')
  url.searchParams.set('overview', 'simplified')
  url.searchParams.set('steps', 'false')
  const resp = await fetch(url.toString())
  const out = await resp.json()
  if (!resp.ok || !out.routes?.length) throw new Error(out?.message || 'mapbox_directions_error')
  const r = out.routes[0]
  return {
    provider: 'mapbox',
    distance_meters: Math.round(r.distance),
    duration_seconds: Math.round(r.duration),
    summary: undefined,
    polyline: r.geometry,
    legs: [],
  }
}

(globalThis as any).Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const request_id = (globalThis as any).crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`
  try {
    if (req.method !== 'POST') return json({ data: null, error: 'Method Not Allowed', request_id }, { status: 405 })
    const body = await req.json() as RouteBody
    if (!body?.origin || !body?.destination) return json({ data: null, error: 'Missing origin/destination', request_id }, { status: 400 })
    const provider = (env('ROUTES_PROVIDER') || env('MAPS_PROVIDER') || 'google').toLowerCase()
    const data = provider === 'mapbox' ? await mapboxDirections(body) : await googleDirections(body)
    return json({ data, error: null, request_id })
  } catch (e: any) {
    return json({ data: null, error: e?.message || 'error', request_id }, { status: 400 })
  }
})
