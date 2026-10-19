import { describe, expect, it } from 'vitest';
import { getOpenStatus, parseDayHours } from '../shared/hours';
import type { WeeklyHours } from '../shared/types';
import { kst } from './fixtures';

const week = (r: WeeklyHours[keyof WeeklyHours]): WeeklyHours => ({ mon: r, tue: r, wed: r, thu: r, fri: r, sat: r, sun: r });
const base = { breakTimes: [], temporaryClosures: [] };

describe('영업 상태 계산 (KST)', () => {
  // 2026-10-19 = 월요일
  it('자정 넘는 영업: 전날 시작한 영업이 새벽까지 이어진다', () => {
    const v = { ...base, weeklyHours: { ...week([{ open: '17:00', close: '02:00' }]), mon: [] } };
    // 화요일 01:30 → 월요일은 휴무라 영업 아님, 일요일 영업분은 이미 지남
    expect(getOpenStatus(v, kst('2026-10-20T01:30')).state).toBe('closed');
    // 월요일 01:30 → 일요일 17:00~02:00 영업 중
    expect(getOpenStatus(v, kst('2026-10-19T01:30'))).toEqual({ state: 'open', closesAt: '02:00' });
    // 월요일 02:00 정각 → 종료
    expect(getOpenStatus(v, kst('2026-10-19T02:00')).state).toBe('regular-holiday');
    // 화요일 23:00 → 영업 중
    expect(getOpenStatus(v, kst('2026-10-20T23:00')).state).toBe('open');
  });

  it('24:00 종료는 자정 넘김이 아닌 당일 종료', () => {
    const v = { ...base, weeklyHours: week([{ open: '16:00', close: '24:00' }]) };
    expect(getOpenStatus(v, kst('2026-10-19T23:59')).state).toBe('open');
    expect(getOpenStatus(v, kst('2026-10-19T15:00'))).toEqual({ state: 'closed', nextOpen: '16:00' });
  });

  it('브레이크타임', () => {
    const v = { ...base, weeklyHours: week([{ open: '11:00', close: '21:00' }]), breakTimes: [{ days: ['mon' as const], start: '15:00', end: '17:00' }] };
    expect(getOpenStatus(v, kst('2026-10-19T15:30'))).toEqual({ state: 'break', resumesAt: '17:00' });
    expect(getOpenStatus(v, kst('2026-10-20T15:30')).state).toBe('open'); // 화요일은 브레이크 없음
  });

  it('임시 휴무가 영업시간보다 우선', () => {
    const v = { ...base, weeklyHours: week([{ open: '11:00', close: '21:00' }]), temporaryClosures: [{ startDate: '2026-10-19', endDate: '2026-10-20', reason: '내부 공사' }] };
    expect(getOpenStatus(v, kst('2026-10-19T12:00'))).toEqual({ state: 'temporarily-closed', reason: '내부 공사', until: '2026-10-20' });
  });

  it('미확인 영업시간은 unknown (휴무로 단정하지 않음)', () => {
    expect(getOpenStatus({ ...base, weeklyHours: null }, kst('2026-10-19T12:00')).state).toBe('unknown');
    const partial = { ...base, weeklyHours: { ...week(null), fri: [{ open: '18:00', close: '01:00' }] } };
    expect(getOpenStatus(partial, kst('2026-10-19T20:00')).state).toBe('unknown');
    // 토요일 00:30 → 금요일 영업 이어짐
    expect(getOpenStatus(partial, kst('2026-10-24T00:30')).state).toBe('open');
  });

  it('기기 시간대와 무관하게 KST 기준', () => {
    const v = { ...base, weeklyHours: week([{ open: '11:00', close: '12:00' }]) };
    // UTC 02:30 = KST 11:30
    expect(getOpenStatus(v, new Date('2026-10-19T02:30:00Z')).state).toBe('open');
  });

  it('입력 파싱: 빈칸=미확인, 휴무=[], 형식 오류는 예외', () => {
    expect(parseDayHours('')).toBeNull();
    expect(parseDayHours('휴무')).toEqual([]);
    expect(parseDayHours('11:30-15:00, 17:00-02:00')).toEqual([{ open: '11:30', close: '15:00' }, { open: '17:00', close: '02:00' }]);
    expect(() => parseDayHours('11시-3시')).toThrow();
    expect(() => parseDayHours('24:30-02:00')).toThrow();
  });
});
