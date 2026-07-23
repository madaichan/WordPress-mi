import{r as s,z as N,j as e,c as w}from"./main-CWwUWTsm.js";import{H as z}from"./HtmlCodeEditor-HiumChVG.js";import{C as K}from"./ClientPreview-CfY_QfaG.js";import{P as Y}from"./PageHeader-B3cm0VTD.js";import{B as R}from"./Button-DcfJqIX5.js";const J=`<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: sans-serif; color: #333; line-height: 1.5; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e1e1e1; }
    .btn { background-color: #6C63FF; color: white !important; padding: 10px 24px; text-decoration: none; font-weight: bold; border-radius: 4px; display: inline-block; }
  </style>
</head>
<body>
  <div class="container">
    <h3>Aktivitas Akun Tidak Biasa</h3>
    <p>Halo {{.FirstName}},</p>
    <p>Kami mendeteksi adanya upaya sign-in tidak dikenal pada akun Anda.</p>
    <div style="text-align: center; margin: 20px 0;">
      <a href="{{.URL}}" class="btn">Verifikasi Akun</a>
    </div>
  </div>
</body>
</html>`,W=[{id:"ms",name:"Microsoft Office 365 Alert",category:"alert",description:"Gaya email security login dengan permintaan pembaruan sandi mendesak.",sender:"Microsoft Security <security@microsoft-update.net>",subject:"Tindakan Diperlukan: Percobaan login tidak sah terdeteksi",thumbnail:{icon:"ti-mail-opened",bg:"bg-red-500/20 text-red-500",bars:[{w:"w-16"},{w:"w-24"}]},html:`<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #333; line-height: 1.5; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e1e1e1; }
    .header { display: flex; align-items: center; gap: 8px; font-weight: bold; color: #555; }
    .logo-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1px; width: 14px; height: 14px; }
    .blue-btn { background-color: #0067b8; color: white !important; padding: 10px 24px; text-decoration: none; font-weight: bold; border-radius: 4px; display: inline-block; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1px; width: 14px; height: 14px; float: left; margin-right: 6px;">
        <div style="background:#f25022; width: 6px; height: 6px;"></div>
        <div style="background:#7fba00; width: 6px; height: 6px;"></div>
        <div style="background:#00a4ef; width: 6px; height: 6px;"></div>
        <div style="background:#ffb900; width: 6px; height: 6px;"></div>
      </div>
      <span style="font-size: 14px; font-weight: 600; color: #5e5e5e;">Microsoft Account Security</span>
    </div>
    <hr style="border: 0; border-top: 1px solid #eee; margin: 15px 0; clear: both;">
    <h3 style="font-size: 16px; font-weight: 600; color: #111;">Security alert</h3>
    <p>Dear {{.FirstName}},</p>
    <p>We detected unusual sign-in activity on your Microsoft 365 Account ({{.Email}}) from an unrecognized device or IP address. If this was not you, please secure your account immediately by verifying your credentials.</p>
    <div style="background: #f9f9f9; border-radius: 6px; padding: 12px; margin: 15px 0; font-size: 12px;">
      <div><strong>Country/Region:</strong> Netherlands</div>
      <div><strong>IP Address:</strong> 185.220.101.4</div>
      <div><strong>Browser:</strong> Chrome / Windows 10</div>
    </div>
    <p>Please click the button below to verify your login credentials and prevent account lockout.</p>
    <div style="text-align: center; margin-top: 20px;">
      <a href="{{.URL}}" class="blue-btn">Verify account</a>
    </div>
  </div>
</body>
</html>`},{id:"google",name:"Google Security Notification",category:"alert",description:"Menginfokan adanya login tidak dikenal dari perangkat baru.",sender:"Google Security <support@google-help.com>",subject:"Waspada Keamanan: Percobaan sign-in diblokir",thumbnail:{icon:"ti-shield",bg:"bg-blue-500/20 text-blue-500",bars:[{w:"w-20"},{w:"w-28"}]},html:`<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Roboto, sans-serif; color: #333; line-height: 1.5; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e1e1e1; border-top: 4px solid #ea4335; }
    .google-text { font-size: 18px; font-weight: bold; margin-bottom: 20px; }
    .btn { background-color: #1a73e8; color: white !important; padding: 10px 24px; text-decoration: none; font-weight: bold; border-radius: 4px; display: inline-block; }
  </style>
</head>
<body>
  <div class="container">
    <div class="google-text">
      <span style="color:#4285f4">G</span><span style="color:#ea4335">o</span><span style="color:#fbbc05">o</span><span style="color:#4285f4">g</span><span style="color:#34a853">l</span><span style="color:#ea4335">e</span>
    </div>
    <h3 style="font-size: 16px; font-weight: bold; color: #111; margin-top: 0;">Security alert: Critical Sign-in Blocked</h3>
    <p>Halo {{.FirstName}},</p>
    <p>Google blocked a critical login attempt to your Google Workspace Account ({{.Email}}). Someone just used your password to try to sign in to your account. Google blocked them, but you should check what happened.</p>
    <div style="text-align: center; margin: 25px 0;">
      <a href="{{.URL}}" class="btn">Check activity</a>
    </div>
  </div>
</body>
</html>`},{id:"hr",name:"Internal HR Payroll Info",category:"info",description:"Email notifikasi gaji kuartal baru dengan tautan dokumen terlampir.",sender:"HR Department <payroll@internal-company.id>",subject:"Info HR: Pembaruan Slip Gaji Kuartal Q3",thumbnail:{icon:"ti-receipt",bg:"bg-emerald-500/20 text-emerald-500",bars:[{w:"w-16"}]},html:`<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: sans-serif; color: #444; line-height: 1.5; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; }
    .hr-logo { width: 32px; height: 32px; border-radius: 50%; background: #f5f3ff; color: #8b5cf6; display: inline-flex; align-items: center; justify-content: center; font-weight: bold; margin-right: 8px; }
    .btn { background-color: #8b5cf6; color: white !important; padding: 10px 24px; text-decoration: none; font-weight: bold; border-radius: 6px; display: inline-block; }
  </style>
</head>
<body>
  <div class="container">
    <div style="display: flex; align-items: center; margin-bottom: 15px;">
      <span class="hr-logo">HR</span>
      <span style="font-weight: bold; color: #111;">Human Resources Department</span>
    </div>
    <hr style="border:0; border-top: 1px solid #eee; margin: 15px 0;">
    <p>Dear Employee {{.FirstName}},</p>
    <p>Please find attached the payroll details and adjustment slip for the upcoming Q3 corporate tax calculation. All employees are required to check their payroll updates by logging into the corporate registry portal below.</p>
    <div style="text-align: center; margin: 25px 0;">
      <a href="{{.URL}}" class="btn">Check payroll statement</a>
    </div>
  </div>
</body>
</html>`},{id:"djp",name:"DJP Online Tax Warning",category:"urgent",description:"Notifikasi e-billing pajak kurang bayar yang harus diselesaikan segera.",sender:"DJP Online <e-filing@pajak.go.id>",subject:"Pemberitahuan: Tunggakan Pajak Tahun Pajak 2024",thumbnail:{icon:"ti-alert-triangle",bg:"bg-yellow-500/20 text-yellow-500",bars:[{w:"w-24"}]},html:`<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: sans-serif; color: #333; line-height: 1.5; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; }
    .logo { width: 36px; height: 36px; border-radius: 50%; background: rgba(234,179,8,0.1); border: 1px solid rgba(234,179,8,0.2); color: #d97706; display: inline-flex; align-items: center; justify-content: center; font-weight: bold; margin-right: 8px; }
    .btn { background-color: #eab308; color: #0b172a !important; padding: 10px 24px; text-decoration: none; font-weight: bold; border-radius: 4px; display: inline-block; }
  </style>
</head>
<body>
  <div class="container">
    <div style="display: flex; align-items: center; margin-bottom: 15px;">
      <span class="logo">DJP</span>
      <span style="font-weight: bold; color: #111;">DIREKTORAT JENDERAL PAJAK</span>
    </div>
    <hr style="border:0; border-top: 1px solid #eee; margin: 15px 0;">
    <p>Yth. {{.FirstName}},</p>
    <p>Surat peringatan elektronik ini diterbitkan sehubungan dengan adanya verifikasi tunggakan pajak tahunan Anda. Anda diwajibkan menyelesaikan pembayaran pajak tertunggak melalui e-billing untuk menghindari denda administratif.</p>
    <div style="text-align: center; margin: 25px 0;">
      <a href="{{.URL}}" class="btn">BAYAR E-BILLING</a>
    </div>
  </div>
</body>
</html>`}];function Q({page:a}){var r,l;return e.jsxs("div",{className:"h-32 bg-[#1F1F1F] rounded-lg border border-gray-800 p-3 relative flex flex-col justify-center gap-2 overflow-hidden select-none",children:[e.jsx("span",{className:"absolute top-2 right-2 rounded-full text-[9px] font-semibold px-2 py-0.5 bg-amber-100 text-amber-700",children:"GoPhish"}),e.jsxs("div",{className:"flex items-center gap-2",children:[e.jsx("div",{className:w("w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold",((r=a.thumbnail)==null?void 0:r.bg)||"bg-violet-500/20 text-violet-500"),children:e.jsx("i",{className:w("ti",((l=a.thumbnail)==null?void 0:l.icon)||"ti-mail")})}),e.jsxs("div",{className:"space-y-1",children:[e.jsx("div",{className:"h-2 bg-gray-500/80 w-16 rounded"}),e.jsx("div",{className:"h-1.5 bg-gray-600/60 w-24 rounded"})]})]}),e.jsxs("div",{className:"space-y-2 mt-2",children:[e.jsx("div",{className:"h-2 bg-gray-700/60 w-full rounded"}),e.jsx("div",{className:"h-2 bg-gray-700/60 w-4/5 rounded"})]})]})}function V({page:a,onEdit:r,onPreview:l}){return e.jsxs("div",{className:"email-page-card bg-white border border-gray-200 rounded-xl p-5 shadow-none flex flex-col justify-between h-80 transition-all hover:border-gray-300",children:[e.jsxs("div",{className:"space-y-4",children:[e.jsx(Q,{page:a}),e.jsxs("div",{children:[e.jsx("h3",{className:"text-sm font-bold text-gray-900",children:a.name}),e.jsx("p",{className:"text-xs text-gray-500 mt-1 line-clamp-2",children:a.description})]})]}),e.jsxs("div",{className:"flex gap-2 mt-4 pt-3 border-t border-gray-50",children:[e.jsxs("button",{onClick:()=>r(a.id),className:"flex-1 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 py-1.5 text-xs font-semibold rounded-lg flex items-center justify-center gap-1 transition-all",children:[e.jsx("i",{className:"ti ti-edit text-sm"}),e.jsx("span",{children:"Edit"})]}),e.jsxs("button",{onClick:()=>l(a.id),className:"flex-1 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 py-1.5 text-xs font-semibold rounded-lg flex items-center justify-center gap-1 transition-all",children:[e.jsx("i",{className:"ti ti-eye text-sm"}),e.jsx("span",{children:"Preview"})]})]})]})}function _({onClick:a}){return e.jsxs("div",{onClick:a,className:"border border-dashed border-gray-200 hover:border-gray-300 rounded-xl p-5 flex flex-col items-center justify-center gap-2 cursor-pointer h-80 transition-all select-none text-gray-400 hover:text-gray-600 bg-white",children:[e.jsx("i",{className:"ti ti-plus text-3xl"}),e.jsx("span",{className:"text-sm font-semibold",children:"Buat template baru"})]})}function $(){return e.jsxs("div",{className:"text-center text-gray-400 space-y-2 py-12",children:[e.jsx("i",{className:"ti ti-mail-opened text-3xl"}),e.jsx("p",{className:"text-xs font-medium",children:'Silakan klik "Preview" pada salah satu template email di daftar atau klik tab "Editor" untuk mengedit template'})]})}function q({editingName:a,name:r,setName:l,sender:d,setSender:m,subject:C,setSubject:g,htmlCode:y,setHtmlCode:P,onBack:S,onSave:f}){const c=a?`Edit template: ${a}`:"Buat email template";return e.jsxs("div",{className:"space-y-6",children:[e.jsxs("div",{className:"flex items-center justify-between",children:[e.jsxs("div",{children:[e.jsx("h2",{className:"text-lg font-bold text-gray-900",children:c}),e.jsx("p",{className:"text-xs text-gray-500 mt-0.5",children:"Konfigurasi envelope header dan kode HTML email phishing"})]}),e.jsxs("div",{className:"flex items-center gap-3",children:[e.jsx("button",{onClick:S,className:"bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 px-4 py-2 text-sm font-semibold rounded-xl transition-all",children:"Batal"}),e.jsx("button",{onClick:()=>f(r,y),className:"bg-violet-500 text-white hover:bg-violet-600 px-4 py-2 text-sm font-semibold rounded-xl transition-all",children:"Simpan template"})]})]}),e.jsxs("div",{className:"grid grid-cols-1 lg:grid-cols-5 gap-6",children:[e.jsxs("div",{className:"lg:col-span-2 bg-white border border-gray-200 rounded-xl p-5 space-y-4 shadow-sm",children:[e.jsx("h3",{className:"text-sm font-semibold text-gray-900 border-b border-gray-100 pb-2",children:"Envelope headers"}),e.jsxs("div",{className:"space-y-3 text-xs",children:[e.jsxs("div",{className:"space-y-1",children:[e.jsx("label",{className:"block font-semibold text-gray-700",children:"Nama template *"}),e.jsx("input",{type:"text",value:r,onChange:n=>l(n.target.value),placeholder:"Contoh: Microsoft O365 Alert",className:"w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-gray-950 focus:outline-none focus:border-violet-500"})]}),e.jsxs("div",{className:"space-y-1",children:[e.jsx("label",{className:"block font-semibold text-gray-700",children:"Pengirim (Envelope From) *"}),e.jsx("input",{type:"text",value:d,onChange:n=>m(n.target.value),placeholder:"Contoh: Admin <admin@company.id>",className:"w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-gray-950 focus:outline-none focus:border-violet-500"})]}),e.jsxs("div",{className:"space-y-1",children:[e.jsx("label",{className:"block font-semibold text-gray-700",children:"Subjek Email *"}),e.jsx("input",{type:"text",value:C,onChange:n=>g(n.target.value),placeholder:"Subjek email phishing",className:"w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-gray-950 focus:outline-none focus:border-violet-500"})]}),e.jsxs("div",{className:"pt-2",children:[e.jsx("span",{className:"block font-semibold text-gray-900 mb-1.5",children:"Variabel dinamis"}),e.jsx("p",{className:"text-[10px] text-gray-400 leading-relaxed",children:"Gunakan placeholder GoPhish berikut untuk personalisasi otomatis:"}),e.jsxs("div",{className:"grid grid-cols-2 gap-1.5 mt-2 font-mono text-[9px] text-gray-600 select-all",children:[e.jsx("div",{className:"bg-gray-50 border border-gray-100 rounded px-1.5 py-0.5 text-center",children:"{{.FirstName}}"}),e.jsx("div",{className:"bg-gray-50 border border-gray-100 rounded px-1.5 py-0.5 text-center",children:"{{.Email}}"}),e.jsx("div",{className:"bg-gray-50 border border-gray-100 rounded px-1.5 py-0.5 text-center",children:"{{.URL}} (Phish Link)"}),e.jsx("div",{className:"bg-gray-50 border border-gray-100 rounded px-1.5 py-0.5 text-center",children:"{{.Position}}"})]})]})]})]}),e.jsxs("div",{className:"lg:col-span-3 bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col shadow-sm",children:[e.jsxs("div",{className:"bg-gray-50 border-b border-gray-200 px-4 py-2 flex items-center justify-between text-xs",children:[e.jsxs("div",{className:"flex items-center gap-2",children:[e.jsx("span",{className:"w-2.5 h-2.5 rounded-full bg-red-400"}),e.jsx("span",{className:"w-2.5 h-2.5 rounded-full bg-yellow-400"}),e.jsx("span",{className:"w-2.5 h-2.5 rounded-full bg-green-400"}),e.jsx("span",{className:"text-gray-500 font-mono ml-2",children:"email_source.html"})]}),e.jsxs("div",{className:"flex items-center gap-3",children:[e.jsxs("span",{className:"text-gray-500 select-none",children:[y.split(`
`).length," baris"]}),e.jsx("span",{className:"text-gray-400 select-none",children:"HTML Source"})]})]}),e.jsx(z,{value:y,onChange:P})]})]})]})}function ie(){const[a,r]=s.useState(W),[l,d]=s.useState("list"),[m,C]=s.useState("all"),[g,y]=s.useState(""),[P,S]=s.useState("Microsoft Office 365 Alert"),[f,c]=s.useState(null),[n,x]=s.useState(""),[v,b]=s.useState(""),[j,h]=s.useState(""),[E,u]=s.useState(""),[A,D]=s.useState(!1),F=s.useMemo(()=>{let t=a;if(m!=="all"&&(t=t.filter(i=>i.category===m)),g.trim()){const i=g.toLowerCase();t=t.filter(o=>o.name.toLowerCase().includes(i))}return t},[a,m,g]),M=s.useMemo(()=>[{key:"all",label:"Semua",count:a.length},{key:"alert",label:"Security alert",count:a.filter(t=>t.category==="alert").length},{key:"info",label:"Internal info",count:a.filter(t=>t.category==="info").length},{key:"urgent",label:"Urgent notification",count:a.filter(t=>t.category==="urgent").length}],[a]),k=s.useCallback(t=>{d(t),t==="list"&&(c(null),x(""),b(""),h(""),u(""))},[]),H=s.useCallback(t=>{const i=a.find(o=>o.id===t);i&&(c(i.id),x(i.name),b(i.sender||""),h(i.subject||""),u(i.html||""),d("editor"))},[a]),I=s.useCallback(t=>{const i=a.find(o=>o.id===t);i&&(S(i.name),c(i.id),x(i.name),b(i.sender||""),h(i.subject||""),u(i.html||""),d("preview"))},[a]),L=s.useCallback(()=>{c(null),x(""),b("Admin <admin@company.id>"),h("Tindakan Diperlukan: Notifikasi Penting"),u(J),d("editor")},[]),G=s.useCallback((t,i)=>{if(f)r(o=>o.map(p=>p.id===f?{...p,name:t||p.name,sender:v,subject:j,html:i}:p)),N.success(`Template "${t||"Email Template"}" berhasil disimpan`);else{const p={id:"custom_"+Date.now(),name:t||"Email Template Baru",category:"alert",description:"Template email kustom dibuat oleh pengguna.",sender:v,subject:j,html:i,thumbnail:{icon:"ti-mail",bg:"bg-violet-500/20 text-violet-500",bars:[{w:"w-20"},{w:"w-24"}]}};r(U=>[...U,p]),N.success(`Template baru "${p.name}" berhasil dibuat`)}d("list"),c(null),x(""),b(""),h(""),u("")},[f,v,j]),B=s.useCallback(()=>{D(!0),N("Menyinkronkan email template dari GoPhish...",{icon:"🔄"}),setTimeout(()=>{D(!1),N.success("Sinkronisasi selesai — 4 email templates")},1500)},[]),T=t=>w("email-tab-btn flex items-center gap-2 py-3 px-1 border-b-2 font-semibold text-sm transition-all focus:outline-none select-none",l===t?"border-violet-500 text-violet-500":"border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"),O=t=>w("email-filter-pill px-4 py-1.5 rounded-full text-xs font-semibold transition-all select-none",m===t?"bg-gray-950 text-white":"bg-white border border-gray-200 text-gray-600 hover:bg-gray-50");return e.jsxs("div",{className:"space-y-6 lg:flex lg:h-[calc(100vh-110px)] lg:min-h-[720px] lg:flex-col lg:overflow-hidden mt-4 animate-fade-in",children:[e.jsx(Y,{title:"Email templates",subtitle:"Kelola template email phishing simulasi",actions:e.jsxs(e.Fragment,{children:[e.jsxs("div",{className:"relative w-64",children:[e.jsx("span",{className:"absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400",children:e.jsx("i",{className:"ti ti-search text-base"})}),e.jsx("input",{type:"text",value:g,onChange:t=>y(t.target.value),placeholder:"Cari template...",className:"w-full bg-white border border-gray-200 rounded-xl pl-9 pr-4 py-2 text-sm text-gray-950 placeholder-gray-400 focus:outline-none focus:border-violet-500 transition-colors"})]}),e.jsxs(R,{variant:"outline",onClick:B,disabled:A,children:[e.jsx("i",{className:w("ti ti-refresh text-base",A&&"animate-spin")}),e.jsx("span",{children:"Sync GoPhish"})]}),e.jsxs(R,{variant:"primary",onClick:L,children:[e.jsx("i",{className:"ti ti-plus text-base"}),e.jsx("span",{children:"Buat email template"})]})]})}),e.jsx("div",{className:"border-b border-gray-200",children:e.jsxs("nav",{className:"flex gap-6 -mb-px","aria-label":"Email template subtabs",children:[e.jsxs("button",{onClick:()=>k("list"),className:T("list"),children:[e.jsx("i",{className:"ti ti-list text-base"}),e.jsx("span",{children:"Daftar template"})]}),e.jsxs("button",{onClick:()=>k("editor"),className:T("editor"),children:[e.jsx("i",{className:"ti ti-edit text-base"}),e.jsx("span",{children:"Editor"})]}),e.jsxs("button",{onClick:()=>k("preview"),className:T("preview"),children:[e.jsx("i",{className:"ti ti-eye text-base"}),e.jsx("span",{children:"Preview"})]})]})}),e.jsxs("div",{className:"space-y-6",children:[l==="list"&&e.jsxs("div",{className:"space-y-6 animate-fade-in",children:[e.jsx("div",{className:"flex flex-wrap items-center gap-2",children:M.map(t=>e.jsxs("button",{onClick:()=>C(t.key),className:O(t.key),children:[t.label," (",t.count,")"]},t.key))}),e.jsxs("div",{className:"grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6",children:[F.map(t=>e.jsx(V,{page:t,onEdit:H,onPreview:I},t.id)),e.jsx(_,{onClick:L})]})]}),l==="editor"&&e.jsx(q,{editingName:n,name:n,setName:x,sender:v,setSender:b,subject:j,setSubject:h,htmlCode:E,setHtmlCode:u,onBack:()=>k("list"),onSave:G}),l==="preview"&&e.jsxs("div",{className:"space-y-6 animate-fade-in",children:[e.jsxs("div",{className:"flex items-center justify-between",children:[e.jsxs("div",{children:[e.jsx("h2",{className:"text-lg font-bold text-gray-900",children:P}),e.jsx("p",{className:"text-xs text-gray-500 mt-0.5",children:"Menampilkan simulasi tampilan kotak masuk email di klien target"})]}),e.jsx("button",{onClick:()=>k("list"),className:"bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 px-4 py-2 text-sm font-semibold rounded-xl transition-all",children:"Kembali ke daftar"})]}),e.jsx("div",{className:"border border-gray-200 rounded-xl bg-gray-50 overflow-hidden flex flex-col p-4 md:p-6 min-h-[450px]",children:E?e.jsx(K,{html:E,sender:v,subject:j}):e.jsx($,{})})]})]})]})}export{ie as default};
