const fs = require('fs');
const path = require('path');

/**
 * Detects available browser executable path across different platforms
 * Checks for common browser locations and returns the first available
 */
function getBrowserPath() {
  const paths = [
    // macOS paths
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
    
    // Windows paths
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    
    // Linux paths
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/snap/bin/chromium'
  ];
  
  // Find first existing browser
  const foundPath = paths.find(browserPath => {
    try {
      return fs.existsSync(browserPath);
    } catch (error) {
      return false;
    }
  });
  
  if (foundPath) {
    console.log(`✅ Browser detected: ${path.basename(foundPath)}`);
    return foundPath;
  }
  
  // Fallback to puppeteer's bundled chromium
  console.log('⚠️  No browser found, using bundled Chromium');
  return undefined; // Let puppeteer use its default
}

/**
 * Gets browser launch options with proper configuration
 */
function getBrowserOptions(customPath) {
  const options = {
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu'
    ]
  };
  
  if (customPath) {
    options.executablePath = customPath;
  }
  
  return options;
}

module.exports = {
  getBrowserPath,
  getBrowserOptions
};