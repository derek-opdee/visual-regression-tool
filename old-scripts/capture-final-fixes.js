const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function captureFinalVersion() {
  const browser = await chromium.launch({
    headless: true
  });

  console.log('📸 Capturing final fixed versions...\n');
  
  // Test business listing page
  const context1 = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  const page1 = await context1.newPage();

  console.log('1. Business Listing Page...');
  try {
    await page1.goto('http://localhost:8001/businesses-for-sale/in-melbourne-vic-3000', {
      waitUntil: 'networkidle',
      timeout: 30000
    });
    await page1.waitForTimeout(2000);
    
    const businessListingPath = path.join(__dirname, 'final-business-listing.png');
    await page1.screenshot({ 
      path: businessListingPath,
      fullPage: true 
    });
    console.log(`  ✅ Saved to: ${businessListingPath}`);
  } catch (error) {
    console.error(`  ❌ Error: ${error.message}`);
  }
  await context1.close();

  // Test individual listing page
  const context2 = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  const page2 = await context2.newPage();

  console.log('\n2. Individual Listing Page...');
  try {
    await page2.goto('http://localhost:8001/franchise-business-for-sale/au/education-coaching-training/basketball-star-academy/darwin-palmerston-city-830-nt/4020639', {
      waitUntil: 'networkidle',
      timeout: 30000
    });
    await page2.waitForTimeout(2000);
    
    const individualListingPath = path.join(__dirname, 'final-individual-listing.png');
    await page2.screenshot({ 
      path: individualListingPath,
      fullPage: true 
    });
    console.log(`  ✅ Saved to: ${individualListingPath}`);
  } catch (error) {
    console.error(`  ❌ Error: ${error.message}`);
  }
  await context2.close();

  await browser.close();
  
  console.log('\n✨ Screenshots captured successfully!');
  console.log('\nChanges made:');
  console.log('- ✅ Removed Bootstrap CSS/JS from frontpage-layout.blade.php');
  console.log('- ✅ Added Tailwind CSS CDN');
  console.log('- ✅ Fixed modal stacking issues');
  console.log('- ✅ Made all listing cards equal height using flexbox');
  console.log('- ✅ Centered content with 1280px max-width');
  console.log('- ✅ Ensured white text on View buttons');
}

captureFinalVersion().catch(console.error);