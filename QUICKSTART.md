# Visual Regression Testing - Quick Start Guide

## 🚀 Bootstrap to Tailwind Migration in 5 Steps

### Step 1: Capture Bootstrap Baseline
Before making any changes, capture the current Bootstrap version:
```bash
npm run test:visual:migrate baseline /business-for-sale brand-page
```

### Step 2: Make Your Tailwind Changes
Convert your Bootstrap components to Tailwind CSS.

### Step 3: Capture Tailwind Version
After your changes:
```bash
npm run test:visual:migrate migrated /business-for-sale brand-page
```

### Step 4: Compare Results
```bash
npm run test:visual:migrate compare brand-page
```

### Step 5: View Report
Open the generated HTML report:
```bash
open tools/visual-regression/migration-screenshots/comparisons/brand-page/comparison-report.html
```

## 📸 Common Commands

### Capture Everything
```bash
npm run test:visual
```

### Test Specific Brand Pages
```bash
npm run test:visual:brand
```

### Compare Two Images
```bash
npm run test:visual:diff before.png after.png diff.png
```

### Batch Compare Directories
```bash
npm run test:visual:batch screenshots-before screenshots-after
```

## 🎯 Testing Checklist

- [ ] Desktop view (1920x1080)
- [ ] Tablet view (768x1024)
- [ ] Mobile view (375x812)
- [ ] Interactive elements (accordions, modals, dropdowns)
- [ ] Hover states
- [ ] Form elements
- [ ] Responsive navigation

## 💡 Pro Tips

1. **Clear Cache**: Always clear browser cache between tests
2. **Consistent Environment**: Use the same machine/browser for comparisons
3. **Wait for Animations**: Add delays if testing animated elements
4. **Check Console**: Look for JavaScript errors after migration

## 🔧 Troubleshooting

### Server Not Running
```bash
php artisan serve
```

### Missing Dependencies
```bash
npm install puppeteer pixelmatch pngjs
```

### Permission Issues
```bash
chmod +x tools/visual-regression/*.js
```

For detailed documentation, see [README.md](./README.md)