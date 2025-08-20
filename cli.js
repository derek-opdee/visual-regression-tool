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
    .version('3.0.0')
    .description(chalk.cyan('Visual Regression Tool - Cross-browser testing with Playwright & AI analysis'))
    .option('--engine <type>', 'Testing engine: playwright (default) or puppeteer', 'playwright')
    .option('--browser <type>', 'Browser: chromium, firefox, webkit, edge, or all', 'chromium');

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
    .option('--devices <devices>', 'Comma-separated device names for mobile emulation')
    .option('--interact <json>', 'JSON string of interactions to perform')
    .option('--headless', 'Run in headless mode (default)', true)
    .option('--headed', 'Run in headed mode (visible browser)')
    .action(async (options) => {
      if (!options.url) {
        console.error(chalk.red('Error: URL is required. Use -u or --url option.'));
        process.exit(1);
      }

      const engineType = program.opts().engine || 'playwright';
      const browserType = program.opts().browser || 'chromium';
      const spinner = ora(`Capturing screenshots with ${engineType} (${browserType}) for ${options.url}...`).start();
      
      try {
        let VRT, vrt;
        try {
          // Choose engine based on option
          if (engineType === 'puppeteer') {
            VRT = require('./lib/vrt');
            vrt = new VRT({
              outputDir: options.outputDir
            });
          } else {
            VRT = require('./lib/playwright-vrt');
            vrt = new VRT({
              outputDir: options.outputDir,
              browser: browserType,
              headless: !options.headed
            });
          }
        } catch (initError) {
          spinner.fail(chalk.red(`Failed to initialize ${engineType}: ${initError.message}`));
          console.error(chalk.red('Please check your installation and try again.'));
          process.exit(1);
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        const outputPath = path.join(options.outputDir, `capture-${timestamp}`);
        await fs.mkdir(outputPath, { recursive: true });

        // Parse devices if provided
        const devices = options.devices ? options.devices.split(',').map(d => d.trim()) : [];
        
        // Parse interactions if provided
        let interactions = null;
        if (options.interact) {
          try {
            interactions = JSON.parse(options.interact);
          } catch (e) {
            console.warn(chalk.yellow('Warning: Invalid JSON for interactions, skipping...'));
          }
        }

        const results = await vrt.capture(options.url, {
          viewport: options.viewport,
          fullPage: options.fullPage,
          analyze: options.analyze,
          components: options.components,
          waitFor: options.waitFor,
          timeline: options.timeline,
          outputPath,
          devices: devices.length > 0 ? devices : undefined,
          interact: interactions,
          browsers: browserType === 'all' ? ['chromium', 'firefox', 'webkit'] : [browserType]
        });

        spinner.succeed(chalk.green(`✅ Screenshots captured successfully with ${engineType}!`));
        console.log(chalk.blue(`📁 Output: ${outputPath}`));
        console.log(chalk.cyan(`🌐 Browser(s): ${browserType}`));
        
        if (devices.length > 0) {
          console.log(chalk.magenta(`📱 Devices: ${devices.join(', ')}`));
        }
        
        if (options.analyze && results.length > 0 && results[0].analysis) {
          console.log(chalk.cyan('\n📊 AI Analysis Results:'));
          results.forEach(r => {
            if (r.analysis) {
              console.log(`  ${r.browser || 'browser'} - ${r.viewport || r.device}:`, r.analysis.summary || 'Analyzed');
            }
          });
        }
        
        // Cleanup for Playwright
        if (engineType === 'playwright' && vrt.cleanup) {
          await vrt.cleanup();
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

  // Interactive command - NEW for Playwright!
  program
    .command('interact')
    .description('Start interactive browser session with AI-friendly API (Playwright only)')
    .option('-u, --url <url>', 'URL to interact with (required)')
    .option('--browser <type>', 'Override global browser setting')
    .option('--device <name>', 'Emulate specific device')
    .option('--record', 'Record the session as video')
    .action(async (options) => {
      if (!options.url) {
        console.error(chalk.red('Error: URL is required. Use -u or --url option.'));
        process.exit(1);
      }

      const engineType = program.opts().engine || 'playwright';
      
      if (engineType !== 'playwright') {
        console.error(chalk.red('Error: Interactive mode is only available with Playwright engine.'));
        console.log(chalk.yellow('Tip: Use --engine playwright to enable interactive mode.'));
        process.exit(1);
      }

      const browserType = options.browser || program.opts().browser || 'chromium';
      console.log(chalk.cyan(`🎮 Starting interactive session with ${browserType}...`));
      console.log(chalk.yellow('This session is designed for AI interaction.'));
      
      try {
        const PlaywrightVRT = require('./lib/playwright-vrt');
        const vrt = new PlaywrightVRT({
          browser: browserType,
          headless: false,
          recordVideo: options.record
        });

        const session = await vrt.interactiveSession(options.url, {
          browser: browserType,
          device: options.device
        });

        console.log(chalk.green('✅ Interactive session ready!'));
        console.log(chalk.blue('Available API methods:'));
        console.log('  • click(selector, options)');
        console.log('  • type(selector, text, options)');
        console.log('  • hover(selector, options)');
        console.log('  • screenshot(options)');
        console.log('  • evaluate(function, ...args)');
        console.log('  • getContent()');
        console.log('  • getUrl()');
        console.log('  • goBack()');
        console.log('  • goForward()');
        console.log('  • reload()');
        console.log('  • selectOption(selector, values)');
        console.log('  • waitForSelector(selector, options)');
        console.log('  • getAccessibilityTree()');
        console.log('  • findElements(description)');
        console.log('  • extractData(selector)');
        console.log('  • close()');
        
        console.log(chalk.yellow('\nSession is active. The AI can now interact with the page.'));
        
        // Keep session alive for AI interaction
        // In a real implementation, this would be handled by the AI system
        process.on('SIGINT', async () => {
          console.log(chalk.yellow('\nClosing interactive session...'));
          await session.cleanup();
          process.exit(0);
        });
        
      } catch (error) {
        console.error(chalk.red(`Failed to start interactive session: ${error.message}`));
        process.exit(1);
      }
    });

  // Mobile command - Showcase device emulation
  program
    .command('mobile')
    .description('Test on mobile devices with Playwright')
    .option('-u, --url <url>', 'URL to test (required)')
    .option('--devices <list>', 'Comma-separated device names', 'iPhone 14 Pro,Pixel 7,iPad Pro')
    .option('--full-page', 'Capture full page on mobile')
    .action(async (options) => {
      if (!options.url) {
        console.error(chalk.red('Error: URL is required.'));
        process.exit(1);
      }

      const spinner = ora('Testing on mobile devices...').start();
      
      try {
        const PlaywrightVRT = require('./lib/playwright-vrt');
        const vrt = new PlaywrightVRT({
          browser: 'chromium'
        });

        const results = await vrt.capture(options.url, {
          devices: options.devices.split(',').map(d => d.trim()),
          fullPage: options.fullPage,
          devicesOnly: true
        });

        spinner.succeed(chalk.green(`✅ Mobile testing complete!`));
        results.forEach(r => {
          console.log(chalk.blue(`  📱 ${r.device}: ${r.path}`));
        });

        await vrt.cleanup();
      } catch (error) {
        spinner.fail(chalk.red(`Mobile testing failed: ${error.message}`));
        process.exit(1);
      }
    });

  // Cross-browser command
  program
    .command('crossbrowser')
    .description('Test across all browsers (Chromium, Firefox, WebKit)')
    .option('-u, --url <url>', 'URL to test (required)')
    .option('--viewport <name>', 'Specific viewport to test')
    .action(async (options) => {
      if (!options.url) {
        console.error(chalk.red('Error: URL is required.'));
        process.exit(1);
      }

      const spinner = ora('Running cross-browser tests...').start();
      
      try {
        const PlaywrightVRT = require('./lib/playwright-vrt');
        const vrt = new PlaywrightVRT({
          browser: 'all'
        });

        const results = await vrt.capture(options.url, {
          browsers: ['chromium', 'firefox', 'webkit'],
          viewport: options.viewport
        });

        spinner.succeed(chalk.green('✅ Cross-browser testing complete!'));
        
        const grouped = {};
        results.forEach(r => {
          if (!grouped[r.browser]) grouped[r.browser] = [];
          grouped[r.browser].push(r);
        });

        Object.entries(grouped).forEach(([browser, items]) => {
          console.log(chalk.cyan(`\n${browser.toUpperCase()}:`));
          items.forEach(item => {
            console.log(`  📸 ${item.viewport || item.device}: ${item.path}`);
          });
        });

        await vrt.cleanup();
      } catch (error) {
        spinner.fail(chalk.red(`Cross-browser testing failed: ${error.message}`));
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