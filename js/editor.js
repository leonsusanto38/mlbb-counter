import {
  ROLES, DATA_URL, loadData, normalize, strongAgainst, slugify, searchKey,
  avatarHtml, escapeHtml, enableAvatarFallback, readDraft, writeDraft, clearDraft,
} from './data.js';

const state = {
  data: { updated: '', heroes: [] },
  selectedId: '',
  query: '',
};

const els = {
  status: document.getElementById('ed-status'),
  q: document.getElementById('ed-q'),
  list: document.getElementById('ed-list'),
  main: document.getElementById('ed-main'),
  options: document.getElementById('hero-options'),
  formAdd: document.getElementById('form-add'),
  addName: document.getElementById('add-name'),
  fileImport: document.getElementById('file-import'),
  toast: document.getElementById('toast'),
};

init();

async function init() {
  enableAvatarFallback();
  const draft = readDraft();
  try {
    if (draft) {
      state.data = normalize(draft);
      setStatus('Memakai draf yang tersimpan di browser ini. Kalau sudah selesai, unduh heroes.json lalu commit ke repo.');
    } else {
      state.data = await loadData();
      const when = state.data.updated ? ` (diperbarui ${state.data.updated})` : '';
      setStatus(`Data dimuat dari ${DATA_URL}${when}. Setiap perubahan otomatis tersimpan sebagai draf di browser ini.`);
    }
  } catch (err) {
    setStatus(`${err.message}. Kalau halaman ini dibuka langsung dari folder, jalankan lewat server lokal (lihat README).`);
    return;
  }

  const fromHash = decodeURIComponent(location.hash.slice(1));
  state.selectedId = byId(fromHash) ? fromHash : state.data.heroes[0]?.id || '';
  renderAll();
  bindEvents();
}

// ---------- Helper data ----------

const heroes = () => state.data.heroes;
const byId = (id) => heroes().find((h) => h.id === id);
const selected = () => byId(state.selectedId);

function resolveHero(text) {
  const key = searchKey(text);
  if (!key) return null;
  const exact = heroes().find((h) => searchKey(h.name) === key || h.id === slugify(text));
  if (exact) return exact;
  const partial = heroes().filter((h) => searchKey(h.name).includes(key));
  return partial.length === 1 ? partial[0] : null;
}

function sortHeroes() {
  heroes().sort((a, b) => a.name.localeCompare(b.name, 'id'));
}

let saveTimer;
function save({ immediate = false } = {}) {
  clearTimeout(saveTimer);
  const run = () => {
    state.data.updated = new Date().toISOString().slice(0, 10);
    const ok = writeDraft(serialize());
    const time = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    setStatus(ok
      ? `Draf tersimpan pukul ${time}. Unduh heroes.json lalu commit ke repo supaya muncul di web.`
      : 'Draf tidak bisa disimpan di browser ini. Unduh heroes.json sebelum menutup halaman.');
  };
  if (immediate) run();
  else saveTimer = setTimeout(run, 400);
}

function serialize() {
  return {
    updated: state.data.updated,
    heroes: heroes().map(({ id, name, roles, image, counters }) => ({
      id,
      name,
      roles: ROLES.filter((r) => roles.includes(r)),
      image,
      counters: counters.map(({ id: cid, why }) => ({ id: cid, why })),
    })),
  };
}

// ---------- Render ----------

function renderAll() {
  renderList();
  renderOptions();
  renderMain();
}

function renderList() {
  const key = searchKey(state.query);
  const list = heroes().filter((h) => !key || searchKey(h.name).includes(key));
  els.list.innerHTML = list.length
    ? list.map((h) => `
      <li>
        <button type="button" data-id="${h.id}" aria-current="${h.id === state.selectedId}">
          ${avatarHtml(h)}
          <span class="ed-name">${escapeHtml(h.name)}</span>
          <span class="ed-badge">${h.counters.length ? `${h.counters.length} counter` : ''}</span>
        </button>
      </li>`).join('')
    : '<li class="ed-empty" style="padding:.75rem">Tidak ada hero dengan nama itu.</li>';
}

function renderOptions() {
  els.options.innerHTML = heroes().map((h) => `<option value="${escapeHtml(h.name)}"></option>`).join('');
}

function renderMain() {
  const hero = selected();
  if (!hero) {
    els.main.innerHTML = '<p class="ed-empty">Pilih hero di daftar sebelah kiri, atau tambah hero baru.</p>';
    return;
  }

  const name = escapeHtml(hero.name);
  const strong = strongAgainst(hero, heroes());

  els.main.innerHTML = `
    <div class="ed-head">
      ${avatarHtml(hero, 'xl')}
      <div>
        <h2>${name}</h2>
        <p>ID: <code>${hero.id}</code></p>
        <p><a href="index.html?draft#${hero.id}" target="_blank" rel="noopener">Lihat di web (draf)</a></p>
      </div>
    </div>

    <div class="ed-grid">
      <label class="field">
        <span>Nama</span>
        <input class="input" data-field="name" value="${name}" autocomplete="off">
      </label>
      <label class="field">
        <span>Gambar (opsional)</span>
        <input class="input" data-field="image" value="${escapeHtml(hero.image)}" placeholder="img/heroes/${hero.id}.webp" autocomplete="off">
        <small>Path file di repo atau URL gambar. Kosongkan untuk memakai monogram.</small>
      </label>
    </div>

    <fieldset class="field">
      <legend>Role</legend>
      <div class="role-checks">
        ${ROLES.map((r) => `
          <label><input type="checkbox" data-role="${r}" ${hero.roles.includes(r) ? 'checked' : ''}> ${r}</label>
        `).join('')}
      </div>
    </fieldset>

    ${sectionHtml({
      side: 'weak',
      tone: 'red',
      title: 'Lemah melawan',
      hint: `Hero yang bisa mengalahkan ${name}. Ini yang muncul sebagai saran pick saat musuh memakai ${name}.`,
      rows: hero.counters,
    })}

    ${sectionHtml({
      side: 'strong',
      tone: 'blue',
      title: 'Kuat melawan',
      hint: `Hero yang biasanya kalah oleh ${name}. Menambah di sini sama dengan memasukkan ${name} ke daftar "Lemah melawan" hero tersebut.`,
      rows: strong,
    })}

    <div class="ed-danger">
      <button type="button" class="btn danger small" data-action="delete-hero">Hapus ${name}</button>
    </div>`;
}

function sectionHtml({ side, tone, title, hint, rows }) {
  const items = rows
    .map((row) => ({ row, other: byId(row.id) }))
    .filter(({ other }) => other)
    .map(({ row, other }) => `
      <li class="ed-row">
        ${avatarHtml(other, 'sm')}
        <span class="ed-row-name">${escapeHtml(other.name)}</span>
        <input class="input" data-why="${side}" data-id="${other.id}" value="${escapeHtml(row.why)}" placeholder="Alasan singkat (opsional)" aria-label="Alasan untuk ${escapeHtml(other.name)}">
        <button type="button" class="btn ghost small" data-remove="${side}" data-id="${other.id}" aria-label="Hapus ${escapeHtml(other.name)}">Hapus</button>
      </li>`)
    .join('');

  return `
    <section class="ed-section ${tone}">
      <h3>${title} <span class="count">${rows.length}</span></h3>
      <p>${hint}</p>
      <form class="add-hero" data-add="${side}">
        <input class="input" list="hero-options" placeholder="Ketik nama hero lalu tekan Tambah" autocomplete="off" aria-label="Tambah hero ke ${title}">
        <button type="submit" class="btn small">Tambah</button>
      </form>
      ${items ? `<ul class="ed-rows">${items}</ul>` : '<p class="ed-empty">Belum ada hero di sini.</p>'}
    </section>`;
}

// ---------- Aksi ----------

function selectHero(id) {
  if (!byId(id)) return;
  state.selectedId = id;
  history.replaceState(null, '', `#${id}`);
  renderList();
  renderMain();
  els.main.scrollIntoView({ block: 'start', behavior: 'smooth' });
}

function addMatchup(side, text) {
  const hero = selected();
  const other = resolveHero(text);
  if (!other) return toast(`Hero “${text}” tidak ditemukan. Pilih dari daftar saran.`);
  if (other.id === hero.id) return toast('Hero tidak bisa meng-counter dirinya sendiri.');

  if (side === 'weak') {
    if (hero.counters.some((c) => c.id === other.id)) return toast(`${other.name} sudah ada di daftar.`);
    hero.counters.push({ id: other.id, why: '' });
  } else {
    if (other.counters.some((c) => c.id === hero.id)) return toast(`${other.name} sudah ada di daftar.`);
    other.counters.push({ id: hero.id, why: '' });
  }
  save();
  renderList();
  renderMain();
  // Fokus ke kolom alasan hero yang baru ditambah.
  els.main.querySelector(`[data-why="${side}"][data-id="${other.id}"]`)?.focus();
  return true;
}

function removeMatchup(side, otherId) {
  const hero = selected();
  if (side === 'weak') {
    hero.counters = hero.counters.filter((c) => c.id !== otherId);
  } else {
    const other = byId(otherId);
    if (other) other.counters = other.counters.filter((c) => c.id !== hero.id);
  }
  save();
  renderList();
  renderMain();
}

function setReason(side, otherId, value) {
  const hero = selected();
  const entry = side === 'weak'
    ? hero.counters.find((c) => c.id === otherId)
    : byId(otherId)?.counters.find((c) => c.id === hero.id);
  if (entry) {
    entry.why = value.trim();
    save();
  }
}

function addHero(name) {
  const clean = name.trim();
  const id = slugify(clean);
  if (!id) return;
  if (byId(id)) {
    toast(`${byId(id).name} sudah ada.`);
    selectHero(id);
    return;
  }
  heroes().push({ id, name: clean, roles: [], image: '', counters: [] });
  sortHeroes();
  save({ immediate: true });
  state.query = '';
  els.q.value = '';
  renderOptions();
  selectHero(id);
  toast(`${clean} ditambahkan. Jangan lupa pilih role-nya.`);
}

function deleteHero() {
  const hero = selected();
  if (!hero) return;
  if (!confirm(`Hapus ${hero.name}? Semua data counter yang berhubungan dengannya ikut terhapus.`)) return;
  const index = heroes().indexOf(hero);
  state.data.heroes = heroes().filter((h) => h !== hero);
  heroes().forEach((h) => { h.counters = h.counters.filter((c) => c.id !== hero.id); });
  state.selectedId = heroes()[Math.min(index, heroes().length - 1)]?.id || '';
  save({ immediate: true });
  renderAll();
  toast(`${hero.name} dihapus.`);
}

function download() {
  save({ immediate: true });
  const blob = new Blob([`${JSON.stringify(serialize(), null, 2)}\n`], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: 'heroes.json' });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast('heroes.json diunduh. Ganti file data/heroes.json di repo dengan file ini.');
}

async function importFile(file) {
  try {
    const data = normalize(JSON.parse(await file.text()));
    if (!data.heroes.length) throw new Error('tidak ada hero di dalamnya');
    state.data = data;
    state.selectedId = data.heroes[0].id;
    save({ immediate: true });
    renderAll();
    toast(`${data.heroes.length} hero diimpor dari ${file.name}.`);
  } catch (err) {
    toast(`File tidak bisa diimpor: ${err.message}.`);
  }
}

async function discardDraft() {
  if (!confirm(`Buang draf dan kembali ke ${DATA_URL}? Perubahan yang belum diunduh akan hilang.`)) return;
  clearDraft();
  try {
    state.data = await loadData();
    state.selectedId = byId(state.selectedId) ? state.selectedId : heroes()[0]?.id || '';
    renderAll();
    setStatus(`Draf dibuang. Data dimuat ulang dari ${DATA_URL}.`);
  } catch (err) {
    setStatus(err.message);
  }
}

// ---------- Event ----------

function bindEvents() {
  els.q.addEventListener('input', () => {
    state.query = els.q.value;
    renderList();
  });

  els.list.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-id]');
    if (btn) selectHero(btn.dataset.id);
  });

  els.formAdd.addEventListener('submit', (e) => {
    e.preventDefault();
    addHero(els.addName.value);
    els.addName.value = '';
  });

  els.main.addEventListener('submit', (e) => {
    const form = e.target.closest('form[data-add]');
    if (!form) return;
    e.preventDefault();
    const input = form.querySelector('input');
    if (input.value.trim()) addMatchup(form.dataset.add, input.value);
  });

  els.main.addEventListener('click', (e) => {
    const remove = e.target.closest('[data-remove]');
    if (remove) removeMatchup(remove.dataset.remove, remove.dataset.id);
    if (e.target.closest('[data-action="delete-hero"]')) deleteHero();
  });

  els.main.addEventListener('input', (e) => {
    const t = e.target;
    if (t.dataset.why) setReason(t.dataset.why, t.dataset.id, t.value);
    if (t.dataset.field === 'image') {
      selected().image = t.value.trim();
      save();
    }
  });

  els.main.addEventListener('change', (e) => {
    const t = e.target;
    const hero = selected();
    if (t.dataset.role) {
      hero.roles = ROLES.filter((r) => (r === t.dataset.role ? t.checked : hero.roles.includes(r)));
      save();
    }
    if (t.dataset.field === 'name') {
      const value = t.value.trim();
      if (!value) {
        t.value = hero.name;
        return;
      }
      hero.name = value;
      sortHeroes();
      save();
      renderList();
      renderOptions();
      els.main.querySelector('.ed-head h2').textContent = value;
    }
    if (t.dataset.field === 'image') renderMain();
  });

  window.addEventListener('hashchange', () => {
    const id = decodeURIComponent(location.hash.slice(1));
    if (id !== state.selectedId) selectHero(id);
  });

  document.getElementById('btn-download').addEventListener('click', download);
  document.getElementById('btn-import').addEventListener('click', () => els.fileImport.click());
  document.getElementById('btn-discard').addEventListener('click', discardDraft);
  els.fileImport.addEventListener('change', () => {
    const file = els.fileImport.files[0];
    if (file) importFile(file);
    els.fileImport.value = '';
  });
}

// ---------- UI kecil ----------

function setStatus(message) {
  els.status.textContent = message;
}

let toastTimer;
function toast(message) {
  els.toast.textContent = message;
  els.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => els.toast.classList.remove('show'), 2600);
  return false;
}
