import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

// Encryption functions using Web Crypto API
async function getKey(secret: string): Promise<CryptoKey> {
  const keyData = new TextEncoder().encode(secret);
  return await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
}

async function encrypt(data: string, secret: string): Promise<string> {
  const key = await getKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encodedData = new TextEncoder().encode(data);
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encodedData
  );

  const buffer = new Uint8Array(iv.length + encrypted.byteLength);
  buffer.set(iv);
  buffer.set(new Uint8Array(encrypted), iv.length);

  return btoa(String.fromCharCode(...buffer));
}


// FIX: Cast Deno to `any` to work around incorrect type definitions in the environment.
(Deno as any).serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { apiKey, llmProvider } = await req.json();
    if (!apiKey) {
      throw new Error("API key is required.");
    }

    // Create a Supabase client with the Auth context of the logged-in user.
    const supabaseClient = createClient(
      // FIX: Cast Deno to `any` to work around incorrect type definitions in the environment.
      (Deno as any).env.get('SUPABASE_URL') ?? '',
      // FIX: Cast Deno to `any` to work around incorrect type definitions in the environment.
      (Deno as any).env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    // Get the user from the session.
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Encrypt the API key.
    // FIX: Cast Deno to `any` to work around incorrect type definitions in the environment.
    const encryptionKey = (Deno as any).env.get('ENCRYPTION_KEY');
    if (!encryptionKey) {
        throw new Error('ENCRYPTION_KEY is not set in environment variables.');
    }
    const encryptedApiKey = await encrypt(apiKey, encryptionKey);
    
    // Create a service role client to update the user's profile.
    const serviceClient = createClient(
        // FIX: Cast Deno to `any` to work around incorrect type definitions in the environment.
        (Deno as any).env.get('SUPABASE_URL') ?? '',
        // FIX: Cast Deno to `any` to work around incorrect type definitions in the environment.
        (Deno as any).env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    const profileUpdate: { encrypted_api_key: string, llm_provider?: string } = { encrypted_api_key: encryptedApiKey };
    if (llmProvider) {
        profileUpdate.llm_provider = llmProvider;
    }

    const { error: updateError } = await serviceClient
      .from('profiles')
      .update(profileUpdate)
      .eq('id', user.id);

    if (updateError) {
      throw updateError;
    }

    return new Response(JSON.stringify({ message: 'API key saved successfully' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})