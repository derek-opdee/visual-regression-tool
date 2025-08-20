const chalk = require('chalk');
const ora = require('ora');
const fs = require('fs').promises;
const path = require('path');
const puppeteer = require('puppeteer');

async function interactionsCommand(url, options) {
  const spinner = ora('Testing interactive elements...').start();
  
  try {
    const elementSelectors = options.elements 
      ? options.elements.split(',').map(s => s.trim())
      : ['button', 'a', '.interactive', 'input', 'select', '[role="button"]'];
    
    spinner.text = 'Launching browser for interaction testing...';
    
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const outputDir = path.join('interaction-tests', new Date().toISOString().replace(/[:]/g, '-'));
    await fs.mkdir(outputDir, { recursive: true });
    
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(url, { waitUntil: 'networkidle2' });
    
    console.log(chalk.cyan('\n🖱️  Interactive Elements Testing\n'));
    console.log(chalk.gray(`URL: ${url}`));
    console.log(chalk.gray(`Testing: ${elementSelectors.join(', ')}\n`));
    
    const results = [];
    const interactionStates = ['default', 'hover', 'focus', 'active'];
    
    for (const selector of elementSelectors) {
      spinner.text = `Testing ${selector} elements...`;
      
      const elements = await page.$$(selector);
      
      if (elements.length === 0) {
        console.log(chalk.yellow(`⚠️  No elements found for selector: ${selector}`));
        continue;
      }
      
      console.log(chalk.yellow(`\n${selector} (${elements.length} elements found):`));
      
      // Test first few elements of each type
      const elementsToTest = elements.slice(0, 3);
      
      for (let i = 0; i < elementsToTest.length; i++) {
        const element = elementsToTest[i];
        const elementResults = {};
        
        try {
          // Get element info
          const elementInfo = await page.evaluate(el => {
            const rect = el.getBoundingClientRect();
            return {
              tagName: el.tagName,
              text: el.textContent?.trim().substring(0, 30) || '',
              className: el.className,
              id: el.id,
              visible: rect.width > 0 && rect.height > 0,
              bounds: {
                x: rect.x,
                y: rect.y,
                width: rect.width,
                height: rect.height
              }
            };
          }, element);
          
          if (!elementInfo.visible) {
            console.log(chalk.gray(`  Element ${i + 1}: Hidden or zero size`));
            continue;
          }
          
          const elementId = elementInfo.id || elementInfo.className || `${elementInfo.tagName}-${i}`;
          console.log(chalk.blue(`  Element ${i + 1}: ${elementId}`));
          
          // Test each interaction state
          for (const state of interactionStates) {
            try {
              // Reset to default state
              await page.mouse.move(0, 0);
              await page.evaluate(() => document.activeElement?.blur());
              await page.waitForTimeout(100);
              
              // Capture default state first
              if (state === 'default') {
                const screenshotPath = path.join(outputDir, `${selector.replace(/[^a-z0-9]/gi, '_')}_${i}_default.png`);
                await element.screenshot({ path: screenshotPath });
                elementResults.default = { screenshot: screenshotPath, success: true };
              }
              
              // Apply interaction state
              const stateResult = await applyInteractionState(page, element, state);
              
              if (stateResult.applied) {
                const screenshotPath = path.join(outputDir, `${selector.replace(/[^a-z0-9]/gi, '_')}_${i}_${state}.png`);
                await element.screenshot({ path: screenshotPath });
                
                // Check for visual feedback
                const hasVisualFeedback = await checkVisualFeedback(page, element, state);
                
                elementResults[state] = {
                  screenshot: screenshotPath,
                  success: true,
                  hasVisualFeedback
                };
                
                if (hasVisualFeedback) {
                  console.log(chalk.green(`    ✅ ${state}: Visual feedback detected`));
                } else {
                  console.log(chalk.yellow(`    ⚠️  ${state}: No visual feedback`));
                }
              } else {
                elementResults[state] = {
                  success: false,
                  reason: stateResult.reason
                };
                console.log(chalk.gray(`    - ${state}: ${stateResult.reason}`));
              }
              
            } catch (error) {
              elementResults[state] = {
                success: false,
                error: error.message
              };
              console.log(chalk.red(`    ❌ ${state}: ${error.message}`));
            }
          }
          
          results.push({
            selector,
            element: elementInfo,
            states: elementResults
          });
          
        } catch (error) {
          console.log(chalk.red(`  Element ${i + 1}: Failed to test (${error.message})`));
        }
      }
    }
    
    await browser.close();
    spinner.succeed('Interaction testing complete!');
    
    // Analyze results
    console.log(chalk.cyan('\n📊 Interaction Analysis:\n'));
    
    const issues = [];
    
    // Check for missing hover states
    const missingHover = results.filter(r => 
      r.states.hover?.success && !r.states.hover?.hasVisualFeedback
    );
    if (missingHover.length > 0) {
      const issue = `${missingHover.length} elements missing hover feedback`;
      console.log(chalk.yellow(`⚠️  ${issue}`));
      issues.push(issue);
    }
    
    // Check for missing focus states
    const missingFocus = results.filter(r => 
      r.states.focus?.success && !r.states.focus?.hasVisualFeedback
    );
    if (missingFocus.length > 0) {
      const issue = `${missingFocus.length} elements missing focus indicators`;
      console.log(chalk.red(`❌ ${issue} (accessibility issue)`));
      issues.push(issue);
    }
    
    // Check for missing active states
    const missingActive = results.filter(r => 
      r.states.active?.success && !r.states.active?.hasVisualFeedback
    );
    if (missingActive.length > 0) {
      const issue = `${missingActive.length} elements missing active/pressed feedback`;
      console.log(chalk.yellow(`⚠️  ${issue}`));
      issues.push(issue);
    }
    
    if (issues.length === 0) {
      console.log(chalk.green('✅ All interactive elements have proper visual feedback'));
    }
    
    // Accessibility recommendations
    console.log(chalk.cyan('\n♿ Accessibility Recommendations:\n'));
    
    const recommendations = [
      'Ensure all interactive elements have visible focus indicators',
      'Use consistent hover effects across similar elements',
      'Provide clear active/pressed states for better user feedback',
      'Test keyboard navigation for all interactive elements',
      'Ensure touch targets are at least 44x44px on mobile'
    ];
    
    recommendations.forEach((rec, index) => {
      console.log(`${index + 1}. ${rec}`);
    });
    
    // Save report
    const report = {
      timestamp: new Date().toISOString(),
      url,
      selectors: elementSelectors,
      results,
      issues,
      summary: {
        totalElements: results.length,
        missingHover: missingHover.length,
        missingFocus: missingFocus.length,
        missingActive: missingActive.length
      }
    };
    
    await fs.writeFile(
      path.join(outputDir, 'interaction-test-report.json'),
      JSON.stringify(report, null, 2)
    );
    
    console.log(chalk.green(`\n📁 Full report saved to: ${outputDir}`));
    
  } catch (error) {
    spinner.fail('Interaction testing failed');
    console.error(chalk.red('Error:'), error.message);
    process.exit(1);
  }
}

async function applyInteractionState(page, element, state) {
  try {
    switch (state) {
      case 'hover':
        const box = await element.boundingBox();
        if (!box) return { applied: false, reason: 'Element not visible' };
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.waitForTimeout(200);
        return { applied: true };
        
      case 'focus':
        const canFocus = await page.evaluate(el => {
          const focusable = ['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'];
          return focusable.includes(el.tagName) || el.hasAttribute('tabindex');
        }, element);
        
        if (!canFocus) return { applied: false, reason: 'Element not focusable' };
        
        await element.focus();
        await page.waitForTimeout(200);
        return { applied: true };
        
      case 'active':
        const isClickable = await page.evaluate(el => {
          const clickable = ['A', 'BUTTON', 'INPUT'];
          return clickable.includes(el.tagName) || 
                 el.hasAttribute('onclick') || 
                 el.style.cursor === 'pointer';
        }, element);
        
        if (!isClickable) return { applied: false, reason: 'Element not clickable' };
        
        await element.click({ delay: 100 });
        await page.waitForTimeout(100);
        return { applied: true };
        
      default:
        return { applied: true };
    }
  } catch (error) {
    return { applied: false, reason: error.message };
  }
}

async function checkVisualFeedback(page, element, state) {
  return await page.evaluate((el, currentState) => {
    const styles = window.getComputedStyle(el);
    const beforeStyles = el.dataset.beforeStyles ? JSON.parse(el.dataset.beforeStyles) : null;
    
    if (!beforeStyles) {
      // Store initial styles
      el.dataset.beforeStyles = JSON.stringify({
        backgroundColor: styles.backgroundColor,
        color: styles.color,
        borderColor: styles.borderColor,
        boxShadow: styles.boxShadow,
        transform: styles.transform,
        opacity: styles.opacity,
        outline: styles.outline
      });
      return false;
    }
    
    // Check for any visual changes
    const hasChange = 
      styles.backgroundColor !== beforeStyles.backgroundColor ||
      styles.color !== beforeStyles.color ||
      styles.borderColor !== beforeStyles.borderColor ||
      styles.boxShadow !== beforeStyles.boxShadow ||
      styles.transform !== beforeStyles.transform ||
      styles.opacity !== beforeStyles.opacity ||
      (currentState === 'focus' && styles.outline !== beforeStyles.outline);
    
    return hasChange;
  }, element, state);
}

module.exports = interactionsCommand;