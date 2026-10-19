import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import catalog from '../../data/catalog/catalog.json';
import {
  EMPTY_FILTER, filterToParams, filterVenues, haversineMeters, hasCoords, paramsToFilter, sortVenues,
  summarizeFilter, type FilterState, type SortMode,
} from '../../shared/filter';
import type { AreaId, PublicVenue, PurposeTag } from '../../shared/types';
import { track } from '../analytics/events';
import { BeverageSheet } from '../components/BeverageSheet';
import { MapView, type MapHandle } from '../components/MapView';
import { DemoBanner, Icon, Notice } from '../components/ui';
import { VenueCard } from '../components/VenueCard';
import { site } from '../config/site';
import type { PublicDataset } from '../data/api';
import { useDataset } from '../hooks/useDataset';
import { useGeolocation } from '../hooks/useGeolocation';

type View = 'split' | 'list' | 'map';

function session<T>(key: string, fallback: T): T {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function saveSession(key: string, v: unknown) {
  try { sessionStorage.setItem(key, JSON.stringify(v)); } catch { /* ignore */ }
}

export function ExplorePage() {
  const ds = useDataset();
  if (ds.status === 'loading') return <div className="page-loading" role="status">업소 정보를 불러오는 중…</div>;
  if (ds.status === 'error') {
    return (
      <main className="page-pad">
        <Notice tone="warn">
          업소 정보를 불러오지 못했습니다. 네트워크 연결을 확인한 뒤 다시 시도해 주세요.
        </Notice>
        <button type="button" className="btn btn-primary" onClick={ds.retry}>다시 시도</button>
      </main>
    );
  }
  return <Explore data={ds.data} />;
}

function Explore({ data }: { data: PublicDataset }) {
  const [params, setParams] = useSearchParams();
  const filter = useMemo(() => paramsToFilter(params), [params]);
  const [qInput, setQInput] = useState(filter.q);
  const [selectedId, setSelectedId] = useState<string | null>(() => session('ht_selected', null));
  const [view, setView] = useState<View>(() => session('ht_view', 'split'));
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sort, setSort] = useState<SortMode>(() => session('ht_sort', 'default'));
  const [mapOk, setMapOk] = useState<boolean | null>(null);
  const [now, setNow] = useState(() => new Date());
  const geo = useGeolocation();
  const mapRef = useRef<MapHandle>(null);
  const cardRefs = useRef(new Map<string, HTMLElement>());
  const showBev = data.config.showBeverageInfo;

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => saveSession('ht_selected', selectedId), [selectedId]);
  useEffect(() => saveSession('ht_view', view), [view]);
  useEffect(() => saveSession('ht_sort', sort), [sort]);

  const setFilter = useCallback(
    (next: Partial<FilterState>) => {
      const merged = { ...paramsToFilter(params), ...next };
      setParams(filterToParams(merged, new URLSearchParams(params)), { replace: true });
    },
    [params, setParams],
  );

  // 검색어 입력 디바운스
  useEffect(() => {
    if (qInput === filter.q) return;
    const t = setTimeout(() => setFilter({ q: qInput }), 300);
    return () => clearTimeout(t);
  }, [qInput, filter.q, setFilter]);

  // 지도와 목록이 공유하는 단일 결과 집합
  const results = useMemo(() => {
    const list = filterVenues(data.venues, filter, now);
    return sortVenues(list, geo.position ? sort : 'default', geo.position);
  }, [data.venues, filter, now, sort, geo.position]);

  // 필터 적용 이벤트 (초기 진입 제외, 입력 중 과다 기록 방지)
  const summary = summarizeFilter(filter);
  const firstSummary = useRef(summary);
  useEffect(() => {
    if (summary === firstSummary.current) return;
    firstSummary.current = '';
    const t = setTimeout(() => track('filter_apply', { filterSummary: summary }), 800);
    return () => clearTimeout(t);
  }, [summary]);

  // 지역을 바꾸면 해당 결과 범위로 지도 이동 (지도 범위 필터 사용 중이 아닐 때)
  const prevArea = useRef(filter.area);
  useEffect(() => {
    if (prevArea.current === filter.area) return;
    prevArea.current = filter.area;
    if (!filter.bounds) mapRef.current?.fitTo(results);
  }, [filter.area, filter.bounds, results]);

  const selectFromMap = (id: string) => {
    setSelectedId(id);
    if (view !== 'map') cardRefs.current.get(id)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  const applyBounds = () => {
    const b = mapRef.current?.getBounds();
    if (b) setFilter({ bounds: b });
  };
  const clearBounds = () => {
    setFilter({ bounds: null });
    mapRef.current?.fitTo(data.venues);
  };
  const resetAll = () => {
    setQInput('');
    setParams(filterToParams(EMPTY_FILTER, new URLSearchParams(params)), { replace: true });
    mapRef.current?.fitTo(data.venues);
  };

  const toggleIn = <T,>(arr: T[], x: T) => (arr.includes(x) ? arr.filter((a) => a !== x) : [...arr, x]);
  const distance = (v: PublicVenue) => (geo.position && hasCoords(v) ? haversineMeters(geo.position, { lat: v.latitude, lng: v.longitude }) : null);
  const selected = results.find((v) => v.id === selectedId) ?? null;
  const sourceSearch = params.get('source') ? `?source=${encodeURIComponent(params.get('source')!)}` : '';
  const activeExtra = filter.products.length + (filter.draftOnly ? 1 : 0);

  return (
    <div className="explore" data-view={view}>
      <div className="explore-side">
        {data.isDemo && <DemoBanner />}
        <header className="site-header">
          <div className="site-header-row">
            <h1 className="site-title">{site.name}</h1>
            <Link to="/about" className="text-link">서비스 안내</Link>
          </div>
          <p className="site-tagline">{site.tagline}</p>
        </header>

        {data.config.notices.map((n) => (
          <Notice key={n.id}>{n.text}</Notice>
        ))}
        {data.staleSince && (
          <Notice tone="warn">
            네트워크 연결이 불안정해 {new Date(data.staleSince).toLocaleString('ko-KR')}에 받은 정보를 보여주고 있습니다.
          </Notice>
        )}

        <section className="filters" aria-label="검색과 필터">
          <label className="search">
            <Icon name="search" />
            <span className="sr-only">업소명·메뉴·주소 검색</span>
            <input
              type="search"
              inputMode="search"
              enterKeyHint="search"
              placeholder="업소명·메뉴·주소 검색"
              value={qInput}
              maxLength={50}
              onChange={(e) => setQInput(e.target.value)}
            />
          </label>

          <div className="chip-row" role="radiogroup" aria-label="지역">
            {[{ id: 'all', label: '전체' }, ...catalog.areas].map((a) => (
              <button
                key={a.id}
                type="button"
                role="radio"
                aria-checked={filter.area === a.id}
                className={`chip${filter.area === a.id ? ' is-on' : ''}`}
                onClick={() => setFilter({ area: a.id as AreaId | 'all' })}
              >
                {filter.area === a.id && <Icon name="check" size={15} />}
                {a.label}
              </button>
            ))}
          </div>

          <div className="chip-row" aria-label="이용 목적">
            {catalog.purposes.map((p) => {
              const on = filter.purposes.includes(p.id as PurposeTag);
              return (
                <button key={p.id} type="button" aria-pressed={on} className={`chip${on ? ' is-on' : ''}`} onClick={() => setFilter({ purposes: toggleIn(filter.purposes, p.id as PurposeTag) })}>
                  <span aria-hidden="true">{p.icon}</span>
                  {p.label}
                </button>
              );
            })}
          </div>

          <div className="chip-row" aria-label="추가 조건">
            <button type="button" aria-pressed={filter.parking} className={`chip${filter.parking ? ' is-on' : ''}`} onClick={() => setFilter({ parking: !filter.parking })}>
              <Icon name="car" size={15} />
              주차 가능
            </button>
            <button type="button" aria-pressed={filter.openNow} className={`chip${filter.openNow ? ' is-on' : ''}`} onClick={() => setFilter({ openNow: !filter.openNow })}>
              <Icon name="clock" size={15} />
              등록 영업시간 기준 운영 중
            </button>
            {showBev && (
              <button type="button" aria-haspopup="dialog" className={`chip${activeExtra ? ' is-on' : ''}`} onClick={() => setSheetOpen(true)}>
                <Icon name="glass" size={15} />
                음료 선택{activeExtra ? ` (${activeExtra})` : ''}
              </button>
            )}
          </div>
          {filter.openNow && <p className="hint">등록된 영업시간으로 계산한 결과이며, 실제 영업 여부는 업소 사정에 따라 다를 수 있습니다.</p>}
          {filter.parking && <p className="hint">주차 가능은 주차 방법이 있다는 뜻이며 빈자리를 보장하지 않습니다.</p>}
        </section>

        <div className="toolbar" role="toolbar" aria-label="보기 설정">
          <p className="result-count" aria-live="polite">
            <strong>{results.length}</strong>곳{filter.bounds ? ' (지도 범위 안)' : ''}
          </p>
          <div className="toolbar-actions">
            <button type="button" className="btn btn-small btn-ghost" onClick={geo.request} disabled={geo.status === 'locating'}>
              <Icon name="locate" size={16} />
              {geo.status === 'locating' ? '확인 중…' : '내 위치'}
            </button>
            {geo.position && (
              <label className="sort-select">
                <span className="sr-only">정렬</span>
                <select value={sort} onChange={(e) => setSort(e.target.value as SortMode)}>
                  <option value="default">기본 순서</option>
                  <option value="distance">가까운 순 (직선거리)</option>
                </select>
              </label>
            )}
            <div className="view-toggle" role="group" aria-label="화면 전환">
              <button type="button" aria-pressed={view === 'split'} onClick={() => setView('split')}>
                <Icon name="map" size={15} /><span aria-hidden="true">+</span><Icon name="list" size={15} />
                <span className="sr-only">지도와 목록</span>
              </button>
              <button type="button" aria-pressed={view === 'map'} onClick={() => setView('map')}>
                <Icon name="map" size={15} /> 지도
              </button>
              <button type="button" aria-pressed={view === 'list'} onClick={() => setView('list')}>
                <Icon name="list" size={15} /> 목록
              </button>
            </div>
          </div>
        </div>
        {geo.message && <p className="hint" role="status">{geo.message}</p>}
        {filter.bounds && (
          <div className="bounds-bar">
            <span>지도에 보이는 범위의 업소만 보는 중</span>
            <button type="button" className="btn btn-small btn-secondary" onClick={clearBounds}>전체 업소 보기</button>
          </div>
        )}

        <section className="venue-list" aria-label="업소 목록">
          {results.length === 0 ? (
            <div className="empty">
              <p><strong>조건에 맞는 업소가 없습니다.</strong></p>
              <p>지도 범위를 넓히거나 필터를 줄여 보세요.</p>
              <div className="empty-actions">
                {filter.bounds && <button type="button" className="btn btn-secondary" onClick={clearBounds}>전체 업소 보기</button>}
                <button type="button" className="btn btn-primary" onClick={resetAll}>필터 초기화</button>
              </div>
            </div>
          ) : (
            results.map((v) => (
              <VenueCard
                key={v.id}
                ref={(el) => { if (el) cardRefs.current.set(v.id, el); else cardRefs.current.delete(v.id); }}
                venue={v}
                selected={v.id === selectedId}
                distanceM={distance(v)}
                showBeverages={showBev}
                detailSearch={sourceSearch}
                onSelect={() => setSelectedId(v.id)}
              />
            ))
          )}
          <p className="disclosure">{site.disclosure}</p>
        </section>
      </div>

      <div className="explore-map">
        <MapView
          ref={mapRef}
          venues={results}
          selectedId={selectedId}
          onSelect={selectFromMap}
          center={data.config.mapCenter}
          myLocation={geo.position}
          persistKey="explore"
          onStatus={(s) => setMapOk(s === 'ready')}
        />
        {mapOk && !filter.bounds && (
          <button type="button" className="map-float btn btn-small" onClick={applyBounds}>
            <Icon name="search" size={15} /> 이 지도에서 보기
          </button>
        )}
        {view === 'map' && selected && (
          <div className="map-selected">
            <div>
              <strong>{selected.name}</strong>
              <span className="muted"> · {selected.category}</span>
            </div>
            <Link className="btn btn-small btn-primary" to={{ pathname: `/venues/${selected.slug}`, search: sourceSearch }}>상세 보기</Link>
          </div>
        )}
      </div>

      {showBev && (
        <BeverageSheet
          open={sheetOpen}
          products={filter.products}
          draftOnly={filter.draftOnly}
          onClose={() => setSheetOpen(false)}
          onApply={(products, draftOnly) => {
            setFilter({ products, draftOnly });
            setSheetOpen(false);
          }}
        />
      )}
    </div>
  );
}
