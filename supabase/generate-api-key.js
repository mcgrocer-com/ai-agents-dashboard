/**
 * Generate custom API key for seed-scraped-products Edge Function
 *
 * Usage:
 *   node generate-api-key.js [key-name] [expiration-days]
 *
 * Examples:
 *   node generate-api-key.js "Dashboard API Key"
 *   node generate-api-key.js "Dashboard API Key" 365
 */

import { createClient } from '@supabase/supabase-js';
import { randomBytes, createHash } from 'crypto';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Get directory path for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from parent directory (linode/)
dotenv.config({ path: join(__dirname, '..', '.env') });

// Configuration
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Error: Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in .env file');
  process.exit(1);
}

// Parse arguments
const keyName = process.argv[2] || 'Default API Key';
const expirationDays = process.argv[3] ? parseInt(process.argv[3], 10) : null;

/**
 * Generate a random API key (32 bytes = 64 hex chars)
 */
function generateApiKey() {
  return randomBytes(32).toString('hex');
}

/**
 * Hash API key using SHA-256
 */
function hashApiKey(key) {
  return createHash('sha256').update(key).digest('hex');
}

/**
 * Insert API key into database
 */
async function insertApiKey(supabase, keyHash, name, expiresAt) {
  const { data, error } = await supabase
    .from('api_keys')
    .insert({
      key_hash: keyHash,
      name,
      permissions: {
        scraped_products: ['insert', 'select']
      },
      is_active: true,
      expires_at: expiresAt
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to insert API key: ${error.message}`);
  }

  return data;
}

/**
 * Main function
 */
async function main() {
  try {
    console.log('🔑 Generating custom API key...\n');

    // Initialize Supabase client with service role key (admin access)
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Generate random API key
    const apiKey = generateApiKey();
    const keyHash = hashApiKey(apiKey);

    // Calculate expiration date
    const expiresAt = expirationDays
      ? new Date(Date.now() + expirationDays * 24 * 60 * 60 * 1000).toISOString()
      : null;

    // Insert into database
    const record = await insertApiKey(supabase, keyHash, keyName, expiresAt);

    // Display results
    console.log('✅ API Key Generated Successfully!\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Name:        ${keyName}`);
    console.log(`ID:          ${record.id}`);
    console.log(`Created:     ${new Date(record.created_at).toLocaleString()}`);
    console.log(`Expires:     ${expiresAt ? new Date(expiresAt).toLocaleString() : 'Never'}`);
    console.log(`Permissions: scraped_products [insert, select]`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('⚠️  IMPORTANT: Copy this API key now - it will NOT be shown again!\n');
    console.log(`API Key: ${apiKey}\n`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('Usage in HTTP requests:\n');
    console.log('  X-API-Key: ' + apiKey + '\n');
    console.log('Example curl command:\n');
    console.log(`  curl -X POST \\`);
    console.log(`    ${SUPABASE_URL}/functions/v1/seed-scraped-products \\`);
    console.log(`    -H "X-API-Key: ${apiKey}" \\`);
    console.log(`    -H "Content-Type: application/json" \\`);
    console.log(`    -d @products.json\n`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
