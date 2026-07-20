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

function compileUnifiedFile(srcFile, destFile, platformName) {
  let content = fs.readFileSync(srcFile, 'utf8');
  
  // Platform-specific optimizations
  let platformInstructions = '';
  if (platformName === 'cursor') {
    platformInstructions = `
## 🎯 Cursor Platform Optimizations
- **Context Tagging:** Use \`@file\`, \`@folder\`, and \`@codebase\` in Cursor's Composer or Chat panel to feed relevant contexts directly to the model.
- **Rules Reference:** Rely on the active codebase context. If you need to trace dependencies, use Cursor's terminal to query the Graphify CLI.
- **Composer Mode:** When refactoring multiple files under \`deanchor-dev\`, write the plan first, then use Cursor Composer to write changes concurrently.
`;
  } else if (platformName === 'claude-code') {
    platformInstructions = `
## 🎯 Claude Code Platform Optimizations
- **Shell Tools:** Leverage Claude Code's native tool execution (\`run_command\`, \`search_web\`) to run Graphify and security tools.
- **Incremental Steps:** For complex refactoring, execute one file replacement at a time, checking compile/test errors in between steps.
- **Lighthouse Loops:** In Claude Code's shell, start the dev server in the background and execute Lighthouse audits to verify optimizations.
`;
  } else if (platformName === 'codex') {
    platformInstructions = `
## 🎯 OpenAI Codex / API Platform Optimizations
- **Token Budget:** Codex has a fixed token context. Focus strictly on the files passed in the prompt context.
- **Deterministic Transforms:** Write deterministic code changes. Verify syntax correctness before responding.
`;
  }
  
  content = content + '\n\n' + platformInstructions;
  
  // Append all sub-workflows
  content += '\n\n# ==========================================\n# SPECIALIZED SUB-WORKFLOWS & PERSONAS\n# ==========================================\n';
  
  const workflows = [
    { id: 'dev', file: 'deanchor-dev.md', name: '💻 CODE ARCHITECTURE DEANCHOR (deanchor-dev)' },
    { id: 'design', file: 'deanchor-design.md', name: '🎨 UI/UX DESIGN DEANCHOR (deanchor-design)' },
    { id: 'sec', file: 'deanchor-sec.md', name: '🛡️ SECURITY AUDIT DEANCHOR (deanchor-sec)' },
    { id: 'perf', file: 'deanchor-perf.md', name: '⚡ PERFORMANCE OPTIMIZATION DEANCHOR (deanchor-perf)' },
    { id: 'doc', file: 'deanchor-doc.md', name: '📄 DOCUMENTATION DEANCHOR (deanchor-doc)' },
    { id: 'review', file: 'deanchor-review.md', name: '🔎 ANCHORING AUDIT DEANCHOR (deanchor-review)' },
    { id: 'audit', file: 'deanchor-audit.md', name: '📊 FROWNING PROJECT AUDIT (deanchor-audit)' }
  ];
  
  for (const wf of workflows) {
    const wfPath = path.join(WORKFLOWS_SRC_DIR, wf.file);
    if (fs.existsSync(wfPath)) {
      let wfContent = fs.readFileSync(wfPath, 'utf8');
      // Strip frontmatter metadata
      if (wfContent.startsWith('---')) {
        const parts = wfContent.split('---');
        if (parts.length >= 3) {
          wfContent = parts.slice(2).join('---').trim();
        }
      }
      content += `\n\n---\n\n## ${wf.name}\n\n${wfContent}`;
    }
  }
  
  const compiled = compiler.compileTemplate(content);
  fs.writeFileSync(destFile, compiled, 'utf8');
}

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

  // Auto-export rule files to local workspace root
  console.log('\n➡️ Exporting compiled rule files to workspace root...');
  exportCursorRules();
  exportClaudeRules();
  exportCodexRules();

  console.log('\n✅ Deanchor rule compilation and installation completed!');
}

function exportCursorRules() {
  const destPath = path.join(process.cwd(), '.cursorrules');
  compileUnifiedFile(CURSORRULES_SRC, destPath, 'cursor');
  console.log(`✅ Compiled and generated .cursorrules at ${destPath}`);
}

function exportClaudeRules() {
  const destPath = path.join(process.cwd(), '.clauderules');
  compileUnifiedFile(CLAUDE_SRC, destPath, 'claude-code');
  console.log(`✅ Compiled and generated .clauderules at ${destPath}`);
}

function exportCodexRules() {
  const destPath = path.join(process.cwd(), 'deanchor-codex.md');
  compileUnifiedFile(CODEX_SRC, destPath, 'codex');
  console.log(`✅ Compiled and generated deanchor-codex.md at ${destPath}`);
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
