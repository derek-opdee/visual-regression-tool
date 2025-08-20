const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Define baseline and current directories
const baselineTimestamp = '2025-05-24T08-42-20';
const currentTimestamp = '2025-05-24T09-20-27';

const pages = ['business-listing', 'home-page', 'individual-listing'];
const viewports = ['mobile', 'tablet', 'desktop'];

console.log('🔍 Running comprehensive visual regression comparison...\n');

// Create main report directory
const mainReportDir = `migration-report-${new Date().toISOString().split('T')[0]}`;
if (!fs.existsSync(mainReportDir)) {
  fs.mkdirSync(mainReportDir, { recursive: true });
}

const summaryResults = [];

// Compare each page and viewport combination
for (const page of pages) {
  for (const viewport of viewports) {
    const baselineDir = `baseline-screenshots/${baselineTimestamp}/${page}/${viewport}`;
    const currentDir = `post-migration-screenshots/${currentTimestamp}/${page}/${viewport}`;
    const outputDir = `${mainReportDir}/${page}-${viewport}`;
    
    console.log(`\n📸 Comparing ${page} - ${viewport}...`);
    
    if (fs.existsSync(baselineDir) && fs.existsSync(currentDir)) {
      try {
        // Run batch comparison
        const result = execSync(
          `node batch-compare.js "${baselineDir}" "${currentDir}" "${outputDir}"`,
          { encoding: 'utf8' }
        );
        
        // Extract summary from result
        const lines = result.split('\n');
        const totalLine = lines.find(l => l.includes('Total images compared:'));
        const identicalLine = lines.find(l => l.includes('Identical:'));
        const differentLine = lines.find(l => l.includes('Different:'));
        
        if (totalLine && identicalLine && differentLine) {
          const total = parseInt(totalLine.match(/\d+/)[0]);
          const identical = parseInt(identicalLine.match(/\d+/)[0]);
          const different = parseInt(differentLine.match(/\d+/)[0]);
          
          summaryResults.push({
            page,
            viewport,
            total,
            identical,
            different,
            percentIdentical: total > 0 ? ((identical / total) * 100).toFixed(1) : 0
          });
          
          console.log(`  ✅ Comparison complete: ${identical}/${total} identical`);
        }
      } catch (error) {
        console.error(`  ❌ Error comparing ${page} - ${viewport}:`, error.message);
      }
    } else {
      console.log(`  ⚠️  Skipping - directories don't exist`);
    }
  }
}

// Generate summary report
console.log('\n📊 VISUAL REGRESSION SUMMARY');
console.log('============================\n');

let allIdentical = true;

summaryResults.forEach(result => {
  const status = result.different === 0 ? '✅' : '⚠️';
  console.log(`${status} ${result.page} - ${result.viewport}: ${result.percentIdentical}% identical (${result.identical}/${result.total})`);
  if (result.different > 0) allIdentical = false;
});

// Create summary HTML report
const summaryHtml = `
<!DOCTYPE html>
<html>
<head>
    <title>Tailwind Migration Visual Regression Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        h1 { color: #333; }
        .summary { background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .success { color: #28a745; }
        .warning { color: #ffc107; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background-color: #f2f2f2; }
        .status-icon { font-size: 20px; }
    </style>
</head>
<body>
    <h1>Bootstrap to Tailwind Migration - Visual Regression Report</h1>
    <div class="summary">
        <h2>Overall Status: ${allIdentical ? '<span class="success">✅ All Tests Passed</span>' : '<span class="warning">⚠️ Visual Differences Detected</span>'}</h2>
        <p>Date: ${new Date().toISOString()}</p>
        <p>Baseline: ${baselineTimestamp}</p>
        <p>Current: ${currentTimestamp}</p>
    </div>
    
    <h2>Detailed Results</h2>
    <table>
        <thead>
            <tr>
                <th>Status</th>
                <th>Page</th>
                <th>Viewport</th>
                <th>Total Images</th>
                <th>Identical</th>
                <th>Different</th>
                <th>Match %</th>
                <th>Report</th>
            </tr>
        </thead>
        <tbody>
            ${summaryResults.map(r => `
                <tr>
                    <td class="status-icon">${r.different === 0 ? '✅' : '⚠️'}</td>
                    <td>${r.page}</td>
                    <td>${r.viewport}</td>
                    <td>${r.total}</td>
                    <td>${r.identical}</td>
                    <td>${r.different}</td>
                    <td>${r.percentIdentical}%</td>
                    <td><a href="${r.page}-${r.viewport}/comparison-report.html">View Report</a></td>
                </tr>
            `).join('')}
        </tbody>
    </table>
</body>
</html>
`;

fs.writeFileSync(path.join(mainReportDir, 'index.html'), summaryHtml);

console.log(`\n✨ Migration visual regression testing complete!`);
console.log(`📁 Full report available at: ${path.join(__dirname, mainReportDir, 'index.html')}`);

if (allIdentical) {
  console.log('\n🎉 Great job! The Tailwind migration maintained visual consistency across all pages and viewports.');
} else {
  console.log('\n⚠️  Some visual differences were detected. Please review the detailed reports.');
}