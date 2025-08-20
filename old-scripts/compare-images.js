const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');
const pixelmatch = require('pixelmatch');

/**
 * Compare two images and generate a diff image
 * Usage: node compare-images.js <image1> <image2> [output]
 */

async function compareImages(img1Path, img2Path, outputPath) {
    return new Promise((resolve, reject) => {
        const img1 = fs.createReadStream(img1Path).pipe(new PNG()).on('parsed', doneReading);
        const img2 = fs.createReadStream(img2Path).pipe(new PNG()).on('parsed', doneReading);

        let filesRead = 0;
        function doneReading() {
            if (++filesRead < 2) return;

            // Check dimensions
            if (img1.width !== img2.width || img1.height !== img2.height) {
                reject(new Error(`Image dimensions don't match: ${img1.width}x${img1.height} vs ${img2.width}x${img2.height}`));
                return;
            }

            // Create diff image
            const diff = new PNG({ width: img1.width, height: img1.height });

            // Compare pixels
            const numDiffPixels = pixelmatch(
                img1.data,
                img2.data,
                diff.data,
                img1.width,
                img1.height,
                { threshold: 0.1 } // Threshold for pixel difference
            );

            // Calculate difference percentage
            const totalPixels = img1.width * img1.height;
            const diffPercentage = (numDiffPixels / totalPixels * 100).toFixed(2);

            // Save diff image
            diff.pack().pipe(fs.createWriteStream(outputPath))
                .on('finish', () => {
                    resolve({
                        totalPixels,
                        diffPixels: numDiffPixels,
                        diffPercentage,
                        identical: numDiffPixels === 0
                    });
                });
        }
    });
}

// CLI usage
if (require.main === module) {
    const args = process.argv.slice(2);
    
    if (args.length < 2) {
        console.log('Usage: node compare-images.js <image1> <image2> [output]');
        console.log('Example: node compare-images.js before.png after.png diff.png');
        process.exit(1);
    }

    const [img1, img2, output = 'diff.png'] = args;

    // Check if files exist
    if (!fs.existsSync(img1)) {
        console.error(`File not found: ${img1}`);
        process.exit(1);
    }
    if (!fs.existsSync(img2)) {
        console.error(`File not found: ${img2}`);
        process.exit(1);
    }

    console.log(`Comparing images...`);
    console.log(`Image 1: ${img1}`);
    console.log(`Image 2: ${img2}`);

    compareImages(img1, img2, output)
        .then(result => {
            console.log(`\nComparison complete:`);
            console.log(`Total pixels: ${result.totalPixels}`);
            console.log(`Different pixels: ${result.diffPixels}`);
            console.log(`Difference: ${result.diffPercentage}%`);
            console.log(`Images are ${result.identical ? 'IDENTICAL' : 'DIFFERENT'}`);
            
            if (!result.identical) {
                console.log(`\nDiff image saved to: ${output}`);
            }
        })
        .catch(error => {
            console.error(`Error: ${error.message}`);
            process.exit(1);
        });
}

module.exports = { compareImages };