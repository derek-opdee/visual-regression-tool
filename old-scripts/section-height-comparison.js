const { chromium } = require('playwright');

async function compareSectionHeights() {
    const browser = await chromium.launch({ headless: true });
    
    try {
        console.log('🔍 Comparing section heights...\n');
        
        // Create pages
        const prodPage = await browser.newPage();
        const localPage = await browser.newPage();
        
        await prodPage.setViewportSize({ width: 1920, height: 1080 });
        await localPage.setViewportSize({ width: 1920, height: 1080 });
        
        // Navigate to pages
        await prodPage.goto('https://directory.hattch.com', { waitUntil: 'networkidle' });
        await localPage.goto('http://directory.hattch-localhost', { waitUntil: 'networkidle' });
        
        // Wait for content to load
        await prodPage.waitForTimeout(2000);
        await localPage.waitForTimeout(2000);
        
        // Define sections to measure
        const sections = [
            { name: 'Header', selector: '.header, header' },
            { name: 'Hero Section', selector: '.bg-gray-50:first-of-type, .container.m-0.py-5.text-info.directory' },
            { name: 'Search Section', selector: '.bg-blue-700, #search-section' },
            { name: 'Metrics', selector: '#metrics, .bg-gray-50:nth-of-type(2)' },
            { name: 'Franchises', selector: '.bg-blue-900, #brand-gallery-section' },
            { name: 'Business Categories', selector: '.bg-white:has(h2:contains("Businesses for Sale")), .container.px-4.py-5.text-center' },
            { name: 'Entrepreneur', selector: '.bg-purple-600, .container.px-4.py-5.text-white' },
            { name: 'Blog', selector: '#our-blog, .bg-gray-50:has(h2:contains("Franchise Buying"))' },
            { name: 'Footer', selector: 'footer, #footer' }
        ];
        
        console.log('Production vs Local Section Heights:\n');
        console.log('Section'.padEnd(25) + 'Production'.padEnd(15) + 'Local'.padEnd(15) + 'Difference');
        console.log('-'.repeat(70));
        
        let totalProdHeight = 0;
        let totalLocalHeight = 0;
        
        for (const section of sections) {
            try {
                // Try multiple selectors
                const selectors = section.selector.split(', ');
                let prodHeight = 0;
                let localHeight = 0;
                
                for (const sel of selectors) {
                    try {
                        if (prodHeight === 0) {
                            const prodEl = await prodPage.$(sel);
                            if (prodEl) {
                                const prodBox = await prodEl.boundingBox();
                                if (prodBox) prodHeight = prodBox.height;
                            }
                        }
                        
                        if (localHeight === 0) {
                            const localEl = await localPage.$(sel);
                            if (localEl) {
                                const localBox = await localEl.boundingBox();
                                if (localBox) localHeight = localBox.height;
                            }
                        }
                    } catch (e) {
                        // Continue to next selector
                    }
                }
                
                const diff = localHeight - prodHeight;
                const diffStr = diff > 0 ? `+${diff}` : `${diff}`;
                
                console.log(
                    section.name.padEnd(25) + 
                    `${prodHeight}px`.padEnd(15) + 
                    `${localHeight}px`.padEnd(15) + 
                    `${diffStr}px`
                );
                
                totalProdHeight += prodHeight;
                totalLocalHeight += localHeight;
                
            } catch (error) {
                console.log(
                    section.name.padEnd(25) + 
                    'Not found'.padEnd(15) + 
                    'Not found'.padEnd(15) + 
                    'N/A'
                );
            }
        }
        
        console.log('-'.repeat(70));
        console.log(
            'TOTAL'.padEnd(25) + 
            `${totalProdHeight}px`.padEnd(15) + 
            `${totalLocalHeight}px`.padEnd(15) + 
            `+${totalLocalHeight - totalProdHeight}px`
        );
        
        // Get full page heights
        const prodFullHeight = await prodPage.evaluate(() => document.body.scrollHeight);
        const localFullHeight = await localPage.evaluate(() => document.body.scrollHeight);
        
        console.log('\n📏 Full Page Heights:');
        console.log(`   Production: ${prodFullHeight}px`);
        console.log(`   Local: ${localFullHeight}px`);
        console.log(`   Difference: +${localFullHeight - prodFullHeight}px`);
        
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await browser.close();
    }
}

compareSectionHeights();