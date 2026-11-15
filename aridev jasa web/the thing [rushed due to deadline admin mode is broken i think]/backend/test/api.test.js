const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createApp } = require('../src/server');

let base, server, dir, token = '';
test.before(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wb-'));
  const app = createApp({ DATA_FILE: path.join(dir, 'store.json'), ADMIN_PASSWORD: 'tes12345', MAIL_MODE: 'console', SESSION_SECRET: 'rahasia-tes' });
  server = app.server;
  await new Promise(r => server.listen(0, r));
  base = `http://127.0.0.1:${server.address().port}`;
});
test.after(() => server.close());

const call = async (p, method = 'GET', body, auth = true) => {
  const r = await fetch(base + p, { method, headers: { 'Content-Type': 'application/json', ...(auth && token ? { Authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { s: r.status, j: await r.json().catch(() => ({})) };
};
const outbox = () => { const d = path.join(dir, 'outbox'); return fs.existsSync(d) ? fs.readdirSync(d).map(f => fs.readFileSync(path.join(d, f), 'utf8')) : []; };
const wait = ms => new Promise(r => setTimeout(r, ms));

test('data publik berisi tiga paket bawaan dengan teks harga otomatis', async () => {
  const { s, j } = await call('/api/packages');
  assert.equal(s, 200);
  assert.equal(j.packages.length, 3);
  assert.equal(j.packages[1].p, 'Rp 500rb – 1,5jt');
  assert.equal(j.extras.major.d, 'Rp 200.000 – 500.000 per revisi');
});

test('endpoint admin butuh token dan login salah ditolak', async () => {
  assert.equal((await call('/api/admin/data')).s, 401);
  assert.equal((await call('/api/admin/login', 'POST', { username: 'admin', password: 'salah' })).s, 401);
  const ok = await call('/api/admin/login', 'POST', { username: 'admin', password: 'tes12345' });
  assert.equal(ok.s, 200);
  token = ok.j.token;
  assert.ok(token);
  assert.equal((await call('/api/admin/data')).s, 200);
});

test('validasi menolak harga terendah di atas harga tertinggi', async () => {
  const d = (await call('/api/admin/data')).j;
  d.packages[0].lo = 900000;
  const r = await call('/api/admin/data', 'PUT', d);
  assert.equal(r.s, 400);
  assert.match(r.j.error, /tidak boleh melebihi/);
});

test('admin mengubah harga, data publik ikut berubah, dan email perubahan terkirim', async () => {
  const d = (await call('/api/admin/data')).j;
  d.packages[0].lo = 150000;
  d.adminEmail = 'admin@contoh.id';
  assert.equal((await call('/api/admin/data', 'PUT', d)).s, 200);
  const pub = (await call('/api/packages', 'GET', null, false)).j;
  assert.equal(pub.packages[0].p, 'Rp 150rb – 500rb');
  await wait(150);
  assert.ok(outbox().some(t => t.includes('Harga website diperbarui') && t.includes('Basic: Rp 150.000 – 500.000')));
});

test('pesan masuk dihitung di server, disimpan, dan dikirim lewat email', async () => {
  const r = await call('/api/inquiries', 'POST', { source: 'estimate', items: [{ c: 'WB-01', q: 2 }], extras: { src: 1, minor: 1 } }, false);
  assert.equal(r.s, 201);
  await wait(150);
  assert.ok(outbox().some(t => t.includes('Rp 440.000 – 1.350.000')));
  const list = (await call('/api/admin/inquiries')).j;
  assert.deepEqual(list[0].total, [440000, 1350000]);
});

test('permintaan tidak valid ditolak', async () => {
  assert.equal((await call('/api/inquiries', 'POST', { source: 'estimate', items: [{ c: 'XX-99', q: 1 }] }, false)).s, 400);
  assert.equal((await call('/api/inquiries', 'POST', { source: 'estimate', items: [] }, false)).s, 400);
  assert.equal((await call('/api/inquiries', 'POST', { source: 'lain' }, false)).s, 400);
});

test('email tes dan halaman admin dapat dipakai', async () => {
  assert.equal((await call('/api/admin/test-email', 'POST')).s, 200);
  const r = await fetch(base + '/admin/');
  assert.equal(r.status, 200);
  assert.match(await r.text(), /admin\.js/);
});
