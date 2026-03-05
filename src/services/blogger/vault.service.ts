/**
 * Vault Service
 * Fetches and caches API keys from Supabase Vault via edge function
 */

import { supabase } from '@/lib/supabase/client';

let cachedGeminiKey: string | null = null;

/**
 * Fetch Gemini API key from Supabase Vault.
 * Caches the result in memory for the session.
 */
export async function getGeminiApiKey(): Promise<string> {
  if (cachedGeminiKey) return cachedGeminiKey;

  const { data, error } = await supabase.functions.invoke('get-api-key', {
    body: { keyName: 'gemini_api_key' },
  });

  if (error) {
    throw new Error(`Vault fetch failed: ${error.message}`);
  }

  const key = data?.key;
  if (!key) throw new Error('Empty key returned from vault');

  cachedGeminiKey = key;
  return key;
}

/**
 * Clear the cached key (e.g., on logout)
 */
export function clearCachedKeys(): void {
  cachedGeminiKey = null;
}
