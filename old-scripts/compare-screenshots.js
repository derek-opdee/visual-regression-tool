const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// Create directories for before/after screenshots
const beforeDir = path.join(__dirname, 'screenshots-before');
const afterDir = path.join(__dirname, 'screenshots-after');

[beforeDir, afterDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

async function captureComparison() {
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        // You can switch between Bootstrap and Tailwind versions by changing these URLs
        // or by using a query parameter to toggle between versions
        const bootstrapUrl = 'http://localhost:8000/business-for-sale?version=bootstrap';
        const tailwindUrl = 'http://localhost:8000/business-for-sale?version=tailwind';
        
        const viewports = [
            { name: 'desktop', width: 1920, height: 1080 },
            { name: 'tablet', width: 768, height: 1024 },
            { name: 'mobile', width: 375, height: 812 }
        ];
        
        // Key areas to compare
        const compareAreas = [
            { 
                name: 'header-section',
                selector: '.container-fluid:first-of-type, .w-full:first-of-type',
                options: { fullPage: false }
            },
            {
                name: 'listing-cards',
                selector: '.card, .bg-white.rounded-lg.shadow-sm',
                options: { fullPage: false }
            },
            {
                name: 'buttons',
                selector: '.card-btn-footer',
                options: { fullPage: false }
            },
            {
                name: 'accordion',
                selector: '#brandFaqAccordion',
                options: { fullPage: false }
            }
        ];

        console.log('📸 Capturing Bootstrap version screenshots...');
        await captureVersion(browser, bootstrapUrl, beforeDir, viewports, compareAreas, 'Bootstrap');
        
        console.log('\n📸 Capturing Tailwind version screenshots...');
        await captureVersion(browser, tailwindUrl, afterDir, viewports, compareAreas, 'Tailwind');
        
        console.log('\n✅ Comparison screenshots captured!');
        console.log(`📁 Bootstrap screenshots: ${beforeDir}`);
        console.log(`📁 Tailwind screenshots: ${afterDir}`);
        console.log('\n💡 Use an image diff tool to compare the screenshots');
        
    } catch (error) {
        console.error('Error during comparison:', error);
    } finally {
        await browser.close();
    }
}

async function captureVersion(browser, url, outputDir, viewports, areas, versionName) {
    for (const viewport of viewports) {
        console.log(`\n${viewport.name} viewport (${viewport.width}x${viewport.height}):`);
        
        const page = await browser.newPage();
        await page.setViewport({ width: viewport.width, height: viewport.height });
        
        // Navigate to page
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
        
        // Wait for content
        await page.waitForTimeout(2000);
        
        // Full page screenshot
        const fullPagePath = path.join(outputDir, `${viewport.name}-full-page.png`);
        await page.screenshot({
            path: fullPagePath,
            fullPage: true
        });
        console.log(`  ✓ Full page captured`);
        
        // Capture specific areas
        for (const area of areas) {
            try {
                const element = await page.$(area.selector);
                if (element) {
                    const screenshotPath = path.join(outputDir, `${viewport.name}-${area.name}.png`);
                    
                    if (area.options.fullPage === false) {
                        await element.screenshot({ path: screenshotPath });
                    } else {
                        await page.screenshot({ path: screenshotPath, ...area.options });
                    }
                    
                    console.log(`  ✓ ${area.name} captured`);
                } else {
                    console.log(`  ✗ ${area.name} not found (${area.selector})`);
                }
            } catch (error) {
                console.log(`  ✗ Error capturing ${area.name}: ${error.message}`);
            }
        }
        
        await page.close();
    }
}

// Run the comparison
captureComparison().catch(console.error);