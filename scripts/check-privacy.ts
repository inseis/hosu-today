// 빌드 결과물에 내부 영업 용어·비공개 필드가 섞이지 않았는지 검사한다.
import { promises as fs } from 'node:fs';
import path from 'node:path';

const FORBIDDEN = [
  /\bPOC\b/, /\bBDR\b/, /\bBEES\b/, /\bKPI\b/, /사업자\s*번호/, /도매사/, /매출/, /내부\s*등급/,
  /verificationEvidence/, /staffNote/, /consentStatus/, /reviewStatus/, /business_number/i, /poc_code/i,
];
// 관리자 화면 청크(운영자용 UI)에는 데이터가 아니라 필드명과 "사업자번호·매출 등은 입력하지 마세요" 같은 안내 문구만 있다.
// 이 항목들은 관리자 청크에서만 허용하고, 내부 영업 약어(POC·BDR·BEES·KPI)는 모든 파일에서 금지한다.
const ADMIN_ALLOWED = new Set(['verificationEvidence', 'staffNote', 'consentStatus', 'reviewStatus', '사업자번호', '도매사', '매출']);

async function walk(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p)));
    else if (/\.(js|html|json|css|webmanifest)$/.test(e.name)) out.push(p);
  }
  return out;
}

const files = await walk('dist');
let failed = false;
for (const f of files) {
  const text = await fs.readFile(f, 'utf8');
  const isAdminChunk = /Admin/i.test(path.basename(f));
  for (const re of FORBIDDEN) {
    const m = text.match(re);
    if (!m) continue;
    if (isAdminChunk && ADMIN_ALLOWED.has(m[0])) continue;
    failed = true;
    console.error(`✗ ${f}: "${m[0]}" 발견`);
  }
}
if (failed) process.exit(1);
console.log(`✓ 개인정보·내부용어 검사 통과 (${files.length}개 파일)`);
