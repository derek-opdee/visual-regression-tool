const chalk = require('chalk');
const ora = require('ora');
const fs = require('fs').promises;
const path = require('path');
const VRT = require('../../lib/vrt');

async function suggestFixesCommand(comparisonDir) {
  const spinner = ora('Analyzing differences and generating CSS fixes...').start();
  
  try {
    const vrt = new VRT({ aiEnabled: true });
    
    // Read comparison results
    const reportPath = path.join(comparisonDir, 'comparison-report.json');
    let comparisonData;
    
    try {
      const reportContent = await fs.readFile(reportPath, 'utf8');
      comparisonData = JSON.parse(reportContent);
    } catch (error) {
      // If no report file, analyze the images directly
      spinner.text = 'No report found, analyzing images directly...';
      
      const beforeDir = path.join(comparisonDir, '..', 'before');
      const afterDir = path.join(comparisonDir, '..', 'after');
      
      const results = await vrt.compare(beforeDir, afterDir, {
        aiAnalysis: true,
        suggestFixes: true
      });
      
      comparisonData = results;
    }
    
    spinner.succeed('Analysis complete!');
    
    console.log(chalk.cyan('\n🔧 AI-Generated CSS Fix Suggestions\n'));
    
    if (!comparisonData.report || comparisonData.report.length === 0) {
      console.log(chalk.yellow('No differences found to suggest fixes for.'));
      return;
    }
    
    // Generate consolidated CSS fixes
    const allFixes = {};
    let totalSuggestions = 0;
    
    comparisonData.report.forEach(item => {
      if (item.suggestedFixes && item.suggestedFixes.length > 0) {
        const component = item.file.replace('.png', '').replace(/-/g, '_');
        allFixes[component] = item.suggestedFixes;
        totalSuggestions += item.suggestedFixes.length;
      }
    });
    
    if (totalSuggestions === 0) {
      console.log(chalk.yellow('No CSS fixes needed - differences may be intentional.'));
      return;
    }
    
    console.log(chalk.green(`Generated ${totalSuggestions} CSS fix suggestions:\n`));
    
    // Display fixes by component
    Object.entries(allFixes).forEach(([component, fixes]) => {
      console.log(chalk.yellow(`/* ${component.replace(/_/g, ' ').toUpperCase()} */`));
      fixes.forEach(fix => {
        console.log(fix);
      });
      console.log('');
    });
    
    // Save fixes to file
    const cssFixesPath = path.join(comparisonDir, 'suggested-fixes.css');
    const cssContent = Object.entries(allFixes)
      .map(([component, fixes]) => `/* ${component.replace(/_/g, ' ').toUpperCase()} */\n${fixes.join('\n')}`)
      .join('\n\n');
    
    await fs.writeFile(cssFixesPath, cssContent);
    
    console.log(chalk.green(`\n✅ CSS fixes saved to: ${cssFixesPath}`));
    
    // Provide additional recommendations
    console.log(chalk.cyan('\n💡 Additional Recommendations:\n'));
    console.log('1. Review each suggestion carefully - not all may be applicable');
    console.log('2. Test fixes incrementally to ensure they don\'t break other components');
    console.log('3. Consider using CSS variables for consistency across components');
    console.log('4. Run visual regression tests after applying fixes');
    
  } catch (error) {
    spinner.fail('Fix suggestion failed');
    console.error(chalk.red('Error:'), error.message);
    process.exit(1);
  }
}

module.exports = suggestFixesCommand;