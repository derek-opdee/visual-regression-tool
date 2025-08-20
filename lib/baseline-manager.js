const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

class BaselineManager {
  constructor(baseDir) {
    this.baseDir = baseDir;
    this.baselineDir = path.join(baseDir, 'baselines');
    this.metadataFile = path.join(this.baselineDir, 'metadata.json');
  }

  async initialize() {
    await fs.mkdir(this.baselineDir, { recursive: true });
    
    // Load or create metadata
    try {
      const data = await fs.readFile(this.metadataFile, 'utf8');
      this.metadata = JSON.parse(data);
    } catch {
      this.metadata = {
        versions: [],
        branches: {},
        current: 'main'
      };
      await this.saveMetadata();
    }
  }

  async createVersion(name, description) {
    await this.initialize();
    
    const version = {
      id: crypto.randomUUID(),
      name,
      description,
      timestamp: new Date().toISOString(),
      gitBranch: this.getCurrentGitBranch(),
      gitCommit: this.getCurrentGitCommit(),
      files: []
    };

    const versionDir = path.join(this.baselineDir, version.id);
    await fs.mkdir(versionDir, { recursive: true });

    this.metadata.versions.push(version);
    await this.saveMetadata();

    return version;
  }

  async updateBaseline(options = {}) {
    const { backup = true, selective = false, files = [] } = options;
    
    await this.initialize();

    // Backup current baseline if requested
    if (backup) {
      await this.backupCurrent();
    }

    const currentDir = path.join(this.baselineDir, 'current');
    await fs.mkdir(currentDir, { recursive: true });

    if (selective && files.length > 0) {
      // Update only selected files
      for (const file of files) {
        const sourcePath = path.join(this.baseDir, file);
        const destPath = path.join(currentDir, path.basename(file));
        await fs.copyFile(sourcePath, destPath);
      }
    } else {
      // Update all files
      const sourceDir = path.join(this.baseDir, 'latest-capture');
      const files = await fs.readdir(sourceDir);
      
      for (const file of files) {
        if (file.endsWith('.png')) {
          await fs.copyFile(
            path.join(sourceDir, file),
            path.join(currentDir, file)
          );
        }
      }
    }

    // Update metadata
    this.metadata.lastUpdate = new Date().toISOString();
    await this.saveMetadata();
  }

  async backupCurrent() {
    const currentDir = path.join(this.baselineDir, 'current');
    const backupDir = path.join(
      this.baselineDir, 
      'backups',
      `backup-${new Date().toISOString().replace(/[:]/g, '-')}`
    );

    await fs.mkdir(path.dirname(backupDir), { recursive: true });

    try {
      await fs.cp(currentDir, backupDir, { recursive: true });
    } catch (error) {
      console.warn('No current baseline to backup');
    }
  }

  async createBranch(branchName) {
    await this.initialize();

    const currentDir = path.join(this.baselineDir, 'current');
    const branchDir = path.join(this.baselineDir, 'branches', branchName);

    await fs.mkdir(path.dirname(branchDir), { recursive: true });
    await fs.cp(currentDir, branchDir, { recursive: true });

    this.metadata.branches[branchName] = {
      created: new Date().toISOString(),
      gitBranch: this.getCurrentGitBranch(),
      parent: this.metadata.current
    };

    await this.saveMetadata();
  }

  async switchBranch(branchName) {
    await this.initialize();

    if (!this.metadata.branches[branchName]) {
      throw new Error(`Branch ${branchName} does not exist`);
    }

    const branchDir = path.join(this.baselineDir, 'branches', branchName);
    const currentDir = path.join(this.baselineDir, 'current');

    // Backup current before switching
    await this.backupCurrent();

    // Copy branch to current
    await fs.rm(currentDir, { recursive: true, force: true });
    await fs.cp(branchDir, currentDir, { recursive: true });

    this.metadata.current = branchName;
    await this.saveMetadata();
  }

  async autoSelectBaseline(captureDir, options = {}) {
    await this.initialize();

    const candidates = await this.findBaselineCandidates();
    let bestMatch = null;
    let bestScore = 0;

    for (const candidate of candidates) {
      const score = await this.calculateSimilarityScore(captureDir, candidate.dir);
      
      if (score > bestScore) {
        bestScore = score;
        bestMatch = candidate;
      }
    }

    if (bestMatch && bestScore > (options.threshold || 0.8)) {
      console.log(`Auto-selected baseline: ${bestMatch.name} (similarity: ${(bestScore * 100).toFixed(1)}%)`);
      return bestMatch;
    }

    console.log('No suitable baseline found, using current');
    return { name: 'current', dir: path.join(this.baselineDir, 'current') };
  }

  async findBaselineCandidates() {
    const candidates = [];
    
    // Add current baseline
    candidates.push({
      name: 'current',
      dir: path.join(this.baselineDir, 'current')
    });

    // Add branch baselines
    for (const [branchName, branchInfo] of Object.entries(this.metadata.branches)) {
      candidates.push({
        name: `branch:${branchName}`,
        dir: path.join(this.baselineDir, 'branches', branchName),
        ...branchInfo
      });
    }

    // Add version baselines
    for (const version of this.metadata.versions) {
      candidates.push({
        name: `version:${version.name}`,
        dir: path.join(this.baselineDir, version.id),
        ...version
      });
    }

    return candidates;
  }

  async calculateSimilarityScore(dir1, dir2) {
    // Simple similarity calculation based on file existence and basic comparison
    // In production, you'd use more sophisticated image comparison
    
    try {
      const files1 = await fs.readdir(dir1);
      const files2 = await fs.readdir(dir2);
      
      const commonFiles = files1.filter(f => files2.includes(f) && f.endsWith('.png'));
      
      if (commonFiles.length === 0) return 0;
      
      // Calculate similarity based on file count and basic metadata
      const fileScore = commonFiles.length / Math.max(files1.length, files2.length);
      
      // In production, you'd also compare image content
      return fileScore;
    } catch {
      return 0;
    }
  }

  async rollback(versionId) {
    await this.initialize();

    const version = this.metadata.versions.find(v => v.id === versionId);
    if (!version) {
      throw new Error(`Version ${versionId} not found`);
    }

    const versionDir = path.join(this.baselineDir, version.id);
    const currentDir = path.join(this.baselineDir, 'current');

    // Backup current
    await this.backupCurrent();

    // Copy version to current
    await fs.rm(currentDir, { recursive: true, force: true });
    await fs.cp(versionDir, currentDir, { recursive: true });

    this.metadata.lastRollback = {
      from: this.metadata.current,
      to: version.name,
      timestamp: new Date().toISOString()
    };

    await this.saveMetadata();
  }

  async cleanupOldVersions(daysToKeep = 30) {
    await this.initialize();

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const versionsToDelete = this.metadata.versions.filter(v => {
      return new Date(v.timestamp) < cutoffDate;
    });

    for (const version of versionsToDelete) {
      const versionDir = path.join(this.baselineDir, version.id);
      await fs.rm(versionDir, { recursive: true, force: true });
    }

    this.metadata.versions = this.metadata.versions.filter(v => {
      return new Date(v.timestamp) >= cutoffDate;
    });

    await this.saveMetadata();

    return versionsToDelete.length;
  }

  getCurrentGitBranch() {
    try {
      return execSync('git branch --show-current').toString().trim();
    } catch {
      return 'unknown';
    }
  }

  getCurrentGitCommit() {
    try {
      return execSync('git rev-parse HEAD').toString().trim();
    } catch {
      return 'unknown';
    }
  }

  async saveMetadata() {
    await fs.writeFile(
      this.metadataFile,
      JSON.stringify(this.metadata, null, 2)
    );
  }

  async getHistory() {
    await this.initialize();
    
    return {
      versions: this.metadata.versions,
      branches: this.metadata.branches,
      current: this.metadata.current,
      lastUpdate: this.metadata.lastUpdate,
      lastRollback: this.metadata.lastRollback
    };
  }
}

module.exports = BaselineManager;