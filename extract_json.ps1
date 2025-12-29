$content = Get-Content 'C:\Users\izzy\.claude\projects\g--Projects-mcgrocer-project-ai-dashboard\a0055a65-800e-49e2-8a3a-8a2ef2af67ea\tool-results\mcp-supabase-mcp-execute_sql-1766485175989.txt' -Raw
$data = $content | ConvertFrom-Json
$jsonData = $data[0].text

# Find the JSON array in the text
$start = $jsonData.IndexOf('[{')
$end = $jsonData.LastIndexOf('}]') + 2
$cleanJson = $jsonData.Substring($start, $end - $start)

# Save to file
$cleanJson | Out-File -FilePath 'g:\Projects\mcgrocer-project\ai-dashboard\products_with_long_names.json' -Encoding utf8

Write-Host "Successfully exported products_with_long_names.json"
