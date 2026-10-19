# 데이터 입력 안내

## 1. 공개 데이터와 비공개 데이터

| 구분 | 위치 | 고객에게 |
|---|---|---|
| `Venue` (공개 필드) | `data/store/venues.json` | 게시 조건 충족 시 공개 API·정적 JSON으로 제공 |
| `VenueOps` (게시 동의·검토 상태·확인 근거·담당자 메모) | `data/store/ops.json` | **절대 공개 안 됨** |
| 캠페인·설정·제보·지표 | `data/store/*.json` | 설정 중 공개 항목만 |

- 공개 응답은 `shared/venue.ts`의 `toPublicVenue()` **허용 목록**으로만 만들어집니다. 저장소에 다른 필드가 섞여도 공개되지 않습니다.
- **사업자번호·도매사·점주 개인 전화번호·POC 코드·매출·BEES 사용 여부·내부 등급은 이 시스템에 입력하지 마세요.** 해당 필드가 없으며, CSV에 이런 열이 있으면 “무시하는 열”로 표시되고 어디에도 저장되지 않습니다.
- 내부 원본 영업 파일은 이 프로젝트 폴더에 두지 마세요.
- `npm run build`는 빌드 결과물에서 내부 용어(POC·BDR·BEES·KPI 등)와 비공개 필드명을 검사해, 고객 화면 번들에 있으면 빌드를 실패시킵니다.

## 2. 게시 조건

고객 화면에 나오려면 **세 가지 모두** 필요합니다.

1. 게시 동의(`consentStatus = agreed`) — 업소가 게시에 동의했음을 운영자가 확인
2. 게시 검토 승인(`reviewStatus = approved`) — 공개 문구·정보를 운영자가 검토
3. 게시 ON(`isPublished = true`)

CSV로는 게시 ON을 바꿀 수 없고, 신규 업소는 항상 비공개로 시작합니다. 후보 목록을 자동 공개하지 않습니다.

> 석암생소금구이·남도해물·주댕곱창대구막창·빽스비어 등 **실제 후보 업소는 아직 입력되어 있지 않습니다.** 업소로부터 받은 정보와 운영자의 확인·동의 기록이 있을 때 입력하세요. 이름만으로 주소·제품 취급·게시 동의가 확인된 것으로 처리하지 않습니다.

## 3. 값 규칙 — “모름”은 비워 두기

- 가격·좌표·용량·주차 대수: **빈칸 = 미확인(null)**. `0`은 실제 0(예: 무료)으로 저장됩니다.
- 영업시간: 빈칸 = 미확인, `휴무` = 정기 휴무, `17:00-02:00` = 자정을 넘는 영업(다음 날 02시까지), `16:00-24:00` = 자정 종료.
- 음료 상태: `available`(취급 확인) / `unverified`(미확인) / `unavailable`(미취급 확인).
  고객 화면은 미확인을 ‘미취급’으로 표시하지 않으며, `unavailable`은 공개하지 않습니다.
- 제품명은 **정확한 이름 그대로** (예: `카스 0.0`과 `카스 0.00`은 다른 제품). 무알코올·비알코올 표기는 제품 정보대로만. 건강·운전과 연결되는 문구를 쓰지 마세요.
- 같은 브랜드라도 **병·생맥주는 각각 한 줄씩**. “한맥 취급”만 적어 생맥주가 있는 것처럼 보이지 않게 합니다.
- 사진은 업소가 제공한 실사진 URL만. 없으면 비워 두면 ‘사진 준비 중’으로 표시됩니다.
- 소개 문구에 ‘검증된 맛집’, ‘지역 1위’, ‘가장 인기’ 같은 확인되지 않은 표현을 쓰지 마세요.

## 4. CSV 템플릿

템플릿: `data/templates/venues-template.csv` (관리자 화면에서도 다운로드). UTF-8로 저장하세요(엑셀은 “CSV UTF-8” 형식).

| 열 | 형식 / 예시 |
|---|---|
| `id`, `slug` | 영문 소문자·숫자·하이픈. slug는 상세 주소(`/venues/{slug}`) — **QR에 넣은 뒤에는 바꾸지 마세요** |
| `name`, `category` | 업소명, 업태 |
| `area` | `lafesta` / `westerndom` / `lakepark` |
| `description` | 소개 한두 문장 |
| `address`, `address_detail` | 주소, 상세 위치(동·층·출입구) |
| `latitude`, `longitude`, `kakao_place_id` | 관리자 화면의 **장소 검색**으로 확인 후 입력 권장 |
| `public_phone` | 업소 대표 공개 번호만 |
| `cover_image` | `https://…` 또는 `/images/…` |
| `purpose_tags` | `meal|light-snack|group|quiet-talk` 중 업소가 확인한 것 (`|`로 구분) |
| `menus` | `메뉴명:가격; 메뉴명:` (가격 빈칸 = 미확인) |
| `hours_mon` … `hours_sun` | `11:30-15:00, 17:00-22:00` / `휴무` / 빈칸 |
| `break_times` | `mon|tue|wed 15:00-17:00; sat 15:30-16:30` |
| `parking_type` | `dedicated`(매장 전용) / `building`(건물) / `public-nearby`(인근 공영) / `none`(불가) / `unknown` |
| `parking_fee` | `free` / `paid` / `conditional` / 빈칸 |
| `parking_description`, `parking_capacity` | 조건 안내, 확인된 대수 |
| `entrance_description`, `floor` | 실제 확인된 입구 경로, 층 |
| `beverages` | `제품id:정확한제품명:제공형태:용량ml:가격:상태:확인일` 을 `;`로 구분<br>예: `hanmac:한맥:draft:500::available:2026-10-01; cass:카스 후레쉬:bottle:::available:2026-10-01` |
| `display_order` | 공개 순서(작을수록 위) |
| `information_verified_at` | `YYYY-MM-DD` — 180일이 지나면 상세 화면에 “확인한 지 오래된 정보” 안내 |
| `consent_status`, `review_status`, `verification_evidence`, `staff_note` | **비공개 운영 열** — 운영 데이터로만 저장 |

가져오기 미리보기는 행마다 **신규 / 수정(바뀐 필드 표시) / 변경 없음 / 파일 내 중복 / 오류**를 보여주고, 파일에 없는 기존 업소(삭제하지 않음), 무시하는 열, 같은 이름의 다른 id 업소(주소 대조 필요)를 알려줍니다. 서버는 반영 시 다시 검증합니다.

제품 id 목록은 `data/catalog/catalog.json`의 `beverageProducts`. 제품 추가·이름 변경은 이 파일을 수정하고 다시 빌드합니다.

## 5. 입력 예시 JSON

`data/examples/venue.example.json` — 공개 `venue`와 비공개 `ops`를 나눠 담은 예시(가상 정보).

## 6. 같은 이름의 업소가 여러 곳일 때

관리자 편집 화면 → **장소 검색** → 결과마다 주소·카테고리·장소 ID와 “카카오맵에서 확인” 링크가 나옵니다. 운영자가 주소를 대조해 **이 장소로 선택**을 눌러야 좌표·장소 ID가 들어갑니다. 자동 선택하지 않으며, 좌표가 없는 업소는 지도에 표시하지 않습니다(목록에는 ‘지도 위치 확인 중’).
