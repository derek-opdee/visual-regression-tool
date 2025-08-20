const chalk = require('chalk');
const ora = require('ora');
const VRT = require('../lib/vrt');

async function monitorCommand(url, options) {
  console.log(chalk.cyan('\n👁️  Visual Monitoring Started\n'));
  console.log(`URL: ${url}`);
  console.log(`Interval: ${options.interval} seconds`);
  console.log(`Threshold: ${(options.threshold * 100).toFixed(1)}%`);
  console.log(chalk.gray('\nPress Ctrl+C to stop monitoring\n'));

  const vrt = new VRT({
    aiEnabled: options.aiAlerts
  });

  // Initialize baseline
  let baseline = null;
  let checkCount = 0;
  let changesDetected = 0;

  async function performCheck() {
    checkCount++;
    const spinner = ora(`Check #${checkCount} - Capturing screenshots...`).start();

    try {
      // Capture current state
      const timestamp = new Date().toISOString().replace(/[:]/g, '-');
      const current = await vrt.capture(url, {
        outputDir: `monitoring/check-${timestamp}`,
        analyze: options.aiAlerts
      });

      if (!baseline) {
        // First run, set as baseline
        baseline = current;
        spinner.succeed(`Check #${checkCount} - Baseline established`);
        console.log(chalk.gray('Baseline screenshots captured'));
      } else {
        // Compare with baseline
        spinner.text = `Check #${checkCount} - Comparing with baseline...`;
        
        const results = await vrt.compare(
          baseline[0].path.replace(/[^\/]+\.png$/, ''), // Get directory from path
          current[0].path.replace(/[^\/]+\.png$/, ''),
          {
            threshold: parseFloat(options.threshold),
            aiAnalysis: options.aiAlerts
          }
        );

        if (!results.passed) {
          changesDetected++;
          spinner.warn(`Check #${checkCount} - Changes detected!`);
          
          console.log(chalk.yellow(`\n⚠️  Visual changes detected at ${new Date().toLocaleTimeString()}`));
          console.log(`Differences found: ${results.differences.length}`);
          
          results.differences.forEach(diff => {
            console.log(`  • ${diff.file}: ${(diff.difference * 100).toFixed(2)}% change`);
          });

          // AI Alert Classification
          if (options.aiAlerts && results.report[0]?.aiAnalysis) {
            const aiAnalysis = results.report[0].aiAnalysis;
            console.log(chalk.cyan('\n🤖 AI Analysis:'));
            console.log(`Severity: ${aiAnalysis.severity}`);
            console.log(`Summary: ${aiAnalysis.summary}`);
            
            if (aiAnalysis.severity === 'high') {
              console.log(chalk.red('\n🚨 HIGH SEVERITY CHANGE - Immediate attention required!'));
            }
          }

          // Send notifications if enabled
          if (options.notify) {
            await sendNotification(results, url);
          }

          // Auto-baseline update for minor changes
          if (options.autoBaseline && results.differences.every(d => d.difference < 0.05)) {
            console.log(chalk.gray('\n📸 Auto-updating baseline for minor changes...'));
            baseline = current;
          } else {
            // Ask user what to do
            console.log(chalk.yellow('\nWhat would you like to do?'));
            console.log('1. Continue monitoring with current baseline');
            console.log('2. Update baseline to current state');
            console.log('3. Stop monitoring');
            console.log(chalk.gray('(Continuing with current baseline in 30 seconds...)'));
            
            // In a real implementation, you'd handle user input here
            // For now, we'll continue with current baseline
          }
        } else {
          spinner.succeed(`Check #${checkCount} - No changes detected`);
        }
      }

      // Display summary
      console.log(chalk.gray(`\n📊 Summary: ${checkCount} checks, ${changesDetected} changes detected`));
      console.log(chalk.gray(`Next check in ${options.interval} seconds...\n`));

    } catch (error) {
      spinner.fail(`Check #${checkCount} - Failed`);
      console.error(chalk.red('Error:'), error.message);
    }
  }

  // Perform initial check
  await performCheck();

  // Set up interval for continuous monitoring
  const intervalId = setInterval(performCheck, options.interval * 1000);

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log(chalk.yellow('\n\n👋 Stopping monitor...'));
    clearInterval(intervalId);
    
    console.log(chalk.cyan('\n📊 Monitoring Summary:'));
    console.log(`Total checks: ${checkCount}`);
    console.log(`Changes detected: ${changesDetected}`);
    console.log(`Detection rate: ${((changesDetected / checkCount) * 100).toFixed(1)}%`);
    
    process.exit(0);
  });

  // Keep process alive
  process.stdin.resume();
}

async function sendNotification(results, url) {
  // This is a placeholder for notification functionality
  // In a real implementation, you would:
  // 1. Send email notifications
  // 2. Post to Slack/Teams webhooks
  // 3. Trigger other alerting systems
  
  console.log(chalk.blue('\n📧 Notification sent (simulated)'));
  console.log(`Subject: Visual changes detected on ${url}`);
  console.log(`Differences: ${results.differences.length}`);
}

module.exports = monitorCommand;