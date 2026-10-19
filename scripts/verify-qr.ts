// QR을 PNG로 생성한 뒤 다시 해독해 목적 URL과 일치하는지 확인한다.
// 사용: npm run qr:verify -- https://도메인/explore?source=lake-banner-01 [저장경로.png]
import { promises as fs } from 'node:fs';
import QRCode from 'qrcode';
import { PNG } from 'pngjs';
import jsQR from 'jsqr';

const url = process.argv[2];
const out = process.argv[3];
if (!url) {
  console.error('사용법: npm run qr:verify -- <URL> [out.png]');
  process.exit(1);
}
const buf = await QRCode.toBuffer(url, { errorCorrectionLevel: 'M', margin: 4, scale: 10, color: { dark: '#000000', light: '#ffffff' } });
const png = PNG.sync.read(buf);
const decoded = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
if (out) await fs.writeFile(out, buf);
if (decoded?.data === url) {
  console.log(`✓ 해독 일치: ${decoded.data}  (${png.width}x${png.height}px)`);
} else {
  console.error(`✗ 불일치: ${decoded?.data ?? '(해독 실패)'}`);
  process.exit(1);
}
