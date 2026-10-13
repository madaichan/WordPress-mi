import{h as Pe,p as Ee,g as Se,u as Ce,q as fe,b as Le,z as M,r as m,j as e,c as A,l as Y,E as pe}from"./main-DAxDwO-R.js";import{u as ve}from"./useMutation-BJqLNXPP.js";import{b as je,c as Me,u as Re}from"./useEntityQueries-9Ds8KjMP.js";import{P as ge}from"./PageShell-BfFc2P__.js";import{P as Ae}from"./PageHeader-CRaf_Fli.js";import{C as S}from"./Card-C1qxmwx9.js";import{L as f}from"./Label-D1c3485U.js";import{I as v}from"./Input-Knp-ifHQ.js";import{B as D}from"./Badge-DK1KIlQb.js";import{B as k}from"./Button-DDm8_VF5.js";import{T as O}from"./Tabs-Byou4Jo9.js";import{c as De,d as Te,U as Fe,e as Ie,f as Be,g as ze,b as $e,s as Ue,E as qe}from"./entitySectors-CCAYsg_D.js";import{S as He}from"./Select-CxlUCdhT.js";import{A as ae}from"./AlertConfirmation-DblxC8hO.js";import{c as we}from"./useMasterAssetQueries-NImqejiQ.js";import{m as Ge,o as We,p as Ye}from"./useMasterAssetMutations-E73Jl4lg.js";import{d as Je,e as Ke,f as Ve,g as Xe,h as Qe,i as Oe}from"./useFlagMutations-DrDndB4c.js";import{A as Ze}from"./AssetEditorLayout-XJvkFhgm.js";import{B as ea}from"./BrowserPreview-BCSGBF7A.js";import{P as aa}from"./Portal-D4OINyAo.js";import{H as sa}from"./HtmlCodeEditor-pFzI_kPC.js";import"./masterAssetApi-DBogONQj.js";const se={get:()=>Se("/me"),update:a=>Ee("/me",a),changePassword:a=>Pe("/me/change-password",a)};function na(a={}){return Ce({queryKey:fe.me,queryFn:se.get,...a})}function ta(a={}){const t=Le();return ve({mutationFn:se.update,onSuccess:(n,i,s)=>{var l;M.success("Profile updated successfully."),t.invalidateQueries({queryKey:fe.me}),(l=a.onSuccess)==null||l.call(a,n,i,s)},onError:(n,i,s)=>{var l;M.error(n.message),(l=a.onError)==null||l.call(a,n,i,s)}})}function ia(a={}){return ve({mutationFn:se.changePassword,onSuccess:(t,n,i)=>{var s;M.success("Password changed. Redirecting to login..."),(s=a.onSuccess)==null||s.call(a,t,n,i)},onError:(t,n,i)=>{var s;M.error(t.message),(s=a.onError)==null||s.call(a,t,n,i)}})}function la({profile:a,canEdit:t}){const n=m.useRef(null),[i,s]=m.useState(null),[l,d]=m.useState(0),[r,g]=m.useState(!1);function u(){s(null),n.current&&(n.current.value="")}const b=De({onSuccess:u,onError:u}),j=Te({onSuccess:()=>g(!1)}),h=b.isPending;m.useEffect(()=>{if(!h)return;d(0);const p=Date.now(),N=setInterval(()=>d(Math.floor((Date.now()-p)/1e3)),1e3);return()=>clearInterval(N)},[h]);function C(p){var T;const N=(T=p.target.files)==null?void 0:T[0];if(!N)return;const _=new FormData;_.append("file",N),s({percent:0,phase:"uploading",fileName:N.name,fileSize:N.size}),b.mutate({id:a.id,formData:_,onProgress:z=>{const F=z.total?Math.min(100,Math.round(z.loaded*100/z.total)):0;s(P=>P&&{...P,percent:F,phase:F>=100?"processing":"uploading"})}})}return e.jsxs("div",{className:"space-y-2",children:[e.jsxs("div",{className:"flex items-center gap-4",children:[e.jsx("div",{className:"flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-gray-50",children:a.logo_url?e.jsx("img",{src:a.logo_url,alt:`${a.display_name||a.entity_name} logo`,className:"h-full w-full object-contain"}):e.jsx("i",{className:"ti ti-building text-2xl text-gray-300"})}),t&&e.jsxs("div",{className:"space-y-1",children:[e.jsxs("div",{className:"flex flex-wrap gap-2",children:[e.jsx(k,{type:"button",variant:"secondary",onClick:()=>{var p;return(p=n.current)==null?void 0:p.click()},disabled:h||j.isPending,children:a.logo_url?"Replace logo":"Upload logo"}),a.logo_url&&e.jsx(k,{type:"button",variant:"ghost",onClick:()=>g(!0),disabled:h||j.isPending,children:"Remove"})]}),e.jsx("p",{className:"text-xs text-gray-500",children:"PNG, JPEG or WebP. Resized to at most 512 px."}),e.jsx("input",{ref:n,type:"file",accept:"image/png,image/jpeg,image/webp",className:"hidden",onChange:C})]})]}),i&&e.jsx(Fe,{fileName:i.fileName,fileSize:i.fileSize,percent:i.percent,phase:i.phase,elapsedSeconds:l}),r&&e.jsx(ae,{title:"Remove logo?",message:"The logo image will be deleted from this entity's profile.",icon:"ti-trash",tone:"danger",confirmLabel:"Remove",pendingLabel:"Removing...",isPending:j.isPending,onCancel:()=>g(!1),onConfirm:()=>j.mutate(a.id)})]})}function he(a){return{display_name:(a==null?void 0:a.display_name)||"",sector:(a==null?void 0:a.sector)||"",employee_count:(a==null?void 0:a.employee_count)??"",location:(a==null?void 0:a.location)||"",description:(a==null?void 0:a.description)||"",contact_name:(a==null?void 0:a.contact_name)||"",contact_email:(a==null?void 0:a.contact_email)||"",contact_phone:(a==null?void 0:a.contact_phone)||""}}function ra({profile:a,canEdit:t}){const[n,i]=m.useState(()=>he(a)),s=Ie();m.useEffect(()=>{i(he(a))},[a]);function l(r,g){i(u=>({...u,[r]:g}))}function d(r){r.preventDefault(),s.mutate({id:a.id,data:n})}return e.jsxs("form",{onSubmit:d,className:"space-y-4",children:[e.jsxs("div",{children:[e.jsx(f,{children:"Logo"}),e.jsx(la,{profile:a,canEdit:t})]}),e.jsxs("div",{className:"grid grid-cols-1 gap-3 sm:grid-cols-2",children:[e.jsxs("div",{children:[e.jsx(f,{children:"Entity name"}),e.jsx(v,{value:a.entity_name,disabled:!0})]}),e.jsxs("div",{children:[e.jsx(f,{children:"Display name"}),e.jsx(v,{value:n.display_name,onChange:r=>l("display_name",r.target.value),placeholder:a.entity_name,disabled:!t}),e.jsx("p",{className:"mt-1 text-xs text-gray-500",children:"Shown in reports. Falls back to the entity name."})]})]}),e.jsxs("div",{className:"grid grid-cols-1 gap-3 sm:grid-cols-3",children:[e.jsxs("div",{children:[e.jsx(f,{children:"Sector"}),e.jsxs(He,{value:n.sector,onChange:r=>l("sector",r.target.value),disabled:!t,children:[e.jsx("option",{value:"",children:"Not set"}),Be.map(r=>e.jsx("option",{value:r.value,children:r.label},r.value))]})]}),e.jsxs("div",{children:[e.jsx(f,{children:"Employees"}),e.jsx(v,{type:"number",min:"0",step:"1",value:n.employee_count,onChange:r=>l("employee_count",r.target.value),disabled:!t})]}),e.jsxs("div",{children:[e.jsx(f,{children:"Location"}),e.jsx(v,{value:n.location,onChange:r=>l("location",r.target.value),placeholder:"Jakarta",disabled:!t})]})]}),e.jsxs("div",{children:[e.jsx(f,{children:"Description"}),e.jsx(v,{value:n.description,onChange:r=>l("description",r.target.value),disabled:!t})]}),e.jsxs("div",{className:"grid grid-cols-1 gap-3 sm:grid-cols-2",children:[e.jsxs("div",{children:[e.jsx(f,{children:"Contact name"}),e.jsx(v,{value:n.contact_name,onChange:r=>l("contact_name",r.target.value),disabled:!t})]}),e.jsxs("div",{children:[e.jsx(f,{children:"Contact phone"}),e.jsx(v,{type:"tel",value:n.contact_phone,onChange:r=>l("contact_phone",r.target.value),disabled:!t})]})]}),e.jsxs("div",{children:[e.jsx(f,{children:"Contact email"}),e.jsx(v,{type:"email",value:n.contact_email,onChange:r=>l("contact_email",r.target.value),disabled:!t})]}),t&&e.jsx("div",{className:"flex justify-end",children:e.jsx(k,{type:"submit",variant:"primary",disabled:s.isPending,children:s.isPending?"Saving...":"Save entity profile"})})]})}const oa={authorized:"success",pending:"warning",rejected:"danger",expired:"gray"};function da({entityName:a,canManage:t=!1}){const[n,i]=m.useState(""),[s,l]=m.useState(null),{data:d=[],isLoading:r}=we(),g=Ge({onSuccess:()=>i("")}),u=We({onSuccess:()=>l(null)}),b=Ye(),j=m.useMemo(()=>d.filter(p=>String(p.owner_entity||"").toLowerCase()===String(a).toLowerCase()),[d,a]);function h(){const p=n.trim().toLowerCase();if(!p||!p.includes(".")){M.error("Enter a valid domain name.");return}g.mutate({domain:p,base_landing_url:`https://${p}`,tracking_url:`https://${p}/track`,environment:"production",owner_entity:a,status:"draft",authorization_status:"pending"})}function C(){s&&u.mutate(s.id)}return e.jsxs("div",{className:"space-y-3",children:[e.jsx("p",{className:"text-xs text-gray-500",children:"Domains used to host this entity's simulation landing pages. New domains start as pending until an admin authorizes them."}),t&&e.jsxs("div",{className:"flex gap-2",children:[e.jsx(v,{value:n,onChange:p=>i(p.target.value),placeholder:"simulation.example.com",onKeyDown:p=>{p.key==="Enter"&&h()}}),e.jsx(k,{variant:"primary",onClick:h,disabled:g.isPending,children:"Add"})]}),r?e.jsx("p",{className:"text-sm text-gray-400",children:"Loading..."}):j.length===0?e.jsx("p",{className:"text-sm text-gray-400",children:"No landing page domains registered for this entity."}):e.jsx("ul",{className:"space-y-2",children:j.map(p=>e.jsxs("li",{className:"flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-100 px-3 py-2",children:[e.jsxs("div",{className:"flex flex-wrap items-center gap-2",children:[e.jsx("span",{className:"text-sm font-medium text-gray-700",children:p.domain}),e.jsx(D,{tone:oa[p.authorization_status]||"gray",children:p.authorization_status||"pending"}),e.jsx(D,{tone:p.status==="active"?"success":"gray",children:p.status||"draft"}),e.jsxs("span",{className:"text-[11px] text-gray-400",children:["DNS: ",p.dns_status||"unknown"," · TLS: ",p.tls_status||"unknown"]})]}),t&&e.jsxs("div",{className:"flex items-center gap-3",children:[e.jsx("button",{type:"button",className:"text-xs font-semibold text-violet-600 hover:underline",onClick:()=>b.mutate(p.id),disabled:b.isPending,children:"Check DNS/TLS"}),e.jsx("button",{type:"button",className:"text-xs font-semibold text-danger hover:underline",onClick:()=>l(p),disabled:u.isPending,children:"Delete"})]})]},p.id))}),s&&e.jsx(ae,{title:"Delete domain?",message:`"${s.domain}" will be deleted from this entity's landing page domains.`,icon:"ti-trash",tone:"danger",confirmLabel:"Delete",pendingLabel:"Deleting...",isPending:u.isPending,onCancel:()=>l(null),onConfirm:C})]})}const ca={contact_name:"",contact_phone:"",contact_email:""};function ma({entityName:a,canEdit:t}){const{data:n,isLoading:i}=je(a),[s,l]=m.useState(ca),d=ze();m.useEffect(()=>{l({contact_name:(n==null?void 0:n.contact_name)||"",contact_phone:(n==null?void 0:n.contact_phone)||"",contact_email:(n==null?void 0:n.contact_email)||""})},[n]);function r(u,b){l(j=>({...j,[u]:b}))}function g(u){u.preventDefault(),d.mutate({entityName:a,data:s})}return i?e.jsx("p",{className:"text-sm text-gray-400",children:"Loading..."}):e.jsxs("form",{onSubmit:g,className:"space-y-4",children:[e.jsxs("div",{children:[e.jsx(f,{children:"Contact / team name"}),e.jsx(v,{value:s.contact_name,onChange:u=>r("contact_name",u.target.value),placeholder:"e.g. Security Operations Center",disabled:!t})]}),e.jsxs("div",{className:"grid grid-cols-1 gap-3 sm:grid-cols-2",children:[e.jsxs("div",{children:[e.jsx(f,{children:"Phone"}),e.jsx(v,{type:"tel",value:s.contact_phone,onChange:u=>r("contact_phone",u.target.value),placeholder:"e.g. 021-555-0100",disabled:!t})]}),e.jsxs("div",{children:[e.jsx(f,{children:"Email"}),e.jsx(v,{type:"email",value:s.contact_email,onChange:u=>r("contact_email",u.target.value),placeholder:"e.g. soc@company.co.id",disabled:!t})]})]}),t&&e.jsx("div",{className:"flex justify-end",children:e.jsx(k,{type:"submit",variant:"primary",disabled:d.isPending,children:d.isPending?"Saving...":"Save report contact"})})]})}function X(a){return String(a??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}function ua({src:a,caption:t,alt:n,flagExampleId:i}={}){const s=String(t||"").trim(),l=X(s||n||"Example");return[`<figure${i!=null?` data-pukat-img="${X(i)}"`:""}>`,`  <img src="${X(a)}" alt="${l}">`,s?`  <figcaption>${X(s)}</figcaption>`:null,"</figure>"].filter(Boolean).join(`
`)}function pa(a,t,n){const i=String(a||""),s=String(t||"");if(!s)return i;if(typeof n=="number"&&n>=0&&n<=i.length){const d=i.slice(0,n),r=i.slice(n),g=d&&!d.endsWith(`
`)?`
`:"",u=r&&!r.startsWith(`
`)?`
`:"";return d+g+s+u+r}const l=i.toLowerCase().lastIndexOf("</body>");return l===-1?i?`${i.replace(/\s+$/,"")}
${s}
`:`${s}
`:`${i.slice(0,l).replace(/\s+$/,"")}
${s}
${i.slice(l)}`}function ga(){return ha}const ee=`<div class="image-box">
                        <!-- Taruh kursor di baris di bawah ini, pilih gambar di strip "example images", lalu klik "Insert at cursor". -->
                        <span class="only-id" style="color:#94a3b8;font-size:13px;">Sisipkan gambar contoh di sini.</span>
                        <span class="only-en" style="color:#94a3b8;font-size:13px;">Insert an example image here.</span>
                    </div>`,ha=`<!DOCTYPE html>
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
`;function xa(a){return!a||!a.id?{key:"none",label:"No page",tone:"gray"}:a.status!=="published"?{key:"draft",label:"Draft",tone:"gray"}:a.has_unpublished_changes?{key:"changes",label:"Unpublished changes",tone:"warning"}:{key:"published",label:"Published",tone:"success"}}const xe=[{key:"code",label:"HTML Code",icon:"ti-code"},{key:"preview",label:"Live Preview",icon:"ti-eye"}];function ya({examples:a=[],adminEntity:t=null,canEdit:n=!1,canPublish:i=!1,onDirtyChange:s}){const l=m.useMemo(()=>t?{entity:t}:{},[t]),{data:d,isLoading:r,isError:g,error:u}=Je(l);return r?e.jsx("p",{className:"text-sm text-gray-400",children:"Loading..."}):g||!d?e.jsx("p",{className:"text-sm text-danger",children:(u==null?void 0:u.message)||"Could not load the education page."}):e.jsx(ba,{page:d,examples:a,requestExtras:l,canEdit:n,canPublish:i,onDirtyChange:s},t||"self")}function ba({page:a,examples:t,requestExtras:n,canEdit:i,canPublish:s,onDirtyChange:l}){const[d,r]=m.useState(a.title||""),[g,u]=m.useState(a.html_body||""),[b,j]=m.useState(a.launch_url||""),[h,C]=m.useState("code"),[p,N]=m.useState(!1),[_,T]=m.useState([]),[z,F]=m.useState(null),[P,H]=m.useState(!1),[L,K]=m.useState(()=>typeof window<"u"?window.innerHeight:800);m.useEffect(()=>{if(!P)return;const o=()=>K(window.innerHeight),x=V=>{V.key==="Escape"&&H(!1)};o(),window.addEventListener("resize",o),window.addEventListener("keydown",x);const y=document.body.style.overflow;return document.body.style.overflow="hidden",()=>{window.removeEventListener("resize",o),window.removeEventListener("keydown",x),document.body.style.overflow=y}},[P]);const I=Ke(),G=Ve(),$=Xe(),U=Qe(),w=I.isPending||G.isPending||$.isPending||U.isPending,q=a.editable===!1,Z=a.active_simulations||[],E=i&&!q,c=s&&!q,{data:B=[]}=we(),W=m.useMemo(()=>B.filter(o=>o.base_landing_url).map(o=>({url:o.base_landing_url,label:`${o.domain} (${o.base_landing_url})`})),[B]),R=d!==(a.title||"")||g!==(a.html_body||"")||b!==(a.launch_url||""),ne=xa(a),J=a.status==="published",te=J&&!R&&!a.has_unpublished_changes,ie=m.useMemo(()=>{const o=new Map;return t.forEach(x=>{const y=x.flag_id;o.has(y)||o.set(y,{flagId:y,label:x.flag_label||"Flag",items:[]}),o.get(y).items.push(x)}),[...o.values()]},[t]);m.useEffect(()=>{l==null||l(R)},[R,l]),m.useEffect(()=>()=>l==null?void 0:l(!1),[l]);const le=()=>({...n,title:d.trim(),html_body:g,launch_url:b});function re(){return d.trim()?!0:(M.error("Nama template is required."),!1)}function oe(){re()&&I.mutate({data:le()})}function ke(){r(a.title||""),u(a.html_body||""),j(a.launch_url||"")}async function Ne(){if(re()){if(!g.trim()){M.error("Add some content before publishing.");return}try{(R||!a.id)&&await I.mutateAsync({data:le()});const o=await G.mutateAsync({data:n});o!=null&&o.sync&&o.sync.ok===!1?M.error(`Published, but GoPhish sync failed: ${o.sync.message}`):o!=null&&o.master&&o.master.ok===!1&&o.master.message&&M.error(`Published & synced, but education campaign failed: ${o.master.message}`)}catch{}}}function de(){u(ga()),d.trim()||r("Flag Email Security Education"),N(!1)}function _e(o){T(x=>x.includes(o)?x.filter(y=>y!==o):[...x,o])}function ce(){if(_.length===0)return;const o=new Map(t.map(y=>[y.id,y])),x=_.map(y=>o.get(y)).filter(Boolean).map(y=>ua({src:y.image_url,caption:y.caption,alt:y.flag_label,flagExampleId:y.id}));x.length!==0&&(u(y=>pa(y,x.join(`
`),z)),T([]),M.success(x.length===1?"Image inserted.":`${x.length} images inserted.`))}const me=E?e.jsxs(k,{variant:"outline",size:"sm",onClick:()=>g.trim()?N(!0):de(),disabled:w,children:[e.jsx("i",{className:"ti ti-template text-sm"}),e.jsx("span",{children:"Use starter template"})]}):null;function ue(o){return h==="code"?e.jsx(Ze,{fileName:"template.html",lineCount:g.split(`
`).length,lineCountLabel:"baris",children:E?e.jsx(sa,{value:g,onChange:u,onCaretChange:F,height:o}):e.jsx("pre",{className:"overflow-auto p-4 font-mono text-xs text-gray-700",style:{maxHeight:o},children:g||"No content yet."})}):e.jsx("div",{className:"flex min-h-[450px] flex-col items-center justify-center overflow-x-auto rounded-xl border border-gray-200 bg-gray-100 p-6",children:g.trim()?e.jsx(ea,{html:g,redirectUrl:"education page",title:"Education page preview"}):e.jsxs("div",{className:"space-y-2 py-12 text-center text-gray-400",children:[e.jsx("i",{className:"ti ti-eye-off text-3xl"}),e.jsx("p",{className:"text-xs font-medium",children:"Nothing to preview yet — add content in the HTML Code tab."})]})})}return e.jsxs("div",{className:"space-y-6 animate-fade-in",children:[q&&e.jsxs("div",{className:"flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800",children:[e.jsx("i",{className:"ti ti-lock mt-0.5 text-base"}),e.jsxs("div",{children:[e.jsx("span",{className:"font-semibold",children:"Terkunci — simulasi terkait masih aktif."}),e.jsxs("span",{className:"ml-1",children:["Halaman ini tidak bisa diubah sampai simulasi berikut selesai/dihentikan: ",Z.map(o=>`${o.name} (${o.status})`).join(", ")||"—","."]})]})]}),e.jsxs("div",{className:"flex flex-wrap items-center justify-between gap-3",children:[e.jsxs("div",{children:[e.jsx("h2",{className:"text-lg font-bold text-gray-900",children:a.id?`Edit: ${a.title||"Education Page"}`:"Create Education Page"}),e.jsx("p",{className:"mt-0.5 text-xs text-gray-500",children:"The HTML page your colleagues see after a simulation. Only the published version is shown to them."})]}),E&&e.jsxs("div",{className:"flex items-center gap-3",children:[e.jsx(k,{variant:"outline",onClick:ke,disabled:w||!R,title:R?"Discard unsaved changes":void 0,children:"Cancel"}),e.jsx(k,{variant:c?"outline":"primary",onClick:oe,disabled:w||!R,children:I.isPending?"Saving...":"Save Draft"}),c&&e.jsx(k,{variant:"primary",onClick:Ne,disabled:w||te,title:te?"The published version is up to date":void 0,children:G.isPending?"Publishing...":"Publish"})]})]}),e.jsxs("div",{className:"space-y-4 rounded-xl border border-gray-200 bg-white p-5",children:[e.jsxs("div",{className:"grid grid-cols-1 gap-4 sm:grid-cols-2",children:[e.jsxs("label",{className:"block space-y-1 text-xs",children:[e.jsx("span",{className:"font-semibold text-gray-700",children:"Template Name *"}),e.jsx("input",{value:d,onChange:o=>r(o.target.value),placeholder:"Contoh: Flag Education",maxLength:255,disabled:!E||w,className:A("w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-950 outline-none focus:border-violet-500",E?"bg-white":"bg-gray-50 text-gray-500")})]}),e.jsxs("label",{className:"block space-y-1 text-xs",children:[e.jsx("span",{className:"font-semibold text-gray-700",children:"Launch URL (campaign education)"}),e.jsxs("select",{value:b,onChange:o=>j(o.target.value),disabled:!E||w,className:A("w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-950 outline-none focus:border-violet-500",E?"bg-white":"bg-gray-50 text-gray-500"),children:[e.jsx("option",{value:"",children:"— Pilih URL —"}),b&&!W.some(o=>o.url===b)&&e.jsx("option",{value:b,children:b}),W.map(o=>e.jsx("option",{value:o.url,children:o.label},o.url))]}),e.jsx("span",{className:"block text-[10px] text-gray-400",children:"Domain yang dipakai saat master campaign education diluncurkan ke GoPhish."})]})]}),E&&e.jsxs("div",{className:"space-y-2 text-xs",children:[e.jsxs("div",{className:"flex flex-wrap items-center justify-between gap-2",children:[e.jsxs("div",{children:[e.jsx("span",{className:"font-semibold text-gray-700",children:"Flags Images"}),e.jsx("p",{className:"text-[10px] text-gray-400",children:"Select the image (click order = insert order), place the cursor in the editor, then Insert."})]}),e.jsx(k,{variant:"primary",size:"sm",onClick:ce,disabled:w||_.length===0,children:`Insert at cursor${_.length?` (${_.length})`:""}`})]}),ie.length===0?e.jsx("p",{className:"text-gray-400",children:"No example images yet — upload some in the Images tab."}):e.jsx("div",{className:"flex gap-3 overflow-x-auto pb-1",children:ie.map(o=>e.jsxs("div",{className:"w-28 flex-shrink-0 space-y-1.5",children:[e.jsx("span",{className:"block truncate text-[11px] font-semibold text-gray-500",title:o.label,children:o.label}),e.jsx("div",{className:"max-h-44 space-y-2 overflow-y-auto pr-1",children:o.items.map(x=>{const y=_.indexOf(x.id),V=y!==-1;return e.jsxs("button",{type:"button",onClick:()=>_e(x.id),disabled:w,title:x.caption||"Select this image",className:A("group relative block h-16 w-full overflow-hidden rounded-lg border bg-gray-50 disabled:opacity-60",V?"border-violet-500 ring-2 ring-violet-300":"border-gray-200 hover:border-violet-400"),children:[e.jsx("img",{src:x.thumbnail_url,alt:x.caption||x.flag_label,className:"h-full w-full object-cover",loading:"lazy"}),V&&e.jsx("span",{className:"absolute left-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-violet-600 text-[11px] font-bold text-white",children:y+1})]},x.id)})})]},o.flagId))})]}),e.jsxs("div",{className:"flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3 text-xs",children:[e.jsx("span",{className:"font-semibold text-gray-500",children:"Status"}),e.jsx(D,{tone:ne.tone,children:ne.label}),R&&e.jsx("span",{className:"text-gray-500",children:"Unsaved changes"}),J&&(a.synced_at?e.jsx(D,{tone:"info",children:"GoPhish: synced"}):e.jsx(D,{tone:"warning",children:"GoPhish: not synced"})),J&&a.gophish_master_id&&e.jsx(D,{tone:"success",children:"Education campaign: ready"}),c&&J&&e.jsx("button",{type:"button",className:"font-semibold text-violet-600 hover:underline disabled:opacity-60",onClick:()=>U.mutate({data:n}),disabled:w,title:"Push the published page to GoPhish again",children:U.isPending?"Syncing...":"Sync to GoPhish"}),c&&J&&e.jsx("button",{type:"button",className:"font-semibold text-danger hover:underline disabled:opacity-60",onClick:()=>$.mutate({data:n}),disabled:w,children:$.isPending?"Unpublishing...":"Unpublish"})]})]}),!P&&e.jsxs("div",{className:"space-y-3",children:[e.jsxs("div",{className:"flex flex-wrap items-center justify-between gap-2",children:[e.jsx(O,{items:xe,active:h,onChange:C,variant:"pill"}),e.jsxs("div",{className:"flex items-center gap-2",children:[me,e.jsxs(k,{variant:"outline",size:"sm",onClick:()=>H(!0),children:[e.jsx("i",{className:"ti ti-maximize text-sm"}),e.jsx("span",{children:"Fullscreen"})]})]})]}),ue(420)]}),P&&e.jsx(aa,{children:e.jsxs("div",{className:"fixed inset-0 z-50 flex flex-col bg-white",children:[e.jsxs("div",{className:"flex items-center justify-between gap-3 border-b border-gray-200 px-4 py-2",children:[e.jsxs("div",{className:"flex min-w-0 items-center gap-3",children:[e.jsx("span",{className:"truncate text-sm font-semibold text-gray-900",children:d||"Education Page"}),e.jsx(O,{items:xe,active:h,onChange:C,variant:"pill"})]}),e.jsxs("div",{className:"flex items-center gap-2",children:[me,E&&_.length>0&&e.jsx(k,{variant:"primary",size:"sm",onClick:ce,disabled:w,children:`Insert at cursor (${_.length})`}),E&&e.jsx(k,{variant:"outline",size:"sm",onClick:oe,disabled:w||!R,children:I.isPending?"Saving...":"Save Draft"}),e.jsxs(k,{variant:"outline",size:"sm",onClick:()=>H(!1),children:[e.jsx("i",{className:"ti ti-minimize text-sm"}),e.jsx("span",{children:"Exit"})]})]})]}),e.jsx("div",{className:"flex-1 overflow-auto p-4",children:ue(Math.max(320,L-150))})]})}),p&&e.jsx(ae,{title:"Replace the current content?",message:"The starter template will replace what is in the editor. Nothing is saved until you save the draft.",icon:"ti-template",tone:"danger",confirmLabel:"Replace",onCancel:()=>N(!1),onConfirm:de})]})}const fa=[{key:"page",label:"Education Page",icon:"ti-edit"},{key:"images",label:"Images",icon:"ti-photo"}];function va({adminEntity:a=null,canManageExamples:t=!1,canEditPage:n=!1,canPublishPage:i=!1}){const s=m.useMemo(()=>a?{entity:a}:{},[a]),{data:l}=Oe(s),d=m.useMemo(()=>(l==null?void 0:l.examples)||[],[l]),[r,g]=m.useState("page"),[u,b]=m.useState(!1);m.useEffect(()=>{if(!u)return;const h=C=>{C.preventDefault(),C.returnValue=""};return window.addEventListener("beforeunload",h),()=>window.removeEventListener("beforeunload",h)},[u]);const j=m.useCallback(h=>b(!!h),[]);return e.jsxs("div",{className:"space-y-4",children:[e.jsx(O,{items:fa,active:r,onChange:g,ariaLabel:"Flag sections"}),e.jsx("div",{className:A(r==="images"&&"hidden"),children:e.jsx(ya,{examples:d,adminEntity:a,canEdit:n,canPublish:i,onDirtyChange:j})}),r==="images"&&e.jsx($e,{canManage:t,adminEntity:a})]})}const ja={email_domains:{label:"Company email domain",hint:"At least one active domain",tab:"guardrails"},landing_domains:{label:"Landing page domain",hint:"At least one authorized by an admin",tab:"guardrails"},report_contact:{label:"Call center report contact",hint:"Who employees contact to report",tab:"report"},flag_examples:{label:"Flag examples",hint:"At least one example image",tab:"flags"},identity:{label:"Entity identity",hint:"Profile with a sector",tab:"entity"}},wa={required:"Required",recommended:"Recommended",optional:"Optional"};function ka({entityName:a,onOpenTab:t,compact:n=!1}){const{data:i,isLoading:s}=Me(a);if(s||!i)return null;const l=i.items||[],d=l.filter(r=>r.done).length;return e.jsxs(S,{className:"space-y-3",children:[e.jsxs("div",{className:"flex flex-wrap items-center justify-between gap-2",children:[e.jsxs("div",{children:[e.jsx("h2",{className:"text-sm font-semibold text-gray-900",children:"Entity readiness"}),e.jsxs("p",{className:"text-xs text-gray-500",children:[d,"/",l.length," complete"]})]}),e.jsx(D,{tone:i.can_launch?"success":"danger",children:i.can_launch?"Ready to launch campaigns":"Campaigns cannot be launched"})]}),e.jsx("ul",{className:A("grid grid-cols-1 gap-2",!n&&"sm:grid-cols-2"),children:l.map(r=>{const g=ja[r.key]||{label:r.key,hint:""},u=r.level==="required"&&!r.done;return e.jsx("li",{children:e.jsxs("button",{type:"button",onClick:()=>g.tab&&(t==null?void 0:t(g.tab)),className:A("flex w-full items-start gap-2 rounded-lg border px-3 py-2 text-left transition hover:bg-gray-50",u?"border-red-200 bg-red-50":"border-gray-100"),children:[e.jsx("i",{className:A("ti mt-0.5 text-base",r.done?"ti-circle-check text-emerald-500":u?"ti-alert-circle text-danger":"ti-circle-dashed text-gray-300")}),e.jsxs("span",{className:"min-w-0 flex-1",children:[e.jsxs("span",{className:"flex flex-wrap items-center gap-1.5",children:[e.jsx("span",{className:"text-sm font-medium text-gray-700",children:g.label}),e.jsx("span",{className:A("text-[10px] font-semibold uppercase",r.level==="required"?"text-danger":"text-gray-400"),children:wa[r.level]||r.level})]}),e.jsx("span",{className:"block text-xs text-gray-500",children:g.hint})]})]})},r.key)})})]})}function Q({icon:a,children:t}){return e.jsxs("li",{className:"flex items-start gap-2 text-xs text-gray-600",children:[e.jsx("i",{className:`ti ${a} mt-0.5 text-sm text-gray-400`}),e.jsx("span",{className:"min-w-0 break-words",children:t})]})}function Na({entityName:a,profile:t,onOpenTab:n}){const{data:i}=je(a),s=[i==null?void 0:i.contact_name,i==null?void 0:i.contact_phone,i==null?void 0:i.contact_email].filter(Boolean),l=t?[t.sector&&{icon:"ti-briefcase",text:Ue(t.sector)},t.employee_count!=null&&{icon:"ti-users",text:`${t.employee_count.toLocaleString()} employees`},t.location&&{icon:"ti-map-pin",text:t.location}].filter(Boolean):[];return e.jsxs(S,{className:"space-y-4",children:[e.jsxs("div",{className:"flex items-center gap-3",children:[e.jsx("div",{className:"flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-gray-100 bg-gray-50",children:t!=null&&t.logo_url?e.jsx("img",{src:t.logo_url,alt:"",className:"h-full w-full object-contain"}):e.jsx("i",{className:"ti ti-building text-xl text-gray-300"})}),e.jsxs("div",{className:"min-w-0",children:[e.jsx("div",{className:"text-[10px] font-semibold uppercase tracking-wider text-gray-400",children:"Entity"}),e.jsx("div",{className:"truncate text-sm font-semibold text-gray-900",children:(t==null?void 0:t.display_name)||a}),(t==null?void 0:t.display_name)&&t.display_name!==a&&e.jsx("div",{className:"truncate text-[11px] text-gray-400",children:a})]})]}),t?l.length>0?e.jsx("ul",{className:"space-y-1.5",children:l.map(d=>e.jsx(Q,{icon:d.icon,children:d.text},d.icon))}):e.jsx("button",{type:"button",onClick:()=>n==null?void 0:n("entity"),className:"text-xs font-semibold text-violet-600 hover:underline",children:"Add sector, size and location"}):e.jsx("p",{className:"text-xs text-gray-400",children:"No entity profile yet — an admin creates it."}),e.jsxs("div",{className:"border-t border-gray-100 pt-3",children:[e.jsx("div",{className:"mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400",children:"Report contact"}),s.length>0?e.jsxs("ul",{className:"space-y-1.5",children:[i.contact_name&&e.jsx(Q,{icon:"ti-user",children:i.contact_name}),i.contact_phone&&e.jsx(Q,{icon:"ti-phone",children:i.contact_phone}),i.contact_email&&e.jsx(Q,{icon:"ti-mail",children:i.contact_email})]}):e.jsx("button",{type:"button",onClick:()=>n==null?void 0:n("report"),className:"text-xs font-semibold text-violet-600 hover:underline",children:"Set a report contact"})]})]})}var ye,be;const _a=((ye=window.PukatData)==null?void 0:ye.logoutUrl)||`${((be=window.PukatData)==null?void 0:be.adminUrl)||"/wp-admin/"}wp-login.php?action=logout`,Pa=[{key:"account",label:"My Account",icon:"ti-user"},{key:"entity",label:"Entity Profile",icon:"ti-building"},{key:"guardrails",label:"Guardrails",icon:"ti-shield-lock"},{key:"flags",label:"Flags",icon:"ti-flag"},{key:"report",label:"Call Center Report",icon:"ti-headset"}];function Va(){const{data:a,isLoading:t}=na(),[n,i]=m.useState("account"),s=String((a==null?void 0:a.entity)||"").trim(),l=s.toLowerCase()==="general",d=Y(c=>c.isAdmin()),r=Y(c=>c.hasPermission("master_entities.edit")),g=Y(c=>c.hasPermission("domains.create")),u=Y(c=>c.hasPermission("flag_examples.upload")),b=Y(c=>c.hasPermission("flag_pages.edit")),j=Y(c=>c.hasPermission("flag_pages.publish")),h=!!s&&(d||!l&&r),C=!!s&&(d||!l&&g),p=!!s&&(d||!l&&u),N=!!s&&(d||!l&&b),_=!!s&&(d||!l&&j),{data:T=[],isLoading:z}=Re({enabled:!!s}),F=m.useMemo(()=>T.find(c=>String(c.entity_name).toLowerCase()===s.toLowerCase())||null,[T,s]),[P,H]=m.useState({display_name:"",email:"",phone:""}),[L,K]=m.useState({current_password:"",new_password:"",confirm_password:""}),[I,G]=m.useState("");m.useEffect(()=>{a&&H({display_name:a.display_name||"",email:a.email||"",phone:a.phone||""})},[a]);const $=ta(),U=ia({onSuccess:()=>{K({current_password:"",new_password:"",confirm_password:""}),setTimeout(()=>{window.location.href=_a},1200)}}),w=(c,B)=>H(W=>({...W,[c]:B})),q=(c,B)=>K(W=>({...W,[c]:B})),Z=c=>{c.preventDefault(),$.mutate(P)},E=c=>{if(c.preventDefault(),G(""),L.new_password!==L.confirm_password){G("New password and confirmation do not match.");return}U.mutate({current_password:L.current_password,new_password:L.new_password})};return t?e.jsx(ge,{spacing:"space-y-4",animated:!1,className:"max-w-2xl",children:[...Array(2)].map((c,B)=>e.jsx(S,{className:"h-40 animate-pulse bg-gray-100"},B))}):e.jsxs(ge,{spacing:"space-y-6",className:s?"":"max-w-3xl",children:[e.jsx(Ae,{title:"My Profile",subtitle:"Manage your account and your entity's information"}),e.jsx(S,{children:e.jsxs("div",{className:"flex items-center gap-4",children:[e.jsx("img",{src:a==null?void 0:a.avatar_url,alt:"Avatar",className:"h-14 w-14 rounded-full bg-gray-100"}),e.jsxs("div",{children:[e.jsx("p",{className:"text-sm font-semibold text-gray-900",children:a==null?void 0:a.display_name}),e.jsxs("div",{className:"mt-1 flex items-center gap-2",children:[e.jsx(D,{tone:"violet",children:a==null?void 0:a.role}),(a==null?void 0:a.entity)&&e.jsx(D,{tone:"gray",children:a.entity})]})]})]})}),e.jsxs("div",{className:A("grid grid-cols-1 gap-6",s&&"lg:grid-cols-3 lg:items-start"),children:[e.jsxs("div",{className:"min-w-0 space-y-6 lg:col-span-2",children:[e.jsx(O,{items:Pa,active:n,onChange:i,ariaLabel:"My Profile sections"}),n==="account"&&e.jsxs(e.Fragment,{children:[e.jsx(S,{children:e.jsxs("form",{onSubmit:Z,children:[e.jsx("h2",{className:"text-sm font-semibold text-gray-900 mb-1",children:"Profile Information"}),e.jsx("p",{className:"text-xs text-gray-500 mb-4",children:"Update your display name, email, and phone number."}),e.jsxs("div",{className:"space-y-4",children:[e.jsxs("div",{children:[e.jsx(f,{children:"Display Name"}),e.jsx(v,{value:P.display_name,onChange:c=>w("display_name",c.target.value),placeholder:"Your name"})]}),e.jsxs("div",{children:[e.jsx(f,{children:"Email"}),e.jsx(v,{type:"email",value:P.email,onChange:c=>w("email",c.target.value),placeholder:"you@example.com"})]}),e.jsxs("div",{children:[e.jsx(f,{children:"Phone Number"}),e.jsx(v,{type:"tel",value:P.phone,onChange:c=>w("phone",c.target.value),placeholder:"e.g. 08123456789"})]})]}),e.jsx("div",{className:"flex justify-end mt-4",children:e.jsx(k,{type:"submit",variant:"primary",disabled:$.isPending,children:$.isPending?"Saving...":"Save Changes"})})]})}),e.jsx(S,{children:e.jsxs("form",{onSubmit:E,children:[e.jsx("h2",{className:"text-sm font-semibold text-gray-900 mb-1",children:"Change Password"}),e.jsx("p",{className:"text-xs text-gray-500 mb-4",children:"You will be logged out and need to sign in again after changing your password."}),I&&e.jsx("p",{className:"mb-3 text-xs text-danger",children:I}),e.jsxs("div",{className:"space-y-4",children:[e.jsxs("div",{children:[e.jsx(f,{children:"Current Password"}),e.jsx(v,{type:"password",autoComplete:"current-password",value:L.current_password,onChange:c=>q("current_password",c.target.value)})]}),e.jsxs("div",{children:[e.jsx(f,{children:"New Password"}),e.jsx(v,{type:"password",autoComplete:"new-password",value:L.new_password,onChange:c=>q("new_password",c.target.value)})]}),e.jsxs("div",{children:[e.jsx(f,{children:"Confirm New Password"}),e.jsx(v,{type:"password",autoComplete:"new-password",value:L.confirm_password,onChange:c=>q("confirm_password",c.target.value)})]})]}),e.jsx("div",{className:"flex justify-end mt-4",children:e.jsx(k,{type:"submit",variant:"primary",disabled:U.isPending||!L.current_password||!L.new_password,children:U.isPending?"Changing...":"Change Password"})})]})})]}),n!=="account"&&!s&&e.jsx(S,{children:e.jsx(pe,{icon:"ti-building-off",title:"Your account is not assigned to an entity",description:"Entity Profile, Guardrails, Flags and Call Center Report are managed per entity. Ask an admin to assign your entity."})}),n==="entity"&&s&&e.jsxs(S,{children:[e.jsx("h2",{className:"mb-1 text-sm font-semibold text-gray-900",children:"Entity Profile"}),e.jsx("p",{className:"mb-4 text-xs text-gray-500",children:h?"Description and contact details for your entity.":"Read-only — only an admin can edit this entity."}),z?e.jsx("p",{className:"text-sm text-gray-400",children:"Loading..."}):F?e.jsx(ra,{profile:F,canEdit:h}):e.jsx(pe,{icon:"ti-building",title:`No profile yet for "${s}"`,description:"Entity profiles are created by an admin. Once it exists, you can fill in its details here."})]}),n==="guardrails"&&s&&e.jsxs(e.Fragment,{children:[e.jsxs(S,{children:[e.jsx("h2",{className:"mb-3 text-sm font-semibold text-gray-900",children:"Landing page domains"}),e.jsx(da,{entityName:s,canManage:C})]}),e.jsxs(S,{children:[e.jsx("h2",{className:"mb-3 text-sm font-semibold text-gray-900",children:"Company email domains"}),e.jsx(qe,{entityName:s,canManage:h,canToggle:h})]})]}),n==="report"&&s&&e.jsxs(S,{children:[e.jsx("h2",{className:"mb-1 text-sm font-semibold text-gray-900",children:"Call Center Report"}),e.jsx("p",{className:"mb-4 text-xs text-gray-500",children:h?"Who employees of your entity should contact to report a suspicious email.":"Read-only — only an admin can edit this entity."}),e.jsx(ma,{entityName:s,canEdit:h})]}),n==="flags"&&s&&e.jsxs(S,{children:[e.jsx("h2",{className:"mb-1 text-sm font-semibold text-gray-900",children:"Flags"}),e.jsx("p",{className:"mb-3 text-xs text-gray-500",children:"Build the education page your colleagues see after a simulation, one per Flag category. Write the page in the Editor, check it in Preview, and upload annotated example screenshots in Images."}),!p&&!N&&e.jsx("p",{className:"mb-3 text-xs text-gray-500",children:"Read-only — you can view but not change this entity's education pages and examples."}),e.jsx("div",{className:"mt-3",children:e.jsx(va,{entityName:s,adminEntity:d?s:null,canManageExamples:p,canEditPage:N,canPublishPage:_})})]})]}),s&&e.jsxs("aside",{className:"order-first space-y-6 lg:sticky lg:top-4 lg:order-none",children:[e.jsx(Na,{entityName:s,profile:F,onOpenTab:i}),e.jsx(ka,{entityName:s,onOpenTab:i,compact:!0})]})]})]})}export{Va as default};
