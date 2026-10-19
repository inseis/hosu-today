import type { BreakTime, DayKey, TemporaryClosure, TimeRange, WeeklyHours } from './types';

// 영업 상태는 "등록된 영업시간 기준 계산값"이다. 실시간 영업을 보장하지 않는다.
// 모든 계산은 한국 표준시(UTC+9, 서머타임 없음) 기준으로 기기 시간대와 무관하게 수행한다.

export const DAY_KEYS: DayKey[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
export const DAY_LABELS: Record<DayKey, string> = {
  mon: '월', tue: '화', wed: '수', thu: '목', fri: '금', sat: '토', sun: '일',
};
export const WEEK_ORDER: DayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

const TIME_RE = /^([01]\d|2[0-4]):([0-5]\d)$/;

export function isValidTime(t: string): boolean {
  if (!TIME_RE.test(t)) return false;
  return !(t.startsWith('24') && t !== '24:00');
}

export function toMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

export function isOvernight(r: TimeRange): boolean {
  return toMinutes(r.close) <= toMinutes(r.open);
}

interface KstMoment {
  day: DayKey;
  prevDay: DayKey;
  date: string; // YYYY-MM-DD
  minutes: number;
}

export function kstMoment(now: Date): KstMoment {
  const k = new Date(now.getTime() + 9 * 3600 * 1000);
  const dayIdx = k.getUTCDay();
  const date = k.toISOString().slice(0, 10);
  return {
    day: DAY_KEYS[dayIdx],
    prevDay: DAY_KEYS[(dayIdx + 6) % 7],
    date,
    minutes: k.getUTCHours() * 60 + k.getUTCMinutes(),
  };
}

export type OpenStatus =
  | { state: 'unknown' }
  | { state: 'temporarily-closed'; reason: string | null; until: string }
  | { state: 'regular-holiday' }
  | { state: 'open'; closesAt: string }
  | { state: 'break'; resumesAt: string }
  | { state: 'closed'; nextOpen: string | null };

interface HoursInput {
  weeklyHours: WeeklyHours | null;
  breakTimes: BreakTime[];
  temporaryClosures: TemporaryClosure[];
}

export function activeClosure(closures: TemporaryClosure[], date: string): TemporaryClosure | null {
  return closures.find((c) => c.startDate <= date && date <= c.endDate) ?? null;
}

export function getOpenStatus(v: HoursInput, now: Date = new Date()): OpenStatus {
  const t = kstMoment(now);
  const closure = activeClosure(v.temporaryClosures, t.date);
  if (closure) return { state: 'temporarily-closed', reason: closure.reason, until: closure.endDate };
  if (!v.weeklyHours) return { state: 'unknown' };

  const today = v.weeklyHours[t.day];
  const prev = v.weeklyHours[t.prevDay];
  const m = t.minutes;

  // 1) 전날 시작해 자정을 넘긴 영업
  if (prev) {
    for (const r of prev) {
      if (isOvernight(r) && m < toMinutes(r.close)) {
        return withBreak(v.breakTimes, t.prevDay, m + 1440, r);
      }
    }
  }
  if (today === null) return { state: 'unknown' };
  // 2) 오늘 시작하는 영업
  for (const r of today) {
    const o = toMinutes(r.open);
    const c = toMinutes(r.close);
    if (isOvernight(r) ? m >= o : m >= o && m < c) {
      return withBreak(v.breakTimes, t.day, m, r);
    }
  }
  // 이른 새벽인데 전날 정보가 없으면 판단 불가
  if (prev === null && m < 6 * 60) return { state: 'unknown' };
  if (today.length === 0) return { state: 'regular-holiday' };
  const next = today.map((r) => r.open).filter((o) => toMinutes(o) > m).sort()[0] ?? null;
  return { state: 'closed', nextOpen: next };
}

/** m은 영업 시작 요일 기준 분(자정 넘으면 1440 이상) */
function withBreak(breaks: BreakTime[], day: DayKey, m: number, r: TimeRange): OpenStatus {
  const mm = m % 1440;
  for (const b of breaks) {
    if (!b.days.includes(day)) continue;
    if (mm >= toMinutes(b.start) && mm < toMinutes(b.end)) return { state: 'break', resumesAt: b.end };
  }
  return { state: 'open', closesAt: r.close };
}

export function formatRange(r: TimeRange): string {
  return `${r.open} – ${r.close}${isOvernight(r) ? ' (다음 날)' : ''}`;
}

export function formatDayHours(ranges: TimeRange[] | null): string {
  if (ranges === null) return '확인 필요';
  if (ranges.length === 0) return '정기 휴무';
  return ranges.map(formatRange).join(', ');
}

export function statusLabel(s: OpenStatus): { text: string; tone: 'open' | 'closed' | 'unknown' } {
  switch (s.state) {
    case 'open':
      return { text: `영업시간 중 · ${s.closesAt}까지`, tone: 'open' };
    case 'break':
      return { text: `브레이크타임 · ${s.resumesAt} 재개`, tone: 'closed' };
    case 'closed':
      return { text: s.nextOpen ? `영업 전 · ${s.nextOpen} 시작` : '오늘 영업 종료', tone: 'closed' };
    case 'regular-holiday':
      return { text: '오늘 정기 휴무', tone: 'closed' };
    case 'temporarily-closed':
      return { text: `임시 휴무 (${s.until}까지)`, tone: 'closed' };
    default:
      return { text: '영업시간 확인 필요', tone: 'unknown' };
  }
}

/** "11:30-15:00, 17:00-02:00" | "휴무" | "" → TimeRange[] | [] | null */
export function parseDayHours(input: string): TimeRange[] | null {
  const s = input.trim();
  if (s === '' || s === '미확인') return null;
  if (s === '휴무' || s === '정기휴무' || s === '정기 휴무') return [];
  return s.split(',').map((part) => {
    const [open, close] = part.trim().split(/\s*[-–~]\s*/);
    if (!open || !close || !isValidTime(open) || !isValidTime(close)) {
      throw new Error(`영업시간 형식 오류: "${part.trim()}" (예: 11:30-02:00)`);
    }
    return { open, close };
  });
}

export function serializeDayHours(ranges: TimeRange[] | null): string {
  if (ranges === null) return '';
  if (ranges.length === 0) return '휴무';
  return ranges.map((r) => `${r.open}-${r.close}`).join(', ');
}
