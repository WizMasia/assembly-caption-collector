/**
 * @file package.js
 * @description 크롬 확장 프로그램 배포용 ZIP 파일 생성 스크립트
 * Packages the Chrome Extension into a distributable ZIP file.
 *
 * 실행 방법 / Usage:
 *   node scripts/package.js
 */

const fs = require("node:fs");
const path = require("node:path");
const { execSync } = require("node:child_process");

/**
 * 배포 아티팩트 빌드 실행 함수
 * Main execution function to package the extension
 * @returns {string} 생성된 ZIP 파일 경로 / Output ZIP file path
 */
function packageExtension() {
  const rootDir = path.resolve(__dirname, "..");
  const manifestPath = path.join(rootDir, "manifest.json");

  if (!fs.existsSync(manifestPath)) {
    throw new Error("manifest.json 파일을 찾을 수 없습니다 / manifest.json not found.");
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
  const version = manifest.version || "1.0.0";
  const distDir = path.join(rootDir, "dist");

  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }

  const zipFilename = `assembly-caption-collector-v${version}.zip`;
  const zipPath = path.join(distDir, zipFilename);

  if (fs.existsSync(zipPath)) {
    fs.unlinkSync(zipPath);
  }

  console.log(`📦 [Package] Packaging extension version v${version}... / v${version} 패키징 시작...`);

  // ZIP 포함 대상 파일 및 디렉토리
  // Target files and directories to include in extension package
  const targets = [
    "manifest.json",
    "config",
    "content",
    "popup",
    "utils",
    "icons",
    "README.md",
    "LICENSE"
  ];

  const zipCmd = `zip -r "${zipPath}" ${targets.join(" ")} -x "*.DS_Store*" -x "*__MACOSX*"`;
  execSync(zipCmd, { cwd: rootDir, stdio: "inherit" });

  console.log(`✅ [Success] Successfully generated package at: ${zipPath}`);
  console.log(`\n📄 [Contents] Verifying zip contents / 압축 파일 목록 검증:`);
  execSync(`unzip -l "${zipPath}"`, { stdio: "inherit" });

  return zipPath;
}

if (require.main === module) {
  try {
    packageExtension();
  } catch (err) {
    console.error("❌ [Error] Failed to package extension / 패키징 실패:", err);
    process.exit(1);
  }
}

module.exports = { packageExtension };
