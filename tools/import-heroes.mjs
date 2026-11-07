#!/usr/bin/env node
/**
 * Impor ikon, role, dan lane hero dari hasil MLBB-Hero-Scraper ke data/heroes.json.
 *
 * Pemakaian (dari folder project ini):
 *   node tools/import-heroes.mjs <folder-hasil-scraper | file-json> [opsi]
 *
 * Opsi:
 *   --hotlink          Jangan salin file ikon, pakai icon_url dari CDN Moonton saja
 *   --keep-roles       Jangan ubah role/lane hero yang sudah ada
 *   --dry-run          Tampilkan ringkasan saja, tidak menulis file apa pun
 *
 * Data counter TIDAK pernah diubah oleh script ini.
 * Butuh Node.js 18 atau lebih baru, tanpa dependency tambahan.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROLES = ['Tank', 'Fighter', 'Assassin', 'Mage', 'Marksman', 'Support'];
const LANES = ['Exp Lane', 'Gold Lane', 'Mid Lane', 'Roamer', 'Jungler'];
const LANE_PATTERNS = [
  [/exp|clash/i, 'Exp Lane'],
  [/gold|farm/i, 'Gold Lane'],
  [/mid/i, 'Mid Lane'],
  [/roam/i, 'Roamer'],
  [/jung/i, 'Jungler'],
];

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA_FILE = path.join(ROOT, 'data', 'heroes.json');
const IMG_DIR = path.join(ROOT, 'img', 'heroes');
const JSON_CANDIDATES = ['mlbb_heroes.json', 'json.txt', 'heroes.json', 'output/mlbb_heroes.json'];

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith('--')));
const source = args.find((a) => !a.startsWith('--'));

if (!source) {
  console.log('Pemakaian: node tools/import-heroes.mjs <folder-hasil-scraper | file-json> [--hotlink] [--keep-roles] [--dry-run]');
  process.exit(1);
}

const slugify = (s) => String(s).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const searchKey = (s) => String(s).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]/g, '');
const toArray = (v) => (Array.isArray(v) ? v : typeof v === 'string' ? v.split(/[,/|]/) : []);
const exists = (p) => fs.access(p).then(() => true, () => false);

// Urutan dari sumber dipertahankan (role/lane utama di depan), duplikat dan nilai asing dibuang.
const unique = (list) => [...new Set(list.filter(Boolean))];

function mapRoles(value) {
  return unique(toArray(value).map((r) => ROLES.find((role) => searchKey(role) === searchKey(r?.name ?? r))));
}

function mapLanes(value) {
  return unique(toArray(value).map((l) => LANE_PATTERNS.find(([re]) => re.test(String(l?.name ?? l)))?.[1]));
}

const sameSet = (a = [], b = []) => a.length === b.length && a.every((x) => b.includes(x));

async function findJson(src) {
  const stat = await fs.stat(src).catch(() => null);
  if (!stat) throw new Error(`Folder atau file tidak ditemukan: ${src}`);
  if (stat.isFile()) return { file: src, dir: path.dirname(src) };
  for (const name of JSON_CANDIDATES) {
    const p = path.join(src, name);
    if (await exists(p)) return { file: p, dir: src };
  }
  throw new Error(`Tidak menemukan ${JSON_CANDIDATES.join(' / ')} di ${src}`);
}

function readEntries(raw) {
  const list = Array.isArray(raw) ? raw : raw?.heroes ?? raw?.data?.records ?? raw?.data ?? [];
  if (!Array.isArray(list) || !list.length) throw new Error('Format JSON tidak dikenali: tidak ada daftar hero.');
  return list.map((e) => ({
    name: String(e.name ?? e.hero_name ?? e.heroName ?? '').trim(),
    roles: mapRoles(e.roles ?? e.role ?? e.sortlabel),
    lanes: mapLanes(e.lanes ?? e.lane ?? e.roadsort),
    iconUrl: e.icon_url ?? e.head ?? e.icon ?? e.image ?? '',
    iconFile: e.icon_file ?? '',
  })).filter((e) => e.name);
}

/** Cari file ikon lokal hasil scraper untuk satu hero. */
async function findIcon(dir, entry) {
  const variants = [...new Set([entry.name, entry.name.replace(/\s+/g, '_'), entry.name.replace(/[^\w-]+/g, '_')])];
  const candidates = [];
  if (entry.iconFile) {
    candidates.push(path.resolve(dir, entry.iconFile));
    for (const v of variants) candidates.push(path.join(dir, 'heroes', v, entry.iconFile));
  }
  for (const v of variants) {
    candidates.push(path.join(dir, 'heroes', v, 'icon.png'), path.join(dir, 'heroes', v, 'icon.jpg'));
  }
  for (const p of candidates) if (await exists(p)) return p;
  return null;
}

async function main() {
  const { file, dir } = await findJson(path.resolve(source));
  const entries = readEntries(JSON.parse(await fs.readFile(file, 'utf8')));
  const data = JSON.parse(await fs.readFile(DATA_FILE, 'utf8'));
  const heroes = data.heroes;

  const report = { matched: 0, added: [], copied: 0, hotlinked: 0, noImage: [], changed: [] };
  const seen = new Set();

  for (const entry of entries) {
    let hero = heroes.find((h) => h.id === slugify(entry.name))
      ?? heroes.find((h) => searchKey(h.name) === searchKey(entry.name));

    if (hero) {
      report.matched += 1;
    } else {
      hero = { id: slugify(entry.name), name: entry.name, roles: [], lanes: [], image: '', counters: [] };
      heroes.push(hero);
      report.added.push(entry.name);
    }
    seen.add(hero.id);

    const isNew = report.added.includes(entry.name);
    if (isNew || !flags.has('--keep-roles')) {
      const old = { roles: hero.roles ?? [], lanes: hero.lanes ?? [] };
      if (entry.roles.length) hero.roles = entry.roles;
      if (entry.lanes.length) hero.lanes = entry.lanes;
      hero.lanes ??= [];
      if (!isNew && !(sameSet(old.roles, hero.roles) && sameSet(old.lanes, hero.lanes))) {
        const fmt = (h) => `${h.roles.join('/')} | ${h.lanes.join('/')}`;
        report.changed.push(`${hero.name}: ${fmt(old)}  ->  ${fmt(hero)}`);
      }
    }

    const icon = flags.has('--hotlink') ? null : await findIcon(dir, entry);
    if (icon) {
      const target = path.join(IMG_DIR, `${hero.id}${path.extname(icon).toLowerCase() || '.png'}`);
      if (!flags.has('--dry-run')) {
        await fs.mkdir(IMG_DIR, { recursive: true });
        await fs.copyFile(icon, target);
      }
      hero.image = path.relative(ROOT, target).split(path.sep).join('/');
      report.copied += 1;
    } else if (/^https?:\/\//.test(entry.iconUrl)) {
      hero.image = entry.iconUrl;
      report.hotlinked += 1;
    } else {
      report.noImage.push(hero.name);
    }
  }

  const missing = heroes.filter((h) => !seen.has(h.id)).map((h) => h.name);
  heroes.sort((a, b) => a.name.localeCompare(b.name, 'id'));
  data.updated = new Date().toISOString().slice(0, 10);

  if (!flags.has('--dry-run')) {
    await fs.writeFile(DATA_FILE, `${JSON.stringify(data, null, 2)}\n`);
  }

  console.log(`Sumber      : ${path.relative(process.cwd(), file)} (${entries.length} hero)`);
  console.log(`Cocok       : ${report.matched} hero`);
  console.log(`Hero baru   : ${report.added.length ? report.added.join(', ') : '-'}`);
  console.log(`Ikon disalin: ${report.copied} file ke img/heroes/`);
  console.log(`Ikon via URL: ${report.hotlinked}`);
  if (report.noImage.length) console.log(`Tanpa ikon  : ${report.noImage.join(', ')}`);
  if (report.changed.length) console.log(`\nRole/lane diperbarui:\n  ${report.changed.join('\n  ')}`);
  if (missing.length) console.log(`\nAda di heroes.json tapi tidak di sumber (cek ejaan namanya):\n  ${missing.join(', ')}`);
  console.log(flags.has('--dry-run') ? '\nDry run: tidak ada file yang diubah.' : `\nSelesai. ${path.relative(process.cwd(), DATA_FILE)} sudah diperbarui.`);
}

main().catch((err) => {
  console.error(`Gagal: ${err.message}`);
  process.exit(1);
});
