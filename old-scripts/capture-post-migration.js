const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// Create timestamp directory for post-migration screenshots
const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
const postMigrationDir = path.join(__dirname, 'post-migration-screenshots', timestamp);

// Ensure directories exist
if (!fs.existsSync(postMigrationDir)) {
  fs.mkdirSync(postMigrationDir, { recursive: true });
}

// Pages to capture (same as baseline)
const pages = [
  {
    name: 'business-listing',
    url: 'http://localhost:8001/businesses-for-sale/in-melbourne-vic-3000',
    template: 'brand.blade.php'
  },
  {
    name: 'home-page',
    url: 'http://localhost:8001/',
    template: 'home page'
  },
  {
    name: 'individual-listing',
    url: 'http://localhost:8001/franchise-business-for-sale/au/cafe-food-beverage/milkylane/melbourne-melbourne-3000-vic/4019014',
    template: 'default-landing-page-preview.blade.php'
  }
];

// Viewport configurations
const viewports = [
  { name: 'mobile', width: 375, height: 667 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1920, height: 1080 }
];

async function capturePostMigration() {
  const browser = await chromium.launch({
    headless: true
  });

  console.log('🚀 Starting post-migration capture...\n');

  for (const viewport of viewports) {
    console.log(`📱 Capturing ${viewport.name} viewport (${viewport.width}x${viewport.height})`);
    
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height }
    });
    const page = await context.newPage();

    for (const pageInfo of pages) {
      console.log(`  📸 Capturing ${pageInfo.name}...`);
      
      try {
        await page.goto(pageInfo.url, {
          waitUntil: 'networkidle',
          timeout: 30000
        });

        // Wait for content to load
        await page.waitForTimeout(3000);

        // Create directory structure
        const pageDir = path.join(postMigrationDir, pageInfo.name, viewport.name);
        if (!fs.existsSync(pageDir)) {
          fs.mkdirSync(pageDir, { recursive: true });
        }

        // Capture full page screenshot
        const fullPagePath = path.join(pageDir, 'full-page.png');
        await page.screenshot({ 
          path: fullPagePath,
          fullPage: true 
        });

        // Capture viewport screenshot
        const viewportPath = path.join(pageDir, 'viewport.png');
        await page.screenshot({ 
          path: viewportPath,
          fullPage: false 
        });

        console.log(`    ✅ Captured successfully`);

      } catch (error) {
        console.error(`    ❌ Error capturing ${pageInfo.name}:`, error.message);
      }
    }

    await context.close();
  }

  await browser.close();

  console.log('\n✨ Post-migration capture complete!');
  console.log(`📁 Screenshots saved to: ${postMigrationDir}`);
  
  // Create comparison command
  const baselineDir = 'baseline-screenshots/2025-05-24T08-42-20';
  console.log('\n🔧 To compare with baseline, run:');
  console.log(`node batch-compare.js --baseline="${baselineDir}" --current="${path.relative(__dirname, postMigrationDir)}" --output="migration-report"`);
}

// Run the capture
capturePostMigration().catch(console.error);