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
    
    console.log(`[INFO] Checking command: ${command}`);
    
    // First check if command exists in PATH
    try {
      execSync(testCmd, { stdio: 'pipe' });
    } catch (e) {
      console.log(`[ERROR] Command not found in PATH: ${command}`);
      return false;
    }
    
    // Then check if it can run --version
    execSync(`${command} --version`, { stdio: 'pipe' });
    console.log(`[OK] Command verified: ${command}`);
    return true;
  } catch (error) {
    console.log(`[ERROR] Command check failed for ${command}: ${error.message}`);
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
  
  console.log(`[INFO] Running command: ${command}`);
  console.log(`[INFO] Working directory: ${defaultOptions.cwd}`);
  
  try {
    execSync(command, defaultOptions);
    console.log(`[OK] Command completed: ${command}`);
    return true;
  } catch (error) {
    console.log(`[ERROR] Command failed: ${command}`);
    console.log(`[ERROR] Error: ${error.message}`);
    if (error.stdout) {
      console.log(`[ERROR] stdout: ${error.stdout.toString()}`);
    }
    if (error.stderr) {
      console.log(`[ERROR] stderr: ${error.stderr.toString()}`);
    }
    log(`Command failed: ${command}`, 'red');
    log(`Error: ${error.message}`, 'red');
    return false;
  }
}

function main() {
  // Immediate feedback that script is running
  console.log('[INFO] Starting backend build process...');
  console.log(`[INFO] Platform: ${process.platform}`);
  console.log(`[INFO] Project root: ${projectRoot}`);
  
  log('[INFO] Starting backend build process...', 'cyan');
  
  // Detect platform
  const isWindows = process.platform === 'win32';
  const exeExtension = isWindows ? '.exe' : '';
  log(`[INFO] Platform: ${process.platform}`, 'blue');
  log(`[INFO] Working directory: ${projectRoot}`, 'blue');
  
  // Check if uv is available
  if (!checkCommand('uv')) {
    log('[ERROR] uv is not installed or not in PATH', 'red');
    log('Please install uv first: https://docs.astral.sh/uv/getting-started/installation/', 'yellow');
    process.exit(1);
  }
  
  log('[OK] uv is available', 'green');
  
  // Check if Python backend directory exists
  const pythonDir = path.join(projectRoot, 'src-python');
  if (!existsSync(pythonDir)) {
    log('[ERROR] src-python directory not found', 'red');
    process.exit(1);
  }
  
  log('[INFO] Found Python backend directory', 'green');
  
  // Install/sync dependencies first
  log('[INFO] Installing Python dependencies...', 'yellow');
  const syncSuccess = runCommand('uv sync', { 
    cwd: pythonDir,
    stdio: 'inherit'
  });
  
  if (!syncSuccess) {
    log('[ERROR] Failed to install dependencies', 'red');
    process.exit(1);
  }
  
  log('[OK] Dependencies installed successfully', 'green');
  
  // Build the backend
  log('[INFO] Building backend with uv...', 'yellow');
  const buildSuccess = runCommand('uv run python build_binary.py', { 
    cwd: pythonDir,
    stdio: 'inherit'
  });
  
  if (!buildSuccess) {
    log('[ERROR] Backend build failed', 'red');
    process.exit(1);
  }
  
  log('[OK] Backend build completed successfully', 'green');
  
  // Verify the binary was created with correct platform-specific naming
  const binaryDir = path.join(projectRoot, 'src-tauri', 'binaries', 'flowexcel-backend');
  const expectedBinary = path.join(binaryDir, `flowexcel-backend${exeExtension}`);
  
  if (!existsSync(binaryDir)) {
    log('[ERROR] Binary directory not found', 'red');
    process.exit(1);
  } else if (!existsSync(expectedBinary)) {
    log(`[ERROR] Expected binary not found: ${expectedBinary}`, 'red');
    process.exit(1);
  } else {
    log('[OK] Binary verified successfully', 'green');
    log(`[OK] Binary location: ${expectedBinary}`, 'green');
  }
  
  log('[INFO] Backend build process completed!', 'cyan');
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
    console.error('[ERROR] Build script failed:', error.message);
    process.exit(1);
  }
}

export { main as buildBackend }; 