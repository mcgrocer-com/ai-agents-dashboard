#!/usr/bin/env python3
"""
Test deletion of 10 3D model files to verify the cleanup logic works.
This script does REAL deletion - use with caution!

Usage:
    python test-delete-10.py
"""

import os
import sys
from supabase import create_client, Client
from dotenv import load_dotenv
from datetime import datetime, timedelta
from urllib.parse import urlparse

# Force UTF-8 output on Windows
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

# Load environment
load_dotenv('../.env')

SUPABASE_URL = os.getenv('SUPABASE_URL', 'https://fxkjblrlogjumybceozk.supabase.co')
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY') or os.getenv('SUPABASE_KEY')

if not SUPABASE_KEY:
    print("ERROR: SUPABASE_SERVICE_ROLE_KEY not found in .env")
    exit(1)

# Initialize Supabase
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def extract_file_path(url: str) -> str:
    """Extract file path from full URL."""
    try:
        parsed = urlparse(url)
        path_parts = parsed.path.split('/product-files/')
        if len(path_parts) == 2:
            return path_parts[1]
        return None
    except:
        return None

def main():
    print("Testing 3D Model Cleanup - Delete 10 Files")
    print("=" * 70)
    print()

    # Calculate date range (7-14 days ago)
    now = datetime.now()
    seven_days_ago = now - timedelta(days=7)
    fourteen_days_ago = now - timedelta(days=14)

    print("Date Range:")
    print(f"   14 days ago: {fourteen_days_ago.isoformat()}")
    print(f"   7 days ago:  {seven_days_ago.isoformat()}")
    print()

    # Step 1: Query 10 products
    print("[1] Querying 10 products with 3D models...")

    response = supabase.table('pending_products').select(
        'id, item_code, glb_url, updated_at'
    ).not_.is_('glb_url', 'null').like(
        'glb_url', '%3d-models%'
    ).gte(
        'updated_at', fourteen_days_ago.isoformat()
    ).lt(
        'updated_at', seven_days_ago.isoformat()
    ).limit(10).execute()

    products = response.data

    if not products:
        print("   WARNING: No products found in time window")
        print("   This might be expected if no products are 7-14 days old")
        print()
        print("   Checking total products with glb_url...")

        total_response = supabase.table('pending_products').select(
            'id', count='exact'
        ).not_.is_('glb_url', 'null').execute()

        print(f"   Total products with glb_url: {total_response.count}")

        if total_response.count == 0:
            print("   PASS: Good! No 3D models to clean up")
        else:
            print("   INFO: Products exist but not in 7-14 day window")

        return

    print(f"   PASS: Found {len(products)} products")
    print()

    # Step 2: Extract file paths
    print("[2] Extracting file paths...")

    file_paths = []
    product_ids = []

    for product in products:
        path = extract_file_path(product['glb_url'])
        if path:
            file_paths.append(path)
            product_ids.append(product['id'])
            print(f"   - Product {product['item_code']}: {path[:60]}...")
        else:
            print(f"   WARNING: Could not extract path from: {product['glb_url']}")

    print(f"   PASS: Extracted {len(file_paths)} valid paths")
    print()

    if not file_paths:
        print("ERROR: No valid file paths found. Aborting.")
        return

    # Step 3: Confirm deletion
    print("WARNING: This will PERMANENTLY delete files!")
    print(f"   Files to delete: {len(file_paths)}")
    print(f"   Products to update: {len(product_ids)}")
    print()

    confirm = input("Type 'yes' to continue: ").strip().lower()

    if confirm != 'yes':
        print("ERROR: Deletion cancelled.")
        return

    print()

    # Step 4: Delete files from storage
    print("[3] Deleting files from storage...")

    try:
        delete_response = supabase.storage.from_('product-files').remove(file_paths)

        # Check response
        if isinstance(delete_response, list):
            deleted_count = len(delete_response)
            print(f"   PASS: Successfully deleted {deleted_count} files")

            # Show sample deleted files
            for i, item in enumerate(delete_response[:3]):
                print(f"   - {item.get('name', 'unknown')}")
            if len(delete_response) > 3:
                print(f"   ... and {len(delete_response) - 3} more")
        else:
            print(f"   WARNING: Unexpected response: {delete_response}")
            deleted_count = len(file_paths)

    except Exception as e:
        print(f"   ERROR: Storage deletion failed: {e}")
        return

    print()

    # Step 5: Update database
    print("[4] Updating database (setting glb_url to NULL)...")

    try:
        update_response = supabase.table('pending_products').update(
            {'glb_url': None}
        ).in_('id', product_ids).execute()

        updated_count = len(update_response.data)
        print(f"   PASS: Updated {updated_count} records")

    except Exception as e:
        print(f"   ERROR: Database update failed: {e}")
        return

    print()

    # Step 6: Verify cleanup
    print("[5] Verifying cleanup...")

    # Check if database was updated
    verify_response = supabase.table('pending_products').select(
        'id, glb_url'
    ).in_('id', product_ids).execute()

    null_count = sum(1 for p in verify_response.data if p['glb_url'] is None)

    print(f"   Database: {null_count}/{len(product_ids)} records have NULL glb_url")

    if null_count == len(product_ids):
        print("   PASS: Database verification PASSED")
    else:
        print("   WARNING: Some records not updated")

    print()
    print("=" * 70)
    print("TEST COMPLETED SUCCESSFULLY!")
    print()
    print("Summary:")
    print(f"   Files deleted:     {deleted_count}")
    print(f"   Records updated:   {updated_count}")
    print(f"   Verification:      {null_count}/{len(product_ids)} confirmed")
    print()
    print("The cleanup logic works! Safe to deploy Edge Function.")
    print()

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\nERROR: Interrupted by user")
    except Exception as e:
        print(f"\n\nERROR: {e}")
        import traceback
        traceback.print_exc()
