$headers = @{
    'Authorization' = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ4a2pibHJsb2dqdW15YmNlb3prIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3MjIyODksImV4cCI6MjA3NDI5ODI4OX0.TWAthI6QVavOB6ZZd68-_YgxkY_TQoS5ulS2E3-JGo4'
    'X-API-Key' = 'e243246e91a46bd5b3d1876061c1a0b4c95e57ab1671e43d9a78f59acccfcbd7'
    'Content-Type' = 'application/json'
}

$body = @{
    vendor = "superdrug"
    fields = @("name", "url", "price", "stock_status")
    page_size = 10
    page = 1
} | ConvertTo-Json

Write-Host "Testing fetch-vendor-products API..." -ForegroundColor Cyan
Write-Host ""

try {
    $response = Invoke-RestMethod -Uri 'https://fxkjblrlogjumybceozk.supabase.co/functions/v1/fetch-vendor-products' -Method Post -Headers $headers -Body $body

    Write-Host "Success! Response received:" -ForegroundColor Green
    Write-Host ""
    Write-Host "Total Count: $($response.pagination.total_count)"
    Write-Host "Page: $($response.pagination.page) of $($response.pagination.total_pages)"
    Write-Host "Products on this page: $($response.data.Count)"
    Write-Host ""

    # Display first product with variants
    $productsWithVariants = $response.data | Where-Object { $_.variance -ne $null }

    if ($productsWithVariants) {
        Write-Host "Found $($productsWithVariants.Count) product(s) with variants on this page:" -ForegroundColor Yellow
        Write-Host ""

        foreach ($product in $productsWithVariants) {
            Write-Host "Product: $($product.name)" -ForegroundColor Magenta
            Write-Host "URL: $($product.url)"
            Write-Host "Price: $($product.price)"
            Write-Host "Stock: $($product.stock_status)"
            Write-Host "Variants Count: $($product.variance.Count)"
            Write-Host ""

            if ($product.variance -and $product.variance.Count -gt 0) {
                Write-Host "  Variants:" -ForegroundColor Cyan
                foreach ($variant in $product.variance) {
                    Write-Host "    - URL: $($variant.url)"
                    Write-Host "      Price: $($variant.price)"
                    Write-Host "      Stock: $($variant.stock_status)"
                    Write-Host ""
                }
            }
        }
    } else {
        Write-Host "No products with variants found on this page. Showing all products:" -ForegroundColor Yellow
        Write-Host ""
        $response.data | ForEach-Object {
            Write-Host "- $($_.name) - Price: $($_.price) - Variants: $($_.variance)"
        }
    }

} catch {
    Write-Host "Error: $_" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
}
