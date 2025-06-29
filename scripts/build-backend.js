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
    // Windows-specific command checking
    const isWindows = process.platform === 'win32';
    const testCmd = isWindows ? `where ${command}` : `which ${command}`;
    
    console.log(`🔍 Checking command: ${command}`);
    
    // First check if command exists in PATH
    try {
      execSync(testCmd, { stdio: 'pipe' });
    } catch (e) {
      console.log(`❌ Command not found in PATH: ${command}`);
      return false;
    }
    
    // Then check if it can run --version
    execSync(`${command} --version`, { stdio: 'pipe' });
    console.log(`✅ Command verified: ${command}`);
    return true;
  } catch (error) {
    console.log(`❌ Command check failed for ${command}: ${error.message}`);
    return false;
  }
}

function runCommand(command, options = {}) {
  const defaultOptions = {
    stdio: 'inherit',
    cwd: projectRoot,
    // Windows-specific shell options
    shell: process.platform === 'win32' ? 'cmd.exe' : true,
    ...options
  };
  
  console.log(`🔧 Running command: ${command}`);
  console.log(`📂 Working directory: ${defaultOptions.cwd}`);
  
  try {
    execSync(command, defaultOptions);
    console.log(`✅ Command completed: ${command}`);
    return true;
  } catch (error) {
    console.log(`❌ Command failed: ${command}`);
    console.log(`❌ Error: ${error.message}`);
    if (error.stdout) {
      console.log(`📤 stdout: ${error.stdout.toString()}`);
    }
    if (error.stderr) {
      console.log(`📤 stderr: ${error.stderr.toString()}`);
    }
    log(`Command failed: ${command}`, 'red');
    log(`Error: ${error.message}`, 'red');
    return false;
  }
}

function main() {
  // Immediate feedback that script is running
  console.log('🚀 Starting backend build process...');
  console.log(`🖥️  Platform: ${process.platform}`);
  console.log(`📁 Project root: ${projectRoot}`);
  
  log('🚀 Starting backend build process...', 'cyan');
  
  // Detect platform
  const isWindows = process.platform === 'win32';
  const exeExtension = isWindows ? '.exe' : '';
  log(`🖥️  Platform: ${process.platform}`, 'blue');
  log(`📁 Working directory: ${projectRoot}`, 'blue');
  
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
  
  // Install/sync dependencies first
  log('📦 Installing Python dependencies...', 'yellow');
  const syncSuccess = runCommand('uv sync', { 
    cwd: pythonDir,
    stdio: 'inherit'
  });
  
  if (!syncSuccess) {
    log('❌ Failed to install dependencies', 'red');
    process.exit(1);
  }
  
  log('✅ Dependencies installed successfully', 'green');
  
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
  
  // Verify the binary was created with correct platform-specific naming
  const binaryDir = path.join(projectRoot, 'src-tauri', 'binaries', 'flowexcel-backend');
  const expectedBinary = path.join(binaryDir, `flowexcel-backend${exeExtension}`);
  
  if (!existsSync(binaryDir)) {
    log('❌ Binary directory not found', 'red');
    process.exit(1);
  } else if (!existsSync(expectedBinary)) {
    log(`❌ Expected binary not found: ${expectedBinary}`, 'red');
    process.exit(1);
  } else {
    log('📦 Binary verified successfully', 'green');
    log(`✓ Binary location: ${expectedBinary}`, 'green');
  }
  
  log('🎉 Backend build process completed!', 'cyan');
}

// Only run if this script is executed directly
// Windows-compatible check for direct execution
function isMainModule() {
  // Check if this script is being run directly
  const scriptPath = fileURLToPath(import.meta.url);
  const mainPath = process.argv[1];
  
  // Normalize paths for cross-platform compatibility
  const normalizedScript = path.resolve(scriptPath);
  const normalizedMain = path.resolve(mainPath);
  
  return normalizedScript === normalizedMain;
}

if (isMainModule()) {
  try {
    main();
  } catch (error) {
    console.error('🚨 Build script failed:', error.message);
    process.exit(1);
  }
}

export { main as buildBackend }; 