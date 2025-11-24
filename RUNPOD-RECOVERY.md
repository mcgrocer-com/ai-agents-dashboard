# 🚨 RunPod Complete Recovery Guide

If your RunPod instance is **terminated**, use this guide to redeploy everything to a new server.

---

## 📦 What You Need (Already Have)

All these files are in your `ai-dashboard` folder:

1. ✅ `deploy-runpod-scraper.sh` - Deploys article scraper service
2. ✅ `deploy-named-tunnel.sh` - Deploys Cloudflare tunnel
3. ✅ `.env` - Contains all secrets (tunnel token, API keys)

---

## 🚀 Recovery Steps (15 minutes)

### Step 1: Get New RunPod SSH Details

After creating new RunPod instance, note:
- IP Address: `XXX.XXX.XXX.XXX`
- SSH Port: `XXXXX`
- (Your SSH key stays the same: `~/.ssh/id_ed25519`)

### Step 2: Deploy Scraper Service

```bash
# Upload scraper deployment script to persistent storage
scp -P NEW_PORT -i ~/.ssh/id_ed25519 deploy-runpod-scraper.sh root@NEW_IP:/runpod-volume/

# SSH and run deployment
ssh root@NEW_IP -p NEW_PORT -i ~/.ssh/id_ed25519
bash /runpod-volume/deploy-runpod-scraper.sh
exit
```

**This installs:**
- Node.js + Playwright + article scraper
- Runs on port 8000
- Everything stored in `/runpod-volume/scraper-service/`

### Step 3: Deploy Cloudflare Tunnel

```bash
# Get tunnel token from your .env file
# Copy the TUNNEL_TOKEN value

# SSH to new RunPod
ssh root@NEW_IP -p NEW_PORT -i ~/.ssh/id_ed25519

# Create tunnel directory and token file
mkdir -p /runpod-volume/cloudflare-tunnel
echo 'PASTE_YOUR_TUNNEL_TOKEN_HERE' > /runpod-volume/cloudflare-tunnel/.tunnel-token
chmod 600 /runpod-volume/cloudflare-tunnel/.tunnel-token
exit

# Upload tunnel deployment script
scp -P NEW_PORT -i ~/.ssh/id_ed25519 deploy-named-tunnel.sh root@NEW_IP:/runpod-volume/cloudflare-tunnel/

# Run tunnel deployment
ssh root@NEW_IP -p NEW_PORT -i ~/.ssh/id_ed25519
bash /runpod-volume/cloudflare-tunnel/deploy-named-tunnel.sh
```

### Step 4: Verify Everything Works

```bash
# Test the HTTPS endpoint
curl https://blogger.mcgrocer.com/scrape-articles-batch \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"urls":["https://example.com"]}'
```

**Should return JSON response** ✅

### Step 5: Test Blog Generation

1. Go to: https://mcgrocer-com.github.io/ai-agents-dashboard/#/blogger/create
2. Generate a blog
3. Should work perfectly! 🎉

---

## 📝 Quick Reference

### Current Configuration:
- **IP:** 69.30.85.32
- **Port:** 22171
- **Tunnel URL:** https://blogger.mcgrocer.com
- **Scraper Port:** 8000

### Critical Files (Keep Safe):
```
ai-dashboard/
├── .env ← ALL SECRETS HERE (backup this!)
├── deploy-runpod-scraper.sh ← Scraper deployment
└── deploy-named-tunnel.sh ← Tunnel deployment
```

### Secrets in `.env`:
- `TUNNEL_TOKEN` - Cloudflare tunnel token
- `VITE_GEMINI_API_KEY` - Gemini API key
- `VITE_SUPABASE_*` - Supabase credentials
- `VITE_ERPNEXT_*` - ERPNext credentials
- `VITE_DECODO_*` - Decodo credentials

---

## ✅ Recovery Checklist

- [ ] New RunPod instance created
- [ ] SSH connection tested
- [ ] Scraper deployed (`deploy-runpod-scraper.sh`)
- [ ] Scraper responding on port 8000
- [ ] Tunnel token file created
- [ ] Tunnel deployed (`deploy-named-tunnel.sh`)
- [ ] HTTPS endpoint responding: `curl https://blogger.mcgrocer.com`
- [ ] Blog generation tested in dashboard
- [ ] Update IP/Port in docs (if changed):
  - `TUNNEL-MAINTENANCE.md`
  - `RUNPOD-RECOVERY.md`

---

## 🔒 Important Notes

1. **`.env` is NOT in git** - Keep it backed up separately
2. **Tunnel URL stays the same** - `https://blogger.mcgrocer.com` doesn't change
3. **No dashboard rebuild needed** - Dashboard already uses `https://blogger.mcgrocer.com`
4. **Scripts are in git** - Safe to pull from repo anytime

---

**Recovery Time:** ~15 minutes

**Last Updated:** 2025-11-24
