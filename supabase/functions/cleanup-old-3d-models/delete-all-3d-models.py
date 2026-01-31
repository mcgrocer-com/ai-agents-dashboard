#!/usr/bin/env python3
"""
Delete ALL 3D model files from product-files bucket.
This processes ALL products with glb_url, not just 7-14 day old ones.

CAUTION: This deletes ALL 3D models!
"""

import os
import sys
from supabase import create_client, Client
from dotenv import load_dotenv
from urllib.parse import urlparse
import time

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

BATCH_SIZE = 1000  # Process 1000 products at a time
STORAGE_BATCH_SIZE = 100  # Storage API limit

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
    print("Delete ALL 3D Models from Storage")
    print("=" * 70)
    print()
    print("WARNING: This will delete ALL 3D model files!")
    print("         Not just 7-14 day old ones.")
    print()

    # Count total products
    print("Counting total products with 3D models...")
    count_response = supabase.table('pending_products').select(
        'id', count='exact'
    ).not_.is_('glb_url', 'null').like(
        'glb_url', '%3d-models%'
    ).execute()

    total_products = count_response.count
    print(f"   Total products with 3D models: {total_products:,}")
    print()

    if total_products == 0:
        print("No 3D models found. Exiting.")
        return

    # Confirm deletion
    print(f"This will PERMANENTLY delete ~{total_products:,} 3D model files!")
    print()
    confirm = input("Type 'DELETE ALL' to continue: ").strip()

    if confirm != 'DELETE ALL':
        print("ERROR: Deletion cancelled.")
        return

    print()
    print("Starting deletion process...")
    print("=" * 70)

    total_deleted = 0
    total_updated = 0
    total_failed = 0
    batch_num = 0

    while True:
        batch_num += 1

        # Fetch next batch of products
        print(f"\nBatch {batch_num}: Fetching {BATCH_SIZE} products...")

        response = supabase.table('pending_products').select(
            'id, item_code, glb_url'
        ).not_.is_('glb_url', 'null').like(
            'glb_url', '%3d-models%'
        ).limit(BATCH_SIZE).execute()

        products = response.data

        if not products:
            print("   No more products to process.")
            break

        print(f"   Found {len(products)} products")

        # Extract file paths
        file_paths = []
        product_ids = []

        for product in products:
            path = extract_file_path(product['glb_url'])
            if path:
                file_paths.append(path)
                product_ids.append(product['id'])

        if not file_paths:
            print("   No valid file paths in this batch.")
            continue

        print(f"   Extracted {len(file_paths)} file paths")

        # Delete files in sub-batches of 100
        deleted_in_batch = 0
        failed_in_batch = 0

        for i in range(0, len(file_paths), STORAGE_BATCH_SIZE):
            sub_batch = file_paths[i:i+STORAGE_BATCH_SIZE]

            try:
                delete_response = supabase.storage.from_('product-files').remove(sub_batch)

                if isinstance(delete_response, list):
                    deleted_in_batch += len(delete_response)
                else:
                    deleted_in_batch += len(sub_batch)

            except Exception as e:
                print(f"   ERROR: Storage deletion failed for sub-batch: {e}")
                failed_in_batch += len(sub_batch)

            # Small delay between storage batches
            time.sleep(0.3)

        print(f"   Deleted {deleted_in_batch} files, {failed_in_batch} failed")

        # Update database
        try:
            update_response = supabase.table('pending_products').update(
                {'glb_url': None}
            ).in_('id', product_ids).execute()

            updated_in_batch = len(update_response.data)
            print(f"   Updated {updated_in_batch} database records")

        except Exception as e:
            print(f"   ERROR: Database update failed: {e}")
            updated_in_batch = 0

        total_deleted += deleted_in_batch
        total_failed += failed_in_batch
        total_updated += updated_in_batch

        print(f"   Progress: {total_deleted:,} deleted, {total_updated:,} updated, {total_failed:,} failed")

        # If we got fewer than BATCH_SIZE, we're done
        if len(products) < BATCH_SIZE:
            break

        # Small delay between batches
        time.sleep(1)

    print()
    print("=" * 70)
    print("DELETION COMPLETE!")
    print()
    print("Final Summary:")
    print(f"   Total files deleted:   {total_deleted:,}")
    print(f"   Total records updated: {total_updated:,}")
    print(f"   Total failures:        {total_failed:,}")
    print()

    # Verify no more 3D models
    verify_response = supabase.table('pending_products').select(
        'id', count='exact'
    ).not_.is_('glb_url', 'null').like(
        'glb_url', '%3d-models%'
    ).execute()

    remaining = verify_response.count
    print(f"Verification: {remaining:,} products still have 3D models")

    if remaining == 0:
        print("PASS: All 3D models successfully deleted!")
    else:
        print(f"WARNING: {remaining:,} products still have glb_url")

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
