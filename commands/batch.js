const chalk = require('chalk');
const ora = require('ora');
const fs = require('fs').promises;
const VRT = require('../lib/vrt');

async function batchCommand(configFile, options) {
  const spinner = ora('Loading batch configuration...').start();
  
  try {
    // Read config file
    const configContent = await fs.readFile(configFile, 'utf8');
    const config = JSON.parse(configContent);
    
    spinner.succeed('Configuration loaded');
    
    console.log(chalk.cyan('\n📦 Batch Processing\n'));
    console.log(`Tests to run: ${config.tests?.length || 0}`);
    console.log(`Parallel instances: ${options.parallel || 1}`);
    
    const vrt = new VRT({
      parallel: true,
      maxParallel: parseInt(options.parallel) || 4
    });
    
    if (options.incremental) {
      console.log(chalk.yellow('Incremental mode: Only testing changed files'));
    }
    
    // Process batch
    const results = await vrt.batch(config.tests || [], {
      parallel: parseInt(options.parallel) || 4,
      incremental: options.incremental
    });
    
    console.log(chalk.green(`\n✅ Batch complete: ${results.length} tests processed`));
    
  } catch (error) {
    spinner.fail('Batch processing failed');
    console.error(chalk.red('Error:'), error.message);
    process.exit(1);
  }
}

module.exports = batchCommand;