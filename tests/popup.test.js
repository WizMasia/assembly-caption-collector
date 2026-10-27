/**
 * @file popup.test.js
 * @description popup/popup.js 기능 및 상태 동기화 단위 테스트
 * Unit tests for popup/popup.js interactions, rendering and state synchronization
 */

const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

/**
 * 팝업 스위트 단위 테스트 실행
 * Executes test suite for popup controller
 * @returns {Promise<void>}
 */
async function runTests() {
  console.log("Starting Task 6 popup tests / 팝업 단위 테스트 시작...");

  // 1. 가상 DOM 및 Chrome API 목(Mock) 환경 구축
  // 1. Build mock DOM and Chrome API environment
  const mockStorageData = {};
  const storageListeners = [];
  const tabSentMessages = [];
  let clipboardText = "";
  const downloadedFiles = [];

  class MockClassList {
    constructor() {
      this.classes = new Set();
    }
    add(cls) { this.classes.add(cls); }
    remove(cls) { this.classes.delete(cls); }
    contains(cls) { return this.classes.has(cls); }
  }

  class MockElement {
    constructor(id, tagName = "div") {
      this.id = id;
      this.tagName = tagName.toUpperCase();
      this.className = "";
      this.classList = new MockClassList();
      this.textContent = "";
      this.value = "";
      this._innerHTML = "";
      this.children = [];
      this.scrollTop = 0;
      this.scrollHeight = 100;
      this.listeners = {};
      this.attributes = {};
    }

    get innerHTML() {
      return this._innerHTML;
    }

    set innerHTML(val) {
      this._innerHTML = val;
      if (val === "") {
        this.children = [];
      }
    }

    appendChild(child) {
      if (child.tagName === "FRAGMENT") {
        this.children.push(...child.children);
      } else {
        this.children.push(child);
      }
      return child;
    }

    removeChild(child) {
      const idx = this.children.indexOf(child);
      if (idx !== -1) this.children.splice(idx, 1);
      return child;
    }

    querySelector(selector) {
      if (selector === ".btn-icon-symbol") {
        return this.children.find((c) => c.className === "btn-icon-symbol") || null;
      }
      return null;
    }

    addEventListener(event, handler) {
      if (!this.listeners[event]) this.listeners[event] = [];
      this.listeners[event].push(handler);
    }

    dispatchEvent(event) {
      const handlers = this.listeners[event.type || event] || [];
      handlers.forEach((h) => h(event));
    }

    click() {
      if (this.listeners["click"]) {
        this.listeners["click"].forEach((h) => h({ type: "click" }));
      }
    }
  }

  const elements = {
    statusBadge: new MockElement("statusBadge"),
    txtStatus: new MockElement("txtStatus", "span"),
    itemCount: new MockElement("itemCount", "strong"),
    lastTime: new MockElement("lastTime", "span"),
    previewList: new MockElement("previewList"),
    emptyNotice: new MockElement("emptyNotice"),
    toggleBtn: new MockElement("toggleBtn", "button"),
    txtToggle: new MockElement("txtToggle", "span"),
    iconToggle: new MockElement("iconToggle", "span"),
    clearBtn: new MockElement("clearBtn", "button"),
    downloadTxtBtn: new MockElement("downloadTxtBtn", "button"),
    downloadMdBtn: new MockElement("downloadMdBtn", "button"),
    copyAllBtn: new MockElement("copyAllBtn", "button"),
    timestampModeSelect: new MockElement("timestampModeSelect", "select"),
    pauseThresholdInput: new MockElement("pauseThresholdInput", "input"),
    selectorInput: new MockElement("selectorInput", "input"),
    toast: new MockElement("toast")
  };

  elements.iconToggle.className = "btn-icon-symbol";
  elements.toggleBtn.appendChild(elements.iconToggle);
  elements.toggleBtn.appendChild(elements.txtToggle);

  const mockDocument = {
    activeElement: null,
    body: {
      appendChild(child) {
        if (child.download) {
          downloadedFiles.push({ filename: child.download, href: child.href });
        }
      },
      removeChild() {}
    },
    getElementById(id) {
      return elements[id] || null;
    },
    createElement(tag) {
      return new MockElement("", tag);
    },
    createDocumentFragment() {
      return new MockElement("", "fragment");
    },
    listeners: {},
    addEventListener(event, handler) {
      if (!this.listeners[event]) this.listeners[event] = [];
      this.listeners[event].push(handler);
    },
    dispatchEvent(event) {
      const handlers = this.listeners[event.type || event] || [];
      handlers.forEach((h) => h(event));
    }
  };

  const mockWindow = {
    AssemblyConstants: require("../config/constants.js"),
    AssemblyExportFormatter: require("../utils/export-formatter.js"),
    document: mockDocument
  };

  global.window = mockWindow;
  global.document = mockDocument;
  global.confirm = () => true;
  global.alert = () => {};
  global.Blob = class {
    constructor(content, options) {
      this.content = content;
      this.options = options;
    }
  };
  global.URL = {
    createObjectURL(_blob) {
      return "blob:mock-url-" + Math.random();
    },
    revokeObjectURL() {}
  };

  // Node 21+ navigator.clipboard 정의
  // Define clipboard on global.navigator in Node 21+
  Object.defineProperty(global.navigator, "clipboard", {
    value: {
      writeText: async (text) => {
        clipboardText = text;
      }
    },
    configurable: true
  });

  global.chrome = {
    runtime: {
      lastError: null
    },
    tabs: {
      query: async () => [{ id: 101, title: "제418회 국회 본회의" }],
      sendMessage: (tabId, message, callback) => {
        tabSentMessages.push({ tabId, message });
        if (message.action === "GET_STATUS") {
          if (callback) callback({
            isRecording: false,
            records: [{ id: "1", text: "회의를 시작합니다.", timestamp: "10:00:00", isParagraphStart: false }],
            customSelector: "#testSubtit",
            pauseThresholdMs: 4000,
            title: "제418회 국회 본회의"
          });
        } else if (message.action === "TOGGLE_RECORDING") {
          if (callback) callback({
            isRecording: true,
            records: [{ id: "1", text: "회의를 시작합니다.", timestamp: "10:00:00", isParagraphStart: false }],
            customSelector: message.customSelector,
            pauseThresholdMs: message.pauseThresholdMs
          });
        } else if (message.action === "CLEAR_DATA") {
          if (callback) callback({
            isRecording: false,
            records: [],
            customSelector: "",
            pauseThresholdMs: 3000
          });
        }
      }
    },
    storage: {
      local: {
        get: (keys, callback) => {
          const res = {};
          if (Array.isArray(keys)) {
            keys.forEach((k) => { res[k] = mockStorageData[k]; });
          }
          callback(res);
        },
        set: (data, callback) => {
          Object.assign(mockStorageData, data);
          if (callback) callback();
        }
      },
      onChanged: {
        addListener: (fn) => storageListeners.push(fn)
      }
    }
  };

  // 2. popup.js 코드 로드 및 초기화
  // 2. Load popup.js script and initialize via DOMContentLoaded
  const popupJsCode = fs.readFileSync(path.join(__dirname, "../popup/popup.js"), "utf8");
  eval(popupJsCode);

  // DOMContentLoaded 이벤트 발생
  // Trigger DOMContentLoaded
  mockDocument.dispatchEvent({ type: "DOMContentLoaded" });

  // 비동기 쿼리 및 이벤트 큐 처리 대기
  // Wait for async tab query and initial state sync
  await new Promise((r) => setTimeout(r, 50));

  // -------------------------------------------------------------
  // 검증 1: 초기 상태 복원 및 GET_STATUS 반영 검증
  // Test 1: Initial state restoration & GET_STATUS sync
  // -------------------------------------------------------------
  assert.strictEqual(elements.itemCount.textContent, "1");
  assert.strictEqual(elements.lastTime.textContent, "10:00:00");
  assert.strictEqual(elements.txtStatus.textContent, "대기 중");
  assert.strictEqual(elements.txtToggle.textContent, "수집 시작");
  assert.strictEqual(elements.selectorInput.value, "#testSubtit");
  assert.strictEqual(elements.pauseThresholdInput.value, "4");
  console.log("✓ Initial state restoration & GET_STATUS passed");

  // -------------------------------------------------------------
  // 검증 2: 수집 토글 버튼 클릭 (TOGGLE_RECORDING)
  // Test 2: Toggle recording action
  // -------------------------------------------------------------
  elements.toggleBtn.click();
  await new Promise((r) => setTimeout(r, 20));

  assert.strictEqual(elements.txtToggle.textContent, "수집 중지");
  assert.strictEqual(elements.toggleBtn.className, "btn btn-danger");
  assert.strictEqual(elements.statusBadge.className, "status-badge status-recording");
  assert.strictEqual(elements.txtStatus.textContent, "수집 중");
  assert.strictEqual(elements.iconToggle.textContent, "⏹");
  console.log("✓ Toggle recording passed");

  // -------------------------------------------------------------
  // 검증 3: 전체 복사 기능 (copyAllBtn)
  // Test 3: Copy all subtitles to clipboard
  // -------------------------------------------------------------
  elements.copyAllBtn.click();
  await new Promise((r) => setTimeout(r, 20));

  assert.ok(clipboardText.includes("회의를 시작합니다."));
  assert.ok(elements.toast.classList.contains("show"));
  console.log("✓ Copy all action passed");

  // -------------------------------------------------------------
  // 검증 4: TXT 및 MD 내보내기 다운로드 기능
  // Test 4: TXT & Markdown export download
  // -------------------------------------------------------------
  elements.downloadTxtBtn.click();
  elements.downloadMdBtn.click();

  assert.strictEqual(downloadedFiles.length, 2);
  assert.ok(downloadedFiles[0].filename.endsWith(".txt"));
  assert.ok(downloadedFiles[1].filename.endsWith(".md"));
  console.log("✓ Export downloads passed");

  // -------------------------------------------------------------
  // 검증 5: 설정 변경 (타임스탬프 모드, 침묵 기준, 셀렉터)
  // Test 5: Settings update events
  // -------------------------------------------------------------
  elements.timestampModeSelect.value = "pc";
  elements.timestampModeSelect.dispatchEvent({ type: "change" });
  assert.strictEqual(mockStorageData["assembly_timestamp_mode"], "pc");

  elements.pauseThresholdInput.value = "5";
  elements.pauseThresholdInput.dispatchEvent({ type: "change" });
  assert.strictEqual(mockStorageData["assembly_pause_threshold_ms"], 5000);

  elements.selectorInput.value = ".custom-caption";
  elements.selectorInput.dispatchEvent({ type: "change" });
  assert.strictEqual(mockStorageData["assembly_custom_selector"], ".custom-caption");
  console.log("✓ Settings update events passed");

  // -------------------------------------------------------------
  // 검증 6: 스토리지 변경 감지 (새 자막 수신 알림)
  // Test 6: Storage onChanged notification for new captions
  // -------------------------------------------------------------
  const newRecords = [
    { id: "1", text: "회의를 시작합니다.", timestamp: "10:00:00", isParagraphStart: false },
    { id: "2", text: "의사일정 제1항입니다.", timestamp: "10:01:00", isParagraphStart: true }
  ];
  storageListeners.forEach((listener) => {
    listener({
      assembly_caption_records: { newValue: newRecords }
    }, "local");
  });

  assert.strictEqual(elements.itemCount.textContent, "2");
  assert.strictEqual(elements.lastTime.textContent, "10:01:00");
  assert.strictEqual(elements.previewList.children.length, 2);
  assert.ok(elements.previewList.children[1].className.includes("para-start"));
  console.log("✓ Storage onChanged real-time sync passed");

  // -------------------------------------------------------------
  // 검증 7: 기록 초기화 (clearBtn)
  // Test 7: Clear records action
  // -------------------------------------------------------------
  elements.clearBtn.click();
  await new Promise((r) => setTimeout(r, 20));

  assert.strictEqual(elements.itemCount.textContent, "0");
  assert.strictEqual(elements.lastTime.textContent, "-");
  assert.deepStrictEqual(mockStorageData["assembly_caption_records"], []);
  console.log("✓ Clear records passed");

  console.log("All Task 6 popup tests passed! / 모든 팝업 테스트를 통과했습니다!");
}

runTests().catch((err) => {
  console.error("Test failed / 테스트 실패:", err);
  process.exit(1);
});
