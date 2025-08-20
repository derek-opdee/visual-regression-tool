const chalk = require('chalk');
const ora = require('ora');
const inquirer = require('inquirer');
const BaselineManager = require('../lib/baseline-manager');

async function baselineCommand(action, options) {
  const baselineManager = new BaselineManager('./');
  await baselineManager.initialize();

  switch (action) {
    case 'update':
      await updateBaseline(baselineManager, options);
      break;
    
    case 'branch':
      await createBranch(baselineManager, options);
      break;
    
    case 'switch':
      await switchBranch(baselineManager, options);
      break;
    
    case 'rollback':
      await rollbackBaseline(baselineManager, options);
      break;
    
    case 'auto-select':
      await autoSelectBaseline(baselineManager, options);
      break;
    
    case 'history':
      await showHistory(baselineManager);
      break;
    
    case 'cleanup':
      await cleanupVersions(baselineManager, options);
      break;
    
    default:
      console.error(chalk.red(`Unknown baseline action: ${action}`));
      console.log('Available actions: update, branch, switch, rollback, auto-select, history, cleanup');
      process.exit(1);
  }
}

async function updateBaseline(manager, options) {
  const spinner = ora('Updating baseline...').start();
  
  try {
    let files = [];
    
    if (options.selective) {
      spinner.stop();
      
      // Get list of available files
      const fs = require('fs').promises;
      const availableFiles = await fs.readdir('latest-capture');
      const imageFiles = availableFiles.filter(f => f.endsWith('.png'));
      
      const { selectedFiles } = await inquirer.prompt([
        {
          type: 'checkbox',
          name: 'selectedFiles',
          message: 'Select files to update:',
          choices: imageFiles,
          pageSize: 20
        }
      ]);
      
      files = selectedFiles;
      spinner.start('Updating selected baselines...');
    }

    await manager.updateBaseline({
      backup: options.backup,
      selective: options.selective,
      files: files
    });

    spinner.succeed('Baseline updated successfully!');
    
    if (options.backup) {
      console.log(chalk.gray('Previous baseline backed up'));
    }
    
    if (options.selective) {
      console.log(chalk.green(`Updated ${files.length} files`));
    }

  } catch (error) {
    spinner.fail('Failed to update baseline');
    console.error(chalk.red(error.message));
    process.exit(1);
  }
}

async function createBranch(manager, options) {
  let branchName = options.branch;
  
  if (!branchName) {
    const { name } = await inquirer.prompt([
      {
        type: 'input',
        name: 'name',
        message: 'Enter branch name:',
        validate: input => input.length > 0 || 'Branch name is required'
      }
    ]);
    branchName = name;
  }

  const spinner = ora(`Creating branch '${branchName}'...`).start();
  
  try {
    await manager.createBranch(branchName);
    spinner.succeed(`Branch '${branchName}' created successfully!`);
    console.log(chalk.gray('Current baseline copied to new branch'));
  } catch (error) {
    spinner.fail('Failed to create branch');
    console.error(chalk.red(error.message));
    process.exit(1);
  }
}

async function switchBranch(manager, options) {
  const history = await manager.getHistory();
  const branches = Object.keys(history.branches);
  
  if (branches.length === 0) {
    console.log(chalk.yellow('No branches available'));
    return;
  }

  const { branchName } = await inquirer.prompt([
    {
      type: 'list',
      name: 'branchName',
      message: 'Select branch to switch to:',
      choices: branches.map(b => ({
        name: `${b} (created: ${new Date(history.branches[b].created).toLocaleDateString()})`,
        value: b
      }))
    }
  ]);

  const spinner = ora(`Switching to branch '${branchName}'...`).start();
  
  try {
    await manager.switchBranch(branchName);
    spinner.succeed(`Switched to branch '${branchName}'`);
  } catch (error) {
    spinner.fail('Failed to switch branch');
    console.error(chalk.red(error.message));
    process.exit(1);
  }
}

async function rollbackBaseline(manager, options) {
  const history = await manager.getHistory();
  
  if (history.versions.length === 0) {
    console.log(chalk.yellow('No versions available for rollback'));
    return;
  }

  let versionId = options.version;
  
  if (!versionId) {
    const { selectedVersion } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selectedVersion',
        message: 'Select version to rollback to:',
        choices: history.versions.map(v => ({
          name: `${v.name} - ${new Date(v.timestamp).toLocaleString()} (${v.description || 'No description'})`,
          value: v.id
        }))
      }
    ]);
    versionId = selectedVersion;
  }

  const spinner = ora('Rolling back baseline...').start();
  
  try {
    await manager.rollback(versionId);
    spinner.succeed('Baseline rolled back successfully!');
  } catch (error) {
    spinner.fail('Failed to rollback baseline');
    console.error(chalk.red(error.message));
    process.exit(1);
  }
}

async function autoSelectBaseline(manager, options) {
  const spinner = ora('Auto-selecting best baseline...').start();
  
  try {
    const captureDir = options.captureDir || 'latest-capture';
    const selected = await manager.autoSelectBaseline(captureDir, {
      threshold: options.threshold || 0.8
    });
    
    spinner.succeed(`Auto-selected baseline: ${selected.name}`);
    
    if (selected.name !== 'current') {
      const { switchNow } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'switchNow',
          message: `Switch to ${selected.name} now?`,
          default: true
        }
      ]);
      
      if (switchNow) {
        await manager.switchBranch(selected.name.replace('branch:', ''));
        console.log(chalk.green('✅ Switched to selected baseline'));
      }
    }
  } catch (error) {
    spinner.fail('Auto-selection failed');
    console.error(chalk.red(error.message));
    process.exit(1);
  }
}

async function showHistory(manager) {
  const history = await manager.getHistory();
  
  console.log(chalk.cyan('\n📋 Baseline History\n'));
  
  console.log(chalk.yellow('Current Configuration:'));
  console.log(`  Active: ${history.current}`);
  console.log(`  Last Update: ${history.lastUpdate ? new Date(history.lastUpdate).toLocaleString() : 'Never'}`);
  
  if (history.lastRollback) {
    console.log(`  Last Rollback: ${new Date(history.lastRollback.timestamp).toLocaleString()}`);
    console.log(`    From: ${history.lastRollback.from}`);
    console.log(`    To: ${history.lastRollback.to}`);
  }
  
  if (history.versions.length > 0) {
    console.log(chalk.yellow('\nVersions:'));
    history.versions.forEach(v => {
      console.log(`  ${v.name} (${v.id.substring(0, 8)})`);
      console.log(`    Created: ${new Date(v.timestamp).toLocaleString()}`);
      console.log(`    Git Branch: ${v.gitBranch}`);
      console.log(`    Git Commit: ${v.gitCommit.substring(0, 8)}`);
      if (v.description) {
        console.log(`    Description: ${v.description}`);
      }
      console.log('');
    });
  }
  
  if (Object.keys(history.branches).length > 0) {
    console.log(chalk.yellow('Branches:'));
    Object.entries(history.branches).forEach(([name, info]) => {
      console.log(`  ${name}`);
      console.log(`    Created: ${new Date(info.created).toLocaleString()}`);
      console.log(`    Git Branch: ${info.gitBranch}`);
      console.log(`    Parent: ${info.parent}`);
      console.log('');
    });
  }
}

async function cleanupVersions(manager, options) {
  const daysToKeep = options.days || 30;
  
  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: `Delete baseline versions older than ${daysToKeep} days?`,
      default: false
    }
  ]);
  
  if (!confirm) {
    console.log(chalk.yellow('Cleanup cancelled'));
    return;
  }
  
  const spinner = ora('Cleaning up old versions...').start();
  
  try {
    const deletedCount = await manager.cleanupOldVersions(daysToKeep);
    spinner.succeed(`Cleaned up ${deletedCount} old versions`);
  } catch (error) {
    spinner.fail('Cleanup failed');
    console.error(chalk.red(error.message));
    process.exit(1);
  }
}

module.exports = baselineCommand;