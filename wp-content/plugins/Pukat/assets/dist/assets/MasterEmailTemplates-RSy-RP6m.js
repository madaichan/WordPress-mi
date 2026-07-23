import{r as i,z as j,j as e,c as U,n as se}from"./main-CWwUWTsm.js";import{F as ae,A as ie}from"./AssignmentPanel-S-i4gns7.js";import{H as le}from"./HtmlCodeEditor-HiumChVG.js";import{C as ne}from"./ClientPreview-CfY_QfaG.js";import{A as re}from"./AssignmentBadge-Dc1x-Yk7.js";import{T as F}from"./TableActionButton-CGYwoAJ4.js";import{P as oe}from"./PageHeader-B3cm0VTD.js";import{B as S}from"./Button-DcfJqIX5.js";import{T as de}from"./Tabs-D7MU9eWN.js";import{B as W}from"./Badge-DppiatDM.js";import{a as ce}from"./useUserQueries-DmGKEcmk.js";const me=`<!DOCTYPE html>
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
    <h3>Unusual Account Activity</h3>
    <p>Hello {{.FirstName}},</p>
    <p>We detected an unknown sign-in attempt on your account.</p>
    <div style="text-align: center; margin: 20px 0;">
      <a href="{{.URL}}" class="btn">Verify Account</a>
    </div>
  </div>
</body>
</html>`,xe=[{id:"ms",name:"Microsoft Office 365 Alert",category:"alert",status:"Published",description:"Security login email style with an urgent password update request.",sender:"Microsoft Security <security@microsoft-update.net>",subject:"Action Required: Unauthorized login attempt detected",assignedTo:"all",users:[],thumbnail:{icon:"ti-mail-opened",bg:"bg-red-500/20 text-red-500"},html:`<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #333; line-height: 1.5; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e1e1e1; }
    .blue-btn { background-color: #0067b8; color: white !important; padding: 10px 24px; text-decoration: none; font-weight: bold; border-radius: 4px; display: inline-block; }
  </style>
</head>
<body>
  <div class="container">
    <div style="font-size: 14px; font-weight: 600; color: #5e5e5e;">Microsoft Account Security</div>
    <hr style="border: 0; border-top: 1px solid #eee; margin: 15px 0;">
    <h3 style="font-size: 16px; font-weight: 600; color: #111;">Security alert</h3>
    <p>Dear {{.FirstName}},</p>
    <p>We detected unusual sign-in activity on your Microsoft 365 Account ({{.Email}}) from an unrecognized device or IP address.</p>
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
</html>`},{id:"google",name:"Google Security Notification",category:"alert",status:"Published",description:"Warns about an unknown login from a new device.",sender:"Google Security <support@google-help.com>",subject:"Security alert: Critical sign-in blocked",assignedTo:"specific",users:[2],thumbnail:{icon:"ti-shield",bg:"bg-blue-500/20 text-blue-500"},html:`<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Roboto, sans-serif; color: #333; line-height: 1.5; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e1e1e1; border-top: 4px solid #ea4335; }
    .btn { background-color: #1a73e8; color: white !important; padding: 10px 24px; text-decoration: none; font-weight: bold; border-radius: 4px; display: inline-block; }
  </style>
</head>
<body>
  <div class="container">
    <div style="font-size: 18px; font-weight: bold; margin-bottom: 20px;">
      <span style="color:#4285f4">G</span><span style="color:#ea4335">o</span><span style="color:#fbbc05">o</span><span style="color:#4285f4">g</span><span style="color:#34a853">l</span><span style="color:#ea4335">e</span>
    </div>
    <h3 style="font-size: 16px; font-weight: bold; color: #111; margin-top: 0;">Security alert: Critical Sign-in Blocked</h3>
    <p>Hello {{.FirstName}},</p>
    <p>Google blocked a critical login attempt to your Google Workspace Account ({{.Email}}).</p>
    <div style="text-align: center; margin: 25px 0;">
      <a href="{{.URL}}" class="btn">Check activity</a>
    </div>
  </div>
</body>
</html>`},{id:"hr",name:"Internal HR Payroll Info",category:"info",status:"Draft",description:"Quarterly payroll notification with a linked document.",sender:"HR Department <payroll@internal-company.id>",subject:"HR Info: Q3 Payroll Statement Update",assignedTo:"specific",users:[1,3],thumbnail:{icon:"ti-receipt",bg:"bg-emerald-500/20 text-emerald-500"},html:`<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: sans-serif; color: #444; line-height: 1.5; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; }
    .btn { background-color: #8b5cf6; color: white !important; padding: 10px 24px; text-decoration: none; font-weight: bold; border-radius: 6px; display: inline-block; }
  </style>
</head>
<body>
  <div class="container">
    <strong>Human Resources Department</strong>
    <hr style="border:0; border-top: 1px solid #eee; margin: 15px 0;">
    <p>Dear Employee {{.FirstName}},</p>
    <p>Please review the payroll details and adjustment slip for the upcoming Q3 corporate tax calculation.</p>
    <div style="text-align: center; margin: 25px 0;">
      <a href="{{.URL}}" class="btn">Check payroll statement</a>
    </div>
  </div>
</body>
</html>`},{id:"djp",name:"DJP Online Tax Warning",category:"urgent",status:"Published",description:"Urgent tax e-billing notification requiring immediate action.",sender:"DJP Online <e-filing@pajak.go.id>",subject:"Notification: 2024 Tax Arrears Warning",assignedTo:"all",users:[],thumbnail:{icon:"ti-alert-triangle",bg:"bg-yellow-500/20 text-yellow-500"},html:`<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: sans-serif; color: #333; line-height: 1.5; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; }
    .btn { background-color: #eab308; color: #0b172a !important; padding: 10px 24px; text-decoration: none; font-weight: bold; border-radius: 4px; display: inline-block; }
  </style>
</head>
<body>
  <div class="container">
    <strong>DIREKTORAT JENDERAL PAJAK</strong>
    <hr style="border:0; border-top: 1px solid #eee; margin: 15px 0;">
    <p>Dear {{.FirstName}},</p>
    <p>This electronic notice is issued because an annual tax arrears verification is pending.</p>
    <div style="text-align: center; margin: 25px 0;">
      <a href="{{.URL}}" class="btn">PAY E-BILLING</a>
    </div>
  </div>
</body>
</html>`}];function pe(s){return{id:Number(s.id),name:s.display_name||s.name||s.email||`User ${s.id}`,email:s.email||"",role:se(s.pukat_role??s.role)}}function ge({status:s}){const o=s==="Published";return e.jsx(W,{tone:o?"success":"warning",className:"text-[10px]",children:s})}function he({templates:s,usersById:o,onEdit:c,onPreview:m,onAssign:x}){return e.jsx("div",{className:"overflow-hidden rounded-xl border border-gray-200 bg-white",children:e.jsx("div",{className:"overflow-x-auto",children:e.jsxs("table",{className:"w-full border-collapse text-left text-xs",children:[e.jsx("thead",{children:e.jsxs("tr",{className:"border-b border-gray-100 bg-gray-50 text-[10px] font-semibold uppercase tracking-wider text-gray-500",children:[e.jsx("th",{className:"p-4",children:"Email template"}),e.jsx("th",{className:"p-4",children:"Category"}),e.jsx("th",{className:"p-4",children:"Sender"}),e.jsx("th",{className:"p-4",children:"Subject"}),e.jsx("th",{className:"p-4",children:"Status"}),e.jsx("th",{className:"p-4",children:"Assignment"}),e.jsx("th",{className:"w-32 p-4 pr-6 text-right",children:"Actions"})]})}),e.jsxs("tbody",{className:"divide-y divide-gray-100",children:[s.map(l=>{var p,g;return e.jsxs("tr",{className:"transition-colors hover:bg-gray-50/70",children:[e.jsx("td",{className:"p-4",children:e.jsxs("div",{className:"flex items-center gap-3",children:[e.jsx("span",{className:U("flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-sm",((p=l.thumbnail)==null?void 0:p.bg)||"bg-violet-100 text-violet-700"),children:e.jsx("i",{className:U("ti",((g=l.thumbnail)==null?void 0:g.icon)||"ti-mail")})}),e.jsxs("div",{className:"min-w-0",children:[e.jsx("div",{className:"font-semibold text-gray-900",children:l.name}),e.jsx("div",{className:"mt-0.5 max-w-xs truncate text-[11px] text-gray-500",children:l.description||l.id})]})]})}),e.jsx("td",{className:"p-4",children:e.jsx(W,{tone:"gray",className:"text-[10px] capitalize",children:l.category.replace("-"," ")})}),e.jsx("td",{className:"p-4",children:e.jsx("span",{className:"block max-w-[180px] truncate text-[11px] font-medium text-gray-700",children:l.sender})}),e.jsx("td",{className:"p-4",children:e.jsx("span",{className:"block max-w-[220px] truncate text-[11px] text-gray-500",children:l.subject})}),e.jsx("td",{className:"p-4",children:e.jsx(ge,{status:l.status})}),e.jsx("td",{className:"p-4",children:e.jsx(re,{item:l,usersById:o})}),e.jsx("td",{className:"w-32 p-4 pr-6 text-right",children:e.jsxs("div",{className:"inline-flex items-center gap-1.5",children:[e.jsx(F,{icon:"ti-edit",label:`Edit ${l.name}`,title:"Edit",onClick:()=>c(l.id)}),e.jsx(F,{icon:"ti-eye",label:`Preview ${l.name}`,title:"Preview",tone:"blue",onClick:()=>m(l.id)}),e.jsx(F,{icon:"ti-user-check",label:`Assign ${l.name}`,title:"Assign",onClick:()=>x(l.id)})]})})]},l.id)}),s.length===0&&e.jsx("tr",{children:e.jsx("td",{colSpan:7,className:"p-8 text-center text-sm text-gray-400",children:"No email templates found."})})]})]})})})}function ue(){return e.jsxs("div",{className:"space-y-2 py-12 text-center text-gray-400",children:[e.jsx("i",{className:"ti ti-mail-opened text-3xl"}),e.jsx("p",{className:"text-xs font-medium",children:"Select a template from the list or open the editor to preview an email."})]})}function be({editingName:s,name:o,setName:c,category:m,setCategory:x,status:l,setStatus:p,sender:g,setSender:C,subject:v,setSubject:D,htmlCode:T,setHtmlCode:u,onBack:N,onSave:d}){const b=s?`Edit template: ${s}`:"Create email template";return e.jsxs("div",{className:"space-y-6 animate-fade-in",children:[e.jsxs("div",{className:"flex items-center justify-between",children:[e.jsxs("div",{children:[e.jsx("h2",{className:"text-lg font-bold text-gray-900",children:b}),e.jsx("p",{className:"mt-0.5 text-xs text-gray-500",children:"Configure the envelope header and phishing email HTML source."})]}),e.jsxs("div",{className:"flex items-center gap-3",children:[e.jsx(S,{variant:"outline",onClick:N,children:"Cancel"}),e.jsx(S,{variant:"primary",onClick:d,children:"Save template"})]})]}),e.jsxs("div",{className:"grid grid-cols-1 gap-6 lg:grid-cols-5",children:[e.jsxs("div",{className:"space-y-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm lg:col-span-2",children:[e.jsx("h3",{className:"border-b border-gray-100 pb-2 text-sm font-semibold text-gray-900",children:"Envelope headers"}),e.jsxs("div",{className:"space-y-3 text-xs",children:[e.jsxs("label",{className:"block space-y-1",children:[e.jsx("span",{className:"block font-semibold text-gray-700",children:"Template name *"}),e.jsx("input",{value:o,onChange:n=>c(n.target.value),placeholder:"Example: Microsoft O365 Alert",className:"w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-gray-950 outline-none focus:border-violet-500"})]}),e.jsxs("div",{className:"grid grid-cols-1 gap-3 sm:grid-cols-2",children:[e.jsxs("label",{className:"block space-y-1",children:[e.jsx("span",{className:"block font-semibold text-gray-700",children:"Category"}),e.jsxs("select",{value:m,onChange:n=>x(n.target.value),className:"w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-gray-950 outline-none focus:border-violet-500",children:[e.jsx("option",{value:"alert",children:"Security alert"}),e.jsx("option",{value:"info",children:"Internal info"}),e.jsx("option",{value:"urgent",children:"Urgent notification"})]})]}),e.jsxs("label",{className:"block space-y-1",children:[e.jsx("span",{className:"block font-semibold text-gray-700",children:"Status"}),e.jsxs("select",{value:l,onChange:n=>p(n.target.value),className:"w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-gray-950 outline-none focus:border-violet-500",children:[e.jsx("option",{children:"Published"}),e.jsx("option",{children:"Draft"})]})]})]}),e.jsxs("label",{className:"block space-y-1",children:[e.jsx("span",{className:"block font-semibold text-gray-700",children:"Sender *"}),e.jsx("input",{value:g,onChange:n=>C(n.target.value),placeholder:"Example: Admin <admin@company.id>",className:"w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-gray-950 outline-none focus:border-violet-500"})]}),e.jsxs("label",{className:"block space-y-1",children:[e.jsx("span",{className:"block font-semibold text-gray-700",children:"Subject *"}),e.jsx("input",{value:v,onChange:n=>D(n.target.value),placeholder:"Email subject",className:"w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-gray-950 outline-none focus:border-violet-500"})]}),e.jsxs("div",{className:"pt-2",children:[e.jsx("span",{className:"mb-1.5 block font-semibold text-gray-900",children:"Dynamic variables"}),e.jsx("p",{className:"text-[10px] leading-relaxed text-gray-400",children:"Use these GoPhish placeholders for automatic personalization:"}),e.jsx("div",{className:"mt-2 grid select-all grid-cols-2 gap-1.5 font-mono text-[9px] text-gray-600",children:["{{.FirstName}}","{{.Email}}","{{.URL}} (Phish Link)","{{.Position}}"].map(n=>e.jsx("div",{className:"rounded border border-gray-100 bg-gray-50 px-1.5 py-0.5 text-center",children:n},n))})]})]})]}),e.jsxs("div",{className:"flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm lg:col-span-3",children:[e.jsxs("div",{className:"flex items-center justify-between border-b border-gray-200 bg-gray-50 px-4 py-2 text-xs",children:[e.jsxs("div",{className:"flex items-center gap-2",children:[e.jsx("span",{className:"h-2.5 w-2.5 rounded-full bg-red-400"}),e.jsx("span",{className:"h-2.5 w-2.5 rounded-full bg-yellow-400"}),e.jsx("span",{className:"h-2.5 w-2.5 rounded-full bg-green-400"}),e.jsx("span",{className:"ml-2 font-mono text-gray-500",children:"email_source.html"})]}),e.jsxs("div",{className:"flex items-center gap-3 text-gray-500",children:[e.jsxs("span",{children:[T.split(`
`).length," lines"]}),e.jsx("span",{className:"text-gray-400",children:"HTML Source"})]})]}),e.jsx(le,{value:T,onChange:u})]})]})]})}const ye=[{key:"list",label:"Template list",icon:"ti-list"},{key:"editor",label:"Editor",icon:"ti-edit"},{key:"preview",label:"Preview",icon:"ti-eye"}];function Pe(){const[s,o]=i.useState(xe),[c,m]=i.useState("list"),[x,l]=i.useState("all"),[p,g]=i.useState(""),[C,v]=i.useState(null),[D,T]=i.useState("Microsoft Office 365 Alert"),[u,N]=i.useState(null),[d,b]=i.useState(""),[n,A]=i.useState("alert"),[E,P]=i.useState("Published"),[y,L]=i.useState(""),[f,M]=i.useState(""),[h,I]=i.useState(""),[H,z]=i.useState(!1),{data:w}=ce({per_page:100}),B=i.useMemo(()=>{var a;return((a=w==null?void 0:w.users)!=null&&a.length?w.users:ae).map(pe)},[w]),_=i.useMemo(()=>new Map(B.map(t=>[t.id,t])),[B]),G=s.find(t=>t.id===C),q=i.useMemo(()=>{let t=s;x!=="all"&&(t=t.filter(r=>r.category===x));const a=p.trim().toLowerCase();return a?t.filter(r=>r.name.toLowerCase().includes(a)||r.description.toLowerCase().includes(a)||r.sender.toLowerCase().includes(a)||r.subject.toLowerCase().includes(a)):t},[x,p,s]),Y=i.useMemo(()=>[{key:"all",label:"All",count:s.length},{key:"alert",label:"Security alert",count:s.filter(t=>t.category==="alert").length},{key:"info",label:"Internal info",count:s.filter(t=>t.category==="info").length},{key:"urgent",label:"Urgent notification",count:s.filter(t=>t.category==="urgent").length}],[s]),O=s.filter(t=>t.assignedTo==="all").length,Q=s.length-O,$=i.useCallback(()=>{N(null),b(""),A("alert"),P("Published"),L(""),M(""),I("")},[]),k=i.useCallback(t=>{m(t),t==="list"&&$()},[$]),R=i.useCallback(t=>{const a=s.find(r=>r.id===t);return a?(N(a.id),b(a.name),A(a.category||"alert"),P(a.status||"Published"),L(a.sender||""),M(a.subject||""),I(a.html||""),a):null},[s]),J=i.useCallback(t=>{R(t)&&m("editor")},[R]),K=i.useCallback(t=>{const a=R(t);a&&(T(a.name),m("preview"))},[R]),V=i.useCallback(()=>{N(null),b(""),A("alert"),P("Published"),L("Admin <admin@company.id>"),M("Action Required: Important Notification"),I(me),m("editor")},[]),X=i.useCallback(()=>{if(!d.trim()||!y.trim()||!f.trim()||!h.trim()){j.error("Template name, sender, subject, and HTML source are required.");return}if(u)o(t=>t.map(a=>a.id===u?{...a,name:d.trim(),category:n,status:E,sender:y.trim(),subject:f.trim(),html:h}:a)),j.success(`Template "${d.trim()}" saved.`);else{const t={id:`custom_${Date.now()}`,name:d.trim(),category:n,status:E,description:"Custom email template created from the master library.",sender:y.trim(),subject:f.trim(),html:h,assignedTo:"all",users:[],thumbnail:{icon:"ti-mail",bg:"bg-violet-500/20 text-violet-500"}};o(a=>[t,...a]),j.success(`Template "${t.name}" created.`)}g(""),k("list")},[n,h,u,d,y,E,f,k]),Z=i.useCallback(()=>{z(!0),j("Syncing email templates from GoPhish...",{icon:"sync"}),window.setTimeout(()=>{z(!1),j.success(`Sync complete - ${s.length} email templates`)},1200)},[s.length]);function ee(t){o(a=>a.map(r=>r.id===C?{...r,...t}:r)),j.success("Assignment updated."),v(null)}const te=t=>U("rounded-full px-4 py-1.5 text-xs font-semibold transition-all select-none",x===t?"bg-gray-950 text-white":"border border-gray-200 bg-white text-gray-600 hover:bg-gray-50");return e.jsxs("div",{className:"mt-4 space-y-6 lg:flex lg:h-[calc(100vh-110px)] lg:min-h-[720px] lg:flex-col lg:overflow-hidden animate-fade-in",children:[e.jsx(oe,{title:"Master email templates",subtitle:"Manage approved GoPhish email templates and user availability.",actions:e.jsxs(e.Fragment,{children:[e.jsxs("div",{className:"relative w-64",children:[e.jsx("span",{className:"pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400",children:e.jsx("i",{className:"ti ti-search text-base"})}),e.jsx("input",{type:"text",value:p,onChange:t=>g(t.target.value),placeholder:"Search templates...",className:"w-full rounded-xl border border-gray-200 bg-white py-2 pl-9 pr-4 text-sm text-gray-950 outline-none placeholder:text-gray-400 focus:border-violet-500"})]}),e.jsxs(S,{variant:"outline",onClick:Z,disabled:H,children:[e.jsx("i",{className:U("ti ti-refresh text-base",H&&"animate-spin")}),e.jsx("span",{children:"Sync GoPhish"})]}),e.jsxs(S,{variant:"primary",onClick:V,children:[e.jsx("i",{className:"ti ti-plus text-base"}),e.jsx("span",{children:"Create email template"})]})]})}),e.jsxs("div",{className:"grid grid-cols-1 gap-4 md:grid-cols-3",children:[e.jsxs("div",{className:"flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm",children:[e.jsx("div",{className:"flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700",children:e.jsx("i",{className:"ti ti-mail text-xl"})}),e.jsxs("div",{children:[e.jsx("div",{className:"text-2xl font-bold text-gray-900",children:s.length}),e.jsx("div",{className:"text-xs font-semibold text-gray-500",children:"Master assets"})]})]}),e.jsxs("div",{className:"rounded-xl border border-gray-200 bg-white p-4 shadow-sm",children:[e.jsx("div",{className:"text-2xl font-bold text-gray-900",children:O}),e.jsx("div",{className:"mt-1 text-xs font-semibold text-gray-500",children:"Available to all users"})]}),e.jsxs("div",{className:"rounded-xl border border-gray-200 bg-white p-4 shadow-sm",children:[e.jsx("div",{className:"text-2xl font-bold text-gray-900",children:Q}),e.jsx("div",{className:"mt-1 text-xs font-semibold text-gray-500",children:"Assigned to specific users"})]})]}),e.jsx(de,{items:ye,active:c,onChange:k,ariaLabel:"Email template subtabs"}),e.jsxs("div",{className:"space-y-6 overflow-y-auto pb-4",children:[c==="list"&&e.jsxs("div",{className:"space-y-6 animate-fade-in",children:[e.jsx("div",{className:"flex flex-wrap items-center gap-2",children:Y.map(t=>e.jsxs("button",{onClick:()=>l(t.key),className:te(t.key),children:[t.label," (",t.count,")"]},t.key))}),e.jsx(he,{templates:q,usersById:_,onEdit:J,onPreview:K,onAssign:v})]}),c==="editor"&&e.jsx(be,{editingName:u?d:"",name:d,setName:b,category:n,setCategory:A,status:E,setStatus:P,sender:y,setSender:L,subject:f,setSubject:M,htmlCode:h,setHtmlCode:I,onBack:()=>k("list"),onSave:X}),c==="preview"&&e.jsxs("div",{className:"space-y-6 animate-fade-in",children:[e.jsxs("div",{className:"flex items-center justify-between",children:[e.jsxs("div",{children:[e.jsx("h2",{className:"text-lg font-bold text-gray-900",children:D}),e.jsx("p",{className:"mt-0.5 text-xs text-gray-500",children:"Preview how this template appears in the target email client."})]}),e.jsx(S,{variant:"outline",onClick:()=>k("list"),children:"Back to list"})]}),e.jsx("div",{className:"flex min-h-[450px] flex-col overflow-hidden rounded-xl border border-gray-200 bg-gray-50 p-4 md:p-6",children:h?e.jsx(ne,{html:h,sender:y,subject:f,timestampLabel:"Today, 10:24 AM",recipientLabel:"{{.Email}} (Target Employee)"}):e.jsx(ue,{})})]})]}),G&&e.jsx(ie,{item:G,resourceLabel:"email template",users:B,onClose:()=>v(null),onSave:ee})]})}export{Pe as default};
