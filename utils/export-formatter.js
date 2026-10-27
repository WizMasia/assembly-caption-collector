/**
 * @file export-formatter.js
 * @description 자막 레코드를 TXT 및 Markdown 문서로 변환하는 포맷터
 * Subtitle export formatter for TXT and Markdown outputs
 */

/**
 * @typedef {Object} CaptionRecord
 * @property {string} id - 고유 레코드 ID / Unique record ID
 * @property {string} timestamp - PC 절대 시각 (HH:mm:ss) / PC absolute clock time
 * @property {string|null} [playerTime] - 영상 재생 시각 (HH:mm:ss 또는 mm:ss) / Player relative elapsed time
 * @property {string} date - 수집 일자 (YYYY-MM-DD) / Collection date
 * @property {string} text - 자막 본문 텍스트 / Subtitle body text
 * @property {boolean} isParagraphStart - 새 문단 시작 여부 / Whether this item starts a new paragraph
 */

/**
 * 기본 제목 및 타임스탬프 모드 상수 정의
 * Default titles and fallback constants
 */
const DEFAULT_TEXT_TITLE = "국회_의사중계_자막";
const DEFAULT_MD_TITLE = "국회 의사중계 자막 기록";
const DEFAULT_TIMESTAMP_MODE = "both";
const FALLBACK_TIMESTAMP = "-";
const DIVIDER_LINE_LENGTH = 50;

/**
 * 타임스탬프 문자열 포맷팅
 * Formats timestamp based on selected mode
 * @param {string|null} pcTime - PC 절대 시각 (HH:mm:ss) / PC absolute clock time
 * @param {string|null} [playerTime] - 영상 재생 시각 (HH:mm:ss 또는 mm:ss) / Player relative elapsed time
 * @param {'pc'|'player'|'both'} [mode='both'] - 표기 모드 / Timestamp display mode
 * @returns {string} 포맷팅된 타임스탬프 / Formatted timestamp string
 */
function formatTimestamp(pcTime, playerTime, mode = DEFAULT_TIMESTAMP_MODE) {
  if (mode === "player" && playerTime) {
    return playerTime;
  }
  if (mode === "both" && playerTime) {
    if (pcTime) {
      return `${pcTime} | 재생 ${playerTime}`;
    }
    return `재생 ${playerTime}`;
  }
  return pcTime || playerTime || FALLBACK_TIMESTAMP;
}

/**
 * 초 단위 숫자를 HH:mm:ss 또는 mm:ss 문자열로 변환
 * Converts seconds into HH:mm:ss or mm:ss format
 * @param {number} totalSeconds - 재생 시간(초) / Total playback seconds
 * @returns {string} HH:mm:ss 또는 mm:ss 형식 문자열 / Formatted time string
 */
function formatSecondsToTime(totalSeconds) {
  if (typeof totalSeconds !== "number" || Number.isNaN(totalSeconds) || totalSeconds < 0) {
    return "00:00";
  }

  const sec = Math.floor(totalSeconds % 60);
  const min = Math.floor((totalSeconds / 60) % 60);
  const hour = Math.floor(totalSeconds / 3600);

  /**
   * 2자리 숫자 패딩
   * Pads number to 2 digits
   * @param {number} n
   * @returns {string}
   */
  const pad = (n) => String(n).padStart(2, "0");

  if (hour > 0) {
    return `${pad(hour)}:${pad(min)}:${pad(sec)}`;
  }
  return `${pad(min)}:${pad(sec)}`;
}

/**
 * TXT 파일 텍스트 생성
 * Generates plain text export content
 * @param {Array<CaptionRecord>} records - 자막 레코드 목록 / Subtitle record list
 * @param {string} [title=DEFAULT_TEXT_TITLE] - 회의명 또는 문서 제목 / Meeting title or document heading
 * @param {'pc'|'player'|'both'} [timestampMode=DEFAULT_TIMESTAMP_MODE] - 타임스탬프 표기 모드 / Timestamp display mode
 * @returns {string} TXT 형식 변환 문자열 / Formatted TXT string
 */
function formatToText(records, title = DEFAULT_TEXT_TITLE, timestampMode = DEFAULT_TIMESTAMP_MODE) {
  if (!records || !Array.isArray(records) || records.length === 0) {
    return "";
  }

  const dateStr = new Date().toISOString().slice(0, 10);
  const divider = "=".repeat(DIVIDER_LINE_LENGTH);
  const header = `[${title}] - ${dateStr}\n총 ${records.length}개 문장 수집\n${divider}\n\n`;

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
 * @param {Array<CaptionRecord>} records - 자막 레코드 목록 / Subtitle record list
 * @param {string} [title=DEFAULT_MD_TITLE] - 회의명 또는 문서 제목 / Meeting title or document heading
 * @param {'pc'|'player'|'both'} [timestampMode=DEFAULT_TIMESTAMP_MODE] - 타임스탬프 표기 모드 / Timestamp display mode
 * @returns {string} Markdown 형식 변환 문자열 / Formatted Markdown string
 */
function formatToMarkdown(records, title = DEFAULT_MD_TITLE, timestampMode = DEFAULT_TIMESTAMP_MODE) {
  if (!records || !Array.isArray(records) || records.length === 0) {
    return "";
  }

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

// 브라우저 및 Node.js 환경 동시 지원 (CommonJS / Browser Window Global)
// Support both Browser and Node.js environments
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    formatTimestamp,
    formatSecondsToTime,
    formatToText,
    formatToMarkdown
  };
} else {
  // @ts-ignore
  const root = typeof window !== "undefined" ? window : globalThis;
  // @ts-ignore
  root.AssemblyExportFormatter = {
    formatTimestamp,
    formatSecondsToTime,
    formatToText,
    formatToMarkdown
  };
}
