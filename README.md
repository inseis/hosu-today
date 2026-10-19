# 호수원픽

고양시 일산동구 장항동 라페스타·웨스턴돔·일산호수공원 인근의 **참여 업소 방문 정보**를 QR로 안내하는 모바일 웹 MVP입니다.
(이전 임시 이름: ‘호수공원 옆, 오늘의 한 곳’. 서비스 이름은 `VITE_SITE_NAME` 또는 `src/config/site.ts`에서 변경)

- 고객 화면: 지도·목록 / 검색·필터 / 업소 상세 / 카카오맵 길찾기 — 앱 설치·회원가입 없음
- 관리자 화면(`/admin`): 업소 등록·수정·게시 중단, CSV 가져오기, 캠페인 QR 생성, 오류 제보, 이용 지표, 설정
- 기술: React 18 · TypeScript · Vite · React Router / Node(Express) API + JSON 파일 저장소

> **데모와 운영의 구분** — `VITE_DATA_MODE=demo`는 가상 상호(“[데모] …”) 데이터를 쓰고 화면 상단에 ‘데모 데이터’ 띠를 표시합니다.
> `live` 빌드에는 데모 파일이 번들에 포함되지 않으며, 서버 저장소에서 **게시 ON + 게시 동의 + 검토 승인**된 업소만 공개됩니다.

---

## 빠른 시작

```bash
npm install
cp .env.example .env           # 값 채우기 (아래 참고)
npm run admin:hash -- '10자 이상 비밀번호'   # 출력값을 .env 의 ADMIN_PASSWORD_HASH 에
openssl rand -hex 32           # 출력값을 .env 의 SESSION_SECRET 에
npm run dev                    # 웹 http://localhost:5173  ·  API http://localhost:8787
```

| 명령 | 설명 |
|---|---|
| `npm run dev` | Vite 개발 서버 + API 서버 동시 실행 (`/api`는 프록시) |
| `npm test` | 단위·통합 테스트 (영업시간·필터·공개 필드·CSV·링크·QR 왕복·서버 API) |
| `npm run build` | 타입 검사 → 빌드 → **번들 개인정보·내부용어 검사** |
| `npm start` | 운영 서버 (빌드된 `dist` + API를 한 프로세스로 제공) |
| `npm run export:public` | 게시 업소만 `public/data/public.json`으로 내보내기 (정적 호스팅용) |
| `npm run qr:verify -- <URL> [out.png]` | QR PNG 생성 후 다시 해독해 URL 일치 확인 |

## 환경변수

`.env.example`에 설명이 있습니다. 요점:

- **브라우저로 전달되는 값(`VITE_*`)**: `VITE_KAKAO_MAP_JAVASCRIPT_KEY`, `VITE_DATA_MODE`, `VITE_SITE_NAME`, `VITE_PUBLIC_BASE_URL`, `VITE_PUBLIC_DATA_URL`, `VITE_ANALYTICS_ENDPOINT`
- **서버 전용**: `ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH`, `SESSION_SECRET`, `ANALYTICS_ENABLED`, `DATA_DIR`, `PORT`
- 카카오 **REST API 키·Admin 키는 이 프로젝트에 필요 없으며 절대 `VITE_` 변수에 넣지 마세요**(번들에 그대로 노출됩니다).

## 문서

- [docs/KAKAO_SETUP.md](docs/KAKAO_SETUP.md) — 카카오맵 키·도메인·사용 설정·쿼터
- [docs/DATA_GUIDE.md](docs/DATA_GUIDE.md) — 데이터 구조, 공개/비공개 분리, CSV 템플릿 형식, 게시 절차
- [docs/DEPLOY.md](docs/DEPLOY.md) — 배포 절차(서버형 / 정적형), QR 인쇄 전 점검
- [docs/STATUS.md](docs/STATUS.md) — 실제 연결된 기능 vs 추가 설정이 필요한 기능, 완료 기준 점검 결과
- `docs/screenshots/` — 모바일(360px)·데스크톱·관리자 주요 화면

## 폴더 구조

```
shared/        화면·서버 공용 로직 (타입, 영업시간 계산, 필터, 공개필드 허용목록, CSV, 링크 검증)
server/        Express API, 관리자 인증, JSON 파일 저장소
src/
  config/      서비스 이름·문구·환경값
  data/        공개 데이터 접근 계층 (데모 / 서버 API / 정적 JSON)
  analytics/   이벤트 인터페이스
  pages/       탐색·상세·안내 화면
  components/  지도, 카드, 음료 선택창 등
  admin/       관리자 화면 (별도 청크)
  demo/        가상 데모 데이터 (live 빌드에서 제외)
data/
  catalog/     지역·이용목적·음료 제품 목록 (수정 가능한 데이터)
  templates/   CSV 템플릿
  examples/    입력 예시 JSON
  store/       운영 저장소 (git 제외)
scripts/       비밀번호 해시, 공개 JSON 내보내기, 번들 검사, QR 검증
tests/
```
