/**
 * Shared HTML Report Generator for Visual Regression Testing
 * Used by both Puppeteer and Playwright implementations
 */

class ReportGenerator {
  /**
   * Generate HTML report for comparison results
   * @param {Object} results - Comparison results
   * @param {string} engineType - Engine type (puppeteer/playwright)
   * @returns {string} HTML report content
   */
  static generateReport(results, engineType = 'VRT') {
    const engineStyles = {
      playwright: {
        headerGradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        title: '🎭 Playwright Visual Regression Report',
        subtitle: 'Advanced cross-browser testing with AI analysis'
      },
      puppeteer: {
        headerGradient: 'linear-gradient(135deg, #43cea2 0%, #185a9d 100%)',
        title: '🎪 Puppeteer Visual Regression Report',
        subtitle: 'Chrome-based visual regression testing'
      },
      default: {
        headerGradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        title: '📸 Visual Regression Report',
        subtitle: 'Automated visual testing results'
      }
    };

    const style = engineStyles[engineType] || engineStyles.default;

    return `
<!DOCTYPE html>
<html>
<head>
  <title>Visual Regression Report - ${engineType}</title>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; 
      margin: 0;
      background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
      min-height: 100vh;
      padding: 20px;
    }
    
    .container {
      max-width: 1400px;
      margin: 0 auto;
    }
    
    .header { 
      background: ${style.headerGradient};
      color: white; 
      padding: 40px; 
      border-radius: 16px; 
      margin-bottom: 30px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.15);
      text-align: center;
    }
    
    .header h1 {
      font-size: 2.5rem;
      margin-bottom: 10px;
      font-weight: 700;
    }
    
    .header p {
      font-size: 1.1rem;
      opacity: 0.95;
    }
    
    .summary { 
      background: white; 
      padding: 30px; 
      border-radius: 12px; 
      margin-bottom: 30px; 
      box-shadow: 0 4px 20px rgba(0,0,0,0.08);
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 20px;
    }
    
    .summary-card {
      padding: 20px;
      border-radius: 8px;
      background: linear-gradient(135deg, #f5f7fa 0%, #ffffff 100%);
      border: 1px solid #e1e8ed;
    }
    
    .summary-card h3 {
      font-size: 0.9rem;
      color: #657786;
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    .summary-card .value {
      font-size: 2rem;
      font-weight: 700;
      color: #14171a;
    }
    
    .passed { color: #10b981; }
    .failed { color: #ef4444; }
    
    .comparison { 
      margin-bottom: 30px; 
      background: white; 
      border-radius: 12px; 
      overflow: hidden;
      box-shadow: 0 4px 20px rgba(0,0,0,0.08);
    }
    
    .comparison-header {
      padding: 20px;
      background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%);
      border-bottom: 1px solid #e1e8ed;
    }
    
    .comparison-header h3 {
      font-size: 1.3rem;
      color: #14171a;
      margin-bottom: 10px;
    }
    
    .comparison-content {
      padding: 20px;
    }
    
    .images { 
      display: grid; 
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); 
      gap: 20px; 
      margin-top: 20px; 
    }
    
    .image-container { 
      text-align: center;
      background: #f8f9fa;
      border-radius: 8px;
      padding: 15px;
    }
    
    .image-container h4 {
      font-size: 0.9rem;
      color: #657786;
      margin-bottom: 10px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    .image-container img { 
      max-width: 100%; 
      border-radius: 8px; 
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      background: white;
    }
    
    .ai-analysis { 
      background: linear-gradient(135deg, #eff6ff 0%, #ffffff 100%);
      padding: 20px; 
      margin-top: 20px; 
      border-radius: 8px; 
      border-left: 4px solid #3b82f6;
    }
    
    .ai-analysis h4 {
      color: #1e40af;
      margin-bottom: 15px;
      font-size: 1.1rem;
    }
    
    .ai-analysis ul {
      list-style: none;
      padding: 0;
    }
    
    .ai-analysis li {
      padding: 8px 0;
      padding-left: 24px;
      position: relative;
    }
    
    .ai-analysis li:before {
      content: "→";
      position: absolute;
      left: 0;
      color: #3b82f6;
    }
    
    .suggested-fixes { 
      background: linear-gradient(135deg, #fef3c7 0%, #ffffff 100%);
      padding: 20px; 
      margin-top: 15px; 
      border-radius: 8px; 
      border-left: 4px solid #f59e0b;
    }
    
    .suggested-fixes h4 {
      color: #92400e;
      margin-bottom: 15px;
      font-size: 1.1rem;
    }
    
    pre { 
      background: #1f2937; 
      color: #f3f4f6; 
      padding: 20px; 
      border-radius: 8px; 
      overflow-x: auto;
      font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', monospace;
      font-size: 0.9rem;
      line-height: 1.5;
    }
    
    .badge { 
      display: inline-block; 
      padding: 6px 12px; 
      border-radius: 20px; 
      font-size: 0.85rem; 
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    .badge-success { 
      background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%);
      color: #065f46; 
    }
    
    .badge-error { 
      background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%);
      color: #991b1b; 
    }
    
    .badge-warning {
      background: linear-gradient(135deg, #fed7aa 0%, #fdba74 100%);
      color: #92400e;
    }
    
    footer {
      text-align: center;
      padding: 40px 20px;
      color: #657786;
      font-size: 0.9rem;
    }
    
    footer a {
      color: #3b82f6;
      text-decoration: none;
    }
    
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 15px;
      margin-top: 15px;
    }
    
    .metric {
      background: #f8f9fa;
      padding: 12px;
      border-radius: 6px;
      text-align: center;
    }
    
    .metric-label {
      font-size: 0.8rem;
      color: #657786;
      margin-bottom: 4px;
    }
    
    .metric-value {
      font-size: 1.2rem;
      font-weight: 700;
      color: #14171a;
    }

    @media (max-width: 768px) {
      .header h1 {
        font-size: 1.8rem;
      }
      
      .images {
        grid-template-columns: 1fr;
      }
      
      .summary {
        grid-template-columns: 1fr;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${style.title}</h1>
      <p>${style.subtitle}</p>
    </div>
    
    <div class="summary">
      <div class="summary-card">
        <h3>Test Status</h3>
        <div class="value ${results.passed ? 'passed' : 'failed'}">
          ${results.passed ? '✅ PASSED' : '❌ FAILED'}
        </div>
      </div>
      
      <div class="summary-card">
        <h3>Total Images</h3>
        <div class="value">${results.totalImages}</div>
      </div>
      
      <div class="summary-card">
        <h3>Differences Found</h3>
        <div class="value ${results.differences.length > 0 ? 'failed' : 'passed'}">
          ${results.differences.length}
        </div>
      </div>
      
      <div class="summary-card">
        <h3>Pass Rate</h3>
        <div class="value">
          ${results.totalImages > 0 
            ? Math.round(((results.totalImages - results.differences.length) / results.totalImages) * 100) 
            : 100}%
        </div>
      </div>
    </div>
    
    ${results.report.map(item => `
      <div class="comparison">
        <div class="comparison-header">
          <h3>${item.file}</h3>
          <div style="margin-top: 10px;">
            <span class="badge badge-${item.passed ? 'success' : 'error'}">
              ${item.passed ? 'PASS' : 'FAIL'}
            </span>
            ${item.difference !== undefined ? `
              <span class="badge badge-${item.difference < 0.01 ? 'success' : item.difference < 0.1 ? 'warning' : 'error'}" style="margin-left: 10px;">
                ${(item.difference * 100).toFixed(2)}% difference
              </span>
            ` : ''}
          </div>
        </div>
        
        <div class="comparison-content">
          ${item.aiAnalysis ? `
            <div class="ai-analysis">
              <h4>🤖 AI Analysis</h4>
              <p><strong>Summary:</strong> ${item.aiAnalysis.summary}</p>
              ${item.aiAnalysis.issues && item.aiAnalysis.issues.length > 0 ? `
                <p style="margin-top: 15px;"><strong>Issues Detected:</strong></p>
                <ul>
                  ${item.aiAnalysis.issues.map(issue => `<li>${issue}</li>`).join('')}
                </ul>
              ` : ''}
            </div>
          ` : ''}
          
          ${item.suggestedFixes && item.suggestedFixes.length > 0 ? `
            <div class="suggested-fixes">
              <h4>💡 Suggested CSS Fixes</h4>
              <pre>${item.suggestedFixes.join('\\n')}</pre>
            </div>
          ` : ''}
          
          ${!item.passed && item.file ? `
            <div class="images">
              <div class="image-container">
                <h4>Before</h4>
                <img src="../before/${item.file}" alt="Before" loading="lazy">
              </div>
              <div class="image-container">
                <h4>After</h4>
                <img src="../after/${item.file}" alt="After" loading="lazy">
              </div>
              <div class="image-container">
                <h4>Difference</h4>
                <img src="diff-${item.file}" alt="Difference" loading="lazy">
              </div>
            </div>
          ` : ''}
        </div>
      </div>
    `).join('')}
    
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
}

module.exports = ReportGenerator;