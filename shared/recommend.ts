import { hasNonAlc } from './filter';
import type { PublicVenue } from './types';

// "뭐 먹지?" 간단 추천. 규칙 기반이며 추천 이유를 함께 돌려준다.
// - 음식: 업소명·업종에 들어간 단어로 대략 분류 (메뉴판 확인 정보가 아님)
// - 음료: 업소가 취급을 확인한(available) 제품만
// 인기·평점은 쓰지 않는다.

export interface FoodPref { id: string; label: string; icon: string; words: string[] }
export interface DrinkPref { id: string; label: string }

export const FOOD_PREFS: FoodPref[] = [
  { id: 'meat', label: '고기·구이', icon: '🥩', words: ['고기', '갈비', '삼겹', '돼지', '돗', '돈', '구이', '백정', '대패', '냉삼', '한우', '미돈', '소갈비'] },
  { id: 'gopchang', label: '곱창·막창', icon: '🔥', words: ['곱창', '막창', '곱새', '낙곱'] },
  { id: 'soup', label: '국물·찌개', icon: '🍲', words: ['탕', '찌개', '전골', '복국', '부대', '감자탕'] },
  { id: 'seafood', label: '해산물', icon: '🦀', words: ['해물', '조개', '대게', '어시장', '동해안', '스시', '쭈낙', '뻘', '횟집'] },
  { id: 'chicken', label: '치킨·닭', icon: '🍗', words: ['치킨', '닭', '통닭', '호프'] },
  { id: 'jokbal', label: '족발', icon: '🐷', words: ['족발'] },
  { id: 'chinese', label: '중식·양꼬치', icon: '🥟', words: ['중식', '짜장', '양꼬치', '금문', '아시안'] },
  { id: 'light', label: '가볍게 한 끼', icon: '🍜', words: ['우동', '텐동', '만두', '밥상', '국수', '양식'] },
];

export const DRINK_PREFS: DrinkPref[] = [
  { id: 'draft', label: '시원한 생맥주' },
  { id: 'cass', label: '카스' },
  { id: 'hanmac', label: '한맥' },
  { id: 'nonalc', label: '논알콜·무알콜' },
  { id: 'any', label: '상관없어요' },
];

export function matchFood(v: PublicVenue, pref: FoodPref): boolean {
  const hay = `${v.name} ${v.category}`;
  return pref.words.some((w) => hay.includes(w));
}

export function matchDrink(v: PublicVenue, drinkId: string): string | null {
  const avail = v.beverages.filter((b) => b.availabilityStatus === 'available');
  switch (drinkId) {
    case 'draft': {
      const b = avail.find((x) => x.servingType === 'draft');
      return b ? `${b.productName} 생맥주` : null;
    }
    case 'cass': {
      const b = avail.find((x) => x.productId === 'cass' || x.productId === 'cass-zero');
      return b ? b.productName + (b.servingType === 'draft' ? ' 생맥주' : b.servingType === 'bottle' ? ' 병' : '') : null;
    }
    case 'hanmac': {
      const b = avail.find((x) => x.productId === 'hanmac');
      return b ? `한맥${b.servingType === 'draft' ? ' 생맥주' : b.servingType === 'bottle' ? ' 병' : ''}` : null;
    }
    case 'nonalc':
      return hasNonAlc(v) ? '논알콜·무알콜 맥주' : null;
    default:
      return null;
  }
}

export interface Recommendation {
  venue: PublicVenue;
  reasons: string[];
}

export interface RecommendResult {
  picks: Recommendation[];
  /** 두 조건을 모두 만족하는 곳이 없어 한쪽 조건만으로 고른 경우 */
  relaxed: 'drink' | 'food' | null;
}

/** seed가 같으면 같은 결과 — '다른 곳 보기'는 seed만 바꿔 다시 섞는다 */
function shuffle<T>(arr: T[], seed: number): T[] {
  const a = [...arr];
  let s = seed || 1;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) % 2147483648;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function recommend(venues: PublicVenue[], foodId: string | null, drinkId: string | null, seed = 1, count = 3): RecommendResult {
  const food = FOOD_PREFS.find((f) => f.id === foodId) ?? null;
  const wantsDrink = !!drinkId && drinkId !== 'any';
  const build = (v: PublicVenue, useFood: boolean, useDrink: boolean): Recommendation | null => {
    const reasons: string[] = [];
    if (useFood && food) {
      if (!matchFood(v, food)) return null;
      reasons.push(`${food.label} (${v.category})`);
    }
    if (useDrink && wantsDrink) {
      const d = matchDrink(v, drinkId!);
      if (!d) return null;
      reasons.push(`${d} 취급 확인`);
    }
    return { venue: v, reasons };
  };
  const pick = (useFood: boolean, useDrink: boolean) =>
    shuffle(venues, seed).map((v) => build(v, useFood, useDrink)).filter((x): x is Recommendation => !!x).slice(0, count);

  let picks = pick(true, true);
  let relaxed: RecommendResult['relaxed'] = null;
  if (picks.length === 0 && food && wantsDrink) {
    picks = pick(true, false);
    relaxed = 'drink';
    if (picks.length === 0) {
      picks = pick(false, true);
      relaxed = 'food';
    }
  }
  return { picks, relaxed };
}
