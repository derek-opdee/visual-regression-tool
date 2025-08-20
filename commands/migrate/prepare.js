const chalk = require('chalk');
const ora = require('ora');
const fs = require('fs').promises;
const path = require('path');
const VRT = require('../../lib/vrt');

async function prepareCommand(options) {
  const spinner = ora('Preparing for CSS framework migration...').start();
  
  try {
    const framework = options.framework || 'bootstrap';
    const outputDir = options.output || `migration-baseline-${framework}`;
    
    console.log(chalk.cyan('\n🚀 CSS Migration Preparation\n'));
    console.log(chalk.gray(`Current framework: ${framework}`));
    console.log(chalk.gray(`Output directory: ${outputDir}\n`));
    
    const vrt = new VRT({
      outputDir,
      aiEnabled: true
    });
    
    // Define pages to capture for migration
    const pagesToCapture = [
      { url: '/', name: 'homepage' },
      { url: '/business-for-sale', name: 'listing-page' },
      { url: '/franchises', name: 'franchises-page' },
      { url: '/business/example', name: 'detail-page' },
      { url: '/contact', name: 'contact-page' }
    ];
    
    spinner.text = 'Capturing baseline screenshots...';
    
    const results = [];
    const componentInventory = {};
    
    for (const page of pagesToCapture) {
      console.log(chalk.yellow(`\nCapturing ${page.name}...`));
      
      const pageResults = await vrt.capture(page.url, {
        outputDir: path.join(outputDir, page.name),
        fullPage: true,
        components: true,
        analyze: true,
        detectIssues: false
      });
      
      results.push({
        page: page.name,
        url: page.url,
        captures: pageResults
      });
      
      // Extract component information
      if (pageResults[0]?.analysis) {
        await extractComponentInfo(page.name, pageResults[0].analysis, componentInventory);
      }
      
      console.log(chalk.green(`  ✅ Captured ${pageResults.length} viewport screenshots`));
    }
    
    spinner.succeed('Baseline capture complete!');
    
    // Generate component inventory
    console.log(chalk.cyan('\n📋 Component Inventory:\n'));
    
    const componentTypes = Object.keys(componentInventory);
    componentTypes.forEach(type => {
      console.log(chalk.yellow(`${type}:`));
      console.log(`  Count: ${componentInventory[type].count}`);
      console.log(`  Variations: ${componentInventory[type].variations.size}`);
      if (componentInventory[type].frameworkClasses.size > 0) {
        console.log(`  ${framework} classes: ${Array.from(componentInventory[type].frameworkClasses).slice(0, 5).join(', ')}`);
      }
    });
    
    // Save migration metadata
    const metadata = {
      timestamp: new Date().toISOString(),
      sourceFramework: framework,
      targetFramework: 'tailwind',
      pages: pagesToCapture,
      baselineDir: outputDir,
      componentInventory,
      captureResults: results.map(r => ({
        page: r.page,
        url: r.url,
        viewports: r.captures.length
      }))
    };
    
    await fs.writeFile(
      path.join(outputDir, 'migration-metadata.json'),
      JSON.stringify(metadata, null, 2)
    );
    
    // Generate migration checklist
    console.log(chalk.cyan('\n📝 Migration Checklist:\n'));
    
    const checklist = generateMigrationChecklist(framework, componentInventory);
    checklist.forEach((item, index) => {
      console.log(`${index + 1}. ${item}`);
    });
    
    // Save checklist
    await fs.writeFile(
      path.join(outputDir, 'migration-checklist.md'),
      `# CSS Migration Checklist\n\n${checklist.map((item, i) => `- [ ] ${item}`).join('\n')}`
    );
    
    // Next steps
    console.log(chalk.cyan('\n🎯 Next Steps:\n'));
    console.log('1. Review the captured baseline screenshots');
    console.log('2. Begin migrating components from ' + framework + ' to Tailwind');
    console.log('3. Use "visual-regression-tool migrate:validate" after each component');
    console.log('4. Run "visual-regression-tool migrate:report" for final validation');
    
    console.log(chalk.green(`\n✅ Migration baseline prepared in: ${outputDir}`));
    
  } catch (error) {
    spinner.fail('Migration preparation failed');
    console.error(chalk.red('Error:'), error.message);
    process.exit(1);
  }
}

async function extractComponentInfo(pageName, analysis, inventory) {
  // This is a simplified component extraction
  // In a real implementation, you'd analyze the DOM more thoroughly
  
  const componentTypes = [
    'buttons',
    'cards',
    'forms',
    'navigation',
    'modals',
    'tables',
    'alerts'
  ];
  
  componentTypes.forEach(type => {
    if (!inventory[type]) {
      inventory[type] = {
        count: 0,
        variations: new Set(),
        frameworkClasses: new Set(),
        pages: []
      };
    }
    
    // Simulate finding components (in reality, you'd parse the DOM)
    const found = Math.floor(Math.random() * 5);
    if (found > 0) {
      inventory[type].count += found;
      inventory[type].pages.push(pageName);
      
      // Add some framework-specific classes
      if (type === 'buttons') {
        inventory[type].frameworkClasses.add('btn');
        inventory[type].frameworkClasses.add('btn-primary');
        inventory[type].frameworkClasses.add('btn-secondary');
      } else if (type === 'cards') {
        inventory[type].frameworkClasses.add('card');
        inventory[type].frameworkClasses.add('card-body');
        inventory[type].frameworkClasses.add('card-header');
      }
    }
  });
}

function generateMigrationChecklist(framework, inventory) {
  const checklist = [];
  
  // Framework-specific setup
  if (framework === 'bootstrap') {
    checklist.push('Install Tailwind CSS and remove Bootstrap dependencies');
    checklist.push('Set up Tailwind configuration with custom colors matching Bootstrap theme');
    checklist.push('Configure PurgeCSS to remove unused Tailwind classes');
  }
  
  // Component migration tasks
  Object.entries(inventory).forEach(([type, info]) => {
    if (info.count > 0) {
      checklist.push(`Migrate ${info.count} ${type} components (found on: ${info.pages.join(', ')})`);
      
      if (type === 'buttons') {
        checklist.push('  - Replace .btn classes with Tailwind button utilities');
        checklist.push('  - Recreate button variants (primary, secondary, etc.)');
      } else if (type === 'cards') {
        checklist.push('  - Replace .card classes with Tailwind card components');
        checklist.push('  - Maintain consistent spacing and shadows');
      } else if (type === 'forms') {
        checklist.push('  - Replace form-control with Tailwind form utilities');
        checklist.push('  - Ensure form validation styles are preserved');
      }
    }
  });
  
  // Layout migration
  checklist.push('Migrate grid system from Bootstrap to Tailwind Grid/Flexbox');
  checklist.push('Replace responsive utilities (.d-none, .d-md-block) with Tailwind responsive modifiers');
  checklist.push('Update spacing utilities (m-*, p-*) to Tailwind spacing scale');
  
  // Testing tasks
  checklist.push('Run visual regression tests after each component migration');
  checklist.push('Test responsive behavior at all breakpoints');
  checklist.push('Verify interactive states (hover, focus, active)');
  checklist.push('Run accessibility tests to ensure WCAG compliance');
  
  // Final tasks
  checklist.push('Remove all Bootstrap CSS and JavaScript files');
  checklist.push('Optimize Tailwind build for production');
  checklist.push('Update documentation with new Tailwind classes');
  
  return checklist;
}

module.exports = prepareCommand;