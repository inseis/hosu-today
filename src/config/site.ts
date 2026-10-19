// 서비스 이름·소개 문구 등 화면 문구 설정. 이름 변경은 VITE_SITE_NAME 또는 여기서.
export const site = {
  name: import.meta.env.VITE_SITE_NAME || '호수원픽',
  tagline: '식사부터 모임까지, 주변 한 곳을 찾아보세요.',
  // 참여 업소 안내 서비스임을 명확히 밝히는 문구
  disclosure:
    '이 서비스는 참여에 동의한 업소의 방문 정보를 안내합니다. 순위나 평가가 아니며, 정보는 각 업소 확인일 기준입니다.',
  regionLabel: '고양시 일산동구 장항동 · 라페스타 · 웨스턴돔 · 일산호수공원 인근',
};

/** 배포 하위 경로 (예: '/hosu-today/'). 루트 배포면 '/' */
export const basePath = import.meta.env.BASE_URL;
/** 앱 내부 경로 → 실제 주소 경로 ('/venues/a' → '/hosu-today/venues/a') */
export const withBase = (p: string) => `${basePath.replace(/\/$/, '')}${p}`;

export const env = {
  kakaoKey: (import.meta.env.VITE_KAKAO_MAP_JAVASCRIPT_KEY as string | undefined)?.trim() || '',
  dataMode: (import.meta.env.VITE_DATA_MODE === 'live' ? 'live' : 'demo') as 'live' | 'demo',
  publicBaseUrl: (import.meta.env.VITE_PUBLIC_BASE_URL as string | undefined)?.replace(/\/$/, '') || '',
  publicDataUrl: (import.meta.env.VITE_PUBLIC_DATA_URL as string | undefined) || '',
  analyticsEndpoint: (import.meta.env.VITE_ANALYTICS_ENDPOINT as string | undefined) || '',
};
