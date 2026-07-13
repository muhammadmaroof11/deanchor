#!/usr/bin/env node

/**
 * Deanchor CLI Tool & Rule Compiler
 * Compiles and installs the Deanchor agent skill across environments.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const WORKFLOWS_SRC_DIR = path.join(__dirname, '..', 'workflows', 'antigravity');
const SKILLS_SRC_DIR = path.join(__dirname, '..', 'skills', 'deanchor');
const CURSORRULES_SRC = path.join(__dirname, '..', 'workflows', 'cursor', '.cursorrules');
const CLAUDE_SRC = path.join(__dirname, '..', 'workflows', 'claude-code', 'deanchor.md');
const CODEX_SRC = path.join(__dirname, '..', 'workflows', 'codex', 'deanchor.md');

const args = process.argv.slice(2);
const command = args[0] || 'help';

// Load configurations
const configPath = path.join(__dirname, '..', 'config', 'config.json');
let config = {
  defaultMode: 'full',
  customBannedParadigms: []
};

if (fs.existsSync(configPath)) {
  try {
    const raw = fs.readFileSync(configPath, 'utf8');
    config = JSON.parse(raw);
  } catch (err) {
    console.warn('⚠️ Warning: Failed to parse config/config.json. Using defaults.');
  }
}

switch (command) {
  case 'install':
    installDeanchor();
    break;
  case 'init-hook':
    installGitHook();
    break;
  case 'cursor':
    exportCursorRules();
    break;
  case 'claude':
    exportClaudeRules();
    break;
  case 'status':
    checkStatus();
    break;
  case 'help':
  default:
    printHelp();
    break;
}

function printHelp() {
  console.log(`
Deanchor CLI Tool ⚓➡️🌌
Usage: node bin/deanchor.js <command>

Commands:
  install     Compile and install deanchor workflows/skills into Antigravity profiles
  init-hook   Setup a git pre-commit hook to automatically compile & sync on commit
  cursor      Generate compiled .cursorrules in current directory
  claude      Generate compiled deanchor.md for Claude Code in current directory
  status      Check installation status across active profiles
  help        Display this help card
  `);
}

function getAntigravityProfilesBase() {
  const userHome = os.homedir();
  if (userHome.includes('AntigravityProfiles')) {
    return path.dirname(userHome);
  }
  return path.join(userHome, 'AntigravityProfiles');
}

function findProfilePaths(profileBase) {
  const paths = [];
  if (!fs.existsSync(profileBase)) {
    return paths;
  }
  
  const profiles = fs.readdirSync(profileBase);
  for (const profile of profiles) {
    const profilePath = path.join(profileBase, profile);
    if (fs.statSync(profilePath).isDirectory()) {
      const gwPath = path.join(profilePath, '.gemini', 'antigravity', 'global_workflows');
      const skillsPath = path.join(profilePath, '.gemini', 'antigravity', 'skills');
      if (fs.existsSync(gwPath)) {
        paths.push({ profileName: profile, workflowsPath: gwPath, skillsPath: skillsPath });
      }
    }
  }
  return paths;
}

// Compile templates replacing {{DEFAULT_MODE}} and {{CUSTOM_BANNED_PARADIGMS}}
function compileTemplate(content) {
  let mode = config.defaultMode || 'full';
  let bannedText = '';
  
  if (Array.isArray(config.customBannedParadigms) && config.customBannedParadigms.length > 0) {
    bannedText = config.customBannedParadigms
      .map(p => `  - 🚫 ${p} -> BANNED`)
      .join('\n');
  }

  return content
    .replace(/\{\{DEFAULT_MODE\}\}/g, mode)
    .replace(/\{\{CUSTOM_BANNED_PARADIGMS\}\}/g, bannedText);
}

function compileAndWrite(srcPath, destPath) {
  const content = fs.readFileSync(srcPath, 'utf8');
  const compiled = compileTemplate(content);
  fs.writeFileSync(destPath, compiled, 'utf8');
}

function compileFolderSync(from, to) {
  if (!fs.existsSync(to)) {
    fs.mkdirSync(to, { recursive: true });
  }
  fs.readdirSync(from).forEach(element => {
    const srcPath = path.join(from, element);
    const destPath = path.join(to, element);
    const stat = fs.lstatSync(srcPath);
    if (stat.isFile()) {
      if (element.endsWith('.md')) {
        compileAndWrite(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    } else if (stat.isDirectory()) {
      compileFolderSync(srcPath, destPath);
    }
  });
}

function installDeanchor() {
  console.log('⚓ Compiling and installing Deanchor workflows and skills...');
  
  const filesToCopy = fs.readdirSync(WORKFLOWS_SRC_DIR)
    .filter(f => f.startsWith('deanchor') && f.endsWith('.md'));

  if (filesToCopy.length === 0) {
    console.error('❌ No workflow source files found in workflows/antigravity/');
    process.exit(1);
  }

  const profilesBase = getAntigravityProfilesBase();
  const destinations = findProfilePaths(profilesBase);

  if (destinations.length === 0) {
    const fallbackWorkflows = path.join(os.homedir(), 'AntigravityProfiles', 'personal2', '.gemini', 'antigravity', 'global_workflows');
    const fallbackSkills = path.join(os.homedir(), 'AntigravityProfiles', 'personal2', '.gemini', 'antigravity', 'skills');
    if (fs.existsSync(fallbackWorkflows)) {
      destinations.push({ profileName: 'personal2', workflowsPath: fallbackWorkflows, skillsPath: fallbackSkills });
    } else {
      console.warn('⚠️ No Antigravity profile directories detected automatically.');
      console.log('Please make sure you have run Antigravity at least once.');
      process.exit(1);
    }
  }

  for (const dest of destinations) {
    console.log(`➡️ Compiling for profile: ${dest.profileName}...`);
    
    // Compile workflows
    for (const file of filesToCopy) {
      const srcFile = path.join(WORKFLOWS_SRC_DIR, file);
      const destFile = path.join(dest.workflowsPath, file);
      compileAndWrite(srcFile, destFile);
      console.log(`  + Compiled workflow ${file} to ${dest.profileName}`);
    }

    // Compile skills
    const destSkillDir = path.join(dest.skillsPath, 'deanchor');
    compileFolderSync(SKILLS_SRC_DIR, destSkillDir);
    console.log(`  + Compiled skill directory to ${dest.profileName}`);
  }

  console.log('\n✅ Deanchor rule compilation and installation completed!');
}

function exportCursorRules() {
  const destPath = path.join(process.cwd(), '.cursorrules');
  compileAndWrite(CURSORRULES_SRC, destPath);
  console.log(`✅ Compiled and generated .cursorrules at ${destPath}`);
}

function exportClaudeRules() {
  const destPath = path.join(process.cwd(), 'deanchor.md');
  compileAndWrite(CLAUDE_SRC, destPath);
  console.log(`✅ Compiled and generated deanchor.md at ${destPath}`);
}

function installGitHook() {
  const gitDir = path.join(__dirname, '..', '.git');
  if (!fs.existsSync(gitDir)) {
    console.error('❌ Error: .git directory not found. Please initialize a git repo first.');
    process.exit(1);
  }

  const hooksDir = path.join(gitDir, 'hooks');
  if (!fs.existsSync(hooksDir)) {
    fs.mkdirSync(hooksDir);
  }

  const hookPath = path.join(hooksDir, 'pre-commit');
  const hookScript = `#!/bin/sh
# Auto-compile and distribute Deanchor rules before committing
echo "⚓ Deanchor: Auto-compiling workflows..."
node bin/deanchor.js install
`;

  fs.writeFileSync(hookPath, hookScript, { mode: 0o755 });
  console.log(`✅ Git pre-commit hook installed successfully at ${hookPath}`);
}

function checkStatus() {
  console.log('🔎 Checking Deanchor installation status...');
  const profilesBase = getAntigravityProfilesBase();
  const destinations = findProfilePaths(profilesBase);

  if (destinations.length === 0) {
    console.log('No profiles found.');
    return;
  }

  for (const dest of destinations) {
    console.log(`\nProfile: ${dest.profileName}`);
    const files = fs.readdirSync(dest.workflowsPath).filter(f => f.startsWith('deanchor'));
    const skillExists = fs.existsSync(path.join(dest.skillsPath, 'deanchor'));
    
    if (files.length === 0) {
      console.log('  ❌ Workflows: Not installed');
    } else {
      console.log(`  ✅ Workflows: Installed (${files.length} files)`);
    }
    
    if (!skillExists) {
      console.log('  ❌ Skill: Not installed');
    } else {
      console.log('  ✅ Skill: Installed');
    }
  }
}
