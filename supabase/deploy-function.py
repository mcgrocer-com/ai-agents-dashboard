#!/usr/bin/env python3
"""Deploy Edge Function using Supabase Management API"""
import os
import requests
from pathlib import Path

PROJECT_REF = 'fxkjblrlogjumybceozk'
FUNCTION_NAME = 'seed-scraped-products'

# Read environment
env_path = Path(__file__).parent.parent / '.env'
access_token = None
with open(env_path) as f:
    for line in f:
        if line.startswith('SUPABASE_ACCESS_TOKEN='):
            access_token = line.split('=', 1)[1].strip()
            break

if not access_token:
    print('Error: SUPABASE_ACCESS_TOKEN not found in .env')
    exit(1)

# Read function code
function_file = Path(__file__).parent / 'functions' / FUNCTION_NAME / 'index.ts'
with open(function_file, 'r', encoding='utf-8') as f:
    function_code = f.read()

print(f'Deploying {FUNCTION_NAME}...')
print(f'Function size: {len(function_code)} bytes\n')

# Deploy using Management API
files = {
    'index.ts': ('index.ts', function_code, 'application/typescript')
}

response = requests.patch(
    f'https://api.supabase.com/v1/projects/{PROJECT_REF}/functions/{FUNCTION_NAME}',
    headers={'Authorization': f'Bearer {access_token}'},
    files=files
)

if response.ok:
    result = response.json()
    print('Deployment successful!')
    print(f'Version: {result["version"]}')
    print(f'Status: {result["status"]}')
else:
    print(f'Deployment failed: {response.status_code}')
    print(response.text)
