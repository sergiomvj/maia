import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { GoogleGenAI } from '@google/genai'
import { corsHeaders } from '../_shared/cors.ts'
import { createLogger, newRequestId, hashUserId } from '../_shared/logger.ts'

// --- DECRYPTION HELPERS ---
async function getKey(secret: string): Promise<CryptoKey> {
  const keyData = new TextEncoder().encode(secret);
  return await crypto.subtle.importKey('raw', keyData, { name: 'AES-GCM' }, false, ['decrypt']);
}

async function decrypt(encryptedData: string, secret: string): Promise<string> {
  const key = await getKey(secret);
  const data = new Uint8Array(atob(encryptedData).split('').map(c => c.charCodeAt(0)));
  const iv = data.slice(0, 12);
  const encrypted = data.slice(12);
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, encrypted);
  return new TextDecoder().decode(decrypted);
}


// FIX: Cast Deno to any via globalThis to satisfy non-Deno type checkers.
(globalThis as any).Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const request_id = newRequestId();
  let log = createLogger(request_id);
  try {
    const body = await req.json()
    const query = body?.query as string
    if (!query || typeof query !== 'string') {
      throw new Error('Query is required.')
    }

    // Auth and get user
    const supabaseClient = createClient(
      // FIX: Cast Deno to any via globalThis to satisfy non-Deno type checkers.
      (globalThis as any).Deno.env.get('SUPABASE_URL') ?? '',
      // FIX: Cast Deno to any via globalThis to satisfy non-Deno type checkers.
      (globalThis as any).Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )
    const { data: { user } } = await supabaseClient.auth.getUser()
    log = createLogger(request_id, { user_hash: hashUserId(user?.id) })
    if (!user) {
      log.error('unauthorized')
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Request-Id': request_id },
      })
    }
    
    // Get profile and decrypt API key
    const serviceClient = createClient(
      // FIX: Cast Deno to any via globalThis to satisfy non-Deno type checkers.
      (globalThis as any).Deno.env.get('SUPABASE_URL') ?? '',
      // FIX: Cast Deno to any via globalThis to satisfy non-Deno type checkers.
      (globalThis as any).Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    const { data: profile, error: profileError } = await serviceClient
      .from('profiles')
      .select('encrypted_api_key, llm_provider, language')
      .eq('id', user.id)
      .single()
      
    if (profileError || !profile || !profile.encrypted_api_key) {
      throw new Error('API key not found or user profile missing.')
    }
    
    // FIX: Cast Deno to any via globalThis to satisfy non-Deno type checkers.
    const encryptionKey = (globalThis as any).Deno.env.get('ENCRYPTION_KEY');
    if (!encryptionKey) throw new Error('Server config error: ENCRYPTION_KEY not set.');
    
    const apiKey = await decrypt(profile.encrypted_api_key, encryptionKey);
    const headerLang = (req.headers.get('x-user-lang') || '').trim();
    const profileLang = (profile as any).language || '';
    const language = headerLang || profileLang || 'pt-BR';
    log.info('starting_generation', { provider: profile.llm_provider || 'gemini', language })

    // Retrieve notes context (simple LIKE and optional vector search via RPC if available)
    const likeLimit = Math.min(Number(body?.notes_like_limit ?? 5), 20)
    const likeRes = await serviceClient
      .from('notes')
      .select('id, content, created_at')
      .ilike('content', `%${query}%`)
      .order('created_at', { ascending: false })
      .limit(likeLimit)

    let noteMatches: Array<{ id: string, content: string }> = []
    if (!likeRes.error && Array.isArray(likeRes.data)) {
      noteMatches.push(...likeRes.data.map((n: any) => ({ id: n.id, content: n.content })))
    }
    // Optional vector RPC fallback
    try {
      const matchCount = Math.min(Number(body?.notes_vector_limit ?? 5), 20)
      const { data: vec } = await serviceClient.rpc('match_notes', { p_query: query, p_match_count: matchCount })
      if (Array.isArray(vec)) {
        for (const v of vec) {
          if (!noteMatches.find(m => m.id === v.id)) noteMatches.push({ id: v.id, content: v.content })
        }
      }
    } catch (_) { /* rpc not available; ignore */ }

    // Retrieve simple user knowledge (title/content LIKE, optional vector)
    const kLikeLimit = Math.min(Number(body?.knowledge_like_limit ?? 5), 20)
    const kLikeRes = await serviceClient
      .from('user_knowledge')
      .select('id, title, content, created_at')
      .eq('user_id', user.id)
      .or(`title.ilike.%${query}%,content.ilike.%${query}%`)
      .order('updated_at', { ascending: false })
      .limit(kLikeLimit)

    let knowledgeMatches: Array<{ id: string, title: string, content: string }> = []
    if (!kLikeRes.error && Array.isArray(kLikeRes.data)) {
      knowledgeMatches.push(...kLikeRes.data.map((k: any) => ({ id: k.id, title: k.title, content: k.content })))
    }
    try {
      const kMatchCount = Math.min(Number(body?.knowledge_vector_limit ?? 5), 20)
      const { data: kvec } = await serviceClient.rpc('match_user_knowledge', { p_query: query, p_match_count: kMatchCount })
      if (Array.isArray(kvec)) {
        for (const v of kvec) {
          if (!knowledgeMatches.find(m => m.id === v.id)) knowledgeMatches.push({ id: v.id, title: v.title, content: v.content })
        }
      }
    } catch (_) { /* rpc not available; ignore */ }

    // Load assistant profile (latest) and relationship context (latest)
    let assistantCtx: any = null;
    try {
      const { data: a } = await serviceClient
        .from('assistant_profiles')
        .select('id,name,description,traits,backstory,motivations,conflicts,abilities,seed,image_url,created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      assistantCtx = a ?? null;
    } catch(_) {}
    let relationshipCtx: any = null;
    try {
      const { data: r } = await serviceClient
        .from('user_relationship_context')
        .select('id,details,updated_at')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      relationshipCtx = r ?? null;
    } catch(_) {}

    // Build system prompt with assistant + notes + knowledge context
    const notesContext = noteMatches.slice(0, 8).map((m, i) => `Note#${i+1} (${m.id}): ${m.content.slice(0, 500)}`).join('\n')
    const knowledgeContext = knowledgeMatches.slice(0, 8).map((m, i) => `Knowledge#${i+1} (${m.id}) ${m.title}: ${m.content.slice(0, 500)}`).join('\n')
    const assistantContext = assistantCtx ? `Assistant persona:\n- name: ${assistantCtx.name}\n- description: ${assistantCtx.description || ''}\n- traits: ${JSON.stringify(assistantCtx.traits || {})}\n- backstory: ${assistantCtx.backstory || ''}\n- motivations: ${assistantCtx.motivations || ''}\n- conflicts: ${assistantCtx.conflicts || ''}\n- abilities: ${JSON.stringify(assistantCtx.abilities || [])}\n` : '(no assistant profile)'
    const relationshipContext = relationshipCtx ? `Relationship context:\n${JSON.stringify(relationshipCtx.details)}` : '(no relationship context)'
    const systemInstructions = `You are Maia. Prefer grounded facts and the user's provided context. Maintain persona consistency. Cite sources when possible. Respond in ${language}.\n\nUser query: ${query}\n\n${assistantContext}\n${relationshipContext}\n\nUser notes context (may be empty):\n${notesContext || '(no matches)'}\n\nUser knowledge context (may be empty):\n${knowledgeContext || '(no matches)'}\n\nReturn a concise, helpful answer.`
      + `\n\nUser knowledge context (may be empty):\n${knowledgeContext || '(no matches)'}`

    // Call Gemini with Google Search tool and notes context
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: systemInstructions,
      config: { tools: [{ googleSearch: {} }] },
    });

    const text = response.text;
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    // Add assistant, relationship, note and knowledge excerpts to citations array
    const assistantCitations = assistantCtx ? [{
      id: assistantCtx.id,
      type: 'assistant_profile',
      title: assistantCtx.name,
      excerpt: (assistantCtx.description || '').slice(0, 240),
    }] : [] as any[];
    const relationshipCitations = relationshipCtx ? [{
      id: relationshipCtx.id,
      type: 'relationship_context',
      title: 'Relationship',
      excerpt: JSON.stringify(relationshipCtx.details).slice(0, 240),
    }] : [] as any[];
    const noteCitations = noteMatches.slice(0, 8).map((m, i) => ({
      id: m.id,
      type: 'note',
      title: `Note#${i+1}`,
      excerpt: m.content.slice(0, 240),
    }))
    const knowledgeCitations = knowledgeMatches.slice(0, 8).map((m, i) => ({
      id: m.id,
      type: 'knowledge',
      title: m.title || `Knowledge#${i+1}`,
      excerpt: m.content.slice(0, 240),
    }))

    log.info('generation_success', { citations_count: (assistantCitations.length + relationshipCitations.length + knowledgeCitations.length + noteCitations.length + groundingChunks.length) })
    return new Response(JSON.stringify({ text, citations: [...assistantCitations, ...relationshipCitations, ...knowledgeCitations, ...noteCitations, ...groundingChunks] }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Request-Id': request_id },
      status: 200,
    })
  } catch (error: any) {
    log.error('generation_error', { error: String(error?.message || error) })
    return new Response(JSON.stringify({ error: error.message, request_id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Request-Id': request_id },
      status: 400,
    })
  }
})
