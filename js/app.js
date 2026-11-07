import {
  ROLES, loadData, weakAgainst, strongAgainst, searchKey,
  avatarHtml, escapeHtml, enableAvatarFallback,
} from './data.js';

const state = {
  heroes: [],
  byId: new Map(),
  role: 'all',
  query: '',
  usingDraft: false,
};

const els = {
  grid: document.getElementById('grid'),
  status: document.getElementById('status'),
  roleNav: document.getElementById('role-nav'),
  q: document.getElementById('q'),
  dialog: document.getElementById('detail'),
  body: document.getElementById('detail-body'),
  toast: document.getElementById('toast'),
};

init();

async function init() {
  enableAvatarFallback();
  state.usingDraft = new URLSearchParams(location.search).has('draft');

  try {
    const data = await loadData({ useDraft: state.usingDraft });
    state.heroes = data.heroes;
    state.byId = new Map(data.heroes.map((h) => [h.id, h]));
  } catch (err) {
    showLoadError(err);
    return;
  }

  renderRoleNav();
  renderGrid();
  bindEvents();
  openFromHash();
}

// ---------- Daftar hero ----------

function renderRoleNav() {
  const options = [['all', 'Semua'], ...ROLES.map((r) => [r, r])];
  els.roleNav.innerHTML = options.map(([value, label]) => (
    `<button type="button" class="role-chip" data-role="${value}" aria-pressed="${value === state.role}">${label}</button>`
  )).join('');
}

function renderGrid() {
  const key = searchKey(state.query);
  const matches = (h) => !key || searchKey(h.name).includes(key);
  const roles = state.role === 'all' ? [...ROLES, ''] : [state.role];

  const sections = roles.map((role) => {
    const list = state.heroes.filter((h) => (role ? h.roles.includes(role) : h.roles.length === 0) && matches(h));
    if (!list.length) return '';
    const title = role || 'Belum ada role';
    const sid = `role-${role ? role.toLowerCase() : 'none'}`;
    return `
      <section class="role-group" aria-labelledby="${sid}">
        <h2 id="${sid}">${title} <span class="count">${list.length}</span></h2>
        <ul class="hero-grid">
          ${list.map(tileHtml).join('')}
        </ul>
      </section>`;
  }).join('');

  const banner = state.usingDraft
    ? '<p class="draft-banner">Kamu sedang melihat draf dari Editor di browser ini. <a href="./">Lihat data yang sudah terbit</a></p>'
    : '';

  if (sections) {
    els.grid.innerHTML = banner + sections;
  } else {
    const q = escapeHtml(state.query.trim());
    const where = state.role === 'all' ? '' : ` di role ${state.role}`;
    els.grid.innerHTML = `${banner}<div class="empty">
      <p>Tidak ada hero bernama “${q}”${where}.</p>
      <button type="button" class="btn ghost" data-action="reset-filter">Tampilkan semua hero</button>
    </div>`;
  }
}

function tileHtml(hero) {
  return `<li><a class="hero-tile" href="#${hero.id}">${avatarHtml(hero)}<span class="hero-name">${escapeHtml(hero.name)}</span></a></li>`;
}

// ---------- Detail hero ----------

function openFromHash() {
  const id = decodeURIComponent(location.hash.slice(1));
  const hero = state.byId.get(id);
  if (!hero) {
    if (els.dialog.open) els.dialog.close();
    return;
  }
  renderDetail(hero);
  if (!els.dialog.open) els.dialog.showModal();
  els.body.scrollTop = 0;
  els.dialog.querySelector('.close')?.focus();
}

function renderDetail(hero) {
  const strong = strongAgainst(hero, state.heroes);
  const weak = weakAgainst(hero);
  const name = escapeHtml(hero.name);
  const roles = hero.roles.length ? hero.roles.join(', ') : 'Belum ada role';

  els.body.innerHTML = `
    <div class="detail-head">
      ${avatarHtml(hero, 'xl')}
      <div class="detail-title">
        <h2 id="detail-name">${name}</h2>
        <p class="detail-roles">${roles}</p>
      </div>
      <button type="button" class="icon-btn close" data-action="close" aria-label="Tutup">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>
      </button>
    </div>

    <div class="versus">
      ${sideHtml({
        tone: 'blue',
        title: 'Kuat melawan',
        hint: `Hero yang biasanya kesulitan menghadapi ${name}.`,
        list: strong,
        hero,
      })}
      ${sideHtml({
        tone: 'red',
        title: 'Lemah melawan',
        hint: `Kalau musuh memakai ${name}, pick salah satu hero ini.`,
        list: weak,
        hero,
      })}
    </div>

    <div class="detail-foot">
      <button type="button" class="btn" data-action="copy-link">Salin tautan</button>
      <a class="btn ghost" href="editor.html#${hero.id}">Ubah di Editor</a>
    </div>`;
}

function sideHtml({ tone, title, hint, list, hero }) {
  const items = list
    .map((entry) => ({ entry, other: state.byId.get(entry.id) }))
    .filter(({ other }) => other)
    .sort((a, b) => a.other.name.localeCompare(b.other.name, 'id'))
    .map(({ entry, other }) => `
      <li>
        <a class="matchup" href="#${other.id}">
          ${avatarHtml(other, 'sm')}
          <span class="matchup-text">
            <span class="matchup-name">${escapeHtml(other.name)}</span>
            ${entry.why ? `<span class="matchup-why">${escapeHtml(entry.why)}</span>` : ''}
          </span>
        </a>
      </li>`)
    .join('');

  const body = items
    ? `<ul class="matchups">${items}</ul>`
    : `<p class="side-empty">Belum ada data. <a href="editor.html#${hero.id}">Isi di Editor</a></p>`;

  return `
    <section class="side side-${tone}" aria-label="${title}">
      <h3>${title} <span class="count">${list.length}</span></h3>
      <p class="side-hint">${hint}</p>
      ${body}
    </section>`;
}

function closeDetail() {
  if (els.dialog.open) els.dialog.close();
}

// ---------- Event ----------

function bindEvents() {
  window.addEventListener('hashchange', openFromHash);

  els.q.addEventListener('input', () => {
    state.query = els.q.value;
    renderGrid();
  });

  els.roleNav.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-role]');
    if (!btn) return;
    state.role = btn.dataset.role;
    els.roleNav.querySelectorAll('[data-role]').forEach((b) => {
      b.setAttribute('aria-pressed', String(b.dataset.role === state.role));
    });
    renderGrid();
  });

  els.grid.addEventListener('click', (e) => {
    if (!e.target.closest('[data-action="reset-filter"]')) return;
    state.query = '';
    state.role = 'all';
    els.q.value = '';
    renderRoleNav();
    renderGrid();
    els.q.focus();
  });

  // Tekan "/" di mana saja untuk langsung mengetik nama hero.
  document.addEventListener('keydown', (e) => {
    if (e.key !== '/' || els.dialog.open) return;
    if (e.target.closest('input, textarea, select, [contenteditable]')) return;
    e.preventDefault();
    els.q.focus();
  });

  els.dialog.addEventListener('click', (e) => {
    if (e.target === els.dialog) closeDetail(); // klik di luar panel
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (action === 'close') closeDetail();
    if (action === 'copy-link') copyLink();
  });

  // Saat panel ditutup (tombol, Esc, atau klik luar), hapus #hero dari URL.
  els.dialog.addEventListener('close', () => {
    if (location.hash) history.replaceState(null, '', location.pathname + location.search);
  });
}

async function copyLink() {
  try {
    await navigator.clipboard.writeText(location.href);
    showToast('Tautan disalin');
  } catch {
    showToast('Tautan tidak bisa disalin otomatis. Salin dari address bar.');
  }
}

let toastTimer;
function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => els.toast.classList.remove('show'), 2200);
}

function showLoadError(err) {
  const fromFile = location.protocol === 'file:';
  els.grid.innerHTML = `<div class="empty">
    <p>Data hero tidak bisa dimuat.</p>
    <p class="muted">${fromFile
      ? 'Halaman ini dibuka langsung dari folder. Jalankan lewat server lokal, misalnya <code>python -m http.server</code>, lalu buka <code>http://localhost:8000</code>.'
      : escapeHtml(err.message)}</p>
  </div>`;
}
