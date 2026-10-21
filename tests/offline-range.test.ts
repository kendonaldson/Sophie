import { describe, expect, it } from 'vitest';
import { cachedResponse, parseByteRange } from '../src/offline/range';

describe('offline audio byte ranges', () => {
  it('supports closed, open-ended and suffix ranges, clipping to file size', () => {
    expect(parseByteRange('bytes=2-5', 10)).toEqual({ start: 2, end: 5 });
    expect(parseByteRange('bytes=2-', 10)).toEqual({ start: 2, end: 9 });
    expect(parseByteRange('bytes=2-99', 10)).toEqual({ start: 2, end: 9 });
    expect(parseByteRange('bytes=-4', 10)).toEqual({ start: 6, end: 9 });
    expect(parseByteRange('bytes=-40', 10)).toEqual({ start: 0, end: 9 });
  });

  it('distinguishes unsatisfiable from invalid or unsupported ranges', () => {
    expect(parseByteRange('bytes=10-', 10)).toBe('unsatisfiable');
    expect(parseByteRange('bytes=-0', 10)).toBe('unsatisfiable');
    expect(parseByteRange('bytes=0-', 0)).toBe('unsatisfiable');
    for (const header of ['bytes=-', 'bytes=4-2', 'items=0-4', 'bytes=0-1,3-4'])
      expect(parseByteRange(header, 10)).toBeUndefined();
  });

  const response = () =>
    new Response('0123456789', {
      headers: { 'Content-Type': 'audio/mpeg', 'Content-Length': '10' },
    });
  const request = (range: string, method = 'GET') =>
    new Request('https://example.test/Sophie/music.mp3', {
      method,
      headers: { Range: range },
    });

  it('returns exact bytes and headers from the complete cached file', async () => {
    const result = await cachedResponse(request('bytes=2-5'), response());
    expect(result.status).toBe(206);
    expect(result.headers.get('Content-Range')).toBe('bytes 2-5/10');
    expect(result.headers.get('Content-Length')).toBe('4');
    expect(result.headers.get('Content-Type')).toBe('audio/mpeg');
    expect(await result.text()).toBe('2345');
  });

  it('returns 416 without a body for a range beyond the file', async () => {
    const result = await cachedResponse(request('bytes=10-'), response());
    expect(result.status).toBe(416);
    expect(result.headers.get('Content-Range')).toBe('bytes */10');
    expect(await result.text()).toBe('');
  });

  it('ignores range for HEAD and keeps full file metadata', async () => {
    const result = await cachedResponse(
      request('bytes=2-5', 'HEAD'),
      response(),
    );
    expect(result.status).toBe(200);
    expect(result.headers.get('Content-Length')).toBe('10');
    expect(result.headers.get('Content-Range')).toBeNull();
    expect(await result.text()).toBe('');
  });

  it('serves a whole file for unsupported and conditional ranges', async () => {
    const conditional = request('bytes=2-5');
    conditional.headers.set('If-Range', 'old-validator');
    for (const input of [request('bytes=0-1,3-4'), conditional]) {
      const result = await cachedResponse(input, response());
      expect(result.status).toBe(200);
      expect(await result.text()).toBe('0123456789');
    }
  });
});
