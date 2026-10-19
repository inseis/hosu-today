// 서버 없이 정적 호스팅할 때: 게시 승인된 업소만 공개 JSON으로 내보낸다.
// 사용: npm run export:public  →  public/data/public.json
// 그 다음 VITE_PUBLIC_DATA_URL=/data/public.json 으로 빌드
import { promises as fs } from 'node:fs';
try { process.loadEnvFile('.env'); } catch { /* optional */ }
const { publicVenues, publicSettings } = await import('../server/app');
const { read, DEFAULT_SETTINGS } = await import('../server/store');

const venues = await publicVenues();
const parking = await read('parking');
const settings = publicSettings({ ...DEFAULT_SETTINGS, ...(await read('settings')) });
await fs.mkdir('public/data', { recursive: true });
await fs.writeFile('public/data/public.json', JSON.stringify({ venues, parking, settings, generatedAt: new Date().toISOString() }, null, 2));
console.log(`공개 업소 ${venues.length}곳, 주차장 ${parking.length}곳 → public/data/public.json`);
console.log('주의: 정적 JSON의 공지(notices)는 내보낸 시점 기준입니다. 기간이 바뀌면 다시 내보내세요.');
