// Fungsi bersama untuk halaman utama (app.js) dan Editor (editor.js).

export const ROLES = ['Tank', 'Fighter', 'Assassin', 'Mage', 'Marksman', 'Support'];
export const DATA_URL = 'data/heroes.json';
const DRAFT_KEY = 'mlbb-counter:draft';

/** Muat data. Kalau useDraft = true dan ada draf dari Editor, pakai draf itu. */
export async function loadData({ useDraft = false } = {}) {
  if (useDraft) {
    const draft = readDraft();
    if (draft) return normalize(draft);
  }
  const res = await fetch(DATA_URL, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`Gagal memuat ${DATA_URL} (HTTP ${res.status})`);
  return normalize(await res.json());
}

/**
 * Rapikan data mentah: buang hero tanpa nama, id ganda, role yang tidak dikenal,
 * dan counter yang menunjuk ke hero yang tidak ada / ke dirinya sendiri.
 */
export function normalize(raw) {
  const list = Array.isArray(raw?.heroes) ? raw.heroes : [];
  const heroes = [];
  const ids = new Set();

  for (const h of list) {
    if (!h || typeof h.name !== 'string' || !h.name.trim()) continue;
    const id = slugify(h.id || h.name);
    if (!id || ids.has(id)) continue;
    ids.add(id);
    heroes.push({
      id,
      name: h.name.trim(),
      roles: (Array.isArray(h.roles) ? h.roles : []).filter((r) => ROLES.includes(r)),
      image: typeof h.image === 'string' ? h.image.trim() : '',
      counters: Array.isArray(h.counters) ? h.counters : [],
    });
  }

  for (const h of heroes) {
    const seen = new Set();
    h.counters = h.counters
      .map((c) => (typeof c === 'string' ? { id: c, why: '' } : c))
      .filter((c) => c && typeof c.id === 'string')
      .map((c) => ({ id: slugify(c.id), why: typeof c.why === 'string' ? c.why.trim() : '' }))
      .filter((c) => ids.has(c.id) && c.id !== h.id && !seen.has(c.id) && seen.add(c.id));
  }

  heroes.sort((a, b) => a.name.localeCompare(b.name, 'id'));
  return { updated: typeof raw?.updated === 'string' ? raw.updated : '', heroes };
}

/** Hero yang mengalahkan `hero` (disimpan langsung di hero.counters). */
export function weakAgainst(hero) {
  return hero.counters;
}

/** Hero yang dikalahkan `hero`: semua hero lain yang daftar counter-nya memuat `hero`. */
export function strongAgainst(hero, heroes) {
  const out = [];
  for (const other of heroes) {
    const entry = other.counters.find((c) => c.id === hero.id);
    if (entry) out.push({ id: other.id, why: entry.why });
  }
  return out;
}

export function slugify(text) {
  return String(text)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Kunci pencarian: huruf kecil tanpa spasi/tanda baca, jadi "yi sun" cocok dengan "Yi Sun-shin". */
export function searchKey(text) {
  return String(text).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]/g, '');
}

export function monogram(name) {
  const parts = name.replace(/[^A-Za-z]+/g, ' ').trim().split(/\s+/);
  const letters = parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : name.slice(0, 2);
  return letters.toUpperCase();
}

/** Warna stabil per hero, dipakai untuk avatar monogram selama belum ada gambar. */
export function hueOf(id) {
  let h = 7;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) % 250;
  // Rentang 150°–400° (teal, biru, ungu, magenta, merah, oranye); hijau-kuning yang kusam dilewati.
  return (150 + h) % 360;
}

export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (ch) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
  ));
}

/** HTML avatar: gambar kalau ada, kalau tidak monogram berwarna. */
export function avatarHtml(hero, size = '') {
  const mono = escapeHtml(monogram(hero.name));
  const cls = `avatar${size ? ` avatar-${size}` : ''}`;
  if (hero.image) {
    return `<span class="${cls}" style="--h:${hueOf(hero.id)}" data-mono="${mono}" aria-hidden="true">`
      + `<img src="${escapeHtml(hero.image)}" alt="" loading="lazy" decoding="async"></span>`;
  }
  return `<span class="${cls}" style="--h:${hueOf(hero.id)}" aria-hidden="true">${mono}</span>`;
}

/** Kalau gambar hero gagal dimuat, ganti dengan monogram. Panggil sekali per halaman. */
export function enableAvatarFallback() {
  document.addEventListener('error', (event) => {
    const img = event.target;
    if (!(img instanceof HTMLImageElement)) return;
    const box = img.closest('.avatar');
    if (box) box.textContent = box.dataset.mono || '?';
  }, true);
}

// ---- Draf Editor (localStorage). Dibungkus try/catch karena bisa diblokir browser. ----

export function readDraft() {
  try {
    const text = localStorage.getItem(DRAFT_KEY);
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

export function writeDraft(data) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function clearDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    /* abaikan */
  }
}
