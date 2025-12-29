import json
import re

# Read the temp file
with open(r'C:\Users\izzy\.claude\projects\g--Projects-mcgrocer-project-ai-dashboard\a0055a65-800e-49e2-8a3a-8a2ef2af67ea\tool-results\mcp-supabase-mcp-execute_sql-1766485175989.txt', 'r', encoding='utf-8') as f:
    wrapper_data = json.load(f)

# Get the text field which contains the escaped JSON
text_content = wrapper_data[0]['text']

# Extract just the JSON array part using regex
# Look for the pattern starting with [{ and ending with }]
# The text content has the format: "message...<marker>[{...}]</marker>"
start_marker = '<untrusted-data'
if start_marker in text_content:
    # Find where the actual JSON array starts
    array_start = text_content.find('[{')
    if array_start > 0:
        # Find the last }] before the closing marker
        array_end = text_content.rfind('}]') + 2
        json_str = text_content[array_start:array_end]

        # Parse the JSON
        products = json.loads(json_str)

        # Save to file with proper formatting
        with open(r'g:\Projects\mcgrocer-project\ai-dashboard\products_with_long_names.json', 'w', encoding='utf-8') as f:
            json.dump(products, f, indent=2, ensure_ascii=False)

        print(f'Success! Exported {len(products)} products with names over 140 characters')
        print(f'File saved to: products_with_long_names.json')
        if products:
            print(f'\nLongest name: {products[0].get("name_length", "N/A")} characters')
            print(f'Shortest (of long names): {products[-1].get("name_length", "N/A")} characters')
    else:
        print('Error: Could not find JSON array start')
else:
    print('Error: Could not find data marker')
