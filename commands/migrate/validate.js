const chalk = require('chalk');
const ora = require('ora');
const fs = require('fs').promises;
const path = require('path');
const VRT = require('../../lib/vrt');

async function validateCommand(options) {
  const spinner = ora('Validating migration changes...').start();
  
  try {
    const baselineDir = options.baseline || 'migration-baseline-bootstrap';
    const currentDir = options.current || 'migration-current-tailwind';
    
    // Load migration metadata
    let metadata;
    try {
      const metadataContent = await fs.readFile(
        path.join(baselineDir, 'migration-metadata.json'),
        'utf8'
      );
      metadata = JSON.parse(metadataContent);
    } catch (error) {
      console.error(chalk.red('Error: Could not find migration metadata. Run "migrate:prepare" first.'));
      process.exit(1);
    }
    
    console.log(chalk.cyan('\n🔍 Migration Validation\n'));
    console.log(chalk.gray(`Baseline: ${baselineDir} (${metadata.sourceFramework})`));
    console.log(chalk.gray(`Current: ${currentDir} (${metadata.targetFramework})`));
    
    const vrt = new VRT({
      aiEnabled: true,
      outputDir: 'migration-validation'
    });
    
    spinner.text = 'Capturing current state...';
    
    // Capture current state for comparison
    const currentResults = [];
    
    for (const page of metadata.pages) {
      const pageResults = await vrt.capture(page.url, {
        outputDir: path.join(currentDir, page.name),
        fullPage: true,
        components: true,
        analyze: true
      });
      
      currentResults.push({
        page: page.name,
        url: page.url,
        captures: pageResults
      });
    }
    
    spinner.text = 'Comparing with baseline...';
    
    // Compare each page
    const validationResults = [];
    let totalPassed = 0;
    let totalFailed = 0;
    
    console.log(chalk.cyan('\n📊 Validation Results:\n'));
    
    for (const page of metadata.pages) {
      console.log(chalk.yellow(`\n${page.name.toUpperCase()}:`));
      
      const baselinePath = path.join(baselineDir, page.name);
      const currentPath = path.join(currentDir, page.name);
      
      try {
        const comparisonResult = await vrt.compare(baselinePath, currentPath, {
          threshold: 0.1,
          aiAnalysis: true,
          suggestFixes: true,
          generateReport: true,
          output: path.join('migration-validation', page.name)
        });
        
        validationResults.push({
          page: page.name,
          result: comparisonResult
        });
        
        if (comparisonResult.passed) {
          console.log(chalk.green('  ✅ Visual parity achieved!'));
          totalPassed++;
        } else {
          console.log(chalk.red(`  ❌ ${comparisonResult.differences.length} visual differences detected`));
          totalFailed++;
          
          // Show top differences
          comparisonResult.differences.slice(0, 3).forEach(diff => {
            console.log(`     • ${diff.file}: ${(diff.difference * 100).toFixed(2)}% difference`);
          });
          
          // Show AI analysis
          const aiAnalysis = comparisonResult.report.find(r => r.aiAnalysis)?.aiAnalysis;
          if (aiAnalysis) {
            console.log(chalk.cyan(`     AI Analysis: ${aiAnalysis.summary}`));
            
            if (aiAnalysis.severity === 'high') {
              console.log(chalk.red('     ⚠️  High severity - significant visual changes'));
            } else if (aiAnalysis.severity === 'medium') {
              console.log(chalk.yellow('     ⚠️  Medium severity - moderate changes'));
            } else {
              console.log(chalk.gray('     ℹ️  Low severity - minor differences'));
            }
          }
        }
        
      } catch (error) {
        console.log(chalk.red(`  ❌ Comparison failed: ${error.message}`));
        totalFailed++;
      }
    }
    
    spinner.succeed('Validation complete!');
    
    // Overall summary
    console.log(chalk.cyan('\n📈 Overall Migration Status:\n'));
    
    const successRate = (totalPassed / (totalPassed + totalFailed)) * 100;
    const statusColor = successRate === 100 ? 'green' : successRate >= 80 ? 'yellow' : 'red';
    
    console.log(chalk[statusColor](`Success Rate: ${successRate.toFixed(1)}%`));
    console.log(`Pages validated: ${totalPassed + totalFailed}`);
    console.log(chalk.green(`Passed: ${totalPassed}`));
    console.log(chalk.red(`Failed: ${totalFailed}`));
    
    // Component-specific analysis
    console.log(chalk.cyan('\n🧩 Component Analysis:\n'));
    
    const componentIssues = analyzeComponentDifferences(validationResults);
    
    Object.entries(componentIssues).forEach(([component, issues]) => {
      if (issues.length > 0) {
        console.log(chalk.yellow(`${component}:`));
        issues.slice(0, 3).forEach(issue => {
          console.log(`  • ${issue}`);
        });
      }
    });
    
    // Migration recommendations
    console.log(chalk.cyan('\n💡 Migration Recommendations:\n'));
    
    const recommendations = generateMigrationRecommendations(validationResults);
    recommendations.forEach((rec, index) => {
      console.log(`${index + 1}. ${rec}`);
    });
    
    // Save validation report
    const validationReport = {
      timestamp: new Date().toISOString(),
      sourceFramework: metadata.sourceFramework,
      targetFramework: metadata.targetFramework,
      successRate,
      results: validationResults,
      componentIssues,
      recommendations
    };
    
    await fs.writeFile(
      path.join('migration-validation', 'validation-report.json'),
      JSON.stringify(validationReport, null, 2)
    );
    
    // Generate action items
    if (totalFailed > 0) {
      console.log(chalk.yellow('\n📋 Action Items:\n'));
      
      const actionItems = generateActionItems(validationResults);
      actionItems.forEach((item, index) => {
        console.log(`${index + 1}. ${item}`);
      });
      
      await fs.writeFile(
        path.join('migration-validation', 'action-items.md'),
        `# Migration Action Items\n\n${actionItems.map(item => `- [ ] ${item}`).join('\n')}`
      );
    }
    
    console.log(chalk.green(`\n📁 Validation reports saved to: migration-validation/`));
    
    // Exit with appropriate code
    process.exit(successRate === 100 ? 0 : 1);
    
  } catch (error) {
    spinner.fail('Validation failed');
    console.error(chalk.red('Error:'), error.message);
    process.exit(1);
  }
}

function analyzeComponentDifferences(validationResults) {
  const componentIssues = {
    buttons: [],
    cards: [],
    forms: [],
    navigation: [],
    spacing: [],
    typography: [],
    colors: []
  };
  
  validationResults.forEach(({ page, result }) => {
    if (!result.passed && result.report) {
      result.report.forEach(item => {
        if (item.aiAnalysis?.affectedAreas) {
          item.aiAnalysis.affectedAreas.forEach(area => {
            const component = area.component.toLowerCase();
            
            if (component.includes('button') || component.includes('btn')) {
              componentIssues.buttons.push(`${page}: ${area.changeType} in buttons`);
            } else if (component.includes('card')) {
              componentIssues.cards.push(`${page}: ${area.changeType} in cards`);
            } else if (component.includes('form') || component.includes('input')) {
              componentIssues.forms.push(`${page}: ${area.changeType} in forms`);
            } else if (component.includes('nav') || component.includes('header')) {
              componentIssues.navigation.push(`${page}: ${area.changeType} in navigation`);
            }
            
            if (area.changeType === 'spacing') {
              componentIssues.spacing.push(`${page}: Spacing differences in ${component}`);
            } else if (area.changeType === 'typography') {
              componentIssues.typography.push(`${page}: Typography changes in ${component}`);
            } else if (area.changeType === 'color') {
              componentIssues.colors.push(`${page}: Color differences in ${component}`);
            }
          });
        }
      });
    }
  });
  
  return componentIssues;
}

function generateMigrationRecommendations(validationResults) {
  const recommendations = [];
  const failedPages = validationResults.filter(r => !r.result.passed);
  
  if (failedPages.length === 0) {
    recommendations.push('Excellent work! Visual parity achieved across all pages');
    recommendations.push('Run accessibility tests to ensure no regressions');
    recommendations.push('Test interactive states and animations');
    recommendations.push('Consider performance testing to compare load times');
  } else {
    // Analyze common issues
    const hasSpacingIssues = failedPages.some(p => 
      p.result.report?.some(r => r.aiAnalysis?.affectedAreas?.some(a => a.changeType === 'spacing'))
    );
    
    const hasColorIssues = failedPages.some(p => 
      p.result.report?.some(r => r.aiAnalysis?.affectedAreas?.some(a => a.changeType === 'color'))
    );
    
    const hasLayoutIssues = failedPages.some(p => 
      p.result.report?.some(r => r.aiAnalysis?.affectedAreas?.some(a => a.changeType === 'layout'))
    );
    
    if (hasSpacingIssues) {
      recommendations.push('Review Tailwind spacing scale configuration to match Bootstrap spacing');
      recommendations.push('Check for custom margin/padding values that need adjustment');
    }
    
    if (hasColorIssues) {
      recommendations.push('Verify color palette configuration in tailwind.config.js');
      recommendations.push('Check for hardcoded colors that should use Tailwind utilities');
    }
    
    if (hasLayoutIssues) {
      recommendations.push('Review grid and flexbox implementations for layout consistency');
      recommendations.push('Check responsive breakpoints match Bootstrap breakpoints');
    }
    
    recommendations.push('Focus on high-severity issues first');
    recommendations.push('Test each fix across all viewports');
    recommendations.push('Use browser DevTools to compare computed styles');
  }
  
  recommendations.push('Document any intentional design improvements');
  recommendations.push('Update component library documentation with Tailwind classes');
  
  return recommendations;
}

function generateActionItems(validationResults) {
  const actionItems = [];
  
  validationResults.forEach(({ page, result }) => {
    if (!result.passed) {
      // High priority items
      const highSeverity = result.report?.filter(r => 
        r.aiAnalysis?.severity === 'high'
      );
      
      if (highSeverity?.length > 0) {
        actionItems.push(`[HIGH] Fix major visual differences on ${page}`);
      }
      
      // Component-specific items
      result.report?.forEach(item => {
        if (item.suggestedFixes?.length > 0) {
          actionItems.push(`Apply CSS fixes for ${item.file} on ${page}`);
        }
      });
    }
  });
  
  // Add general action items
  actionItems.push('Review and apply all AI-suggested CSS fixes');
  actionItems.push('Validate fixes don\'t break other pages');
  actionItems.push('Update migration checklist with completed items');
  actionItems.push('Re-run validation after applying fixes');
  
  return actionItems;
}

module.exports = validateCommand;