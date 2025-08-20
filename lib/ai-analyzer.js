const sharp = require('sharp');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

class AIAnalyzer {
  constructor() {
    this.designPatterns = {
      alignment: {
        rules: ['Elements should align to a grid', 'Text should have consistent baseline'],
        tolerance: 2 // pixels
      },
      spacing: {
        rules: ['Consistent spacing between elements', 'Proper padding and margins'],
        patterns: [8, 16, 24, 32, 48, 64] // Common spacing values
      },
      typography: {
        rules: ['Consistent font sizes', 'Proper line height', 'Readable contrast'],
        minContrast: 4.5 // WCAG AA standard
      },
      color: {
        rules: ['Consistent color palette', 'Proper color contrast', 'Accessible colors']
      }
    };
  }

  async analyzeScreenshot(screenshotPath, options = {}) {
    const metadata = await sharp(screenshotPath).metadata();
    const analysis = {
      viewport: options.viewport,
      url: options.url,
      timestamp: new Date().toISOString(),
      dimensions: {
        width: metadata.width,
        height: metadata.height
      },
      issues: [],
      score: 100,
      recommendations: []
    };

    // Analyze various aspects
    if (options.detectIssues !== false) {
      const issues = await this.detectVisualIssues(screenshotPath);
      analysis.issues = issues;
      analysis.score -= issues.length * 10;
    }

    if (options.checkAccessibility) {
      const a11yIssues = await this.checkAccessibility(screenshotPath);
      analysis.accessibilityIssues = a11yIssues;
    }

    // Generate natural language summary
    analysis.summary = this.generateSummary(analysis);
    
    // Add recommendations
    analysis.recommendations = this.generateRecommendations(analysis);

    return analysis;
  }

  async detectVisualIssues(screenshotPath) {
    const issues = [];
    const imageBuffer = await fs.readFile(screenshotPath);
    const image = sharp(imageBuffer);
    const metadata = await image.metadata();

    // Analyze for common visual issues
    // This is a simplified version - in production, you'd use more sophisticated image analysis

    // Check for potential alignment issues
    const edges = await this.detectEdges(image);
    const alignmentIssues = this.checkAlignment(edges);
    issues.push(...alignmentIssues);

    // Check for color consistency
    const colorIssues = await this.checkColorConsistency(image);
    issues.push(...colorIssues);

    // Check for spacing issues
    const spacingIssues = await this.checkSpacing(edges);
    issues.push(...spacingIssues);

    return issues;
  }

  async detectEdges(image) {
    // Simplified edge detection using sharp
    // In production, you'd use more sophisticated computer vision
    const edges = await image
      .greyscale()
      .convolve({
        width: 3,
        height: 3,
        kernel: [-1, -1, -1, -1, 8, -1, -1, -1, -1] // Edge detection kernel
      })
      .toBuffer();

    return edges;
  }

  checkAlignment(edges) {
    const issues = [];
    
    // Simplified alignment check
    // In production, you'd analyze the edge data to find misaligned elements
    
    // Mock implementation for demonstration
    const mockMisalignment = Math.random() > 0.7;
    if (mockMisalignment) {
      issues.push({
        type: 'alignment',
        severity: 'medium',
        description: 'Potential misalignment detected in header elements',
        location: { x: 100, y: 50, width: 200, height: 50 },
        suggestion: 'Ensure elements align to an 8px grid system'
      });
    }

    return issues;
  }

  async checkColorConsistency(image) {
    const issues = [];
    
    // Get dominant colors
    const stats = await image.stats();
    const channels = stats.channels;
    
    // Check for color consistency (simplified)
    const colorVariance = channels.reduce((acc, channel) => acc + channel.stdev, 0) / 3;
    
    if (colorVariance > 50) {
      issues.push({
        type: 'color',
        severity: 'low',
        description: 'High color variance detected - possible inconsistent color usage',
        suggestion: 'Consider using a more consistent color palette'
      });
    }

    return issues;
  }

  checkSpacing(edges) {
    const issues = [];
    
    // Simplified spacing check
    // In production, you'd analyze gaps between elements
    
    const mockSpacingIssue = Math.random() > 0.6;
    if (mockSpacingIssue) {
      issues.push({
        type: 'spacing',
        severity: 'low',
        description: 'Inconsistent spacing detected between card elements',
        suggestion: 'Use consistent spacing values (8px, 16px, 24px, etc.)'
      });
    }

    return issues;
  }

  async checkAccessibility(screenshotPath) {
    // In a real implementation, you'd analyze the screenshot for:
    // - Color contrast issues
    // - Text readability
    // - Touch target sizes
    // - Visual hierarchy

    const issues = [];
    
    // Mock accessibility check
    issues.push({
      type: 'contrast',
      level: 'AA',
      description: 'Low contrast detected between text and background',
      location: { selector: '.hero-text' },
      currentRatio: 3.5,
      requiredRatio: 4.5,
      suggestion: 'Increase text color darkness or background lightness'
    });

    return issues;
  }

  async analyzeDifference(beforePath, afterPath, diffPath) {
    const analysis = {
      summary: '',
      issues: [],
      affectedAreas: [],
      severity: 'low'
    };

    // Analyze the difference image
    const diffBuffer = await fs.readFile(diffPath);
    const diffImage = sharp(diffBuffer);
    const metadata = await diffImage.metadata();

    // Calculate affected area percentage
    const stats = await diffImage.stats();
    const redChannel = stats.channels[0]; // Assuming red is used for differences
    const affectedPixels = redChannel.sum / 255; // Normalize
    const totalPixels = metadata.width * metadata.height;
    const affectedPercentage = (affectedPixels / totalPixels) * 100;

    analysis.affectedPercentage = affectedPercentage;

    // Determine severity
    if (affectedPercentage > 20) {
      analysis.severity = 'high';
      analysis.summary = 'Significant visual changes detected across large areas of the page';
    } else if (affectedPercentage > 5) {
      analysis.severity = 'medium';
      analysis.summary = 'Moderate visual changes detected in specific components';
    } else {
      analysis.severity = 'low';
      analysis.summary = 'Minor visual changes detected, mostly in small details';
    }

    // Identify types of changes (mock implementation)
    analysis.issues = [
      'Layout shift detected in navigation area',
      'Color changes in button elements',
      'Spacing differences in card components'
    ];

    analysis.affectedAreas = [
      { component: 'header', changeType: 'layout', percentage: 15 },
      { component: 'buttons', changeType: 'color', percentage: 8 },
      { component: 'cards', changeType: 'spacing', percentage: 5 }
    ];

    return analysis;
  }

  async suggestCSSFixes(analysis) {
    const fixes = [];

    // Generate CSS fixes based on the analysis
    for (const area of analysis.affectedAreas) {
      switch (area.changeType) {
        case 'layout':
          fixes.push(`/* Fix layout shift in ${area.component} */`);
          fixes.push(`.${area.component} {`);
          fixes.push(`  display: flex;`);
          fixes.push(`  align-items: center;`);
          fixes.push(`  justify-content: space-between;`);
          fixes.push(`}`);
          break;
          
        case 'color':
          fixes.push(`/* Restore original colors in ${area.component} */`);
          fixes.push(`.${area.component} {`);
          fixes.push(`  background-color: var(--primary-color);`);
          fixes.push(`  color: var(--text-color);`);
          fixes.push(`}`);
          break;
          
        case 'spacing':
          fixes.push(`/* Fix spacing in ${area.component} */`);
          fixes.push(`.${area.component} {`);
          fixes.push(`  padding: 1rem;`);
          fixes.push(`  margin-bottom: 1.5rem;`);
          fixes.push(`  gap: 1rem;`);
          fixes.push(`}`);
          break;
      }
      fixes.push('');
    }

    return fixes;
  }

  generateSummary(analysis) {
    const { issues, score, accessibilityIssues } = analysis;
    
    if (score >= 90) {
      return 'The page appears visually well-structured with minimal issues detected.';
    } else if (score >= 70) {
      return `Found ${issues.length} visual issues that should be addressed for better consistency.`;
    } else {
      return `Multiple visual issues detected (${issues.length} total) that significantly impact the design quality.`;
    }
  }

  generateRecommendations(analysis) {
    const recommendations = [];
    
    // Group issues by type
    const issuesByType = analysis.issues.reduce((acc, issue) => {
      if (!acc[issue.type]) acc[issue.type] = [];
      acc[issue.type].push(issue);
      return acc;
    }, {});

    // Generate recommendations based on issue types
    if (issuesByType.alignment) {
      recommendations.push({
        priority: 'high',
        category: 'Layout',
        suggestion: 'Implement a consistent grid system (8px or 16px base)',
        impact: 'Improves visual harmony and professional appearance'
      });
    }

    if (issuesByType.spacing) {
      recommendations.push({
        priority: 'medium',
        category: 'Spacing',
        suggestion: 'Use a spacing scale (8, 16, 24, 32, 48px) consistently',
        impact: 'Creates better visual rhythm and hierarchy'
      });
    }

    if (issuesByType.color) {
      recommendations.push({
        priority: 'medium',
        category: 'Color',
        suggestion: 'Define and use a consistent color palette with CSS variables',
        impact: 'Enhances brand consistency and maintenance'
      });
    }

    if (analysis.accessibilityIssues?.length > 0) {
      recommendations.push({
        priority: 'high',
        category: 'Accessibility',
        suggestion: 'Address color contrast issues to meet WCAG AA standards',
        impact: 'Improves usability for all users, especially those with visual impairments'
      });
    }

    return recommendations;
  }

  async analyzeTimeline(timelineResults) {
    const analysis = {
      loadingPhases: [],
      visualStability: [],
      recommendations: []
    };

    // Analyze loading phases
    for (let i = 0; i < timelineResults.length; i++) {
      const current = timelineResults[i];
      
      analysis.loadingPhases.push({
        time: current.time,
        phase: this.getLoadingPhase(current.time),
        screenshot: current.path
      });

      // Compare with previous screenshot to detect visual changes
      if (i > 0) {
        const previous = timelineResults[i - 1];
        const stability = await this.compareTimelineFrames(previous.path, current.path);
        analysis.visualStability.push({
          timeRange: `${previous.time}-${current.time}ms`,
          stability: stability,
          changes: stability < 0.95 ? 'Significant visual changes' : 'Stable'
        });
      }
    }

    // Add recommendations based on timeline analysis
    const unstablePhases = analysis.visualStability.filter(s => s.stability < 0.95);
    if (unstablePhases.length > 0) {
      analysis.recommendations.push({
        issue: 'Visual instability during loading',
        suggestion: 'Consider using skeleton screens or progressive loading',
        affectedPhases: unstablePhases.map(p => p.timeRange)
      });
    }

    return analysis;
  }

  getLoadingPhase(time) {
    if (time === 0) return 'Initial';
    if (time <= 500) return 'First Paint';
    if (time <= 1000) return 'First Contentful Paint';
    if (time <= 3000) return 'Main Content Loaded';
    return 'Fully Loaded';
  }

  async compareTimelineFrames(path1, path2) {
    // Simple similarity check between consecutive frames
    // Returns a value between 0 and 1 (1 = identical)
    
    // In production, you'd use proper image comparison
    // For now, return a mock value
    return 0.85 + Math.random() * 0.15;
  }
}

module.exports = AIAnalyzer;