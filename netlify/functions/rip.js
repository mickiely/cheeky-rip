import https from 'node:https';
import http from 'node:http';
import { lookup } from 'node:dns/promises';
import { Readable } from 'node:stream';
import ipaddr from 'ipaddr.js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Expose-Headers': 'Content-Disposition',
};
const json = (body, status = 200, headers = {}) => Response.json(body, { status, headers: { ...corsHeaders, ...headers } });

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
      signal, headers: { Accept: 'audio/*', 'Accept-Encoding': 'identity', 'User-Agent': 'CheekyRip/1.0 (+https://netlify.app)' },
      // Pin the validated address to prevent DNS rebinding.
      // Node's autoSelectFamily asks for `all` addresses and expects an array back.
      lookup: (_host, options, callback) => (options?.all ? callback(null, addresses) : callback(null, address.address, address.family)),
    }, resolve);
    request.on('error', reject);
  });
  if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
    response.destroy();
    if (redirects >= 4 || !response.headers.location) throw fail('Too many source redirects.');
    return openAudio(new URL(response.headers.location, url).href, signal, redirects + 1);
  }
  const rawType = String(response.headers['content-type'] || '').split(';')[0].toLowerCase();
  const type = rawType === 'application/ogg' ? 'audio/ogg' : rawType;
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
  if (request.method === 'OPTIONS') return new Response(null, { status: 200, headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405, { Allow: 'POST, OPTIONS' });
  let body;
  try { body = await request.json(); } catch { return json({ error: 'Send JSON containing a media URL.' }, 400); }
  if (typeof body?.url !== 'string' || body.url.length > 4096) return json({ error: 'Provide a valid media URL.' }, 400);
  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(55000)]);
  try {
    let parsed;
    try { parsed = new URL(body.url); } catch { throw fail('Provide a valid public audio URL.'); }
    const platformHosts = ['spotify.com', 'spotify.link', 'soundcloud.com', 'on.soundcloud.com'];
    if (['https:', 'http:'].includes(parsed.protocol) && platformHosts.some((host) => parsed.hostname === host || parsed.hostname.endsWith(`.${host}`))) {
      return json({
        success: false,
        requiresDirectAudio: true,
        message: 'This streaming-platform page cannot be downloaded here. Drop a local MP3 or WAV in Section 02, or paste a direct public audio URL in Section 01, then download the file and load it in SoundLab.',
      });
    }
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
    const headers = { ...corsHeaders, 'Content-Type': type, 'Content-Disposition': `attachment; filename="cheeky-rip.${extension}"`, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
    if (response.headers['content-length']) headers['Content-Length'] = response.headers['content-length'];
    return new Response(stream, { headers });
  } catch (error) {
    return json({ error: error.status ? error.message : 'Unable to retrieve audio. The source may be unavailable or timed out.' }, error.status || 502);
  }
}
