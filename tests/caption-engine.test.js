/**
 * @file caption-engine.test.js
 * @description content/caption-engine.js 단위 테스트
 * Unit tests for content/caption-engine.js
 */

const assert = require("node:assert");
const { CaptionEngine } = require("../content/caption-engine.js");

const engine = new CaptionEngine({
  pauseThresholdMs: 2000
});

// Test deduplication & clean text
assert.strictEqual(engine.cleanText("   의사일정   제1항을   상정합니다.  "), "의사일정 제1항을 상정합니다.");
assert.strictEqual(engine.isDuplicate("안녕하세요", "안녕하세요"), true);
assert.strictEqual(engine.isDuplicate("안녕하세요 여러분", "안녕하세요"), false);
assert.strictEqual(engine.isDuplicate("안녕", "안녕하세요"), true); // prefix check

// Test record creation
const rec1 = engine.createRecord("국민의례가 있겠습니다.", "10:00:00", "00:01:00");
assert.strictEqual(rec1.text, "국민의례가 있겠습니다.");
assert.strictEqual(rec1.isParagraphStart, false);

// Wait for pause threshold to test paragraph start
engine.lastRecordTime = Date.now() - 3000;
const rec2 = engine.createRecord("모두 자리에 착석해 주십시오.", "10:00:05", "00:01:05");
assert.strictEqual(rec2.isParagraphStart, true);

// Additional edge cases & features
// Test cleanText edge cases
assert.strictEqual(engine.cleanText(""), "");
assert.strictEqual(engine.cleanText(null), "");
assert.strictEqual(engine.cleanText(undefined), "");
assert.strictEqual(engine.cleanText(123), "");

// Test isDuplicate edge cases
assert.strictEqual(engine.isDuplicate("", "테스트"), true);
assert.strictEqual(engine.isDuplicate("동일문장", "동일문장"), true);
assert.strictEqual(engine.isDuplicate("전체 문장입니다", "전체"), false);
assert.strictEqual(engine.isDuplicate("전체", "전체 문장입니다"), true); // prefix

// Test handleMutationText and onRecordAdded callback
let callbackRecord = null;
let callbackRecords = null;
engine.onRecordAdded = (rec, list) => {
  callbackRecord = rec;
  callbackRecords = list;
};

engine.handleMutationText("   새로운   발언입니다.   ");
assert.strictEqual(engine.records.length, 1);
assert.strictEqual(engine.records[0].text, "새로운 발언입니다.");
assert.strictEqual(engine.lastLoggedText, "새로운 발언입니다.");
assert.strictEqual(callbackRecord.text, "새로운 발언입니다.");
assert.strictEqual(callbackRecords.length, 1);

// Test duplicate mutation text should be ignored
engine.handleMutationText("새로운 발언입니다.");
assert.strictEqual(engine.records.length, 1);

// Test clear
engine.clear();
assert.strictEqual(engine.records.length, 0);
assert.strictEqual(engine.lastLoggedText, "");
assert.strictEqual(engine.lastRecordTime, 0);

// Test with mock document for player time, container search, and observer lifecycle
const originalDocument = global.document;
const originalMutationObserver = global.MutationObserver;

try {
  let observedTarget = null;
  let observerOptions = null;
  let observerDisconnected = false;
  let observerCallback = null;

  class MockMutationObserver {
    constructor(callback) {
      observerCallback = callback;
    }
    observe(target, options) {
      observedTarget = target;
      observerOptions = options;
    }
    disconnect() {
      observerDisconnected = true;
    }
  }

  const mockDiv = {
    innerText: "자막 테스트 내용",
    textContent: "자막 테스트 내용"
  };

  const mockVideo = {
    currentTime: 3665 // 01:01:05
  };

  /** @type {any} */ (global).MutationObserver = MockMutationObserver;
  /** @type {any} */ (global).document = {
    body: {},
    querySelector: (selector) => {
      if (selector === "video") return mockVideo;
      if (selector === "#viewSubtit .incont") return mockDiv;
      return null;
    }
  };

  const domEngine = new CaptionEngine({ pauseThresholdMs: 1000 });
  assert.strictEqual(domEngine.extractPlayerTime(), "01:01:05");
  assert.strictEqual(domEngine.findCaptionContainer(), mockDiv);

  domEngine.startObserving();
  assert.strictEqual(observedTarget, mockDiv);
  assert.strictEqual(observerOptions.childList, true);
  assert.strictEqual(observerOptions.subtree, true);
  assert.strictEqual(observerOptions.characterData, true);

  // Trigger mutation callback
  observerCallback();
  assert.strictEqual(domEngine.records.length, 1);
  assert.strictEqual(domEngine.records[0].text, "자막 테스트 내용");
  assert.strictEqual(domEngine.records[0].playerTime, "01:01:05");

  domEngine.stopObserving();
  assert.strictEqual(observerDisconnected, true);
  assert.strictEqual(domEngine.observer, null);
} finally {
  /** @type {any} */ (global).document = originalDocument;
  /** @type {any} */ (global).MutationObserver = originalMutationObserver;
}

console.log("Task 3 test passed!");
