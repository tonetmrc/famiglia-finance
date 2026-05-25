import { useState, useEffect, useMemo } from "react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, ReferenceLine
} from "recharts";

// ─── THEME ───────────────────────────────────────────────────────────────────
const C = {
  bg: "#0f0f13", surface: "#16161d", card: "#1c1c26", border: "#2a2a38",
  accent: "#6c63ff", accentSoft: "#6c63ff22",
  green: "#2dd4a0", red: "#ff5e7e", yellow: "#ffd166", blue: "#4cc9f0",
  orange: "#fb923c", purple: "#a78bfa",
  text: "#e8e8f0", muted: "#7a7a9a",
};

// ─── SUPABASE ────────────────────────────────────────────────────────────────
const SUPABASE_URL = "https://xqnvjdmdlysbaonxqfcd.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhxbnZqZG1kbHlzYmFvbnhxZmNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwMDc0NzcsImV4cCI6MjA5MzU4MzQ3N30.VDZ4s42BpJC1abi8sPfw4aPVZ7D1E_OifVwu0Zttabw";

// Auth
async function signIn(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });
  const data = await res.json();
  if (data.access_token) {
    sessionStorage.setItem("ff_token", data.access_token);
    sessionStorage.setItem("ff_uid", data.user.id);
    return { ok: true };
  }
  return { ok: false, error: data.error_description || "Credenziali errate" };
}

async function signOut() {
  const token = sessionStorage.getItem("ff_token");
  await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
    method: "POST",
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}` }
  });
  sessionStorage.removeItem("ff_token");
  sessionStorage.removeItem("ff_uid");
}

function getAuthHeaders() {
  const token = sessionStorage.getItem("ff_token") || SUPABASE_KEY;
  return { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

async function loadFromSupabase() {
  const uid = sessionStorage.getItem("ff_uid");
  if (!uid) return null;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/ff_data?user_id=eq.${uid}&select=payload`, {
    headers: getAuthHeaders()
  });
  const rows = await res.json();
  if (rows?.[0]?.payload && Object.keys(rows[0].payload).length > 0) return rows[0].payload;
  return null;
}

async function saveToSupabase(data) {
  const uid = sessionStorage.getItem("ff_uid");
  if (!uid) return;
  // Upsert: aggiorna se esiste, crea se non esiste
  await fetch(`${SUPABASE_URL}/rest/v1/ff_data?user_id=eq.${uid}`, {
    method: "PATCH",
    headers: { ...getAuthHeaders(), Prefer: "return=minimal" },
    body: JSON.stringify({ payload: data, updated_at: new Date().toISOString() })
  });
}

async function initUserData(uid) {
  // Crea riga vuota per nuovo utente se non esiste
  await fetch(`${SUPABASE_URL}/rest/v1/ff_data`, {
    method: "POST",
    headers: { ...getAuthHeaders(), Prefer: "resolution=ignore-duplicates" },
    body: JSON.stringify({ user_id: uid, payload: {} })
  });
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const MONTHS_IT = ["Gen","Feb","Mar","Apr","Mag","Giu","Lug","Ago","Set","Ott","Nov","Dic"];
const CURRENT_MONTH = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`; };
const formatEuro = n => new Intl.NumberFormat("it-IT",{style:"currency",currency:"EUR"}).format(n||0);
const monthLabel = ym => { const [y,m]=ym.split("-"); return `${MONTHS_IT[parseInt(m)-1]} ${y}`; };
const uid = () => Math.random().toString(36).slice(2,10);

// ─── INITIAL STATE ───────────────────────────────────────────────────────────
const DEFAULT_CATEGORIES = [
  {id:"1",name:"Casa",icon:"🏠"},{id:"2",name:"Cibo & Spesa",icon:"🛒"},
  {id:"3",name:"Trasporti",icon:"🚗"},{id:"4",name:"Salute",icon:"💊"},
  {id:"5",name:"Svago",icon:"🎬"},{id:"6",name:"Abbigliamento",icon:"👕"},
  {id:"7",name:"Istruzione",icon:"📚"},{id:"8",name:"Ristorante & Bar",icon:"☕"},
  {id:"9",name:"Tecnologia",icon:"💻"},{id:"10",name:"Altro",icon:"📦"},
];

const initialState = {
  settings: { stipendioIO: 2000, stipendioSara: 1700, nomeIO: "Marco", nomeSara: "Sara" },
  categories: DEFAULT_CATEGORIES,
  recurring: [
    {id:"r1",name:"Netflix",amount:17.99,category:"5",type:"fixed",who:"comune",paidBy:"io",essential:false},
    {id:"r2",name:"Amazon Prime",amount:4.99,category:"5",type:"fixed",who:"comune",paidBy:"io",essential:false},
    {id:"r3",name:"SIM Telefono",amount:9.99,category:"9",type:"fixed",who:"io",paidBy:"io",essential:true},
    {id:"r4",name:"SIM Telefono Sara",amount:9.99,category:"9",type:"fixed",who:"sara",paidBy:"sara",essential:true},
    {id:"r5",name:"Retta Asilo Alessandro",amount:0,category:"7",type:"variable",who:"comune",paidBy:"io",essential:true},
    {id:"r6",name:"Bolletta Luce",amount:0,category:"1",type:"variable",who:"comune",paidBy:"io",essential:true},
    {id:"r7",name:"Disney+",amount:13.99,category:"5",type:"fixed",who:"comune",paidBy:"io",essential:false},
  ],
  expenses: [
    // ── Settembre 2025 ──
    {id:"h-sep-01",date:"2025-09-05",amount:310,category:"3",description:"Rata auto",who:"io",type:"solo-io",essential:true},
    {id:"h-sep-02",date:"2025-09-10",amount:150,category:"7",description:"Retta asilo",who:"io",type:"comune",essential:true},
    {id:"h-sep-03",date:"2025-09-12",amount:100,category:"1",description:"Bolletta luce",who:"io",type:"comune",essential:true},
    {id:"h-sep-04",date:"2025-09-14",amount:200,category:"2",description:"Spesa supermercato",who:"io",type:"comune",essential:true},
    {id:"h-sep-05",date:"2025-09-20",amount:160,category:"2",description:"Spesa supermercato",who:"sara",type:"comune",essential:true},
    {id:"h-sep-06",date:"2025-09-22",amount:130,category:"8",description:"Ristoranti/uscite",who:"io",type:"comune",essential:false},
    {id:"h-sep-07",date:"2025-09-28",amount:120,category:"10",description:"Varie settembre",who:"io",type:"comune",essential:true},
    // ── Ottobre 2025 ──
    {id:"h-oct-01",date:"2025-10-05",amount:310,category:"3",description:"Rata auto",who:"io",type:"solo-io",essential:true},
    {id:"h-oct-02",date:"2025-10-10",amount:150,category:"7",description:"Retta asilo",who:"io",type:"comune",essential:true},
    {id:"h-oct-03",date:"2025-10-12",amount:100,category:"1",description:"Bolletta luce",who:"io",type:"comune",essential:true},
    {id:"h-oct-04",date:"2025-10-14",amount:200,category:"2",description:"Spesa supermercato",who:"io",type:"comune",essential:true},
    {id:"h-oct-05",date:"2025-10-20",amount:160,category:"2",description:"Spesa supermercato",who:"sara",type:"comune",essential:true},
    {id:"h-oct-06",date:"2025-10-22",amount:180,category:"8",description:"Ristoranti/uscite",who:"sara",type:"comune",essential:false},
    {id:"h-oct-07",date:"2025-10-28",amount:250,category:"10",description:"Varie ottobre",who:"io",type:"comune",essential:true},
    // ── Novembre 2025 ──
    {id:"h-nov-01",date:"2025-11-05",amount:310,category:"3",description:"Rata auto",who:"io",type:"solo-io",essential:true},
    {id:"h-nov-02",date:"2025-11-10",amount:150,category:"7",description:"Retta asilo",who:"io",type:"comune",essential:true},
    {id:"h-nov-03",date:"2025-11-12",amount:100,category:"1",description:"Bolletta luce",who:"io",type:"comune",essential:true},
    {id:"h-nov-04",date:"2025-11-14",amount:200,category:"2",description:"Spesa supermercato",who:"io",type:"comune",essential:true},
    {id:"h-nov-05",date:"2025-11-20",amount:160,category:"2",description:"Spesa supermercato",who:"sara",type:"comune",essential:true},
    {id:"h-nov-06",date:"2025-11-24",amount:170,category:"8",description:"Ristoranti/uscite",who:"io",type:"comune",essential:false},
    {id:"h-nov-07",date:"2025-11-28",amount:220,category:"10",description:"Varie novembre",who:"io",type:"comune",essential:true},
    // ── Dicembre 2025 ──
    {id:"h-dec-01",date:"2025-12-05",amount:310,category:"3",description:"Rata auto",who:"io",type:"solo-io",essential:true},
    {id:"h-dec-02",date:"2025-12-12",amount:100,category:"1",description:"Bolletta luce",who:"io",type:"comune",essential:true},
    {id:"h-dec-03",date:"2025-12-14",amount:200,category:"2",description:"Spesa supermercato",who:"io",type:"comune",essential:true},
    {id:"h-dec-04",date:"2025-12-18",amount:160,category:"2",description:"Spesa supermercato",who:"sara",type:"comune",essential:true},
    {id:"h-dec-05",date:"2025-12-20",amount:350,category:"5",description:"Regali Natale",who:"io",type:"comune",essential:false},
    {id:"h-dec-06",date:"2025-12-22",amount:220,category:"8",description:"Cene natalizie",who:"io",type:"comune",essential:false},
    {id:"h-dec-07",date:"2025-12-28",amount:180,category:"10",description:"Varie dicembre",who:"sara",type:"comune",essential:true},
    // ── Gennaio 2026 ──
    {id:"h-jan-01",date:"2026-01-05",amount:310,category:"3",description:"Rata auto",who:"io",type:"solo-io",essential:true},
    {id:"h-jan-02",date:"2026-01-10",amount:150,category:"7",description:"Retta asilo",who:"io",type:"comune",essential:true},
    {id:"h-jan-03",date:"2026-01-12",amount:100,category:"1",description:"Bolletta luce",who:"io",type:"comune",essential:true},
    {id:"h-jan-04",date:"2026-01-14",amount:200,category:"2",description:"Spesa supermercato",who:"io",type:"comune",essential:true},
    {id:"h-jan-05",date:"2026-01-20",amount:160,category:"2",description:"Spesa supermercato",who:"sara",type:"comune",essential:true},
    {id:"h-jan-06",date:"2026-01-22",amount:200,category:"8",description:"Ristoranti/uscite",who:"io",type:"comune",essential:false},
    {id:"h-jan-07",date:"2026-01-28",amount:350,category:"10",description:"Varie gennaio",who:"io",type:"comune",essential:true},
    // ── Febbraio 2026 ──
    {id:"h-feb-01",date:"2026-02-05",amount:310,category:"3",description:"Rata auto",who:"io",type:"solo-io",essential:true},
    {id:"h-feb-02",date:"2026-02-10",amount:150,category:"7",description:"Retta asilo",who:"io",type:"comune",essential:true},
    {id:"h-feb-03",date:"2026-02-12",amount:100,category:"1",description:"Bolletta luce",who:"io",type:"comune",essential:true},
    {id:"h-feb-04",date:"2026-02-14",amount:200,category:"2",description:"Spesa supermercato",who:"io",type:"comune",essential:true},
    {id:"h-feb-05",date:"2026-02-20",amount:160,category:"2",description:"Spesa supermercato",who:"sara",type:"comune",essential:true},
    {id:"h-feb-06",date:"2026-02-22",amount:160,category:"8",description:"Ristoranti/uscite",who:"sara",type:"comune",essential:false},
    {id:"h-feb-07",date:"2026-02-28",amount:220,category:"10",description:"Varie febbraio",who:"io",type:"comune",essential:true},
    // ── Marzo 2026 ──
    {id:"h-mar-01",date:"2026-03-05",amount:310,category:"3",description:"Rata auto",who:"io",type:"solo-io",essential:true},
    {id:"h-mar-02",date:"2026-03-10",amount:150,category:"7",description:"Retta asilo",who:"io",type:"comune",essential:true},
    {id:"h-mar-03",date:"2026-03-12",amount:100,category:"1",description:"Bolletta luce",who:"io",type:"comune",essential:true},
    {id:"h-mar-04",date:"2026-03-14",amount:200,category:"2",description:"Spesa supermercato",who:"io",type:"comune",essential:true},
    {id:"h-mar-05",date:"2026-03-20",amount:160,category:"2",description:"Spesa supermercato",who:"sara",type:"comune",essential:true},
    {id:"h-mar-06",date:"2026-03-22",amount:130,category:"8",description:"Ristoranti/uscite",who:"io",type:"comune",essential:false},
    {id:"h-mar-07",date:"2026-03-28",amount:160,category:"10",description:"Varie marzo",who:"io",type:"comune",essential:true},
    // ── Aprile 2026 ──
    {id:"h-apr-01",date:"2026-04-05",amount:310,category:"3",description:"Rata auto",who:"io",type:"solo-io",essential:true},
    {id:"h-apr-02",date:"2026-04-10",amount:150,category:"7",description:"Retta asilo",who:"io",type:"comune",essential:true},
    {id:"h-apr-03",date:"2026-04-12",amount:100,category:"1",description:"Bolletta luce",who:"io",type:"comune",essential:true},
    {id:"h-apr-04",date:"2026-04-14",amount:200,category:"2",description:"Spesa supermercato",who:"io",type:"comune",essential:true},
    {id:"h-apr-05",date:"2026-04-20",amount:160,category:"2",description:"Spesa supermercato",who:"sara",type:"comune",essential:true},
    {id:"h-apr-06",date:"2026-04-22",amount:110,category:"8",description:"Ristoranti/uscite",who:"sara",type:"comune",essential:false},
    {id:"h-apr-07",date:"2026-04-28",amount:110,category:"10",description:"Varie aprile",who:"io",type:"comune",essential:true},
  ],
  incomes: {
    "2025-09":{stipendioIO:2500,stipendioSara:1800,extraIO:[],extraSara:[]},
    "2025-10":{stipendioIO:2500,stipendioSara:1800,extraIO:[{id:"hx-oct1",description:"Entrate extra",amount:1042}],extraSara:[]},
    "2025-11":{stipendioIO:2500,stipendioSara:1800,extraIO:[],extraSara:[]},
    "2025-12":{stipendioIO:2500,stipendioSara:1800,extraIO:[{id:"hx-dec1",description:"13esima",amount:2500}],extraSara:[{id:"hx-dec2",description:"13esima",amount:815}]},
    "2026-01":{stipendioIO:2600,stipendioSara:1900,extraIO:[],extraSara:[]},
    "2026-02":{stipendioIO:2600,stipendioSara:1900,extraIO:[],extraSara:[]},
    "2026-03":{stipendioIO:2600,stipendioSara:1900,extraIO:[],extraSara:[]},
    "2026-04":{stipendioIO:2600,stipendioSara:1900,extraIO:[],extraSara:[]},
    "2026-05":{stipendioIO:2600,stipendioSara:1900,extraIO:[],extraSara:[]},
  },
  recurringValues: {
    "2025-09":{r5:150,r6:100},"2025-10":{r5:150,r6:100},"2025-11":{r5:150,r6:100},
    "2025-12":{r5:0,r6:100},"2026-01":{r5:150,r6:100},"2026-02":{r5:150,r6:100},
    "2026-03":{r5:150,r6:100},"2026-04":{r5:150,r6:100},"2026-05":{r5:150,r6:100},
  },
  carryover: {
    "2025-09":1371,"2025-10":2928,"2025-11":5111,"2025-12":6722,
    "2026-01":11848,"2026-02":13378,"2026-03":14011,"2026-04":15278,"2026-05":17178,
  },
  investments: [
    {id:"inv1",name:"Moneyfarm",owner:"io",monthlyContrib:350,currentValue:4820,lastUpdated:"2026-05-01",history:[]},
    {id:"inv2",name:"Piano Pensione",owner:"io",monthlyContrib:100,currentValue:1240,lastUpdated:"2026-05-01",history:[]},
    {id:"inv3",name:"PAC Alessandro",owner:"aggregato",monthlyContrib:100,currentValue:680,lastUpdated:"2026-05-01",note:"Tu €50 + Sara €50",history:[]},
    {id:"inv4",name:"PAC Gabriele",owner:"aggregato",monthlyContrib:100,currentValue:540,lastUpdated:"2026-05-01",note:"Tu €50 + Sara €50",history:[]},
    {id:"inv5",name:"Piano Pensione",owner:"sara",monthlyContrib:100,currentValue:890,lastUpdated:"2026-05-01",history:[]},
  ],
  settlements: [],
  realHistory: [
    {month:"2025-09",label:"Set 2025",shortLabel:"Set",base:1371,entrate:4088,uscite:2532},
    {month:"2025-10",label:"Ott 2025",shortLabel:"Ott",base:2928,entrate:5342,uscite:3158},
    {month:"2025-11",label:"Nov 2025",shortLabel:"Nov",base:5111,entrate:5160,uscite:3549},
    {month:"2025-12",label:"Dic 2025",shortLabel:"Dic",base:6722,entrate:8015,uscite:2888},
    {month:"2026-01",label:"Gen 2026",shortLabel:"Gen",base:11848,entrate:5897,uscite:4366},
    {month:"2026-02",label:"Feb 2026",shortLabel:"Feb",base:13378,entrate:4629,uscite:3996},
    {month:"2026-03",label:"Mar 2026",shortLabel:"Mar",base:14011,entrate:4344,uscite:3076},
    {month:"2026-04",label:"Apr 2026",shortLabel:"Apr",base:15278,entrate:4576,uscite:2675},
    {month:"2026-05",label:"Mag 2026",shortLabel:"Mag",base:17178,entrate:null,uscite:null},
  ],
};

// ─── LOGIN ───────────────────────────────────────────────────────────────────
function LockScreen({ onUnlock }) {
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);

  const tryLogin = async () => {
    if (!email || !pwd) return;
    setLoading(true);
    setError("");
    const result = await signIn(email, pwd);
    if (result.ok) {
      await initUserData(sessionStorage.getItem("ff_uid"));
      onUnlock();
    } else {
      setError(result.error);
      setShake(true);
      setPwd("");
      setTimeout(()=>setShake(false), 500);
    }
    setLoading(false);
  };

  return (
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:24,padding:40,width:"100%",maxWidth:360,textAlign:"center",animation:shake?"shake 0.4s ease":"none"}}>
        <div style={{fontSize:48,marginBottom:16}}>💼</div>
        <div style={{fontSize:22,fontWeight:700,marginBottom:6,color:C.text}}>FamilyFinance</div>
        <div style={{fontSize:14,color:C.muted,marginBottom:32}}>Accedi con la tua email</div>
        <input type="email" value={email} onChange={e=>{setEmail(e.target.value);setError("");}}
          onKeyDown={e=>e.key==="Enter"&&tryLogin()}
          placeholder="Email" autoFocus
          style={{width:"100%",background:C.surface,border:`1px solid ${error?C.red:C.border}`,borderRadius:12,padding:"12px 16px",color:C.text,fontSize:15,outline:"none",boxSizing:"border-box",marginBottom:10}}/>
        <input type="password" value={pwd} onChange={e=>{setPwd(e.target.value);setError("");}}
          onKeyDown={e=>e.key==="Enter"&&tryLogin()}
          placeholder="Password"
          style={{width:"100%",background:C.surface,border:`1px solid ${error?C.red:C.border}`,borderRadius:12,padding:"12px 16px",color:C.text,fontSize:15,outline:"none",boxSizing:"border-box",marginBottom:8}}/>
        {error && <div style={{color:C.red,fontSize:13,marginBottom:12}}>{error}</div>}
        {!error && <div style={{marginBottom:12}}/>}
        <button onClick={tryLogin} disabled={loading} style={{width:"100%",background:C.accent,color:"#fff",border:"none",borderRadius:12,padding:"13px",fontSize:15,fontWeight:700,cursor:"pointer",opacity:loading?0.7:1}}>
          {loading?"Accesso in corso...":"Accedi"}
        </button>
      </div>
      <style>{`@keyframes shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-10px)}40%{transform:translateX(10px)}60%{transform:translateX(-8px)}80%{transform:translateX(8px)}}`}</style>
    </div>
  );
}

// ─── UI COMPONENTS ───────────────────────────────────────────────────────────
function Badge({children,color=C.accent}){return <span style={{background:color+"22",color,border:`1px solid ${color}44`,borderRadius:6,padding:"2px 8px",fontSize:11,fontWeight:600,whiteSpace:"nowrap"}}>{children}</span>;}
function Card({children,style}){return <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:16,padding:20,...style}}>{children}</div>;}
function Modal({open,onClose,title,children}){
  if(!open)return null;
  return <div style={{position:"fixed",inset:0,background:"#000000bb",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:16}} onClick={onClose}>
    <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:20,padding:28,width:"100%",maxWidth:480,maxHeight:"90vh",overflowY:"auto"}} onClick={e=>e.stopPropagation()}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
        <h3 style={{margin:0,fontSize:18,color:C.text}}>{title}</h3>
        <button onClick={onClose} style={{background:"none",border:"none",color:C.muted,fontSize:22,cursor:"pointer"}}>×</button>
      </div>
      {children}
    </div>
  </div>;
}
function Input({label,...props}){return <div style={{marginBottom:14}}>{label&&<label style={{display:"block",fontSize:12,color:C.muted,marginBottom:5,fontWeight:600,letterSpacing:0.5}}>{label}</label>}<input {...props} style={{width:"100%",background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:"10px 14px",color:C.text,fontSize:14,outline:"none",boxSizing:"border-box",...props.style}}/></div>;}
function Select({label,children,...props}){return <div style={{marginBottom:14}}>{label&&<label style={{display:"block",fontSize:12,color:C.muted,marginBottom:5,fontWeight:600,letterSpacing:0.5}}>{label}</label>}<select {...props} style={{width:"100%",background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:"10px 14px",color:C.text,fontSize:14,outline:"none",boxSizing:"border-box",...props.style}}>{children}</select></div>;}
function Btn({children,onClick,variant="primary",small,style}){const bg=variant==="primary"?C.accent:variant==="danger"?C.red:C.border;return <button onClick={onClick} style={{background:bg,color:"#fff",border:"none",borderRadius:10,padding:small?"7px 14px":"11px 22px",fontSize:small?12:14,fontWeight:600,cursor:"pointer",transition:"opacity .15s",...style}} onMouseEnter={e=>e.currentTarget.style.opacity="0.85"} onMouseLeave={e=>e.currentTarget.style.opacity="1"}>{children}</button>;}

// ─── NAV ─────────────────────────────────────────────────────────────────────
const NAV = [
  {id:"dashboard",label:"Dashboard",icon:"📊"},{id:"expenses",label:"Spese",icon:"💸"},
  {id:"incomes",label:"Entrate",icon:"💰"},{id:"recurring",label:"Ricorrenti",icon:"🔄"},
  {id:"investments",label:"Investimenti",icon:"📈"},{id:"split",label:"Divisione",icon:"⚖️"},
  {id:"report",label:"Report",icon:"📋"},{id:"settings",label:"Impostazioni",icon:"⚙️"},
];

// ─── COMPUTE MONTH ───────────────────────────────────────────────────────────
function computeMonth(data, m) {
  const income = data.incomes[m] || {stipendioIO:0,stipendioSara:0,extraIO:[],extraSara:[]};
  const totalIO = income.stipendioIO + (income.extraIO||[]).reduce((s,x)=>s+x.amount,0);
  const totalSara = income.stipendioSara + (income.extraSara||[]).reduce((s,x)=>s+x.amount,0);
  const totalIncome = totalIO + totalSara;
  const monthExpenses = data.expenses.filter(e=>e.date.startsWith(m));
  const rValues = data.recurringValues[m]||{};
  const recurringThisMonth = data.recurring.map(r=>({...r,effectiveAmount:r.type==="variable"?(rValues[r.id]||0):r.amount}));
  const totalRecurring = recurringThisMonth.reduce((s,r)=>s+r.effectiveAmount,0);
  const totalExpenses = monthExpenses.reduce((s,e)=>s+e.amount,0) + totalRecurring;
  const totalInvestments = data.investments.reduce((s,i)=>s+i.monthlyContrib,0);
  const carryover = data.carryover[m]||0;
  const residuo = totalIncome + carryover - totalExpenses - totalInvestments;
  const avoidable = monthExpenses.filter(e=>!e.essential).reduce((s,e)=>s+e.amount,0)
    + recurringThisMonth.filter(r=>!r.essential).reduce((s,r)=>s+r.effectiveAmount,0);
  const flussoNetto = totalIncome - totalExpenses; // entrate - uscite del mese, senza carryover
  const savingsRate = totalIncome > 0 ? ((totalInvestments + Math.max(0,flussoNetto)) / totalIncome) * 100 : 0;
  return {income,totalIO,totalSara,totalIncome,monthExpenses,recurringThisMonth,totalRecurring,totalExpenses,totalInvestments,carryover,residuo,avoidable,savingsRate};
}

// ─── MAIN APP ────────────────────────────────────────────────────────────────
export default function App() {
  const [unlocked, setUnlocked] = useState(()=>!!sessionStorage.getItem("ff_token"));
  const [data, setData] = useState(()=>{try{const s=localStorage.getItem("famiglia_finance_v1");return s?JSON.parse(s):initialState;}catch{return initialState;}});
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState(null);
  const [tab, setTab] = useState("dashboard");
  const [selectedMonth, setSelectedMonth] = useState(CURRENT_MONTH());
  const [navOpen, setNavOpen] = useState(false);

  useEffect(()=>{
    if(!unlocked)return;
    setSyncing(true);
    loadFromSupabase().then(remote=>{
      if(remote){setData(remote);localStorage.setItem("famiglia_finance_v1",JSON.stringify(remote));}
      setSyncing(false);setSyncStatus("ok");
    }).catch(()=>{setSyncing(false);setSyncStatus("error");});
  },[unlocked]);

  useEffect(()=>{
    if(!unlocked)return;
    localStorage.setItem("famiglia_finance_v1",JSON.stringify(data));
    const t=setTimeout(()=>{saveToSupabase(data).then(()=>setSyncStatus("ok")).catch(()=>setSyncStatus("error"));},1200);
    return()=>clearTimeout(t);
  },[data,unlocked]);

  const update = fn => setData(d=>({...fn(d)}));

  const monthData = useMemo(()=>computeMonth(data,selectedMonth),[data,selectedMonth]);

  const nomeIO = data.settings?.nomeIO || "Marco";
  const nomeSara = data.settings?.nomeSara || "Sara";
  const splitData = useMemo(()=>{
    const {totalIO,totalSara,monthExpenses,recurringThisMonth} = monthData;
    const totale = totalIO+totalSara;
    const pctIO = totale>0?totalIO/totale:0.5;
    const pctSara = totale>0?totalSara/totale:0.5;
    const comuneOneOff = monthExpenses.filter(e=>e.type==="comune").map(e=>({...e,payer:e.who}));
    const comuneRecurring = recurringThisMonth.filter(r=>r.who==="comune").map(r=>({...r,amount:r.effectiveAmount,payer:r.paidBy||"io"}));
    const allComune = [...comuneOneOff,...comuneRecurring];
    const totaleComune = allComune.reduce((s,e)=>s+e.amount,0);
    const deveIO = totaleComune*pctIO, deveSara = totaleComune*pctSara;
    const pagatoIO = allComune.filter(e=>e.payer==="io").reduce((s,e)=>s+e.amount,0);
    const pagatoSara = allComune.filter(e=>e.payer==="sara").reduce((s,e)=>s+e.amount,0);

    // Spese al 100%: "per Sara pago io" → credito diretto per io (non divise %)
    const creditoIO = monthExpenses.filter(e=>e.type==="per-sara"&&e.who==="io").reduce((s,e)=>s+e.amount,0);
    // "per me paga Sara" → credito diretto per Sara (non divise %)
    const creditoSara = monthExpenses.filter(e=>e.type==="per-io"&&e.who==="sara").reduce((s,e)=>s+e.amount,0);

    // diffIO > 0 = io ho pagato più della mia quota (Sara mi deve)
    // diffIO < 0 = io ho pagato meno della mia quota (io devo a Sara)
    const diffIO = (pagatoIO - deveIO) + creditoIO - creditoSara;
    const diffSara = (pagatoSara - deveSara) + creditoSara - creditoIO;
    const settlements = data.settlements||[];
    const settlTotal = settlements.reduce((s,p)=>p.payer==="sara"?s+p.amount:p.payer==="io"?s-p.amount:s,0);
    const netBalance = diffIO-settlTotal;
    const messaggio = Math.abs(diffIO)<0.5?"✅ Siete in pari!":diffIO>0?`${nomeSara} deve dare ${formatEuro(Math.abs(diffIO))} a ${nomeIO}`:`${nomeIO} deve dare ${formatEuro(Math.abs(diffIO))} a ${nomeSara}`;
    const netMsg = Math.abs(netBalance)<0.5?"✅ Conti completamente in pari!":netBalance>0?`${nomeSara} ti deve ancora ${formatEuro(Math.abs(netBalance))}`:`${nomeIO} deve ancora ${formatEuro(Math.abs(netBalance))} a ${nomeSara}`;
    return {pctIO,pctSara,totaleComune,deveIO,deveSara,pagatoIO,pagatoSara,diffIO,diffSara,messaggio,netBalance,netMsg,settlTotal,settlements};
  },[monthData,data.settlements]);

  const allMonths = useMemo(()=>{
    const months=new Set([CURRENT_MONTH()]);
    data.expenses.forEach(e=>months.add(e.date.slice(0,7)));
    Object.keys(data.incomes).forEach(m=>months.add(m));
    Object.keys(data.carryover).forEach(m=>months.add(m));
    return Array.from(months).sort().reverse();
  },[data]);

  // ─── RENDER ──────────────────────────────────────────────────────────────
  if(!unlocked) return <LockScreen onUnlock={()=>setUnlocked(true)}/>;
  return (
    <div style={{background:C.bg,minHeight:"100vh",color:C.text,fontFamily:"'DM Sans','Segoe UI',sans-serif"}}>
      {/* Top bar */}
      <div style={{background:C.surface,borderBottom:`1px solid ${C.border}`,padding:"0 20px",display:"flex",alignItems:"center",justifyContent:"space-between",height:56,position:"sticky",top:0,zIndex:100}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <button onClick={()=>setNavOpen(!navOpen)} style={{background:"none",border:"none",color:C.text,fontSize:20,cursor:"pointer"}}>☰</button>
          <span style={{fontWeight:700,fontSize:16,letterSpacing:-0.5}}>💼 FamilyFinance</span>
          {syncing&&<span style={{fontSize:11,color:C.muted}}>⏳</span>}
          {!syncing&&syncStatus==="ok"&&<span style={{fontSize:11,color:C.green}}>☁️</span>}
          {!syncing&&syncStatus==="error"&&<span style={{fontSize:11,color:C.red}}>⚠️</span>}
          <button onClick={async()=>{await signOut();setUnlocked(false);}} style={{background:"none",border:`1px solid ${C.border}`,color:C.muted,borderRadius:8,padding:"3px 10px",fontSize:11,cursor:"pointer",marginLeft:4}}>Esci</button>
        </div>
        <select value={selectedMonth} onChange={e=>setSelectedMonth(e.target.value)}
          style={{background:C.card,border:`1px solid ${C.border}`,color:C.text,borderRadius:8,padding:"5px 10px",fontSize:13}}>
          {allMonths.map(m=><option key={m} value={m}>{monthLabel(m)}</option>)}
        </select>
      </div>
      {/* Side nav */}
      {navOpen&&<div style={{position:"fixed",inset:0,zIndex:200}}>
        <div style={{position:"absolute",inset:0,background:"#000000aa"}} onClick={()=>setNavOpen(false)}/>
        <div style={{position:"absolute",left:0,top:0,bottom:0,width:240,background:C.surface,borderRight:`1px solid ${C.border}`,padding:20}}>
          <div style={{fontWeight:700,fontSize:16,marginBottom:24}}>💼 FamilyFinance</div>
          {NAV.map(n=><button key={n.id} onClick={()=>{setTab(n.id);setNavOpen(false);}} style={{display:"flex",alignItems:"center",gap:12,width:"100%",background:tab===n.id?C.accentSoft:"none",border:"none",color:tab===n.id?C.accent:C.text,borderRadius:10,padding:"11px 14px",fontSize:14,cursor:"pointer",marginBottom:4,fontWeight:tab===n.id?600:400,textAlign:"left"}}><span>{n.icon}</span>{n.label}</button>)}
        </div>
      </div>}
      {/* Content */}
      <div style={{padding:"20px 16px",maxWidth:920,margin:"0 auto"}}>
        {tab==="dashboard"&&<Dashboard data={data} monthData={monthData} splitData={splitData} selectedMonth={selectedMonth} allMonths={allMonths}/>}
        {tab==="expenses"&&<Expenses data={data} update={update} selectedMonth={selectedMonth} monthData={monthData}/>}
        {tab==="incomes"&&<Incomes data={data} update={update} selectedMonth={selectedMonth} monthData={monthData}/>}
        {tab==="recurring"&&<Recurring data={data} update={update} selectedMonth={selectedMonth} monthData={monthData}/>}
        {tab==="investments"&&<Investments data={data} update={update} allMonths={allMonths}/>}
        {tab==="split"&&<Split splitData={splitData} monthData={monthData} selectedMonth={selectedMonth} data={data} update={update}/>}
        {tab==="report"&&<Report data={data} allMonths={allMonths}/>}
        {tab==="settings"&&<Settings data={data} update={update}/>}
      </div>
    </div>
  );
}

// ─── DASHBOARD ───────────────────────────────────────────────────────────────
function Dashboard({data,monthData,splitData,selectedMonth,allMonths}){
  const {totalIncome,totalExpenses,totalInvestments,residuo,avoidable,carryover,savingsRate} = monthData;

  // Medie ultimi 6 mesi (escluso mese corrente)
  const pastMonths = allMonths.filter(m=>m<selectedMonth).slice(0,6);
  const avg = pastMonths.length>0 ? pastMonths.reduce((acc,m)=>{
    const md = computeMonth(data,m);
    return {entrate:acc.entrate+md.totalIncome, uscite:acc.uscite+md.totalExpenses, residuo:acc.residuo+md.residuo, evitabili:acc.evitabili+md.avoidable};
  },{entrate:0,uscite:0,residuo:0,evitabili:0}) : null;
  const avgN = pastMonths.length||1;
  const avgEntrate = avg?(avg.entrate/avgN):0;
  const avgUscite = avg?(avg.uscite/avgN):0;
  const avgEvitabili = avg?(avg.evitabili/avgN):0;
  const alertEvitabili = avg && avoidable > avgEvitabili*1.15;

  // Proiezione fine anno — usa REAL_HISTORY per gli ultimi 3 mesi disponibili
  const curMonthNum = parseInt(selectedMonth.split("-")[1]);
  const monthsLeft = 12-curMonthNum;
  const realHistory = data.realHistory || [];
  const last3Real = realHistory.filter(r=>r.month<selectedMonth&&r.entrate!==null).slice(-3);
  const projN = last3Real.length||1;
  const projAvgEntrate = last3Real.length>0 ? last3Real.reduce((s,r)=>s+r.entrate,0)/projN : 0;
  const projAvgUscite = last3Real.length>0 ? last3Real.reduce((s,r)=>s+r.uscite,0)/projN : 0;
  const totalInvestimenti = data.investments.reduce((s,i)=>s+i.monthlyContrib,0);
  const projResiduo = last3Real.length>0 ? (residuo + (projAvgEntrate - projAvgUscite - totalInvestimenti)*monthsLeft) : null;
  const proj = {entrate: projAvgEntrate, uscite: projAvgUscite};

  // Trend categorie
  const catTrend = useMemo(()=>{
    if(pastMonths.length<2) return [];
    const cur = {};
    monthData.monthExpenses.forEach(e=>{const cat=data.categories.find(c=>c.id===e.category);const n=cat?cat.name:"Altro";cur[n]=(cur[n]||0)+e.amount;});
    const past = {};
    pastMonths.forEach(m=>{data.expenses.filter(e=>e.date.startsWith(m)).forEach(e=>{const cat=data.categories.find(c=>c.id===e.category);const n=cat?cat.name:"Altro";past[n]=(past[n]||0)+e.amount;});});
    return Object.entries(cur).map(([name,val])=>{
      const pastAvg=(past[name]||0)/pastMonths.length;
      const pct=pastAvg>0?((val-pastAvg)/pastAvg)*100:0;
      return {name,val,pct:Math.round(pct)};
    }).filter(x=>Math.abs(x.pct)>5).sort((a,b)=>Math.abs(b.pct)-Math.abs(a.pct)).slice(0,4);
  },[monthData,data,pastMonths]);

  // Chart data
  const chartMonths = allMonths.slice(0,8).reverse();
  const chartData = chartMonths.map(m=>{
    const md=computeMonth(data,m);
    return {name:monthLabel(m).slice(0,3),entrate:md.totalIncome,uscite:md.totalExpenses,residuo:md.residuo};
  });

  const PIE_COLORS=[C.accent,C.green,C.blue,C.yellow,C.red,C.orange,C.purple,"#34d399","#f59e0b"];
  const catMap={};
  monthData.monthExpenses.forEach(e=>{const cat=data.categories.find(c=>c.id===e.category);const n=cat?cat.name:"Altro";catMap[n]=(catMap[n]||0)+e.amount;});
  const pieData=Object.entries(catMap).map(([name,value])=>({name,value}));

  return (
    <div>
      <h2 style={{fontSize:22,fontWeight:700,marginBottom:20,marginTop:0}}>Dashboard — {monthLabel(selectedMonth)}</h2>

      {/* Alert evitabili */}
      {alertEvitabili&&<div style={{background:C.yellow+"22",border:`1px solid ${C.yellow}44`,borderRadius:12,padding:"12px 16px",marginBottom:16,display:"flex",gap:10,alignItems:"center"}}>
        <span style={{fontSize:18}}>⚠️</span>
        <span style={{fontSize:13,color:C.yellow}}>Le spese evitabili questo mese ({formatEuro(avoidable)}) superano la media storica ({formatEuro(avgEvitabili)})</span>
      </div>}

      {/* KPIs */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))",gap:12,marginBottom:20}}>
        {[
          {label:"Entrate mese",value:formatEuro(totalIncome),sub:carryover>0?`Base: ${formatEuro(carryover)}`:"",color:C.green},
          {label:"Uscite mese",value:formatEuro(totalExpenses),sub:`Spese + ricorrenti · media: ${formatEuro(avgUscite)}`,color:C.red},
          {label:"Entrate - Uscite",value:formatEuro(totalIncome-totalExpenses),sub:(totalIncome-totalExpenses)>=0?"Flusso positivo":"Flusso negativo",color:(totalIncome-totalExpenses)>=0?C.green:C.red},
          {label:"Investimenti",value:formatEuro(totalInvestments),sub:"Esclusi dalle uscite",color:C.blue},
          {label:"Residuo netto",value:formatEuro(residuo),sub:`Base ${formatEuro(carryover)} + entrate - uscite - invest.`,color:residuo>=0?C.green:C.red},
          {label:"Spese essenziali",value:formatEuro(totalExpenses-avoidable),sub:`Evitabili: ${formatEuro(avoidable)}${alertEvitabili?" ⚠️":""}`,color:C.blue},
          {label:"Tasso risparmio",value:`${savingsRate.toFixed(1)}%`,sub:"(Invest. + flusso netto) / entrate",color:C.purple},
        ].map(k=><Card key={k.label} style={{borderLeft:`3px solid ${k.color}`}}>
          <div style={{fontSize:11,color:C.muted,marginBottom:5,fontWeight:600,textTransform:"uppercase",letterSpacing:0.4}}>{k.label}</div>
          <div style={{fontSize:20,fontWeight:700,color:k.color}}>{k.value}</div>
          {k.sub&&<div style={{fontSize:11,color:C.muted,marginTop:3}}>{k.sub}</div>}
        </Card>)}
      </div>

      {/* Charts row */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16}}>
        <Card>
          <div style={{fontSize:13,fontWeight:600,marginBottom:14}}>Entrate vs Uscite (ultimi mesi)</div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border}/>
              <XAxis dataKey="name" tick={{fill:C.muted,fontSize:10}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fill:C.muted,fontSize:10}} axisLine={false} tickLine={false}/>
              <Tooltip contentStyle={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8}} formatter={v=>formatEuro(v)}/>
              <Bar dataKey="entrate" fill={C.green} radius={[4,4,0,0]} name="Entrate"/>
              <Bar dataKey="uscite" fill={C.red} radius={[4,4,0,0]} name="Uscite"/>
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card>
          <div style={{fontSize:13,fontWeight:600,marginBottom:14}}>Spese per categoria</div>
          {pieData.length>0?<ResponsiveContainer width="100%" height={180}>
            <PieChart><Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={3} dataKey="value">
              {pieData.map((_,i)=><Cell key={i} fill={PIE_COLORS[i%PIE_COLORS.length]}/>)}
            </Pie>
            <Tooltip contentStyle={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8}} formatter={v=>formatEuro(v)}/>
            <Legend wrapperStyle={{fontSize:10,color:C.muted}}/></PieChart>
          </ResponsiveContainer>:<div style={{color:C.muted,fontSize:13,textAlign:"center",paddingTop:60}}>Nessuna spesa</div>}
        </Card>
      </div>

      {/* Trend categorie + Proiezione */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16}}>
        <Card>
          <div style={{fontSize:13,fontWeight:600,marginBottom:12}}>📊 Trend categorie vs media</div>
          {catTrend.length===0?<div style={{fontSize:12,color:C.muted}}>Dati insufficienti</div>:
          catTrend.map(t=><div key={t.name} style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
            <span style={{flex:1,fontSize:13}}>{t.name}</span>
            <span style={{fontSize:12,fontWeight:600,color:t.pct>0?C.red:C.green}}>{t.pct>0?"+":""}{t.pct}%</span>
            <div style={{width:80,height:6,background:C.border,borderRadius:3}}>
              <div style={{width:`${Math.min(100,Math.abs(t.pct))}%`,height:"100%",background:t.pct>0?C.red:C.green,borderRadius:3}}/>
            </div>
          </div>)}
        </Card>
        <Card>
          <div style={{fontSize:13,fontWeight:600,marginBottom:12}}>🔮 Proiezione fine anno</div>
          {projResiduo!==null?<>
            <div style={{fontSize:11,color:C.muted,marginBottom:6}}>Media ultimi {projN} mesi reali · {monthsLeft} mesi rimanenti</div>
            <div style={{fontSize:22,fontWeight:700,color:projResiduo>=0?C.green:C.red}}>{formatEuro(projResiduo)}</div>
            <div style={{fontSize:11,color:C.muted,marginTop:4}}>Residuo stimato a dicembre</div>
            <div style={{marginTop:12,display:"flex",gap:12}}>
              <div><div style={{fontSize:10,color:C.muted}}>Entrate/mese stimate</div><div style={{fontSize:13,fontWeight:600,color:C.green}}>{formatEuro(proj.entrate)}</div></div>
              <div><div style={{fontSize:10,color:C.muted}}>Uscite/mese stimate</div><div style={{fontSize:13,fontWeight:600,color:C.red}}>{formatEuro(proj.uscite)}</div></div>
              <div><div style={{fontSize:10,color:C.muted}}>Invest./mese</div><div style={{fontSize:13,fontWeight:600,color:C.blue}}>{formatEuro(totalInvestimenti)}</div></div>
            </div>
          </>:<div style={{fontSize:12,color:C.muted}}>Inserisci almeno 1 mese storico</div>}
        </Card>
      </div>

      {/* Split summary */}
      <Card style={{borderLeft:`3px solid ${C.yellow}`}}>
        <div style={{fontSize:12,fontWeight:600,color:C.muted,marginBottom:6,textTransform:"uppercase",letterSpacing:0.4}}>Divisione spese comuni</div>
        <div style={{fontSize:16,fontWeight:700,color:C.yellow}}>{splitData.messaggio}</div>
        <div style={{fontSize:11,color:C.muted,marginTop:6}}>Tu: {(splitData.pctIO*100).toFixed(0)}% → quota {formatEuro(splitData.deveIO)} · pagato {formatEuro(splitData.pagatoIO)} | Sara: {(splitData.pctSara*100).toFixed(0)}% → quota {formatEuro(splitData.deveSara)} · pagato {formatEuro(splitData.pagatoSara)}</div>
      </Card>
    </div>
  );
}

// ─── EXPENSES ────────────────────────────────────────────────────────────────
function Expenses({data,update,selectedMonth,monthData}){
  const [modal,setModal]=useState(false);
  const [form,setForm]=useState({date:new Date().toISOString().slice(0,10),amount:"",category:"1",description:"",who:"io",type:"comune",essential:true});
  const save=()=>{
    if(!form.amount||!form.description)return;
    update(d=>({...d,expenses:[...d.expenses,{...form,id:uid(),amount:parseFloat(form.amount)}]}));
    setModal(false);setForm({date:new Date().toISOString().slice(0,10),amount:"",category:"1",description:"",who:"io",type:"comune",essential:true});
  };
  const del=id=>update(d=>({...d,expenses:d.expenses.filter(e=>e.id!==id)}));
  const {monthExpenses}=monthData;
  const totale=monthExpenses.reduce((s,e)=>s+e.amount,0);
  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
        <h2 style={{margin:0,fontSize:22,fontWeight:700}}>Spese — {monthLabel(selectedMonth)}</h2>
        <Btn onClick={()=>setModal(true)}>+ Aggiungi</Btn>
      </div>
      <div style={{marginBottom:12,display:"flex",gap:8,flexWrap:"wrap"}}>
        <Badge color={C.red}>Totale: {formatEuro(totale)}</Badge>
        <Badge color={C.yellow}>Evitabili: {formatEuro(monthExpenses.filter(e=>!e.essential).reduce((s,e)=>s+e.amount,0))}</Badge>
        <Badge color={C.blue}>Fondamentali: {formatEuro(monthExpenses.filter(e=>e.essential).reduce((s,e)=>s+e.amount,0))}</Badge>
      </div>
      {monthExpenses.length===0&&<Card><div style={{color:C.muted,textAlign:"center",padding:30}}>Nessuna spesa questo mese</div></Card>}
      {[...monthExpenses].sort((a,b)=>b.date.localeCompare(a.date)).map(e=>{
        const cat=data.categories.find(c=>c.id===e.category);
        return <Card key={e.id} style={{marginBottom:10,display:"flex",alignItems:"center",gap:12}}>
          <span style={{fontSize:22}}>{cat?.icon||"📦"}</span>
          <div style={{flex:1}}>
            <div style={{fontWeight:600,fontSize:14}}>{e.description}</div>
            <div style={{fontSize:12,color:C.muted,marginTop:3,display:"flex",gap:8,flexWrap:"wrap"}}>
              <span>{e.date}</span>
              <Badge color={e.who==="io"?C.blue:C.accent}>{e.who==="io"?(data.settings?.nomeIO||"Marco"):(data.settings?.nomeSara||"Sara")}</Badge>
              <Badge color={e.type==="comune"?C.green:e.type==="per-sara"||e.type==="per-io"?C.orange:C.blue}>{e.type==="comune"?"Comune":e.type==="solo-io"?"Solo tu":e.type==="solo-sara"?"Solo Sara":e.type==="per-sara"?"Per Sara":"Per me"}</Badge>
              {!e.essential&&<Badge color={C.yellow}>Evitabile</Badge>}
            </div>
          </div>
          <div style={{fontWeight:700,fontSize:16,color:C.red}}>{formatEuro(e.amount)}</div>
          <button onClick={()=>del(e.id)} style={{background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:16}}>🗑</button>
        </Card>;
      })}
      <Modal open={modal} onClose={()=>setModal(false)} title="Nuova spesa">
        <Input label="Data" type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))}/>
        <Input label="Importo (€)" type="number" step="0.01" placeholder="0.00" value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))}/>
        <Input label="Descrizione" placeholder="es. Spesa Esselunga" value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))}/>
        <Select label="Categoria" value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))}>
          {data.categories.map(c=><option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
        </Select>
        <Select label="Chi ha pagato?" value={form.who} onChange={e=>setForm(f=>({...f,who:e.target.value}))}>
          <option value="io">Tu</option><option value="sara">Sara</option>
        </Select>
        <Select label="Tipo spesa" value={form.type} onChange={e=>{
          const t=e.target.value;
          setForm(f=>({...f,type:t,who:t==="per-sara"?"io":t==="per-io"?"sara":f.who}));
        }}>
          <option value="comune">Comune (da dividere)</option>
          <option value="solo-io">Solo tua</option>
          <option value="solo-sara">Solo di Sara</option>
          <option value="per-sara">Per Sara (pago io → lei mi deve)</option>
          <option value="per-io">Per me (paga Sara → io le devo)</option>
        </Select>
        <Select label="Fondamentale o evitabile?" value={form.essential?"yes":"no"} onChange={e=>setForm(f=>({...f,essential:e.target.value==="yes"}))}>
          <option value="yes">Fondamentale</option><option value="no">Evitabile</option>
        </Select>
        <Btn onClick={save} style={{width:"100%"}}>Salva spesa</Btn>
      </Modal>
    </div>
  );
}

// ─── INCOMES ─────────────────────────────────────────────────────────────────
function Incomes({data,update,selectedMonth,monthData}){
  const [modal,setModal]=useState(false);
  const [extraForm,setExtraForm]=useState({who:"io",description:"",amount:""});
  const {income,totalIO,totalSara,totalIncome}=monthData;
  const setStipendio=(who,val)=>update(d=>{const key=who==="io"?"stipendioIO":"stipendioSara";const cur=d.incomes[selectedMonth]||{stipendioIO:0,stipendioSara:0,extraIO:[],extraSara:[]};return{...d,incomes:{...d.incomes,[selectedMonth]:{...cur,[key]:parseFloat(val)||0}}};});
  const addExtra=()=>{
    if(!extraForm.amount||!extraForm.description)return;
    update(d=>{const cur=d.incomes[selectedMonth]||{stipendioIO:0,stipendioSara:0,extraIO:[],extraSara:[]};const key=extraForm.who==="io"?"extraIO":"extraSara";return{...d,incomes:{...d.incomes,[selectedMonth]:{...cur,[key]:[...(cur[key]||[]),{id:uid(),description:extraForm.description,amount:parseFloat(extraForm.amount)}]}}};});
    setModal(false);setExtraForm({who:"io",description:"",amount:""});
  };
  const delExtra=(who,id)=>update(d=>{const cur=d.incomes[selectedMonth];const key=who==="io"?"extraIO":"extraSara";return{...d,incomes:{...d.incomes,[selectedMonth]:{...cur,[key]:cur[key].filter(x=>x.id!==id)}}};});
  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
        <h2 style={{margin:0,fontSize:22,fontWeight:700}}>Entrate — {monthLabel(selectedMonth)}</h2>
        <Btn onClick={()=>setModal(true)}>+ Entrata extra</Btn>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:20}}>
        {[{who:"io",label:"Il tuo stipendio",val:income.stipendioIO,total:totalIO,extras:income.extraIO||[]},
          {who:"sara",label:"Stipendio Sara",val:income.stipendioSara,total:totalSara,extras:income.extraSara||[]}].map(p=>(
          <Card key={p.who}>
            <div style={{fontSize:13,fontWeight:600,marginBottom:10,color:p.who==="io"?C.blue:C.accent}}>{p.label}</div>
            <input type="number" value={p.val} onChange={e=>setStipendio(p.who,e.target.value)} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"8px 12px",color:C.text,fontSize:18,fontWeight:700,width:"100%",boxSizing:"border-box"}}/>
            {p.extras.map(x=><div key={x.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:8,fontSize:13}}>
              <span style={{color:C.muted}}>{x.description}</span>
              <div style={{display:"flex",gap:8,alignItems:"center"}}>
                <span style={{color:C.green,fontWeight:600}}>{formatEuro(x.amount)}</span>
                <button onClick={()=>delExtra(p.who,x.id)} style={{background:"none",border:"none",color:C.muted,cursor:"pointer"}}>🗑</button>
              </div>
            </div>)}
            <div style={{marginTop:10,paddingTop:10,borderTop:`1px solid ${C.border}`,fontWeight:700,color:C.green}}>Totale: {formatEuro(p.total)}</div>
          </Card>
        ))}
      </div>
      <Card style={{borderLeft:`3px solid ${C.green}`}}>
        <div style={{fontSize:13,color:C.muted}}>Totale entrate questo mese</div>
        <div style={{fontSize:28,fontWeight:700,color:C.green}}>{formatEuro(totalIncome)}</div>
      </Card>
      <Modal open={modal} onClose={()=>setModal(false)} title="Entrata extra">
        <Select label="Di chi?" value={extraForm.who} onChange={e=>setExtraForm(f=>({...f,who:e.target.value}))}>
          <option value="io">Tu</option><option value="sara">Sara</option>
        </Select>
        <Input label="Descrizione" placeholder="es. Vendita bici" value={extraForm.description} onChange={e=>setExtraForm(f=>({...f,description:e.target.value}))}/>
        <Input label="Importo (€)" type="number" step="0.01" value={extraForm.amount} onChange={e=>setExtraForm(f=>({...f,amount:e.target.value}))}/>
        <Btn onClick={addExtra} style={{width:"100%"}}>Salva</Btn>
      </Modal>
    </div>
  );
}

// ─── RECURRING ───────────────────────────────────────────────────────────────
function Recurring({data,update,selectedMonth,monthData}){
  const [modal,setModal]=useState(false);
  const [form,setForm]=useState({name:"",amount:"",category:"1",type:"fixed",who:"comune",paidBy:"io",essential:true});
  const addRecurring=()=>{
    if(!form.name)return;
    update(d=>({...d,recurring:[...d.recurring,{...form,id:uid(),amount:parseFloat(form.amount)||0}]}));
    setModal(false);setForm({name:"",amount:"",category:"1",type:"fixed",who:"comune",paidBy:"io",essential:true});
  };
  const del=id=>update(d=>({...d,recurring:d.recurring.filter(r=>r.id!==id)}));
  const setVarValue=(id,val)=>update(d=>({...d,recurringValues:{...d.recurringValues,[selectedMonth]:{...(d.recurringValues[selectedMonth]||{}),[id]:parseFloat(val)||0}}}));
  const {recurringThisMonth,totalRecurring}=monthData;
  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
        <h2 style={{margin:0,fontSize:22,fontWeight:700}}>Ricorrenti — {monthLabel(selectedMonth)}</h2>
        <Btn onClick={()=>setModal(true)}>+ Aggiungi</Btn>
      </div>
      <div style={{marginBottom:10,display:"flex",gap:10,flexWrap:"wrap"}}>
        <Badge color={C.blue}>Fisse: {formatEuro(recurringThisMonth.filter(r=>r.type==="fixed").reduce((s,r)=>s+r.effectiveAmount,0))}</Badge>
        <Badge color={C.yellow}>Variabili: {formatEuro(recurringThisMonth.filter(r=>r.type==="variable").reduce((s,r)=>s+r.effectiveAmount,0))}</Badge>
        <Badge color={C.red}>Totale: {formatEuro(totalRecurring)}</Badge>
      </div>
      {recurringThisMonth.map(r=>{
        const cat=data.categories.find(c=>c.id===r.category);
        const paidBy=r.paidBy||(r.who!=="comune"?r.who:"io");
        return <Card key={r.id} style={{marginBottom:10,display:"flex",alignItems:"center",gap:12}}>
          <span style={{fontSize:20}}>{cat?.icon||"📦"}</span>
          <div style={{flex:1}}>
            <div style={{fontWeight:600,fontSize:14}}>{r.name}</div>
            <div style={{display:"flex",gap:6,marginTop:4,flexWrap:"wrap"}}>
              <Badge color={r.type==="fixed"?C.blue:C.yellow}>{r.type==="fixed"?"Fissa":"Variabile"}</Badge>
              <Badge color={r.who==="comune"?C.green:r.who==="io"?C.blue:C.accent}>{r.who==="comune"?"Comune":r.who==="io"?"Solo tu":"Solo Sara"}</Badge>
              {r.who==="comune"&&<Badge color={paidBy==="io"?C.blue:C.accent}>Paga: {paidBy==="io"?"Tu":"Sara"}</Badge>}
              {!r.essential&&<Badge color={C.yellow}>Evitabile</Badge>}
            </div>
          </div>
          {r.type==="variable"?<input type="number" step="0.01" value={(data.recurringValues[selectedMonth]||{})[r.id]||""} onChange={e=>setVarValue(r.id,e.target.value)} placeholder="€ questo mese" style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"6px 10px",color:C.text,fontSize:14,width:110}}/>:<div style={{fontWeight:700,color:C.red}}>{formatEuro(r.effectiveAmount)}</div>}
          <button onClick={()=>del(r.id)} style={{background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:16}}>🗑</button>
        </Card>;
      })}
      <Modal open={modal} onClose={()=>setModal(false)} title="Nuova spesa ricorrente">
        <Input label="Nome" placeholder="es. Netflix" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))}/>
        <Select label="Tipo" value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))}>
          <option value="fixed">Fissa (importo fisso)</option><option value="variable">Variabile (importo mensile)</option>
        </Select>
        {form.type==="fixed"&&<Input label="Importo mensile (€)" type="number" step="0.01" value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))}/>}
        <Select label="Categoria" value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))}>
          {data.categories.map(c=><option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
        </Select>
        <Select label="Appartiene a?" value={form.who} onChange={e=>setForm(f=>({...f,who:e.target.value}))}>
          <option value="comune">Comune (da dividere)</option><option value="io">Solo tua</option><option value="sara">Solo di Sara</option>
        </Select>
        {form.who==="comune"&&<Select label="Chi la paga fisicamente?" value={form.paidBy} onChange={e=>setForm(f=>({...f,paidBy:e.target.value}))}>
          <option value="io">Tu</option><option value="sara">Sara</option>
        </Select>}
        <Select label="Fondamentale?" value={form.essential?"yes":"no"} onChange={e=>setForm(f=>({...f,essential:e.target.value==="yes"}))}>
          <option value="yes">Fondamentale</option><option value="no">Evitabile</option>
        </Select>
        <Btn onClick={addRecurring} style={{width:"100%"}}>Salva</Btn>
      </Modal>
    </div>
  );
}

// ─── INVESTMENTS ─────────────────────────────────────────────────────────────
function Investments({data,update,allMonths}){
  const [modal,setModal]=useState(false);
  const [editModal,setEditModal]=useState(null);
  const [newVal,setNewVal]=useState("");
  const [form,setForm]=useState({name:"",owner:"io",monthlyContrib:"",currentValue:"",note:""});
  const totalContrib=data.investments.reduce((s,i)=>s+i.monthlyContrib,0);
  const totalValue=data.investments.reduce((s,i)=>s+i.currentValue,0);
  const addInv=()=>{
    if(!form.name)return;
    update(d=>({...d,investments:[...d.investments,{...form,id:uid(),monthlyContrib:parseFloat(form.monthlyContrib)||0,currentValue:parseFloat(form.currentValue)||0,lastUpdated:new Date().toISOString().slice(0,10),history:[]}]}));
    setModal(false);setForm({name:"",owner:"io",monthlyContrib:"",currentValue:"",note:""});
  };
  const updateValue=(id,val)=>{
    const v=parseFloat(val)||0;
    const today=new Date().toISOString().slice(0,10);
    update(d=>({...d,investments:d.investments.map(i=>i.id===id?{...i,currentValue:v,lastUpdated:today,history:[...(i.history||[]),{date:today,value:v}]}:i)}));
    setEditModal(null);setNewVal("");
  };
  const del=id=>update(d=>({...d,investments:d.investments.filter(i=>i.id!==id)}));
  const ownerColor=o=>o==="io"?C.blue:o==="sara"?C.accent:C.green;
  const ownerLabel=o=>o==="io"?"Tu":o==="sara"?"Sara":"Aggregato";

  // Chart: storico valore per investimento
  const invChartData = useMemo(()=>{
    const byDate={};
    data.investments.forEach(inv=>{
      (inv.history||[]).forEach(h=>{
        if(!byDate[h.date])byDate[h.date]={date:h.date};
        byDate[h.date][inv.name+(inv.owner!=="aggregato"?` (${ownerLabel(inv.owner)})`:"")]=h.value;
      });
      // always add current value
      const key=inv.name+(inv.owner!=="aggregato"?` (${ownerLabel(inv.owner)})`:"");
      if(!byDate[inv.lastUpdated])byDate[inv.lastUpdated]={date:inv.lastUpdated};
      byDate[inv.lastUpdated][key]=inv.currentValue;
    });
    return Object.values(byDate).sort((a,b)=>a.date.localeCompare(b.date));
  },[data.investments]);

  const invKeys=data.investments.map(i=>i.name+(i.owner!=="aggregato"?` (${ownerLabel(i.owner)})`:""));
  const INV_COLORS=[C.accent,C.green,C.blue,C.yellow,C.orange];

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
        <h2 style={{margin:0,fontSize:22,fontWeight:700}}>Investimenti</h2>
        <Btn onClick={()=>setModal(true)}>+ Aggiungi</Btn>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:20}}>
        <Card style={{borderLeft:`3px solid ${C.blue}`}}>
          <div style={{fontSize:12,color:C.muted}}>Contributi mensili totali</div>
          <div style={{fontSize:24,fontWeight:700,color:C.blue}}>{formatEuro(totalContrib)}</div>
        </Card>
        <Card style={{borderLeft:`3px solid ${C.green}`}}>
          <div style={{fontSize:12,color:C.muted}}>Patrimonio investito totale</div>
          <div style={{fontSize:24,fontWeight:700,color:C.green}}>{formatEuro(totalValue)}</div>
        </Card>
      </div>

      {/* Grafico andamento */}
      {invChartData.length>1&&<Card style={{marginBottom:20}}>
        <div style={{fontSize:13,fontWeight:600,marginBottom:14}}>📈 Andamento valore investimenti</div>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={invChartData}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.border}/>
            <XAxis dataKey="date" tick={{fill:C.muted,fontSize:10}} axisLine={false} tickLine={false}/>
            <YAxis tick={{fill:C.muted,fontSize:10}} axisLine={false} tickLine={false}/>
            <Tooltip contentStyle={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8}} formatter={v=>formatEuro(v)}/>
            <Legend wrapperStyle={{fontSize:10}}/>
            {invKeys.map((k,i)=><Line key={k} type="monotone" dataKey={k} stroke={INV_COLORS[i%INV_COLORS.length]} strokeWidth={2} dot={{r:4}} connectNulls/>)}
          </LineChart>
        </ResponsiveContainer>
      </Card>}

      {data.investments.map(inv=>(
        <Card key={inv.id} style={{marginBottom:10}}>
          <div style={{display:"flex",alignItems:"flex-start",gap:12}}>
            <div style={{fontSize:24}}>📈</div>
            <div style={{flex:1}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                <span style={{fontWeight:700,fontSize:15}}>{inv.name}</span>
                <Badge color={ownerColor(inv.owner)}>{ownerLabel(inv.owner)}</Badge>
                {inv.note&&<span style={{fontSize:11,color:C.muted}}>{inv.note}</span>}
              </div>
              <div style={{display:"flex",gap:20,flexWrap:"wrap"}}>
                <div><div style={{fontSize:11,color:C.muted}}>Contributo mensile</div><div style={{fontWeight:600,color:C.blue}}>{formatEuro(inv.monthlyContrib)}/mese</div></div>
                <div><div style={{fontSize:11,color:C.muted}}>Valore attuale</div><div style={{fontWeight:700,color:C.green,fontSize:16}}>{formatEuro(inv.currentValue)}</div></div>
                <div><div style={{fontSize:11,color:C.muted}}>Aggiornato</div><div style={{fontSize:12,color:C.muted}}>{inv.lastUpdated}</div></div>
                {(inv.history||[]).length>0&&<div><div style={{fontSize:11,color:C.muted}}>Aggiornamenti</div><div style={{fontSize:12,color:C.muted}}>{inv.history.length} storico</div></div>}
              </div>
            </div>
            <div style={{display:"flex",gap:6}}>
              <Btn small onClick={()=>{setEditModal(inv);setNewVal(inv.currentValue);}}>Aggiorna</Btn>
              <button onClick={()=>del(inv.id)} style={{background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:16}}>🗑</button>
            </div>
          </div>
        </Card>
      ))}

      <Modal open={modal} onClose={()=>setModal(false)} title="Nuovo investimento">
        <Input label="Nome" placeholder="es. Moneyfarm" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))}/>
        <Select label="Intestatario" value={form.owner} onChange={e=>setForm(f=>({...f,owner:e.target.value}))}>
          <option value="io">Tu</option><option value="sara">Sara</option><option value="aggregato">Aggregato (entrambi)</option>
        </Select>
        <Input label="Contributo mensile (€)" type="number" step="0.01" value={form.monthlyContrib} onChange={e=>setForm(f=>({...f,monthlyContrib:e.target.value}))}/>
        <Input label="Valore attuale (€)" type="number" step="0.01" value={form.currentValue} onChange={e=>setForm(f=>({...f,currentValue:e.target.value}))}/>
        <Input label="Note (opzionale)" value={form.note} onChange={e=>setForm(f=>({...f,note:e.target.value}))}/>
        <Btn onClick={addInv} style={{width:"100%"}}>Salva</Btn>
      </Modal>
      {editModal&&<Modal open={true} onClose={()=>setEditModal(null)} title={`Aggiorna: ${editModal.name}`}>
        <div style={{color:C.muted,fontSize:13,marginBottom:16}}>Valore attuale: <strong style={{color:C.green}}>{formatEuro(editModal.currentValue)}</strong></div>
        <Input label="Nuovo valore (€)" type="number" step="0.01" value={newVal} onChange={e=>setNewVal(e.target.value)}/>
        <div style={{fontSize:11,color:C.muted,marginBottom:14}}>Il valore verrà salvato nello storico con la data di oggi ({new Date().toISOString().slice(0,10)})</div>
        <Btn onClick={()=>updateValue(editModal.id,newVal)} style={{width:"100%"}}>Aggiorna e salva in storico</Btn>
      </Modal>}
    </div>
  );
}

// ─── SPLIT ────────────────────────────────────────────────────────────────────
function Split({splitData,monthData,selectedMonth,data,update}){
  const {pctIO,pctSara,totaleComune,deveIO,deveSara,pagatoIO,pagatoSara,diffIO,diffSara,messaggio,netBalance,netMsg,settlTotal,settlements}=splitData;
  const [settlModal,setSettlModal]=useState(false);
  const [settlForm,setSettlForm]=useState({date:new Date().toISOString().slice(0,10),amount:"",payer:"sara",note:""});
  const comuneExpenses=monthData.monthExpenses.filter(e=>e.type==="comune");
  const comuneRecurring=monthData.recurringThisMonth.filter(r=>r.who==="comune");
  const addSettlement=()=>{
    if(!settlForm.amount)return;
    update(d=>({...d,settlements:[...(d.settlements||[]),{id:uid(),date:settlForm.date,amount:parseFloat(settlForm.amount),payer:settlForm.payer,note:settlForm.note,month:selectedMonth}]}));
    setSettlModal(false);
  };
  const delSettlement=id=>update(d=>({...d,settlements:(d.settlements||[]).filter(s=>s.id!==id)}));
  return (
    <div>
      <h2 style={{fontSize:22,fontWeight:700,marginBottom:20,marginTop:0}}>Divisione spese — {monthLabel(selectedMonth)}</h2>
      <Card style={{marginBottom:16,borderLeft:`3px solid ${C.yellow}`}}>
        <div style={{fontSize:12,color:C.muted,marginBottom:4,fontWeight:600,textTransform:"uppercase",letterSpacing:0.5}}>Saldo mese corrente</div>
        <div style={{fontSize:20,fontWeight:700,color:C.yellow,marginBottom:6}}>{messaggio}</div>
        <div style={{fontSize:13,color:C.muted}}>Spese comuni totali: {formatEuro(totaleComune)}</div>
      </Card>
      <Card style={{marginBottom:20,borderLeft:`3px solid ${Math.abs(netBalance)<0.5?C.green:C.red}`}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
          <div>
            <div style={{fontSize:12,color:C.muted,marginBottom:4,fontWeight:600,textTransform:"uppercase",letterSpacing:0.5}}>Saldo netto (dopo saldi storici)</div>
            <div style={{fontSize:18,fontWeight:700,color:Math.abs(netBalance)<0.5?C.green:C.red}}>{netMsg}</div>
            {settlements.length>0&&<div style={{fontSize:12,color:C.muted,marginTop:4}}>Saldi effettuati: {formatEuro(Math.abs(settlTotal))} totali</div>}
          </div>
          <Btn onClick={()=>{setSettlForm(f=>({...f,payer:diffIO<0?"io":"sara",amount:Math.abs(diffIO).toFixed(2)}));setSettlModal(true);}}>✅ Registra saldo</Btn>
        </div>
      </Card>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:20}}>
        {[{label:nomeIO,pct:pctIO,deve:deveIO,pagato:pagatoIO,diff:diffIO,color:C.blue},{label:nomeSara,pct:pctSara,deve:deveSara,pagato:pagatoSara,diff:diffSara,color:C.accent}].map(p=>(
          <Card key={p.label} style={{borderLeft:`3px solid ${p.color}`}}>
            <div style={{fontWeight:700,fontSize:15,marginBottom:10,color:p.color}}>{p.label} ({(p.pct*100).toFixed(0)}%)</div>
            {[["Quota dovuta",formatEuro(p.deve)],["Già pagato",formatEuro(p.pagato)]].map(([l,v])=>(
              <div key={l} style={{fontSize:13,marginBottom:6,display:"flex",justifyContent:"space-between"}}><span style={{color:C.muted}}>{l}</span><span style={{fontWeight:600}}>{v}</span></div>
            ))}
            <div style={{fontSize:13,display:"flex",justifyContent:"space-between",paddingTop:8,borderTop:`1px solid ${C.border}`}}>
              <span style={{color:C.muted}}>Differenza</span>
              <span style={{fontWeight:700,color:p.diff>=0?C.green:C.red}}>{p.diff>=0?"+":""}{formatEuro(p.diff)}</span>
            </div>
          </Card>
        ))}
      </div>
      {settlements.length>0&&<div style={{marginBottom:24}}>
        <h3 style={{fontSize:15,fontWeight:600,marginBottom:12}}>📜 Storico saldi</h3>
        {[...settlements].sort((a,b)=>b.date.localeCompare(a.date)).map(s=>(
          <div key={s.id} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 0",borderBottom:`1px solid ${C.border}`}}>
            <div style={{width:36,height:36,borderRadius:"50%",background:C.green+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>✅</div>
            <div style={{flex:1}}>
              <div style={{fontSize:14,fontWeight:600}}>{s.payer==="sara"?(data.settings?.nomeSara||"Sara")+" ha saldato":(data.settings?.nomeIO||"Marco")+" ha saldato"} {formatEuro(s.amount)}</div>
              <div style={{fontSize:12,color:C.muted,marginTop:2}}>{s.date}{s.note?` · ${s.note}`:""}{s.month&&<span style={{marginLeft:8}}><Badge color={C.muted}>{monthLabel(s.month)}</Badge></span>}</div>
            </div>
            <button onClick={()=>delSettlement(s.id)} style={{background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:16}}>🗑</button>
          </div>
        ))}
      </div>}
      <h3 style={{fontSize:15,fontWeight:600,marginBottom:12}}>Dettaglio spese comuni</h3>
      {[...comuneExpenses].sort((a,b)=>b.date.localeCompare(a.date)).map(e=>{
        const cat=data.categories.find(c=>c.id===e.category);
        return <div key={e.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 0",borderBottom:`1px solid ${C.border}`}}>
          <span>{cat?.icon||"📦"}</span><span style={{flex:1,fontSize:13}}>{e.description}</span>
          <Badge color={e.who==="io"?C.blue:C.accent}>{e.who==="io"?"Pagato da te":"Pagato da Sara"}</Badge>
          <span style={{fontWeight:600,fontSize:14}}>{formatEuro(e.amount)}</span>
        </div>;
      })}
      {comuneRecurring.map(r=>(
        <div key={r.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 0",borderBottom:`1px solid ${C.border}`}}>
          <span>🔄</span><span style={{flex:1,fontSize:13}}>{r.name} <span style={{color:C.muted,fontSize:11}}>(ricorrente)</span></span>
          <Badge color={C.yellow}>{r.type==="fixed"?"Fissa":"Variabile"}</Badge>
          <span style={{fontWeight:600,fontSize:14}}>{formatEuro(r.effectiveAmount)}</span>
        </div>
      ))}
      <Modal open={settlModal} onClose={()=>setSettlModal(false)} title="Registra saldo">
        <div style={{background:C.accentSoft,borderRadius:10,padding:"12px 14px",marginBottom:16,fontSize:13,color:C.muted}}>Saldo mese: <strong style={{color:C.yellow}}>{messaggio}</strong></div>
        <Select label="Chi ha pagato?" value={settlForm.payer} onChange={e=>setSettlForm(f=>({...f,payer:e.target.value}))}>
          <option value="sara">Sara</option><option value="io">Tu</option>
        </Select>
        <Input label="Importo (€)" type="number" step="0.01" value={settlForm.amount} onChange={e=>setSettlForm(f=>({...f,amount:e.target.value}))}/>
        <Input label="Data" type="date" value={settlForm.date} onChange={e=>setSettlForm(f=>({...f,date:e.target.value}))}/>
        <Input label="Note (opzionale)" placeholder="es. Bonifico" value={settlForm.note} onChange={e=>setSettlForm(f=>({...f,note:e.target.value}))}/>
        <Btn onClick={addSettlement} style={{width:"100%"}}>✅ Conferma saldo</Btn>
      </Modal>
    </div>
  );
}

// ─── REPORT ──────────────────────────────────────────────────────────────────
function Report({data,allMonths}){
  // Dati storici reali — presi da data.realHistory (salvati su Supabase per utente)
  const REAL_HISTORY = data.realHistory || [];
  const totalPatrimonio=data.investments.reduce((s,i)=>s+i.currentValue,0);
  const totalInvestimenti=data.investments.reduce((s,i)=>s+i.monthlyContrib,0);

  // Usa dati reali per tutti i mesi storici tranne il mese corrente
  const currentMonth = CURRENT_MONTH();
  const reportData = useMemo(()=>{
    // Mesi storici da REAL_HISTORY
    const hist = REAL_HISTORY.filter(r=>r.month<currentMonth).map(r=>({
      ...r,
      residuo: r.entrate!==null ? r.base + r.entrate - r.uscite - totalInvestimenti : null,
      investimenti: totalInvestimenti,
      savingsRate: r.entrate ? ((totalInvestimenti + Math.max(0, r.base+r.entrate-r.uscite-totalInvestimenti)) / r.entrate)*100 : 0,
      isReal: true,
    }));
    // Mese corrente calcolato dall'app
    const md = computeMonth(data, currentMonth);
    const cur = {
      month: currentMonth,
      label: monthLabel(currentMonth),
      shortLabel: monthLabel(currentMonth).slice(0,3),
      base: md.carryover,
      entrate: md.totalIncome,
      uscite: md.totalExpenses,
      residuo: md.residuo,
      investimenti: md.totalInvestments,
      savingsRate: md.savingsRate,
      isReal: false,
    };
    return [...hist, cur];
  },[data,currentMonth,totalInvestimenti]);

  const complete = reportData.filter(r=>r.entrate!==null);
  const avgEntrate=complete.length?complete.reduce((s,r)=>s+r.entrate,0)/complete.length:0;
  const avgUscite=complete.length?complete.reduce((s,r)=>s+r.uscite,0)/complete.length:0;
  const avgResiduo=complete.length?complete.reduce((s,r)=>s+(r.residuo||0),0)/complete.length:0;
  const avgSavings=complete.length?complete.reduce((s,r)=>s+r.savingsRate,0)/complete.length:0;

  return (
    <div>
      <h2 style={{fontSize:22,fontWeight:700,marginBottom:20,marginTop:0}}>Report storico</h2>

      {/* Medie */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:12,marginBottom:20}}>
        {[
          {label:"Media entrate",value:formatEuro(avgEntrate),color:C.green},
          {label:"Media uscite",value:formatEuro(avgUscite),color:C.red},
          {label:"Media residuo",value:formatEuro(avgResiduo),color:avgResiduo>=0?C.green:C.red},
          {label:"Tasso risparmio medio",value:`${avgSavings.toFixed(1)}%`,color:C.purple},
          {label:"Invest. mensili",value:formatEuro(totalInvestimenti),color:C.blue},
          {label:"Patrimonio totale",value:formatEuro(totalPatrimonio),color:C.green},
        ].map(k=><Card key={k.label} style={{borderLeft:`3px solid ${k.color}`}}>
          <div style={{fontSize:11,color:C.muted,marginBottom:4,fontWeight:600}}>{k.label}</div>
          <div style={{fontSize:18,fontWeight:700,color:k.color}}>{k.value}</div>
        </Card>)}
      </div>

      {/* Grafico entrate/uscite/base */}
      <Card style={{marginBottom:16}}>
        <div style={{fontSize:13,fontWeight:600,marginBottom:4}}>Andamento mensile — dati reali</div>
        <div style={{fontSize:11,color:C.muted,marginBottom:14}}>I mesi storici riportano i tuoi dati reali · il mese corrente è calcolato dall'app</div>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={reportData}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.border}/>
            <XAxis dataKey="shortLabel" tick={{fill:C.muted,fontSize:10}} axisLine={false} tickLine={false}/>
            <YAxis tick={{fill:C.muted,fontSize:10}} axisLine={false} tickLine={false}/>
            <Tooltip contentStyle={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8}} formatter={v=>v!=null?formatEuro(v):"—"}/>
            <Legend wrapperStyle={{fontSize:11}}/>
            <ReferenceLine y={0} stroke={C.border}/>
            <Line type="monotone" dataKey="entrate" stroke={C.green} strokeWidth={2} dot={{r:3}} name="Entrate" connectNulls/>
            <Line type="monotone" dataKey="uscite" stroke={C.red} strokeWidth={2} dot={{r:3}} name="Uscite" connectNulls/>
            <Line type="monotone" dataKey="base" stroke={C.blue} strokeWidth={2} dot={{r:3}} name="Base mese" connectNulls strokeDasharray="5 3"/>
          </LineChart>
        </ResponsiveContainer>
      </Card>

      {/* Grafico tasso risparmio */}
      <Card style={{marginBottom:16}}>
        <div style={{fontSize:13,fontWeight:600,marginBottom:14}}>Tasso di risparmio mensile (%)</div>
        <ResponsiveContainer width="100%" height={150}>
          <BarChart data={complete}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.border}/>
            <XAxis dataKey="shortLabel" tick={{fill:C.muted,fontSize:10}} axisLine={false} tickLine={false}/>
            <YAxis tick={{fill:C.muted,fontSize:10}} axisLine={false} tickLine={false} unit="%"/>
            <Tooltip contentStyle={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8}} formatter={v=>`${v.toFixed(1)}%`}/>
            <ReferenceLine y={avgSavings} stroke={C.purple} strokeDasharray="4 4" label={{value:"media",fill:C.muted,fontSize:10}}/>
            <Bar dataKey="savingsRate" fill={C.purple} radius={[4,4,0,0]} name="Tasso risparmio"/>
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* Tabella */}
      <div style={{overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
          <thead>
            <tr style={{borderBottom:`2px solid ${C.border}`}}>
              {["Mese","Base","Entrate","Uscite","Investimenti","Residuo","Risparmio%"].map(h=>(
                <th key={h} style={{padding:"10px 12px",textAlign:"right",color:C.muted,fontWeight:600,fontSize:11,textTransform:"uppercase",letterSpacing:0.5}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...reportData].reverse().map(row=>(
              <tr key={row.month} style={{borderBottom:`1px solid ${C.border}`,opacity:row.entrate===null?0.5:1}}>
                <td style={{padding:"10px 12px",fontWeight:600,display:"flex",alignItems:"center",gap:6}}>
                  {row.label}{row.isReal&&<Badge color={C.green}>✓</Badge>}
                </td>
                <td style={{padding:"10px 12px",textAlign:"right",color:C.blue}}>{formatEuro(row.base)}</td>
                <td style={{padding:"10px 12px",textAlign:"right",color:C.green}}>{row.entrate!=null?formatEuro(row.entrate):"—"}</td>
                <td style={{padding:"10px 12px",textAlign:"right",color:C.red}}>{row.uscite!=null?formatEuro(row.uscite):"—"}</td>
                <td style={{padding:"10px 12px",textAlign:"right",color:C.blue}}>{formatEuro(row.investimenti)}</td>
                <td style={{padding:"10px 12px",textAlign:"right",fontWeight:700,color:row.residuo!=null?(row.residuo>=0?C.green:C.red):C.muted}}>{row.residuo!=null?formatEuro(row.residuo):"—"}</td>
                <td style={{padding:"10px 12px",textAlign:"right",color:C.purple}}>{row.savingsRate!=null?`${row.savingsRate.toFixed(1)}%`:"—"}</td>
              </tr>
            ))}
            <tr style={{borderTop:`2px solid ${C.border}`,background:C.surface}}>
              <td style={{padding:"10px 12px",fontWeight:700,color:C.muted}}>Media</td>
              <td style={{padding:"10px 12px",textAlign:"right",color:C.blue,fontWeight:700}}>—</td>
              <td style={{padding:"10px 12px",textAlign:"right",color:C.green,fontWeight:700}}>{formatEuro(avgEntrate)}</td>
              <td style={{padding:"10px 12px",textAlign:"right",color:C.red,fontWeight:700}}>{formatEuro(avgUscite)}</td>
              <td style={{padding:"10px 12px",textAlign:"right",color:C.blue,fontWeight:700}}>{formatEuro(totalInvestimenti)}</td>
              <td style={{padding:"10px 12px",textAlign:"right",fontWeight:700,color:avgResiduo>=0?C.green:C.red}}>{formatEuro(avgResiduo)}</td>
              <td style={{padding:"10px 12px",textAlign:"right",color:C.purple,fontWeight:700}}>{avgSavings.toFixed(1)}%</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── SETTINGS ────────────────────────────────────────────────────────────────
function Settings({data,update}){
  const [catModal,setCatModal]=useState(false);
  const [newCat,setNewCat]=useState({name:"",icon:"📦"});
  const addCat=()=>{if(!newCat.name)return;update(d=>({...d,categories:[...d.categories,{...newCat,id:uid()}]}));setCatModal(false);setNewCat({name:"",icon:"📦"});};
  const delCat=id=>update(d=>({...d,categories:d.categories.filter(c=>c.id!==id)}));
  const exportData=()=>{const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="famiglia_finance_backup.json";a.click();};
  const importData=e=>{const file=e.target.files[0];if(!file)return;const reader=new FileReader();reader.onload=ev=>{try{update(()=>JSON.parse(ev.target.result));}catch{alert("File non valido");}};reader.readAsText(file);};
  return (
    <div>
      <h2 style={{fontSize:22,fontWeight:700,marginBottom:20,marginTop:0}}>Impostazioni</h2>
      <Card style={{marginBottom:16}}>
        <div style={{fontWeight:600,marginBottom:14}}>Stipendi base mensili</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
          <div>
            <label style={{fontSize:12,color:C.muted,display:"block",marginBottom:5}}>Nome persona 1</label>
            <input value={data.settings?.nomeIO||"Marco"} onChange={e=>update(d=>({...d,settings:{...d.settings,nomeIO:e.target.value}}))} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"8px 12px",color:C.text,fontSize:14,width:"100%",boxSizing:"border-box"}}/>
          </div>
          <div>
            <label style={{fontSize:12,color:C.muted,display:"block",marginBottom:5}}>Nome persona 2</label>
            <input value={data.settings?.nomeSara||"Sara"} onChange={e=>update(d=>({...d,settings:{...d.settings,nomeSara:e.target.value}}))} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"8px 12px",color:C.text,fontSize:14,width:"100%",boxSizing:"border-box"}}/>
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          {[{who:"io",label:"Stipendio base persona 1 (€)",key:"stipendioIO"},{who:"sara",label:"Stipendio base persona 2 (€)",key:"stipendioSara"}].map(p=>(
            <div key={p.who}>
              <label style={{fontSize:12,color:C.muted,display:"block",marginBottom:5}}>{p.label}</label>
              <input type="number" value={data.settings[p.key]} onChange={e=>update(d=>({...d,settings:{...d.settings,[p.key]:parseFloat(e.target.value)||0}}))} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"8px 12px",color:C.text,fontSize:14,width:"100%",boxSizing:"border-box"}}/>
            </div>
          ))}
        </div>
        <div style={{fontSize:12,color:C.muted,marginTop:10}}>Usati come base per il calcolo delle % di split. Vengono sovrascritti dai valori mensili nella sezione Entrate.</div>
      </Card>
      <Card style={{marginBottom:16}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
          <div style={{fontWeight:600}}>Categorie ({data.categories.length})</div>
          <Btn small onClick={()=>setCatModal(true)}>+ Aggiungi</Btn>
        </div>
        <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
          {data.categories.map(c=><div key={c.id} style={{display:"flex",alignItems:"center",gap:6,background:C.surface,borderRadius:8,padding:"6px 10px",border:`1px solid ${C.border}`}}>
            <span>{c.icon}</span><span style={{fontSize:13}}>{c.name}</span>
            <button onClick={()=>delCat(c.id)} style={{background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:12,paddingLeft:4}}>×</button>
          </div>)}
        </div>
      </Card>
      <Card>
        <div style={{fontWeight:600,marginBottom:14}}>Backup dati</div>
        <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
          <Btn onClick={exportData}>⬇️ Esporta JSON</Btn>
          <label style={{background:C.border,color:C.text,borderRadius:10,padding:"11px 22px",fontSize:14,fontWeight:600,cursor:"pointer"}}>⬆️ Importa JSON<input type="file" accept=".json" onChange={importData} style={{display:"none"}}/></label>
        </div>
        <div style={{fontSize:12,color:C.muted,marginTop:10}}>I dati sono salvati su Supabase (sync multi-device) e nel localStorage come fallback offline.</div>
      </Card>
      <Modal open={catModal} onClose={()=>setCatModal(false)} title="Nuova categoria">
        <Input label="Nome" placeholder="es. Sport" value={newCat.name} onChange={e=>setNewCat(f=>({...f,name:e.target.value}))}/>
        <Input label="Emoji" placeholder="es. 🏋️" value={newCat.icon} onChange={e=>setNewCat(f=>({...f,icon:e.target.value}))}/>
        <Btn onClick={addCat} style={{width:"100%"}}>Aggiungi</Btn>
      </Modal>
    </div>
  );
}
