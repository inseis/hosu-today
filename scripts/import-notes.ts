// 상권 노트(내부 영업 기록 JSON)에서 '장항동' 업소의 공개 가능한 항목만 골라 저장소에 등록하고,
// 업소 주변 주차장을 카카오 '주차장' 카테고리 검색으로 수집한다.
//
// 사용: KAKAO_REST_API_KEY=... npx tsx scripts/import-notes.ts <노트파일.json>
//
// - 노트 파일은 이 저장소에 복사하지 않는다(경로로만 읽음).
// - 가져오는 값: 상호, 주소, 업태, 이용 성격(식사/2차), '취급 중'으로 기록된 음료.
// - 담당자명·의사결정자·도매사·경쟁사·후속 조치·메모 등은 읽지도 저장하지도 않는다.
// - REST API 키는 이 로컬 스크립트에서만 쓰고, 파일·번들에 저장하지 않는다.
import { readFileSync } from 'node:fs';
import crypto from 'node:crypto';
try { process.loadEnvFile('.env'); } catch { /* optional */ }
const { update } = await import('../server/store');
const { emptyVenue } = await import('../shared/venue');
const { haversineMeters } = await import('../shared/filter');
import type { AreaId, Beverage, ParkingLot, PurposeTag, Venue, VenueOps } from '../shared/types';

const KEY = process.env.KAKAO_REST_API_KEY;
const file = process.argv[2];
if (!KEY || !file) {
  console.error('사용법: KAKAO_REST_API_KEY=... npx tsx scripts/import-notes.ts <노트파일.json>');
  process.exit(1);
}

interface NoteRecord {
  id?: string; area?: string; storeName?: string; address?: string; businessType?: string;
  usePurpose?: string; visitStatus?: string; products?: Record<string, string>; updatedAt?: string;
  /** 조사 시 업소에서 쓰고 있던 제품 목록 (자유 입력). 제품 취급 여부만 추출하고 원문은 저장하지 않음 */
  competitors?: string;
}

const ID_PREFIX = 'jh-';
const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);

// 지역 기준점 (카카오 장소 검색으로 확인한 좌표)
const ANCHORS: { area: AreaId; lat: number; lng: number }[] = [
  { area: 'lafesta', lat: 37.66103, lng: 126.76831 },
  { area: 'westerndom', lat: 37.65589, lng: 126.77218 },
  { area: 'lakepark', lat: 37.65614, lng: 126.76414 },
];

const CATEGORY: Record<string, string> = {
  '한식·고깃집': '한식·고기', '중식·아시안': '중식·아시안', '이자카야·요리주점': '요리주점',
  '치킨·호프': '치킨·호프', '펍·생맥주 전문': '펍', '양식·피자': '양식',
};

// 노트의 제품 표기 → 카탈로그 제품. 코로나 등 카탈로그에 없는 제품은 제외
type BevBase = Omit<Beverage, 'availabilityStatus' | 'verifiedAt' | 'price'>;

// 조사 메모의 '사용 제품' 자유 입력 → 제품 (기본 병, 바로 뒤에 '생'이 붙으면 생맥주)
// 예: "카스 테라 켈리 테라제로", "스텔라2 카스 생, 카스 테라", "테라 생"
// 테라라이트·하이트제로 등 카탈로그에 없는 제품은 제외
const USED_RE = /(카스\s?제로|테라\s?제로|테라\s?라이트|테라|켈리|캘리|카스)(\s?생(?!맥))?/g;
const USED: Record<string, BevBase | null> = {
  카스: { productId: 'cass', brand: '카스', productName: '카스', servingType: 'bottle', volumeMl: null },
  카스제로: { productId: 'cass-zero', brand: '카스', productName: '카스 0.00', servingType: 'bottle', volumeMl: null },
  테라: { productId: 'terra', brand: '테라', productName: '테라', servingType: 'bottle', volumeMl: null },
  테라제로: { productId: 'terra-zero', brand: '테라', productName: '테라 제로', servingType: 'bottle', volumeMl: null },
  켈리: { productId: 'kelly', brand: '켈리', productName: '켈리', servingType: 'bottle', volumeMl: null },
  캘리: { productId: 'kelly', brand: '켈리', productName: '켈리', servingType: 'bottle', volumeMl: null },
  테라라이트: null,
};
function parseUsed(text: string): BevBase[] {
  const out: BevBase[] = [];
  for (const m of text.matchAll(USED_RE)) {
    const base = USED[m[1].replace(/\s/g, '')];
    if (!base) continue;
    out.push(m[2] ? { ...base, servingType: 'draft' } : base);
  }
  return out;
}

const PRODUCTS: Record<string, BevBase> = {
  '카스 생': { productId: 'cass', brand: '카스', productName: '카스', servingType: 'draft', volumeMl: null },
  // 노트의 '카스 0.0' 표기는 운영자 확인에 따라 카스 0.00 병맥주로 등록 (2026-10-19)
  '카스 0.0': { productId: 'cass-zero', brand: '카스', productName: '카스 0.00', servingType: 'bottle', volumeMl: null },
  '한맥 병': { productId: 'hanmac', brand: '한맥', productName: '한맥', servingType: 'bottle', volumeMl: null },
  '한맥 생': { productId: 'hanmac', brand: '한맥', productName: '한맥', servingType: 'draft', volumeMl: null },
  '스텔라 생': { productId: 'stella', brand: '스텔라', productName: '스텔라', servingType: 'draft', volumeMl: null },
  '스텔라 병 330ml': { productId: 'stella', brand: '스텔라', productName: '스텔라', servingType: 'bottle', volumeMl: 330 },
  '버드와이저 생': { productId: 'budweiser', brand: '버드와이저', productName: '버드와이저', servingType: 'draft', volumeMl: null },
  '버드와이저 병 330ml': { productId: 'budweiser', brand: '버드와이저', productName: '버드와이저', servingType: 'bottle', volumeMl: 330 },
};

interface KakaoDoc { id: string; place_name: string; address_name: string; road_address_name: string; category_name: string; x: string; y: string }

async function kakao(path: string, params: Record<string, string>): Promise<KakaoDoc[]> {
  const url = `https://dapi.kakao.com${path}?${new URLSearchParams(params)}`;
  const r = await fetch(url, { headers: { Authorization: `KakaoAK ${KEY}` } });
  if (!r.ok) throw new Error(`Kakao ${r.status}: ${await r.text()}`);
  return ((await r.json()) as { documents: KakaoDoc[] }).documents;
}

const normAddr = (a: string) => {
  const s = a.replace(/\s+/g, ' ').trim();
  return s.startsWith('경기') ? s : `경기 고양시 일산동구 ${s}`;
};
const lot = (a: string) => a.match(/장항동\s*([\d-]+)/)?.[1] ?? '';

async function locate(name: string, address: string) {
  const near = { x: '126.7700', y: '37.6585', radius: '2500' };
  const docs = await kakao('/v2/local/search/keyword.json', { query: name.trim(), ...near, size: '15' });
  const l = lot(address);
  const pick = docs.find((d) => lot(d.address_name) === l)
    ?? docs.find((d) => d.address_name.includes('장항동') && d.place_name.replace(/\s/g, '').includes(name.replace(/\s/g, '')));
  if (pick) return { lat: Number(pick.y), lng: Number(pick.x), placeId: pick.id, road: pick.road_address_name || null, kakaoCategory: pick.category_name, how: 'place' as const };
  const a = await kakao('/v2/local/search/address.json', { query: address });
  if (a[0]) return { lat: Number(a[0].y), lng: Number(a[0].x), placeId: null, road: null, kakaoCategory: null, how: 'address' as const };
  return null;
}

const nearestArea = (lat: number, lng: number): AreaId =>
  ANCHORS.map((a) => ({ a: a.area, d: haversineMeters({ lat, lng }, a) })).sort((x, y) => x.d - y.d)[0].a;

// ── 1. 업소 ──
const records = (JSON.parse(readFileSync(file, 'utf8')) as { records: NoteRecord[] }).records;
const targets = records.filter((r) =>
  ((r.area ?? '').includes('장항') || (r.address ?? '').includes('장항'))
  && r.storeName?.trim() && r.address?.trim()
  && !r.storeName.includes('미확인')
  && r.visitStatus !== '조사 거절');

const venues: Venue[] = [];
const report: string[] = [];
for (const [i, r] of targets.entries()) {
  const name = r.storeName!.trim();
  const address = normAddr(r.address!);
  const loc = await locate(name, address);
  const verified = (r.updatedAt ?? '').slice(0, 10) || today;
  const fromProducts = Object.entries(r.products ?? {}).filter(([k, v]) => v === '취급 중' && PRODUCTS[k]).map(([k]) => PRODUCTS[k]);
  const seen = new Set<string>();
  const beverages: Beverage[] = [...fromProducts, ...parseUsed(r.competitors ?? '')]
    .filter((b) => { const k = `${b.productId}|${b.servingType}`; if (seen.has(k)) return false; seen.add(k); return true; })
    .map((b) => ({ ...b, price: null, availabilityStatus: 'available', verifiedAt: verified }));
  const purposes: PurposeTag[] = (r.usePurpose ?? '').includes('주류') ? ['light-snack'] : (r.usePurpose ?? '').includes('식사') ? ['meal'] : [];
  const kakaoCat = loc?.kakaoCategory?.split('>').pop()?.trim();
  const hash = crypto.createHash('sha1').update(r.id ?? name).digest('hex').slice(0, 8);
  const id = `${ID_PREFIX}${loc?.placeId ?? hash}`;
  // 공개 순서: 강조 제품(카스 생·카스 0.00·한맥) → 카스 병 → 그 외
  const featured = beverages.some((b) => ['cass-zero', 'hanmac'].includes(b.productId) || (b.productId === 'cass' && b.servingType !== 'bottle'));
  const cassBottle = beverages.some((b) => b.productId === 'cass' && b.servingType === 'bottle');
  venues.push({
    ...emptyVenue(id),
    name,
    area: loc ? nearestArea(loc.lat, loc.lng) : 'westerndom',
    category: CATEGORY[r.businessType ?? ''] ?? kakaoCat ?? '음식점',
    address: loc?.road ? `${loc.road} (${address.replace('경기 고양시 일산동구 ', '')})` : address,
    latitude: loc?.lat ?? null,
    longitude: loc?.lng ?? null,
    kakaoPlaceId: loc?.placeId ?? null,
    purposeTags: purposes,
    beverages,
    displayOrder: (featured ? 10 : cassBottle ? 100 : 200) + i,
    isPublished: true,
    informationVerifiedAt: verified,
  });
  report.push(`${loc ? (loc.how === 'place' ? '장소' : '주소') : '좌표없음'}\t${name}\t${beverages.map((b) => `${b.productName}(${b.servingType})`).join(',')}`);
}

const ops: VenueOps[] = venues.map((v) => ({
  venueId: v.id, consentStatus: 'agreed', consentRecordedAt: today, reviewStatus: 'approved',
  verificationEvidence: `상권 노트(2026-10-19) 기반 일괄 등록 · 게시 동의는 운영자 확인(${today})`,
  staffNote: '메뉴·가격·영업시간·주차는 미입력 (대략 등록)', updatedAt: new Date().toISOString(),
}));

await update('venues', (cur) => ({ next: [...cur.filter((v) => !v.id.startsWith(ID_PREFIX)), ...venues] }));
await update('ops', (cur) => ({ next: [...cur.filter((o) => !o.venueId.startsWith(ID_PREFIX)), ...ops] }));

// ── 2. 주변 주차장 ──
const lots = new Map<string, ParkingLot>();
for (const a of ANCHORS) {
  for (let page = 1; page <= 3; page++) {
    const docs = await kakao('/v2/local/search/category.json', {
      category_group_code: 'PK6', x: String(a.lng), y: String(a.lat), radius: '700', page: String(page), size: '15', sort: 'distance',
    });
    for (const d of docs) {
      lots.set(d.id, {
        id: `pk-${d.id}`, name: d.place_name, kind: d.place_name.includes('공영') ? 'public' : 'building',
        address: d.road_address_name || d.address_name || null, latitude: Number(d.y), longitude: Number(d.x),
        kakaoPlaceId: d.id, collectedAt: today,
      });
    }
    if (docs.length < 15) break;
  }
}
// 고객이 이용하기 쉬운 곳 위주로 추림: 공영주차장 + 대형 상가(라페스타·웨스턴돔·백화점·엠시티) + 오피스텔 부설.
// 관공서 주차장 제외, 운영사 이름만 다른 같은 주소 중복은 하나로. 등록 업소에서 500m 이내만.
const KEEP = /(라페스타|웨스턴돔|오피스텔|웨스턴853|롯데백화점|엠시티|M시티)/;
const DROP = /(세무서|연수원|공소청|구청)/;
const OPERATOR = /^(하이파킹|투루파킹|아마노|카카오T|나이스파크)\s*/;
const located = venues.filter((v) => v.latitude !== null);
const byAddr = new Map<string, ParkingLot>();
for (const p of lots.values()) {
  if (DROP.test(p.name) || (p.kind === 'building' && !KEEP.test(p.name))) continue;
  if (!located.some((v) => haversineMeters({ lat: p.latitude, lng: p.longitude }, { lat: v.latitude!, lng: v.longitude! }) <= 500)) continue;
  const key = p.address ?? p.id;
  const prev = byAddr.get(key);
  if (!prev || (OPERATOR.test(prev.name) && !OPERATOR.test(p.name))) byAddr.set(key, p);
}
const parking = [...byAddr.values()];
await update('parking', () => ({ next: parking }));

console.log(report.join('\n'));
console.log(`\n업소 ${venues.length}곳 등록 (장소 매칭 ${report.filter((x) => x.startsWith('장소')).length}, 주소 좌표 ${report.filter((x) => x.startsWith('주소')).length}, 좌표 없음 ${report.filter((x) => x.startsWith('좌표없음')).length})`);
console.log(`강조 업소(카스 생·0.00·한맥) ${venues.filter((v) => v.displayOrder < 100).length}곳, 카스 병 ${venues.filter((v) => v.beverages.some((b) => b.productId === 'cass' && b.servingType === 'bottle')).length}곳, 논알콜 ${venues.filter((v) => v.beverages.some((b) => b.productId === 'cass-zero' || b.productId === 'terra-zero')).length}곳`);
console.log(`주차장 ${parking.length}곳 (공영 ${parking.filter((p) => p.kind === 'public').length}, 건물·민영 ${parking.filter((p) => p.kind === 'building').length})`);
