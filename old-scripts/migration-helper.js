const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

/**
 * Migration Helper - Captures screenshots for Bootstrap to Tailwind migration
 * This script helps validate that the Tailwind version looks identical to Bootstrap
 */

class MigrationHelper {
    constructor(options = {}) {
        this.baseUrl = options.baseUrl || 'http://localhost:8000';
        this.outputDir = options.outputDir || path.join(__dirname, 'migration-screenshots');
        this.viewports = options.viewports || [
            { name: 'mobile', width: 375, height: 812 },
            { name: 'tablet', width: 768, height: 1024 },
            { name: 'desktop', width: 1440, height: 900 }
        ];
    }

    async captureBaseline(pagePath, componentName) {
        const dir = path.join(this.outputDir, 'baseline', componentName);
        await this.capture(pagePath, dir, 'bootstrap');
    }

    async captureMigrated(pagePath, componentName) {
        const dir = path.join(this.outputDir, 'migrated', componentName);
        await this.capture(pagePath, dir, 'tailwind');
    }

    async capture(pagePath, outputDir, version) {
        // Ensure output directory exists
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        try {
            const url = `${this.baseUrl}${pagePath}`;
            console.log(`📸 Capturing ${version} version: ${url}`);

            for (const viewport of this.viewports) {
                const page = await browser.newPage();
                await page.setViewport(viewport);
                
                // Navigate to page
                await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
                
                // Wait for content to stabilize
                await page.waitForTimeout(1000);

                // Full page screenshot
                const fullPagePath = path.join(outputDir, `${viewport.name}-full.png`);
                await page.screenshot({ path: fullPagePath, fullPage: true });
                console.log(`  ✓ ${viewport.name} full page`);

                // Capture specific components
                await this.captureComponents(page, outputDir, viewport.name);

                await page.close();
            }
        } finally {
            await browser.close();
        }
    }

    async captureComponents(page, outputDir, viewportName) {
        const components = [
            { name: 'header', selector: 'header, nav, .header-main' },
            { name: 'cards', selector: '.card, .bg-white.rounded-lg.shadow-sm' },
            { name: 'buttons', selector: '.btn, button' },
            { name: 'forms', selector: 'form' },
            { name: 'modals', selector: '.modal, [role="dialog"]' },
            { name: 'accordions', selector: '.accordion, .accordion-item' }
        ];

        for (const component of components) {
            try {
                const elements = await page.$$(component.selector);
                if (elements.length > 0) {
                    // Capture first instance
                    const screenshotPath = path.join(outputDir, `${viewportName}-${component.name}.png`);
                    await elements[0].screenshot({ path: screenshotPath });
                    console.log(`  ✓ ${viewportName} ${component.name}`);
                }
            } catch (error) {
                console.log(`  ⚠️  ${viewportName} ${component.name} - not found`);
            }
        }
    }

    async compareResults(componentName) {
        const baselineDir = path.join(this.outputDir, 'baseline', componentName);
        const migratedDir = path.join(this.outputDir, 'migrated', componentName);
        const comparisonDir = path.join(this.outputDir, 'comparisons', componentName);

        if (!fs.existsSync(baselineDir)) {
            console.error(`❌ No baseline found for ${componentName}. Run captureBaseline first.`);
            return;
        }

        if (!fs.existsSync(migratedDir)) {
            console.error(`❌ No migrated version found for ${componentName}. Run captureMigrated first.`);
            return;
        }

        // Use the batch compare function
        const { batchCompare } = require('./batch-compare');
        await batchCompare(baselineDir, migratedDir, comparisonDir);
    }

    async generateReport() {
        const reportPath = path.join(this.outputDir, 'migration-report.html');
        const components = fs.readdirSync(path.join(this.outputDir, 'baseline'));
        
        let html = `<!DOCTYPE html>
<html>
<head>
    <title>Bootstrap to Tailwind Migration Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; }
        h1 { color: #333; }
        .component { margin: 20px 0; padding: 20px; background: #f8f9fa; border-radius: 8px; }
        .component h2 { margin-top: 0; }
        .status { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 0.9em; }
        .status.complete { background: #28a745; color: white; }
        .status.in-progress { background: #ffc107; color: #333; }
        .status.pending { background: #6c757d; color: white; }
        .actions { margin-top: 10px; }
        .btn { display: inline-block; padding: 8px 16px; margin-right: 10px; background: #007bff; color: white; text-decoration: none; border-radius: 4px; }
        .btn:hover { background: #0056b3; }
        .checklist { margin-top: 15px; }
        .checklist li { margin: 5px 0; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Bootstrap to Tailwind Migration Report</h1>
        <p>Generated: ${new Date().toLocaleString()}</p>
        
        <h2>Components</h2>`;

        for (const component of components) {
            const hasComparison = fs.existsSync(path.join(this.outputDir, 'comparisons', component));
            const status = hasComparison ? 'complete' : 'in-progress';
            
            html += `
        <div class="component">
            <h2>${component} <span class="status ${status}">${status.toUpperCase()}</span></h2>
            <div class="actions">
                <a href="baseline/${component}" class="btn">View Baseline</a>
                <a href="migrated/${component}" class="btn">View Migrated</a>
                ${hasComparison ? `<a href="comparisons/${component}/comparison-report.html" class="btn">View Comparison</a>` : ''}
            </div>
            <div class="checklist">
                <h3>Migration Checklist:</h3>
                <ul>
                    <li>☐ Grid system converted (container → w-full, row → flex, col-* → w-*)</li>
                    <li>☐ Buttons converted (btn btn-primary → Tailwind classes)</li>
                    <li>☐ Cards converted (card → bg-white rounded-lg shadow-sm)</li>
                    <li>☐ Forms styled with Tailwind</li>
                    <li>☐ Modals working without Bootstrap JS</li>
                    <li>☐ Responsive utilities updated</li>
                    <li>☐ Hover states preserved</li>
                    <li>☐ Transitions smooth</li>
                </ul>
            </div>
        </div>`;
        }

        html += `
    </div>
</body>
</html>`;

        fs.writeFileSync(reportPath, html);
        console.log(`\n📊 Migration report generated: ${reportPath}`);
    }
}

// CLI Interface
if (require.main === module) {
    const args = process.argv.slice(2);
    const command = args[0];
    const pagePath = args[1];
    const componentName = args[2] || path.basename(pagePath);

    const helper = new MigrationHelper();

    switch (command) {
        case 'baseline':
            if (!pagePath) {
                console.error('Usage: node migration-helper.js baseline <pagePath> [componentName]');
                console.error('Example: node migration-helper.js baseline /business-for-sale brand-page');
                process.exit(1);
            }
            helper.captureBaseline(pagePath, componentName)
                .then(() => console.log('✅ Baseline captured successfully'))
                .catch(console.error);
            break;

        case 'migrated':
            if (!pagePath) {
                console.error('Usage: node migration-helper.js migrated <pagePath> [componentName]');
                process.exit(1);
            }
            helper.captureMigrated(pagePath, componentName)
                .then(() => console.log('✅ Migrated version captured successfully'))
                .catch(console.error);
            break;

        case 'compare':
            if (!componentName) {
                console.error('Usage: node migration-helper.js compare <componentName>');
                process.exit(1);
            }
            helper.compareResults(args[1])
                .then(() => console.log('✅ Comparison complete'))
                .catch(console.error);
            break;

        case 'report':
            helper.generateReport()
                .catch(console.error);
            break;

        default:
            console.log('Bootstrap to Tailwind Migration Helper');
            console.log('=====================================\n');
            console.log('Commands:');
            console.log('  baseline <pagePath> [name]  - Capture Bootstrap version screenshots');
            console.log('  migrated <pagePath> [name]  - Capture Tailwind version screenshots');
            console.log('  compare <name>              - Compare baseline vs migrated');
            console.log('  report                      - Generate migration report\n');
            console.log('Example workflow:');
            console.log('  1. node migration-helper.js baseline /business-for-sale brand-page');
            console.log('  2. (Make your Tailwind changes)');
            console.log('  3. node migration-helper.js migrated /business-for-sale brand-page');
            console.log('  4. node migration-helper.js compare brand-page');
            console.log('  5. node migration-helper.js report');
    }
}

module.exports = MigrationHelper;