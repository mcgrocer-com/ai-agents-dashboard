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

# CRITICAL: Force headed mode (HEADLESS=false) for better extraction reliability
# Headed mode significantly improves CSS extraction success rates for Boots, Superdrug, and other vendors
# DO NOT change this to true without testing thoroughly
export HEADLESS=false
echo "[start.sh] HEADLESS mode is DISABLED (headed mode enabled for better extraction)"

# Dynamically find Chromium path from playwright installation
# This avoids hardcoding the chromium version number
if [ -z "$CHROME_PATH" ]; then
    # Find the latest chromium installation
    PLAYWRIGHT_CHROMIUM_DIR="/root/.cache/ms-playwright"
    if [ -d "$PLAYWRIGHT_CHROMIUM_DIR" ]; then
        CHROMIUM_VERSION=$(ls -1 "$PLAYWRIGHT_CHROMIUM_DIR" | grep -E '^chromium-[0-9]+$' | sort -t- -k2 -n | tail -1)
        if [ -n "$CHROMIUM_VERSION" ]; then
            FOUND_PATH="$PLAYWRIGHT_CHROMIUM_DIR/$CHROMIUM_VERSION/chrome-linux64/chrome"
            if [ -x "$FOUND_PATH" ]; then
                export CHROME_PATH="$FOUND_PATH"
                echo "[start.sh] Found Chromium at: $CHROME_PATH"
            else
                # Try chrome-linux folder (older structure)
                FOUND_PATH="$PLAYWRIGHT_CHROMIUM_DIR/$CHROMIUM_VERSION/chrome-linux/chrome"
                if [ -x "$FOUND_PATH" ]; then
                    export CHROME_PATH="$FOUND_PATH"
                    echo "[start.sh] Found Chromium at: $CHROME_PATH"
                fi
            fi
        fi
    fi

    # Fallback to system chromium if playwright not found
    if [ -z "$CHROME_PATH" ]; then
        for path in /usr/bin/chromium /usr/bin/chromium-browser /usr/bin/google-chrome; do
            if [ -x "$path" ]; then
                export CHROME_PATH="$path"
                echo "[start.sh] Using system Chromium at: $CHROME_PATH"
                break
            fi
        done
    fi
fi

if [ -z "$CHROME_PATH" ]; then
    echo "[start.sh] WARNING: CHROME_PATH not found. AI extraction will fail for unknown vendors."
else
    echo "[start.sh] CHROME_PATH set to: $CHROME_PATH"
fi

# Start the API
cd /runpod-volume/product-checker-api
exec npm start
