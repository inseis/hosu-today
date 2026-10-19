import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { Campaign, ErrorReport, ParkingLot, SiteSettings, Venue, VenueOps } from '../shared/types';

// 단일 서버용 JSON 파일 저장소. 쓰기는 임시 파일 → rename 으로 원자적으로 처리하고,
// 프로세스 안에서 직렬화한다. 여러 서버 인스턴스로 확장할 때는 DB로 교체해야 한다.

export const DATA_DIR = path.resolve(process.env.DATA_DIR || 'data/store');

export interface StoreShape {
  venues: Venue[];
  ops: VenueOps[];
  campaigns: Campaign[];
  settings: SiteSettings;
  reports: ErrorReport[];
  parking: ParkingLot[];
  /** 날짜별 이벤트 집계: { 'YYYY-MM-DD': { 'event|venueId|source': count } } — 개인 단위 기록 없음 */
  metrics: Record<string, Record<string, number>>;
}

export const DEFAULT_SETTINGS: SiteSettings = {
  notices: [],
  // 음료 정보 노출은 운영 담당자 검토 후 켠다
  showBeverageInfo: true,
  // 라페스타·웨스턴돔·호수공원 사이 대략적 중심. 운영자가 관리자 화면에서 확인·조정
  mapCenter: { latitude: 37.6588, longitude: 126.7695, level: 5 },
  contactEmail: null,
};

const DEFAULTS: StoreShape = {
  venues: [], ops: [], campaigns: [], settings: DEFAULT_SETTINGS, reports: [], parking: [], metrics: {},
};

const file = (k: keyof StoreShape) => path.join(DATA_DIR, `${k}.json`);
let queue: Promise<unknown> = Promise.resolve();

export async function read<K extends keyof StoreShape>(k: K): Promise<StoreShape[K]> {
  try {
    const raw = await fs.readFile(file(k), 'utf8');
    return JSON.parse(raw) as StoreShape[K];
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return structuredClone(DEFAULTS[k]);
    throw e;
  }
}

async function writeNow<K extends keyof StoreShape>(k: K, value: StoreShape[K]): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tmp = `${file(k)}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(value, null, 2), 'utf8');
  await fs.rename(tmp, file(k));
}

/** 읽기-수정-쓰기를 직렬화해 동시 요청으로 인한 유실을 막는다 */
export function update<K extends keyof StoreShape, R = void>(k: K, fn: (cur: StoreShape[K]) => { next: StoreShape[K]; result?: R }): Promise<R | undefined> {
  const run = queue.then(async () => {
    const cur = await read(k);
    const { next, result } = fn(cur);
    await writeNow(k, next);
    return result;
  });
  queue = run.catch(() => undefined);
  return run;
}
