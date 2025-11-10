$headers = @{
    Authorization = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ4a2pibHJsb2dqdW15YmNlb3prIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3MjIyODksImV4cCI6MjA3NDI5ODI4OX0.TWAthI6QVavOB6ZZd68-_YgxkY_TQoS5ulS2E3-JGo4'
    'X-API-Key' = 'e243246e91a46bd5b3d1876061c1a0b4c95e57ab1671e43d9a78f59acccfcbd7'
    'Content-Type' = 'application/json'
}

Write-Host "Fetching product with variants to show response structure..." -ForegroundColor Cyan
Write-Host ""

$body = @{
    vendor = "superdrug"
    fields = @("name", "url", "price", "stock_status")
    page_size = 50
    page = 3
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri 'https://fxkjblrlogjumybceozk.supabase.co/functions/v1/fetch-vendor-products' -Method Post -Headers $headers -Body $body

$productsWithVariants = $response.data | Where-Object { $null -ne $_.variance -and $_.variance.Count -gt 0 }

if ($productsWithVariants.Count -gt 0) {
    $product = $productsWithVariants[0]

    Write-Host "========================================" -ForegroundColor Green
    Write-Host "FULL API RESPONSE STRUCTURE" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""

    # Show the full response object
    Write-Host "Response Object:" -ForegroundColor Yellow
    $response | ConvertTo-Json -Depth 10 | Write-Host
}
