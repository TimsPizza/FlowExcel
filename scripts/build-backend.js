#!/usr/bin/env node

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function checkCommand(command) {
  try {
    execSync(`${command} --version`, { stdio: 'pipe' });
    return true;
  } catch (error) {
    return false;
  }
}

function runCommand(command, options = {}) {
  const defaultOptions = {
    stdio: 'inherit',
    cwd: projectRoot,
    ...options
  };
  
  try {
    execSync(command, defaultOptions);
    return true;
  } catch (error) {
    log(`Command failed: ${command}`, 'red');
    log(`Error: ${error.message}`, 'red');
    return false;
  }
}

function main() {
  log('🚀 Starting backend build process...', 'cyan');
  
  // Check if uv is available
  if (!checkCommand('uv')) {
    log('❌ uv is not installed or not in PATH', 'red');
    log('Please install uv first: https://docs.astral.sh/uv/getting-started/installation/', 'yellow');
    process.exit(1);
  }
  
  log('✅ uv is available', 'green');
  
  // Check if Python backend directory exists
  const pythonDir = path.join(projectRoot, 'src-python');
  if (!existsSync(pythonDir)) {
    log('❌ src-python directory not found', 'red');
    process.exit(1);
  }
  
  log('📁 Found Python backend directory', 'green');
  
  // Build the backend
  log('🔨 Building backend with uv...', 'yellow');
  const buildSuccess = runCommand('uv run python build_binary.py', { 
    cwd: pythonDir,
    stdio: 'inherit'
  });
  
  if (!buildSuccess) {
    log('❌ Backend build failed', 'red');
    process.exit(1);
  }
  
  log('✅ Backend build completed successfully', 'green');
  
  // Check if the binary was created
  const binaryDir = path.join(projectRoot, 'src-tauri', 'binaries');
  if (!existsSync(binaryDir)) {
    log('⚠️  Binary directory not found, but build completed', 'yellow');
  } else {
    log('📦 Binary directory found', 'green');
  }
  
  log('🎉 Backend build process completed!', 'cyan');
}

// Only run if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { main as buildBackend }; 