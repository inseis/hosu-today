import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { DRINK_PREFS, FOOD_PREFS, recommend } from '../../shared/recommend';
import type { PublicVenue } from '../../shared/types';
import { track } from '../analytics/events';
import { featuredBeverages } from '../lib/brand';
import { BrandMark } from './BrandMark';

interface Props {
  venues: PublicVenue[];
  showBeverages: boolean;
  detailSearch: string;
  onShowOnMap(id: string): void;
}

/** 뭐 먹을지 모르는 사람을 위한 간단 추천 (규칙 기반, 이유 표시) */
export function Recommender({ venues, showBeverages, detailSearch, onShowOnMap }: Props) {
  const [open, setOpen] = useState(false);
  const [food, setFood] = useState<string | null>(null);
  const [drink, setDrink] = useState<string | null>(null);
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 100000) + 1);
  const drinks = showBeverages ? DRINK_PREFS : DRINK_PREFS.filter((d) => d.id === 'any');
  const result = useMemo(() => (food || drink ? recommend(venues, food, drink, seed) : null), [venues, food, drink, seed]);

  const choose = (kind: 'food' | 'drink', id: string) => {
    if (kind === 'food') setFood((f) => (f === id ? null : id));
    else setDrink((d) => (d === id ? null : id));
    setSeed((s) => s + 1);
    track('filter_apply', { filterSummary: `recommend:${kind}` });
  };

  if (!open) {
    return (
      <button type="button" className="reco-open" onClick={() => setOpen(true)}>
        <span className="reco-open-text">
          <strong>뭐 먹을지 모르겠다면?</strong>
          <span className="small muted">땡기는 음식·술을 고르면 세 곳을 골라드려요</span>
        </span>
        <span className="reco-open-arrow" aria-hidden="true">→</span>
      </button>
    );
  }

  return (
    <section className="reco" aria-labelledby="reco-title">
      <div className="reco-head">
        <h2 id="reco-title">오늘 뭐 땡겨요?</h2>
        <button type="button" className="btn btn-small btn-ghost" onClick={() => setOpen(false)}>접기</button>
      </div>
      <p className="reco-label">음식</p>
      <div className="chip-row reco-chips">
        {FOOD_PREFS.map((f) => (
          <button key={f.id} type="button" aria-pressed={food === f.id} className={`chip${food === f.id ? ' is-on' : ''}`} onClick={() => choose('food', f.id)}>
            {f.label}
          </button>
        ))}
      </div>
      <p className="reco-label">술·음료</p>
      <div className="chip-row reco-chips">
        {drinks.map((d) => (
          <button key={d.id} type="button" aria-pressed={drink === d.id} className={`chip${drink === d.id ? ' is-on' : ''}`} onClick={() => choose('drink', d.id)}>
            {d.label}
          </button>
        ))}
      </div>

      {result && (
        <div className="reco-result" aria-live="polite">
          {result.relaxed === 'drink' && <p className="hint">두 조건을 모두 만족하는 곳이 없어 음식 기준으로 골랐어요.</p>}
          {result.relaxed === 'food' && <p className="hint">두 조건을 모두 만족하는 곳이 없어 술·음료 기준으로 골랐어요.</p>}
          {result.picks.length === 0 ? (
            <p className="muted">조건에 맞는 곳이 아직 없어요. 다른 걸 골라 보세요.</p>
          ) : (
            <ol className="reco-list">
              {result.picks.map(({ venue: v, reasons }) => {
                const feat = showBeverages ? featuredBeverages(v) : [];
                return (
                  <li key={v.id} className={feat.length ? 'is-featured' : undefined}>
                    <div className="reco-item-main">
                      <strong>{v.name}</strong>
                      <span className="small muted">{v.category}</span>
                      <span className="small reco-reason">{reasons.join(' · ')}</span>
                    </div>
                    {feat.length > 0 && (
                      <span className="reco-bottles" aria-label={feat.map((b) => b.productName).join(', ')}>
                        {feat.slice(0, 2).map((b, i) => <BrandMark key={i} productId={b.productId} servingType={b.servingType} size={20} imageHeight={44} />)}
                      </span>
                    )}
                    <div className="reco-actions">
                      <Link className="btn btn-small btn-primary" to={{ pathname: `/venues/${v.slug}`, search: detailSearch }}>상세</Link>
                      {v.latitude !== null && <button type="button" className="btn btn-small btn-ghost" onClick={() => onShowOnMap(v.id)}>지도</button>}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
          <div className="reco-foot">
            <button type="button" className="btn btn-small btn-secondary" onClick={() => setSeed((s) => s + 7)}>다른 곳 보기</button>
            <span className="small muted">업소명·업종과 확인된 음료 정보로 고른 결과예요. 순위가 아니에요.</span>
          </div>
        </div>
      )}
    </section>
  );
}
