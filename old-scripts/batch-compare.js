const fs = require('fs');
const path = require('path');
const { compareImages } = require('./compare-images');

/**
 * Batch compare all images in two directories
 * Usage: node batch-compare.js <dir1> <dir2> [outputDir]
 */

async function batchCompare(dir1, dir2, outputDir = 'comparisons') {
    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    // Get all PNG files from first directory
    const files1 = fs.readdirSync(dir1)
        .filter(f => f.endsWith('.png'))
        .sort();

    const files2 = fs.readdirSync(dir2)
        .filter(f => f.endsWith('.png'))
        .sort();

    console.log(`Found ${files1.length} images in ${dir1}`);
    console.log(`Found ${files2.length} images in ${dir2}`);

    // Find matching files
    const matchingFiles = files1.filter(f => files2.includes(f));
    console.log(`\nComparing ${matchingFiles.length} matching images...\n`);

    const results = [];
    let identical = 0;
    let different = 0;

    for (const file of matchingFiles) {
        const img1Path = path.join(dir1, file);
        const img2Path = path.join(dir2, file);
        const outputPath = path.join(outputDir, `diff-${file}`);

        console.log(`Comparing ${file}...`);

        try {
            const result = await compareImages(img1Path, img2Path, outputPath);
            
            results.push({
                file,
                ...result
            });

            if (result.identical) {
                identical++;
                console.log(`  ✅ IDENTICAL`);
                // Remove diff file if images are identical
                if (fs.existsSync(outputPath)) {
                    fs.unlinkSync(outputPath);
                }
            } else {
                different++;
                console.log(`  ⚠️  DIFFERENT (${result.diffPercentage}% difference)`);
            }
        } catch (error) {
            console.log(`  ❌ ERROR: ${error.message}`);
            results.push({
                file,
                error: error.message
            });
        }
    }

    // Generate summary report
    const report = {
        timestamp: new Date().toISOString(),
        directory1: dir1,
        directory2: dir2,
        totalFiles: matchingFiles.length,
        identical,
        different,
        results: results.sort((a, b) => {
            // Sort by difference percentage (highest first)
            return (b.diffPercentage || 0) - (a.diffPercentage || 0);
        })
    };

    // Save report
    const reportPath = path.join(outputDir, 'comparison-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    // Generate HTML report
    const htmlReport = generateHTMLReport(report, outputDir);
    const htmlPath = path.join(outputDir, 'comparison-report.html');
    fs.writeFileSync(htmlPath, htmlReport);

    // Print summary
    console.log('\n' + '='.repeat(50));
    console.log('COMPARISON SUMMARY');
    console.log('='.repeat(50));
    console.log(`Total images compared: ${matchingFiles.length}`);
    console.log(`Identical: ${identical} (${(identical/matchingFiles.length*100).toFixed(1)}%)`);
    console.log(`Different: ${different} (${(different/matchingFiles.length*100).toFixed(1)}%)`);
    console.log(`\nReports saved to:`);
    console.log(`  JSON: ${reportPath}`);
    console.log(`  HTML: ${htmlPath}`);

    // List files not in both directories
    const onlyInDir1 = files1.filter(f => !files2.includes(f));
    const onlyInDir2 = files2.filter(f => !files1.includes(f));

    if (onlyInDir1.length > 0) {
        console.log(`\nFiles only in ${dir1}:`);
        onlyInDir1.forEach(f => console.log(`  - ${f}`));
    }

    if (onlyInDir2.length > 0) {
        console.log(`\nFiles only in ${dir2}:`);
        onlyInDir2.forEach(f => console.log(`  - ${f}`));
    }
}

function generateHTMLReport(report, outputDir) {
    return `<!DOCTYPE html>
<html>
<head>
    <title>Visual Regression Report</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 20px;
            background-color: #f5f5f5;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background-color: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        h1, h2 {
            color: #333;
        }
        .summary {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin: 20px 0;
        }
        .stat {
            background-color: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            text-align: center;
        }
        .stat-value {
            font-size: 2em;
            font-weight: bold;
            color: #007bff;
        }
        .stat-label {
            color: #666;
            margin-top: 5px;
        }
        .results {
            margin-top: 30px;
        }
        .result-item {
            background-color: #f8f9fa;
            margin: 10px 0;
            padding: 15px;
            border-radius: 8px;
            border-left: 4px solid #ddd;
        }
        .result-item.different {
            border-left-color: #ffc107;
        }
        .result-item.identical {
            border-left-color: #28a745;
        }
        .result-item.error {
            border-left-color: #dc3545;
        }
        .result-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
        }
        .filename {
            font-weight: bold;
        }
        .badge {
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 0.85em;
            color: white;
        }
        .badge.identical {
            background-color: #28a745;
        }
        .badge.different {
            background-color: #ffc107;
            color: #333;
        }
        .badge.error {
            background-color: #dc3545;
        }
        .images {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 10px;
            margin-top: 10px;
        }
        .image-container {
            text-align: center;
        }
        .image-container img {
            max-width: 100%;
            border: 1px solid #ddd;
            border-radius: 4px;
        }
        .image-label {
            margin-top: 5px;
            font-size: 0.9em;
            color: #666;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Visual Regression Report</h1>
        <p>Generated: ${new Date(report.timestamp).toLocaleString()}</p>
        
        <div class="summary">
            <div class="stat">
                <div class="stat-value">${report.totalFiles}</div>
                <div class="stat-label">Total Images</div>
            </div>
            <div class="stat">
                <div class="stat-value" style="color: #28a745">${report.identical}</div>
                <div class="stat-label">Identical</div>
            </div>
            <div class="stat">
                <div class="stat-value" style="color: #ffc107">${report.different}</div>
                <div class="stat-label">Different</div>
            </div>
        </div>

        <div class="results">
            <h2>Comparison Results</h2>
            ${report.results.map(result => {
                const status = result.error ? 'error' : (result.identical ? 'identical' : 'different');
                const badge = result.error ? 'ERROR' : (result.identical ? 'IDENTICAL' : `${result.diffPercentage}% DIFFERENT`);
                
                return `
                <div class="result-item ${status}">
                    <div class="result-header">
                        <span class="filename">${result.file}</span>
                        <span class="badge ${status}">${badge}</span>
                    </div>
                    ${!result.identical && !result.error ? `
                    <div class="images">
                        <div class="image-container">
                            <a href="../${report.directory1}/${result.file}" target="_blank">
                                <img src="../${report.directory1}/${result.file}" alt="Before">
                            </a>
                            <div class="image-label">Before</div>
                        </div>
                        <div class="image-container">
                            <a href="../${report.directory2}/${result.file}" target="_blank">
                                <img src="../${report.directory2}/${result.file}" alt="After">
                            </a>
                            <div class="image-label">After</div>
                        </div>
                        <div class="image-container">
                            <a href="diff-${result.file}" target="_blank">
                                <img src="diff-${result.file}" alt="Difference">
                            </a>
                            <div class="image-label">Difference</div>
                        </div>
                    </div>
                    ` : ''}
                    ${result.error ? `<p style="color: #dc3545">${result.error}</p>` : ''}
                </div>
                `;
            }).join('')}
        </div>
    </div>
</body>
</html>`;
}

// CLI usage
if (require.main === module) {
    const args = process.argv.slice(2);
    
    if (args.length < 2) {
        console.log('Usage: node batch-compare.js <dir1> <dir2> [outputDir]');
        console.log('Example: node batch-compare.js screenshots-before screenshots-after comparisons');
        process.exit(1);
    }

    const [dir1, dir2, outputDir] = args;

    // Check if directories exist
    if (!fs.existsSync(dir1)) {
        console.error(`Directory not found: ${dir1}`);
        process.exit(1);
    }
    if (!fs.existsSync(dir2)) {
        console.error(`Directory not found: ${dir2}`);
        process.exit(1);
    }

    batchCompare(dir1, dir2, outputDir).catch(console.error);
}

module.exports = { batchCompare };