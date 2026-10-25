# Implementation Plan: Quiz Module

Status: **Q1–Q7 selesai** (2026-10-21) — terverifikasi live, termasuk E2E rantai penuh
Date: 2026-10-20
Related PRD: `docs/PRD_QUIZ_MODULE.md`
Prasyarat bacaan: `docs/api_campaignnew.md` (§3.1.1 `POST /{id}/next`, §3.5.1 hasil gabungan, §4.2 pola rantai, §7 GoPhish tidak menilai quiz), `docs/IMPLEMENTATION_PLAN_FLAG_EDUCATION_PAGES.md` (G1–G4 as-built)

Pola yang diikuti: `FlagPageRepository`/`FlagPageService`/`FlagPageSyncService`/`FlagPageController` untuk halaman per-entity dan sinkronisasi GoPhish, `EntityProfileService` untuk scoping, `EntityFlagPageEditor` untuk editor, dan jalur `CampaignRunService::sync_results()` untuk skoring. **Tidak ada arsitektur baru** — yang benar-benar baru hanya answer key, linter, skoring, dan relink rantai.

## 1. Urutan

```text
Q1  Schema + RBAC
Q2  Backend bank soal + halaman quiz (termasuk linter)
Q3  Sync GoPhish: Landing Page + master quiz + edit-lock
Q4  Relink rantai dua arah + wiring wizard
Q5  Skoring dari results + kirim manual
Q6  Frontend area /post/quiz + reporting
Q7  QA + smoke test live
```

Q1–Q2 tidak menyentuh GoPhish sama sekali dan bisa di-review/smoke-test sendiri. Q3 baru butuh GoPhish hidup. **Q4 adalah fase paling rawan** dan satu-satunya tanpa preseden di G3b — jangan digabung ke fase lain. Q5 bergantung Q3 (snapshot answer key sudah tersimpan) tapi tidak bergantung Q4.

## 2. Q1 — Schema dan RBAC

**`includes/Core/Activator.php`**

- `create_tables()`: tambah `pukat_quiz_pages` persis PRD §7.1.
- Migrasi baru — **nomor berikutnya yang bebas adalah `1.28.0`** (terakhir terpakai `1.27.0`, kolom `type` dynamic domains). Verifikasi ulang saat implementasi, karena fitur lain bisa mendahului:
  1. `create_tables()` untuk membuat `pukat_quiz_pages`.
  2. `ensure_quiz_questions_entity_columns()` — ALTER idempoten PRD §7.2, lalu **hapus** baris tanpa `entity_name` (bank global legacy) dan catat jumlahnya lewat `error_log`. Aman karena fitur belum pernah rilis dan tidak ada konsumen (PRD §2.1).
  3. `ensure_quiz_results_scoring_columns()` — ALTER idempoten PRD §7.3. Perhatikan: `campaign_run_id` sudah ada dari `ensure_quiz_results_campaign_run_column()`; pastikan nullable sebelum menambahkan `UNIQUE (campaign_run_id, gophish_rid)`.
  4. `seed_rbac_defaults()` untuk resource `quiz_pages` yang baru.
- Ikuti pola helper `ensure_*_column()` yang sudah ada (cek `SHOW COLUMNS`/`SHOW INDEX` dulu, jangan ALTER buta).

**`includes/Services/PermissionRegistry.php`**

- Resource `quiz_pages` di group **Post Sim**: `view_gate => shared`, actions `edit => operator`, `publish => operator`, `invite => operator`.
- Bank soal **tidak** dapat resource baru — tetap `post_sim.view`/`post_sim.manage` yang sudah ada (PRD §8).

Smoke Q1: aktivasi ulang plugin di DB bersih **dan** di DB yang sudah punya `pukat_quiz_*` lama; cek kolom + indeks terbentuk, migrasi dijalankan dua kali tidak error, role operator punya `pukat_quiz_pages_edit/_publish/_invite`.

## 3. Q2 — Backend bank soal, halaman quiz, linter

**`includes/Repositories/QuizQuestionRepository.php`** (baru)

- `list_for_entity( string $entity, bool $only_active = false )`, `find( int $id )`, `create`, `update`, `delete`, `find_by_input_name( string $entity, string $input_name )`.
- Pencocokan entity case-insensitive seperti `FlagPageRepository::find_for_entity()`. Hindari `SELECT *` untuk list (AGENTS.md §5.2) — kolom eksplisit.

**`includes/Repositories/QuizPageRepository.php`** (baru)

- `find_for_entity()`, `create()`, `update()`. Cermin `FlagPageRepository`.

**`includes/Services/QuizQuestionService.php`** (baru)

- Entity dari server (`target_entity()` seperti `FlagPageService`), `enforce_entity_editable()` untuk tulis.
- Validasi: `input_name` pola `^answer_[a-z0-9_]{1,50}$` + unik per entity (422 dengan pesan yang menyebut soal yang menabrak), minimal 2 opsi, minimal 1 opsi `correct`, `value` opsi unik dalam satu soal, `difficulty` 1–5.
- `answer_key_for_entity( string $entity )` → `[ input_name => ['question_id' => int, 'correct' => string[]] ]` dari soal **aktif**. Ini sumber snapshot dan sumber starter.
- Audit `quiz_question.created/updated/deleted`.

**`includes/Services/QuizPageLinter.php`** (baru) — fungsi murni, tanpa DB, supaya mudah di-unit-test.

- `inspect( string $html, array $answer_key ): array` → `[ 'ok' => bool, 'issues' => [ ['code' => …, 'input_name' => …, 'message' => …], … ] ]`.
- Kode masalah: `missing_form` (tidak ada `<form method="post">`), `input_without_key`, `key_without_input`, `duplicate_input`.
- Ekstraksi input memakai `DOMDocument` (bukan regex) atas semua `input`/`select`/`textarea` ber-`name` berawalan `answer_`; `libxml_use_internal_errors(true)` karena HTML user bisa tidak well-formed, dan **kegagalan parse bukan berarti lolos** — laporkan sebagai masalah.
- Pesan `duplicate_input` **wajib** menyebut jebakan bilingual: label ID/EN harus berbagi satu input, bukan menduplikasi blok beserta `name`-nya (PRD §5.2).

**`includes/Services/QuizPageService.php`** (baru) — cermin `FlagPageService`, tambah snapshot + linter.

- `get( $params )` — halaman kosong (`id: null`) bila entity belum punya; sertakan `editable`, `active_simulations`, `linter` (hasil dry-run atas draft), `answer_key_count`.
- `save( $params, $user_id )` — `assert_editable()` dulu (409 `quiz_locked`), validasi `html_body` ≤ `MAX_HTML_BYTES` (4 MB), `title` ≤ 255, `pass_score` 0–100 atau null, `launch_url` harus domain bertipe **`quiz`** yang boleh dilihat user, `thankyou_url` URL valid. Upsert; **tidak** menyentuh kolom `published_*`. Audit `quiz_page.saved`.
- `validate( $params )` — linter dry-run tanpa menyimpan.
- `publish( $params, $user_id )` — urutan PRD FR-7: linter (422 bila gagal) → salin `html_body` → `published_html` + snapshot `published_answer_key`/`published_pass_score` → sync (Q3) → master (Q3) → relink (Q4). Kegagalan di langkah sync/master/relink dikembalikan sebagai `data.sync`/`data.master`/`data.chain`, **tidak** membatalkan publish lokal.
- `unpublish( $params, $user_id )` — kosongkan `published_html` + snapshot, lepas rantai (Q4).
- `effective_pass_score( ?int $run_override, array $page_row )` → override run → `pass_score` entity → option `pukat_quiz_pass_score` (70). Dipakai Q5.
- `published_master_id_for_entity( string $entity )` — read-only, **tanpa edit-gate**, sejajar `FlagPageService::published_master_id_for_entity()` (dipakai saat launch; pemanggil sudah lolos cek run-level).

**`includes/Api/QuizPageController.php`** (baru) — route PRD §8 untuk `/quiz-page*`, `require_capability()` seperti `FlagPageController`.

**`includes/Api/QuizController.php`** (diubah)

- Bank soal: `GET`/`POST`/`PUT`/`DELETE /quiz/questions[/{id}]` didelegasikan ke `QuizQuestionService` (entity-scoped). `PUT` adalah route baru.
- **Hapus** `POST /quiz/submit` dan `submit_quiz()` (PRD §8). Sekalian hapus `quizApi.submit` di frontend (Q6).
- `get_results()` dirombak jadi `GET /quiz/results` dengan filter `entity`/`campaign_run_id` dan kolom eksplisit (bukan `SELECT *`, dan tanpa mengirim payload `answers` di ringkasan).

**`pukat-app/src/utils/quizPageTemplate.js`** (baru, fungsi murni + test)

- `buildStarterHtml( questions )` — bilingual ID/EN dengan toggle bahasa, `<form method="post">`, hidden `{{.RId}}`, satu blok per soal, `name` = `input_name`, **satu set input dipakai dua bahasa**, slot teks EN kosong. Adaptasi `buildStarterHtml()` education + struktur soal.
- Pakai ulang `buildFigureHtml()`/`insertAtCursor()` dari `utils/flagPageTemplate.js` — jangan duplikasi.
- `quizPageStatus( page )` — label/tone status.

Smoke Q2: `php -l`; CRUD soal lintas role (operator vs viewer vs entity lain); `input_name` duplikat → 422; save/publish halaman tanpa menyentuh GoPhish (publish akan melapor sync gagal — itu yang diharapkan sebelum Q3); unit test linter untuk empat kode masalah + HTML tidak well-formed.

## 4. Q3 — Sync GoPhish: Landing Page, master quiz, edit-lock

**Generalisasi dulu, lalu tambah.** `FlagPageSyncService::inline_flag_images()`/`count_flag_images()`/`replace_first_img_src()`/`slug()` tidak khusus education. Pindahkan ke helper bersama (mis. `includes/Services/GoPhishHtmlAssets.php`) dan biarkan `FlagPageSyncService` memanggilnya, supaya tidak ada dua implementasi base64 yang bisa berbeda perilaku. Perubahan ini harus **tanpa perubahan perilaku** untuk education — ini syarat review Q3.

**`includes/Services/QuizPageSyncService.php`** (baru) — cermin `FlagPageSyncService`:

| Education | Quiz |
|---|---|
| `page_name()` → `pukat-edu-<slug>` | `pukat-quiz-<slug>` |
| `master_name()` → `pukat-edu-master-<slug>` | `pukat-quiz-master-<slug>` |
| `ensure_dummy_template()` → `pukat-edu-tmpl-<slug>` | `pukat-quiz-tmpl-<slug>` |
| `ensure_dummy_smtp()` → `pukat-edu-smtp-<slug>` | `pukat-quiz-smtp-<slug>` |

- `push( $html, $entity, $existing_page_id )` — `capture_credentials=true` (wajib; kalau `false` GoPhish membuang atribut `name` → jawaban hilang), `capture_passwords=false`, `redirect_url` = **thank-you URL** (ini satu-satunya beda material dari education, yang mengosongkannya). Reuse by stored id → by name → create. **Sertakan `id` di body saat `PUT /api/pages/{id}`** — bug yang sudah pernah menggigit di G2.
- `ensure_master()` / `recreate_master()` — `campaign_type=quiz`, `is_master=true`, `entity`, `url=launch_url`, `page{name}` + dummy template/smtp by name, `launch_date` ≤ now → In progress, `next_campaign_id=0` (quiz adalah ujung rantai). Ingat: SMTP `from_address` **harus email polos**, fork menolak format `Nama <email>`.
- `active_simulations_for_quiz( int $quiz_master_id, int $education_master_id )` — campaign non-Completed yang `next_campaign_id` menunjuk master quiz **atau** menunjuk master education yang merantai ke master quiz itu. Ini lebih luas dari `FlagPageSyncService::active_simulations_for_master()` dan jadi dasar `quiz_locked` (PRD FR-11).

**`includes/Services/QuizPageService.php`** (diubah) — `assert_editable()`, `refresh_master()`, `sync()` + `POST /quiz-page/sync` untuk retry. Simpan `gophish_page_id`/`gophish_master_id`/`synced_at`. Audit `quiz_page.synced`, `quiz_page.master_recreated`.

Smoke Q3 (**entity buangan, bukan entity nyata**): publish → Page `pukat-quiz-<slug>` ada, HTML self-contained (base64 ada, `data-pukat-img` 0), `capture_credentials=true`, `redirect_url` = thank-you URL; master ada dengan tipe/master/url benar dan In progress; publish ke-2 → master id berubah (recreate); verifikasi education **tidak berubah perilaku** setelah generalisasi helper. Bersihkan semua objek + row setelahnya.

## 5. Q4 — Relink rantai dua arah + wizard

Fase paling rawan. Masalahnya: **kedua master di-recreate tiap publish**, jadi `next_campaign_id` yang menunjuk id lama jadi basi tanpa ada yang error.

**`includes/Services/QuizChainService.php`** (baru) — satu tempat untuk seluruh logika rantai, supaya tidak tersebar di dua service halaman:

- `link_education_to_quiz( string $entity )` — resolve master education + master quiz entity, lalu `GoPhishService::set_next_campaign( $edu_id, $quiz_id )`. No-op (bukan error) bila salah satu belum published.
- `unlink_education_from_quiz( string $entity )` — `set_next_campaign( $edu_id, 0 )`. Dipakai saat unpublish quiz.
- `resolve_simulation_next( string $entity, bool $education_enabled, bool $quiz_enabled ): int` — education on → master education; education off + quiz on → master quiz; keduanya off → 0.

**Pemanggilan:**

- `QuizPageService::publish()` → setelah master quiz baru dibuat, `link_education_to_quiz()`. Hasil masuk `data.chain`; gagal = **warning**, bukan pembatal.
- `FlagPageService::publish()` (diubah) → setelah `refresh_master()`, panggil `link_education_to_quiz()` juga. **Tanpa ini, setiap publish education memutus rantai ke quiz.**
- `QuizPageService::unpublish()` → `unlink_education_from_quiz()`.
- `CampaignRunService::launch()` (diubah) → generalisasi `link_education_follow_up()` (G3b) menjadi `link_follow_up_chain()` yang memakai `resolve_simulation_next()`. Pertahankan kontrak G3b: **warn, bukan block** — campaign GoPhish sudah ada saat linking dijalankan. Perluas `data.education_link` menjadi `data.follow_up_link` yang menyebut tahap tujuan, dan jaga agar frontend lama tidak pecah.
- `CampaignRunService::sanitize_follow_up()` (diubah) → `quiz_enabled` (default `false`) + `quiz_pass_score` (null atau 0–100).

**Frontend:** `Step3.jsx` — baris quiz jadi toggle live, independen dari education; aktif hanya bila `useQuizPage(runEntity)` melaporkan `status=published` + `gophish_master_id`, selain itu disabled + hint "Publish halaman quiz dulu". Field override pass score muncul saat quiz on. `campaignLaunch.js` meneruskan `quiz_enabled`/`quiz_pass_score`; `Campaigns.jsx` memfold ketersediaan seperti `withEffectiveEducation()` yang sudah ada (jadikan `withEffectiveFollowUp()`), untuk launch **dan** save-draft. `surfaceEducationLinkResult()` diperluas ke hasil rantai yang baru.

Smoke Q4 (**entity buangan**): (a) publish quiz → `next_campaign_id` master education menunjuk master quiz; (b) publish education lagi → master education baru **tetap** menunjuk master quiz (ini regresi yang paling mungkin terjadi); (c) publish quiz lagi → master education menunjuk master quiz **yang baru**; (d) unpublish quiz → `next_campaign_id` education jadi 0; (e) launch simulation dengan quiz on + education off → `next_campaign_id` sim = master quiz; (f) keduanya on → = master education. Verifikasi lewat `get_campaign()`, bukan lewat asumsi.

## 6. Q5 — Skoring + kirim manual

**`includes/Services/QuizScoringService.php`** (baru)

- `score_payload( array $payload, array $answer_key, int $pass_score ): array` — fungsi murni: normalisasi nilai payload (GoPhish mengirim array per field), bandingkan sebagai **himpunan** terhadap `correct` (soal boleh punya >1 kunci), hasilkan `correct_count`/`question_count`/`score`/`passed`. Input tak dikenal **diabaikan** dan tidak menambah `question_count`.
- `record_from_results( array $timeline_events, array $context ): int` — untuk tiap event `Submitted Data (Quiz)`: ambil `rid` (sudah ditulis-ulang ke entry asal, §3.5.1), `details.payload`, lalu upsert `pukat_quiz_results` lewat `UNIQUE (campaign_run_id, gophish_rid)`. Simpan `question_count`, `correct_count`, `pass_score_used`, `quiz_page_id`, `gophish_campaign_id`, `entity_name`.
- Snapshot yang dipakai adalah `published_answer_key` **halaman saat ini**. Batasan yang harus ditulis di kode: kalau halaman di-republish dengan kunci berbeda di tengah kampanye, hasil lama tidak dinilai ulang (row yang sudah ada tidak disentuh nilainya) — edit-lock FR-11 yang mencegah skenario ini terjadi.
- Audit `quiz.scored` (agregat per sync, bukan per row, supaya audit tidak membanjir).

**`includes/Services/CampaignRunService.php`** (diubah)

- Di jalur `sync_results()`/`sync_results_for_run()` yang sudah mem-parse `QUIZ_EVENT_TYPE`, panggil `QuizScoringService::record_from_results()`. **Tidak ada call API GoPhish baru** — timeline-nya sudah di tangan.
- Resolve pass score efektif lewat `QuizPageService::effective_pass_score()` dengan `follow_up_json.quiz_pass_score` sebagai override.
- Setelah hasil tersimpan, picu risk scoring seperti jalur yang sudah ada. **Jangan** ubah rumus `RiskScoringService`.

**`includes/Services/RiskScoringService.php`** (diubah, minimal) — `compute_campaign_run_quiz_score()` harus memilih **percobaan terakhir** per target sekarang bahwa bisa ada >1 row per email (`ORDER BY completed_at DESC, id DESC LIMIT 1`). Query lama yang mengandaikan satu row perlu dicek ulang.

**Kirim manual (FR-15)** — `QuizInviteService` + `POST /quiz/invite`: buat group GoPhish dari target terpilih, lalu campaign quiz `is_master=false` dengan template email + sending profile pilihan operator dan `page{name}` = Landing Page quiz entity. Hasilnya ikut dinilai lewat `record_from_results()` dengan `campaign_run_id = NULL`. Audit `quiz.invited`.

> **Sebelum fase ini dikunci, verifikasi Open Question PRD §12**: apakah `add_recipients(send_email=true)` memakai template snapshot atau terkini. Kalau terkini, kirim manual bisa disederhanakan jadi `add_recipients` ke master dan `QuizInviteService` tidak perlu ada.

Smoke Q5: unit test `score_payload()` (semua benar, sebagian, kosong, multi-kunci, input tak dikenal, payload array); sync dua kali → jumlah row tetap (idempoten); dua kedatangan → dua row + risk pakai yang terakhir; override pass score per run terbukti di `pass_score_used`.

## 7. Q6 — Frontend

- `api/quizApi.js` — ganti isinya: `getPage`, `savePage`, `validatePage`, `publishPage`, `unpublishPage`, `syncPage`, `questions`, `createQuestion`, `updateQuestion`, `deleteQuestion`, `invite`, `results`. **Hapus** `submit`.
- `api/queryKeys.js` — prefix `quiz` dengan `quiz.page(params)`, `quiz.questions(params)`, `quiz.results(params)`.
- `hooks/queries/useQuizQueries.js` + `hooks/mutations/useQuizMutations.js` — pola `useFlagQueries`/`useFlagMutations`, termasuk `refetchOnWindowFocus: false` pada `useQuizPage` supaya refetch tidak menimpa ketikan.
- `features/quiz/components/QuestionBankPanel.jsx` — tabel/list soal + drawer editor soal (`Drawer` + `Input`/`Select`/`Checkbox` yang sudah ada). Tidak memanggil mutation sendiri kalau page bisa mengirim callback (AGENTS.md §4.2).
- `features/quiz/components/QuizPageEditor.jsx` — adaptasi `EntityFlagPageEditor`: header Cancel/Save Draft/Publish, panel atas (nama, pass score, Launch URL difilter tipe `quiz`, thank-you URL, pemilih gambar + Insert at cursor, status + sync + status rantai, laporan linter), panel bawah (HTML Code/Live Preview + Use starter template + Check + Fullscreen via `Portal`).
- `features/quiz/components/SendQuizDialog.jsx` — dialog kirim manual; sebutkan eksplisit bahwa email benar-benar terkirim.
- `pages/PostSimulation/Quiz.jsx` — ganti demo hardcoded jadi orchestration layer: sub-tab Question Bank / Quiz Page, query + mutation, permission props dari `quiz_pages.edit`/`.publish`/`.invite` dan `post_sim.manage`.
- `features/campaigns/Reports/QuizReportPane.jsx` — ganti mock dengan data nyata: ringkasan, tabel per target (riwayat percobaan), analisis per soal dengan denominator per soal.
- Jangan sentuh `assets/dist`.

## 8. Q7 — QA

- `php -l` untuk seluruh file PHP baru/diubah.
- `npm run lint` dan `npm run test` dari `pukat-app`; `npm run build` **tidak** dijalankan (menulis ke `assets/dist`) kecuali user minta build artifact.
- Unit test baru: `quizPageTemplate.test.js` (starter dari soal, satu set input untuk dua bahasa, status), linter (empat kode masalah + HTML rusak), `score_payload()`.
- REST smoke sesuai AGENTS.md §7.2: success, permission denied, invalid input, dan **tidak ada field sensitif** di response (payload `answers` tidak ikut di ringkasan).
- Smoke live: **selalu pakai entity buangan + campaign buangan, jangan pernah entity/master produksi**, dan bersihkan semua objek GoPhish + row DB setelahnya. Pola ini sudah dipakai G3/G3b/G4 — ikuti persis, termasuk mencatat bukti verifikasi di dokumen ini setelah dijalankan.
- E2E submit dari nol (seperti G4): POST langsung ke phish server sebagai target, lewati rantai sim → education → quiz, lalu pastikan `Submitted Data (Quiz)` tergabung ke hasil sim dan row `pukat_quiz_results` terbentuk dengan skor benar.

## 9. File

| Baru | Diubah |
|---|---|
| `includes/Repositories/QuizQuestionRepository.php` | `includes/Core/Activator.php` (tabel + migrasi `1.28.0`) |
| `includes/Repositories/QuizPageRepository.php` | `includes/Services/PermissionRegistry.php` (resource `quiz_pages`) |
| `includes/Services/QuizQuestionService.php` | `includes/Core/Plugin.php` (registrasi controller) |
| `includes/Services/QuizPageService.php` | `includes/Api/QuizController.php` (bank soal, hapus `/quiz/submit`, rombak results) |
| `includes/Services/QuizPageLinter.php` | `includes/Services/FlagPageSyncService.php` (helper base64 digeneralisasi) |
| `includes/Services/QuizPageSyncService.php` | `includes/Services/FlagPageService.php` (relink saat publish) |
| `includes/Services/QuizChainService.php` | `includes/Services/CampaignRunService.php` (follow-up quiz, skoring, chain) |
| `includes/Services/QuizScoringService.php` | `includes/Services/RiskScoringService.php` (percobaan terakhir) |
| `includes/Services/QuizInviteService.php` | `pukat-app/src/api/quizApi.js`, `api/queryKeys.js` |
| `includes/Api/QuizPageController.php` | `pukat-app/src/pages/PostSimulation/Quiz.jsx` |
| `includes/Services/GoPhishHtmlAssets.php` | `pukat-app/src/features/campaigns/Reports/QuizReportPane.jsx` |
| `pukat-app/src/features/quiz/components/QuestionBankPanel.jsx` | `pukat-app/src/features/campaigns/Wizard/Step3.jsx` |
| `pukat-app/src/features/quiz/components/QuizPageEditor.jsx` | `pukat-app/src/pages/Simulation/Campaigns.jsx` |
| `pukat-app/src/features/quiz/components/SendQuizDialog.jsx` | `pukat-app/src/utils/campaignLaunch.js` (+ test) |
| `pukat-app/src/hooks/queries/useQuizQueries.js` | |
| `pukat-app/src/hooks/mutations/useQuizMutations.js` | |
| `pukat-app/src/utils/quizPageTemplate.js` (+ test) | |

## 10. Risiko

- **Relink rantai (Q4) adalah risiko utama.** Rantai bisa putus tanpa error yang terlihat: publish education menghasilkan master baru, dan `next_campaign_id` ke quiz hilang. Kampanye tetap jalan, hanya quiz-nya tidak pernah tercapai — ketahuan setelah data hilang. Mitigasi: status rantai ditampilkan eksplisit di editor (PRD §9), relink dipanggil dari **kedua** sisi publish, dan smoke Q4 (b)/(c) wajib dijalankan.
- **HTML bebas vs answer key.** Linter adalah satu-satunya pengaman. Kalau ekstraksi input salah (HTML tidak well-formed, input di dalam komentar, `name` dinamis dari JS), publish bisa lolos padahal jawaban tak ternilai. Karena itu: `DOMDocument` bukan regex, dan gagal parse diperlakukan sebagai masalah, bukan sebagai lolos.
- **Generalisasi helper base64 menyentuh education yang sudah live.** Harus benar-benar tanpa perubahan perilaku; regresi di sini merusak fitur yang sudah terverifikasi. Review Q3 harus membandingkan output `inline_flag_images()` sebelum/sesudah untuk HTML yang sama.
- **Edit-lock lebih luas dari education.** Deteksi harus mencakup simulasi yang menunjuk master education yang merantai ke quiz, bukan hanya yang menunjuk master quiz. Kalau terlewat, halaman quiz bisa diedit di tengah kampanye dan master di-recreate → snapshot basi + rantai putus.
- **Idempotensi skoring.** Tanpa `UNIQUE (campaign_run_id, gophish_rid)` yang benar-benar aktif, tiap sync menambah row dan rata-rata skor jadi salah. `campaign_run_id` nullable untuk hasil undangan berarti pasangan `(NULL, rid)` perlu ditangani sadar — di MySQL, NULL tidak bentrok di unique index, jadi hasil undangan butuh jalur upsert sendiri (mis. berbasis `gophish_campaign_id` + `gophish_rid`). **Putuskan ini di awal Q5**, jangan setelah data masuk.
- **Jawaban target adalah input publik.** Payload dari form bisa berisi apa saja; sanitasi sebelum simpan dan jangan pernah merender `answers` sebagai HTML.
- **Baris bank legacy dihapus saat migrasi.** Tidak bisa di-undo. Aman karena tidak ada konsumen (PRD §2.1), tapi jumlah yang dihapus harus dicatat dan disebut di catatan rilis.
- **Komparabilitas skor** bila subset soal nanti diizinkan — sudah dimitigasi dengan `question_count`/`correct_count` per row, tapi jangan tambahkan subset tanpa menyelesaikan Open Question PRD §12 lebih dulu.

## 11. Di luar cakupan

- Menampilkan skor/pembahasan ke target setelah submit.
- Randomisasi per target dan subset soal per run (Open Question PRD §12).
- Soal bersama lintas entity (master question yang di-assign ke entity).
- **Quiz Builder tanpa koding (v2).** v1 memakai editor HTML bebas + starter. Arah v2 (PRD §13): operator membuat halaman tanpa koding — pilih **quiz template** dari katalog yang dibuat administrator, pilih soal dari bank (urutan tampil = urutan pemilihan), HTML digenerate. Belum dikerjakan; menunggu Open Questions PRD §13.7 (terutama nasib `html_body` bebas per entity dan bentuk penanda slot). Sketsa dampak: tabel baru `pukat_quiz_templates` + migrasi, kolom `template_id`/`selected_question_ids_json` di `pukat_quiz_pages`, area admin CRUD template (editor HTML v1 pindah ke sini), builder di tab Quiz Page, generator menggantikan `quizPageTemplate.js` sebagai sumber `html_body`, dan snapshot answer key diturunkan dari soal terpilih terurut. Linter v1 tetap dijalankan sebagai regression guard, bukan beban operator. Saling bergantung dengan tipe soal bergambar.
- **Tipe soal bergambar.** v1 hanya text-only; tipe kedua (soal dengan gambar) sudah diputuskan ada tapi desainnya belum (PRD §11 + Open Question §12). Sketsa dampaknya bila nanti dikerjakan: migrasi `question_type` di `pukat_quiz_questions`, field tipe + pemilih gambar di `QuestionBankPanel`, blok bergambar di `quizPageTemplate.js`, aturan baru di `QuizPageLinter` (gambar soal hilang dari HTML harus memblokir publish), cek ukuran base64 terhadap batas 4 MB di `QuizPageSyncService`/`GoPhishHtmlAssets`, dan teks pengganti di rekap per soal.
- Riwayat versi halaman quiz, approval, dan assignment ke user lain.
- Menambahkan `quiz_at`/skor quiz ke export CSV/PDF (`CampaignDataExportService`) — kolomnya eksplisit; enhancement terpisah, sama seperti yang ditunda di G4.
- Perubahan rumus risk scoring.
- Kedatangan tanpa submit.

## 12. As-built log

### Q1 — schema dan RBAC (SELESAI 2026-10-21)

- `Activator.php`: `pukat_quiz_pages` dibuat di `create_tables()`; helper `ensure_quiz_questions_entity_columns()` dan `ensure_quiz_results_scoring_columns()` dipanggil dari `create_tables()` **dan** dari migrasi **`1.28.0`** (nomor `1.27.0` memang yang terakhir terpakai, seperti dugaan plan).
- `launch_url`/`thankyou_url` dibuat `VARCHAR(500)`, bukan 255 seperti di PRD §7.1 — menyesuaikan `pukat_flag_pages.launch_url` yang sudah ada.
- `pukat_quiz_results` mendapat **dua** unique key, bukan satu: `run_rid (campaign_run_id, gophish_rid)` dan `invite_rid (gophish_campaign_id, gophish_rid)`. Risiko "NULL tidak bentrok di unique index" di §10 diputuskan di sini, bukan ditunda ke Q5: hasil dari campaign undangan dideduplikasi lewat key kedua.
- `PermissionRegistry`: resource `quiz_pages` (group Post Sim) dengan `view` gate `shared`, `edit`/`publish`/`invite` seed `operator`.
- **Gotcha dbDelta (menghabiskan satu putaran debug):** `dbDelta()` memecah statement pada `;`, jadi **tidak boleh ada titik koma di dalam string `COMMENT`** pada CREATE TABLE. Komentar `'per-entity; NULL = global option'` membelah query jadi dua dan tabel gagal dibuat — sementara `pukat_db_version` **tetap naik**, sehingga migrasi tidak mengulang sendiri. Dampak hanya di DB dev (kode belum pernah di-commit); pemulihannya: set `pukat_db_version` kembali ke `1.27.0`, lalu `maybe_upgrade()` lagi. Hati-hati pola ini untuk migrasi berikutnya.
- Verifikasi: migrasi dijalankan dari `1.27.0` **dua kali** tanpa error (idempoten), semua kolom + indeks terbentuk, dan `pukat_operator`/`pukat_admin` memegang `quiz_pages.view/edit/publish/invite` sementara `pukat_viewer` hanya `view`.

### Q2 — bank soal, halaman quiz, linter (SELESAI 2026-10-21)

- File baru sesuai §9: `QuizQuestionRepository`, `QuizPageRepository`, `QuizQuestionService`, `QuizPageLinter`, `QuizPageService`, `QuizPageController`; `QuizController` ditulis ulang untuk bank soal; `Plugin.php` mendaftarkan controller baru.
- `POST /quiz/submit` **dihapus** beserta `submit_quiz()` (PRD §8). Diverifikasi 404 di smoke test.
- `QuizPageService::publish()` di Q2 baru melakukan linter + snapshot + publish lokal. Sync/master/relink menyusul di Q3/Q4.
- **Linter — temuan penting:** identitas node DOM **tidak boleh** memakai `spl_object_id()`. Setiap akses `parentNode` mengembalikan wrapper PHP baru, jadi satu radio group terbaca sebagai beberapa grup dan halaman yang benar ditolak sebagai `duplicate_input`. Diganti `getNodePath()`. Aturan duplikat yang berlaku: radio/checkbox dinilai per `fieldset`/`li`/`form`/`body` terdekat (sengaja **bukan** `div`, lihat komentar di kode), sementara `text`/`select`/`textarea` dinilai per elemen.
- **Bugfix validasi:** `thankyou_url` awalnya divalidasi dengan `wp_http_validate_url()`, yang **melakukan resolusi DNS** dan menolak host yang tidak resolve dari server — padahal halaman terima kasih justru biasanya portal internal. Diganti validasi bentuk (`wp_parse_url` + scheme http/https + host wajib).
- `launch_url` divalidasi hanya terhadap `dynamic_domains` bertipe **`quiz`**, memakai kolom `type` dari migrasi `1.27.0`.
- Frontend: `utils/quizPageTemplate.js` (+ `quizPageTemplate.test.js`, 7 test). Starter digenerate dari bank soal, satu `<fieldset>` per soal, **satu set input dipakai dua bahasa** (justru pola yang dipakai starter education `answer_1`), `<form method="post">`, hidden `{{.RId}}`. `escapeHtml`/`insertAtCursor`/`buildFigureHtml` di-**re-export** dari `flagPageTemplate.js`, tidak diduplikasi.
- QA: `php -l` bersih untuk seluruh file PHP baru/diubah. `tools/smoke-quiz-module.php` (baru) **33/33 PASS** — bank soal lintas role/entity, linter empat kode masalah, publish 422 saat mismatch, snapshot tidak tersentuh saat publish gagal, pass score/thank-you URL tersimpan, unpublish mengosongkan snapshot, `/quiz/submit` 404, dan semua row/user/role buangan terhapus. Entity yang dipakai `ZZSmokeQuizOwn`/`ZZSmokeQuizOther` — tidak pernah entity nyata.
- `npm run test` 137 lulus (18 file). `npm run lint` menyisakan **1 warning pra-ada** di `Performing.jsx` (file tidak disentuh fase ini); karena `--max-warnings 0`, perintahnya exit non-zero — kondisi yang sama seperti sebelum fase ini dimulai.
- Catatan utang kecil: `GET /quiz/results/{campaign_id}` masih men-scope per campaign id saja (tanpa entity), persis seperti route lama. Ditandai TODO di kode dan diselesaikan di Q5 bersama `QuizResultRepository`.

### Q3 — sync GoPhish (SELESAI 2026-10-21, verified live)

- `GoPhishHtmlAssets` (baru) memegang `inline_flag_images()`/`count_flag_images()`/`replace_first_img_src()`/`slug()`; `FlagPageSyncService` memanggilnya lewat delegasi dan tetap mengekspos dua method lamanya. **Syarat review §10 dipenuhi:** output `inline_flag_images()` dibandingkan sebelum/sesudah refactor untuk 9 bentuk HTML (substitusi normal, example hilang, atribut lain, img di luar figure, dua figure, src kutip tunggal, markup bersarang, tanpa src, tag uppercase) — **byte-identik**.
- Catatan perilaku lama yang ikut terdokumentasi dari baseline itu: hanya `src` ber-**kutip ganda** yang disubstitusi (sesuai yang di-emit `buildFigureHtml`); `src='...'` dibiarkan. Tidak diubah di fase ini.
- `QuizPageSyncService` (baru) cermin `FlagPageSyncService` dengan nama `pukat-quiz-<slug>` / `pukat-quiz-master-<slug>` / `pukat-quiz-tmpl-<slug>` / `pukat-quiz-smtp-<slug>`. Dua beda material: `redirect_url` = thank-you URL (education mengosongkannya), dan master `campaign_type=quiz` dengan `next_campaign_id=0`.
- `active_simulations_for_quiz( $quiz_master_id, $education_master_id )` lebih luas dari padanan education: campaign yang chained ke master education **yang merantai ke quiz ini** ikut mengunci, dan kedua master sendiri dikecualikan (master memang permanen In progress).
- `QuizPageService` mengambil `FlagPageRepository` (bukan `FlagPageService`) untuk mencari master education — mencegah siklus konstruksi begitu Q4 menyambungkan chain service ke kedua service halaman.
- Smoke `tools/smoke-quiz-gophish.php` (baru): **30/30 PASS** di entity buangan `ZZQuizGp` — page tersync dengan `capture_credentials=true` + redirect thank-you + `data-pukat-img` tersapu, master `quiz`/`is_master`/url/In progress/`next=0`/entity, re-publish mengganti id master tapi page di-update in place (hanya satu master bernama sama), 409 `quiz_locked` untuk save/publish/unpublish saat ada simulasi chained, editable lagi setelah simulasi dihapus. Semua objek dibersihkan, master education produksi diverifikasi utuh.

### Q4 — relink rantai dua arah + wizard (SELESAI 2026-10-21, verified live)

- `QuizChainService` (baru): `link_education_to_quiz()`, `unlink_education_from_quiz()` (hanya melepas link yang memang menunjuk quiz entity ini), `resolve_simulation_target()`. Membaca kedua halaman lewat repository.
- Dipanggil dari **empat** tempat: `QuizPageService::publish()`, `QuizPageService::sync()` (juga me-recreate master), `QuizPageService::unpublish()` (unlink), dan `FlagPageService::publish()` — yang terakhir adalah inti fase ini: tanpa itu setiap publish education memutus rantai ke quiz.
- `CampaignRunService`: `link_education_follow_up()` → `link_follow_up_chain()` (stage-aware). Response `launch()` kini membawa `follow_up_link`, dan `education_link` dipertahankan sebagai alias supaya klien G3b tidak pecah. Audit action tetap `campaign_run.education_linked` (ditambah field `stage`) agar riwayat audit tidak terbelah.
- **Perubahan default yang perlu diketahui:** `sanitize_follow_up()` dulu men-default `quiz_enabled` ke **true** (era switch placeholder). Sekarang **false** — follow-up harus diminta. Run lama yang tersimpan masih membawa `true`; chaining tetap butuh master quiz published, jadi entity tanpa halaman quiz tidak terpengaruh. `quiz_pass_score` (nullable, 0–100) ikut disimpan.
- Wizard Step 3: baris quiz jadi toggle live + field override pass score, independen dari education; `Campaigns.jsx` `withEffectiveEducation()` → `withEffectiveFollowUp()` (memfold ketersediaan **dua** stage untuk launch dan save-draft), `surfaceEducationLinkResult()` → `surfaceFollowUpLinkResult()` (menyebut stage).
- Data layer FE ditarik maju dari Q6 karena Q4 membutuhkannya: `api/quizApi.js` (ditulis ulang), `queryKeys.quiz.*`, `useQuizQueries.js`, `useQuizMutations.js`.
- Smoke `tools/smoke-quiz-chain.php` (baru): **26/26 PASS** di entity buangan `ZZQuizChain` — skenario (a)–(f) plus dua yang muncul saat menulisnya: publish quiz tanpa education page = no-op yang melapor jujur, dan **halaman quiz terkunci oleh simulasi yang hanya chained ke education** (jalur `via=education`; ini sempat membuat test (d) gagal sampai urutannya diperbaiki — bukti locknya bekerja). Regresi terpenting ((b) publish education ulang **tetap** menunjuk master quiz, (c) publish quiz ulang me-repoint education) terbukti terhadap `get_campaign()` nyata.

### Q5 — skoring + kirim manual (SELESAI 2026-10-21)

- `QuizEventTypes` (baru) memegang label `Submitted Data (Quiz|Education|Chained)`; `CampaignRunService` memakai konstanta itu, jadi tidak ada dua definisi string yang bisa berbeda.
- `QuizResultRepository` (baru) memegang idempotensi: `upsert()` mencari baris lewat `(campaign_run_id, gophish_rid)` atau — untuk hasil undangan tanpa run — `(gophish_campaign_id, gophish_rid)`.
- `QuizScoringService` (baru): `score_payload()` murni (himpunan, mendukung >1 kunci, mengabaikan field asing), `record_from_results()` (grading dari timeline yang sudah di tangan, tanpa call API baru), `per_question_breakdown()` (denominator per soal).
- `CampaignRunService::sync_results_for_run()` memanggil grading **sebelum** risk scoring, karena `RiskScoringService` membaca baris hasil dari DB.
- `RiskScoringService`: kedua query skor quiz diubah ke `ORDER BY completed_at DESC, id DESC` — dengan upsert, `created_at` tetap di insert pertama, jadi "percobaan terakhir" harus diurut berdasarkan waktu submit.
- `QuizInviteService` (baru) + `POST /quiz/invite`: membuat campaign quiz **non-master** dengan aset pilihan operator; menolak aset placeholder `pukat-*-tmpl/smtp-*`, menolak aset yang tak ada di GoPhish, menerapkan allow-list domain email entity **tanpa bypass**, batas 200 penerima, dan menghapus group bila create campaign gagal.
- `GET /quiz/results` (baru, filter `entity`/`campaign_run_id`) + `/quiz/results/{campaign_id}` kini berbagi `summarize()`: baris difilter ke entity yang boleh dilihat caller (menutup utang Q2), tanpa payload `answers`.
- Smoke `tools/smoke-quiz-scoring.php` (baru): **30/30 PASS** — grading deterministik dari payload berbentuk §3.5.1, event simulasi diabaikan, idempotensi (sync ulang tidak menambah baris), kedatangan kedua jadi baris sendiri, risk scoring memakai percobaan terakhir, breakdown per soal, override pass score, **mengubah kunci di bank tidak mengubah skor tersimpan**, dan jalur undangan live (ditolak saat belum ada domain allow-list, dibuat 201 dengan aset nyata, hasil undangan tergrade tanpa `campaign_run_id`).

### Q6 — frontend (SELESAI 2026-10-21)

- `pages/PostSimulation/Quiz.jsx` ditulis ulang dari demo 1-soal menjadi orchestration layer dengan tiga sub-tab **Question Bank / Quiz Page / Results**, memakai route `/post/quiz` yang sudah terdaftar.
- `features/quiz/components/`: `QuestionBankPanel` (list + drawer form, menonjolkan `input_name`), `QuizPageEditor` (adaptasi `EntityFlagPageEditor` + laporan linter + pass score + thank-you URL + badge master/chain), `QuizResultsPanel`, `SendQuizDialog` (dropdown template/SMTP GoPhish nyata, menyaring aset placeholder, menyatakan eksplisit bahwa email benar-benar terkirim), `index.js`.
- `QuizReportPane` tidak lagi mock: menerima `campaignRunId` dan menampilkan data nyata lewat `QuizResultsPanel`. **Catatan penempatan:** `ReportView` di sekitarnya masih mock penuh (judul kampanye hardcoded) dan tidak punya campaign run, jadi tanpa prop pane itu menampilkan empty state yang mengarahkan ke `/post/quiz` — bukan angka karangan. FR-16 secara fungsional hidup di area Quiz.
- Verifikasi kompilasi: `npx vite build --outDir /tmp/quizbuild` (bukan `assets/dist`) — build ini yang menangkap satu import store yang salah path, yang tidak terlihat oleh lint maupun test.

### Q7 — QA (SELESAI 2026-10-21)

- `php -l` bersih untuk semua file PHP baru/diubah.
- `npm run test` **138 lulus** (18 file). `npm run lint` menyisakan **1 warning pra-ada** di `Performing.jsx` (tak disentuh), sehingga perintahnya exit non-zero karena `--max-warnings 0` — kondisi yang sama seperti sebelum modul ini dimulai.
- Smoke yang relevan dan sudah ada ikut dijalankan ulang: `smoke-permission-registry`, `smoke-rbac-seed`, `smoke-campaign-result-metrics` — semua PASS.
- **E2E `tools/smoke-quiz-e2e.php` (baru): 16/16 PASS.** Target sungguhan di-walk lewat phish server (`host.docker.internal:8081` dari dalam container): submit halaman simulasi → 302 ke education dengan rid baru → submit → 302 ke quiz dengan rid baru → submit jawaban → `Submitted Data (Quiz)` **tergabung ke hasil simulasi dengan rid asal** → `record_from_results()` menilai 1 submission, skor 100, passed, teratribusi ke email target. Semua objek dibersihkan; master education produksi (`pukat-edu-master-ibaraki`) diverifikasi utuh di akhir setiap smoke write-path.
- Lima script smoke baru: `smoke-quiz-module.php`, `smoke-quiz-gophish.php`, `smoke-quiz-chain.php`, `smoke-quiz-scoring.php`, `smoke-quiz-e2e.php`.

### Penyimpangan dari PRD (as-built)

1. `launch_url`/`thankyou_url` = `VARCHAR(500)`, bukan 255 — menyesuaikan `pukat_flag_pages.launch_url`.
2. `pukat_quiz_results` punya **dua** unique key (`run_rid`, `invite_rid`); PRD §7.3 hanya menyebut satu. Diputuskan di Q1, bukan ditunda.
3. API bertambah `GET /quiz/results` (entity/run) di samping `/quiz/results/{campaign_id}`; PRD §8 hanya menyebut satu bentuk.
4. `thankyou_url` divalidasi bentuk, **bukan** `wp_http_validate_url()` (helper itu resolusi DNS dan menolak portal internal).
5. FR-16 hidup di area Quiz; `QuizReportPane` menunggu `campaignRunId` dari report view yang masih mock.
6. Kirim manual memvalidasi aset GoPhish hanya untuk *keberadaan* + bukan placeholder. Kepemilikan aset per entity adalah urusan Master Library dan di luar cakupan v1.
7. `quiz_enabled` default berubah dari `true` (era placeholder) ke `false`.

## 13. As-built log v2 (Quiz Builder — PRD §13)

### V2-Fase 1 — skema DB (SELESAI 2026-10-22)

- `Activator.php`: tabel baru `pukat_quiz_templates` (shell HTML + `placeholders` JSON + `is_active`) di `create_tables()`. `pukat_quiz_pages` diubah: `UNIQUE KEY entity_name` → `KEY entity_name` (banyak quiz per entity), tambah `template_id` (NULL = legacy hand-written v1), `field_values_json`, `selected_question_ids_json`, `is_default_followup`, plus index `entity_default (entity_name, is_default_followup)`.
- Helper idempoten baru `ensure_quiz_pages_builder_columns()`: tambah kolom bila belum ada, **drop UNIQUE** `entity_name` (cek `Non_unique='0'`) lalu re-add sebagai index biasa, tambah `entity_default`. Dipanggil dari `create_tables()` dan migrasi baru **`1.29.0`**.
- Asumsi yang diputuskan agar skema bisa jalan (PRD §13.7): HTML bebas v1 → builder jadi jalur normal, baris quiz v1 lama dibiarkan sebagai legacy (`template_id` NULL), tidak dihapus. Konvensi penanda template: placeholder `{{pukat:<key>}}`, slot soal `{{pukat:questions}}`.
- Verifikasi: migrasi dijalankan lewat `wp-load.php` di container `plugindev_wordpress`, `pukat_db_version` naik ke `1.29.0`, seluruh tabel/kolom/index terbentuk, dan `entity_name` tidak lagi unik. `php -l` bersih.

### V2-Fase 2a — katalog quiz template (backend, admin-only) (SELESAI 2026-10-22)

- File baru: `QuizTemplateRepository` (CRUD `pukat_quiz_templates`, list tanpa `html_body` per AGENTS.md §5.2), `QuizTemplateService` (validasi + marker check), `QuizTemplateController` (REST `GET/POST/PUT/DELETE /quiz/templates[/{id}]`, gate `quiz_templates.*`).
- `QuizPageRepository::count_using_template()` ditambah untuk guard hapus template yang masih dipakai.
- `PermissionRegistry`: resource baru `quiz_templates` (group Post Sim, `view_gate=admin`, actions create/edit/delete seed `admin`). `Plugin.php` mendaftarkan controller.
- **Marker template divalidasi di server** (bukan hanya di builder): HTML wajib memuat slot soal `{{pukat:questions}}` tepat sekali, dan tiap `{{pukat:<key>}}` lain wajib terdeklarasi di `placeholders` — kalau tidak, marker akan bocor ke halaman live. Placeholder: key pola `^[a-z0-9_]{1,40}$`, unik, tipe `text`/`textarea`.
- Migrasi `1.29.0` kini juga memanggil `seed_rbac_defaults()` (idempoten) agar cap admin baru ter-seed.
- Smoke `tools/smoke-quiz-template.php` (baru): **19/19 PASS** — seeding cap (admin punya, operator tidak), create valid, tolak tanpa-slot/marker-tak-terdeklarasi/key-ganda (422), list tanpa html_body, update, dan guard hapus-saat-dipakai (409). Entity buangan `ZZSmokeTplEntity`, semua baris dibersihkan.

### V2-Fase 2b — quiz page banyak-per-entity (backend) (SELESAI 2026-10-22)

- `QuizPageRepository`: tambah `find(id)`, `list_for_entity`, `count_for_entity`, `find_default_for_entity` (deterministik: flag `is_default_followup` dulu, lalu id terkecil), `clear_default_for_entity`, `delete`. `find_for_entity` kini **delegasi ke find_default_for_entity** — jadi pemanggil lama (QuizChainService, QuizScoringService, QuizInviteService, FlagPageService) otomatis menunjuk quiz default entity tanpa diubah.
- `QuizPageService`: `get`/`save`/`publish`/`unpublish`/`sync` jadi **id-aware** lewat `writable_context` (id → quiz itu, wajib milik entity, 404 kalau bukan; tanpa id → quiz default/legacy, menjaga back-compat v1). Method baru: `list`, `create` (quiz baru, yang pertama jadi default), `set_default` (clear default lain + relink chain), `delete` (blokir saat locked; unlink chain bila default+published; promote default pengganti). `prepare()` mengekspor `template_id`/`field_values`/`selected_question_ids`/`is_default_followup`.
- **Chain hanya tersentuh untuk quiz default** (PRD §13.9): publish/sync/unpublish quiz non-default tidak me-relink/unlink education.
- `QuizPageController`: route baru `GET/POST /quiz-pages` (list/create), `POST /quiz-page/default`, `POST /quiz-page/delete`; `GET/PUT /quiz-page` tetap (kini menerima `id` opsional).
- Verifikasi: `php -l` bersih; empat smoke v1 (`module`/`gophish`/`chain`/`scoring`) tetap **PASS** (back-compat path lewat quiz default). Smoke baru `tools/smoke-quiz-builder.php` **16/16 PASS** — banyak quiz per entity, satu default (switch & promote saat delete), save id-scoped tak menyentuh quiz lain, id entity lain ditolak 404. Entity buangan `ZZBuilderEntity`.

### V2-Fase 3 — generator HTML + answer key per quiz (SELESAI 2026-10-22)

- `QuizPageGenerator` (baru, pure): `generate(template_html, field_values, questions)` mengisi slot `{{pukat:questions}}` dengan blok soal lalu mensubstitusi `{{pukat:<key>}}` (escaped). Blok soal = `<fieldset class="pukat-question">` + radio (atau checkbox bila soal punya >1 kunci benar), `name=input_name` — bentuk yang diterima linter & dipakai answer key. Slot diisi **sebelum** placeholder agar nilai placeholder tak bisa menyelundupkan markup soal. `{{.RId}}` GoPhish tak tersentuh.
- `QuizQuestionRepository::find_selected_for_entity(ids, entity)` (urut sesuai pilihan, hanya soal milik entity — batas keamanan) + `QuizQuestionService::selected_questions()` / `answer_key_from_rows()`.
- `QuizPageService`: `save()` kini bercabang — **template-backed** (template_id ada) menggenerate `html_body` dari template+field_values+soal terpilih dan menyimpan `field_values_json`/`selected_question_ids_json` (klien tak kirim html_body); **legacy** (tanpa template) tetap menerima html_body tulisan tangan v1. `publish()`/`prepare()`/`validate()` memakai `answer_key_for_row()`: quiz template → kunci dari **soal terpilih quiz itu**; legacy → seluruh bank aktif entity.
- Verifikasi: `php -l` bersih. Smoke `tools/smoke-quiz-generator.php` **17/17 PASS** (substitusi placeholder, slot terisi, `{{.RId}}` utuh, hanya soal terpilih dirender, answer_key_count = jumlah terpilih bukan seluruh bank, urutan pilihan tersimpan, linter lolos, legacy tetap pakai bank penuh). Regресi `module`/`gophish`/`scoring`/`builder` tetap PASS.

### V2-Fase 4 — scoring & GoPhish per quiz, invite per quiz (SELESAI 2026-10-22)

- **Penamaan GoPhish per quiz:** `QuizPageSyncService::page_name()/master_name()` menerima `?int $quiz_id` → `pukat-quiz-<slug>-<id>` / `pukat-quiz-master-<slug>-<id>` (id-less tetap didukung untuk pemanggil legacy). `push()`/`recreate_master()`/`delete_existing_master()`/`create_master()` meneruskan quiz id; `QuizPageService` mengirim `(int)$row['id']`. Tanpa ini banyak quiz satu entity bertabrakan di satu objek GoPhish.
- **Scoring per quiz (`QuizScoringService::record_from_results`):** tiap event dinilai terhadap snapshot quiz **yang mengirimnya** — resolusi: context `quiz_page_id` (undangan) → master id event (`published_rows_for_entity` diindeks per `gophish_master_id`) → quiz default entity. Helper `grading_context_for_page()` (cache per-invokasi; direset tiap panggilan karena override pass score bisa beda antar panggilan). `QuizPageRepository::published_rows_for_entity()` baru.
- **Invite per quiz (`QuizInviteService`):** menerima `quiz_id` (wajib milik entity, else 404) atau default; memakai `page_name(entity, id)` quiz itu; mengembalikan `quiz_page_id`.
- **Bug yang ketahuan & diperbaiki saat smoke:** cache grading per-instance menahan pass-score override lama antar panggilan `record_from_results` → direset per panggilan.
- Verifikasi: `php -l` bersih. Smoke baru `tools/smoke-quiz-multiscore.php` **7/7 PASS** (dua quiz published beda kunci, tiap event dinilai ke quiz yang benar via master id, campaign tak dikenal fallback ke default). Smoke v1 `gophish`/`chain`/`scoring` diperbarui ke nama ber-id dan **semua PASS**. Seluruh suite quiz (module/builder/generator/scoring/template/gophish/chain/multiscore) hijau.

### V2-Fase 5 — frontend builder & admin template area (SELESAI 2026-10-22)

- Data layer: `quizApi` tambah `listPages`/`createPage`/`setDefaultPage`/`deletePage` + template CRUD (`templates`/`template`/`createTemplate`/`updateTemplate`/`deleteTemplate`); `queryKeys.quiz.pages/templates/template`; hooks `useQuizPages`/`useQuizTemplates`/`useQuizTemplate` + mutations create/setDefault/delete page & template CRUD.
- Komponen baru di `features/quiz/components/`: `QuizListPanel` (daftar quiz per entity + New/Edit/Set default/Delete, badge default & legacy), `QuizBuilder` (pilih template → form placeholder dinamis → pilih & urutkan soal bank → setting launch/thank-you/pass score → preview `BrowserPreview` dari html_body hasil generate + laporan linter/sync/chain; **tanpa editor HTML**), `QuizTemplateAdminPanel` (CRUD template admin: HtmlCodeEditor + deklarasi placeholder + preview, starter HTML dengan marker). `QuizPageEditor` v1 tetap diekspor tapi tak lagi dipakai dari halaman.
- `Quiz.jsx`: tab **Quiz Page** jadi daftar↔builder (state `openQuizId`), tab **Templates** (admin-only). Tombol "Send quiz manually" aktif saat quiz **default** published+synced.
- Backend tweak: `GET /quiz/templates` dibuka untuk `quiz_pages.edit` (operator bisa memilih template) via `require_any_capability`; CRUD tetap admin-only.
- Wizard Step 3: hint quiz diperbarui menyebut "tandai satu quiz sebagai default follow-up". Ketersediaan quiz follow-up sudah otomatis benar — `useQuizPage` tanpa id mengembalikan quiz default entity.

### V2-Fase 6 — QA (SELESAI 2026-10-22)

- Frontend (container `plugindev_node`, `/app`): `npm run lint` **0 error** (hanya 1 warning pra-ada di `Performing.jsx`), `npm run test` **138 lulus** (18 file), `npx vite build` sukses (chunk `Quiz` ter-build, tak ada import salah).
- Backend: `php -l` bersih untuk semua file. Delapan smoke quiz **semua PASS**: module, builder, generator, scoring, template, multiscore, gophish, chain.
- Catatan revisi: user akan merevisi UI/UX saat testing (bukan blocker). `QuizPageEditor` v1 dibiarkan (dead-ish) untuk jaga-jaga quiz legacy; bisa dihapus kalau tak dipakai.

### V2-Fase 7 — soal bergambar (PRD §13.10) (SELESAI 2026-10-25)

- Skema: migrasi **`1.30.0`** menambah `question_type` (`text`|`image`) + `image_data` (LONGTEXT data URI) ke `pukat_quiz_questions` via `ensure_quiz_questions_image_columns()`.
- Repo: `FIELDS` tambah `question_type`; `list_for_entity` membawa `has_image` (derivasi `image_data IS NOT NULL`) tanpa bytes; `find()` + `find_selected_for_entity()` menyertakan `image_data`.
- Service `QuizQuestionService`: `sanitize()` validasi tipe + `validate_image()` (data URI png/jpg/gif/webp, cap **1 MB** decoded, tipe text menghapus gambar); `prepare()` ekspor `question_type` + `has_image` (tak pernah bytes); `get_one()` baru (single row + image, entity-scoped). Route `GET /quiz/questions/{id}` (gate view).
- Generator: `render_question_block()` menyisipkan `<div class="pukat-question-image"><img src="<data-uri>">` di atas opsi untuk soal `image`. Inline apa adanya ke GoPhish; batas 4 MB halaman tetap dijaga `build_from_template`.
- Frontend: form bank dapat toggle **Text/Image** + uploader (FileReader→data URI, validasi tipe+1 MB klien), preview thumbnail + replace/remove; badge **Image** di list; `QuestionPreview` + preview builder menampilkan gambar (ambil `image_data` via `GET /quiz/questions/{id}` saat dibutuhkan, list tetap ringan).
- Verifikasi: `php -l` bersih; `tools/smoke-quiz-image.php` **8/8 PASS** (create/get_one/list-has_image/tolak non-dataURI/tolak tanpa gambar/tolak >1 MB/generator render img/text tanpa gambar); regresi generator/module/builder PASS. FE lint 0 error, 138 test, build sukses, `assets/dist` di-rebuild.
