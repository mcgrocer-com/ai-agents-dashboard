# GET PRODUCT FROM ERPNEXT WITH URL
curl --location 'https://erpnext.mcgrocer.com/api/method/frappe.desk.reportview.get' \
--header 'Authorization: token 22e5ac2bbae91a7:8f6cd5cfc166cde' \
--header 'Content-Type: application/json' \
--header 'Cookie: full_name=Guest; sid=Guest; system_user=no; user_id=Guest; user_image=' \
--data '{
    "doctype": "Item",
    "filters":[["Item Supplier","custom_product_url","=","https://www.lego.com/en-gb/product/2x4-blue-luggage-tag-5005543"]]
}'
 **Response**
{
    "message": {
        "keys": [
            "name"
        ],
        "values": [
            [
                "STO-ITEM-2025-01433"
            ]
        ],
        "user_info": {}
    }
}

# Get PRODUCT FROM ERPNEXT
 curl -X GET https://erpnext.mcgrocer.com/api/resource/Item/STO-ITEM-2025-00082 -H "Authorization: token bd1a3e844578cbb:1d6f64e2a41e914"
 **Response**
 {
  "data": {
    "name": "STO-ITEM-2025-00082",
    "owner": "Administrator",
    "creation": "2025-09-29 18:56:18.087290",
    "modified": "2025-09-30 13:10:53.465190",
    "modified_by": "isl.israelite@gmail.com",
    "docstatus": 0,
    "idx": 0,
    "naming_series": "STO-ITEM-.YYYY.-",
    "item_code": "STO-ITEM-2025-00082",
    "item_name": "2.0 Convertible Ruler with Minifigure",
    "item_group": "Minifigures",
    "stock_uom": "Nos",
    "removal_score": 0,
    "custom_website_breadcrumb": "['Minifigures', 'Home', '2.0 Convertible Ruler With Minifigure']",
    "data_source": "Scrapper",
    "last_scrapped_at": "2025-09-30 13:10:53.447444",
    "disabled": 0,
    "deleted_from_shopify": 0,
    "allow_alternative_item": 0,
    "is_stock_item": 1,
    "has_variants": 0,
    "opening_stock": 0,
    "ai_title":"",
    "summary":"",
    "valuation_rate": 4.99,
    "standard_rate": 0,
    "shopify_selling_rate": 8.73,
    "is_fixed_asset": 0,
    "auto_create_assets": 0,
    "is_grouped_asset": 0,
    "over_delivery_receipt_allowance": 0,
    "over_billing_allowance": 0,
    "image": "https://www.lego.com/cdn/cs/set/assets/blt5400a26025760041/5007195.jpg?fit=crop&quality=80&width=800&height=800&dpr=1",
    "description": "2.0 Convertible Ruler with Minifigure\n    \n\n\n    <div>\n        \n2.0 Convertible Ruler with Minifigure\n        \n        <div><div>This 2-in-1 LEGO® ruler is great for measuring and fun for building! Made from LEGO pieces, the ruler easily converts between 6 in. (15 cm) and 12 in. (30 cm) long and includes both centimeter and inch scales. Kids can customize the ruler to their own design using the included LEGO minifigure and any LEGO bricks of their own.<ul><li>2-in-1 LEGO® ruler – Made from LEGO pieces, the ruler easily converts between 6 in. (15 cm) and 12 in. (30 cm) long and includes both centimeter and inch scales</li><li>Made with real LEGO® bricks – This 28-piece building kit allows LEGO fans to customize their design to create a fun and colorful ruler</li><li>LEGO® building fun – The top of the ruler provides a place for kids to attach the included minifigure and any LEGO bricks of their own</li></ul></div></div>\n    </div>\n\n",
    "length": 0,
    "width": 0,
    "height": 0,
    "weight": 0,
    "volumetric_weight": 0,
    "raw_html_description": "<div class=\"ProductFeaturesstyles__FeaturesText-sc-tutz3a-2 cePksm\"><span class=\"Markup__StyledMarkup-sc-nc8x20-0 dbPAWk\">This 2-in-1 LEGO® ruler is great for measuring and fun for building! Made from LEGO pieces, the ruler easily converts between 6 in. (15 cm) and 12 in. (30 cm) long and includes both centimeter and inch scales. Kids can customize the ruler to their own design using the included LEGO minifigure and any LEGO bricks of their own.<ul><li>2-in-1 LEGO® ruler – Made from LEGO pieces, the ruler easily converts between 6 in. (15 cm) and 12 in. (30 cm) long and includes both centimeter and inch scales</li><li>Made with real LEGO® bricks – This 28-piece building kit allows LEGO fans to customize their design to create a fun and colorful ruler</li><li>LEGO® building fun – The top of the ruler provides a place for kids to attach the included minifigure and any LEGO bricks of their own</li></ul></span></div>",
    "shelf_life_in_days": 0,
    "end_of_life": "2099-12-31",
    "default_material_request_type": "Purchase",
    "valuation_method": "",
    "weight_per_unit": 0,
    "weight_uom": "Kg",
    "allow_negative_stock": 0,
    "has_batch_no": 0,
    "create_new_batch": 0,
    "has_expiry_date": 0,
    "retain_sample": 0,
    "sample_quantity": 0,
    "has_serial_no": 0,
    "variant_based_on": "Item Attribute",
    "enable_deferred_expense": 0,
    "no_of_months_exp": 0,
    "enable_deferred_revenue": 0,
    "no_of_months": 0,
    "min_order_qty": 0,
    "safety_stock": 0,
    "is_purchase_item": 1,
    "lead_time_days": 0,
    "last_purchase_rate": 0,
    "is_customer_provided_item": 0,
    "delivered_by_supplier": 0,
    "grant_commission": 1,
    "is_sales_item": 1,
    "max_discount": 0,
    "inspection_required_before_purchase": 0,
    "inspection_required_before_delivery": 0,
    "include_item_in_manufacturing": 1,
    "is_sub_contracted_item": 0,
    "customer_code": "",
    "total_projected_qty": 0,
    "doctype": "Item",
    "supplier_items": [
      {
        "name": "kklmeapgie",
        "owner": "Administrator",
        "creation": "2025-09-29 18:56:18.087290",
        "modified": "2025-09-30 13:10:53.465190",
        "modified_by": "isl.israelite@gmail.com",
        "docstatus": 0,
        "idx": 1,
        "supplier": "lego",
        "supplier_part_no": "5007195",
        "custom_product_url": "https://www.lego.com/en-gb/product/20-convertible-ruler-with-minifigure-5007195",
        "custom_stock_status": "In Stock",
        "custom_price": 4.99,
        "main_vendor": 1,
        "parent": "STO-ITEM-2025-00082",
        "parentfield": "supplier_items",
        "parenttype": "Item",
        "doctype": "Item Supplier"
      }
    ],
    "barcodes": [],
    "attributes": [],
    "customer_items": [],
    "taxes": [],
    "reorder_levels": [],
    "item_defaults": [
      {
        "name": "kklde3qefm",
        "owner": "Administrator",
        "creation": "2025-09-29 18:56:18.131774",
        "modified": "2025-09-30 13:10:53.465190",
        "modified_by": "isl.israelite@gmail.com",
        "docstatus": 0,
        "idx": 1,
        "company": "McGrocer",
        "default_warehouse": "Stores - M",
        "parent": "STO-ITEM-2025-00082",
        "parentfield": "item_defaults",
        "parenttype": "Item",
        "doctype": "Item Default"
      }
    ],
    "uoms": [
      {
        "name": "kklggvr432",
        "owner": "Administrator",
        "creation": "2025-09-29 18:56:18.129882",
        "modified": "2025-09-30 13:10:53.465190",
        "modified_by": "isl.israelite@gmail.com",
        "docstatus": 0,
        "idx": 1,
        "uom": "Nos",
        "conversion_factor": 1,
        "parent": "STO-ITEM-2025-00082",
        "parentfield": "uoms",
        "parenttype": "Item",
        "doctype": "UOM Conversion Detail"
      }
    ]
  }
}


## UPDATE STAGING ERPNEXT
curl --location 'https://staging-erpnext.mcgrocer.com/api/method/mcgrocer_customization.mcgrocer_customization.apis.item.create_items_from_json' \
--header 'Authorization: token ba5536ccfabf26c:1c5ae2972cf2190' \
--header 'Content-Type: application/json' \
--header 'Cookie: full_name=Guest; sid=Guest; system_user=no; user_id=Guest; user_image=' \
--data '[
    {
        "name": "Item 1",
        "price": 10.99,
        "selling_price": 12.99,
        "product_id": "123",
        "description": "Description of Item 1",
        "stock_status": "In Stock",
        "url": "https://example.com/item1",
        "category": "Category 1",

        "ai_title": "AI Title 1",
        "summary": "AI Description 1",
        "meta_title": "Meta Title 1",
        "meta_description": "Meta Description 1",
        "variants": [
            {
                "name": "Variant 1",
                "price": 11.99,
                "product_id": "123-variant1",
                "description": "Description of Variant 1",
                "stock_status": "In Stock",
                "url": "https://example.com/item1/variant1",
                "category": "Category 1"
            },
            {
                "name": "Variant 1",
                "price": 11.99,
                "product_id": "123-variant1",
                "description": "Description of Variant 1",
                "stock_status": "In Stock",
                "url": "https://example.com/item1/variant1",
                "category": "Category 1"
            },
            {
                "name": "Variant 1",
                "price": 11.99,
                "product_id": "123-variant1",
                "description": "Description of Variant 1",
                "stock_status": "In Stock",
                "url": "https://example.com/item1/variant1",
                "category": "Category 1"
            }
        ],
        "variant_attribute" "size",


        "vendor": "Vendor 1",
        "images": ["image1.jpg", "image2.jpg"],
        "main_image": "https://example.com/main_image1.jpg",
        "timestamp": "2021-06-01 12:00:00",
        "height": 10.5,
        "weight": 2.3,
        "width": 5.0,
        "volumetric_weight": 3.0,
        "length": 15.0,
        "breadcrumb": ["Category 1", "Subcategory 1"]
    }
]'


**Sample Response**
{
    "message": {
        "status": "warning",
        "message": "Created: 0, Updated: 1, Errors: 0",
        "created_items": [],
        "updated_items": [
            "STO-ITEM-2025-01384"
        ],
        "errors": []
    }
}