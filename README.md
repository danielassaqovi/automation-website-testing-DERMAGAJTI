# Universal Website Testing Tool

QA automation universal berbasis **Playwright + JavaScript + Docker**. Masukkan URL website apa pun, dan seluruh proses inspeksi, pengujian, screenshot, serta pembuatan HTML report berjalan di dalam container. Tidak perlu memasang Node.js, browser, atau dependency Playwright di komputer host.

> **Gunakan hanya pada website milik Anda atau website yang Anda punya izin eksplisit untuk diuji.** Tool ini melakukan request `GET` read-only dan tidak pernah mengirim form, login, transaksi, atau menghapus data.

---

## 1. Fitur

- Input URL target melalui environment variable; source code tidak perlu diubah.
- Validasi URL: hanya `http` dan `https`, mendukung input tanpa skema (default `https://`), dan menolak URL dengan embedded credentials.
- Pre-flight inspection: reachability, HTTP status, response time, title, content type, redirect, server.
- Homepage testing: status HTTP, title, `document.readyState`, body terlihat, dan basic performance (Navigation Timing API).
- Navigation testing: keberadaan navigasi utama dan validitas link navigasi.
- Link testing: crawl link internal secara terbatas, mendeteksi HTTP 4xx/5xx, timeout, dan opsional soft-404.
- Image testing: gambar yang gagal dimuat / respons non-image, dengan verifikasi HTTP sebagai fallback.
- Form testing: deteksi form, jumlah control, atribut validasi dasar, dan accessible label. **Form tidak pernah diisi atau dikirim.**
- Responsive testing: desktop 1440×900, tablet 810×1080, mobile 390×844, deteksi horizontal overflow dan viewport meta.
- Basic accessibility: `lang`, `h1`, `alt` gambar, duplikasi `id`, accessible name untuk link/button.
- Console error dan uncaught page error.
- PASS / FAIL / SKIP yang jujur: elemen yang tidak ditemukan menjadi **SKIP**, bukan PASS palsu.
- Screenshot otomatis untuk setiap test yang gagal.
- HTML report interaktif + HTML report bawaan Playwright + JSON/Markdown summary.
- Semua eksekusi browser berada di dalam Docker.
- Batas crawl (`MAX_PAGES`, `MAX_DEPTH`, `MAX_LINKS`, `MAX_IMAGES`) agar website target tidak dibebani.
- Safe local demo website dengan defect yang disengaja untuk validasi.

---

## 2. Teknologi dan versi

| Komponen | Versi |
| --- | --- |
| Node.js di container | Sesuai image resmi Playwright |
| `@playwright/test` | **1.64.1** (pinned) |
| Docker image | `mcr.microsoft.com/playwright:v1.64.1-noble` |
| Browser default | Chromium (Firefox/WebKit tersedia di image) |
| Docker Compose | Format Compose modern (`docker compose`) |

Tidak ada dependency tambahan di luar Playwright.

---

## 3. Prasyarat

Hanya:

- Docker Engine 20.10+ (disarankan versi terbaru)
- Docker Compose v2 (`docker compose`)

Tidak perlu:

- Node.js / npm di host
- `npx playwright install`
- Browser Chromium/Firefox di host

Cek instalasi:

```bash
docker --version
docker compose version
```

---

## 4. Struktur project

```text
universal-website-testing/
├── src/
│   ├── config/
│   │   └── index.js              # Validasi & parsing environment
│   ├── tests/
│   │   ├── accessibility.spec.js
│   │   ├── navigation.spec.js
│   │   ├── links.spec.js
│   │   ├── images.spec.js
│   │   ├── forms.spec.js
│   │   └── responsive.spec.js
│   ├── utils/
│   │   ├── diagnostics.js        # Console/page/request error collector
│   │   ├── fixtures.js           # Fixture screenshot + diagnostics
│   │   ├── formatting.js
│   │   ├── forms.js
│   │   ├── fs.js
│   │   ├── html.js
│   │   ├── http.js               # Pre-flight inspection
│   │   ├── images.js
│   │   ├── links.js              # Crawl link terbatas
│   │   ├── page.js               # Navigasi & koleksi data halaman
│   │   ├── summary-reporter.js   # report.html, summary.json, summary.md
│   │   └── url.js                # Validasi URL
│   └── runner.js                 # Entry point: validasi, pre-flight, jalankan test
├── demo-site/                    # Website demo lokal yang aman
│   ├── assets/logo.svg
│   ├── index.html
│   ├── about.html
│   ├── contact.html
│   └── styles.css
├── reports/                      # HTML/JSON/Markdown report (volume)
├── screenshots/                  # Screenshot kegagalan + responsive (volume)
├── Dockerfile
├── docker-compose.yml
├── playwright.config.js
├── package.json
├── package-lock.json
├── .env.example
├── .dockerignore
├── .gitignore
└── README.md
```

---

## 5. Mulai cepat

Dari folder project:

```bash
# 1. Build image (sekali, atau setelah source berubah)
docker compose build

# 2. Jalankan pengujian terhadap website target
TARGET_URL=https://example.com docker compose run --rm playwright
```

Atau gunakan file konfigurasi:

```bash
cp .env.example .env
# edit TARGET_URL dan opsi lain di .env
docker compose run --rm playwright
```

Contoh URL lain:

```bash
TARGET_URL=https://staging.example.com docker compose run --rm playwright
TARGET_URL=http://192.168.1.20:8080 docker compose run --rm playwright
TARGET_URL=http://host.docker.internal:3000 docker compose run --rm playwright
```

`host.docker.internal` sudah dipetakan lewat `extra_hosts` agar service yang berjalan di host dapat diakses dari container (Linux dan Docker Desktop).

### Menjalankan hanya test tertentu

Argumen setelah nama service diteruskan ke Playwright:

```bash
TARGET_URL=https://example.com docker compose run --rm playwright --grep "internal links"
TARGET_URL=https://example.com docker compose run --rm playwright --grep "Responsive"
TARGET_URL=https://example.com docker compose run --rm playwright --list
```

Urutan eksekusi internal:

1. `runner.js` membaca `TARGET_URL`.
2. URL divalidasi (protokol, host, credentials).
3. Pre-flight HTTP GET read-only dijalankan dan ditulis ke `reports/inspection.json`.
4. `reports/` dan `screenshots/` dibersihkan (kecuali `CLEAN_OUTPUT=false`).
5. Seluruh spec Playwright dijalankan di dalam container.
6. Reporter menulis `reports/report.html`, `reports/summary.json`, `reports/summary.md`, dan report bawaan Playwright.
7. Screenshot kegagalan disimpan di `screenshots/` dan dilampirkan ke report.
8. Exit code `0` jika semua test yang dieksekusi PASS; `1` jika ada FAIL atau error konfigurasi.

---

## 6. URL target dan allowlist

`TARGET_URL` wajib diisi. Format yang diterima:

- `https://example.com`
- `http://example.com`
- `example.com` → otomatis menjadi `https://example.com`
- `localhost:3000` → otomatis menjadi `https://localhost:3000`
- `192.168.1.10:8080` → otomatis menjadi `https://192.168.1.10:8080`

Ditolak:

- Protokol selain HTTP/HTTPS (`ftp://`, `file://`, `javascript:`, dan sejenisnya)
- URL dengan username/password di dalamnya
- URL tanpa hostname

Untuk membatasi target secara eksplisit, gunakan allowlist:

```env
TARGET_HOST_ALLOWLIST=example.com,*.example.org,localhost
```

Host di luar allowlist akan ditolak sebelum browser dijalankan.

---

## 7. Test suite

| File | Test case utama | Catatan FAIL |
| --- | --- | --- |
| `navigation.spec.js` | HTTP status homepage, title, readyState/body, performance, navigasi, console error, page error | Status ≥ 400, title kosong, halaman tidak selesai load, melebihi budget performance, link navigasi rusak, error JS |
| `links.spec.js` | Crawl link internal dan cek status HTTP | 4xx/5xx, timeout, soft-404 (jika diaktifkan) |
| `images.spec.js` | Semua `<img>` dapat dimuat | Request gagal, HTTP error, content-type bukan image, browser gagal decode |
| `forms.spec.js` | Form terdeteksi dan control punya label | Control visible tanpa accessible label |
| `responsive.spec.js` | Desktop, tablet, mobile | Horizontal overflow > toleransi, body tidak terlihat, viewport meta mobile tidak ada/ tidak `width=device-width` |
| `accessibility.spec.js` | `lang`, `h1`, `alt`, duplikasi `id`, nama link/button | Atribut hilang, `alt` tidak ada, `id` duplikat, elemen interaktif tanpa nama |

### Arti status

| Status | Arti |
| --- | --- |
| **PASS** | Test benar-benar dieksekusi dan assertion terpenuhi. |
| **FAIL** | Test dieksekusi dan menemukan masalah, timeout, atau error. |
| **SKIP** | Elemen/fitur yang diuji tidak ditemukan atau tidak relevan, **bukan** PASS. |

Contoh SKIP yang benar:

- Website tidak punya `<form>` → form test SKIP.
- Website tidak punya `<img>` → image test SKIP.
- Tidak ada link internal yang bisa diuji → link test SKIP.
- Semua gambar lazy dan tidak bisa diverifikasi → image test SKIP (bukan PASS palsu).

Pass rate dihitung dari `PASS / (PASS + FAIL)`, tidak memasukkan SKIP.

### Form safety

Tool hanya membaca struktur form. Tool **tidak**:

- mengisi form,
- menekan tombol submit,
- login,
- melakukan transaksi,
- menghapus/mengubah data.

Form dengan file upload atau password hanya dicatat sebagai metadata.

### Crawl safety

- Hanya link same-origin yang diperiksa.
- Link eksternal tidak di-crawl.
- `MAX_PAGES`, `MAX_DEPTH`, `MAX_LINKS` membatasi jumlah request.
- Pola berbahaya seperti `logout`, `delete`, `checkout`, `unsubscribe` dilewati secara default melalui `SKIP_URL_PATTERNS`.
- Hanya method `GET` yang dipakai.

---

## 8. Report dan screenshot

Setelah eksekusi, buka **di host**:

```text
reports/report.html          ← report utama (interactive, filter PASS/FAIL/SKIP)
reports/html/index.html      ← report bawaan Playwright (trace, attachment, error context)
reports/summary.json         ← data mesin: totals, durasi, detail test, attachment
reports/summary.md           ← ringkasan Markdown
reports/inspection.json      ← hasil pre-flight HTTP
reports/results.json         ← raw JSON reporter Playwright
reports/test-results/        ← trace, screenshot bawaan Playwright, error context
screenshots/                 ← screenshot kegagalan + screenshot responsive
```

`reports/report.html` menampilkan:

- kartu Total / Passed / Failed / Skipped,
- durasi eksekusi,
- pre-flight inspection (status HTTP, title, response time, redirect),
- tabel test dengan filter status,
- detail error/stack trace,
- lampiran screenshot, trace, dan file JSON,
- catatan bahwa SKIP bukan PASS.

Membuka report tanpa web server:

```bash
# Linux
xdg-open reports/report.html

# macOS
open reports/report.html

# Windows
start reports\report.html
```

Report berupa file HTML statis dengan path relatif, sehingga tetap bisa dibuka langsung dari filesystem.

### Screenshot

- Screenshot kegagalan diambil full-page (fallback viewport jika full-page gagal) dan disimpan ke `screenshots/`.
- Screenshot responsive desktop/tablet/mobile disimpan ke `screenshots/` sebagai bukti visual.
- Playwright juga menyalin attachment ke `reports/test-results/` agar report mandiri.

---

## 9. Konfigurasi environment

Semua opsi tersedia di `.env.example`.

| Variable | Default | Fungsi |
| --- | --- | --- |
| `TARGET_URL` | — (wajib) | URL website target. |
| `BROWSER` | `chromium` | `chromium`, `firefox`, atau `webkit`. |
| `IGNORE_HTTPS_ERRORS` | `false` | Abaikan sertifikat TLS invalid (hati-hati). |
| `TARGET_HOST_ALLOWLIST` | kosong | Daftar host yang diizinkan, mendukung `*.example.com`. |
| `TEST_TIMEOUT_MS` | `120000` | Timeout per test. |
| `NAV_TIMEOUT_MS` | `30000` | Timeout navigasi/`page.goto`. |
| `ACTION_TIMEOUT_MS` | `10000` | Timeout action Playwright. |
| `EXPECT_TIMEOUT_MS` | `7000` | Timeout assertion. |
| `LINK_CHECK_TIMEOUT_MS` | `15000` | Timeout request cek link/gambar. |
| `RENDER_WAIT_MS` | `500` | Waktu tunggu tambahan setelah load untuk render client-side. |
| `MAX_PAGES` | `10` | Jumlah URL internal maksimum yang dicek. |
| `MAX_DEPTH` | `1` | `1` = hanya link dari homepage; `2` = termasuk link dari halaman tersebut. |
| `MAX_LINKS` | `50` | Jumlah link yang dikoleksi dari homepage. |
| `MAX_IMAGES` | `50` | Jumlah gambar yang diperiksa. |
| `MAX_FORMS` | `10` | Jumlah form yang diperiksa. |
| `SKIP_URL_PATTERNS` | `logout,signout,...` | Regex dipisah koma; URL/link yang cocok tidak di-crawl. |
| `DETECT_SOFT_404` | `false` | Deteksi halaman HTTP 200 yang tampak seperti 404. |
| `FAIL_ON_CONSOLE_ERRORS` | `true` | Jadikan console error sebagai FAIL. |
| `FAIL_ON_PAGE_ERRORS` | `true` | Jadikan uncaught page error sebagai FAIL. |
| `CONSOLE_ERROR_IGNORE_PATTERNS` | kosong | Regex error console yang diabaikan. |
| `PAGE_ERROR_IGNORE_PATTERNS` | kosong | Regex page error yang diabaikan. |
| `PERF_DOMCONTENTLOADED_MAX_MS` | `6000` | Budget DOMContentLoaded. |
| `PERF_LOAD_MAX_MS` | `12000` | Budget load event. |
| `OVERFLOW_TOLERANCE_PX` | `2` | Toleransi horizontal overflow. |
| `CLEAN_OUTPUT` | `true` | Bersihkan report/screenshot lama setiap run. |
| `REPORTS_DIR` | `reports` | Lokasi report (di container: `/app/reports`). |
| `SCREENSHOTS_DIR` | `screenshots` | Lokasi screenshot (di container: `/app/screenshots`). |

Contoh mengabaikan error pihak ketiga:

```bash
TARGET_URL=https://example.com \
CONSOLE_ERROR_IGNORE_PATTERNS="third-party-cookie,analytics" \
docker compose run --rm playwright
```

---

## 10. Validasi dengan demo site lokal

Demo site aman tersedia di `demo-site/` dan sengaja memiliki 6 defect:

1. broken internal link (`missing-page.html` → 404)
2. broken image (`assets/missing-image.png` → 404)
3. gambar tanpa `alt`
4. input form tanpa label
5. console error
6. uncaught page error

Jalankan:

```bash
docker compose --profile demo up -d --wait demo
TARGET_URL=http://demo docker compose run --rm playwright
docker compose --profile demo down
```

Hasil yang diharapkan pada versi ini: **19 test, 13 PASS, 6 FAIL, 0 SKIP**. Keenam FAIL adalah defect yang memang disengaja. Screenshot kegagalan muncul di `screenshots/` dan report.

Nama service `demo` dapat diakses dari container Playwright karena berada di network Compose yang sama.

---

## 11. Menambahkan test case baru

1. Buat file baru di `src/tests/`, misalnya `content.spec.js`.
2. Gunakan fixture bersama agar diagnostics dan screenshot otomatis aktif:

```js
'use strict';

const { test, expect } = require('../utils/fixtures');
const { gotoTarget } = require('../utils/page');

test('homepage contains a main landmark', async ({ page }, testInfo) => {
  await gotoTarget(page);

  const mainCount = await page.locator('main').count();

  await testInfo.attach('main-landmark.json', {
    body: JSON.stringify({ mainCount }, null, 2),
    contentType: 'application/json',
  });

  if (mainCount === 0) {
    test.skip(true, 'No <main> landmark found; this check is not applicable.');
  }

  await expect(page.locator('main').first()).toBeVisible();
});
```

3. Aturan penting:
   - Gunakan `gotoTarget(page)` dari `src/utils/page.js`, jangan hardcode URL.
   - Gunakan locator semantik (`getByRole`, `getByLabel`) atau selector umum yang tahan perubahan.
   - Jangan submit form atau melakukan aksi yang mengubah data.
   - Jika elemen tidak ditemukan, gunakan `test.skip()` — jangan membuat assertion yang selalu PASS.
   - Lampirkan data pendukung dengan `testInfo.attach()`.
   - Fail harus memiliki pesan yang menjelaskan masalah dan cara memperbaikinya.
   - Batasi jumlah elemen/halaman yang diperiksa.
4. Jalankan ulang:

```bash
docker compose build
TARGET_URL=https://example.com docker compose run --rm playwright --grep "main landmark"
```

Test baru otomatis masuk ke HTML report.

### Menambah tipe config

Tambahkan pembacaan environment di `src/config/index.js` dengan `readInt`, `readBool`, `readList`, atau `readRegexList`, lalu teruskan ke util/test. Jangan membaca `process.env` langsung di spec agar validasi dan default tetap terpusat.

---

## 12. Keamanan dan etika

- **Hanya uji website yang Anda miliki atau yang memberi izin.** Gunakan `TARGET_HOST_ALLOWLIST` untuk mencegah salah target.
- Tool ini melakukan request `GET` read-only. Tidak ada form submission, login, transaksi, atau perubahan data.
- Link yang berpotensi mengubah state (`logout`, `delete`, `checkout`, dan sejenisnya) dilewati secara default.
- Jangan memasukkan credentials ke `TARGET_URL`. URL dengan username/password ditolak.
- Jangan memakai tool untuk melewati autentikasi, CAPTCHA, rate limit, WAF, atau proteksi keamanan lain.
- Hormati `robots.txt`, rate limit, dan ketentuan layanan website. Kurangi `MAX_PAGES`/`MAX_LINKS` untuk website produksi.
- `IGNORE_HTTPS_ERRORS=true` hanya untuk environment uji internal yang Anda kendalikan.
- Report dan screenshot dapat berisi informasi internal; jangan commit ke repository publik.

---

## 13. Batasan automatic website testing

Tool ini adalah **smoke/health check universal**, bukan pengganti pengujian fungsional dan business logic.

Batasan yang perlu diketahui:

- **Struktur HTML berbeda-beda.** Pemeriksaan memakai heuristik umum (`<nav>`, `<form>`, `<img>`, heading, label). Website dengan struktur tidak lazim bisa menghasilkan SKIP atau FAIL yang perlu ditinjau manual.
- **Aplikasi JavaScript berat** mungkin belum selesai render dalam `RENDER_WAIT_MS`. Naikkan nilainya bila perlu.
- **Konten di dalam iframe, Shadow DOM, atau canvas** tidak diperiksa.
- **Login/area terautentikasi** tidak diuji secara default. Tool tidak login otomatis.
- **CAPTCHA, bot protection, WAF, rate limiting** dapat membuat hasil tidak representatif atau memblokir request.
- **Lazy-loaded images** yang tidak pernah masuk viewport bisa berstatus *unverified* (dan test menjadi SKIP bila tidak ada gambar yang bisa diverifikasi).
- **Soft-404** hanya dideteksi dengan heuristik dan default nonaktif.
- **Accessibility** hanya basic checks (bukan audit WCAG lengkap seperti axe).
- **Performance** adalah pengukuran sintetis satu kali dari Navigation Timing API, bukan load test atau Core Web Vitals lengkap.
- **Responsive** memeriksa overflow dan viewport meta, bukan kualitas visual atau usability.
- **Link checker** menggunakan HTTP request, bukan navigasi browser, sehingga halaman yang membutuhkan JavaScript untuk menampilkan error bisa lolos.
- **Form validation** hanya memeriksa struktur dan label, bukan aturan bisnis atau validasi server.
- **Cross-origin link** tidak dicek.
- Default hanya **Chromium**; Firefox/WebKit dapat dipilih lewat `BROWSER` tetapi tidak diuji bersamaan.
- Website yang memblokir user-agent/headless browser dapat menghasilkan FAIL yang bukan kesalahan aplikasi.

---

## 14. Troubleshooting

### Report tidak muncul / permission denied

Container berjalan sebagai `root`, sehingga file hasil bisa dimiliki `root` di host. Perbaiki dengan:

```bash
sudo chown -R "$(id -u):$(id -g)" reports screenshots
```

### `TARGET_URL is required`

Jalankan dengan environment variable:

```bash
TARGET_URL=https://example.com docker compose run --rm playwright
```

atau isi `.env`.

### Website localhost tidak bisa diakses

Di dalam container, `localhost` berarti container itu sendiri. Gunakan:

- `http://host.docker.internal:3000` untuk service di host, atau
- nama service Compose, misalnya `http://demo`.

### Sertifikat TLS invalid

Untuk environment internal saja:

```bash
TARGET_URL=https://internal.test IGNORE_HTTPS_ERRORS=true docker compose run --rm playwright
```

### Terlalu banyak console error dari pihak ketiga

Gunakan allowlist regex:

```bash
CONSOLE_ERROR_IGNORE_PATTERNS="analytics,tracker,ads\\." \
TARGET_URL=https://example.com docker compose run --rm playwright
```

### Report terlalu lama / website terbebani

Kurangi:

```bash
MAX_PAGES=3 MAX_LINKS=15 MAX_IMAGES=20 \
TARGET_URL=https://example.com docker compose run --rm playwright
```

### Ingin melihat trace kegagalan

Buka `reports/html/index.html`, pilih test yang gagal, lalu buka attachment **trace**. Playwright HTML report sudah menyertakan trace viewer dan dapat dibuka langsung dari filesystem. File trace mentah juga tersedia di `reports/test-results/<folder>/trace.zip`.

---

## 15. Status validasi project

Validasi dilakukan **sepenuhnya di dalam Docker** (tidak memakai Node.js/browser host):

- `docker compose build` berhasil.
- Demo site lokal + suite lengkap berhasil dijalankan: **19 test, 13 PASS, 6 FAIL, 0 SKIP**; seluruh FAIL sesuai defect yang disengaja dan screenshot/report tergenerate.
- Pengujian read-only terhadap `https://example.com` berhasil dijalankan: **12 PASS, 1 FAIL, 6 SKIP**. FAIL berasal dari tidak adanya heading `<h1>` pada halaman tersebut; SKIP muncul karena tidak ada form, gambar, link internal, atau navigasi semantik yang dapat diuji. Ini menunjukkan mekanisme SKIP berjalan dan tidak menghasilkan PASS palsu.
- Validasi URL kosong dan skema `ftp://` berhasil ditolak dengan exit code `1` dan pesan yang jelas.

Hasil aktual dapat berbeda tergantung website target, koneksi, dan proteksi yang aktif.
