/**
 * @file caption-engine.js
 * @description 실시간 국회 자막 감지, 중복 필터링 및 단락 분할 코어 엔진
 * Real-time caption detection, deduplication, and paragraph splitting core engine
 */

/**
 * @typedef {Object} CaptionRecord
 * @property {string} id - 고유 레코드 식별자 / Unique record ID
 * @property {string} text - 정제된 자막 텍스트 본문 / Sanitized subtitle body text
 * @property {string} timestamp - PC 절대 시각 (HH:mm:ss) / PC absolute clock time
 * @property {string|null} playerTime - 영상 재생 시각 (HH:mm:ss 또는 mm:ss) / Video playback elapsed time
 * @property {string} date - 수집 일자 (YYYY-MM-DD) / Collection date
 * @property {boolean} isParagraphStart - 새 문단 시작 여부 / Whether this record starts a new paragraph
 */

/**
 * @typedef {Object} CaptionEngineOptions
 * @property {Array<string>} [candidateSelectors] - 자막 DOM 탐색용 선택자 목록 / Candidate CSS selectors for caption DOM
 * @property {number} [pauseThresholdMs] - 문단 분할 기준 침묵 밀리초 / Silence threshold in milliseconds for paragraph splitting
 * @property {number} [debounceMs] - DOM 변경 감지 디바운스 대기 밀리초 / Debounce delay in milliseconds for DOM mutations
 * @property {string} [customSelector] - 사용자 지정 자막 컨테이너 선택자 / Custom caption container selector
 * @property {Array<CaptionRecord>} [records] - 초기 복원 자막 레코드 목록 / Initial restored caption records
 * @property {((record: CaptionRecord, records: Array<CaptionRecord>) => void)|null} [onRecordAdded] - 신규 자막 추가 콜백 / Callback when record is added
 */

/**
 * 기본 후보 CSS 선택자 목록 (constants.js 연동 전 폴백 기본값)
 * Default candidate CSS selectors fallback before constants resolution
 * @type {ReadonlyArray<string>}
 */
let candidateSelectorsDefault = [
  "#viewSubtit .incont",
  "#viewSubtit",
  ".vjs-text-track-display",
  ".caption_box",
  "#captionText",
  ".player-subtitles",
  ".caption_area",
  "[class*='caption']",
  "[id*='caption']"
];

/**
 * 기본 문단 분할 침묵 기준 시간 (ms)
 * Default pause threshold for paragraph splitting in milliseconds
 * @type {number}
 */
let defaultPauseThresholdMs = 3000;

/**
 * 기본 DOM 변경 디바운스 대기 시간 (ms)
 * Default DOM mutation debounce delay in milliseconds
 * @type {number}
 */
let defaultDebounceMutationMs = 80;

// Node.js 환경에서 config/constants.js 불러오기 시도
// Try loading config/constants.js in Node.js environment
if (typeof require !== "undefined") {
  try {
    const constants = require("../config/constants.js");
    if (constants.CANDIDATE_SELECTORS && Array.isArray(constants.CANDIDATE_SELECTORS)) {
      candidateSelectorsDefault = constants.CANDIDATE_SELECTORS;
    }
    if (constants.TIMING && typeof constants.TIMING.DEFAULT_PAUSE_THRESHOLD_MS === "number") {
      defaultPauseThresholdMs = constants.TIMING.DEFAULT_PAUSE_THRESHOLD_MS;
    }
    if (constants.TIMING && typeof constants.TIMING.DEBOUNCE_MUTATION_MS === "number") {
      defaultDebounceMutationMs = constants.TIMING.DEBOUNCE_MUTATION_MS;
    }
  } catch (_) {
    // constants.js 파일이 없을 경우 기본값 유지 / Keep defaults if constants.js is not found
  }
} else {
  // 브라우저 전역 객체 AssemblyConstants 확인
  // Check browser global AssemblyConstants
  const globalScope = typeof window !== "undefined"
    ? window
    : (typeof globalThis !== "undefined" ? globalThis : null);

  if (globalScope && /** @type {any} */ (globalScope).AssemblyConstants) {
    const consts = /** @type {any} */ (globalScope).AssemblyConstants;
    if (consts.CANDIDATE_SELECTORS && Array.isArray(consts.CANDIDATE_SELECTORS)) {
      candidateSelectorsDefault = consts.CANDIDATE_SELECTORS;
    }
    if (consts.TIMING && typeof consts.TIMING.DEFAULT_PAUSE_THRESHOLD_MS === "number") {
      defaultPauseThresholdMs = consts.TIMING.DEFAULT_PAUSE_THRESHOLD_MS;
    }
    if (consts.TIMING && typeof consts.TIMING.DEBOUNCE_MUTATION_MS === "number") {
      defaultDebounceMutationMs = consts.TIMING.DEBOUNCE_MUTATION_MS;
    }
  }
}

/**
 * 2자리 숫자 0 채우기 포맷터
 * Pads number to two digits with leading zero
 * @param {number} num - 숫자 값 / Numeric value
 * @returns {string} 2자리 포맷 문자열 / Padded two-digit string
 */
function padTwoDigits(num) {
  return String(num).padStart(2, "0");
}

/**
 * 실시간 국회 자막 감지 및 중복 필터링 엔진
 * Core engine for real-time assembly caption detection and deduplication
 */
class CaptionEngine {
  /**
   * CaptionEngine 인스턴스 초기화
   * Initializes CaptionEngine instance
   * @param {CaptionEngineOptions} [options={}] - 엔진 설정 옵션 / Engine configuration options
   */
  constructor(options = {}) {
    /**
     * 자막 탐색 후보 CSS 선택자 배열
     * Candidate CSS selectors array for caption container lookup
     * @type {Array<string>}
     */
    this.candidateSelectors = (options.candidateSelectors && options.candidateSelectors.length > 0)
      ? [...options.candidateSelectors]
      : [...candidateSelectorsDefault];

    /**
     * 문단 분할 기준 침묵 시간 (밀리초)
     * Pause threshold in ms for paragraph splitting
     * @type {number}
     */
    this.pauseThresholdMs = typeof options.pauseThresholdMs === "number" && options.pauseThresholdMs > 0
      ? options.pauseThresholdMs
      : defaultPauseThresholdMs;

    /**
     * 사용자 정의 자막 DOM 선택자
     * User-defined custom caption DOM selector
     * @type {string}
     */
    this.customSelector = typeof options.customSelector === "string" ? options.customSelector.trim() : "";

    /**
     * DOM 변경 감지 디바운스 대기 시간 (밀리초)
     * Debounce delay in ms for DOM mutation detection
     * @type {number}
     */
    this.debounceMs = typeof options.debounceMs === "number" && options.debounceMs >= 0
      ? options.debounceMs
      : defaultDebounceMutationMs;

    /**
     * 수집된 자막 레코드 배열
     * Collected caption record array
     * @type {Array<CaptionRecord>}
     */
    this.records = [];

    /**
     * 가장 최근에 기록된 정제 텍스트
     * Most recently logged clean text
     * @type {string}
     */
    this.lastLoggedText = "";

    /**
     * 마지막 레코드 생성 시각 타임스탬프 (ms)
     * Timestamp of the last created record in ms
     * @type {number}
     */
    this.lastRecordTime = 0;

    /**
     * DOM 변경 감지 디바운스 타이머 식별자
     * Debounce timer handle for DOM mutation events
     * @type {NodeJS.Timeout|number|null}
     */
    this.debounceTimer = null;

    /**
     * 현재 옵저버가 감시 중인 대상 DOM 엘리먼트
     * Currently observed target DOM element
     * @type {Element|null}
     */
    this.observedTarget = null;

    /**
     * DOM 변경 감지기 인스턴스
     * MutationObserver instance for DOM changes
     * @type {MutationObserver|null}
     */
    this.observer = null;

    /**
     * 신규 레코드 등록 시 실행되는 콜백 함수
     * Callback invoked whenever a new caption record is added
     * @type {((record: CaptionRecord, records: Array<CaptionRecord>) => void)|null}
     */
    this.onRecordAdded = typeof options.onRecordAdded === "function" ? options.onRecordAdded : null;

    // 초기 전달된 복원 레코드가 있는 경우 상태 복원
    // Restore state if initial restored records are provided
    if (options.records && Array.isArray(options.records)) {
      this.initRecords(options.records);
    }
  }

  /**
   * 텍스트 공백 정규화 및 트림
   * Normalizes redundant whitespaces and trims text
   * @param {string} text - 원본 텍스트 / Raw input text
   * @returns {string} 공백 정규화된 텍스트 / Normalized text
   */
  cleanText(text) {
    if (!text || typeof text !== "string") {
      return "";
    }
    return text.replace(/\s+/g, " ").trim();
  }

  /**
   * 중복 및 점진적 음성인식 갱신 여부 검사
   * Checks if incoming text is duplicate or partial repetition
   * @param {string} currentText - 현재 들어온 정제 텍스트 / Current sanitized text
   * @param {string} lastText - 직전 기록된 정제 텍스트 / Last recorded sanitized text
   * @returns {boolean} 중복 여부 (true면 수집 생략) / True if duplicate, should skip
   */
  isDuplicate(currentText, lastText) {
    if (!currentText) {
      return true;
    }
    if (currentText === lastText) {
      return true;
    }
    // 직전 문장이 현재 문장을 접두사로 포함하는 경우 (음성인식 점진 갱신 중간 상태 필터링)
    // If lastText starts with currentText, currentText is a shorter substring of an already recorded sentence
    if (lastText && lastText.startsWith(currentText)) {
      return true;
    }
    return false;
  }

  /**
   * DOM 내 비디오 태그로부터 현재 재생 시각 추출
   * Extracts current video playback elapsed time from DOM video element
   * @returns {string|null} HH:mm:ss 또는 mm:ss 형식 문자열 / Formatted playback time or null
   */
  extractPlayerTime() {
    try {
      if (typeof document === "undefined") {
        return null;
      }
      /** @type {HTMLVideoElement|null} */
      const video = document.querySelector("video");
      if (!video || typeof video.currentTime !== "number" || Number.isNaN(video.currentTime) || video.currentTime < 0) {
        return null;
      }

      const totalSec = Math.floor(video.currentTime);
      const s = totalSec % 60;
      const m = Math.floor((totalSec / 60) % 60);
      const h = Math.floor(totalSec / 3600);

      if (h > 0) {
        return `${padTwoDigits(h)}:${padTwoDigits(m)}:${padTwoDigits(s)}`;
      }
      return `${padTwoDigits(m)}:${padTwoDigits(s)}`;
    } catch (_) {
      return null;
    }
  }

  /**
   * 새로운 자막 레코드 객체 생성
   * Creates a structured subtitle record
   * @param {string} cleanText - 정제된 자막 텍스트 / Sanitized subtitle text
   * @param {string|null} [customTimestamp=null] - 사용자 지정 PC 시각 / Custom PC timestamp
   * @param {string|null} [customPlayerTime=null] - 사용자 지정 플레이어 시각 / Custom player playback time
   * @returns {CaptionRecord} 생성된 자막 레코드 / Constructed caption record
   */
  createRecord(cleanText, customTimestamp = null, customPlayerTime = null) {
    const now = new Date();
    const pcTimestamp = customTimestamp
      || `${padTwoDigits(now.getHours())}:${padTwoDigits(now.getMinutes())}:${padTwoDigits(now.getSeconds())}`;
    const playerTime = customPlayerTime !== undefined && customPlayerTime !== null
      ? customPlayerTime
      : this.extractPlayerTime();
    const currentTimeMs = Date.now();

    // 직전 수집 시각과 비교하여 침묵 텀(pause threshold) 초과 시 새 문단 플래그 지정
    // Set paragraph start flag if pause threshold is exceeded compared to last record time
    const isParagraphStart = this.lastRecordTime > 0
      && (currentTimeMs - this.lastRecordTime) >= this.pauseThresholdMs;

    const randomSuffix = Math.random().toString(36).slice(2, 7);
    /** @type {CaptionRecord} */
    const record = {
      id: `${currentTimeMs}-${randomSuffix}`,
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
   * Finds target caption DOM element container
   * @returns {Element|null} 탐색된 DOM 엘리먼트 또는 null / Found DOM element or null
   */
  findCaptionContainer() {
    if (typeof document === "undefined") {
      return null;
    }

    if (this.customSelector) {
      try {
        const customEl = document.querySelector(this.customSelector);
        if (customEl) {
          return customEl;
        }
      } catch (_) {
        // 잘못된 선택자 문법 무시 / Ignore invalid selector syntax
      }
    }

    for (const selector of this.candidateSelectors) {
      try {
        const candidateEl = document.querySelector(selector);
        if (candidateEl) {
          return candidateEl;
        }
      } catch (_) {
        // 선택자 탐색 오류 무시 / Ignore selector query errors
      }
    }

    return null;
  }

  /**
   * 스토리지에서 복원된 자막 레코드 목록 초기화 및 엔진 내부 상태 복구
   * Initializes records restored from storage and recovers engine internal state
   * @param {Array<CaptionRecord>} [records=[]] - 복원할 자막 레코드 목록 / Caption records to restore
   * @returns {void}
   */
  initRecords(records) {
    if (Array.isArray(records) && records.length > 0) {
      this.records = [...records];
      const lastRecord = this.records[this.records.length - 1];
      this.lastLoggedText = (lastRecord && typeof lastRecord.text === "string") ? lastRecord.text : "";

      // 마지막 레코드 ID에서 밀리초 타임스탬프 파싱 시도 (형식: {timestamp}-{suffix})
      // Attempt to parse millisecond timestamp from last record ID (format: {timestamp}-{suffix})
      let restoredTime = Date.now();
      if (lastRecord && typeof lastRecord.id === "string") {
        const parsedTime = parseInt(lastRecord.id.split("-")[0], 10);
        if (!Number.isNaN(parsedTime) && parsedTime > 0) {
          restoredTime = parsedTime;
        }
      }
      this.lastRecordTime = restoredTime;
    } else {
      this.records = [];
      this.lastLoggedText = "";
      this.lastRecordTime = 0;
    }
  }

  /**
   * DOM 변경 감지 시 전달받은 원본 텍스트 처리 (점진적 STT 갱신 포함)
   * Handles caption mutation events, supports progressive STT streaming updates, and adds records
   * @param {string} rawText - 감지된 DOM 원본 텍스트 / Raw text detected from DOM
   * @returns {CaptionRecord|null} 추가 또는 갱신된 레코드 또는 null / Added or updated record or null
   */
  handleMutationText(rawText) {
    const clean = this.cleanText(rawText);
    if (!clean || this.isDuplicate(clean, this.lastLoggedText)) {
      return null;
    }

    const currentTimeMs = Date.now();

    // 점진적 음성인식 스트리밍(STT 텍스트 점진 확장) 감지:
    // 직전 수집 텍스트로 시작하고 침묵 기준 시간(pauseThresholdMs) 이내인 경우 기존 마지막 레코드 본문 갱신
    // Progressive STT streaming expansion:
    // When cleanText starts with lastLoggedText within pauseThresholdMs and lastLoggedText is non-empty, update last record
    const isExpandingLastRecord = Boolean(this.lastLoggedText)
      && this.records.length > 0
      && clean.startsWith(this.lastLoggedText)
      && (currentTimeMs - this.lastRecordTime) < this.pauseThresholdMs;

    if (isExpandingLastRecord) {
      const lastRecord = this.records[this.records.length - 1];
      lastRecord.text = clean;
      this.lastLoggedText = clean;
      this.lastRecordTime = currentTimeMs;

      if (typeof this.onRecordAdded === "function") {
        try {
          this.onRecordAdded(lastRecord, this.records);
        } catch (_) {
          // 콜백 오류 무시 / Suppress callback errors
        }
      }

      return lastRecord;
    }

    const record = this.createRecord(clean);
    this.records.push(record);
    this.lastLoggedText = clean;

    if (typeof this.onRecordAdded === "function") {
      try {
        this.onRecordAdded(record, this.records);
      } catch (_) {
        // 콜백 오류 무시 / Suppress callback errors
      }
    }

    return record;
  }

  /**
   * MutationObserver를 통한 자막 DOM 감시 시작 (디바운스 및 동적 대상 재지정 적용)
   * Starts observing caption DOM mutations using MutationObserver (debounced with dynamic retargeting)
   */
  startObserving() {
    this.stopObserving();
    if (typeof document === "undefined" || typeof MutationObserver === "undefined") {
      return;
    }

    const initialContainer = this.findCaptionContainer();
    const target = initialContainer || document.body;
    if (!target) {
      return;
    }

    this.observedTarget = target;
    this.observer = new MutationObserver(() => {
      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer);
        this.debounceTimer = null;
      }

      this.debounceTimer = setTimeout(() => {
        this.debounceTimer = null;

        const currentContainer = this.findCaptionContainer();
        if (currentContainer) {
          // document.body를 감시 중이었으나 구체적인 자막 컨테이너가 탐색된 경우 옵저버 대상 재지정
          // Retarget observer to the discovered caption container if initially observing document.body
          if (this.observedTarget !== currentContainer && this.observer) {
            this.observer.disconnect();
            this.observedTarget = currentContainer;
            this.observer.observe(currentContainer, {
              childList: true,
              subtree: true,
              characterData: true
            });
          }

          /** @type {HTMLElement} */
          const htmlContainer = /** @type {HTMLElement} */ (currentContainer);
          const text = htmlContainer.innerText || htmlContainer.textContent || "";
          this.handleMutationText(text);
        }
      }, this.debounceMs);
    });

    this.observer.observe(target, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }

  /**
   * 자막 DOM 감시 중단 및 옵저버/디바운스 타이머 해제
   * Stops observing DOM mutations and cleans up observer/debounce timer
   */
  stopObserving() {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    this.observedTarget = null;
  }

  /**
   * 메모리에 저장된 자막 기록, 디바운스 타이머 및 이전 상태 초기화
   * Clears in-memory records, debounce timer, and internal state
   */
  clear() {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    this.records = [];
    this.lastLoggedText = "";
    this.lastRecordTime = 0;
  }
}

// 브라우저 및 Node.js 환경 내보내기 지원
// Support exports for both CommonJS and Browser environments (window / globalThis)
if (typeof module !== "undefined" && module.exports) {
  module.exports = { CaptionEngine };
}

if (typeof window !== "undefined") {
  /** @type {any} */ (window).AssemblyCaptionEngine = CaptionEngine;
} else if (typeof globalThis !== "undefined") {
  /** @type {any} */ (globalThis).AssemblyCaptionEngine = CaptionEngine;
}
