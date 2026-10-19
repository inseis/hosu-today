import { describe, expect, it } from 'vitest';
import QRCode from 'qrcode';
import { PNG } from 'pngjs';
import jsQR from 'jsqr';
import { buildCampaignUrl } from '../shared/links';

describe('QR 생성 → 해독 왕복', () => {
  const urls = [
    buildCampaignUrl('https://example.kr', '/explore', 'lake-banner-01'),
    buildCampaignUrl('https://example.kr', '/explore', 'lafesta-store-01'),
    buildCampaignUrl('https://example.kr', '/venues/demo-mulbit', 'store-banner-01'),
  ];
  it.each(urls)('%s', async (url) => {
    const buf = await QRCode.toBuffer(url, { errorCorrectionLevel: 'M', margin: 4, scale: 8 });
    const png = PNG.sync.read(buf);
    expect(png.width).toBe(png.height); // 정사각형
    expect(jsQR(new Uint8ClampedArray(png.data), png.width, png.height)?.data).toBe(url);
  });
  it('quiet zone 4모듈 유지 (가장자리 흰색)', async () => {
    const buf = await QRCode.toBuffer(urls[0], { margin: 4, scale: 8 });
    const png = PNG.sync.read(buf);
    for (let x = 0; x < png.width; x += 4) expect(png.data[(0 * png.width + x) * 4]).toBe(255);
  });
});
