const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function captureFixedVersion() {
  const browser = await chromium.launch({
    headless: true
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  
  const page = await context.newPage();

  console.log('📸 Capturing fixed business listing page...');
  
  try {
    await page.goto('http://localhost:8001/businesses-for-sale/in-melbourne-vic-3000', {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    // Wait for content to load
    await page.waitForTimeout(2000);
    
    // Check if modals are hidden
    const modalsVisible = await page.evaluate(() => {
      const modals = document.querySelectorAll('.modal');
      let visibleCount = 0;
      modals.forEach(modal => {
        const computedStyle = window.getComputedStyle(modal);
        if (computedStyle.display !== 'none') {
          visibleCount++;
          console.log('Modal visible:', modal.id || modal.className);
        }
      });
      return visibleCount;
    });
    
    console.log(`  Modal check: ${modalsVisible} modals visible (should be 0)`);
    
    // Check content width
    const contentWidth = await page.evaluate(() => {
      const mainContent = document.querySelector('.max-w-\\[1280px\\]');
      if (mainContent) {
        const rect = mainContent.getBoundingClientRect();
        return {
          width: rect.width,
          maxWidth: window.getComputedStyle(mainContent).maxWidth
        };
      }
      return null;
    });
    
    if (contentWidth) {
      console.log(`  Content width: ${contentWidth.width}px (max-width: ${contentWidth.maxWidth})`);
    }

    // Capture screenshot
    const screenshotPath = path.join(__dirname, 'fixed-business-listing.png');
    await page.screenshot({ 
      path: screenshotPath,
      fullPage: true 
    });

    console.log(`  ✅ Screenshot saved to: ${screenshotPath}`);

  } catch (error) {
    console.error('  ❌ Error:', error.message);
  }

  await browser.close();
}

captureFixedVersion().catch(console.error);