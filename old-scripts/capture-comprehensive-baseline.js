const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// Create timestamp directory for baseline
const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
const baselineDir = path.join(__dirname, 'baseline-screenshots', timestamp);

// Ensure directories exist
if (!fs.existsSync(baselineDir)) {
  fs.mkdirSync(baselineDir, { recursive: true });
}

// Viewport configurations
const viewports = [
  { name: 'mobile', width: 375, height: 667 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1920, height: 1080 }
];

// Pages to capture
const pages = [
  {
    name: 'business-listing',
    url: 'http://localhost:8001/businesses-for-sale/in-melbourne-vic-3000',
    template: 'brand.blade.php',
    interactions: [
      { name: 'filters-open', action: async (page) => {
        // Try to open filters if they exist
        const filterButton = await page.$('.filter-toggle, button:has-text("Filters")');
        if (filterButton) await filterButton.click();
        await page.waitForTimeout(500);
      }},
      { name: 'sort-dropdown', action: async (page) => {
        // Try to open sort dropdown
        const sortButton = await page.$('.sort-dropdown, select[name="sort"]');
        if (sortButton) await sortButton.click();
        await page.waitForTimeout(500);
      }}
    ]
  },
  {
    name: 'home-page',
    url: 'http://localhost:8001/',
    template: 'home page',
    interactions: [
      { name: 'search-focused', action: async (page) => {
        const searchInput = await page.$('input[type="search"], input[placeholder*="Search"]');
        if (searchInput) await searchInput.focus();
        await page.waitForTimeout(500);
      }}
    ]
  },
  {
    name: 'individual-listing',
    url: 'http://localhost:8001/franchise-business-for-sale/au/cafe-food-beverage/milkylane/melbourne-melbourne-3000-vic/4019014',
    template: 'default-landing-page-preview.blade.php',
    interactions: [
      { name: 'faq-expanded', action: async (page) => {
        // Try to expand first FAQ item
        const faqButton = await page.$('.accordion-button, [data-bs-toggle="collapse"]').first();
        if (faqButton) await faqButton.click();
        await page.waitForTimeout(500);
      }}
    ]
  }
];

// Key sections to capture separately
const pageSections = {
  'business-listing': [
    { name: 'header', selector: 'header, .navbar' },
    { name: 'hero', selector: '.hero-section, .jumbotron, .page-header' },
    { name: 'filters', selector: '.filter-container, .filter-wrapper, .search-filters' },
    { name: 'toggle-section', selector: '.border-b.border-t.flex.border-gray-800' },
    { name: 'listing-grid', selector: '.listing-grid, .card-grid, main .container' },
    { name: 'footer', selector: 'footer' }
  ],
  'home-page': [
    { name: 'header', selector: 'header, .navbar' },
    { name: 'hero', selector: '.hero-section, .hero, section:first-of-type' },
    { name: 'search', selector: '.search-section, .search-container' },
    { name: 'categories', selector: '.categories-section, .category-grid' },
    { name: 'footer', selector: 'footer' }
  ],
  'individual-listing': [
    { name: 'header', selector: 'header, .navbar' },
    { name: 'hero', selector: '.hero-section, .listing-hero, .brand-hero' },
    { name: 'content', selector: '.main-content, .listing-content, article' },
    { name: 'faq', selector: '.faq-section, .accordion, #accordionExample' },
    { name: 'cta', selector: '.cta-section, .contact-section' },
    { name: 'footer', selector: 'footer' }
  ]
};

async function captureBaseline() {
  const browser = await chromium.launch({
    headless: true
  });

  const results = {
    timestamp,
    baselineDir,
    captures: []
  };

  for (const viewport of viewports) {
    console.log(`\n📱 Testing ${viewport.name} viewport (${viewport.width}x${viewport.height})`);
    
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

        // Wait for content to stabilize
        await page.waitForTimeout(2000);

        // Create page directory
        const pageDir = path.join(baselineDir, pageInfo.name, viewport.name);
        if (!fs.existsSync(pageDir)) {
          fs.mkdirSync(pageDir, { recursive: true });
        }

        // Capture full page
        const fullPagePath = path.join(pageDir, 'full-page.png');
        await page.screenshot({ 
          path: fullPagePath,
          fullPage: true 
        });
        console.log(`    ✅ Full page captured`);

        // Capture viewport only
        const viewportPath = path.join(pageDir, 'viewport.png');
        await page.screenshot({ 
          path: viewportPath,
          fullPage: false 
        });

        // Capture individual sections
        const sections = pageSections[pageInfo.name] || [];
        for (const section of sections) {
          try {
            const element = await page.$(section.selector);
            if (element) {
              const sectionPath = path.join(pageDir, `section-${section.name}.png`);
              await element.screenshot({ path: sectionPath });
              console.log(`    ✅ Section "${section.name}" captured`);
            }
          } catch (err) {
            console.log(`    ⚠️  Section "${section.name}" not found`);
          }
        }

        // Capture interactive states
        if (pageInfo.interactions) {
          for (const interaction of pageInfo.interactions) {
            try {
              // Take baseline before interaction
              await interaction.action(page);
              const interactionPath = path.join(pageDir, `state-${interaction.name}.png`);
              await page.screenshot({ 
                path: interactionPath,
                fullPage: false 
              });
              console.log(`    ✅ Interactive state "${interaction.name}" captured`);
              
              // Reset page for next interaction
              await page.reload({ waitUntil: 'networkidle' });
              await page.waitForTimeout(1000);
            } catch (err) {
              console.log(`    ⚠️  Interactive state "${interaction.name}" failed`);
            }
          }
        }

        results.captures.push({
          page: pageInfo.name,
          viewport: viewport.name,
          success: true
        });

      } catch (error) {
        console.error(`    ❌ Error capturing ${pageInfo.name}:`, error.message);
        results.captures.push({
          page: pageInfo.name,
          viewport: viewport.name,
          success: false,
          error: error.message
        });
      }
    }

    await context.close();
  }

  await browser.close();

  // Save summary report
  const reportPath = path.join(baselineDir, 'capture-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));

  console.log('\n✨ Baseline capture complete!');
  console.log(`📁 Screenshots saved to: ${baselineDir}`);
  console.log(`📊 Report saved to: ${reportPath}`);
  
  return results;
}

// Run the capture
captureBaseline().catch(console.error);