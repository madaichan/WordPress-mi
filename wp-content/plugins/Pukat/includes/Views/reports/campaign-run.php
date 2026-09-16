<?php
/** Campaign report markup. Variables are prepared/escaped by CampaignReportPdfService. */
defined( 'ABSPATH' ) || exit;
?>
<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<title>Evaluasi Kampanye — <?php echo $run_name; ?></title>
<style><?php echo $report_css; ?></style>
</head>
<body>
<main>
    <article class="report-page" aria-label="Ringkasan kampanye">
        <header class="report-heading">
            <p class="eyebrow">Security awareness / Campaign report</p>
            <h1>Evaluasi Kampanye<br>Simulasi Phishing</h1>
            <p class="report-subtitle"><?php echo $run_name; ?> · Campaign #<?php echo (int) ( $run['id'] ?? 0 ); ?></p>
        </header>
        <section>
            <h2>1. Informasi Kampanye &amp; Skenario</h2>
            <div class="meta-grid"><table><?php echo $meta_html; ?></table></div>
        </section>
        <section>
            <h2>2. Ringkasan Eksekutif</h2>
            <p><?php echo $summary_p1; ?></p>
            <p class="summary-result"><?php echo $summary_p2; ?></p>
        </section>
        <section>
            <?php echo $kpi_html; ?>
            <h2>3. Ringkasan Metrik &amp; Grafik Visual</h2>
            <?php echo $charts_html; ?>
            <p class="method-note">Persentase metrik dihitung dari total target. Distribusi respons memakai kategori eksklusif; pelaporan mendapat prioritas, disusul klik/pengiriman data.</p>
        </section>
    </article>
    <article class="report-page" aria-label="Temuan dan rekomendasi">
        <header class="report-heading">
            <p class="eyebrow">Temuan &amp; tindak lanjut</p>
            <h1>Hasil Evaluasi</h1>
        </header>
        <section>
            <h2>4. Detail Target &amp; Temuan Audit</h2>
            <table class="target-table">
                <colgroup><col style="width:18%"><col style="width:27%"><col style="width:14%"><col style="width:20%"><col style="width:21%"></colgroup>
                <thead><tr><th>Nama Target</th><th>Detail Email</th><th>Departemen</th><th>Status Email</th><th>Pelaporan</th></tr></thead>
                <tbody><?php echo $target_rows_html; ?></tbody>
            </table>
            <ul class="findings"><?php echo $findings_html; ?></ul>
        </section>
        <section>
            <h2>5. Matriks Penilaian Risiko</h2>
            <?php echo $risk_matrix_html; ?>
            <p class="method-note">Penilaian merupakan indikator simulasi berdasarkan aturan Pukat. Pelaporan mengukur respons target; ukuran sampel saja tidak membuktikan representasi seluruh organisasi.</p>
        </section>
        <section>
            <h2>6. Rekomendasi Audit &amp; Rencana Tindak Lanjut</h2>
            <ul><?php echo $recommendations_html; ?></ul>
        </section>
        <div class="signature-container">
            <div class="signature-box"><p>Dibuat Oleh,</p><div class="signature-line"></div><p><b>IT Auditor</b></p></div>
            <div class="signature-box"><p>Disetujui Oleh,</p><div class="signature-line"></div><p><b>CISO / Head of IT Security</b></p></div>
        </div>
    </article>
</main>
</body>
</html>
