/**
 * Inspect Supabase Database Schema
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../frontend/.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function inspectTables() {
  console.log('🔍 Inspecting database tables...\n');

  const tables = [
    'categories',
    'seo_keywords',
    'agent_resource',
    'mapper_agent_products',
    'weight_dimension_agent_products',
    'seo_agent_products',
    'scraped_products'
  ];

  for (const table of tables) {
    console.log(`\n📊 Table: ${table}`);
    console.log('-'.repeat(60));

    try {
      // Get column information using information_schema
      const { data, error } = await supabase.rpc('exec_sql', {
        query: `
          SELECT
            column_name,
            data_type,
            is_nullable,
            column_default
          FROM information_schema.columns
          WHERE table_schema = 'public'
          AND table_name = '${table}'
          ORDER BY ordinal_position;
        `
      });

      if (error) {
        // Try direct query if RPC doesn't work
        const { data: directData, error: directError } = await supabase
          .from(table)
          .select('*')
          .limit(0);

        if (directError) {
          console.log(`❌ Error: ${directError.message}`);
        } else {
          console.log(`✅ Table exists (schema introspection unavailable)`);
        }
      } else {
        data.forEach(col => {
          console.log(`  - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? 'NOT NULL' : ''}`);
        });
      }

      // Get row count
      const { count, error: countError } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });

      if (!countError) {
        console.log(`  📈 Row count: ${count || 0}`);
      }

    } catch (err) {
      console.log(`❌ Error inspecting ${table}: ${err.message}`);
    }
  }

  // Check RLS policies using pg_catalog
  console.log('\n\n🔒 Checking RLS Policies...');
  console.log('-'.repeat(60));

  try {
    const { data, error } = await supabase.rpc('exec_sql', {
      query: `
        SELECT
          schemaname,
          tablename,
          policyname,
          permissive,
          roles::text[],
          cmd,
          qual
        FROM pg_policies
        WHERE schemaname = 'public'
        ORDER BY tablename, policyname;
      `
    });

    if (error) {
      console.log('⚠️  Cannot access pg_policies (need admin access)');
    } else if (data && data.length > 0) {
      data.forEach(policy => {
        console.log(`  ${policy.tablename}.${policy.policyname} (${policy.cmd})`);
      });
    } else {
      console.log('⚠️  No RLS policies found');
    }
  } catch (err) {
    console.log('⚠️  RLS policy check unavailable');
  }
}

inspectTables();
