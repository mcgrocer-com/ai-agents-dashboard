#!/bin/bash
# RunPod Startup Script for Product Checker API
# This script automatically reinstalls all dependencies and starts the API after pod restart
# Place this in /workspace/product-checker-api/ and run on startup

set -e  # Exit on any error

echo "======================================"
echo "RunPod Startup - Product Checker API"
echo "======================================"
echo "Started at: $(date)"
echo ""

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Step 1: Install Node.js if not present
echo "[1/6] Checking Node.js installation..."
if ! command_exists node; then
    echo "Installing Node.js 20.x..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
    echo "✓ Node.js installed: $(node --version)"
else
    echo "✓ Node.js already installed: $(node --version)"
fi

# Step 2: Install Xvfb if not present
echo "[2/6] Checking Xvfb installation..."
if ! command_exists Xvfb; then
    echo "Installing Xvfb..."
    apt-get update -qq
    apt-get install -y xvfb
    echo "✓ Xvfb installed"
else
    echo "✓ Xvfb already installed"
fi

# Step 3: Start Xvfb on display :99
echo "[3/6] Starting Xvfb virtual display..."
if pgrep -x "Xvfb" > /dev/null; then
    echo "✓ Xvfb already running"
else
    Xvfb :99 -screen 0 1280x1024x24 > /dev/null 2>&1 &
    sleep 2
    if pgrep -x "Xvfb" > /dev/null; then
        echo "✓ Xvfb started on display :99"
    else
        echo "✗ Failed to start Xvfb"
        exit 1
    fi
fi

# Step 4: Navigate to API directory
echo "[4/6] Navigating to API directory..."
cd /workspace/product-checker-api
echo "✓ Current directory: $(pwd)"

# Step 5: Install Playwright if Chromium not found
echo "[5/6] Checking Playwright Chromium..."
if [ -d "/root/.cache/ms-playwright/chromium-1200" ]; then
    echo "✓ Playwright Chromium already installed"
else
    echo "Installing Playwright Chromium (this may take 3-4 minutes)..."
    npx playwright install chromium
    npx playwright install-deps chromium
    echo "✓ Playwright Chromium installed"
fi

# Step 6: Start the Product Checker API
echo "[6/6] Starting Product Checker API..."

# Check if API is already running
if pgrep -f "tsx.*index.ts" > /dev/null; then
    echo "⚠ API already running, stopping old process..."
    pkill -f "tsx.*index.ts"
    sleep 2
fi

# Start API in background
nohup ./start.sh > /tmp/api.log 2>&1 &
API_PID=$!
sleep 5

# Verify API started successfully
if curl -s http://localhost:3003/health > /dev/null; then
    echo "✓ API started successfully (PID: $API_PID)"
    echo ""
    curl -s http://localhost:3003/health | head -1
    echo ""
else
    echo "✗ API failed to start, checking logs..."
    tail -20 /tmp/api.log
    exit 1
fi

echo ""
echo "======================================"
echo "Startup Complete!"
echo "======================================"
echo "Completed at: $(date)"
echo ""
echo "API Health: http://localhost:3003/health"
echo "External:   https://lkzqju0uvvpqa2-3003.proxy.runpod.net/health"
echo ""
echo "Configuration:"
echo "  • HEADLESS: false (headed mode)"
echo "  • DISPLAY: :99"
echo "  • Browser Pool: 6 instances"
echo "  • Chromium Path: /root/.cache/ms-playwright/chromium-1200/chrome-linux64/chrome"
echo ""
echo "Logs: tail -f /tmp/api.log"
echo ""
