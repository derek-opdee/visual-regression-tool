const chalk = require('chalk');
const ora = require('ora');
const puppeteerExtra = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs').promises;
const path = require('path');
const DebugCapture = require('../lib/debug-capture');

puppeteerExtra.use(StealthPlugin());

async function debugCommand(url, options) {
  const spinner = ora('Starting debug session...').start();
  
  try {
    const debugCapture = new DebugCapture();
    const outputDir = path.join('debug-output', new Date().toISOString().replace(/[:]/g, '-'));
    await fs.mkdir(outputDir, { recursive: true });

    spinner.text = 'Launching browser...';
    
    const browser = await puppeteerExtra.launch({
      headless: options.slowmo ? false : 'new',
      slowMo: parseInt(options.slowmo) || 0,
      devtools: options.elementInspector,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });

    // Attach listeners
    if (options.console) {
      spinner.text = 'Attaching console listener...';
      debugCapture.attachConsoleListener(page);
    }

    if (options.network) {
      spinner.text = 'Attaching network listener...';
      debugCapture.attachNetworkListener(page);
    }

    spinner.text = 'Navigating to page...';
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    // Capture performance metrics
    if (options.performance) {
      spinner.text = 'Capturing performance metrics...';
      await debugCapture.capturePerformanceMetrics(page);
    }

    // Capture visual timeline
    if (options.timeline) {
      spinner.text = 'Capturing visual timeline...';
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      await debugCapture.captureTimeline(page);
    }

    // Run accessibility checks
    if (options.accessibility) {
      spinner.text = 'Running accessibility checks...';
      const a11yResults = await debugCapture.runAccessibilityCheck(page);
      
      if (a11yResults) {
        await fs.writeFile(
          path.join(outputDir, 'accessibility-report.json'),
          JSON.stringify(a11yResults, null, 2)
        );
      }
    }

    // Element inspector mode
    if (options.elementInspector) {
      console.log(chalk.yellow('\n🔍 Element Inspector Mode'));
      console.log('Click on any element in the browser to inspect it.');
      console.log('Press Ctrl+C to exit.\n');

      await page.evaluate(() => {
        document.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          console.log('Element clicked:', e.target);
        }, true);
      });

      // Keep browser open for inspection
      await new Promise(() => {});
    }

    // Generate debug report
    spinner.text = 'Generating debug report...';
    const report = await debugCapture.generateDebugReport(outputDir);

    await browser.close();
    spinner.succeed('Debug analysis complete!');

    // Display summary
    console.log(chalk.cyan('\n🐛 Debug Report Summary\n'));
    
    if (report.summary.consoleErrors > 0) {
      console.log(chalk.red(`❌ Console Errors: ${report.summary.consoleErrors}`));
      report.summary.issues
        .filter(i => i.type === 'error')
        .slice(0, 3)
        .forEach(issue => {
          console.log(`   • ${issue.message}`);
        });
    } else {
      console.log(chalk.green('✅ No console errors'));
    }

    if (report.summary.consoleWarnings > 0) {
      console.log(chalk.yellow(`⚠️  Console Warnings: ${report.summary.consoleWarnings}`));
    }

    if (report.summary.failedRequests > 0) {
      console.log(chalk.red(`❌ Failed Network Requests: ${report.summary.failedRequests}`));
      report.summary.issues
        .filter(i => i.type === 'network')
        .slice(0, 3)
        .forEach(issue => {
          console.log(`   • ${issue.message}`);
        });
    } else {
      console.log(chalk.green('✅ All network requests successful'));
    }

    if (report.summary.slowRequests > 0) {
      console.log(chalk.yellow(`🐌 Slow Requests (>1s): ${report.summary.slowRequests}`));
    }

    if (report.summary.performanceScore !== null) {
      const score = report.summary.performanceScore;
      const color = score >= 90 ? 'green' : score >= 70 ? 'yellow' : 'red';
      console.log(chalk[color](`⚡ Performance Score: ${score}/100`));
    }

    // Accessibility summary
    if (options.accessibility && report.accessibility) {
      const a11y = report.accessibility;
      console.log(chalk.cyan('\n♿ Accessibility Summary:'));
      if (a11y.summary.criticalViolations > 0) {
        console.log(chalk.red(`   Critical violations: ${a11y.summary.criticalViolations}`));
      }
      if (a11y.summary.seriousViolations > 0) {
        console.log(chalk.red(`   Serious violations: ${a11y.summary.seriousViolations}`));
      }
      console.log(`   Total violations: ${a11y.summary.totalViolations}`);
    }

    console.log(chalk.green(`\n📁 Full debug report: ${outputDir}/debug-report.html`));
    console.log(chalk.gray(`📁 Console logs: ${outputDir}/console-logs.txt`));
    
    if (options.timeline) {
      console.log(chalk.gray(`📁 Visual timeline: ${outputDir}/timeline/`));
    }

  } catch (error) {
    spinner.fail('Debug session failed');
    console.error(chalk.red('\nError:'), error.message);
    process.exit(1);
  }
}

module.exports = debugCommand;