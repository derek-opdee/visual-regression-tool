const inquirer = require('inquirer');
const chalk = require('chalk');
const ora = require('ora');
const VRT = require('../lib/vrt');

async function interactiveCommand() {
  console.log(chalk.cyan('\n🎯 Visual Regression Tool - Interactive Mode\n'));

  const { workflow } = await inquirer.prompt([
    {
      type: 'list',
      name: 'workflow',
      message: 'What would you like to do?',
      choices: [
        { name: '📸 Capture screenshots with AI analysis', value: 'capture' },
        { name: '🔍 Compare and analyze differences', value: 'compare' },
        { name: '🐛 Debug visual issues', value: 'debug' },
        { name: '📊 Run comprehensive analysis', value: 'analyze' },
        { name: '🔄 Manage baselines', value: 'baseline' },
        { name: '🚀 CSS Migration workflow', value: 'migrate' },
        { name: '📱 Test responsive design', value: 'responsive' },
        { name: '♿ Check accessibility', value: 'accessibility' },
        { name: '⚡ Performance analysis', value: 'performance' },
        { name: '❌ Exit', value: 'exit' }
      ]
    }
  ]);

  if (workflow === 'exit') {
    console.log(chalk.green('\n👋 Goodbye!\n'));
    process.exit(0);
  }

  const vrt = new VRT();

  switch (workflow) {
    case 'capture':
      await captureWorkflow(vrt);
      break;
    case 'compare':
      await compareWorkflow(vrt);
      break;
    case 'debug':
      await debugWorkflow(vrt);
      break;
    case 'analyze':
      await analyzeWorkflow(vrt);
      break;
    case 'baseline':
      await baselineWorkflow(vrt);
      break;
    case 'migrate':
      await migrateWorkflow(vrt);
      break;
    case 'responsive':
      await responsiveWorkflow(vrt);
      break;
    case 'accessibility':
      await accessibilityWorkflow(vrt);
      break;
    case 'performance':
      await performanceWorkflow(vrt);
      break;
  }

  // Ask if user wants to continue
  const { continueWork } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'continueWork',
      message: 'Would you like to perform another task?',
      default: true
    }
  ]);

  if (continueWork) {
    await interactiveCommand();
  } else {
    console.log(chalk.green('\n👋 Goodbye!\n'));
  }
}

async function captureWorkflow(vrt) {
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'url',
      message: 'Enter the URL to capture:',
      default: 'http://directory.hattch-localhost'
    },
    {
      type: 'checkbox',
      name: 'viewports',
      message: 'Select viewports to capture:',
      choices: [
        { name: 'Mobile (375x812)', value: 'mobile', checked: true },
        { name: 'Tablet (768x1024)', value: 'tablet', checked: true },
        { name: 'Desktop (1440x900)', value: 'desktop', checked: true },
        { name: 'Desktop XL (1920x1080)', value: 'desktop-xl' }
      ]
    },
    {
      type: 'checkbox',
      name: 'features',
      message: 'Select additional features:',
      choices: [
        { name: '🤖 AI Visual Analysis', value: 'analyze' },
        { name: '📄 Full page screenshots', value: 'fullPage' },
        { name: '🧩 Capture individual components', value: 'components' },
        { name: '🎬 Visual timeline', value: 'timeline' },
        { name: '📝 Console log capture', value: 'console' },
        { name: '🌐 Network monitoring', value: 'network' }
      ]
    }
  ]);

  const spinner = ora('Capturing screenshots...').start();

  try {
    const options = {
      analyze: answers.features.includes('analyze'),
      fullPage: answers.features.includes('fullPage'),
      components: answers.features.includes('components'),
      timeline: answers.features.includes('timeline'),
      console: answers.features.includes('console'),
      network: answers.features.includes('network')
    };

    // Filter viewports based on selection
    vrt.options.viewports = vrt.options.viewports.filter(v => 
      answers.viewports.includes(v.name)
    );

    const results = await vrt.capture(answers.url, options);
    
    spinner.succeed('Screenshots captured successfully!');

    // Display results
    console.log(chalk.green('\n✅ Capture Complete\n'));
    console.log(`📁 Output directory: ${results[0]?.url || 'screenshots'}`);
    console.log(`📸 Total screenshots: ${results.length}`);

    if (options.analyze && results[0]?.analysis) {
      console.log(chalk.yellow('\n🤖 AI Analysis Summary:'));
      console.log(results[0].analysis.summary);
      
      if (results[0].analysis.issues.length > 0) {
        console.log(chalk.red(`\n⚠️  ${results[0].analysis.issues.length} issues detected:`));
        results[0].analysis.issues.forEach((issue, i) => {
          console.log(`  ${i + 1}. ${issue.description} (${issue.severity})`);
        });
      }
    }

  } catch (error) {
    spinner.fail('Capture failed');
    console.error(chalk.red(error.message));
  }
}

async function compareWorkflow(vrt) {
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'before',
      message: 'Enter the baseline directory:',
      default: 'baseline-screenshots/current'
    },
    {
      type: 'input',
      name: 'after',
      message: 'Enter the current directory:',
      default: 'post-migration-screenshots/latest'
    },
    {
      type: 'number',
      name: 'threshold',
      message: 'Difference threshold (0-1):',
      default: 0.1
    },
    {
      type: 'checkbox',
      name: 'features',
      message: 'Select analysis features:',
      choices: [
        { name: '🤖 AI-powered analysis', value: 'aiAnalysis', checked: true },
        { name: '🔧 CSS fix suggestions', value: 'suggestFixes', checked: true },
        { name: '📊 Generate HTML report', value: 'generateReport', checked: true }
      ]
    }
  ]);

  const spinner = ora('Comparing screenshots...').start();

  try {
    const options = {
      threshold: answers.threshold,
      aiAnalysis: answers.features.includes('aiAnalysis'),
      suggestFixes: answers.features.includes('suggestFixes'),
      generateReport: answers.features.includes('generateReport')
    };

    const results = await vrt.compare(answers.before, answers.after, options);
    
    spinner.succeed('Comparison complete!');

    // Display results
    console.log(chalk[results.passed ? 'green' : 'red'](`\n${results.passed ? '✅' : '❌'} Comparison ${results.passed ? 'Passed' : 'Failed'}\n`));
    console.log(`Total images compared: ${results.totalImages}`);
    console.log(`Differences found: ${results.differences.length}`);

    if (results.differences.length > 0) {
      console.log(chalk.yellow('\n📋 Differences:'));
      results.differences.forEach((diff, i) => {
        console.log(`  ${i + 1}. ${diff.file} - ${(diff.difference * 100).toFixed(2)}% difference`);
      });

      // Show AI analysis if available
      const firstDiff = results.report.find(r => r.aiAnalysis);
      if (firstDiff?.aiAnalysis) {
        console.log(chalk.cyan('\n🤖 AI Analysis:'));
        console.log(`Summary: ${firstDiff.aiAnalysis.summary}`);
        console.log(`Severity: ${firstDiff.aiAnalysis.severity}`);
      }
    }

    if (options.generateReport) {
      console.log(chalk.green('\n📊 HTML report generated: comparison-results/report.html'));
    }

  } catch (error) {
    spinner.fail('Comparison failed');
    console.error(chalk.red(error.message));
  }
}

async function debugWorkflow(vrt) {
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'url',
      message: 'Enter the URL to debug:',
      default: 'http://directory.hattch-localhost'
    },
    {
      type: 'checkbox',
      name: 'features',
      message: 'Select debug features:',
      choices: [
        { name: '📝 Console logs', value: 'console', checked: true },
        { name: '🌐 Network activity', value: 'network', checked: true },
        { name: '⚡ Performance metrics', value: 'performance', checked: true },
        { name: '🎬 Visual timeline', value: 'timeline' },
        { name: '♿ Accessibility check', value: 'accessibility' },
        { name: '🔍 Element inspector', value: 'elementInspector' }
      ]
    },
    {
      type: 'number',
      name: 'slowmo',
      message: 'Slow motion delay (ms):',
      default: 0
    }
  ]);

  const spinner = ora('Running debug analysis...').start();

  try {
    const options = {
      console: answers.features.includes('console'),
      network: answers.features.includes('network'),
      performance: answers.features.includes('performance'),
      timeline: answers.features.includes('timeline'),
      accessibility: answers.features.includes('accessibility'),
      elementInspector: answers.features.includes('elementInspector'),
      slowMo: answers.slowmo
    };

    const results = await vrt.debug(answers.url, options);
    
    spinner.succeed('Debug analysis complete!');

    // Display summary
    console.log(chalk.green('\n✅ Debug Report Generated\n'));
    
    if (results.summary) {
      console.log(chalk.yellow('📊 Summary:'));
      console.log(`  Console Errors: ${results.summary.consoleErrors}`);
      console.log(`  Console Warnings: ${results.summary.consoleWarnings}`);
      console.log(`  Failed Requests: ${results.summary.failedRequests}`);
      console.log(`  Performance Score: ${results.summary.performanceScore || 'N/A'}`);
    }

    console.log(chalk.green('\n📁 Full report available in: debug-output/debug-report.html'));

  } catch (error) {
    spinner.fail('Debug analysis failed');
    console.error(chalk.red(error.message));
  }
}

async function analyzeWorkflow(vrt) {
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'target',
      message: 'Enter URL or screenshot directory to analyze:',
      default: 'http://directory.hattch-localhost'
    },
    {
      type: 'list',
      name: 'analysisType',
      message: 'Select analysis type:',
      choices: [
        { name: '🎨 Design Quality', value: 'design' },
        { name: '♿ Accessibility', value: 'accessibility' },
        { name: '⚡ Performance', value: 'performance' },
        { name: '🔍 All (Comprehensive)', value: 'all' }
      ]
    },
    {
      type: 'checkbox',
      name: 'features',
      message: 'Select additional features:',
      choices: [
        { name: '🔍 Detect visual issues', value: 'detectIssues', checked: true },
        { name: '💡 Get improvement suggestions', value: 'suggestImprovements', checked: true },
        { name: '✅ Check design consistency', value: 'checkConsistency', checked: true }
      ]
    }
  ]);

  const spinner = ora('Running AI analysis...').start();

  try {
    // For this example, we'll use the capture method with analysis
    const options = {
      analyze: true,
      detectIssues: answers.features.includes('detectIssues'),
      checkAccessibility: answers.analysisType === 'accessibility' || answers.analysisType === 'all'
    };

    const results = await vrt.capture(answers.target, options);
    
    spinner.succeed('Analysis complete!');

    // Display comprehensive analysis
    if (results[0]?.analysis) {
      const analysis = results[0].analysis;
      
      console.log(chalk.cyan('\n🤖 AI Analysis Report\n'));
      console.log(chalk.yellow('📝 Summary:'), analysis.summary);
      console.log(chalk.yellow('📊 Quality Score:'), analysis.score + '/100');

      if (analysis.issues.length > 0) {
        console.log(chalk.red('\n⚠️  Issues Detected:'));
        analysis.issues.forEach((issue, i) => {
          console.log(`\n${i + 1}. ${chalk.yellow(issue.type.toUpperCase())} - ${issue.severity}`);
          console.log(`   ${issue.description}`);
          if (issue.suggestion) {
            console.log(chalk.green(`   💡 Suggestion: ${issue.suggestion}`));
          }
        });
      }

      if (analysis.recommendations.length > 0) {
        console.log(chalk.cyan('\n💡 Recommendations:'));
        analysis.recommendations.forEach((rec, i) => {
          console.log(`\n${i + 1}. [${rec.priority.toUpperCase()}] ${rec.category}`);
          console.log(`   ${rec.suggestion}`);
          console.log(chalk.gray(`   Impact: ${rec.impact}`));
        });
      }
    }

  } catch (error) {
    spinner.fail('Analysis failed');
    console.error(chalk.red(error.message));
  }
}

async function baselineWorkflow(vrt) {
  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'Select baseline action:',
      choices: [
        { name: '🔄 Update baseline', value: 'update' },
        { name: '🌿 Create branch', value: 'branch' },
        { name: '🔀 Switch branch', value: 'switch' },
        { name: '⏪ Rollback to version', value: 'rollback' },
        { name: '🤖 Auto-select best baseline', value: 'autoSelect' },
        { name: '📋 View history', value: 'history' }
      ]
    }
  ]);

  const baselineManager = vrt.baselineManager;

  switch (action) {
    case 'update':
      const updateAnswers = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'backup',
          message: 'Create backup before updating?',
          default: true
        },
        {
          type: 'confirm',
          name: 'selective',
          message: 'Update selectively (choose files)?',
          default: false
        }
      ]);

      const spinner = ora('Updating baseline...').start();
      try {
        await baselineManager.updateBaseline(updateAnswers);
        spinner.succeed('Baseline updated successfully!');
      } catch (error) {
        spinner.fail('Failed to update baseline');
        console.error(chalk.red(error.message));
      }
      break;

    case 'branch':
      const { branchName } = await inquirer.prompt([
        {
          type: 'input',
          name: 'branchName',
          message: 'Enter branch name:',
          validate: (input) => input.length > 0 || 'Branch name is required'
        }
      ]);

      try {
        await baselineManager.createBranch(branchName);
        console.log(chalk.green(`✅ Branch '${branchName}' created successfully!`));
      } catch (error) {
        console.error(chalk.red(error.message));
      }
      break;

    case 'history':
      const history = await baselineManager.getHistory();
      console.log(chalk.cyan('\n📋 Baseline History\n'));
      console.log(`Current: ${history.current}`);
      console.log(`Last Update: ${history.lastUpdate || 'Never'}`);
      
      if (history.versions.length > 0) {
        console.log(chalk.yellow('\nVersions:'));
        history.versions.forEach(v => {
          console.log(`  - ${v.name} (${new Date(v.timestamp).toLocaleString()})`);
        });
      }
      
      if (Object.keys(history.branches).length > 0) {
        console.log(chalk.yellow('\nBranches:'));
        Object.entries(history.branches).forEach(([name, info]) => {
          console.log(`  - ${name} (created: ${new Date(info.created).toLocaleString()})`);
        });
      }
      break;
  }
}

async function migrateWorkflow(vrt) {
  console.log(chalk.cyan('\n🚀 CSS Migration Workflow\n'));

  const { step } = await inquirer.prompt([
    {
      type: 'list',
      name: 'step',
      message: 'Select migration step:',
      choices: [
        { name: '1️⃣ Prepare - Capture baseline (Bootstrap)', value: 'prepare' },
        { name: '2️⃣ Validate - Compare with Tailwind version', value: 'validate' },
        { name: '3️⃣ Report - Generate migration report', value: 'report' }
      ]
    }
  ]);

  console.log(chalk.yellow('\n⚠️  Migration workflow would be implemented here'));
  console.log('This would guide you through the complete CSS framework migration process.');
}

async function responsiveWorkflow(vrt) {
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'url',
      message: 'Enter URL to test:',
      default: 'http://directory.hattch-localhost'
    },
    {
      type: 'input',
      name: 'breakpoints',
      message: 'Enter breakpoints (comma-separated):',
      default: '320,375,768,1024,1440,1920'
    }
  ]);

  console.log(chalk.yellow('\n📱 Responsive testing would capture at all breakpoints and analyze layout shifts'));
}

async function accessibilityWorkflow(vrt) {
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'url',
      message: 'Enter URL to test:',
      default: 'http://directory.hattch-localhost'
    },
    {
      type: 'list',
      name: 'standard',
      message: 'Select accessibility standard:',
      choices: ['WCAG2A', 'WCAG2AA', 'WCAG2AAA'],
      default: 'WCAG2AA'
    }
  ]);

  console.log(chalk.yellow('\n♿ Accessibility testing would run axe-core and provide detailed recommendations'));
}

async function performanceWorkflow(vrt) {
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'url',
      message: 'Enter URL to test:',
      default: 'http://directory.hattch-localhost'
    }
  ]);

  console.log(chalk.yellow('\n⚡ Performance analysis would capture metrics and provide optimization suggestions'));
}

module.exports = interactiveCommand;