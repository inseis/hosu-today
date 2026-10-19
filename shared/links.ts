import type { PublicVenue } from './types';

// 외부 링크·관리자 입력 URL 검증과 카카오맵 공식 링크 생성.
// 카카오맵 URL 규격: https://apis.map.kakao.com/web/guide/#bigmapurl

/** http(s)만 허용. 상대경로(/로 시작, //는 거부)는 allowRelative일 때 허용 */
export function safeUrl(input: string | null | undefined, opts: { allowRelative?: boolean } = {}): string | null {
  if (!input) return null;
  const s = input.trim();
  if (opts.allowRelative && s.startsWith('/') && !s.startsWith('//')) return s;
  try {
    const u = new URL(s);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : null;
  } catch {
    return null;
  }
}

const enc = encodeURIComponent;

/** 길찾기(도착지 지정) 링크 */
export function kakaoDirectionsUrl(v: Pick<PublicVenue, 'name' | 'latitude' | 'longitude' | 'kakaoPlaceId' | 'address'>): string {
  if (v.kakaoPlaceId && /^\d+$/.test(v.kakaoPlaceId)) return `https://map.kakao.com/link/to/${v.kakaoPlaceId}`;
  if (typeof v.latitude === 'number' && typeof v.longitude === 'number') {
    return `https://map.kakao.com/link/to/${enc(v.name)},${v.latitude},${v.longitude}`;
  }
  // 좌표 미확인: 임의 위치를 만들지 않고 주소/이름 검색으로 연결
  return `https://map.kakao.com/link/search/${enc(v.address ?? v.name)}`;
}

/** 카카오맵에서 위치 보기 링크 */
export function kakaoMapUrl(v: Pick<PublicVenue, 'name' | 'latitude' | 'longitude' | 'kakaoPlaceId' | 'address'>): string {
  if (v.kakaoPlaceId && /^\d+$/.test(v.kakaoPlaceId)) return `https://map.kakao.com/link/map/${v.kakaoPlaceId}`;
  if (typeof v.latitude === 'number' && typeof v.longitude === 'number') {
    return `https://map.kakao.com/link/map/${enc(v.name)},${v.latitude},${v.longitude}`;
  }
  return `https://map.kakao.com/link/search/${enc(v.address ?? v.name)}`;
}

/** QR 대상 경로 검증: /explore 또는 /venues/{slug} 만 허용 */
export function isAllowedTargetPath(p: string): boolean {
  return p === '/explore' || /^\/venues\/[a-z0-9-]{1,60}$/.test(p);
}

export function buildCampaignUrl(baseUrl: string, targetPath: string, source: string): string {
  // 하위 경로 배포(https://id.github.io/repo)도 유지되도록 문자열로 이어 붙임
  const u = new URL(`${baseUrl.replace(/\/+$/, '')}${targetPath}`);
  u.searchParams.set('source', source);
  return u.toString();
}

export const SOURCE_RE = /^[a-z0-9][a-z0-9-]{0,59}$/;
