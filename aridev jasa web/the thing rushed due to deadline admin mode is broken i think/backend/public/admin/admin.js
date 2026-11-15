const $ = s => document.querySelector(s);
const h = (t, a = {}, ...k) => {
  const e = document.createElement(t);
  for (const [n, v] of Object.entries(a)) {
    if (n === 'class') e.className = v;
    else if (n.startsWith('on')) e.addEventListener(n.slice(2), v);
    else if (v === true) e.setAttribute(n, '');
    else if (v !== false && v != null) e.setAttribute(n, v);
  }
  k.flat().forEach(c => e.append(c && c.nodeType ? c : document.createTextNode(c == null ? '' : c)));
  return e;
};
const app = $('#app');
const rp = n => 'Rp ' + String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
let token = sessionStorage.getItem('tk') || '', D = null, tab = 'harga', msg = { t: '', k: 'ok' };

async function api(path, method = 'GET', body) {
  const r = await fetch('/api/admin/' + path, { method, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (r.status === 401 && path !== 'login') { logout(); throw new Error('Sesi berakhir, silakan masuk lagi'); }
  if (!r.ok) throw new Error(j.error || 'Terjadi kesalahan');
  return j;
}
function logout() { token = ''; sessionStorage.removeItem('tk'); D = null; draw(); }
function say(t, k = 'ok') { msg = { t, k }; const m = $('#msg'); if (m) { m.textContent = t; m.className = 'msg ' + k; } }

function login(err = '') {
  app.replaceChildren(h('div', { class: 'login card' },
    h('h1', {}, 'Masuk Admin'), h('p', { class: 'hint' }, 'Aridev Studio · pengelola harga website'),
    h('label', { class: 'f' }, 'Nama pengguna', h('input', { id: 'u', autocomplete: 'username' })),
    h('label', { class: 'f' }, 'Kata sandi', h('input', { id: 'pw', type: 'password', autocomplete: 'current-password' })),
    h('button', { class: 'btn p', onclick: doLogin }, 'Masuk'),
    h('p', { class: 'msg err', id: 'msg' }, err)));
  $('#pw').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
}
async function doLogin() {
  try { const j = await api('login', 'POST', { username: $('#u').value, password: $('#pw').value }); token = j.token; sessionStorage.setItem('tk', token); await load(); }
  catch (e) { login(e.message); }
}
async function load() { D = await api('data'); draw(); }

const field = (label, obj, key, type = 'text', cls = '') =>
  h('label', { class: 'f ' + cls }, label, h('input', { type, value: obj[key] ?? '', oninput: e => { obj[key] = type === 'number' ? Number(e.target.value) : e.target.value; } }));
const check = (label, obj, key) =>
  h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: !!obj[key], onchange: e => { obj[key] = e.target.checked; } }), label);

function mv(i, d) { const j = i + d; if (j < 0 || j >= D.packages.length) return; [D.packages[i], D.packages[j]] = [D.packages[j], D.packages[i]]; draw(); }
function addPkg() { D.packages.push({ c: 'WB-' + String(D.packages.length + 1).padStart(2, '0'), n: '', tag: '', r: '3× minor', lo: 0, hi: 0, s: [''], o: '', src: 0 }); draw(); }

function pkgCard(p, i) {
  return h('section', { class: 'card' },
    h('div', { class: 'head' }, h('b', {}, (p.n || 'Paket baru') + ' · ' + p.c), h('span', { class: 'sp' }),
      h('button', { class: 'btn sm', onclick: () => mv(i, -1) }, '↑'), h('button', { class: 'btn sm', onclick: () => mv(i, 1) }, '↓'),
      h('button', { class: 'btn sm danger', onclick: () => { if (confirm('Hapus paket ini?')) { D.packages.splice(i, 1); draw(); } } }, 'Hapus')),
    h('div', { class: 'grid' }, field('Kode paket', p, 'c'), field('Nama', p, 'n'), field('Tagline', p, 'tag', 'text', 'wide'), field('Jatah revisi', p, 'r'),
      field('Harga terendah (Rp)', p, 'lo', 'number'), field('Harga tertinggi (Rp)', p, 'hi', 'number')),
    h('label', { class: 'f' }, 'Lingkup kerja (satu butir per baris)', h('textarea', { rows: 4, oninput: e => { p.s = e.target.value.split('\n'); } }, p.s.join('\n'))),
    field('Hasil akhir yang diterima', p, 'o'),
    h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: !!p.src, onchange: e => { p.src = e.target.checked ? 1 : 0; } }), 'Source code termasuk'));
}
const hargaView = () => h('div', {}, h('p', { class: 'hint' }, 'Teks harga di website dibuat otomatis dari harga terendah dan tertinggi. Urutan kartu mengikuti urutan di sini.'),
  ...D.packages.map(pkgCard), h('button', { class: 'btn', onclick: addPkg }, '+ Tambah paket'));
const biayaView = () => h('div', {},
  h('section', { class: 'card' }, h('h2', {}, 'Source code'),
    h('label', { class: 'f' }, 'Tambahan untuk paket yang belum termasuk source code (%)', h('input', { type: 'number', value: Math.round(D.extras.src.pct * 1000) / 10, oninput: e => { D.extras.src.pct = Number(e.target.value) / 100; } }))),
  h('section', { class: 'card' }, h('h2', {}, 'Revisi tambahan minor (per revisi)'), h('div', { class: 'grid' }, field('Harga terendah (Rp)', D.extras.minor, 'lo', 'number'), field('Harga tertinggi (Rp)', D.extras.minor, 'hi', 'number'))),
  h('section', { class: 'card' }, h('h2', {}, 'Revisi tambahan major (per revisi)'), h('div', { class: 'grid' }, field('Harga terendah (Rp)', D.extras.major, 'lo', 'number'), field('Harga tertinggi (Rp)', D.extras.major, 'hi', 'number'))));
const aturView = () => h('div', {},
  h('section', { class: 'card' }, h('h2', {}, 'Kontak'),
    field('Nomor WhatsApp studio (format internasional tanpa +, contoh 6281234567890)', D, 'wa'),
    field('Email penerima notifikasi', D, 'adminEmail', 'email')),
  h('section', { class: 'card' }, h('h2', {}, 'Kirim email notifikasi saat'),
    check('Pengunjung mengirim estimasi via WhatsApp', D.notify, 'estimate'), check('Pengunjung menekan tombol chat sebuah paket', D.notify, 'chat'),
    check('Pengunjung menekan tombol konsultasi gratis', D.notify, 'consult'), check('Harga atau paket diperbarui lewat panel ini', D.notify, 'changes'),
    h('p', { class: 'hint' }, 'Simpan dulu, lalu coba kirim email tes untuk memastikan pengaturan SMTP di server sudah benar.'),
    h('button', { class: 'btn', onclick: async () => { try { await api('test-email', 'POST'); say('Email tes terkirim. Periksa kotak masuk Anda.'); } catch (e) { say(e.message, 'err'); } } }, 'Kirim email tes')));
function pesanView() {
  const box = h('div', {}, h('p', { class: 'hint' }, 'Memuat...'));
  const jenis = { estimate: 'Kirim estimasi', chat: 'Chat paket', consult: 'Konsultasi gratis' };
  api('inquiries').then(j => box.replaceChildren(j.length
    ? h('table', {}, h('tr', {}, ...['Waktu', 'Jenis', 'Paket', 'Estimasi'].map(x => h('th', {}, x))),
      ...j.map(q => h('tr', {}, h('td', {}, new Date(q.at).toLocaleString('id-ID')), h('td', {}, jenis[q.source]), h('td', {}, q.items.map(i => `${i.c} ×${i.q}`).join(', ') || '-'), h('td', {}, q.total ? rp(q.total[0]) + ' – ' + rp(q.total[1]) : '-'))))
    : h('p', { class: 'hint' }, 'Belum ada pesan masuk.'))).catch(e => box.replaceChildren(h('p', { class: 'msg err' }, e.message)));
  return box;
}
async function save() {
  try { D = await api('data', 'PUT', D); say('Tersimpan. Website publik langsung memakai data terbaru.'); draw(); }
  catch (e) { say(e.message, 'err'); }
}
function draw() {
  if (!token) return login();
  if (!D) return load().catch(e => login(e.message));
  const tabs = [['harga', 'Paket dan Harga'], ['biaya', 'Biaya Tambahan'], ['atur', 'Pengaturan'], ['pesan', 'Pesan Masuk']];
  const view = { harga: hargaView, biaya: biayaView, atur: aturView, pesan: pesanView }[tab]();
  app.replaceChildren(
    h('div', { class: 'wrap' }, h('div', { class: 'top' }, h('h1', {}, 'Admin · Harga Website'), h('span', { class: 'sp' }), h('button', { class: 'btn sm', onclick: logout }, 'Keluar')),
      h('div', { class: 'tabs' }, ...tabs.map(([k, l]) => h('button', { class: 'btn' + (tab === k ? ' on' : ''), onclick: () => { tab = k; draw(); } }, l))), view),
    tab === 'pesan' ? '' : h('div', { class: 'bar' }, h('span', { id: 'msg', class: 'msg ' + msg.k }, msg.t), h('button', { class: 'btn p', onclick: save }, 'Simpan perubahan')));
}
draw();
