Flow Beyond — Development Requirements


Phishing Simulation Platform

Engine: GoPhish (as-is) · UI: WordPress Plugin (custom development)

Legend

BadgeKeterangan[WP]Dikembangkan sebagai WordPress Plugin[GoPhish]Dikonfigurasi di GoPhish admin (tidak perlu coding)[WP + GoPhish]WordPress Plugin berkomunikasi ke GoPhish via REST API


1. Pre Simulation

1.1 Socialization [WP]

Functional Requirements


R1 — Support multi-channel delivery (email, internal portal, LMS)
R2 — Track open/read rates per user
R3 — Allow scheduling of socialization campaigns
R4 — Support multilingual content


Acceptance Criteria


✓ At least 80% user reach before simulation launch
✓ Audit log of delivery per recipient



1.2 Pamphlet & Email Pamphlet [WP]

Functional Requirements


R1 — Template builder for pamphlet design
R2 — PDF and HTML export support
R3 — Email distribution with tracking pixel
R4 — Version control for pamphlet content


Acceptance Criteria


✓ Pamphlet delivered at least 7 days before simulation
✓ Delivery confirmed with read receipts



2. Simulation

2.1 Preparation [WP + GoPhish]

Functional Requirements


R1 — Support bulk target import (CSV)
R2 — Configurable phishing templates (customize from default / create new)
R3 — Difficulty level scoring — adopt PhishScale NIST


Acceptance Criteria


✓ CSV dengan 1.000+ baris berhasil diimport tanpa error dalam waktu < 30 detik
✓ Setiap target tampil di preview sebelum kampanye dijalankan
✓ Template baru tersimpan dan bisa dipilih ulang di kampanye berikutnya
✓ Skor PhishScale tampil pada setiap template (skala 1–5 sesuai NIST)



2.2 Performing [WP + GoPhish]

Functional Requirements


R1 — Choose playbook campaign
R2 — Custom campaign
R3 — Set target
R4 — Real-time click and submission tracking
R5 — Cron-based scheduling with timezone support
R6 — Pre-launch checklist enforcement


Acceptance Criteria


✓ Kampanye playbook dapat dipilih dan dijalankan tanpa konfigurasi ulang dari nol
✓ Klik dan submit tercatat di dashboard dalam waktu < 5 detik setelah event
✓ Kampanye terjadwal berjalan tepat waktu sesuai timezone yang dipilih (toleransi ± 1 menit)
✓ Pre-launch checklist mencegah kampanye berjalan jika ada item wajib yang belum diisi
✓ Simulasi tidak dapat dijalankan selama periode blackout yang telah ditetapkan



2.3 Reporting [WP]

Functional Requirements


R1 — Auto-generate PDF dan dashboard report saat simulasi selesai
R2 — Risk vulnerable per-department dan per-user breakdown
R3 — Benchmark comparison vs. simulasi sebelumnya
R4 — Risk scoring total (based on click history + quiz scores)
R5 — Exportable raw data (CSV / JSON)
R6 — Contextual guidance embedded in report (what to do next)


Acceptance Criteria


✓ Report generated after simulation completion
✓ Executive summary under 1 page



3. Post Simulation

3.1 Quiz Module [WP]

Functional Requirements


R1 — Auto-assign quiz to users who clicked phishing links
R2 — Question bank with randomization
R3 — Scoring and pass/fail threshold configuration
R4 — Completion tracking and reminders


Acceptance Criteria


✓ Quiz completion rate tracked per simulation
✓ Failed quiz triggers escalation notification



3.2 Post-Simulation Socialization [WP]

Functional Requirements


R1 — Automated debrief email with results summary
R2 — Differentiated messaging: clickers vs. non-clickers


Acceptance Criteria


✓ Debrief sent within 24 hours of simulation close
✓ Open rate tracked and stored



3.3 Coaching & Reinforcement [WP]

Functional Requirements


R1 — Risk scoring per user (based on click history + quiz scores)
R2 — Assign training modules based on risk tier
R3 — Manager notification for high-risk direct reports
R4 — Progress tracking over time
R5 — Drip campaign builder (weekly/monthly tips)


Acceptance Criteria


✓ High-risk users receive coaching within 48 hours
✓ Training completion logged per user
✓ Campaign engagement rate tracked



3.4 Next Simulation Planning [WP]

Functional Requirements


R1 — Personalized content based on user risk profile
R2 — Recommendation engine for scenario selection
R3 — Historical trend analysis dashboard
R4 — Simulation calendar with approval workflow


Acceptance Criteria


✓ Content personalization accuracy > 80%
✓ Planner accessible by admin and security team roles



4. Simulation Setup

4.1 Playbook Setup [GoPhish]

Functional Requirements


R1 — Definisikan template playbook yang dapat digunakan ulang untuk skenario kampanye
R2 — Setiap playbook berisi: template email, landing page, dan sending profile yang sudah dipasangkan


Acceptance Criteria


✓ Playbook tersimpan dan muncul sebagai pilihan saat membuat kampanye baru
✓ Perubahan pada playbook tidak mempengaruhi kampanye yang sudah berjalan



4.2 Template Email Setup [GoPhish]

Functional Requirements


R1 — Buat dan kelola template phishing email di GoPhish
R2 — Mendukung variabel dinamis (nama, departemen, dll.)


Acceptance Criteria


✓ Template email berhasil dikirim ke target tanpa masuk folder spam (deliverability test)
✓ Variabel dinamis tergantikan dengan data target yang benar saat pengiriman



4.3 Template Landing Page [GoPhish]

Functional Requirements


R1 — Buat dan kelola fake landing page di GoPhish
R2 — Landing page merekam klik dan submit form dari target


Acceptance Criteria


✓ Landing page tampil normal di browser mobile dan desktop
✓ Event klik dan submit form tercatat di GoPhish dalam < 3 detik



4.4 SMTP Setup [GoPhish]

Functional Requirements


R1 — Konfigurasi sending profile (SMTP relay, domain) di GoPhish
R2 — Validasi koneksi SMTP sebelum kampanye dijalankan


Acceptance Criteria


✓ Test email dari sending profile berhasil diterima tanpa error
✓ Kampanye tidak dapat dijalankan jika SMTP belum tervalidasi



5. Admin Panel

5.1 User Access Management [WP]

Functional Requirements


R1 — Role-based access control (admin, operator, viewer)
R2 — SSO / LDAP integration untuk user provisioning
R3 — Audit log per user action


Acceptance Criteria


✓ User dengan role viewer tidak dapat membuat atau mengubah kampanye
✓ Setiap login, perubahan data, dan aksi penting tercatat di audit log dengan timestamp
✓ User baru dari LDAP/SSO langsung mendapat role default tanpa setup manual



5.2 Page Setup [WP]

Functional Requirements


R1 — Konfigurasi global settings (nama organisasi, logo, timezone)
R2 — Kelola notification templates untuk email sistem


Acceptance Criteria


✓ Perubahan logo dan nama organisasi langsung tampil di seluruh halaman plugin tanpa perlu reload
✓ Notification template dapat diedit dan perubahan langsung berlaku untuk email berikutnya



Summary

#FaseModulPlatform1.1Pre SimulationSocializationWordPress Plugin1.2Pre SimulationPamphlet & Email PamphletWordPress Plugin2.1SimulationPreparationWP + GoPhish2.2SimulationPerformingWP + GoPhish2.3SimulationReportingWordPress Plugin3.1Post SimulationQuiz ModuleWordPress Plugin3.2Post SimulationPost-Simulation SocializationWordPress Plugin3.3Post SimulationCoaching & ReinforcementWordPress Plugin3.4Post SimulationNext Simulation PlanningWordPress Plugin4.1Simulation SetupPlaybook SetupGoPhish4.2Simulation SetupTemplate Email SetupGoPhish4.3Simulation SetupTemplate Landing PageGoPhish4.4Simulation SetupSMTP SetupGoPhish5.1Admin PanelUser Access ManagementWordPress Plugin5.2Admin PanelPage SetupWordPress Plugin

Total: 15 modul · 43 functional requirements · 37 acceptance criteria