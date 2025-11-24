#!/bin/bash
# Deploy Cloudflare Named Tunnel to RunPod
# Run this on your RunPod server
# Stored in: /runpod-volume/cloudflare-tunnel/

set -e

echo "============================================================"
echo "Cloudflare Named Tunnel Setup for McGrocer Scraper"
echo "============================================================"
echo ""

# Persistent storage directory
TUNNEL_DIR="/runpod-volume/cloudflare-tunnel"
LOG_FILE="$TUNNEL_DIR/tunnel.log"
TOKEN_FILE="$TUNNEL_DIR/.tunnel-token"

# Create directory if it doesn't exist
mkdir -p "$TUNNEL_DIR"

# Read tunnel token from secure file (not in git)
if [ -f "$TOKEN_FILE" ]; then
    TUNNEL_TOKEN=$(cat "$TOKEN_FILE")
    echo "✓ Tunnel token loaded from $TOKEN_FILE"
else
    echo "❌ ERROR: Tunnel token file not found!"
    echo ""
    echo "Please create the token file:"
    echo "  echo 'YOUR_TUNNEL_TOKEN' > $TOKEN_FILE"
    echo "  chmod 600 $TOKEN_FILE"
    echo ""
    echo "Get your token from: https://one.dash.cloudflare.com"
    exit 1
fi

echo "Step 1: Stopping old tunnel (if running)..."
pkill -f "cloudflared tunnel" 2>/dev/null || echo "No old tunnel found"
sleep 2

echo ""
echo "Step 2: Checking if Docker is available..."
if command -v docker &> /dev/null; then
    echo "✓ Docker is available - using Docker method"
    USE_DOCKER=true
else
    echo "✓ Docker not found - using binary method"
    USE_DOCKER=false
fi

if [ "$USE_DOCKER" = true ]; then
    echo ""
    echo "Step 3: Starting Named Tunnel with Docker..."
    echo "Stopping any existing cloudflared containers..."
    docker stop cloudflared-mcgrocer 2>/dev/null || true
    docker rm cloudflared-mcgrocer 2>/dev/null || true

    echo "Starting new tunnel container..."
    docker run -d \
        --name cloudflared-mcgrocer \
        --restart unless-stopped \
        --network host \
        cloudflare/cloudflared:latest \
        tunnel --no-autoupdate run --token "$TUNNEL_TOKEN"

    echo ""
    echo "✓ Named Tunnel started with Docker!"
    echo ""
    echo "View logs: docker logs -f cloudflared-mcgrocer"

else
    echo ""
    echo "Step 3: Installing cloudflared binary..."
    if ! command -v cloudflared &> /dev/null; then
        wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
        dpkg -i cloudflared-linux-amd64.deb
        rm cloudflared-linux-amd64.deb
        echo "✓ cloudflared installed"
    else
        echo "✓ cloudflared already installed"
    fi

    echo ""
    echo "Step 4: Starting Named Tunnel..."
    nohup cloudflared tunnel --no-autoupdate run --token "$TUNNEL_TOKEN" > "$LOG_FILE" 2>&1 &
    TUNNEL_PID=$!

    echo "✓ Named Tunnel started with PID: $TUNNEL_PID"
    echo ""
    echo "View logs: tail -f $LOG_FILE"
fi

echo ""
echo "Step 5: Waiting for tunnel to connect..."
sleep 10

echo ""
echo "============================================================"
echo "✅ Named Tunnel is Running!"
echo "============================================================"
echo ""
echo "Next steps:"
echo "1. Go to Cloudflare Zero Trust Dashboard:"
echo "   https://one.dash.cloudflare.com"
echo ""
echo "2. Navigate to: Networks > Tunnels"
echo ""
echo "3. Find your tunnel and copy the Public Hostname URL"
echo "   (e.g., https://your-tunnel.cfargotunnel.com)"
echo ""
echo "4. Update your local .env file:"
echo "   VITE_RUNPOD_API_URL=https://your-tunnel.cfargotunnel.com"
echo ""
echo "5. Rebuild and deploy:"
echo "   npm run build && npm run deploy"
echo ""
echo "============================================================"
echo ""
echo "Tunnel Management:"
if [ "$USE_DOCKER" = true ]; then
    echo "  Status:  docker ps | grep cloudflared"
    echo "  Logs:    docker logs -f cloudflared-mcgrocer"
    echo "  Restart: docker restart cloudflared-mcgrocer"
    echo "  Stop:    docker stop cloudflared-mcgrocer"
else
    echo "  Status:  ps aux | grep cloudflared"
    echo "  Logs:    tail -f $LOG_FILE"
    echo "  PID:     $TUNNEL_PID"
fi
echo ""
echo "Script location: $TUNNEL_DIR/deploy-named-tunnel.sh"
echo "Log location:    $LOG_FILE"
echo "============================================================"
