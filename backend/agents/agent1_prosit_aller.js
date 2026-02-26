/**
 * agents/agent1_prosit_aller.js
 *
 * AGENT 1 — Architecte du Prosit Aller
 * ──────────────────────────────────────────────────────────────────────────────
 * Architecture ReAct (Reasoning + Acting) :
 *   Thought → Action → Observation → Thought → Action → ...
 *
 * Cycle complet :
 *   1. Thought   : analyse la thématique et planifie le contenu
 *   2. Action    : appelle LLM pour générer le Prosit Aller (JSON)
 *   3. Action    : valide la structure avec l'outil validate_structure()
 *   4. Observation : lit le score de qualité
 *   5. Thought   : décide si une correction est nécessaire
 *   6. Action    : (si besoin) appelle LLM pour corriger
 *   7. Action    : appelle le générateur DOCX → écrit le fichier
 *   8. Result    : écrit les données en mémoire partagée
 *
 * Outils disponibles :
 *   - validate_structure(data)  → { valid, errors, score }
 *
 * Mémoire partagée (lecture) : memory.theme, memory.rawInput
 * Mémoire partagée (écriture) : memory.prositAller, memory.files.prositAller
 */

"use strict";

const path = require("path");
const { generatePrositAllerDocx } = require("../generators/gen_docx_prosit_aller");
const { callLLM }   = require("../llm");
const { parseJSON } = require("../parse_json");

// ── Outil : validation de structure ──────────────────────────────────────────
/**
 * Vérifie que le Prosit Aller respecte les contraintes structurelles.
 * @param {object} data - Données PA à valider
 * @returns {{ valid: boolean, errors: string[], score: number }}
 */
function validate_structure(data) {
  const rules = [
    { field: "mots_cles",          check: d => Array.isArray(d) && d.length >= 6,                   msg: "≥6 mots clés requis"            },
    { field: "contexte",           check: d => typeof d === "string" && d.length >= 100,             msg: "contexte trop court (≥100 car.)" },
    { field: "definition_besoins", check: d => Array.isArray(d) && d.length >= 2,                   msg: "≥2 besoins requis"              },
    { field: "problematique",      check: d => typeof d === "string" && d.trim().endsWith("?"),      msg: "doit être une question (finir par ?)" },
    { field: "contraintes",        check: d => Array.isArray(d) && d.length >= 3,                   msg: "≥3 contraintes requises"        },
    { field: "generalisation",     check: d => typeof d === "string" && d.length >= 20,             msg: "généralisation trop courte"     },
    { field: "pistes_solution",    check: d => Array.isArray(d) && d.length >= 2,                   msg: "≥2 pistes de solution requises" },
    { field: "plan_action",        check: d => Array.isArray(d) && d.length >= 4,                   msg: "plan d'action : ≥4 étapes"      },
  ];
  const errors = rules.filter(r => !r.check(data[r.field] ?? "")).map(r => `[${r.field}] ${r.msg}`);
  return { valid: errors.length === 0, errors, score: Math.round(((rules.length - errors.length) / rules.length) * 100) };
}

// ── Boucle ReAct principale ───────────────────────────────────────────────────
/**
 * Exécute la boucle ReAct de l'Agent 1.
 * @param {object}   memory - Mémoire partagée (lue et écrite)
 * @param {function} onLog  - Callback(type, message) pour journaliser les étapes
 *                            types : "thought" | "action" | "observation" | "result"
 */
async function runAgent(memory, onLog) {
  // ── THOUGHT 1 : Analyse de la situation ─────────────────────────────────
  onLog("thought", `Lecture de la mémoire partagée. Thème reçu : "${memory.theme}".`);
  onLog("thought", "Je dois analyser le domaine avant de générer pour garantir la cohérence.");

  // ── ACTION 1 : Analyse et planification ─────────────────────────────────
  onLog("action", "Appel LLM — analyse du domaine et identification des enjeux.");
  const rawAnalysis = await callLLM(
    `Tu es l'Agent 1 du système UCAC-ICAM. Tu analyses une thématique d'ingénierie avant de rédiger un Prosit Aller.
Réponds UNIQUEMENT en JSON : {"domaine":"","enjeux":[""],"angle_problematique":"","mots_cles_candidats":[""]}`,
    [{ role: "user", content: `Thématique : "${memory.theme}"\nContexte fourni : ${memory.rawInput || "Aucun — génère un contexte professionnel réaliste UCAC-ICAM."}` }]
  );
  const analysis = parseJSON(rawAnalysis);

  // ── OBSERVATION 1 : Résultats de l'analyse ───────────────────────────────
  onLog("observation", `Domaine : ${analysis.domaine} | Enjeux : ${analysis.enjeux?.join(", ")}`);
  onLog("observation", `Angle problématique retenu : ${analysis.angle_problematique}`);

  // ── THOUGHT 2 : Décision de génération ──────────────────────────────────
  onLog("thought", "L'analyse est satisfaisante. Je génère maintenant le Prosit Aller structuré.");

  // ── ACTION 2 : Génération du Prosit Aller ────────────────────────────────
  onLog("action", "Appel LLM — génération du Prosit Aller complet au format JSON.");
  const rawPA = await callLLM(
    `Tu es l'Agent 1 UCAC-ICAM, expert en rédaction de Prosit Aller pour écoles d'ingénieurs.
Génère un Prosit Aller COMPLET et DÉTAILLÉ en JSON strict.

Format attendu (respecte EXACTEMENT les clés) :
{
  "theme": "string",
  "mots_cles": ["string", ...],
  "contexte": "Paragraphe détaillé de 3-5 phrases décrivant la situation professionnelle réelle",
  "definition_besoins": ["Besoin 1", "Besoin 2", "Besoin 3"],
  "problematique": "Question centrale complète se terminant par ?",
  "contraintes": ["Contrainte technique", "Contrainte organisationnelle", "Contrainte humaine", ...],
  "generalisation": "Formulation générique du problème applicable à d'autres contextes",
  "pistes_solution": ["Piste 1 en forme de question ?", "Piste 2 ?", "Piste 3 ?"],
  "plan_action": ["Étape 1 : ...", "Étape 2 : ...", "Étape 3 : ...", "Étape 4 : ..."]
}

CONTRAINTES STRICTES :
- mots_cles : ≥8 termes techniques précis
- contexte : ≥150 caractères, décrit une situation professionnelle concrète
- problematique : phrase complète terminant par ?
- contraintes : ≥4 contraintes variées (technique, budget, délai, humain)
- pistes_solution : ≥3 pistes formulées en questions
- plan_action : exactement 4 étapes numérotées et détaillées
Réponds UNIQUEMENT en JSON valide, sans markdown, sans commentaires.`,
    [{
      role: "user",
      content: `Thématique : "${memory.theme}"
Analyse préalable : ${JSON.stringify(analysis)}
Contexte brut : ${memory.rawInput || ""}
Génère le Prosit Aller complet.`
    }],
    3500
  );
  let pa = parseJSON(rawPA);
  pa.theme = pa.theme || memory.theme;

  // ── ACTION 3 : Validation avec outil ─────────────────────────────────────
  onLog("action", "Appel outil validate_structure — contrôle qualité du contenu généré.");
  const v1 = validate_structure(pa);

  // ── OBSERVATION 2 : Résultat de la validation ────────────────────────────
  onLog("observation", `Score qualité : ${v1.score}% | Erreurs : ${v1.errors.join("; ") || "aucune ✓"}`);

  // ── THOUGHT 3 : Décision de correction ──────────────────────────────────
  if (!v1.valid) {
    onLog("thought", `Score ${v1.score}% insuffisant. Correction ciblée sur : ${v1.errors.join(", ")}`);

    // ── ACTION 4 : Auto-correction ──────────────────────────────────────────
    onLog("action", "Appel LLM — correction ciblée des champs défaillants.");
    const rawFixed = await callLLM(
      `Tu corriges un Prosit Aller incomplet. Corrige UNIQUEMENT les champs suivants et retourne le JSON complet corrigé.
Problèmes détectés : ${v1.errors.join(" | ")}
Retourne le JSON complet sans markdown.`,
      [{ role: "user", content: JSON.stringify(pa, null, 2) }],
      3500
    );
    const fixed = parseJSON(rawFixed);
    pa = { ...pa, ...fixed };

    const v2 = validate_structure(pa);
    onLog("observation", `Score après correction : ${v2.score}% | Erreurs restantes : ${v2.errors.join("; ") || "aucune ✓"}`);
    onLog("thought", v2.valid ? "Correction réussie. Procédure de génération DOCX." : `Score final ${v2.score}% — génération DOCX avec le meilleur contenu disponible.`);
  } else {
    onLog("thought", `Score ${v1.score}% excellent. Aucune correction nécessaire. Génération DOCX.`);
  }

  // ── ACTION 5 : Écriture en mémoire partagée ──────────────────────────────
  memory.prositAller = pa;
  onLog("action", "Écriture des données Prosit Aller en mémoire partagée.");

  // ── ACTION 6 : Génération du fichier DOCX ────────────────────────────────
  const outputPath = path.join(memory.outputDir, `01_Prosit_Aller_${memory.slug}.docx`);
  onLog("action", `Appel générateur DOCX → ${outputPath}`);
  await generatePrositAllerDocx(pa, memory, outputPath);
  memory.files.prositAller = outputPath;

  // ── RESULT ────────────────────────────────────────────────────────────────
  onLog("result", `✓ Prosit Aller terminé. Fichier : ${path.basename(outputPath)} | ${(pa.mots_cles || []).length} mots clés | ${(pa.plan_action || []).length} étapes`);
  return pa;
}

module.exports = { runAgent };
