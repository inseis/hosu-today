import catalog from '../data/catalog/catalog.json';
import { parseDayHours, WEEK_ORDER, serializeDayHours } from './hours';
import { emptyVenue, validateVenue } from './venue';
import type { Beverage, BreakTime, DayKey, FeaturedMenu, Venue, VenueOps } from './types';

// CSV 가져오기: 행 → Venue(공개) + VenueOps(비공개) 분리, 기존 데이터와 비교한 미리보기 생성.
// 비공개 열은 VenueOps로만 가고, 알 수 없는 열(사업자번호 등)은 어디에도 저장하지 않는다.

export const PUBLIC_COLUMNS = [
  'id', 'slug', 'name', 'area', 'category', 'description', 'address', 'address_detail',
  'latitude', 'longitude', 'kakao_place_id', 'public_phone', 'cover_image', 'purpose_tags', 'menus',
  ...WEEK_ORDER.map((d) => `hours_${d}`), 'break_times', 'parking_type', 'parking_fee',
  'parking_description', 'parking_capacity', 'entrance_description', 'floor', 'beverages',
  'display_order', 'information_verified_at',
] as const;

export const PRIVATE_COLUMNS = ['consent_status', 'review_status', 'verification_evidence', 'staff_note'] as const;

type Row = Record<string, string | undefined>;

const blank = (s: string | undefined) => (s ?? '').trim();
const nullable = (s: string | undefined) => blank(s) || null;
function numOrNull(s: string | undefined, field: string, errors: string[]): number | null {
  const t = blank(s).replace(/,/g, '');
  if (!t) return null; // 빈칸 = 미확인 (0과 구분)
  const n = Number(t);
  if (!Number.isFinite(n)) errors.push(`${field}: 숫자가 아님 "${s}"`);
  return Number.isFinite(n) ? n : null;
}

const productBrand = new Map(catalog.beverageProducts.map((p) => [p.id, p.brand]));

export function parseMenus(s: string, errors: string[]): FeaturedMenu[] {
  return blank(s).split(';').map((x) => x.trim()).filter(Boolean).map((part) => {
    const i = part.lastIndexOf(':');
    const name = (i >= 0 ? part.slice(0, i) : part).trim();
    const price = i >= 0 ? numOrNull(part.slice(i + 1), `메뉴 가격(${name})`, errors) : null;
    return { name, price, description: null, image: null, verifiedAt: null };
  });
}

/** productId:정확한제품명:제공형태:용량ml:가격:상태:확인일 */
export function parseBeverages(s: string, errors: string[]): Beverage[] {
  return blank(s).split(';').map((x) => x.trim()).filter(Boolean).map((part) => {
    const [productId = '', productName = '', serving = 'unknown', vol, price, status = 'unverified', verifiedAt] = part.split(':').map((x) => x.trim());
    if (!productBrand.has(productId)) errors.push(`음료 제품 id 미등록: "${productId}" (data/catalog/catalog.json 확인)`);
    if (!['draft', 'bottle', 'can', 'unknown'].includes(serving)) errors.push(`음료 제공형태: draft|bottle|can|unknown ("${serving}")`);
    if (!['available', 'unavailable', 'unverified'].includes(status)) errors.push(`음료 상태: available|unavailable|unverified ("${status}")`);
    return {
      productId, brand: productBrand.get(productId) ?? '', productName,
      servingType: serving as Beverage['servingType'],
      volumeMl: numOrNull(vol, '음료 용량', errors), price: numOrNull(price, '음료 가격', errors),
      availabilityStatus: status as Beverage['availabilityStatus'], verifiedAt: verifiedAt || null,
    };
  });
}

/** "mon|tue 15:00-17:00; sat 15:30-17:00" */
export function parseBreaks(s: string, errors: string[]): BreakTime[] {
  return blank(s).split(';').map((x) => x.trim()).filter(Boolean).map((part) => {
    const [days, range] = part.split(/\s+/);
    const [start, end] = (range ?? '').split('-');
    const ds = (days ?? '').split('|') as DayKey[];
    if (!ds.every((d) => WEEK_ORDER.includes(d)) || !start || !end) errors.push(`브레이크타임 형식: "${part}" (예: mon|tue 15:00-17:00)`);
    return { days: ds, start, end };
  });
}

export function rowToRecords(row: Row, existing?: Venue): { venue: Venue; ops: Partial<VenueOps>; errors: string[] } {
  const errors: string[] = [];
  const id = blank(row.id);
  const v: Venue = { ...(existing ?? emptyVenue(id)) };
  v.id = id;
  v.slug = blank(row.slug) || id;
  v.name = blank(row.name);
  v.area = blank(row.area) as Venue['area'];
  v.category = blank(row.category);
  v.description = nullable(row.description);
  v.address = nullable(row.address);
  v.addressDetail = nullable(row.address_detail);
  v.latitude = numOrNull(row.latitude, 'latitude', errors);
  v.longitude = numOrNull(row.longitude, 'longitude', errors);
  v.kakaoPlaceId = nullable(row.kakao_place_id);
  v.publicPhone = nullable(row.public_phone);
  v.coverImage = nullable(row.cover_image);
  v.purposeTags = blank(row.purpose_tags).split('|').map((x) => x.trim()).filter(Boolean) as Venue['purposeTags'];
  v.featuredMenus = parseMenus(row.menus ?? '', errors);
  const allBlank = WEEK_ORDER.every((d) => !blank(row[`hours_${d}`]));
  if (allBlank) v.weeklyHours = null;
  else {
    const h = {} as NonNullable<Venue['weeklyHours']>;
    for (const d of WEEK_ORDER) {
      try { h[d] = parseDayHours(row[`hours_${d}`] ?? ''); } catch (e) { errors.push(`hours_${d}: ${(e as Error).message}`); h[d] = null; }
    }
    v.weeklyHours = h;
  }
  v.breakTimes = parseBreaks(row.break_times ?? '', errors);
  v.parkingType = (blank(row.parking_type) || 'unknown') as Venue['parkingType'];
  v.parkingFee = (nullable(row.parking_fee) as Venue['parkingFee']) ?? null;
  v.parkingDescription = nullable(row.parking_description);
  v.parkingCapacity = numOrNull(row.parking_capacity, 'parking_capacity', errors);
  v.entranceDescription = nullable(row.entrance_description);
  v.floor = nullable(row.floor);
  v.beverages = parseBeverages(row.beverages ?? '', errors);
  v.displayOrder = numOrNull(row.display_order, 'display_order', errors) ?? v.displayOrder;
  v.informationVerifiedAt = nullable(row.information_verified_at);
  // 게시 여부는 CSV로 바꾸지 않는다 (신규는 항상 비공개로 시작)
  v.isPublished = existing?.isPublished ?? false;
  errors.push(...validateVenue(v));

  const ops: Partial<VenueOps> = {};
  const cs = blank(row.consent_status);
  if (cs) ops.consentStatus = cs as VenueOps['consentStatus'];
  const rs = blank(row.review_status);
  if (rs) ops.reviewStatus = rs as VenueOps['reviewStatus'];
  if (blank(row.verification_evidence)) ops.verificationEvidence = blank(row.verification_evidence);
  if (blank(row.staff_note)) ops.staffNote = blank(row.staff_note);
  if (ops.consentStatus && !['pending', 'agreed', 'withdrawn'].includes(ops.consentStatus)) errors.push('consent_status: pending|agreed|withdrawn');
  if (ops.reviewStatus && !['draft', 'in_review', 'approved', 'rejected'].includes(ops.reviewStatus)) errors.push('review_status: draft|in_review|approved|rejected');
  return { venue: v, ops, errors };
}

export type ImportRowStatus = 'new' | 'update' | 'unchanged' | 'duplicate' | 'invalid';

export interface ImportPreviewRow {
  line: number;
  id: string;
  name: string;
  status: ImportRowStatus;
  errors: string[];
  warnings: string[];
  changedFields: string[];
  venue: Venue;
  ops: Partial<VenueOps>;
}

export interface ImportPreview {
  rows: ImportPreviewRow[];
  missing: { id: string; name: string }[];
  ignoredColumns: string[];
  missingColumns: string[];
}

export function buildImportPreview(headers: string[], rows: Row[], existing: Venue[]): ImportPreview {
  const known = new Set<string>([...PUBLIC_COLUMNS, ...PRIVATE_COLUMNS]);
  const ignoredColumns = headers.filter((h) => !known.has(h));
  const missingColumns = ['id', 'name', 'area', 'category'].filter((c) => !headers.includes(c));
  const byId = new Map(existing.map((v) => [v.id, v]));
  const seen = new Set<string>();
  const out: ImportPreviewRow[] = rows.map((row, i) => {
    const id = blank(row.id);
    const prev = byId.get(id);
    const { venue, ops, errors } = rowToRecords(row, prev);
    const warnings: string[] = [];
    const sameName = existing.filter((e) => e.name === venue.name && e.id !== id);
    if (sameName.length) warnings.push(`같은 업소명이 다른 id로 존재: ${sameName.map((s) => s.id).join(', ')} — 주소·장소 ID 대조 필요`);
    if (venue.latitude === null) warnings.push('좌표 미확인 — 지도 마커 없이 목록에만 표시됨');
    let status: ImportRowStatus;
    if (seen.has(id)) status = 'duplicate';
    else if (errors.length) status = 'invalid';
    else if (!prev) status = 'new';
    else status = changed(prev, venue).length || Object.keys(ops).length ? 'update' : 'unchanged';
    if (id) seen.add(id);
    return { line: i + 2, id, name: venue.name, status, errors, warnings, changedFields: prev ? changed(prev, venue) : [], venue, ops };
  });
  const inFile = new Set(out.map((r) => r.id));
  const missing = existing.filter((v) => !inFile.has(v.id)).map((v) => ({ id: v.id, name: v.name }));
  return { rows: out, missing, ignoredColumns, missingColumns };
}

function changed(a: Venue, b: Venue): string[] {
  return (Object.keys(b) as (keyof Venue)[]).filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k]));
}

/** 내보내기·템플릿용 */
export function venueToRow(v: Venue): Record<string, string> {
  const r: Record<string, string> = {
    id: v.id, slug: v.slug, name: v.name, area: v.area, category: v.category,
    description: v.description ?? '', address: v.address ?? '', address_detail: v.addressDetail ?? '',
    latitude: v.latitude?.toString() ?? '', longitude: v.longitude?.toString() ?? '',
    kakao_place_id: v.kakaoPlaceId ?? '', public_phone: v.publicPhone ?? '', cover_image: v.coverImage ?? '',
    purpose_tags: v.purposeTags.join('|'),
    menus: v.featuredMenus.map((m) => `${m.name}:${m.price ?? ''}`).join('; '),
    break_times: v.breakTimes.map((b) => `${b.days.join('|')} ${b.start}-${b.end}`).join('; '),
    parking_type: v.parkingType, parking_fee: v.parkingFee ?? '', parking_description: v.parkingDescription ?? '',
    parking_capacity: v.parkingCapacity?.toString() ?? '', entrance_description: v.entranceDescription ?? '',
    floor: v.floor ?? '',
    beverages: v.beverages.map((b) => [b.productId, b.productName, b.servingType, b.volumeMl ?? '', b.price ?? '', b.availabilityStatus, b.verifiedAt ?? ''].join(':')).join('; '),
    display_order: String(v.displayOrder), information_verified_at: v.informationVerifiedAt ?? '',
  };
  for (const d of WEEK_ORDER) r[`hours_${d}`] = serializeDayHours(v.weeklyHours?.[d] ?? null);
  return r;
}
