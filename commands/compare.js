const chalk = require('chalk');
const ora = require('ora');
const path = require('path');
const VRT = require('../lib/vrt');

async function compareCommand(before, after, options) {
  const spinner = ora('Comparing screenshots...').start();
  
  try {
    const vrt = new VRT({
      aiEnabled: options.aiAnalysis || options.suggestFixes
    });

    const results = await vrt.compare(before, after, {
      threshold: parseFloat(options.threshold),
      output: options.output,
      highlightColor: options.highlightColor,
      generateReport: options.generateReport,
      aiAnalysis: options.aiAnalysis,
      suggestFixes: options.suggestFixes
    });

    spinner.succeed('Comparison complete!');

    // Display results
    const status = results.passed ? chalk.green('✅ PASSED') : chalk.red('❌ FAILED');
    console.log(`\n${status} - Visual Regression Test\n`);
    
    console.log(`📊 Summary:`);
    console.log(`  Total images compared: ${results.totalImages}`);
    console.log(`  Differences found: ${results.differences.length}`);
    console.log(`  Threshold: ${options.threshold * 100}%`);

    if (results.differences.length > 0) {
      console.log(chalk.yellow('\n⚠️  Differences detected:\n'));
      
      results.differences.forEach((diff, index) => {
        console.log(`${index + 1}. ${chalk.cyan(diff.file)}`);
        console.log(`   Difference: ${chalk.red((diff.difference * 100).toFixed(2) + '%')}`);
        console.log(`   Diff image: ${diff.diffPath}`);
        
        // Find the full report for this file
        const fullReport = results.report.find(r => r.file === diff.file);
        
        if (fullReport?.aiAnalysis) {
          console.log(chalk.blue(`   AI Analysis: ${fullReport.aiAnalysis.summary}`));
          console.log(`   Severity: ${fullReport.aiAnalysis.severity}`);
          
          if (fullReport.aiAnalysis.affectedAreas.length > 0) {
            console.log('   Affected areas:');
            fullReport.aiAnalysis.affectedAreas.forEach(area => {
              console.log(`     - ${area.component}: ${area.changeType} (${area.percentage}%)`);
            });
          }
        }
        
        if (fullReport?.suggestedFixes && fullReport.suggestedFixes.length > 0) {
          console.log(chalk.green('   Suggested CSS fixes:'));
          console.log('   ```css');
          fullReport.suggestedFixes.slice(0, 5).forEach(fix => {
            console.log(`   ${fix}`);
          });
          if (fullReport.suggestedFixes.length > 5) {
            console.log(`   ... and ${fullReport.suggestedFixes.length - 5} more lines`);
          }
          console.log('   ```');
        }
        
        console.log('');
      });
    } else {
      console.log(chalk.green('\n✨ No visual differences detected! All screenshots match within the threshold.'));
    }

    if (options.generateReport) {
      const reportPath = path.join(options.output || 'comparison-results', 'report.html');
      console.log(chalk.blue(`\n📄 HTML report generated: ${reportPath}`));
      console.log('Open the report in your browser for detailed visual comparison.');
    }

    // Exit with appropriate code
    process.exit(results.passed ? 0 : 1);

  } catch (error) {
    spinner.fail('Comparison failed');
    console.error(chalk.red('\nError:'), error.message);
    process.exit(1);
  }
}

module.exports = compareCommand;