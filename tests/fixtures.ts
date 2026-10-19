import { emptyVenue } from '../shared/venue';
import type { Venue } from '../shared/types';

export function venue(p: Partial<Venue> & { id: string }): Venue {
  return { ...emptyVenue(p.id), name: `테스트 ${p.id}`, category: '한식', latitude: 37.66, longitude: 126.77, ...p };
}
/** KST 기준 시각 → Date */
export const kst = (iso: string) => new Date(`${iso}+09:00`);
