# Implementation Plan: Flag Education Pages

Status: **Tahap 1 selesai** (2026-10-12) — Tahap 2 belum dibangun
Date: 2026-10-09 (diselaraskan dengan kode 2026-10-12)
Related PRD: `docs/PRD_FLAG_EDUCATION_PAGES.md`

Plan ini mencakup **Tahap 1** PRD (menyusun dan mem-publish Education Page di Pukat). Tahap 2 (hubungan ke GoPhish) hanya diurutkan di §6 dan baru dirinci setelah Open Questions PRD §13 dijawab.

Pola yang diikuti: `FlagExampleController`/`FlagExampleService`/`FlagExampleRepository` untuk backend per-entity, `EntityProfileService` untuk scoping, tab di `MyProfile.jsx` untuk UI, dan komponen editor landing page untuk tampilan.

## 1. Urutan

```text
Tahap 1 — Education Page di Pukat
  F1 Schema pukat_flag_pages + RBAC flag_pages.*
  F2 Backend: repository, service, controller
  F3 Frontend data layer: API, query keys, hooks
  F4 Frontend UI: editor di tab Flags
  F5 QA
```

F1–F2 bisa di-review dan di-smoke-test sendiri sebelum F3–F4 dimulai.

## 2. Status: Tahap 1 selesai (2026-10-12)

Tahap 1 sudah diimplementasikan dan tervalidasi: `php -l` bersih, `npm run lint` bersih di file fitur (2 warning sisanya pra-ada di `ManageView.jsx`/`Performing.jsx`), `npm run test` 91 lulus. §3 di bawah sudah ditulis ulang sebagai deskripsi **as-built** final.

Catatan sejarah (supaya tidak ditemukan ulang): arsitektur sempat **per-kategori** lalu **dibalik jadi satu halaman per entity** pada 2026-10-12 (PRD §12); `pukat_flag_pages` di-reshape via migrasi `1.21.0` (DROP + recreate, fitur belum rilis); dan guard "hapus kategori punya halaman" + `FlagRepository::count_pages()` yang sempat ada **sudah dicabut**. Keputusan "base64 inline saat insert" juga dibatalkan — diganti identitas `data-pukat-img` + base64 saat export.

## 3. Tahap 1

### F1. Schema dan RBAC (as-built)

- `Activator.php`: `pukat_flag_pages` persis PRD §7 — **UNIQUE per `entity_name`, tanpa `flag_id`**. Dibuat pertama kali di migrasi `1.20.0`, lalu di-reshape ke bentuk ini di migrasi **`1.21.0`** (`DROP TABLE` + `create_tables()`, karena fitur belum rilis sehingga aman di-drop).
- `PermissionRegistry.php`: resource `flag_pages` dengan `view_gate => shared`, `edit => operator`, `publish => operator`. Setelah upgrade, role operator punya `pukat_flag_pages_view/_edit/_publish`; viewer hanya `_view`.

### F2. Backend (as-built)

**`includes/Repositories/FlagPageRepository.php`**

- `find_for_entity( string $entity_name )` — pencocokan entity case-insensitive (`SELECT *`).
- `create( array $data )`, `update( int $id, array $data )`.

**`includes/Services/FlagPageService.php`** — satu halaman per entity.

- `get( $params )` — entity tanpa halaman → objek halaman kosong (`id: null`, `html_body: ''`, `status: 'draft'`); non-admin yang menyebut entity lain di-fallback ke entity-nya sendiri.
- `save( $params, $user_id )` — entity dari server (admin boleh `entity`); `enforce_entity_editable()`; validasi nama entity ≤ 191, `html_body` string ≤ **4 MB** (`MAX_HTML_BYTES`), `title` ≤ 255; upsert; tidak menyentuh `published_html`; audit `flag_page.saved`.
- `publish( $params, $user_id )` — halaman harus sudah tersimpan & draft tidak kosong (422); salin `html_body` → `published_html`, set `status`/`published_by`/`published_at`; audit `flag_page.published`.
- `unpublish( $params, $user_id )` — `published_html = NULL`, `status = 'draft'`; audit `flag_page.unpublished`.
- Helper entity mengikuti `FlagExampleService::target_entity()`; response lewat satu `prepare()` yang menghitung `has_unpublished_changes`.

**`includes/Api/FlagPageController.php`** — route tunggal `/flag-page`:

- `GET /flag-page` (gate `flag_pages.view`), `PUT /flag-page` (`.edit`), `POST /flag-page/publish` & `/flag-page/unpublish` (`.publish`), `require_capability()` seperti `FlagExampleController`. Didaftarkan di `Plugin.php` setelah `FlagExampleController`.

**`includes/Api/FlagExampleController.php` + `FlagExampleService.php`** — endpoint base64 untuk Tahap 2:

- `GET /flag-examples/{id}/data-uri` (gate `flag_examples.view`, scoping `current_user_can_view_entity()`) → `{ data_uri: "data:<mime>;base64,…" }` dari rendition **`large`** (fallback file tersimpan), tidak pernah file 2560px penuh. **Belum dipanggil di Tahap 1** (insert memakai URL); disiapkan untuk substitusi base64 saat export/sync.

### F3. Frontend data layer (as-built)

- `api/flagApi.js`: `getPage(params)`, `savePage(data)`, `publishPage(data)`, `unpublishPage(data)` (tanpa `flagId`); `exampleDataUri(id)` (untuk Tahap 2).
- `api/queryKeys.js`: `flags.page(params)` di bawah prefix `['flags']`.
- `hooks/queries/useFlagQueries.js`: `useFlagPage(params)` (`refetchOnWindowFocus: false` agar tidak menimpa ketikan).
- `hooks/mutations/useFlagMutations.js`: `useSaveFlagPageMutation/usePublishFlagPageMutation/useUnpublishFlagPageMutation` — dipanggil `mutate({ data })`.

### F4. Frontend UI (as-built)

- `utils/flagPageTemplate.js` — fungsi murni, diuji di `flagPageTemplate.test.js`:
  - `buildStarterHtml()` — template bilingual adaptasi `docs/prototypes/education-page.html` (slot `.image-box` kosong, `{{.RId}}`, toggle bahasa).
  - `buildFigureHtml({ src, caption, alt, flagExampleId })` — `<figure data-pukat-img="{id}"><img src="<src>">…` (`src` = **URL**; `escapeHtml` semua nilai).
  - `insertAtCursor(html, snippet, caretPos)` — sisip di kursor (fallback sebelum `</body>`/akhir). `insertImageIntoHtml` lama dihapus.
  - `flagPageStatus(page)` — label/tone status (No page/Draft/Published/Unpublished changes).
- `features/entities/EntityFlagPageEditor.jsx` — **satu halaman per entity** (tanpa switcher kategori). Header (Cancel/Save Draft/Publish) + panel atas (Nama template, **pemilih gambar multi-select dikelompokkan per kategori, kolom scrollable**, Insert at cursor, status + Unpublish) + panel bawah (tab HTML Code/Live Preview + **Use starter template** + **Fullscreen**, `AssetEditorLayout`+`HtmlCodeEditor`, `BrowserPreview`). Insert membangun `<figure data-pukat-img>` dari `example.image_url` (bukan `/data-uri`) lalu `insertAtCursor` di `caret` dari `HtmlCodeEditor.onCaretChange`. Fullscreen via `Portal` (FR-11). `dirty` dari banding state lokal vs server; baca-saja bila `!canEdit`.
- `components/Editor/HtmlCodeEditor.jsx` — prop opsional `onCaretChange(selectionStart)` (via `onSelect`/`onClick`/`onKeyUp`); pemakaian existing tidak berubah.
- `features/entities/EntityFlagsPanel.jsx` — pembungkus: sub-tab **Education Page / Images**; editor tetap ter-mount saat tab Images aktif (draft tak hilang); warning `beforeunload` saat `dirty`. Tanpa kepemilikan kategori.
- `features/entities/EntityFlagExamplesPanel.jsx` — props opsional `selectedFlagId`/`onSelectFlag` (tidak lagi dipakai `EntityFlagsPanel`; tetap jalan standalone untuk `MasterEntities.jsx`).
- `pages/Admin/MyProfile.jsx` — tab `flags` memakai `EntityFlagsPanel`; `canEditFlagPage`/`canPublishFlagPage` dari `flag_pages.edit`/`.publish`.
- Tidak menyentuh `assets/dist`.

### F5. QA (dijalankan)

- `php -l` bersih untuk semua file PHP yang diubah/dibuat; route `/flag-page`(+publish/unpublish) & `/flag-examples/{id}/data-uri` hidup (401 tanpa auth); route lama `/flag-pages/{id}` 404.
- `npm run lint` bersih di file fitur; `npm run test` 91 lulus (termasuk `flagPageTemplate.test.js`: `buildFigureHtml` data-pukat-img, `insertAtCursor`, `buildStarterHtml`, `flagPageStatus`).
- `npm run build` **tidak** dijalankan (menulis ke `assets/dist`).
- **Belum** smoke test REST manual lintas role & uji manual browser penuh (simpan/reload/publish/unpublish/insert/fullscreen) — disarankan sebelum rilis.

## 4. File

| Baru | Diubah |
|---|---|
| `includes/Repositories/FlagPageRepository.php` | `includes/Core/Activator.php` (tabel + migrasi 1.20.0/1.21.0) |
| `includes/Services/FlagPageService.php` | `includes/Services/PermissionRegistry.php` (resource `flag_pages`) |
| `includes/Api/FlagPageController.php` | `includes/Core/Plugin.php` (registrasi controller) |
| `pukat-app/src/features/entities/EntityFlagPageEditor.jsx` | `includes/Api/FlagExampleController.php`, `includes/Services/FlagExampleService.php` (`/data-uri`) |
| `pukat-app/src/features/entities/EntityFlagsPanel.jsx` | `includes/Services/FlagService.php`, `includes/Repositories/FlagRepository.php` (guard + `count_pages` dicabut) |
| `pukat-app/src/utils/flagPageTemplate.js` (+ test) | `pukat-app/src/components/Editor/HtmlCodeEditor.jsx` (`onCaretChange`) |
| | `pukat-app/src/api/flagApi.js`, `api/queryKeys.js` |
| | `pukat-app/src/hooks/queries/useFlagQueries.js`, `hooks/mutations/useFlagMutations.js` |
| | `pukat-app/src/features/entities/EntityFlagExamplesPanel.jsx`, `pukat-app/src/pages/Admin/MyProfile.jsx` |

## 5. Risiko

- **HTML bebas.** Disimpan apa adanya seperti landing page; pratinjau wajib tetap di iframe ber-sandbox dan tidak boleh ada `dangerouslySetInnerHTML` untuk isi halaman.
- **Kunci unik pada `entity_name`.** Kolom dibuat `VARCHAR(191)` agar indeks gabungan aman di utf8mb4; nama entity di tabel lain `VARCHAR(255)`. Nama entity di atas 191 karakter akan ditolak saat simpan — validasi eksplisit di service.
- **Perbandingan `published_html <> html_body`** dihitung di `prepare()` (PHP), bukan di query list, dan hanya satu baris per entity — ringan.
- **Kehilangan ketikan** saat refetch: `useFlagPage` memakai `refetchOnWindowFocus: false`; state editor diturunkan dari data server lewat `key` (per entity), bukan ditimpa saat `dirty`.
- **`src` gambar di draft = URL WP Media**: preview butuh URL itu bisa diakses; di GoPhish (Tahap 2) URL diganti base64. Bila flag example dihapus setelah disisipkan, `data-pukat-img`-nya jadi yatim — substitusi export perlu menangani ini.

## 6. Tahap 2 (urutan saja)

**Disederhanakan oleh `api_campaignnew.md` Rilis 3 (`next_campaign_id`)** — kedatangan otomatis saat submit; tanpa endpoint penerima buatan sendiri, tanpa `redirect_url`, tanpa `recipients` untuk rantai.

```text
G1  Klien GoPhish ............................. SELESAI 2026-10-12
G2  Publish → sync GoPhish Landing Page (base64) . SELESAI 2026-10-12 (verified live)
G3  Publish → create/refresh master education + edit-lock saat simulasi aktif ... SELESAI 2026-10-12 (verified live)
G3b Wiring: simulation launch → set next_campaign_id = gophish_master_id ... SELESAI 2026-10-13
G4  Monitoring: GET /campaigns/{simulation}/results, group timeline by rid (Submitted Data (Education|Quiz) tergabung) ... BELUM
```

**G3b (as-built, 2026-10-13) — simulation launch menautkan rantai ke master education entity.**
- **Follow-up flag baru**: `CampaignRunService::sanitize_follow_up()` menambah `education_enabled` (default `false`; frontend yang set). Tersimpan di `follow_up_json`, dibaca balik saat launch.
- **Linking saat launch (bukan create)**: `CampaignRunService::launch()` memanggil `link_education_follow_up()` setelah campaign GoPhish ada. Bila `education_enabled`, resolve `FlagPageService::published_master_id_for_entity($entity)` (read-only, **tanpa edit-gate** — launcher sudah lolos cek run-level) lalu `GoPhishService::set_next_campaign($sim_id, $master_id)`. Linking di launch (bukan saat create simulation) karena master di-recreate tiap Publish (FR-12) → id-nya harus diresolusi fresh. Audit `campaign_run.education_linked`.
- **Warn, bukan block** (keputusan 2026-10-13): gagal link (tak ada master published / GoPhish tolak) **tidak** membatalkan launch — campaign GoPhish sudah ada. Hasil dikembalikan sebagai `data.education_link = {ok, message?, campaign_id?}`; frontend toast warning, run bisa di-relaunch/relink.
- **Wizard Step 3**: baris "education" di kartu "Set The Follow Up" kini **toggle live** (bukan "Coming soon") — aktif hanya bila entity punya education page `status=published` + `gophish_master_id` (dicek via `useFlagPage(runEntity)`; admin kirim `entity`). Default **on bila tersedia** (keputusan 2026-10-13); bila tak tersedia → disabled + hint "Publish Flag education page dulu", dan payload tidak mengirim `education_enabled=true`. Quiz & Force-Reset tetap placeholder "Coming soon" disabled.
- Alir data FE: `followUp.educationEnabled` → `campaignLaunch.js` `education_enabled` → `withEffectiveEducation()` di `Campaigns.jsx` meng-fold ketersediaan sebelum build payload (launch & save-draft). `launchRunWithGuardrailRetry()` kini mengembalikan run (bukan bool) agar `surfaceEducationLinkResult()` bisa baca `education_link`.
- QA: `php -l` bersih (`CampaignRunService.php`, `FlagPageService.php`); `npm run lint` bersih di file fitur (2 warning pra-ada `ManageView`/`Performing`); `npm run test` 91 lulus (`campaignLaunch.test.js` diperluas untuk `education_enabled`).
- **Smoke test live SELESAI 2026-10-13** (entity ibaraki, operator `pukatopr`, semua objek buangan dibersihkan): `published_master_id_for_entity('ibaraki')`=52, entity tak dikenal→0 (warn path). Dibuat simulation buangan (dijadwalkan 2099 → tak kirim email) + group `*.invalid`, row run buangan `education_enabled=true`, lalu `CampaignRunService::launch()` → `education_link.ok=true campaign_id=52`, **GoPhish `sim.next_campaign_id` jadi 52** (diverifikasi via `get_campaign`), audit `campaign_run.education_linked` tercatat. Semua objek (campaign/group/run/audit) dihapus; flag page ibaraki & master 52 tak tersentuh.
- File diubah: `includes/Services/CampaignRunService.php`, `includes/Services/FlagPageService.php`, `pukat-app/src/features/campaigns/Wizard/Step3.jsx`, `pukat-app/src/pages/Simulation/Campaigns.jsx`, `pukat-app/src/utils/campaignLaunch.js` (+ `campaignLaunch.test.js`).

**G3 (as-built, 2026-10-12, verified live) — master dibuat saat Publish + edit-lock.**
- **Launch URL**: kolom `launch_url` (migrasi `1.23.0`), dropdown di editor dari `dynamic_domains`, divalidasi server.
- **Master at publish**: `FlagPageService::publish()` → setelah sync Page, panggil `refresh_master()` → `FlagPageSyncService::recreate_master()` (hapus master lama + create fresh, karena GoPhish **snapshot** halaman saat create — terverifikasi). Kolom `gophish_master_id` (migrasi `1.24.0`). Aset dummy template/smtp per entity (`from_address` harus email polos). Status `sync`+`master` dikembalikan ke UI.
- **Edit-lock (FR-13)**: `FlagPageSyncService::active_simulations_for_master($id)` (campaign dengan `next_campaign_id==id` & status ≠ Completed). `FlagPageService::assert_editable()` memblok save/publish/unpublish (409 `education_locked`) saat ada yang aktif; `get()` menyertakan `editable`+`active_simulations`. Editor menampilkan banner + mematikan kontrol (canEdit/canPublish efektif mem-fold `locked`).
- **Bugfix**: `push()` kini menyertakan `id` di body saat `PUT /api/pages/{id}` (GoPhish menolak tanpa itu → re-sync dulu diam-diam gagal).
- Verifikasi live (entity buangan, dibersihkan): publish→master dibuat; edit+republish→master recreate (id baru, snapshot V2); sim aktif chained→save/publish/unpublish 409 & `editable=false`; sim Completed→editable lagi.
- Catatan: `FlagPageService::ensure_master()` (idempoten, non-recreate) tetap ada untuk dipakai G3b bila perlu memastikan id tanpa recreate.

**G2 (as-built) — Publish langsung sync ke GoPhish sebagai Landing Page.** Keputusan desain: yang disync saat Publish hanya **objek Page** GoPhish (tidak butuh `url`); **master campaign** (yang butuh `url`) ditunda ke G3 saat domain diketahui.
- `FlagPageSyncService::inline_flag_images($html)` — ganti `src` tiap `<figure data-pukat-img="{id}">` dengan base64 (`FlagExampleService::data_uri`), hapus atribut identitas; konten di luar figure utuh; example hilang dibiarkan URL. `count_flag_images()` untuk cek kesiapan.
- `FlagPageSyncService::push($html, $entity, $existing_page_id?)` — buat/update Page `pukat-edu-<slug>` (`capture_credentials=true`, `redirect_url=''`), reuse by stored id → by name → create.
- `FlagPageService::publish()` auto-sync setelah publish lokal; gagal sync tidak membatalkan publish (status dikembalikan di `data.sync`). `FlagPageService::sync()` + `POST /flag-page/sync` untuk retry. Kolom `gophish_page_id`/`synced_at` di `pukat_flag_pages` (migrasi `1.22.0`, ALTER). Audit `flag_page.synced`.
- Frontend: `flagApi.syncPage`, `useSyncFlagPageMutation` (toast ikut `data.sync.ok`), badge "GoPhish: synced/not synced" + tombol "Sync to GoPhish" di editor.
- **Diverifikasi live** (2026-10-12): entity `ibaraki` ter-sync → GoPhish Page id 34 `pukat-edu-ibaraki`, HTML self-contained (base64 ada, `data-pukat-img` 0, `capture_credentials=true`), `gophish_page_id`/`synced_at` tersimpan.

**Launch URL (2026-10-12).** Karena master butuh `url` dan GoPhish tak bisa mengubahnya setelah create, URL dipilih eksplisit di editor lewat dropdown **"Launch URL (campaign education)"** — kolom `launch_url` di `pukat_flag_pages` (migrasi `1.23.0`), divalidasi terhadap `dynamic_domains.base_landing_url` yang user boleh lihat. Dropdown diisi `useMasterDynamicDomains()`.

**G3a — provisioning master education (SELESAI 2026-10-12, verified live di entity buangan).** `FlagPageSyncService::ensure_master($entity, $launch_url, $existing_master_id?)` idempoten:
- Reuse master by stored id → by name (`get_campaigns(is_master,education)`) → else create.
- `ensure_dummy_template`/`ensure_dummy_smtp` (nama `pukat-edu-tmpl-<slug>`/`pukat-edu-smtp-<slug>`, reuse by name). SMTP `from_address` **harus email polos** (fork menolak format "Nama <email>").
- `create_campaign`: `campaign_type=education`, `is_master=true`, `entity`, `url=launch_url`, `page{name=pukat-edu-<slug>}`, template/smtp by name, `launch_date` ≤ now → **In progress**.
- `FlagPageService::ensure_master($params,$user_id)` memvalidasi (published + `gophish_page_id` + `launch_url`), simpan `gophish_master_id` (migrasi `1.24.0`), audit `flag_page.master_ensured`. Belum dipanggil lewat endpoint/UI — dipakai G3b.
- Verifikasi live (zz-test): master dibuat (education/master/In progress/url benar), panggilan kedua idempoten (id sama), semua objek + row DB dibersihkan setelahnya. **Catatan GoPhish:** campaign men-snapshot page/template saat create, jadi master yang sudah ada tidak otomatis ikut perubahan halaman (perlu recreate) — limitation.

**G3b — wiring ke simulation launch (BELUM).** Saat simulation di-launch dengan education follow-up: panggil `ensure_master`, lalu set `next_campaign_id` simulation → master id (saat create atau `set_next_campaign`). Butuh pilihan "education follow-up" di wizard Step 3 (sekarang placeholder disabled) + perubahan alur `CampaignRunService` launch. **Baca `docs/api_campaignnew.md` dulu** (§3.3/§3.4 urutan & prasyarat).

**G1 (as-built, `includes/Services/GoPhishService.php`):** `get_campaigns($filters)` & `get_campaigns_summary($filters)` (filter `campaign_type`/`entity`/`is_master`, via helper `campaign_filters()`+`query_string()`); `add_recipients($id, $recipients, $send_email=false)` (POST `/recipients`); `reactivate_campaign($id)` (POST `/reactivate`); `set_next_campaign($id, $next_id)` (POST `/{id}/next`, Rilis 3); `complete_campaign($id, $confirm_master=false)` & `delete_campaign($id, $confirm_master=false)` menambah `?confirm_master=true`. Semua param baru opsional → pemanggil lama (`CampaignController`, `CampaignRunService`) tidak berubah. `create_campaign($data)` meneruskan `campaign_type`/`is_master`/`next_campaign_id` apa adanya. `php -l` bersih; logika filter/boolean diverifikasi. Status result `Added` dikenali nanti di G4 (sisi sync), bukan di klien.

**Smoke test live G1 — SUDAH dijalankan (2026-10-12, read-only).** Lewat `GoPhishService` di WP: `test_connection` sukses; `get_campaigns()` 31 campaign; filter `is_master=true` (2 master) & `campaign_type=education` (1) jalan; `get_campaigns_summary(is_master=true)` memuat `master_stats`. Artinya GoPhish terkonfigurasi (`pukat_gophish_url`/`_api_key` di Settings) dan fork-nya **Rilis 2/3** — klien G1 terbukti jalan live.

**Follow-up G1 (belum):** `CampaignRunService::find_gophish_asset_by_name($gp->get_campaigns(), …)` di lookup reuse campaign belum memakai `is_master=false`; aman sekarang (master belum dibuat), tapi tambahkan filter saat G2 agar master tak ikut ter-match.

**Keputusan G2 (2026-10-12): aset dummy template/page/smtp master dibuat per entity.** Sisa keputusan operasional: **akun/API key GoPhish** mana yang dipakai orchestrator (PRD §13 / dokumen §6) — de facto sudah ada satu key di Settings yang berfungsi; untuk produksi disarankan akun khusus orchestrator.

## 7. Di luar cakupan

Quiz, editor visual, riwayat versi/approval halaman, dan perubahan perilaku galeri Flag Example.
