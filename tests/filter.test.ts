import { describe, expect, it } from 'vitest';
import { EMPTY_FILTER, filterToParams, filterVenues, paramsToFilter, sortVenues } from '../shared/filter';
import { toPublicVenue } from '../shared/venue';
import { venue } from './fixtures';

const bev = (productId: string, servingType: 'draft' | 'bottle', availabilityStatus: 'available' | 'unverified' | 'unavailable') => ({
  productId, brand: '', productName: productId, servingType, volumeMl: null, price: null, availabilityStatus, verifiedAt: null,
});

const list = [
  venue({ id: 'a', area: 'lafesta', purposeTags: ['meal', 'group'], parkingType: 'building', displayOrder: 2, beverages: [bev('hanmac', 'bottle', 'available')] }),
  venue({ id: 'b', area: 'westerndom', purposeTags: ['quiet-talk'], parkingType: 'unknown', displayOrder: 1, beverages: [bev('hanmac', 'draft', 'available')] }),
  venue({ id: 'c', area: 'lakepark', purposeTags: ['meal'], parkingType: 'none', displayOrder: 3, latitude: null, longitude: null, beverages: [bev('cass', 'bottle', 'unverified')] }),
].map(toPublicVenue);

describe('필터', () => {
  it('지역·목적·주차', () => {
    expect(filterVenues(list, { ...EMPTY_FILTER, area: 'lafesta' }).map((v) => v.id)).toEqual(['a']);
    expect(filterVenues(list, { ...EMPTY_FILTER, purposes: ['meal'] }).map((v) => v.id)).toEqual(['a', 'c']);
    expect(filterVenues(list, { ...EMPTY_FILTER, parking: true }).map((v) => v.id)).toEqual(['a']);
  });

  it('브랜드 미선택 시 모든 공개 업소', () => {
    expect(filterVenues(list, EMPTY_FILTER)).toHaveLength(3);
  });

  it('병/생맥주 구분: 한맥 병만 있는 곳은 생맥주 필터에서 제외', () => {
    expect(filterVenues(list, { ...EMPTY_FILTER, products: ['hanmac'] }).map((v) => v.id)).toEqual(['a', 'b']);
    expect(filterVenues(list, { ...EMPTY_FILTER, products: ['hanmac'], draftOnly: true }).map((v) => v.id)).toEqual(['b']);
  });

  it('미확인 취급은 일치로 보지 않음 (미취급으로도 표시하지 않음)', () => {
    expect(filterVenues(list, { ...EMPTY_FILTER, products: ['cass'] })).toHaveLength(0);
  });

  it('지도 범위 필터는 좌표 없는 업소를 제외', () => {
    const bounds = { sw: { lat: 37.6, lng: 126.7 }, ne: { lat: 37.7, lng: 126.8 } };
    expect(filterVenues(list, { ...EMPTY_FILTER, bounds }).map((v) => v.id)).toEqual(['a', 'b']);
  });

  it('검색: 이름·메뉴·주소', () => {
    const l = [toPublicVenue(venue({ id: 'm', featuredMenus: [{ name: '막창 구이', price: null, description: null, image: null, verifiedAt: null }] }))];
    expect(filterVenues(l, { ...EMPTY_FILTER, q: '막창' })).toHaveLength(1);
    expect(filterVenues(l, { ...EMPTY_FILTER, q: '없는말' })).toHaveLength(0);
  });

  it('URL 쿼리 왕복 (뒤로 가기 시 필터 복원)', () => {
    const f = { ...EMPTY_FILTER, q: '국수', area: 'westerndom' as const, purposes: ['group' as const], parking: true, openNow: true, products: ['hanmac'], draftOnly: true, bounds: { sw: { lat: 37.65, lng: 126.76 }, ne: { lat: 37.67, lng: 126.78 } } };
    const p = filterToParams(f, new URLSearchParams('source=lake-banner-01'));
    expect(p.get('source')).toBe('lake-banner-01');
    expect(paramsToFilter(p)).toEqual(f);
  });

  it('잘못된 쿼리 값은 무시', () => {
    const f = paramsToFilter(new URLSearchParams('area=seoul&purpose=meal,hack&drink=<script>'));
    expect(f.area).toBe('all');
    expect(f.purposes).toEqual(['meal']);
    expect(f.products).toEqual([]);
  });

  it('기본 정렬은 운영자 공개 순서, 거리순은 위치가 있을 때만', () => {
    expect(sortVenues(list, 'default', null).map((v) => v.id)).toEqual(['b', 'a', 'c']);
    expect(sortVenues(list, 'distance', null).map((v) => v.id)).toEqual(['b', 'a', 'c']);
    const near = sortVenues(list, 'distance', { lat: 37.66, lng: 126.77 });
    expect(near[near.length - 1].id).toBe('c'); // 좌표 없음 → 뒤로
  });
});
