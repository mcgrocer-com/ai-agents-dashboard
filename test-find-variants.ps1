$headers = @{
    'Authorization' = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ4a2pibHJsb2dqdW15YmNlb3prIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3MjIyODksImV4cCI6MjA3NDI5ODI4OX0.TWAthI6QVavOB6ZZd68-_YgxkY_TQoS5ulS2E3-JGo4'
    'X-API-Key' = 'e243246e91a46bd5b3d1876061c1a0b4c95e57ab1671e43d9a78f59acccfcbd7'
    'Content-Type' = 'application/json'
}

Write-Host "Searching for products with variants..." -ForegroundColor Cyan
Write-Host ""

$found = $false
$page = 1
$maxPages = 100
$pageSize = 50

while (-not $found -and $page -le $maxPages) {
    Write-Host "Checking page $page..." -NoNewline

    $body = @{
        vendor = "superdrug"
        fields = @("name", "url", "price", "stock_status")
        page_size = $pageSize
        page = $page
    } | ConvertTo-Json

    try {
        $response = Invoke-RestMethod -Uri 'https://fxkjblrlogjumybceozk.supabase.co/functions/v1/fetch-vendor-products' -Method Post -Headers $headers -Body $body

        # Find products with variants
        $productsWithVariants = $response.data | Where-Object { $_.variance -ne $null -and $_.variance.Count -gt 0 }

        if ($productsWithVariants.Count -gt 0) {
            Write-Host " Found $($productsWithVariants.Count) products with variants!" -ForegroundColor Green
            Write-Host ""
            $found = $true

            # Show the first product with variants
            $product = $productsWithVariants[0]

            Write-Host "========================================" -ForegroundColor Magenta
            Write-Host "EXAMPLE PRODUCT WITH VARIANTS" -ForegroundColor Magenta
            Write-Host "========================================" -ForegroundColor Magenta
            Write-Host ""
            Write-Host "Product Name: $($product.name)" -ForegroundColor Yellow
            Write-Host "URL: $($product.url)"
            Write-Host "Price: $($product.price)"
            Write-Host "Stock Status: $($product.stock_status)"
            Write-Host "Number of Variants: $($product.variance.Count)" -ForegroundColor Cyan
            Write-Host ""
            Write-Host "Variants:" -ForegroundColor Cyan

            foreach ($variant in $product.variance) {
                Write-Host "  --------------------------------" -ForegroundColor DarkGray
                Write-Host "  Variant URL: $($variant.url)"
                Write-Host "  Variant Price: $($variant.price)"
                Write-Host "  Variant Stock: $($variant.stock_status)"
                Write-Host "  Variant Name: $($variant.name)"
                Write-Host ""
            }

            Write-Host "========================================" -ForegroundColor Green
            Write-Host "TEST RESULT: SUCCESS ✓" -ForegroundColor Green
            Write-Host "========================================" -ForegroundColor Green
            Write-Host "The API correctly returns the 'variance' field with variant data!"
            Write-Host ""

        } else {
            Write-Host " No variants on this page" -ForegroundColor DarkGray
            $page++
        }

    } catch {
        Write-Host " Error: $_" -ForegroundColor Red
        break
    }
}

if (-not $found) {
    Write-Host ""
    Write-Host "Searched $page pages but did not find products with variants." -ForegroundColor Yellow
}
