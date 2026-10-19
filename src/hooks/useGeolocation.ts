import { useCallback, useState } from 'react';

// '내 위치'를 눌렀을 때만 권한을 요청한다. 좌표는 이 탭의 메모리에만 두고 저장·전송하지 않는다.
type Status = 'idle' | 'locating' | 'ok' | 'denied' | 'timeout' | 'unavailable';

let memo: { lat: number; lng: number } | null = null;

export function useGeolocation() {
  const [position, setPosition] = useState(memo);
  const [status, setStatus] = useState<Status>(memo ? 'ok' : 'idle');

  const request = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setStatus('unavailable');
      return;
    }
    setStatus('locating');
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const { latitude: lat, longitude: lng } = p.coords;
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
          setStatus('unavailable');
          return;
        }
        memo = { lat, lng };
        setPosition(memo);
        setStatus('ok');
      },
      (err) => setStatus(err.code === err.PERMISSION_DENIED ? 'denied' : err.code === err.TIMEOUT ? 'timeout' : 'unavailable'),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    );
  }, []);

  const message =
    status === 'denied' ? '위치 권한이 허용되지 않았습니다. 지역 지도와 목록은 그대로 이용할 수 있습니다.'
    : status === 'timeout' ? '위치 확인 시간이 초과되었습니다. 지역 지도와 목록은 그대로 이용할 수 있습니다.'
    : status === 'unavailable' ? '현재 위치를 확인할 수 없습니다. 지역 지도와 목록은 그대로 이용할 수 있습니다.'
    : status === 'ok' ? '내 위치는 이 화면에서 거리 계산에만 쓰이며 저장되지 않습니다. 거리는 직선거리입니다.'
    : null;

  return { position, status, request, message };
}
