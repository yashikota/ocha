#!/usr/bin/env node
/**
 * バージョン一括更新スクリプト
 *
 * 使い方:
 *   bun scripts/version.js patch   # 0.1.4 -> 0.1.5
 *   bun scripts/version.js minor   # 0.1.4 -> 0.2.0
 *   bun scripts/version.js major   # 0.1.4 -> 1.0.0
 *   bun scripts/version.js 0.2.0   # 直接指定
 */

import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';

const files = [
  { path: 'package.json', pattern: /"version":\s*"([^"]+)"/ },
  { path: 'src-tauri/tauri.conf.json', pattern: /"version":\s*"([^"]+)"/ },
  { path: 'src-tauri/Cargo.toml', pattern: /^version\s*=\s*"([^"]+)"/m },
];

function getCurrentVersion() {
  const pkg = JSON.parse(readFileSync('package.json', 'utf-8'));
  return pkg.version;
}

function bumpVersion(current, type) {
  const [major, minor, patch] = current.split('.').map(Number);

  switch (type) {
    case 'major':
      return `${major + 1}.0.0`;
    case 'minor':
      return `${major}.${minor + 1}.0`;
    case 'patch':
      return `${major}.${minor}.${patch + 1}`;
    default:
      // 直接指定された場合
      if (/^\d+\.\d+\.\d+$/.test(type)) {
        return type;
      }
      throw new Error(`Invalid version type: ${type}`);
  }
}

function updateFile(filePath, pattern, newVersion) {
  const content = readFileSync(filePath, 'utf-8');
  const updated = content.replace(pattern, (match, oldVersion) => {
    return match.replace(oldVersion, newVersion);
  });
  writeFileSync(filePath, updated);
  console.log(`  ✓ ${filePath}`);
}

function main() {
  const arg = process.argv[2];

  if (!arg) {
    console.log('Usage: bun scripts/version.js <patch|minor|major|x.y.z>');
    process.exit(1);
  }

  const currentVersion = getCurrentVersion();
  const newVersion = bumpVersion(currentVersion, arg);

  console.log(`\nUpdating version: ${currentVersion} → ${newVersion}\n`);

  // ファイルを更新
  for (const file of files) {
    updateFile(file.path, file.pattern, newVersion);
  }

  // Git操作
  console.log('\nGit operations:');
  try {
    execSync('git add package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml', { stdio: 'inherit' });
    execSync(`git commit -m "chore: bump version to ${newVersion}"`, { stdio: 'inherit' });
    execSync(`git tag v${newVersion}`, { stdio: 'inherit' });
    console.log(`\n✓ Created tag: v${newVersion}`);
    console.log('\nRun "git push && git push --tags" to publish');
  } catch (e) {
    console.error('Git operation failed:', e.message);
  }
}

main();
