import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import https from 'node:https';
import { PassThrough } from 'node:stream';
import { EventEmitter } from 'node:events';
import rip from '../netlify/functions/rip.js';

const post = (url) => new Request('https://example.com/.netlify/functions/rip', { method: 'POST', body: JSON.stringify({ url }) });
test('rejects invalid requests and private network destinations', async () => {
  assert.equal((await rip(new Request('https://example.com'))).status, 405);
  assert.equal((await rip(new Request('https://example.com', { method: 'POST', body: '{' }))).status, 400);
  for (const url of ['file:///etc/passwd', 'http://127.0.0.1/a.mp3', 'http://[::1]/a', 'http://169.254.169.254/a']) {
    assert.equal((await rip(post(url))).status, 400);
  }
});
test('streams original audio bytes and rejects pages, oversized files and unsafe redirects', async () => {
  let fixture = {};
  const stub = mock.method(https, 'get', (_url, options, callback) => {
    assert.equal(typeof options.lookup, 'function');
    const stream = new PassThrough();
    stream.statusCode = fixture.status || 200;
    stream.headers = fixture.headers || { 'content-type': 'audio/mpeg', 'content-length': '3' };
    queueMicrotask(() => { callback(stream); if (!stream.destroyed) stream.end(Buffer.from([0, 128, 255])); });
    return new EventEmitter();
  });
  try {
    const response = await rip(post('https://8.8.8.8/track'));
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-disposition'), /\.mp3/);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), Buffer.from([0, 128, 255]));
    fixture = { headers: { 'content-type': 'text/html' } };
    assert.equal((await rip(post('https://8.8.8.8/page'))).status, 422);
    fixture = { headers: { 'content-type': 'audio/mpeg', 'content-length': '25000000' } };
    assert.equal((await rip(post('https://8.8.8.8/large'))).status, 413);
    fixture = { status: 302, headers: { location: 'http://127.0.0.1/private' } };
    assert.equal((await rip(post('https://8.8.8.8/redirect'))).status, 400);
  } finally { stub.mock.restore(); }
});
