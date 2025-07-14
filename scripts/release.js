#!/usr/bin/env node

import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
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

function exec(command, options = {}) {
  log(`[INFO] 执行命令: ${command}`, 'blue');
  try {
    return execSync(command, { encoding: 'utf8', ...options }).trim();
  } catch (error) {
    log(`[ERROR] 命令执行失败: ${error.message}`, 'red');
    throw error;
  }
}

function updateVersion(newVersion) {
  // 更新 package.json
  const packageJsonPath = path.join(projectRoot, 'package.json');
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
  packageJson.version = newVersion;
  writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
  log(`[OK] 已更新 package.json 版本为 ${newVersion}`, 'green');

  // 更新 tauri.conf.json
  const tauriConfPath = path.join(projectRoot, 'src-tauri', 'tauri.conf.json');
  const tauriConf = JSON.parse(readFileSync(tauriConfPath, 'utf8'));
  tauriConf.version = newVersion;
  writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2) + '\n');
  log(`[OK] 已更新 tauri.conf.json 版本为 ${newVersion}`, 'green');

  // 更新 Cargo.toml
  const cargoTomlPath = path.join(projectRoot, 'src-tauri', 'Cargo.toml');
  let cargoToml = readFileSync(cargoTomlPath, 'utf8');
  cargoToml = cargoToml.replace(/^version = ".*"$/m, `version = "${newVersion}"`);
  writeFileSync(cargoTomlPath, cargoToml);
  log(`[OK] 已更新 Cargo.toml 版本为 ${newVersion}`, 'green');

  // 更新 Python pyproject.toml
  const pyprojectPath = path.join(projectRoot, 'src-python', 'pyproject.toml');
  let pyproject = readFileSync(pyprojectPath, 'utf8');
  pyproject = pyproject.replace(/^version = ".*"$/m, `version = "${newVersion}"`);
  writeFileSync(pyprojectPath, pyproject);
  log(`[OK] 已更新 pyproject.toml 版本为 ${newVersion}`, 'green');
}

function validateVersion(version) {
  const versionRegex = /^\d+\.\d+\.\d+$/;
  if (!versionRegex.test(version)) {
    throw new Error('[ERROR] 版本号必须符合 x.y.z 格式');
  }
}

function getCurrentVersion() {
  const packageJsonPath = path.join(projectRoot, 'package.json');
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
  return packageJson.version;
}

function checkGitStatus() {
  try {
    const status = exec('git status --porcelain');
    if (status) {
      throw new Error('[ERROR] 工作目录有未提交的更改，请先提交或暂存更改');
    }
  } catch (error) {
    if (error.message.includes('工作目录有未提交的更改')) {
      throw error;
    }
    log('[ERROR] Git 状态检查失败，可能不在 Git 仓库中', 'yellow');
  }
}

function createRelease(version, releaseType = 'draft') {
  log('\n[INFO] 开始发布流程...', 'cyan');
  
  // 检查 Git 状态
  log('[INFO] 检查 Git 状态...', 'blue');
  checkGitStatus();
  
  const currentVersion = getCurrentVersion();
  log(`[INFO] 当前版本: ${currentVersion}`, 'blue');
  log(`[INFO] 新版本: ${version}`, 'blue');
  
  // 验证版本号
  validateVersion(version);
  
  // 更新版本号
  log('\n[INFO] 更新版本号...', 'yellow');
  updateVersion(version);
  
  // 提交更改
  log('\n[INFO] 提交版本更改...', 'yellow');
  exec('git add .');
  exec(`git commit -m "chore: bump version to v${version}"`);
  
  // 创建标签
  log('\n[INFO] 创建版本标签...', 'yellow');
  exec(`git tag -a v${version} -m "Release v${version}"`);
  
  // 推送到远程
  log('\n[INFO] 推送到远程仓库...', 'yellow');
  exec('git push origin HEAD');
  exec(`git push origin v${version}`);
  
  log('\n[INFO] 发布流程完成！', 'green');
  log(`[INFO] GitHub Actions 将自动构建并发布 v${version}`, 'green');
  log(`[INFO] 查看构建状态: https://github.com/TimsPizza/FlowExcel/actions`, 'cyan');
}

function showUsage() {
  log('\n[INFO] 使用说明:', 'cyan');
  log('  node scripts/release.js <version> [type]', 'white');
  log('\n[INFO] 参数:', 'cyan');
  log('  version  版本号 (例如: 1.0.0)', 'white');
  log('  type     发布类型 (draft|prerelease|release，默认: draft)', 'white');
  log('\n[INFO] 示例:', 'cyan');
  log('  node scripts/release.js 1.0.0 draft      # 创建草稿发布', 'white');
  log('  node scripts/release.js 1.0.1 prerelease # 创建预发布', 'white');
  log('  node scripts/release.js 1.1.0 release    # 创建正式发布', 'white');
}

function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    showUsage();
    return;
  }
  
  const version = args[0];
  const releaseType = args[1] || 'draft';
  
  if (!['draft', 'prerelease', 'release'].includes(releaseType)) {
    log('[ERROR] 发布类型必须是 draft、prerelease 或 release', 'red');
    return;
  }
  
  try {
    createRelease(version, releaseType);
  } catch (error) {
    log(`[ERROR] 发布失败: ${error.message}`, 'red');
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
} 