import csv
import json

def convert_csv_to_json():
    csv_file = 'boots_product_on_erpnext.csv'
    json_file = 'boots_products.json'

    products = []

    with open(csv_file, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            product = {
                'item_code': row.get('Item Code', ''),
                'item_name': row.get('Item Name', ''),
                'data_source': row.get('Data Source', ''),
                'shopify_selling_rate': float(row.get('Shopify Selling Rate', 0) or 0),
                'standard_selling_rate': float(row.get('Standard Selling Rate', 0) or 0),
                'description': row.get('Description', ''),
                'product_url': row.get('Product URL (Supplier Items)', ''),
                'vendor': row.get('Vendor (Supplier Items)', '')
            }
            products.append(product)

    with open(json_file, 'w', encoding='utf-8') as f:
        json.dump(products, f, indent=2, ensure_ascii=False)

    print(f"Converted {len(products)} products to {json_file}")

if __name__ == '__main__':
    convert_csv_to_json()
