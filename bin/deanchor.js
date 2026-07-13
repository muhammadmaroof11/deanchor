#!/usr/bin/env node

/**
 * Deanchor CLI Tool & Installer
 * Helps install and manage the Deanchor agent skill across environments.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const WORKFLOWS_SRC_DIR = path.join(__dirname, '..', 'workflows', 'antigravity');
const SKILLS_SRC_DIR = path.join(__dirname, '..', 'skills', 'deanchor');
const CURSORRULES_SRC = path.join(__dirname, '..', 'workflows', 'cursor', '.cursorrules');
const CLAUDE_SRC = path.join(__dirname, '..', 'workflows', 'claude-code', 'deanchor.md');

const args = process.argv.slice(2);
const command = args[0] || 'help';

switch (command) {
  case 'install':
    installDeanchor();
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
  install   Install deanchor workflows and skills into all detected Antigravity profiles
  cursor    Generate a .cursorrules file in the current working directory
  claude    Generate a deanchor.md file in the current directory for Claude Code
  status    Check installation status across active Antigravity profiles
  help      Display this help card
  `);
}

function getAntigravityProfilesBase() {
  const userHome = os.homedir();
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

function copyFolderSync(from, to) {
  if (!fs.existsSync(to)) {
    fs.mkdirSync(to, { recursive: true });
  }
  fs.readdirSync(from).forEach(element => {
    const stat = fs.lstatSync(path.join(from, element));
    if (stat.isFile()) {
      fs.copyFileSync(path.join(from, element), path.join(to, element));
    } else if (stat.isDirectory()) {
      copyFolderSync(path.join(from, element), path.join(to, element));
    }
  });
}

function installDeanchor() {
  console.log('⚓ Installing Deanchor workflows and skills...');
  
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
    console.log(`➡️ Installing for profile: ${dest.profileName}...`);
    
    // Copy workflows
    for (const file of filesToCopy) {
      const srcFile = path.join(WORKFLOWS_SRC_DIR, file);
      const destFile = path.join(dest.workflowsPath, file);
      fs.copyFileSync(srcFile, destFile);
      console.log(`  + Copied workflow ${file} to ${dest.profileName}`);
    }

    // Copy skills
    const destSkillDir = path.join(dest.skillsPath, 'deanchor');
    copyFolderSync(SKILLS_SRC_DIR, destSkillDir);
    console.log(`  + Copied skill directory to ${dest.profileName}`);
  }

  console.log('\n✅ Deanchor workflows and skills successfully installed!');
}

function exportCursorRules() {
  const destPath = path.join(process.cwd(), '.cursorrules');
  fs.copyFileSync(CURSORRULES_SRC, destPath);
  console.log(`✅ Generated .cursorrules at ${destPath}`);
}

function exportClaudeRules() {
  const destPath = path.join(process.cwd(), 'deanchor.md');
  fs.copyFileSync(CLAUDE_SRC, destPath);
  console.log(`✅ Generated deanchor.md at ${destPath}`);
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
