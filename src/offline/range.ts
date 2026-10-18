type ByteRange = { start: number; end: number } | 'unsatisfiable' | undefined;

/** Ignore unsupported/malformed ranges; a valid range outside the file gets 416. */
export function parseByteRange(header: string, length: number): ByteRange {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match || (!match[1] && !match[2])) return undefined;
  const first = match[1] ? Number(match[1]) : undefined;
  const last = match[2] ? Number(match[2]) : undefined;
  if (
    (first !== undefined && !Number.isSafeInteger(first)) ||
    (last !== undefined && !Number.isSafeInteger(last))
  )
    return undefined;
  if (length === 0) return 'unsatisfiable';
  if (first === undefined) {
    if (!last) return 'unsatisfiable';
    return { start: Math.max(0, length - last), end: length - 1 };
  }
  if (last !== undefined && last < first) return undefined;
  if (first >= length) return 'unsatisfiable';
  return { start: first, end: Math.min(last ?? length - 1, length - 1) };
}

export async function cachedResponse(request: Request, response: Response) {
  const headers = new Headers(response.headers);
  headers.set('Accept-Ranges', 'bytes');
  if (request.method === 'HEAD')
    return new Response(null, { status: 200, headers });
  const range = request.headers.get('Range');
  // Cached responses are complete, decoded files. Do not let stale validators
  // turn a conditional range request into a slice of a different resource.
  if (!range || request.headers.has('If-Range')) return response;
  const body = await response.arrayBuffer();
  const selected = parseByteRange(range, body.byteLength);
  if (!selected) return new Response(body, { status: 200, headers });
  if (selected === 'unsatisfiable') {
    headers.set('Content-Range', `bytes */${body.byteLength}`);
    headers.set('Content-Length', '0');
    return new Response(null, { status: 416, headers });
  }
  const { start, end } = selected;
  headers.set('Content-Range', `bytes ${start}-${end}/${body.byteLength}`);
  headers.set('Content-Length', String(end - start + 1));
  return new Response(body.slice(start, end + 1), { status: 206, headers });
}
