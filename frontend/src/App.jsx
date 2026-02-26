/**
 * UCAC_MultiAgents.jsx
 *
 * Interface React — Système Multi-Agents UCAC-ICAM
 * ──────────────────────────────────────────────────────────────────────────────
 * Cette interface se connecte au serveur Express (server.js) via SSE.
 * Le serveur exécute les vrais agents IA (Agent1, Agent2, Agent3) et
 * génère les vrais fichiers DOCX/PPTX sur disque.
 * L'interface affiche les raisonnements en temps réel et propose le
 * téléchargement des fichiers via /api/download/:filename.
 *
 * Architecture :
 *   React App (UI) ──SSE──> Express Server ──calls──> Orchestrateur
 *                                                        ├── Agent 1 → DOCX PA
 *                                                        ├── Agent 2 → PPTX PR
 *                                                        └── Agent 3 → DOCX CER
 *
 * Modes supportés :
 *   "full"    → Thématique seule → Génère PA + PR + CER
 *   "from_pa" → Import PA JSON  → Génère PR + CER
 *   "from_pr" → Import PR JSON  → Génère CER uniquement
 *
 * Config serveur : modifier API_BASE si votre serveur tourne sur un autre port.
 */

import { useState, useRef, useEffect } from "react";

// ── Config ────────────────────────────────────────────────────────────────────
const API_BASE = "/api";
const STUDENT   = "MAYACK ETIENNE";
const PROMOTION = "X2027";
const ANNEE     = "2025 – 2026";

// ── Utilitaires ───────────────────────────────────────────────────────────────

/** Parse un fichier JSON ou texte contenant du JSON */
function parseImportedFile(text) {
  if (typeof text !== "string") return (text && typeof text === "object") ? text : null;
  try { return JSON.parse(text); } catch { /* ignore */ }
  const m = text.match(/\{[\s\S]+\}/);
  if (m) { try { return JSON.parse(m[0]); } catch { /* ignore */ } }
  return null;
}

/** Télécharger un fichier depuis le serveur */
async function downloadFromServer(filename) {
  const res  = await fetch(`${API_BASE}/download/${filename}`);
  const blob = await res.blob();
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ── CSS ───────────────────────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Outfit:wght@300;400;500;600;700&display=swap');

:root {
  --bg:      #0B0D14;  --s1: #111520;   --s2: #161B2C;
  --brd:     rgba(255,255,255,.07);  --brd2: rgba(255,255,255,.12);
  --txt:     #E4EAF8;  --mu: rgba(255,255,255,.38);  --mu2: rgba(255,255,255,.55);
  --blue:    #4F87FF;  --bd: rgba(79,135,255,.14);   --bb: rgba(79,135,255,.3);
  --green:   #36D399;  --gd: rgba(54,211,153,.11);   --gb: rgba(54,211,153,.28);
  --amber:   #FBCC25;  --ad: rgba(251,204,37,.1);
  --red:     #F87171;  --rd: rgba(248,113,113,.1);   --rb: rgba(248,113,113,.28);
  --violet:  #A78BFA;  --vd: rgba(167,139,250,.1);   --vb: rgba(167,139,250,.28);
}
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: 'Outfit', sans-serif; background: var(--bg); color: var(--txt); line-height: 1.6; min-height: 100vh; }
.app { max-width: 880px; margin: 0 auto; padding: 0 20px 100px; }

/* ── Header ── */
.hdr { padding: 56px 0 32px; position: relative; }
.hdr::after { content:''; position:absolute; bottom:0; left:0; right:0; height:1px; background:linear-gradient(90deg,transparent,var(--brd2),transparent); }
.pill { display:inline-flex; align-items:center; gap:7px; background:var(--bd); border:1px solid var(--bb); border-radius:100px; padding:5px 14px; font-size:11px; font-weight:600; color:var(--blue); letter-spacing:.06em; text-transform:uppercase; margin-bottom:18px; }
.dot { width:6px; height:6px; border-radius:50%; background:var(--green); animation:bk 2s infinite; }
@keyframes bk { 0%,100%{opacity:1} 50%{opacity:.25} }
h1 { font-family:'Instrument Serif',serif; font-size:44px; line-height:1.08; color:white; margin-bottom:8px; }
h1 em { font-style:italic; color:var(--blue); }
.sub { font-size:13px; color:var(--mu); font-weight:300; }
.arch-badge { display:inline-flex; align-items:center; gap:6px; background:var(--gd); border:1px solid var(--gb); border-radius:6px; padding:4px 11px; font-size:11px; color:var(--green); font-weight:500; margin-top:10px; }

/* ── Mode selector ── */
.modes { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; margin:28px 0; }
.mode { background:var(--s1); border:1.5px solid var(--brd); border-radius:14px; padding:18px 16px; cursor:pointer; transition:.18s all; }
.mode:hover { border-color:var(--bb); background:var(--s2); transform:translateY(-1px); }
.mode.sel { border-color:var(--blue); background:var(--bd); }
.mode-ico { font-size:26px; margin-bottom:10px; }
.mode-ttl { font-size:13px; font-weight:600; color:var(--txt); margin-bottom:4px; }
.mode-dsc { font-size:11px; color:var(--mu); line-height:1.55; }

/* ── Pipeline tracker ── */
.pipe { display:flex; align-items:center; gap:0; padding:14px 18px; background:var(--s1); border:1px solid var(--brd); border-radius:12px; margin:20px 0; overflow-x:auto; }
.ps { display:flex; align-items:center; gap:9px; flex:1; min-width:110px; padding:6px 8px; border-radius:8px; }
.pnum { width:32px; height:32px; border-radius:8px; border:1.5px solid var(--brd2); display:flex; align-items:center; justify-content:center; font-weight:700; font-size:11px; flex-shrink:0; transition:.25s all; }
.ps.active .pnum { background:var(--blue); border-color:var(--blue); color:white; box-shadow:0 0 16px rgba(79,135,255,.4); }
.ps.done   .pnum { background:var(--gd); border-color:var(--gb); color:var(--green); }
.ps.skip   .pnum { background:rgba(255,255,255,.04); color:var(--mu); }
.plbl { font-size:9.5px; color:var(--mu); text-transform:uppercase; letter-spacing:.07em; }
.pnm  { font-size:12px; font-weight:500; color:var(--mu2); }
.ps.active .pnm, .ps.done .pnm { color:var(--txt); }
.parr { color:var(--brd2); font-size:18px; margin:0 2px; flex-shrink:0; }

/* ── Cards ── */
.card { background:var(--s1); border:1px solid var(--brd); border-radius:16px; overflow:hidden; margin-bottom:14px; transition:border-color .2s; }
.card.act { border-color:var(--bb); }
.card.dn  { border-color:var(--gb); }
.card.err { border-color:var(--rb); }
.chead { display:flex; align-items:center; gap:13px; padding:18px 22px; border-bottom:1px solid var(--brd); }
.cico { width:40px; height:40px; border-radius:11px; display:flex; align-items:center; justify-content:center; font-size:20px; flex-shrink:0; }
.i1{background:var(--bd)} .i2{background:var(--vd)} .i3{background:var(--gd)}
.cttl { font-size:15px; font-weight:600; color:var(--txt); margin-bottom:2px; }
.cdsc { font-size:11px; color:var(--mu); }
.cbdy { padding:20px 22px; }

/* ── Status badge ── */
.stbg { padding:3px 11px; border-radius:100px; font-size:10px; font-weight:700; letter-spacing:.04em; flex-shrink:0; }
.sw{background:rgba(255,255,255,.05);color:var(--mu)}
.sr{background:var(--bd);color:var(--blue);animation:pulse 1.5s infinite}
.sg{background:var(--gd);color:var(--green)}
.sk{background:rgba(255,255,255,.04);color:var(--mu)}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}

/* ── Form ── */
.flbl{font-size:10.5px;font-weight:600;color:var(--mu);text-transform:uppercase;letter-spacing:.07em;margin-bottom:8px}
.fi{width:100%;background:rgba(255,255,255,.04);border:1px solid var(--brd);border-radius:10px;padding:11px 14px;color:var(--txt);font-family:'Outfit',sans-serif;font-size:13.5px;outline:none;transition:border-color .2s}
.fi:focus{border-color:var(--bb)} .fi::placeholder{color:rgba(255,255,255,.18)}
.fi.ta{resize:vertical;min-height:90px;line-height:1.6}
.fg{margin-bottom:16px}
.row{display:flex;gap:10px;flex-wrap:wrap;margin-top:12px}

/* ── Buttons ── */
.btn{display:inline-flex;align-items:center;gap:6px;padding:10px 20px;border-radius:9px;font-family:'Outfit',sans-serif;font-size:13px;font-weight:500;cursor:pointer;border:none;transition:.18s all;white-space:nowrap}
.btn:disabled{opacity:.32;cursor:not-allowed}
.bp{background:var(--blue);color:white}.bp:hover:not(:disabled){background:#6497ff;transform:translateY(-1px);box-shadow:0 4px 18px rgba(79,135,255,.38)}
.bs{background:rgba(255,255,255,.06);color:var(--mu2);border:1px solid var(--brd)}.bs:hover:not(:disabled){background:rgba(255,255,255,.1)}
.bg{background:var(--gd);color:var(--green);border:1px solid var(--gb)}.bg:hover:not(:disabled){background:rgba(54,211,153,.18);transform:translateY(-1px);box-shadow:0 4px 13px rgba(54,211,153,.22)}
.bv{background:var(--vd);color:var(--violet);border:1px solid var(--vb)}.bv:hover:not(:disabled){background:rgba(167,139,250,.18)}

/* ── Import zone ── */
.iz{border:2px dashed var(--brd2);border-radius:10px;padding:24px;text-align:center;cursor:pointer;transition:.2s all;background:var(--s2)}
.iz:hover,.iz.drag{border-color:var(--bb);background:var(--bd)}
.iz.ok{border-color:var(--gb);background:var(--gd)}
.iz.er{border-color:var(--rb);background:var(--rd)}
.iz-ic{font-size:30px;margin-bottom:8px}
.iz-t{font-size:13px;font-weight:600;margin-bottom:4px}
.iz-d{font-size:11px;color:var(--mu)}
.iz-ok{font-size:11px;color:var(--green);margin-top:5px;font-weight:500}
.iz-e{font-size:11px;color:var(--red);margin-top:5px}

/* ── Agent log ── */
.log{background:rgba(0,0,0,.4);border:1px solid var(--brd);border-radius:10px;padding:14px;margin-top:14px;max-height:260px;overflow-y:auto;font-size:11.5px}
.log::-webkit-scrollbar{width:3px}.log::-webkit-scrollbar-thumb{background:var(--brd2);border-radius:2px}
.lr{display:flex;gap:8px;margin-bottom:7px;line-height:1.5;align-items:flex-start}
.la{font-size:10px;font-weight:700;flex-shrink:0;width:76px;margin-top:1px}
.la1{color:var(--blue)}.la2{color:var(--violet)}.la3{color:var(--green)}.lo{color:var(--amber)}
.lt{font-size:9px;font-weight:700;flex-shrink:0;width:74px;text-transform:uppercase;letter-spacing:.05em;margin-top:2px}
.ltt{color:rgba(255,255,255,.28)}.lac{color:var(--blue)}.lob{color:var(--amber)}.lrs{color:var(--green)}
.lm{color:var(--mu2);flex:1}
.cstep{color:var(--amber);font-style:italic;font-size:10.5px}

/* ── Memory panel ── */
.mem{background:var(--s2);border:1px solid var(--brd);border-radius:11px;padding:14px;margin-top:14px}
.mem-t{font-size:11px;font-weight:600;color:var(--mu2);margin-bottom:10px;display:flex;align-items:center;gap:6px}
.mem-g{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.mi{background:rgba(0,0,0,.25);border-radius:7px;padding:9px 11px;text-align:center}
.miv{font-size:22px;font-weight:700;color:var(--txt);margin-bottom:2px}
.mil{font-size:9.5px;color:var(--mu);text-transform:uppercase;letter-spacing:.05em}
.tools{display:flex;flex-wrap:wrap;gap:6px;margin-top:9px}
.tc{background:var(--s1);border:1px solid var(--brd);border-radius:6px;padding:3px 10px;font-size:10.5px;color:var(--mu2)}
.tc.used{background:var(--ad);border-color:rgba(251,204,37,.3);color:var(--amber)}

/* ── Download box ── */
.dlb{background:var(--gd);border:1px solid var(--gb);border-radius:12px;padding:16px;margin-top:16px}
.dlt{font-size:12px;font-weight:700;color:var(--green);margin-bottom:10px;display:flex;align-items:center;gap:6px}
.file-chip{display:inline-flex;align-items:center;gap:6px;background:rgba(0,0,0,.3);border:1px solid var(--gb);border-radius:8px;padding:6px 12px;font-size:12px;color:var(--green);font-weight:500}

/* ── Preview ── */
.pv{background:rgba(0,0,0,.3);border:1px solid var(--brd);border-radius:10px;padding:16px;margin-top:14px;max-height:280px;overflow-y:auto}
.pvl{font-size:10px;color:var(--mu);text-transform:uppercase;letter-spacing:.08em;margin-bottom:12px;display:flex;align-items:center;gap:8px}
.pvl::after{content:'';flex:1;height:1px;background:var(--brd)}
.pvs{margin-bottom:12px;padding-bottom:12px;border-bottom:1px solid var(--brd)}
.pvs:last-child{border-bottom:none;margin:0;padding:0}
.pvs h3{font-size:10px;font-weight:700;color:var(--blue);text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px}
.pvs p,.pvs li{font-size:11.5px;color:var(--mu2);line-height:1.65}
.pvs ul{padding-left:14px}

/* ── Notif ── */
.ni{display:flex;align-items:center;gap:8px;padding:10px 13px;border-radius:8px;font-size:12.5px;margin-top:10px}
.nii{background:var(--bd);border:1px solid var(--bb);color:#93b4ff}
.ns{background:var(--gd);border:1px solid var(--gb);color:#86efac}
.ne{background:var(--rd);border:1px solid var(--rb);color:#fca5a5}

/* ── Skip bar ── */
.sb{margin-top:12px;padding-top:12px;border-top:1px solid var(--brd);display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.sb p{font-size:11.5px;color:var(--mu);flex:1}
.chk{display:flex;align-items:center;gap:7px;cursor:pointer;font-size:12px;color:var(--mu2)}
.chk input{accent-color:var(--blue)}

/* ── Footer ── */
.ftr{margin-top:60px;padding:20px 0;border-top:1px solid var(--brd);text-align:center;color:var(--mu);font-size:11px}

/* ── Server status ── */
.srvbadge{display:inline-flex;align-items:center;gap:6px;font-size:11px;padding:4px 12px;border-radius:100px;background:var(--gd);border:1px solid var(--gb);color:var(--green);margin-top:8px}
.srvbadge.off{background:var(--rd);border-color:var(--rb);color:var(--red)}
.srv-dot{width:5px;height:5px;border-radius:50%;background:currentColor}
`;

// ── Zone d'import ─────────────────────────────────────────────────────────────
const BINARY_EXTS = ["docx", "pptx", "ppt", "doc"];

function ImportZone({ label, onImport, imported, hint = "auto" }) {
  const [drag,    setDrag]    = useState(false);
  const [err,     setErr]     = useState("");
  const [loading, setLoading] = useState(false);
  const ref = useRef();

  function getExt(fname) { return (fname || "").split(".").pop().toLowerCase(); }

  /** Fichiers texte / JSON — lecture directe */
  function handleText(text, fname) {
    setErr("");
    const d = parseImportedFile(text);
    if (!d) { setErr("Format non reconnu — attendu : JSON, DOCX ou PPTX."); return; }
    onImport(d, fname);
  }

  /** Fichiers binaires (DOCX, PPTX, PPT) — envoi base64 au backend */
  async function handleBinary(buffer, fname) {
    setErr("");
    setLoading(true);
    try {
      const bytes = new Uint8Array(buffer);
      let binary = "";
      for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
      const b64 = btoa(binary);
      const res  = await fetch(`${API_BASE}/parse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: fname, data: b64, hint }),
      });
      const json = await res.json();
      if (!json.ok) { setErr(json.error || "Erreur lors du parsing."); return; }
      if (!json.data) { setErr("Aucune donnée extraite du fichier."); return; }
      onImport(json.data, fname);
    } catch (e) {
      setErr("Erreur réseau : " + e.message);
    } finally {
      setLoading(false);
    }
  }

  function processFile(f) {
    if (!f) return;
    const ext = getExt(f.name);
    if (BINARY_EXTS.includes(ext)) {
      const r = new FileReader();
      r.onload = ev => handleBinary(ev.target.result, f.name);
      r.readAsArrayBuffer(f);
    } else {
      const r = new FileReader();
      r.onload = ev => handleText(ev.target.result, f.name);
      r.readAsText(f);
    }
  }

  return (
    <div className={`iz${drag?" drag":""}${imported?" ok":""}${err?" er":""}`}
      onDragOver={e=>{e.preventDefault();setDrag(true)}} onDragLeave={()=>setDrag(false)}
      onDrop={e=>{e.preventDefault();setDrag(false);processFile(e.dataTransfer.files[0]);}}
      onClick={()=>!loading&&ref.current.click()}>
      <input ref={ref} type="file" accept=".json,.txt,.docx,.pptx,.ppt,.doc" style={{display:"none"}}
        onChange={e=>{processFile(e.target.files[0]);e.target.value="";}}/>
      <div className="iz-ic">{loading?"⏳":imported?"✅":"📁"}</div>
      <div className="iz-t">{loading?"Analyse en cours…":imported?"Fichier importé ✓":label}</div>
      <div className="iz-d">{imported?"Cliquez pour remplacer":"Glissez-déposez ou cliquez — DOCX · PPTX · PPT · JSON"}</div>
      {imported && <div className="iz-ok">Thème : {imported.theme||"?"} · {Object.keys(imported).length} champs chargés</div>}
      {err && <div className="iz-e">⚠ {err}</div>}
    </div>
  );
}

// ── Aperçu de données ─────────────────────────────────────────────────────────
function Preview({ data, type }) {
  if (!data) return null;
  const s = (title, content) => (
    <div className="pvs" key={title}>
      <h3>{title}</h3>
      {typeof content === "string" && <p>{content.slice(0, 200)}{content.length>200?"…":""}</p>}
      {Array.isArray(content) && <ul>{content.slice(0,4).map((x,i)=><li key={i}>{typeof x==="object"?(x.hypothese||x.titre||Object.values(x)[0]):String(x)}</li>)}</ul>}
      {typeof content === "object" && content !== null && !Array.isArray(content) && <ul>{Object.entries(content).slice(0,4).map(([k,v])=><li key={k}><b>{k}</b>: {String(v).slice(0,60)}</li>)}</ul>}
    </div>
  );
  return (
    <div className="pv">
      <div className="pvl">Aperçu du contenu généré</div>
      {type==="pa" && <>{s("Thème",data.theme)}{s("Mots clés",data.mots_cles)}{s("Contexte",data.contexte)}{s("Problématique",data.problematique)}{s("Plan d'action",data.plan_action)}</>}
      {type==="pr" && <>{s("Thème",data.theme)}{s("Définitions",data.definitions)}{s("Validation",data.validation_hypotheses)}{s("Bilan",data.bilan)}</>}
      {type==="cer" && <>{s("Thème",data.theme)}{s("Obj. Savoir",data.objectifs_savoir)}{s("Obj. Savoir-faire",data.objectifs_savoir_faire)}{s("Réalisation",data.realisation?.map(r=>r.titre))}{s("Conclusion",data.conclusion)}</>}
    </div>
  );
}

// ── APP ───────────────────────────────────────────────────────────────────────
export default function App() {
  const [mode,       setMode]       = useState(null);
  const [theme,      setTheme]      = useState("");
  const [rawInput,   setRawInput]   = useState("");
  const [skipPR,     setSkipPR]     = useState(false);

  const [impPA, setImpPA] = useState(null);
  const [impPR, setImpPR] = useState(null);

  // Résultats
  const [pa,  setPa]  = useState(null);
  const [pr,  setPr]  = useState(null);
  const [cer, setCer] = useState(null);
  const [files, setFiles] = useState({});  // { prositAller: "01_PA_xxx.docx", ... }

  // État pipeline
  const [phase,      setPhase]      = useState("idle");    // idle | running | done | error
  const [agentA,     setAgentA]     = useState(null);
  const [logs,       setLogs]       = useState([]);
  const [tools,      setTools]      = useState([]);
  const [stepMsg,    setStepMsg]    = useState("");
  const [error,      setError]      = useState("");
  const [srvOk,      setSrvOk]      = useState(null);

  const logRef = useRef(null);

  // Vérifier si le serveur est disponible
  useEffect(() => {
    fetch(`${API_BASE}/status`).then(r=>r.json()).then(()=>setSrvOk(true)).catch(()=>setSrvOk(false));
  }, []);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  // Labels agent → style
  const agentClass = { orchestrator:"lo", agent1:"la1", agent2:"la2", agent3:"la3" };
  const agentLabel = { orchestrator:"🎯 Orch.", agent1:"🔵 Ag.1", agent2:"🟣 Ag.2", agent3:"🟢 Ag.3" };
  const typeClass  = { thought:"ltt", action:"lac", observation:"lob", result:"lrs" };

  async function launchPipeline() {
    setPhase("running"); setError(""); setLogs([]); setTools([]);
    setPa(null); setPr(null); setCer(null); setFiles({});

    const body = {
      mode,
      skipPR,
      student:   STUDENT,
      promotion: PROMOTION,
      annee:     ANNEE,
    };

    if (mode === "full") {
      body.theme    = theme;
      body.rawInput = rawInput;
    } else if (mode === "from_pa") {
      body.theme       = impPA?.theme || theme;
      body.prositAller = impPA;
    } else if (mode === "from_pr") {
      body.theme        = impPR?.theme || theme;
      body.prositRetour = impPR;
    }

    try {
      const res = await fetch(`${API_BASE}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const reader = res.body.getReader();
      const dec    = new TextDecoder();
      let   buf    = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });

        // Parse SSE lines
        const lines = buf.split("\n\n");
        buf = lines.pop(); // garder le fragment incomplet

        for (const block of lines) {
          const eventLine = block.split("\n");
          let evType = "message", evData = "";
          for (const line of eventLine) {
            if (line.startsWith("event: ")) evType = line.slice(7).trim();
            if (line.startsWith("data: "))  evData = line.slice(6).trim();
          }
          if (!evData) continue;
          const d = JSON.parse(evData);

          if (evType === "log") {
            // Détecter les appels d'outils dans les messages d'action
            if (d.type === "action" && d.msg.includes("outil")) {
              const toolMatch = d.msg.match(/outil (\w+)/i);
              if (toolMatch) setTools(t => [...new Set([...t, toolMatch[1]])]);
            }
            // Détecter l'agent actif
            if (d.agent === "agent1") setAgentA(1);
            else if (d.agent === "agent2") setAgentA(2);
            else if (d.agent === "agent3") setAgentA(3);

            setLogs(l => [...l, d]);
          } else if (evType === "step") {
            setStepMsg(d.msg);
          } else if (evType === "done") {
            setFiles(d.files || {});
            if (d.prositAller)  setPa(d.prositAller);
            if (d.prositRetour) setPr(d.prositRetour);
            if (d.cer)          setCer(d.cer);
            setPhase("done"); setAgentA(null); setStepMsg("");
          } else if (evType === "error") {
            setError(d.message); setPhase("error"); setAgentA(null); setStepMsg("");
          }
        }
      }
    } catch (e) {
      setError(`Impossible de joindre le serveur. Vérifiez que server.js tourne sur ${API_BASE}\n${e.message}`);
      setPhase("error");
    }
  }

  const canRun = () => {
    if (phase === "running" || !srvOk) return false;
    if (mode === "full")    return theme.trim().length > 0;
    if (mode === "from_pa") return !!impPA;
    if (mode === "from_pr") return !!impPR;
    return false;
  };

  const showPA = pa || impPA;
  const showPR = pr || impPR;

  const steps = [
    { n:1, lbl:"Agent 01", nm:"Prosit Aller",
      st: mode==="from_pa"||mode==="from_pr" ? "skip" : pa?"done":agentA===1?"active":"idle" },
    { n:2, lbl:"Agent 02", nm:"Prosit Retour",
      st: mode==="from_pr"||skipPR ? "skip" : pr?"done":agentA===2?"active":"idle" },
    { n:3, lbl:"Agent 03", nm:"CER",
      st: cer?"done":agentA===3?"active":"idle" },
  ];

  const TOOLS_ALL = ["validate_structure","check_coherence","analyze_memory"];

  return (
    <>
      <style>{CSS}</style>
      <div className="app">
        {/* ── Header ── */}
        <div className="hdr">
          <div className="pill"><span className="dot"/>Système Multi-Agents IA · UCAC-ICAM</div>
          <h1>Prosit & CER<br/><em>Agents IA Réels</em></h1>
          <div className="sub">{STUDENT} · {PROMOTION} · Architecture ReAct avec mémoire partagée et outils</div>
          <div>
            {srvOk === null && <div className="srvbadge">⏳ Vérification serveur…</div>}
            {srvOk === true  && <div className="srvbadge"><span className="srv-dot"/>Serveur connecté · {API_BASE}</div>}
            {srvOk === false && <div className="srvbadge off"><span className="srv-dot"/>Serveur hors-ligne — lancez : <code>node server.js</code></div>}
          </div>
          <div style={{marginTop:10}}>
            <div className="arch-badge">✓ Vrais fichiers DOCX + PPTX générés sur disque</div>
          </div>
        </div>

        {/* ── Mode selector (avant lancement) ── */}
        {phase === "idle" && !mode && (
          <>
            <div className="flbl" style={{marginTop:28,marginBottom:10}}>Choisissez votre point de départ</div>
            <div className="modes">
              {[
                { id:"full",    ico:"🚀", t:"Tout générer", d:"Je pars d'une thématique. Les 3 agents s'enchaînent automatiquement." },
                { id:"from_pa", ico:"📄", t:"J'ai le Prosit Aller", d:"J'importe mon PA (DOCX, PPTX ou JSON). Agents 2 et 3 prennent le relais." },
                { id:"from_pr", ico:"📊", t:"J'ai le Prosit Retour", d:"J'importe mon PR (DOCX, PPTX ou JSON). L'Agent 3 génère le CER seul." },
              ].map(m => (
                <div key={m.id} className={`mode${mode===m.id?" sel":""}`} onClick={()=>setMode(m.id)}>
                  <div className="mode-ico">{m.ico}</div>
                  <div className="mode-ttl">{m.t}</div>
                  <div className="mode-dsc">{m.d}</div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── Pipeline ── */}
        {mode && (
          <div className="pipe">
            {steps.map((s,i) => (
              <div key={s.n} style={{display:"flex",alignItems:"center",flex:1}}>
                <div className={`ps ${s.st==="active"?"active":s.st==="done"?"done":s.st==="skip"?"skip":""}`}>
                  <div className="pnum">{s.st==="done"?"✓":s.st==="skip"?"–":s.n}</div>
                  <div><div className="plbl">{s.lbl}</div><div className="pnm">{s.nm}</div></div>
                </div>
                {i<2&&<div className="parr">›</div>}
              </div>
            ))}
          </div>
        )}

        {/* ── Formulaire mode FULL ── */}
        {mode === "full" && phase === "idle" && (
          <div className="card act">
            <div className="chead">
              <div className="cico i1">⚙️</div>
              <div><div className="cttl">Configuration du pipeline complet</div><div className="cdsc">Les 3 agents s'exécutent en séquence</div></div>
            </div>
            <div className="cbdy">
              <div className="fg"><div className="flbl">Thématique *</div>
                <input className="fi" placeholder="Ex: Management des risques, Cybersécurité des SI…" value={theme} onChange={e=>setTheme(e.target.value)}/>
              </div>
              <div className="fg"><div className="flbl">Texte de situation (optionnel)</div>
                <textarea className="fi ta" placeholder="Collez ici le texte déclencheur du prosit si vous en avez un…" value={rawInput} onChange={e=>setRawInput(e.target.value)}/>
              </div>
              <div className="sb">
                <p>L'Agent 2 (Prosit Retour) peut être ignoré.</p>
                <label className="chk"><input type="checkbox" checked={skipPR} onChange={e=>setSkipPR(e.target.checked)}/>Sauter le Prosit Retour</label>
              </div>
              <div className="row">
                <button className="btn bp" disabled={!canRun()} onClick={launchPipeline}>🚀 Lancer les agents</button>
                <button className="btn bs" onClick={()=>setMode(null)}>← Retour</button>
              </div>
            </div>
          </div>
        )}

        {/* ── Import PA ── */}
        {mode === "from_pa" && phase === "idle" && (
          <div className="card act">
            <div className="chead">
              <div className="cico i1">📄</div>
              <div><div className="cttl">Import Prosit Aller</div><div className="cdsc">Agents 2 et 3 prendront le relais</div></div>
            </div>
            <div className="cbdy">
              <div className="fg"><div className="flbl">Votre fichier Prosit Aller (JSON / DOCX / PPTX)</div>
                <ImportZone label="Importer le Prosit Aller" onImport={d=>setImpPA(d)} imported={impPA} hint="prosit_aller"/>
              </div>
              {impPA && <>
                <div className="ni ns">✓ Chargé — Thème : {impPA.theme}</div>
                <Preview data={impPA} type="pa"/>
                <div className="sb">
                  <p>Voulez-vous générer le Prosit Retour ?</p>
                  <label className="chk"><input type="checkbox" checked={skipPR} onChange={e=>setSkipPR(e.target.checked)}/>Non — aller directement au CER</label>
                </div>
              </>}
              <div className="row">
                <button className="btn bp" disabled={!canRun()} onClick={launchPipeline}>🚀 Lancer les agents</button>
                <button className="btn bs" onClick={()=>{setMode(null);setImpPA(null)}}>← Retour</button>
              </div>
            </div>
          </div>
        )}

        {/* ── Import PR ── */}
        {mode === "from_pr" && phase === "idle" && (
          <div className="card act">
            <div className="chead">
              <div className="cico i2">📊</div>
              <div><div className="cttl">Import Prosit Retour</div><div className="cdsc">L'Agent 3 génère le CER</div></div>
            </div>
            <div className="cbdy">
              <div className="fg"><div className="flbl">Votre fichier Prosit Retour (JSON / DOCX / PPTX)</div>
                <ImportZone label="Importer le Prosit Retour" onImport={d=>setImpPR(d)} imported={impPR} hint="prosit_retour"/>
              </div>
              {impPR && <>
                <div className="ni ns">✓ Chargé — Thème : {impPR.theme}</div>
                <Preview data={impPR} type="pr"/>
              </>}
              <div className="row">
                <button className="btn bp" disabled={!canRun()} onClick={launchPipeline}>🚀 Lancer Agent 3 (CER)</button>
                <button className="btn bs" onClick={()=>{setMode(null);setImpPR(null)}}>← Retour</button>
              </div>
            </div>
          </div>
        )}

        {/* ── Running / Done ── */}
        {phase !== "idle" && (
          <>
            {/* Mémoire partagée */}
            <div className="mem">
              <div className="mem-t">🗂 Mémoire partagée des agents</div>
              <div className="mem-g">
                <div className="mi"><div className="miv">{showPA?"✓":"–"}</div><div className="mil">Prosit Aller</div></div>
                <div className="mi"><div className="miv">{skipPR?"⏭":showPR?"✓":"–"}</div><div className="mil">Prosit Retour</div></div>
                <div className="mi"><div className="miv">{cer?"✓":"–"}</div><div className="mil">CER</div></div>
              </div>
              <div className="tools">
                {TOOLS_ALL.map(t => <span key={t} className={`tc${tools.includes(t)?" used":""}`}>⚙ {t}</span>)}
              </div>
            </div>

            {/* Journal temps réel */}
            {logs.length > 0 && (
              <div className="log" ref={logRef}>
                {logs.map((l,i) => (
                  <div key={i} className="lr">
                    <span className={`la ${agentClass[l.agent]||"lo"}`}>{agentLabel[l.agent]||l.agent}</span>
                    <span className={`lt ${typeClass[l.type]||"ltt"}`}>{l.type}</span>
                    <span className="lm">{l.msg}</span>
                  </div>
                ))}
                {phase==="running" && stepMsg && (
                  <div className="lr"><span className="la lo">⏳</span><span className="lt ltt">status</span><span className="lm cstep">{stepMsg}</span></div>
                )}
              </div>
            )}

            {phase === "error" && <div className="ni ne" style={{marginTop:14}}>⚠ {error}</div>}

            {/* Résultat Agent 1 */}
            {showPA && (
              <div className="card dn" style={{marginTop:14}}>
                <div className="chead">
                  <div className="cico i1">📝</div>
                  <div style={{flex:1}}><div className="cttl">Agent 01 — Prosit Aller</div><div className="cdsc">Fichier DOCX généré</div></div>
                  <span className="stbg sg">✓ Terminé</span>
                </div>
                <div className="cbdy">
                  <Preview data={showPA} type="pa"/>
                  {files.prositAller && (
                    <div className="dlb">
                      <div className="dlt">↓ Téléchargement</div>
                      <div className="file-chip">📄 {files.prositAller}</div>
                      <div className="row" style={{marginTop:10}}>
                        <button className="btn bg" onClick={()=>downloadFromServer(files.prositAller)}>⬇ Télécharger DOCX</button>
                        <button className="btn bs" onClick={()=>{const b=new Blob([JSON.stringify(showPA,null,2)],{type:"application/json"});const u=URL.createObjectURL(b);const a=document.createElement("a");a.href=u;a.download=`PA_${showPA.theme||"export"}.json`;a.click();URL.revokeObjectURL(u);}}>⬇ JSON</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Résultat Agent 2 */}
            {showPR && (
              <div className="card dn">
                <div className="chead">
                  <div className="cico i2">🔁</div>
                  <div style={{flex:1}}><div className="cttl">Agent 02 — Prosit Retour</div><div className="cdsc">Fichier PPTX généré (12 slides)</div></div>
                  <span className="stbg sg">✓ Terminé</span>
                </div>
                <div className="cbdy">
                  <Preview data={showPR} type="pr"/>
                  {files.prositRetour && (
                    <div className="dlb">
                      <div className="dlt">↓ Téléchargement</div>
                      <div className="file-chip">📊 {files.prositRetour}</div>
                      <div className="row" style={{marginTop:10}}>
                        <button className="btn bg" onClick={()=>downloadFromServer(files.prositRetour)}>⬇ Télécharger PPTX</button>
                        <button className="btn bs" onClick={()=>{const b=new Blob([JSON.stringify(showPR,null,2)],{type:"application/json"});const u=URL.createObjectURL(b);const a=document.createElement("a");a.href=u;a.download=`PR_${showPR.theme||"export"}.json`;a.click();URL.revokeObjectURL(u);}}>⬇ JSON</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Résultat Agent 3 */}
            {cer && (
              <div className="card dn">
                <div className="chead">
                  <div className="cico i3">📘</div>
                  <div style={{flex:1}}><div className="cttl">Agent 03 — CER</div><div className="cdsc">Cahier d'Étude et de Recherche · DOCX généré · {STUDENT} · {PROMOTION}</div></div>
                  <span className="stbg sg">✓ Terminé</span>
                </div>
                <div className="cbdy">
                  <Preview data={cer} type="cer"/>
                  {files.cer && (
                    <div className="dlb">
                      <div className="dlt">↓ Téléchargement</div>
                      <div className="file-chip">📘 {files.cer}</div>
                      <div className="row" style={{marginTop:10}}>
                        <button className="btn bg" onClick={()=>downloadFromServer(files.cer)}>⬇ Télécharger DOCX CER</button>
                        <button className="btn bs" onClick={()=>{const b=new Blob([JSON.stringify(cer,null,2)],{type:"application/json"});const u=URL.createObjectURL(b);const a=document.createElement("a");a.href=u;a.download=`CER_${cer.theme||"export"}.json`;a.click();URL.revokeObjectURL(u);}}>⬇ JSON</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {phase === "done" && (
              <div style={{marginTop:20}}>
                <button className="btn bs" onClick={()=>{
                  setPhase("idle");setMode(null);setTheme("");setRawInput("");
                  setPa(null);setPr(null);setCer(null);setFiles({});
                  setImpPA(null);setImpPR(null);setLogs([]);setTools([]);setSkipPR(false);
                }}>↺ Nouvelle session</button>
              </div>
            )}
          </>
        )}

        <div className="ftr">UCAC-ICAM · Système Multi-Agents IA · {STUDENT} · {PROMOTION} · {ANNEE}</div>
      </div>
    </>
  );
}
