/**
 * @file caption-engine.test.js
 * @description content/caption-engine.js 단위 테스트 (디바운스, STT 점진 갱신, 복원 헬퍼, 대상 재지정)
 * Unit tests for content/caption-engine.js (debounce, STT progressive update, initRecords, observer retargeting)
 */

const assert = require("node:assert");
const { CaptionEngine } = require("../content/caption-engine.js");

/**
 * 지정된 밀리초 동안 비동기 대기
 * Asynchronously waits for specified milliseconds
 * @param {number} ms - 대기 시간 (ms) / Wait time in ms
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 자막 엔진 전체 테스트 스위트 실행
 * Executes entire test suite for CaptionEngine
 * @returns {Promise<void>}
 */
async function runTests() {
  // -------------------------------------------------------------
  // 테스트 1: 텍스트 정제 및 중복 필터링 검증
  // Test 1: Text sanitization and duplicate filtering
  // -------------------------------------------------------------
  const engine = new CaptionEngine({
    pauseThresholdMs: 2000,
    debounceMs: 20
  });

  // 공백 정규화 및 트림 검증 / Verify whitespace normalization and trimming
  assert.strictEqual(engine.cleanText("   의사일정   제1항을   상정합니다.  "), "의사일정 제1항을 상정합니다.");
  assert.strictEqual(engine.cleanText(""), "");
  assert.strictEqual(engine.cleanText(null), "");
  assert.strictEqual(engine.cleanText(undefined), "");
  assert.strictEqual(engine.cleanText(123), "");

  // 중복 검증 / Verify duplicate checks
  assert.strictEqual(engine.isDuplicate("안녕하세요", "안녕하세요"), true);
  assert.strictEqual(engine.isDuplicate("안녕하세요 여러분", "안녕하세요"), false);
  assert.strictEqual(engine.isDuplicate("안녕", "안녕하세요"), true); // 직전 텍스트의 접두사 축약 형태 / Prefix substring of last text
  assert.strictEqual(engine.isDuplicate("", "테스트"), true);
  assert.strictEqual(engine.isDuplicate("동일문장", "동일문장"), true);
  assert.strictEqual(engine.isDuplicate("전체 문장입니다", "전체"), false);
  assert.strictEqual(engine.isDuplicate("전체", "전체 문장입니다"), true);

  // -------------------------------------------------------------
  // 테스트 2: 레코드 생성 및 문단 분할 침묵 기준 시간 검증
  // Test 2: Record creation and silence pause threshold for paragraph split
  // -------------------------------------------------------------
  const rec1 = engine.createRecord("국민의례가 있겠습니다.", "10:00:00", "00:01:00");
  assert.strictEqual(rec1.text, "국민의례가 있겠습니다.");
  assert.strictEqual(rec1.isParagraphStart, false);

  // 침묵 기준 시간 초과 시뮬레이션 (새 문단 시작 플래그 확인)
  // Simulate pause threshold exceeded (check isParagraphStart flag)
  engine.lastRecordTime = Date.now() - 3000;
  const rec2 = engine.createRecord("모두 자리에 착석해 주십시오.", "10:00:05", "00:01:05");
  assert.strictEqual(rec2.isParagraphStart, true);

  // -------------------------------------------------------------
  // 테스트 3: 음성인식 점진적 갱신(STT progressive expansion) 검증
  // Test 3: Progressive STT streaming expansion verification
  // -------------------------------------------------------------
  engine.clear();

  /** @type {any} */
  let lastAddedCallbackRecord = null;
  /** @type {any} */
  let callbackRecordsList = null;
  engine.onRecordAdded = (rec, list) => {
    lastAddedCallbackRecord = rec;
    callbackRecordsList = list;
  };

  // 1) 첫 번째 발언 수집 / First utterance captured
  const r1 = engine.handleMutationText("   대한민국   국회는   ");
  assert.strictEqual(engine.records.length, 1);
  assert.strictEqual(engine.records[0].text, "대한민국 국회는");
  assert.strictEqual(r1.text, "대한민국 국회는");
  assert.strictEqual(lastAddedCallbackRecord.text, "대한민국 국회는");

  // 2) 발언 도중 텍스트 점진 확장 (시간 차이 작음, startsWith 만족)
  // Progressive expansion during speech (small time diff, startsWith matches)
  const r2 = engine.handleMutationText("대한민국 국회는 국민을 위해");
  assert.strictEqual(engine.records.length, 1, "점진 확장의 경우 새 레코드가 추가되지 않고 기존 레코드가 갱신되어야 함 / Record count should remain 1 on progressive expansion");
  assert.strictEqual(engine.records[0].text, "대한민국 국회는 국민을 위해");
  assert.strictEqual(r2.text, "대한민국 국회는 국민을 위해");
  assert.strictEqual(engine.lastLoggedText, "대한민국 국회는 국민을 위해");
  assert.strictEqual(lastAddedCallbackRecord.text, "대한민국 국회는 국민을 위해");

  // 3) 추가 점진 확장 / Further progressive expansion
  engine.handleMutationText("대한민국 국회는 국민을 위해 최선을 다합니다.");
  assert.strictEqual(engine.records.length, 1);
  assert.strictEqual(engine.records[0].text, "대한민국 국회는 국민을 위해 최선을 다합니다.");

  // 4) 동일 텍스트 재유입 시 무시 검증 / Identical text re-entry should be skipped
  const duplicateResult = engine.handleMutationText("대한민국 국회는 국민을 위해 최선을 다합니다.");
  assert.strictEqual(duplicateResult, null);
  assert.strictEqual(engine.records.length, 1);

  // 5) 침묵 기준 시간(2000ms) 경과 후 동일 접두사로 시작하는 새 문장 유입 시 분할 생성 검증
  // Verify new record is created when pauseThresholdMs is exceeded even if starting with same prefix
  engine.lastRecordTime = Date.now() - 2500;
  const r3 = engine.handleMutationText("대한민국 국회는 국민을 위해 최선을 다합니다. 다음 안건입니다.");
  assert.strictEqual(engine.records.length, 2, "침묵 시간 경과 후에는 새 레코드로 생성되어야 함 / Should append new record after pause threshold");
  assert.strictEqual(r3.isParagraphStart, true);
  assert.strictEqual(engine.records[1].text, "대한민국 국회는 국민을 위해 최선을 다합니다. 다음 안건입니다.");

  // -------------------------------------------------------------
  // 테스트 4: 저장소 복원 헬퍼 initRecords 검증
  // Test 4: Storage restoration helper initRecords
  // -------------------------------------------------------------
  const restoredEngine = new CaptionEngine({ pauseThresholdMs: 2000 });
  const fixedTimestamp = Date.now() - 10000;
  const mockSavedRecords = [
    {
      id: `${fixedTimestamp}-abcde`,
      text: "제1호 의안을 의결합니다.",
      timestamp: "14:00:00",
      playerTime: "00:10:00",
      date: "2026-10-27",
      isParagraphStart: false
    }
  ];

  restoredEngine.initRecords(mockSavedRecords);
  assert.strictEqual(restoredEngine.records.length, 1);
  assert.strictEqual(restoredEngine.lastLoggedText, "제1호 의안을 의결합니다.");
  assert.strictEqual(restoredEngine.lastRecordTime, fixedTimestamp);

  // 복원 직후 동일 텍스트 유입 시 중복 무시 확인 / Verify duplicate ignore after restoration
  assert.strictEqual(restoredEngine.handleMutationText("제1호 의안을 의결합니다."), null);

  // 복원 직후 점진 확장 텍스트 유입 시 (시간 갱신 후) 레코드 업데이트 확인
  // Verify progressive update on restored record when extended within pause threshold
  restoredEngine.lastRecordTime = Date.now();
  restoredEngine.handleMutationText("제1호 의안을 의결합니다. 가결되었음을 선포합니다.");
  assert.strictEqual(restoredEngine.records.length, 1);
  assert.strictEqual(restoredEngine.records[0].text, "제1호 의안을 의결합니다. 가결되었음을 선포합니다.");

  // 빈 배열로 초기화 시 상태 리셋 확인 / Verify state reset when initialized with empty array
  restoredEngine.initRecords([]);
  assert.strictEqual(restoredEngine.records.length, 0);
  assert.strictEqual(restoredEngine.lastLoggedText, "");
  assert.strictEqual(restoredEngine.lastRecordTime, 0);

  // -------------------------------------------------------------
  // 테스트 5: Mock DOM 환경에서 비디오 재생 시각, 컨테이너 검색, 디바운스 및 옵저버 수명주기 검증
  // Test 5: Video playback time, container lookup, debounce, and observer lifecycle in mock DOM
  // -------------------------------------------------------------
  const originalDocument = global.document;
  const originalMutationObserver = global.MutationObserver;

  try {
    let observedTarget = null;
    let observerOptions = null;
    let observerDisconnected = false;
    let observerCallback = null;
    let observeCalls = [];
    let disconnectCalls = 0;

    class MockMutationObserver {
      constructor(callback) {
        observerCallback = callback;
      }
      observe(target, options) {
        observedTarget = target;
        observerOptions = options;
        observeCalls.push({ target, options });
      }
      disconnect() {
        observerDisconnected = true;
        disconnectCalls++;
      }
    }

    const mockDiv = {
      innerText: "실시간 중계 자막 내용",
      textContent: "실시간 중계 자막 내용"
    };

    const mockVideo = {
      currentTime: 3665 // 01:01:05
    };

    const mockBody = { isBody: true };

    /** @type {any} */ (global).MutationObserver = MockMutationObserver;
    /** @type {any} */ (global).document = {
      body: mockBody,
      querySelector: (selector) => {
        if (selector === "video") return mockVideo;
        if (selector === "#viewSubtit .incont") return mockDiv;
        return null;
      }
    };

    const domEngine = new CaptionEngine({
      pauseThresholdMs: 1000,
      debounceMs: 25
    });

    assert.strictEqual(domEngine.extractPlayerTime(), "01:01:05");
    assert.strictEqual(domEngine.findCaptionContainer(), mockDiv);

    // 관찰 시작 / Start observing
    domEngine.startObserving();
    assert.strictEqual(observedTarget, mockDiv);
    assert.strictEqual(observerOptions.childList, true);
    assert.strictEqual(observerOptions.subtree, true);
    assert.strictEqual(observerOptions.characterData, true);

    // 디바운스 집약 검증: 연속해서 3회 옵저버 콜백 발생 / Verify debounce coalescing: trigger 3 rapid callbacks
    observerCallback();
    observerCallback();
    observerCallback();

    // 디바운스 만료 전에는 아직 처리되지 않아야 함 / Should not be processed before debounce expires
    assert.strictEqual(domEngine.records.length, 0);

    // 디바운스 대기 시간 초과 대기 / Wait for debounce to expire
    await sleep(40);
    assert.strictEqual(domEngine.records.length, 1);
    assert.strictEqual(domEngine.records[0].text, "실시간 중계 자막 내용");
    assert.strictEqual(domEngine.records[0].playerTime, "01:01:05");

    // -------------------------------------------------------------
    // 테스트 6: stopObserving() 시 디바운스 타이머 해제 및 메모리 누수 방지 검증
    // Test 6: Verify debounce timer cleanup and leak prevention on stopObserving()
    // -------------------------------------------------------------
    mockDiv.innerText = "중지 전 예약된 자막";
    mockDiv.textContent = "중지 전 예약된 자막";
    observerCallback(); // 디바운스 타이머 예약 / Schedule debounce timer
    assert.notStrictEqual(domEngine.debounceTimer, null);

    // 즉시 관찰 중지 호출 / Call stopObserving() immediately
    domEngine.stopObserving();
    assert.strictEqual(domEngine.debounceTimer, null, "stopObserving 시 디바운스 타이머가 null로 정리되어야 함 / debounceTimer should be cleared to null on stopObserving");
    assert.strictEqual(observerDisconnected, true);
    assert.strictEqual(domEngine.observer, null);

    // 디바운스 시간이 지나도 콜백이 실행되지 않아 레코드가 갱신되지 않음을 확인
    // Verify records remain unchanged even after debounce interval passes
    await sleep(40);
    assert.strictEqual(domEngine.records.length, 1);
    assert.strictEqual(domEngine.records[0].text, "실시간 중계 자막 내용");

    // -------------------------------------------------------------
    // 테스트 7: 초기 document.body 감시 후 자막 컨테이너 발견 시 관찰 대상 재지정 검증
    // Test 7: Verify observer retargeting from document.body to discovered container
    // -------------------------------------------------------------
    let containerMounted = false;
    const dynamicContainer = {
      innerText: "동적 탑재된 자막 엘리먼트",
      textContent: "동적 탑재된 자막 엘리먼트"
    };

    /** @type {any} */ (global).document.querySelector = (selector) => {
      if (selector === "video") return mockVideo;
      if (selector === "#viewSubtit .incont" && containerMounted) return dynamicContainer;
      return null;
    };

    observeCalls = [];
    disconnectCalls = 0;
    const retargetEngine = new CaptionEngine({
      pauseThresholdMs: 1000,
      debounceMs: 25
    });

    // 컨테이너가 아직 없으므로 document.body를 관찰 시작 / Start observing document.body since container is not mounted yet
    retargetEngine.startObserving();
    assert.strictEqual(retargetEngine.observedTarget, mockBody);
    assert.strictEqual(observeCalls.length, 1);
    assert.strictEqual(observeCalls[0].target, mockBody);

    // 동적으로 자막 컨테이너 생성 및 옵저버 이벤트 발생 시뮬레이션
    // Mount caption container dynamically and trigger observer mutation event
    containerMounted = true;
    observerCallback();

    // 디바운스 만료 대기 / Wait for debounce to complete
    await sleep(40);

    // 옵저버가 기존 body 연결을 해제하고 dynamicContainer로 재지정되었는지 검증
    // Verify observer disconnected from body and retargeted to dynamicContainer
    assert.strictEqual(retargetEngine.observedTarget, dynamicContainer);
    assert.strictEqual(retargetEngine.records.length, 1);
    assert.strictEqual(retargetEngine.records[0].text, "동적 탑재된 자막 엘리먼트");
    assert.strictEqual(observeCalls.length, 2);
    assert.strictEqual(observeCalls[1].target, dynamicContainer);

    retargetEngine.stopObserving();
  } finally {
    /** @type {any} */ (global).document = originalDocument;
    /** @type {any} */ (global).MutationObserver = originalMutationObserver;
  }

  // -------------------------------------------------------------
  // 테스트 8: clear() 호출 시 상태 및 디바운스 타이머 완전 초기화 검증
  // Test 8: Verify clear() completely resets records and internal state
  // -------------------------------------------------------------
  engine.clear();
  assert.strictEqual(engine.records.length, 0);
  assert.strictEqual(engine.lastLoggedText, "");
  assert.strictEqual(engine.lastRecordTime, 0);
  assert.strictEqual(engine.debounceTimer, null);

  console.log("Task 3 test passed!");
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
