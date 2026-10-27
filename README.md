# 대한민국 국회 의사중계 실시간 자막 수집기
## National Assembly Live Subtitle Collector (Chrome Extension)

[![Chrome Extension](https://img.shields.io/badge/Chrome_Extension-Manifest_V3-4285F4?logo=googlechrome&logoColor=white)](https://developer.chrome.com/docs/extensions/mv3/)
[![JavaScript](https://img.shields.io/badge/JavaScript-ES2022-F7DF1E?logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)

> **대한민국 국회 의사중계 웹 플레이어의 실시간 자막을 감지하여 듀얼 타임스탬프와 스마트 문단 분할과 함께 텍스트/마크다운 문서로 저장하는 크롬 확장 프로그램입니다.**  
> A lightweight, no-build Chrome Extension (Manifest V3) that captures live subtitles/captions from the Republic of Korea National Assembly Webcast player, providing dual timestamps, smart silence-based paragraph segmentation, live preview, and multi-format document exports (TXT & Markdown).

---

## 목차 / Table of Contents
1. [배경 및 개요 / Overview & Background](#배경-및-개요--overview--background)
2. [주요 기능 / Key Features](#주요-기능--key-features)
3. [시스템 아키텍처 / System Architecture](#시스템-아키텍처--system-architecture)
4. [설치 가이드 / Installation Guide](#설치-가이드--installation-guide)
5. [사용 방법 / Usage Instructions](#사용-방법--usage-instructions)
6. [상세 설정 가이드 / Configuration Guide](#상세-설정-가이드--configuration-guide)
7. [프로젝트 구조 / Project Structure](#프로젝트-구조--project-structure)
8. [테스트 및 검증 / Testing & Verification](#테스트-및-검증--testing--verification)
9. [라이선스 / License](#라이선스--license)

---

## 배경 및 개요 / Overview & Background

대한민국 국회 의사중계(`assembly.webcast.go.kr`, `vplatform.assembly.go.kr`, `natv.go.kr`) 시스템에서는 본회의, 상임위원회, 국정감사 등의 실시간 영상과 함께 AI 음성인식 및 수동 속기 기반의 자막을 송출합니다.

본 프로젝트는 국회 회의록 작성자, 연구원, 언론인 및 시민들이 실시간 의사중계를 모니터링하면서 주요 발언을 신속하게 텍스트로 기록하고 인용할 수 있도록 제작된 크롬 확장 프로그램입니다. 복잡한 빌드 과정이나 외부 의존성 없이 순수 Vanilla JavaScript(Manifest V3)로 동작하며, 안정적인 DOM 감지와 고정밀 타임스탬프 추출을 보장합니다.

The Republic of Korea National Assembly webcast services broadcast plenary meetings, standing committee sessions, and parliamentary inquiries with real-time speech-to-text (STT) and stenography captions. This extension enables researchers, journalists, and citizens to capture, organize, and export live deliberation records with zero build configuration.

---

## 주요 기능 / Key Features

### 1. 무빌드(No Build) 즉시 로드 / Zero Build & Pure Vanilla JS
- Webpack, Vite 등의 번들러나 npm 패키지 의존성이 전혀 필요 없습니다.
- Chrome 브라우저의 `개발자 모드`에서 압축 해제된 폴더를 직접 로드하여 1초 만에 실행할 수 있습니다.
- No build steps or bundlers required. Loads directly in Developer Mode via `chrome://extensions/`.

### 2. 듀얼 타임스탬프 (Dual Timestamps)
- **PC 절대 시각**: 현재 로컬 시스템 시각 (예: `10:15:32`).
- **영상 재생 시각**: `<video>` 요소의 `currentTime`을 감지하여 경과 시각 표시 (예: `01:24:18` 또는 `12:45`).
- **3가지 표기 모드 지원**:
  - `PC 시각`: `[10:15:32] 발언 내용`
  - `재생 시각`: `[01:24:18] 발언 내용`
  - `둘 다 병기`: `[10:15:32 | 재생 01:24:18] 발언 내용`
- Captures both local computer clock time and video playback elapsed time with flexible formatting.

### 3. 스마트 중복 제거 & 문단 자동 분할 / Smart Deduplication & Chunking
- **실시간 스트림 정제**: 음성 인식 엔진이 단어를 점진적으로 갱신하거나 이전 텍스트가 접두어로 남아있는 현상을 지능적으로 병합 및 필터링합니다.
- **침묵/일시정지 감지 분할**: 발언 간 공백 시간(기본 3,000ms / 3초, 사용자 변경 가능) 동안 새로운 자막이 들어오지 않으면 자동으로 새로운 문단(`isParagraphStart`)으로 구분합니다.
- Eliminates duplicate or incremental partial speech recognition texts. Automatically breaks text into paragraphs when speech pauses exceed the configurable threshold.

### 4. 실시간 미리보기 및 원클릭 복사 / Live Preview & One-Click Copy
- 팝업 창에서 현재 수집 중인 자막 스트림을 실시간 스크롤 뷰로 확인 가능.
- 새 문단 시작 시 시각적 구분선 및 뱃지 표시.
- **전체 복사 버튼**: 전체 기록을 즉시 클립보드에 복사하고 세련된 토스트(Toast) 알림 제공.
- Displays live scrolling feed of captured lines. Single click to copy all text to clipboard with toast feedback.

### 5. 다양한 형식 내보내기 (TXT & Markdown) / Multi-Format Document Export
- **Markdown (.md)**: 메타데이터(수집 일자, 총 문장 수, 타임스탬프 모드) 및 깔끔한 마크다운 리스트/인용 구조로 내보내기.
- **Text (.txt)**: 회의명 헤더와 구분선이 포함된 정갈한 순수 텍스트 문서 내보내기.
- Export clean documents with headers, dividers, and structured timestamping.

### 6. 국회 웹캐스트 전용 셀렉터 자동 내장 & 커스텀 지원 / Robust Selectors
- 국회 플레이어의 주요 자막 셀렉터군(` #viewSubtit .incont `, ` #viewSubtit `, ` .vjs-text-track-display ` 등)을 우선순위별로 자동 탐색.
- 특수한 페이지 구조를 위한 **사용자 정의 CSS 셀렉터(Custom Selector)** 지원.
- Pre-configured with National Assembly Webcast player selectors, with fallback and custom selector overrides.

### 7. 화면 내 플로팅 위젯 (In-Page Floating Widget) 🚀
- 브라우저 상단 툴바 팝업을 열지 않고도, **국회 의사중계 시청 화면 우측 하단에 항상 떠 있는 플로팅 배지 및 미니 컨트롤러**를 제공합니다.
- **Shadow DOM**으로 격리되어 있어 국회 웹페이지의 기존 CSS 스타일과 일체 충돌하지 않습니다.
- 영상 전체화면 모드나 창 크기와 관계없이 실시간 수집 건수 확인, 수집 시작/중지, 원클릭 복사, 즉시 다운로드를 화면 위에서 바로 조작할 수 있습니다.
- Provides a clean on-screen floating widget injected directly into the live webcast page using Shadow DOM isolation. Controls recording, copying, and instant downloads right on the broadcast screen.

### 8. 주기적 자동 파일 저장 (Periodic Auto-Save) 💾
- 장시간 이어지는 본회의, 청문회, 국정감사(3~8시간 이상) 시청 중 브라우저 탭 충돌이나 메모리 부족 등으로 인한 데이터 유실을 방지합니다.
- **5분, 10분, 30분** 간격으로 지금까지 수집된 회의 자막을 사용자가 지정한 형식(TXT 또는 Markdown)으로 로컬 다운로드 폴더에 자동 분할 저장합니다.
- 확장 프로그램 팝업창을 닫아도 **웹페이지 탭 내에서 백그라운드로 안전하게 동작**합니다.
- Automatically saves and downloads collected captions at configurable intervals (e.g. every 5, 10, or 30 minutes) in TXT or Markdown format directly to your Downloads folder to prevent data loss during long legislative sessions.

---

## 시스템 아키텍처 / System Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Chrome Web Browser Tab                          │
│             (assembly.webcast.go.kr / *.assembly.go.kr)                │
│                                                                        │
│  ┌──────────────────────┐              ┌──────────────────────────┐    │
│  │ HTML5 <video> Player │              │   Caption DOM Element    │    │
│  │   (currentTime)      │              │  (#viewSubtit .incont)   │    │
│  └──────────┬───────────┘              └───────────┬──────────────┘    │
│             │                                      │ (Mutation)        │
│             ▼                                      ▼                   │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │    content/caption-engine.js                                   │    │
│  │    - MutationObserver & Dynamic Selector Resolution            │    │
│  │    - Deduplication & Progressive Substring Prefix Merging      │    │
│  │    - Dual Timestamps (KST Local + Video Playback Time)         │    │
│  │    - Smart Silence-based Paragraph Chunking                    │    │
│  └─────────────────────────────────┬──────────────────────────────┘    │
│                                    │                                   │
│                                    ▼                                   │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │    content/content.js                                          │    │
│  │    - Runtime Messaging Router                                  │    │
│  │    - In-Page Floating Widget (Shadow DOM Overlay Control)      │    │
│  │    - Periodic Auto-Save Engine (Independent 5/10/30m Timer)   │    │
│  └─────────────────────────────────┬──────────────────────────────┘    │
└────────────────────────────────────┼───────────────────────────────────┘
                                     │ Chrome Storage / Message
                                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│    popup/popup.js, popup.html, popup.css                               │
│    - Status Badge & Real-time Live Preview List (Fixed min-height)     │
│    - Recording Toggle / One-click Copy / Clear Records                 │
│    - Settings (Timestamp Mode, Silence Threshold, CSS Selector)        │
│    - Periodic Auto-Save Settings & Floating Widget Toggle              │
│    - Export Formatter (TXT / Markdown Download)                        │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 설치 가이드 / Installation Guide

1. **저장소 클론 또는 다운로드 (Clone or Download)**:
   ```bash
   git clone https://github.com/WizMasia/assembly-caption-collector.git
   ```
2. **구글 크롬 확장 프로그램 관리자 접속**:
   - Chrome 주소창에 `chrome://extensions/` 입력 후 접속합니다.
3. **개발자 모드 활성화 (Developer Mode)**:
   - 화면 우측 상단의 **개발자 모드 (Developer mode)** 토글 스위치를 켭니다.
4. **압축해제된 확장 프로그램 로드**:
   - 화면 좌측 상단의 **[압축해제된 확장 프로그램을 로드합니다]** (Load unpacked) 버튼을 클릭합니다.
   - 클론한 프로젝트 폴더(`assembly-caption-collector`)를 선택합니다.
5. **📌 툴바 핀(고정) 필수 안내 (중요)**:
   - Chrome은 로드된 확장 프로그램을 기본적으로 주소창 우측 퍼즐 아이콘(`🧩`) 내부에 숨겨둡니다.
   - 브라우저 상단 우측의 **퍼즐 아이콘(`🧩`)**을 클릭한 후, **[국회 의사중계 실시간 자막 수집기]** 우측의 **핀 아이콘(`📌`)**을 클릭하여 브라우저 상단 툴바에 고정해주세요.

---

## 사용 방법 / Usage Instructions

> 💡 **두 가지 조작 방식 지원**: 브라우저 상단 **툴바 팝업**을 열거나, 영상 시청 화면 우측 하단의 **플로팅 위젯**을 바로 조작할 수 있습니다.

1. **국회 의사중계 웹사이트 접속**:
   - [국회인터넷의사중계시스템 (assembly.webcast.go.kr)](https://assembly.webcast.go.kr/main/) 또는 회의 영상 페이지로 이동합니다.
2. **자막 켜기**:
   - 플레이어 화면 내의 `자막(CC)` 버튼을 활성화하여 화면에 자막 텍스트가 표시되도록 합니다.
3. **화면 내 플로팅 위젯 (In-Page Widget)으로 바로 사용**:
   - 중계 페이지가 열리면 화면 우측 하단에 **`🏛️ 0건 | 대기`** 플로팅 배지가 나타납니다.
   - 배지를 클릭하면 미니 컨트롤 창이 열려 **[수집 시작]**, **[복사]**, **[TXT]**, **[MD]**를 시청 화면에서 바로 수행할 수 있습니다.
4. **툴바 팝업으로 상세 제어 & 실시간 스트림 확인**:
   - 브라우저 상단 확장 프로그램 아이콘을 클릭하여 팝업을 열면, 실시간 자막 피드, 문단 구분 뱃지, 상세 설정을 조작할 수 있습니다.
5. **주기적 자동 파일 저장 (Periodic Auto-Save)**:
   - 상세 설정에서 자동 저장 주기를 `5분`, `10분`, `30분`으로 지정하면 회의 도중 정기적으로 파일이 다운로드 폴더에 자동 백업됩니다.

---

## 상세 설정 가이드 / Configuration Guide

팝업창 하단의 **[상세 설정 / Settings]** 아코디언 메뉴를 클릭하여 설정을 조정할 수 있습니다.

| 설정 항목 (Option) | 기본값 (Default) | 설명 (Description) |
| :--- | :--- | :--- |
| **자동 저장 주기** | `사용 안 함 (Off)` | `사용 안 함`, `5분`, `10분`, `30분` 단위로 회의 자막을 로컬에 자동 분할 저장합니다. |
| **자동 저장 파일 형식** | `텍스트 파일 (.txt)` | 주기적 자동 저장 시 출력할 형식(`TXT` 또는 `Markdown`)을 선택합니다. |
| **화면 내 플로팅 위젯** | `체크 (On)` | 국회 중계 페이지 화면 우측 하단에 오버레이 컨트롤러 표시 여부를 결정합니다. |
| **타임스탬프 모드** | `둘 다 병기 (Both)` | `PC 절대시각`, `플레이어 재생시각`, `둘 다 병기` 중 출력 형식을 선택합니다. |
| **문단 분할 기준 시간** | `3초 (3000ms)` | 발언자 교대 또는 묵음 공백 시간 기준입니다. 설정된 시간 동안 새 자막이 없으면 새 문단으로 분할합니다. |
| **커스텀 CSS 선택자** | `(공백 / Auto)` | 비표준 플레이어나 특수 웹페이지에서 특정 자막 DOM 요소를 타겟팅해야 할 때 입력합니다. |
| :--- | :--- | :--- |
| **타임스탬프 모드** | `둘 다 병기 (Both)` | `PC 절대시각`, `플레이어 재생시각`, `둘 다 병기` 중 출력 형식을 선택합니다. |
| **문단 분할 기준 시간** | `3초 (3000ms)` | 발언자 교대 또는 묵음 공백 시간 기준입니다. 설정된 시간 동안 새 자막이 없으면 새 문단으로 분할합니다. |
| **커스텀 CSS 선택자** | `(공백 / Auto)` | 비표준 플레이어나 커스텀 웹페이지에서 특정 자막 DOM 요소를 타겟팅해야 할 때 입력합니다. |

---

## 프로젝트 구조 / Project Structure

```text
assembly-caption-collector/
├── manifest.json                     # Chrome Extension Manifest V3 메타데이터
├── .gitignore                        # Git 추적 제외 파일 목록 (OS, 캐시, 로그 등)
├── README.md                         # 종합 프로젝트 안내서 (한/영 병기)
├── config/
│   └── constants.js                  # 중앙 상수, 셀렉터 후보군, 다국어 문구, 스토리지 키
├── content/
│   ├── caption-engine.js             # MutationObserver, 타임스탬프, 중복제거, 단락분할 코어 로직
│   └── content.js                    # Content Script 런타임 메시징 및 수명주기 제어
├── popup/
│   ├── popup.html                    # 팝업 대시보드 마크업 구조
│   ├── popup.css                     # 모던 글래스모피즘 스타일, 다크모드, 반응형, 마이크로 인터랙션
│   └── popup.js                      # 팝업 컨트롤러, 실시간 스트림 렌더링, 이벤트 핸들러
├── utils/
│   └── export-formatter.js           # TXT 및 Markdown 문서 변환 및 타임스탬프 포맷 유틸리티
├── icons/
│   ├── generate_icons.js             # PNG 아이콘 프로그래밍 생성 스크립트 (Zero dependency)
│   ├── icon16.png                    # 16x16 툴바 아이콘
│   ├── icon48.png                    # 48x48 확장 프로그램 관리 아이콘
│   └── icon128.png                   # 128x128 웹스토어/디테일 아이콘
├── tests/
│   ├── constants.test.js             # 상수 및 I18N 무결성 단위 테스트
│   ├── export-formatter.test.js      # TXT/Markdown 포맷터 검증 테스트
│   ├── caption-engine.test.js        # 캡션 엔진, 중복 필터, 타임스탬프, 분할 로직 테스트
│   └── popup.test.js                 # 팝업 DOM 조작, 다운로드, 스토리지 동기화 시뮬레이션 테스트
└── docs/
    └── superpowers/                  # 설계 문서(Spec) 및 단계별 구현 계획(Plan)
```

---

## 테스트 및 검증 / Testing & Verification

프로젝트는 Node.js 내장 `node:assert`를 활용하여 외부 패키지 설치 없이 즉시 실행 가능한 단위 테스트 스위트를 제공합니다.

모든 테스트를 실행하려면 다음 명령어를 터미널에서 실행합니다:

```bash
node tests/constants.test.js && \
node tests/export-formatter.test.js && \
node tests/caption-engine.test.js && \
node tests/popup.test.js
```

### 테스트 커버리지 요약
- **상수 검증 (`constants.test.js`)**: 국회 전용 셀렉터 유효성, 타이밍 기본값, I18N 한/영 다국어 키 검증.
- **포맷터 검증 (`export-formatter.test.js`)**: 타임스탬프 모드별 출력, 초 단위 시간 변환, TXT/Markdown 헤더 및 단락 구분선 검증.
- **캡션 엔진 검증 (`caption-engine.test.js`)**: 중복 문자열 제거, 접두사 스트림 병합, 재생 시각 싱크, 침묵 구간 문단 분할 플래그 검증.
- **팝업 컨트롤러 검증 (`popup.test.js`)**: 스토리지 복원, 녹화 토글, 클립보드 복사, Blob 다운로드 및 메모리 해제, 실시간 스토리지 동기화, 토스트 메시지 검증.

---

## 기술적 특징 (Technical Highlights)

- **Pure Manifest V3**: 최신 구글 크롬 확장 프로그램 표준을 준수하여 백그라운드 불필요한 메모리 낭비를 방지하고 Content Script 위주로 경량화.
- **Content Security Policy (CSP) 준수**: 인라인 이벤트 핸들러(`onclick`)를 완전히 배제하고 표준 이벤트 리스너(`addEventListener`)로 구현.
- **메모리 누수 방지**: Blob URL 다운로드 후 적절한 지연 해제(`URL.revokeObjectURL`) 및 MutationObserver 자원 정리.
- **엄격한 타입 안전성**: JSDoc `@typedef` 및 `@param`을 적용하여 Vanilla JS 환경에서도 IDE 타입 추론 및 린트 지원.
- **한/영 병기 문서화**: 모든 소스 코드 주석과 설명서에 한국어와 영어를 병기하여 코드 가독성과 접근성 제고.

---

## 라이선스 / License

This project is licensed under the [MIT License](LICENSE).

```
MIT License

Copyright (c) 2026 WizMasia

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
