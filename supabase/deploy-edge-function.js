/**
 * Deploy Edge Function using Supabase Management API
 */
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env') });

const PROJECT_REF = 'fxkjblrlogjumybceozk';
const FUNCTION_NAME = 'seed-scraped-products';
const SUPABASE_ACCESS_TOKEN = process.env.SUPABASE_SERVICE_KEY;

async function deployFunction() {
  try {
    console.log('📦 Reading function source...');
    const functionPath = join(__dirname, 'functions', FUNCTION_NAME, 'index.ts');
    const functionCode = readFileSync(functionPath, 'utf-8');

    console.log(`✅ Read ${functionCode.length} characters from ${FUNCTION_NAME}/index.ts`);
    console.log('🚀 Deploying to Supabase...\n');

    // Create form data manually
    const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
    const body = [
      `--${boundary}`,
      `Content-Disposition: form-data; name="index.ts"; filename="index.ts"`,
      `Content-Type: application/typescript`,
      '',
      functionCode,
      `--${boundary}--`,
      ''
    ].join('\r\n');

    const response = await fetch(
      `https://api.supabase.com/v1/projects/${PROJECT_REF}/functions/${FUNCTION_NAME}`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${SUPABASE_ACCESS_TOKEN}`,
          'Content-Type': `multipart/form-data; boundary=${boundary}`
        },
        body
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Deployment failed: ${response.status} - ${error}`);
    }

    const result = await response.json();
    console.log('✅ Deployment successful!');
    console.log(`Version: ${result.version}`);
    console.log(`Status: ${result.status}`);
    console.log(`Function ID: ${result.id}`);

  } catch (error) {
    console.error('❌ Deployment failed:', error.message);
    process.exit(1);
  }
}

deployFunction();
