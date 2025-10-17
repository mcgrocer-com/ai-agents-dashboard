/**
 * Supabase Test Data Seeding Script
 *
 * This script:
 * 1. Creates test users with different roles
 * 2. Seeds reference data (categories, keywords, agent resources)
 * 3. Creates sample agent results for testing
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from frontend/.env
dotenv.config({ path: join(__dirname, '../frontend/.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
  process.exit(1);
}

// Create Supabase admin client
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Test users configuration
const TEST_USERS = [
  {
    email: 'admin@mcgrocer.com',
    password: 'Test123!@#',
    role: 'admin',
    metadata: { role: 'admin' }
  },
  {
    email: 'reviewer@mcgrocer.com',
    password: 'Test123!@#',
    role: 'reviewer',
    metadata: { role: 'reviewer' }
  },
  {
    email: 'seo@mcgrocer.com',
    password: 'Test123!@#',
    role: 'seo-expert',
    metadata: { role: 'seo-expert' }
  }
];

// Reference data - Updated to match actual database schema
const CATEGORIES = [
  { name: 'Food & Beverages', description: 'Food, drinks, and grocery items', level: 1, is_active: true },
  { name: 'Health & Beauty', description: 'Healthcare and beauty products', level: 1, is_active: true },
  { name: 'Home & Garden', description: 'Home improvement and gardening', level: 1, is_active: true },
  { name: 'Electronics', description: 'Electronic devices and accessories', level: 1, is_active: true },
  { name: 'Clothing & Apparel', description: 'Clothing and fashion items', level: 1, is_active: true },
  { name: 'Sports & Outdoors', description: 'Sports equipment and outdoor gear', level: 1, is_active: true },
  { name: 'Toys & Games', description: 'Toys, games, and entertainment', level: 1, is_active: true },
  { name: 'Books & Media', description: 'Books, movies, and media', level: 1, is_active: true },
  { name: 'Pet Supplies', description: 'Pet food and accessories', level: 1, is_active: true },
  { name: 'Baby & Kids', description: 'Baby and children products', level: 1, is_active: true }
];

const SEO_KEYWORDS = [
  { keyword: 'organic', category: 'general', priority: 10, is_active: true },
  { keyword: 'natural', category: 'general', priority: 8, is_active: true },
  { keyword: 'premium', category: 'general', priority: 5, is_active: true },
  { keyword: 'eco-friendly', category: 'general', priority: 7, is_active: true },
  { keyword: 'sustainable', category: 'general', priority: 6, is_active: true },
  { keyword: 'handmade', category: 'general', priority: 4, is_active: true },
  { keyword: 'luxury', category: 'general', priority: 9, is_active: true },
  { keyword: 'best', category: 'general', priority: 10, is_active: true },
  { keyword: 'top rated', category: 'general', priority: 8, is_active: true },
  { keyword: 'professional', category: 'general', priority: 7, is_active: true }
];

const AGENT_RESOURCES = [
  {
    agent_type: 'category',
    resource_type: 'guideline',
    title: 'Category Mapping Guidelines',
    content: 'Map products to the most specific category available. Consider product type, use case, and target audience.',
    is_active: true,
    version: 1
  },
  {
    agent_type: 'weight_dimension',
    resource_type: 'guideline',
    title: 'Weight & Dimension Estimation',
    content: 'Estimate weight and dimensions based on product images and descriptions. Use industry standards for similar products.',
    is_active: true,
    version: 1
  },
  {
    agent_type: 'seo',
    resource_type: 'guideline',
    title: 'SEO Optimization Guidelines',
    content: 'Create SEO-friendly titles and descriptions. Include relevant keywords naturally. Focus on user intent.',
    is_active: true,
    version: 1
  }
];

/**
 * Create test users
 */
async function createTestUsers() {
  console.log('\n📝 Creating test users...');

  const results = {
    created: [],
    failed: [],
    existing: []
  };

  for (const user of TEST_USERS) {
    try {
      // Check if user already exists
      const { data: existingUsers } = await supabase.auth.admin.listUsers();
      const userExists = existingUsers?.users?.some(u => u.email === user.email);

      if (userExists) {
        console.log(`⚠️  User ${user.email} already exists, skipping...`);
        results.existing.push(user.email);
        continue;
      }

      // Create user with admin API
      const { data, error } = await supabase.auth.admin.createUser({
        email: user.email,
        password: user.password,
        email_confirm: true,
        user_metadata: user.metadata
      });

      if (error) {
        console.error(`❌ Failed to create ${user.email}:`, error.message);
        results.failed.push({ email: user.email, error: error.message });
      } else {
        console.log(`✅ Created user: ${user.email} (role: ${user.role})`);
        results.created.push(user.email);
      }
    } catch (err) {
      console.error(`❌ Error creating ${user.email}:`, err.message);
      results.failed.push({ email: user.email, error: err.message });
    }
  }

  return results;
}

/**
 * Seed categories table
 */
async function seedCategories() {
  console.log('\n📦 Seeding categories...');

  const { data, error } = await supabase
    .from('categories')
    .upsert(CATEGORIES, { onConflict: 'name', ignoreDuplicates: true })
    .select();

  if (error) {
    console.error('❌ Failed to seed categories:', error.message);
    return { success: false, error: error.message };
  }

  console.log(`✅ Seeded ${data.length} categories`);
  return { success: true, count: data.length };
}

/**
 * Seed SEO keywords table
 */
async function seedKeywords() {
  console.log('\n🔑 Seeding SEO keywords...');

  const { data, error } = await supabase
    .from('seo_keywords')
    .upsert(SEO_KEYWORDS, { onConflict: 'keyword', ignoreDuplicates: true })
    .select();

  if (error) {
    console.error('❌ Failed to seed keywords:', error.message);
    return { success: false, error: error.message };
  }

  console.log(`✅ Seeded ${data.length} keywords`);
  return { success: true, count: data.length };
}

/**
 * Seed agent resources
 */
async function seedAgentResources() {
  console.log('\n🤖 Seeding agent resources...');

  const { data, error } = await supabase
    .from('agent_resource')
    .upsert(AGENT_RESOURCES, { onConflict: 'title', ignoreDuplicates: true })
    .select();

  if (error) {
    console.error('❌ Failed to seed agent resources:', error.message);
    return { success: false, error: error.message };
  }

  console.log(`✅ Seeded ${data.length} agent resources`);
  return { success: true, count: data.length };
}

/**
 * Create sample agent results
 */
async function createSampleAgentResults() {
  console.log('\n🎯 Creating sample agent results...');

  // Get 10 sample scraped products
  const { data: sampleProducts, error: fetchError } = await supabase
    .from('scraped_products')
    .select('id')
    .limit(10);

  if (fetchError || !sampleProducts || sampleProducts.length === 0) {
    console.error('❌ Failed to fetch sample products:', fetchError?.message || 'No products found');
    return { success: false, error: fetchError?.message || 'No products found' };
  }

  console.log(`📊 Found ${sampleProducts.length} sample products to process`);

  const results = {
    mapper: 0,
    weight_dimension: 0,
    seo: 0,
    errors: []
  };

  // Insert into mapper_agent_products - using correct column names from schema
  for (const product of sampleProducts) {
    try {
      const { error } = await supabase
        .from('mapper_agent_products')
        .insert({
          product_id: product.id,
          status: 'processed',
          retry: false,
          confidence_score: 0.85 + Math.random() * 0.15,
          category_mapped: 'Food & Beverages',
          reasoning: 'Sample category mapping for testing dashboard functionality',
          tools_used: { mapper_version: '1.0', confidence_threshold: 0.85 },
          processing_cost: 0.002
        });

      if (error && !error.message.includes('duplicate')) {
        throw error;
      }
      results.mapper++;
    } catch (err) {
      results.errors.push({ table: 'mapper_agent_products', product_id: product.id, error: err.message });
    }
  }

  // Insert into weight_dimension_agent_products - using correct column names from schema
  for (const product of sampleProducts) {
    try {
      const { error } = await supabase
        .from('weight_dimension_agent_products')
        .insert({
          product_id: product.id,
          status: 'processed',
          retry: false,
          confidence_score: 0.75 + Math.random() * 0.25,
          weight_value: 0.5 + Math.random() * 2,
          weight_unit: 'kg',
          width_value: 10 + Math.random() * 20,
          height_value: 15 + Math.random() * 25,
          length_value: 5 + Math.random() * 15,
          dimension_unit: 'cm',
          volumetric_weight: null,
          reasoning: 'Sample weight and dimension estimation for testing',
          tools_used: { estimator_version: '1.0', method: '3d_model_analysis' },
          processing_cost: 0.003
        });

      if (error && !error.message.includes('duplicate')) {
        throw error;
      }
      results.weight_dimension++;
    } catch (err) {
      results.errors.push({ table: 'weight_dimension_agent_products', product_id: product.id, error: err.message });
    }
  }

  // Insert into seo_agent_products - using correct column names from schema
  for (const product of sampleProducts) {
    try {
      const { error } = await supabase
        .from('seo_agent_products')
        .insert({
          product_id: product.id,
          status: 'processed',
          retry: false,
          confidence_score: 0.9,
          optimized_title: 'Premium Organic Product - Best Quality Available',
          optimized_description: 'Sample SEO optimized description with relevant keywords for testing dashboard functionality and search engine visibility',
          keywords_used: ['organic', 'premium', 'best', 'quality'],
          reasoning: 'Sample SEO optimization for testing',
          tools_used: { seo_version: '1.0', keyword_density: 0.02 },
          processing_cost: 0.001
        });

      if (error && !error.message.includes('duplicate')) {
        throw error;
      }
      results.seo++;
    } catch (err) {
      results.errors.push({ table: 'seo_agent_products', product_id: product.id, error: err.message });
    }
  }

  console.log(`✅ Created ${results.mapper} mapper results`);
  console.log(`✅ Created ${results.weight_dimension} weight-dimension results`);
  console.log(`✅ Created ${results.seo} SEO results`);

  if (results.errors.length > 0) {
    console.log(`⚠️  Encountered ${results.errors.length} errors (may be duplicates)`);
  }

  return { success: true, results };
}

/**
 * Verify RLS policies
 */
async function verifyRLSPolicies() {
  console.log('\n🔒 Checking RLS policies...');

  const { data, error } = await supabase
    .from('pg_policies')
    .select('schemaname, tablename, policyname, permissive, roles, cmd')
    .eq('schemaname', 'public')
    .order('tablename')
    .order('policyname');

  if (error) {
    console.error('❌ Failed to fetch RLS policies:', error.message);
    return { success: false, error: error.message };
  }

  console.log(`📋 Found ${data?.length || 0} RLS policies`);

  // Group by table
  const policiesByTable = {};
  data?.forEach(policy => {
    if (!policiesByTable[policy.tablename]) {
      policiesByTable[policy.tablename] = [];
    }
    policiesByTable[policy.tablename].push(policy);
  });

  Object.entries(policiesByTable).forEach(([table, policies]) => {
    console.log(`\n  📊 ${table}: ${policies.length} policies`);
    policies.forEach(p => {
      console.log(`     - ${p.policyname} (${p.cmd})`);
    });
  });

  return { success: true, policies: data };
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 Starting Supabase Test Data Seeding...');
  console.log(`📍 Supabase URL: ${supabaseUrl}`);

  const report = {
    timestamp: new Date().toISOString(),
    users: null,
    categories: null,
    keywords: null,
    agent_resources: null,
    sample_results: null,
    rls_policies: null
  };

  try {
    // Step 1: Create test users
    report.users = await createTestUsers();

    // Step 2: Seed categories
    report.categories = await seedCategories();

    // Step 3: Seed keywords
    report.keywords = await seedKeywords();

    // Step 4: Seed agent resources
    report.agent_resources = await seedAgentResources();

    // Step 5: Create sample agent results
    report.sample_results = await createSampleAgentResults();

    // Step 6: Verify RLS policies
    report.rls_policies = await verifyRLSPolicies();

    // Generate summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 SEEDING SUMMARY');
    console.log('='.repeat(60));

    console.log('\n👥 Test Users:');
    console.log(`   ✅ Created: ${report.users.created.length}`);
    console.log(`   ⚠️  Existing: ${report.users.existing.length}`);
    console.log(`   ❌ Failed: ${report.users.failed.length}`);

    if (report.users.created.length > 0) {
      console.log('\n   📧 Login Credentials (ALL USERS):');
      console.log('   Email: admin@mcgrocer.com / reviewer@mcgrocer.com / seo@mcgrocer.com');
      console.log('   Password: Test123!@#');
      console.log('   ⚠️  TEMPORARY - Change in production!');
    }

    console.log('\n📦 Reference Data:');
    console.log(`   Categories: ${report.categories.success ? '✅' : '❌'} (${report.categories.count || 0})`);
    console.log(`   Keywords: ${report.keywords.success ? '✅' : '❌'} (${report.keywords.count || 0})`);
    console.log(`   Agent Resources: ${report.agent_resources.success ? '✅' : '❌'} (${report.agent_resources.count || 0})`);

    console.log('\n🎯 Sample Agent Results:');
    if (report.sample_results.success) {
      console.log(`   Mapper: ✅ (${report.sample_results.results.mapper})`);
      console.log(`   Weight-Dimension: ✅ (${report.sample_results.results.weight_dimension})`);
      console.log(`   SEO: ✅ (${report.sample_results.results.seo})`);
    } else {
      console.log(`   ❌ Failed: ${report.sample_results.error}`);
    }

    console.log('\n🔒 RLS Policies:');
    console.log(`   ${report.rls_policies.success ? '✅' : '❌'} Found ${report.rls_policies.policies?.length || 0} policies`);

    console.log('\n' + '='.repeat(60));
    console.log('✅ Seeding Complete!');
    console.log('='.repeat(60));

    console.log('\n📝 Next Steps:');
    console.log('   1. Test login with each user role');
    console.log('   2. Verify dashboard displays data correctly');
    console.log('   3. Check role-based access control');
    console.log('   4. Process remaining 39K products using agents on Linode');

    // Save report to file
    const fs = await import('fs/promises');
    await fs.writeFile(
      join(__dirname, 'seeding-report.json'),
      JSON.stringify(report, null, 2)
    );
    console.log('\n📄 Report saved to: supabase/seeding-report.json');

  } catch (error) {
    console.error('\n❌ Fatal error during seeding:', error);
    process.exit(1);
  }
}

// Run main function
main();
