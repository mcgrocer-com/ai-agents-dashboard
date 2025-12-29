$content = Get-Content 'C:\Users\izzy\.claude\projects\g--Projects-mcgrocer-project-ai-dashboard\a0055a65-800e-49e2-8a3a-8a2ef2af67ea\tool-results\mcp-supabase-mcp-execute_sql-1766485175989.txt' -Raw
$data = $content | ConvertFrom-Json
$jsonData = $data[0].text

# Find the JSON array in the text
$start = $jsonData.IndexOf('[{')
$end = $jsonData.LastIndexOf('}]') + 2
$cleanJsonString = $jsonData.Substring($start, $end - $start)

# Parse the JSON string to PowerShell objects
$products = $cleanJsonString | ConvertFrom-Json

# Save as properly formatted JSON
$products | ConvertTo-Json -Depth 10 | Set-Content -Path 'g:\Projects\mcgrocer-project\ai-dashboard\products_with_long_names.json' -Encoding UTF8

Write-Host "Successfully exported $($products.Count) products to products_with_long_names.json"
