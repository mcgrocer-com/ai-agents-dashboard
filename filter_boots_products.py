import json

def filter_products():
    brands = ['No7', 'Soap & Glory', 'Soap  Glory', 'Soap and Glory', 'Liz Earle', 'Botanics', 'Sleek MakeUP', 'Sleek Makeup']

    with open('boots_products.json', 'r', encoding='utf-8') as f:
        products = json.load(f)

    filtered = []
    for product in products:
        name = product['item_name'].lower()
        for brand in brands:
            if brand.lower() in name:
                filtered.append(product)
                break

    with open('boots_products.json', 'w', encoding='utf-8') as f:
        json.dump(filtered, f, indent=2, ensure_ascii=False)

    print(f"Filtered from {len(products)} to {len(filtered)} products")

    # Count by brand
    for brand in brands:
        count = sum(1 for p in filtered if brand.lower() in p['item_name'].lower())
        print(f"  {brand}: {count}")

if __name__ == '__main__':
    filter_products()
