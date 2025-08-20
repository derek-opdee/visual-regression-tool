const chalk = require('chalk');
const ora = require('ora');
const fs = require('fs').promises;
const path = require('path');
const VRT = require('../../lib/vrt');

async function responsiveCommand(url, options) {
  const spinner = ora('Testing responsive behavior...').start();
  
  try {
    const breakpoints = options.breakpoints 
      ? options.breakpoints.split(',').map(b => parseInt(b))
      : [320, 375, 414, 768, 1024, 1280, 1440, 1920];
    
    const vrt = new VRT({ aiEnabled: true });
    const puppeteer = require('puppeteer');
    
    spinner.text = 'Launching browser for responsive testing...';
    
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const outputDir = path.join('responsive-tests', new Date().toISOString().replace(/[:]/g, '-'));
    await fs.mkdir(outputDir, { recursive: true });
    
    const results = [];
    const issues = [];
    
    console.log(chalk.cyan('\n📱 Responsive Design Testing\n'));
    console.log(chalk.gray(`URL: ${url}`));
    console.log(chalk.gray(`Breakpoints: ${breakpoints.join(', ')}px\n`));
    
    for (let i = 0; i < breakpoints.length; i++) {
      const width = breakpoints[i];
      const prevWidth = i > 0 ? breakpoints[i - 1] : null;
      
      spinner.text = `Testing ${width}px breakpoint...`;
      
      const page = await browser.newPage();
      await page.setViewport({ width, height: 1024 });
      await page.goto(url, { waitUntil: 'networkidle2' });
      
      // Wait for any responsive adjustments
      await page.waitForTimeout(500);
      
      // Capture screenshot
      const screenshotPath = path.join(outputDir, `${width}px.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });
      
      // Analyze layout
      const layoutAnalysis = await analyzeResponsiveLayout(page, width);
      
      console.log(chalk.yellow(`${width}px:`));
      
      // Check for common responsive issues
      const breakpointIssues = [];
      
      // Horizontal overflow
      if (layoutAnalysis.hasHorizontalScroll) {
        const issue = 'Horizontal scroll detected';
        console.log(chalk.red(`  ❌ ${issue}`));
        breakpointIssues.push(issue);
      }
      
      // Text readability
      if (layoutAnalysis.tinyText.length > 0) {
        const issue = `${layoutAnalysis.tinyText.length} elements with text too small`;
        console.log(chalk.red(`  ❌ ${issue}`));
        breakpointIssues.push(issue);
      }
      
      // Touch targets
      if (width <= 768 && layoutAnalysis.smallTouchTargets.length > 0) {
        const issue = `${layoutAnalysis.smallTouchTargets.length} touch targets too small`;
        console.log(chalk.red(`  ❌ ${issue}`));
        breakpointIssues.push(issue);
      }
      
      // Layout shifts
      if (prevWidth && layoutAnalysis.majorLayoutShift) {
        const issue = 'Major layout shift detected';
        console.log(chalk.yellow(`  ⚠️  ${issue}`));
        breakpointIssues.push(issue);
      }
      
      if (breakpointIssues.length === 0) {
        console.log(chalk.green('  ✅ No issues detected'));
      }
      
      results.push({
        breakpoint: width,
        screenshot: screenshotPath,
        issues: breakpointIssues,
        analysis: layoutAnalysis
      });
      
      issues.push(...breakpointIssues.map(issue => ({ breakpoint: width, issue })));
      
      await page.close();
    }
    
    await browser.close();
    spinner.succeed('Responsive testing complete!');
    
    // Analyze breakpoint consistency
    console.log(chalk.cyan('\n🔍 Breakpoint Analysis:\n'));
    
    // Find optimal breakpoints based on layout changes
    const layoutChanges = [];
    for (let i = 1; i < results.length; i++) {
      const prev = results[i - 1];
      const curr = results[i];
      
      if (curr.analysis.majorLayoutShift) {
        layoutChanges.push({
          from: prev.breakpoint,
          to: curr.breakpoint,
          change: 'Major layout change'
        });
      }
    }
    
    if (layoutChanges.length > 0) {
      console.log(chalk.yellow('Layout changes detected at:'));
      layoutChanges.forEach(change => {
        console.log(`  • Between ${change.from}px and ${change.to}px: ${change.change}`);
      });
    } else {
      console.log(chalk.green('✅ Smooth responsive transitions'));
    }
    
    // Summary
    console.log(chalk.cyan('\n📊 Summary:\n'));
    console.log(`Breakpoints tested: ${breakpoints.length}`);
    console.log(`Total issues found: ${issues.length}`);
    
    if (issues.length > 0) {
      console.log(chalk.red('\nIssues by breakpoint:'));
      const issuesByBreakpoint = issues.reduce((acc, item) => {
        if (!acc[item.breakpoint]) acc[item.breakpoint] = [];
        acc[item.breakpoint].push(item.issue);
        return acc;
      }, {});
      
      Object.entries(issuesByBreakpoint).forEach(([bp, bpIssues]) => {
        console.log(`  ${bp}px: ${bpIssues.length} issues`);
      });
    }
    
    // Recommendations
    console.log(chalk.cyan('\n💡 Recommendations:\n'));
    
    const recommendations = generateResponsiveRecommendations(results);
    recommendations.forEach((rec, index) => {
      console.log(`${index + 1}. ${rec}`);
    });
    
    // Save report
    const report = {
      timestamp: new Date().toISOString(),
      url,
      breakpoints,
      results,
      issues,
      layoutChanges,
      recommendations
    };
    
    await fs.writeFile(
      path.join(outputDir, 'responsive-test-report.json'),
      JSON.stringify(report, null, 2)
    );
    
    // Generate HTML report
    await generateResponsiveHTMLReport(report, outputDir);
    
    console.log(chalk.green(`\n📁 Full report saved to: ${outputDir}`));
    
  } catch (error) {
    spinner.fail('Responsive testing failed');
    console.error(chalk.red('Error:'), error.message);
    process.exit(1);
  }
}

async function analyzeResponsiveLayout(page, width) {
  return await page.evaluate((viewportWidth) => {
    const analysis = {
      hasHorizontalScroll: document.documentElement.scrollWidth > window.innerWidth,
      tinyText: [],
      smallTouchTargets: [],
      overlappingElements: [],
      majorLayoutShift: false
    };
    
    // Check for tiny text
    const textElements = document.querySelectorAll('p, span, div, h1, h2, h3, h4, h5, h6, a, button');
    textElements.forEach(el => {
      const styles = window.getComputedStyle(el);
      const fontSize = parseFloat(styles.fontSize);
      if (fontSize < 12) {
        analysis.tinyText.push({
          selector: el.tagName.toLowerCase(),
          fontSize: fontSize
        });
      }
    });
    
    // Check touch targets on mobile
    if (viewportWidth <= 768) {
      const interactiveElements = document.querySelectorAll('a, button, input, select, textarea');
      interactiveElements.forEach(el => {
        const rect = el.getBoundingClientRect();
        if (rect.width < 44 || rect.height < 44) {
          analysis.smallTouchTargets.push({
            selector: el.tagName.toLowerCase(),
            width: rect.width,
            height: rect.height
          });
        }
      });
    }
    
    // Detect overlapping elements
    const allElements = document.querySelectorAll('*');
    for (let i = 0; i < allElements.length; i++) {
      for (let j = i + 1; j < allElements.length; j++) {
        const rect1 = allElements[i].getBoundingClientRect();
        const rect2 = allElements[j].getBoundingClientRect();
        
        if (rect1.width > 0 && rect1.height > 0 && rect2.width > 0 && rect2.height > 0) {
          const overlap = !(rect1.right < rect2.left || 
                          rect2.right < rect1.left || 
                          rect1.bottom < rect2.top || 
                          rect2.bottom < rect1.top);
          
          if (overlap && !allElements[i].contains(allElements[j]) && !allElements[j].contains(allElements[i])) {
            analysis.overlappingElements.push({
              element1: allElements[i].tagName.toLowerCase(),
              element2: allElements[j].tagName.toLowerCase()
            });
          }
        }
      }
    }
    
    // Simple heuristic for major layout shift
    analysis.majorLayoutShift = analysis.overlappingElements.length > 5;
    
    return analysis;
  }, width);
}

function generateResponsiveRecommendations(results) {
  const recommendations = [];
  
  // Check for horizontal scroll issues
  const horizontalScrollIssues = results.filter(r => r.analysis.hasHorizontalScroll);
  if (horizontalScrollIssues.length > 0) {
    recommendations.push('Fix horizontal overflow issues by using relative units and max-width constraints');
  }
  
  // Check for text readability
  const textIssues = results.filter(r => r.analysis.tinyText.length > 0);
  if (textIssues.length > 0) {
    recommendations.push('Increase minimum font size to 14px for better mobile readability');
  }
  
  // Check for touch targets
  const touchTargetIssues = results.filter(r => r.breakpoint <= 768 && r.analysis.smallTouchTargets.length > 0);
  if (touchTargetIssues.length > 0) {
    recommendations.push('Ensure all touch targets are at least 44x44px on mobile devices');
  }
  
  // Check for missing breakpoints
  const majorShifts = results.filter(r => r.analysis.majorLayoutShift);
  if (majorShifts.length > 1) {
    recommendations.push('Consider adding intermediate breakpoints to smooth layout transitions');
  }
  
  // General recommendations
  recommendations.push('Test on real devices to verify responsive behavior');
  recommendations.push('Use CSS Grid or Flexbox for more flexible layouts');
  recommendations.push('Implement a mobile-first approach for better progressive enhancement');
  
  return recommendations;
}

async function generateResponsiveHTMLReport(report, outputDir) {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Responsive Design Test Report</title>
  <style>
    body { font-family: -apple-system, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
    .container { max-width: 1400px; margin: 0 auto; }
    h1 { color: #333; }
    .breakpoint-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin: 20px 0; }
    .breakpoint-card { background: white; border-radius: 8px; padding: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .breakpoint-card img { width: 100%; height: 200px; object-fit: cover; object-position: top; border: 1px solid #e0e0e0; border-radius: 4px; }
    .breakpoint-card h3 { margin: 10px 0; }
    .issues { margin-top: 10px; }
    .issue { color: #d32f2f; font-size: 14px; }
    .no-issues { color: #388e3c; }
    .summary { background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>📱 Responsive Design Test Report</h1>
    <div class="summary">
      <p><strong>URL:</strong> ${report.url}</p>
      <p><strong>Date:</strong> ${new Date(report.timestamp).toLocaleString()}</p>
      <p><strong>Breakpoints tested:</strong> ${report.breakpoints.length}</p>
      <p><strong>Issues found:</strong> ${report.issues.length}</p>
    </div>
    
    <h2>Breakpoint Screenshots</h2>
    <div class="breakpoint-grid">
      ${report.results.map(result => `
        <div class="breakpoint-card">
          <h3>${result.breakpoint}px</h3>
          <img src="${path.basename(result.screenshot)}" alt="${result.breakpoint}px viewport">
          <div class="issues">
            ${result.issues.length === 0 
              ? '<p class="no-issues">✅ No issues</p>'
              : result.issues.map(issue => `<p class="issue">❌ ${issue}</p>`).join('')
            }
          </div>
        </div>
      `).join('')}
    </div>
    
    <h2>Recommendations</h2>
    <ul>
      ${report.recommendations.map(rec => `<li>${rec}</li>`).join('')}
    </ul>
  </div>
</body>
</html>
  `;
  
  await fs.writeFile(path.join(outputDir, 'responsive-report.html'), html);
}

module.exports = responsiveCommand;