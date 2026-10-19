import catalog from '../data/catalog/catalog.json';
import { getOpenStatus } from './hours';
import type { AreaId, ParkingLot, PublicVenue, PurposeTag } from './types';

// 지도와 목록은 반드시 이 함수 하나의 결과를 함께 사용한다.

export interface Bounds {
  sw: { lat: number; lng: number };
  ne: { lat: number; lng: number };
}

export interface FilterState {
  q: string;
  area: AreaId | 'all';
  purposes: PurposeTag[];
  parking: boolean;
  openNow: boolean;
  products: string[];
  draftOnly: boolean;
  /** 논알콜·무알콜 제품 취급 확인 업소만 */
  nonAlc: boolean;
  bounds: Bounds | null;
}

export const EMPTY_FILTER: FilterState = {
  q: '', area: 'all', purposes: [], parking: false, openNow: false,
  products: [], draftOnly: false, nonAlc: false, bounds: null,
};

/** 카탈로그에서 nonAlcoholic 표시된 제품 */
export const NON_ALC_PRODUCTS: string[] = catalog.beverageProducts.filter((p) => (p as { nonAlcoholic?: boolean }).nonAlcoholic).map((p) => p.id);

export function hasNonAlc(v: PublicVenue): boolean {
  return v.beverages.some((b) => b.availabilityStatus === 'available' && NON_ALC_PRODUCTS.includes(b.productId));
}

const PARKING_OK = new Set(['dedicated', 'building', 'public-nearby']);

function norm(s: string): string {
  return s.toLowerCase().replace(/\s+/g, '');
}

export function hasCoords(v: Pick<PublicVenue, 'latitude' | 'longitude'>): v is { latitude: number; longitude: number } {
  return typeof v.latitude === 'number' && typeof v.longitude === 'number'
    && Number.isFinite(v.latitude) && Number.isFinite(v.longitude);
}

export function inBounds(v: PublicVenue, b: Bounds): boolean {
  if (!hasCoords(v)) return false;
  return v.latitude >= b.sw.lat && v.latitude <= b.ne.lat && v.longitude >= b.sw.lng && v.longitude <= b.ne.lng;
}

export function matchesBeverage(v: PublicVenue, products: string[], draftOnly: boolean): boolean {
  if (products.length === 0 && !draftOnly) return true;
  // 확인된 취급(available)만 대상으로 한다. 미확인은 일치로도 불일치로도 단정하지 않으므로 제외.
  const avail = v.beverages.filter((b) => b.availabilityStatus === 'available');
  const ok = (b: (typeof avail)[number]) => !draftOnly || b.servingType === 'draft';
  if (products.length === 0) return avail.some(ok);
  return products.some((p) => avail.some((b) => b.productId === p && ok(b)));
}

/** 업소에서 maxM 이내 주차장 (직선거리 오름차순) */
export function nearbyParking(v: PublicVenue, lots: ParkingLot[], maxM = 300): { lot: ParkingLot; meters: number }[] {
  if (!hasCoords(v)) return [];
  return lots
    .map((lot) => ({ lot, meters: haversineMeters({ lat: v.latitude, lng: v.longitude }, { lat: lot.latitude, lng: lot.longitude }) }))
    .filter((x) => x.meters <= maxM)
    .sort((a, b) => a.meters - b.meters);
}

export interface FilterOptions {
  /** '주차 가능' 필터에서 업소 자체 주차 외에 인근 주차장도 인정할지 판단 */
  hasNearbyParking?: (v: PublicVenue) => boolean;
}

export function filterVenues(venues: PublicVenue[], f: FilterState, now: Date = new Date(), opts: FilterOptions = {}): PublicVenue[] {
  const q = norm(f.q);
  return venues.filter((v) => {
    if (f.area !== 'all' && v.area !== f.area) return false;
    if (f.purposes.length && !f.purposes.every((p) => v.purposeTags.includes(p))) return false;
    if (f.parking && !PARKING_OK.has(v.parkingType) && !opts.hasNearbyParking?.(v)) return false;
    if (f.openNow && getOpenStatus(v, now).state !== 'open') return false;
    if (!matchesBeverage(v, f.products, f.draftOnly)) return false;
    if (f.nonAlc && !hasNonAlc(v)) return false;
    if (f.bounds && !inBounds(v, f.bounds)) return false;
    if (q) {
      const hay = norm([v.name, v.category, v.address ?? '', v.addressDetail ?? '', ...v.featuredMenus.map((m) => m.name)].join(' '));
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export type SortMode = 'default' | 'distance';

/** 거리순은 유효한 내 위치가 있을 때만. 거리 계산 불가 업소는 뒤로 */
export function sortVenues(
  venues: PublicVenue[],
  mode: SortMode,
  origin: { lat: number; lng: number } | null,
): PublicVenue[] {
  const list = [...venues];
  if (mode === 'distance' && origin) {
    const d = (v: PublicVenue) => (hasCoords(v) ? haversineMeters(origin, { lat: v.latitude, lng: v.longitude }) : Infinity);
    return list.sort((a, b) => d(a) - d(b) || a.displayOrder - b.displayOrder);
  }
  return list.sort((a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name, 'ko'));
}

export function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const rad = (x: number) => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function formatStraightDistance(m: number): string {
  const v = m < 1000 ? `${Math.round(m / 10) * 10}m` : `${(m / 1000).toFixed(1)}km`;
  return `직선거리 ${v}`;
}

// ── URL 쿼리 직렬화 (뒤로 가기 시 필터 유지) ──
export function filterToParams(f: FilterState, params = new URLSearchParams()): URLSearchParams {
  const set = (k: string, v: string | null) => (v ? params.set(k, v) : params.delete(k));
  set('q', f.q.trim() || null);
  set('area', f.area === 'all' ? null : f.area);
  set('purpose', f.purposes.join(',') || null);
  set('parking', f.parking ? '1' : null);
  set('open', f.openNow ? '1' : null);
  set('drink', f.products.join(',') || null);
  set('draft', f.draftOnly ? '1' : null);
  set('na', f.nonAlc ? '1' : null);
  set('bounds', f.bounds ? [f.bounds.sw.lat, f.bounds.sw.lng, f.bounds.ne.lat, f.bounds.ne.lng].map((n) => n.toFixed(5)).join(',') : null);
  return params;
}

const AREAS = new Set(['lafesta', 'westerndom', 'lakepark']);
const PURPOSES = new Set(['meal', 'light-snack', 'group', 'quiet-talk']);

export function paramsToFilter(p: URLSearchParams): FilterState {
  const list = (k: string) => (p.get(k) ?? '').split(',').filter(Boolean);
  const area = p.get('area') ?? 'all';
  const b = list('bounds').map(Number);
  return {
    q: (p.get('q') ?? '').slice(0, 50),
    area: AREAS.has(area) ? (area as AreaId) : 'all',
    purposes: list('purpose').filter((x) => PURPOSES.has(x)) as PurposeTag[],
    parking: p.get('parking') === '1',
    openNow: p.get('open') === '1',
    products: list('drink').filter((x) => /^[a-z0-9-]{1,40}$/.test(x)),
    draftOnly: p.get('draft') === '1',
    nonAlc: p.get('na') === '1',
    bounds: b.length === 4 && b.every(Number.isFinite) ? { sw: { lat: b[0], lng: b[1] }, ne: { lat: b[2], lng: b[3] } } : null,
  };
}

export function summarizeFilter(f: FilterState): string {
  const parts: string[] = [];
  if (f.area !== 'all') parts.push(`area:${f.area}`);
  if (f.purposes.length) parts.push(`purpose:${f.purposes.join('+')}`);
  if (f.parking) parts.push('parking');
  if (f.openNow) parts.push('openNow');
  if (f.products.length) parts.push(`drink:${f.products.join('+')}`);
  if (f.draftOnly) parts.push('draftOnly');
  if (f.nonAlc) parts.push('nonAlc');
  if (f.bounds) parts.push('mapBounds');
  if (f.q.trim()) parts.push('search');
  return parts.join('|') || 'none';
}
