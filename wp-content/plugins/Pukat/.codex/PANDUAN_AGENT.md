# Agent Codex untuk Pukat

Paket: uat, security, techdocs, handbook.

## Pemasangan

1. Ekstrak ZIP ke folder sementara.
2. Salin folder `.codex` ke dalam folder project `Pukat`.
3. Hasilnya harus `Pukat/.codex/agents/uat.toml` dan tiga file agent lainnya.
4. Jika folder `.codex` sudah ada, gabungkan foldernya. Periksa sebelum mengganti file bernama sama.
5. Pertahankan AGENTS.md dan konfigurasi existing.
6. Buka sesi Codex baru pada folder Pukat.

Konfigurasi ini untuk Codex yang mendukung standalone custom agent TOML.
Model dan reasoning mengikuti sesi induk. Browser/tools harus tersedia pada sesi induk.
Instruksi pembatasan edit adalah aturan perilaku; permission teknis mengikuti sesi induk.
Jika agent tidak dikenali, periksa versi/client dan dukungan custom agent sebelum mengubah konfigurasi.

## Cara memanggil

- Gunakan agent uat untuk menguji fitur [nama fitur] pada [URL testing].
- Gunakan agent security untuk review statis modul [nama modul].
- Gunakan agent techdocs untuk mendokumentasikan arsitektur, database, dan setup lokal.
- Gunakan agent handbook untuk membuat panduan [role] pada fitur [nama fitur].
- Gunakan agent uat untuk retest temuan [ID] dari run [run-id].

Nama agent bukan otomatis slash command. Jika delegasi tidak tersedia, Codex harus
menjelaskan keterbatasan dan tidak mengklaim agent telah berjalan.

## Hasil

- UAT: docs/quality/uat/<run-id>/
- Security: docs/quality/security/<run-id>/
- Dokumentasi teknis: docs/technical/
- Handbook: docs/handbook/

Paket sudah diperiksa sintaks TOML-nya. Belum dijalankan pada repository Pukat.

Referensi format: https://learn.chatgpt.com/docs/agent-configuration/subagents
