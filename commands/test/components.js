const chalk = require('chalk');
const ora = require('ora');
const fs = require('fs').promises;
const path = require('path');
const VRT = require('../../lib/vrt');

async function componentsCommand(url, options) {
  const spinner = ora('Testing UI components in isolation...').start();
  
  try {
    const vrt = new VRT({ aiEnabled: true });
    
    // Load component test configuration
    let componentConfig = {
      components: [
        { name: 'header', selector: 'header, nav, .header', states: ['default', 'scrolled', 'mobile-open'] },
        { name: 'hero', selector: '.hero, .jumbotron, .banner', states: ['default'] },
        { name: 'card', selector: '.card, .product-card', states: ['default', 'hover', 'active'] },
        { name: 'button', selector: '.btn, button', states: ['default', 'hover', 'focus', 'disabled'] },
        { name: 'form', selector: 'form', states: ['default', 'filled', 'error'] },
        { name: 'footer', selector: 'footer, .footer', states: ['default'] }
      ]
    };
    
    if (options.config) {
      const configContent = await fs.readFile(options.config, 'utf8');
      componentConfig = JSON.parse(configContent);
    }
    
    spinner.text = 'Launching browser for component testing...';
    
    const puppeteer = require('puppeteer');
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const results = [];
    const outputDir = path.join('component-tests', new Date().toISOString().replace(/[:]/g, '-'));
    await fs.mkdir(outputDir, { recursive: true });
    
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(url, { waitUntil: 'networkidle2' });
    
    console.log(chalk.cyan('\n🧩 Component Testing Report\n'));
    
    for (const component of componentConfig.components) {
      spinner.text = `Testing ${component.name} component...`;
      
      const componentDir = path.join(outputDir, component.name);
      await fs.mkdir(componentDir, { recursive: true });
      
      // Check if component exists
      const exists = await page.$(component.selector);
      
      if (!exists) {
        console.log(chalk.red(`❌ ${component.name}: Component not found (${component.selector})`));
        continue;
      }
      
      console.log(chalk.yellow(`\n${component.name.toUpperCase()} Component:`));
      
      // Test each state
      for (const state of component.states) {
        try {
          // Apply state
          await applyComponentState(page, component.selector, state);
          
          // Capture screenshot
          const element = await page.$(component.selector);
          const screenshotPath = path.join(componentDir, `${state}.png`);
          await element.screenshot({ path: screenshotPath });
          
          // Analyze with AI
          const analysis = await vrt.ai.analyzeScreenshot(screenshotPath, {
            detectIssues: true,
            component: component.name,
            state: state
          });
          
          if (analysis.issues.length === 0) {
            console.log(chalk.green(`  ✅ ${state}: Passed`));
          } else {
            console.log(chalk.red(`  ❌ ${state}: ${analysis.issues.length} issues`));
            analysis.issues.slice(0, 2).forEach(issue => {
              console.log(`     - ${issue.description}`);
            });
          }
          
          results.push({
            component: component.name,
            state: state,
            passed: analysis.issues.length === 0,
            issues: analysis.issues,
            screenshot: screenshotPath
          });
          
        } catch (error) {
          console.log(chalk.red(`  ❌ ${state}: Failed to test (${error.message})`));
        }
      }
    }
    
    await browser.close();
    spinner.succeed('Component testing complete!');
    
    // Summary
    const totalTests = results.length;
    const passedTests = results.filter(r => r.passed).length;
    const failedTests = totalTests - passedTests;
    
    console.log(chalk.cyan('\n📊 Summary:\n'));
    console.log(`Total tests: ${totalTests}`);
    console.log(chalk.green(`Passed: ${passedTests}`));
    console.log(chalk.red(`Failed: ${failedTests}`));
    console.log(`Success rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
    
    // Save report
    const report = {
      timestamp: new Date().toISOString(),
      url: url,
      results: results,
      summary: {
        total: totalTests,
        passed: passedTests,
        failed: failedTests
      }
    };
    
    await fs.writeFile(
      path.join(outputDir, 'component-test-report.json'),
      JSON.stringify(report, null, 2)
    );
    
    console.log(chalk.green(`\n📁 Full report saved to: ${outputDir}`));
    
  } catch (error) {
    spinner.fail('Component testing failed');
    console.error(chalk.red('Error:'), error.message);
    process.exit(1);
  }
}

async function applyComponentState(page, selector, state) {
  switch (state) {
    case 'hover':
      await page.hover(selector);
      break;
      
    case 'focus':
      await page.focus(selector);
      break;
      
    case 'active':
      await page.click(selector, { delay: 100 });
      break;
      
    case 'disabled':
      await page.$eval(selector, el => el.disabled = true);
      break;
      
    case 'scrolled':
      await page.evaluate(() => window.scrollBy(0, 100));
      break;
      
    case 'mobile-open':
      const menuToggle = await page.$('.menu-toggle, .hamburger, .mobile-menu-toggle');
      if (menuToggle) await menuToggle.click();
      break;
      
    case 'filled':
      const inputs = await page.$$(`${selector} input, ${selector} textarea`);
      for (const input of inputs) {
        await input.type('Test content');
      }
      break;
      
    case 'error':
      await page.$eval(selector, form => {
        form.classList.add('has-error', 'error', 'invalid');
      });
      break;
      
    default:
      // Default state - no action needed
      break;
  }
  
  // Wait for any animations
  await page.waitForTimeout(300);
}

module.exports = componentsCommand;