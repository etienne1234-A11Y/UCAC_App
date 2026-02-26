/**
 * orchestrator.js
 *
 * ORCHESTRATEUR — Système Multi-Agents UCAC-ICAM
 * ──────────────────────────────────────────────────────────────────────────────
 * Coordonne les 3 agents selon le mode d'exécution choisi :
 *
 *   "full"      → Agent 1 (PA) → Agent 2 (PR) → Agent 3 (CER)
 *   "from_pa"   → Agent 2 (PR) → Agent 3 (CER)  [PA importé]
 *   "from_pr"   → Agent 3 (CER) uniquement        [PR importé]
 *
 * L'orchestrateur gère la mémoire partagée et décide du chemin d'exécution.
 *
 * Usage depuis la React app (via fetch API) ou en ligne de commande :
 *   const { createMemory, run } = require('./orchestrator');
 *   const memory = createMemory({ theme: "...", student: "...", outputDir: "..." });
 *   const result = await run(memory, "full", false, onLog, onStep);
 *
 * Usage CLI :
 *   node orchestrator.js --theme "Gestion des risques" --mode full
 *
 * Fichiers générés dans memory.outputDir :
 *   01_Prosit_Aller_[slug].docx
 *   02_Prosit_Retour_[slug].pptx
 *   03_CER_[slug].docx
 */

"use strict";

const path   = require("path");
const fs     = require("fs");
const Agent1 = require("./agents/agent1_prosit_aller");
const Agent2 = require("./agents/agent2_prosit_retour");
const Agent3 = require("./agents/agent3_cer");

// ── Mémoire partagée ──────────────────────────────────────────────────────────
/**
 * Crée et initialise la mémoire partagée utilisée par tous les agents.
 *
 * @param {object} params
 * @param {string} params.theme        - Thématique du prosit (obligatoire)
 * @param {string} [params.rawInput]   - Texte de situation brut (optionnel)
 * @param {string} [params.student]    - Nom complet de l'étudiant
 * @param {string} [params.promotion]  - Code promotion (ex: X2027)
 * @param {string} [params.annee]      - Année académique (ex: 2025 – 2026)
 * @param {string} [params.outputDir]  - Répertoire de sortie (défaut: ./output)
 * @param {object} [params.prositAller]  - Données PA importées (mode from_pa / from_pr)
 * @param {object} [params.prositRetour] - Données PR importées (mode from_pr)
 *
 * @returns {object} Mémoire partagée initialisée
 */
function createMemory(params) {
  const theme = params.theme || "Prosit";
  const slug  = theme
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")  // supprime accents
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 35);

  return {
    // ── Identité ─────────────────────────────────────────────────────────────
    theme,
    rawInput:    params.rawInput    || "",
    student:     params.student     || "MAYACK ETIENNE",
    promotion:   params.promotion   || "X2027",
    annee:       params.annee       || "2025 – 2026",
    slug,

    // ── Répertoire de sortie ──────────────────────────────────────────────────
    outputDir: params.outputDir || path.join(__dirname, "output"),

    // ── Données agents (lues/écrites par chaque agent) ─────────────────────
    prositAller:  params.prositAller  || null,   // écrit par Agent 1 ou importé
    prositRetour: params.prositRetour || null,   // écrit par Agent 2 ou importé
    cer:          null,                           // écrit par Agent 3

    // ── Fichiers générés ──────────────────────────────────────────────────────
    files: {
      prositAller:  null,   // chemin .docx
      prositRetour: null,   // chemin .pptx
      cer:          null,   // chemin .docx
    },

    // ── Journal et diagnostics ────────────────────────────────────────────────
    logs:               [],   // { agent, type, msg, ts }
    coherenceWarnings:  [],   // avertissements inter-agents

    startedAt: new Date().toISOString(),
  };
}

// ── Pipeline principal ────────────────────────────────────────────────────────
/**
 * Exécute le pipeline multi-agents selon le mode choisi.
 *
 * @param {object}   memory  - Mémoire partagée (from createMemory)
 * @param {string}   mode    - "full" | "from_pa" | "from_pr"
 * @param {boolean}  skipPR  - Si true, saute Agent 2 (même en mode "full")
 * @param {function} onLog   - Callback(agentName, type, message) pour le logging
 *                             agentName : "orchestrator"|"agent1"|"agent2"|"agent3"
 *                             type      : "thought"|"action"|"observation"|"result"
 * @param {function} onStep  - Callback(message) pour les étapes haut niveau
 *
 * @returns {object} { prositAller, prositRetour, cer, files, logs }
 */
async function run(memory, mode, skipPR, onLog, onStep) {
  // Assurer le répertoire de sortie
  fs.mkdirSync(memory.outputDir, { recursive: true });

  // Wrapper de log qui écrit aussi dans memory.logs
  const log = (agent, type, msg) => {
    const entry = { agent, type, msg, ts: new Date().toISOString() };
    memory.logs.push(entry);
    if (onLog) onLog(agent, type, msg);
  };

  const step = (msg) => { if (onStep) onStep(msg); };

  // ── Décision de l'orchestrateur ───────────────────────────────────────────
  log("orchestrator", "thought", `Mode d'exécution sélectionné : "${mode}" | skipPR : ${skipPR}`);
  log("orchestrator", "thought", `Thème : "${memory.theme}" | Étudiant : ${memory.student} | Promo : ${memory.promotion}`);
  log("orchestrator", "observation", `État mémoire initiale : PA=${!!memory.prositAller}, PR=${!!memory.prositRetour}`);
  log("orchestrator", "observation", `Répertoire de sortie : ${memory.outputDir}`);

  // ── AGENT 1 : Prosit Aller ────────────────────────────────────────────────
  if (mode === "full") {
    step("Lancement Agent 1 — Génération du Prosit Aller…");
    log("orchestrator", "action", "Délégation à Agent 1 (Prosit Aller).");
    await Agent1.runAgent(memory, (type, msg) => log("agent1", type, msg));
    log("orchestrator", "observation", `Agent 1 terminé → ${memory.files.prositAller ? path.basename(memory.files.prositAller) : "aucun fichier"}`);
  } else {
    log("orchestrator", "observation", `Agent 1 ignoré (mode="${mode}") — Prosit Aller déjà en mémoire.`);
    step("Prosit Aller déjà disponible — Agent 1 ignoré.");
  }

  // ── AGENT 2 : Prosit Retour ───────────────────────────────────────────────
  if (mode === "from_pr") {
    log("orchestrator", "observation", "Agent 2 ignoré — Prosit Retour importé directement.");
    step("Prosit Retour importé — Agent 2 ignoré.");
  } else if (skipPR) {
    log("orchestrator", "observation", "Agent 2 ignoré sur décision utilisateur (skipPR=true).");
    step("Prosit Retour ignoré — passage direct au CER.");
  } else {
    step("Lancement Agent 2 — Génération du Prosit Retour…");
    log("orchestrator", "action", "Délégation à Agent 2 (Prosit Retour).");
    await Agent2.runAgent(memory, (type, msg) => log("agent2", type, msg));
    log("orchestrator", "observation", `Agent 2 terminé → ${memory.files.prositRetour ? path.basename(memory.files.prositRetour) : "aucun fichier"}`);
  }

  // ── AGENT 3 : CER ─────────────────────────────────────────────────────────
  step("Lancement Agent 3 — Génération du CER…");
  log("orchestrator", "action", "Délégation à Agent 3 (CER).");
  await Agent3.runAgent(memory, (type, msg) => log("agent3", type, msg));
  log("orchestrator", "observation", `Agent 3 terminé → ${memory.files.cer ? path.basename(memory.files.cer) : "aucun fichier"}`);

  // ── Bilan final ───────────────────────────────────────────────────────────
  const generated = Object.values(memory.files).filter(Boolean).length;
  log("orchestrator", "result", `Pipeline complet. ${generated} fichier(s) généré(s). Avertissements : ${memory.coherenceWarnings.length}`);
  if (memory.coherenceWarnings.length > 0)
    log("orchestrator", "observation", `Avertissements cohérence : ${memory.coherenceWarnings.join(" | ")}`);

  return {
    prositAller:  memory.prositAller,
    prositRetour: memory.prositRetour,
    cer:          memory.cer,
    files:        memory.files,
    logs:         memory.logs,
  };
}

// ── Export module ─────────────────────────────────────────────────────────────
module.exports = { createMemory, run };

// ── CLI (usage direct : node orchestrator.js --theme "..." --mode full) ───────
if (require.main === module) {
  const args = process.argv.slice(2);
  const get  = (flag) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : null; };

  const theme  = get("--theme")  || "Gestion des risques en entreprise";
  const mode   = get("--mode")   || "full";
  const skipPR = args.includes("--skip-pr");
  const outDir = get("--output") || path.join(__dirname, "output");

  const memory = createMemory({ theme, outputDir: outDir });

  console.log(`\n${"═".repeat(60)}`);
  console.log(` UCAC-ICAM · Système Multi-Agents`);
  console.log(` Thème    : ${theme}`);
  console.log(` Mode     : ${mode}${skipPR ? " (sans PR)" : ""}`);
  console.log(` Sortie   : ${outDir}`);
  console.log(`${"═".repeat(60)}\n`);

  const colors = { thought: "\x1b[36m", action: "\x1b[33m", observation: "\x1b[90m", result: "\x1b[32m", reset: "\x1b[0m" };
  const agents  = { orchestrator: "\x1b[35m[Orchestr.]\x1b[0m", agent1: "\x1b[34m[Agent 1  ]\x1b[0m", agent2: "\x1b[33m[Agent 2  ]\x1b[0m", agent3: "\x1b[32m[Agent 3  ]\x1b[0m" };

  run(
    memory, mode, skipPR,
    (agent, type, msg) => console.log(`${agents[agent] || agent} ${(colors[type] || "")}[${type.padEnd(11)}]${colors.reset} ${msg}`),
    (msg) => console.log(`\n── ${msg}`)
  ).then(result => {
    console.log(`\n${"═".repeat(60)}`);
    console.log(" Fichiers générés :");
    Object.entries(result.files).forEach(([k, v]) => { if (v) console.log(`   ${k.padEnd(15)} → ${path.basename(v)}`); });
    console.log(`${"═".repeat(60)}\n`);
  }).catch(err => {
    console.error("\x1b[31m[ERREUR]\x1b[0m", err.message);
    process.exit(1);
  });
}
