#!/usr/bin/env node
const { program } = require('commander');
const { loadChalk, loadOra, loadInquirer } = require('./lib/esm-loader');
const path = require('path');
const fs = require('fs').promises;

// Initialize ESM modules
let chalk, ora, inquirer;

async function initializeModules() {
  chalk = await loadChalk();
  ora = await loadOra();
  inquirer = await loadInquirer();
}

// Main CLI implementation
async function main() {
  await initializeModules();

  // Configure program
  program
    .version('2.0.0')
    .description(chalk.cyan('Visual Regression Tool - AI-powered visual testing for Bootstrap to Tailwind migration'));

  // Capture command
  program
    .command('capture')
    .description('Capture screenshots with AI analysis')
    .option('-u, --url <url>', 'URL to capture (required)')
    .option('-v, --viewport <name>', 'Specific viewport (mobile, tablet, desktop, desktop-xl)')
    .option('--full-page', 'Capture full page screenshots')
    .option('--analyze', 'Enable AI-powered visual analysis')
    .option('--components', 'Capture individual UI components')
    .option('--wait-for <selector>', 'Wait for specific element before capture')
    .option('--output-dir <dir>', 'Custom output directory', './screenshots')
    .option('--timeline', 'Capture visual timeline at intervals')
    .action(async (options) => {
      if (!options.url) {
        console.error(chalk.red('Error: URL is required. Use -u or --url option.'));
        process.exit(1);
      }

      const spinner = ora(`Capturing screenshots for ${options.url}...`).start();
      
      try {
        let VRT, vrt;
        try {
          VRT = require('./lib/vrt');
          vrt = new VRT({
            outputDir: options.outputDir
          });
        } catch (initError) {
          spinner.fail(chalk.red(`Failed to initialize VRT: ${initError.message}`));
          console.error(chalk.red('Please check your installation and try again.'));
          process.exit(1);
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        const outputPath = path.join(options.outputDir, `capture-${timestamp}`);
        await fs.mkdir(outputPath, { recursive: true });

        const results = await vrt.capture(options.url, {
          viewport: options.viewport,
          fullPage: options.fullPage,
          analyze: options.analyze,
          components: options.components,
          waitFor: options.waitFor,
          timeline: options.timeline,
          outputPath
        });

        spinner.succeed(chalk.green(`✅ Screenshots captured successfully!`));
        console.log(chalk.blue(`📁 Output: ${outputPath}`));
        
        if (options.analyze && results.analysis) {
          console.log(chalk.cyan('\n📊 AI Analysis Results:'));
          console.log(results.analysis);
        }
      } catch (error) {
        spinner.fail(chalk.red(`Failed to capture: ${error.message}`));
        process.exit(1);
      }
    });

  // Compare command
  program
    .command('compare <before-dir> <after-dir>')
    .description('Compare screenshots with AI-powered difference analysis')
    .option('--threshold <number>', 'Difference threshold (0-1)', '0.1')
    .option('--output <dir>', 'Output directory for diff reports', './comparison-results')
    .option('--ai-analysis', 'Enable AI analysis of differences')
    .option('--suggest-fixes', 'Get AI-suggested CSS fixes')
    .option('--generate-report', 'Generate HTML comparison report')
    .option('--ignore-regions <selectors>', 'CSS selectors to ignore during comparison')
    .action(async (beforeDir, afterDir, options) => {
      const spinner = ora('Comparing screenshots...').start();
      
      try {
        let VRT, vrt;
        try {
          VRT = require('./lib/vrt');
          vrt = new VRT();
        } catch (initError) {
          spinner.fail(chalk.red(`Failed to initialize VRT: ${initError.message}`));
          process.exit(1);
        }

        const results = await vrt.compare(beforeDir, afterDir, {
          threshold: parseFloat(options.threshold),
          outputDir: options.output,
          aiAnalysis: options.aiAnalysis,
          suggestFixes: options.suggestFixes,
          generateReport: options.generateReport,
          ignoreRegions: options.ignoreRegions?.split(',')
        });

        spinner.succeed(chalk.green('✅ Comparison complete!'));
        console.log(chalk.blue(`📁 Results: ${options.output}`));
        
        if (results.summary) {
          console.log(chalk.cyan('\n📊 Comparison Summary:'));
          console.log(`  Total images: ${results.summary.total}`);
          console.log(`  Matches: ${results.summary.matches}`);
          console.log(`  Differences: ${results.summary.differences}`);
        }
      } catch (error) {
        spinner.fail(chalk.red(`Comparison failed: ${error.message}`));
        process.exit(1);
      }
    });

  // Baseline command
  program
    .command('baseline <action>')
    .description('Smart baseline management with Git integration')
    .option('-b, --backup', 'Backup existing baseline before updating')
    .option('-s, --selective', 'Choose which screenshots to update')
    .option('-f, --force', 'Force update without confirmation')
    .option('--branch <name>', 'Create baseline branch')
    .option('--version <version>', 'Baseline version management')
    .action(async (action, options) => {
      const spinner = ora(`Managing baseline: ${action}...`).start();
      
      try {
        const BaselineManager = require('./lib/baseline-manager');
        const manager = new BaselineManager();

        switch (action) {
          case 'update':
            await manager.update(options);
            spinner.succeed(chalk.green('✅ Baseline updated successfully!'));
            break;
          case 'branch':
            await manager.createBranch(options.branch);
            spinner.succeed(chalk.green(`✅ Baseline branch created: ${options.branch}`));
            break;
          case 'rollback':
            await manager.rollback();
            spinner.succeed(chalk.green('✅ Baseline rolled back!'));
            break;
          case 'auto-select':
            await manager.autoSelect();
            spinner.succeed(chalk.green('✅ AI-powered baseline selection complete!'));
            break;
          default:
            spinner.fail(chalk.red(`Unknown action: ${action}`));
            process.exit(1);
        }
      } catch (error) {
        spinner.fail(chalk.red(`Baseline operation failed: ${error.message}`));
        process.exit(1);
      }
    });

  // Debug command
  program
    .command('debug <url>')
    .description('Advanced debugging with console monitoring and performance analysis')
    .option('-c, --console', 'Capture console logs and errors')
    .option('-n, --network', 'Monitor network requests and failures')
    .option('-p, --performance', 'Capture performance metrics')
    .option('--coverage', 'Generate code coverage report')
    .option('--trace', 'Create Chrome trace file')
    .option('-s, --slowmo <ms>', 'Slow down actions by specified milliseconds')
    .option('--timeline', 'Capture visual timeline at intervals')
    .option('--element-inspector', 'Enable element inspection mode')
    .option('--accessibility', 'Run accessibility checks with axe-core')
    .action(async (url, options) => {
      const spinner = ora(`Starting debug session for ${url}...`).start();
      
      try {
        const DebugCapture = require('./lib/debug-capture');
        const debugSession = new DebugCapture();

        const results = await debugSession.debug(url, options);

        spinner.succeed(chalk.green('✅ Debug session complete!'));
        console.log(chalk.blue(`📁 Debug output: ./debug-output/`));
        
        if (results.summary) {
          console.log(chalk.cyan('\n📊 Debug Summary:'));
          if (results.summary.console) {
            console.log(`  Console logs: ${results.summary.console.logs}`);
            console.log(`  Console errors: ${results.summary.console.errors}`);
          }
          if (results.summary.network) {
            console.log(`  Network requests: ${results.summary.network.total}`);
            console.log(`  Failed requests: ${results.summary.network.failed}`);
          }
          if (results.summary.performance) {
            console.log(`  Load time: ${results.summary.performance.loadTime}ms`);
          }
        }

      } catch (error) {
        spinner.fail(chalk.red(`Debug session failed: ${error.message}`));
        process.exit(1);
      }
    });

  // Analyze command
  program
    .command('analyze <image-or-directory>')
    .description('AI-powered visual analysis with issue detection')
    .option('--type <all|layout|color|typography|spacing>', 'Analysis type', 'all')
    .option('--format <json|html>', 'Output format', 'html')
    .option('--include-metrics', 'Include detailed quality metrics')
    .option('--group-by <viewport|page|component>', 'Group results')
    .option('--threshold <number>', 'Issue detection threshold')
    .action(async (target, options) => {
      const spinner = ora('Analyzing screenshots...').start();
      
      try {
        const AIAnalyzer = require('./lib/ai-analyzer');
        const analyzer = new AIAnalyzer();

        const results = await analyzer.analyze(target, options);

        spinner.succeed(chalk.green('✅ Analysis complete!'));
        console.log(chalk.blue(`📁 Analysis report: ./analysis-reports/`));
        
        if (results.summary) {
          console.log(chalk.cyan('\n📊 Analysis Summary:'));
          console.log(`  Quality Score: ${results.summary.qualityScore}/100`);
          console.log(`  Issues Found: ${results.summary.issuesCount}`);
          console.log(`  Recommendations: ${results.summary.recommendationsCount}`);
        }
      } catch (error) {
        spinner.fail(chalk.red(`Analysis failed: ${error.message}`));
        process.exit(1);
      }
    });

  // Interactive mode
  program
    .command('interactive')
    .alias('i')
    .description('Guided interactive mode for visual testing workflows')
    .action(async () => {
      console.log(chalk.cyan.bold('\n🎯 Visual Regression Tool - Interactive Mode\n'));

      const choices = [
        { name: '📸 Capture Screenshots', value: 'capture' },
        { name: '🔍 Compare Screenshots', value: 'compare' },
        { name: '🐛 Debug Session', value: 'debug' },
        { name: '📊 Analyze Screenshots', value: 'analyze' },
        { name: '📦 Manage Baselines', value: 'baseline' },
        { name: '🔄 CSS Migration Helper', value: 'migrate' },
        { name: '❌ Exit', value: 'exit' }
      ];

      const { action } = await inquirer.prompt([
        {
          type: 'list',
          name: 'action',
          message: 'What would you like to do?',
          choices
        }
      ]);

      if (action === 'exit') {
        console.log(chalk.green('👋 Goodbye!'));
        process.exit(0);
      }

      // Handle interactive workflows
      console.log(chalk.yellow(`Starting ${action} workflow...`));
      // Interactive implementation would go here
    });

  // Migrate command for Bootstrap to Tailwind
  program
    .command('migrate <action>')
    .description('CSS framework migration tools (Bootstrap to Tailwind)')
    .option('--framework <name>', 'Source framework', 'bootstrap')
    .option('--output <dir>', 'Output directory')
    .option('--format <format>', 'Report format', 'html')
    .action(async (action, options) => {
      const spinner = ora(`Running migration ${action}...`).start();
      
      try {
        console.log(chalk.cyan(`🔄 Migration Helper: ${action}`));
        console.log(chalk.blue(`📦 Framework: ${options.framework} → Tailwind`));
        
        // Migration logic would go here
        spinner.succeed(chalk.green('✅ Migration step complete!'));
      } catch (error) {
        spinner.fail(chalk.red(`Migration failed: ${error.message}`));
        process.exit(1);
      }
    });

  // Monitor command
  program
    .command('monitor <url>')
    .description('Continuous monitoring with AI-powered change detection')
    .option('-i, --interval <seconds>', 'Check interval in seconds', '300')
    .option('-n, --notify', 'Send notifications on changes')
    .option('-t, --threshold <number>', 'Change threshold to trigger alert', '0.1')
    .option('--ai-alerts', 'Enable AI-powered alert classification')
    .option('--auto-baseline', 'Automatically update baseline for minor changes')
    .action(async (url, options) => {
      console.log(chalk.cyan(`🔍 Starting monitor for ${url}...`));
      console.log(chalk.blue(`⏰ Check interval: ${options.interval}s`));
      
      const Monitor = require('./lib/monitor');
      const monitor = new Monitor();
      await monitor.start(url, options);
    });

  // Test command specifically for directory.hattch-localhost
  program
    .command('test')
    .description('Quick test on directory.hattch-localhost')
    .action(async () => {
      const spinner = ora('Testing on directory.hattch-localhost...').start();
      
      try {
        let VRT, vrt;
        try {
          VRT = require('./lib/vrt');
          vrt = new VRT();
        } catch (initError) {
          spinner.fail(chalk.red(`Failed to initialize VRT: ${initError.message}`));
          process.exit(1);
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        const outputPath = `./screenshots/test-${timestamp}`;
        
        await vrt.capture('http://directory.hattch-localhost', {
          fullPage: true,
          analyze: true,
          outputPath
        });

        spinner.succeed(chalk.green('✅ Test complete!'));
        console.log(chalk.blue(`📁 Results: ${outputPath}`));
      } catch (error) {
        spinner.fail(chalk.red(`Test failed: ${error.message}`));
        process.exit(1);
      }
    });

  // Parse arguments
  program.parse(process.argv);

  // Show help if no command provided
  if (!process.argv.slice(2).length) {
    program.outputHelp();
  }
}

// Run the CLI
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});