/**
 * agents/agent3_cer.js
 *
 * AGENT 3 — Rédacteur du CER (Cahier d'Étude et de Recherche)
 * ──────────────────────────────────────────────────────────────────────────────
 * Architecture ReAct (Reasoning + Acting) :
 *   Thought → Action → Observation → Thought → ...
 *
 * Cycle complet :
 *   1. Thought   : analyse la mémoire partagée (PA + PR si disponible)
 *   2. Action    : lit les logs des agents précédents pour capitaliser
 *   3. Action    : appelle LLM pour planifier le CER
 *   4. Observation : lit le plan et décide du niveau de détail
 *   5. Action    : appelle LLM pour générer le CER complet (JSON)
 *   6. Action    : appelle validate_structure()
 *   7. Observation : lit le score
 *   8. Action    : (si besoin) correction automatique
 *   9. Action    : appelle le générateur DOCX → écrit le fichier
 *  10. Result    : écrit les données en mémoire partagée
 *
 * Outils disponibles :
 *   - validate_structure(data)   → { valid, errors, score }
 *   - analyze_memory(memory)     → { source, qualitySignals }
 *
 * Mémoire partagée (lecture) : memory.prositAller, memory.prositRetour, memory.logs
 * Mémoire partagée (écriture) : memory.cer, memory.files.cer
 */

"use strict";

const path = require("path");
const { generateCerDocx } = require("../generators/gen_docx_cer");
const { callLLM }   = require("../llm");
const { parseJSON } = require("../parse_json");

// ── Outil : validation de structure CER ──────────────────────────────────────
function validate_structure(data) {
  const rules = [
    { field: "contexte",                     check: d => typeof d === "string" && d.length >= 100,           msg: "contexte trop court (≥100 car.)"              },
    { field: "objectifs_savoir",             check: d => Array.isArray(d) && d.length >= 4,                  msg: "≥4 objectifs savoir requis"                   },
    { field: "objectifs_savoir_faire",       check: d => Array.isArray(d) && d.length >= 4,                  msg: "≥4 objectifs savoir-faire requis"             },
    { field: "besoins",                      check: d => Array.isArray(d) && d.length >= 2,                  msg: "≥2 besoins requis"                            },
    { field: "problematique",                check: d => typeof d === "string" && d.trim().endsWith("?"),    msg: "problematique doit finir par ?"               },
    { field: "contraintes",                  check: d => Array.isArray(d) && d.length >= 3,                  msg: "≥3 contraintes requises"                      },
    { field: "realisation",                  check: d => Array.isArray(d) && d.length >= 3,                  msg: "≥3 sections de réalisation"                  },
    { field: "validation_hypotheses",        check: d => Array.isArray(d) && d.length >= 2,                  msg: "≥2 validations d'hypothèses"                 },
    { field: "conclusion",                   check: d => typeof d === "string" && d.length >= 100,           msg: "conclusion trop courte (≥100 car.)"           },
    { field: "synthese",                     check: d => typeof d === "string" && d.length >= 200,           msg: "synthèse trop courte (≥200 car.)"             },
    { field: "methodes_utilisees",           check: d => Array.isArray(d) && d.length >= 2,                  msg: "≥2 méthodes/outils"                           },
    { field: "references_bibliographiques",  check: d => Array.isArray(d) && d.length >= 3,                  msg: "≥3 références bibliographiques"               },
  ];
  const errors = rules.filter(r => !r.check(data[r.field] ?? "")).map(r => `[${r.field}] ${r.msg}`);
  return { valid: errors.length === 0, errors, score: Math.round(((rules.length - errors.length) / rules.length) * 100) };
}

// ── Outil : analyse de la mémoire partagée ────────────────────────────────────
/**
 * Analyse ce qui est disponible dans la mémoire pour guider la génération.
 * @param {object} memory - Mémoire partagée
 * @returns {{ source: string, qualitySignals: object, richness: string }}
 */
function analyze_memory(memory) {
  const hasPR = !!memory.prositRetour;
  const hasPA = !!memory.prositAller;
  const source = (hasPA && hasPR) ? "PA + PR" : hasPR ? "PR seul" : hasPA ? "PA seul" : "mémoire minimale";

  // Extraction des signaux de qualité des logs précédents
  const agentLogs = (memory.logs || []);
  const scores = agentLogs
    .filter(l => typeof l.msg === "string" && l.msg.includes("Score"))
    .map(l => { const m = l.msg.match(/(\d+)%/); return m ? parseInt(m[1], 10) : null; })
    .filter(Boolean);

  const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
  const warnings = (memory.coherenceWarnings || []).length;

  // Évaluation de la richesse des données disponibles
  const paFields = hasPR ? Object.keys(memory.prositRetour).length : hasPA ? Object.keys(memory.prositAller).length : 0;
  const richness = paFields >= 10 ? "riche" : paFields >= 6 ? "moyenne" : "minimale";

  return {
    source,
    qualitySignals: { avgScore, warnings, richness },
    hasPR,
    richness,
  };
}

// ── Boucle ReAct principale ───────────────────────────────────────────────────
async function runAgent(memory, onLog) {
  // ── THOUGHT 1 : Analyse de la mémoire ────────────────────────────────────
  const hasPR = !!memory.prositRetour;
  const sourceData = hasPR ? memory.prositRetour : (memory.prositAller || {});

  onLog("thought", `Consultation de la mémoire partagée : PA=${!!memory.prositAller}, PR=${hasPR}`);
  onLog("thought", hasPR
    ? "Prosit Retour disponible — je capitalise sur PA + PR pour un CER complet et cohérent."
    : "Pas de Prosit Retour — je travaille uniquement sur le Prosit Aller."
  );

  // ── ACTION 1 : Analyse de la mémoire ─────────────────────────────────────
  onLog("action", "Appel outil analyze_memory — évaluation des données disponibles.");
  const memAnalysis = analyze_memory(memory);
  onLog("observation", `Source : ${memAnalysis.source} | Richesse : ${memAnalysis.richness} | Score moyen agents précédents : ${memAnalysis.qualitySignals.avgScore || "N/A"}%`);
  if (memAnalysis.qualitySignals.warnings > 0)
    onLog("observation", `⚠ ${memAnalysis.qualitySignals.warnings} avertissement(s) de cohérence à corriger dans le CER.`);

  // ── ACTION 2 : Planification du CER ──────────────────────────────────────
  onLog("action", "Appel LLM — planification du CER selon les données disponibles.");
  const rawPlan = await callLLM(
    `Tu es l'Agent 3 UCAC-ICAM, responsable de la rédaction du CER.
Tu analyses les données disponibles et planifies la rédaction.
Réponds UNIQUEMENT en JSON : {"sections_prioritaires":[""],"lacunes_a_combler":[""],"niveau_detail":"basique|intermédiaire|avancé","nombre_objectifs_recommande":5}`,
    [{
      role: "user",
      content: `Données disponibles (${memAnalysis.source}) :
${JSON.stringify(sourceData, null, 2)}
Avertissements cohérence : ${JSON.stringify(memory.coherenceWarnings || [])}`
    }]
  );
  const plan = parseJSON(rawPlan);
  onLog("observation", `Sections prioritaires : ${plan.sections_prioritaires?.join(", ")}`);
  onLog("observation", `Niveau de détail décidé : ${plan.niveau_detail} | Objectifs recommandés : ${plan.nombre_objectifs_recommande}`);

  // ── THOUGHT 2 : Décision de génération ───────────────────────────────────
  onLog("thought", "Plan validé. Génération du CER complet avec contenu riche et structuré.");

  // ── ACTION 3 : Génération du CER ─────────────────────────────────────────
  onLog("action", "Appel LLM — génération du CER complet (JSON volumieux).");
  const rawCER = await callLLM(
    `Tu es l'Agent 3 UCAC-ICAM. Tu génères le CER COMPLET pour l'étudiant ${memory.student || "MAYACK ETIENNE"} (${memory.promotion || "X2027"}).
Ce CER est un document académique de recherche approfondie.

Format JSON attendu (respecte EXACTEMENT les clés) :
{
  "theme": "string",
  "contexte": "Analyse détaillée du contexte en plusieurs phrases",
  "objectifs_savoir": [
    "[OBJ_ID_1] Comprendre ...",
    "[OBJ_ID_2] Maîtriser les concepts de ...",
    ...
  ],
  "objectifs_savoir_faire": [
    "[OBJ_ID_1] Être capable de ...",
    "[OBJ_ID_2] Savoir mettre en œuvre ...",
    ...
  ],
  "besoins": ["Besoin 1", "Besoin 2", ...],
  "problematique": "Question centrale se terminant par ?",
  "contraintes": ["Contrainte 1", "Contrainte 2", ...],
  "generalisation": "Formulation générique du problème",
  "pistes_solution": ["Piste 1 en forme de question ?", ...],
  "plan_action": ["Étape 1 : ...", "Étape 2 : ...", "Étape 3 : ...", "Étape 4 : ..."],
  "realisation": [
    {
      "titre": "Titre de la section de réalisation",
      "contenu": "Contenu détaillé en plusieurs paragraphes séparés par \\n\\n. Chaque paragraphe doit être substantiel (3-5 phrases). Inclure résultats, observations, difficultés rencontrées."
    },
    ...
  ],
  "validation_hypotheses": [
    { "hypothese": "Texte de l'hypothèse", "statut": "Validé" },
    ...
  ],
  "conclusion": "Conclusion générale en plusieurs phrases. Résume les apports, les limites et les perspectives.",
  "synthese": "Synthèse longue du travail effectué en plusieurs paragraphes séparés par \\n\\n. Inclure les apprentissages, les difficultés surmontées, les compétences développées.",
  "methodes_utilisees": [
    { "titre": "Nom de la méthode/outil", "reference": "Auteur(s), Année ou standard", "description": "Description de comment cette méthode a été appliquée dans ce contexte" },
    ...
  ],
  "references_bibliographiques": [
    "NOM Prénom, Titre, Éditeur, Année",
    ...
  ]
}

CONTRAINTES STRICTES :
- objectifs_savoir : ≥5 objectifs avec identifiant [OBJ_ID_N]
- objectifs_savoir_faire : ≥5 objectifs avec identifiant [OBJ_ID_N]
- realisation : 4 sections avec contenu TRÈS détaillé (≥200 chars par section)
- conclusion : ≥150 caractères
- synthese : ≥250 caractères, plusieurs paragraphes séparés par \\n\\n
- methodes_utilisees : ≥3 méthodes avec références académiques correctes
- references_bibliographiques : ≥5 références format APA
Niveau de détail requis : ${plan.niveau_detail}
Réponds UNIQUEMENT en JSON valide, sans markdown.`,
    [{
      role: "user",
      content: `Données sources (${memAnalysis.source}) :
${JSON.stringify(sourceData, null, 2)}

Plan de rédaction :
${JSON.stringify(plan, null, 2)}

Avertissements de cohérence à corriger : ${JSON.stringify(memory.coherenceWarnings || [])}

Génère le CER complet pour ${memory.student || "MAYACK ETIENNE"} (${memory.promotion || "X2027"}).`
    }],
    6000
  );
  let cer = parseJSON(rawCER);
  cer.theme = cer.theme || (sourceData.theme) || memory.theme;

  // ── ACTION 4 : Validation avec outil ─────────────────────────────────────
  onLog("action", "Appel outil validate_structure — contrôle qualité du CER.");
  const v1 = validate_structure(cer);
  onLog("observation", `Score qualité CER : ${v1.score}% | Erreurs : ${v1.errors.join("; ") || "aucune ✓"}`);

  // ── THOUGHT 3 : Décision de correction ───────────────────────────────────
  if (!v1.valid) {
    onLog("thought", `Score ${v1.score}% insuffisant. Auto-correction sur : ${v1.errors.join(", ")}`);

    // ── ACTION 5 : Auto-correction ────────────────────────────────────────
    onLog("action", "Appel LLM — correction ciblée des champs défaillants du CER.");
    const rawFixed = await callLLM(
      `Tu corriges un CER incomplet. Corrige et enrichis UNIQUEMENT les champs suivants, retourne le JSON complet.
Problèmes : ${v1.errors.join(" | ")}
Rappel : synthese doit faire ≥250 chars, conclusion ≥150 chars, realisation ≥3 sections détaillées.
Retourne le JSON complet sans markdown.`,
      [{ role: "user", content: JSON.stringify(cer, null, 2) }],
      6000
    );
    const fixed = parseJSON(rawFixed);
    cer = { ...cer, ...fixed };

    const v2 = validate_structure(cer);
    onLog("observation", `Score après correction : ${v2.score}%`);
    onLog("thought", v2.valid ? "Correction réussie." : `Score final : ${v2.score}% — génération avec meilleur contenu disponible.`);
  } else {
    onLog("thought", `Score ${v1.score}% excellent. Aucune correction nécessaire.`);
  }

  // ── ACTION 6 : Écriture en mémoire partagée ──────────────────────────────
  memory.cer = cer;
  onLog("action", "Écriture du CER en mémoire partagée.");

  // ── ACTION 7 : Génération du fichier DOCX ────────────────────────────────
  const outputPath = path.join(memory.outputDir, `03_CER_${memory.slug}.docx`);
  onLog("action", `Appel générateur DOCX CER → ${outputPath}`);
  await generateCerDocx(cer, memory, outputPath);
  memory.files.cer = outputPath;

  // ── RESULT ────────────────────────────────────────────────────────────────
  const nbObj   = (cer.objectifs_savoir || []).length + (cer.objectifs_savoir_faire || []).length;
  const nbReal  = (cer.realisation || []).length;
  const nbRefs  = (cer.references_bibliographiques || []).length;
  onLog("result", `✓ CER terminé. Fichier : ${path.basename(outputPath)} | ${nbObj} objectifs | ${nbReal} sections réalisation | ${nbRefs} références`);
  return cer;
}

module.exports = { runAgent };
