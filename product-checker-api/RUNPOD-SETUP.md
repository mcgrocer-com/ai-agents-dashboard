# RunPod Automatic Startup Configuration

This guide explains how to configure your RunPod pod to automatically start the Product Checker API after every restart.

## Overview

The `runpod-startup.sh` script automates the entire recovery process after a pod restart:
- ✅ Installs Node.js 20.x
- ✅ Installs Xvfb (virtual display)
- ✅ Installs Playwright Chromium
- ✅ Starts Xvfb on display :99
- ✅ Starts the Product Checker API

**Recovery Time:** ~5 minutes (or ~30 seconds if Playwright Chromium is cached)

---

## Option 1: Manual Execution After Restart (Simplest)

After every pod restart, SSH in and run:

```bash
cd /workspace/product-checker-api
./runpod-startup.sh
```

That's it! The script will handle everything automatically.

---

## Option 2: Docker-Based Auto-Startup (Recommended)

Create a custom RunPod template with auto-startup.

### Step 1: Create a Dockerfile

Create a file at `/workspace/product-checker-api/Dockerfile`:

```dockerfile
FROM runpod/pytorch:2.1.0-py3.10-cuda11.8.0-devel-ubuntu22.04

# Set working directory
WORKDIR /workspace/product-checker-api

# Copy startup script
COPY runpod-startup.sh /workspace/product-checker-api/
RUN chmod +x /workspace/product-checker-api/runpod-startup.sh

# Set startup command
CMD ["/workspace/product-checker-api/runpod-startup.sh"]
```

### Step 2: Build and Push Docker Image

```bash
# Build image
docker build -t your-dockerhub-username/product-checker-api:latest .

# Push to Docker Hub
docker push your-dockerhub-username/product-checker-api:latest
```

### Step 3: Configure RunPod Template

1. Go to RunPod → My Templates → New Template
2. Set Docker Image: `your-dockerhub-username/product-checker-api:latest`
3. Set Container Disk: 10 GB minimum
4. Set Volume Mount: `/workspace` (to persist API code)
5. Expose Ports: `3003`
6. Save template

### Step 4: Deploy Pod

Deploy a new pod using your custom template. The startup script will run automatically on every restart.

---

## Option 3: RunPod Init Script (Alternative)

RunPod allows you to configure an init script in the pod settings.

### Step 1: Edit Pod Settings

1. Go to your RunPod pod
2. Click "Edit Pod"
3. Scroll to "Container Configuration"
4. Find "Container Start Command" or "Init Script"

### Step 2: Add Startup Command

Set the start command to:

```bash
/workspace/product-checker-api/runpod-startup.sh
```

### Step 3: Save and Restart

Save settings and restart the pod. The script will execute automatically.

---

## Verification

After the script runs (whether manually or automatically), verify the API is running:

### 1. Check Health Endpoint

```bash
curl http://localhost:3003/health
```

Expected response:
```json
{"status":"ok","timestamp":"2026-01-20T12:00:00.000Z","pool":{"total":6,"inUse":0,"available":6,"waiting":0}}
```

### 2. Check External Access

```bash
curl https://lkzqju0uvvpqa2-3003.proxy.runpod.net/health
```

### 3. View Logs

```bash
tail -f /tmp/api.log
```

---

## Troubleshooting

### Script fails with "command not found"

Make sure the script is executable:
```bash
chmod +x /workspace/product-checker-api/runpod-startup.sh
```

### API fails to start

Check logs:
```bash
tail -50 /tmp/api.log
```

### Xvfb not starting

Check if Xvfb is installed:
```bash
which Xvfb
```

Manually install if needed:
```bash
apt-get update && apt-get install -y xvfb
```

### Node.js not found

Verify Node.js installation:
```bash
node --version
npm --version
```

Manually install if needed:
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
```

---

## Configuration

The startup script uses these settings from your `.env` file:

```bash
PORT=3003
HEADLESS=false          # Headed mode (required)
DISPLAY=:99             # Virtual display
BROWSER_POOL_SIZE=6     # Number of browser instances
```

**IMPORTANT:** The script enforces `HEADLESS=false` via `start.sh` to ensure optimal extraction performance.

---

## Recovery Time Breakdown

| Step | Time (First Run) | Time (Cached) |
|------|-----------------|---------------|
| Install Node.js | ~30s | Skip (already installed) |
| Install Xvfb | ~30s | Skip (already installed) |
| Install Playwright | ~3-4min | Skip (cache exists) |
| Start Xvfb | 2s | 2s |
| Start API | 5s | 5s |
| **Total** | **~5min** | **~30s** |

After the first run, recovery time drops to ~30 seconds as Playwright Chromium is cached in `/root/.cache/ms-playwright`.

---

## What Persists After Restart

### ✅ Persists (in /workspace volume)
- API code and configuration
- node_modules
- .env file
- start.sh and runpod-startup.sh
- All logs and data

### ❌ Does NOT Persist (ephemeral OS storage)
- Node.js installation
- Xvfb installation
- System packages
- Playwright Chromium (in /root/.cache)

This is why the startup script is necessary - it reinstalls the ephemeral dependencies on every restart.

---

## Next Steps

**Recommendation:** Use **Option 1** (manual execution) for now to verify everything works, then upgrade to **Option 2** (Docker-based auto-startup) for fully automated recovery.

For questions or issues, check the logs at `/tmp/api.log` or review the startup script output.
