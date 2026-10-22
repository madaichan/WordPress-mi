import{b as _e,z as M,q as Pe,r as m,j as e,c as A,l as Y,E as ue}from"./main-C96NTj9p.js";import{p as fe,u as Ee}from"./useProfileQueries-DF4z16K8.js";import{u as ye}from"./useMutation-DgzvDAfY.js";import{b as ve,c as Se,u as Ce}from"./useEntityQueries-U9_IWQhO.js";import{P as pe}from"./PageShell-BIvnoc-C.js";import{P as Le}from"./PageHeader-5giUD1wb.js";import{C as S}from"./Card-Dq8eH4ah.js";import{L as y}from"./Label-W0VBrwSP.js";import{I as v}from"./Input-C6M-GdzS.js";import{B as D}from"./Badge-BQag9_0x.js";import{B as w}from"./Button-BVpY08qX.js";import{T as Q}from"./Tabs-BQKMX9Rm.js";import{c as Me,d as Re,U as Ae,e as De,f as Te,g as Fe,b as Ie,s as Be,E as ze}from"./entitySectors-BFeciSKZ.js";import{S as $e}from"./Select-DXMf358C.js";import{A as ae}from"./AlertConfirmation-Bjdhvs1x.js";import{c as je}from"./useMasterAssetQueries-B8RaNh1Y.js";import{m as Ue,o as qe,p as He}from"./useMasterAssetMutations-DD8Kxxy5.js";import{a as Ge,b as We}from"./useFlagQueries-BW7K8_gJ.js";import{c as Ye,d as Je,e as Ke,f as Ve}from"./useFlagMutations-BtfKjJ5Q.js";import{A as Xe}from"./AssetEditorLayout-CXxvmtG4.js";import{B as Oe}from"./BrowserPreview-CPNioWKz.js";import{P as Qe}from"./Portal-D9_0hltO.js";import{H as Ze}from"./HtmlCodeEditor-CwYcXGg-.js";import"./Modal-DYyMF_3z.js";import"./masterAssetApi-CVoQjjEH.js";function X(a){return String(a??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}function ea({src:a,caption:t,alt:s,flagExampleId:i}={}){const n=String(t||"").trim(),l=X(n||s||"Example");return[`<figure${i!=null?` data-pukat-img="${X(i)}"`:""}>`,`  <img src="${X(a)}" alt="${l}">`,n?`  <figcaption>${X(n)}</figcaption>`:null,"</figure>"].filter(Boolean).join(`
`)}function aa(a,t,s){const i=String(a||""),n=String(t||"");if(!n)return i;if(typeof s=="number"&&s>=0&&s<=i.length){const d=i.slice(0,s),o=i.slice(s),g=d&&!d.endsWith(`
`)?`
`:"",u=o&&!o.startsWith(`
`)?`
`:"";return d+g+n+u+o}const l=i.toLowerCase().lastIndexOf("</body>");return l===-1?i?`${i.replace(/\s+$/,"")}
${n}
`:`${n}
`:`${i.slice(0,l).replace(/\s+$/,"")}
${n}
${i.slice(l)}`}function na(){return sa}const ee=`<div class="image-box">
                        <!-- Taruh kursor di baris di bawah ini, pilih gambar di strip "example images", lalu klik "Insert at cursor". -->
                        <span class="only-id" style="color:#94a3b8;font-size:13px;">Sisipkan gambar contoh di sini.</span>
                        <span class="only-en" style="color:#94a3b8;font-size:13px;">Insert an example image here.</span>
                    </div>`,sa=`<!DOCTYPE html>
<html lang="id">

<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Edukasi Keamanan Email / Email Security Training</title>
    <style type="text/css">
        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }

        body {
            background-color: #f4f6f9;
            color: #333;
            line-height: 1.6;
            padding: 20px;
        }

        .container {
            max-width: 800px;
            margin: 0 auto;
            background: #ffffff;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
            padding: 30px;
        }

        .lang-switch {
            display: flex;
            justify-content: flex-end;
            gap: 8px;
            margin-bottom: 16px;
        }

        .lang-switch button {
            border: 1px solid #cbd5e1;
            background: #fff;
            color: #475569;
            padding: 6px 14px;
            border-radius: 20px;
            cursor: pointer;
            font-size: 13px;
            font-weight: 600;
        }

        .lang-switch button.active {
            background: #2563eb;
            color: #fff;
            border-color: #2563eb;
        }

        h1 {
            color: #1e293b;
            text-align: center;
            margin-bottom: 10px;
            font-size: 24px;
        }

        p.subtitle {
            text-align: center;
            color: #64748b;
            margin-bottom: 30px;
        }

        .card {
            background: #fff;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            margin-bottom: 24px;
            overflow: hidden;
        }

        .card-header {
            background: #f8fafc;
            padding: 12px 20px;
            font-weight: bold;
            font-size: 18px;
            border-bottom: 1px solid #e2e8f0;
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .card-header .number {
            background: #2563eb;
            color: #fff;
            width: 28px;
            height: 28px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 14px;
            flex-shrink: 0;
        }

        .card-body {
            padding: 20px;
        }

        .image-box {
            background: #f1f5f9;
            border: 1px dashed #cbd5e1;
            padding: 15px;
            border-radius: 6px;
            margin-bottom: 15px;
            text-align: center;
        }

        .image-box img {
            max-width: 100%;
            height: auto;
            border-radius: 4px;
            box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
        }

        figure {
            margin: 0;
        }

        figure img {
            max-width: 100%;
            height: auto;
            border-radius: 4px;
            box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
        }

        figcaption {
            margin-top: 6px;
            font-size: 13px;
            color: #64748b;
        }

        .details-title {
            font-weight: 600;
            margin-bottom: 8px;
            color: #0f172a;
        }

        ul {
            padding-left: 20px;
        }

        li {
            margin-bottom: 8px;
            color: #475569;
        }

        .highlight {
            background-color: #fef08a;
            padding: 2px 6px;
            border-radius: 4px;
            font-family: monospace;
            font-weight: bold;
        }

        .alert-banner {
            background-color: #fee2e2;
            border-left: 4px solid #ef4444;
            padding: 15px;
            border-radius: 4px;
            margin-top: 30px;
        }

        .alert-banner h3 {
            color: #991b1b;
            margin-bottom: 5px;
            font-size: 16px;
        }

        .alert-banner p {
            color: #7f1d1d;
            font-size: 14px;
        }

        .question {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 16px 20px;
            margin-top: 16px;
        }

        .q-text {
            font-weight: 600;
            color: #0f172a;
            margin-bottom: 12px;
        }

        .options {
            display: flex;
            gap: 12px;
            flex-wrap: wrap;
        }

        .options label {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            border: 1px solid #cbd5e1;
            border-radius: 6px;
            padding: 8px 18px;
            cursor: pointer;
            color: #334155;
            background: #fff;
            min-width: 110px;
        }

        .options input[type="radio"] {
            accent-color: #2563eb;
        }

        .submit-btn {
            display: block;
            width: 100%;
            background: #2563eb;
            color: #fff;
            border: none;
            padding: 14px;
            font-size: 16px;
            font-weight: 600;
            border-radius: 8px;
            cursor: pointer;
            margin-top: 8px;
        }

        /* Language visibility: body carries lang-id or lang-en */
        body.lang-id .only-en {
            display: none;
        }

        body.lang-en .only-id {
            display: none;
        }
    </style>
</head>

<body class="lang-id">
    <div class="container">
        <div class="lang-switch"><button id="btn-id" onclick="setLang('id')" type="button">Bahasa
                Indonesia</button><button id="btn-en" onclick="setLang('en')" type="button">English</button></div>

        <h1><span class="only-id">Panduan Ringkas: 3 Tanda Bahaya Email Phishing</span> <span class="only-en">Quick
                Guide: 3 Phishing Email Red Flags</span></h1>

        <p class="subtitle"><span class="only-id">Selalu perhatikan 3 indikator ini sebelum menindaklanjuti pesan atau
                menekan tautan pada email Anda.</span> <span class="only-en">Always check these 3 indicators before
                acting on a message or clicking any link in your email.</span></p>
        <!-- Each card teaches one red flag, then asks its comprehension question.
         The whole lesson is one form so a single submit captures all answers. -->

        <form action="" class="exam-form" method="post"><input name="rid" type="hidden" value="{{.RId}}" /> <input
                id="lang-field" name="lang" type="hidden" value="id" /> <!-- Flag 1 -->
            <div class="card">
                <div class="card-header">
                    <div class="number">1</div>
                    <span><span class="only-id">Tag Peringatan Otomatis <code>[Beware]</code></span> <span
                            class="only-en">Automatic Warning Tag <code>[Beware]</code></span> </span>
                </div>

                <div class="card-body">
                    ${ee}

                    <div class="details-title"><span class="only-id">Apa yang harus Anda lakukan?</span> <span
                            class="only-en">What should you do?</span></div>

                    <ul>
                        <li><span class="only-id"><strong>Label Peringatan Sistem:</strong> Label <span
                                    class="highlight">[Beware]</span> ditambahkan otomatis oleh sistem keamanan email
                                untuk menandai pesan berisiko.</span> <span class="only-en"><strong>System warning
                                    label:</strong> The <span class="highlight">[Beware]</span> label is added
                                automatically by the email security system to flag risky messages.</span></li>
                        <li><span class="only-id"><strong>Tahan Diri:</strong> Jangan mengeklik tautan, mengunduh
                                lampiran, atau menyetujui permintaan (<i>Approval</i>) yang ada pada email
                                tersebut.</span> <span class="only-en"><strong>Hold back:</strong> Do not click links,
                                download attachments, or grant any approval requested in that email.</span></li>
                        <li><span class="only-id"><strong>Konfirmasi Mandiri:</strong> Verifikasi nomor transaksi atau
                                <i>Service Request</i> melalui jalur komunikasi internal yang resmi.</span> <span
                                class="only-en"><strong>Verify independently:</strong> Confirm the transaction number or
                                service request through an official internal channel.</span></li>
                    </ul>

                    <div class="question">
                        <p class="q-text"><span class="only-id">Apakah Anda sempat memperhatikan/memeriksa tanda <span
                                    class="highlight">[Beware]</span> pada email yang Anda terima?</span> <span
                                class="only-en">Did you notice/check the <span class="highlight">[Beware]</span> tag on
                                the email you received?</span></p>

                        <div class="options"><label><input name="answer_1" required="" type="radio" value="yes" /> <span
                                    class="only-id">Ya</span><span class="only-en">Yes</span></label> <label><input
                                    name="answer_1" type="radio" value="no" /> <span class="only-id">Tidak</span><span
                                    class="only-en">No</span></label></div>
                    </div>
                </div>
            </div>
            <!-- Flag 2 -->

            <div class="card">
                <div class="card-header">
                    <div class="number">2</div>
                    <span><span class="only-id">Pemeriksaan Detail Pengirim (<i>Sender</i>)</span> <span
                            class="only-en">Checking the Sender Details</span> </span>
                </div>

                <div class="card-body">
                    ${ee}

                    <div class="details-title"><span class="only-id">Apa yang harus Anda lakukan?</span> <span
                            class="only-en">What should you do?</span></div>

                    <ul>
                        <li><span class="only-id"><strong>Cek Alamat Email Lengkap:</strong> Jangan hanya melihat nama
                                tampilan (<i>Display Name</i>), tetapi periksa alamat email lengkap di dalam tanda
                                kurung siku <code>&lt;...&gt;</code>.</span> <span class="only-en"><strong>Check the
                                    full email address:</strong> Don&#39;t rely on the display name; inspect the full
                                address inside the angle brackets <code>&lt;...&gt;</code>.</span></li>
                        <li><span class="only-id"><strong>Periksa Domain:</strong> Pastikan domain setelah tanda
                                <code>@</code> (misal: <code>industry-platform.com</code>) sesuai dengan
                                instansi/perusahaan resmi.</span> <span class="only-en"><strong>Inspect the
                                    domain:</strong> Make sure the domain after the <code>@</code> (e.g.
                                <code>industry-platform.com</code>) matches the official organization.</span></li>
                        <li><span class="only-id"><strong>Waspadai Penyamaran:</strong> Jika pengirim mengaku dari
                                internal atau vendor terpercaya tetapi menggunakan domain asing, indikasi kuat pesan
                                tersebut adalah penipuan.</span> <span class="only-en"><strong>Beware of
                                    spoofing:</strong> If a sender claims to be internal or a trusted vendor but uses an
                                unfamiliar domain, it is a strong sign of fraud.</span></li>
                    </ul>

                    <div class="question">
                        <p class="q-text"><span class="only-id">Apakah Anda memperhatikan/memeriksa alamat email lengkap
                                dan domain pengirim?</span> <span class="only-en">Did you pay attention to / check the
                                full email address and sender domain?</span></p>

                        <div class="options"><label><input name="answer_2" required="" type="radio" value="yes" /> <span
                                    class="only-id">Ya</span><span class="only-en">Yes</span></label> <label><input
                                    name="answer_2" type="radio" value="no" /> <span class="only-id">Tidak</span><span
                                    class="only-en">No</span></label></div>
                    </div>
                </div>
            </div>
            <!-- Flag 3 -->

            <div class="card">
                <div class="card-header">
                    <div class="number">3</div>
                    <span><span class="only-id">Banner Pengirim Eksternal (<i>EXTERNAL SENDER</i>)</span> <span
                            class="only-en">External Sender Banner (<i>EXTERNAL SENDER</i>)</span> </span>
                </div>

                <div class="card-body">
                    ${ee}

                    <div class="details-title"><span class="only-id">Apa yang harus Anda lakukan?</span> <span
                            class="only-en">What should you do?</span></div>

                    <ul>
                        <li><span class="only-id"><strong>Tingkatkan Kewaspadaan:</strong> Banner merah mencolok ini
                                memberi peringatan tegas bahwa pesan dikirim dari luar organisasi. Ekstra hati-hati
                                terhadap lampiran dan tautan.</span> <span class="only-en"><strong>Raise your
                                    guard:</strong> This prominent red banner clearly warns that the message came from
                                outside the organization. Be extra careful with attachments and links.</span></li>
                        <li><span class="only-id"><strong>Deteksi Penyamaran:</strong> Jika email mengaku dari rekan
                                kerja/atasan tetapi bertanda <i>EXTERNAL SENDER</i>, itu adalah upaya penyamaran
                                (<i>impersonation</i>).</span> <span class="only-en"><strong>Spot
                                    impersonation:</strong> If an email claims to be from a colleague or manager but is
                                marked <i>EXTERNAL SENDER</i>, it is an impersonation attempt.</span></li>
                        <li><span class="only-id"><strong>Laporkan Segera:</strong> Jika dicurigai sebagai penipuan,
                                lakukan klik kanan pada email lalu pilih <b>Block</b> atau <b>Report as Phishing /
                                    Spam</b> (atau hubungi IT Care).</span> <span class="only-en"><strong>Report
                                    immediately:</strong> If you suspect fraud, right-click the email and choose
                                <b>Block</b> or <b>Report as Phishing / Spam</b> (or contact IT Care).</span></li>
                    </ul>

                    <div class="question">
                        <p class="q-text"><span class="only-id">Apakah Anda memperhatikan/memeriksa tanda <i>EXTERNAL
                                    SENDER</i> sehingga patut dicurigai?</span> <span class="only-en">Did you
                                notice/check the <i>EXTERNAL SENDER</i> banner that should raise suspicion?</span></p>

                        <div class="options"><label><input name="answer_3" required="" type="radio" value="yes" /> <span
                                    class="only-id">Ya</span><span class="only-en">Yes</span></label> <label><input
                                    name="answer_3" type="radio" value="no" /> <span class="only-id">Tidak</span><span
                                    class="only-en">No</span></label></div>
                    </div>
                </div>
            </div>
            <!-- Himbauan / Reminder -->

            <div class="alert-banner">
                <h3><span class="only-id">Ingat Prinsip Utama:</span> <span class="only-en">Remember the Golden
                        Rule:</span></h3>

                <p><span class="only-id">Jika Anda ragu terhadap keabsahan suatu email, jangan pernah menekan tautan
                        atau memberikan informasi sensitif. Segera laporkan ke tim Cyber Security / IT Helpdesk
                        Anda.</span> <span class="only-en">If you doubt an email&#39;s legitimacy, never click a link or
                        share sensitive information. Report it to your Cyber Security team / IT Helpdesk right
                        away.</span></p>
            </div>
            <button class="submit-btn" type="submit"><span class="only-id">Kirim Jawaban</span> <span
                    class="only-en">Submit Answers</span></button>
        </form>
    </div>
    <script>
        function setLang(lang) {
            document.body.className = 'lang-' + lang;
            document.documentElement.lang = lang;
            var field = document.getElementById('lang-field');
            if (field) { field.value = lang; }
            var bId = document.getElementById('btn-id');
            var bEn = document.getElementById('btn-en');
            if (bId) { bId.classList.toggle('active', lang === 'id'); }
            if (bEn) { bEn.classList.toggle('active', lang === 'en'); }
        }
        // Default to Indonesian.
        setLang('id');
    <\/script>
</body>

</html>
`;function ta(a){return!a||!a.id?{key:"none",label:"No page",tone:"gray"}:a.status!=="published"?{key:"draft",label:"Draft",tone:"gray"}:a.has_unpublished_changes?{key:"changes",label:"Unpublished changes",tone:"warning"}:{key:"published",label:"Published",tone:"success"}}function ia(a={}){const t=_e();return ye({mutationFn:fe.update,onSuccess:(s,i,n)=>{var l;M.success("Profile updated successfully."),t.invalidateQueries({queryKey:Pe.me}),(l=a.onSuccess)==null||l.call(a,s,i,n)},onError:(s,i,n)=>{var l;M.error(s.message),(l=a.onError)==null||l.call(a,s,i,n)}})}function la(a={}){return ye({mutationFn:fe.changePassword,onSuccess:(t,s,i)=>{var n;M.success("Password changed. Redirecting to login..."),(n=a.onSuccess)==null||n.call(a,t,s,i)},onError:(t,s,i)=>{var n;M.error(t.message),(n=a.onError)==null||n.call(a,t,s,i)}})}function oa({profile:a,canEdit:t}){const s=m.useRef(null),[i,n]=m.useState(null),[l,d]=m.useState(0),[o,g]=m.useState(!1);function u(){n(null),s.current&&(s.current.value="")}const f=Me({onSuccess:u,onError:u}),j=Re({onSuccess:()=>g(!1)}),h=f.isPending;m.useEffect(()=>{if(!h)return;d(0);const p=Date.now(),N=setInterval(()=>d(Math.floor((Date.now()-p)/1e3)),1e3);return()=>clearInterval(N)},[h]);function C(p){var T;const N=(T=p.target.files)==null?void 0:T[0];if(!N)return;const _=new FormData;_.append("file",N),n({percent:0,phase:"uploading",fileName:N.name,fileSize:N.size}),f.mutate({id:a.id,formData:_,onProgress:z=>{const F=z.total?Math.min(100,Math.round(z.loaded*100/z.total)):0;n(P=>P&&{...P,percent:F,phase:F>=100?"processing":"uploading"})}})}return e.jsxs("div",{className:"space-y-2",children:[e.jsxs("div",{className:"flex items-center gap-4",children:[e.jsx("div",{className:"flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-line bg-panel-subtle",children:a.logo_url?e.jsx("img",{src:a.logo_url,alt:`${a.display_name||a.entity_name} logo`,className:"h-full w-full object-contain"}):e.jsx("i",{className:"ti ti-building text-2xl text-ink-faint"})}),t&&e.jsxs("div",{className:"space-y-1",children:[e.jsxs("div",{className:"flex flex-wrap gap-2",children:[e.jsx(w,{type:"button",variant:"secondary",onClick:()=>{var p;return(p=s.current)==null?void 0:p.click()},disabled:h||j.isPending,children:a.logo_url?"Replace logo":"Upload logo"}),a.logo_url&&e.jsx(w,{type:"button",variant:"ghost",onClick:()=>g(!0),disabled:h||j.isPending,children:"Remove"})]}),e.jsx("p",{className:"text-xs text-ink-muted",children:"PNG, JPEG or WebP. Resized to at most 512 px."}),e.jsx("input",{ref:s,type:"file",accept:"image/png,image/jpeg,image/webp",className:"hidden",onChange:C})]})]}),i&&e.jsx(Ae,{fileName:i.fileName,fileSize:i.fileSize,percent:i.percent,phase:i.phase,elapsedSeconds:l}),o&&e.jsx(ae,{title:"Remove logo?",message:"The logo image will be deleted from this entity's profile.",icon:"ti-trash",tone:"danger",confirmLabel:"Remove",pendingLabel:"Removing...",isPending:j.isPending,onCancel:()=>g(!1),onConfirm:()=>j.mutate(a.id)})]})}function ge(a){return{display_name:(a==null?void 0:a.display_name)||"",sector:(a==null?void 0:a.sector)||"",employee_count:(a==null?void 0:a.employee_count)??"",location:(a==null?void 0:a.location)||"",description:(a==null?void 0:a.description)||"",contact_name:(a==null?void 0:a.contact_name)||"",contact_email:(a==null?void 0:a.contact_email)||"",contact_phone:(a==null?void 0:a.contact_phone)||""}}function ra({profile:a,canEdit:t}){const[s,i]=m.useState(()=>ge(a)),n=De();m.useEffect(()=>{i(ge(a))},[a]);function l(o,g){i(u=>({...u,[o]:g}))}function d(o){o.preventDefault(),n.mutate({id:a.id,data:s})}return e.jsxs("form",{onSubmit:d,className:"space-y-4",children:[e.jsxs("div",{children:[e.jsx(y,{children:"Logo"}),e.jsx(oa,{profile:a,canEdit:t})]}),e.jsxs("div",{className:"grid grid-cols-1 gap-3 sm:grid-cols-2",children:[e.jsxs("div",{children:[e.jsx(y,{children:"Entity name"}),e.jsx(v,{value:a.entity_name,disabled:!0})]}),e.jsxs("div",{children:[e.jsx(y,{children:"Display name"}),e.jsx(v,{value:s.display_name,onChange:o=>l("display_name",o.target.value),placeholder:a.entity_name,disabled:!t}),e.jsx("p",{className:"mt-1 text-xs text-ink-muted",children:"Shown in reports. Falls back to the entity name."})]})]}),e.jsxs("div",{className:"grid grid-cols-1 gap-3 sm:grid-cols-3",children:[e.jsxs("div",{children:[e.jsx(y,{children:"Sector"}),e.jsxs($e,{value:s.sector,onChange:o=>l("sector",o.target.value),disabled:!t,children:[e.jsx("option",{value:"",children:"Not set"}),Te.map(o=>e.jsx("option",{value:o.value,children:o.label},o.value))]})]}),e.jsxs("div",{children:[e.jsx(y,{children:"Employees"}),e.jsx(v,{type:"number",min:"0",step:"1",value:s.employee_count,onChange:o=>l("employee_count",o.target.value),disabled:!t})]}),e.jsxs("div",{children:[e.jsx(y,{children:"Location"}),e.jsx(v,{value:s.location,onChange:o=>l("location",o.target.value),placeholder:"Jakarta",disabled:!t})]})]}),e.jsxs("div",{children:[e.jsx(y,{children:"Description"}),e.jsx(v,{value:s.description,onChange:o=>l("description",o.target.value),disabled:!t})]}),e.jsxs("div",{className:"grid grid-cols-1 gap-3 sm:grid-cols-2",children:[e.jsxs("div",{children:[e.jsx(y,{children:"Contact name"}),e.jsx(v,{value:s.contact_name,onChange:o=>l("contact_name",o.target.value),disabled:!t})]}),e.jsxs("div",{children:[e.jsx(y,{children:"Contact phone"}),e.jsx(v,{type:"tel",value:s.contact_phone,onChange:o=>l("contact_phone",o.target.value),disabled:!t})]})]}),e.jsxs("div",{children:[e.jsx(y,{children:"Contact email"}),e.jsx(v,{type:"email",value:s.contact_email,onChange:o=>l("contact_email",o.target.value),disabled:!t})]}),t&&e.jsx("div",{className:"flex justify-end",children:e.jsx(w,{type:"submit",variant:"primary",disabled:n.isPending,children:n.isPending?"Saving...":"Save entity profile"})})]})}const da={authorized:"success",pending:"warning",rejected:"danger",expired:"gray"};function ca({entityName:a,canManage:t=!1}){const[s,i]=m.useState(""),[n,l]=m.useState(null),{data:d=[],isLoading:o}=je(),g=Ue({onSuccess:()=>i("")}),u=qe({onSuccess:()=>l(null)}),f=He(),j=m.useMemo(()=>d.filter(p=>String(p.owner_entity||"").toLowerCase()===String(a).toLowerCase()),[d,a]);function h(){const p=s.trim().toLowerCase();if(!p||!p.includes(".")){M.error("Enter a valid domain name.");return}g.mutate({domain:p,base_landing_url:`https://${p}`,tracking_url:`https://${p}/track`,environment:"production",owner_entity:a,status:"draft",authorization_status:"pending"})}function C(){n&&u.mutate(n.id)}return e.jsxs("div",{className:"space-y-3",children:[e.jsx("p",{className:"text-xs text-ink-muted",children:"Domains used to host this entity's simulation landing pages. New domains start as pending until an admin authorizes them."}),t&&e.jsxs("div",{className:"flex gap-2",children:[e.jsx(v,{value:s,onChange:p=>i(p.target.value),placeholder:"simulation.example.com",onKeyDown:p=>{p.key==="Enter"&&h()}}),e.jsx(w,{variant:"primary",onClick:h,disabled:g.isPending,children:"Add"})]}),o?e.jsx("p",{className:"text-sm text-ink-faint",children:"Loading..."}):j.length===0?e.jsx("p",{className:"text-sm text-ink-faint",children:"No landing page domains registered for this entity."}):e.jsx("ul",{className:"space-y-2",children:j.map(p=>e.jsxs("li",{className:"flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line-soft px-3 py-2",children:[e.jsxs("div",{className:"flex flex-wrap items-center gap-2",children:[e.jsx("span",{className:"text-sm font-medium text-ink-soft",children:p.domain}),e.jsx(D,{tone:da[p.authorization_status]||"gray",children:p.authorization_status||"pending"}),e.jsx(D,{tone:p.status==="active"?"success":"gray",children:p.status||"draft"}),e.jsxs("span",{className:"text-[11px] text-ink-faint",children:["DNS: ",p.dns_status||"unknown"," · TLS: ",p.tls_status||"unknown"]})]}),t&&e.jsxs("div",{className:"flex items-center gap-3",children:[e.jsx("button",{type:"button",className:"text-xs font-semibold text-violet-600 dark:text-violet-400 hover:underline",onClick:()=>f.mutate(p.id),disabled:f.isPending,children:"Check DNS/TLS"}),e.jsx("button",{type:"button",className:"text-xs font-semibold text-danger hover:underline",onClick:()=>l(p),disabled:u.isPending,children:"Delete"})]})]},p.id))}),n&&e.jsx(ae,{title:"Delete domain?",message:`"${n.domain}" will be deleted from this entity's landing page domains.`,icon:"ti-trash",tone:"danger",confirmLabel:"Delete",pendingLabel:"Deleting...",isPending:u.isPending,onCancel:()=>l(null),onConfirm:C})]})}const ma={contact_name:"",contact_phone:"",contact_email:""};function ua({entityName:a,canEdit:t}){const{data:s,isLoading:i}=ve(a),[n,l]=m.useState(ma),d=Fe();m.useEffect(()=>{l({contact_name:(s==null?void 0:s.contact_name)||"",contact_phone:(s==null?void 0:s.contact_phone)||"",contact_email:(s==null?void 0:s.contact_email)||""})},[s]);function o(u,f){l(j=>({...j,[u]:f}))}function g(u){u.preventDefault(),d.mutate({entityName:a,data:n})}return i?e.jsx("p",{className:"text-sm text-ink-faint",children:"Loading..."}):e.jsxs("form",{onSubmit:g,className:"space-y-4",children:[e.jsxs("div",{children:[e.jsx(y,{children:"Contact / team name"}),e.jsx(v,{value:n.contact_name,onChange:u=>o("contact_name",u.target.value),placeholder:"e.g. Security Operations Center",disabled:!t})]}),e.jsxs("div",{className:"grid grid-cols-1 gap-3 sm:grid-cols-2",children:[e.jsxs("div",{children:[e.jsx(y,{children:"Phone"}),e.jsx(v,{type:"tel",value:n.contact_phone,onChange:u=>o("contact_phone",u.target.value),placeholder:"e.g. 021-555-0100",disabled:!t})]}),e.jsxs("div",{children:[e.jsx(y,{children:"Email"}),e.jsx(v,{type:"email",value:n.contact_email,onChange:u=>o("contact_email",u.target.value),placeholder:"e.g. soc@company.co.id",disabled:!t})]})]}),t&&e.jsx("div",{className:"flex justify-end",children:e.jsx(w,{type:"submit",variant:"primary",disabled:d.isPending,children:d.isPending?"Saving...":"Save report contact"})})]})}const he=[{key:"code",label:"HTML Code",icon:"ti-code"},{key:"preview",label:"Live Preview",icon:"ti-eye"}];function pa({examples:a=[],adminEntity:t=null,canEdit:s=!1,canPublish:i=!1,onDirtyChange:n}){const l=m.useMemo(()=>t?{entity:t}:{},[t]),{data:d,isLoading:o,isError:g,error:u}=Ge(l);return o?e.jsx("p",{className:"text-sm text-ink-faint",children:"Loading..."}):g||!d?e.jsx("p",{className:"text-sm text-danger",children:(u==null?void 0:u.message)||"Could not load the education page."}):e.jsx(ga,{page:d,examples:a,requestExtras:l,canEdit:s,canPublish:i,onDirtyChange:n},t||"self")}function ga({page:a,examples:t,requestExtras:s,canEdit:i,canPublish:n,onDirtyChange:l}){const[d,o]=m.useState(a.title||""),[g,u]=m.useState(a.html_body||""),[f,j]=m.useState(a.launch_url||""),[h,C]=m.useState("code"),[p,N]=m.useState(!1),[_,T]=m.useState([]),[z,F]=m.useState(null),[P,H]=m.useState(!1),[L,K]=m.useState(()=>typeof window<"u"?window.innerHeight:800);m.useEffect(()=>{if(!P)return;const r=()=>K(window.innerHeight),x=V=>{V.key==="Escape"&&H(!1)};r(),window.addEventListener("resize",r),window.addEventListener("keydown",x);const b=document.body.style.overflow;return document.body.style.overflow="hidden",()=>{window.removeEventListener("resize",r),window.removeEventListener("keydown",x),document.body.style.overflow=b}},[P]);const I=Ye(),G=Je(),$=Ke(),U=Ve(),k=I.isPending||G.isPending||$.isPending||U.isPending,q=a.editable===!1,Z=a.active_simulations||[],E=i&&!q,c=n&&!q,{data:B=[]}=je(),W=m.useMemo(()=>B.filter(r=>r.type==="education"&&r.base_landing_url).map(r=>({url:r.base_landing_url,label:`${r.domain} (${r.base_landing_url})`})),[B]),R=d!==(a.title||"")||g!==(a.html_body||"")||f!==(a.launch_url||""),ne=ta(a),J=a.status==="published",se=J&&!R&&!a.has_unpublished_changes,te=m.useMemo(()=>{const r=new Map;return t.forEach(x=>{const b=x.flag_id;r.has(b)||r.set(b,{flagId:b,label:x.flag_label||"Flag",items:[]}),r.get(b).items.push(x)}),[...r.values()]},[t]);m.useEffect(()=>{l==null||l(R)},[R,l]),m.useEffect(()=>()=>l==null?void 0:l(!1),[l]);const ie=()=>({...s,title:d.trim(),html_body:g,launch_url:f});function le(){return d.trim()?!0:(M.error("Nama template is required."),!1)}function oe(){le()&&I.mutate({data:ie()})}function ke(){o(a.title||""),u(a.html_body||""),j(a.launch_url||"")}async function we(){if(le()){if(!g.trim()){M.error("Add some content before publishing.");return}try{(R||!a.id)&&await I.mutateAsync({data:ie()});const r=await G.mutateAsync({data:s});r!=null&&r.sync&&r.sync.ok===!1?M.error(`Published, but GoPhish sync failed: ${r.sync.message}`):r!=null&&r.master&&r.master.ok===!1&&r.master.message&&M.error(`Published & synced, but education campaign failed: ${r.master.message}`)}catch{}}}function re(){u(na()),d.trim()||o("Flag Email Security Education"),N(!1)}function Ne(r){T(x=>x.includes(r)?x.filter(b=>b!==r):[...x,r])}function de(){if(_.length===0)return;const r=new Map(t.map(b=>[b.id,b])),x=_.map(b=>r.get(b)).filter(Boolean).map(b=>ea({src:b.image_url,caption:b.caption,alt:b.flag_label,flagExampleId:b.id}));x.length!==0&&(u(b=>aa(b,x.join(`
`),z)),T([]),M.success(x.length===1?"Image inserted.":`${x.length} images inserted.`))}const ce=E?e.jsxs(w,{variant:"outline",size:"sm",onClick:()=>g.trim()?N(!0):re(),disabled:k,children:[e.jsx("i",{className:"ti ti-template text-sm"}),e.jsx("span",{children:"Use starter template"})]}):null;function me(r){return h==="code"?e.jsx(Xe,{fileName:"template.html",lineCount:g.split(`
`).length,lineCountLabel:"baris",children:E?e.jsx(Ze,{value:g,onChange:u,onCaretChange:F,height:r}):e.jsx("pre",{className:"overflow-auto p-4 font-mono text-xs text-ink-soft",style:{maxHeight:r},children:g||"No content yet."})}):e.jsx("div",{className:"flex min-h-[450px] flex-col items-center justify-center overflow-x-auto rounded-xl border border-line bg-panel-muted p-6",children:g.trim()?e.jsx(Oe,{html:g,redirectUrl:"education page",title:"Education page preview"}):e.jsxs("div",{className:"space-y-2 py-12 text-center text-ink-faint",children:[e.jsx("i",{className:"ti ti-eye-off text-3xl"}),e.jsx("p",{className:"text-xs font-medium",children:"Nothing to preview yet — add content in the HTML Code tab."})]})})}return e.jsxs("div",{className:"space-y-6 animate-fade-in",children:[q&&e.jsxs("div",{className:"flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-300",children:[e.jsx("i",{className:"ti ti-lock mt-0.5 text-base"}),e.jsxs("div",{children:[e.jsx("span",{className:"font-semibold",children:"This page is locked"}),e.jsxs("span",{className:"ml-1",children:["for editing until the next simulation has been completed or stopped: ",Z.map(r=>`${r.name} (${r.status})`).join(", ")||"—","."]})]})]}),e.jsxs("div",{className:"flex flex-wrap items-center justify-between gap-3",children:[e.jsxs("div",{children:[e.jsx("h2",{className:"text-lg font-bold text-ink",children:a.id?`Edit: ${a.title||"Education Page"}`:"Create Education Page"}),e.jsx("p",{className:"mt-0.5 text-xs text-ink-muted",children:"The HTML page your colleagues see after a simulation. Only the published version is shown to them."})]}),E&&e.jsxs("div",{className:"flex items-center gap-3",children:[e.jsx(w,{variant:"outline",onClick:ke,disabled:k||!R,title:R?"Discard unsaved changes":void 0,children:"Cancel"}),e.jsx(w,{variant:c?"outline":"primary",onClick:oe,disabled:k||!R,children:I.isPending?"Saving...":"Save Draft"}),c&&e.jsx(w,{variant:"primary",onClick:we,disabled:k||se,title:se?"The published version is up to date":void 0,children:G.isPending?"Publishing...":"Publish"})]})]}),e.jsxs("div",{className:"space-y-4 rounded-xl border border-line bg-panel p-5",children:[e.jsxs("div",{className:"grid grid-cols-1 gap-4 sm:grid-cols-2",children:[e.jsxs("label",{className:"block space-y-1 text-xs",children:[e.jsx("span",{className:"font-semibold text-ink-soft",children:"Template Name *"}),e.jsx("input",{value:d,onChange:r=>o(r.target.value),placeholder:"Contoh: Flag Education",maxLength:255,disabled:!E||k,className:A("w-full rounded-lg border border-line px-3 py-2 text-sm text-ink outline-none focus:border-violet-500",E?"bg-panel":"bg-panel-subtle text-ink-muted")})]}),e.jsxs("label",{className:"block space-y-1 text-xs",children:[e.jsx("span",{className:"font-semibold text-ink-soft",children:"Launch URL (campaign education)"}),e.jsxs("select",{value:f,onChange:r=>j(r.target.value),disabled:!E||k,className:A("w-full rounded-lg border border-line px-3 py-2 text-sm text-ink outline-none focus:border-violet-500",E?"bg-panel":"bg-panel-subtle text-ink-muted"),children:[e.jsx("option",{value:"",children:"— Pilih URL —"}),f&&!W.some(r=>r.url===f)&&e.jsx("option",{value:f,children:f}),W.map(r=>e.jsx("option",{value:r.url,children:r.label},r.url))]}),e.jsx("span",{className:"block text-[10px] text-ink-faint",children:"Domain used for education page."})]})]}),E&&e.jsxs("div",{className:"space-y-2 text-xs",children:[e.jsxs("div",{className:"flex flex-wrap items-center justify-between gap-2",children:[e.jsxs("div",{children:[e.jsx("span",{className:"font-semibold text-ink-soft",children:"Flags Images"}),e.jsx("p",{className:"text-[10px] text-ink-faint",children:"Select the image (click order = insert order), place the cursor in the editor, then Insert."})]}),e.jsx(w,{variant:"primary",size:"sm",onClick:de,disabled:k||_.length===0,children:`Insert at cursor${_.length?` (${_.length})`:""}`})]}),te.length===0?e.jsx("p",{className:"text-ink-faint",children:"No example images yet — upload some in the Images tab."}):e.jsx("div",{className:"flex gap-3 overflow-x-auto pb-1",children:te.map(r=>e.jsxs("div",{className:"w-28 flex-shrink-0 space-y-1.5",children:[e.jsx("span",{className:"block truncate text-[11px] font-semibold text-ink-muted",title:r.label,children:r.label}),e.jsx("div",{className:"max-h-44 space-y-2 overflow-y-auto pr-1",children:r.items.map(x=>{const b=_.indexOf(x.id),V=b!==-1;return e.jsxs("button",{type:"button",onClick:()=>Ne(x.id),disabled:k,title:x.caption||"Select this image",className:A("group relative block h-16 w-full overflow-hidden rounded-lg border bg-panel-subtle disabled:opacity-60",V?"border-violet-500 ring-2 ring-violet-300":"border-line hover:border-violet-400"),children:[e.jsx("img",{src:x.thumbnail_url,alt:x.caption||x.flag_label,className:"h-full w-full object-cover",loading:"lazy"}),V&&e.jsx("span",{className:"absolute left-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-violet-600 text-[11px] font-bold text-white",children:b+1})]},x.id)})})]},r.flagId))})]}),e.jsxs("div",{className:"flex flex-wrap items-center gap-2 border-t border-line-soft pt-3 text-xs",children:[e.jsx("span",{className:"font-semibold text-ink-muted",children:"Status"}),e.jsx(D,{tone:ne.tone,children:ne.label}),R&&e.jsx("span",{className:"text-ink-muted",children:"Unsaved changes"}),J&&(a.synced_at?e.jsx(D,{tone:"info",children:"GoPhish: synced"}):e.jsx(D,{tone:"warning",children:"GoPhish: not synced"})),J&&a.gophish_master_id&&e.jsx(D,{tone:"success",children:"Education campaign: ready"}),c&&J&&e.jsx("button",{type:"button",className:"font-semibold text-violet-600 dark:text-violet-400 hover:underline disabled:opacity-60",onClick:()=>U.mutate({data:s}),disabled:k,title:"Push the published page to GoPhish again",children:U.isPending?"Syncing...":"Sync to GoPhish"}),c&&J&&e.jsx("button",{type:"button",className:"font-semibold text-danger hover:underline disabled:opacity-60",onClick:()=>$.mutate({data:s}),disabled:k,children:$.isPending?"Unpublishing...":"Unpublish"})]})]}),!P&&e.jsxs("div",{className:"space-y-3",children:[e.jsxs("div",{className:"flex flex-wrap items-center justify-between gap-2",children:[e.jsx(Q,{items:he,active:h,onChange:C,variant:"pill"}),e.jsxs("div",{className:"flex items-center gap-2",children:[ce,e.jsxs(w,{variant:"outline",size:"sm",onClick:()=>H(!0),children:[e.jsx("i",{className:"ti ti-maximize text-sm"}),e.jsx("span",{children:"Fullscreen"})]})]})]}),me(420)]}),P&&e.jsx(Qe,{children:e.jsxs("div",{className:"fixed inset-0 z-50 flex flex-col bg-panel",children:[e.jsxs("div",{className:"flex items-center justify-between gap-3 border-b border-line px-4 py-2",children:[e.jsxs("div",{className:"flex min-w-0 items-center gap-3",children:[e.jsx("span",{className:"truncate text-sm font-semibold text-ink",children:d||"Education Page"}),e.jsx(Q,{items:he,active:h,onChange:C,variant:"pill"})]}),e.jsxs("div",{className:"flex items-center gap-2",children:[ce,E&&_.length>0&&e.jsx(w,{variant:"primary",size:"sm",onClick:de,disabled:k,children:`Insert at cursor (${_.length})`}),E&&e.jsx(w,{variant:"outline",size:"sm",onClick:oe,disabled:k||!R,children:I.isPending?"Saving...":"Save Draft"}),e.jsxs(w,{variant:"outline",size:"sm",onClick:()=>H(!1),children:[e.jsx("i",{className:"ti ti-minimize text-sm"}),e.jsx("span",{children:"Exit"})]})]})]}),e.jsx("div",{className:"flex-1 overflow-auto p-4",children:me(Math.max(320,L-150))})]})}),p&&e.jsx(ae,{title:"Replace the current content?",message:"The starter template will replace what is in the editor. Nothing is saved until you save the draft.",icon:"ti-template",tone:"danger",confirmLabel:"Replace",onCancel:()=>N(!1),onConfirm:re})]})}const ha=[{key:"page",label:"Education Page",icon:"ti-edit"},{key:"images",label:"Images",icon:"ti-photo"}];function xa({adminEntity:a=null,canManageExamples:t=!1,canEditPage:s=!1,canPublishPage:i=!1}){const n=m.useMemo(()=>a?{entity:a}:{},[a]),{data:l}=We(n),d=m.useMemo(()=>(l==null?void 0:l.examples)||[],[l]),[o,g]=m.useState("page"),[u,f]=m.useState(!1);m.useEffect(()=>{if(!u)return;const h=C=>{C.preventDefault(),C.returnValue=""};return window.addEventListener("beforeunload",h),()=>window.removeEventListener("beforeunload",h)},[u]);const j=m.useCallback(h=>f(!!h),[]);return e.jsxs("div",{className:"space-y-4",children:[e.jsx(Q,{items:ha,active:o,onChange:g,ariaLabel:"Flag sections"}),e.jsx("div",{className:A(o==="images"&&"hidden"),children:e.jsx(pa,{examples:d,adminEntity:a,canEdit:s,canPublish:i,onDirtyChange:j})}),o==="images"&&e.jsx(Ie,{canManage:t,adminEntity:a})]})}const ba={email_domains:{label:"Company email domain",hint:"At least one active domain",tab:"guardrails"},landing_domains:{label:"Landing page domain",hint:"At least one authorized by an admin",tab:"guardrails"},report_contact:{label:"Call center report contact",hint:"Who employees contact to report",tab:"report"},flag_examples:{label:"Flag examples",hint:"At least one example image",tab:"flags"},identity:{label:"Entity identity",hint:"Profile with a sector",tab:"entity"}},fa={required:"Required",recommended:"Recommended",optional:"Optional"};function ya({entityName:a,onOpenTab:t,compact:s=!1}){const{data:i,isLoading:n}=Se(a);if(n||!i)return null;const l=i.items||[],d=l.filter(o=>o.done).length;return e.jsxs(S,{className:"space-y-3",children:[e.jsxs("div",{className:"flex flex-wrap items-center justify-between gap-2",children:[e.jsxs("div",{children:[e.jsx("h2",{className:"text-sm font-semibold text-ink",children:"Entity readiness"}),e.jsxs("p",{className:"text-xs text-ink-muted",children:[d,"/",l.length," complete"]})]}),e.jsx(D,{tone:i.can_launch?"success":"danger",children:i.can_launch?"Ready to launch campaigns":"Campaigns cannot be launched"})]}),e.jsx("ul",{className:A("grid grid-cols-1 gap-2",!s&&"sm:grid-cols-2"),children:l.map(o=>{const g=ba[o.key]||{label:o.key,hint:""},u=o.level==="required"&&!o.done;return e.jsx("li",{children:e.jsxs("button",{type:"button",onClick:()=>g.tab&&(t==null?void 0:t(g.tab)),className:A("flex w-full items-start gap-2 rounded-lg border px-3 py-2 text-left transition hover:bg-panel-subtle",u?"border-red-500/30 bg-red-500/10":"border-line-soft"),children:[e.jsx("i",{className:A("ti mt-0.5 text-base",o.done?"ti-circle-check text-emerald-500":u?"ti-alert-circle text-danger":"ti-circle-dashed text-ink-faint")}),e.jsxs("span",{className:"min-w-0 flex-1",children:[e.jsxs("span",{className:"flex flex-wrap items-center gap-1.5",children:[e.jsx("span",{className:"text-sm font-medium text-ink-soft",children:g.label}),e.jsx("span",{className:A("text-[10px] font-semibold uppercase",o.level==="required"?"text-danger":"text-ink-faint"),children:fa[o.level]||o.level})]}),e.jsx("span",{className:"block text-xs text-ink-muted",children:g.hint})]})]})},o.key)})})]})}function O({icon:a,children:t}){return e.jsxs("li",{className:"flex items-start gap-2 text-xs text-ink-muted",children:[e.jsx("i",{className:`ti ${a} mt-0.5 text-sm text-ink-faint`}),e.jsx("span",{className:"min-w-0 break-words",children:t})]})}function va({entityName:a,profile:t,onOpenTab:s}){const{data:i}=ve(a),n=[i==null?void 0:i.contact_name,i==null?void 0:i.contact_phone,i==null?void 0:i.contact_email].filter(Boolean),l=t?[t.sector&&{icon:"ti-briefcase",text:Be(t.sector)},t.employee_count!=null&&{icon:"ti-users",text:`${t.employee_count.toLocaleString()} employees`},t.location&&{icon:"ti-map-pin",text:t.location}].filter(Boolean):[];return e.jsxs(S,{className:"space-y-4",children:[e.jsxs("div",{className:"flex items-center gap-3",children:[e.jsx("div",{className:"flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-line-soft bg-panel-subtle",children:t!=null&&t.logo_url?e.jsx("img",{src:t.logo_url,alt:"",className:"h-full w-full object-contain"}):e.jsx("i",{className:"ti ti-building text-xl text-ink-faint"})}),e.jsxs("div",{className:"min-w-0",children:[e.jsx("div",{className:"text-[10px] font-semibold uppercase tracking-wider text-ink-faint",children:"Entity"}),e.jsx("div",{className:"truncate text-sm font-semibold text-ink",children:(t==null?void 0:t.display_name)||a}),(t==null?void 0:t.display_name)&&t.display_name!==a&&e.jsx("div",{className:"truncate text-[11px] text-ink-faint",children:a})]})]}),t?l.length>0?e.jsx("ul",{className:"space-y-1.5",children:l.map(d=>e.jsx(O,{icon:d.icon,children:d.text},d.icon))}):e.jsx("button",{type:"button",onClick:()=>s==null?void 0:s("entity"),className:"text-xs font-semibold text-violet-600 dark:text-violet-400 hover:underline",children:"Add sector, size and location"}):e.jsx("p",{className:"text-xs text-ink-faint",children:"No entity profile yet — an admin creates it."}),e.jsxs("div",{className:"border-t border-line-soft pt-3",children:[e.jsx("div",{className:"mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-ink-faint",children:"Report contact"}),n.length>0?e.jsxs("ul",{className:"space-y-1.5",children:[i.contact_name&&e.jsx(O,{icon:"ti-user",children:i.contact_name}),i.contact_phone&&e.jsx(O,{icon:"ti-phone",children:i.contact_phone}),i.contact_email&&e.jsx(O,{icon:"ti-mail",children:i.contact_email})]}):e.jsx("button",{type:"button",onClick:()=>s==null?void 0:s("report"),className:"text-xs font-semibold text-violet-600 dark:text-violet-400 hover:underline",children:"Set a report contact"})]})]})}var xe,be;const ja=((xe=window.PukatData)==null?void 0:xe.logoutUrl)||`${((be=window.PukatData)==null?void 0:be.adminUrl)||"/wp-admin/"}wp-login.php?action=logout`,ka=[{key:"account",label:"My Account",icon:"ti-user"},{key:"entity",label:"Entity Profile",icon:"ti-building"},{key:"guardrails",label:"Guardrails",icon:"ti-shield-lock"},{key:"flags",label:"Flags",icon:"ti-flag"},{key:"report",label:"Call Center Report",icon:"ti-headset"}];function Ka(){const{data:a,isLoading:t}=Ee(),[s,i]=m.useState("account"),n=String((a==null?void 0:a.entity)||"").trim(),l=n.toLowerCase()==="general",d=Y(c=>c.isAdmin()),o=Y(c=>c.hasPermission("master_entities.edit")),g=Y(c=>c.hasPermission("domains.create")),u=Y(c=>c.hasPermission("flag_examples.upload")),f=Y(c=>c.hasPermission("flag_pages.edit")),j=Y(c=>c.hasPermission("flag_pages.publish")),h=!!n&&(d||!l&&o),C=!!n&&(d||!l&&g),p=!!n&&(d||!l&&u),N=!!n&&(d||!l&&f),_=!!n&&(d||!l&&j),{data:T=[],isLoading:z}=Ce({enabled:!!n}),F=m.useMemo(()=>T.find(c=>String(c.entity_name).toLowerCase()===n.toLowerCase())||null,[T,n]),[P,H]=m.useState({display_name:"",email:"",phone:""}),[L,K]=m.useState({current_password:"",new_password:"",confirm_password:""}),[I,G]=m.useState("");m.useEffect(()=>{a&&H({display_name:a.display_name||"",email:a.email||"",phone:a.phone||""})},[a]);const $=ia(),U=la({onSuccess:()=>{K({current_password:"",new_password:"",confirm_password:""}),setTimeout(()=>{window.location.href=ja},1200)}}),k=(c,B)=>H(W=>({...W,[c]:B})),q=(c,B)=>K(W=>({...W,[c]:B})),Z=c=>{c.preventDefault(),$.mutate(P)},E=c=>{if(c.preventDefault(),G(""),L.new_password!==L.confirm_password){G("New password and confirmation do not match.");return}U.mutate({current_password:L.current_password,new_password:L.new_password})};return t?e.jsx(pe,{spacing:"space-y-4",animated:!1,className:"max-w-2xl",children:[...Array(2)].map((c,B)=>e.jsx(S,{className:"h-40 animate-pulse bg-panel-muted"},B))}):e.jsxs(pe,{spacing:"space-y-6",className:n?"":"max-w-3xl",children:[e.jsx(Le,{title:"My Profile",subtitle:"Manage your account and your entity's information"}),e.jsx(S,{children:e.jsxs("div",{className:"flex items-center gap-4",children:[e.jsx("img",{src:a==null?void 0:a.avatar_url,alt:"Avatar",className:"h-14 w-14 rounded-full bg-panel-muted"}),e.jsxs("div",{children:[e.jsx("p",{className:"text-sm font-semibold text-ink",children:a==null?void 0:a.display_name}),e.jsxs("div",{className:"mt-1 flex items-center gap-2",children:[e.jsx(D,{tone:"violet",children:a==null?void 0:a.role}),(a==null?void 0:a.entity)&&e.jsx(D,{tone:"gray",children:a.entity})]})]})]})}),e.jsxs("div",{className:A("grid grid-cols-1 gap-6",n&&"lg:grid-cols-3 lg:items-start"),children:[e.jsxs("div",{className:"min-w-0 space-y-6 lg:col-span-2",children:[e.jsx(Q,{items:ka,active:s,onChange:i,ariaLabel:"My Profile sections"}),s==="account"&&e.jsxs(e.Fragment,{children:[e.jsx(S,{children:e.jsxs("form",{onSubmit:Z,children:[e.jsx("h2",{className:"text-sm font-semibold text-ink mb-1",children:"Profile Information"}),e.jsx("p",{className:"text-xs text-ink-muted mb-4",children:"Update your display name, email, and phone number."}),e.jsxs("div",{className:"space-y-4",children:[e.jsxs("div",{children:[e.jsx(y,{children:"Display Name"}),e.jsx(v,{value:P.display_name,onChange:c=>k("display_name",c.target.value),placeholder:"Your name"})]}),e.jsxs("div",{children:[e.jsx(y,{children:"Email"}),e.jsx(v,{type:"email",value:P.email,onChange:c=>k("email",c.target.value),placeholder:"you@example.com"})]}),e.jsxs("div",{children:[e.jsx(y,{children:"Phone Number"}),e.jsx(v,{type:"tel",value:P.phone,onChange:c=>k("phone",c.target.value),placeholder:"e.g. 08123456789"})]})]}),e.jsx("div",{className:"flex justify-end mt-4",children:e.jsx(w,{type:"submit",variant:"primary",disabled:$.isPending,children:$.isPending?"Saving...":"Save Changes"})})]})}),e.jsx(S,{children:e.jsxs("form",{onSubmit:E,children:[e.jsx("h2",{className:"text-sm font-semibold text-ink mb-1",children:"Change Password"}),e.jsx("p",{className:"text-xs text-ink-muted mb-4",children:"You will be logged out and need to sign in again after changing your password."}),I&&e.jsx("p",{className:"mb-3 text-xs text-danger",children:I}),e.jsxs("div",{className:"space-y-4",children:[e.jsxs("div",{children:[e.jsx(y,{children:"Current Password"}),e.jsx(v,{type:"password",autoComplete:"current-password",value:L.current_password,onChange:c=>q("current_password",c.target.value)})]}),e.jsxs("div",{children:[e.jsx(y,{children:"New Password"}),e.jsx(v,{type:"password",autoComplete:"new-password",value:L.new_password,onChange:c=>q("new_password",c.target.value)})]}),e.jsxs("div",{children:[e.jsx(y,{children:"Confirm New Password"}),e.jsx(v,{type:"password",autoComplete:"new-password",value:L.confirm_password,onChange:c=>q("confirm_password",c.target.value)})]})]}),e.jsx("div",{className:"flex justify-end mt-4",children:e.jsx(w,{type:"submit",variant:"primary",disabled:U.isPending||!L.current_password||!L.new_password,children:U.isPending?"Changing...":"Change Password"})})]})})]}),s!=="account"&&!n&&e.jsx(S,{children:e.jsx(ue,{icon:"ti-building-off",title:"Your account is not assigned to an entity",description:"Entity Profile, Guardrails, Flags and Call Center Report are managed per entity. Ask an admin to assign your entity."})}),s==="entity"&&n&&e.jsxs(S,{children:[e.jsx("h2",{className:"mb-1 text-sm font-semibold text-ink",children:"Entity Profile"}),e.jsx("p",{className:"mb-4 text-xs text-ink-muted",children:h?"Description and contact details for your entity.":"Read-only — only an admin can edit this entity."}),z?e.jsx("p",{className:"text-sm text-ink-faint",children:"Loading..."}):F?e.jsx(ra,{profile:F,canEdit:h}):e.jsx(ue,{icon:"ti-building",title:`No profile yet for "${n}"`,description:"Entity profiles are created by an admin. Once it exists, you can fill in its details here."})]}),s==="guardrails"&&n&&e.jsxs(e.Fragment,{children:[e.jsxs(S,{children:[e.jsx("h2",{className:"mb-3 text-sm font-semibold text-ink",children:"Landing page domains"}),e.jsx(ca,{entityName:n,canManage:C})]}),e.jsxs(S,{children:[e.jsx("h2",{className:"mb-3 text-sm font-semibold text-ink",children:"Company email domains"}),e.jsx(ze,{entityName:n,canManage:h,canToggle:h})]})]}),s==="report"&&n&&e.jsxs(S,{children:[e.jsx("h2",{className:"mb-1 text-sm font-semibold text-ink",children:"Call Center Report"}),e.jsx("p",{className:"mb-4 text-xs text-ink-muted",children:h?"Who employees of your entity should contact to report a suspicious email.":"Read-only — only an admin can edit this entity."}),e.jsx(ua,{entityName:n,canEdit:h})]}),s==="flags"&&n&&e.jsxs(S,{children:[e.jsx("h2",{className:"mb-1 text-sm font-semibold text-ink",children:"Flags"}),e.jsx("p",{className:"mb-3 text-xs text-ink-muted",children:"Build the education page your colleagues see after a simulation, one per Flag category. Write the page in the Editor, check it in Preview, and upload annotated example screenshots in Images."}),!p&&!N&&e.jsx("p",{className:"mb-3 text-xs text-ink-muted",children:"Read-only — you can view but not change this entity's education pages and examples."}),e.jsx("div",{className:"mt-3",children:e.jsx(xa,{entityName:n,adminEntity:d?n:null,canManageExamples:p,canEditPage:N,canPublishPage:_})})]})]}),n&&e.jsxs("aside",{className:"order-first space-y-6 lg:sticky lg:top-4 lg:order-none",children:[e.jsx(va,{entityName:n,profile:F,onOpenTab:i}),e.jsx(ya,{entityName:n,onOpenTab:i,compact:!0})]})]})]})}export{Ka as default};
