const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');
const compiler = require('./compiler');

const WORKFLOWS_SRC_DIR = path.join(__dirname, '..', 'workflows', 'antigravity');
const SKILLS_SRC_DIR = path.join(__dirname, '..', 'skills', 'deanchor');
const CURSORRULES_SRC = path.join(__dirname, '..', 'workflows', 'cursor', '.cursorrules');
const CLAUDE_SRC = path.join(__dirname, '..', 'workflows', 'claude-code', 'deanchor.md');
const CODEX_SRC = path.join(__dirname, '..', 'workflows', 'codex', 'deanchor.md');

function installDeanchor() {
  console.log('⚓ Compiling and installing Deanchor workflows and skills...');
  
  if (!fs.existsSync(WORKFLOWS_SRC_DIR)) {
    console.error('❌ Error: workflows/antigravity source directory not found.');
    process.exit(1);
  }

  const filesToCopy = fs.readdirSync(WORKFLOWS_SRC_DIR)
    .filter(f => f.startsWith('deanchor') && f.endsWith('.md'));

  if (filesToCopy.length === 0) {
    console.error('❌ No workflow source files found in workflows/antigravity/');
    process.exit(1);
  }

  const dest = compiler.getAntigravityPaths();

  // Create target directories if they don't exist
  fs.mkdirSync(dest.workflowsPath, { recursive: true });
  fs.mkdirSync(dest.skillsPath, { recursive: true });

  console.log(`➡️ Compiling for active profile at: ${os.homedir()}...`);
  
  // Compile workflows
  for (const file of filesToCopy) {
    const srcFile = path.join(WORKFLOWS_SRC_DIR, file);
    const destFile = path.join(dest.workflowsPath, file);
    compiler.compileAndWrite(srcFile, destFile);
    console.log(`  + Compiled workflow ${file} to global_workflows`);
  }

  // Compile skills
  const destSkillDir = path.join(dest.skillsPath, 'deanchor');
  compiler.compileFolderSync(SKILLS_SRC_DIR, destSkillDir);
  console.log(`  + Compiled skill directory to skills`);

  console.log('\n✅ Deanchor rule compilation and installation completed!');
}

function exportCursorRules() {
  const destPath = path.join(process.cwd(), '.cursorrules');
  compiler.compileAndWrite(CURSORRULES_SRC, destPath);
  console.log(`✅ Compiled and generated .cursorrules at ${destPath}`);
}

function exportClaudeRules() {
  const destPath = path.join(process.cwd(), 'deanchor.md');
  compiler.compileAndWrite(CLAUDE_SRC, destPath);
  console.log(`✅ Compiled and generated deanchor.md at ${destPath}`);
}

function installGitHook() {
  const gitDir = path.join(__dirname, '..', '.git');
  if (!fs.existsSync(gitDir)) {
    console.error('❌ Error: .git directory not found. Please initialize a git repo first.');
    process.exit(1);
  }

  const hooksDir = path.join(gitDir, 'hooks');
  fs.mkdirSync(hooksDir, { recursive: true });

  const hookPath = path.join(hooksDir, 'pre-commit');
  const hookScript = `#!/bin/sh
# Delta-change checks for Deanchor
echo "⚓ Deanchor: Analyzing commit changes..."

# Check if templates or configurations changed
if git diff --cached --name-only | grep -E '^workflows/|^skills/|^config/|^bin/|^lib/' >/dev/null 2>&1; then
  echo "⚓ Deanchor: Changes detected in rule templates/configs. Compiling workflows..."
  node bin/deanchor.js install
fi

# Check if codebase source files changed
if git diff --cached --name-only | grep -E '\\.js$|\\.ts$|\\.py$|\\.go$' >/dev/null 2>&1; then
  if command -v graphify >/dev/null 2>&1; then
    echo "⚓ Deanchor: Code changes detected. Rebuilding Graphify code graph..."
    node bin/deanchor.js graphify
  fi
  
  if command -v aider >/dev/null 2>&1; then
    echo "⚓ Deanchor: Code changes detected. Rebuilding Aider repository map..."
    node bin/deanchor.js repomap
  fi
fi
`;

  fs.writeFileSync(hookPath, hookScript, { mode: 0o755 });
  console.log(`✅ Git pre-commit hook installed successfully at ${hookPath}`);
}

function runGraphifyUpdate() {
  console.log('⚓ Rebuilding Graphify code graph...');
  try {
    execSync('graphify update', { stdio: 'inherit' });
    console.log('✅ Graphify update completed!');
  } catch (err) {
    console.warn('⚠️ Warning: Failed to run "graphify update". Ensure graphifyy is installed globally.');
  }
}

function startMcpServer() {
  const graphJson = path.join(process.cwd(), '.graphify', 'graph.json');
  if (!fs.existsSync(graphJson)) {
    console.error('❌ Error: graph.json not found. Run "node bin/deanchor.js graphify" first.');
    process.exit(1);
  }
  console.log(`⚓ Starting Graphify MCP server on ${graphJson}...`);
  try {
    execSync(`npx graphify serve "${graphJson}"`, { stdio: 'inherit' });
  } catch (err) {
    console.error('❌ Failed to run Graphify MCP server.');
  }
}

function generateRepoMap() {
  console.log('⚓ Generating codebase repository map...');
  try {
    execSync('aider --show-repo-map', { stdio: 'inherit' });
    return;
  } catch (e) {
    // Aider not available
  }
  
  const reportPath = path.join(process.cwd(), '.graphify', 'GRAPH_REPORT.md');
  if (fs.existsSync(reportPath)) {
    const dest = path.join(process.cwd(), 'repo-map.md');
    fs.copyFileSync(reportPath, dest);
    console.log(`✅ Repo map exported to ${dest}`);
  } else {
    console.error('❌ Neither Aider nor Graphify report was found. Run "node bin/deanchor.js graphify" first.');
  }
}

function checkStatus() {
  console.log('🔎 Checking Deanchor installation status...');
  const dest = compiler.getAntigravityPaths();

  const workflowsExist = fs.existsSync(dest.workflowsPath);
  const skillExists = fs.existsSync(path.join(dest.skillsPath, 'deanchor'));
  
  console.log(`\nActive Profile Path: ${os.homedir()}`);
  
  if (!workflowsExist) {
    console.log('  ❌ Workflows: Not installed');
  } else {
    const files = fs.readdirSync(dest.workflowsPath).filter(f => f.startsWith('deanchor'));
    console.log(`  ✅ Workflows: Installed (${files.length} files) at ${dest.workflowsPath}`);
  }
  
  if (!skillExists) {
    console.log('  ❌ Skill: Not installed');
  } else {
    console.log(`  ✅ Skill: Installed at ${dest.skillsPath}`);
  }
}

module.exports = {
  installDeanchor,
  exportCursorRules,
  exportClaudeRules,
  installGitHook,
  runGraphifyUpdate,
  startMcpServer,
  generateRepoMap,
  checkStatus
};
