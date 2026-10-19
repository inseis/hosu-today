import { describe, expect, it } from 'vitest';
import { buildCampaignUrl, isAllowedTargetPath, kakaoDirectionsUrl, safeUrl } from '../shared/links';

describe('카카오맵 링크', () => {
  it('업소명 URL 인코딩 (쉼표 포함 이름도 안전)', () => {
    expect(kakaoDirectionsUrl({ name: '호수, 식당', latitude: 37.1, longitude: 126.2, kakaoPlaceId: null, address: null }))
      .toBe('https://map.kakao.com/link/to/%ED%98%B8%EC%88%98%2C%20%EC%8B%9D%EB%8B%B9,37.1,126.2');
  });
  it('검증된 장소 ID 우선', () => {
    expect(kakaoDirectionsUrl({ name: 'a', latitude: 1, longitude: 2, kakaoPlaceId: '12345', address: null })).toBe('https://map.kakao.com/link/to/12345');
  });
  it('좌표 미확인이면 임의 위치 대신 주소 검색', () => {
    expect(kakaoDirectionsUrl({ name: 'a', latitude: null, longitude: null, kakaoPlaceId: null, address: '장항동 1' })).toBe(`https://map.kakao.com/link/search/${encodeURIComponent('장항동 1')}`);
  });
});

describe('URL 검증', () => {
  it('http(s)와 상대경로만', () => {
    expect(safeUrl('javascript:alert(1)')).toBeNull();
    expect(safeUrl('data:text/html,x')).toBeNull();
    expect(safeUrl('//evil.com/x', { allowRelative: true })).toBeNull();
    expect(safeUrl('/images/a.jpg', { allowRelative: true })).toBe('/images/a.jpg');
    expect(safeUrl('https://example.com/a.jpg')).toBe('https://example.com/a.jpg');
  });
  it('QR 대상 경로 제한', () => {
    expect(isAllowedTargetPath('/explore')).toBe(true);
    expect(isAllowedTargetPath('/venues/demo-mulbit')).toBe(true);
    expect(isAllowedTargetPath('https://evil.com')).toBe(false);
    expect(isAllowedTargetPath('/admin')).toBe(false);
  });
  it('캠페인 URL', () => {
    expect(buildCampaignUrl('https://example.kr', '/explore', 'lake-banner-01')).toBe('https://example.kr/explore?source=lake-banner-01');
    expect(buildCampaignUrl('https://inseis.github.io/hosu-today/', '/venues/a', 's1')).toBe('https://inseis.github.io/hosu-today/venues/a?source=s1');
  });
});
