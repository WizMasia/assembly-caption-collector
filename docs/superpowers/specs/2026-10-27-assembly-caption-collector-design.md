# 국회 의사중계 실시간 자막 수집기 (Assembly Caption Collector) 설계 문서
# Design Document: National Assembly Live Subtitle Collector Chrome Extension

**Date:** 2026-10-27  
**Version:** 1.0.0  
**Target:** Chrome Extension (Manifest V3, Vanilla JavaScript)

---

## 1. 개요 및 목적 (Overview & Goals)
대한민국 국회 의사중계 시스템(`assembly.webcast.go.kr`, `vplatform.assembly.go.kr`, `*.assembly.go.kr`, `*.natv.go.kr`)의 웹 플레이어에서 송출되는 실시간 자막(AI 자막 및 수동 속기 자막)을 브라우저 단에서 감지 및 수집하여 타임스탬프와 함께 정돈된 문서(TXT, Markdown)로 내보내는 크롬 확장 프로그램입니다.

### 핵심 요구사항 (Key Requirements)
1. **무빌드(No Build) 순수 바닐라 JS 환경**: 별도의 npm 번들링 없이 크롬 `확장 프로그램 관리`에서 디렉토리를 직접 로드하여 실행.
2. **듀얼 타임스탬프 기록**:
   - PC 로컬 절대 시각 (예: `10:15:32`)
   - 웹 플레이어 영상 재생 상대 시각 (예: `01:24:18`, `HTMLVideoElement.currentTime` 기반)
   - 사용자 설정에 따라 PC시각, 영상시각, 또는 둘 다 출력 지원.
3. **스마트 중복 필터링 및 문단 자동 분할**:
   - 자막 스트림에서 연속으로 발생하는 중복 문장 및 부분 갱신 문장 필터링.
   - 발언 간 공백 시간(예: 3초 이상 새로운 자막 없음) 감지 시 자동으로 새 단락 구분 플래그 부여.
4. **실시간 미리보기 & 프리미엄 UI**:
   - 팝업창에서 수집 중인 자막 스트림을 실시간 스크롤 뷰로 확인.
   - 원클릭 클립보드 전체 복사 기능.
   - 세련된 다크/라이트 현대적 디자인 및 부드러운 상태 전환 애니메이션.
5. **국회 방송 전용 셀렉터 자동 내장 및 커스텀 지원**:
   - 실제 국회 플레이어의 `#viewSubtit .incont`, `#viewSubtit`, `.vjs-text-track-display` 등을 기본 탑재.
   - 사용자가 직접 CSS 셀렉터를 지정할 수 있는 수동 입력창 제공.
6. **규칙 준수 (User Rules)**:
   - 하드코딩 배제: 설정 및 셀렉터, UI 텍스트는 `config/constants.js`에서 일괄 관리.
   - 한/영 병기 주석 및 JSDoc 기반 엄격한 타입 명시.
7. **GitHub 원격 저장소 생성**:
   - 개발 완료 후 `gh` CLI를 통해 GitHub 원격 저장소를 생성하고 초기 커밋 및 푸시 수행.

---

## 2. 파일 및 디렉토리 아키텍처 (File & Directory Architecture)

```
/Users/joonhokeum/dev/국회회의크롤/
├── manifest.json                     # Chrome Extension Manifest V3
├── config/
│   └── constants.js                  # 상수, 기본 셀렉터, 다국어 문구, 설정 기본값
├── content/
│   ├── caption-engine.js             # MutationObserver, 타임스탬프, 중복제거, 단락분할 코어 로직
│   └── content.js                    # 런타임 메시지 핸들러 및 캡처 엔진 바인딩
├── popup/
│   ├── popup.html                    # 팝업 인터페이스 구조
│   ├── popup.css                     # 모던 스타일링, 반응형, 마이크로 애니메이션
│   └── popup.js                      # 팝업 라이프사이클, 실시간 스트림 렌더러, 이벤트 제어
├── utils/
│   └── export-formatter.js           # TXT 및 Markdown 변환 엔진
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── docs/
│   └── superpowers/
│       └── specs/
│           └── 2026-10-27-assembly-caption-collector-design.md
└── README.md                         # 프로젝트 설명서 (한/영 병기)
```

---

## 3. 데이터 구조 및 타입 정의 (Data Structures & Types)

```typescript
/**
 * 자막 레코드 단위 객체
 * Single subtitle record item
 */
interface SubtitleRecord {
  id: string;                      // UUID or timestamp-based unique ID
  text: string;                    // 정제된 자막 텍스트 (Cleaned text)
  timestamp: string;               // PC 로컬 절대시각 (HH:mm:ss)
  playerTime: string | null;       // 비디오 플레이어 재생시각 (HH:mm:ss 또는 mm:ss)
  date: string;                    // 기록 일자 (YYYY-MM-DD)
  isParagraphStart: boolean;       // 공백 시간(Pause interval) 경과 후 시작된 새 문단 여부
}

/**
 * 확장 프로그램 설정 및 상태 객체
 * Extension configuration & runtime state
 */
interface CollectorConfig {
  isRecording: boolean;            // 수집 활성화 여부
  customSelector: string;          // 사용자 정의 CSS 선택자
  timestampMode: 'pc' | 'player' | 'both'; // 타임스탬프 표기 방식
  pauseThresholdMs: number;        // 새 문단 분할 기준 공백 시간(밀리초, 기본 3000ms)
}
```

---

## 4. 컴포넌트 상세 설계 (Component Design)

### 4.1 Content Script & Caption Engine (`content/caption-engine.js`, `content/content.js`)
- **실제 대상 웹사이트 매칭**:
  - `*://*.assembly.go.kr/*`
  - `*://*.webcast.go.kr/*`
  - `*://*.natv.go.kr/*`
- **셀렉터 감지 우선순위**:
  1. 사용자 지정 `customSelector` (설정된 경우)
  2. `#viewSubtit .incont` (국회인터넷의사중계 자막 본문 영역)
  3. `#viewSubtit` (국회인터넷의사중계 자막 래퍼)
  4. `.vjs-text-track-display` (Video.js 기본 캡션 트랙)
  5. 기타 후보군 (`.caption_box`, `#captionText`, `.player-subtitles`)
- **타임스탬프 캡처**:
  - PC 시각: `new Date().toLocaleTimeString('ko-KR', { hour12: false })`
  - 비디오 시각: `document.querySelector('video')`를 탐색하여 `video.currentTime`을 `HH:mm:ss` 형식으로 변환. 비디오 태그가 없거나 유효하지 않으면 `null`.
- **중복 및 공백 감지**:
  - 텍스트 정규화: 다중 공백 제거 및 trim.
  - 직전 문장과 동일하거나, 직전 문장이 현재 문장의 접두어인 불완전 음성인식 스트림 병합/치환 처리.
  - 직전 수집 시각 대비 `pauseThresholdMs`(기본 3000ms) 초과 시 `isParagraphStart = true` 플래그 설정.
- **스토리지 동기화**:
  - 메모리 버퍼 및 `chrome.storage.local`에 실시간 영속화.

### 4.2 Popup UI & Controller (`popup/popup.html`, `popup/popup.js`, `popup/popup.css`)
- **헤더**: 상태 뱃지 (수집 중: 녹색 펄스 애니메이션, 대기 중: 그레이).
- **상태 카드**: 수집된 문장 수, 최근 수집 시각, 활성 타임스탬프 모드 표시.
- **실시간 미리보기 창 (Live Stream Viewer)**:
  - 최근 수집된 자막 10~20개를 실시간 스크롤 카드로 표출.
  - 새 문단 시작 시 시각적 구분선 표시.
- **컨트롤 버튼군**:
  - [수집 시작 / 중지] (Primary toggle button)
  - [전체 복사] (원클릭 클립보드 복사, 복사 완료 피드백 토스트)
  - [기록 초기화] (확인 후 스토리지 및 메모리 즉각 리셋)
- **다운로드 버튼군**:
  - [TXT 다운로드]
  - [Markdown 다운로드]
- **설정 아코디언**:
  - 타임스탬프 모드 선택 (PC 절대시각 / 비디오 재생시각 / 둘 다)
  - 문단 분할 기준 공백 시간 설정 (초 단위)
  - 커스텀 CSS 셀렉터 입력창

### 4.3 내보내기 포맷터 (`utils/export-formatter.js`)
- **Markdown 포맷 예시**:
  ```markdown
  # 국회 의사중계 자막 기록 - 본회의

  - **수집 일시**: 2026-10-27
  - **총 문장 수**: 120
  - **타임스탬프 모드**: PC 시각 & 재생 시각 병기

  ---

  ### [10:15:20 | 재생 00:12:05]
  의사일정 제1항 법률안 심의를 시작하겠습니다.

  ### [10:16:02 | 재생 00:12:47]
  제안설명은 배부해 드린 유인물로 대체하겠습니다.
  ```
- **TXT 포맷 예시**:
  ```text
  [국회 의사중계 자막 기록 - 2026-10-27]
  
  [10:15:20 (00:12:05)] 의사일정 제1항 법률안 심의를 시작하겠습니다.
  
  [10:16:02 (00:12:47)] 제안설명은 배부해 드린 유인물로 대체하겠습니다.
  ```

---

## 5. GitHub 저장소 생성 및 배포 계획 (Git & GitHub Deployment Plan)
1. 로컬 git 저장소 초기화 (`git init`)
2. 전체 확장 프로그램 소스 코드 및 문서 작성
3. `.gitignore` 생성 (OS 파일, 임시 파일 제외)
4. 초기 커밋 생성: `feat: 대한민국 국회 의사중계 실시간 자막 수집기 크롬 확장 프로그램 최초 구현`
5. GitHub CLI (`gh repo create assembly-caption-collector --public --source=. --remote=origin --push`) 명령어로 원격 저장소 자동 생성 및 푸시.

---

## 6. 자체 검토 (Spec Self-Review)
- **Placeholder 검사**: TBD, TODO 등 미정 항목 없음.
- **일관성 검사**: 파일 구조, 메시지 규격, 데이터 모델이 일치함.
- **범위 검사**: 바닐라 JS 기반으로 단일 확장 프로그램 스코프에 부합함.
- **모호성 검사**: PC시각 vs 플레이어 시각, 공백 문단 분할 등 사용자 추가 요구사항이 명확히 정의됨.
