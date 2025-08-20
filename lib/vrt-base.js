const EventEmitter = require('events');
const fs = require('fs').promises;
const path = require('path');
const { PNG } = require('pngjs');
const pixelmatch = require('pixelmatch').default || require('pixelmatch');

/**
 * Base class for Visual Regression Testing
 * Provides shared functionality for both Puppeteer and Playwright implementations
 */
class VRTBase extends EventEmitter {
  constructor(options = {}) {
    super();
    
    // Default options shared by all implementations
    this.options = {
      baseUrl: options.baseUrl || 'http://localhost:8000',
      outputDir: options.outputDir || './screenshots',
      viewports: options.viewports || [
        { name: 'mobile', width: 375, height: 812, deviceScaleFactor: 2 },
        { name: 'tablet', width: 768, height: 1024, deviceScaleFactor: 2 },
        { name: 'desktop', width: 1440, height: 900, deviceScaleFactor: 1 },
        { name: 'desktop-xl', width: 1920, height: 1080, deviceScaleFactor: 1 }
      ],
      aiEnabled: options.aiEnabled !== false,
      parallel: options.parallel || false,
      maxParallel: options.maxParallel || 4,
      retries: options.retries || 3,
      timeout: options.timeout || 30000,
      navigationTimeout: options.navigationTimeout || 30000,
      maxConcurrentBrowsers: options.maxConcurrentBrowsers || 3,
      memoryThreshold: options.memoryThreshold || 1024 * 1024 * 1024, // 1GB
      ...options
    };

    // Initialize AI module with safe fallback
    this.initializeAIModule();
    
    // Initialize BaselineManager with safe fallback
    this.initializeBaselineManager();
    
    // Resource tracking
    this.activeBrowsers = new Set();
    this.currentBrowserCount = 0;
  }

  initializeAIModule() {
    try {
      const AIAnalyzer = require('./ai-analyzer');
      this.ai = new AIAnalyzer();
    } catch (error) {
      console.warn('AI module not available, continuing without AI features');
      // Provide a no-op AI analyzer
      this.ai = {
        analyzeScreenshot: async () => ({ summary: 'AI analysis disabled' }),
        analyzeDifference: async () => ({ summary: 'AI analysis disabled' }),
        suggestCSSFixes: async () => ([]),
        analyzeTimeline: async () => ({ summary: 'AI analysis disabled' })
      };
    }
  }

  initializeBaselineManager() {
    try {
      const BaselineManager = require('./baseline-manager');
      this.baselineManager = new BaselineManager(this.options.outputDir);
    } catch (error) {
      console.warn('BaselineManager module not available');
      this.baselineManager = null;
    }
  }

  /**
   * Sanitize file path components to prevent path traversal
   */
  sanitizePathComponent(component) {
    if (!component) return 'default';
    return component.toString().replace(/[^a-zA-Z0-9\-_]/g, '');
  }

  /**
   * Check memory usage and cleanup if necessary
   */
  async checkMemoryUsage() {
    const memUsage = process.memoryUsage();
    if (memUsage.heapUsed > this.options.memoryThreshold) {
      console.warn(`Memory usage high: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`);
      // Force cleanup of oldest browser if we have multiple
      if (this.activeBrowsers.size > 1) {
        const oldestBrowser = this.activeBrowsers.values().next().value;
        await this.cleanupBrowser(oldestBrowser);
      }
    }
  }

  /**
   * Wait for a browser slot to become available
   */
  async waitForBrowserSlot() {
    while (this.currentBrowserCount >= this.options.maxConcurrentBrowsers) {
      console.log(`Waiting for browser slot (${this.currentBrowserCount}/${this.options.maxConcurrentBrowsers} in use)...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  /**
   * Retry operation with exponential backoff
   */
  async withRetry(operation, retries = this.options.retries) {
    let lastError;
    
    for (let i = 0; i <= retries; i++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        console.warn(`Attempt ${i + 1}/${retries + 1} failed: ${error.message}`);
        
        if (i < retries) {
          const backoffTime = Math.min(1000 * Math.pow(2, i), 5000); // Max 5s delay
          console.log(`Waiting ${backoffTime}ms before retry...`);
          await this.sleep(backoffTime);
        }
      }
    }
    
    throw new Error(`Operation failed after ${retries + 1} attempts. Last error: ${lastError.message}`);
  }

  /**
   * Sleep helper
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Compare two images and generate diff
   */
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

  /**
   * Compare directories of screenshots
   */
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

  /**
   * Generate HTML report for comparison results
   */
  async generateHTMLReport(results, outputDir) {
    const reportGenerator = require('./report-generator');
    const html = reportGenerator.generateReport(results, this.getEngineType());
    await fs.writeFile(path.join(outputDir, 'report.html'), html);
  }

  /**
   * Batch process multiple configurations
   */
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

  /**
   * Process a single configuration
   */
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

  /**
   * Get the engine type (to be overridden by implementations)
   */
  getEngineType() {
    return 'base';
  }

  /**
   * Abstract methods to be implemented by subclasses
   */
  async capture(pageNameOrUrl, options = {}) {
    throw new Error('capture() must be implemented by subclass');
  }

  async cleanupBrowser(browser) {
    throw new Error('cleanupBrowser() must be implemented by subclass');
  }

  async cleanup() {
    throw new Error('cleanup() must be implemented by subclass');
  }
}

module.exports = VRTBase;