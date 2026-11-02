import https from 'node:https';
import http from 'node:http';
import { lookup } from 'node:dns/promises';
import { Readable } from 'node:stream';
import ipaddr from 'ipaddr.js';

const MAX_BYTES = 19 * 1024 * 1024;
const fail = (message, status = 400) => Object.assign(new Error(message), { status });

async function openAudio(input, signal, redirects = 0) {
  let url;
  try { url = new URL(input); } catch { throw fail('Provide a valid public audio URL.'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || (url.port && !['80', '443'].includes(url.port))) {
    throw fail('Use a public HTTP(S) audio URL on a standard port.');
  }
  const host = url.hostname.replace(/^\[|\]$/g, '');
  const addresses = await lookup(host, { all: true });
  if (!addresses.length || addresses.some(({ address }) => ipaddr.process(address).range() !== 'unicast')) {
    throw fail('Private and reserved network addresses are not supported.');
  }
  const address = addresses[0];
  const response = await new Promise((resolve, reject) => {
    const request = (url.protocol === 'https:' ? https : http).get(url, {
      signal, headers: { Accept: 'audio/*', 'Accept-Encoding': 'identity' },
      // Pin the validated address to prevent DNS rebinding.
      lookup: (_host, _options, callback) => callback(null, address.address, address.family),
    }, resolve);
    request.on('error', reject);
  });
  if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
    response.destroy();
    if (redirects >= 4 || !response.headers.location) throw fail('Too many source redirects.');
    return openAudio(new URL(response.headers.location, url).href, signal, redirects + 1);
  }
  const type = String(response.headers['content-type'] || '').split(';')[0].toLowerCase();
  if (response.statusCode !== 200 || !/^audio\/[a-z0-9.+-]+$/.test(type) || type.includes('mpegurl')) {
    response.destroy();
    throw fail('This link is not a downloadable audio file. Use a direct audio URL; track pages and playlists require a separate resolver.', 422);
  }
  if (Number(response.headers['content-length']) > MAX_BYTES) {
    response.destroy();
    throw fail('Audio exceeds the 19 MB download limit.', 413);
  }
  return { response, type };
}

export default async function rip(request) {
  if (request.method !== 'POST') return Response.json({ error: 'Method not allowed.' }, { status: 405, headers: { Allow: 'POST' } });
  let body;
  try { body = await request.json(); } catch { return Response.json({ error: 'Send JSON containing a media URL.' }, { status: 400 }); }
  if (typeof body?.url !== 'string' || body.url.length > 4096) return Response.json({ error: 'Provide a valid media URL.' }, { status: 400 });
  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(55000)]);
  try {
    const { response, type } = await openAudio(body.url, signal);
    let received = 0;
    const stream = Readable.toWeb(response).pipeThrough(new TransformStream({
      transform(chunk, controller) {
        received += chunk.byteLength;
        if (received > MAX_BYTES) { response.destroy(); controller.error(fail('Audio exceeds the 19 MB download limit.', 413)); return; }
        controller.enqueue(chunk);
      },
    }));
    const extension = ({ 'audio/mpeg': 'mp3', 'audio/wav': 'wav', 'audio/x-wav': 'wav', 'audio/ogg': 'ogg', 'audio/flac': 'flac', 'audio/mp4': 'm4a', 'audio/aac': 'aac' })[type] || 'audio';
    const headers = { 'Content-Type': type, 'Content-Disposition': `attachment; filename="cheeky-rip.${extension}"`, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
    if (response.headers['content-length']) headers['Content-Length'] = response.headers['content-length'];
    return new Response(stream, { headers });
  } catch (error) {
    return Response.json({ error: error.status ? error.message : 'Unable to retrieve audio. The source may be unavailable or timed out.' }, { status: error.status || 502 });
  }
}
