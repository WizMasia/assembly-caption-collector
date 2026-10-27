/**
 * @file content.js
 * @description 국회 의사중계 웹페이지 주입 Content Script (팝업 통신, 실시간 감시 및 스토리지 연동)
 * Content script injected into Assembly webcast pages (Popup messaging, real-time monitoring & storage sync)
 */

(function () {
  "use strict";

  // 중복 스크립트 실행 방지 가드 플래그
  // Guard flag to prevent duplicate script injection
  if (typeof window === "undefined" || window.__natvCaptionCollectorLoaded) {
    return;
  }
  window.__natvCaptionCollectorLoaded = true;

  /**
   * 런타임 메시지 액션 상수
   * Runtime message action type constants
   * @type {Readonly<{GET_STATUS: string, TOGGLE_RECORDING: string, UPDATE_CONFIG: string, CLEAR_DATA: string}>}
   */
  const MESSAGE_ACTIONS = Object.freeze({
    GET_STATUS: "GET_STATUS",
    TOGGLE_RECORDING: "TOGGLE_RECORDING",
    UPDATE_CONFIG: "UPDATE_CONFIG",
    CLEAR_DATA: "CLEAR_DATA"
  });

  /**
   * 중앙 상수 정의 객체 참조 (config/constants.js)
   * Reference to centralized constants configuration
   * @type {any}
   */
  const Constants = window.AssemblyConstants || {};

  /**
   * 크롬 로컬 스토리지 키 매핑
   * Storage key mappings for Chrome local storage
   * @type {StorageKeys}
   */
  const STORAGE_KEYS = Constants.STORAGE_KEYS || Object.freeze({
    RECORDS: "assembly_caption_records",
    IS_RECORDING: "assembly_is_recording",
    CUSTOM_SELECTOR: "assembly_custom_selector",
    TIMESTAMP_MODE: "assembly_timestamp_mode",
    PAUSE_THRESHOLD_MS: "assembly_pause_threshold_ms",
    AUTO_SAVE_INTERVAL_MIN: "assembly_auto_save_interval_min",
    AUTO_SAVE_FORMAT: "assembly_auto_save_format",
    SHOW_FLOATING_WIDGET: "assembly_show_floating_widget"
  });

  /**
   * 기본 문단 분할 기준 침묵 밀리초
   * Default pause threshold in milliseconds for paragraph splitting
   * @type {number}
   */
  const defaultPauseThresholdMs = (Constants.TIMING && typeof Constants.TIMING.DEFAULT_PAUSE_THRESHOLD_MS === "number")
    ? Constants.TIMING.DEFAULT_PAUSE_THRESHOLD_MS
    : 3000;

  /**
   * 자막 DOM 기본 후보 선택자 목록
   * Default candidate selectors for caption DOM lookup
   * @type {ReadonlyArray<string>}
   */
  const candidateSelectors = (Constants.CANDIDATE_SELECTORS && Array.isArray(Constants.CANDIDATE_SELECTORS))
    ? Constants.CANDIDATE_SELECTORS
    : [];

  /**
   * 자막 코어 엔진 클래스 참조 (content/caption-engine.js)
   * Reference to CaptionEngine class
   * @type {any}
   */
  const CaptionEngineClass = window.AssemblyCaptionEngine;
  if (!CaptionEngineClass) {
    console.error("[Assembly Collector] CaptionEngine is not loaded / CaptionEngine이 로드되지 않았습니다.");
    return;
  }

  /**
   * 자막 수집 코어 엔진 인스턴스
   * Core caption engine instance
   * @type {CaptionEngine}
   */
  const engine = new CaptionEngineClass({
    candidateSelectors: candidateSelectors,
    pauseThresholdMs: defaultPauseThresholdMs
  });

  /**
   * 현재 자막 수집 활성화 여부 플래그
   * Flag indicating whether subtitle recording is currently active
   * @type {boolean}
   */
  let isRecording = false;

  /**
   * 주기적 자동 파일 저장 주기 (분 단위, 0 = 비활성화)
   * Periodic auto-save interval in minutes (0 = disabled)
   * @type {number}
   */
  let autoSaveIntervalMin = 0;

  /**
   * 자동 저장 파일 형식 ('txt' | 'md')
   * Auto-save file format
   * @type {'txt' | 'md'}
   */
  let autoSaveFormat = "txt";

  /**
   * 웹페이지 내 플로팅 위젯 표시 여부
   * Whether to display in-page floating widget
   * @type {boolean}
   */
  let showFloatingWidget = true;

  /**
   * 마지막으로 자동 저장된 자막 문장 수
   * Number of subtitle records saved in last auto-save
   * @type {number}
   */
  let lastAutoSavedCount = 0;

  /**
   * 자동 저장 인터벌 타이머 ID
   * Timer ID for periodic auto-save
   * @type {ReturnType<typeof setInterval> | null}
   */
  let autoSaveTimer = null;

  /**
   * 웹페이지 DOM 내 가상 앵커를 통한 파일 다운로드 헬퍼
   * Helper to trigger file download via dynamic anchor
   * @param {string} content - 파일 본문 / File content
   * @param {string} mimeType - MIME 타입 / MIME type
   * @param {string} filename - 파일명 / Download filename
   * @returns {void}
   */
  function downloadBlob(content, mimeType, filename) {
    if (typeof document === "undefined" || !document.body) return;
    try {
      const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      console.warn("[Assembly Collector] Auto-save download error / 자동 저장 다운로드 오류:", err);
    }
  }

  /**
   * 주기적 자동 저장 실행 함수
   * Executes periodic auto-save if new subtitles are available
   * @returns {void}
   */
  function triggerAutoSave() {
    if (!isRecording || engine.records.length === 0 || engine.records.length <= lastAutoSavedCount) {
      return;
    }
    const Formatter = window.AssemblyExportFormatter;
    if (!Formatter) return;

    const rawTitle = (typeof document !== "undefined" && document.title) ? document.title : "국회_의사중계_자막";
    const cleanTitle = rawTitle.replace(/[\\/:*?"<>|\r\n\t\x00-\x1f]/g, "_").trim() || "국회_의사중계_자막";
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const timeStr = `${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`;
    const format = autoSaveFormat === "md" ? "md" : "txt";
    const filename = `${cleanTitle}_자동백업_${dateStr}_${timeStr}.${format}`;

    let fileContent = "";
    let mimeType = "text/plain";
    if (format === "md") {
      fileContent = Formatter.formatToMarkdown(engine.records, rawTitle, "both");
      mimeType = "text/markdown";
    } else {
      fileContent = Formatter.formatToText(engine.records, rawTitle, "both");
    }

    downloadBlob(fileContent, mimeType, filename);
    lastAutoSavedCount = engine.records.length;
    showFloatingToast(`자막 ${lastAutoSavedCount}개 자동 백업 저장됨`);
  }

  /**
   * 주기적 자동 저장 타이머 설정 및 해제
   * Configures or clears periodic auto-save timer
   * @returns {void}
   */
  function setupAutoSaveTimer() {
    if (autoSaveTimer) {
      clearInterval(autoSaveTimer);
      autoSaveTimer = null;
    }
    if (isRecording && autoSaveIntervalMin > 0) {
      autoSaveTimer = setInterval(triggerAutoSave, autoSaveIntervalMin * 60 * 1000);
    }
  }

  // 플로팅 위젯 호스트 및 섀도우 루트
  // Floating widget host element and shadow root
  let floatingHost = null;
  let floatingShadow = null;
  let isFloatingExpanded = false;

  /**
   * 플로팅 위젯 내부 토스트 알림 표시
   * Displays toast notification inside floating widget shadow DOM
   * @param {string} msg
   */
  function showFloatingToast(msg) {
    if (!floatingShadow) return;
    const toast = floatingShadow.getElementById("floatingToast");
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 2500);
  }

  /**
   * 플로팅 위젯 UI 동기화
   * Synchronizes floating widget UI with current state
   * @returns {void}
   */
  function updateFloatingWidgetUI() {
    if (!floatingShadow) return;
    const badgeText = floatingShadow.getElementById("badgeText");
    const statusDot = floatingShadow.getElementById("statusDot");
    const countEl = floatingShadow.getElementById("panelCount");
    const timeEl = floatingShadow.getElementById("panelTime");
    const autoSaveStatusEl = floatingShadow.getElementById("panelAutoSave");
    const toggleBtn = floatingShadow.getElementById("panelToggleBtn");

    const count = engine.records.length;
    const lastItem = count > 0 ? engine.records[count - 1] : null;

    if (badgeText) {
      badgeText.textContent = isRecording ? `수집 중 (${count})` : `대기 중 (${count})`;
    }
    if (statusDot) {
      statusDot.className = `status-dot ${isRecording ? "recording" : "stopped"}`;
    }
    if (countEl) countEl.textContent = `${count}개`;
    if (timeEl) timeEl.textContent = lastItem ? (lastItem.timestamp || "-") : "-";
    if (autoSaveStatusEl) {
      autoSaveStatusEl.textContent = autoSaveIntervalMin > 0 ? `${autoSaveIntervalMin}분마다` : "꺼짐";
    }
    if (toggleBtn) {
      toggleBtn.textContent = isRecording ? "수집 중지" : "수집 시작";
      toggleBtn.className = isRecording ? "btn btn-danger" : "btn btn-primary";
    }
  }

  /**
   * 웹페이지 내 플로팅 위젯 생성 및 마운트 (Shadow DOM 격리)
   * Creates and mounts in-page floating widget using Shadow DOM for style isolation
   * @returns {void}
   */
  function initFloatingWidget() {
    if (typeof document === "undefined" || !document.body) return;
    if (!showFloatingWidget) {
      if (floatingHost) {
        floatingHost.remove();
        floatingHost = null;
        floatingShadow = null;
      }
      return;
    }
    if (floatingHost) {
      updateFloatingWidgetUI();
      return;
    }

    floatingHost = document.createElement("div");
    floatingHost.id = "assembly-caption-floating-host";
    floatingHost.style.position = "fixed";
    floatingHost.style.bottom = "24px";
    floatingHost.style.right = "24px";
    floatingHost.style.zIndex = "2147483647";
    floatingHost.style.fontFamily = "-apple-system, BlinkMacSystemFont, 'Pretendard', sans-serif";

    floatingShadow = floatingHost.attachShadow({ mode: "open" });
    floatingShadow.innerHTML = `
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .floating-pill {
          display: flex;
          align-items: center;
          gap: 7px;
          background: rgba(15, 23, 42, 0.90);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          color: #ffffff;
          padding: 8px 14px;
          border-radius: 20px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          box-shadow: 0 4px 16px rgba(0,0,0,0.25);
          border: 1px solid rgba(255,255,255,0.2);
          transition: transform 0.15s, background 0.15s;
          user-select: none;
        }
        .floating-pill:hover {
          transform: translateY(-2px);
          background: rgba(15, 23, 42, 0.98);
        }
        .status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }
        .status-dot.recording {
          background: #10b981;
          box-shadow: 0 0 8px #10b981;
          animation: pulse 1.5s infinite;
        }
        .status-dot.stopped {
          background: #94a3b8;
        }
        @keyframes pulse {
          0% { transform: scale(0.9); opacity: 0.8; }
          50% { transform: scale(1.3); opacity: 1; }
          100% { transform: scale(0.9); opacity: 0.8; }
        }
        .floating-panel {
          display: none;
          flex-direction: column;
          gap: 10px;
          width: 260px;
          background: #ffffff;
          color: #0f172a;
          border-radius: 12px;
          padding: 14px;
          box-shadow: 0 10px 25px rgba(0,0,0,0.25);
          border: 1px solid #e2e8f0;
          margin-bottom: 8px;
        }
        .floating-panel.open { display: flex; }
        .panel-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 13px;
          font-weight: 700;
          border-bottom: 1px solid #f1f5f9;
          padding-bottom: 8px;
        }
        .btn-close {
          background: none;
          border: none;
          font-size: 14px;
          cursor: pointer;
          color: #64748b;
          padding: 2px 4px;
        }
        .panel-stats {
          display: flex;
          justify-content: space-between;
          font-size: 11px;
          color: #64748b;
          background: #f8fafc;
          padding: 6px 8px;
          border-radius: 6px;
        }
        .panel-stats strong { color: #2563eb; }
        .panel-buttons {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .btn-row { display: flex; gap: 6px; }
        .btn {
          flex: 1;
          padding: 6px 10px;
          font-size: 12px;
          font-weight: 600;
          border-radius: 6px;
          border: none;
          cursor: pointer;
          transition: background 0.15s;
        }
        .btn-primary { background: #2563eb; color: #fff; }
        .btn-primary:hover { background: #1d4ed8; }
        .btn-danger { background: #ef4444; color: #fff; }
        .btn-danger:hover { background: #dc2626; }
        .btn-secondary { background: #f1f5f9; color: #334155; border: 1px solid #cbd5e1; }
        .btn-secondary:hover { background: #e2e8f0; }
        .toast {
          position: absolute;
          bottom: 45px;
          right: 0;
          background: rgba(15, 23, 42, 0.9);
          color: #fff;
          font-size: 11px;
          padding: 4px 10px;
          border-radius: 12px;
          pointer-events: none;
          opacity: 0;
          transition: opacity 0.2s;
          white-space: nowrap;
        }
        .toast.show { opacity: 1; }
      </style>
      <div id="floatingPanel" class="floating-panel">
        <div class="panel-header">
          <span>🏛️ 국회 자막 수집기</span>
          <button id="panelCloseBtn" class="btn-close" type="button">✕</button>
        </div>
        <div class="panel-stats">
          <div>수집: <strong id="panelCount">0개</strong></div>
          <div>최근: <span id="panelTime">-</span></div>
          <div>자동저장: <span id="panelAutoSave">꺼짐</span></div>
        </div>
        <div class="panel-buttons">
          <button id="panelToggleBtn" class="btn btn-primary" type="button">수집 시작</button>
          <div class="btn-row">
            <button id="panelCopyBtn" class="btn btn-secondary" type="button">전체 복사</button>
            <button id="panelSaveBtn" class="btn btn-secondary" type="button">파일 저장</button>
          </div>
        </div>
      </div>
      <div id="floatingPill" class="floating-pill">
        <span id="statusDot" class="status-dot stopped"></span>
        <span id="badgeText">대기 중 (0)</span>
      </div>
      <div id="floatingToast" class="toast"></div>
    `;

    document.body.appendChild(floatingHost);

    const pill = floatingShadow.getElementById("floatingPill");
    const panel = floatingShadow.getElementById("floatingPanel");
    const closeBtn = floatingShadow.getElementById("panelCloseBtn");
    const toggleBtn = floatingShadow.getElementById("panelToggleBtn");
    const copyBtn = floatingShadow.getElementById("panelCopyBtn");
    const saveBtn = floatingShadow.getElementById("panelSaveBtn");

    pill.addEventListener("click", () => {
      isFloatingExpanded = !isFloatingExpanded;
      panel.classList.toggle("open", isFloatingExpanded);
    });

    closeBtn.addEventListener("click", () => {
      isFloatingExpanded = false;
      panel.classList.remove("open");
    });

    toggleBtn.addEventListener("click", () => {
      if (isRecording) {
        stopRecording();
      } else {
        startRecording();
      }
      updateFloatingWidgetUI();
    });

    copyBtn.addEventListener("click", () => {
      if (engine.records.length === 0) {
        showFloatingToast("복사할 자막이 없습니다.");
        return;
      }
      const Formatter = window.AssemblyExportFormatter;
      const text = Formatter ? Formatter.formatToText(engine.records, document.title, "both") : "";
      navigator.clipboard.writeText(text).then(() => {
        showFloatingToast("클립보드에 복사되었습니다.");
      });
    });

    saveBtn.addEventListener("click", () => {
      if (engine.records.length === 0) {
        showFloatingToast("저장할 자막이 없습니다.");
        return;
      }
      const Formatter = window.AssemblyExportFormatter;
      if (!Formatter) return;
      const rawTitle = document.title || "국회_의사중계_자막";
      const cleanTitle = rawTitle.replace(/[\\/:*?"<>|\r\n\t\x00-\x1f]/g, "_").trim();
      const dateStr = new Date().toISOString().slice(0, 10);
      const format = autoSaveFormat === "md" ? "md" : "txt";
      const content = format === "md" ? Formatter.formatToMarkdown(engine.records, rawTitle, "both") : Formatter.formatToText(engine.records, rawTitle, "both");
      downloadBlob(content, format === "md" ? "text/markdown" : "text/plain", `${cleanTitle}_${dateStr}.${format}`);
      showFloatingToast("다운로드가 시작되었습니다.");
    });

    updateFloatingWidgetUI();
  }

  /**
   * 자막 수집 시작 및 스토리지 상태 동기화
   * Starts subtitle recording and synchronizes state to storage
   * @returns {void}
   */
  function startRecording() {
    isRecording = true;
    engine.startObserving();
    setupAutoSaveTimer();
    updateFloatingWidgetUI();
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ [STORAGE_KEYS.IS_RECORDING]: true });
    }
  }

  /**
   * 자막 수집 중단 및 스토리지 상태 동기화
   * Stops subtitle recording and synchronizes state to storage
   * @returns {void}
   */
  function stopRecording() {
    isRecording = false;
    engine.stopObserving();
    setupAutoSaveTimer();
    updateFloatingWidgetUI();
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ [STORAGE_KEYS.IS_RECORDING]: false });
    }
  }

  // 1. 로컬 스토리지에 저장된 이전 수집 상태 및 설정 복원
  // 1. Restore previous recording state and configuration from chrome.storage.local
  if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get([
      STORAGE_KEYS.RECORDS,
      STORAGE_KEYS.IS_RECORDING,
      STORAGE_KEYS.CUSTOM_SELECTOR,
      STORAGE_KEYS.PAUSE_THRESHOLD_MS,
      STORAGE_KEYS.AUTO_SAVE_INTERVAL_MIN,
      STORAGE_KEYS.AUTO_SAVE_FORMAT,
      STORAGE_KEYS.SHOW_FLOATING_WIDGET
    ], (data) => {
      if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.lastError) {
        console.warn(
          "[Assembly Collector] Failed to load local storage / 로컬 스토리지 로드 실패:",
          chrome.runtime.lastError.message
        );
        return;
      }

      if (!data) {
        return;
      }

      // 수집된 레코드 복원 (엔진 내부 상태 및 lastLoggedText/lastRecordTime 함께 복구)
      // Restore collected records (recovers internal state, lastLoggedText, and lastRecordTime)
      if (Array.isArray(data[STORAGE_KEYS.RECORDS])) {
        engine.initRecords(data[STORAGE_KEYS.RECORDS]);
      }

      // 사용자 정의 선택자 복원
      // Restore user-defined custom selector
      if (typeof data[STORAGE_KEYS.CUSTOM_SELECTOR] === "string") {
        engine.customSelector = data[STORAGE_KEYS.CUSTOM_SELECTOR].trim();
      }

      // 문단 분할 침묵 기준 시간 복원
      // Restore pause threshold for paragraph splitting
      if (typeof data[STORAGE_KEYS.PAUSE_THRESHOLD_MS] === "number" && data[STORAGE_KEYS.PAUSE_THRESHOLD_MS] > 0) {
        engine.pauseThresholdMs = data[STORAGE_KEYS.PAUSE_THRESHOLD_MS];
      }

      // 자동 파일 저장 설정 복원
      // Restore auto-save interval and format
      if (typeof data[STORAGE_KEYS.AUTO_SAVE_INTERVAL_MIN] === "number") {
        autoSaveIntervalMin = data[STORAGE_KEYS.AUTO_SAVE_INTERVAL_MIN];
      }

      if (data[STORAGE_KEYS.AUTO_SAVE_FORMAT] === "md" || data[STORAGE_KEYS.AUTO_SAVE_FORMAT] === "txt") {
        autoSaveFormat = data[STORAGE_KEYS.AUTO_SAVE_FORMAT];
      }

      if (typeof data[STORAGE_KEYS.SHOW_FLOATING_WIDGET] === "boolean") {
        showFloatingWidget = data[STORAGE_KEYS.SHOW_FLOATING_WIDGET];
      }

      // 활성 수집 상태였던 경우 수집 자동 재개
      // Automatically resume recording if it was active
      if (Boolean(data[STORAGE_KEYS.IS_RECORDING])) {
        startRecording();
      } else {
        updateFloatingWidgetUI();
      }
    });
  }

  // DOM 로드 시 플로팅 위젯 초기화
  // Initialize in-page floating widget on DOM load
  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", initFloatingWidget);
    } else {
      initFloatingWidget();
    }
  }

  // 2. 신규 자막 레코드 추가 및 갱신 시 로컬 스토리지 자동 저장 콜백 연결
  // 2. Connect callback to auto-persist records to local storage upon addition or update
  engine.onRecordAdded = (_record, allRecords) => {
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ [STORAGE_KEYS.RECORDS]: allRecords });
    }
    updateFloatingWidgetUI();
  };

  // 3. 확장 프로그램 팝업 및 백그라운드와의 런타임 메시지 수신 리스너 등록
  // 3. Register runtime message listener for communication with popup and background
  if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
      if (!request || typeof request.action !== "string") {
        return false;
      }

      switch (request.action) {
        case MESSAGE_ACTIONS.GET_STATUS: {
          const pageTitle = (typeof document !== "undefined" && typeof document.title === "string")
            ? document.title
            : "";
          sendResponse({
            isRecording: isRecording,
            records: engine.records,
            customSelector: engine.customSelector,
            pauseThresholdMs: engine.pauseThresholdMs,
            autoSaveIntervalMin: autoSaveIntervalMin,
            autoSaveFormat: autoSaveFormat,
            showFloatingWidget: showFloatingWidget,
            title: pageTitle
          });
          return false;
        }

        case MESSAGE_ACTIONS.TOGGLE_RECORDING: {
          if (request.customSelector !== undefined && typeof request.customSelector === "string") {
            engine.customSelector = request.customSelector.trim();
            if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
              chrome.storage.local.set({ [STORAGE_KEYS.CUSTOM_SELECTOR]: engine.customSelector });
            }
          }

          if (request.pauseThresholdMs !== undefined && typeof request.pauseThresholdMs === "number" && request.pauseThresholdMs > 0) {
            engine.pauseThresholdMs = request.pauseThresholdMs;
            if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
              chrome.storage.local.set({ [STORAGE_KEYS.PAUSE_THRESHOLD_MS]: engine.pauseThresholdMs });
            }
          }

          if (isRecording) {
            stopRecording();
          } else {
            startRecording();
          }

          sendResponse({
            isRecording: isRecording,
            records: engine.records,
            customSelector: engine.customSelector,
            pauseThresholdMs: engine.pauseThresholdMs,
            autoSaveIntervalMin: autoSaveIntervalMin,
            autoSaveFormat: autoSaveFormat,
            showFloatingWidget: showFloatingWidget
          });
          return false;
        }

        case MESSAGE_ACTIONS.UPDATE_CONFIG: {
          if (request.customSelector !== undefined && typeof request.customSelector === "string") {
            engine.customSelector = request.customSelector.trim();
            if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
              chrome.storage.local.set({ [STORAGE_KEYS.CUSTOM_SELECTOR]: engine.customSelector });
            }
          }

          if (request.pauseThresholdMs !== undefined && typeof request.pauseThresholdMs === "number" && request.pauseThresholdMs > 0) {
            engine.pauseThresholdMs = request.pauseThresholdMs;
            if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
              chrome.storage.local.set({ [STORAGE_KEYS.PAUSE_THRESHOLD_MS]: engine.pauseThresholdMs });
            }
          }

          if (typeof request.autoSaveIntervalMin === "number") {
            autoSaveIntervalMin = request.autoSaveIntervalMin;
            setupAutoSaveTimer();
            if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
              chrome.storage.local.set({ [STORAGE_KEYS.AUTO_SAVE_INTERVAL_MIN]: autoSaveIntervalMin });
            }
          }

          if (request.autoSaveFormat === "txt" || request.autoSaveFormat === "md") {
            autoSaveFormat = request.autoSaveFormat;
            if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
              chrome.storage.local.set({ [STORAGE_KEYS.AUTO_SAVE_FORMAT]: autoSaveFormat });
            }
          }

          if (typeof request.showFloatingWidget === "boolean") {
            showFloatingWidget = request.showFloatingWidget;
            initFloatingWidget();
            if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
              chrome.storage.local.set({ [STORAGE_KEYS.SHOW_FLOATING_WIDGET]: showFloatingWidget });
            }
          }

          // 수집 중인 상태에서 설정이 변경된 경우 새로운 설정으로 DOM 감시 재시작
          // Restart DOM observation with updated settings if recording is active
          if (isRecording) {
            engine.startObserving();
          }

          updateFloatingWidgetUI();
          sendResponse({ success: true });
          return false;
        }

        case MESSAGE_ACTIONS.CLEAR_DATA: {
          engine.clear();
          lastAutoSavedCount = 0;
          updateFloatingWidgetUI();
          if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
            chrome.storage.local.set({ [STORAGE_KEYS.RECORDS]: [] }, () => {
              sendResponse({
                isRecording: isRecording,
                records: engine.records,
                customSelector: engine.customSelector,
                pauseThresholdMs: engine.pauseThresholdMs,
                autoSaveIntervalMin: autoSaveIntervalMin,
                autoSaveFormat: autoSaveFormat,
                showFloatingWidget: showFloatingWidget
              });
            });
            return true; // 비동기 콜백 응답 대기를 위해 true 반환 / Return true to keep message channel open for async response
          }

          sendResponse({
            isRecording: isRecording,
            records: engine.records,
            customSelector: engine.customSelector,
            pauseThresholdMs: engine.pauseThresholdMs,
            autoSaveIntervalMin: autoSaveIntervalMin,
            autoSaveFormat: autoSaveFormat,
            showFloatingWidget: showFloatingWidget
          });
          return false;
        }

        default:
          return false;
      }
    });
  }

  // 디버깅 및 단위 테스트용 전역 참조 등록
  // Expose internal references for debugging and unit testing
  if (typeof window !== "undefined") {
    /** @type {any} */ (window).__assemblyCollector = {
      engine,
      getIsRecording: () => isRecording,
      startRecording,
      stopRecording,
      MESSAGE_ACTIONS
    };
  }
})();
