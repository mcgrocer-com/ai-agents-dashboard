# 🚨 SECURITY NOTICE - IMMEDIATE ACTION REQUIRED

## ⚠️ Tunnel Token Was Exposed in Git

Your Cloudflare Tunnel token was previously **hardcoded** in `deploy-named-tunnel.sh` and committed to git. This has been **fixed**, but the token should be **rotated immediately**.

---

## ✅ What I Fixed

1. **Removed hardcoded token** from `deploy-named-tunnel.sh`
2. **Moved token** to secure file: `/runpod-volume/cloudflare-tunnel/.tunnel-token` (600 permissions)
3. **Updated script** to read from secure file
4. **Added `.tunnel-token` to `.gitignore`** to prevent future commits

---

## 🔒 REQUIRED: Rotate Your Tunnel Token

Since the old token was exposed in git history, you should rotate it:

### Step 1: Get New Token

1. Go to: https://one.dash.cloudflare.com
2. Navigate to: **Networks** → **Tunnels**
3. Find your tunnel → Click **Configure**
4. Click **Delete** on the old tunnel token
5. Click **Create Token**
6. Copy the new token

### Step 2: Update Token on RunPod

```bash
# SSH to RunPod
ssh root@69.30.85.32 -p 22171 -i ~/.ssh/id_ed25519

# Update token file with new token
echo 'YOUR_NEW_TOKEN_HERE' > /runpod-volume/cloudflare-tunnel/.tunnel-token
chmod 600 /runpod-volume/cloudflare-tunnel/.tunnel-token

# Restart tunnel
bash /runpod-volume/cloudflare-tunnel/deploy-named-tunnel.sh
```

### Step 3: Verify

```bash
# Check tunnel is running
ps aux | grep cloudflared

# Test endpoint
curl https://blogger.mcgrocer.com/scrape-articles-batch \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"urls":["https://example.com"]}'
```

---

## 🛡️ Security Best Practices

### ✅ DO:
- Keep tokens in secure files outside git (`.tunnel-token`, `.env`)
- Use 600 permissions on sensitive files (`chmod 600`)
- Add sensitive files to `.gitignore`
- Rotate tokens if accidentally exposed
- Use environment variables or secret management

### ❌ DON'T:
- Hardcode tokens/secrets in code
- Commit `.env` files to git (unless encrypted)
- Share tokens in public repositories
- Store tokens in plaintext in public locations

---

## 📋 Current Secure Setup

- **Token Location:** `/runpod-volume/cloudflare-tunnel/.tunnel-token` (RunPod only)
- **Permissions:** `600` (read/write for owner only)
- **Git Status:** ✅ Not tracked (in `.gitignore`)
- **Script:** Loads token from file (not hardcoded)

---

## 🔍 Check Git History (Optional)

If this is a public repo, you may want to remove the token from git history:

```bash
# WARNING: This rewrites git history!
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch deploy-named-tunnel.sh" \
  --prune-empty --tag-name-filter cat -- --all

# Force push (BE CAREFUL!)
git push origin --force --all
```

**Note:** Only do this if:
- You understand git history rewriting
- You're the only one using the repo
- The repo is private (or you don't mind breaking forks)

---

## ✅ Verification Checklist

After rotating the token:

- [ ] New token created in Cloudflare Dashboard
- [ ] Old token deleted from Cloudflare
- [ ] New token saved to `/runpod-volume/cloudflare-tunnel/.tunnel-token`
- [ ] Token file has 600 permissions
- [ ] Tunnel restarted successfully
- [ ] `https://blogger.mcgrocer.com` responds correctly
- [ ] `.tunnel-token` is in `.gitignore`
- [ ] No hardcoded tokens in any files

---

**Priority:** 🔴 **HIGH** - Rotate token as soon as possible to prevent unauthorized access.
