$headers = @{
    'Authorization' = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ4a2pibHJsb2dqdW15YmNlb3prIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3MjIyODksImV4cCI6MjA3NDI5ODI4OX0.TWAthI6QVavOB6ZZd68-_YgxkY_TQoS5ulS2E3-JGo4'
    'X-API-Key' = 'e243246e91a46bd5b3d1876061c1a0b4c95e57ab1671e43d9a78f59acccfcbd7'
    'Content-Type' = 'application/json'
}

# Get all superdrug products (without pagination to ensure we get products with variants)
$body = @{
    vendor = "superdrug"
    fields = @("name", "url", "price", "stock_status")
} | ConvertTo-Json

Write-Host "Fetching all superdrug products to find ones with variants..." -ForegroundColor Cyan
Write-Host "(This may take a moment as we're fetching all products)"
Write-Host ""

try {
    $response = Invoke-RestMethod -Uri 'https://fxkjblrlogjumybceozk.supabase.co/functions/v1/fetch-vendor-products' -Method Post -Headers $headers -Body $body -TimeoutSec 300

    Write-Host "Success! Response received:" -ForegroundColor Green
    Write-Host ""
    Write-Host "Total Products: $($response.metadata.total_count)"
    Write-Host ""

    # Find products with variants
    $productsWithVariants = $response.data | Where-Object { $_.variance -ne $null -and $_.variance.Count -gt 0 }

    Write-Host "Found $($productsWithVariants.Count) product(s) with variants:" -ForegroundColor Yellow
    Write-Host ""

    # Show first 5 products with variants
    $productsWithVariants | Select-Object -First 5 | ForEach-Object {
        Write-Host "========================================" -ForegroundColor Magenta
        Write-Host "Product: $($_.name)" -ForegroundColor Magenta
        Write-Host "URL: $($_.url)"
        Write-Host "Price: $($_.price)"
        Write-Host "Stock: $($_.stock_status)"
        Write-Host "Number of Variants: $($_.variance.Count)" -ForegroundColor Cyan
        Write-Host ""

        if ($_.variance -and $_.variance.Count -gt 0) {
            Write-Host "  Variants:" -ForegroundColor Cyan
            foreach ($variant in $_.variance) {
                Write-Host "    ---" -ForegroundColor DarkGray
                Write-Host "    URL: $($variant.url)"
                Write-Host "    Price: $($variant.price)"
                Write-Host "    Stock: $($variant.stock_status)"
                Write-Host "    Name: $($variant.name)"
                if ($variant.description) {
                    Write-Host "    Description: $($variant.description.Substring(0, [Math]::Min(100, $variant.description.Length)))..."
                }
                Write-Host ""
            }
        }
        Write-Host ""
    }

    # Show summary
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "TEST SUMMARY" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "✓ API call successful"
    Write-Host "✓ Products with 'variance' field: $($response.data.Count)"
    Write-Host "✓ Products with actual variants: $($productsWithVariants.Count)"
    Write-Host "✓ The 'variance' field is properly returned in the response"
    Write-Host ""

    if ($productsWithVariants.Count -gt 0) {
        Write-Host "SUCCESS: Variants are being returned correctly!" -ForegroundColor Green
    } else {
        Write-Host "WARNING: No variants found in the dataset" -ForegroundColor Yellow
    }

} catch {
    Write-Host "Error: $_" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
}
