const chalk = require('chalk');
const ora = require('ora');
const fs = require('fs').promises;
const path = require('path');
const puppeteer = require('puppeteer');
const { AxePuppeteer } = require('@axe-core/puppeteer');

async function accessibilityCommand(url, options) {
  const spinner = ora('Running accessibility tests...').start();
  
  try {
    const standard = options.standard || 'WCAG2AA';
    const standardTags = {
      'WCAG2A': ['wcag2a', 'wcag21a'],
      'WCAG2AA': ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'],
      'WCAG2AAA': ['wcag2a', 'wcag2aa', 'wcag2aaa', 'wcag21a', 'wcag21aa', 'wcag21aaa']
    };
    
    spinner.text = 'Launching browser for accessibility testing...';
    
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const outputDir = path.join('accessibility-tests', new Date().toISOString().replace(/[:]/g, '-'));
    await fs.mkdir(outputDir, { recursive: true });
    
    // Test across different viewports
    const viewports = [
      { name: 'desktop', width: 1440, height: 900 },
      { name: 'tablet', width: 768, height: 1024 },
      { name: 'mobile', width: 375, height: 812 }
    ];
    
    console.log(chalk.cyan('\n♿ Accessibility Testing Report\n'));
    console.log(chalk.gray(`URL: ${url}`));
    console.log(chalk.gray(`Standard: ${standard}`));
    console.log(chalk.gray(`Date: ${new Date().toLocaleString()}\n`));
    
    const allResults = [];
    
    for (const viewport of viewports) {
      spinner.text = `Testing ${viewport.name} viewport...`;
      
      const page = await browser.newPage();
      await page.setViewport(viewport);
      await page.goto(url, { waitUntil: 'networkidle2' });
      
      // Run axe accessibility tests
      const results = await new AxePuppeteer(page)
        .withTags(standardTags[standard])
        .analyze();
      
      // Capture screenshot with violations highlighted
      const screenshotPath = path.join(outputDir, `${viewport.name}-accessibility.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });
      
      // Highlight violations on the page
      if (results.violations.length > 0) {
        await highlightViolations(page, results.violations);
        const highlightedPath = path.join(outputDir, `${viewport.name}-violations-highlighted.png`);
        await page.screenshot({ path: highlightedPath, fullPage: true });
      }
      
      console.log(chalk.yellow(`\n${viewport.name.toUpperCase()}:`));
      
      // Summary
      const summary = {
        violations: results.violations.length,
        passes: results.passes.length,
        incomplete: results.incomplete.length,
        inapplicable: results.inapplicable.length
      };
      
      if (summary.violations === 0) {
        console.log(chalk.green('  ✅ No accessibility violations found!'));
      } else {
        console.log(chalk.red(`  ❌ ${summary.violations} violations found`));
      }
      
      console.log(chalk.gray(`  ✓ ${summary.passes} rules passed`));
      console.log(chalk.gray(`  ? ${summary.incomplete} rules need review`));
      
      // Show violations grouped by impact
      if (results.violations.length > 0) {
        const violationsByImpact = {
          critical: results.violations.filter(v => v.impact === 'critical'),
          serious: results.violations.filter(v => v.impact === 'serious'),
          moderate: results.violations.filter(v => v.impact === 'moderate'),
          minor: results.violations.filter(v => v.impact === 'minor')
        };
        
        console.log(chalk.red('\n  Violations by Impact:'));
        
        ['critical', 'serious', 'moderate', 'minor'].forEach(impact => {
          if (violationsByImpact[impact].length > 0) {
            const color = impact === 'critical' || impact === 'serious' ? 'red' : 'yellow';
            console.log(chalk[color](`    ${impact.toUpperCase()}: ${violationsByImpact[impact].length}`));
            
            violationsByImpact[impact].slice(0, 3).forEach(violation => {
              console.log(`      • ${violation.help}`);
              console.log(chalk.gray(`        ${violation.description}`));
              console.log(chalk.gray(`        Affects: ${violation.nodes.length} element(s)`));
            });
            
            if (violationsByImpact[impact].length > 3) {
              console.log(chalk.gray(`      ... and ${violationsByImpact[impact].length - 3} more`));
            }
          }
        });
      }
      
      allResults.push({
        viewport: viewport.name,
        results,
        summary,
        screenshot: screenshotPath
      });
      
      await page.close();
    }
    
    await browser.close();
    spinner.succeed('Accessibility testing complete!');
    
    // Overall summary
    console.log(chalk.cyan('\n📊 Overall Summary:\n'));
    
    const totalViolations = allResults.reduce((sum, r) => sum + r.results.violations.length, 0);
    const uniqueViolations = new Set();
    
    allResults.forEach(r => {
      r.results.violations.forEach(v => {
        uniqueViolations.add(v.id);
      });
    });
    
    console.log(`Total violations across all viewports: ${totalViolations}`);
    console.log(`Unique violation types: ${uniqueViolations.size}`);
    
    // Most common violations
    const violationCounts = {};
    allResults.forEach(r => {
      r.results.violations.forEach(v => {
        if (!violationCounts[v.id]) {
          violationCounts[v.id] = {
            count: 0,
            help: v.help,
            impact: v.impact
          };
        }
        violationCounts[v.id].count += v.nodes.length;
      });
    });
    
    const sortedViolations = Object.entries(violationCounts)
      .sort((a, b) => b[1].count - a[1].count);
    
    if (sortedViolations.length > 0) {
      console.log(chalk.yellow('\nMost Common Issues:'));
      sortedViolations.slice(0, 5).forEach(([id, data], index) => {
        const color = data.impact === 'critical' || data.impact === 'serious' ? 'red' : 'yellow';
        console.log(chalk[color](`${index + 1}. ${data.help} (${data.count} instances)`));
      });
    }
    
    // Recommendations
    console.log(chalk.cyan('\n💡 Recommendations:\n'));
    
    const recommendations = generateAccessibilityRecommendations(allResults);
    recommendations.forEach((rec, index) => {
      console.log(`${index + 1}. ${rec}`);
    });
    
    // Save detailed report
    const report = {
      timestamp: new Date().toISOString(),
      url,
      standard,
      results: allResults,
      summary: {
        totalViolations,
        uniqueViolations: uniqueViolations.size,
        violationsByType: violationCounts
      },
      recommendations
    };
    
    await fs.writeFile(
      path.join(outputDir, 'accessibility-report.json'),
      JSON.stringify(report, null, 2)
    );
    
    // Generate HTML report
    await generateAccessibilityHTMLReport(report, outputDir);
    
    console.log(chalk.green(`\n📁 Full report saved to: ${outputDir}`));
    console.log(chalk.blue(`📄 Open ${path.join(outputDir, 'accessibility-report.html')} in your browser for detailed results`));
    
    // Exit with error code if violations found
    if (totalViolations > 0) {
      process.exit(1);
    }
    
  } catch (error) {
    spinner.fail('Accessibility testing failed');
    console.error(chalk.red('Error:'), error.message);
    process.exit(1);
  }
}

async function highlightViolations(page, violations) {
  await page.evaluate((violationData) => {
    violationData.forEach(violation => {
      violation.nodes.forEach(node => {
        try {
          const elements = document.querySelectorAll(node.target.join(','));
          elements.forEach(el => {
            el.style.outline = '3px solid red';
            el.style.outlineOffset = '2px';
            
            // Add violation info as data attribute
            el.dataset.a11yViolation = violation.help;
            el.dataset.a11yImpact = violation.impact;
          });
        } catch (e) {
          console.error('Failed to highlight element:', e);
        }
      });
    });
  }, violations);
}

function generateAccessibilityRecommendations(results) {
  const recommendations = [];
  const allViolations = [];
  
  results.forEach(r => {
    allViolations.push(...r.results.violations);
  });
  
  // Check for critical color contrast issues
  const colorContrastIssues = allViolations.filter(v => v.id === 'color-contrast');
  if (colorContrastIssues.length > 0) {
    recommendations.push('Fix color contrast issues to meet WCAG standards (4.5:1 for normal text, 3:1 for large text)');
  }
  
  // Check for missing alt text
  const altTextIssues = allViolations.filter(v => v.id === 'image-alt');
  if (altTextIssues.length > 0) {
    recommendations.push('Add descriptive alt text to all informative images');
  }
  
  // Check for form label issues
  const labelIssues = allViolations.filter(v => v.id === 'label' || v.id === 'label-title-only');
  if (labelIssues.length > 0) {
    recommendations.push('Ensure all form inputs have associated labels');
  }
  
  // Check for heading structure
  const headingIssues = allViolations.filter(v => v.id === 'heading-order' || v.id === 'page-has-heading-one');
  if (headingIssues.length > 0) {
    recommendations.push('Fix heading hierarchy - use proper nesting and start with h1');
  }
  
  // Check for keyboard navigation
  const keyboardIssues = allViolations.filter(v => 
    v.tags.includes('keyboard') || v.id === 'focus-order-semantics'
  );
  if (keyboardIssues.length > 0) {
    recommendations.push('Ensure all interactive elements are keyboard accessible');
  }
  
  // General recommendations
  recommendations.push('Test with screen readers (NVDA, JAWS, or VoiceOver)');
  recommendations.push('Implement skip links for keyboard navigation');
  recommendations.push('Use semantic HTML elements appropriately');
  recommendations.push('Test with browser zoom at 200% to ensure content reflows properly');
  recommendations.push('Consider implementing a high contrast mode');
  
  return recommendations;
}

async function generateAccessibilityHTMLReport(report, outputDir) {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Accessibility Test Report</title>
  <style>
    body { font-family: -apple-system, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; line-height: 1.6; }
    .container { max-width: 1200px; margin: 0 auto; }
    .header { background: white; padding: 30px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    h1 { margin: 0 0 10px 0; color: #333; }
    .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0; }
    .metric { background: white; padding: 20px; border-radius: 8px; text-align: center; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .metric-value { font-size: 36px; font-weight: bold; margin: 10px 0; }
    .violations { color: #d32f2f; }
    .passes { color: #388e3c; }
    .viewport-section { background: white; padding: 20px; margin: 20px 0; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .violation { padding: 15px; margin: 10px 0; background: #ffebee; border-left: 4px solid #d32f2f; border-radius: 4px; }
    .violation-critical { border-color: #b71c1c; background: #ffcdd2; }
    .violation-serious { border-color: #d32f2f; }
    .violation-moderate { border-color: #f57c00; background: #fff3e0; }
    .violation-minor { border-color: #fbc02d; background: #fffde7; }
    .impact { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; text-transform: uppercase; }
    .impact-critical { background: #b71c1c; color: white; }
    .impact-serious { background: #d32f2f; color: white; }
    .impact-moderate { background: #f57c00; color: white; }
    .impact-minor { background: #fbc02d; color: #333; }
    .recommendations { background: #e3f2fd; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .recommendation { margin: 10px 0; padding-left: 20px; }
    code { background: #f5f5f5; padding: 2px 4px; border-radius: 3px; font-family: monospace; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>♿ Accessibility Test Report</h1>
      <p><strong>URL:</strong> ${report.url}</p>
      <p><strong>Standard:</strong> ${report.standard}</p>
      <p><strong>Date:</strong> ${new Date(report.timestamp).toLocaleString()}</p>
    </div>
    
    <div class="summary">
      <div class="metric">
        <div class="metric-value violations">${report.summary.totalViolations}</div>
        <div>Total Violations</div>
      </div>
      <div class="metric">
        <div class="metric-value">${report.summary.uniqueViolations}</div>
        <div>Unique Issues</div>
      </div>
      <div class="metric">
        <div class="metric-value passes">${report.results.reduce((sum, r) => sum + r.results.passes.length, 0)}</div>
        <div>Rules Passed</div>
      </div>
    </div>
    
    ${report.results.map(viewportResult => `
      <div class="viewport-section">
        <h2>${viewportResult.viewport.charAt(0).toUpperCase() + viewportResult.viewport.slice(1)} Viewport</h2>
        <p>Violations: ${viewportResult.summary.violations} | Passes: ${viewportResult.summary.passes}</p>
        
        ${viewportResult.results.violations.length > 0 ? `
          <h3>Violations</h3>
          ${viewportResult.results.violations.map(violation => `
            <div class="violation violation-${violation.impact}">
              <span class="impact impact-${violation.impact}">${violation.impact}</span>
              <strong>${violation.help}</strong>
              <p>${violation.description}</p>
              <p>Affects ${violation.nodes.length} element(s)</p>
              <details>
                <summary>View affected elements</summary>
                <ul>
                  ${violation.nodes.slice(0, 3).map(node => `
                    <li><code>${node.target.join(' ')}</code></li>
                  `).join('')}
                  ${violation.nodes.length > 3 ? `<li>... and ${violation.nodes.length - 3} more</li>` : ''}
                </ul>
              </details>
            </div>
          `).join('')}
        ` : '<p>✅ No violations found!</p>'}
      </div>
    `).join('')}
    
    <div class="recommendations">
      <h2>💡 Recommendations</h2>
      ${report.recommendations.map(rec => `
        <div class="recommendation">• ${rec}</div>
      `).join('')}
    </div>
  </div>
</body>
</html>
  `;
  
  await fs.writeFile(path.join(outputDir, 'accessibility-report.html'), html);
}

module.exports = accessibilityCommand;