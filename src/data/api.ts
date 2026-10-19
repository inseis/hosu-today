// 공개 데이터 접근 계층. 화면 컴포넌트는 이 모듈만 사용하고 데이터 출처(데모/서버/정적 JSON)를 모른다.
import { env, withBase } from '../config/site';
import type { ParkingLot, PublicVenue, SiteSettings } from '../../shared/types';

export interface PublicConfig {
  notices: { id: string; text: string }[];
  showBeverageInfo: boolean;
  mapCenter: SiteSettings['mapCenter'];
  contactEmail: string | null;
}

export interface PublicDataset {
  venues: PublicVenue[];
  parking: ParkingLot[];
  config: PublicConfig;
  isDemo: boolean;
  /** 네트워크 실패로 이전에 받아둔 데이터를 보여주는 경우 그 시각 */
  staleSince: string | null;
}

const DEFAULT_CONFIG: PublicConfig = {
  notices: [],
  showBeverageInfo: true,
  mapCenter: { latitude: 37.6588, longitude: 126.7695, level: 5 },
  contactEmail: null,
};

const CACHE_KEY = 'ht_public_cache_v2';
let cached: Promise<PublicDataset> | null = null;

async function getJson<T>(url: string): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return (await r.json()) as T;
  } finally {
    clearTimeout(t);
  }
}

async function loadLive(): Promise<PublicDataset> {
  try {
    let data: { venues: PublicVenue[]; parking: ParkingLot[]; config: PublicConfig };
    if (env.publicDataUrl) {
      const j = await getJson<{ venues: PublicVenue[]; parking?: ParkingLot[]; settings: PublicConfig }>(env.publicDataUrl.startsWith('/') ? withBase(env.publicDataUrl) : env.publicDataUrl);
      data = { venues: j.venues, parking: j.parking ?? [], config: { ...DEFAULT_CONFIG, ...j.settings } };
    } else {
      const [v, c, p] = await Promise.all([
        getJson<{ venues: PublicVenue[] }>('/api/public/venues'),
        getJson<PublicConfig>('/api/public/config'),
        getJson<{ parking: ParkingLot[] }>('/api/public/parking').catch(() => ({ parking: [] })),
      ]);
      data = { venues: v.venues, parking: p.parking, config: { ...DEFAULT_CONFIG, ...c } };
    }
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ ...data, savedAt: new Date().toISOString() }));
    } catch { /* 저장 불가 환경 무시 */ }
    return { ...data, isDemo: false, staleSince: null };
  } catch (e) {
    // 네트워크 불안정: 이전에 받은 공개 데이터가 있으면 시각을 밝히고 보여줌
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (raw) {
        const c = JSON.parse(raw) as { venues: PublicVenue[]; parking?: ParkingLot[]; config: PublicConfig; savedAt: string };
        return { venues: c.venues, parking: c.parking ?? [], config: c.config, isDemo: false, staleSince: c.savedAt };
      }
    } catch { /* ignore */ }
    throw e;
  }
}

async function loadDemo(): Promise<PublicDataset> {
  // live 빌드에서는 이 분기가 제거되어 데모 파일이 번들에 포함되지 않음
  const mod = await import('../demo/venues.demo.json');
  return { venues: mod.default.venues as unknown as PublicVenue[], parking: [], config: DEFAULT_CONFIG, isDemo: true, staleSince: null };
}

export function loadPublicData(force = false): Promise<PublicDataset> {
  if (cached && !force) return cached;
  cached = import.meta.env.VITE_DATA_MODE === 'live' ? loadLive() : loadDemo();
  cached.catch(() => { cached = null; });
  return cached;
}

export type ReportResult = 'sent' | 'demo' | 'unavailable';

export async function submitReport(venueId: string, kind: string, message: string, isDemo: boolean): Promise<ReportResult> {
  if (isDemo) return 'demo';
  if (env.publicDataUrl) return 'unavailable'; // 정적 호스팅: 서버 없음
  const r = await fetch('/api/reports', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ venueId, kind, message }),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return 'sent';
}
