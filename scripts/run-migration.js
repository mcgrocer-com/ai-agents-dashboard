/**
 * Script to apply RLS policies to seo_keywords table
 * This fixes the "row-level security policy" error when importing keywords
 */

import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

console.log('╔════════════════════════════════════════════════════════════════╗')
console.log('║  Fix SEO Keywords RLS Policy                                   ║')
console.log('╚════════════════════════════════════════════════════════════════╝')
console.log('')

// Read the migration SQL
const migrationPath = join(__dirname, '..', 'supabase', 'migrations', '20251118000000_add_rls_policies_to_seo_keywords.sql')
const sql = readFileSync(migrationPath, 'utf-8')

console.log('📋 Please apply the following SQL to your Supabase database:')
console.log('')
console.log('1. Go to your Supabase Dashboard')
console.log('2. Navigate to: SQL Editor')
console.log('3. Create a new query and paste the following SQL:')
console.log('')
console.log('─'.repeat(70))
console.log(sql)
console.log('─'.repeat(70))
console.log('')
console.log('4. Click "Run" to execute the migration')
console.log('')
console.log('✅ After running this SQL, the import will work correctly!')
console.log('')
