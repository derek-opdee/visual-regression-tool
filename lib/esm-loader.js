// ESM module loader for CommonJS compatibility
// This handles loading ESM-only modules in a CommonJS environment

async function loadChalk() {
  try {
    const chalk = await import('chalk');
    return chalk.default || chalk;
  } catch (error) {
    console.error('Failed to load chalk:', error);
    // Fallback to basic console colors
    return {
      green: (str) => `\x1b[32m${str}\x1b[0m`,
      blue: (str) => `\x1b[34m${str}\x1b[0m`,
      red: (str) => `\x1b[31m${str}\x1b[0m`,
      yellow: (str) => `\x1b[33m${str}\x1b[0m`,
      cyan: (str) => `\x1b[36m${str}\x1b[0m`,
      magenta: (str) => `\x1b[35m${str}\x1b[0m`,
      bold: (str) => `\x1b[1m${str}\x1b[0m`,
      dim: (str) => `\x1b[2m${str}\x1b[0m`
    };
  }
}

async function loadOra() {
  try {
    const ora = await import('ora');
    return ora.default || ora;
  } catch (error) {
    console.error('Failed to load ora:', error);
    // Fallback spinner implementation
    return function(text) {
      console.log(`⏳ ${text}`);
      return {
        start: function() { 
          console.log(`⏳ ${text}`);
          return this;
        },
        succeed: function(message) { 
          console.log(`✅ ${message || text}`);
          return this;
        },
        fail: function(message) { 
          console.log(`❌ ${message || text}`);
          return this;
        },
        warn: function(message) { 
          console.log(`⚠️ ${message || text}`);
          return this;
        },
        info: function(message) { 
          console.log(`ℹ️ ${message || text}`);
          return this;
        },
        stop: function() { 
          return this;
        },
        text: text
      };
    };
  }
}

async function loadInquirer() {
  try {
    const inquirer = await import('inquirer');
    return inquirer.default || inquirer;
  } catch (error) {
    console.error('Failed to load inquirer:', error);
    // Basic fallback for simple prompts
    const readline = require('readline');
    return {
      prompt: async function(questions) {
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout
        });
        
        const answers = {};
        for (const question of Array.isArray(questions) ? questions : [questions]) {
          const answer = await new Promise((resolve) => {
            rl.question(`${question.message} `, resolve);
          });
          answers[question.name] = answer;
        }
        rl.close();
        return answers;
      }
    };
  }
}

module.exports = {
  loadChalk,
  loadOra,
  loadInquirer
};