const fs = require('fs').promises;
const path = require('path');
const { AxePuppeteer } = require('@axe-core/puppeteer');

class DebugCapture {
  constructor() {
    this.consoleLogs = [];
    this.networkRequests = [];
    this.performanceMetrics = {};
    this.timeline = [];
  }

  attachConsoleListener(page) {
    this.consoleLogs = [];
    
    page.on('console', msg => {
      this.consoleLogs.push({
        type: msg.type(),
        text: msg.text(),
        timestamp: new Date().toISOString(),
        location: msg.location(),
        args: msg.args().map(arg => arg.toString())
      });
    });

    page.on('pageerror', error => {
      this.consoleLogs.push({
        type: 'error',
        text: error.toString(),
        timestamp: new Date().toISOString(),
        stack: error.stack
      });
    });
  }

  attachNetworkListener(page) {
    this.networkRequests = [];

    page.on('request', request => {
      this.networkRequests.push({
        type: 'request',
        url: request.url(),
        method: request.method(),
        timestamp: new Date().toISOString(),
        resourceType: request.resourceType()
      });
    });

    page.on('response', response => {
      const request = this.networkRequests.find(r => r.url === response.url());
      if (request) {
        request.response = {
          status: response.status(),
          statusText: response.statusText(),
          headers: response.headers(),
          timestamp: new Date().toISOString()
        };
        
        // Calculate load time
        request.loadTime = new Date(request.response.timestamp) - new Date(request.timestamp);
      }
    });

    page.on('requestfailed', request => {
      const req = this.networkRequests.find(r => r.url === request.url());
      if (req) {
        req.failed = true;
        req.failure = request.failure();
      }
    });
  }

  async capturePerformanceMetrics(page) {
    // Get performance metrics
    const metrics = await page.metrics();
    const performanceTiming = await page.evaluate(() => {
      const timing = performance.timing;
      return {
        domContentLoaded: timing.domContentLoadedEventEnd - timing.navigationStart,
        loadComplete: timing.loadEventEnd - timing.navigationStart,
        firstPaint: performance.getEntriesByType('paint')[0]?.startTime || 0,
        firstContentfulPaint: performance.getEntriesByType('paint')[1]?.startTime || 0
      };
    });

    // Get resource timing
    const resourceTimings = await page.evaluate(() => {
      return performance.getEntriesByType('resource').map(resource => ({
        name: resource.name,
        type: resource.initiatorType,
        duration: resource.duration,
        size: resource.transferSize,
        startTime: resource.startTime
      }));
    });

    this.performanceMetrics = {
      metrics,
      timing: performanceTiming,
      resources: resourceTimings,
      timestamp: new Date().toISOString()
    };

    return this.performanceMetrics;
  }

  async captureTimeline(page, intervals = [0, 100, 250, 500, 1000, 2000, 3000, 5000]) {
    this.timeline = [];
    const startTime = Date.now();

    for (const interval of intervals) {
      await new Promise(resolve => setTimeout(resolve, interval - (Date.now() - startTime)));
      
      const screenshot = await page.screenshot({ encoding: 'base64', fullPage: false });
      const metrics = await page.metrics();
      
      this.timeline.push({
        time: interval,
        screenshot,
        metrics,
        actualTime: Date.now() - startTime,
        consoleLogs: this.consoleLogs.filter(log => 
          new Date(log.timestamp) >= new Date(startTime + (interval - 100))
        )
      });
    }

    return this.timeline;
  }

  async runAccessibilityCheck(page) {
    try {
      // Wait for page to be fully loaded
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const results = await new AxePuppeteer(page)
        .withTags(['wcag2a', 'wcag2aa'])
        .options({ timeout: 30000 })
        .analyze();
      
      return {
        violations: results.violations,
        passes: results.passes.length,
        incomplete: results.incomplete,
        inapplicable: results.inapplicable.length,
        summary: {
          totalViolations: results.violations.length,
          criticalViolations: results.violations.filter(v => v.impact === 'critical').length,
          seriousViolations: results.violations.filter(v => v.impact === 'serious').length,
          moderateViolations: results.violations.filter(v => v.impact === 'moderate').length,
          minorViolations: results.violations.filter(v => v.impact === 'minor').length
        }
      };
    } catch (error) {
      console.warn('Accessibility check failed:', error.message);
      return {
        error: error.message,
        violations: [],
        passes: 0,
        incomplete: [],
        inapplicable: 0,
        summary: {
          totalViolations: 0,
          criticalViolations: 0,
          seriousViolations: 0,
          moderateViolations: 0,
          minorViolations: 0
        }
      };
    }
  }

  async capture(url, options = {}) {
    const outputDir = path.join('debug-output', new Date().toISOString().replace(/[:]/g, '-'));
    await fs.mkdir(outputDir, { recursive: true });

    const puppeteer = require('puppeteer');
    const { getBrowserPath, getBrowserOptions } = require('./browser-detector');
    
    const browserPath = getBrowserPath();
    const browserOptions = getBrowserOptions(browserPath);
    const browser = await puppeteer.launch({
      ...browserOptions,
      timeout: 60000,
      protocolTimeout: 60000
    });

    try {
      const page = await browser.newPage();
      page.setDefaultTimeout(30000);
      page.setDefaultNavigationTimeout(30000);
      
      // Add extra headers for better compatibility
      await page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9'
      });
      
      await page.setViewport({ width: 1440, height: 900 });

      // Attach listeners
      if (options.console) {
        this.attachConsoleListener(page);
      }

      if (options.network) {
        this.attachNetworkListener(page);
      }

      await page.goto(url, { 
        waitUntil: ['domcontentloaded', 'networkidle2'], 
        timeout: 30000 
      });

      // Capture performance metrics
      if (options.performance) {
        await this.capturePerformanceMetrics(page);
      }

      // Capture visual timeline
      if (options.timeline) {
        await this.captureTimeline(page);
      }

      // Run accessibility checks
      if (options.accessibility) {
        const a11yResults = await this.runAccessibilityCheck(page);
        await fs.writeFile(
          path.join(outputDir, 'accessibility-report.json'),
          JSON.stringify(a11yResults, null, 2)
        );
      }

      // Generate debug report
      const report = await this.generateDebugReport(outputDir);
      
      return {
        outputDir,
        report,
        summary: report.summary
      };

    } finally {
      await browser.close();
    }
  }

  async captureElementInspection(page, selector) {
    const element = await page.$(selector);
    if (!element) {
      throw new Error(`Element not found: ${selector}`);
    }

    const elementInfo = await page.evaluate(el => {
      const rect = el.getBoundingClientRect();
      const styles = window.getComputedStyle(el);
      
      return {
        tagName: el.tagName,
        className: el.className,
        id: el.id,
        bounds: {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height
        },
        computedStyles: {
          display: styles.display,
          position: styles.position,
          color: styles.color,
          backgroundColor: styles.backgroundColor,
          fontSize: styles.fontSize,
          fontFamily: styles.fontFamily,
          padding: styles.padding,
          margin: styles.margin,
          border: styles.border,
          boxShadow: styles.boxShadow,
          opacity: styles.opacity,
          zIndex: styles.zIndex
        },
        attributes: Array.from(el.attributes).reduce((acc, attr) => {
          acc[attr.name] = attr.value;
          return acc;
        }, {})
      };
    }, element);

    // Capture element screenshot
    const screenshot = await element.screenshot({ encoding: 'base64' });
    elementInfo.screenshot = screenshot;

    return elementInfo;
  }

  async generateDebugReport(outputDir) {
    const report = {
      timestamp: new Date().toISOString(),
      consoleLogs: this.consoleLogs,
      networkRequests: this.networkRequests,
      performanceMetrics: this.performanceMetrics,
      timeline: this.timeline.map(t => ({
        ...t,
        screenshot: undefined // Remove base64 data from JSON
      })),
      summary: this.generateSummary()
    };

    // Save report
    await fs.writeFile(
      path.join(outputDir, 'debug-report.json'),
      JSON.stringify(report, null, 2)
    );

    // Save console logs separately
    if (this.consoleLogs.length > 0) {
      const consoleOutput = this.consoleLogs
        .map(log => `[${log.timestamp}] ${log.type.toUpperCase()}: ${log.text}`)
        .join('\n');
      
      await fs.writeFile(
        path.join(outputDir, 'console-logs.txt'),
        consoleOutput
      );
    }

    // Save timeline screenshots
    if (this.timeline.length > 0) {
      const timelineDir = path.join(outputDir, 'timeline');
      await fs.mkdir(timelineDir, { recursive: true });

      for (const frame of this.timeline) {
        await fs.writeFile(
          path.join(timelineDir, `${frame.time}ms.png`),
          frame.screenshot,
          'base64'
        );
      }
    }

    // Generate HTML report
    await this.generateHTMLReport(outputDir, report);

    return report;
  }

  generateSummary() {
    const errors = this.consoleLogs.filter(log => log.type === 'error');
    const warnings = this.consoleLogs.filter(log => log.type === 'warning');
    const failedRequests = this.networkRequests.filter(req => req.failed);
    const slowRequests = this.networkRequests.filter(req => req.loadTime > 1000);

    return {
      consoleErrors: errors.length,
      consoleWarnings: warnings.length,
      totalRequests: this.networkRequests.length,
      failedRequests: failedRequests.length,
      slowRequests: slowRequests.length,
      performanceScore: this.calculatePerformanceScore(),
      issues: [
        ...errors.map(e => ({ type: 'error', message: e.text })),
        ...failedRequests.map(r => ({ type: 'network', message: `Failed to load: ${r.url}` })),
        ...slowRequests.map(r => ({ type: 'performance', message: `Slow resource: ${r.url} (${r.loadTime}ms)` }))
      ]
    };
  }

  calculatePerformanceScore() {
    if (!this.performanceMetrics.timing) return null;

    const { domContentLoaded, loadComplete, firstContentfulPaint } = this.performanceMetrics.timing;
    
    // Simple scoring based on load times
    let score = 100;
    
    if (firstContentfulPaint > 2500) score -= 20;
    else if (firstContentfulPaint > 1500) score -= 10;
    
    if (domContentLoaded > 3000) score -= 20;
    else if (domContentLoaded > 2000) score -= 10;
    
    if (loadComplete > 5000) score -= 20;
    else if (loadComplete > 3000) score -= 10;

    return Math.max(0, score);
  }

  async generateHTMLReport(outputDir, report) {
    const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Debug Report - ${new Date(report.timestamp).toLocaleString()}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
    .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
    .metric { background: #f8f9fa; padding: 15px; border-radius: 8px; text-align: center; }
    .metric h3 { margin: 0 0 10px 0; color: #495057; font-size: 14px; }
    .metric .value { font-size: 32px; font-weight: bold; color: #212529; }
    .error { color: #dc3545; }
    .warning { color: #ffc107; }
    .success { color: #28a745; }
    .section { margin-bottom: 30px; }
    .section h2 { color: #212529; border-bottom: 2px solid #e9ecef; padding-bottom: 10px; }
    .log-entry { padding: 8px; margin: 5px 0; border-radius: 4px; font-family: monospace; font-size: 12px; }
    .log-error { background: #f8d7da; color: #721c24; }
    .log-warning { background: #fff3cd; color: #856404; }
    .network-table { width: 100%; border-collapse: collapse; }
    .network-table th, .network-table td { padding: 8px; text-align: left; border-bottom: 1px solid #dee2e6; }
    .network-table th { background: #e9ecef; font-weight: bold; }
    .failed { background: #f8d7da; }
    .slow { background: #fff3cd; }
    .timeline { display: flex; overflow-x: auto; gap: 10px; padding: 10px; background: #f8f9fa; border-radius: 8px; }
    .timeline-item { flex: 0 0 200px; text-align: center; }
    .timeline-item img { width: 100%; border: 1px solid #dee2e6; border-radius: 4px; }
    .timeline-item .time { font-weight: bold; margin-top: 5px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Debug Report</h1>
    <p>Generated: ${new Date(report.timestamp).toLocaleString()}</p>
    
    <div class="summary">
      <div class="metric">
        <h3>Console Errors</h3>
        <div class="value ${report.summary.consoleErrors > 0 ? 'error' : 'success'}">${report.summary.consoleErrors}</div>
      </div>
      <div class="metric">
        <h3>Console Warnings</h3>
        <div class="value ${report.summary.consoleWarnings > 0 ? 'warning' : 'success'}">${report.summary.consoleWarnings}</div>
      </div>
      <div class="metric">
        <h3>Failed Requests</h3>
        <div class="value ${report.summary.failedRequests > 0 ? 'error' : 'success'}">${report.summary.failedRequests}</div>
      </div>
      <div class="metric">
        <h3>Performance Score</h3>
        <div class="value ${report.summary.performanceScore < 70 ? 'error' : report.summary.performanceScore < 90 ? 'warning' : 'success'}">${report.summary.performanceScore || 'N/A'}</div>
      </div>
    </div>

    <div class="section">
      <h2>Console Logs</h2>
      ${report.consoleLogs.length === 0 ? '<p>No console logs captured</p>' : 
        report.consoleLogs.map(log => `
          <div class="log-entry log-${log.type}">
            [${new Date(log.timestamp).toLocaleTimeString()}] ${log.type.toUpperCase()}: ${log.text}
          </div>
        `).join('')
      }
    </div>

    <div class="section">
      <h2>Network Requests</h2>
      <table class="network-table">
        <thead>
          <tr>
            <th>URL</th>
            <th>Method</th>
            <th>Status</th>
            <th>Time (ms)</th>
            <th>Type</th>
          </tr>
        </thead>
        <tbody>
          ${report.networkRequests.map(req => `
            <tr class="${req.failed ? 'failed' : req.loadTime > 1000 ? 'slow' : ''}">
              <td>${req.url.length > 50 ? '...' + req.url.slice(-50) : req.url}</td>
              <td>${req.method}</td>
              <td>${req.response?.status || (req.failed ? 'Failed' : 'Pending')}</td>
              <td>${req.loadTime || '-'}</td>
              <td>${req.resourceType}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    ${report.timeline.length > 0 ? `
      <div class="section">
        <h2>Visual Timeline</h2>
        <div class="timeline">
          ${report.timeline.map(frame => `
            <div class="timeline-item">
              <img src="timeline/${frame.time}ms.png" alt="${frame.time}ms">
              <div class="time">${frame.time}ms</div>
            </div>
          `).join('')}
        </div>
      </div>
    ` : ''}

    <div class="section">
      <h2>Performance Metrics</h2>
      ${report.performanceMetrics.timing ? `
        <ul>
          <li>First Paint: ${report.performanceMetrics.timing.firstPaint.toFixed(2)}ms</li>
          <li>First Contentful Paint: ${report.performanceMetrics.timing.firstContentfulPaint.toFixed(2)}ms</li>
          <li>DOM Content Loaded: ${report.performanceMetrics.timing.domContentLoaded}ms</li>
          <li>Page Load Complete: ${report.performanceMetrics.timing.loadComplete}ms</li>
        </ul>
      ` : '<p>No performance metrics captured</p>'}
    </div>
  </div>
</body>
</html>
    `;

    await fs.writeFile(path.join(outputDir, 'debug-report.html'), html);
  }
}

module.exports = DebugCapture;