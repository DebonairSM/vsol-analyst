#!/usr/bin/env node
const { spawn } = require('child_process');
const path = require('path');

// Change to the project directory
process.chdir(__dirname);

// Set environment variable
process.env.DATABASE_URL = process.env.DATABASE_URL || 'file:./dev.db';

// Spawn tsx with the MCP server script
const tsxPath = path.join(__dirname, 'node_modules', '.bin', 'tsx.cmd');
const serverPath = path.join(__dirname, 'src', 'mcp', 'server.ts');

const child = spawn(tsxPath, [serverPath], {
  stdio: 'inherit',
  cwd: __dirname,
  env: process.env,
  shell: true
});

child.on('error', (error) => {
  console.error('Failed to start MCP server:', error);
  process.exit(1);
});

child.on('exit', (code) => {
  process.exit(code || 0);
});

