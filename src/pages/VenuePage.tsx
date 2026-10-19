import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { DAY_LABELS, formatDayHours, WEEK_ORDER } from '../../shared/hours';
import { kakaoDirectionsUrl, kakaoMapUrl } from '../../shared/links';
import { isStale } from '../../shared/venue';
import type { ParkingLot, PublicVenue } from '../../shared/types';
import { formatStraightDistance, nearbyParking } from '../../shared/filter';
import { featuredBeverages, featuredLabel } from '../lib/brand';
import { BrandMark } from '../components/BrandMark';
import { track } from '../analytics/events';
import { MapView } from '../components/MapView';
import { beverageText, DemoBanner, Icon, Notice, OpenBadge, VenueImage } from '../components/ui';
import { submitReport } from '../data/api';
import { useDataset } from '../hooks/useDataset';
import { areaLabel, formatDate, PARKING_FEE_LABEL, PARKING_LABEL, price, purpose, SERVING_LABEL } from '../lib/format';
import { site, withBase } from '../config/site';

export function VenuePage() {
  const { slug } = useParams();
  const ds = useDataset();
  const back = useBack();
  if (ds.status === 'loading') return <div className="page-loading" role="status">불러오는 중…</div>;
  if (ds.status === 'error') {
    return (
      <main className="page-pad">
        <Notice tone="warn">정보를 불러오지 못했습니다. 네트워크 연결을 확인해 주세요.</Notice>
        <button type="button" className="btn btn-primary" onClick={ds.retry}>다시 시도</button>
      </main>
    );
  }
  const venue = ds.data.venues.find((v) => v.slug === slug);
  if (!venue) {
    return (
      <main className="page-pad">
        <h1 className="page-title">업소 정보를 찾을 수 없습니다</h1>
        <p>게시가 중단되었거나 주소가 바뀐 업소일 수 있습니다.</p>
        <Link className="btn btn-primary" to="/explore">주변 업소 보러 가기</Link>
      </main>
    );
  }
  return <VenueDetail venue={venue} isDemo={ds.data.isDemo} showBeverages={ds.data.config.showBeverageInfo} contactEmail={ds.data.config.contactEmail} onBack={back} parking={ds.data.parking} />;
}

/** 탐색 화면에서 들어왔으면 뒤로 가기(필터·지도 상태 유지), 직접 접속이면 탐색 화면으로 */
function useBack() {
  const nav = useNavigate();
  const loc = useLocation();
  return () => (loc.key !== 'default' ? nav(-1) : nav({ pathname: '/explore', search: loc.search }));
}

interface DetailProps {
  venue: PublicVenue;
  isDemo: boolean;
  showBeverages: boolean;
  contactEmail: string | null;
  onBack?: () => void;
  /** 관리자 미리보기: 이벤트·제보 비활성 */
  preview?: boolean;
  parking?: ParkingLot[];
}

export function VenueDetail({ venue: v, isDemo, showBeverages, contactEmail, onBack, preview, parking = [] }: DetailProps) {
  const [allMenus, setAllMenus] = useState(false);
  const [shareMsg, setShareMsg] = useState<string | null>(null);
  const opened = useRef(false);

  useEffect(() => {
    if (preview || opened.current) return;
    opened.current = true;
    track('venue_open', { venueId: v.id });
    document.title = `${v.name} · ${site.name}`;
    return () => { document.title = site.name; };
  }, [v.id, v.name, preview]);

  const menus = allMenus ? v.featuredMenus : v.featuredMenus.slice(0, 3);
  const bevs = v.beverages.filter((b) => b.availabilityStatus === 'available');
  const unverifiedBevs = v.beverages.filter((b) => b.availabilityStatus === 'unverified');
  const stale = isStale(v.informationVerifiedAt);
  const hasCoord = v.latitude !== null && v.longitude !== null;
  const featured = showBeverages ? featuredBeverages(v) : [];
  const lots = nearbyParking(v, parking, 400).slice(0, 4);

  const share = async () => {
    if (preview) return;
    track('share_click', { venueId: v.id });
    const url = `${location.origin}${withBase(`/venues/${v.slug}`)}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: v.name, text: `${v.name} · ${site.name}`, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setShareMsg('링크를 복사했습니다.');
    } catch (e) {
      if ((e as DOMException)?.name !== 'AbortError') setShareMsg(`복사할 수 없어요. 주소: ${url}`);
    }
  };

  return (
    <main className="detail">
      {isDemo && <DemoBanner />}
      <div className="detail-topbar">
        {onBack && (
          <button type="button" className="icon-btn" onClick={onBack} aria-label="목록으로 돌아가기">
            <Icon name="back" />
          </button>
        )}
        <span className="detail-topbar-title">{v.name}</span>
        <button type="button" className="icon-btn" onClick={share} aria-label="공유하기">
          <Icon name="share" />
        </button>
      </div>
      {shareMsg && <p className="hint" role="status">{shareMsg}</p>}

      {/* 1. 대표 사진과 업소명 */}
      <VenueImage src={v.coverImage} alt={v.name} className="detail-cover" />
      <section className="detail-section detail-head">
        <p className="venue-meta">{areaLabel(v.area)} · {v.category}{v.floor ? ` · ${v.floor}` : ''}</p>
        <h1 className="detail-title">{v.name}</h1>
        {/* 2. 소개 */}
        {v.description && <p className="detail-desc">{v.description}</p>}
        {featured.length > 0 && (
          <div className="detail-featured">
            <span className="featured-ribbon-title">카스·한맥 취급</span>
            <ul className="featured-list">
              {featured.map((b, i) => (
                <li key={i} className={`featured-chip brand-${b.productId}`}><BrandMark productId={b.productId} size={20} />{featuredLabel(b)}</li>
              ))}
            </ul>
          </div>
        )}
        <div className="detail-quick">
          <a className="btn btn-primary" href={kakaoDirectionsUrl(v)} target="_blank" rel="noopener noreferrer" onClick={() => !preview && track('directions_click', { venueId: v.id })}>
            <Icon name="route" /> 카카오맵 길찾기
          </a>
          {v.publicPhone && <a className="btn btn-secondary" href={`tel:${v.publicPhone}`}>전화</a>}
        </div>
      </section>

      {stale && (
        <Notice tone="warn">
          이 업소 정보는 확인한 지 오래되었거나 확인일이 없습니다. 방문 전 업소에 직접 확인해 주세요.
        </Notice>
      )}

      {/* 3. 대표 메뉴·가격 */}
      <section className="detail-section" aria-labelledby="sec-menu">
        <h2 id="sec-menu">대표 메뉴</h2>
        {v.featuredMenus.length === 0 ? <p className="muted">메뉴 정보 확인 중</p> : (
          <ul className="menu-list">
            {menus.map((m, i) => (
              <li key={i}>
                {m.image && <VenueImage src={m.image} alt={m.name} className="menu-img" />}
                <div className="menu-text">
                  <span className="menu-name">{m.name}</span>
                  {m.description && <span className="muted small">{m.description}</span>}
                </div>
                <span className="menu-price">{price(m.price) ?? <span className="muted">가격 확인 필요</span>}</span>
              </li>
            ))}
          </ul>
        )}
        {v.featuredMenus.length > 3 && !allMenus && (
          <button type="button" className="btn btn-ghost btn-block" onClick={() => { setAllMenus(true); if (!preview) track('menu_open', { venueId: v.id }); }}>
            메뉴 {v.featuredMenus.length}개 모두 보기
          </button>
        )}
        <p className="muted small">가격은 확인일 기준이며 변동될 수 있습니다.</p>
      </section>

      {/* 4. 이용 정보 */}
      {v.purposeTags.length > 0 && (
        <section className="detail-section" aria-labelledby="sec-use">
          <h2 id="sec-use">이용 정보</h2>
          <ul className="tag-row">
            {v.purposeTags.map((t) => (
              <li key={t} className="tag"><span aria-hidden="true">{purpose(t).icon}</span> {purpose(t).label}</li>
            ))}
          </ul>
          <p className="muted small">업소가 확인한 이용 목적입니다.</p>
        </section>
      )}

      {/* 5. 음료 취급 정보 */}
      {showBeverages && (bevs.length > 0 || unverifiedBevs.length > 0) && (
        <section className="detail-section" aria-labelledby="sec-bev">
          <h2 id="sec-bev">음료 취급 정보</h2>
          {bevs.length > 0 && (
            <ul className="bev-table">
              {bevs.map((b, i) => (
                <li key={i}>
                  <div>
                    <span className="bev-brand"><Icon name="glass" size={14} /> {b.brand}</span>
                    <strong className="bev-product">{b.productName}</strong>
                  </div>
                  <div className="bev-detail">
                    <span className="serving">{SERVING_LABEL[b.servingType]}</span>
                    {b.volumeMl !== null && <span>{b.volumeMl}ml</span>}
                    {b.price !== null && <span>{price(b.price)}</span>}
                    <span className="muted small">확인 {formatDate(b.verifiedAt)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {unverifiedBevs.length > 0 && (
            <p className="muted small">
              취급 여부 확인 중: {unverifiedBevs.map(beverageText).join(', ')}
            </p>
          )}
          <p className="muted small">업소가 확인한 정보 기준이며, 재고 상황에 따라 다를 수 있습니다.</p>
        </section>
      )}

      {/* 6. 영업시간 */}
      <section className="detail-section" aria-labelledby="sec-hours">
        <h2 id="sec-hours">영업시간</h2>
        <OpenBadge venue={v} />
        <p className="muted small">등록된 영업시간으로 계산한 상태이며 실시간 영업 여부를 보장하지 않습니다.</p>
        {v.weeklyHours ? (
          <table className="hours-table">
            <tbody>
              {WEEK_ORDER.map((d) => (
                <tr key={d}>
                  <th scope="row">{DAY_LABELS[d]}</th>
                  <td className={v.weeklyHours![d] === null ? 'muted' : undefined}>{formatDayHours(v.weeklyHours![d])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <p>영업시간 확인 필요</p>}
        {v.breakTimes.length > 0 && (
          <p><strong>브레이크타임</strong> {v.breakTimes.map((b) => `${b.days.map((d) => DAY_LABELS[d]).join('·')} ${b.start}–${b.end}`).join(' / ')}</p>
        )}
        {v.temporaryClosures.filter((c) => c.endDate >= new Date().toISOString().slice(0, 10)).map((c, i) => (
          <p key={i}><strong>임시 휴무</strong> {c.startDate} ~ {c.endDate}{c.reason ? ` (${c.reason})` : ''}</p>
        ))}
      </section>

      {/* 7. 주차·입구 */}
      <section className="detail-section" aria-labelledby="sec-parking">
        <h2 id="sec-parking">주차·입구 안내</h2>
        <p className="fact-line"><Icon name="car" /> <strong>{PARKING_LABEL[v.parkingType]}</strong>{v.parkingFee ? ` · ${PARKING_FEE_LABEL[v.parkingFee]}` : ''}</p>
        {v.parkingDescription && <p>{v.parkingDescription}</p>}
        {v.parkingCapacity !== null && <p>주차 가능 대수: {v.parkingCapacity}대</p>}
        {v.parkingType !== 'none' && v.parkingType !== 'unknown' && <p className="muted small">주차 가능은 빈자리를 보장하지 않습니다.</p>}
        {lots.length > 0 && (
          <div className="nearby-parking">
            <p className="fact-line"><strong>가까운 주차장</strong></p>
            <ul>
              {lots.map(({ lot, meters }) => (
                <li key={lot.id}>
                  <span className={`p-mark p-${lot.kind}`} aria-hidden="true">P</span>
                  <div className="nearby-parking-text">
                    <span>{lot.name}</span>
                    <span className="muted small">{lot.kind === 'public' ? '공영' : '건물·오피스텔'} · {formatStraightDistance(meters)}</span>
                  </div>
                  <a className="btn btn-small btn-ghost" href={kakaoDirectionsUrl({ name: lot.name, latitude: lot.latitude, longitude: lot.longitude, kakaoPlaceId: lot.kakaoPlaceId, address: lot.address })} target="_blank" rel="noopener noreferrer">길찾기</a>
                </li>
              ))}
            </ul>
            <p className="muted small">카카오맵 주차장 정보 기준({lots[0].lot.collectedAt} 수집). 요금·운영시간·빈자리는 확인되지 않았습니다.</p>
          </div>
        )}
        <p className="fact-line"><Icon name="door" /> <strong>입구</strong></p>
        <p>{v.entranceDescription ?? <span className="muted">입구 안내 확인 중</span>}</p>
      </section>

      {/* 8. 위치·길찾기 */}
      <section className="detail-section" aria-labelledby="sec-loc">
        <h2 id="sec-loc">위치</h2>
        <p>{v.address ?? '주소 확인 중'}{v.addressDetail ? `, ${v.addressDetail}` : ''}</p>
        {hasCoord ? (
          <div className="mini-map">
            <MapView venues={[v]} selectedId={v.id} onSelect={() => undefined} myLocation={null} center={{ latitude: v.latitude!, longitude: v.longitude!, level: 3 }} />
          </div>
        ) : <p className="muted small">지도 위치를 확인 중입니다. 아래 링크로 카카오맵에서 주소를 검색할 수 있습니다.</p>}
        <div className="detail-quick">
          <a className="btn btn-primary" href={kakaoDirectionsUrl(v)} target="_blank" rel="noopener noreferrer" onClick={() => !preview && track('directions_click', { venueId: v.id })}>
            <Icon name="route" /> 길찾기
          </a>
          <a className="btn btn-secondary" href={kakaoMapUrl(v)} target="_blank" rel="noopener noreferrer">카카오맵에서 보기</a>
        </div>
        <p className="muted small">길찾기는 카카오맵에서 열립니다.</p>
      </section>

      {/* 9. 확인일·오류 제보 */}
      <section className="detail-section" aria-labelledby="sec-verify">
        <h2 id="sec-verify">정보 확인</h2>
        <p>정보 확인일: <strong>{formatDate(v.informationVerifiedAt)}</strong></p>
        {!preview && <ReportForm venueId={v.id} isDemo={isDemo} contactEmail={contactEmail} />}
      </section>
      <p className="disclosure page-pad">{site.disclosure}</p>
    </main>
  );
}

function ReportForm({ venueId, isDemo, contactEmail }: { venueId: string; isDemo: boolean; contactEmail: string | null }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState('hours');
  const [msg, setMsg] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'demo' | 'unavailable' | 'error'>('idle');

  if (!open) return <button type="button" className="btn btn-ghost" onClick={() => setOpen(true)}>정보가 다른가요? 오류 제보</button>;
  if (state === 'sent') return <Notice>제보가 접수되었습니다. 운영자가 확인 후 반영합니다.</Notice>;
  if (state === 'demo') return <Notice>데모 화면에서는 제보가 저장되지 않습니다.</Notice>;
  if (state === 'unavailable') {
    return <Notice>{contactEmail ? <>제보는 이메일로 보내주세요: <a href={`mailto:${contactEmail}`}>{contactEmail}</a></> : '현재 제보 접수 기능이 준비 중입니다.'}</Notice>;
  }
  return (
    <form
      className="report-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setState('sending');
        try {
          setState(await submitReport(venueId, kind, msg, isDemo));
        } catch {
          setState('error');
        }
      }}
    >
      <label>
        어떤 정보가 다른가요?
        <select value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="hours">영업시간</option>
          <option value="menu">메뉴·가격</option>
          <option value="location">위치·입구</option>
          <option value="parking">주차</option>
          <option value="beverage">음료 취급</option>
          <option value="closed">폐업·이전</option>
          <option value="other">기타</option>
        </select>
      </label>
      <label>
        내용 (선택, 500자 이내)
        <textarea value={msg} maxLength={500} rows={3} onChange={(e) => setMsg(e.target.value)} placeholder="연락처 등 개인정보는 적지 마세요." />
      </label>
      {state === 'error' && <p className="error-text">전송하지 못했습니다. 잠시 후 다시 시도해 주세요.</p>}
      <button type="submit" className="btn btn-primary" disabled={state === 'sending'}>{state === 'sending' ? '보내는 중…' : '제보 보내기'}</button>
    </form>
  );
}
