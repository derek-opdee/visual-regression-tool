const { chromium, firefox, webkit, devices } = require('playwright');
const fs = require('fs').promises;
const path = require('path');
const VRTBase = require('./vrt-base');

class PlaywrightVRT extends VRTBase {
  constructor(options = {}) {
    // Call parent constructor with options
    super(options);
    
    // Add Playwright-specific options
    this.options = {
      ...this.options,
      browser: options.browser || 'chromium', // chromium, firefox, webkit, all
      devices: options.devices || [], // Specific device emulation
      headless: options.headless !== false,
      slowMo: options.slowMo || 0,
      interactive: options.interactive || false,
      recordVideo: options.recordVideo || false,
      tracing: options.tracing || false
    };
    
    // Device presets for mobile emulation
    this.devicePresets = {
      'iPhone 14 Pro': devices['iPhone 14 Pro'],
      'iPhone 14 Pro Max': devices['iPhone 14 Pro Max'],
      'iPhone 13': devices['iPhone 13'],
      'iPhone SE': devices['iPhone SE'],
      'iPad Pro': devices['iPad Pro'],
      'iPad Mini': devices['iPad Mini'],
      'Pixel 7': devices['Pixel 7'],
      'Galaxy S22': devices['Galaxy S22'],
      'Galaxy Tab S8': devices['Galaxy Tab S8']
    };
  }

  // Resource management methods inherited from VRTBase

  async getBrowser(browserType = this.options.browser) {
    // Check resource limits
    await this.waitForBrowserSlot();
    await this.checkMemoryUsage();
    
    const launchOptions = {
      headless: this.options.headless,
      slowMo: this.options.slowMo,
      timeout: this.options.timeout
    };

    let browser;
    try {
      this.currentBrowserCount++;
      
      switch (browserType.toLowerCase()) {
        case 'firefox':
          browser = await firefox.launch(launchOptions);
          break;
        case 'webkit':
        case 'safari':
          browser = await webkit.launch(launchOptions);
          break;
        case 'chromium':
        case 'chrome':
        case 'edge':
        default:
          browser = await chromium.launch({
            ...launchOptions,
            channel: browserType === 'edge' ? 'msedge' : undefined
          });
          break;
      }

      this.activeBrowsers.add(browser);
      return browser;
    } catch (error) {
      this.currentBrowserCount--;
      throw error;
    }
  }

  async capture(pageNameOrUrl, options = {}) {
    return this.withRetry(async () => {
      const timestamp = new Date().toISOString().replace(/[:]/g, '-').split('.')[0];
      const outputDir = path.join(this.options.outputDir, options.outputDir || `capture-${timestamp}`);
      
      await fs.mkdir(outputDir, { recursive: true });

      const results = [];
      const browsers = [];

      try {
        // Determine which browsers to use
        const browserTypes = options.browsers || (this.options.browser === 'all' 
          ? ['chromium', 'firefox', 'webkit'] 
          : [this.options.browser]);

        const url = (pageNameOrUrl.startsWith('http') || pageNameOrUrl.startsWith('file://'))
          ? pageNameOrUrl 
          : `${this.options.baseUrl}${pageNameOrUrl}`;

        // Process browsers sequentially to respect resource limits
        for (const browserType of browserTypes) {
          console.log(`🚀 Launching ${browserType}...`);
          const browser = await this.getBrowser(browserType);

          try {
            this.emit('capture:start', pageNameOrUrl, browserType);

            // Capture with viewports
            if (!options.devicesOnly) {
              for (const viewport of this.options.viewports) {
                const context = await browser.newContext({
                  viewport,
                  recordVideo: this.options.recordVideo ? { dir: path.join(outputDir, 'videos') } : undefined
                });

                if (this.options.tracing) {
                  await context.tracing.start({ screenshots: true, snapshots: true });
                }

                const page = await context.newPage();
                await this.setupPage(page);

                await page.goto(url, { 
                  waitUntil: options.waitUntil || 'domcontentloaded',
                  timeout: this.options.navigationTimeout 
                });

                if (options.waitFor) {
                  await page.waitForSelector(options.waitFor, { timeout: 10000 });
                }

                if (options.interact) {
                  await this.performInteractions(page, options.interact);
                }

                await page.waitForTimeout(options.delay || 2000);

                // Security: Sanitize viewport name to prevent path traversal
                const sanitizedViewportName = this.sanitizePathComponent(viewport.name);
                const screenshotPath = path.join(
                  outputDir, 
                  `${browserType}-${sanitizedViewportName}-${options.fullPage ? 'full' : 'viewport'}.png`
                );

                await page.screenshot({
                  path: screenshotPath,
                  fullPage: options.fullPage || false
                });

                results.push({
                  browser: browserType,
                  viewport: viewport.name,
                  path: screenshotPath,
                  url: url
                });

                // AI Analysis if enabled
                if (this.options.aiEnabled && options.analyze) {
                  try {
                    const analysis = await this.ai.analyzeScreenshot(screenshotPath, {
                      browser: browserType,
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

                if (this.options.tracing) {
                  await context.tracing.stop({ 
                    path: path.join(outputDir, `trace-${browserType}-${viewport.name}.zip`) 
                  });
                }

                await context.close();
              }
            }

            // Capture with specific devices
            if (options.devices || this.options.devices.length > 0) {
              const devicesToEmulate = options.devices || this.options.devices;
              
              for (const deviceName of devicesToEmulate) {
                const device = this.devicePresets[deviceName] || devices[deviceName];
                
                if (!device) {
                  console.warn(`Device "${deviceName}" not found, skipping...`);
                  continue;
                }

                const context = await browser.newContext({
                  ...device,
                  recordVideo: this.options.recordVideo ? { dir: path.join(outputDir, 'videos') } : undefined
                });

                const page = await context.newPage();
                await this.setupPage(page);

                await page.goto(url, { 
                  waitUntil: options.waitUntil || 'domcontentloaded',
                  timeout: this.options.navigationTimeout 
                });

                if (options.interact) {
                  await this.performInteractions(page, options.interact);
                }

                await page.waitForTimeout(options.delay || 2000);

                // Security: Sanitize device name to prevent path traversal
                const sanitizedDeviceName = this.sanitizePathComponent(deviceName.replace(/\s+/g, '-'));
                const screenshotPath = path.join(
                  outputDir, 
                  `${browserType}-${sanitizedDeviceName}.png`
                );

                await page.screenshot({
                  path: screenshotPath,
                  fullPage: options.fullPage || false
                });

                results.push({
                  browser: browserType,
                  device: deviceName,
                  path: screenshotPath,
                  url: url
                });

                await context.close();
              }
            }
          } finally {
            // Always clean up browser after use
            await this.cleanupBrowser(browser);
          }
        }

        this.emit('capture:complete', pageNameOrUrl, results);
        return results;

      } finally {
        // Cleanup any remaining browsers (shouldn't be any if everything worked)
        for (const browser of browsers) {
          await this.cleanupBrowser(browser);
        }
      }
    });
  }

  async setupPage(page) {
    // Set default timeouts
    page.setDefaultTimeout(this.options.timeout);
    page.setDefaultNavigationTimeout(this.options.navigationTimeout);

    // Add console listener for debugging
    if (this.options.debug) {
      page.on('console', msg => console.log('PAGE LOG:', msg.text()));
      page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
    }

    // Add request interception if needed
    if (this.options.blockAds) {
      await page.route('**/*', route => {
        const url = route.request().url();
        if (url.includes('doubleclick') || url.includes('googlesyndication')) {
          return route.abort();
        }
        return route.continue();
      });
    }
  }

  async performInteractions(page, interactions) {
    if (!Array.isArray(interactions)) {
      interactions = [interactions];
    }

    for (const interaction of interactions) {
      switch (interaction.type) {
        case 'click':
          await page.click(interaction.selector, {
            button: interaction.button || 'left',
            clickCount: interaction.clickCount || 1,
            delay: interaction.delay || 0,
            position: interaction.position,
            modifiers: interaction.modifiers
          });
          break;

        case 'type':
        case 'fill':
          if (interaction.clear !== false) {
            await page.fill(interaction.selector, '');
          }
          await page.type(interaction.selector, interaction.text, {
            delay: interaction.typeDelay || 0
          });
          if (interaction.pressEnter) {
            await page.press(interaction.selector, 'Enter');
          }
          break;

        case 'hover':
          await page.hover(interaction.selector, {
            position: interaction.position,
            modifiers: interaction.modifiers,
            force: interaction.force
          });
          break;

        case 'drag':
          await page.dragAndDrop(
            interaction.sourceSelector,
            interaction.targetSelector,
            {
              sourcePosition: interaction.sourcePosition,
              targetPosition: interaction.targetPosition
            }
          );
          break;

        case 'select':
          await page.selectOption(interaction.selector, interaction.values);
          break;

        case 'check':
          await page.check(interaction.selector);
          break;

        case 'uncheck':
          await page.uncheck(interaction.selector);
          break;

        case 'press':
          await page.press(interaction.selector || 'body', interaction.key, {
            delay: interaction.delay || 0
          });
          break;

        case 'scroll':
          if (interaction.selector) {
            await page.locator(interaction.selector).scrollIntoViewIfNeeded();
          } else if (interaction.position) {
            await page.evaluate(({ x, y }) => window.scrollTo(x, y), interaction.position);
          }
          break;

        case 'wait':
          if (interaction.selector) {
            await page.waitForSelector(interaction.selector, {
              state: interaction.state || 'visible',
              timeout: interaction.timeout || 30000
            });
          } else if (interaction.timeout) {
            await page.waitForTimeout(interaction.timeout);
          }
          break;

        case 'evaluate':
          // Security: Validate and sanitize function execution
          if (!interaction.function) {
            throw new Error('Evaluate interaction requires a function');
          }
          
          // Only allow string functions for security
          if (typeof interaction.function !== 'string') {
            throw new Error('Function must be provided as a string for security');
          }
          
          // Check for dangerous patterns
          const dangerousPatterns = [
            'require', 'process', 'child_process', '__dirname', '__filename',
            'eval', 'Function', 'setTimeout', 'setInterval', 'setImmediate',
            'fs', 'http', 'https', 'net', 'os', 'path', 'crypto', 'buffer'
          ];
          
          const functionStr = interaction.function.toLowerCase();
          for (const pattern of dangerousPatterns) {
            if (functionStr.includes(pattern)) {
              throw new Error(`Security: Unsafe pattern "${pattern}" detected in evaluate function`);
            }
          }
          
          // Execute in a sandboxed context
          try {
            const safeFunction = new Function('return ' + interaction.function)();
            await page.evaluate(safeFunction, interaction.args);
          } catch (error) {
            throw new Error(`Evaluate execution failed: ${error.message}`);
          }
          break;

        case 'screenshot':
          await page.screenshot({
            path: interaction.path,
            fullPage: interaction.fullPage,
            clip: interaction.clip
          });
          break;

        default:
          console.warn(`Unknown interaction type: ${interaction.type}`);
      }

      // Add delay between interactions if specified
      if (interaction.afterDelay) {
        await page.waitForTimeout(interaction.afterDelay);
      }
    }
  }

  async interactiveSession(url, options = {}) {
    console.log('🎮 Starting interactive session...');
    const browser = await this.getBrowser(options.browser || this.options.browser);
    
    try {
      const context = await browser.newContext({
        viewport: options.viewport || { width: 1440, height: 900 },
        recordVideo: { dir: path.join(this.options.outputDir, 'interactive-sessions') }
      });

      const page = await context.newPage();
      await this.setupPage(page);

      await page.goto(url, { waitUntil: 'domcontentloaded' });

      // Create interaction API for AI
      const api = {
        click: async (selector, options = {}) => {
          await page.click(selector, options);
          return { success: true, action: 'click', selector };
        },

        type: async (selector, text, options = {}) => {
          await page.type(selector, text, options);
          return { success: true, action: 'type', selector, text };
        },

        hover: async (selector, options = {}) => {
          await page.hover(selector, options);
          return { success: true, action: 'hover', selector };
        },

        screenshot: async (options = {}) => {
          const screenshotPath = options.path || path.join(
            this.options.outputDir,
            `interactive-${Date.now()}.png`
          );
          await page.screenshot({ ...options, path: screenshotPath });
          return { success: true, action: 'screenshot', path: screenshotPath };
        },

        evaluate: async (fn, ...args) => {
          const result = await page.evaluate(fn, ...args);
          return { success: true, action: 'evaluate', result };
        },

        getContent: async () => {
          const content = await page.content();
          return { success: true, action: 'getContent', content };
        },

        getUrl: async () => {
          const url = page.url();
          return { success: true, action: 'getUrl', url };
        },

        goBack: async () => {
          await page.goBack();
          return { success: true, action: 'goBack' };
        },

        goForward: async () => {
          await page.goForward();
          return { success: true, action: 'goForward' };
        },

        reload: async () => {
          await page.reload();
          return { success: true, action: 'reload' };
        },

        selectOption: async (selector, values) => {
          await page.selectOption(selector, values);
          return { success: true, action: 'selectOption', selector, values };
        },

        waitForSelector: async (selector, options = {}) => {
          await page.waitForSelector(selector, options);
          return { success: true, action: 'waitForSelector', selector };
        },

        getAccessibilityTree: async () => {
          const snapshot = await page.accessibility.snapshot();
          return { success: true, action: 'getAccessibilityTree', snapshot };
        },

        // Advanced AI-friendly methods
        findElements: async (description) => {
          // Use AI to find elements based on description
          const elements = await page.$$eval('*', (els, desc) => {
            return els.filter(el => {
              const text = el.textContent || '';
              const label = el.getAttribute('aria-label') || '';
              const title = el.getAttribute('title') || '';
              return text.includes(desc) || label.includes(desc) || title.includes(desc);
            }).map(el => ({
              tagName: el.tagName,
              text: el.textContent?.substring(0, 100),
              selector: el.className ? `.${el.className.split(' ')[0]}` : el.tagName.toLowerCase()
            }));
          }, description);
          return { success: true, action: 'findElements', elements };
        },

        extractData: async (selector) => {
          const data = await page.$$eval(selector, els => 
            els.map(el => ({
              text: el.textContent,
              href: el.href,
              src: el.src,
              value: el.value
            }))
          );
          return { success: true, action: 'extractData', data };
        },

        close: async () => {
          await context.close();
          return { success: true, action: 'close' };
        }
      };

      // Return the API for AI to use
      return {
        page,
        context,
        browser,
        api,
        cleanup: async () => {
          await context.close();
          await this.cleanupBrowser(browser);
        }
      };

    } catch (error) {
      await this.cleanupBrowser(browser);
      throw error;
    }
  }

  // compare and compareImages methods inherited from VRTBase

  async generateHTMLReport(results, outputDir) {
    const ReportGenerator = require('./report-generator');
    const html = ReportGenerator.generateReport(results, 'playwright');
    await fs.writeFile(path.join(outputDir, 'report.html'), html);
  }
  
  getEngineType() {
    return 'playwright';
  }

  // batch method inherited from VRTBase

  async processConfig(config) {
    // Handle Playwright-specific interactive config type
    if (config.type === 'interactive') {
      return this.interactiveSession(config.url, config.options);
    }
    // Delegate to base class for standard types
    return super.processConfig(config);
  }

  // withRetry method inherited from VRTBase

  async cleanupBrowser(browser) {
    try {
      if (browser && this.activeBrowsers.has(browser)) {
        await browser.close();
        this.activeBrowsers.delete(browser);
        this.currentBrowserCount = Math.max(0, this.currentBrowserCount - 1);
      }
    } catch (error) {
      console.warn('Error closing browser:', error.message);
      // Ensure count is decremented even on error
      if (this.activeBrowsers.has(browser)) {
        this.activeBrowsers.delete(browser);
        this.currentBrowserCount = Math.max(0, this.currentBrowserCount - 1);
      }
    }
  }

  async cleanup() {
    // Clean up all active browsers
    for (const browser of this.activeBrowsers) {
      await this.cleanupBrowser(browser);
    }
  }
}

module.exports = PlaywrightVRT;