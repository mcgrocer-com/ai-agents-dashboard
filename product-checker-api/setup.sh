#!/bin/bash
# RunPod Environment Setup Script for Product Checker API
# This script installs all dependencies needed to run the product checker API
# Run this after creating a new RunPod pod or when the environment is reset

set -e  # Exit on any error

echo "======================================"
echo "Product Checker API - Environment Setup"
echo "======================================"

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "Please run as root"
    exit 1
fi

# Update package list
echo "[1/7] Updating package list..."
apt-get update -qq

# Install Node.js 20.x
echo "[2/7] Installing Node.js 20.x..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
    echo "Node.js installed: $(node --version)"
    echo "npm installed: $(npm --version)"
else
    echo "Node.js already installed: $(node --version)"
fi

# Install Xvfb for headed mode
echo "[3/7] Installing Xvfb (virtual display)..."
if ! command -v Xvfb &> /dev/null; then
    apt-get install -y xvfb
    echo "Xvfb installed successfully"
else
    echo "Xvfb already installed"
fi

# Start Xvfb on display :99
echo "[4/7] Starting Xvfb virtual display..."
if ! pgrep -x "Xvfb" > /dev/null; then
    Xvfb :99 -screen 0 1280x1024x24 &
    sleep 2
    echo "Xvfb started on display :99"
else
    echo "Xvfb already running"
fi

# Navigate to API directory
echo "[5/7] Installing npm dependencies..."
cd /workspace/product-checker-api

# Install npm dependencies
if [ ! -d "node_modules" ]; then
    npm install
    echo "npm dependencies installed"
else
    echo "node_modules already exists, skipping npm install"
fi

# Install Playwright and Chromium
echo "[6/7] Installing Playwright and Chromium browser..."
npx playwright install chromium
npx playwright install-deps

# Verify Chromium installation
CHROMIUM_PATH=$(find /root/.cache/ms-playwright -name chrome -type f 2>/dev/null | head -1)
if [ -n "$CHROMIUM_PATH" ]; then
    echo "Chromium installed at: $CHROMIUM_PATH"
else
    echo "WARNING: Chromium not found!"
fi

# Create .env if it doesn't exist
echo "[7/7] Checking environment configuration..."
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo ".env created from .env.example"
        echo "IMPORTANT: Update .env with your API keys and proxy credentials"
    else
        echo "WARNING: No .env or .env.example found!"
    fi
else
    echo ".env already exists"
fi

echo ""
echo "======================================"
echo "Setup Complete!"
echo "======================================"
echo ""
echo "Installed components:"
echo "  ✓ Node.js: $(node --version)"
echo "  ✓ npm: $(npm --version)"
echo "  ✓ Xvfb: Running on display :99"
echo "  ✓ Playwright: Installed with Chromium"
echo "  ✓ Dependencies: node_modules ready"
echo ""
echo "Next steps:"
echo "  1. Update .env with your API keys (if not already done)"
echo "  2. Run: ./start.sh"
echo ""
echo "To verify the API is working:"
echo "  curl http://localhost:3003/health"
echo ""
