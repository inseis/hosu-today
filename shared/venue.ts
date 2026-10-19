import { isValidTime, WEEK_ORDER } from './hours';
import { safeUrl } from './links';
import type {
  AreaId, AvailabilityStatus, Beverage, BreakTime, FeaturedMenu, ParkingType, PublicVenue,
  PurposeTag, ServingType, TemporaryClosure, Venue, WeeklyHours,
} from './types';

// 공개 데이터는 "허용 목록" 방식으로만 만든다. 저장소에 어떤 필드가 섞여 들어와도
// 여기 나열되지 않은 값은 공개 응답·정적 JSON에 포함되지 않는다.

const AREAS: AreaId[] = ['lafesta', 'westerndom', 'lakepark'];
const PURPOSES: PurposeTag[] = ['meal', 'light-snack', 'group', 'quiet-talk'];
const PARKING: ParkingType[] = ['dedicated', 'building', 'public-nearby', 'none', 'unknown'];
const SERVING: ServingType[] = ['draft', 'bottle', 'can', 'unknown'];
const AVAIL: AvailabilityStatus[] = ['available', 'unavailable', 'unverified'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const str = (v: unknown, max = 500): string | null =>
  typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null;
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const date = (v: unknown): string | null => (typeof v === 'string' && DATE_RE.test(v) ? v : null);
const img = (v: unknown): string | null => safeUrl(typeof v === 'string' ? v : null, { allowRelative: true });

function pickMenu(m: FeaturedMenu): FeaturedMenu {
  return { name: str(m.name, 80) ?? '', price: num(m.price), description: str(m.description, 200), image: img(m.image), verifiedAt: date(m.verifiedAt) };
}

function pickBeverage(b: Beverage): Beverage {
  return {
    productId: str(b.productId, 40) ?? '',
    brand: str(b.brand, 40) ?? '',
    productName: str(b.productName, 80) ?? '',
    servingType: SERVING.includes(b.servingType) ? b.servingType : 'unknown',
    volumeMl: num(b.volumeMl),
    price: num(b.price),
    availabilityStatus: AVAIL.includes(b.availabilityStatus) ? b.availabilityStatus : 'unverified',
    verifiedAt: date(b.verifiedAt),
  };
}

function pickHours(h: WeeklyHours | null): WeeklyHours | null {
  if (!h) return null;
  const out = {} as WeeklyHours;
  for (const d of WEEK_ORDER) {
    const r = h[d];
    out[d] = Array.isArray(r) ? r.filter((x) => isValidTime(x.open) && isValidTime(x.close)).map((x) => ({ open: x.open, close: x.close })) : null;
  }
  return out;
}

export function toPublicVenue(v: Venue): PublicVenue {
  return {
    id: v.id,
    slug: v.slug,
    name: v.name,
    area: v.area,
    category: v.category,
    description: str(v.description),
    address: str(v.address, 200),
    addressDetail: str(v.addressDetail, 200),
    latitude: num(v.latitude),
    longitude: num(v.longitude),
    kakaoPlaceId: v.kakaoPlaceId && /^\d+$/.test(v.kakaoPlaceId) ? v.kakaoPlaceId : null,
    publicPhone: str(v.publicPhone, 20),
    coverImage: img(v.coverImage),
    images: (v.images ?? []).map(img).filter((x): x is string => !!x),
    purposeTags: (v.purposeTags ?? []).filter((t) => PURPOSES.includes(t)),
    featuredMenus: (v.featuredMenus ?? []).map(pickMenu).filter((m) => m.name),
    weeklyHours: pickHours(v.weeklyHours),
    breakTimes: (v.breakTimes ?? []).map((b: BreakTime) => ({ days: b.days.filter((d) => WEEK_ORDER.includes(d)), start: b.start, end: b.end })),
    temporaryClosures: (v.temporaryClosures ?? []).map((c: TemporaryClosure) => ({ startDate: c.startDate, endDate: c.endDate, reason: str(c.reason, 100) })),
    parkingType: PARKING.includes(v.parkingType) ? v.parkingType : 'unknown',
    parkingFee: v.parkingFee ?? null,
    parkingDescription: str(v.parkingDescription),
    parkingCapacity: num(v.parkingCapacity),
    entranceDescription: str(v.entranceDescription),
    floor: str(v.floor, 20),
    // 미취급 확인 정보는 고객 화면에 필요하지 않으므로 공개 응답에서 제외
    beverages: (v.beverages ?? []).map(pickBeverage).filter((b) => b.productName && b.availabilityStatus !== 'unavailable'),
    displayOrder: num(v.displayOrder) ?? 9999,
    informationVerifiedAt: date(v.informationVerifiedAt),
  };
}

export function validateVenue(v: Partial<Venue>): string[] {
  const e: string[] = [];
  if (!v.id || !/^[a-z0-9-]{1,60}$/.test(v.id)) e.push('id: 영문 소문자·숫자·하이픈 1~60자');
  if (!v.slug || !/^[a-z0-9-]{1,60}$/.test(v.slug)) e.push('slug: 영문 소문자·숫자·하이픈 1~60자');
  if (!v.name?.trim()) e.push('name: 업소명 필수');
  if (!v.area || !AREAS.includes(v.area)) e.push('area: lafesta | westerndom | lakepark');
  if (!v.category?.trim()) e.push('category: 업태 필수');
  const latOk = v.latitude === null || (typeof v.latitude === 'number' && v.latitude > 33 && v.latitude < 39);
  const lngOk = v.longitude === null || (typeof v.longitude === 'number' && v.longitude > 124 && v.longitude < 132);
  if (!latOk || !lngOk) e.push('좌표: 국내 범위 숫자 또는 미확인(빈칸)');
  if ((v.latitude === null) !== (v.longitude === null)) e.push('좌표: 위도·경도는 함께 입력');
  if (v.kakaoPlaceId && !/^\d+$/.test(v.kakaoPlaceId)) e.push('kakaoPlaceId: 숫자');
  if (v.coverImage && !safeUrl(v.coverImage, { allowRelative: true })) e.push('coverImage: http(s) 또는 / 경로');
  for (const m of v.featuredMenus ?? []) {
    if (m.price !== null && (typeof m.price !== 'number' || m.price < 0)) e.push(`메뉴 가격(${m.name}): 0 이상 숫자 또는 미확인`);
  }
  for (const b of v.beverages ?? []) {
    if (!b.productName?.trim()) e.push('음료: 정확한 제품명 필수');
  }
  if (v.publicPhone && !/^[0-9-]{7,15}$/.test(v.publicPhone)) e.push('publicPhone: 숫자와 하이픈');
  return e;
}

export function emptyVenue(id = ''): Venue {
  return {
    id, slug: id, name: '', area: 'lafesta', category: '', description: null, address: null, addressDetail: null,
    latitude: null, longitude: null, kakaoPlaceId: null, publicPhone: null, coverImage: null, images: [],
    purposeTags: [], featuredMenus: [], weeklyHours: null, breakTimes: [], temporaryClosures: [],
    parkingType: 'unknown', parkingFee: null, parkingDescription: null, parkingCapacity: null,
    entranceDescription: null, floor: null, beverages: [], displayOrder: 100, isPublished: false,
    informationVerifiedAt: null,
  };
}

/** 정보 확인일이 오래됐는지 (기본 180일) */
export function isStale(verifiedAt: string | null, now = new Date(), days = 180): boolean {
  if (!verifiedAt) return true;
  return now.getTime() - new Date(`${verifiedAt}T00:00:00+09:00`).getTime() > days * 86400000;
}
