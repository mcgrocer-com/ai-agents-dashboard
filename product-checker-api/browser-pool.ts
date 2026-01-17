/**
 * Browser Pool for Parallel Product Checking
 * Pre-initializes a pool of browser instances to enable true parallel processing
 * without the overhead of launching browsers for each request.
 */
import { chromium } from "playwright-extra";
import type { Browser, BrowserContext, Page } from "playwright";
import StealthPlugin from "puppeteer-extra-plugin-stealth";

// Apply stealth plugin to bypass anti-bot detection
chromium.use(StealthPlugin());

interface ProxyConfig {
  server: string;
  username: string;
  password: string;
}

interface PooledBrowser {
  browser: Browser;
  id: number;
  inUse: boolean;
  lastUsed: Date;
}

interface BrowserPoolConfig {
  size: number;
  proxy?: ProxyConfig;
  headless: boolean;
}

const BROWSER_ARGS = [
  "--no-sandbox",
  "--disable-setuid-sandbox",
  "--disable-blink-features=AutomationControlled",
  "--disable-dev-shm-usage",
  "--disable-gpu",
];

const CONTEXT_OPTIONS = {
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 1,
  hasTouch: false,
  isMobile: false,
  userAgent:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  locale: "en-GB",
  timezoneId: "Europe/London",
  permissions: ["geolocation"] as ("geolocation")[],
  geolocation: { latitude: 51.5074, longitude: -0.1278 }, // London
  colorScheme: "light" as const,
};

export class BrowserPool {
  private browsers: PooledBrowser[] = [];
  private config: BrowserPoolConfig;
  private waitingQueue: Array<(browser: PooledBrowser) => void> = [];
  private initialized = false;
  private initializing = false;

  constructor(config: BrowserPoolConfig) {
    this.config = config;
  }

  /**
   * Initialize the browser pool with the configured number of instances
   */
  async initialize(): Promise<void> {
    if (this.initialized || this.initializing) {
      return;
    }

    this.initializing = true;
    console.log(`[BrowserPool] Initializing ${this.config.size} browser instances...`);

    const startTime = Date.now();

    // Launch browsers in parallel for faster startup
    const launchPromises = Array.from({ length: this.config.size }, (_, i) =>
      this.launchBrowser(i)
    );

    const results = await Promise.allSettled(launchPromises);

    for (const result of results) {
      if (result.status === "fulfilled" && result.value) {
        this.browsers.push(result.value);
      } else if (result.status === "rejected") {
        console.error(`[BrowserPool] Failed to launch browser:`, result.reason);
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[BrowserPool] Initialized ${this.browsers.length}/${this.config.size} browsers in ${duration}s`);

    if (this.browsers.length === 0) {
      throw new Error("Failed to initialize any browsers in the pool");
    }

    this.initialized = true;
    this.initializing = false;
  }

  /**
   * Launch a single browser instance
   */
  private async launchBrowser(id: number): Promise<PooledBrowser> {
    console.log(`[BrowserPool] Launching browser ${id + 1}...`);

    const launchOptions: Parameters<typeof chromium.launch>[0] = {
      headless: this.config.headless,
      args: BROWSER_ARGS,
    };

    if (this.config.proxy) {
      launchOptions.proxy = {
        server: this.config.proxy.server,
        username: this.config.proxy.username,
        password: this.config.proxy.password,
      };
    }

    const browser = await chromium.launch(launchOptions);

    console.log(`[BrowserPool] Browser ${id + 1} launched successfully`);

    return {
      browser,
      id,
      inUse: false,
      lastUsed: new Date(),
    };
  }

  /**
   * Acquire a browser from the pool
   * If all browsers are busy, waits for one to become available
   */
  async acquire(): Promise<{ browser: Browser; context: BrowserContext; page: Page; release: () => Promise<void> }> {
    if (!this.initialized) {
      await this.initialize();
    }

    // Find an available browser
    const available = this.browsers.find((b) => !b.inUse);

    if (available) {
      available.inUse = true;
      available.lastUsed = new Date();
      console.log(`[BrowserPool] Acquired browser ${available.id + 1} (${this.getStatus()})`);

      // Create a fresh context for this request
      const context = await available.browser.newContext(CONTEXT_OPTIONS);
      const page = await context.newPage();

      return {
        browser: available.browser,
        context,
        page,
        release: async () => {
          await this.releaseContext(available, context);
        },
      };
    }

    // All browsers busy, wait for one to become available
    console.log(`[BrowserPool] All browsers busy, waiting... (${this.getStatus()})`);

    return new Promise((resolve) => {
      this.waitingQueue.push(async (pooledBrowser) => {
        pooledBrowser.inUse = true;
        pooledBrowser.lastUsed = new Date();
        console.log(`[BrowserPool] Acquired browser ${pooledBrowser.id + 1} from queue (${this.getStatus()})`);

        const context = await pooledBrowser.browser.newContext(CONTEXT_OPTIONS);
        const page = await context.newPage();

        resolve({
          browser: pooledBrowser.browser,
          context,
          page,
          release: async () => {
            await this.releaseContext(pooledBrowser, context);
          },
        });
      });
    });
  }

  /**
   * Release a browser context back to the pool
   */
  private async releaseContext(pooledBrowser: PooledBrowser, context: BrowserContext): Promise<void> {
    try {
      // Close all pages and the context
      await context.close();
    } catch (e) {
      console.error(`[BrowserPool] Error closing context:`, e);
    }

    pooledBrowser.inUse = false;
    console.log(`[BrowserPool] Released browser ${pooledBrowser.id + 1} (${this.getStatus()})`);

    // Check if anyone is waiting
    if (this.waitingQueue.length > 0) {
      const next = this.waitingQueue.shift();
      if (next) {
        next(pooledBrowser);
      }
    }
  }

  /**
   * Get pool status string
   */
  private getStatus(): string {
    const inUse = this.browsers.filter((b) => b.inUse).length;
    return `${inUse}/${this.browsers.length} in use, ${this.waitingQueue.length} waiting`;
  }

  /**
   * Get pool statistics
   */
  getStats(): { total: number; inUse: number; available: number; waiting: number } {
    const inUse = this.browsers.filter((b) => b.inUse).length;
    return {
      total: this.browsers.length,
      inUse,
      available: this.browsers.length - inUse,
      waiting: this.waitingQueue.length,
    };
  }

  /**
   * Shutdown the pool and close all browsers
   */
  async shutdown(): Promise<void> {
    console.log(`[BrowserPool] Shutting down...`);

    for (const pooledBrowser of this.browsers) {
      try {
        await pooledBrowser.browser.close();
        console.log(`[BrowserPool] Closed browser ${pooledBrowser.id + 1}`);
      } catch (e) {
        console.error(`[BrowserPool] Error closing browser ${pooledBrowser.id + 1}:`, e);
      }
    }

    this.browsers = [];
    this.waitingQueue = [];
    this.initialized = false;
    console.log(`[BrowserPool] Shutdown complete`);
  }

  /**
   * Check if pool is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }
}

// Global pool instance
let globalPool: BrowserPool | null = null;

/**
 * Get or create the global browser pool
 */
export function getGlobalPool(): BrowserPool {
  if (!globalPool) {
    const hasDisplay = !!process.env.DISPLAY;
    const useProxy = process.env.USE_PROXY === "true";
    const poolSize = parseInt(process.env.BROWSER_POOL_SIZE || "4", 10);

    const config: BrowserPoolConfig = {
      size: poolSize,
      headless: !hasDisplay,
    };

    if (useProxy && process.env.PROXY_SERVER && process.env.PROXY_USERNAME && process.env.PROXY_PASSWORD) {
      config.proxy = {
        server: process.env.PROXY_SERVER,
        username: process.env.PROXY_USERNAME,
        password: process.env.PROXY_PASSWORD,
      };
    }

    console.log(`[BrowserPool] Creating pool: size=${poolSize}, headless=${config.headless}, proxy=${!!config.proxy}`);
    globalPool = new BrowserPool(config);
  }

  return globalPool;
}

/**
 * Shutdown the global pool
 */
export async function shutdownGlobalPool(): Promise<void> {
  if (globalPool) {
    await globalPool.shutdown();
    globalPool = null;
  }
}
