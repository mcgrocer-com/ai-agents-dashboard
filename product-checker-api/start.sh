#!/bin/bash
# Start script with xvfb for headed browser mode

# Check if Xvfb is already running on :99
if ! pgrep -f "Xvfb :99" > /dev/null; then
    Xvfb :99 -screen 0 1920x1080x24 &
    sleep 2
fi

# Export display
export DISPLAY=:99

# Set environment
export SERVER_MODE=false
export PORT=${PORT:-3003}
export CHROME_PATH=${CHROME_PATH:-/root/.cache/ms-playwright/chromium-1200/chrome-linux64/chrome}

# Start the API
cd /runpod-volume/product-checker-api
exec npm start
