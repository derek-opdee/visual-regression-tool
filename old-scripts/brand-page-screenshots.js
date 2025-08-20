const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// Create screenshots directory if it doesn't exist
const screenshotsDir = path.join(__dirname, 'screenshots');
if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
}

async function captureScreenshots() {
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        // Test URL - update this to your local or staging environment
        const url = 'http://localhost:8000/business-for-sale';
        
        // Define viewport sizes for different devices
        const viewports = [
            { name: 'desktop', width: 1920, height: 1080 },
            { name: 'tablet', width: 768, height: 1024 },
            { name: 'mobile', width: 375, height: 812 }
        ];

        for (const viewport of viewports) {
            console.log(`Capturing screenshots for ${viewport.name}...`);
            
            const page = await browser.newPage();
            await page.setViewport({ width: viewport.width, height: viewport.height });
            
            // Navigate to the page
            await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
            
            // Wait for content to load
            await page.waitForSelector('.card', { timeout: 10000 });
            
            // Capture full page screenshot
            await page.screenshot({
                path: path.join(screenshotsDir, `brand-page-${viewport.name}-full.png`),
                fullPage: true
            });
            
            // Capture specific sections
            const sections = [
                { selector: '.header-main', name: 'header' },
                { selector: '.assess-banner-container', name: 'assessment-banner' },
                { selector: '.toggle-btn', name: 'toggle-buttons' },
                { selector: '.card:first-of-type', name: 'first-listing-card' },
                { selector: '#brandFaqAccordion', name: 'faq-accordion' },
                { selector: '.card-btn-footer', name: 'card-buttons' }
            ];
            
            for (const section of sections) {
                try {
                    const element = await page.$(section.selector);
                    if (element) {
                        await element.screenshot({
                            path: path.join(screenshotsDir, `brand-page-${viewport.name}-${section.name}.png`)
                        });
                        console.log(`  ✓ Captured ${section.name}`);
                    } else {
                        console.log(`  ✗ Could not find ${section.name} (${section.selector})`);
                    }
                } catch (error) {
                    console.log(`  ✗ Error capturing ${section.name}: ${error.message}`);
                }
            }
            
            // Test interactive elements
            console.log(`Testing interactive elements on ${viewport.name}...`);
            
            // Test accordion functionality
            const accordionButtons = await page.$$('.accordion-button');
            if (accordionButtons.length > 0) {
                // Click first accordion item
                await accordionButtons[0].click();
                await page.waitForTimeout(500); // Wait for animation
                
                await page.screenshot({
                    path: path.join(screenshotsDir, `brand-page-${viewport.name}-accordion-expanded.png`),
                    fullPage: false,
                    clip: await accordionButtons[0].boundingBox()
                });
                console.log('  ✓ Captured accordion expanded state');
            }
            
            // Test toggle buttons
            const franchiseToggle = await page.$('#btnFranchises');
            if (franchiseToggle) {
                await franchiseToggle.click();
                await page.waitForTimeout(500);
                
                await page.screenshot({
                    path: path.join(screenshotsDir, `brand-page-${viewport.name}-franchise-view.png`),
                    fullPage: false,
                    clip: { x: 0, y: 200, width: viewport.width, height: 600 }
                });
                console.log('  ✓ Captured franchise toggle state');
            }
            
            await page.close();
        }
        
        console.log('\n✅ All screenshots captured successfully!');
        console.log(`📁 Screenshots saved to: ${screenshotsDir}`);
        
    } catch (error) {
        console.error('Error capturing screenshots:', error);
    } finally {
        await browser.close();
    }
}

// Run the screenshot capture
captureScreenshots().catch(console.error);