# Cloudflare Tunnel Maintenance Guide

Your blogger uses a **persistent Cloudflare Tunnel** for HTTPS access to the scraper service.

## 🔒 Security Note

🚨 **IMPORTANT:** Read [SECURITY-NOTICE.md](SECURITY-NOTICE.md) - Your tunnel token was exposed in git and should be **rotated immediately**.

## 📋 Current Setup

- **Public URL:** `https://blogger.mcgrocer.com`
- **Tunnel Type:** Named Tunnel (persistent, survives restarts)
- **Tunnel Location:** RunPod server (69.30.85.32:22171)
- **Service:** Article scraper on `localhost:8000`
- **Script Location:** `/runpod-volume/cloudflare-tunnel/deploy-named-tunnel.sh`
- **Log Location:** `/runpod-volume/cloudflare-tunnel/tunnel.log`
- **Token Location:** `/runpod-volume/cloudflare-tunnel/.tunnel-token` (600 permissions, not in git)

---

## ✅ Check Tunnel Status

```bash
ssh root@69.30.85.32 -p 22171 -i ~/.ssh/id_ed25519 'ps aux | grep cloudflared'
```

**Expected output:** Should show `cloudflared tunnel` process running

---

## 🔄 Restart Tunnel

If the tunnel stops or RunPod restarts:

```bash
ssh root@69.30.85.32 -p 22171 -i ~/.ssh/id_ed25519 'bash /runpod-volume/cloudflare-tunnel/deploy-named-tunnel.sh'
```

This will:
- Stop any old tunnel
- Start the named tunnel
- Auto-reconnect to Cloudflare

---

## 📊 View Tunnel Logs

```bash
ssh root@69.30.85.32 -p 22171 -i ~/.ssh/id_ed25519 'tail -f /runpod-volume/cloudflare-tunnel/tunnel.log'
```

**What to look for:**
- `✓ Registered tunnel connection` - Tunnel is connected
- `connIndex=0,1,2,3` - 4 connections to Cloudflare edge

---

## 🚨 Troubleshooting

### Blogger fails with "Failed to fetch" error

**Cause:** Tunnel or scraper service is down

**Fix:**

1. Check scraper service is running:
   ```bash
   ssh root@69.30.85.32 -p 22171 -i ~/.ssh/id_ed25519 'pm2 status'
   ```

   If stopped, restart:
   ```bash
   ssh root@69.30.85.32 -p 22171 -i ~/.ssh/id_ed25519 'pm2 restart scraper'
   ```

2. Check tunnel is running (see "Check Tunnel Status" above)

3. If tunnel is down, restart it (see "Restart Tunnel" above)

### Test the endpoint directly

```bash
curl https://blogger.mcgrocer.com/scrape-articles-batch \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"urls":["https://example.com"]}'
```

**Expected:** JSON response (even if scraping fails, should get a response)

---

## 📁 Files Reference

**On RunPod (persistent storage):**
- `/runpod-volume/cloudflare-tunnel/deploy-named-tunnel.sh` - Script to deploy/restart tunnel
- `/runpod-volume/cloudflare-tunnel/tunnel.log` - Tunnel logs
- `/runpod-volume/scraper-service/` - Article scraper service

**On your local machine:**
- `.env` - Contains `VITE_RUNPOD_API_URL=https://blogger.mcgrocer.com`
- `deploy-named-tunnel.sh` - Local copy of tunnel deployment script

---

## 🔐 Cloudflare Dashboard

View tunnel status in Cloudflare Zero Trust:
- **URL:** https://one.dash.cloudflare.com
- **Navigate to:** Networks → Tunnels
- **Look for:** Your tunnel (should show "Healthy" status)

---

## 💡 Key Points

✅ **Persistent URL** - `https://blogger.mcgrocer.com` never changes
✅ **Auto-reconnect** - Tunnel reconnects automatically if disconnected
✅ **No maintenance** - Tunnel runs in background, survives restarts
✅ **Production-ready** - Free SSL, professional domain

---

## 📞 Quick Commands

```bash
# SSH to RunPod
ssh root@69.30.85.32 -p 22171 -i ~/.ssh/id_ed25519

# Check tunnel
ps aux | grep cloudflared

# Restart tunnel
bash /runpod-volume/cloudflare-tunnel/deploy-named-tunnel.sh

# Check scraper
pm2 status

# View tunnel logs
tail -f /runpod-volume/cloudflare-tunnel/tunnel.log

# View scraper logs
pm2 logs scraper
```

---

**That's it!** Your tunnel is production-ready and requires minimal maintenance. 🚀
