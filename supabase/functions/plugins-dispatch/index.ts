import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

function baseUrl(supabaseUrl: string) {
  try {
    const u = new URL(supabaseUrl);
    return `${u.origin}/functions/v1`;
  } catch {
    return `${supabaseUrl}/functions/v1`;
  }
}

async function authHeaders(supabase: any, req: Request) {
  const token = req.headers.get('Authorization');
  if (token) return { Authorization: token };
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Unauthorized');
  return { Authorization: `Bearer ${session.access_token}` };
}

(globalThis as any).Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: corsHeaders })

  try {
    const { provider, action, payload } = await req.json();
    if (!provider || !action) throw new Error('provider and action are required');

    const supabase = createClient(
      (globalThis as any).Deno.env.get('SUPABASE_URL') ?? '',
      (globalThis as any).Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    const headers = await authHeaders(supabase, req);
    const base = baseUrl((globalThis as any).Deno.env.get('SUPABASE_URL') ?? '');

    const callPOST = async (path: string, body: any) => {
      const res = await fetch(`${base}${path}`, {
        method: 'POST',
        headers: { ...headers, 'content-type': 'application/json' },
        body: JSON.stringify(body ?? {}),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || `Upstream error: ${res.status}`);
      return json;
    };

    const callGET = async (path: string, params: Record<string, any>) => {
      const url = new URL(`${base}${path}`);
      for (const [k, v] of Object.entries(params || {})) url.searchParams.set(k, String(v));
      const res = await fetch(url.toString(), { method: 'GET', headers });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || `Upstream error: ${res.status}`);
      return json;
    };

    let result: any = null;

    switch (provider) {
      case 'spotify':
        // actions like searchTrack, play, pause encapsulated by integrations-spotify
        result = await callPOST('/integrations-spotify', { action, ...(payload || {}) });
        break;
      case 'notion':
        result = await callPOST('/integrations-notion', { action, ...(payload || {}) });
        break;
      case 'gmail':
        result = await callPOST('/integrations-gmail', { action, ...(payload || {}) });
        break;
      case 'facebook':
        result = await callPOST('/integrations-facebook', { action, ...(payload || {}) });
        break;
      case 'instagram':
        result = await callPOST('/integrations-instagram', { action, ...(payload || {}) });
        break;
      case 'google_calendar':
        result = await callGET('/integrations-google-calendar', payload || {});
        break;
      case 'web_search':
        result = await callGET('/web-search', payload || {});
        break;
      case 'places_search':
        result = await callGET('/places-search', payload || {});
        break;
      case 'routes':
        result = await callPOST('/routes', payload || {});
        break;
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }

    return new Response(JSON.stringify({ ok: true, result }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as any).message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 })
  }
});
