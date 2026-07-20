#!/usr/bin/env node

/**
 * Deanchor CLI Tool & Rule Compiler
 * Entry point that routes subcommands to decoupled handlers.
 */

const commands = require('../lib/commands');

const args = process.argv.slice(2);
const command = args[0] || 'help';

switch (command) {
  case 'install':
    commands.installDeanchor();
    break;
  case 'init-hook':
    commands.installGitHook();
    break;
  case 'cursor':
    commands.exportCursorRules();
    break;
  case 'claude':
    commands.exportClaudeRules();
    break;
  case 'codex':
    commands.exportCodexRules();
    break;
  case 'graphify':
    commands.runGraphifyUpdate();
    break;
  case 'mcp':
    commands.startMcpServer();
    break;
  case 'repomap':
    commands.generateRepoMap();
    break;
  case 'status':
    commands.checkStatus();
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
  install     Compile and install deanchor workflows/skills into active Antigravity environment
  init-hook   Setup an optimized git pre-commit hook to compile & sync on commit
  cursor      Generate compiled .cursorrules in current directory
  claude      Generate compiled .clauderules for Claude Code in current directory
  codex       Generate compiled deanchor-codex.md for OpenAI Codex in current directory
  graphify    Update local Graphify codebase knowledge graph
  mcp         Start local Graphify stdio MCP server
  repomap     Generate Aider-style repo map of the codebase
  status      Check installation status across active environment
  help        Display this help card
  `);
}
