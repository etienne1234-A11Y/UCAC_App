/**
 * agents/agent2_prosit_retour.js
 *
 * AGENT 2 — Chercheur du Prosit Retour
 * ──────────────────────────────────────────────────────────────────────────────
 * Architecture ReAct (Reasoning + Acting) :
 *   Thought → Action → Observation → Thought → ...
 *
 * Cycle complet :
 *   1. Thought   : lit le Prosit Aller depuis la mémoire partagée
 *   2. Action    : appelle LLM pour planifier les recherches
 *   3. Action    : appelle l'outil check_coherence(PA)
 *   4. Observation : note les éventuels problèmes de cohérence
 *   5. Action    : appelle LLM pour générer le Prosit Retour complet (JSON)
 *   6. Action    : appelle validate_structure()
 *   7. Observation : lit le score
 *   8. Action    : (si besoin) correction automatique
 *   9. Action    : appelle le générateur PPTX → écrit le fichier
 *  10. Result    : écrit les données en mémoire partagée
 *
 * Outils disponibles :
 *   - validate_structure(data)  → { valid, errors, score }
 *   - check_coherence(pa, pr)   → { coherent, issues }
 *
 * Mémoire partagée (lecture) : memory.prositAller
 * Mémoire partagée (écriture) : memory.prositRetour, memory.files.prositRetour
 */

"use strict";

const path = require("path");
const { generatePrositRetourPptx } = require("../generators/gen_pptx_prosit_retour");
const { callLLM }   = require("../llm");
const { parseJSON } = require("../parse_json");

// ── Outil : validation de structure ──────────────────────────────────────────
function validate_structure(data) {
  const rules = [
    { field: "definitions",            check: d => typeof d === "object" && Object.keys(d).length >= 4,     msg: "≥4 définitions requises"                  },
    { field: "contexte_rappel",        check: d => typeof d === "string" && d.length >= 80,                 msg: "contexte_rappel trop court"               },
    { field: "besoins",                check: d => Array.isArray(d) && d.length >= 2,                       msg: "≥2 besoins requis"                         },
    { field: "contraintes",            check: d => Array.isArray(d) && d.length >= 2,                       msg: "≥2 contraintes requises"                   },
    { field: "problematique",          check: d => typeof d === "string" && d.trim().endsWith("?"),         msg: "problematique doit finir par ?"            },
    { field: "validation_hypotheses",  check: d => Array.isArray(d) && d.length >= 2,                       msg: "≥2 validations d'hypothèses requises"      },
    { field: "plan_action",            check: d => Array.isArray(d) && d.length >= 3,                       msg: "≥3 étapes dans le plan d'action"           },
    { field: "solutions",              check: d => Array.isArray(d) && d.length >= 2,                       msg: "≥2 solutions requises"                     },
    { field: "bilan",                  check: d => typeof d === "string" && d.length >= 60,                 msg: "bilan trop court"                          },
  ];
  const errors = rules.filter(r => !r.check(data[r.field] ?? "")).map(r => `[${r.field}] ${r.msg}`);
  return { valid: errors.length === 0, errors, score: Math.round(((rules.length - errors.length) / rules.length) * 100) };
}

// ── Outil : vérification de cohérence PA ↔ PR ────────────────────────────────
/**
 * Vérifie la cohérence entre le Prosit Aller et le Prosit Retour.
 * @param {object} pa - Prosit Aller
 * @param {object} pr - Prosit Retour (partiel ou complet)
 * @returns {{ coherent: boolean, issues: string[] }}
 */
function check_coherence(pa, pr) {
  const issues = [];
  if (!pa) { issues.push("Prosit Aller absent de la mémoire"); return { coherent: false, issues }; }

  const paTheme = String(pa.theme || "").toLowerCase();
  const prTheme = String(pr?.theme || "").toLowerCase();
  if (prTheme && prTheme !== paTheme && !prTheme.includes(paTheme.slice(0, 10)))
    issues.push(`Thème incohérent : PA="${pa.theme}" vs PR="${pr?.theme}"`);

  const paHypos      = Array.isArray(pa.pistes_solution)    ? pa.pistes_solution.length    : 0;
  const prValidations = Array.isArray(pr?.validation_hypotheses) ? pr.validation_hypotheses.length : 0;
  if (paHypos > 0 && prValidations > 0 && prValidations < paHypos)
    issues.push(`Nombre de validations (${prValidations}) < pistes PA (${paHypos})`);

  const paMots = new Set((pa.mots_cles || []).map(m => String(m).toLowerCase()));
  const prDefs = new Set(Object.keys(pr?.definitions || {}).map(k => String(k).toLowerCase()));
  const missing = [...paMots].filter(m => ![...prDefs].some(d => d.includes(m.slice(0, 5))));
  if (missing.length > 2)
    issues.push(`Mots clés PA non définis dans PR : ${missing.slice(0, 3).join(", ")}`);

  return { coherent: issues.length === 0, issues };
}

// ── Boucle ReAct principale ───────────────────────────────────────────────────
async function runAgent(memory, onLog) {
  // ── THOUGHT 1 : Lecture de la mémoire ────────────────────────────────────
  if (!memory.prositAller)
    throw new Error("Agent 2 : Prosit Aller absent de la mémoire partagée. Agent 1 doit s'exécuter en premier.");

  const pa = memory.prositAller;
  onLog("thought", `Lecture du Prosit Aller depuis la mémoire. Thème : "${pa.theme}"`);
  onLog("thought", `${(pa.mots_cles || []).length} mots clés et ${(pa.pistes_solution || []).length} pistes à valider.`);

  // ── ACTION 1 : Planification des recherches ───────────────────────────────
  onLog("action", "Appel LLM — planification des recherches et identification des lacunes.");
  const rawPlan = await callLLM(
    `Tu es l'Agent 2 UCAC-ICAM, spécialisé en recherche et validation.
Tu reçois un Prosit Aller et tu dois planifier les recherches nécessaires pour le Prosit Retour.
Réponds UNIQUEMENT en JSON : {"themes_a_approfondir":[""],"hypotheses_a_valider":[""],"sources_pertinentes":[""],"point_critique":""}`,
    [{ role: "user", content: `Prosit Aller reçu :\n${JSON.stringify(pa, null, 2)}` }]
  );
  const plan = parseJSON(rawPlan);

  // ── OBSERVATION 1 : Plan de recherche ────────────────────────────────────
  onLog("observation", `Thèmes à approfondir : ${plan.themes_a_approfondir?.join(", ")}`);
  onLog("observation", `Point critique identifié : ${plan.point_critique}`);

  // ── ACTION 2 : Vérification de cohérence préalable ───────────────────────
  onLog("action", "Appel outil check_coherence — vérification PA avant génération.");
  const coherence0 = check_coherence(pa, null);
  onLog("observation", `Cohérence préalable PA : ${coherence0.coherent ? "✓ OK" : "⚠ " + coherence0.issues.join("; ")}`);

  // ── THOUGHT 2 : Décision de génération ───────────────────────────────────
  onLog("thought", "Plan de recherche validé. Génération du Prosit Retour complet.");

  // ── ACTION 3 : Génération du Prosit Retour ───────────────────────────────
  onLog("action", "Appel LLM — génération du Prosit Retour structuré (JSON).");
  const rawPR = await callLLM(
    `Tu es l'Agent 2 UCAC-ICAM. Tu génères le Prosit Retour COMPLET à partir du Prosit Aller reçu.
Tu as conduit des recherches approfondies sur : ${plan.themes_a_approfondir?.join(", ")}.

Format JSON attendu (respecte EXACTEMENT les clés) :
{
  "theme": "string (identique au PA)",
  "definitions": { "terme1": "définition précise et complète", ... },
  "contexte_rappel": "Rappel du contexte initial en 2-3 phrases",
  "besoins": ["Besoin 1", "Besoin 2", ...],
  "contraintes": ["Contrainte 1", ...],
  "problematique": "Problématique identique au PA, formulation interrogative se terminant par ?",
  "generalisation": "Généralisation du problème",
  "validation_hypotheses": [
    { "hypothese": "Texte de la piste de solution", "statut": "Validé", "justification": "Explication détaillée de pourquoi cette piste est validée ou invalidée" },
    ...
  ],
  "plan_action": ["Étape 1", "Étape 2", "Étape 3", "Étape 4"],
  "solutions": [
    { "titre": "Nom de la solution", "description": "Description concrète et détaillée (3-5 phrases)" },
    ...
  ],
  "bilan": "Bilan synthétique de ce Prosit Retour (2-3 paragraphes)"
}

CONTRAINTES STRICTES :
- definitions : TOUS les mots clés du PA doivent avoir une définition précise
- validation_hypotheses : CHAQUE piste du PA doit être validée ou invalidée avec justification
- solutions : ≥3 solutions concrètes et distinctes avec description détaillée
- bilan : ≥100 caractères, présente les enseignements principaux
Réponds UNIQUEMENT en JSON valide, sans markdown.`,
    [{
      role: "user",
      content: `Prosit Aller source :
${JSON.stringify(pa, null, 2)}

Plan de recherche :
${JSON.stringify(plan, null, 2)}

Génère le Prosit Retour complet.`
    }],
    5000
  );
  let pr = parseJSON(rawPR);
  pr.theme = pr.theme || pa.theme;

  // ── ACTION 4 : Validation avec outil ─────────────────────────────────────
  onLog("action", "Appel outil validate_structure — contrôle qualité du Prosit Retour.");
  const v1 = validate_structure(pr);
  onLog("observation", `Score qualité PR : ${v1.score}% | Erreurs : ${v1.errors.join("; ") || "aucune ✓"}`);

  // ── ACTION 5 : Vérification cohérence PA ↔ PR ─────────────────────────────
  onLog("action", "Appel outil check_coherence — vérification cohérence PA↔PR.");
  const coherence = check_coherence(pa, pr);
  if (!coherence.coherent) {
    onLog("observation", `⚠ Incohérences PA↔PR détectées : ${coherence.issues.join(" | ")}`);
    memory.coherenceWarnings.push(...coherence.issues);
  } else {
    onLog("observation", "Cohérence PA↔PR vérifiée ✓");
  }

  // ── THOUGHT 3 : Décision de correction ───────────────────────────────────
  if (!v1.valid) {
    onLog("thought", `Score ${v1.score}% insuffisant. Correction sur : ${v1.errors.join(", ")}`);

    // ── ACTION 6 : Auto-correction ────────────────────────────────────────
    onLog("action", "Appel LLM — correction ciblée des champs défaillants du PR.");
    const rawFixed = await callLLM(
      `Tu corriges un Prosit Retour incomplet. Corrige uniquement les champs défaillants et retourne le JSON complet.
Problèmes : ${v1.errors.join(" | ")}
Retourne le JSON complet sans markdown.`,
      [{ role: "user", content: JSON.stringify(pr, null, 2) }],
      5000
    );
    const fixed = parseJSON(rawFixed);
    pr = { ...pr, ...fixed };

    const v2 = validate_structure(pr);
    onLog("observation", `Score après correction : ${v2.score}%`);
  } else {
    onLog("thought", `Score ${v1.score}% excellent. Aucune correction nécessaire.`);
  }

  // ── ACTION 7 : Écriture en mémoire partagée ──────────────────────────────
  memory.prositRetour = pr;
  onLog("action", "Écriture du Prosit Retour en mémoire partagée.");

  // ── ACTION 8 : Génération du fichier PPTX ────────────────────────────────
  const outputPath = path.join(memory.outputDir, `02_Prosit_Retour_${memory.slug}.pptx`);
  onLog("action", `Appel générateur PPTX → ${outputPath}`);
  await generatePrositRetourPptx(pr, memory, outputPath);
  memory.files.prositRetour = outputPath;

  // ── RESULT ────────────────────────────────────────────────────────────────
  const nbDefs = Object.keys(pr.definitions || {}).length;
  const nbSols = (pr.solutions || []).length;
  const nbValid = (pr.validation_hypotheses || []).length;
  onLog("result", `✓ Prosit Retour terminé. Fichier : ${path.basename(outputPath)} | ${nbDefs} définitions | ${nbValid} validations | ${nbSols} solutions`);
  return pr;
}

module.exports = { runAgent };
