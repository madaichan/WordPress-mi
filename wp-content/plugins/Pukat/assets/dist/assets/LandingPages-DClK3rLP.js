import{r as i,z as L,j as e,c as b}from"./main-Dg9ttT0i.js";const J=[{id:"djp",name:"DJP Pajak Login",category:"login",description:"Kloning form login portal DJP Online Direktorat Jenderal Pajak.",html:`<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>DJP Online - Login</title>
  <style>
    body { margin:0; font-family:sans-serif; background:#0b172a; color:#fff; display:flex; align-items:center; justify-content:center; min-height:100vh; }
    .card { width:360px; padding:32px; text-align:center; }
    .logo { width:48px; height:48px; border-radius:50%; background:rgba(234,179,8,.2); border:1px solid rgba(234,179,8,.4); color:#eab308; font-weight:700; font-size:14px; display:flex; align-items:center; justify-content:center; margin:0 auto 12px; }
    h3 { font-size:11px; color:#9ca3af; margin:0 0 4px; }
    h4 { font-size:14px; margin:0 0 24px; }
    input { width:100%; box-sizing:border-box; background:rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.1); border-radius:4px; padding:8px 12px; font-size:12px; color:#fff; margin-bottom:12px; }
    input::placeholder { color:#6b7280; }
    button { width:100%; background:#eab308; color:#0b172a; border:none; padding:10px; font-size:12px; font-weight:700; border-radius:4px; cursor:pointer; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">DJP</div>
    <h3>DIREKTORAT JENDERAL PAJAK</h3>
    <h4>DJP Online Login Portal</h4>
    <form action="" method="POST">
      <input type="text" name="npwp" placeholder="NPWP / NIK" />
      <input type="password" name="password" placeholder="Kata Sandi" />
      <button type="submit">MASUK</button>
    </form>
  </div>
</body>
</html>`,thumbnail:{accent:e.jsxs("div",{className:"flex items-center gap-1.5",children:[e.jsx("div",{className:"w-8 h-8 rounded bg-blue-700/60 flex-shrink-0"}),e.jsx("div",{className:"h-3 bg-blue-700/40 w-16 rounded"})]}),bars:[{w:"w-full"},{w:"w-4/5"}]},badges:["Data","Pass"]},{id:"ms",name:"Microsoft 365 Login",category:"login",description:"Kloning form login portal email korporat Outlook 365.",html:`<!DOCTYPE html>
<html>
<head>
  <title>Sign in to your account</title>
  <style>
    body { margin:0; font-family:'Segoe UI',sans-serif; background:#f2f2f2; display:flex; align-items:center; justify-content:center; min-height:100vh; }
    .card { width:440px; background:#fff; padding:44px; box-shadow:0 2px 6px rgba(0,0,0,.2); }
    .logo { display:flex; align-items:center; gap:4px; margin-bottom:16px; }
    .logo .grid { display:grid; grid-template-columns:1fr 1fr; gap:2px; width:16px; height:16px; }
    .logo .grid div:nth-child(1) { background:#f25022; }
    .logo .grid div:nth-child(2) { background:#7fba00; }
    .logo .grid div:nth-child(3) { background:#00a4ef; }
    .logo .grid div:nth-child(4) { background:#ffb900; }
    .logo span { font-size:14px; font-weight:600; color:#5e5e5e; }
    h2 { font-size:24px; font-weight:600; margin:0 0 24px; }
    input { width:100%; box-sizing:border-box; border:none; border-bottom:1px solid #666; padding:6px 0; font-size:14px; outline:none; margin-bottom:16px; }
    .link { font-size:13px; color:#0067b8; text-decoration:none; }
    .actions { display:flex; justify-content:flex-end; margin-top:24px; }
    button { background:#0067b8; color:#fff; border:none; padding:8px 24px; font-size:14px; cursor:pointer; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo"><div class="grid"><div></div><div></div><div></div><div></div></div><span>Microsoft</span></div>
    <h2>Sign in</h2>
    <form action="" method="POST">
      <input type="email" name="email" placeholder="Email, phone, or Skype" />
      <p style="font-size:13px;color:#666">No account? <a href="#" class="link">Create one!</a></p>
      <div class="actions"><button type="submit">Next</button></div>
    </form>
  </div>
</body>
</html>`,thumbnail:{accent:e.jsx("div",{className:"flex items-center gap-1.5",children:e.jsx("div",{className:"w-12 h-2.5 bg-blue-500/80 rounded"})}),bars:[{w:"w-full"},{w:"w-4/5"}]},badges:["Data","Pass"]},{id:"hr",name:"HR Portal — Data",category:"form",description:"Form input pembaruan data karyawan korporat.",html:`<!DOCTYPE html>
<html>
<head>
  <title>HR Portal - Data Update</title>
  <style>
    body { margin:0; font-family:sans-serif; background:#f9fafb; display:flex; align-items:center; justify-content:center; min-height:100vh; }
    .card { width:400px; background:#fff; border:1px solid #e5e7eb; border-radius:8px; padding:32px; }
    h2 { font-size:18px; margin:0 0 4px; }
    p { font-size:12px; color:#6b7280; margin:0 0 24px; }
    label { display:block; font-size:12px; font-weight:600; color:#374151; margin-bottom:4px; }
    input, select { width:100%; box-sizing:border-box; border:1px solid #d1d5db; border-radius:6px; padding:8px 12px; font-size:13px; margin-bottom:16px; }
    button { width:100%; background:#dc2626; color:#fff; border:none; padding:10px; font-size:13px; font-weight:600; border-radius:6px; cursor:pointer; }
  </style>
</head>
<body>
  <div class="card">
    <h2>Pembaruan Data Karyawan</h2>
    <p>Silakan lengkapi data berikut untuk verifikasi HR</p>
    <form action="" method="POST">
      <label>Nama Lengkap</label>
      <input type="text" name="fullname" placeholder="Nama sesuai KTP" />
      <label>NIK Karyawan</label>
      <input type="text" name="nik" placeholder="Nomor Induk Karyawan" />
      <label>Email Korporat</label>
      <input type="email" name="email" placeholder="nama@perusahaan.co.id" />
      <label>Departemen</label>
      <select name="department">
        <option>Finance</option>
        <option>Engineering</option>
        <option>Human Resources</option>
        <option>Marketing</option>
      </select>
      <button type="submit">Kirim Data</button>
    </form>
  </div>
</body>
</html>`,thumbnail:{accent:e.jsx("div",{className:"flex items-center gap-1.5",children:e.jsx("div",{className:"w-12 h-2.5 bg-red-500/80 rounded"})}),bars:[{w:"w-full"},{w:"w-4/5"}]},badges:["Data"]},{id:"vpn",name:"IT Helpdesk — VPN Reset",category:"login",html:`<!DOCTYPE html>
<html>
<head>
  <title>VPN Portal Gateway</title>
  <style>
    body { margin:0; font-family:sans-serif; background:#f3f4f6; display:flex; align-items:center; justify-content:center; min-height:100vh; }
    .card { width:380px; background:#fff; border:1px solid #e5e7eb; border-radius:8px; padding:32px; text-align:center; }
    .icon { width:40px; height:40px; background:#eff6ff; color:#2563eb; display:flex; align-items:center; justify-content:center; margin:0 auto 8px; border-radius:6px; font-size:20px; }
    h3 { font-size:14px; margin:0 0 4px; }
    p { font-size:12px; color:#6b7280; margin:0 0 20px; }
    input { width:100%; box-sizing:border-box; border:1px solid #e5e7eb; border-radius:4px; padding:8px 12px; font-size:12px; margin-bottom:12px; }
    button { width:100%; background:#2563eb; color:#fff; border:none; padding:10px; font-size:12px; font-weight:700; border-radius:4px; cursor:pointer; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">🔑</div>
    <h3>VPN Portal Gateway</h3>
    <p>Autentikasi Ulang Koneksi VPN Korporat</p>
    <form action="" method="POST">
      <input type="text" name="username" placeholder="Username Korporat" />
      <input type="password" name="password" placeholder="Password Active Directory" />
      <button type="submit">RESET KONEKSI</button>
    </form>
  </div>
</body>
</html>`,description:null,meta:"Belum dipakai · Dibuat kemarin",chips:[{label:"Login page",cls:"bg-blue-50 text-blue-700"},{label:"Cleartext ⚠",cls:"bg-red-50 text-red-700 border border-red-200"}],thumbnail:{accent:null,bars:[{w:"w-3/4"},{w:"w-1/2"}]},badges:["Data","Pass"]},{id:"google",name:"Google Redirect",category:"redirect",description:"Halaman edukasi landing page yang me-redirect target langsung ke portal resmi setelah klik.",html:`<!DOCTYPE html>
<html>
<head>
  <title>Redirecting...</title>
  <meta http-equiv="refresh" content="3;url=https://www.google.com">
  <style>
    body { margin:0; font-family:sans-serif; background:#f0fdf4; display:flex; align-items:center; justify-content:center; min-height:100vh; }
    .card { text-align:center; padding:40px; }
    .icon { font-size:48px; margin-bottom:16px; }
    h2 { font-size:18px; color:#166534; margin:0 0 8px; }
    p { font-size:13px; color:#6b7280; margin:0 0 24px; max-width:360px; }
    a { color:#2563eb; font-size:13px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">✅</div>
    <h2>Terima kasih!</h2>
    <p>Anda akan dialihkan ke halaman resmi dalam beberapa detik...</p>
    <a href="https://www.google.com">Klik di sini jika tidak otomatis redirect</a>
  </div>
</body>
</html>`,thumbnail:{accent:e.jsx("div",{className:"flex items-center gap-1.5",children:e.jsx("div",{className:"w-12 h-2.5 bg-emerald-500/80 rounded"})}),bars:[{w:"w-3/4"}]},badges:["Data"]}];function V({label:t}){const s=t==="Pass";return e.jsxs("span",{className:b("rounded-full text-[9px] font-semibold px-1.5 py-0.5",s?"bg-red-100 text-red-700":"bg-emerald-100 text-emerald-700"),children:[t," ✓"]})}function Y({page:t}){return e.jsxs("div",{className:"h-32 bg-[#1F1F1F] rounded-lg border border-gray-800 p-3 relative flex flex-col justify-center gap-2 overflow-hidden select-none",children:[e.jsx("span",{className:"absolute top-2 right-2 rounded-full text-[9px] font-semibold px-2 py-0.5 bg-amber-100 text-amber-700",children:"GoPhish"}),t.thumbnail.accent,e.jsx("div",{className:"space-y-2 mt-2",children:t.thumbnail.bars.map((s,n)=>e.jsx("div",{className:b("h-2.5 bg-gray-700/60 rounded",s.w)},n))}),e.jsx("div",{className:"absolute bottom-2 left-2 flex items-center gap-1.5",children:t.badges.map(s=>e.jsx(V,{label:s},s))})]})}function _({page:t,onEdit:s,onPreview:n}){return e.jsxs("div",{className:"landing-page-card bg-white border border-gray-200 rounded-xl p-5 shadow-none flex flex-col justify-between h-80 transition-all hover:border-gray-300","data-category":t.category,"data-title":t.name,children:[e.jsxs("div",{className:"space-y-4",children:[e.jsx(Y,{page:t}),e.jsx("div",{children:t.chips?e.jsxs(e.Fragment,{children:[e.jsx("div",{className:"flex items-center justify-between",children:e.jsx("h3",{className:"text-sm font-bold text-gray-900",children:t.name})}),t.meta&&e.jsx("p",{className:"text-[10px] text-gray-400 mt-0.5",children:t.meta}),e.jsx("div",{className:"flex flex-wrap gap-1.5 mt-2",children:t.chips.map(l=>e.jsx("span",{className:b("rounded-full text-[9px] font-semibold px-2.5 py-0.5",l.cls),children:l.label},l.label))})]}):e.jsxs(e.Fragment,{children:[e.jsx("h3",{className:"text-sm font-bold text-gray-900",children:t.name}),t.description&&e.jsx("p",{className:"text-xs text-gray-500 mt-1",children:t.description})]})})]}),e.jsxs("div",{className:"flex gap-2 mt-4 pt-3 border-t border-gray-50",children:[e.jsxs("button",{onClick:()=>s(t.id),className:"flex-1 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 py-1.5 text-xs font-semibold rounded-lg flex items-center justify-center gap-1 transition-all",children:[e.jsx("i",{className:"ti ti-edit text-sm"}),e.jsx("span",{children:"Edit"})]}),e.jsxs("button",{onClick:()=>n(t.id),className:"flex-1 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 py-1.5 text-xs font-semibold rounded-lg flex items-center justify-center gap-1 transition-all",children:[e.jsx("i",{className:"ti ti-eye text-sm"}),e.jsx("span",{children:"Preview"})]})]})]})}function q({onClick:t}){return e.jsxs("div",{onClick:t,className:"border border-dashed border-gray-200 hover:border-gray-300 rounded-xl p-5 flex flex-col items-center justify-center gap-2 cursor-pointer h-80 transition-all select-none text-gray-400 hover:text-gray-600 bg-white",children:[e.jsx("i",{className:"ti ti-plus text-3xl"}),e.jsx("span",{className:"text-sm font-semibold",children:"Buat landing page baru"})]})}function Z({html:t,redirectUrl:s}){const[n,l]=i.useState("desktop"),o={desktop:"w-full max-w-5xl",tablet:"w-[768px]",mobile:"w-[375px]"}[n];return e.jsxs("div",{className:"w-full flex flex-col items-center space-y-4 animate-fade-in",children:[e.jsxs("div",{className:"flex items-center justify-between w-full max-w-5xl bg-white border border-gray-200 rounded-xl px-4 py-2 text-xs",children:[e.jsxs("div",{className:"flex items-center gap-2",children:[e.jsx("span",{className:"font-semibold text-gray-500 mr-2",children:"Viewport:"}),e.jsxs("button",{onClick:()=>l("desktop"),className:b("px-2.5 py-1 rounded-md font-semibold transition-all flex items-center gap-1.5",n==="desktop"?"bg-violet-50 text-violet-600":"text-gray-600 hover:bg-gray-50"),children:[e.jsx("i",{className:"ti ti-device-desktop text-sm"})," Desktop"]}),e.jsxs("button",{onClick:()=>l("tablet"),className:b("px-2.5 py-1 rounded-md font-semibold transition-all flex items-center gap-1.5",n==="tablet"?"bg-violet-50 text-violet-600":"text-gray-600 hover:bg-gray-50"),children:[e.jsx("i",{className:"ti ti-device-tablet text-sm"})," Tablet (768px)"]}),e.jsxs("button",{onClick:()=>l("mobile"),className:b("px-2.5 py-1 rounded-md font-semibold transition-all flex items-center gap-1.5",n==="mobile"?"bg-violet-50 text-violet-600":"text-gray-600 hover:bg-gray-50"),children:[e.jsx("i",{className:"ti ti-device-mobile text-sm"})," Mobile (375px)"]})]}),e.jsxs("div",{className:"text-gray-400 select-none text-[10px] flex items-center gap-1",children:[e.jsx("span",{className:"inline-block w-1.5 h-1.5 rounded-full bg-emerald-500"})," Live Sandbox"]})]}),e.jsxs("div",{className:b("bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm flex flex-col transition-all duration-300",o),children:[e.jsxs("div",{className:"bg-gray-50 border-b border-gray-200 px-4 py-3 flex items-center gap-3",children:[e.jsxs("div",{className:"flex items-center gap-1.5 flex-shrink-0",children:[e.jsx("span",{className:"w-3 h-3 rounded-full bg-red-400"}),e.jsx("span",{className:"w-3 h-3 rounded-full bg-yellow-400"}),e.jsx("span",{className:"w-3 h-3 rounded-full bg-green-400"})]}),e.jsxs("div",{className:"bg-white border border-gray-200 rounded-lg px-3 py-1.5 flex items-center gap-2 flex-1 text-xs text-gray-500 select-none font-mono",children:[e.jsx("i",{className:"ti ti-lock text-emerald-600"}),e.jsx("span",{className:"truncate",children:s||"https://portal.office.com"})]})]}),e.jsx("div",{className:"bg-gray-50 p-4 min-h-[500px] flex items-center justify-center w-full",children:e.jsx("iframe",{srcDoc:t||"<h3>No HTML content</h3>",title:"Landing Page Preview",className:"w-full min-h-[480px] bg-white border border-gray-200/80 rounded-lg shadow-sm",sandbox:"allow-scripts"})})]})]})}function Q(){return e.jsxs("div",{className:"text-center text-gray-400 space-y-2 py-12",children:[e.jsx("i",{className:"ti ti-eye-off text-3xl"}),e.jsx("p",{className:"text-xs font-medium",children:'Silakan klik "Preview" pada salah satu landing page di daftar atau klik tab "Editor" untuk mengedit template'})]})}const W=`<!DOCTYPE html>
<html>
<head>
  <title>Sign in to your account</title>
  <style>body { font-family: sans-serif; }</style>
</head>
<body>
  <div class="login-card">
    <h2>Sign In</h2>
    <form action="" method="POST">
      <input type="email" name="email" placeholder="Email" />
      <input type="password" name="password" placeholder="Password" />
      <button type="submit">Submit</button>
    </form>
  </div>
</body>
</html>`;function X(t){let s=t.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");return s=s.replace(/(&lt;!--[\s\S]*?--&gt;)/g,'<span class="text-gray-500 italic">$1</span>'),s=s.replace(/(&lt;!DOCTYPE\s+[^&]*&gt;)/gi,'<span class="text-blue-400">$1</span>'),s=s.replace(/(&lt;\/?)([a-zA-Z][a-zA-Z0-9-]*)([^&]*?)(\/?)(&gt;)/g,(n,l,o,u,p,f)=>{const v=u.replace(/([a-zA-Z-]+)(=)(&quot;[^&]*?&quot;|&#39;[^&]*?&#39;|[^\s&]+)/g,'<span class="text-yellow-400">$1$2</span><span class="text-green-300">$3</span>');return`<span class="text-blue-400">${l}${o}</span>${v}<span class="text-blue-400">${p}${f}</span>`}),s}function ee({value:t,onChange:s}){const n=i.useRef(null),l=i.useRef(null),o=i.useRef(null),u=t.split(`
`).length,p=i.useCallback(()=>{const d=n.current;l.current&&(l.current.scrollTop=d.scrollTop,l.current.scrollLeft=d.scrollLeft),o.current&&(o.current.scrollTop=d.scrollTop)},[]),f=i.useCallback(d=>{if(d.key==="Tab"){d.preventDefault();const c=d.target,j=c.selectionStart,y=c.selectionEnd,h=c.value.substring(0,j)+"  "+c.value.substring(y);s(h),requestAnimationFrame(()=>{c.selectionStart=c.selectionEnd=j+2})}},[s]),v=i.useMemo(()=>X(t),[t]);return e.jsxs("div",{className:"bg-[#1e1e1e] font-mono text-[11px] h-[420px] flex relative",children:[e.jsx("div",{ref:o,className:"text-gray-600 select-none text-right pr-3 pl-3 border-r border-gray-800 flex-shrink-0 overflow-hidden pt-4 pb-4",style:{width:48,lineHeight:"1.625"},children:Array.from({length:u},(d,c)=>e.jsx("div",{className:"h-[17.875px] flex items-center justify-end",children:c+1},c))}),e.jsxs("div",{className:"relative flex-1 overflow-hidden",children:[e.jsx("pre",{ref:l,className:"absolute inset-0 p-4 m-0 overflow-hidden pointer-events-none text-gray-300 whitespace-pre-wrap break-words",style:{lineHeight:"1.625",wordBreak:"break-all"},"aria-hidden":"true",dangerouslySetInnerHTML:{__html:v+`
`}}),e.jsx("textarea",{ref:n,value:t,onChange:d=>s(d.target.value),onScroll:p,onKeyDown:f,spellCheck:!1,className:"absolute inset-0 w-full h-full resize-none p-4 m-0 bg-transparent border-none outline-none overflow-auto",style:{lineHeight:"1.625",color:"transparent",caretColor:"#d4d4d4",whiteSpace:"pre-wrap",wordBreak:"break-all",fontFamily:"inherit",fontSize:"inherit"}})]})]})}function te({editingName:t,name:s,setName:n,htmlCode:l,setHtmlCode:o,redirectUrl:u,setRedirectUrl:p,captureData:f,setCaptureData:v,capturePass:d,setCapturePass:c,onBack:j,onSave:y}){const h=t?`Edit: ${t}`:"Buat landing page";return e.jsxs("div",{className:"space-y-6 animate-fade-in",children:[e.jsxs("div",{className:"flex items-center justify-between",children:[e.jsxs("div",{children:[e.jsx("h2",{className:"text-lg font-bold text-gray-900",children:h}),e.jsx("p",{className:"text-xs text-gray-500 mt-0.5",children:"Konfigurasi template HTML untuk menangkap input kredensial simulasi"})]}),e.jsxs("div",{className:"flex items-center gap-3",children:[e.jsx("button",{onClick:j,className:"bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 px-4 py-2 text-sm font-semibold rounded-xl transition-all",children:"Batal"}),e.jsx("button",{onClick:()=>y(s,l),className:"bg-violet-500 text-white hover:bg-violet-600 px-4 py-2 text-sm font-semibold rounded-xl transition-all",children:"Simpan template"})]})]}),e.jsxs("div",{className:"grid grid-cols-1 lg:grid-cols-5 gap-6",children:[e.jsxs("div",{className:"lg:col-span-2 bg-white border border-gray-200 rounded-xl p-5 space-y-4",children:[e.jsx("h3",{className:"text-sm font-semibold text-gray-900 border-b border-gray-100 pb-2",children:"Konfigurasi template"}),e.jsxs("div",{className:"space-y-3 text-xs",children:[e.jsxs("div",{className:"space-y-1",children:[e.jsx("label",{className:"block font-semibold text-gray-700",children:"Nama template *"}),e.jsx("input",{type:"text",value:s,onChange:m=>n(m.target.value),placeholder:"Contoh: Microsoft 365 Login",className:"w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-gray-950 focus:outline-none focus:border-violet-500"})]}),e.jsxs("div",{className:"space-y-1",children:[e.jsx("label",{className:"block font-semibold text-gray-700",children:"Redirect URL (setelah submit)"}),e.jsx("input",{type:"text",value:u,onChange:m=>p(m.target.value),placeholder:"https://...",className:"w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-gray-950 focus:outline-none focus:border-violet-500"})]}),e.jsxs("div",{className:"pt-2 space-y-3",children:[e.jsxs("label",{className:"flex items-start gap-2.5 cursor-pointer select-none",children:[e.jsx("input",{type:"checkbox",checked:f,onChange:m=>v(m.target.checked),className:"mt-0.5 text-violet-600 border-gray-300 rounded focus:ring-violet-500"}),e.jsxs("div",{children:[e.jsx("span",{className:"block font-semibold text-gray-900",children:"Capture submitted data"}),e.jsx("span",{className:"block text-[10px] text-gray-400 mt-0.5",children:"Tangkap data parameter input yang dimasukkan user target"})]})]}),e.jsxs("label",{className:"flex items-start gap-2.5 cursor-pointer select-none",children:[e.jsx("input",{type:"checkbox",checked:d,onChange:m=>c(m.target.checked),className:"mt-0.5 text-violet-600 border-gray-300 rounded focus:ring-violet-500"}),e.jsxs("div",{children:[e.jsx("span",{className:"block font-semibold text-gray-900",children:"Capture passwords"}),e.jsx("span",{className:"block text-[10px] text-gray-400 mt-0.5",children:"Tangkap input password (direkomendasikan dalam mode terenkripsi)"})]})]})]})]})]}),e.jsxs("div",{className:"lg:col-span-3 bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col",children:[e.jsxs("div",{className:"bg-gray-50 border-b border-gray-200 px-4 py-2 flex items-center justify-between text-xs",children:[e.jsxs("div",{className:"flex items-center gap-2",children:[e.jsx("span",{className:"w-2.5 h-2.5 rounded-full bg-red-400"}),e.jsx("span",{className:"w-2.5 h-2.5 rounded-full bg-yellow-400"}),e.jsx("span",{className:"w-2.5 h-2.5 rounded-full bg-green-400"}),e.jsx("span",{className:"text-gray-500 font-mono ml-2",children:"template.html"})]}),e.jsxs("div",{className:"flex items-center gap-3",children:[e.jsxs("span",{className:"text-gray-500 select-none",children:[l.split(`
`).length," baris"]}),e.jsx("span",{className:"text-gray-400 select-none",children:"HTML Source"})]})]}),e.jsx(ee,{value:l,onChange:o})]})]})]})}function se(){const[t,s]=i.useState(J),[n,l]=i.useState("list"),[o,u]=i.useState("all"),[p,f]=i.useState(""),[v,d]=i.useState(null),[c,j]=i.useState("Microsoft 365 Login"),[y,h]=i.useState(null),[m,w]=i.useState(""),[K,N]=i.useState(""),[S,k]=i.useState("https://portal.office.com"),[E,P]=i.useState(!0),[z,C]=i.useState(!0),[A,H]=i.useState(!1),O=i.useMemo(()=>{let a=t;if(o!=="all"&&(a=a.filter(r=>r.category===o)),p.trim()){const r=p.toLowerCase();a=a.filter(g=>g.name.toLowerCase().includes(r))}return a},[t,o,p]),I=i.useMemo(()=>[{key:"all",label:"Semua",count:t.length},{key:"login",label:"Login page",count:t.filter(a=>a.category==="login").length},{key:"form",label:"Form submission",count:t.filter(a=>a.category==="form").length},{key:"redirect",label:"Redirect only",count:t.filter(a=>a.category==="redirect").length}],[t]),D=i.useCallback((a,r)=>{l(a),a==="list"&&(h(null),w(""),N(""),k("https://portal.office.com"),P(!0),C(!0))},[]),U=i.useCallback(a=>{var g,x;const r=t.find(T=>T.id===a);r&&(h(r.id),w(r.name),N(r.html||""),k(r.redirectUrl||"https://portal.office.com"),P(((g=r.badges)==null?void 0:g.includes("Data"))??!0),C(((x=r.badges)==null?void 0:x.includes("Pass"))??!0),l("editor"))},[t]),F=i.useCallback(a=>{var g,x;const r=t.find(T=>T.id===a);r&&(d(a),j(r.name),h(r.id),w(r.name),N(r.html||""),k(r.redirectUrl||"https://portal.office.com"),P(((g=r.badges)==null?void 0:g.includes("Data"))??!0),C(((x=r.badges)==null?void 0:x.includes("Pass"))??!0),l("preview"))},[t]),M=i.useCallback(()=>{h(null),w(""),N(W),k("https://portal.office.com"),P(!0),C(!0),l("editor")},[]),$=i.useCallback((a,r)=>{if(y)s(g=>g.map(x=>x.id===y?{...x,name:a||x.name,html:r,redirectUrl:S,badges:[...E?["Data"]:[],...z?["Pass"]:[]]}:x)),L.success(`Template "${a||"Landing Page"}" berhasil disimpan`);else{const x={id:"custom_"+Date.now(),name:a||"Landing Page Baru",category:"login",description:"Template kustom dibuat oleh pengguna.",html:r,redirectUrl:S,thumbnail:{accent:null,bars:[{w:"w-3/4"},{w:"w-1/2"}]},badges:[...E?["Data"]:[],...z?["Pass"]:[]]};s(T=>[...T,x]),L.success(`Template baru "${x.name}" berhasil dibuat`)}l("list"),h(null),w(""),N(""),k("https://portal.office.com"),P(!0),C(!0)},[y,S,E,z]),B=i.useCallback(()=>{H(!0),L("Menyinkronkan data dari GoPhish...",{icon:"🔄"}),setTimeout(()=>{H(!1),L.success("Sinkronisasi selesai — 5 landing pages")},1500)},[]),R=a=>b("landing-tab-btn flex items-center gap-2 py-3 px-1 border-b-2 font-semibold text-sm transition-all focus:outline-none select-none",n===a?"border-violet-500 text-violet-500":"border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"),G=a=>b("landing-filter-pill px-4 py-1.5 rounded-full text-xs font-semibold transition-all select-none",o===a?"bg-gray-950 text-white":"bg-white border border-gray-200 text-gray-600 hover:bg-gray-50");return e.jsxs("div",{className:"space-y-6 lg:flex lg:h-[calc(100vh-110px)] lg:min-h-[720px] lg:flex-col lg:overflow-hidden mt-4 animate-fade-in",children:[e.jsxs("div",{className:"flex flex-col md:flex-row md:items-center justify-between gap-4",children:[e.jsxs("div",{children:[e.jsx("h1",{className:"text-2xl font-bold text-gray-900",children:"Landing pages"}),e.jsx("p",{className:"text-sm text-gray-500 mt-0.5",children:"Dikelola di GoPhish · terhubung via API"})]}),e.jsxs("div",{className:"flex flex-wrap items-center gap-3",children:[e.jsxs("div",{className:"relative w-64",children:[e.jsx("span",{className:"absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400",children:e.jsx("i",{className:"ti ti-search text-base"})}),e.jsx("input",{type:"text",value:p,onChange:a=>f(a.target.value),placeholder:"Cari landing page...",className:"w-full bg-white border border-gray-200 rounded-xl pl-9 pr-4 py-2 text-sm text-gray-950 placeholder-gray-400 focus:outline-none focus:border-violet-500 transition-colors"})]}),e.jsxs("button",{onClick:B,disabled:A,className:"bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 px-4 py-2 text-sm font-semibold rounded-xl flex items-center gap-2 transition-all disabled:opacity-60",children:[e.jsx("i",{className:b("ti ti-refresh text-base",A&&"animate-spin")}),e.jsx("span",{children:"Sync GoPhish"})]}),e.jsxs("button",{onClick:M,className:"bg-violet-500 text-white hover:bg-violet-600 px-4 py-2 text-sm font-semibold rounded-xl flex items-center gap-1.5 transition-all",children:[e.jsx("i",{className:"ti ti-plus text-base"}),e.jsx("span",{children:"Buat landing page"})]})]})]}),e.jsx("div",{className:"border-b border-gray-200",children:e.jsxs("nav",{className:"flex gap-6 -mb-px","aria-label":"Landing page subtabs",children:[e.jsxs("button",{onClick:()=>D("list"),className:R("list"),children:[e.jsx("i",{className:"ti ti-list text-base"}),e.jsx("span",{children:"Daftar landing page"})]}),e.jsxs("button",{onClick:()=>D("editor"),className:R("editor"),children:[e.jsx("i",{className:"ti ti-edit text-base"}),e.jsx("span",{children:"Editor"})]}),e.jsxs("button",{onClick:()=>D("preview"),className:R("preview"),children:[e.jsx("i",{className:"ti ti-eye text-base"}),e.jsx("span",{children:"Preview"})]})]})}),e.jsxs("div",{className:"space-y-6",children:[n==="list"&&e.jsxs("div",{className:"space-y-6 animate-fade-in",children:[e.jsx("div",{className:"flex flex-wrap items-center gap-2",children:I.map(a=>e.jsxs("button",{onClick:()=>u(a.key),className:G(a.key),children:[a.label," (",a.count,")"]},a.key))}),e.jsxs("div",{className:"grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6",children:[O.map(a=>e.jsx(_,{page:a,onEdit:U,onPreview:F},a.id)),e.jsx(q,{onClick:M})]})]}),n==="editor"&&e.jsx(te,{editingName:m,name:m,setName:w,htmlCode:K,setHtmlCode:N,redirectUrl:S,setRedirectUrl:k,captureData:E,setCaptureData:P,capturePass:z,setCapturePass:C,onBack:()=>D("list"),onSave:$}),n==="preview"&&e.jsxs("div",{className:"space-y-6 animate-fade-in",children:[e.jsxs("div",{className:"flex items-center justify-between",children:[e.jsxs("div",{children:[e.jsx("h2",{className:"text-lg font-bold text-gray-900",children:c}),e.jsx("p",{className:"text-xs text-gray-500 mt-0.5",children:"Menampilkan simulasi tampilan persis di mata korban target"})]}),e.jsx("button",{onClick:()=>D("list"),className:"bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 px-4 py-2 text-sm font-semibold rounded-xl transition-all",children:"Kembali ke daftar"})]}),e.jsx("div",{className:"border border-gray-200 rounded-xl overflow-hidden bg-gray-100 flex flex-col items-center justify-center p-6 min-h-[450px]",children:K?e.jsx(Z,{html:K,redirectUrl:S}):e.jsx(Q,{})})]})]})]})}export{se as default};
