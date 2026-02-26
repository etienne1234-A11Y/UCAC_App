/**
 * parse_json.js — Parser JSON robuste pour les réponses LLM
 *
 * Gère les cas courants de JSON malformé retourné par les LLMs :
 *   - Blocs markdown ```json ... ```
 *   - Virgules trailing avant } ou ]
 *   - JSON tronqué (maxTokens atteint) → fermeture automatique
 *   - Texte avant/après le JSON
 */
"use strict";

/**
 * Extrait et parse le premier objet/tableau JSON valide d'une string.
 * @param {string} raw - Réponse brute du LLM
 * @returns {object|Array} JSON parsé
 */
function parseJSON(raw) {
  if (typeof raw !== "string") throw new Error("parseJSON: entrée non-string");

  // 1. Supprimer les blocs markdown
  let s = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();

  // 2. Trouver le début du JSON (premier { ou [)
  const start = s.search(/[{\[]/);
  if (start === -1) throw new Error("Aucun JSON trouvé dans la réponse LLM");
  s = s.slice(start);

  // 3. Trouver la fin par matching de brackets
  const opener = s[0];
  const closer = opener === "{" ? "}" : "]";
  let depth = 0, inStr = false, escape = false, end = -1;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (escape) { escape = false; continue; }
    if (c === "\\") { escape = true; continue; }
    if (c === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (c === opener || c === "{" || c === "[") depth++;
    if (c === closer || c === "}" || c === "]") { depth--; if (depth === 0) { end = i; break; } }
  }

  // Si JSON tronqué, on ferme les brackets manquants
  if (end === -1) {
    s = repairTruncated(s);
  } else {
    s = s.slice(0, end + 1);
  }

  // 4. Corriger les virgules trailing ( [a, b,] ou {k:v,} )
  s = s.replace(/,\s*([}\]])/g, "$1");

  // 5. Tentative de parse
  try {
    return JSON.parse(s);
  } catch (e) {
    // Dernier recours : forcer la fermeture des strings ouvertes et brackets
    s = repairTruncated(s);
    s = s.replace(/,\s*([}\]])/g, "$1");
    return JSON.parse(s);
  }
}

/**
 * Tente de réparer un JSON tronqué en fermant les structures ouvertes.
 */
function repairTruncated(s) {
  const stack = [];
  let inStr = false, escape = false;
  let result = "";

  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    result += c;
    if (escape) { escape = false; continue; }
    if (c === "\\") { escape = true; continue; }
    if (c === '"') {
      inStr = !inStr;
      if (!inStr && stack.length === 0) break; // fin du JSON de base
      continue;
    }
    if (inStr) continue;
    if (c === "{") stack.push("}");
    else if (c === "[") stack.push("]");
    else if ((c === "}" || c === "]") && stack.length > 0) stack.pop();
  }

  // Supprimer une éventuelle valeur incomplète à la fin (trailing comma ou valeur partielle)
  result = result.trimEnd().replace(/,\s*$/, "").replace(/:\s*$/, ': ""').replace(/"[^"]*$/, '"..."');

  // Fermer les structures ouvertes
  while (stack.length > 0) result += stack.pop();

  return result;
}

module.exports = { parseJSON };
