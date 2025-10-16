import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

(globalThis as any).Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const body = await req.json();
    const { id, name, description, traits, backstory, motivations, conflicts, abilities } = body || {};
    if (!id) throw new Error('id is required');

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

    const { data: existing, error: exErr } = await service
      .from('assistant_profiles')
      .select('id, user_id')
      .eq('id', id)
      .single();
    if (exErr || !existing) throw new Error('assistant not found');
    if (existing.user_id !== user.id) throw new Error('forbidden');

    const updatePayload: any = {};
    if (name !== undefined) updatePayload.name = name;
    if (description !== undefined) updatePayload.description = description;
    if (traits !== undefined) updatePayload.traits = traits;
    if (backstory !== undefined) updatePayload.backstory = backstory;
    if (motivations !== undefined) updatePayload.motivations = motivations;
    if (conflicts !== undefined) updatePayload.conflicts = conflicts;
    if (abilities !== undefined) updatePayload.abilities = abilities;

    const { data, error } = await service
      .from('assistant_profiles')
      .update(updatePayload)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;

    return new Response(JSON.stringify({ assistant: data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 })
  }
});
