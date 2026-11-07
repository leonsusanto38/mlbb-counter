import {
  ROLES, LANES, loadData, weakAgainst, strongAgainst, searchKey, slugify,
  avatarHtml, escapeHtml, enableAvatarFallback,
} from './data.js';

// Cara pengelompokan hero. `key` = nama field di heroes.json.
const GROUPS = {
  role: { label: 'Role', key: 'roles', values: ROLES, none: 'Belum ada role' },
  lane: { label: 'Lane', key: 'lanes', values: LANES, none: 'Belum ada lane' },
};

const state = {
  heroes: [],
  byId: new Map(),
  groupBy: new URLSearchParams(location.search).get('by') === 'lane' ? 'lane' : 'role',
  filter: 'all',
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
  const group = GROUPS[state.groupBy];
  const switcher = Object.entries(GROUPS).map(([value, g]) => (
    `<button type="button" data-group="${value}" aria-pressed="${value === state.groupBy}">${g.label}</button>`
  )).join('');
  const chips = [['all', 'Semua'], ...group.values.map((v) => [v, v])].map(([value, label]) => (
    `<button type="button" class="role-chip" data-filter="${value}" aria-pressed="${value === state.filter}">${label}</button>`
  )).join('');
  els.roleNav.innerHTML = `<div class="group-switch" role="group" aria-label="Kelompokkan berdasarkan">${switcher}</div>${chips}`;
}

function renderGrid() {
  const group = GROUPS[state.groupBy];
  const key = searchKey(state.query);
  const matches = (h) => !key || searchKey(h.name).includes(key);
  const values = state.filter === 'all' ? [...group.values, ''] : [state.filter];

  const sections = values.map((value) => {
    const list = state.heroes.filter((h) => (value ? h[group.key].includes(value) : h[group.key].length === 0) && matches(h));
    if (!list.length) return '';
    const title = value || group.none;
    const sid = `group-${value ? slugify(value) : 'none'}`;
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
    const where = state.filter === 'all' ? '' : ` di ${state.filter}`;
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
    const tags = [
    ...hero.roles.map((r) => `<li class="tag">${r}</li>`),
    ...hero.lanes.map((l) => `<li class="tag tag-lane">${l}</li>`),
  ].join('');

  els.body.innerHTML = `
    <div class="detail-head">
      ${avatarHtml(hero, 'xl')}
      <div class="detail-title">
        <h2 id="detail-name">${name}</h2>
        <ul class="detail-tags" aria-label="Role dan lane">${tags || '<li class="tag">Belum ada role</li>'}</ul>
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
    // Ganti cara kelompok (Role <-> Lane). Pilihan disimpan di URL (?by=lane).
    const groupBtn = e.target.closest('[data-group]');
    if (groupBtn) {
      if (groupBtn.dataset.group === state.groupBy) return;
      state.groupBy = groupBtn.dataset.group;
      state.filter = 'all';
      const params = new URLSearchParams(location.search);
      if (state.groupBy === 'lane') params.set('by', 'lane');
      else params.delete('by');
      const qs = params.toString();
      history.replaceState(null, '', `${location.pathname}${qs ? `?${qs}` : ''}${location.hash}`);
      renderRoleNav();
      renderGrid();
      return;
    }

    const chip = e.target.closest('[data-filter]');
    if (!chip) return;
    state.filter = chip.dataset.filter;
    els.roleNav.querySelectorAll('[data-filter]').forEach((b) => {
      b.setAttribute('aria-pressed', String(b.dataset.filter === state.filter));
    });
    renderGrid();
  });

  els.grid.addEventListener('click', (e) => {
    if (!e.target.closest('[data-action="reset-filter"]')) return;
    state.query = '';
    state.filter = 'all';
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
