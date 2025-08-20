const chalk = require('chalk');
const ora = require('ora');
const fs = require('fs').promises;
const path = require('path');

async function reportCommand(options) {
  const spinner = ora('Generating migration report...').start();
  
  try {
    const format = options.format || 'html';
    const validationDir = 'migration-validation';
    
    // Load validation report
    let validationReport;
    try {
      const reportContent = await fs.readFile(
        path.join(validationDir, 'validation-report.json'),
        'utf8'
      );
      validationReport = JSON.parse(reportContent);
    } catch (error) {
      console.error(chalk.red('Error: No validation report found. Run "migrate:validate" first.'));
      process.exit(1);
    }
    
    // Load migration metadata
    let metadata;
    try {
      const metadataContent = await fs.readFile(
        path.join('migration-baseline-bootstrap', 'migration-metadata.json'),
        'utf8'
      );
      metadata = JSON.parse(metadataContent);
    } catch (error) {
      metadata = {
        sourceFramework: 'bootstrap',
        targetFramework: 'tailwind'
      };
    }
    
    spinner.succeed('Report data loaded');
    
    console.log(chalk.cyan('\n📊 Migration Report Summary\n'));
    
    // Display summary
    const successRate = validationReport.successRate;
    const statusColor = successRate === 100 ? 'green' : successRate >= 80 ? 'yellow' : 'red';
    
    console.log(`Migration: ${chalk.bold(metadata.sourceFramework)} → ${chalk.bold(metadata.targetFramework)}`);
    console.log(`Date: ${new Date(validationReport.timestamp).toLocaleString()}`);
    console.log(chalk[statusColor](`Success Rate: ${successRate.toFixed(1)}%`));
    
    // Page-by-page summary
    console.log(chalk.cyan('\n📄 Page Results:\n'));
    
    validationReport.results.forEach(({ page, result }) => {
      const icon = result.passed ? '✅' : '❌';
      const status = result.passed ? chalk.green('PASSED') : chalk.red('FAILED');
      console.log(`${icon} ${page}: ${status}`);
      
      if (!result.passed) {
        console.log(`   Differences: ${result.differences.length}`);
        console.log(`   Severity: ${result.report[0]?.aiAnalysis?.severity || 'unknown'}`);
      }
    });
    
    // Component issues summary
    const hasComponentIssues = Object.values(validationReport.componentIssues)
      .some(issues => issues.length > 0);
    
    if (hasComponentIssues) {
      console.log(chalk.cyan('\n🧩 Component Issues:\n'));
      
      Object.entries(validationReport.componentIssues).forEach(([component, issues]) => {
        if (issues.length > 0) {
          console.log(chalk.yellow(`${component}: ${issues.length} issues`));
        }
      });
    }
    
    // Generate report files
    spinner.start(`Generating ${format} report...`);
    
    const reportDir = path.join(validationDir, 'final-report');
    await fs.mkdir(reportDir, { recursive: true });
    
    switch (format) {
      case 'html':
        await generateHTMLReport(validationReport, metadata, reportDir);
        console.log(chalk.green(`\n📄 HTML report generated: ${path.join(reportDir, 'migration-report.html')}`));
        break;
        
      case 'markdown':
        await generateMarkdownReport(validationReport, metadata, reportDir);
        console.log(chalk.green(`\n📄 Markdown report generated: ${path.join(reportDir, 'migration-report.md')}`));
        break;
        
      case 'json':
        await fs.writeFile(
          path.join(reportDir, 'migration-report.json'),
          JSON.stringify({ metadata, ...validationReport }, null, 2)
        );
        console.log(chalk.green(`\n📄 JSON report generated: ${path.join(reportDir, 'migration-report.json')}`));
        break;
    }
    
    spinner.succeed('Report generated successfully!');
    
    // Executive summary
    console.log(chalk.cyan('\n📋 Executive Summary:\n'));
    
    const summary = generateExecutiveSummary(validationReport, metadata);
    summary.forEach(point => {
      console.log(`• ${point}`);
    });
    
    // Next steps
    if (successRate < 100) {
      console.log(chalk.yellow('\n🎯 Recommended Next Steps:\n'));
      
      const nextSteps = [
        'Review the detailed report to identify specific issues',
        'Apply AI-suggested CSS fixes from validation results',
        'Focus on high-severity issues first',
        'Re-run validation after each batch of fixes',
        'Document any intentional design changes'
      ];
      
      nextSteps.forEach((step, index) => {
        console.log(`${index + 1}. ${step}`);
      });
    } else {
      console.log(chalk.green('\n🎉 Migration Complete!\n'));
      console.log('All pages have achieved visual parity. Final steps:');
      console.log('1. Run comprehensive browser testing');
      console.log('2. Perform accessibility validation');
      console.log('3. Test interactive features and animations');
      console.log('4. Update documentation and style guides');
      console.log('5. Remove old framework dependencies');
    }
    
  } catch (error) {
    spinner.fail('Report generation failed');
    console.error(chalk.red('Error:'), error.message);
    process.exit(1);
  }
}

function generateExecutiveSummary(report, metadata) {
  const summary = [];
  
  // Overall status
  if (report.successRate === 100) {
    summary.push('✅ Migration completed successfully with 100% visual parity');
  } else if (report.successRate >= 80) {
    summary.push(`⚠️  Migration ${report.successRate.toFixed(1)}% complete with minor issues remaining`);
  } else {
    summary.push(`❌ Migration requires significant work (${report.successRate.toFixed(1)}% complete)`);
  }
  
  // Framework transition
  summary.push(`Successfully transitioned core framework from ${metadata.sourceFramework} to ${metadata.targetFramework}`);
  
  // Pages status
  const totalPages = report.results.length;
  const passedPages = report.results.filter(r => r.result.passed).length;
  summary.push(`${passedPages} of ${totalPages} pages fully migrated`);
  
  // Component status
  const componentTypes = Object.keys(report.componentIssues);
  const affectedComponents = componentTypes.filter(c => report.componentIssues[c].length > 0);
  
  if (affectedComponents.length === 0) {
    summary.push('All UI components successfully migrated');
  } else {
    summary.push(`${affectedComponents.length} component types require attention`);
  }
  
  // Time and effort estimate
  const estimatedHours = Math.ceil((100 - report.successRate) / 10) * 4;
  if (estimatedHours > 0) {
    summary.push(`Estimated ${estimatedHours} hours needed to complete migration`);
  }
  
  // Risk assessment
  if (report.successRate < 70) {
    summary.push('⚠️  High risk: Significant visual differences may impact user experience');
  } else if (report.successRate < 90) {
    summary.push('⚠️  Medium risk: Some visual inconsistencies need addressing');
  } else {
    summary.push('✅ Low risk: Minor or no visual impact on users');
  }
  
  return summary;
}

async function generateHTMLReport(report, metadata, outputDir) {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CSS Migration Report - ${metadata.sourceFramework} to ${metadata.targetFramework}</title>
  <style>
    * { box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
      margin: 0; 
      padding: 0; 
      background: #f8f9fa; 
      line-height: 1.6;
    }
    .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
    .header { 
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
      color: white; 
      padding: 40px; 
      border-radius: 12px; 
      margin-bottom: 30px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.1);
    }
    .header h1 { margin: 0 0 10px 0; font-size: 2.5em; }
    .header p { margin: 5px 0; opacity: 0.9; }
    
    .summary-grid { 
      display: grid; 
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); 
      gap: 20px; 
      margin-bottom: 30px; 
    }
    .metric-card { 
      background: white; 
      padding: 25px; 
      border-radius: 12px; 
      text-align: center; 
      box-shadow: 0 2px 10px rgba(0,0,0,0.05);
      transition: transform 0.2s;
    }
    .metric-card:hover { transform: translateY(-2px); }
    .metric-value { 
      font-size: 3em; 
      font-weight: bold; 
      margin: 15px 0; 
    }
    .metric-label { color: #6c757d; font-size: 0.9em; text-transform: uppercase; }
    
    .success { color: #28a745; }
    .warning { color: #ffc107; }
    .danger { color: #dc3545; }
    
    .section { 
      background: white; 
      padding: 30px; 
      margin-bottom: 20px; 
      border-radius: 12px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.05);
    }
    .section h2 { margin-top: 0; color: #333; border-bottom: 2px solid #e9ecef; padding-bottom: 10px; }
    
    .page-result { 
      padding: 20px; 
      margin: 10px 0; 
      background: #f8f9fa; 
      border-radius: 8px;
      border-left: 4px solid #e9ecef;
    }
    .page-result.passed { border-left-color: #28a745; }
    .page-result.failed { border-left-color: #dc3545; }
    
    .component-grid { 
      display: grid; 
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); 
      gap: 15px; 
      margin-top: 20px;
    }
    .component-card { 
      padding: 15px; 
      background: #f8f9fa; 
      border-radius: 8px;
      text-align: center;
    }
    .component-card.has-issues { background: #fff3cd; }
    
    .progress-bar {
      width: 100%;
      height: 30px;
      background: #e9ecef;
      border-radius: 15px;
      overflow: hidden;
      margin: 20px 0;
    }
    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #28a745 0%, #20c997 100%);
      transition: width 0.5s;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: bold;
    }
    
    .timeline {
      position: relative;
      padding: 20px 0;
    }
    .timeline-item {
      padding: 10px 20px;
      margin-left: 30px;
      border-left: 2px solid #e9ecef;
    }
    .timeline-item::before {
      content: '';
      position: absolute;
      left: -8px;
      width: 14px;
      height: 14px;
      background: #667eea;
      border-radius: 50%;
      border: 3px solid white;
    }
    
    .recommendations {
      background: #e7f3ff;
      padding: 20px;
      border-radius: 8px;
      margin-top: 20px;
    }
    .recommendation-item {
      padding: 10px 0;
      border-bottom: 1px solid rgba(0,0,0,0.1);
    }
    .recommendation-item:last-child { border-bottom: none; }
    
    @media print {
      .container { max-width: 100%; }
      .header { background: #333; }
      .section { box-shadow: none; border: 1px solid #ddd; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>CSS Migration Report</h1>
      <p><strong>${metadata.sourceFramework}</strong> → <strong>${metadata.targetFramework}</strong></p>
      <p>Generated: ${new Date(report.timestamp).toLocaleString()}</p>
    </div>
    
    <div class="summary-grid">
      <div class="metric-card">
        <div class="metric-label">Success Rate</div>
        <div class="metric-value ${report.successRate === 100 ? 'success' : report.successRate >= 80 ? 'warning' : 'danger'}">
          ${report.successRate.toFixed(1)}%
        </div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Pages Tested</div>
        <div class="metric-value">${report.results.length}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Pages Passed</div>
        <div class="metric-value success">${report.results.filter(r => r.result.passed).length}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Issues Found</div>
        <div class="metric-value ${report.results.filter(r => !r.result.passed).length > 0 ? 'danger' : 'success'}">
          ${report.results.reduce((sum, r) => sum + (r.result.differences?.length || 0), 0)}
        </div>
      </div>
    </div>
    
    <div class="section">
      <h2>Migration Progress</h2>
      <div class="progress-bar">
        <div class="progress-fill" style="width: ${report.successRate}%">
          ${report.successRate.toFixed(1)}%
        </div>
      </div>
    </div>
    
    <div class="section">
      <h2>Page-by-Page Results</h2>
      ${report.results.map(({ page, result }) => `
        <div class="page-result ${result.passed ? 'passed' : 'failed'}">
          <h3>${page} ${result.passed ? '✅' : '❌'}</h3>
          ${result.passed ? 
            '<p>Visual parity achieved - no significant differences detected.</p>' :
            `<p>${result.differences.length} visual differences detected.</p>
             <ul>
               ${result.differences.slice(0, 3).map(diff => 
                 `<li>${diff.file}: ${(diff.difference * 100).toFixed(2)}% difference</li>`
               ).join('')}
               ${result.differences.length > 3 ? `<li>... and ${result.differences.length - 3} more</li>` : ''}
             </ul>`
          }
        </div>
      `).join('')}
    </div>
    
    <div class="section">
      <h2>Component Analysis</h2>
      <div class="component-grid">
        ${Object.entries(report.componentIssues).map(([component, issues]) => `
          <div class="component-card ${issues.length > 0 ? 'has-issues' : ''}">
            <h4>${component.charAt(0).toUpperCase() + component.slice(1)}</h4>
            <p>${issues.length === 0 ? '✅ No issues' : `⚠️ ${issues.length} issues`}</p>
          </div>
        `).join('')}
      </div>
    </div>
    
    ${report.recommendations ? `
      <div class="section">
        <h2>Recommendations</h2>
        <div class="recommendations">
          ${report.recommendations.map(rec => `
            <div class="recommendation-item">• ${rec}</div>
          `).join('')}
        </div>
      </div>
    ` : ''}
    
    <div class="section">
      <h2>Migration Timeline</h2>
      <div class="timeline">
        <div class="timeline-item">
          <strong>Migration Started</strong>
          <p>Baseline captured with ${metadata.sourceFramework}</p>
        </div>
        <div class="timeline-item">
          <strong>Current Status</strong>
          <p>${report.successRate.toFixed(1)}% complete</p>
        </div>
        <div class="timeline-item" style="opacity: 0.5">
          <strong>Target Completion</strong>
          <p>100% visual parity with ${metadata.targetFramework}</p>
        </div>
      </div>
    </div>
  </div>
</body>
</html>
  `;
  
  await fs.writeFile(path.join(outputDir, 'migration-report.html'), html);
}

async function generateMarkdownReport(report, metadata, outputDir) {
  const markdown = `# CSS Migration Report

## Migration: ${metadata.sourceFramework} → ${metadata.targetFramework}

**Date:** ${new Date(report.timestamp).toLocaleString()}  
**Success Rate:** ${report.successRate.toFixed(1)}%

## Summary

- **Pages Tested:** ${report.results.length}
- **Pages Passed:** ${report.results.filter(r => r.result.passed).length}
- **Total Issues:** ${report.results.reduce((sum, r) => sum + (r.result.differences?.length || 0), 0)}

## Page Results

${report.results.map(({ page, result }) => `
### ${page} ${result.passed ? '✅' : '❌'}

${result.passed ? 
  'Visual parity achieved - no significant differences detected.' :
  `${result.differences.length} visual differences detected:
${result.differences.slice(0, 5).map(diff => 
  `- ${diff.file}: ${(diff.difference * 100).toFixed(2)}% difference`
).join('\n')}${result.differences.length > 5 ? `\n- ... and ${result.differences.length - 5} more` : ''}`
}
`).join('\n')}

## Component Analysis

${Object.entries(report.componentIssues).map(([component, issues]) => 
  `- **${component.charAt(0).toUpperCase() + component.slice(1)}:** ${issues.length === 0 ? '✅ No issues' : `⚠️ ${issues.length} issues`}`
).join('\n')}

## Recommendations

${report.recommendations ? report.recommendations.map(rec => `- ${rec}`).join('\n') : 'No recommendations available.'}

## Next Steps

${report.successRate < 100 ? `
1. Review visual differences in detail
2. Apply suggested CSS fixes
3. Re-run validation tests
4. Document intentional changes
` : `
1. Run browser compatibility tests
2. Perform accessibility validation
3. Test interactive features
4. Remove old framework dependencies
`}
`;
  
  await fs.writeFile(path.join(outputDir, 'migration-report.md'), markdown);
}

module.exports = reportCommand;