import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

(globalThis as any).Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const body = await req.json();
    const { id, title, content, tags } = body || {};
    if (!title || !content) throw new Error('title and content are required');

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

    if (id) {
      const { data: existing, error: exErr } = await service.from('user_knowledge').select('id,user_id').eq('id', id).single();
      if (exErr || !existing) throw new Error('knowledge not found');
      if (existing.user_id !== user.id) throw new Error('forbidden');
      const { data, error } = await service.from('user_knowledge').update({ title, content, tags: tags ?? [] }).eq('id', id).select('*').single();
      if (error) throw error;
      return new Response(JSON.stringify({ knowledge: data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
    } else {
      const { data, error } = await service.from('user_knowledge').insert({ user_id: user.id, title, content, tags: tags ?? [] }).select('*').single();
      if (error) throw error;
      return new Response(JSON.stringify({ knowledge: data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 201 })
    }
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 })
  }
});
