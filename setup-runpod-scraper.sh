#!/bin/bash
# Quick setup script for Article Scraper on Runpod
# Run this on Runpod server: bash setup-runpod-scraper.sh

set -e

echo "============================================================"
echo "McGrocer Article Scraper Setup for Runpod"
echo "============================================================"

# Install Node.js 20.x
echo "Installing Node.js 20.x..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

echo "Node.js installed:"
node --version
npm --version

# Create service directory
echo "Creating service directory..."
mkdir -p /root/scraper-service
cd /root/scraper-service

# Create server.js
echo "Creating server.js..."
cat > server.js << 'SERVERJS'
#!/usr/bin/env node
/**
 * Article Scraping Service for McGrocer Blogger
 * Uses Stagehand + Gemini for AI-powered content extraction
 */

const express = require('express');
const { Stagehand } = require('@browserbasehq/stagehand');
const { z } = require('zod');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'AIzaSyDE7_jKXrXT7vB-oYA-9Cbtr1gFOemDRsQ';

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'mcgrocer-scraper', version: '1.0.0' });
});

// Article scraping endpoint
app.post('/scrape-article', async (req, res) => {
  let stagehand = null;
  const startTime = Date.now();

  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    console.log(`[${new Date().toISOString()}] Scraping request: ${url}`);

    // Set Gemini API key for Stagehand
    process.env.GOOGLE_API_KEY = GEMINI_API_KEY;

    // Initialize Stagehand in LOCAL mode (FREE)
    stagehand = new Stagehand({
      env: 'LOCAL',
      verbose: 0,
      headless: true,
    });

    await stagehand.init();
    const page = stagehand.context.pages()[0];

    // Navigate to article
    await page.goto(url, {
      waitUntil: 'networkidle',
      timeout: 30000,
    });

    // Wait for content to load
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Extract article content with Gemini AI
    const article = await stagehand.extract(
      "Extract the full article content including the title and all section headings",
      z.object({
        title: z.string().describe("Article title or main heading"),
        content: z.string().describe("Full article text content - all paragraphs combined"),
        headings: z.array(z.string()).describe("All article section headings (h1-h4) in order"),
      }),
      {
        model: 'gemini-2.0-flash',
        timeout: 30000
      }
    );

    // Calculate word count
    const wordCount = article.content.split(/\s+/).filter(w => w.length > 0).length;

    const duration = Date.now() - startTime;
    console.log(`[${new Date().toISOString()}] Scraped ${url} in ${duration}ms (${wordCount} words)`);

    res.json({
      url,
      title: article.title,
      text: article.content,
      wordCount,
      headings: article.headings,
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[${new Date().toISOString()}] Error after ${duration}ms:`, error.message);
    res.status(500).json({
      error: error.message || 'Scraping failed',
      url: req.body.url,
    });
  } finally {
    if (stagehand) {
      try {
        await stagehand.close();
      } catch (cleanupError) {
        console.warn('Cleanup error:', cleanupError.message);
      }
    }
  }
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Article Scraper Service running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Scraping endpoint: POST http://localhost:${PORT}/scrape-article`);
  console.log(`Using Gemini API key: ${GEMINI_API_KEY.substring(0, 20)}...`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  process.exit(0);
});
SERVERJS

chmod +x server.js

# Install dependencies
echo "Installing npm dependencies..."
npm install express @browserbasehq/stagehand zod

# Install Chromium for Stagehand/Playwright
echo "Installing Chromium..."
apt-get install -y chromium-browser chromium-chromedriver || true
npx playwright install chromium
npx playwright install-deps chromium

# Create systemd service
echo "Creating systemd service..."
cat > /etc/systemd/system/scraper.service << 'SERVICE'
[Unit]
Description=McGrocer Article Scraper Service
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/root/scraper-service
Environment="PORT=8000"
Environment="GEMINI_API_KEY=AIzaSyDE7_jKXrXT7vB-oYA-9Cbtr1gFOemDRsQ"
Environment="NODE_ENV=production"
ExecStart=/usr/bin/node /root/scraper-service/server.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=scraper-service

[Install]
WantedBy=multi-user.target
SERVICE

# Reload systemd
systemctl daemon-reload

# Enable and start service
echo "Starting scraper service..."
systemctl enable scraper.service
systemctl start scraper.service

# Wait for service to start
sleep 3

# Check status
echo ""
echo "============================================================"
echo "Service Status:"
echo "============================================================"
systemctl status scraper.service --no-pager || true

# Test the endpoint
echo ""
echo "============================================================"
echo "Testing scraper endpoint..."
echo "============================================================"
curl -X POST http://localhost:8000/health -H "Content-Type: application/json" || echo "Health check failed"

echo ""
echo "============================================================"
echo "Setup Complete!"
echo "============================================================"
echo "Service running on: http://localhost:8000"
echo "Health check: curl http://localhost:8000/health"
echo ""
echo "Test scraping:"
echo 'curl -X POST http://localhost:8000/scrape-article \\'
echo '  -H "Content-Type: application/json" \\'
echo '  -d '"'"'{"url":"https://en.wikipedia.org/wiki/Baby_oil"}'"'"
echo ""
echo "View logs: journalctl -u scraper.service -f"
echo "Restart: systemctl restart scraper.service"
echo ""
echo "Next: Get your Runpod public URL and update frontend!"
echo "============================================================"
