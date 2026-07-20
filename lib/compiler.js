const fs = require('fs');
const path = require('path');
const os = require('os');

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

// Get target paths for the active Antigravity environment
function getAntigravityPaths() {
  const base = path.join(os.homedir(), '.gemini', 'antigravity');
  return {
    workflowsPath: path.join(base, 'global_workflows'),
    skillsPath: path.join(base, 'skills')
  };
}

// Compile template dynamically replacing any {{KEY}} from config
function compileTemplate(content) {
  let compiled = content;
  
  // Dynamic template substitution
  for (const key of Object.keys(config)) {
    const placeholder = `{{${key.replace(/([A-Z])/g, '_$1').toUpperCase()}}}`; // e.g. defaultMode -> {{DEFAULT_MODE}}
    let value = config[key];
    
    if (Array.isArray(value)) {
      value = value.map(item => `  - 🚫 ${item} -> BANNED`).join('\n');
    }
    
    // Perform global replacement
    compiled = compiled.replaceAll(placeholder, value);
  }
  
  return compiled;
}

function compileAndWrite(srcPath, destPath) {
  const content = fs.readFileSync(srcPath, 'utf8');
  const compiled = compileTemplate(content);
  fs.writeFileSync(destPath, compiled, 'utf8');
}

function compileFolderSync(from, to) {
  fs.mkdirSync(to, { recursive: true });
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

module.exports = {
  config,
  getAntigravityPaths,
  compileTemplate,
  compileAndWrite,
  compileFolderSync
};
