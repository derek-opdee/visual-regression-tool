# Visual Regression Tool

This is a standalone visual regression testing tool that was extracted from the hattch-web-app project.

## Purpose
This tool was created to help with the Bootstrap to Tailwind CSS migration for the Hattch web application. It captures screenshots of pages before and after changes, compares them, and generates visual diff reports.

## Project Structure
```
visual-regression-tool/
├── README.md                      # Original documentation
├── QUICKSTART.md                  # Quick start guide
├── PROJECT_INFO.md               # This file
├── package.json                  # Node.js dependencies
├── .gitignore                   # Git ignore file
├── tests/                       # Test specifications
│   └── capture-baseline.spec.ts # Playwright test spec
├── baseline-screenshots/        # Baseline screenshots for comparison
├── post-migration-screenshots/  # Screenshots after migration
├── production-vs-local/         # Production vs local comparisons
├── migration-report-*/          # Generated comparison reports
└── *.js                        # Various capture and comparison scripts
```

## Usage
1. Install dependencies: `npm install`
2. Capture baseline: `node capture-hattch-baseline.js`
3. Make changes to the target site
4. Capture new state: `node capture-current-state.js`
5. Compare: `node compare-screenshots.js`

## Configuration
Update the URLs in the scripts to point to your target website:
- Default local URL: http://directory.hattch-localhost
- Default production URL: https://directory.hattch.com

## Related Project
This tool was extracted from: /Users/derekzar/Documents/Projects/hattch-web-app