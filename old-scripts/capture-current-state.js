const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

async function captureCurrentState() {
    console.log('🚀 Starting visual regression capture...\n');
    
    // Create screenshots directory with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const screenshotsDir = path.join(__dirname, `screenshots-${timestamp}`);
    fs.mkdirSync(screenshotsDir, { recursive: true });

    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        defaultViewport: null
    });

    try {
        // Test multiple URLs to ensure consistency across different pages
        const urls = [
            'http://localhost:8000/business-for-sale',
            'http://localhost:8000/franchises-for-sale',
            'http://localhost:8000/business-for-sale/in-melbourne-vic',
            'http://localhost:8000/cafe-food-beverage-businesses-for-sale'
        ];

        const viewports = [
            { name: 'mobile', width: 375, height: 812, deviceScaleFactor: 2 },
            { name: 'tablet', width: 768, height: 1024, deviceScaleFactor: 2 },
            { name: 'desktop', width: 1440, height: 900, deviceScaleFactor: 1 },
            { name: 'desktop-xl', width: 1920, height: 1080, deviceScaleFactor: 1 }
        ];

        for (const url of urls) {
            const urlName = url.split('/').pop() || 'home';
            console.log(`📄 Capturing: ${urlName}`);
            
            for (const viewport of viewports) {
                const page = await browser.newPage();
                await page.setViewport(viewport);
                
                try {
                    await page.goto(url, { 
                        waitUntil: 'networkidle0', 
                        timeout: 60000 
                    });
                    
                    // Wait for dynamic content
                    await page.waitForSelector('.card, .bg-white.rounded-lg', { 
                        timeout: 10000 
                    }).catch(() => console.log('  ⚠️  No cards found on this page'));
                    
                    // Capture critical layout elements
                    const elements = {
                        'full-page': { selector: 'body', fullPage: true },
                        'header': { selector: 'header, .header-main, nav' },
                        'hero-section': { selector: '.container-fluid:first-of-type, .w-full.flex.justify-center:first-of-type' },
                        'toggle-buttons': { selector: '.border-b.border-t.flex.border-gray-800' },
                        'first-card': { selector: '.card:first-of-type, .bg-white.rounded-lg.shadow-sm:first-of-type' },
                        'card-grid': { selector: '.row.brands-all, .grid.grid-cols-1' },
                        'pagination': { selector: '.pagination, nav[aria-label="pagination"]' },
                        'footer': { selector: 'footer' }
                    };
                    
                    for (const [elementName, config] of Object.entries(elements)) {
                        const filename = `${urlName}-${viewport.name}-${elementName}.png`;
                        const filepath = path.join(screenshotsDir, filename);
                        
                        try {
                            if (config.fullPage) {
                                await page.screenshot({
                                    path: filepath,
                                    fullPage: true
                                });
                                console.log(`  ✓ ${viewport.name} - ${elementName}`);
                            } else {
                                const element = await page.$(config.selector);
                                if (element) {
                                    const box = await element.boundingBox();
                                    if (box && box.width > 0 && box.height > 0) {
                                        await element.screenshot({ path: filepath });
                                        console.log(`  ✓ ${viewport.name} - ${elementName}`);
                                    } else {
                                        console.log(`  ⚠️  ${viewport.name} - ${elementName} (element not visible)`);
                                    }
                                } else {
                                    console.log(`  ⚠️  ${viewport.name} - ${elementName} (not found)`);
                                }
                            }
                        } catch (err) {
                            console.log(`  ✗ ${viewport.name} - ${elementName} (${err.message})`);
                        }
                    }
                    
                    // Test responsive behavior
                    if (viewport.name === 'mobile') {
                        // Check if mobile menu works
                        const mobileMenuButton = await page.$('.show_on_mobile button, .mobile-menu-button');
                        if (mobileMenuButton) {
                            await mobileMenuButton.click();
                            await page.waitForTimeout(300);
                            await page.screenshot({
                                path: path.join(screenshotsDir, `${urlName}-mobile-menu-open.png`)
                            });
                            console.log(`  ✓ mobile - menu open state`);
                        }
                    }
                    
                } catch (error) {
                    console.error(`  ✗ Error loading ${urlName} on ${viewport.name}: ${error.message}`);
                } finally {
                    await page.close();
                }
            }
            console.log('');
        }
        
        console.log(`\n✅ Screenshots saved to: ${screenshotsDir}`);
        console.log('\n📊 Next steps:');
        console.log('1. Review the screenshots to ensure layout consistency');
        console.log('2. Compare mobile vs desktop layouts');
        console.log('3. Check for any visual regressions or broken elements');
        console.log('4. Run this script before and after changes to compare\n');
        
    } catch (error) {
        console.error('Fatal error:', error);
    } finally {
        await browser.close();
    }
}

// Check if running on localhost
const http = require('http');
http.get('http://localhost:8000', (res) => {
    if (res.statusCode === 200 || res.statusCode === 302) {
        captureCurrentState();
    } else {
        console.error('❌ Laravel server is not running on localhost:8000');
        console.log('Please start the server with: php artisan serve');
    }
}).on('error', (err) => {
    console.error('❌ Laravel server is not running on localhost:8000');
    console.log('Please start the server with: php artisan serve');
});