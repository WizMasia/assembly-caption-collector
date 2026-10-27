# 국회 의사중계 실시간 자막 수집기 구현 계획 (Assembly Caption Collector Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 대한민국 국회 의사중계 웹페이지의 실시간 자막을 감지하여 듀얼 타임스탬프(PC시각/플레이어시각) 및 스마트 문단 분할과 함께 실시간 미리보기 및 TXT/MD 문서로 내보내는 크롬 확장 프로그램을 개발하고 GitHub 저장소에 배포합니다.

**Architecture:** 순수 바닐라 JS(Manifest V3) 기반의 모듈식 아키텍처로, 중앙 집중형 상수(`config/constants.js`), 견고한 자막 추출 코어(`content/caption-engine.js`), 런타임 메시징(`content/content.js`), 모던 프리미엄 팝업 UI(`popup/`), 문서 포맷터(`utils/export-formatter.js`)로 구성됩니다.

**Tech Stack:** Chrome Extension Manifest V3, Vanilla JavaScript (ES2022, Strict Mode, JSDoc Types), HTML5, CSS3 (Modern Flex/Grid, Custom Properties, Keyframe Animations), Node.js (테스트 러너).

---

### Task 1: 설정 및 상수 모듈 작성 (`config/constants.js`)

**Files:**
- Create: `config/constants.js`
- Test: `tests/constants.test.js`

- [ ] **Step 1: 실패하는 단위 테스트 작성**

```javascript
// tests/constants.test.js
const assert = require("node:assert");
const { CANDIDATE_SELECTORS, TIMING, TIMESTAMP_MODES, STORAGE_KEYS, I18N } = require("../config/constants.js");

assert.ok(Array.isArray(CANDIDATE_SELECTORS), "CANDIDATE_SELECTORS must be an array");
assert.ok(CANDIDATE_SELECTORS.includes("#viewSubtit .incont"), "Should include primary natv webcast selector");
assert.ok(TIMING.DEFAULT_PAUSE_THRESHOLD_MS > 0, "Default pause threshold should be positive");
assert.deepStrictEqual(Object.keys(TIMESTAMP_MODES), ["PC", "PLAYER", "BOTH"]);
assert.ok(I18N.ko && I18N.en, "Localization dictionaries must exist");
console.log("Task 1 test passed!");
```

- [ ] **Step 2: 테스트 실행하여 실패 확인**

Run: `node tests/constants.test.js`  
Expected: `Error: Cannot find module '../config/constants.js'`

- [ ] **Step 3: `config/constants.js` 구현**

```javascript
// config/constants.js
/**
 * @file constants.js
 * @description 국회 자막 수집기 중앙 상수 및 설정 정의
 * Centralized constants and configurations for Assembly Caption Collector
 */

/**
 * 자막 DOM 탐색 우선순위 후보군
 * Candidate CSS selectors for caption DOM containers
 */
const CANDIDATE_SELECTORS = Object.freeze([
  "#viewSubtit .incont",          // 국회인터넷의사중계 주 자막 영역
  "#viewSubtit",                 // 국회인터넷의사중계 자막 래퍼
  ".vjs-text-track-display",      // Video.js 자막 트랙 디스플레이
  ".caption_box",                 // 일반 캡션 박스
  "#captionText",                 // 캡션 텍스트 엘리먼트
  ".player-subtitles",            // 플레이어 서브타이틀
  ".caption_area",                // 캡션 영역
  "[class*='caption']",           // 클래스명에 caption 포함
  "[id*='caption']"               // ID에 caption 포함
]);

/**
 * 시간 및 갱신 주기 관련 상수
 * Timing & threshold configurations
 */
const TIMING = Object.freeze({
  DEFAULT_PAUSE_THRESHOLD_MS: 3000, // 새 문단 분할 기준 침묵 시간 (3초)
  DEBOUNCE_MUTATION_MS: 80,          // DOM 변경 디바운스 대기 시간 (80ms)
  PREVIEW_MAX_ITEMS: 30              // 팝업 실시간 미리보기 최대 표시 개수
});

/**
 * 타임스탬프 표기 모드
 * Timestamp display modes
 */
const TIMESTAMP_MODES = Object.freeze({
  PC: "pc",         // PC 절대 시각 (10:15:30)
  PLAYER: "player", // 플레이어 상대 재생 시각 (00:15:30)
  BOTH: "both"      // 둘 다 병기 ([10:15:30 | 00:15:30])
});

/**
 * 크롬 로컬 스토리지 키
 * Chrome local storage keys
 */
const STORAGE_KEYS = Object.freeze({
  RECORDS: "assembly_caption_records",
  IS_RECORDING: "assembly_is_recording",
  CUSTOM_SELECTOR: "assembly_custom_selector",
  TIMESTAMP_MODE: "assembly_timestamp_mode",
  PAUSE_THRESHOLD_MS: "assembly_pause_threshold_ms"
});

/**
 * 다국어 UI 레이블
 * Localized UI strings
 */
const I18N = Object.freeze({
  ko: {
    appTitle: "국회 의사중계 자막 수집기",
    statusRecording: "수집 중",
    statusStopped: "대기 중",
    startRecord: "수집 시작",
    stopRecord: "수집 중지",
    copyAll: "전체 복사",
    copySuccess: "클립보드에 복사되었습니다.",
    clearRecords: "기록 비우기",
    clearConfirm: "수집된 모든 자막 기록을 초기화하시겠습니까?",
    downloadTxt: "TXT 다운로드",
    downloadMd: "MD 다운로드",
    noData: "수집된 자막이 없습니다.",
    emptyPreview: "아직 수집된 자막이 없습니다. 수집을 시작해 보세요.",
    settings: "상세 설정",
    tsModeLabel: "타임스탬프 방식:",
    pauseThresholdLabel: "문단 분할 침묵 기준(초):",
    customSelectorLabel: "수동 자막 엘리먼트 선택자 (선택):",
    customSelectorPlaceholder: "#viewSubtit .incont 등"
  },
  en: {
    appTitle: "Assembly Caption Collector",
    statusRecording: "RECORDING",
    statusStopped: "STOPPED",
    startRecord: "Start",
    stopRecord: "Stop",
    copyAll: "Copy All",
    copySuccess: "Copied to clipboard.",
    clearRecords: "Clear All",
    clearConfirm: "Are you sure you want to clear all recorded subtitles?",
    downloadTxt: "TXT",
    downloadMd: "Markdown",
    noData: "No subtitles recorded.",
    emptyPreview: "No subtitles captured yet. Start recording.",
    settings: "Settings",
    tsModeLabel: "Timestamp Mode:",
    pauseThresholdLabel: "Pause Split Threshold (sec):",
    customSelectorLabel: "Custom Selector (Optional):",
    customSelectorPlaceholder: "e.g. #viewSubtit .incont"
  }
});

// 브라우저 및 Node.js 환경 동시 지원 (CommonJS / ES Window Global)
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    CANDIDATE_SELECTORS,
    TIMING,
    TIMESTAMP_MODES,
    STORAGE_KEYS,
    I18N
  };
} else {
  window.AssemblyConstants = {
    CANDIDATE_SELECTORS,
    TIMING,
    TIMESTAMP_MODES,
    STORAGE_KEYS,
    I18N
  };
}
```

- [ ] **Step 4: 테스트 실행하여 통과 확인**

Run: `node tests/constants.test.js`  
Expected: `Task 1 test passed!`

- [ ] **Step 5: Git 커밋**

```bash
git add config/constants.js tests/constants.test.js
git commit -m "feat: 상수 및 설정 모듈 작성 (config/constants.js)"
```

---

### Task 2: 내보내기 포맷터 모듈 작성 (`utils/export-formatter.js`)

**Files:**
- Create: `utils/export-formatter.js`
- Test: `tests/export-formatter.test.js`

- [ ] **Step 1: 실패하는 단위 테스트 작성**

```javascript
// tests/export-formatter.test.js
const assert = require("node:assert");
const { formatTimestamp, formatToText, formatToMarkdown } = require("../utils/export-formatter.js");

const dummyRecords = [
  {
    id: "1",
    timestamp: "10:00:00",
    playerTime: "00:05:10",
    date: "2026-10-27",
    text: "의사일정 제1항을 상정합니다.",
    isParagraphStart: false
  },
  {
    id: "2",
    timestamp: "10:00:08",
    playerTime: "00:05:18",
    date: "2026-10-27",
    text: "제안설명을 듣도록 하겠습니다.",
    isParagraphStart: true
  }
];

// Test timestamp formatting
assert.strictEqual(formatTimestamp("10:00:00", "00:05:10", "pc"), "10:00:00");
assert.strictEqual(formatTimestamp("10:00:00", "00:05:10", "player"), "00:05:10");
assert.strictEqual(formatTimestamp("10:00:00", "00:05:10", "both"), "10:00:00 | 재생 00:05:10");

// Test Text formatting
const txt = formatToText(dummyRecords, "제410회 국회 본회의", "both");
assert.ok(txt.includes("[제410회 국회 본회의]"), "Must contain title");
assert.ok(txt.includes("의사일정 제1항"), "Must contain records");

// Test Markdown formatting
const md = formatToMarkdown(dummyRecords, "제410회 국회 본회의", "both");
assert.ok(md.startsWith("# 제410회 국회 본회의"), "Must start with H1 title");
assert.ok(md.includes("총 문장 수: 2"), "Must show count");

console.log("Task 2 test passed!");
```

- [ ] **Step 2: 테스트 실행하여 실패 확인**

Run: `node tests/export-formatter.test.js`  
Expected: `Error: Cannot find module '../utils/export-formatter.js'`

- [ ] **Step 3: `utils/export-formatter.js` 구현**

```javascript
// utils/export-formatter.js
/**
 * @file export-formatter.js
 * @description 자막 레코드를 TXT 및 Markdown 문서로 변환하는 포맷터
 * Subtitle export formatter for TXT and Markdown outputs
 */

/**
 * 타임스탬프 문자열 구성
 * Formats timestamp based on selected mode
 * @param {string} pcTime - PC 절대 시각 (HH:mm:ss)
 * @param {string|null} playerTime - 영상 재생 시각 (HH:mm:ss 또는 mm:ss)
 * @param {'pc'|'player'|'both'} mode - 표기 모드
 * @returns {string} 포맷팅된 타임스탬프
 */
function formatTimestamp(pcTime, playerTime, mode = "both") {
  if (mode === "player" && playerTime) {
    return playerTime;
  }
  if (mode === "both" && playerTime) {
    return `${pcTime} | 재생 ${playerTime}`;
  }
  return pcTime || playerTime || "-";
}

/**
 * 초 단위 숫자를 HH:mm:ss 또는 mm:ss로 변환
 * Converts seconds into HH:mm:ss format
 * @param {number} totalSeconds
 * @returns {string}
 */
function formatSecondsToTime(totalSeconds) {
  if (typeof totalSeconds !== "number" || isNaN(totalSeconds) || totalSeconds < 0) {
    return "00:00";
  }
  const sec = Math.floor(totalSeconds % 60);
  const min = Math.floor((totalSeconds / 60) % 60);
  const hour = Math.floor(totalSeconds / 3600);

  const pad = (n) => String(n).padStart(2, "0");
  if (hour > 0) {
    return `${pad(hour)}:${pad(min)}:${pad(sec)}`;
  }
  return `${pad(min)}:${pad(sec)}`;
}

/**
 * TXT 파일 텍스트 생성
 * Generates plain text export content
 * @param {Array<Object>} records - 자막 목록
 * @param {string} title - 회의명 / 웹페이지 타이틀
 * @param {'pc'|'player'|'both'} timestampMode - 타임스탬프 모드
 * @returns {string}
 */
function formatToText(records, title = "국회_의사중계_자막", timestampMode = "both") {
  if (!records || records.length === 0) return "";

  const dateStr = new Date().toISOString().slice(0, 10);
  const header = `[${title}] - ${dateStr}\n총 ${records.length}개 문장 수집\n${"=".repeat(50)}\n\n`;

  const body = records.map((item, idx) => {
    const ts = formatTimestamp(item.timestamp, item.playerTime, timestampMode);
    const prefix = item.isParagraphStart && idx > 0 ? "\n" : "";
    return `${prefix}[${ts}] ${item.text}`;
  }).join("\n");

  return header + body;
}

/**
 * Markdown 파일 텍스트 생성
 * Generates Markdown export content
 * @param {Array<Object>} records - 자막 목록
 * @param {string} title - 회의명 / 웹페이지 타이틀
 * @param {'pc'|'player'|'both'} timestampMode - 타임스탬프 모드
 * @returns {string}
 */
function formatToMarkdown(records, title = "국회 의사중계 자막 기록", timestampMode = "both") {
  if (!records || records.length === 0) return "";

  const dateStr = new Date().toISOString().slice(0, 10);
  let md = `# ${title}\n\n`;
  md += `- **수집 일자 (Date)**: ${dateStr}\n`;
  md += `- **총 문장 수 (Count)**: ${records.length}\n`;
  md += `- **타임스탬프 모드 (Mode)**: ${timestampMode}\n\n`;
  md += `---\n\n`;

  records.forEach((item, idx) => {
    const ts = formatTimestamp(item.timestamp, item.playerTime, timestampMode);
    if (item.isParagraphStart && idx > 0) {
      md += `\n---\n\n`;
    }
    md += `* **[${ts}]** ${item.text}\n\n`;
  });

  return md;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    formatTimestamp,
    formatSecondsToTime,
    formatToText,
    formatToMarkdown
  };
} else {
  window.AssemblyExportFormatter = {
    formatTimestamp,
    formatSecondsToTime,
    formatToText,
    formatToMarkdown
  };
}
```

- [ ] **Step 4: 테스트 실행하여 통과 확인**

Run: `node tests/export-formatter.test.js`  
Expected: `Task 2 test passed!`

- [ ] **Step 5: Git 커밋**

```bash
git add utils/export-formatter.js tests/export-formatter.test.js
git commit -m "feat: 문서 포맷터 모듈 작성 (utils/export-formatter.js)"
```

---

### Task 3: 실시간 자막 감지 엔진 작성 (`content/caption-engine.js`)

**Files:**
- Create: `content/caption-engine.js`
- Test: `tests/caption-engine.test.js`

- [ ] **Step 1: 실패하는 단위 테스트 작성 (Mock DOM 환경)**

```javascript
// tests/caption-engine.test.js
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

console.log("Task 3 test passed!");
```

- [ ] **Step 2: 테스트 실행하여 실패 확인**

Run: `node tests/caption-engine.test.js`  
Expected: `Error: Cannot find module '../content/caption-engine.js'`

- [ ] **Step 3: `content/caption-engine.js` 구현**

```javascript
// content/caption-engine.js
/**
 * @file caption-engine.js
 * @description 실시간 국회 자막 감지, 중복 필터링 및 단락 분할 코어 엔진
 * Real-time caption detection, deduplication, and paragraph splitting engine
 */

class CaptionEngine {
  /**
   * @param {Object} options
   * @param {Array<string>} [options.candidateSelectors]
   * @param {number} [options.pauseThresholdMs]
   */
  constructor(options = {}) {
    this.candidateSelectors = options.candidateSelectors || [
      "#viewSubtit .incont",
      "#viewSubtit",
      ".vjs-text-track-display",
      ".caption_box",
      "#captionText"
    ];
    this.pauseThresholdMs = options.pauseThresholdMs || 3000;
    this.customSelector = "";

    /** @type {Array<Object>} */
    this.records = [];
    this.lastLoggedText = "";
    this.lastRecordTime = 0;
    this.observer = null;
    this.onRecordAdded = null; // Callback
  }

  /**
   * 텍스트 공백 정규화
   * Normalizes redundant whitespaces
   * @param {string} text
   * @returns {string}
   */
  cleanText(text) {
    if (!text || typeof text !== "string") return "";
    return text.replace(/\s+/g, " ").trim();
  }

  /**
   * 중복 문장 검사
   * Checks if incoming text is duplicate or partial repetition
   * @param {string} currentText
   * @param {string} lastText
   * @returns {boolean}
   */
  isDuplicate(currentText, lastText) {
    if (!currentText) return true;
    if (currentText === lastText) return true;
    // 직전 문장이 현재 문장의 시작 부분이며 더 짧은 경우 (음성인식 점진 갱신)
    if (lastText && lastText.startsWith(currentText)) return true;
    return false;
  }

  /**
   * DOM 내 비디오 태그로부터 현재 재생 시각 추출
   * Extracts current video playback time in seconds
   * @returns {string|null}
   */
  extractPlayerTime() {
    try {
      if (typeof document === "undefined") return null;
      const video = document.querySelector("video");
      if (!video || typeof video.currentTime !== "number" || isNaN(video.currentTime)) {
        return null;
      }
      const sec = video.currentTime;
      const s = Math.floor(sec % 60);
      const m = Math.floor((sec / 60) % 60);
      const h = Math.floor(sec / 3600);
      const pad = (n) => String(n).padStart(2, "0");
      return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
    } catch (_) {
      return null;
    }
  }

  /**
   * 새로운 자막 레코드 객체 생성
   * Creates a structured subtitle record
   * @param {string} cleanText
   * @param {string} [customTimestamp]
   * @param {string|null} [customPlayerTime]
   * @returns {Object}
   */
  createRecord(cleanText, customTimestamp = null, customPlayerTime = null) {
    const now = new Date();
    const pcTimestamp = customTimestamp || now.toLocaleTimeString("ko-KR", { hour12: false });
    const playerTime = customPlayerTime !== undefined ? customPlayerTime : this.extractPlayerTime();
    const currentTimeMs = Date.now();

    // 직전 수집 시각과 비교하여 침묵 텀(pause threshold) 초과 시 새 문단 플래그 지정
    const isParagraphStart = this.lastRecordTime > 0 &&
      (currentTimeMs - this.lastRecordTime) >= this.pauseThresholdMs;

    const record = {
      id: `${currentTimeMs}-${Math.random().toString(36).slice(2, 7)}`,
      text: cleanText,
      timestamp: pcTimestamp,
      playerTime: playerTime,
      date: now.toISOString().slice(0, 10),
      isParagraphStart: isParagraphStart
    };

    this.lastRecordTime = currentTimeMs;
    return record;
  }

  /**
   * 대상 자막 DOM 컨테이너 탐색
   * Finds target caption DOM element
   * @returns {Element|null}
   */
  findCaptionContainer() {
    if (typeof document === "undefined") return null;
    if (this.customSelector) {
      const el = document.querySelector(this.customSelector);
      if (el) return el;
    }
    for (const selector of this.candidateSelectors) {
      const el = document.querySelector(selector);
      if (el) return el;
    }
    return null;
  }

  /**
   * DOM 변경 감지 이벤트 핸들러
   * Handles caption mutation events
   * @param {string} rawText
   */
  handleMutationText(rawText) {
    const clean = this.cleanText(rawText);
    if (!clean || this.isDuplicate(clean, this.lastLoggedText)) {
      return;
    }

    const record = this.createRecord(clean);
    this.records.push(record);
    this.lastLoggedText = clean;

    if (typeof this.onRecordAdded === "function") {
      this.onRecordAdded(record, this.records);
    }
  }

  /**
   * MutationObserver 감시 시작
   * Starts observing caption DOM mutations
   */
  startObserving() {
    this.stopObserving();
    if (typeof document === "undefined") return;

    const target = this.findCaptionContainer() || document.body;
    this.observer = new MutationObserver(() => {
      const container = this.findCaptionContainer();
      if (container) {
        const text = container.innerText || container.textContent || "";
        this.handleMutationText(text);
      }
    });

    this.observer.observe(target, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }

  /**
   * 감시 중단
   * Stops observing
   */
  stopObserving() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
  }

  /**
   * 전체 기록 초기화
   * Clears in-memory records
   */
  clear() {
    this.records = [];
    this.lastLoggedText = "";
    this.lastRecordTime = 0;
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { CaptionEngine };
} else {
  window.AssemblyCaptionEngine = CaptionEngine;
}
```

- [ ] **Step 4: 테스트 실행하여 통과 확인**

Run: `node tests/caption-engine.test.js`  
Expected: `Task 3 test passed!`

- [ ] **Step 5: Git 커밋**

```bash
git add content/caption-engine.js tests/caption-engine.test.js
git commit -m "feat: 자막 감지 및 중복 필터링 엔진 작성 (content/caption-engine.js)"
```

---

### Task 4: Content Script 통합 메인 모듈 (`content/content.js`)

**Files:**
- Create: `content/content.js`

- [ ] **Step 1: `content/content.js` 작성**

```javascript
// content/content.js
/**
 * @file content.js
 * @description 국회 의사중계 웹페이지 주입 Content Script (팝업 통신 및 스토리지 연동)
 * Content script injecting into Assembly webcast pages
 */

(function () {
  if (window.__natvCaptionCollectorLoaded) return;
  window.__natvCaptionCollectorLoaded = true;

  const Constants = window.AssemblyConstants || {};
  const STORAGE_KEYS = Constants.STORAGE_KEYS || {
    RECORDS: "assembly_caption_records",
    IS_RECORDING: "assembly_is_recording",
    CUSTOM_SELECTOR: "assembly_custom_selector",
    TIMESTAMP_MODE: "assembly_timestamp_mode",
    PAUSE_THRESHOLD_MS: "assembly_pause_threshold_ms"
  };

  const CaptionEngineClass = window.AssemblyCaptionEngine;
  if (!CaptionEngineClass) {
    console.error("[Assembly Collector] CaptionEngine not loaded.");
    return;
  }

  const engine = new CaptionEngineClass({
    candidateSelectors: Constants.CANDIDATE_SELECTORS,
    pauseThresholdMs: Constants.TIMING?.DEFAULT_PAUSE_THRESHOLD_MS || 3000
  });

  let isRecording = false;

  // 1. 로컬 스토리지 상태 동기화 복원
  chrome.storage.local.get([
    STORAGE_KEYS.RECORDS,
    STORAGE_KEYS.IS_RECORDING,
    STORAGE_KEYS.CUSTOM_SELECTOR,
    STORAGE_KEYS.PAUSE_THRESHOLD_MS
  ], (data) => {
    if (data[STORAGE_KEYS.RECORDS]) {
      engine.records = data[STORAGE_KEYS.RECORDS];
    }
    if (data[STORAGE_KEYS.CUSTOM_SELECTOR]) {
      engine.customSelector = data[STORAGE_KEYS.CUSTOM_SELECTOR];
    }
    if (data[STORAGE_KEYS.PAUSE_THRESHOLD_MS]) {
      engine.pauseThresholdMs = data[STORAGE_KEYS.PAUSE_THRESHOLD_MS];
    }

    if (data[STORAGE_KEYS.IS_RECORDING]) {
      startRecording();
    }
  });

  // 자막 수집 시 스토리지 저장 콜백
  engine.onRecordAdded = (record, allRecords) => {
    chrome.storage.local.set({ [STORAGE_KEYS.RECORDS]: allRecords });
  };

  function startRecording() {
    isRecording = true;
    engine.startObserving();
    chrome.storage.local.set({ [STORAGE_KEYS.IS_RECORDING]: true });
  }

  function stopRecording() {
    isRecording = false;
    engine.stopObserving();
    chrome.storage.local.set({ [STORAGE_KEYS.IS_RECORDING]: false });
  }

  // 팝업 및 확장 런타임 메시지 처리
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    switch (request.action) {
      case "GET_STATUS":
        sendResponse({
          isRecording: isRecording,
          records: engine.records,
          customSelector: engine.customSelector,
          pauseThresholdMs: engine.pauseThresholdMs,
          title: document.title
        });
        break;

      case "TOGGLE_RECORDING":
        if (request.customSelector !== undefined) {
          engine.customSelector = request.customSelector;
          chrome.storage.local.set({ [STORAGE_KEYS.CUSTOM_SELECTOR]: engine.customSelector });
        }
        if (request.pauseThresholdMs !== undefined) {
          engine.pauseThresholdMs = request.pauseThresholdMs;
          chrome.storage.local.set({ [STORAGE_KEYS.PAUSE_THRESHOLD_MS]: engine.pauseThresholdMs });
        }

        if (isRecording) {
          stopRecording();
        } else {
          startRecording();
        }

        sendResponse({
          isRecording: isRecording,
          records: engine.records,
          customSelector: engine.customSelector
        });
        break;

      case "UPDATE_CONFIG":
        if (request.customSelector !== undefined) {
          engine.customSelector = request.customSelector;
          chrome.storage.local.set({ [STORAGE_KEYS.CUSTOM_SELECTOR]: engine.customSelector });
          if (isRecording) engine.startObserving();
        }
        if (request.pauseThresholdMs !== undefined) {
          engine.pauseThresholdMs = request.pauseThresholdMs;
          chrome.storage.local.set({ [STORAGE_KEYS.PAUSE_THRESHOLD_MS]: engine.pauseThresholdMs });
        }
        sendResponse({ success: true });
        break;

      case "CLEAR_DATA":
        engine.clear();
        chrome.storage.local.set({ [STORAGE_KEYS.RECORDS]: [] }, () => {
          sendResponse({
            isRecording: isRecording,
            records: [],
            customSelector: engine.customSelector
          });
        });
        return true; // 비동기 응답 플래그
    }
    return true;
  });
})();
```

- [ ] **Step 2: 파일 생성 및 문법 검증**

Run: `node -c content/content.js`  
Expected: 무출력 (Syntax OK)

- [ ] **Step 3: Git 커밋**

```bash
git add content/content.js
git commit -m "feat: Content Script 통합 모듈 작성 (content/content.js)"
```

---

### Task 5: 팝업 UI 마크업 및 스타일링 (`popup/popup.html`, `popup/popup.css`)

**Files:**
- Create: `popup/popup.html`
- Create: `popup/popup.css`

- [ ] **Step 1: `popup/popup.html` 작성**

```html
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>국회 자막 수집기</title>
  <link rel="stylesheet" href="popup.css">
</head>
<body>
  <div class="app-container">
    <!-- Header -->
    <header class="app-header">
      <div class="logo-group">
        <div class="logo-icon">🏛️</div>
        <h1 class="logo-title" id="txtAppTitle">국회 자막 수집기</h1>
      </div>
      <div id="statusBadge" class="status-badge status-stopped">
        <span class="status-dot"></span>
        <span id="txtStatus" class="status-text">대기 중</span>
      </div>
    </header>

    <!-- Stats Card -->
    <section class="stats-card">
      <div class="stat-item">
        <span class="stat-label">수집 문장</span>
        <strong id="itemCount" class="stat-value">0</strong>
      </div>
      <div class="stat-divider"></div>
      <div class="stat-item">
        <span class="stat-label">최근 수집</span>
        <span id="lastTime" class="stat-value-sub">-</span>
      </div>
    </section>

    <!-- Live Preview Stream -->
    <section class="preview-section">
      <div class="section-header">
        <span class="section-title">실시간 자막 스트림</span>
        <button id="copyAllBtn" class="btn-icon" title="전체 복사">📋 복사</button>
      </div>
      <div id="previewList" class="preview-list">
        <div class="empty-state" id="emptyNotice">아직 수집된 자막이 없습니다.</div>
      </div>
    </section>

    <!-- Control Buttons -->
    <section class="actions-section">
      <div class="button-row">
        <button id="toggleBtn" class="btn btn-primary">
          <span class="btn-icon-symbol">▶</span>
          <span id="txtToggle">수집 시작</span>
        </button>
        <button id="clearBtn" class="btn btn-secondary">
          <span>기록 비우기</span>
        </button>
      </div>

      <div class="button-row">
        <button id="downloadTxtBtn" class="btn btn-outline">
          <span>TXT 다운로드</span>
        </button>
        <button id="downloadMdBtn" class="btn btn-outline">
          <span>Markdown 다운로드</span>
        </button>
      </div>
    </section>

    <!-- Settings Accordion -->
    <details class="settings-accordion">
      <summary class="settings-summary">⚙️ 상세 설정 (타임스탬프 / 셀렉터)</summary>
      <div class="settings-body">
        <div class="form-group">
          <label for="timestampModeSelect">타임스탬프 형식</label>
          <select id="timestampModeSelect" class="form-select">
            <option value="both">PC 시각 + 영상 시각 병기 (추천)</option>
            <option value="pc">PC 절대 시각만</option>
            <option value="player">영상 재생 시각만</option>
          </select>
        </div>

        <div class="form-group">
          <label for="pauseThresholdInput">문단 분할 침묵 기준 (초)</label>
          <input type="number" id="pauseThresholdInput" class="form-input" min="1" max="30" value="3">
        </div>

        <div class="form-group">
          <label for="selectorInput">수동 CSS 선택자 (기본 감지 실패 시)</label>
          <input type="text" id="selectorInput" class="form-input" placeholder="#viewSubtit .incont">
        </div>
      </div>
    </details>

    <div id="toast" class="toast">클립보드에 복사되었습니다.</div>
  </div>

  <script src="../config/constants.js"></script>
  <script src="../utils/export-formatter.js"></script>
  <script src="popup.js"></script>
</body>
</html>
```

- [ ] **Step 2: `popup/popup.css` 작성**

```css
/* popup/popup.css */
:root {
  --bg-color: #f8fafc;
  --surface-color: #ffffff;
  --text-main: #0f172a;
  --text-sub: #64748b;
  --primary-color: #2563eb;
  --primary-hover: #1d4ed8;
  --danger-color: #ef4444;
  --danger-hover: #dc2626;
  --success-color: #10b981;
  --border-color: #e2e8f0;
  --radius-md: 10px;
  --radius-sm: 6px;
  --shadow-sm: 0 1px 3px rgba(0,0,0,0.06);
  --font-family: -apple-system, BlinkMacSystemFont, "Pretendard", "Segoe UI", Roboto, sans-serif;
}

body {
  margin: 0;
  padding: 0;
  width: 360px;
  font-family: var(--font-family);
  background-color: var(--bg-color);
  color: var(--text-main);
  box-sizing: border-box;
}

.app-container {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* Header */
.app-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.logo-group {
  display: flex;
  align-items: center;
  gap: 6px;
}

.logo-icon {
  font-size: 18px;
}

.logo-title {
  font-size: 15px;
  font-weight: 700;
  margin: 0;
  color: var(--text-main);
}

/* Status Badge */
.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 8px;
  border-radius: 20px;
  font-size: 11px;
  font-weight: 600;
  transition: all 0.2s ease;
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.status-stopped {
  background-color: #e2e8f0;
  color: #64748b;
}
.status-stopped .status-dot {
  background-color: #94a3b8;
}

.status-recording {
  background-color: #d1fae5;
  color: #065f46;
}
.status-recording .status-dot {
  background-color: var(--success-color);
  box-shadow: 0 0 6px var(--success-color);
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0% { transform: scale(0.9); opacity: 0.8; }
  50% { transform: scale(1.3); opacity: 1; }
  100% { transform: scale(0.9); opacity: 0.8; }
}

/* Stats Card */
.stats-card {
  background: var(--surface-color);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 10px 14px;
  display: flex;
  align-items: center;
  box-shadow: var(--shadow-sm);
}

.stat-item {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.stat-label {
  font-size: 11px;
  color: var(--text-sub);
}

.stat-value {
  font-size: 17px;
  font-weight: 700;
  color: var(--primary-color);
}

.stat-value-sub {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-main);
}

.stat-divider {
  width: 1px;
  height: 28px;
  background-color: var(--border-color);
  margin: 0 10px;
}

/* Preview Section */
.preview-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.section-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-sub);
}

.btn-icon {
  background: none;
  border: none;
  font-size: 11px;
  color: var(--primary-color);
  cursor: pointer;
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  font-weight: 600;
}
.btn-icon:hover {
  background-color: #eff6ff;
}

.preview-list {
  background: var(--surface-color);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  height: 140px;
  overflow-y: auto;
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.empty-state {
  margin: auto;
  font-size: 12px;
  color: var(--text-sub);
  text-align: center;
}

.preview-item {
  font-size: 12px;
  line-height: 1.4;
  padding: 4px 6px;
  border-radius: var(--radius-sm);
  background-color: #f8fafc;
  border-left: 3px solid #cbd5e1;
}

.preview-item.para-start {
  border-left-color: var(--primary-color);
  margin-top: 4px;
}

.preview-meta {
  font-size: 10px;
  color: var(--text-sub);
  margin-bottom: 2px;
  display: flex;
  gap: 4px;
}

.preview-text {
  color: var(--text-main);
  word-break: break-all;
}

/* Actions Section */
.actions-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.button-row {
  display: flex;
  gap: 6px;
}

.btn {
  flex: 1;
  padding: 9px 12px;
  font-size: 13px;
  font-weight: 600;
  border-radius: var(--radius-sm);
  border: 1px solid transparent;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  transition: all 0.15s ease-in-out;
}

.btn-primary {
  background-color: var(--primary-color);
  color: #fff;
}
.btn-primary:hover {
  background-color: var(--primary-hover);
}

.btn-danger {
  background-color: var(--danger-color);
  color: #fff;
}
.btn-danger:hover {
  background-color: var(--danger-hover);
}

.btn-secondary {
  background-color: #f1f5f9;
  border-color: #cbd5e1;
  color: #334155;
}
.btn-secondary:hover {
  background-color: #e2e8f0;
}

.btn-outline {
  background-color: #fff;
  border-color: #cbd5e1;
  color: #334155;
  font-size: 12px;
}
.btn-outline:hover {
  background-color: #f8fafc;
  border-color: #94a3b8;
}

/* Settings Accordion */
.settings-accordion {
  border-top: 1px solid var(--border-color);
  padding-top: 8px;
}

.settings-summary {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-sub);
  cursor: pointer;
  user-select: none;
}

.settings-body {
  padding-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.form-group label {
  font-size: 11px;
  color: var(--text-sub);
}

.form-select, .form-input {
  padding: 6px 8px;
  font-size: 12px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background-color: #fff;
  color: var(--text-main);
  outline: none;
}
.form-select:focus, .form-input:focus {
  border-color: var(--primary-color);
}

/* Toast Notification */
.toast {
  position: fixed;
  bottom: 12px;
  left: 50%;
  transform: translateX(-50%) translateY(50px);
  background-color: rgba(15, 23, 42, 0.9);
  color: #fff;
  padding: 6px 14px;
  border-radius: 20px;
  font-size: 12px;
  pointer-events: none;
  opacity: 0;
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
}

.toast.show {
  transform: translateX(-50%) translateY(0);
  opacity: 1;
}
```

- [ ] **Step 3: Git 커밋**

```bash
git add popup/popup.html popup/popup.css
git commit -m "feat: 팝업 UI 레이아웃 및 스타일링 작성 (popup/popup.html, popup/popup.css)"
```

---

### Task 6: 팝업 스크립트 모듈 구현 (`popup/popup.js`)

**Files:**
- Create: `popup/popup.js`

- [ ] **Step 1: `popup/popup.js` 작성**

```javascript
// popup/popup.js
/**
 * @file popup.js
 * @description 팝업 인터랙션, 실시간 프리뷰 렌더링, 다운로드 및 설정 제어
 * Popup controller for Assembly Caption Collector
 */

document.addEventListener("DOMContentLoaded", async () => {
  const Constants = window.AssemblyConstants || {};
  const Formatter = window.AssemblyExportFormatter || {};
  const STORAGE_KEYS = Constants.STORAGE_KEYS || {};

  // DOM Elements
  const statusBadge = document.getElementById("statusBadge");
  const txtStatus = document.getElementById("txtStatus");
  const itemCountEl = document.getElementById("itemCount");
  const lastTimeEl = document.getElementById("lastTime");
  const previewList = document.getElementById("previewList");
  const emptyNotice = document.getElementById("emptyNotice");
  const toggleBtn = document.getElementById("toggleBtn");
  const txtToggle = document.getElementById("txtToggle");
  const clearBtn = document.getElementById("clearBtn");
  const downloadTxtBtn = document.getElementById("downloadTxtBtn");
  const downloadMdBtn = document.getElementById("downloadMdBtn");
  const copyAllBtn = document.getElementById("copyAllBtn");
  const timestampModeSelect = document.getElementById("timestampModeSelect");
  const pauseThresholdInput = document.getElementById("pauseThresholdInput");
  const selectorInput = document.getElementById("selectorInput");
  const toast = document.getElementById("toast");

  let [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  let currentRecords = [];
  let pageTitle = "국회 의사중계 자막 기록";

  function showToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("show");
    setTimeout(() => {
      toast.classList.remove("show");
    }, 2000);
  }

  function renderPreview(records, tsMode) {
    previewList.innerHTML = "";
    if (!records || records.length === 0) {
      previewList.appendChild(emptyNotice);
      return;
    }

    // 최근 30개만 표시
    const slice = records.slice(-30);
    slice.forEach((item) => {
      const itemEl = document.createElement("div");
      itemEl.className = `preview-item ${item.isParagraphStart ? "para-start" : ""}`;

      const metaEl = document.createElement("div");
      metaEl.className = "preview-meta";
      const tsText = Formatter.formatTimestamp ? Formatter.formatTimestamp(item.timestamp, item.playerTime, tsMode) : item.timestamp;
      metaEl.textContent = `[${tsText}]`;

      const textEl = document.createElement("div");
      textEl.className = "preview-text";
      textEl.textContent = item.text;

      itemEl.appendChild(metaEl);
      itemEl.appendChild(textEl);
      previewList.appendChild(itemEl);
    });

    // 자동 스크롤 맨 아래로 이동
    previewList.scrollTop = previewList.scrollHeight;
  }

  function updateUI(state) {
    if (!state) return;
    const isRecording = Boolean(state.isRecording);
    currentRecords = state.records || [];
    if (state.title) pageTitle = state.title;

    // Toggle button & Status badge
    if (isRecording) {
      txtToggle.textContent = "수집 중지";
      toggleBtn.className = "btn btn-danger";
      statusBadge.className = "status-badge status-recording";
      txtStatus.textContent = "수집 중";
    } else {
      txtToggle.textContent = "수집 시작";
      toggleBtn.className = "btn btn-primary";
      statusBadge.className = "status-badge status-stopped";
      txtStatus.textContent = "대기 중";
    }

    itemCountEl.textContent = currentRecords.length;
    lastTimeEl.textContent = currentRecords.length
      ? currentRecords[currentRecords.length - 1].timestamp
      : "-";

    const tsMode = timestampModeSelect.value || "both";
    renderPreview(currentRecords, tsMode);

    if (state.customSelector !== undefined) {
      selectorInput.value = state.customSelector;
    }
    if (state.pauseThresholdMs !== undefined) {
      pauseThresholdInput.value = Math.round(state.pauseThresholdMs / 1000);
    }
  }

  // 1. 스토리지 기반 초기 상태 로드
  chrome.storage.local.get([
    STORAGE_KEYS.RECORDS,
    STORAGE_KEYS.IS_RECORDING,
    STORAGE_KEYS.CUSTOM_SELECTOR,
    STORAGE_KEYS.TIMESTAMP_MODE,
    STORAGE_KEYS.PAUSE_THRESHOLD_MS
  ], (data) => {
    if (data[STORAGE_KEYS.TIMESTAMP_MODE]) {
      timestampModeSelect.value = data[STORAGE_KEYS.TIMESTAMP_MODE];
    }
    updateUI({
      isRecording: Boolean(data[STORAGE_KEYS.IS_RECORDING]),
      records: data[STORAGE_KEYS.RECORDS] || [],
      customSelector: data[STORAGE_KEYS.CUSTOM_SELECTOR] || "",
      pauseThresholdMs: data[STORAGE_KEYS.PAUSE_THRESHOLD_MS] || 3000
    });

    // 2. 탭 연결 후 실시간 상태 동기화
    if (activeTab?.id) {
      chrome.tabs.sendMessage(activeTab.id, { action: "GET_STATUS" }, (response) => {
        if (!chrome.runtime.lastError && response) {
          updateUI(response);
        }
      });
    }
  });

  // 스토리지 실시간 변화 감지 (새 자막 수집 시 팝업 뷰 자동 갱신)
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes[STORAGE_KEYS.RECORDS]) {
      currentRecords = changes[STORAGE_KEYS.RECORDS].newValue || [];
      itemCountEl.textContent = currentRecords.length;
      lastTimeEl.textContent = currentRecords.length
        ? currentRecords[currentRecords.length - 1].timestamp
        : "-";
      renderPreview(currentRecords, timestampModeSelect.value);
    }
  });

  // 수집 토글 이벤트
  toggleBtn.addEventListener("click", () => {
    if (!activeTab?.id) return;
    chrome.tabs.sendMessage(activeTab.id, {
      action: "TOGGLE_RECORDING",
      customSelector: selectorInput.value.trim(),
      pauseThresholdMs: Number(pauseThresholdInput.value || 3) * 1000
    }, (response) => {
      if (!chrome.runtime.lastError && response) {
        updateUI(response);
      }
    });
  });

  // 전체 복사
  copyAllBtn.addEventListener("click", () => {
    if (!currentRecords.length) {
      showToast("복사할 자막이 없습니다.");
      return;
    }
    const tsMode = timestampModeSelect.value;
    const textContent = Formatter.formatToText(currentRecords, pageTitle, tsMode);
    navigator.clipboard.writeText(textContent).then(() => {
      showToast("클립보드에 복사되었습니다.");
    });
  });

  // 기록 초기화
  clearBtn.addEventListener("click", () => {
    if (!confirm("수집된 모든 자막 기록을 초기화하시겠습니까?")) return;

    chrome.storage.local.set({ [STORAGE_KEYS.RECORDS]: [] }, () => {
      currentRecords = [];
      updateUI({ isRecording: false, records: [] });

      if (activeTab?.id) {
        chrome.tabs.sendMessage(activeTab.id, { action: "CLEAR_DATA" }, (res) => {
          if (!chrome.runtime.lastError && res) {
            updateUI(res);
          }
        });
      }
      showToast("기록이 초기화되었습니다.");
    });
  });

  // 파일 다운로드 헬퍼
  function triggerDownload(content, mimeType, filename) {
    const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  // TXT 다운로드
  downloadTxtBtn.addEventListener("click", () => {
    if (!currentRecords.length) {
      alert("다운로드할 자막 기록이 없습니다.");
      return;
    }
    const cleanTitle = (pageTitle || "국회_의사중계_자막").replace(/[\\/:*?"<>|]/g, "_").trim();
    const dateStr = new Date().toISOString().slice(0, 10);
    const content = Formatter.formatToText(currentRecords, cleanTitle, timestampModeSelect.value);
    triggerDownload(content, "text/plain", `${cleanTitle}_${dateStr}.txt`);
  });

  // Markdown 다운로드
  downloadMdBtn.addEventListener("click", () => {
    if (!currentRecords.length) {
      alert("다운로드할 자막 기록이 없습니다.");
      return;
    }
    const cleanTitle = (pageTitle || "국회_의사중계_자막").replace(/[\\/:*?"<>|]/g, "_").trim();
    const dateStr = new Date().toISOString().slice(0, 10);
    const content = Formatter.formatToMarkdown(currentRecords, cleanTitle, timestampModeSelect.value);
    triggerDownload(content, "text/markdown", `${cleanTitle}_${dateStr}.md`);
  });

  // 설정값 변경 이벤트
  timestampModeSelect.addEventListener("change", () => {
    const mode = timestampModeSelect.value;
    chrome.storage.local.set({ [STORAGE_KEYS.TIMESTAMP_MODE]: mode });
    renderPreview(currentRecords, mode);
  });

  pauseThresholdInput.addEventListener("change", () => {
    const sec = Math.max(1, Number(pauseThresholdInput.value) || 3);
    const ms = sec * 1000;
    chrome.storage.local.set({ [STORAGE_KEYS.PAUSE_THRESHOLD_MS]: ms });
    if (activeTab?.id) {
      chrome.tabs.sendMessage(activeTab.id, { action: "UPDATE_CONFIG", pauseThresholdMs: ms });
    }
  });

  selectorInput.addEventListener("change", () => {
    const val = selectorInput.value.trim();
    chrome.storage.local.set({ [STORAGE_KEYS.CUSTOM_SELECTOR]: val });
    if (activeTab?.id) {
      chrome.tabs.sendMessage(activeTab.id, { action: "UPDATE_CONFIG", customSelector: val });
    }
  });
});
```

- [ ] **Step 2: 문법 검증**

Run: `node -c popup/popup.js`  
Expected: 무출력 (Syntax OK)

- [ ] **Step 3: Git 커밋**

```bash
git add popup/popup.js
git commit -m "feat: 팝업 컨트롤러 및 프리뷰 로직 구현 (popup/popup.js)"
```

---

### Task 7: 매니페스트 및 아이콘 생성 (`manifest.json`, `icons/`)

**Files:**
- Create: `manifest.json`
- Create: `icons/generate_icons.js` (아이콘 자동 생성 스크립트)
- Create: `icons/icon16.png`, `icons/icon48.png`, `icons/icon128.png`

- [ ] **Step 1: `manifest.json` 작성**

```json
{
  "manifest_version": 3,
  "name": "대한민국 국회 의사중계 실시간 자막 수집기",
  "version": "1.0.0",
  "description": "국회 의사중계 웹 플레이어의 실시간 자막을 감지하여 듀얼 타임스탬프와 스마트 문단 분할과 함께 텍스트/마크다운 문서로 저장합니다.",
  "permissions": [
    "storage",
    "activeTab"
  ],
  "host_permissions": [
    "*://*.assembly.go.kr/*",
    "*://*.webcast.go.kr/*",
    "*://*.natv.go.kr/*"
  ],
  "action": {
    "default_popup": "popup/popup.html",
    "default_title": "국회 의사중계 자막 수집기",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },
  "content_scripts": [
    {
      "matches": [
        "*://*.assembly.go.kr/*",
        "*://*.webcast.go.kr/*",
        "*://*.natv.go.kr/*"
      ],
      "js": [
        "config/constants.js",
        "utils/export-formatter.js",
        "content/caption-engine.js",
        "content/content.js"
      ],
      "run_at": "document_idle"
    }
  ],
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  }
}
```

- [ ] **Step 2: PNG 아이콘 생성 스크립트 작성 및 실행**

아이콘(16, 48, 128)을 순수 Node.js로 생성 (유효한 최소 PNG 바이너리 생성기):
```javascript
// icons/generate_icons.js
const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");

function createPng(width, height, r, g, b) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  
  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // Bit depth: 8
  ihdrData[9] = 2; // Color type: 2 (RGB)
  ihdrData[10] = 0; // Compression
  ihdrData[11] = 0; // Filter
  ihdrData[12] = 0; // Interlace
  const ihdrChunk = createChunk("IHDR", ihdrData);

  // Raw image data with filter byte 0 per scanline
  const rowSize = 1 + width * 3;
  const rawData = Buffer.alloc(height * rowSize);
  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0; // Filter 0
    for (let x = 0; x < width; x++) {
      const pixelOffset = rowOffset + 1 + x * 3;
      rawData[pixelOffset] = r;
      rawData[pixelOffset + 1] = g;
      rawData[pixelOffset + 2] = b;
    }
  }

  const idatData = zlib.deflateSync(rawData);
  const idatChunk = createChunk("IDAT", idatData);
  const iendChunk = createChunk("IEND", Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createChunk(type, data) {
  const length = data.length;
  const buffer = Buffer.alloc(8 + length + 4);
  buffer.writeUInt32BE(length, 0);
  buffer.write(type, 4, 4, "ascii");
  data.copy(buffer, 8);

  const crcTarget = buffer.subarray(4, 8 + length);
  const crc = crc32(crcTarget);
  buffer.writeUInt32BE(crc, 8 + length);
  return buffer;
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    const byte = buf[i];
    crc ^= byte;
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

const dir = __dirname;
// National Assembly Blue theme RGB: (37, 99, 235)
fs.writeFileSync(path.join(dir, "icon16.png"), createPng(16, 16, 37, 99, 235));
fs.writeFileSync(path.join(dir, "icon48.png"), createPng(48, 48, 37, 99, 235));
fs.writeFileSync(path.join(dir, "icon128.png"), createPng(128, 128, 37, 99, 235));
console.log("Generated icon16.png, icon48.png, icon128.png successfully.");
```

Run: `node icons/generate_icons.js`  
Expected: `Generated icon16.png, icon48.png, icon128.png successfully.`

- [ ] **Step 3: Git 커밋**

```bash
git add manifest.json icons/
git commit -m "feat: Manifest V3 정의 및 확장 프로그램 아이콘 생성"
```

---

### Task 8: 종합 검증, README 작성 및 GitHub 저장소 생성/푸시

**Files:**
- Create: `README.md`
- Create: `.gitignore`
- Test: 전체 단위 테스트 스위트 실행

- [ ] **Step 1: 전체 테스트 스위트 실행**

Run: `node tests/constants.test.js && node tests/export-formatter.test.js && node tests/caption-engine.test.js`  
Expected: 모든 테스트 PASS

- [ ] **Step 2: `.gitignore` 및 `README.md` 작성**

```markdown
# 대한민국 국회 의사중계 실시간 자막 수집기
## National Assembly Live Subtitle Collector (Chrome Extension)

대한민국 국회 의사중계 시스템(`assembly.webcast.go.kr`, `vplatform.assembly.go.kr` 등)의 웹 플레이어에서 송출되는 실시간 자막(AI 자막 및 속기 자막)을 감지하여 듀얼 타임스탬프와 스마트 문단 분할과 함께 텍스트(TXT) 및 마크다운(MD) 파일로 저장하는 크롬 확장 프로그램입니다.

### 주요 기능 (Key Features)
1. **무빌드(No Build) 즉시 실행**: 복잡한 빌드나 의존성 설치 없이 소스 폴더 그대로 크롬에 로드하여 사용.
2. **듀얼 타임스탬프 (Dual Timestamps)**:
   - PC 로컬 절대 시각 (`10:00:15`)
   - 플레이어 영상 재생 시각 (`00:15:30`)
   - 설정에 따라 둘 다 병기 또는 단일 시각 선택 가능.
3. **스마트 중복 필터링 & 문단 분할**:
   - 실시간 STT 자막 스트림의 중복 및 부분 변경 문장 필터링.
   - 발언 간 침묵 공백 텀(기본 3초) 감지 시 자동으로 새 단락 구분.
4. **실시간 미리보기 & 원클릭 복사**:
   - 팝업에서 현재 수집 중인 자막 스트림을 실시간 확인.
   - 원클릭 클립보드 전체 복사 기능.
5. **다양한 포맷 내보내기**:
   - 구조화된 마크다운(`.md`) 및 일반 텍스트(`.txt`) 다운로드 지원.

### 설치 및 실행 방법 (Installation)
1. 이 저장소를 로컬 컴퓨터에 클론(Clone)하거나 다운로드합니다.
2. 구글 크롬 브라우저를 열고 주소창에 `chrome://extensions/` 를 입력하여 접속합니다.
3. 우측 상단의 **개발자 모드(Developer mode)** 스위치를 켭니다.
4. 좌측 상단의 **[압축해제된 확장 프로그램을 로드합니다]** 버튼을 클릭합니다.
5. 본 프로젝트 폴더(`/국회회의크롤`)를 선택합니다.
6. [국회인터넷의사중계시스템](https://assembly.webcast.go.kr/main/) 또는 의사중계 영상 페이지로 이동하여 회의를 시청하고, 확장 프로그램 아이콘을 눌러 [수집 시작]을 클릭합니다.
```

- [ ] **Step 3: Git 커밋**

```bash
git add .gitignore README.md
git commit -m "docs: 프로젝트 상세 설명서(README.md) 및 .gitignore 추가"
```

- [ ] **Step 4: GitHub 원격 저장소 생성 및 푸시**

Run: `gh repo create assembly-caption-collector --public --source=. --remote=origin --push`  
Expected: `✓ Created repository WizMasia/assembly-caption-collector on GitHub` 및 커밋 푸시 완료.

---

### 계획 검토 (Self-Review Checklist)
- [x] Spec coverage: 듀얼 타임스탬프, 문단 분할, 프리뷰, 셀렉터, GitHub 저장소 생성까지 모두 각 Task에 명시됨.
- [x] No Placeholders: 모든 파일 경로, 코드, 테스트, 커맨드가 완전하게 포함됨.
- [x] Type consistency: 상수명(`STORAGE_KEYS`, `TIMESTAMP_MODES`), 메서드명(`cleanText`, `formatToMarkdown` 등)이 일관되게 정의됨.
