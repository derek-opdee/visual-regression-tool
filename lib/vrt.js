const puppeteer = require('puppeteer');
const puppeteerExtra = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs').promises;
const path = require('path');
const sharp = require('sharp');
const { getBrowserPath, getBrowserOptions } = require('./browser-detector');
const VRTBase = require('./vrt-base');

// Debug module
const DebugCapture = require('./debug-capture');

puppeteerExtra.use(StealthPlugin());

class VRT extends VRTBase {
  constructor(options = {}) {
    // Call parent constructor with options
    super(options);
    
    // Add Puppeteer-specific options
    this.options = {
      ...this.options,
      puppeteerOptions: options.puppeteerOptions || {
        headless: 'new',
        args: [
          '--no-sandbox', 
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor'
        ],
        timeout: 60000,
        protocolTimeout: 60000
      },
      debug: options.debug || false
    };
    
    // Initialize browser
    this.browser = null;
  }

  async getBrowser() {
    if (!this.browser) {
      // Check resource limits from base class
      await this.checkMemoryUsage();
      
      const browserPath = getBrowserPath();
      const browserOptions = getBrowserOptions(browserPath);
      
      const launchOptions = {
        ...this.options.puppeteerOptions,
        ...browserOptions
      };

      // Remove empty executablePath if Puppeteer should use bundled Chromium
      if (!launchOptions.executablePath) {
        delete launchOptions.executablePath;
      }

      console.log('🚀 Launching browser...');
      if (launchOptions.executablePath) {
        const browserName = launchOptions.executablePath.includes('Microsoft Edge') ? 'Microsoft Edge' :
                           launchOptions.executablePath.includes('Google Chrome') ? 'Google Chrome' :
                           launchOptions.executablePath.includes('Chromium') ? 'Chromium' :
                           launchOptions.executablePath.includes('Brave') ? 'Brave Browser' : 'Custom Browser';
        console.log(`✅ Browser detected: ${browserName}`);
      } else {
        console.log('📦 Using Puppeteer bundled Chromium');
      }
      
      // Use withRetry from base class
      this.browser = await this.withRetry(async () => {
        return await puppeteerExtra.launch(launchOptions);
      });
    }
    return this.browser;
  }

  async capture(pageNameOrUrl, options = {}) {
    return this.withRetry(async () => {
      const browser = await this.getBrowser();
      const timestamp = new Date().toISOString().replace(/[:]/g, '-').split('.')[0];
      const outputDir = path.join(this.options.outputDir, options.outputDir || `capture-${timestamp}`);
      
      // Create output directory
      await fs.mkdir(outputDir, { recursive: true });

      const results = [];
      const url = pageNameOrUrl.startsWith('http') ? pageNameOrUrl : `${this.options.baseUrl}${pageNameOrUrl}`;

      // Process viewports in parallel or sequentially based on settings
      const viewports = options.viewports || this.options.viewports;
      const capturePromises = viewports.map(async (viewport) => {
        const page = await browser.newPage();

        try {
          // Set viewport
          await page.setViewport(viewport);

          // Navigate to page
          await page.goto(url, {
            waitUntil: options.waitUntil || 'networkidle2',
            timeout: this.options.timeout
          });

          // Wait if needed
          if (options.waitFor) {
            if (typeof options.waitFor === 'string') {
              await page.waitForSelector(options.waitFor, { timeout: 10000 });
            } else {
              await page.waitForTimeout(options.waitFor);
            }
          }

          // Additional delay
          await page.waitForTimeout(options.delay || 2000);

          // Security: Sanitize viewport name to prevent path traversal
          const sanitizedViewportName = this.sanitizePathComponent(viewport.name);
          const screenshotPath = path.join(outputDir, `${sanitizedViewportName}-${options.fullPage ? 'full' : 'viewport'}.png`);

          // Take screenshot
          await page.screenshot({
            path: screenshotPath,
            fullPage: options.fullPage || false
          });

          results.push({
            viewport: viewport.name,
            path: screenshotPath,
            url: url
          });

          // AI Analysis if enabled and available
          if (this.options.aiEnabled && options.analyze && this.ai) {
            try {
              const analysis = await this.ai.analyzeScreenshot(screenshotPath, {
                viewport: viewport.name,
                url: url,
                detectIssues: options.detectIssues,
                checkAccessibility: options.checkAccessibility
              });
              results[results.length - 1].analysis = analysis;
            } catch (error) {
              console.warn('AI analysis failed:', error.message);
            }
          }

        } finally {
          await page.close();
        }
      });

      // Execute captures
      if (this.options.parallel) {
        await Promise.all(capturePromises);
      } else {
        for (const promise of capturePromises) {
          await promise;
        }
      }

      this.emit('capture:complete', pageNameOrUrl, results);
      return results;
    });
  }

  async debug(url, options = {}) {
    const browser = await this.getBrowser();
    const debugCapture = new DebugCapture(browser, this.options);
    return debugCapture.analyze(url, options);
  }

  // compare method inherited from VRTBase
  // compareImages method inherited from VRTBase

  async generateHTMLReport(results, outputDir) {
    const ReportGenerator = require('./report-generator');
    const html = ReportGenerator.generateReport(results, 'puppeteer');
    await fs.writeFile(path.join(outputDir, 'report.html'), html);
  }
  
  getEngineType() {
    return 'puppeteer';
  }

  // batch method inherited from VRTBase
  // processConfig method inherited from VRTBase

  async cleanup() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  async cleanupBrowser(browser) {
    // Puppeteer doesn't use the same browser management as Playwright
    // Just close the browser
    if (browser) {
      await browser.close();
    }
  }
}

module.exports = VRT;