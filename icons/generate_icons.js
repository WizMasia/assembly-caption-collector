/**
 * @fileoverview 국회 의사중계 실시간 자막 수집기 아이콘 바이너리 생성기
 * Generator script for Chrome Extension icons (PNG format) using pure Node.js.
 */

const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");

/**
 * 아이콘 렌더링에 사용되는 디자인 토큰 및 색상 상수 정의
 * Design tokens and color constants used for rendering icons.
 */
const ICON_THEME = {
  // 메인 국회 블루 테마 색상 / Primary National Assembly Blue Theme (RGB 37, 99, 235)
  PRIMARY_BLUE_START: [59, 130, 246], // #3B82F6 (Blue 500)
  PRIMARY_BLUE_END: [29, 78, 216],   // #1D4ED8 (Blue 700)

  // 플레이어 화면 내부 배경 / Player screen inner background
  SCREEN_BG: [15, 23, 42],            // #0F172A (Slate 900)

  // 자막 텍스트 바 색상 / Caption bars color
  CAPTION_TEXT_TOP: [255, 255, 255],  // #FFFFFF (Pure White)
  CAPTION_TEXT_BOTTOM: [147, 197, 253] // #93C5FD (Light Sky Blue)
};

/**
 * 둥근 모서리 사각형 부호화 거리 함수 (SDF: Signed Distance Field)
 * Signed distance function for a rounded rectangle.
 *
 * @param {number} px 점의 X 좌표 / Point X coordinate
 * @param {number} py 점의 Y 좌표 / Point Y coordinate
 * @param {number} width 사각형 가로 길이 / Rectangle width
 * @param {number} height 사각형 세로 길이 / Rectangle height
 * @param {number} radius 모서리 둥글기 반경 / Corner radius
 * @returns {number} 거리 값 (음수: 내부, 양수: 외부) / Distance value (negative: inside, positive: outside)
 */
function sdfRoundedBox(px, py, width, height, radius) {
  const qx = Math.abs(px) - (width / 2 - radius);
  const qy = Math.abs(py) - (height / 2 - radius);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - radius;
}

/**
 * 주어진 픽셀 좌표에 대한 RGBA 색상 계산
 * Computes RGBA color for the given pixel coordinates.
 *
 * @param {number} x 픽셀 X 좌표 / Pixel X coordinate
 * @param {number} y 픽셀 Y 좌표 / Pixel Y coordinate
 * @param {number} size 아이콘 전체 가로/세로 크기 / Total size of icon
 * @returns {number[]} [r, g, b, a] 배열 / Array of [r, g, b, a] values
 */
function renderPixel(x, y, size) {
  const nx = (x + 0.5) / size;
  const ny = (y + 0.5) / size;
  const cx = nx - 0.5;
  const cy = ny - 0.5;
  const pixelSize = 1.0 / size;

  // 1. 외곽 둥근 모서리 사각형 (Base App Icon Rounded Box)
  const baseDist = sdfRoundedBox(cx, cy, 0.90, 0.90, 0.22);
  const baseAlpha = Math.max(0, Math.min(1, -baseDist / pixelSize + 0.5));
  if (baseAlpha <= 0) {
    return [0, 0, 0, 0];
  }

  // 기본 국회 블루 그라데이션 계산 / Compute primary blue vertical gradient
  const gradT = ny;
  let r = ICON_THEME.PRIMARY_BLUE_START[0] * (1 - gradT) + ICON_THEME.PRIMARY_BLUE_END[0] * gradT;
  let g = ICON_THEME.PRIMARY_BLUE_START[1] * (1 - gradT) + ICON_THEME.PRIMARY_BLUE_END[1] * gradT;
  let b = ICON_THEME.PRIMARY_BLUE_START[2] * (1 - gradT) + ICON_THEME.PRIMARY_BLUE_END[2] * gradT;

  // 2. 비디오 플레이어 화면 영역 (Inner Screen Box)
  const screenDist = sdfRoundedBox(cx, cy, 0.70, 0.64, 0.12);
  const screenAlpha = Math.max(0, Math.min(1, -screenDist / pixelSize + 0.5));
  if (screenAlpha > 0) {
    const screenBlend = screenAlpha * 0.88;
    r = r * (1 - screenBlend) + ICON_THEME.SCREEN_BG[0] * screenBlend;
    g = g * (1 - screenBlend) + ICON_THEME.SCREEN_BG[1] * screenBlend;
    b = b * (1 - screenBlend) + ICON_THEME.SCREEN_BG[2] * screenBlend;
  }

  // 3. 자막 상단 라인 (Upper Caption Bar)
  const bar1Dist = sdfRoundedBox(cx, cy - (-0.05), 0.44, 0.11, 0.04);
  const bar1Alpha = Math.max(0, Math.min(1, -bar1Dist / pixelSize + 0.5));
  if (bar1Alpha > 0) {
    r = r * (1 - bar1Alpha) + ICON_THEME.CAPTION_TEXT_TOP[0] * bar1Alpha;
    g = g * (1 - bar1Alpha) + ICON_THEME.CAPTION_TEXT_TOP[1] * bar1Alpha;
    b = b * (1 - bar1Alpha) + ICON_THEME.CAPTION_TEXT_TOP[2] * bar1Alpha;
  }

  // 4. 자막 하단 라인 (Lower Caption Bar - Slightly Shorter)
  const bar2Dist = sdfRoundedBox(cx - 0.07, cy - 0.13, 0.30, 0.11, 0.04);
  const bar2Alpha = Math.max(0, Math.min(1, -bar2Dist / pixelSize + 0.5));
  if (bar2Alpha > 0) {
    r = r * (1 - bar2Alpha) + ICON_THEME.CAPTION_TEXT_BOTTOM[0] * bar2Alpha;
    g = g * (1 - bar2Alpha) + ICON_THEME.CAPTION_TEXT_BOTTOM[1] * bar2Alpha;
    b = b * (1 - bar2Alpha) + ICON_THEME.CAPTION_TEXT_BOTTOM[2] * bar2Alpha;
  }

  return [
    Math.round(Math.max(0, Math.min(255, r))),
    Math.round(Math.max(0, Math.min(255, g))),
    Math.round(Math.max(0, Math.min(255, b))),
    Math.round(Math.max(0, Math.min(255, baseAlpha * 255)))
  ];
}

/**
 * IEEE 802.3 CRC32 체크섬 계산 함수
 * Calculates 32-bit Cyclic Redundancy Check (CRC32).
 *
 * @param {Buffer} buffer 대상 데이터 버퍼 / Target data buffer
 * @returns {number} 32비트 무부호 정수 CRC32 / 32-bit unsigned integer CRC32
 */
function crc32(buffer) {
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i++) {
    const byte = buffer[i];
    crc ^= byte;
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * PNG 청크 버퍼 생성
 * Creates a standard PNG chunk (Length + Type + Data + CRC).
 *
 * @param {string} type 4글자 ASCII 청크 타입 (예: "IHDR", "IDAT", "IEND") / 4-character chunk type
 * @param {Buffer} data 청크 페이로드 데이터 / Chunk payload data
 * @returns {Buffer} 완성된 청크 버퍼 / Assembled chunk buffer
 */
function createChunk(type, data) {
  const length = data.length;
  const buffer = Buffer.alloc(8 + length + 4);
  buffer.writeUInt32BE(length, 0);
  buffer.write(type, 4, 4, "ascii");
  data.copy(buffer, 8);

  const crcTarget = buffer.subarray(4, 8 + length);
  const crcVal = crc32(crcTarget);
  buffer.writeUInt32BE(crcVal, 8 + length);
  return buffer;
}

/**
 * 지정된 크기의 RGBA PNG 이미지 바이너리 버퍼 생성
 * Generates a valid RGBA PNG binary buffer of specified width and height.
 *
 * @param {number} width 가로 픽셀 수 / Width in pixels
 * @param {number} height 세로 픽셀 수 / Height in pixels
 * @returns {Buffer} PNG 바이너리 버퍼 / PNG binary buffer
 */
function createPng(width, height) {
  // PNG 파일 시그니처 / Standard PNG Signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR 청크 생성 (Color Type 6: RGBA, Bit Depth: 8)
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // 8-bit depth
  ihdrData[9] = 6; // Color type 6 (RGBA)
  ihdrData[10] = 0; // Deflate compression
  ihdrData[11] = 0; // Filter method 0
  ihdrData[12] = 0; // Non-interlaced
  const ihdrChunk = createChunk("IHDR", ihdrData);

  // 스캔라인 원시 데이터 생성 (각 행마다 필터 바이트 0 포함)
  // Raw scanline buffer (1 filter byte (0) per scanline + width * 4 bytes RGBA)
  const rowSize = 1 + width * 4;
  const rawData = Buffer.alloc(height * rowSize);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0; // No filter (Filter type 0)
    for (let x = 0; x < width; x++) {
      const pixelOffset = rowOffset + 1 + x * 4;
      const [r, g, b, a] = renderPixel(x, y, width);
      rawData[pixelOffset] = r;
      rawData[pixelOffset + 1] = g;
      rawData[pixelOffset + 2] = b;
      rawData[pixelOffset + 3] = a;
    }
  }

  // IDAT 청크 압축 및 생성 / Compress scanlines with Deflate into IDAT chunk
  const idatData = zlib.deflateSync(rawData);
  const idatChunk = createChunk("IDAT", idatData);

  // IEND 청크 생성 (비어있는 페이로드) / End chunk with empty payload
  const iendChunk = createChunk("IEND", Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

/**
 * 메인 실행 함수: 16x16, 48x48, 128x128 아이콘 파일 생성
 * Main execution: writes icon16.png, icon48.png, icon128.png
 */
function generateAllIcons() {
  const dir = __dirname;
  const sizes = [16, 48, 128];

  for (const size of sizes) {
    const fileName = `icon${size}.png`;
    const filePath = path.join(dir, fileName);
    const pngBuffer = createPng(size, size);
    fs.writeFileSync(filePath, pngBuffer);
  }

  console.log("Generated icon16.png, icon48.png, icon128.png successfully.");
}

// 스크립트 직접 실행 시 아이콘 생성 수행 / Execute icon generation when called directly
if (require.main === module) {
  generateAllIcons();
}

module.exports = {
  createPng,
  renderPixel,
  createChunk,
  crc32,
  ICON_THEME
};
