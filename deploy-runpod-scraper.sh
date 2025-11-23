#!/bin/bash
# Runpod Article Scraper - Complete Setup Script
# Run this on Runpod server: bash deploy-runpod-scraper.sh

set -e

echo "============================================================"
echo "McGrocer Article Scraper - Runpod Deployment"
echo "============================================================"

# Use runpod-volume for persistent storage
SERVICE_DIR="/runpod-volume/scraper-service"

echo "Step 1: Checking Node.js installation..."
if ! command -v node &> /dev/null; then
    echo "Installing Node.js 20.x..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
else
    echo "Node.js already installed: $(node --version)"
fi

echo ""
echo "Step 2: Creating service directory..."
mkdir -p "$SERVICE_DIR"
cd "$SERVICE_DIR"

echo ""
echo "Step 3: Creating package.json..."
cat > package.json << 'PACKAGEJSON'
{
  "name": "mcgrocer-scraper-service",
  "version": "1.1.0",
  "description": "Article scraping service using Playwright + Gemini AI with batch processing",
  "main": "server-playwright.js",
  "scripts": {
    "start": "node server-playwright.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "playwright": "^1.40.0",
    "@google/generative-ai": "latest"
  }
}
PACKAGEJSON

echo ""
echo "Step 4: Installing npm dependencies..."
npm install

echo ""
echo "Step 5: Installing Playwright browsers..."
npx playwright install chromium
npx playwright install-deps chromium

echo ""
echo "Step 6: Creating server-playwright.js..."
cat > server-playwright.js << 'SERVERJS'
#!/usr/bin/env node
/**
 * Article Scraping Service for McGrocer Blogger
 * Uses Playwright + Gemini AI for content extraction
 */

const express = require('express');
const { chromium } = require('playwright');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
app.use(express.json());

// CORS middleware - Allow all origins for scraping service
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }

  next();
});

const PORT = process.env.PORT || 8000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'AIzaSyDE7_jKXrXT7vB-oYA-9Cbtr1gFOemDRsQ';
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'mcgrocer-scraper-playwright', version: '1.0.2' });
});

// Article scraping endpoint
app.post('/scrape-article', async (req, res) => {
  let browser = null;
  const startTime = Date.now();

  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    console.log(`[${new Date().toISOString()}] Scraping request: ${url}`);

    // Launch browser
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    // Navigate to article
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);

    // Extract page content
    const content = await page.evaluate(() => {
      const article = document.querySelector('article') || document.querySelector('main') || document.body;
      return {
        title: document.title || document.querySelector('h1')?.textContent || '',
        text: article?.innerText || document.body.innerText,
        html: article?.innerHTML || document.body.innerHTML
      };
    });

    // Use Gemini to structure the content (with API key from request)
    const genAI = new GoogleGenerativeAI(api_key);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const prompt = `Extract structured article content from this text and HTML:

Title: ${content.title}

Text: ${content.text.substring(0, 5000)}

Return JSON with this exact structure:
{
  "title": "Article title or main heading",
  "content": "Full article text content - all paragraphs combined",
  "headings": ["All article section headings in order"]
}`;

    const result = await model.generateContent(prompt);
    const response = result.response.text();

    // Parse Gemini response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to extract structured data from Gemini response');
    }

    const article = JSON.parse(jsonMatch[0]);

    // Calculate word count
    const wordCount = article.content.split(/\s+/).filter(w => w.length > 0).length;

    const duration = Date.now() - startTime;
    console.log(`[${new Date().toISOString()}] Scraped ${url} in ${duration}ms (${wordCount} words)`);

    res.json({
      url,
      title: article.title,
      text: article.content,
      wordCount,
      headings: article.headings || [],
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[${new Date().toISOString()}] Error after ${duration}ms:`, error.message);
    res.status(500).json({
      error: error.message || 'Scraping failed',
      url: req.body.url,
    });
  } finally {
    if (browser) {
      await browser.close();
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
  console.log(`Article Scraper Service (Playwright) running on port ${PORT}`);
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

chmod +x server-playwright.js

echo ""
echo "Step 7: Installing PM2 globally..."
if ! command -v pm2 &> /dev/null; then
    npm install -g pm2
else
    echo "PM2 already installed: $(pm2 --version)"
fi

echo ""
echo "Step 8: Stopping old PM2 process (if exists)..."
pm2 delete scraper 2>/dev/null || echo "No existing scraper process found"

echo ""
echo "Step 9: Starting service with PM2..."
pm2 start server-playwright.js \
  --name scraper \
  --cwd "$SERVICE_DIR" \
  --env production \
  --log /runpod-volume/logs/scraper.log \
  --error /runpod-volume/logs/scraper-error.log \
  --max-memory-restart 1G

# Create logs directory
mkdir -p /runpod-volume/logs

echo ""
echo "Step 10: Saving PM2 configuration..."
pm2 save

echo ""
echo "Step 11: Setting up PM2 startup (if possible)..."
pm2 startup || echo "Note: PM2 startup may not work in Docker containers"

echo ""
echo "============================================================"
echo "Deployment Complete!"
echo "============================================================"
echo ""
echo "Service Location: $SERVICE_DIR"
echo "Service Port: 8000 (internal)"
echo "External Access: http://69.30.85.32:22172"
echo ""
echo "PM2 Commands:"
echo "  View status:  pm2 status"
echo "  View logs:    pm2 logs scraper"
echo "  Restart:      pm2 restart scraper"
echo "  Stop:         pm2 stop scraper"
echo ""
echo "Testing:"
echo "  Health check:    curl http://localhost:8000/health"
echo "  Single scrape:   curl -X POST http://localhost:8000/scrape-article \\"
echo "                     -H 'Content-Type: application/json' \\"
echo "                     -d '{\"url\":\"https://example.com\",\"api_key\":\"YOUR_GEMINI_KEY\"}'"
echo "  Batch scrape:    curl -X POST http://localhost:8000/scrape-articles-batch \\"
echo "                     -H 'Content-Type: application/json' \\"
echo "                     -d '{\"urls\":[\"https://url1.com\",\"https://url2.com\"],\"api_key\":\"YOUR_GEMINI_KEY\"}'"
echo ""
echo "============================================================"

# Wait a few seconds then check status
sleep 3
pm2 list
