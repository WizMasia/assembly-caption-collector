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
    PAUSE_THRESHOLD_MS: "assembly_pause_threshold_ms"
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
   * 자막 수집 시작 및 스토리지 상태 동기화
   * Starts subtitle recording and synchronizes state to storage
   * @returns {void}
   */
  function startRecording() {
    isRecording = true;
    engine.startObserving();
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
      STORAGE_KEYS.PAUSE_THRESHOLD_MS
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

      // 활성 수집 상태였던 경우 수집 자동 재개
      // Automatically resume recording if it was active
      if (Boolean(data[STORAGE_KEYS.IS_RECORDING])) {
        startRecording();
      }
    });
  }

  // 2. 신규 자막 레코드 추가 및 갱신 시 로컬 스토리지 자동 저장 콜백 연결
  // 2. Connect callback to auto-persist records to local storage upon addition or update
  engine.onRecordAdded = (_record, allRecords) => {
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ [STORAGE_KEYS.RECORDS]: allRecords });
    }
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
            pauseThresholdMs: engine.pauseThresholdMs
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

          // 수집 중인 상태에서 설정이 변경된 경우 새로운 설정으로 DOM 감시 재시작
          // Restart DOM observation with updated settings if recording is active
          if (isRecording) {
            engine.startObserving();
          }

          sendResponse({ success: true });
          return false;
        }

        case MESSAGE_ACTIONS.CLEAR_DATA: {
          engine.clear();
          if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
            chrome.storage.local.set({ [STORAGE_KEYS.RECORDS]: [] }, () => {
              sendResponse({
                isRecording: isRecording,
                records: engine.records,
                customSelector: engine.customSelector,
                pauseThresholdMs: engine.pauseThresholdMs
              });
            });
            return true; // 비동기 콜백 응답 대기를 위해 true 반환 / Return true to keep message channel open for async response
          }

          sendResponse({
            isRecording: isRecording,
            records: engine.records,
            customSelector: engine.customSelector,
            pauseThresholdMs: engine.pauseThresholdMs
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
