import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

(globalThis as any).Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: corsHeaders })

  try {
    const body = await req.json();
    const {
      identidade,
      rotina,
      preferencias,
      locais,
      notificacoes,
      privacidade,
      assistente,
      metas,
    } = body || {}

    const supabaseClient = createClient(
      (globalThis as any).Deno.env.get('SUPABASE_URL') ?? '',
      (globalThis as any).Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const service = createClient(
      (globalThis as any).Deno.env.get('SUPABASE_URL') ?? '',
      (globalThis as any).Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Upsert by user_id
    const { data, error } = await service
      .from('profiles_preferences')
      .upsert({
        user_id: user.id,
        identidade: identidade ?? undefined,
        rotina: rotina ?? undefined,
        preferencias: preferencias ?? undefined,
        locais: locais ?? undefined,
        notificacoes: notificacoes ?? undefined,
        privacidade: privacidade ?? undefined,
        assistente: assistente ?? undefined,
        metas: metas ?? undefined,
      }, { onConflict: 'user_id' })
      .select('*')
      .single();

    if (error) throw error;

    return new Response(JSON.stringify({ preferences: data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 })
  }
});
