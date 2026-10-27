/**
 * @file export-formatter.test.js
 * @description utils/export-formatter.js 단위 테스트
 * Unit tests for utils/export-formatter.js
 */

const assert = require("node:assert");
const { formatTimestamp, formatSecondsToTime, formatToText, formatToMarkdown } = require("../utils/export-formatter.js");

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

// 1. 타임스탬프 포맷 검증 / Verify timestamp formatting
assert.strictEqual(formatTimestamp("10:00:00", "00:05:10", "pc"), "10:00:00");
assert.strictEqual(formatTimestamp("10:00:00", "00:05:10", "player"), "00:05:10");
assert.strictEqual(formatTimestamp("10:00:00", "00:05:10", "both"), "10:00:00 | 재생 00:05:10");
assert.strictEqual(formatTimestamp("10:00:00", null, "player"), "10:00:00");
assert.strictEqual(formatTimestamp(null, "00:05:10", "pc"), "00:05:10");
assert.strictEqual(formatTimestamp(null, null, "both"), "-");

// 2. 초 -> 시간 포맷 검증 / Verify seconds to time string conversion
assert.strictEqual(formatSecondsToTime(310), "05:10");
assert.strictEqual(formatSecondsToTime(3665), "01:01:05");
assert.strictEqual(formatSecondsToTime(0), "00:00");
assert.strictEqual(formatSecondsToTime(-5), "00:00");
assert.strictEqual(formatSecondsToTime(NaN), "00:00");

// 3. 텍스트 문서 포맷 검증 / Verify text formatting
const txt = formatToText(dummyRecords, "제410회 국회 본회의", "both");
assert.ok(txt.includes("[제410회 국회 본회의]"), "Must contain title");
assert.ok(txt.includes("의사일정 제1항"), "Must contain records");
assert.ok(txt.includes("총 2개 문장 수집"), "Must contain count info");
assert.strictEqual(formatToText([]), "");
assert.strictEqual(formatToText(null), "");

// 4. 마크다운 문서 포맷 검증 / Verify Markdown formatting
const md = formatToMarkdown(dummyRecords, "제410회 국회 본회의", "both");
assert.ok(md.startsWith("# 제410회 국회 본회의"), "Must start with H1 title");
assert.ok(md.includes("총 문장 수: 2") || md.includes("총 문장 수"), "Must show count");
assert.ok(md.includes("---"), "Must contain separator for paragraph");
assert.strictEqual(formatToMarkdown([]), "");
assert.strictEqual(formatToMarkdown(null), "");

console.log("Task 2 test passed!");
