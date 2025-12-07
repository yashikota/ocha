#!/usr/bin/env node
/**
 * .version ファイルからバージョンを読み取り、
 * package.json, Cargo.toml, tauri.conf.json を更新するスクリプト
 */

import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");

// .version からバージョンを読み取る
const version = readFileSync(join(rootDir, ".version"), "utf-8").trim();
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
// [package] セクションの version のみを更新（依存関係の version は変更しない）
cargoToml = cargoToml.replace(
  /^(name = "ocha"\nversion = )"[^"]*"/m,
  `$1"${version}"`
);
writeFileSync(cargoTomlPath, cargoToml);
console.log("✓ src-tauri/Cargo.toml");

console.log(`\nVersion synced to ${version}`);
