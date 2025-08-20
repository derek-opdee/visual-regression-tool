/**
 * Report Generator for Visual Regression Testing
 * Uses extracted templates for better maintainability
 */

const {
  reportStyles,
  getCSS,
  generateSummarySection,
  generateComparisonItem
} = require('./report-templates');

class ReportGenerator {
  /**
   * Generate HTML report for comparison results
   * @param {Object} results - Comparison results
   * @param {string} engineType - Engine type (puppeteer/playwright)
   * @returns {string} HTML report content
   */
  static generateReport(results, engineType = 'VRT') {
    const style = reportStyles[engineType] || reportStyles.default;
    const css = getCSS(style);
    const summaryHTML = generateSummarySection(results);
    const comparisonsHTML = results.report
      .map(item => generateComparisonItem(item))
      .join('');

    return `
<!DOCTYPE html>
<html>
<head>
  <title>Visual Regression Report - ${engineType}</title>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>${css}</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${style.title}</h1>
      <p>${style.subtitle}</p>
    </div>
    
    ${summaryHTML}
    ${comparisonsHTML}
    
    <footer>
      <p>
        Generated with ${engineType} Visual Regression Tool<br>
        ${new Date().toLocaleString()}<br>
        <a href="https://github.com/derekzar/visual-regression-tool">Documentation</a>
      </p>
    </footer>
  </div>
</body>
</html>
    `;
  }

  /**
   * Generate a summary report in JSON format
   */
  static generateJSONReport(results, engineType = 'VRT') {
    return {
      engine: engineType,
      timestamp: new Date().toISOString(),
      summary: {
        passed: results.passed,
        totalImages: results.totalImages,
        differencesFound: results.differences.length,
        passRate: results.totalImages > 0 
          ? ((results.totalImages - results.differences.length) / results.totalImages) 
          : 1
      },
      differences: results.differences,
      details: results.report
    };
  }

  /**
   * Generate a markdown report
   */
  static generateMarkdownReport(results, engineType = 'VRT') {
    let md = `# Visual Regression Report - ${engineType}\n\n`;
    md += `**Generated:** ${new Date().toLocaleString()}\n\n`;
    
    md += `## Summary\n\n`;
    md += `- **Status:** ${results.passed ? '✅ PASSED' : '❌ FAILED'}\n`;
    md += `- **Total Images:** ${results.totalImages}\n`;
    md += `- **Differences Found:** ${results.differences.length}\n`;
    md += `- **Pass Rate:** ${results.totalImages > 0 
      ? Math.round(((results.totalImages - results.differences.length) / results.totalImages) * 100) 
      : 100}%\n\n`;
    
    if (results.differences.length > 0) {
      md += `## Failed Comparisons\n\n`;
      results.differences.forEach(diff => {
        md += `### ${diff.file}\n`;
        md += `- **Difference:** ${(diff.difference * 100).toFixed(2)}%\n`;
        md += `- **Diff Path:** ${diff.diffPath}\n\n`;
      });
    }
    
    return md;
  }

  /**
   * Generate a CSV report for data analysis
   */
  static generateCSVReport(results, engineType = 'VRT') {
    const rows = [
      ['Engine', 'Timestamp', 'File', 'Status', 'Difference %', 'Path']
    ];
    
    results.report.forEach(item => {
      rows.push([
        engineType,
        new Date().toISOString(),
        item.file || '',
        item.passed ? 'PASS' : 'FAIL',
        item.difference ? (item.difference * 100).toFixed(2) : '0',
        item.diffPath || ''
      ]);
    });
    
    return rows.map(row => row.map(cell => 
      cell.includes(',') ? `"${cell}"` : cell
    ).join(',')).join('\n');
  }

  /**
   * Generate a simple text report for CI/CD pipelines
   */
  static generateTextReport(results, engineType = 'VRT') {
    let report = `Visual Regression Report - ${engineType}\n`;
    report += `${'='.repeat(50)}\n\n`;
    
    report += `Status: ${results.passed ? 'PASSED' : 'FAILED'}\n`;
    report += `Total Images: ${results.totalImages}\n`;
    report += `Differences: ${results.differences.length}\n`;
    report += `Pass Rate: ${results.totalImages > 0 
      ? Math.round(((results.totalImages - results.differences.length) / results.totalImages) * 100) 
      : 100}%\n\n`;
    
    if (results.differences.length > 0) {
      report += `Failed Comparisons:\n`;
      report += `${'-'.repeat(20)}\n`;
      results.differences.forEach(diff => {
        report += `• ${diff.file}: ${(diff.difference * 100).toFixed(2)}% difference\n`;
      });
    }
    
    return report;
  }
}

module.exports = ReportGenerator;