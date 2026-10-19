import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { hasCoords, type Bounds } from '../../shared/filter';
import type { ParkingLot, PublicVenue } from '../../shared/types';
import { brandImage, featuredBeverages, isFeatured } from '../lib/brand';
import { withBase } from '../config/site';
import { KakaoError, kakaoErrorMessage, loadKakaoMaps, type KakaoLoadError } from '../lib/kakaoLoader';
import type { PublicConfig } from '../data/api';

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface MapHandle {
  getBounds(): Bounds | null;
  fitTo(venues: PublicVenue[]): void;
  panTo(lat: number, lng: number, level?: number): void;
}

interface Props {
  venues: PublicVenue[];
  selectedId: string | null;
  onSelect(id: string): void;
  center: PublicConfig['mapCenter'];
  myLocation: { lat: number; lng: number } | null;
  /** 지도 상태를 저장할 sessionStorage 키 (상세 화면 다녀와도 위치 유지) */
  persistKey?: string;
  onStatus?(status: 'ready' | KakaoLoadError): void;
  /** 주변 주차장 레이어 */
  parking?: ParkingLot[];
  showParking?: boolean;
  selectedParkingId?: string | null;
  onParkingSelect?(id: string): void;
}

const VIEW_KEY_PREFIX = 'ht_map_view:';

export const MapView = forwardRef<MapHandle, Props>(function MapView(
  { venues, selectedId, onSelect, center, myLocation, persistKey, onStatus, parking = [], showParking = false, selectedParkingId = null, onParkingSelect },
  ref,
) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const overlays = useRef(new Map<string, { overlay: any; node: HTMLButtonElement }>());
  const meOverlay = useRef<any>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const onParkingRef = useRef(onParkingSelect);
  onParkingRef.current = onParkingSelect;
  const parkingOverlays = useRef(new Map<string, { overlay: any; node: HTMLButtonElement }>());
  const [error, setError] = useState<KakaoLoadError | null>(null);
  const [ready, setReady] = useState(false);

  // 지도 생성: 마운트당 한 번. SDK 로드는 모듈 단위 Promise라 중복 삽입 없음
  useEffect(() => {
    let cancelled = false;
    let observer: ResizeObserver | null = null;
    let idleHandler: (() => void) | null = null;
    loadKakaoMaps()
      .then((kakao) => {
        if (cancelled || !el.current) return;
        const saved = readView(persistKey);
        const map = new kakao.maps.Map(el.current, {
          center: new kakao.maps.LatLng(saved?.lat ?? center.latitude, saved?.lng ?? center.longitude),
          level: saved?.level ?? center.level,
        });
        map.addControl(new kakao.maps.ZoomControl(), kakao.maps.ControlPosition.RIGHT);
        mapRef.current = map;
        // 멀리 보면 이름표 대신 점으로 (강조 업소는 이름 유지) — 마커 겹침 완화
        const syncZoom = () => { if (el.current) el.current.dataset.zoom = map.getLevel() >= 4 ? 'far' : 'near'; };
        syncZoom();
        kakao.maps.event.addListener(map, 'zoom_changed', syncZoom);
        if (!saved) fit(map, venues);
        if (persistKey) {
          idleHandler = () => {
            const c = map.getCenter();
            try {
              sessionStorage.setItem(VIEW_KEY_PREFIX + persistKey, JSON.stringify({ lat: c.getLat(), lng: c.getLng(), level: map.getLevel() }));
            } catch { /* ignore */ }
          };
          kakao.maps.event.addListener(map, 'idle', idleHandler);
        }
        // 컨테이너 크기 변화(하단 패널·화면 전환) 시 레이아웃 갱신
        observer = new ResizeObserver(() => {
          const c = map.getCenter();
          map.relayout();
          map.setCenter(c);
        });
        observer.observe(el.current);
        setReady(true);
        onStatus?.('ready');
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        const code = e instanceof KakaoError ? e.code : 'script-failed';
        setError(code);
        onStatus?.(code);
      });
    return () => {
      cancelled = true;
      observer?.disconnect();
      const kakao = window.kakao;
      if (idleHandler && mapRef.current && kakao) kakao.maps.event.removeListener(mapRef.current, 'idle', idleHandler);
      overlays.current.forEach(({ overlay }) => overlay.setMap(null));
      overlays.current.clear();
      parkingOverlays.current.forEach(({ overlay }) => overlay.setMap(null));
      parkingOverlays.current.clear();
      meOverlay.current?.setMap(null);
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 마커(커스텀 오버레이) 동기화: 목록과 같은 업소 집합 중 좌표 확인된 곳만
  useEffect(() => {
    const kakao = window.kakao;
    const map = mapRef.current;
    if (!ready || !map || !kakao) return;
    const want = new Map(venues.filter(hasCoords).map((v) => [v.id, v]));
    overlays.current.forEach((o, id) => {
      if (!want.has(id)) {
        o.overlay.setMap(null);
        overlays.current.delete(id);
      }
    });
    want.forEach((v, id) => {
      if (overlays.current.has(id)) return;
      const node = document.createElement('button');
      node.type = 'button';
      const featured = isFeatured(v);
      node.className = featured ? 'map-marker is-featured' : 'map-marker';
      if (featured) {
        const imgs = [...new Set(featuredBeverages(v).map(brandImage).filter((x): x is string => !!x))].slice(0, 2);
        if (imgs.length) {
          for (const src of imgs) {
            const img = document.createElement('img');
            img.className = 'map-marker-bottle';
            img.src = withBase(`/images/brands/${src}`);
            img.alt = '';
            node.appendChild(img);
          }
        } else {
          const icon = document.createElement('span');
          icon.className = 'map-marker-icon';
          icon.setAttribute('aria-hidden', 'true');
          node.appendChild(icon);
        }
      }
      const label = document.createElement('span');
      label.className = 'map-marker-label';
      label.textContent = v.name; // textContent: 사용자 입력을 HTML로 해석하지 않음
      node.appendChild(label);
      node.setAttribute('aria-label', `${v.name} 선택${featured ? ' (카스·한맥 취급)' : ''}`);
      node.addEventListener('click', (ev) => {
        ev.stopPropagation();
        onSelectRef.current(id);
      });
      const overlay = new kakao.maps.CustomOverlay({
        position: new kakao.maps.LatLng(v.latitude, v.longitude),
        content: node,
        yAnchor: 1.15,
        clickable: true,
        zIndex: featured ? 3 : 1,
      });
      overlay.setMap(map);
      overlays.current.set(id, { overlay, node });
    });
  }, [venues, ready]);

  // 선택 강조
  useEffect(() => {
    overlays.current.forEach(({ overlay, node }, id) => {
      const on = id === selectedId;
      node.classList.toggle('is-selected', on);
      node.setAttribute('aria-pressed', String(on));
      overlay.setZIndex(on ? 10 : node.classList.contains('is-featured') ? 3 : 1);
    });
    const map = mapRef.current;
    const sel = selectedId ? overlays.current.get(selectedId) : null;
    if (map && sel) {
      const pos = sel.overlay.getPosition();
      if (!map.getBounds().contain(pos)) map.panTo(pos);
    }
  }, [selectedId, ready, venues]);

  // 주차장 레이어
  useEffect(() => {
    const kakao = window.kakao;
    const map = mapRef.current;
    if (!ready || !map || !kakao) return;
    parkingOverlays.current.forEach(({ overlay }) => overlay.setMap(null));
    parkingOverlays.current.clear();
    if (!showParking) return;
    for (const p of parking) {
      const node = document.createElement('button');
      node.type = 'button';
      node.className = `map-parking map-parking-${p.kind}`;
      node.textContent = 'P';
      node.title = p.name;
      node.setAttribute('aria-label', `${p.kind === 'public' ? '공영주차장' : '건물 주차장'}: ${p.name}`);
      node.addEventListener('click', (ev) => {
        ev.stopPropagation();
        onParkingRef.current?.(p.id);
      });
      const overlay = new kakao.maps.CustomOverlay({ position: new kakao.maps.LatLng(p.latitude, p.longitude), content: node, clickable: true, zIndex: 2 });
      overlay.setMap(map);
      parkingOverlays.current.set(p.id, { overlay, node });
    }
  }, [parking, showParking, ready]);

  useEffect(() => {
    parkingOverlays.current.forEach(({ overlay, node }, id) => {
      const on = id === selectedParkingId;
      node.classList.toggle('is-selected', on);
      overlay.setZIndex(on ? 9 : 2);
    });
  }, [selectedParkingId, showParking, parking, ready]);

  // 내 위치 표시 (화면에만, 저장·전송 안 함)
  useEffect(() => {
    const kakao = window.kakao;
    const map = mapRef.current;
    if (!ready || !map || !kakao) return;
    meOverlay.current?.setMap(null);
    if (!myLocation) return;
    const dot = document.createElement('div');
    dot.className = 'me-dot';
    dot.setAttribute('aria-label', '내 위치');
    meOverlay.current = new kakao.maps.CustomOverlay({ position: new kakao.maps.LatLng(myLocation.lat, myLocation.lng), content: dot, zIndex: 5 });
    meOverlay.current.setMap(map);
    map.panTo(new kakao.maps.LatLng(myLocation.lat, myLocation.lng));
  }, [myLocation, ready]);

  useImperativeHandle(ref, () => ({
    getBounds() {
      const map = mapRef.current;
      if (!map) return null;
      const b = map.getBounds();
      const sw = b.getSouthWest();
      const ne = b.getNorthEast();
      return { sw: { lat: sw.getLat(), lng: sw.getLng() }, ne: { lat: ne.getLat(), lng: ne.getLng() } };
    },
    fitTo(list) {
      if (mapRef.current) fit(mapRef.current, list, center);
    },
    panTo(lat, lng, level) {
      const kakao = window.kakao;
      if (!mapRef.current || !kakao) return;
      if (level) mapRef.current.setLevel(level);
      mapRef.current.panTo(new kakao.maps.LatLng(lat, lng));
    },
  }));

  if (error) {
    return (
      <div className="map-fallback" role="status">
        <strong>지도를 표시할 수 없습니다</strong>
        <p>{kakaoErrorMessage(error)}</p>
        <p>업소 목록·상세 정보와 카카오맵 길찾기 링크는 계속 이용할 수 있습니다.</p>
      </div>
    );
  }
  return <div ref={el} className="map-canvas" role="region" aria-label="업소 위치 지도" />;
});

function fit(map: any, venues: PublicVenue[], center?: PublicConfig['mapCenter']) {
  const kakao = window.kakao;
  const pts = venues.filter(hasCoords);
  if (!kakao) return;
  if (pts.length === 0) {
    if (center) {
      map.setLevel(center.level);
      map.setCenter(new kakao.maps.LatLng(center.latitude, center.longitude));
    }
    return;
  }
  if (pts.length === 1) {
    map.setCenter(new kakao.maps.LatLng(pts[0].latitude, pts[0].longitude));
    map.setLevel(4);
    return;
  }
  const b = new kakao.maps.LatLngBounds();
  pts.forEach((v) => b.extend(new kakao.maps.LatLng(v.latitude, v.longitude)));
  map.setBounds(b, 60, 40, 60, 40);
}

function readView(key?: string): { lat: number; lng: number; level: number } | null {
  if (!key) return null;
  try {
    const raw = sessionStorage.getItem(VIEW_KEY_PREFIX + key);
    const v = raw ? JSON.parse(raw) : null;
    return v && Number.isFinite(v.lat) && Number.isFinite(v.lng) && Number.isFinite(v.level) ? v : null;
  } catch {
    return null;
  }
}
