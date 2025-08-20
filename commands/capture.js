const chalk = require('chalk');
const ora = require('ora');
const VRT = require('../lib/vrt');

async function captureCommand(options) {
  const spinner = ora('Initializing capture...').start();
  
  try {
    // Parse viewports
    const viewportNames = options.viewports.split(',').map(v => v.trim());
    const viewportMap = {
      mobile: { name: 'mobile', width: 375, height: 812, deviceScaleFactor: 2 },
      tablet: { name: 'tablet', width: 768, height: 1024, deviceScaleFactor: 2 },
      desktop: { name: 'desktop', width: 1440, height: 900, deviceScaleFactor: 1 },
      'desktop-xl': { name: 'desktop-xl', width: 1920, height: 1080, deviceScaleFactor: 1 }
    };

    const viewports = viewportNames.map(name => viewportMap[name]).filter(Boolean);

    // Initialize VRT with options
    const vrt = new VRT({
      baseUrl: options.url,
      viewports: viewports.length > 0 ? viewports : undefined,
      aiEnabled: options.analyze || options.timeline
    });

    // Parse pages if provided
    const pages = options.pages ? options.pages.split(',').map(p => p.trim()) : ['/'];

    spinner.text = 'Capturing screenshots...';

    const allResults = [];

    for (const page of pages) {
      const results = await vrt.capture(page, {
        outputDir: options.output,
        fullPage: options.fullPage,
        components: options.components,
        analyze: options.analyze,
        timeline: options.timeline,
        detectIssues: options.analyze,
        checkAccessibility: options.analyze
      });

      allResults.push(...results);
    }

    spinner.succeed(`Captured ${allResults.length} screenshots successfully!`);

    // Display results
    console.log(chalk.green('\n✅ Capture Complete\n'));
    console.log(`📁 Output directory: ${options.output || 'screenshots'}`);
    console.log(`📸 Total screenshots: ${allResults.length}`);
    console.log(`🖼️  Pages captured: ${pages.join(', ')}`);
    console.log(`📱 Viewports: ${viewportNames.join(', ')}`);

    // Display AI analysis if available
    if (options.analyze) {
      const analysisResults = allResults.filter(r => r.analysis);
      
      if (analysisResults.length > 0) {
        console.log(chalk.cyan('\n🤖 AI Analysis Summary:\n'));
        
        analysisResults.forEach(result => {
          console.log(chalk.yellow(`${result.url} (${result.viewport}):`));
          console.log(`  Summary: ${result.analysis.summary}`);
          console.log(`  Quality Score: ${result.analysis.score}/100`);
          
          if (result.analysis.issues.length > 0) {
            console.log(chalk.red(`  Issues: ${result.analysis.issues.length} found`));
            result.analysis.issues.slice(0, 3).forEach(issue => {
              console.log(`    - ${issue.type}: ${issue.description}`);
            });
            if (result.analysis.issues.length > 3) {
              console.log(`    ... and ${result.analysis.issues.length - 3} more`);
            }
          }
          console.log('');
        });
      }
    }

    // Display timeline info if captured
    if (options.timeline) {
      console.log(chalk.blue('\n🎬 Visual Timeline captured at intervals: 0ms, 500ms, 1000ms, 2000ms, 3000ms, 5000ms'));
      console.log('Timeline analysis available in the output directory.');
    }

  } catch (error) {
    spinner.fail('Capture failed');
    console.error(chalk.red('\nError:'), error.message);
    process.exit(1);
  }
}

module.exports = captureCommand;