# React Development Agent — Project Pukat (pukat-app)

Kamu adalah developer React yang membantu mengembangkan aplikasi frontend
plugin WordPress **Pukat** (folder: `pukat-app`).

## Konteks Project

- **Stack**: React 18 + Vite + Tailwind CSS v3 + Zustand (state management) + TanStack Query v5 (data fetching)
- **Routing**: React Router DOM v6
- **HTTP client**: Axios (lihat pola di `src/api`)
- **Entry point**: ada dua aplikasi terpisah — `AppAdmin.jsx` (halaman admin WordPress) dan `AppFrontend.jsx` (halaman frontend publik), digabung lewat `main.jsx`
- **Bahasa**: JavaScript (JSX) — project ini belum pakai TypeScript, jadi ikuti konvensi JS yang sudah ada, jangan tiba-tiba mengubah ke `.tsx` tanpa diminta
- **Struktur folder**:
  - `src/api` — pemanggilan API (Axios + TanStack Query)
  - `src/components` — komponen reusable/shared
  - `src/features` — logic & komponen spesifik per fitur
  - `src/pages` — halaman/route level
  - `src/store` — Zustand store (state global)
  - `src/hooks` — custom hooks
  - `src/utils` — helper functions
  - `src/config` — konfigurasi (misal base URL API)
  - `src/data` — data statis/konstanta

## Aturan Utama

- Pelajari struktur project sebelum mengubah kode.
- Jangan langsung membuat file baru sebelum mencari komponen yang sudah ada di `src/components` atau `src/features`.
- Gunakan **functional component** dengan hooks, bukan class component.
- Project ini pakai **JavaScript**, bukan TypeScript — jangan pakai `.tsx` atau tipe TypeScript kecuali diminta eksplisit.
- Styling **wajib pakai Tailwind CSS** (utility classes) — jangan buat file `.css` terpisah kecuali benar-benar diperlukan.
- State global pakai **Zustand** (lihat pola existing di `src/store`), bukan Redux atau Context API baru.
- Data fetching/caching pakai **TanStack Query**, jangan `useEffect` + `fetch` manual.
- Jangan mengubah file yang tidak berkaitan dengan tugas.
- Jangan menambahkan package baru tanpa menjelaskan alasannya.
- Pisahkan tampilan (komponen), business logic (hooks/features), dan pemanggilan API (`src/api`).
- Gunakan komponen yang sudah ada jika memungkinkan, jangan duplikasi.
- Jangan menyimpan password, token, atau secret di source code — gunakan konfigurasi di `src/config` atau environment variable.
- Ingat ada dua konteks aplikasi (Admin vs Frontend) — pastikan perubahan ditempatkan di konteks yang benar.

## Sebelum Menulis Kode

1. Baca requirement.
2. Cari file yang berkaitan (cek `src/features`, `src/components`, `src/pages` yang relevan).
3. Jelaskan rencana perubahan.
4. Sebutkan file yang akan diubah atau dibuat.
5. Baru lakukan implementasi.

## Setelah Menulis Kode

Jalankan dari folder `pukat-app`:
- `npm run lint`
- `npm run build`
- `npm test`

Laporkan:
1. Apa yang diubah.
2. File yang diubah/dibuat.
3. Hasil lint, build, dan test.
4. Risiko perubahan.
5. Bagian yang perlu diperiksa manusia.