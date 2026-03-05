/**
 * Get API Key from Supabase Vault
 *
 * Retrieves whitelisted API keys stored in Supabase Vault.
 * Only returns keys from the ALLOWED_KEYS list.
 *
 * Endpoint: POST /get-api-key
 * Body: { keyName: string }
 *
 * Supported key names:
 * - gemini_api_key: Google Gemini API key (used by blogger tool)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const ALLOWED_KEYS = ['gemini_api_key'];

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const { keyName } = await req.json();

    if (!keyName || !ALLOWED_KEYS.includes(keyName)) {
      return new Response(
        JSON.stringify({ error: `Invalid key name. Allowed: ${ALLOWED_KEYS.join(', ')}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use service role to access vault
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data, error } = await adminClient.rpc('get_vault_secret', { secret_name: keyName });

    if (error || !data) {
      console.error('Vault lookup error:', error);
      return new Response(
        JSON.stringify({ error: 'Secret not found in vault' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ key: data }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
