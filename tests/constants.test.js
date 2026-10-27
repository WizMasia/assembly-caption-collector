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

// 3. TIMESTAMP_MODES 검증 / Verify TIMESTAMP_MODES
assert.deepStrictEqual(Object.keys(TIMESTAMP_MODES), ["PC", "PLAYER", "BOTH"]);
assert.strictEqual(TIMESTAMP_MODES.PC, "pc");
assert.strictEqual(TIMESTAMP_MODES.PLAYER, "player");
assert.strictEqual(TIMESTAMP_MODES.BOTH, "both");

// 4. STORAGE_KEYS 검증 / Verify STORAGE_KEYS
assert.ok(STORAGE_KEYS.RECORDS && STORAGE_KEYS.IS_RECORDING, "Storage keys must be defined");

// 5. I18N 다국어 검증 / Verify I18N dictionaries
assert.ok(I18N.ko && I18N.en, "Localization dictionaries must exist");
assert.strictEqual(typeof I18N.ko.appTitle, "string");
assert.strictEqual(typeof I18N.en.appTitle, "string");

console.log("Task 1 test passed!");
