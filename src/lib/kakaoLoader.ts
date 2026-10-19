// 카카오맵 Web JavaScript SDK 로더.
// - 모듈 단위 단일 Promise로 스크립트를 한 번만 삽입 (StrictMode 이중 실행·재렌더링에도 중복 없음)
// - autoload=false 로 받은 뒤 kakao.maps.load() 콜백 이후에만 지도를 생성
// 공식 가이드: https://apis.map.kakao.com/web/guide/
import { env } from '../config/site';

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window { kakao?: any }
}

export type KakaoLoadError = 'no-key' | 'script-failed' | 'timeout' | 'init-failed';

let promise: Promise<any> | null = null;
const TIMEOUT_MS = 10000;

export function loadKakaoMaps(): Promise<any> {
  if (promise) return promise;
  promise = new Promise((resolve, reject) => {
    if (!env.kakaoKey) return reject(new KakaoError('no-key'));
    if (window.kakao?.maps?.LatLng) return resolve(window.kakao);
    const timer = window.setTimeout(() => reject(new KakaoError('timeout')), TIMEOUT_MS);
    const script = document.createElement('script');
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(env.kakaoKey)}&autoload=false&libraries=services`;
    script.async = true;
    script.onerror = () => {
      window.clearTimeout(timer);
      reject(new KakaoError('script-failed'));
    };
    script.onload = () => {
      // 미등록 도메인·잘못된 키는 스크립트는 받아지지만 kakao 객체가 없거나 load가 실패할 수 있음
      if (!window.kakao?.maps?.load) {
        window.clearTimeout(timer);
        return reject(new KakaoError('init-failed'));
      }
      window.kakao.maps.load(() => {
        window.clearTimeout(timer);
        resolve(window.kakao);
      });
    };
    document.head.appendChild(script);
  });
  // 실패 시 다음 시도에서 다시 로드할 수 있게 초기화
  promise.catch(() => {
    promise = null;
    document.querySelectorAll('script[src*="dapi.kakao.com/v2/maps/sdk.js"]').forEach((s) => s.remove());
  });
  return promise;
}

export class KakaoError extends Error {
  constructor(public code: KakaoLoadError) {
    super(code);
  }
}

export function kakaoErrorMessage(code: KakaoLoadError): string {
  switch (code) {
    case 'no-key':
      return '지도 API 키가 설정되지 않아 지도를 표시하지 않습니다.';
    case 'timeout':
      return '지도를 불러오는 시간이 초과되었습니다. 네트워크 상태를 확인해 주세요.';
    case 'init-failed':
      return '지도를 초기화하지 못했습니다. (등록되지 않은 도메인, 지도 사용 설정 또는 사용량 제한일 수 있습니다)';
    default:
      return '지도를 불러오지 못했습니다. (네트워크, 등록되지 않은 도메인 또는 사용량 제한일 수 있습니다)';
  }
}
