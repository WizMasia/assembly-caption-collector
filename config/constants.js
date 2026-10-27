/**
 * @file constants.js
 * @description 국회 자막 수집기 중앙 상수 및 설정 정의
 * Centralized constants and configurations for Assembly Caption Collector
 */

/**
 * @typedef {Object} TimingConfig
 * @property {number} DEFAULT_PAUSE_THRESHOLD_MS - 새 문단 분할 기준 침묵 시간 (ms) / Default silence threshold for paragraph splitting in ms
 * @property {number} DEBOUNCE_MUTATION_MS - DOM 변경 감지 디바운스 대기 시간 (ms) / Debounce delay for DOM mutations in ms
 * @property {number} PREVIEW_MAX_ITEMS - 팝업 실시간 미리보기 최대 표시 항목 수 / Maximum number of items in live preview
 */

/**
 * @typedef {Object} TimestampModes
 * @property {string} PC - PC 절대 시각 모드 / PC absolute timestamp mode
 * @property {string} PLAYER - 플레이어 상대 재생 시각 모드 / Player relative elapsed time mode
 * @property {string} BOTH - PC 시각 및 플레이어 시각 동시 병기 모드 / Dual timestamp mode with both PC and player times
 */

/**
 * @typedef {Object} StorageKeys
 * @property {string} RECORDS - 자막 레코드 저장소 키 / Storage key for subtitle records
 * @property {string} IS_RECORDING - 수집 활성화 플래그 키 / Storage key for recording active state
 * @property {string} CUSTOM_SELECTOR - 사용자 정의 DOM 선택자 키 / Storage key for custom DOM selector
 * @property {string} TIMESTAMP_MODE - 타임스탬프 형식 모드 키 / Storage key for timestamp display mode
 * @property {string} PAUSE_THRESHOLD_MS - 침묵 분할 기준 밀리초 키 / Storage key for pause threshold in ms
 */

/**
 * @typedef {Object} I18nItem
 * @property {string} appTitle - 확장 프로그램 제목 / Extension title
 * @property {string} statusRecording - 수집 중 상태 문구 / Recording status text
 * @property {string} statusStopped - 대기 중 상태 문구 / Stopped status text
 * @property {string} startRecord - 수집 시작 버튼 라벨 / Start recording button label
 * @property {string} stopRecord - 수집 중지 버튼 라벨 / Stop recording button label
 * @property {string} copyAll - 전체 복사 버튼 라벨 / Copy all button label
 * @property {string} copySuccess - 복사 성공 안내 메시지 / Copy success notification
 * @property {string} clearRecords - 기록 비우기 버튼 라벨 / Clear records button label
 * @property {string} clearConfirm - 기록 초기화 확인 대화상자 문구 / Confirmation text for clearing records
 * @property {string} downloadTxt - TXT 다운로드 버튼 라벨 / Download TXT button label
 * @property {string} downloadMd - MD 다운로드 버튼 라벨 / Download MD button label
 * @property {string} noData - 데이터 없음 안내 / No data notification
 * @property {string} emptyPreview - 빈 미리보기 안내 / Empty preview placeholder text
 * @property {string} settings - 상세 설정 헤더 라벨 / Settings accordion label
 * @property {string} tsModeLabel - 타임스탬프 방식 설정 라벨 / Timestamp mode field label
 * @property {string} pauseThresholdLabel - 문단 분할 침묵 기준 설정 라벨 / Pause threshold field label
 * @property {string} customSelectorLabel - 수동 선택자 필드 라벨 / Custom selector field label
 * @property {string} customSelectorPlaceholder - 수동 선택자 입력 안내 / Custom selector placeholder
 */

/**
 * 자막 DOM 탐색 우선순위 후보군
 * Candidate CSS selectors for caption DOM containers in order of priority
 * @type {ReadonlyArray<string>}
 */
const CANDIDATE_SELECTORS = Object.freeze([
  "#viewSubtit .incont",          // 국회인터넷의사중계 주 자막 영역 / NATV webcast primary subtitle content area
  "#viewSubtit",                 // 국회인터넷의사중계 자막 래퍼 / NATV webcast subtitle container wrapper
  ".vjs-text-track-display",      // Video.js 자막 트랙 디스플레이 / Video.js text track display
  ".caption_box",                 // 일반 캡션 박스 / Generic caption box
  "#captionText",                 // 캡션 텍스트 엘리먼트 / Caption text element ID
  ".player-subtitles",            // 플레이어 서브타이틀 / Player subtitles container
  ".caption_area",                // 캡션 영역 클래스 / Caption area class
  "[class*='caption']",           // 클래스명에 caption 포함 엘리먼트 / Elements containing 'caption' in class
  "[id*='caption']"               // ID에 caption 포함 엘리먼트 / Elements containing 'caption' in ID
]);

/**
 * 시간 및 갱신 주기 관련 상수
 * Timing & threshold configurations
 * @type {Readonly<TimingConfig>}
 */
const TIMING = Object.freeze({
  DEFAULT_PAUSE_THRESHOLD_MS: 3000, // 새 문단 분할 기준 침묵 시간 (3초) / Silence threshold for new paragraph (3 seconds)
  DEBOUNCE_MUTATION_MS: 80,          // DOM 변경 디바운스 대기 시간 (80ms) / DOM mutation debounce delay (80ms)
  PREVIEW_MAX_ITEMS: 30              // 팝업 실시간 미리보기 최대 표시 개수 / Max items to display in preview (30)
});

/**
 * 타임스탬프 표기 모드
 * Timestamp display modes
 * @type {Readonly<TimestampModes>}
 */
const TIMESTAMP_MODES = Object.freeze({
  PC: "pc",         // PC 절대 시각 (예: 10:15:30) / PC absolute clock time (e.g. 10:15:30)
  PLAYER: "player", // 플레이어 상대 재생 시각 (예: 00:15:30) / Player relative elapsed time (e.g. 00:15:30)
  BOTH: "both"      // 둘 다 병기 (예: [10:15:30 | 00:15:30]) / Dual timestamp (e.g. [10:15:30 | 00:15:30])
});

/**
 * 크롬 로컬 스토리지 키
 * Chrome local storage keys
 * @type {Readonly<StorageKeys>}
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
 * Localized UI strings for internationalization
 * @type {Readonly<{ko: Readonly<I18nItem>, en: Readonly<I18nItem>}>}
 */
const I18N = Object.freeze({
  ko: Object.freeze({
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
  }),
  en: Object.freeze({
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
  })
});

// 브라우저 및 Node.js 환경 동시 지원 (CommonJS / ES Window Global)
// Support both Browser and Node.js environments
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    CANDIDATE_SELECTORS,
    TIMING,
    TIMESTAMP_MODES,
    STORAGE_KEYS,
    I18N
  };
} else {
  // @ts-ignore
  window.AssemblyConstants = {
    CANDIDATE_SELECTORS,
    TIMING,
    TIMESTAMP_MODES,
    STORAGE_KEYS,
    I18N
  };
}
