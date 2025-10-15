# GitHub Pages Deployment Script for PowerShell
# This script builds and deploys the React app to GitHub Pages

Write-Host "Starting GitHub Pages deployment..." -ForegroundColor Cyan

# Step 1: Build the project
Write-Host "Building the project..." -ForegroundColor Yellow
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host "Build failed!" -ForegroundColor Red
    exit 1
}

Write-Host "Build completed successfully!" -ForegroundColor Green

# Step 2: Navigate to dist folder
Write-Host "Navigating to dist folder..." -ForegroundColor Yellow
Set-Location dist

# Step 3: Initialize git in dist folder
Write-Host "Initializing git repository..." -ForegroundColor Yellow
git init

# Step 4: Configure git
git config user.name "izzylite"
git config user.email "71887542+izzylite@users.noreply.github.com"

# Step 5: Add all files
Write-Host "Adding files..." -ForegroundColor Yellow
git add -A

# Step 6: Commit
Write-Host "Committing changes..." -ForegroundColor Yellow
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
git commit -m "Deploy to GitHub Pages - $timestamp"

# Step 7: Push to gh-pages branch
Write-Host "Pushing to gh-pages branch..." -ForegroundColor Yellow
git push -f https://github.com/mcgrocer-com/linode-server-agents.git master:gh-pages

if ($LASTEXITCODE -ne 0) {
    Write-Host "Deployment failed!" -ForegroundColor Red
    Set-Location ..
    exit 1
}

# Step 8: Clean up
Write-Host "Cleaning up..." -ForegroundColor Yellow
Set-Location ..

Write-Host "Deployment completed successfully!" -ForegroundColor Green
Write-Host "Your site will be available at: https://mcgrocer-com.github.io/linode-server-agents/" -ForegroundColor Cyan
Write-Host "It may take a few minutes for changes to appear." -ForegroundColor Yellow

