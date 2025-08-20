const { chromium } = require('playwright');
const { PNG } = require('pngjs');
const pixelmatch = require('pixelmatch');
const fs = require('fs');
const path = require('path');

async function compareHomepage() {
    const browser = await chromium.launch({ headless: true });
    
    try {
        console.log('🚀 Comparing homepage only...\n');
        
        const viewport = { width: 1920, height: 1080 };
        const outputDir = path.join(__dirname, 'screenshots', 'homepage-comparison');
        
        // Create output directory
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }
        
        // Capture production
        console.log('📸 Capturing production homepage...');
        const prodPage = await browser.newPage();
        await prodPage.setViewportSize(viewport);
        await prodPage.goto('https://directory.hattch.com', { waitUntil: 'networkidle' });
        await prodPage.waitForTimeout(2000);
        const prodScreenshot = await prodPage.screenshot({ fullPage: true });
        fs.writeFileSync(path.join(outputDir, 'production.png'), prodScreenshot);
        await prodPage.close();
        console.log('✅ Production captured\n');
        
        // Capture local
        console.log('📸 Capturing local homepage (Tailwind)...');
        const localPage = await browser.newPage();
        await localPage.setViewportSize(viewport);
        await localPage.goto('http://directory.hattch-localhost', { waitUntil: 'networkidle' });
        await localPage.waitForTimeout(2000);
        const localScreenshot = await localPage.screenshot({ fullPage: true });
        fs.writeFileSync(path.join(outputDir, 'local.png'), localScreenshot);
        await localPage.close();
        console.log('✅ Local captured\n');
        
        // Compare images
        console.log('🔍 Comparing images...');
        const prodImg = PNG.sync.read(prodScreenshot);
        const localImg = PNG.sync.read(localScreenshot);
        
        console.log(`   - Production size: ${prodImg.width}x${prodImg.height}`);
        console.log(`   - Local size: ${localImg.width}x${localImg.height}`);
        
        let numDiffPixels = 0;
        let diffPercentage = 'N/A';
        let totalPixels = 0;
        let hasDiff = false;
        let diff = null;
        
        // Only compare if sizes match
        if (prodImg.width === localImg.width && prodImg.height === localImg.height) {
            const width = prodImg.width;
            const height = prodImg.height;
            
            diff = new PNG({ width, height });
            
            numDiffPixels = pixelmatch(
                prodImg.data,
                localImg.data,
                diff.data,
                width,
                height,
                { threshold: 0.1 }
            );
            
            totalPixels = width * height;
            diffPercentage = (numDiffPixels / totalPixels * 100).toFixed(2);
            hasDiff = true;
            
            // Save diff image
            fs.writeFileSync(path.join(outputDir, 'diff.png'), PNG.sync.write(diff));
        } else {
            console.log('⚠️  Image sizes differ - cannot perform pixel comparison');
            diffPercentage = 'N/A - Size mismatch';
        }
        
        console.log(`\n📊 Results:`);
        if (hasDiff) {
            console.log(`   - Difference: ${diffPercentage}%`);
            console.log(`   - Different pixels: ${numDiffPixels.toLocaleString()}`);
            console.log(`   - Total pixels: ${totalPixels.toLocaleString()}`);
        } else {
            console.log(`   - Difference: ${diffPercentage}`);
        }
        
        // Generate HTML report
        const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Homepage Comparison Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 1400px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        h1 { text-align: center; color: #333; }
        .stats { text-align: center; margin: 20px 0; padding: 20px; background: #f8f9fa; border-radius: 4px; }
        .comparison { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 20px; }
        .image-container { border: 1px solid #ddd; border-radius: 4px; overflow: hidden; }
        .image-container h3 { margin: 0; padding: 10px; background: #f8f9fa; text-align: center; }
        img { width: 100%; display: block; }
        .diff-container { margin-top: 20px; text-align: center; }
        .diff-container img { max-width: 100%; border: 1px solid #ddd; }
        .status { display: inline-block; padding: 5px 15px; border-radius: 20px; font-weight: bold; }
        .status.good { background: #d4edda; color: #155724; }
        .status.warning { background: #fff3cd; color: #856404; }
        .status.error { background: #f8d7da; color: #721c24; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Homepage Visual Regression Report</h1>
        
        <div class="stats">
            <h2>Comparison Results</h2>
            <p><strong>Difference:</strong> <span class="status ${hasDiff ? (parseFloat(diffPercentage) < 5 ? 'good' : parseFloat(diffPercentage) < 20 ? 'warning' : 'error') : 'error'}">${hasDiff ? diffPercentage + '%' : diffPercentage}</span></p>
            <p><strong>Production Size:</strong> ${prodImg.width}x${prodImg.height}</p>
            <p><strong>Local Size:</strong> ${localImg.width}x${localImg.height}</p>
            ${hasDiff ? `<p><strong>Different Pixels:</strong> ${numDiffPixels.toLocaleString()} / ${totalPixels.toLocaleString()}</p>` : ''}
        </div>
        
        <div class="comparison">
            <div class="image-container">
                <h3>Production</h3>
                <img src="production.png" alt="Production">
            </div>
            <div class="image-container">
                <h3>Local (Tailwind)</h3>
                <img src="local.png" alt="Local">
            </div>
        </div>
        
        ${hasDiff ? `
        <div class="diff-container">
            <h3>Visual Difference</h3>
            <img src="diff.png" alt="Difference">
            <p><small>Pink pixels indicate differences between the two versions</small></p>
        </div>
        ` : ''}
    </div>
</body>
</html>
        `;
        
        fs.writeFileSync(path.join(outputDir, 'report.html'), html);
        
        console.log(`\n✅ Comparison complete!`);
        console.log(`📁 Results saved to: ${outputDir}`);
        console.log(`🌐 Open report: file://${path.join(outputDir, 'report.html')}`);
        
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await browser.close();
    }
}

compareHomepage();