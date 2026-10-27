/**
 * @file popup.js
 * @description 팝업 인터랙션, 실시간 프리뷰 렌더링, 다운로드 및 설정 제어 컨트롤러
 * Popup interaction, live preview rendering, export download & settings controller
 */

/**
 * @typedef {import("../utils/export-formatter.js").CaptionRecord} CaptionRecord
 */

/**
 * @typedef {Object} PopupState
 * @property {boolean} [isRecording] - 수집 활성화 여부 / Whether recording is active
 * @property {Array<CaptionRecord>} [records] - 자막 레코드 목록 / Subtitle record list
 * @property {string} [customSelector] - 사용자 정의 CSS 선택자 / Custom CSS selector
 * @property {number} [pauseThresholdMs] - 문단 분할 기준 밀리초 / Paragraph pause threshold in ms
 * @property {string} [title] - 페이지 제목 / Webcast page title
 */

document.addEventListener("DOMContentLoaded", async () => {
  /**
   * 중앙 상수 및 유틸리티 참조
   * References to centralized constants and utilities
   */
  const Constants = window.AssemblyConstants || {};
  const Formatter = window.AssemblyExportFormatter || {};
  const i18n = (Constants.I18N && Constants.I18N.ko) || {};

  /**
   * 스토리지 키 매핑
   * Storage key mappings
   * @type {Record<string, string>}
   */
  const STORAGE_KEYS = Constants.STORAGE_KEYS || {
    RECORDS: "assembly_caption_records",
    IS_RECORDING: "assembly_is_recording",
    CUSTOM_SELECTOR: "assembly_custom_selector",
    TIMESTAMP_MODE: "assembly_timestamp_mode",
    PAUSE_THRESHOLD_MS: "assembly_pause_threshold_ms"
  };

  /**
   * 타이밍 및 UI 제어 상수
   * Timing and UI control constants
   */
  const PREVIEW_MAX_ITEMS = (Constants.TIMING && Constants.TIMING.PREVIEW_MAX_ITEMS) || 30;
  const DEFAULT_PAUSE_MS = (Constants.TIMING && Constants.TIMING.DEFAULT_PAUSE_THRESHOLD_MS) || 3000;
  const DEFAULT_PAUSE_SECONDS = Math.round(DEFAULT_PAUSE_MS / 1000);
  const TOAST_DURATION_MS = 2000;
  const DEFAULT_TIMESTAMP_MODE = (Constants.TIMESTAMP_MODES && Constants.TIMESTAMP_MODES.BOTH) || "both";
  const DEFAULT_FALLBACK_TITLE = "국회 의사중계 자막 기록";

  // DOM 엘리먼트 바인딩 / Bind DOM elements
  /** @type {HTMLElement|null} */
  const statusBadge = document.getElementById("statusBadge");
  /** @type {HTMLElement|null} */
  const txtStatus = document.getElementById("txtStatus");
  /** @type {HTMLElement|null} */
  const itemCountEl = document.getElementById("itemCount");
  /** @type {HTMLElement|null} */
  const lastTimeEl = document.getElementById("lastTime");
  /** @type {HTMLElement|null} */
  const previewList = document.getElementById("previewList");
  /** @type {HTMLElement|null} */
  const emptyNotice = document.getElementById("emptyNotice");
  /** @type {HTMLButtonElement|null} */
  const toggleBtn = /** @type {HTMLButtonElement|null} */ (document.getElementById("toggleBtn"));
  /** @type {HTMLElement|null} */
  const txtToggle = document.getElementById("txtToggle");
  /** @type {HTMLElement|null} */
  const iconToggle = toggleBtn ? toggleBtn.querySelector(".btn-icon-symbol") : null;
  /** @type {HTMLButtonElement|null} */
  const clearBtn = /** @type {HTMLButtonElement|null} */ (document.getElementById("clearBtn"));
  /** @type {HTMLButtonElement|null} */
  const downloadTxtBtn = /** @type {HTMLButtonElement|null} */ (document.getElementById("downloadTxtBtn"));
  /** @type {HTMLButtonElement|null} */
  const downloadMdBtn = /** @type {HTMLButtonElement|null} */ (document.getElementById("downloadMdBtn"));
  /** @type {HTMLButtonElement|null} */
  const copyAllBtn = /** @type {HTMLButtonElement|null} */ (document.getElementById("copyAllBtn"));
  /** @type {HTMLSelectElement|null} */
  const timestampModeSelect = /** @type {HTMLSelectElement|null} */ (document.getElementById("timestampModeSelect"));
  /** @type {HTMLInputElement|null} */
  const pauseThresholdInput = /** @type {HTMLInputElement|null} */ (document.getElementById("pauseThresholdInput"));
  /** @type {HTMLInputElement|null} */
  const selectorInput = /** @type {HTMLInputElement|null} */ (document.getElementById("selectorInput"));
  /** @type {HTMLElement|null} */
  const toast = document.getElementById("toast");

  /**
   * 현재 활성 탭 객체
   * Currently active browser tab
   * @type {chrome.tabs.Tab | null}
   */
  let activeTab = null;

  /**
   * 현재 메모리에 보유 중인 자막 레코드 목록
   * Subtitle records held in popup memory
   * @type {Array<CaptionRecord>}
   */
  let currentRecords = [];

  /**
   * 국회 회의 웹페이지 제목
   * Assembly webcast page title
   * @type {string}
   */
  let pageTitle = DEFAULT_FALLBACK_TITLE;

  /**
   * 현재 자막 수집 활성화 여부 상태값
   * Current subtitle recording active state flag
   * @type {boolean}
   */
  let isRecordingState = false;

  /**
   * 토스트 타이머 핸들러
   * Toast timer handle for auto-dismiss
   * @type {ReturnType<typeof setTimeout> | null}
   */
  let toastTimer = null;

  // 1. 활성 탭 조회
  // 1. Query active tab in the current window
  if (typeof chrome !== "undefined" && chrome.tabs && chrome.tabs.query) {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (Array.isArray(tabs) && tabs.length > 0) {
        activeTab = tabs[0];
      }
    } catch (err) {
      console.warn("[Assembly Popup] Failed to query active tab / 활성 탭 조회 실패:", err);
    }
  }

  /**
   * 사용자 피드백용 토스트 알림 표시
   * Displays toast notification for user feedback
   * @param {string} message - 표시할 텍스트 메시지 / Text message to show
   * @returns {void}
   */
  function showToast(message) {
    if (!toast) return;

    toast.textContent = message;
    toast.classList.add("show");

    if (toastTimer) {
      clearTimeout(toastTimer);
    }

    toastTimer = setTimeout(() => {
      toast.classList.remove("show");
      toastTimer = null;
    }, TOAST_DURATION_MS);
  }

  /**
   * 실시간 자막 스트림 프리뷰 렌더링
   * Renders the real-time subtitle stream preview list
   * @param {Array<CaptionRecord>} records - 자막 레코드 배열 / Subtitle record array
   * @param {string} tsMode - 타임스탬프 형식 모드 / Timestamp display mode
   * @returns {void}
   */
  function renderPreview(records, tsMode) {
    if (!previewList) return;

    previewList.innerHTML = "";

    if (!records || !Array.isArray(records) || records.length === 0) {
      if (emptyNotice) {
        previewList.appendChild(emptyNotice);
      }
      return;
    }

    // 최근 최대 N개 항목만 추출하여 렌더링
    // Slice and render recent items up to PREVIEW_MAX_ITEMS
    const recentRecords = records.slice(-PREVIEW_MAX_ITEMS);
    const fragment = document.createDocumentFragment();

    recentRecords.forEach((item) => {
      const itemEl = document.createElement("div");
      itemEl.className = `preview-item ${item.isParagraphStart ? "para-start" : ""}`.trim();

      const metaEl = document.createElement("div");
      metaEl.className = "preview-meta";

      const formattedTs = (Formatter && typeof Formatter.formatTimestamp === "function")
        ? Formatter.formatTimestamp(item.timestamp, item.playerTime, tsMode)
        : item.timestamp;
      metaEl.textContent = `[${formattedTs}]`;

      const textEl = document.createElement("div");
      textEl.className = "preview-text";
      textEl.textContent = item.text || "";

      itemEl.appendChild(metaEl);
      itemEl.appendChild(textEl);
      fragment.appendChild(itemEl);
    });

    previewList.appendChild(fragment);

    // 자동 스크롤 맨 아래로 이동
    // Auto-scroll to the bottom of the list
    previewList.scrollTop = previewList.scrollHeight;
  }

  /**
   * 팝업 전체 UI 상태 갱신
   * Updates overall popup UI according to current state
   * @param {PopupState} state - 수집기 상태 객체 / Collector state object
   * @returns {void}
   */
  function updateUI(state) {
    if (!state) return;

    const isRecording = Boolean(state.isRecording);
    isRecordingState = isRecording;
    currentRecords = Array.isArray(state.records) ? state.records : [];

    if (state.title && typeof state.title === "string" && state.title.trim().length > 0) {
      pageTitle = state.title.trim();
    }

    // 1. 수집 토글 버튼 및 상태 뱃지 업데이트
    // 1. Update toggle button and status badge
    if (toggleBtn && txtToggle) {
      if (isRecording) {
        txtToggle.textContent = i18n.stopRecord || "수집 중지";
        toggleBtn.className = "btn btn-danger";
        if (iconToggle) iconToggle.textContent = "⏹";
      } else {
        txtToggle.textContent = i18n.startRecord || "수집 시작";
        toggleBtn.className = "btn btn-primary";
        if (iconToggle) iconToggle.textContent = "▶";
      }
    }

    if (statusBadge && txtStatus) {
      if (isRecording) {
        statusBadge.className = "status-badge status-recording";
        txtStatus.textContent = i18n.statusRecording || "수집 중";
      } else {
        statusBadge.className = "status-badge status-stopped";
        txtStatus.textContent = i18n.statusStopped || "대기 중";
      }
    }

    // 2. 수집 문장 수 및 최근 수집 시각 업데이트
    // 2. Update sentence count and last collected timestamp
    if (itemCountEl) {
      itemCountEl.textContent = String(currentRecords.length);
    }

    if (lastTimeEl) {
      lastTimeEl.textContent = currentRecords.length > 0
        ? (currentRecords[currentRecords.length - 1].timestamp || "-")
        : "-";
    }

    // 3. 자막 실시간 프리뷰 렌더링
    // 3. Render real-time subtitle preview
    const currentMode = (timestampModeSelect && timestampModeSelect.value)
      ? timestampModeSelect.value
      : DEFAULT_TIMESTAMP_MODE;
    renderPreview(currentRecords, currentMode);

    // 4. 입력 필드 값 갱신 (제공된 경우)
    // 4. Update input field values if provided
    if (selectorInput && typeof state.customSelector === "string") {
      selectorInput.value = state.customSelector;
    }

    if (pauseThresholdInput && typeof state.pauseThresholdMs === "number" && state.pauseThresholdMs > 0) {
      pauseThresholdInput.value = String(Math.round(state.pauseThresholdMs / 1000));
    }
  }

  // 2. 크롬 스토리지에서 이전 상태 및 설정 복원
  // 2. Restore previous state and configuration from chrome.storage.local
  if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get([
      STORAGE_KEYS.RECORDS,
      STORAGE_KEYS.IS_RECORDING,
      STORAGE_KEYS.CUSTOM_SELECTOR,
      STORAGE_KEYS.TIMESTAMP_MODE,
      STORAGE_KEYS.PAUSE_THRESHOLD_MS
    ], (data) => {
      if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.lastError) {
        console.warn("[Assembly Popup] Failed to read storage / 스토리지 읽기 실패:", chrome.runtime.lastError.message);
        return;
      }

      if (!data) return;

      if (timestampModeSelect && data[STORAGE_KEYS.TIMESTAMP_MODE]) {
        timestampModeSelect.value = data[STORAGE_KEYS.TIMESTAMP_MODE];
      }

      updateUI({
        isRecording: Boolean(data[STORAGE_KEYS.IS_RECORDING]),
        records: Array.isArray(data[STORAGE_KEYS.RECORDS]) ? data[STORAGE_KEYS.RECORDS] : [],
        customSelector: data[STORAGE_KEYS.CUSTOM_SELECTOR] || "",
        pauseThresholdMs: typeof data[STORAGE_KEYS.PAUSE_THRESHOLD_MS] === "number"
          ? data[STORAGE_KEYS.PAUSE_THRESHOLD_MS]
          : DEFAULT_PAUSE_MS
      });

      // 3. 활성 탭과 통신하여 현재 수집 상태 실시간 동기화
      // 3. Communicate with active tab to sync live recording status
      if (activeTab && activeTab.id) {
        chrome.tabs.sendMessage(activeTab.id, { action: "GET_STATUS" }, (response) => {
          if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.lastError) {
            // 주입되지 않은 탭(다른 사이트나 시스템 페이지)에서는 무시
            // Ignore error when content script is not loaded (e.g. system tab or unsupported domain)
            return;
          }
          if (response) {
            updateUI(response);
          }
        });
      }
    });
  }

  // 4. 스토리지 변경 감지 리스너 (새 자막 수신 또는 상태 변경 시 자동 갱신)
  // 4. Storage change listener for auto-updating UI when new captions arrive
  if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "local") return;

      if (changes[STORAGE_KEYS.RECORDS]) {
        currentRecords = Array.isArray(changes[STORAGE_KEYS.RECORDS].newValue)
          ? changes[STORAGE_KEYS.RECORDS].newValue
          : [];

        if (itemCountEl) {
          itemCountEl.textContent = String(currentRecords.length);
        }

        if (lastTimeEl) {
          lastTimeEl.textContent = currentRecords.length > 0
            ? (currentRecords[currentRecords.length - 1].timestamp || "-")
            : "-";
        }

        const mode = (timestampModeSelect && timestampModeSelect.value)
          ? timestampModeSelect.value
          : DEFAULT_TIMESTAMP_MODE;
        renderPreview(currentRecords, mode);
      }

      if (changes[STORAGE_KEYS.IS_RECORDING]) {
        const isRec = Boolean(changes[STORAGE_KEYS.IS_RECORDING].newValue);
        isRecordingState = isRec;
        if (toggleBtn && txtToggle) {
          if (isRec) {
            txtToggle.textContent = i18n.stopRecord || "수집 중지";
            toggleBtn.className = "btn btn-danger";
            if (iconToggle) iconToggle.textContent = "⏹";
          } else {
            txtToggle.textContent = i18n.startRecord || "수집 시작";
            toggleBtn.className = "btn btn-primary";
            if (iconToggle) iconToggle.textContent = "▶";
          }
        }

        if (statusBadge && txtStatus) {
          if (isRec) {
            statusBadge.className = "status-badge status-recording";
            txtStatus.textContent = i18n.statusRecording || "수집 중";
          } else {
            statusBadge.className = "status-badge status-stopped";
            txtStatus.textContent = i18n.statusStopped || "대기 중";
          }
        }
      }

      if (changes[STORAGE_KEYS.CUSTOM_SELECTOR] && selectorInput && document.activeElement !== selectorInput) {
        selectorInput.value = changes[STORAGE_KEYS.CUSTOM_SELECTOR].newValue || "";
      }

      if (changes[STORAGE_KEYS.PAUSE_THRESHOLD_MS] && pauseThresholdInput && document.activeElement !== pauseThresholdInput) {
        const ms = changes[STORAGE_KEYS.PAUSE_THRESHOLD_MS].newValue;
        if (typeof ms === "number" && ms > 0) {
          pauseThresholdInput.value = String(Math.round(ms / 1000));
        }
      }
    });
  }

  // 5. 수집 토글 버튼 클릭 이벤트
  // 5. Toggle recording button click handler
  if (toggleBtn) {
    toggleBtn.addEventListener("click", () => {
      if (!activeTab || !activeTab.id) {
        showToast("활성화된 국회 의사중계 탭을 찾을 수 없습니다.");
        return;
      }

      const selectorVal = selectorInput ? selectorInput.value.trim() : "";
      const pauseSec = Math.max(1, Number(pauseThresholdInput ? pauseThresholdInput.value : DEFAULT_PAUSE_SECONDS) || DEFAULT_PAUSE_SECONDS);
      const pauseMs = pauseSec * 1000;

      chrome.tabs.sendMessage(activeTab.id, {
        action: "TOGGLE_RECORDING",
        customSelector: selectorVal,
        pauseThresholdMs: pauseMs
      }, (response) => {
        if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.lastError) {
          showToast("국회 의사중계 페이지가 열려 있는지 확인해주세요.");
          return;
        }
        if (response) {
          updateUI(response);
        }
      });
    });
  }

  // 6. 전체 복사 버튼 클릭 이벤트
  // 6. Copy all button click handler
  if (copyAllBtn) {
    copyAllBtn.addEventListener("click", () => {
      if (!currentRecords || currentRecords.length === 0) {
        showToast(i18n.noData || "수집된 자막이 없습니다.");
        return;
      }

      const mode = (timestampModeSelect && timestampModeSelect.value)
        ? timestampModeSelect.value
        : DEFAULT_TIMESTAMP_MODE;

      const textContent = (Formatter && typeof Formatter.formatToText === "function")
        ? Formatter.formatToText(currentRecords, pageTitle, mode)
        : currentRecords.map((r) => `[${r.timestamp}] ${r.text}`).join("\n");

      if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
        navigator.clipboard.writeText(textContent)
          .then(() => {
            showToast(i18n.copySuccess || "클립보드에 복사되었습니다.");
          })
          .catch((err) => {
            console.error("[Assembly Popup] Clipboard copy error / 클립보드 복사 실패:", err);
            showToast("복사에 실패했습니다. 권한을 확인해주세요.");
          });
      } else {
        // 클립보드 API 미지원 환경 대비 폴백
        // Fallback for environments lacking clipboard API
        showToast("클립보드 API가 지원되지 않는 환경입니다.");
      }
    });
  }

  // 7. 기록 초기화 버튼 클릭 이벤트
  // 7. Clear records button click handler
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      const confirmMsg = i18n.clearConfirm || "수집된 모든 자막 기록을 초기화하시겠습니까?";
      if (!confirm(confirmMsg)) {
        return;
      }

      if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ [STORAGE_KEYS.RECORDS]: [] }, () => {
          currentRecords = [];
          updateUI({ isRecording: isRecordingState, records: [] });

          if (activeTab && activeTab.id) {
            chrome.tabs.sendMessage(activeTab.id, { action: "CLEAR_DATA" }, (res) => {
              if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.lastError) {
                return;
              }
              if (res) {
                updateUI(res);
              }
            });
          }
          showToast("기록이 초기화되었습니다.");
        });
      }
    });
  }

  /**
   * 가상 앵커를 통한 파일 다운로드 헬퍼
   * Triggers file download via dynamic anchor element
   * @param {string} content - 파일에 기록할 텍스트 / Text content to write
   * @param {string} mimeType - 파일 MIME 타입 / File MIME type
   * @param {string} filename - 파일 이름 / Output file name
   * @returns {void}
   */
  function triggerDownload(content, mimeType, filename) {
    const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * 파일명에 사용할 수 없는 특수문자 치환 헬퍼
   * Cleans filename by replacing invalid characters
   * @param {string} name - 원본 문서 제목 / Original document title
   * @returns {string} 안전한 파일명 / Safe filename
   */
  function sanitizeFilename(name) {
    const fallback = (Constants.I18N && Constants.I18N.ko && Constants.I18N.ko.appTitle)
      ? Constants.I18N.ko.appTitle.replace(/\s+/g, "_")
      : "국회_의사중계_자막";
    const cleaned = (name || fallback).replace(/[\\/:*?"<>|]/g, "_").trim();
    return cleaned.length > 0 ? cleaned : fallback;
  }

  // 8. TXT 다운로드 버튼 클릭 이벤트
  // 8. TXT download button click handler
  if (downloadTxtBtn) {
    downloadTxtBtn.addEventListener("click", () => {
      if (!currentRecords || currentRecords.length === 0) {
        alert(i18n.noData || "다운로드할 자막 기록이 없습니다.");
        return;
      }

      const cleanTitle = sanitizeFilename(pageTitle);
      const dateStr = new Date().toISOString().slice(0, 10);
      const mode = (timestampModeSelect && timestampModeSelect.value)
        ? timestampModeSelect.value
        : DEFAULT_TIMESTAMP_MODE;

      const content = (Formatter && typeof Formatter.formatToText === "function")
        ? Formatter.formatToText(currentRecords, cleanTitle, mode)
        : currentRecords.map((r) => `[${r.timestamp}] ${r.text}`).join("\n");

      triggerDownload(content, "text/plain", `${cleanTitle}_${dateStr}.txt`);
    });
  }

  // 9. Markdown 다운로드 버튼 클릭 이벤트
  // 9. Markdown download button click handler
  if (downloadMdBtn) {
    downloadMdBtn.addEventListener("click", () => {
      if (!currentRecords || currentRecords.length === 0) {
        alert(i18n.noData || "다운로드할 자막 기록이 없습니다.");
        return;
      }

      const cleanTitle = sanitizeFilename(pageTitle);
      const dateStr = new Date().toISOString().slice(0, 10);
      const mode = (timestampModeSelect && timestampModeSelect.value)
        ? timestampModeSelect.value
        : DEFAULT_TIMESTAMP_MODE;

      const content = (Formatter && typeof Formatter.formatToMarkdown === "function")
        ? Formatter.formatToMarkdown(currentRecords, cleanTitle, mode)
        : `# ${cleanTitle}\n\n` + currentRecords.map((r) => `- [${r.timestamp}] ${r.text}`).join("\n");

      triggerDownload(content, "text/markdown", `${cleanTitle}_${dateStr}.md`);
    });
  }

  // 10. 타임스탬프 표기 모드 셀렉트 변경 이벤트
  // 10. Timestamp mode select change handler
  if (timestampModeSelect) {
    timestampModeSelect.addEventListener("change", () => {
      const mode = timestampModeSelect.value;
      if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ [STORAGE_KEYS.TIMESTAMP_MODE]: mode });
      }
      renderPreview(currentRecords, mode);
    });
  }

  // 11. 문단 분할 침묵 기준 변경 이벤트
  // 11. Pause threshold input change handler
  if (pauseThresholdInput) {
    pauseThresholdInput.addEventListener("change", () => {
      const sec = Math.max(1, Number(pauseThresholdInput.value) || DEFAULT_PAUSE_SECONDS);
      const ms = sec * 1000;
      if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ [STORAGE_KEYS.PAUSE_THRESHOLD_MS]: ms });
      }
      if (activeTab && activeTab.id) {
        chrome.tabs.sendMessage(activeTab.id, {
          action: "UPDATE_CONFIG",
          pauseThresholdMs: ms
        }, () => {
          if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.lastError) {
            // 주입되지 않은 탭 무시 / Ignore unconnected tabs
          }
        });
      }
    });
  }

  // 12. 수동 CSS 선택자 변경 이벤트
  // 12. Custom CSS selector input change handler
  if (selectorInput) {
    selectorInput.addEventListener("change", () => {
      const val = selectorInput.value.trim();
      if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ [STORAGE_KEYS.CUSTOM_SELECTOR]: val });
      }
      if (activeTab && activeTab.id) {
        chrome.tabs.sendMessage(activeTab.id, {
          action: "UPDATE_CONFIG",
          customSelector: val
        }, () => {
          if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.lastError) {
            // 주입되지 않은 탭 무시 / Ignore unconnected tabs
          }
        });
      }
    });
  }
});
