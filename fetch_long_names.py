import json
from supabase import create_client, Client

# Initialize Supabase client
url = "https://fxkjblrlogjumybceozk.supabase.co"
key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ4a2pibHJsb2dqdW15YmNlb3prIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzIzNzI3ODksImV4cCI6MjA0Nzk0ODc4OX0.LvYf_ZNuV3j9GmS7pz5BZWDWklFWKNTaGPgQg4lkTSI"
supabase: Client = create_client(url, key)

# Query products with names longer than 140 characters
response = supabase.table('scraped_products').select(
    'id, product_id, vendor, name, ai_title, description, price, url, status, category, breadcrumbs'
).execute()

# Filter products with name length > 140
long_name_products = []
for product in response.data:
    if product.get('name') and len(product['name']) > 140:
        product['name_length'] = len(product['name'])
        long_name_products.append(product)

# Sort by name length descending
long_name_products.sort(key=lambda x: x['name_length'], reverse=True)

# Save to JSON file
with open('products_with_long_names.json', 'w', encoding='utf-8') as f:
    json.dump(long_name_products, f, indent=2, ensure_ascii=False)

print(f'Exported {len(long_name_products)} products with names over 140 characters')
print(f'Longest name: {long_name_products[0]["name_length"]} characters')
