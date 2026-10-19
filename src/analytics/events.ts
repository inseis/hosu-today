// 사용 행동 이벤트 인터페이스.
// - 엔드포인트가 설정되지 않으면 수집하지 않고 개발 모드에서 콘솔에만 남긴다.
// - 위치 좌표·기기 식별자·사용자 식별자는 보내지 않는다.
import { env } from '../config/site';
import type { AnalyticsEvent, AnalyticsEventName } from '../../shared/types';
import { SOURCE_RE } from '../../shared/links';

const SOURCE_KEY = 'ht_source';

/** 랜딩 시 URL의 source를 이번 방문(탭) 동안 유지해 상세·길찾기 이벤트까지 이어서 기록 */
export function captureSource(params: URLSearchParams): string | null {
  const s = params.get('source');
  if (s && SOURCE_RE.test(s)) {
    try { sessionStorage.setItem(SOURCE_KEY, s); } catch { /* ignore */ }
    return s;
  }
  return currentSource();
}

export function currentSource(): string | null {
  try { return sessionStorage.getItem(SOURCE_KEY); } catch { return null; }
}

export function track(name: AnalyticsEventName, data: { venueId?: string; filterSummary?: string } = {}): void {
  const event: AnalyticsEvent = {
    name,
    venueId: data.venueId ?? null,
    source: currentSource(),
    timestamp: new Date().toISOString(),
    filterSummary: data.filterSummary ?? null,
  };
  // 관리자 화면의 연결 페이지 미리보기는 집계하지 않음
  if (event.source === 'admin-preview') return;
  if (import.meta.env.DEV) console.debug('[analytics]', event);
  if (!env.analyticsEndpoint) return;
  const body = JSON.stringify(event);
  try {
    if (!navigator.sendBeacon?.(env.analyticsEndpoint, new Blob([body], { type: 'text/plain' }))) {
      void fetch(env.analyticsEndpoint, { method: 'POST', body, keepalive: true, headers: { 'Content-Type': 'text/plain' } });
    }
  } catch { /* 측정 실패가 화면 동작을 막지 않도록 */ }
}
