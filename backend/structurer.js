/**
 * structurer.js — Structure un texte brut en données exploitables via LLM
 *
 * Utilisé par /api/parse pour convertir du texte extrait (DOCX/PPTX/TXT)
 * en JSON structuré compatible avec les agents.
 */

"use strict";

const { callLLM }   = require("./llm");
const { parseJSON } = require("./parse_json");

const PROMPTS = {
  prosit_retour: `Tu es un assistant spécialisé dans l'extraction d'informations académiques.
On te donne le texte brut extrait d'un Prosit Retour (présentation PPTX/DOCX).
Extrait et structure les informations en JSON avec EXACTEMENT ces clés :
{
  "theme": "Titre/thème du Prosit Retour",
  "definitions": { "terme": "définition" },
  "contexte_rappel": "Contexte rappelé dans le document",
  "besoins": ["Besoin 1", "Besoin 2"],
  "contraintes": ["Contrainte 1"],
  "problematique": "Question problématique se terminant par ?",
  "generalisation": "Généralisation du problème si présente",
  "validation_hypotheses": [
    { "hypothese": "Texte de l'hypothèse", "statut": "Validé", "justification": "Explication" }
  ],
  "plan_action": ["Étape 1", "Étape 2"],
  "solutions": [
    { "titre": "Titre solution", "description": "Description détaillée" }
  ],
  "bilan": "Bilan ou conclusion du Prosit Retour"
}
Si une information n'est pas présente, mets une valeur vide cohérente (chaîne vide, tableau vide, objet vide).
Réponds UNIQUEMENT en JSON valide, sans markdown.`,

  prosit_aller: `Tu es un assistant spécialisé dans l'extraction d'informations académiques.
On te donne le texte brut extrait d'un Prosit Aller (document DOCX/PPTX).
Extrait et structure les informations en JSON avec EXACTEMENT ces clés :
{
  "theme": "Titre/thème du Prosit",
  "mots_cles": ["mot1", "mot2"],
  "contexte": "Contexte de la situation",
  "besoins": ["Besoin 1"],
  "contraintes": ["Contrainte 1"],
  "problematique": "Question problématique se terminant par ?",
  "pistes_solution": ["Piste 1", "Piste 2"],
  "plan_action": ["Étape 1", "Étape 2"]
}
Si une information n'est pas présente, mets une valeur vide cohérente.
Réponds UNIQUEMENT en JSON valide, sans markdown.`,

  cer: `Tu es un assistant spécialisé dans l'extraction d'informations académiques.
On te donne le texte brut extrait d'un CER (Cahier d'Étude et de Recherche).
Extrait et structure les informations en JSON avec EXACTEMENT ces clés :
{
  "theme": "Titre/thème du CER",
  "contexte": "Contexte",
  "objectifs_savoir": ["Objectif savoir 1"],
  "objectifs_savoir_faire": ["Objectif savoir-faire 1"],
  "besoins": ["Besoin 1"],
  "problematique": "Question problématique se terminant par ?",
  "contraintes": ["Contrainte 1"],
  "realisation": [{ "titre": "Section", "contenu": "Contenu détaillé" }],
  "validation_hypotheses": [{ "hypothese": "Hypothèse", "statut": "Validé" }],
  "conclusion": "Conclusion",
  "synthese": "Synthèse",
  "methodes_utilisees": [{ "titre": "Méthode", "reference": "Référence", "description": "Description" }],
  "references_bibliographiques": ["Référence 1"]
}
Si une information n'est pas présente, mets une valeur vide cohérente.
Réponds UNIQUEMENT en JSON valide, sans markdown.`,
};


function simpleExtract(text, hint) {
  const str = typeof text === "string" ? text : "";
  // Chercher un vrai titre : ignorer les lignes génériques ("PROSIT RETOUR", "PROSIT ALLER")
  const lines = str.split(/\n/).map(l => l.trim()).filter(Boolean);
  const skip = /^(prosit\s*(retour|aller|return)?|cer|sommaire|plan)$/i;
  const themeLine = lines.find(l => l.length >= 5 && l.length <= 100 && !skip.test(l))
    || (str.match(/th[eè]me?\s*[:：]\s*(.+)/i) || [])[1]
    || lines[0]
    || "Thème non détecté";
  return {
    theme:    themeLine.trim(),
    raw_text: str.slice(0, 4000),
  };
}

async function structureDocument(text, hint) {
  const str = typeof text === "string" ? text : String(text || "");
  const docType = (hint && hint !== "auto") ? hint : "prosit_aller";
  const preview = `Type : ${docType} · Longueur : ${str.length} caractères`;

  if (str.trim().length < 30) {
    const data = simpleExtract(str, docType);
    return { data, docType, preview: preview + " · Contenu insuffisant" };
  }

  const prompt = PROMPTS[docType] || PROMPTS.prosit_aller;
  const userMsg = [{ role: "user", content: `Texte extrait du document :\n\n${str.slice(0, 6000)}` }];

  // Tentative LLM avec 1 retry si rate-limit (attente 6s)
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const raw  = await callLLM(prompt, userMsg, 2000);
      const data = parseJSON(raw);
      return { data, docType, preview };
    } catch (err) {
      const isRateLimit = err.message.includes("retry") || err.message.includes("quota") || err.message.includes("429");
      if (isRateLimit && attempt === 1) {
        console.warn("[structurer] Rate limit — retry dans 7s…");
        await new Promise(r => setTimeout(r, 7000));
        continue;
      }
      console.error("[structurer] LLM error:", err.message);
      const data = simpleExtract(str, docType);
      return { data, docType, preview: preview + ` · Fallback (erreur LLM)` };
    }
  }
}

module.exports = { structureDocument };
