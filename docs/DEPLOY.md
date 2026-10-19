# 배포 절차

> 이 저장소는 아직 어디에도 배포되지 않았습니다. 배포·도메인 구입·유료 서비스 사용은 운영 담당자가 결정합니다.

## A. 서버형 (권장 — 관리자 기능·제보·지표 모두 사용)

Node 20 이상이 실행되는 한 대의 서버(VM, Render·Railway·Fly.io 같은 Node 호스팅 등)에 올립니다.

```bash
npm ci
# 운영용 .env (서버에만 보관)
#   VITE_DATA_MODE=live
#   VITE_KAKAO_MAP_JAVASCRIPT_KEY=…(JavaScript 키)
#   VITE_PUBLIC_BASE_URL=https://운영도메인
#   VITE_ANALYTICS_ENDPOINT=/api/events      (집계할 경우)
#   ADMIN_USERNAME / ADMIN_PASSWORD_HASH / SESSION_SECRET
#   ANALYTICS_ENABLED=true                     (집계할 경우)
#   DATA_DIR=/영구/저장/경로                    (재배포해도 지워지지 않는 디스크)
npm run build        # VITE_ 값은 빌드 시점에 번들에 들어갑니다 — 값을 바꾸면 다시 빌드
npm start            # dist + /api 를 PORT 에서 제공
```

체크리스트
- HTTPS 필수(위치 권한·공유·보안 쿠키). 리버스 프록시(Nginx/Caddy) 또는 호스팅의 TLS 사용.
- `DATA_DIR`은 **영구 디스크**에. 컨테이너 임시 디스크면 재시작 시 데이터가 사라집니다. 주기적으로 백업하세요(JSON 파일 복사).
- JSON 파일 저장소는 **서버 1대(단일 프로세스)** 기준입니다. 여러 인스턴스로 늘리려면 DB(Postgres 등)로 `server/store.ts`를 교체해야 합니다.
- 카카오 콘솔에 운영 도메인을 등록 (KAKAO_SETUP.md §3).

## B. 정적형 (서버를 둘 수 없을 때)

고객 화면만 정적 호스팅(Netlify, Cloudflare Pages, GitHub Pages 등)에 올리고, 데이터 수정은 운영자 PC에서 합니다.

1. 운영자 PC에서 `npm run dev` → `/admin`에서 업소 수정 (데이터는 PC의 `data/store`)
2. `npm run export:public` → `public/data/public.json` 생성 (게시 승인 업소만)
3. `.env`에 `VITE_DATA_MODE=live`, `VITE_PUBLIC_DATA_URL=/data/public.json` 설정 후 `npm run build`
4. `dist/`를 업로드. SPA이므로 **모든 경로를 `index.html`로 되돌리는 설정**이 필요합니다(Netlify `_redirects`: `/* /index.html 200`).

한계: 오류 제보는 서버가 없어 접수되지 않고 설정의 공개 이메일로 안내됩니다. 이벤트 집계도 없습니다(별도 분석 서비스를 연결하려면 `src/analytics/events.ts`의 전송부만 바꾸면 됩니다). 기간 한정 안내 문구는 내보낸 시점 기준이므로 기간이 바뀌면 다시 내보내야 합니다. 브라우저 localStorage를 공유 DB나 관리자 인증처럼 쓰지 않습니다.

## QR 인쇄 전 점검

1. `VITE_PUBLIC_BASE_URL`을 **운영자가 관리하는 고정 도메인**으로 설정하고 다시 빌드 (미설정이면 QR 화면에 “미리보기용”이 표시되고 파일명에 `-preview`가 붙습니다)
2. 관리자 → 캠페인·QR → 캠페인 등록 → 화면의 **“해독 결과가 목적 URL과 일치”** 확인 → SVG(인쇄용) 또는 PNG 다운로드
3. 서버에서도 확인: `npm run qr:verify -- "https://도메인/explore?source=lake-banner-01" qr.png`
4. 실제 휴대폰(iPhone 카메라, 안드로이드, 카카오톡 QR)으로 인쇄 시안을 스캔
5. QR 위에 로고·장식을 덮지 말고, 사방 여백(quiet zone)을 자르지 마세요. 배너 디자인과 연결 페이지는 QR 화면 오른쪽 미리보기로 함께 검토합니다.
6. 주류 브랜드 노출 방식과 공개 문구는 운영 담당자가 광고 관련 기준을 확인한 뒤 공개합니다(설정 → 음료 브랜드 정보 노출).

QR에는 고정 주소만 들어가므로, 업소 정보·메뉴·가격 변경 시 배너를 다시 인쇄할 필요가 없습니다. 단 업소 상세용 QR은 해당 `slug`를 바꾸면 깨지므로 slug는 고정하세요.
