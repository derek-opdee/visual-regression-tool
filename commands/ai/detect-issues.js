const chalk = require('chalk');
const ora = require('ora');
const VRT = require('../../lib/vrt');

async function detectIssuesCommand(url, options) {
  const spinner = ora('Detecting visual issues with AI...').start();
  
  try {
    const vrt = new VRT({ aiEnabled: true });
    
    const types = options.types ? options.types.split(',') : ['all'];
    
    spinner.text = 'Capturing and analyzing page...';
    
    const results = await vrt.capture(url, {
      analyze: true,
      detectIssues: true,
      issueTypes: types
    });
    
    spinner.succeed('AI analysis complete!');
    
    console.log(chalk.cyan('\n🤖 AI Visual Issue Detection\n'));
    
    results.forEach(result => {
      if (result.analysis) {
        console.log(chalk.yellow(`${result.viewport}:`));
        if (result.analysis.issues.length === 0) {
          console.log(chalk.green('  ✅ No issues detected'));
        } else {
          result.analysis.issues.forEach(issue => {
            const color = issue.severity === 'high' ? 'red' : issue.severity === 'medium' ? 'yellow' : 'gray';
            console.log(chalk[color](`  • [${issue.severity.toUpperCase()}] ${issue.type}: ${issue.description}`));
            if (issue.suggestion) {
              console.log(chalk.green(`    💡 ${issue.suggestion}`));
            }
          });
        }
        console.log('');
      }
    });
    
  } catch (error) {
    spinner.fail('Issue detection failed');
    console.error(chalk.red('Error:'), error.message);
    process.exit(1);
  }
}

module.exports = detectIssuesCommand;