#!/usr/bin/env node
/**
 * バージョンを各設定ファイルに同期するスクリプト
 * 引数でバージョンを指定、または package.json から読み取る
 */

import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");

// 引数からバージョンを取得、なければ package.json から
const version = process.argv[2] || JSON.parse(readFileSync(join(rootDir, "package.json"), "utf-8")).version;
console.log(`Syncing version: ${version}`);

// package.json を更新
const packageJsonPath = join(rootDir, "package.json");
const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
packageJson.version = version;
writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + "\n");
console.log("✓ package.json");

// tauri.conf.json を更新
const tauriConfPath = join(rootDir, "src-tauri", "tauri.conf.json");
const tauriConf = JSON.parse(readFileSync(tauriConfPath, "utf-8"));
tauriConf.version = version;
writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2) + "\n");
console.log("✓ src-tauri/tauri.conf.json");

// Cargo.toml を更新
const cargoTomlPath = join(rootDir, "src-tauri", "Cargo.toml");
let cargoToml = readFileSync(cargoTomlPath, "utf-8");
cargoToml = cargoToml.replace(
  /^(name = "ocha"\nversion = )"[^"]*"/m,
  `$1"${version}"`
);
writeFileSync(cargoTomlPath, cargoToml);
console.log("✓ src-tauri/Cargo.toml");

console.log(`\nVersion synced to ${version}`);

