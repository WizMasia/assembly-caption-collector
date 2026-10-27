/**
 * @file constants.test.js
 * @description config/constants.js 단위 테스트
 * Unit tests for config/constants.js
 */

const assert = require("node:assert");
const { CANDIDATE_SELECTORS, TIMING, TIMESTAMP_MODES, STORAGE_KEYS, I18N } = require("../config/constants.js");

// 1. CANDIDATE_SELECTORS 검증 / Verify CANDIDATE_SELECTORS
assert.ok(Array.isArray(CANDIDATE_SELECTORS), "CANDIDATE_SELECTORS must be an array");
assert.ok(CANDIDATE_SELECTORS.includes("#viewSubtit .incont"), "Should include primary natv webcast selector");

// 2. TIMING 검증 / Verify TIMING
assert.ok(TIMING.DEFAULT_PAUSE_THRESHOLD_MS > 0, "Default pause threshold should be positive");
assert.strictEqual(typeof TIMING.DEBOUNCE_MUTATION_MS, "number", "Debounce mutation delay should be a number");
assert.strictEqual(typeof TIMING.PREVIEW_MAX_ITEMS, "number", "Preview max items should be a number");
assert.strictEqual(TIMING.TOAST_DURATION_MS, 2000, "Toast duration should be 2000ms");
assert.strictEqual(TIMING.BLOB_REVOKE_DELAY_MS, 1000, "Blob revoke delay should be 1000ms");
assert.strictEqual(typeof TIMING.DEFAULT_AUTO_SAVE_INTERVAL_MIN, "number", "Auto save interval should be a number");

// 3. TIMESTAMP_MODES 검증 / Verify TIMESTAMP_MODES
assert.deepStrictEqual(Object.keys(TIMESTAMP_MODES), ["PC", "PLAYER", "BOTH"]);
assert.strictEqual(TIMESTAMP_MODES.PC, "pc");
assert.strictEqual(TIMESTAMP_MODES.PLAYER, "player");
assert.strictEqual(TIMESTAMP_MODES.BOTH, "both");

// 4. STORAGE_KEYS 검증 / Verify STORAGE_KEYS
assert.ok(STORAGE_KEYS.RECORDS && STORAGE_KEYS.IS_RECORDING, "Storage keys must be defined");
assert.ok(STORAGE_KEYS.AUTO_SAVE_INTERVAL_MIN, "AUTO_SAVE_INTERVAL_MIN must be defined");

// 5. I18N 다국어 검증 / Verify I18N dictionaries
assert.ok(I18N.ko && I18N.en, "Localization dictionaries must exist");
assert.strictEqual(typeof I18N.ko.appTitle, "string");
assert.strictEqual(typeof I18N.en.appTitle, "string");

const requiredI18nKeys = [
  "tabNotFound",
  "notAssemblyPage",
  "copyFailed",
  "clipboardNotSupported",
  "clearSuccess",
  "defaultTitle",
  "autoSaveLabel",
  "floatingWidgetLabel"
];

requiredI18nKeys.forEach((key) => {
  assert.ok(I18N.ko[key], `ko.${key} must be defined`);
  assert.ok(I18N.en[key], `en.${key} must be defined`);
});

assert.strictEqual(I18N.ko.tabNotFound, "활성화된 국회 의사중계 탭을 찾을 수 없습니다.");
assert.strictEqual(I18N.en.tabNotFound, "No active National Assembly webcast tab found.");
assert.strictEqual(I18N.ko.notAssemblyPage, "국회 의사중계 페이지가 열려 있는지 확인해주세요.");
assert.strictEqual(I18N.en.notAssemblyPage, "Please verify a National Assembly webcast page is open.");
assert.strictEqual(I18N.ko.copyFailed, "복사에 실패했습니다. 권한을 확인해주세요.");
assert.strictEqual(I18N.en.copyFailed, "Failed to copy. Please check clipboard permissions.");
assert.strictEqual(I18N.ko.clipboardNotSupported, "클립보드 API가 지원되지 않는 환경입니다.");
assert.strictEqual(I18N.en.clipboardNotSupported, "Clipboard API is not supported in this environment.");
assert.strictEqual(I18N.ko.clearSuccess, "기록이 초기화되었습니다.");
assert.strictEqual(I18N.en.clearSuccess, "All records cleared successfully.");
assert.strictEqual(I18N.ko.defaultTitle, "국회 의사중계 자막 기록");
assert.strictEqual(I18N.en.defaultTitle, "National Assembly Webcast Captions");

console.log("Task 1 test passed!");
