# 🎭 Playwright Visual Regression Tool - Complete Guide v3.0

## 🚀 Major Upgrade: From Puppeteer to Playwright

The Visual Regression Tool has been completely upgraded with **Playwright**, providing enterprise-grade cross-browser testing, mobile emulation, and advanced AI-friendly interaction capabilities.

## ✨ What's New in v3.0

### 🌟 Key Improvements over Puppeteer

| Feature | Puppeteer (v2.x) | Playwright (v3.0) | Benefit |
|---------|------------------|-------------------|---------|
| **Browser Support** | Chromium only | Chromium, Firefox, WebKit | True cross-browser testing |
| **Mobile Emulation** | Basic viewport | Real device emulation | Accurate mobile testing |
| **API Design** | Callback-based | Promise-based with async | Cleaner, more maintainable code |
| **Network Control** | Limited | Full interception & mocking | Better testing scenarios |
| **Auto-waiting** | Manual waits needed | Smart auto-waiting | More reliable tests |
| **Debugging** | Basic | Built-in trace viewer | Easier troubleshooting |
| **Parallel Testing** | Manual setup | Native support | Faster test execution |
| **Video Recording** | Screenshot only | Full video capture | Better debugging |

## 📦 Installation

```bash
# Already installed! Just verify:
npm list playwright

# If needed, reinstall browsers:
npx playwright install
```

## 🎯 Quick Start

### Basic Capture (Playwright - Default)
```bash
# Capture with Playwright (default engine)
node cli.js capture -u https://example.com

# Explicitly use Playwright
node cli.js capture -u https://example.com --engine playwright

# Use specific browser
node cli.js capture -u https://example.com --browser firefox

# Full page capture with analysis
node cli.js capture -u https://example.com --full-page --analyze
```

### Cross-Browser Testing 🌐
```bash
# Test on ALL browsers (Chromium, Firefox, WebKit/Safari)
node cli.js crossbrowser -u https://example.com

# Specific viewport across all browsers
node cli.js crossbrowser -u https://example.com --viewport mobile

# Or use the capture command with --browser all
node cli.js capture -u https://example.com --browser all
```

### Mobile Device Testing 📱
```bash
# Test on default mobile devices
node cli.js mobile -u https://example.com

# Specific devices
node cli.js mobile -u https://example.com --devices "iPhone 14 Pro,Pixel 7,iPad Pro"

# Available devices:
# - iPhone 14 Pro / Pro Max
# - iPhone 13 / SE
# - iPad Pro / Mini
# - Pixel 7
# - Galaxy S22 / Tab S8
```

### Interactive Sessions (AI-Friendly) 🤖
```bash
# Start interactive session for AI control
node cli.js interact -u https://example.com

# With specific browser
node cli.js interact -u https://example.com --browser firefox

# With device emulation
node cli.js interact -u https://example.com --device "iPhone 14 Pro"

# Record the session
node cli.js interact -u https://example.com --record
```

## 🎮 Advanced Features

### 1. Interaction Sequences
```bash
# Perform complex interactions during capture
node cli.js capture -u https://example.com \
  --interact '[
    {"type": "click", "selector": ".menu-button"},
    {"type": "wait", "timeout": 1000},
    {"type": "type", "selector": "#search", "text": "visual regression"},
    {"type": "press", "key": "Enter"},
    {"type": "wait", "selector": ".results"},
    {"type": "screenshot", "path": "after-search.png"}
  ]'
```

### 2. Device-Specific Testing
```bash
# Mobile-only testing
node cli.js capture -u https://example.com \
  --devices "iPhone 14 Pro,Pixel 7" \
  --full-page

# Tablet testing
node cli.js capture -u https://example.com \
  --devices "iPad Pro,Galaxy Tab S8"
```

### 3. Headed Mode (Visible Browser)
```bash
# Watch the browser in action
node cli.js capture -u https://example.com --headed

# Interactive session is always visible
node cli.js interact -u https://example.com
```

### 4. Network Control
```bash
# Block ads during capture (built-in)
node cli.js capture -u https://example.com --block-ads

# Custom network filtering via API
```

## 🤖 AI Integration API

The interactive session provides a comprehensive API for AI systems:

### Starting a Session
```javascript
const PlaywrightVRT = require('./lib/playwright-vrt');
const vrt = new PlaywrightVRT({ browser: 'chromium' });

const session = await vrt.interactiveSession('https://example.com');

// Use the API
const url = await session.api.getUrl();
const screenshot = await session.api.screenshot();
const elements = await session.api.findElements('button');
```

### Available API Methods

| Method | Description | Example |
|--------|-------------|---------|
| `click(selector)` | Click an element | `api.click('.button')` |
| `type(selector, text)` | Type text | `api.type('#input', 'text')` |
| `hover(selector)` | Hover over element | `api.hover('.menu')` |
| `screenshot(options)` | Take screenshot | `api.screenshot({fullPage: true})` |
| `evaluate(fn, args)` | Run JS in browser | `api.evaluate(() => document.title)` |
| `getContent()` | Get page HTML | `api.getContent()` |
| `getUrl()` | Get current URL | `api.getUrl()` |
| `goBack()` | Navigate back | `api.goBack()` |
| `goForward()` | Navigate forward | `api.goForward()` |
| `reload()` | Reload page | `api.reload()` |
| `selectOption(sel, val)` | Select dropdown | `api.selectOption('#dropdown', 'value')` |
| `waitForSelector(sel)` | Wait for element | `api.waitForSelector('.loaded')` |
| `getAccessibilityTree()` | Get a11y tree | `api.getAccessibilityTree()` |
| `findElements(desc)` | Find by description | `api.findElements('Submit button')` |
| `extractData(selector)` | Extract data | `api.extractData('.product-card')` |

## 📊 Comparison & Reporting

### Visual Comparison
```bash
# Compare two sets of screenshots
node cli.js compare screenshots/before screenshots/after \
  --threshold 0.1 \
  --generate-report \
  --ai-analysis \
  --suggest-fixes
```

### HTML Reports
Generated reports include:
- Visual differences highlighted
- AI analysis of changes
- Suggested CSS fixes
- Cross-browser comparison
- Performance metrics

## 🛠️ Configuration

### Using Both Engines
```bash
# Use Puppeteer (legacy)
node cli.js capture -u https://example.com --engine puppeteer

# Use Playwright (default, recommended)
node cli.js capture -u https://example.com --engine playwright
```

### Custom Viewports
```javascript
// vrt.config.js
module.exports = {
  viewports: [
    { name: 'small-phone', width: 320, height: 568 },
    { name: '4k', width: 3840, height: 2160 }
  ],
  browser: 'chromium',
  headless: true
};
```

## 🔧 Troubleshooting

### Browser Installation Issues
```bash
# Reinstall specific browser
npx playwright install chromium
npx playwright install firefox
npx playwright install webkit

# Install with dependencies (Linux)
npx playwright install-deps
```

### Timeout Issues
```bash
# Increase timeout
node cli.js capture -u https://slow-site.com --timeout 60000

# Use faster wait condition
node cli.js capture -u https://example.com --wait-until domcontentloaded
```

### Permission Issues (macOS)
```bash
# If browsers won't launch
xattr -cr ~/Library/Caches/ms-playwright/
```

## 📈 Performance Comparison

### Test: Capturing 4 viewports

| Engine | Time | Browsers | Features |
|--------|------|----------|----------|
| Puppeteer | ~8s | 1 | Basic |
| Playwright | ~6s | 1 | Full |
| Playwright (parallel) | ~3s | 1 | Full |
| Playwright (all browsers) | ~12s | 3 | Full |

## 🎯 Use Cases

### 1. Bootstrap to Tailwind Migration
```bash
# Capture before migration
node cli.js capture -u http://localhost:3000 \
  --output-dir before-tailwind \
  --browser all

# After migration
node cli.js capture -u http://localhost:3000 \
  --output-dir after-tailwind \
  --browser all

# Compare
node cli.js compare before-tailwind after-tailwind \
  --generate-report \
  --ai-analysis
```

### 2. Mobile-First Testing
```bash
# Test mobile experience across devices
node cli.js mobile -u https://example.com \
  --devices "iPhone 14 Pro,iPhone SE,Pixel 7,Galaxy S22"

# Compare mobile vs desktop
node cli.js capture -u https://example.com \
  --viewport mobile \
  --output-dir mobile-view

node cli.js capture -u https://example.com \
  --viewport desktop \
  --output-dir desktop-view
```

### 3. CI/CD Integration
```yaml
# GitHub Actions
- name: Visual Regression Test
  run: |
    npm install
    npx playwright install
    node cli.js crossbrowser -u ${{ env.STAGING_URL }}
    node cli.js compare baseline current --threshold 0.05
```

### 4. Accessibility Testing
```bash
# Capture with accessibility analysis
node cli.js debug https://example.com \
  --accessibility \
  --output-dir a11y-report
```

## 🚀 Migration Guide (Puppeteer → Playwright)

### For Existing Scripts

| Puppeteer | Playwright |
|-----------|------------|
| `--engine puppeteer` | `--engine playwright` (or omit, it's default) |
| Single browser | `--browser all` for cross-browser |
| Basic viewport | `--devices "iPhone 14 Pro"` for real devices |
| Manual waits | Auto-waiting built-in |
| Screenshots only | Add `--record` for video |

### Backwards Compatibility
- ✅ All existing Puppeteer commands still work with `--engine puppeteer`
- ✅ Existing screenshots remain compatible
- ✅ Comparison works across both engines

## 📁 Project Structure
```
visual-regression-tool/
├── lib/
│   ├── playwright-vrt.js       # NEW: Playwright implementation
│   ├── vrt.js                   # Original Puppeteer implementation
│   ├── browser-detector.js      # Cross-platform browser detection
│   ├── esm-loader.js           # ESM module compatibility
│   └── ai-analyzer.js          # AI analysis engine
├── tests/
│   └── test-playwright-features.js  # Playwright test suite
├── cli.js                       # Enhanced CLI with both engines
├── package.json                 # Updated dependencies
└── PLAYWRIGHT-VRT-GUIDE.md      # This guide
```

## ✅ Feature Checklist

- [x] **Cross-browser testing** - Chromium, Firefox, WebKit
- [x] **Mobile device emulation** - iPhone, iPad, Pixel, Galaxy
- [x] **Interactive sessions** - AI-friendly API
- [x] **Advanced interactions** - Click, type, drag, hover
- [x] **Network control** - Intercept, mock, block
- [x] **Video recording** - Full session capture
- [x] **Parallel testing** - Native support
- [x] **Auto-waiting** - Smart element detection
- [x] **Trace debugging** - Built-in viewer
- [x] **Backwards compatible** - Puppeteer still works

## 🎉 Summary

The Visual Regression Tool v3.0 with Playwright provides:

1. **True cross-browser testing** across Chromium, Firefox, and WebKit
2. **Accurate mobile emulation** with real device profiles
3. **AI-friendly interactive API** for automated testing
4. **Advanced interaction capabilities** for complex scenarios
5. **Enterprise-grade reliability** with auto-waiting and retries
6. **Comprehensive debugging** with video recording and traces
7. **Backwards compatibility** with existing Puppeteer scripts

**Recommended:** Use Playwright (`--engine playwright`) for all new projects!

---

*Version: 3.0.0 | Engine: Playwright 1.55.0 | Updated: 2025-08-20*