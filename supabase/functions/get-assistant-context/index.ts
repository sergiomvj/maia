import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

(globalThis as any).Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const url = new URL(req.url);
    const assistantId = url.searchParams.get('assistant_id') || null;

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

    // Load assistant profile (by id or latest for user)
    let assistant: any = null;
    if (assistantId) {
      const { data, error } = await service
        .from('assistant_profiles')
        .select('*')
        .eq('id', assistantId)
        .single();
      if (error) throw error;
      if (data.user_id !== user.id) return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      assistant = data;
    } else {
      const { data, error } = await service
        .from('assistant_profiles')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      if (error) throw error;
      assistant = data;
    }

    // Load relationship context (latest)
    const { data: rel } = await service
      .from('user_relationship_context')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const context = {
      assistant: {
        id: assistant.id,
        name: assistant.name,
        description: assistant.description,
        traits: assistant.traits,
        backstory: assistant.backstory,
        motivations: assistant.motivations,
        conflicts: assistant.conflicts,
        abilities: assistant.abilities,
        seed: assistant.seed,
        image_url: assistant.image_url,
      },
      relationship: rel ?? null,
    };

    return new Response(JSON.stringify(context), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 })
  }
});
