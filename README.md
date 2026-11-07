# Counter Pick

Web referensi counter hero Mobile Legends: Bang Bang. Hero dikelompokkan per role. Klik satu hero untuk melihat hero yang dia kalahkan (**Kuat melawan**) dan hero yang bisa mengalahkannya (**Lemah melawan**).

Dibuat dengan HTML, CSS, dan JavaScript biasa, tanpa framework dan tanpa backend. "Database"-nya adalah satu file JSON di repo, jadi bisa di-host gratis di GitHub Pages.

## Fitur

- Daftar hero per role dengan filter role dan pencarian (tekan `/` untuk langsung mencari)
- Panel detail berisi papan versus: biru untuk "Kuat melawan", merah untuk "Lemah melawan", lengkap dengan alasan singkat
- Setiap hero punya tautan sendiri (contoh `.../#fanny`) yang bisa dibagikan ke teman
- Halaman **Editor** (`editor.html`) untuk mengisi data counter tanpa mengedit JSON secara manual
- Responsif: di HP, panel detail tampil sebagai bottom sheet

## Struktur folder

```
├── index.html        halaman utama
├── editor.html       editor data counter
├── css/style.css     semua gaya
├── js/data.js        fungsi bersama (muat data, hitung counter, avatar)
├── js/app.js         logika halaman utama
├── js/editor.js      logika editor
└── data/heroes.json  data hero dan counter
```

## Menjalankan di komputer

Browser tidak bisa memuat `heroes.json` kalau `index.html` dibuka langsung dengan klik dua kali. Jalankan lewat server lokal:

```bash
cd folder-project
python -m http.server 8000
```

Lalu buka http://localhost:8000. Bisa juga memakai extension **Live Server** di VS Code.

## Deploy ke GitHub Pages

1. Push semua file ke repo GitHub.
2. Buka **Settings → Pages**.
3. Di **Build and deployment**, pilih **Deploy from a branch**, branch `main`, folder `/ (root)`, lalu Save.
4. Tunggu sekitar 1 menit. Web tersedia di `https://USERNAME.github.io/NAMA-REPO/`.

Kalau nama repo-nya `USERNAME.github.io`, web langsung tersedia di `https://USERNAME.github.io/`.

## Mengubah data counter

1. Buka `editor.html` (di localhost atau langsung di web yang sudah online).
2. Pilih hero, lalu tambahkan hero di bagian **Lemah melawan** atau **Kuat melawan** dan isi alasannya.
3. Semua perubahan otomatis tersimpan sebagai draf di browser. Klik **Lihat hasil draf** untuk melihat tampilannya.
4. Klik **Unduh heroes.json**, lalu ganti file `data/heroes.json` di repo dengan file tersebut.
5. Commit dan push. GitHub Pages akan memperbarui web dalam sekitar 1 menit.

Data hanya menyimpan satu arah, yaitu `counters`: daftar hero yang mengalahkan hero tersebut. Daftar "Kuat melawan" dihitung otomatis dari data itu, jadi tidak ada data yang dobel atau saling bertentangan.

## Format data

```json
{
  "updated": "2026-11-07",
  "heroes": [
    {
      "id": "fanny",
      "name": "Fanny",
      "roles": ["Assassin"],
      "image": "",
      "counters": [
        { "id": "khufra", "why": "Bouncing Ball memantulkan hero yang dash menembus dirinya" }
      ]
    }
  ]
}
```

- `id`: huruf kecil dan tanda hubung, dipakai di URL (`#fanny`)
- `roles`: satu atau dua dari `Tank`, `Fighter`, `Assassin`, `Mage`, `Marksman`, `Support`
- `image`: opsional, path file (misalnya `img/heroes/fanny.webp`) atau URL. Kalau kosong, tampil monogram berwarna.
- `counters`: hero yang kuat melawan hero ini, `why` boleh kosong

## Atribusi

Proyek penggemar, non-komersial. Mobile Legends: Bang Bang beserta nama dan gambar hero adalah milik Moonton.
