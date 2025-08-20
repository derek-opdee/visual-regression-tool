const puppeteer = require('puppeteer');
const puppeteerExtra = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs').promises;
const path = require('path');
const { PNG } = require('pngjs');
const pixelmatch = require('pixelmatch').default || require('pixelmatch');
// const resemble = require('resemblejs');
const sharp = require('sharp');
const EventEmitter = require('events');
const { getBrowserPath, getBrowserOptions } = require('./browser-detector');

// AI Analysis modules
const AIAnalyzer = require('./ai-analyzer');
const BaselineManager = require('./baseline-manager');
const DebugCapture = require('./debug-capture');

puppeteerExtra.use(StealthPlugin());

class VRT extends EventEmitter {
  constructor(options = {}) {
    super();
    this.options = {
      baseUrl: options.baseUrl || 'http://localhost:8000',
      outputDir: options.outputDir || './screenshots',
      viewports: options.viewports || [
        { name: 'mobile', width: 375, height: 812, deviceScaleFactor: 2 },
        { name: 'tablet', width: 768, height: 1024, deviceScaleFactor: 2 },
        { name: 'desktop', width: 1440, height: 900, deviceScaleFactor: 1 },
        { name: 'desktop-xl', width: 1920, height: 1080, deviceScaleFactor: 1 }
      ],
      puppeteerOptions: options.puppeteerOptions || {
        headless: 'new',
        // executablePath is now handled by browser-detector.js
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
      aiEnabled: options.aiEnabled !== false,
      parallel: options.parallel || false,
      maxParallel: options.maxParallel || 4,
      retries: options.retries || 3,
      timeout: options.timeout || 30000,
      navigationTimeout: options.navigationTimeout || 30000,
      maxConcurrentBrowsers: options.maxConcurrentBrowsers || 3,
      memoryThreshold: options.memoryThreshold || 1024 * 1024 * 1024 // 1GB
    };

    // Initialize modules with safe fallbacks
    try {
      this.ai = new AIAnalyzer();
    } catch (error) {
      console.warn('AI module not available, continuing without AI features');
      this.ai = {
        analyzeScreenshot: async () => ({ summary: 'AI analysis disabled' }),
        analyzeDifference: async () => ({ summary: 'AI analysis disabled' }),
        suggestCSSFixes: async () => ([]),
        analyzeTimeline: async () => ({ summary: 'AI analysis disabled' })
      };
    }
    
    try {
      this.baselineManager = new BaselineManager(this.options.outputDir);
    } catch (error) {
      console.warn('BaselineManager module not available');
      this.baselineManager = null;
    }
    
    try {
      this.debugCapture = new DebugCapture();
    } catch (error) {
      console.warn('DebugCapture module not available');
      this.debugCapture = null;
    }
  }

  async capture(pageNameOrUrl, options = {}) {
    return this.withRetry(async () => {
      const timestamp = new Date().toISOString().replace(/[:]/g, '-').split('.')[0];
      const outputDir = path.join(this.options.outputDir, options.outputDir || `capture-${timestamp}`);
      
      await fs.mkdir(outputDir, { recursive: true });

      console.log('🚀 Launching browser...');
      
      // Use browser detector for cross-platform support
      const browserPath = getBrowserPath();
      const browserOptions = getBrowserOptions(browserPath);
      const finalOptions = { ...browserOptions, ...this.options.puppeteerOptions };
      
      const browser = await puppeteerExtra.launch(finalOptions);
      const results = [];
      
      try {
        const url = pageNameOrUrl.startsWith('http') ? pageNameOrUrl : `${this.options.baseUrl}${pageNameOrUrl}`;
        this.emit('capture:start', pageNameOrUrl);

        for (const viewport of this.options.viewports) {
          const page = await browser.newPage();
          
          // Set longer timeouts
          page.setDefaultTimeout(this.options.navigationTimeout);
          page.setDefaultNavigationTimeout(this.options.navigationTimeout);
          
          // Add extra headers for better compatibility
          await page.setExtraHTTPHeaders({
            'Accept-Language': 'en-US,en;q=0.9'
          });
          
          await page.setViewport(viewport);

          if (options.console) {
            this.debugCapture.attachConsoleListener(page);
          }

          if (options.network) {
            this.debugCapture.attachNetworkListener(page);
          }

          if (options.timeline) {
            await this.captureTimeline(page, url, outputDir, viewport);
          } else {
            await page.goto(url, { 
              waitUntil: ['domcontentloaded', 'networkidle2'], 
              timeout: this.options.navigationTimeout 
            });
            
            if (options.waitFor) {
              await page.waitForSelector(options.waitFor, { timeout: 10000 });
            }

            await new Promise(resolve => setTimeout(resolve, 2000));

            const screenshotPath = path.join(outputDir, `${viewport.name}-${options.fullPage ? 'full' : 'viewport'}.png`);
            await page.screenshot({
              path: screenshotPath,
              fullPage: options.fullPage || false
            });

            results.push({
              viewport: viewport.name,
              path: screenshotPath,
              url: url
            });

            // AI Analysis if enabled
            if (this.options.aiEnabled && options.analyze) {
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

            // Capture components if requested
            if (options.components) {
              await this.captureComponents(page, outputDir, viewport.name);
            }
          }

          await page.close();
        }

        this.emit('capture:complete', pageNameOrUrl, results);
        return results;

      } finally {
        if (browser) {
          await browser.close();
        }
      }
    });
  }

  async withRetry(operation, retries = this.options.retries) {
    let lastError;
    
    for (let i = 0; i <= retries; i++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        console.warn(`Attempt ${i + 1}/${retries + 1} failed: ${error.message}`);
        
        if (i < retries) {
          const backoffTime = Math.min(1000 * Math.pow(2, i), 10000); // Exponential backoff with max 10s
          console.log(`Waiting ${backoffTime}ms before retry...`);
          await this.sleep(backoffTime);
        }
      }
    }
    
    throw new Error(`Operation failed after ${retries + 1} attempts. Last error: ${lastError.message}`);
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async captureTimeline(page, url, outputDir, viewport) {
    const timelineDir = path.join(outputDir, `${viewport.name}-timeline`);
    await fs.mkdir(timelineDir, { recursive: true });

    const intervals = [0, 500, 1000, 2000, 3000, 5000];
    const timelineResults = [];

    await page.goto(url, { waitUntil: 'domcontentloaded' });

    for (const interval of intervals) {
      await new Promise(resolve => setTimeout(resolve, interval));
      const screenshotPath = path.join(timelineDir, `${interval}ms.png`);
      await page.screenshot({ path: screenshotPath, fullPage: false });
      
      timelineResults.push({
        time: interval,
        path: screenshotPath
      });
    }

    // Generate timeline analysis
    if (this.options.aiEnabled) {
      const analysis = await this.ai.analyzeTimeline(timelineResults);
      await fs.writeFile(
        path.join(timelineDir, 'timeline-analysis.json'),
        JSON.stringify(analysis, null, 2)
      );
    }

    return timelineResults;
  }

  async captureComponents(page, outputDir, viewportName) {
    const components = await page.evaluate(() => {
      const selectors = [
        { name: 'header', selector: 'header, nav, .header' },
        { name: 'hero', selector: '.hero, .jumbotron, .banner' },
        { name: 'cards', selector: '.card, .product-card' },
        { name: 'footer', selector: 'footer, .footer' }
      ];

      return selectors.map(({ name, selector }) => {
        const element = document.querySelector(selector);
        if (element) {
          const rect = element.getBoundingClientRect();
          return {
            name,
            selector,
            bounds: {
              x: rect.x,
              y: rect.y,
              width: rect.width,
              height: rect.height
            }
          };
        }
        return null;
      }).filter(Boolean);
    });

    for (const component of components) {
      const screenshotPath = path.join(outputDir, `${viewportName}-${component.name}.png`);
      await page.screenshot({
        path: screenshotPath,
        clip: component.bounds
      });
    }
  }

  async compare(beforeDir, afterDir, options = {}) {
    const threshold = options.threshold || 0.1;
    const outputDir = options.output || path.join(this.options.outputDir, 'comparison-results');
    
    await fs.mkdir(outputDir, { recursive: true });

    const beforeFiles = await fs.readdir(beforeDir);
    const afterFiles = await fs.readdir(afterDir);
    
    const results = {
      passed: true,
      totalImages: 0,
      differences: [],
      report: []
    };

    for (const file of beforeFiles) {
      if (!file.endsWith('.png')) continue;
      if (!afterFiles.includes(file)) continue;

      results.totalImages++;

      const beforePath = path.join(beforeDir, file);
      const afterPath = path.join(afterDir, file);
      const diffPath = path.join(outputDir, `diff-${file}`);

      const comparison = await this.compareImages(beforePath, afterPath, diffPath, threshold);
      
      if (comparison.difference > threshold) {
        results.passed = false;
        results.differences.push({
          file,
          difference: comparison.difference,
          diffPath
        });

        // AI Analysis of differences
        if (this.options.aiEnabled && options.aiAnalysis) {
          const aiAnalysis = await this.ai.analyzeDifference(beforePath, afterPath, diffPath);
          comparison.aiAnalysis = aiAnalysis;
          
          if (options.suggestFixes) {
            comparison.suggestedFixes = await this.ai.suggestCSSFixes(aiAnalysis);
          }
        }
      }

      results.report.push({
        file,
        ...comparison
      });
    }

    if (options.generateReport) {
      await this.generateHTMLReport(results, outputDir);
    }

    this.emit('compare:complete', results);
    return results;
  }

  async compareImages(beforePath, afterPath, diffPath, threshold) {
    try {
      // Read images
      const img1 = PNG.sync.read(await fs.readFile(beforePath));
      const img2 = PNG.sync.read(await fs.readFile(afterPath));

      // Ensure images have same dimensions
      if (img1.width !== img2.width || img1.height !== img2.height) {
        return {
          difference: 1,
          dimensions: { width: img1.width - img2.width, height: img1.height - img2.height },
          analysisTime: 0,
          passed: false,
          error: 'Image dimensions do not match'
        };
      }

      // Create diff image
      const diff = new PNG({ width: img1.width, height: img1.height });

      // Compare pixels
      const numDiffPixels = pixelmatch(
        img1.data,
        img2.data,
        diff.data,
        img1.width,
        img1.height,
        { threshold: 0.1 }
      );

      // Calculate difference percentage
      const totalPixels = img1.width * img1.height;
      const difference = numDiffPixels / totalPixels;

      // Save diff image
      await fs.writeFile(diffPath, PNG.sync.write(diff));

      return {
        difference,
        dimensions: { width: 0, height: 0 },
        analysisTime: Date.now(),
        passed: difference <= threshold
      };
    } catch (error) {
      console.error('Error comparing images:', error);
      return {
        difference: 1,
        dimensions: { width: 0, height: 0 },
        analysisTime: 0,
        passed: false,
        error: error.message
      };
    }
  }

  async generateHTMLReport(results, outputDir) {
    const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Visual Regression Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    .summary { background: #f0f0f0; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
    .passed { color: green; }
    .failed { color: red; }
    .comparison { margin-bottom: 30px; border: 1px solid #ddd; padding: 20px; border-radius: 8px; }
    .images { display: flex; gap: 20px; margin-top: 20px; }
    .image-container { flex: 1; text-align: center; }
    .image-container img { max-width: 100%; border: 1px solid #ddd; }
    .ai-analysis { background: #e8f4f8; padding: 15px; margin-top: 20px; border-radius: 5px; }
    .suggested-fixes { background: #f8f4e8; padding: 15px; margin-top: 10px; border-radius: 5px; }
    pre { background: #f5f5f5; padding: 10px; overflow-x: auto; }
  </style>
</head>
<body>
  <h1>Visual Regression Report</h1>
  <div class="summary">
    <h2 class="${results.passed ? 'passed' : 'failed'}">
      ${results.passed ? '✓ All tests passed' : '✗ Visual differences detected'}
    </h2>
    <p>Total images compared: ${results.totalImages}</p>
    <p>Differences found: ${results.differences.length}</p>
  </div>
  
  ${results.report.map(item => `
    <div class="comparison">
      <h3>${item.file}</h3>
      <p>Difference: ${(item.difference * 100).toFixed(2)}% ${item.passed ? '✓' : '✗'}</p>
      
      ${item.aiAnalysis ? `
        <div class="ai-analysis">
          <h4>AI Analysis</h4>
          <p><strong>Summary:</strong> ${item.aiAnalysis.summary}</p>
          <p><strong>Issues Detected:</strong></p>
          <ul>
            ${item.aiAnalysis.issues.map(issue => `<li>${issue}</li>`).join('')}
          </ul>
        </div>
      ` : ''}
      
      ${item.suggestedFixes ? `
        <div class="suggested-fixes">
          <h4>Suggested CSS Fixes</h4>
          <pre>${item.suggestedFixes.join('\n')}</pre>
        </div>
      ` : ''}
      
      ${!item.passed ? `
        <div class="images">
          <div class="image-container">
            <h4>Before</h4>
            <img src="../before/${item.file}" alt="Before">
          </div>
          <div class="image-container">
            <h4>After</h4>
            <img src="../after/${item.file}" alt="After">
          </div>
          <div class="image-container">
            <h4>Difference</h4>
            <img src="diff-${item.file}" alt="Difference">
          </div>
        </div>
      ` : ''}
    </div>
  `).join('')}
  
  <footer>
    <p>Generated: ${new Date().toLocaleString()}</p>
  </footer>
</body>
</html>
    `;

    await fs.writeFile(path.join(outputDir, 'report.html'), html);
  }

  async batch(configs, options = {}) {
    const parallel = options.parallel || this.options.parallel;
    const maxParallel = options.maxParallel || this.options.maxParallel;

    if (parallel) {
      // Process in chunks for parallel execution
      const chunks = [];
      for (let i = 0; i < configs.length; i += maxParallel) {
        chunks.push(configs.slice(i, i + maxParallel));
      }

      const results = [];
      for (const chunk of chunks) {
        const chunkResults = await Promise.all(
          chunk.map(config => this.processConfig(config))
        );
        results.push(...chunkResults);
      }
      return results;
    } else {
      // Sequential processing
      const results = [];
      for (const config of configs) {
        results.push(await this.processConfig(config));
      }
      return results;
    }
  }

  async processConfig(config) {
    switch (config.type) {
      case 'capture':
        return this.capture(config.url, config.options);
      case 'compare':
        return this.compare(config.before, config.after, config.options);
      default:
        throw new Error(`Unknown config type: ${config.type}`);
    }
  }

  createMonitor(options) {
    const Monitor = require('./monitor');
    return new Monitor(this, options);
  }

  async debug(url, options) {
    return this.debugCapture.capture(url, options);
  }
}

module.exports = VRT;