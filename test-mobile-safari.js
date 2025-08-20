const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');

async function testMobileSafari() {
  console.log('🔍 Testing mobile version of businesses-for-sale page...\n');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    timeout: 60000
  });

  try {
    const page = await browser.newPage();
    
    // Set mobile Safari viewport (iPhone 12 Pro)
    await page.setViewport({
      width: 390,
      height: 844,
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true
    });

    // Set Safari user agent
    await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1');

    console.log('📱 Loading businesses-for-sale page in mobile Safari mode...');
    
    // Navigate with timeout
    await page.goto('http://directory.hattch-localhost/businesses-for-sale', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    console.log('✅ Page loaded successfully');

    // Wait for any animations or lazy loading
    await page.waitForTimeout(2000);

    // Capture mobile screenshot
    const timestamp = new Date().toISOString().replace(/[:]/g, '-').split('.')[0];
    const outputDir = `mobile-safari-test-${timestamp}`;
    await fs.mkdir(outputDir, { recursive: true });

    const screenshotPath = path.join(outputDir, 'mobile-safari-full.png');
    await page.screenshot({
      path: screenshotPath,
      fullPage: true
    });

    console.log(`📸 Mobile screenshot captured: ${screenshotPath}`);

    // Test mobile interactions
    console.log('\n🔄 Testing mobile interactions...');
    
    // Check for mobile menu
    const mobileMenuExists = await page.$('.mobile-menu, .hamburger, .menu-toggle, [data-toggle="mobile-menu"]');
    if (mobileMenuExists) {
      console.log('✅ Mobile menu found');
      
      // Try to open mobile menu
      await mobileMenuExists.click();
      await page.waitForTimeout(500);
      
      const menuOpenPath = path.join(outputDir, 'mobile-menu-open.png');
      await page.screenshot({
        path: menuOpenPath,
        fullPage: false
      });
      console.log(`📸 Mobile menu captured: ${menuOpenPath}`);
    } else {
      console.log('⚠️  No mobile menu found');
    }

    // Check for responsive elements
    console.log('\n📋 Checking responsive elements...');
    
    const analysis = await page.evaluate(() => {
      const issues = [];
      const recommendations = [];
      
      // Check horizontal overflow
      const hasHorizontalScroll = document.documentElement.scrollWidth > window.innerWidth;
      if (hasHorizontalScroll) {
        issues.push('Horizontal scroll detected - page wider than viewport');
      }

      // Check text size
      const textElements = document.querySelectorAll('p, span, div, h1, h2, h3, h4, h5, h6, a');
      let smallTextCount = 0;
      textElements.forEach(el => {
        const fontSize = parseFloat(window.getComputedStyle(el).fontSize);
        if (fontSize < 14) {
          smallTextCount++;
        }
      });
      
      if (smallTextCount > 0) {
        issues.push(`${smallTextCount} elements with text smaller than 14px (may be hard to read on mobile)`);
      }

      // Check touch targets
      const interactiveElements = document.querySelectorAll('button, a, input, select, [role="button"]');
      let smallTouchTargets = 0;
      interactiveElements.forEach(el => {
        const rect = el.getBoundingClientRect();
        if (rect.width < 44 || rect.height < 44) {
          smallTouchTargets++;
        }
      });
      
      if (smallTouchTargets > 0) {
        issues.push(`${smallTouchTargets} touch targets smaller than 44px (iOS accessibility guideline)`);
      }

      // Check for common mobile patterns
      const hasSticky = document.querySelector('[style*="position: sticky"], [style*="position: fixed"]');
      if (hasSticky) {
        recommendations.push('Sticky elements detected - verify they don\'t cover content on mobile');
      }

      // Check viewport meta tag
      const viewportMeta = document.querySelector('meta[name="viewport"]');
      if (!viewportMeta) {
        issues.push('Missing viewport meta tag');
      } else {
        const content = viewportMeta.getAttribute('content');
        if (!content.includes('width=device-width')) {
          issues.push('Viewport meta tag missing width=device-width');
        }
        if (content.includes('user-scalable=no')) {
          issues.push('Zoom disabled (user-scalable=no) - accessibility issue');
        }
      }

      // Check for layout elements
      const cards = document.querySelectorAll('.card, .business-card, .listing-card, [class*="card"]');
      const buttons = document.querySelectorAll('button, .btn, [role="button"]');
      const forms = document.querySelectorAll('form, input, select, textarea');
      
      return {
        issues,
        recommendations,
        elements: {
          cards: cards.length,
          buttons: buttons.length,
          forms: forms.length,
          hasHorizontalScroll,
          viewportWidth: window.innerWidth,
          documentWidth: document.documentElement.scrollWidth
        }
      };
    });

    // Display results
    console.log('\n📊 Mobile Analysis Results:');
    console.log(`Elements found: ${analysis.elements.cards} cards, ${analysis.elements.buttons} buttons, ${analysis.elements.forms} form elements`);
    console.log(`Viewport: ${analysis.elements.viewportWidth}px, Document: ${analysis.elements.documentWidth}px`);

    if (analysis.issues.length === 0) {
      console.log('✅ No mobile issues detected!');
    } else {
      console.log('\n⚠️  Issues detected:');
      analysis.issues.forEach((issue, i) => {
        console.log(`  ${i + 1}. ${issue}`);
      });
    }

    if (analysis.recommendations.length > 0) {
      console.log('\n💡 Recommendations:');
      analysis.recommendations.forEach((rec, i) => {
        console.log(`  ${i + 1}. ${rec}`);
      });
    }

    // Test Safari-specific features
    console.log('\n🧪 Testing Safari-specific compatibility...');
    
    const safariTests = await page.evaluate(() => {
      const results = {
        webkitFeatures: !!window.webkit,
        touchSupport: 'ontouchstart' in window,
        devicePixelRatio: window.devicePixelRatio,
        safariUserAgent: navigator.userAgent.includes('Safari'),
        modernFeatures: {
          flexbox: CSS.supports('display', 'flex'),
          grid: CSS.supports('display', 'grid'),
          customProperties: CSS.supports('--test', 'var(--test)'),
          viewport: CSS.supports('width', '100vw')
        }
      };
      return results;
    });

    console.log('Safari compatibility:');
    console.log(`  WebKit features: ${safariTests.webkitFeatures ? '✅' : '❌'}`);
    console.log(`  Touch support: ${safariTests.touchSupport ? '✅' : '❌'}`);
    console.log(`  Device pixel ratio: ${safariTests.devicePixelRatio}`);
    console.log(`  Safari user agent: ${safariTests.safariUserAgent ? '✅' : '❌'}`);
    console.log('  Modern CSS features:');
    console.log(`    Flexbox: ${safariTests.modernFeatures.flexbox ? '✅' : '❌'}`);
    console.log(`    Grid: ${safariTests.modernFeatures.grid ? '✅' : '❌'}`);
    console.log(`    CSS Variables: ${safariTests.modernFeatures.customProperties ? '✅' : '❌'}`);
    console.log(`    Viewport units: ${safariTests.modernFeatures.viewport ? '✅' : '❌'}`);

    // Save detailed report
    const report = {
      timestamp: new Date().toISOString(),
      url: 'http://directory.hattch-localhost/businesses-for-sale',
      device: 'iPhone 12 Pro (Mobile Safari)',
      viewport: { width: 390, height: 844 },
      analysis,
      safariTests,
      screenshots: [screenshotPath]
    };

    await fs.writeFile(
      path.join(outputDir, 'mobile-safari-report.json'),
      JSON.stringify(report, null, 2)
    );

    console.log(`\n📄 Full report saved: ${path.join(outputDir, 'mobile-safari-report.json')}`);
    console.log(`📁 All files saved to: ${outputDir}/`);

    // Final assessment
    const score = Math.max(0, 100 - (analysis.issues.length * 15));
    console.log(`\n🎯 Mobile Safari Compatibility Score: ${score}/100`);
    
    if (score >= 85) {
      console.log('✅ Excellent mobile Safari compatibility!');
    } else if (score >= 70) {
      console.log('⚠️  Good compatibility with minor issues to address');
    } else {
      console.log('❌ Significant mobile Safari issues need attention');
    }

  } catch (error) {
    console.error('❌ Error during mobile Safari testing:', error.message);
  } finally {
    await browser.close();
  }
}

// Run the test
testMobileSafari().catch(console.error);