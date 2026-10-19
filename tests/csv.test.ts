import { describe, expect, it } from 'vitest';
import Papa from 'papaparse';
import { readFileSync } from 'node:fs';
import { buildImportPreview } from '../shared/csv';
import { venue } from './fixtures';

function parse(csv: string) {
  const r = Papa.parse<Record<string, string>>(csv.trim(), { header: true, skipEmptyLines: 'greedy' });
  return { headers: r.meta.fields ?? [], rows: r.data };
}

const H = 'id,name,area,category,latitude,longitude,menus,hours_mon,beverages,consent_status,staff_note,business_number';

describe('CSV 가져오기 미리보기', () => {
  it('신규·수정·변경없음·중복·오류·누락 구분', () => {
    const existing = [venue({ id: 'keep', name: '유지', area: 'lafesta' }), venue({ id: 'gone', name: '빠진 업소' })];
    const { headers, rows } = parse(`${H}
new-1,신규,lafesta,한식,37.66,126.77,국밥:9000,11:00-21:00,hanmac:한맥:draft:500:5000:available:2026-10-01,agreed,메모,123-45-67890
keep,유지-이름변경,lafesta,한식,37.66,126.77,,,,,,
new-1,신규중복,lafesta,한식,,,,,,,,
bad,,seoul,,,,,25:00-26:00,unknown:x:keg::::,,,`);
    const p = buildImportPreview(headers, rows, existing);
    expect(p.rows.map((r) => r.status)).toEqual(['new', 'update', 'duplicate', 'invalid']);
    expect(p.missing.map((m) => m.id)).toEqual(['gone']);
    expect(p.ignoredColumns).toEqual(['business_number']);
    expect(p.rows[3].errors.length).toBeGreaterThan(2);
  });

  it('비공개 열은 공개 Venue로 복사되지 않음, 알 수 없는 열은 어디에도 저장되지 않음', () => {
    const { headers, rows } = parse(`${H}
n,이름,lafesta,한식,,,,,,agreed,담당 메모,123-45-67890`);
    const r = buildImportPreview(headers, rows, []).rows[0];
    expect(JSON.stringify(r.venue)).not.toContain('담당 메모');
    expect(JSON.stringify(r.venue)).not.toContain('123-45-67890');
    expect(JSON.stringify(r.ops)).not.toContain('123-45-67890');
    expect(r.ops).toEqual({ consentStatus: 'agreed', staffNote: '담당 메모' });
    expect(r.venue.isPublished).toBe(false); // CSV로 게시되지 않음
  });

  it('빈 가격·좌표는 null(미확인), 0은 0', () => {
    const { headers, rows } = parse(`${H}
n,이름,lafesta,한식,,,무료시식:0;특선:,,,,,`);
    const v = buildImportPreview(headers, rows, []).rows[0].venue;
    expect(v.latitude).toBeNull();
    expect(v.featuredMenus.map((m) => m.price)).toEqual([0, null]);
    expect(v.weeklyHours).toBeNull();
  });

  it('제공 템플릿 CSV가 오류 없이 읽힌다', () => {
    const { headers, rows } = parse(readFileSync('public/templates/venues-template.csv', 'utf8'));
    const p = buildImportPreview(headers, rows, []);
    expect(p.missingColumns).toEqual([]);
    expect(p.ignoredColumns).toEqual([]);
    for (const r of p.rows) expect(r.errors).toEqual([]);
  });
});
