const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// Create screenshots directory if it doesn't exist
const screenshotsDir = path.join(__dirname, 'baseline-screenshots');
if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

async function captureBaseline() {
  const browser = await chromium.launch({
    headless: true
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  const page = await context.newPage();

  // Pages to capture
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

  for (const pageInfo of pages) {
    console.log(`Capturing ${pageInfo.name} (${pageInfo.template})...`);
    
    try {
      await page.goto(pageInfo.url, {
        waitUntil: 'networkidle',
        timeout: 30000
      });

      // Wait for content to load
      await page.waitForTimeout(3000);

      // Capture full page screenshot
      await page.screenshot({
        path: path.join(screenshotsDir, `${pageInfo.name}-full.png`),
        fullPage: true
      });

      // Capture above-the-fold screenshot
      await page.screenshot({
        path: path.join(screenshotsDir, `${pageInfo.name}-viewport.png`),
        fullPage: false
      });

      console.log(`✓ Captured ${pageInfo.name}`);
    } catch (error) {
      console.error(`✗ Error capturing ${pageInfo.name}:`, error.message);
    }
  }

  await browser.close();
  console.log('\nBaseline screenshots captured successfully!');
  console.log(`Screenshots saved to: ${screenshotsDir}`);
}

// Run the capture
captureBaseline().catch(console.error);