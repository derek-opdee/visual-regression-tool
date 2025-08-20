const puppeteer = require('puppeteer');

async function testBasic() {
  console.log('Testing basic puppeteer launch...');
  
  try {
    const browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox', 
        '--disable-setuid-sandbox'
      ]
    });
    
    console.log('✅ Browser launched successfully');
    
    const page = await browser.newPage();
    await page.goto('https://google.com', { waitUntil: 'domcontentloaded', timeout: 10000 });
    console.log('✅ Page loaded successfully');
    
    await browser.close();
    console.log('✅ Test completed successfully');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testBasic();