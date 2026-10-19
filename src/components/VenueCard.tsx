import { forwardRef } from 'react';
import { Link } from 'react-router-dom';
import { formatStraightDistance } from '../../shared/filter';
import type { PublicVenue } from '../../shared/types';
import { areaLabel, PARKING_LABEL, price, purpose } from '../lib/format';
import { Icon, OpenBadge, VenueImage } from './ui';
import { BrandMark } from './BrandMark';
import { brandImage, featuredBeverages, featuredLabel, hasCassBottle } from '../lib/brand';

interface Props {
  venue: PublicVenue;
  selected: boolean;
  distanceM: number | null;
  showBeverages: boolean;
  onSelect(): void;
  /** 상세 링크에 붙일 쿼리 (source 등) */
  detailSearch: string;
  /** 300m 이내 주차장 수 */
  nearbyParkingCount: number;
  /** '근처 주차장' 누름 → 지도에 주차장 표시 */
  onShowParking(): void;
}

export const VenueCard = forwardRef<HTMLElement, Props>(function VenueCard(
  { venue: v, selected, distanceM, showBeverages, onSelect, detailSearch, nearbyParkingCount, onShowParking },
  ref,
) {
  const menu = v.featuredMenus[0];
  const menuPrice = menu ? price(menu.price) : null;
  const featured = showBeverages ? featuredBeverages(v) : [];
  const bottles = featured.some((b) => brandImage(b));
  const showParkingButton = v.parkingType === 'unknown' && nearbyParkingCount > 0;
  return (
    <article ref={ref} className={`venue-card${selected ? ' is-selected' : ''}${featured.length ? ' is-featured' : ''}`} aria-current={selected || undefined}>
      <button type="button" className="venue-card-hit" onClick={onSelect} aria-label={`${v.name} 지도에서 보기`}>
        <div className="venue-card-body">
          <p className="venue-meta">
            {areaLabel(v.area)} · {v.category}
            {v.floor ? ` · ${v.floor}` : ''}
          </p>
          <h3 className="venue-name">{v.name}</h3>
          {menu && (
            <p className="venue-menu">
              {menu.name}
              {menuPrice ? <strong> {menuPrice}</strong> : <span className="muted"> 가격 확인 필요</span>}
            </p>
          )}
          <div className="venue-facts">
            {v.purposeTags.slice(0, 3).map((t) => <span key={t} className="tag">{purpose(t).label}</span>)}
            <OpenBadge venue={v} />
            {distanceM !== null && (
              <span className="fact">
                <Icon name="pin" size={14} />
                {formatStraightDistance(distanceM)}
              </span>
            )}
            {v.latitude === null && <span className="fact muted">지도 위치 확인 중</span>}
          </div>
        </div>
        {bottles ? (
          <span className="venue-card-bottles" aria-hidden="true">
            {featured.filter((b) => brandImage(b)).slice(0, 2).map((b, i) => <BrandMark key={i} productId={b.productId} servingType={b.servingType} imageHeight={64} />)}
          </span>
        ) : (
          <VenueImage src={v.coverImage} alt={v.name} className="venue-card-img" />
        )}
      </button>

      {featured.length > 0 && (
        <p className="featured-line">
          <span className="featured-line-title">카스·한맥 취급</span>
          {featured.map((b, i) => (
            <span key={`${b.productId}-${b.servingType}-${i}`} className={`featured-chip brand-${b.productId}`}>
              {!brandImage(b) && <BrandMark productId={b.productId} servingType={b.servingType} size={16} />}
              {featuredLabel(b)}
            </span>
          ))}
        </p>
      )}

      <div className="venue-card-foot">
        {showParkingButton ? (
          <button type="button" className="parking-link" onClick={onShowParking}>
            <span className="p-mark p-public" aria-hidden="true">P</span>
            근처 주차장 {nearbyParkingCount}곳 보기
          </button>
        ) : (
          <span className="fact">
            <Icon name="car" size={14} />
            {PARKING_LABEL[v.parkingType]}
          </span>
        )}
        {showBeverages && !featured.length && hasCassBottle(v) && (
          <span className="cass-bottle-line">
            <BrandMark productId="cass" servingType="bottle" imageHeight={22} />
            카스 병 있어요
          </span>
        )}
        <Link className="detail-link" to={{ pathname: `/venues/${v.slug}`, search: detailSearch }}>
          상세 보기 <span aria-hidden="true">→</span>
        </Link>
      </div>
    </article>
  );
});
