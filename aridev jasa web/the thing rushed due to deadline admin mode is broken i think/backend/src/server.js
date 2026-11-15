
'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = path.resolve(__dirname, '..');
try { for (const l of fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split(/\r?\n/)) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^(["'])(.*)\1$/, '$2'); } } catch {}
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8' };

const SEED = () => ({
  wa: '', adminEmail: '', notify: { estimate: true, chat: true, consult: true, changes: true },
  extras: { src: { pct: 0.3 }, minor: { lo: 50000, hi: 50000 }, major: { lo: 200000, hi: 500000 } },
  packages: [
    { c: 'WB-01', n: 'Basic', tag: 'Untuk usaha kecil dan personal', r: '2× minor', lo: 100000, hi: 500000, s: ['Website 1 halaman (landing page)', 'Desain dari template pilihan, responsif', 'Tombol WhatsApp dan formulir kontak'], o: 'Website online siap pakai dan panduan singkat penggunaan', src: 0 },
    { c: 'WB-02', n: 'Business', tag: 'Untuk bisnis yang mulai berkembang', r: '3× minor', lo: 500000, hi: 1500000, s: ['Website company profile 3–5 halaman', 'Desain custom sesuai brand Anda', 'SEO dasar dan optimasi kecepatan', 'Integrasi WhatsApp, Google Maps, dan media sosial'], o: 'Website online, source code, dan panduan mengelola konten', src: 1 },
    { c: 'WB-03', n: 'Professional', tag: 'Untuk perusahaan dan toko online', r: '5× minor', lo: 2000000, hi: 3000000, s: ['Website custom hingga 10 halaman', 'Fitur lanjutan: toko online atau sistem booking', 'Dashboard admin untuk mengelola konten', 'SEO on-page dan optimasi performa'], o: 'Website online, source code, akun admin, dan pelatihan penggunaan', src: 1 },
  ],
  inquiries: [],
});

function loadConfig(o = {}) {
  const e = { ...process.env, ...o };
  let password = e.ADMIN_PASSWORD || '';
  if (!password && !e.ADMIN_PASSWORD_HASH) {
    if (e.NODE_ENV === 'production') throw new Error('ADMIN_PASSWORD atau ADMIN_PASSWORD_HASH wajib diisi');
    password = 'ganti-password';
    console.warn('[peringatan] ADMIN_PASSWORD kosong, memakai "ganti-password" (hanya untuk pengembangan)');
  }
  return {
    port: Number(e.PORT || 3000), adminUser: e.ADMIN_USER || 'admin', password, passwordHash: e.ADMIN_PASSWORD_HASH || '',
    secret: e.SESSION_SECRET || crypto.randomBytes(32).toString('hex'), cors: e.CORS_ORIGIN || '*', trustProxy: e.TRUST_PROXY === 'true',
    dataFile: path.resolve(e.DATA_FILE || path.join(ROOT, 'data', 'store.json')), frontendDir: e.FRONTEND_DIR ? path.resolve(e.FRONTEND_DIR) : '',
    mailMode: e.MAIL_MODE || (e.SMTP_HOST ? 'smtp' : 'console'), mailFrom: e.MAIL_FROM || e.SMTP_USER || 'website@localhost', adminEmail: e.ADMIN_EMAIL || '',
    smtp: { host: e.SMTP_HOST, port: Number(e.SMTP_PORT || 587), secure: e.SMTP_SECURE === 'true', user: e.SMTP_USER, pass: e.SMTP_PASS },
  };
}

const dots = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const short = n => (n >= 1e6 ? String(+(n / 1e6).toFixed(2)).replace('.', ',') + 'jt' : String(+(n / 1e3).toFixed(1)).replace('.', ',') + 'rb');
const range = (a, b) => 'Rp ' + dots(a) + (a === b ? '' : ' – ' + dots(b));

function createStore(file, adminEmail) {
  let data;
  const persist = () => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file + '.tmp', JSON.stringify(data, null, 2)); fs.renameSync(file + '.tmp', file); };
  try { data = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { data = SEED(); if (adminEmail) data.adminEmail = adminEmail; persist(); }
  return { get: () => data, save: fn => { fn(data); persist(); } };
}

const bad = m => Object.assign(new Error(m), { status: 400 });
const num = (v, min, max, label) => { const n = Math.round(Number(v)); if (!Number.isFinite(n) || n < min || n > max) throw bad(`${label} harus berupa angka ${min} sampai ${max}`); return n; };
const txt = (v, max, label, req = true) => { const s = String(v ?? '').trim(); if (req && !s) throw bad(`${label} wajib diisi`); if (s.length > max) throw bad(`${label} maksimal ${max} karakter`); return s; };

function cleanData(b) {
  if (!b || typeof b !== 'object') throw bad('Data tidak valid');
  if (!Array.isArray(b.packages) || b.packages.length < 1 || b.packages.length > 12) throw bad('Jumlah paket harus 1 sampai 12');
  const seen = new Set();
  const packages = b.packages.map((p, i) => {
    const c = txt(p?.c, 12, `Kode paket #${i + 1}`);
    if (!/^[A-Za-z0-9-]{2,12}$/.test(c)) throw bad(`Kode paket “${c}” hanya boleh huruf, angka, dan tanda minus (2 sampai 12 karakter)`);
    if (seen.has(c)) throw bad(`Kode paket “${c}” dipakai dua kali`);
    seen.add(c);
    const lo = num(p.lo, 0, 1e9, `Harga terendah ${c}`), hi = num(p.hi, 0, 1e9, `Harga tertinggi ${c}`);
    if (lo > hi) throw bad(`Harga terendah ${c} tidak boleh melebihi harga tertinggi`);
    const s = (Array.isArray(p.s) ? p.s : []).map(x => String(x).trim()).filter(Boolean);
    if (s.length < 1 || s.length > 8) throw bad(`Lingkup kerja ${c} harus 1 sampai 8 baris`);
    s.forEach(x => { if (x.length > 120) throw bad(`Baris lingkup kerja ${c} maksimal 120 karakter`); });
    return { c, n: txt(p.n, 30, `Nama ${c}`), tag: txt(p.tag, 80, `Tagline ${c}`, false), r: txt(p.r, 20, `Revisi ${c}`, false), lo, hi, s, o: txt(p.o, 200, `Hasil akhir ${c}`, false), src: p.src ? 1 : 0 };
  });
  const e = b.extras || {}; const pct = Number(e.src?.pct);
  if (!(pct >= 0 && pct <= 1)) throw bad('Persentase source code harus 0 sampai 100');
  const rg = (x, label) => { const lo = num(x?.lo, 0, 1e9, `${label} terendah`), hi = num(x?.hi, 0, 1e9, `${label} tertinggi`); if (lo > hi) throw bad(`${label}: harga terendah melebihi harga tertinggi`); return { lo, hi }; };
  const wa = String(b.wa ?? '').replace(/[\s+()-]/g, '');
  if (!/^\d{0,20}$/.test(wa)) throw bad('Nomor WhatsApp hanya boleh berisi angka');
  const adminEmail = String(b.adminEmail ?? '').trim();
  if (adminEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) throw bad('Format email tidak valid');
  const n = b.notify || {};
  return { wa, adminEmail, notify: { estimate: !!n.estimate, chat: !!n.chat, consult: !!n.consult, changes: !!n.changes },
    extras: { src: { pct: Math.round(pct * 1000) / 1000 }, minor: rg(e.minor, 'Revisi minor'), major: rg(e.major, 'Revisi major') }, packages };
}

const adminData = d => ({ wa: d.wa, adminEmail: d.adminEmail, notify: d.notify, extras: d.extras, packages: d.packages });
const publicData = d => ({
  wa: d.wa, packages: d.packages.map(p => ({ ...p, p: `Rp ${short(p.lo)} – ${short(p.hi)}` })),
  extras: {
    src: { n: 'Butuh source code', d: `+${Math.round(d.extras.src.pct * 100)}% untuk paket yang belum termasuk source code`, pct: d.extras.src.pct },
    minor: { n: 'Revisi tambahan minor', d: `${range(d.extras.minor.lo, d.extras.minor.hi)} per revisi`, ...d.extras.minor },
    major: { n: 'Revisi tambahan major', d: `${range(d.extras.major.lo, d.extras.major.hi)} per revisi`, ...d.extras.major },
  },
});

function cleanInquiry(b, d) {
  const source = ['estimate', 'chat', 'consult'].includes(b?.source) ? b.source : null;
  if (!source) throw bad('Jenis pesan tidak valid');
  const items = (Array.isArray(b.items) ? b.items : []).slice(0, 12).map(i => {
    const p = d.packages.find(x => x.c === i?.c);
    if (!p) throw bad('Paket tidak dikenal');
    return { c: p.c, q: num(i.q ?? 1, 1, 99, 'Jumlah proyek') };
  });
  if (source !== 'consult' && !items.length) throw bad('Pilih minimal satu paket');
  const e = b.extras || {};
  return { source, items, ex: { src: e.src ? 1 : 0, minor: num(e.minor ?? 0, 0, 99, 'Revisi minor'), major: num(e.major ?? 0, 0, 99, 'Revisi major') } };
}

function estimate(d, items, ex) {
  let lo = 0, hi = 0, sLo = 0, sHi = 0;
  for (const { c, q } of items) {
    const p = d.packages.find(x => x.c === c);
    lo += p.lo * q; hi += p.hi * q;
    if (!p.src) { sLo += p.lo * q * d.extras.src.pct; sHi += p.hi * q * d.extras.src.pct; }
  }
  const s = ex.src ? [sLo, sHi] : [0, 0], { minor, major } = d.extras;
  return [lo + s[0] + ex.minor * minor.lo + ex.major * major.lo, hi + s[1] + ex.minor * minor.hi + ex.major * major.hi].map(Math.round);
}

const b64 = v => Buffer.from(v).toString('base64url');
const hmac = (secret, body) => crypto.createHmac('sha256', secret).update(body).digest('base64url');
const safeEq = (a, b) => crypto.timingSafeEqual(crypto.createHash('sha256').update(String(a)).digest(), crypto.createHash('sha256').update(String(b)).digest());
const sign = (cfg, payload) => { const body = b64(JSON.stringify(payload)); return body + '.' + hmac(cfg.secret, body); };
function verify(cfg, token) {
  const [body, sig] = String(token || '').split('.');
  if (!body || !sig || !safeEq(sig, hmac(cfg.secret, body))) return null;
  try { const p = JSON.parse(Buffer.from(body, 'base64url')); return p.exp > Date.now() ? p : null; } catch { return null; }
}
function checkLogin(cfg, user, pass) {
  const okUser = safeEq(user, cfg.adminUser);
  let okPass;
  if (cfg.passwordHash) {
    const [, salt, hash] = cfg.passwordHash.split('$');
    okPass = !!salt && !!hash && safeEq(crypto.scryptSync(pass, Buffer.from(salt, 'hex'), 32).toString('hex'), hash);
  } else okPass = safeEq(pass, cfg.password);
  return okUser && okPass;
}

const hits = new Map();
setInterval(() => hits.clear(), 3600e3).unref();
function limited(key, max, ms) {
  const now = Date.now(), arr = (hits.get(key) || []).filter(t => now - t < ms);
  arr.push(now); hits.set(key, arr);
  return arr.length > max;
}

function createMailer(cfg) {
  let tx;
  return async (to, subject, text) => {
    if (!to || cfg.mailMode === 'off') return false;
    if (cfg.mailMode === 'console') {
      const dir = path.join(path.dirname(cfg.dataFile), 'outbox');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, `${Date.now()}-${crypto.randomBytes(3).toString('hex')}.txt`), `To: ${to}\nSubject: ${subject}\n\n${text}\n`);
      return true;
    }
    tx ||= require('nodemailer').createTransport({ host: cfg.smtp.host, port: cfg.smtp.port, secure: cfg.smtp.secure, auth: cfg.smtp.user ? { user: cfg.smtp.user, pass: cfg.smtp.pass } : undefined });
    await tx.sendMail({ from: cfg.mailFrom, to, subject, text });
    return true;
  };
}

const LABEL = { estimate: 'mengirim estimasi via WhatsApp', chat: 'menekan tombol chat sebuah paket', consult: 'menekan tombol konsultasi gratis' };
function inquiryMail(inq, d) {
  const name = c => d.packages.find(p => p.c === c)?.n || c;
  const L = [`Ada pengunjung yang ${LABEL[inq.source]}.`, '', 'Waktu    : ' + new Date(inq.at).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }) + ' WIB'];
  if (inq.items.length) { L.push('Paket    :'); inq.items.forEach(i => L.push(`  - ${name(i.c)} x${i.q}`)); }
  const ex = [inq.ex.src && 'butuh source code', inq.ex.minor && `${inq.ex.minor}x revisi minor`, inq.ex.major && `${inq.ex.major}x revisi major`].filter(Boolean);
  if (ex.length) L.push('Tambahan : ' + ex.join(', '));
  if (inq.total) L.push('Estimasi : ' + range(...inq.total));
  L.push('', 'Pengunjung akan menghubungi Anda lewat WhatsApp. Lihat semua pesan di panel admin (/admin/).');
  return { subject: `[Website] ${inq.source === 'consult' ? 'Permintaan konsultasi' : 'Pesanan baru'}${inq.total ? ' · ' + range(...inq.total) : ''}`, text: L.join('\n') };
}

const httpErr = (status, message) => Object.assign(new Error(message), { status });
const readBody = req => new Promise((resolve, reject) => {
  let n = 0; const chunks = [];
  req.on('data', c => { n += c.length; if (n > 1e5) { reject(httpErr(413, 'Data terlalu besar')); req.destroy(); } else chunks.push(c); });
  req.on('end', () => { try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}); } catch { reject(httpErr(400, 'JSON tidak valid')); } });
  req.on('error', reject);
});

function serveFile(res, base, rel, admin) {
  let f;
  try { f = path.normalize(path.join(base, decodeURIComponent(rel))); } catch { return false; }
  if (f !== base && !f.startsWith(base + path.sep)) return false;
  try { if (fs.statSync(f).isDirectory()) f = path.join(f, 'index.html'); if (!fs.statSync(f).isFile()) return false; } catch { return false; }
  const h = { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff' };
  if (admin) Object.assign(h, { 'X-Frame-Options': 'DENY', 'Content-Security-Policy': "default-src 'self'; frame-ancestors 'none'", 'Cache-Control': 'no-store' });
  res.writeHead(200, h); fs.createReadStream(f).pipe(res);
  return true;
}

function createApp(overrides = {}) {
  const cfg = loadConfig(overrides);
  const store = createStore(cfg.dataFile, cfg.adminEmail);
  const mail = createMailer(cfg);
  const adminDir = path.join(ROOT, 'public', 'admin');
  const ip = req => (cfg.trustProxy && req.headers['x-forwarded-for']?.split(',')[0].trim()) || req.socket.remoteAddress || '?';
  const notify = (to, subject, text) => mail(to, subject, text).catch(e => console.error('[email gagal]', e.message));

  const json = (res, status, body) => {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Access-Control-Allow-Origin': cfg.cors, Vary: 'Origin' });
    res.end(JSON.stringify(body));
  };

  async function handle(req, res) {
    const p = new URL(req.url, 'http://x').pathname, m = req.method;
    if (m === 'OPTIONS') { res.writeHead(204, { 'Access-Control-Allow-Origin': cfg.cors, 'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Max-Age': '600' }); return res.end(); }
    const d = store.get();

    // Homepage route: backend status
    if (p === '/' && m === 'GET') {
      return json(res, 200, {
        status: 'OK',
        message: 'ARIDEV Backend is running',
        endpoints: {
          health: '/api/health',
          packages: '/api/packages',
          admin: '/admin/'
        }
      });
    }

    if (p === '/api/health') return json(res, 200, { ok: true });
    if (p === '/api/packages' && m === 'GET') return json(res, 200, publicData(d));
    if (p === '/api/inquiries' && m === 'POST') {
      if (limited('inq:' + ip(req), 30, 3600e3)) return json(res, 429, { error: 'Terlalu banyak permintaan' });
      const { source, items, ex } = cleanInquiry(await readBody(req), d);
      const inq = { id: crypto.randomUUID(), at: new Date().toISOString(), source, items, ex, total: items.length ? estimate(d, items, ex) : null };
      store.save(x => { x.inquiries.unshift(inq); x.inquiries.length = Math.min(x.inquiries.length, 500); });
      if (d.notify[source]) { const mm = inquiryMail(inq, d); notify(d.adminEmail || cfg.adminEmail, mm.subject, mm.text); }
      return json(res, 201, { ok: true, id: inq.id });
    }
    if (p === '/api/admin/login' && m === 'POST') {
      if (limited('login:' + ip(req), 8, 15 * 60e3)) return json(res, 429, { error: 'Terlalu banyak percobaan masuk. Coba lagi nanti.' });
      const b = await readBody(req);
      if (!checkLogin(cfg, String(b.username || ''), String(b.password || ''))) return json(res, 401, { error: 'Nama pengguna atau kata sandi salah' });
      return json(res, 200, { token: sign(cfg, { u: cfg.adminUser, exp: Date.now() + 8 * 3600e3 }) });
    }
    if (p.startsWith('/api/admin/')) {
      const user = verify(cfg, (req.headers.authorization || '').replace(/^Bearer\s+/i, ''));
      if (!user) return json(res, 401, { error: 'Belum masuk atau sesi berakhir' });
      if (p === '/api/admin/data' && m === 'GET') return json(res, 200, adminData(d));
      if (p === '/api/admin/data' && m === 'PUT') {
        const clean = cleanData(await readBody(req));
        store.save(x => Object.assign(x, clean));
        if (clean.notify.changes) notify(clean.adminEmail || cfg.adminEmail, 'Harga website diperbarui', ['Data harga diperbarui oleh ' + user.u + '.', '', ...clean.packages.map(x => `- ${x.n}: ${range(x.lo, x.hi)}`), '', `Source code: +${Math.round(clean.extras.src.pct * 100)}%`, `Revisi minor: ${range(clean.extras.minor.lo, clean.extras.minor.hi)}`, `Revisi major: ${range(clean.extras.major.lo, clean.extras.major.hi)}`].join('\n'));
        return json(res, 200, adminData(store.get()));
      }
      if (p === '/api/admin/inquiries' && m === 'GET') return json(res, 200, d.inquiries.slice(0, 100));
      if (p === '/api/admin/test-email' && m === 'POST') {
        const to = d.adminEmail || cfg.adminEmail;
        if (!to) return json(res, 400, { error: 'Isi email penerima pada tab Pengaturan lalu simpan dulu' });
        try { await mail(to, 'Email tes dari panel admin', 'Jika Anda membaca ini, notifikasi email sudah berfungsi.'); return json(res, 200, { ok: true }); } catch (e) { return json(res, 502, { error: 'Gagal mengirim email: ' + e.message }); }
      }
      return json(res, 404, { error: 'Tidak ditemukan' });
    }
    if (p === '/admin') { res.writeHead(302, { Location: '/admin/' }); return res.end(); }
    if (p.startsWith('/admin/') && serveFile(res, adminDir, p.slice(7) || 'index.html', true)) return;
    if (cfg.frontendDir && m === 'GET' && serveFile(res, cfg.frontendDir, p === '/' ? 'index.html' : p.slice(1), false)) return;
    return json(res, 404, { error: 'Tidak ditemukan' });
  }

  const server = http.createServer((req, res) => handle(req, res).catch(err => {
    if (!err.status) console.error(err);
    if (!res.headersSent) json(res, err.status || 500, { error: err.status ? err.message : 'Terjadi kesalahan di server' }); else res.end();
  }));
  return { cfg, server, store };
}

module.exports = { createApp };
if (require.main === module) {
  const { cfg, server } = createApp();
  server.listen(cfg.port, () => console.log(`Backend berjalan di http://localhost:${cfg.port} (panel admin: /admin/, email: ${cfg.mailMode})`));
}
