import { describe, expect, it } from 'vitest';
import { recommend } from '../shared/recommend';
import { toPublicVenue } from '../shared/venue';
import { venue } from './fixtures';

const bev = (productId: string, servingType: 'draft' | 'bottle') => ({ productId, brand: '', productName: productId === 'hanmac' ? '한맥' : '카스', servingType, volumeMl: null, price: null, availabilityStatus: 'available' as const, verifiedAt: null });
const list = [
  venue({ id: 'g', name: '착한곱창', category: '한식·고기', beverages: [bev('cass', 'draft')] }),
  venue({ id: 'm', name: '풍류갈비', category: '한식·고기', beverages: [bev('hanmac', 'bottle')] }),
  venue({ id: 'c', name: '정성통닭', category: '치킨·호프' }),
].map(toPublicVenue);

describe('뭐 먹지 추천', () => {
  it('음식+음료 모두 만족, 이유 포함', () => {
    const r = recommend(list, 'meat', 'hanmac', 3);
    expect(r.picks.map((p) => p.venue.id)).toEqual(['m']);
    expect(r.picks[0].reasons.join()).toContain('한맥 병 취급 확인');
  });
  it('둘 다 만족하는 곳이 없으면 음식 기준으로 완화', () => {
    const r = recommend(list, 'chicken', 'draft', 3);
    expect(r.relaxed).toBe('drink');
    expect(r.picks.map((p) => p.venue.id)).toEqual(['c']);
  });
  it('생맥주는 생맥주로 확인된 곳만', () => {
    expect(recommend(list, null, 'draft', 5).picks.map((p) => p.venue.id)).toEqual(['g']);
  });
  it('최대 3곳', () => {
    expect(recommend(list, null, 'any', 1).picks.length).toBe(3); // '상관없어요'만 골라도 3곳 제안
    expect(recommend([...list, ...list.map((v) => ({ ...v, id: v.id + '2' }))], 'meat', null, 1).picks.length).toBe(3);
  });
});
