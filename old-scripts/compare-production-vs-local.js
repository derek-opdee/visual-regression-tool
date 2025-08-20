const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// Define test pages and viewports
const pages = [
  {
    name: 'homepage',
    paths: {
      production: 'https://directory.hattch.com',
      local: 'http://directory.hattch-localhost'
    }
  },
  {
    name: 'businesses-for-sale',
    paths: {
      production: 'https://directory.hattch.com/businesses-for-sale',
      local: 'http://directory.hattch-localhost/businesses-for-sale'
    }
  },
  {
    name: 'businesses-melbourne',
    paths: {
      production: 'https://directory.hattch.com/businesses-for-sale/in-melbourne-vic-3000',
      local: 'http://directory.hattch-localhost/businesses-for-sale/in-melbourne-vic-3000'
    }
  },
  {
    name: 'franchises-for-sale',
    paths: {
      production: 'https://directory.hattch.com/franchises-for-sale',
      local: 'http://directory.hattch-localhost/franchises-for-sale'
    }
  },
  {
    name: 'brand-listing',
    paths: {
      production: 'https://directory.hattch.com/franchise-business-for-sale/au/cafe-food-beverage/milkylane/melbourne-melbourne-3000-vic/4019014',
      local: 'http://directory.hattch-localhost/franchise-business-for-sale/au/cafe-food-beverage/milkylane/melbourne-melbourne-3000-vic/4019014'
    }
  },
  {
    name: 'assessment',
    paths: {
      production: 'https://directory.hattch.com/assessment',
      local: 'http://directory.hattch-localhost/assessment'
    }
  }
];

const viewports = [
  { name: 'mobile', width: 375, height: 667, device: 'iPhone SE' },
  { name: 'tablet', width: 768, height: 1024, device: 'iPad' },
  { name: 'desktop', width: 1920, height: 1080, device: 'Desktop HD' }
];

async function captureComparison() {
  const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
  const baseDir = path.join(__dirname, 'production-vs-local', timestamp);
  
  // Create directories
  fs.mkdirSync(baseDir, { recursive: true });
  fs.mkdirSync(path.join(baseDir, 'production'), { recursive: true });
  fs.mkdirSync(path.join(baseDir, 'local'), { recursive: true });

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const results = {
    timestamp,
    comparisons: []
  };

  console.log('🚀 Starting visual regression comparison...\n');
  console.log('📍 Production: directory.hattch.com');
  console.log('📍 Local: directory.hattch-localhost\n');

  for (const viewport of viewports) {
    console.log(`\n📱 Testing ${viewport.device} (${viewport.width}x${viewport.height})`);
    
    for (const page of pages) {
      console.log(`\n  📸 Capturing ${page.name}...`);
      
      // Capture production
      try {
        const context = await browser.newContext({
          viewport: { width: viewport.width, height: viewport.height },
          userAgent: viewport.name === 'mobile' 
            ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15'
            : undefined
        });
        const prodPage = await context.newPage();
        
        console.log(`    🌐 Production...`);
        await prodPage.goto(page.paths.production, {
          waitUntil: 'networkidle',
          timeout: 60000
        });
        
        // Wait for content to stabilize
        await prodPage.waitForTimeout(3000);
        
        // Special handling for assessment page
        if (page.name === 'assessment') {
          // Check if drag-drop elements are present
          const hasDragDrop = await prodPage.evaluate(() => {
            return document.querySelectorAll('[draggable="true"]').length > 0;
          });
          console.log(`      Drag-drop elements found: ${hasDragDrop}`);
        }
        
        const prodScreenshotPath = path.join(baseDir, 'production', `${page.name}-${viewport.name}.png`);
        await prodPage.screenshot({ 
          path: prodScreenshotPath,
          fullPage: true 
        });
        console.log(`      ✅ Captured`);
        
        await context.close();
      } catch (error) {
        console.error(`      ❌ Production error: ${error.message}`);
      }
      
      // Capture local
      try {
        const context = await browser.newContext({
          viewport: { width: viewport.width, height: viewport.height },
          userAgent: viewport.name === 'mobile' 
            ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15'
            : undefined
        });
        const localPage = await context.newPage();
        
        console.log(`    💻 Local...`);
        await localPage.goto(page.paths.local, {
          waitUntil: 'networkidle',
          timeout: 60000
        });
        
        // Wait for content to stabilize
        await localPage.waitForTimeout(3000);
        
        // Special handling for assessment page
        if (page.name === 'assessment') {
          // Check if drag-drop elements are present
          const hasDragDrop = await localPage.evaluate(() => {
            return document.querySelectorAll('[draggable="true"]').length > 0;
          });
          console.log(`      Drag-drop elements found: ${hasDragDrop}`);
        }
        
        const localScreenshotPath = path.join(baseDir, 'local', `${page.name}-${viewport.name}.png`);
        await localPage.screenshot({ 
          path: localScreenshotPath,
          fullPage: true 
        });
        console.log(`      ✅ Captured`);
        
        await context.close();
        
        results.comparisons.push({
          page: page.name,
          viewport: viewport.name,
          production: `production/${page.name}-${viewport.name}.png`,
          local: `local/${page.name}-${viewport.name}.png`
        });
        
      } catch (error) {
        console.error(`      ❌ Local error: ${error.message}`);
      }
    }
  }

  await browser.close();

  // Save comparison metadata
  const metadataPath = path.join(baseDir, 'comparison-metadata.json');
  fs.writeFileSync(metadataPath, JSON.stringify(results, null, 2));

  // Generate HTML report
  const reportHtml = generateComparisonReport(results, baseDir);
  const reportPath = path.join(baseDir, 'comparison-report.html');
  fs.writeFileSync(reportPath, reportHtml);

  console.log('\n✨ Visual regression comparison complete!');
  console.log(`📁 Screenshots saved to: ${baseDir}`);
  console.log(`📊 Report available at: ${reportPath}`);
  
  // Generate comparison command
  console.log('\n🔧 To run pixel-by-pixel comparison:');
  console.log(`cd ${baseDir}`);
  console.log('node ../../batch-compare.js production local comparison-results\n');
}

function generateComparisonReport(results, baseDir) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Production vs Local - Visual Comparison</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 20px;
            background: #f5f5f5;
        }
        .container {
            max-width: 1400px;
            margin: 0 auto;
        }
        h1, h2 {
            color: #333;
        }
        .comparison-grid {
            display: grid;
            gap: 30px;
            margin-bottom: 50px;
        }
        .comparison-item {
            background: white;
            border-radius: 8px;
            padding: 20px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .comparison-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 2px solid #eee;
        }
        .viewport-badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
        }
        .viewport-mobile { background: #e3f2fd; color: #1976d2; }
        .viewport-tablet { background: #f3e5f5; color: #7b1fa2; }
        .viewport-desktop { background: #e8f5e9; color: #388e3c; }
        .images-container {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
        }
        .image-wrapper {
            position: relative;
        }
        .image-label {
            position: absolute;
            top: 10px;
            left: 10px;
            background: rgba(0,0,0,0.7);
            color: white;
            padding: 5px 10px;
            border-radius: 4px;
            font-size: 14px;
            font-weight: 600;
        }
        .screenshot {
            width: 100%;
            height: auto;
            border: 1px solid #ddd;
            border-radius: 4px;
        }
        .navigation {
            position: sticky;
            top: 20px;
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            margin-bottom: 30px;
        }
        .nav-links {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
        }
        .nav-link {
            padding: 8px 16px;
            background: #f0f0f0;
            border-radius: 4px;
            text-decoration: none;
            color: #333;
            font-size: 14px;
            transition: all 0.2s;
        }
        .nav-link:hover {
            background: #e0e0e0;
            transform: translateY(-1px);
        }
        .metadata {
            background: #f9f9f9;
            padding: 15px;
            border-radius: 4px;
            margin-bottom: 20px;
            font-size: 14px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🔍 Visual Regression: Production vs Local</h1>
        <div class="metadata">
            <strong>Timestamp:</strong> ${results.timestamp}<br>
            <strong>Production:</strong> directory.hattch.com<br>
            <strong>Local:</strong> directory.hattch-localhost<br>
            <strong>Total Comparisons:</strong> ${results.comparisons.length}
        </div>
        
        <nav class="navigation">
            <h3>Quick Navigation</h3>
            <div class="nav-links">
                ${pages.map(page => `
                    <a href="#${page.name}" class="nav-link">${page.name.replace(/-/g, ' ')}</a>
                `).join('')}
            </div>
        </nav>
        
        <div class="comparison-grid">
            ${pages.map(page => `
                <div id="${page.name}" class="comparison-section">
                    <h2>${page.name.replace(/-/g, ' ').toUpperCase()}</h2>
                    ${viewports.map(viewport => {
                        const comparison = results.comparisons.find(
                            c => c.page === page.name && c.viewport === viewport.name
                        );
                        if (!comparison) return '';
                        
                        return `
                        <div class="comparison-item">
                            <div class="comparison-header">
                                <h3>${page.name} - ${viewport.device}</h3>
                                <span class="viewport-badge viewport-${viewport.name}">${viewport.name}</span>
                            </div>
                            <div class="images-container">
                                <div class="image-wrapper">
                                    <div class="image-label">PRODUCTION</div>
                                    <img src="${comparison.production}" alt="Production" class="screenshot" loading="lazy">
                                </div>
                                <div class="image-wrapper">
                                    <div class="image-label">LOCAL</div>
                                    <img src="${comparison.local}" alt="Local" class="screenshot" loading="lazy">
                                </div>
                            </div>
                        </div>
                        `;
                    }).join('')}
                </div>
            `).join('')}
        </div>
    </div>
</body>
</html>
  `;
}

// Run the comparison
captureComparison().catch(console.error);