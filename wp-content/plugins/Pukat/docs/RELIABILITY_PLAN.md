# Rencana Keandalan Pukat

Status per 14 Oktober 2026. Untuk tim engineering Pukat, ditulis setelah root cause analysis kegagalan pengiriman campaign pada 13-14 Oktober 2026.

## Ringkasan

Campaign run #51 gagal mengirim ke 100% target pada 14 Oktober 2026, karena password sending profile GoPhish terhapus oleh aksi "Save" biasa di orchestrator pada 13 Oktober. Checklist pre-launch tetap melaporkan sending profile siap, status run tetap `running`, dan tidak ada satu pun baris audit log tentang perubahan itu.

Akar masalahnya bukan satu baris kode yang salah, tapi tiga lapis pengaman yang sama-sama tidak ada: tidak ada test yang menjaga invariant write-path ke GoPhish, tidak ada validasi yang memeriksa kredensial secara nyata, dan tidak ada jejak audit untuk mutasi GoPhish.

Tiga pekerjaan yang kita dahulukan:

1. Contract test write-path GoPhish — menutup kelas bug ini untuk semua asset GoPhish sekaligus, bukan hanya sending profile.
2. Pola `update_with_merge()` di `GoPhishService` — membuat update yang aman jadi satu-satunya jalan yang tersedia.
3. CI minimal plus `phpunit.xml` — tanpa ini, dua poin di atas akan membusuk dalam sebulan.

## Akar masalah

`PUT /pukat/v1/gophish/smtp/{id}` selalu mengirim field `password` apa adanya dari form, dan form itu selalu kosong dalam mode edit. Jadi setiap "Save" pada sending profile yang sudah ada menghapus password yang tersimpan di GoPhish.

Rantai lengkapnya:

1. `prepare_smtp_profile_response()` melakukan `unset($profile['password'])`, jadi browser memang tidak pernah menerima password. Ini benar secara keamanan dan bukan bagian yang salah.
2. `gophishSmtpProfileToUiProfile()` mengisi `password: ''`, lalu `profileToSmtpForm()` meneruskannya sebagai `form.password = ''`.
3. `buildGophishSmtpPayload()` mengirim `password: form.password`, yaitu string kosong.
4. `build_smtp_profile_payload()` menerjemahkannya menjadi `'password' => ''` tanpa fallback apa pun.
5. `update_sending_profile()` sudah memanggil `get_sending_profile($id)` untuk keperluan cek entity, tapi tidak memakai hasilnya untuk mengisi password yang kosong. `PUT /api/smtp/{id}` kemudian me-replace seluruh objek, dan password hilang.

Jalur test email sudah menangani kasus ini secara eksplisit, dengan komentar yang menyebut bahwa form yang tidak diedit memang mengirim string kosong. Logika itu ada di `send_test_email()` tapi tidak pernah dipindahkan ke `update_sending_profile()`. Inilah sebabnya test email dari orchestrator berhasil, sementara aksi Save justru merusak profile yang baru saja diuji.

Bukti PUT yang menghapus password cocok sampai ke jumlah byte. Body `GET /api/smtp/1` saat ini, dengan password terisi, berukuran 339 byte; baris password di dalamnya 42 byte; `modified_date` lama tanpa fraksi detik 9 byte lebih pendek. GoPhish mengembalikan 330 byte sebelum PUT dan 297 byte sesudahnya, dan 330 + 9 - 42 = 297. Tidak ada field lain yang berubah.

Dua jalur lain sudah aman dan tidak perlu disentuh: assign entity melakukan PUT ulang atas hasil GET yang masih memuat password, dan tombol Sync GoPhish bersifat read-only.

## Dua kelas bug yang akan terulang

Password hanya korban pertama. Ada dua pola di arsitektur ini yang akan terus memproduksi insiden serupa kalau tidak ditutup secara struktural.

**Destructive write-back ke objek eksternal.** Pukat tidak memiliki data GoPhish; dia mengedit objek milik sistem lain lewat `PUT` yang bersifat full-replace. Setiap field yang backend tidak tahu nilainya akan terhapus saat save — baik karena sengaja di-strip dari browser, maupun karena fork GoPhish punya field yang Pukat belum kenal. Pola yang sama ada di `update_email_template()` dan `update_landing_page()`. Fork GoPhish sudah menambahkan `entity`, dan `next_campaign_id` di Rilis 3; field berikutnya bisa hilang dengan cara yang persis sama.

**Validasi yang memeriksa metadata, bukan kenyataan.** `validate_playbook_ready()` hanya bertanya apakah ref ada, statusnya `active`, dan `gophish_sending_profile_id` tidak kosong, lalu melaporkan siap. Saat launch, `resolve_sending_profile()` cuma melakukan `GET` untuk memastikan profile ada, lalu menandai step `completed`. Di sisi UI, `gophishSmtpProfileToUiProfile()` meng-hardcode `status: 'Valid'` dan master mapper meng-hardcode `lastTest: 'Mapping ready'`. Checklist pre-launch jadi teater: dia tidak pernah bisa gagal karena alasan yang benar.

Yang paling perlu dicatat sebagai pelajaran: `smtpProfileHelpers.test.js` sudah ada dan hijau, dengan test bernama *prepares duplicate forms without copying the password* dan *maps GoPhish SMTP profiles into UI profiles without exposing passwords*. Test-nya justru mengunci perilaku yang merusak. Unit test lulus sementara janji sistemnya bobol — tanda test kita menguji implementasi, bukan invariant.

## Kondisi lapis pengaman sekarang

Keenam lapis yang seharusnya menangkap insiden seperti ini berada dalam kondisi berikut per 14 Oktober 2026.

| Lapis | Kondisi | Risiko yang ditinggalkan |
| --- | --- | --- |
| Test unit PHP | Tidak ada. 74 file di `includes/`, folder `tests/` dan `phpunit.xml` tidak ada, padahal `composer.json` mendefinisikan `"test": "phpunit --configuration phpunit.xml"` | Perintah `composer test` error kalau dijalankan hari ini; orang mengira ada jaring padahal tidak |
| Test frontend | 15 file test untuk 208 file di `pukat-app/src` | Helper kritis seperti payload builder tidak terjaga invariant-nya |
| CI | Tidak ada. Folder `.github/` tidak ada | Seluruh validasi di AGENTS.md pasal 7 bergantung pada ingatan manusia |
| Smoke test | 13 script di `tools/`, butuh container hidup, dijalankan manual satu per satu | Tidak pernah dijalankan lengkap sebelum rilis |
| Audit trail | Nol pemanggilan `AuditLogService::log()` di `GoPhishProxy.php` | Mutasi destruktif ke GoPhish tidak meninggalkan jejak sama sekali |
| Alerting | Run #51 berstatus `running` sampai sekarang meski 100% target `Error Sending Email` | Kegagalan operasional total terbaca sebagai simulasi yang sedang berjalan |

## Rencana kerja

Enam workstream, berurut dari paling berdampak.

| Workstream | Kriteria selesai | Status |
| --- | --- | --- |
| 1. Contract test write-path GoPhish | Test merah kalau perbaikan password di-revert | **Selesai** |
| 2. Pola `update_with_merge()` di `GoPhishService` | Tidak ada `update_*` yang mengirim payload mentah | **Selesai** |
| 3. Readiness nyata, bukan metadata | Insiden 13 Oktober tertangkap sebelum launch | Belum mulai |
| 4. Audit dan alerting untuk mutasi GoPhish | Root cause serupa ketemu dari audit log, bukan dari log HTTP | Belum mulai |
| 5. CI minimal | Lint, build, dan test jalan otomatis di setiap push | Belum mulai |
| 6. Bereskan utang test | `composer test` dan runner smoke bisa dijalankan satu perintah | Belum mulai |

**1. Contract test write-path GoPhish.** Invariant yang dijaga: menyimpan sending profile tanpa mengubah password tidak boleh menghapus password yang tersimpan. Ini hanya bisa diuji end-to-end lawan GoPhish asli, yang sudah tersedia di container `gopdev_gophish`: `GET`, ingat password, `PUT` tanpa password, `GET`, bandingkan. Dijalankan pada profile throwaway yang dibuat dan dihapus oleh test itu sendiri, tidak pernah pada profile asli. Satu test seperti ini menutup kelas bug destructive write-back untuk semua asset GoPhish.

**2. Pola `update_with_merge()`.** Daripada menambal `password` di satu fungsi, tambahkan helper di `GoPhishService` yang selalu `GET` dulu, merge perubahan di atas objek utuh, baru `PUT`. Semua `update_*` dialihkan ke sana. Efeknya field yang Pukat belum kenal ikut terpelihara otomatis, termasuk yang ditambahkan fork GoPhish besok. Kalau jalan yang aman juga jalan yang paling mudah, developer berikutnya tidak bisa salah.

**3. Readiness nyata.** Simpan `last_verified_at` beserta hasilnya di `sending_profile_refs` setiap kali test email sukses. Checklist pre-launch kemudian menolak atau memperingatkan kalau profile belum pernah diverifikasi, verifikasinya kedaluwarsa, atau `modified_date` di GoPhish lebih baru dari verifikasi terakhir. Buang `status: 'Valid'` dan `lastTest: 'Mapping ready'` yang di-hardcode: badge yang selalu hijau lebih buruk daripada tidak ada badge, karena dia aktif menipu.

**4. Audit dan alerting.** `AuditLogService::log()` untuk semua mutasi di `GoPhishProxy`, tanpa nilai secret, cukup `password_changed: true/false`. Run yang didominasi status `Error` berubah status jadi gagal atau degraded dan memunculkan notifikasi, bukan dibiarkan `running` selamanya.

**5. CI minimal.** Satu workflow: `npm run lint`, `npm run build`, `npm run test`, plus `composer test` begitu `phpunit.xml` dan `tests/` ada. Mulai dari yang sudah hijau supaya CI-nya kredibel sejak hari pertama, lalu tambah.

**6. Bereskan utang test.** Buat `phpunit.xml` dan `tests/`; `composer test` yang broken lebih berbahaya daripada tidak ada karena orang mengira ada jaring. Buat runner yang menjalankan 13 smoke script sekaligus dan exit non-zero kalau ada yang gagal. Prioritaskan unit test PHP untuk yang paling mahal kalau salah: `CampaignRunService` (orkestrasi launch), `PermissionRegistry` (RBAC), dan payload builder di `GoPhishProxy`.

## Catatan pelaksanaan

**Fase 1 selesai pada 14 Oktober 2026.** Gate 1 terbukti: kalau perbaikannya di-revert, test-nya merah pada case yang benar dan script keluar dengan exit code 1.

Yang berubah:

- `includes/Services/GoPhishService.php` — helper baru `put_merged()`: `GET` dulu, merge perubahan di atas objek utuh, baru `PUT`. `update_sending_profile()`, `update_email_template()`, dan `update_landing_page()` sekarang lewat sana. Key yang dikirim tetap menang, termasuk string kosong, jadi field masih bisa dikosongkan dengan sengaja.
- `includes/Api/GoPhishProxy.php` — `build_smtp_profile_payload()` tidak lagi menyertakan key `password` kalau form mengirim string kosong. Gabungan dengan `put_merged()`, "tidak dikirim" sekarang berarti "jangan diubah", bukan "hapus".
- `tools/smoke-gophish-write-path.php` — contract test baru, 7 case.

Menjalankannya:

```bash
docker exec plugindev_wordpress php /var/www/html/wp-content/plugins/Pukat/tools/smoke-gophish-write-path.php
```

Test ini bicara ke GoPhish sungguhan, karena bug-nya ada pada perilaku full-replace PUT milik GoPhish; client yang di-mock akan tetap hijau. Semua tulisan diarahkan ke sending profile, email template, dan landing page throwaway yang dibuat dan dihapus sendiri oleh script, dan penghapusan hanya dilakukan kalau nama objeknya masih berawalan `[PUKAT-SMOKE]`.

Satu temuan sampingan: GoPhish menormalkan HTML landing page saat menyimpan, misalnya menambahkan `<head></head>`. Jadi baseline perbandingan harus diambil dari apa yang GoPhish simpan, bukan dari string yang kita kirim. Test versi pertama sempat merah karena ini, dan itu kesalahan test-nya, bukan kode produksinya.

Belum dikerjakan: workstream 3 sampai 6, menunggu Gate 1 ditandatangani dan dua pertanyaan terbuka di bawah dijawab.

## Urutan eksekusi

```text
┌──────────────────────────┐      ┌──────────────────────────┐      ┌──────────────────────────┐
│  1. Setop pendarahan     │      │  2. Pasang jaring        │      │  3. Jaga terus           │
│                          │ Gate │                          │ Gate │                          │
│  Contract test           │  1   │  Readiness nyata         │  2   │  Audit dan alerting      │
│  write-path              │ ◆──► │  CI minimal              │ ◆──► │  Bereskan utang test     │
│  Pola update_with_merge()│      │                          │      │                          │
└──────────────────────────┘      └──────────────────────────┘      └──────────────────────────┘
      Gate 1: test merah kalau perbaikannya di-revert
      Gate 2: CI hijau jadi syarat sebelum merge
```

Fase 1 dikerjakan lebih dulu karena dia menutup kelas bug-nya, bukan cuma insidennya; fase 2 dan 3 yang membuatnya tetap tertutup. Gate di antara fase bukan tanggal, tapi bukti: fase berikutnya baru dibuka setelah gate sebelumnya benar-benar bisa ditunjukkan.

Aturan kerja yang berlaku setelah ini:

- Setiap perubahan pada write-path GoPhish wajib disertai contract test di PR yang sama.
- Test ditulis sebagai janji sistem, bukan cermin implementasi. Kalau sebuah test akan tetap hijau saat produknya rusak, test itu salah tulis.
- Test write-path selalu memakai entitas throwaway yang dibuat dan dihapus sendiri, tidak pernah data asli.
- Mutasi apa pun ke sistem eksternal masuk audit log, tanpa nilai secret.
- Tidak menampilkan status hijau yang tidak kita punya buktinya.

## Pertanyaan terbuka

- Readiness di workstream 3: hard-block launch, atau warning dulu sebulan pertama?
- Berapa hari verifikasi sending profile dianggap kedaluwarsa?

## Lampiran

### Timeline bukti

Dari `docker logs gopdev_gophish`, urut kronologis karena urutannya adalah buktinya. Semua waktu UTC, profile `id=1` (`ramdn@ichoe.me`).

| Waktu | Kejadian |
| --- | --- |
| 13 Okt 09:01:56 | `GET /api/smtp/1` 200, 330 byte, password masih ada |
| 13 Okt 09:02:07, 09:02:21, 09:02:54 | `Email sent` tiga kali, test email sukses |
| 13 Okt 09:02:58 | `GET /api/smtp/1` lalu `PUT /api/smtp/1` 200, jalur edit dan save |
| 13 Okt 10:45:22 | `GET /api/smtp/1` 200, 297 byte, password hilang |
| 14 Okt 01:34:09 | Launch run #51, `GET /api/smtp/1` 297 byte |
| 14 Okt 01:34:45 | `Max connection attempts exceeded - 535 5.7.8 Error: authentication failed` |
| 14 Okt 02:49:38 | `modified_date` profile berubah, password terisi kembali secara manual |

### Referensi kode

| Berkas | Yang relevan |
| --- | --- |
| `includes/Api/GoPhishProxy.php` | `update_sending_profile()` baris 549-575, `build_smtp_profile_payload()` baris 784, `prepare_smtp_profile_response()` baris 990, fallback password di `send_test_email()` baris 660-662 |
| `includes/Services/GoPhishService.php` | `update_sending_profile()`, `update_email_template()`, `update_landing_page()` |
| `includes/Services/CampaignRunService.php` | `validate_playbook_ready()` baris 2235-2242, `resolve_sending_profile()` baris 1659-1678 |
| `includes/Services/PlaybookMasterService.php` | Pengecekan readiness kembar, baris 522-533 |
| `pukat-app/src/utils/smtpProfileHelpers.js` | `gophishSmtpProfileToUiProfile()`, `profileToSmtpForm()`, `buildGophishSmtpPayload()` |
| `pukat-app/src/pages/Admin/MasterSendingProfiles.jsx` | `submitProfile()` baris 337 |

Root cause analysis dilakukan tanpa mengubah apa pun: hanya membaca kode, query `SELECT` ke database, `docker logs`, dan satu `GET /api/smtp/` yang bersifat read-only.
