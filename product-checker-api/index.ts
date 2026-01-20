/**
 * Product Checker API Server v2 - Browser Pool
 * Accepts a URL and returns product data (name, price, availability)
 * Uses a pre-initialized browser pool for parallel processing
 */
import "dotenv/config";
import express from "express";
import { existsSync, readdirSync } from "fs";
import { checkProduct, checkProductWithPage, ProductCheckResult } from "./product-checker";
import { getGlobalPool, shutdownGlobalPool, restartGlobalPool } from "./browser-pool";

// Dynamically set CHROME_PATH if not already set (needed for Stagehand AI extraction)
if (!process.env.CHROME_PATH) {
  const playwrightDir = "/root/.cache/ms-playwright";
  if (existsSync(playwrightDir)) {
    try {
      const dirs = readdirSync(playwrightDir).filter(d => d.match(/^chromium-\d+$/));
      if (dirs.length > 0) {
        // Sort by version number and take the latest
        dirs.sort((a, b) => {
          const vA = parseInt(a.split("-")[1], 10);
          const vB = parseInt(b.split("-")[1], 10);
          return vB - vA;
        });
        const latestChromium = dirs[0];
        // Try chrome-linux64 first (newer structure), then chrome-linux (older)
        for (const subdir of ["chrome-linux64", "chrome-linux"]) {
          const chromePath = `${playwrightDir}/${latestChromium}/${subdir}/chrome`;
          if (existsSync(chromePath)) {
            process.env.CHROME_PATH = chromePath;
            console.log(`[Server] Auto-detected CHROME_PATH: ${chromePath}`);
            break;
          }
        }
      }
    } catch (e) {
      console.error("[Server] Error auto-detecting CHROME_PATH:", e);
    }
  }
  // Fallback to common system paths
  if (!process.env.CHROME_PATH) {
    for (const path of ["/usr/bin/chromium", "/usr/bin/chromium-browser", "/usr/bin/google-chrome"]) {
      if (existsSync(path)) {
        process.env.CHROME_PATH = path;
        console.log(`[Server] Using system Chrome: ${path}`);
        break;
      }
    }
  }
}

const app = express();
const PORT = process.env.PORT || 3001;
const POOL_SIZE = parseInt(process.env.BROWSER_POOL_SIZE || "4", 10);

// Track if we're using the pool (initialized after startup)
let usePool = false;

app.use(express.json());

// Helper to process items with concurrency limit
async function processWithConcurrency<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  concurrency: number
): Promise<R[]> {
  const results: R[] = [];
  const executing: Promise<void>[] = [];

  for (const item of items) {
    const promise = processor(item).then((result) => {
      results.push(result);
    });
    executing.push(promise);

    if (executing.length >= concurrency) {
      await Promise.race(executing);
      // Remove completed promises
      for (let i = executing.length - 1; i >= 0; i--) {
        const p = executing[i];
        if (await Promise.race([p.then(() => true), Promise.resolve(false)])) {
          executing.splice(i, 1);
        }
      }
    }
  }

  await Promise.all(executing);
  return results;
}

// Health check endpoint
app.get("/health", (_req, res) => {
  const pool = usePool ? getGlobalPool() : null;
  const poolStats = pool?.getStats();
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    pool: poolStats || { enabled: false },
  });
});

// Restart browser pool endpoint - refreshes all browser instances
app.post("/restart-pool", async (_req, res) => {
  try {
    console.log(`[${new Date().toISOString()}] Restarting browser pool...`);
    const result = await restartGlobalPool();
    console.log(`[${new Date().toISOString()}] Pool restarted: ${result.browsers} browsers`);
    res.json({
      success: true,
      message: "Browser pool restarted successfully",
      browsers: result.browsers,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error restarting pool:`, error);
    res.status(500).json({
      success: false,
      error: "Failed to restart browser pool",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Product check endpoint - uses browser pool for parallel processing
app.post("/check", async (req, res) => {
  const { url, productName, geminiApiKey } = req.body;

  if (!url) {
    return res.status(400).json({ error: "URL is required" });
  }

  if (!geminiApiKey) {
    return res.status(400).json({ error: "geminiApiKey is required" });
  }

  try {
    console.log(`[${new Date().toISOString()}] Checking product: ${url}${productName ? ` (hint: ${productName})` : ""}`);

    let result: ProductCheckResult;

    if (usePool) {
      // Use browser pool for better parallelism
      const pool = getGlobalPool();
      const { page, release } = await pool.acquire();

      try {
        result = await checkProductWithPage(page, url, productName, geminiApiKey);
      } finally {
        await release();
      }
    } else {
      // Fallback to original method (creates new browser each time)
      result = await checkProduct(url, productName, geminiApiKey);
    }

    console.log(`[${new Date().toISOString()}] Result:`, result);
    res.json(result);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error:`, error);
    res.status(500).json({
      error: "Failed to check product",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// GET endpoint for easy testing
app.get("/check", async (req, res) => {
  const url = req.query.url as string;
  const productName = req.query.productName as string | undefined;
  const geminiApiKey = req.query.geminiApiKey as string;

  if (!url) {
    return res.status(400).json({ error: "URL query parameter is required" });
  }

  if (!geminiApiKey) {
    return res.status(400).json({ error: "geminiApiKey query parameter is required" });
  }

  try {
    console.log(`[${new Date().toISOString()}] Checking product: ${url}${productName ? ` (hint: ${productName})` : ""}`);

    let result: ProductCheckResult;

    if (usePool) {
      const pool = getGlobalPool();
      const { page, release } = await pool.acquire();

      try {
        result = await checkProductWithPage(page, url, productName, geminiApiKey);
      } finally {
        await release();
      }
    } else {
      result = await checkProduct(url, productName, geminiApiKey);
    }

    console.log(`[${new Date().toISOString()}] Result:`, result);
    res.json(result);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error:`, error);
    res.status(500).json({
      error: "Failed to check product",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Batch check endpoint - process multiple URLs in parallel
interface BatchItem {
  url: string;
  productName?: string;
}

interface BatchResult extends ProductCheckResult {
  success: boolean;
  error?: string;
}

app.post("/check-batch", async (req, res) => {
  const { items, concurrency, geminiApiKey } = req.body as { items: BatchItem[]; concurrency?: number; geminiApiKey: string };

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "items array is required" });
  }

  if (!geminiApiKey) {
    return res.status(400).json({ error: "geminiApiKey is required" });
  }

  // With browser pool, we can handle more concurrent requests
  const maxConcurrent = Math.min(concurrency || POOL_SIZE, POOL_SIZE);
  const startTime = Date.now();

  console.log(`[${new Date().toISOString()}] Batch check: ${items.length} items, concurrency: ${maxConcurrent}`);

  const results = await processWithConcurrency<BatchItem, BatchResult>(
    items,
    async (item) => {
      try {
        console.log(`[${new Date().toISOString()}] Checking: ${item.url}`);

        let result: ProductCheckResult;

        if (usePool) {
          const pool = getGlobalPool();
          const { page, release } = await pool.acquire();

          try {
            result = await checkProductWithPage(page, item.url, item.productName, geminiApiKey);
          } finally {
            await release();
          }
        } else {
          result = await checkProduct(item.url, item.productName, geminiApiKey);
        }

        return { ...result, success: true };
      } catch (error) {
        console.error(`[${new Date().toISOString()}] Error for ${item.url}:`, error);
        return {
          url: item.url,
          product: "Error",
          price: "N/A",
          availability: "Unknown" as const,
          extractionMethod: "css" as const,
          checkedAt: new Date().toISOString(),
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
    maxConcurrent
  );

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  const successful = results.filter((r) => r.success).length;

  console.log(`[${new Date().toISOString()}] Batch complete: ${successful}/${items.length} success in ${duration}s`);

  res.json({
    results,
    summary: {
      total: items.length,
      successful,
      failed: items.length - successful,
      duration: `${duration}s`,
      concurrency: maxConcurrent,
    },
  });
});

// Start server and initialize browser pool
async function startServer() {
  // Initialize browser pool before accepting requests
  console.log(`[Server] Initializing browser pool with ${POOL_SIZE} instances...`);

  try {
    const pool = getGlobalPool();
    await pool.initialize();
    usePool = true;
    console.log(`[Server] Browser pool initialized successfully`);
  } catch (error) {
    console.error(`[Server] Failed to initialize browser pool, falling back to on-demand browsers:`, error);
    usePool = false;
  }

  const server = app.listen(PORT, () => {
    console.log(`Product Checker API v2 running on port ${PORT}`);
    console.log(`Browser Pool: ${usePool ? `enabled (${POOL_SIZE} browsers)` : "disabled"}`);
    console.log(`Health: http://localhost:${PORT}/health`);
    console.log(`Check:  POST http://localhost:${PORT}/check { "url": "...", "productName": "optional", "geminiApiKey": "required" }`);
    console.log(`Batch:  POST http://localhost:${PORT}/check-batch { "items": [...], "concurrency": ${POOL_SIZE}, "geminiApiKey": "required" }`);
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`\n[Server] Received ${signal}, shutting down gracefully...`);

    server.close(async () => {
      console.log(`[Server] HTTP server closed`);

      if (usePool) {
        await shutdownGlobalPool();
      }

      console.log(`[Server] Shutdown complete`);
      process.exit(0);
    });

    // Force exit after 30 seconds
    setTimeout(() => {
      console.error(`[Server] Forced shutdown after timeout`);
      process.exit(1);
    }, 30000);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

startServer().catch((error) => {
  console.error(`[Server] Failed to start:`, error);
  process.exit(1);
});
