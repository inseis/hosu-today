import { useState } from 'react';
import Papa from 'papaparse';
import { buildImportPreview, PRIVATE_COLUMNS, type ImportPreview } from '../../shared/csv';
import { api, ApiError } from './api';
import { withBase } from '../config/site';
import { useAdminVenues } from './AdminApp';

const STATUS_LABEL = { new: '신규', update: '수정', unchanged: '변경 없음', duplicate: '파일 내 중복', invalid: '오류' } as const;

export function ImportTab() {
  const { rows: existing, reload } = useAdminVenues();
  const [parsed, setParsed] = useState<{ headers: string[]; rows: Record<string, string>[] } | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const onFile = (file: File) => {
    setResult(null);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: 'greedy',
      transformHeader: (h) => h.trim(),
      complete: (r) => {
        const headers = r.meta.fields ?? [];
        setParsed({ headers, rows: r.data });
        setPreview(buildImportPreview(headers, r.data, (existing ?? []).map((x) => x.venue)));
      },
      error: (e) => setResult(`CSV를 읽지 못했습니다: ${e.message}`),
    });
  };

  const apply = async () => {
    if (!parsed) return;
    try {
      const r = await api<{ applied: number; skipped: number }>('/import/apply', { method: 'POST', body: parsed });
      setResult(`반영 완료: ${r.applied}건 저장, ${r.skipped}건 건너뜀. 신규 업소는 비공개 상태로 등록됩니다.`);
      setParsed(null);
      setPreview(null);
      reload();
    } catch (e) {
      setResult((e as ApiError).message);
    }
  };

  const count = (s: keyof typeof STATUS_LABEL) => preview?.rows.filter((r) => r.status === s).length ?? 0;
  const applicable = count('new') + count('update');

  return (
    <section>
      <h1>CSV 가져오기</h1>
      <p className="muted small">
        템플릿: <a href={withBase('/templates/venues-template.csv')} download>venues-template.csv</a> · 형식 설명은 <code>docs/DATA_GUIDE.md</code>.
        미리보기를 확인한 뒤 <strong>신규·수정</strong> 행만 반영됩니다. 게시 여부는 CSV로 바뀌지 않으며, 신규 업소는 비공개로 시작합니다.
      </p>
      <label className="file-input">
        CSV 파일 선택 (UTF-8)
        <input type="file" accept=".csv,text/csv" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
      </label>
      {result && <p role="status">{result}</p>}

      {preview && (
        <>
          <ul className="metric-grid">
            {(Object.keys(STATUS_LABEL) as (keyof typeof STATUS_LABEL)[]).map((s) => (
              <li key={s}><span>{STATUS_LABEL[s]}</span><strong>{count(s)}</strong></li>
            ))}
            <li><span>파일에 없는 기존 업소</span><strong>{preview.missing.length}</strong></li>
          </ul>
          {preview.missingColumns.length > 0 && <p className="error-text">필수 열 누락: {preview.missingColumns.join(', ')}</p>}
          {preview.ignoredColumns.length > 0 && (
            <p className="warn-text small">저장하지 않고 무시하는 열: {preview.ignoredColumns.join(', ')} — 사업자번호·내부 코드 등은 이 시스템에 저장하지 않습니다.</p>
          )}
          <p className="muted small">비공개 운영 열({PRIVATE_COLUMNS.join(', ')})은 운영 데이터로만 저장되고 공개 데이터로 복사되지 않습니다.</p>
          {preview.missing.length > 0 && (
            <p className="small">파일에 없는 기존 업소(삭제하지 않음): {preview.missing.map((m) => m.name).join(', ')}</p>
          )}
          <div className="table-wrap">
            <table className="admin-table">
              <thead><tr><th>행</th><th>id</th><th>업소명</th><th>상태</th><th>내용</th></tr></thead>
              <tbody>
                {preview.rows.map((r) => (
                  <tr key={r.line} className={`row-${r.status}`}>
                    <td>{r.line}</td>
                    <td>{r.id || '-'}</td>
                    <td>{r.name || '-'}</td>
                    <td>{STATUS_LABEL[r.status]}</td>
                    <td className="small">
                      {r.errors.map((e) => <div key={e} className="error-text">{e}</div>)}
                      {r.warnings.map((w) => <div key={w} className="warn-text">{w}</div>)}
                      {r.status === 'update' && r.changedFields.length > 0 && <div>변경: {r.changedFields.join(', ')}</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button type="button" className="btn btn-primary" disabled={!applicable} onClick={apply}>
            {applicable}건 반영하기
          </button>
        </>
      )}
    </section>
  );
}
