import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import catalog from '../../data/catalog/catalog.json';
import { parseBreaks } from '../../shared/csv';
import { DAY_LABELS, parseDayHours, serializeDayHours, WEEK_ORDER } from '../../shared/hours';
import { emptyOps, publishBlockers } from '../../shared/ops';
import { emptyVenue, toPublicVenue, validateVenue } from '../../shared/venue';
import type { Beverage, FeaturedMenu, PurposeTag, Venue, VenueOps, WeeklyHours } from '../../shared/types';
import { loadKakaoMaps, KakaoError, kakaoErrorMessage } from '../lib/kakaoLoader';
import { VenueDetail } from '../pages/VenuePage';
import { useAdminVenues } from './AdminApp';
import { api, ApiError } from './api';

/* eslint-disable @typescript-eslint/no-explicit-any */

const numOrNull = (s: string) => (s.trim() === '' ? null : Number(s));

export function VenueEditor() {
  const { id } = useParams();
  const isNew = id === 'new';
  const { rows } = useAdminVenues();
  const nav = useNavigate();
  const [venue, setVenue] = useState<Venue | null>(null);
  const [ops, setOps] = useState<VenueOps | null>(null);
  const [hoursText, setHoursText] = useState<Record<string, string>>({});
  const [breaksText, setBreaksText] = useState('');
  const [closuresText, setClosuresText] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const [preview, setPreview] = useState(false);

  useEffect(() => {
    if (!rows || venue) return;
    const row = rows.find((r) => r.venue.id === id);
    const v = row?.venue ?? emptyVenue();
    setVenue(v);
    setOps(row?.ops ?? emptyOps(''));
    setHoursText(Object.fromEntries(WEEK_ORDER.map((d) => [d, serializeDayHours(v.weeklyHours?.[d] ?? null)])));
    setBreaksText(v.breakTimes.map((b) => `${b.days.join('|')} ${b.start}-${b.end}`).join('; '));
    setClosuresText(v.temporaryClosures.map((c) => `${c.startDate}~${c.endDate}${c.reason ? ` ${c.reason}` : ''}`).join('; '));
  }, [rows, id, venue]);

  if (!rows || !venue || !ops) return <p>불러오는 중…</p>;
  if (!isNew && !rows.some((r) => r.venue.id === id)) return <p>업소를 찾을 수 없습니다. <Link to="/admin">목록으로</Link></p>;

  const set = <K extends keyof Venue>(k: K, val: Venue[K]) => { setSaved(false); setVenue({ ...venue, [k]: val }); };

  /** 텍스트 입력(영업시간 등)을 구조 데이터로 변환 */
  const compose = (): { v: Venue; errs: string[] } => {
    const errs: string[] = [];
    let weeklyHours: WeeklyHours | null = null;
    if (WEEK_ORDER.some((d) => (hoursText[d] ?? '').trim())) {
      weeklyHours = {} as WeeklyHours;
      for (const d of WEEK_ORDER) {
        try { weeklyHours[d] = parseDayHours(hoursText[d] ?? ''); } catch (e) { errs.push(`${DAY_LABELS[d]}요일 ${(e as Error).message}`); weeklyHours[d] = null; }
      }
    }
    const breakTimes = parseBreaks(breaksText, errs);
    const temporaryClosures = closuresText.split(';').map((x) => x.trim()).filter(Boolean).map((part) => {
      const m = part.match(/^(\d{4}-\d{2}-\d{2})~(\d{4}-\d{2}-\d{2})\s*(.*)$/);
      if (!m) errs.push(`임시 휴무 형식: "${part}" (예: 2026-12-31~2027-01-01 연말 휴무)`);
      return { startDate: m?.[1] ?? '', endDate: m?.[2] ?? '', reason: m?.[3] || null };
    });
    const v = { ...venue, weeklyHours, breakTimes, temporaryClosures };
    errs.push(...validateVenue(v));
    return { v, errs };
  };

  const save = async () => {
    const { v, errs } = compose();
    setErrors(errs);
    if (errs.length) return;
    try {
      await api(`/venues/${v.id}`, { method: 'PUT', body: { venue: v, ops } });
      setSaved(true);
      setVenue(v);
      if (isNew) nav(`/admin/venues/${v.id}`, { replace: true });
    } catch (e) {
      setErrors((e as ApiError).errors);
    }
  };

  const blockers = publishBlockers(venue, ops);

  return (
    <section className="admin-form">
      <div className="admin-title-row">
        <h1>{isNew ? '새 업소 등록' : `편집: ${venue.name}`}</h1>
        <div className="row-actions">
          <button type="button" className="btn btn-secondary" onClick={() => setPreview((p) => !p)}>{preview ? '편집으로' : '게시 전 미리보기'}</button>
          <button type="button" className="btn btn-primary" onClick={save}>저장</button>
        </div>
      </div>
      {errors.length > 0 && <ul className="error-box" role="alert">{errors.map((e) => <li key={e}>{e}</li>)}</ul>}
      {saved && <p role="status" className="ok-text">저장했습니다. (서버 저장소에 반영됨)</p>}

      {preview ? (
        <div className="preview-frame">
          <p className="muted small">미리보기 — 고객 화면과 같은 구성으로 공개 필드만 표시합니다. 이벤트는 기록되지 않습니다.</p>
          <div className="phone">
            <VenueDetail venue={toPublicVenue(compose().v)} isDemo={false} showBeverages contactEmail={null} preview />
          </div>
        </div>
      ) : (
        <>
          <fieldset>
            <legend>게시 관리 (비공개 운영 정보)</legend>
            <div className="grid-3">
              <label>게시 동의
                <select value={ops.consentStatus} onChange={(e) => setOps({ ...ops, consentStatus: e.target.value as VenueOps['consentStatus'] })}>
                  <option value="pending">동의 대기</option><option value="agreed">게시 동의 확인</option><option value="withdrawn">동의 철회</option>
                </select>
              </label>
              <label>게시 검토
                <select value={ops.reviewStatus} onChange={(e) => setOps({ ...ops, reviewStatus: e.target.value as VenueOps['reviewStatus'] })}>
                  <option value="draft">작성 중</option><option value="in_review">검토 중</option><option value="approved">승인</option><option value="rejected">반려</option>
                </select>
              </label>
              <label className="check"><input type="checkbox" checked={venue.isPublished} onChange={(e) => set('isPublished', e.target.checked)} /> 게시 ON</label>
            </div>
            <label>정보 확인 근거 (비공개)<textarea rows={2} value={ops.verificationEvidence ?? ''} onChange={(e) => setOps({ ...ops, verificationEvidence: e.target.value || null })} placeholder="예: 2026-10-10 매장 방문 확인, 메뉴판 사진 보관" /></label>
            <label>담당자 확인 메모 (비공개)<textarea rows={2} value={ops.staffNote ?? ''} onChange={(e) => setOps({ ...ops, staffNote: e.target.value || null })} /></label>
            <p className="muted small">사업자번호·도매사·점주 개인 연락처·매출 등 내부 정보는 이 시스템에 입력하지 마세요.</p>
            {blockers.length > 0 && <p className="warn-text small">공개 조건 미충족: {blockers.join(' / ')}</p>}
          </fieldset>

          <fieldset>
            <legend>기본 정보</legend>
            <div className="grid-3">
              <label>id (영문)<input value={venue.id} disabled={!isNew} onChange={(e) => setVenue({ ...venue, id: e.target.value, slug: venue.slug || e.target.value })} /></label>
              <label>slug (주소용)<input value={venue.slug} onChange={(e) => set('slug', e.target.value)} /></label>
              <label>공개 순서<input type="number" value={venue.displayOrder} onChange={(e) => set('displayOrder', Number(e.target.value))} /></label>
            </div>
            <div className="grid-3">
              <label>업소명<input value={venue.name} onChange={(e) => set('name', e.target.value)} /></label>
              <label>지역
                <select value={venue.area} onChange={(e) => set('area', e.target.value as Venue['area'])}>
                  {catalog.areas.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
                </select>
              </label>
              <label>업태<input value={venue.category} onChange={(e) => set('category', e.target.value)} placeholder="예: 한식, 고기구이" /></label>
            </div>
            <label>소개 (한두 문장, 확인되지 않은 ‘맛집·1위’ 표현 금지)<textarea rows={2} maxLength={300} value={venue.description ?? ''} onChange={(e) => set('description', e.target.value || null)} /></label>
            <div className="grid-3">
              <label>업소 대표 전화(공개)<input value={venue.publicPhone ?? ''} onChange={(e) => set('publicPhone', e.target.value || null)} placeholder="031-000-0000" /></label>
              <label>층<input value={venue.floor ?? ''} onChange={(e) => set('floor', e.target.value || null)} placeholder="예: 2층" /></label>
              <label>정보 확인일<input type="date" value={venue.informationVerifiedAt ?? ''} onChange={(e) => set('informationVerifiedAt', e.target.value || null)} /></label>
            </div>
            <fieldset className="inline">
              <legend>이용 목적 (업소가 확인한 것만)</legend>
              {catalog.purposes.map((p) => (
                <label key={p.id} className="check">
                  <input type="checkbox" checked={venue.purposeTags.includes(p.id as PurposeTag)}
                    onChange={(e) => set('purposeTags', e.target.checked ? [...venue.purposeTags, p.id as PurposeTag] : venue.purposeTags.filter((t) => t !== p.id))} />
                  {p.label}
                </label>
              ))}
            </fieldset>
          </fieldset>

          <LocationFields venue={venue} set={set} setVenue={setVenue} />

          <fieldset>
            <legend>사진</legend>
            <label>대표 사진 URL (업소 제공 실사진만, 없으면 비움)<input value={venue.coverImage ?? ''} onChange={(e) => set('coverImage', e.target.value || null)} placeholder="https://… 또는 /images/…" /></label>
            <label>추가 사진 URL (한 줄에 하나)<textarea rows={2} value={venue.images.join('\n')} onChange={(e) => set('images', e.target.value.split('\n').map((x) => x.trim()).filter(Boolean))} /></label>
          </fieldset>

          <MenuFields menus={venue.featuredMenus} onChange={(m) => set('featuredMenus', m)} />

          <fieldset>
            <legend>영업시간 (빈칸 = 미확인, “휴무” = 정기 휴무, 자정 넘김 예: 17:00-02:00)</legend>
            <div className="hours-grid">
              {WEEK_ORDER.map((d) => (
                <label key={d}>{DAY_LABELS[d]}<input value={hoursText[d] ?? ''} onChange={(e) => setHoursText({ ...hoursText, [d]: e.target.value })} placeholder="11:30-15:00, 17:00-22:00" /></label>
              ))}
            </div>
            <label>브레이크타임 (예: mon|tue|wed 15:00-17:00; sat 15:30-16:30)<input value={breaksText} onChange={(e) => setBreaksText(e.target.value)} /></label>
            <label>임시 휴무 (예: 2026-12-31~2027-01-01 연말 휴무)<input value={closuresText} onChange={(e) => setClosuresText(e.target.value)} /></label>
          </fieldset>

          <fieldset>
            <legend>주차·입구</legend>
            <div className="grid-3">
              <label>주차 유형
                <select value={venue.parkingType} onChange={(e) => set('parkingType', e.target.value as Venue['parkingType'])}>
                  <option value="unknown">미확인</option><option value="dedicated">매장 전용</option><option value="building">건물 주차</option><option value="public-nearby">인근 공영주차</option><option value="none">불가</option>
                </select>
              </label>
              <label>요금
                <select value={venue.parkingFee ?? ''} onChange={(e) => set('parkingFee', (e.target.value || null) as Venue['parkingFee'])}>
                  <option value="">미확인</option><option value="free">무료</option><option value="paid">유료</option><option value="conditional">조건부 무료</option>
                </select>
              </label>
              <label>가능 대수 (확인 시)<input type="number" min={0} value={venue.parkingCapacity ?? ''} onChange={(e) => set('parkingCapacity', numOrNull(e.target.value))} /></label>
            </div>
            <label>주차 조건·안내<textarea rows={2} value={venue.parkingDescription ?? ''} onChange={(e) => set('parkingDescription', e.target.value || null)} /></label>
            <label>입구 안내 (건물 안쪽·2층 등 실제 확인된 경로)<textarea rows={2} value={venue.entranceDescription ?? ''} onChange={(e) => set('entranceDescription', e.target.value || null)} /></label>
          </fieldset>

          <BeverageFields items={venue.beverages} onChange={(b) => set('beverages', b)} />
        </>
      )}
    </section>
  );
}

function LocationFields({ venue, set, setVenue }: { venue: Venue; set: <K extends keyof Venue>(k: K, v: Venue[K]) => void; setVenue(v: Venue): void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const search = async () => {
    setErr(null);
    setResults(null);
    try {
      const kakao = await loadKakaoMaps();
      const places = new kakao.maps.services.Places();
      places.keywordSearch(query || venue.name, (data: any[], status: string) => {
        if (status === kakao.maps.services.Status.OK) setResults(data);
        else if (status === kakao.maps.services.Status.ZERO_RESULT) setResults([]);
        else setErr('장소 검색 중 오류가 발생했습니다.');
      }, { location: new kakao.maps.LatLng(37.6588, 126.7695), radius: 5000 });
    } catch (e) {
      setErr(e instanceof KakaoError ? kakaoErrorMessage(e.code) : '카카오 SDK를 불러오지 못했습니다.');
    }
  };

  return (
    <fieldset>
      <legend>위치 (좌표 미확인 시 지도에 표시하지 않음)</legend>
      <label>주소<input value={venue.address ?? ''} onChange={(e) => set('address', e.target.value || null)} /></label>
      <label>상세 위치<input value={venue.addressDetail ?? ''} onChange={(e) => set('addressDetail', e.target.value || null)} placeholder="예: B동 2층, 엘리베이터 이용" /></label>
      <div className="grid-3">
        <label>위도<input inputMode="decimal" value={venue.latitude ?? ''} onChange={(e) => set('latitude', numOrNull(e.target.value))} /></label>
        <label>경도<input inputMode="decimal" value={venue.longitude ?? ''} onChange={(e) => set('longitude', numOrNull(e.target.value))} /></label>
        <label>카카오 장소 ID<input value={venue.kakaoPlaceId ?? ''} onChange={(e) => set('kakaoPlaceId', e.target.value || null)} /></label>
      </div>
      <div className="place-search">
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`카카오 장소 검색 (기본: ${venue.name || '업소명'})`} />
        <button type="button" className="btn btn-secondary" onClick={search}>장소 검색</button>
      </div>
      <p className="muted small">같은 이름이 여러 곳이면 주소·카카오맵 링크로 대조한 뒤 선택하세요. 검색은 관리자 등록 시에만 수행되며 고객 화면에서는 반복 지오코딩하지 않습니다.</p>
      {err && <p className="error-text">{err}</p>}
      {results && (results.length === 0 ? <p>검색 결과가 없습니다.</p> : (
        <ul className="place-results">
          {results.map((p) => (
            <li key={p.id}>
              <div><strong>{p.place_name}</strong> <span className="muted small">{p.category_name}</span></div>
              <div className="small">{p.road_address_name || p.address_name} · 장소 ID {p.id}</div>
              <div className="row-actions">
                <a className="btn btn-small btn-ghost" href={`https://place.map.kakao.com/${encodeURIComponent(p.id)}`} target="_blank" rel="noopener noreferrer">카카오맵에서 확인</a>
                <button type="button" className="btn btn-small btn-primary" onClick={() => setVenue({
                  ...venue, latitude: Number(p.y), longitude: Number(p.x), kakaoPlaceId: String(p.id),
                  address: venue.address || p.road_address_name || p.address_name,
                })}>이 장소로 선택</button>
              </div>
            </li>
          ))}
        </ul>
      ))}
    </fieldset>
  );
}

function MenuFields({ menus, onChange }: { menus: FeaturedMenu[]; onChange(m: FeaturedMenu[]): void }) {
  const upd = (i: number, p: Partial<FeaturedMenu>) => onChange(menus.map((m, j) => (j === i ? { ...m, ...p } : m)));
  return (
    <fieldset>
      <legend>대표 메뉴 (가격 빈칸 = 미확인, 0원과 구분)</legend>
      {menus.map((m, i) => (
        <div key={i} className="repeat-row">
          <label>메뉴명<input value={m.name} onChange={(e) => upd(i, { name: e.target.value })} /></label>
          <label>가격(원)<input inputMode="numeric" value={m.price ?? ''} onChange={(e) => upd(i, { price: numOrNull(e.target.value) })} /></label>
          <label>설명<input value={m.description ?? ''} onChange={(e) => upd(i, { description: e.target.value || null })} /></label>
          <label>사진 URL<input value={m.image ?? ''} onChange={(e) => upd(i, { image: e.target.value || null })} /></label>
          <label>확인일<input type="date" value={m.verifiedAt ?? ''} onChange={(e) => upd(i, { verifiedAt: e.target.value || null })} /></label>
          <button type="button" className="btn btn-small btn-ghost" onClick={() => onChange(menus.filter((_, j) => j !== i))}>삭제</button>
        </div>
      ))}
      <button type="button" className="btn btn-small btn-secondary" onClick={() => onChange([...menus, { name: '', price: null, description: null, image: null, verifiedAt: null }])}>메뉴 추가</button>
    </fieldset>
  );
}

function BeverageFields({ items, onChange }: { items: Beverage[]; onChange(b: Beverage[]): void }) {
  const upd = (i: number, p: Partial<Beverage>) => onChange(items.map((b, j) => (j === i ? { ...b, ...p } : b)));
  return (
    <fieldset>
      <legend>음료 취급 정보 (병·생맥주는 각각 따로 입력)</legend>
      <p className="muted small">정확한 제품명을 그대로 입력하세요(예: ‘카스 0.0’과 ‘카스 0.00’은 다른 제품). 무알코올·비알코올 표기는 제품 정보대로만. 미확인은 고객 화면에 ‘미취급’으로 표시되지 않습니다.</p>
      {items.map((b, i) => (
        <div key={i} className="repeat-row">
          <label>제품군
            <select value={b.productId} onChange={(e) => {
              const p = catalog.beverageProducts.find((x) => x.id === e.target.value);
              upd(i, { productId: e.target.value, brand: p?.brand ?? '' });
            }}>
              {catalog.beverageProducts.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </label>
          <label>정확한 제품명<input value={b.productName} onChange={(e) => upd(i, { productName: e.target.value })} /></label>
          <label>제공 형태
            <select value={b.servingType} onChange={(e) => upd(i, { servingType: e.target.value as Beverage['servingType'] })}>
              <option value="draft">생맥주</option><option value="bottle">병</option><option value="can">캔</option><option value="unknown">미확인</option>
            </select>
          </label>
          <label>용량(ml)<input inputMode="numeric" value={b.volumeMl ?? ''} onChange={(e) => upd(i, { volumeMl: numOrNull(e.target.value) })} /></label>
          <label>가격(원)<input inputMode="numeric" value={b.price ?? ''} onChange={(e) => upd(i, { price: numOrNull(e.target.value) })} /></label>
          <label>상태
            <select value={b.availabilityStatus} onChange={(e) => upd(i, { availabilityStatus: e.target.value as Beverage['availabilityStatus'] })}>
              <option value="available">취급 확인</option><option value="unverified">미확인</option><option value="unavailable">미취급 확인(비공개)</option>
            </select>
          </label>
          <label>확인일<input type="date" value={b.verifiedAt ?? ''} onChange={(e) => upd(i, { verifiedAt: e.target.value || null })} /></label>
          <button type="button" className="btn btn-small btn-ghost" onClick={() => onChange(items.filter((_, j) => j !== i))}>삭제</button>
        </div>
      ))}
      <button type="button" className="btn btn-small btn-secondary" onClick={() => onChange([...items, { productId: 'cass', brand: '카스', productName: '', servingType: 'unknown', volumeMl: null, price: null, availabilityStatus: 'unverified', verifiedAt: null }])}>음료 추가</button>
    </fieldset>
  );
}
