/**
 * generators/gen_pptx_prosit_retour.js
 *
 * Génère un vrai fichier PPTX (PowerPoint) pour le Prosit Retour UCAC-ICAM.
 * 12 slides structurées selon le template original :
 *   1.  Cover sombre avec bande bordeaux verticale
 *   2.  Sommaire (2 colonnes)
 *   3.  Définitions des mots clés
 *   4.  Contexte (rappel)
 *   5.  Besoins
 *   6.  Contraintes
 *   7.  Problématique (encadré citation)
 *   8.  Généralisation (box bleu marine)
 *   9.  Validation des hypothèses (✓/✗ colorés)
 *   10. Plan d'action (numéros bordeaux)
 *   11. Solutions (grille de cartes)
 *   12. Bilan
 *
 * Palette : Navy #1F3864 · Bordeaux #B71E42 · Sable #F5F1EC
 *
 * Usage :
 *   const { generatePrositRetourPptx } = require('./gen_pptx_prosit_retour');
 *   await generatePrositRetourPptx(prData, memoryContext, '/chemin/sortie.pptx');
 */

"use strict";

const PptxGenJS = require("pptxgenjs");

// ── Palette ───────────────────────────────────────────────────────────────────
const NAVY  = "1F3864";
const RED   = "B71E42";
const SAND  = "F5F1EC";
const SAND2 = "EDE8E1";
const WHITE = "FFFFFF";
const DARK  = "2C2C2C";
const GRAY  = "777777";

// Dimensions LAYOUT_WIDE : 13.33 × 7.5 pouces
const W = 13.33;
const H = 7.5;
const TOTAL_SLIDES = 12;

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Ajoute la structure commune d'une slide (bande navy + ligne bordeaux + fond sable).
 * @param {object} prs   - Instance PptxGenJS
 * @param {object} slide - Slide cible
 * @param {string} title - Titre de la slide
 */
function addSlideLayout(prs, slide, title) {
  slide.background = { color: SAND };
  // Bande bleue marine en haut
  slide.addShape(prs.ShapeType.rect, {
    x: 0, y: 0, w: W, h: 1.25,
    fill: { color: NAVY }, line: { color: NAVY },
  });
  // Filet bordeaux sous la bande
  slide.addShape(prs.ShapeType.rect, {
    x: 0, y: 1.25, w: W, h: 0.05,
    fill: { color: RED }, line: { color: RED },
  });
  // Titre
  slide.addText(title, {
    x: 0.5, y: 0.1, w: W - 1.0, h: 1.05,
    fontSize: 24, bold: true, color: WHITE, fontFace: "Arial",
    align: "left", valign: "middle",
  });
}

/** Numéro de slide (coin bas-droit) */
function addPageNum(slide, n) {
  slide.addText(`${n} / ${TOTAL_SLIDES}`, {
    x: W - 1.1, y: H - 0.38, w: 1.0, h: 0.28,
    fontSize: 9, color: GRAY, align: "right", fontFace: "Arial",
  });
}

/** Bloc de puces avec bullet bordeaux */
function addBullets(slide, items, x, y, w, h) {
  if (!Array.isArray(items) || !items.length) return;
  const safeItems = items.map(i => typeof i === "object" ? (i.titre || i.text || JSON.stringify(i)) : String(i ?? "")).filter(Boolean);
  if (!safeItems.length) return;
  const rows = safeItems.map((txt, i) => [
    { text: "•  ", options: { color: RED, bold: true, fontSize: 14 } },
    { text: txt, options: { color: DARK, fontSize: 13, breakLine: i < safeItems.length - 1 } },
  ]).flat();
  slide.addText(rows, { x, y, w, h, fontFace: "Arial", valign: "top", wrap: true });
}

// ── 12 slides ─────────────────────────────────────────────────────────────────

/** Slide 1 — Cover */
function slide01_Cover(prs, pr, memory) {
  const sl = prs.addSlide();
  sl.background = { color: NAVY };

  // Bande bordeaux verticale gauche
  sl.addShape(prs.ShapeType.rect, {
    x: 0, y: 0, w: 0.35, h: H,
    fill: { color: RED }, line: { color: RED },
  });

  // Grand titre
  sl.addText("PROSIT\nRETOUR", {
    x: 0.7, y: 0.9, w: 7.5, h: 3.0,
    fontSize: 62, bold: true, color: WHITE, fontFace: "Arial",
    align: "left", lineSpacingMultiple: 1.1,
  });

  // Filet bordeaux horizontal
  sl.addShape(prs.ShapeType.rect, {
    x: 0.7, y: 4.1, w: 7.0, h: 0.07,
    fill: { color: RED }, line: { color: RED },
  });

  // Thème
  sl.addText((pr.theme || "").toUpperCase(), {
    x: 0.7, y: 4.25, w: 9.5, h: 0.75,
    fontSize: 17, bold: true, color: RED, fontFace: "Arial", align: "left",
  });

  // Infos étudiant
  sl.addText(`${memory.student || "MAYACK ETIENNE"}  ·  ${memory.promotion || "X2027"}  ·  UCAC-ICAM  ·  ${memory.annee || "2025–2026"}`, {
    x: 0.7, y: 5.1, w: 10, h: 0.45,
    fontSize: 12, color: "AABBDD", fontFace: "Arial",
  });

  // Décorations cercles (coin haut-droit)
  sl.addShape(prs.ShapeType.ellipse, {
    x: 10.5, y: -0.8, w: 5.2, h: 5.2,
    fill: { color: "2A4A7A", transparency: 65 }, line: { color: "2A4A7A", transparency: 65 },
  });
  sl.addShape(prs.ShapeType.ellipse, {
    x: 11.8, y: 4.5, w: 3.0, h: 3.0,
    fill: { color: RED, transparency: 80 }, line: { color: RED, transparency: 80 },
  });
}

/** Slide 2 — Sommaire */
function slide02_Sommaire(prs, n) {
  const sl = prs.addSlide();
  addSlideLayout(prs, sl, "SOMMAIRE");
  addPageNum(sl, n);

  const items = [
    "I.    Définitions des mots clés",
    "II.   Contexte (rappel)",
    "III.  Besoins",
    "IV.  Contraintes",
    "V.   Problématique",
    "VI.  Généralisation",
    "VII. Validation des pistes de solution",
    "VIII. Plan d'action",
    "IX.  Solutions proposées",
    "X.   Bilan",
  ];

  const half = Math.ceil(items.length / 2);

  // Colonne gauche
  sl.addText(
    items.slice(0, half).map((t, i) => [
      { text: "›  ", options: { color: RED, bold: true, fontSize: 14 } },
      { text: t, options: { color: DARK, fontSize: 13, breakLine: i < half - 1 } },
    ]).flat(),
    { x: 0.4, y: 1.45, w: 5.8, h: 5.6, fontFace: "Arial", valign: "top" }
  );

  // Séparateur vertical bordeaux
  sl.addShape(prs.ShapeType.rect, {
    x: 6.5, y: 1.5, w: 0.04, h: 5.5,
    fill: { color: RED }, line: { color: RED },
  });

  // Colonne droite
  sl.addText(
    items.slice(half).map((t, i) => [
      { text: "›  ", options: { color: RED, bold: true, fontSize: 14 } },
      { text: t, options: { color: DARK, fontSize: 13, breakLine: i < items.slice(half).length - 1 } },
    ]).flat(),
    { x: 6.8, y: 1.45, w: 6.0, h: 5.6, fontFace: "Arial", valign: "top" }
  );
}

/** Slide 3 — Définitions */
function slide03_Definitions(prs, pr, n) {
  const sl = prs.addSlide();
  addSlideLayout(prs, sl, "DÉFINITIONS DES MOTS CLÉS");
  addPageNum(sl, n);

  const rawDefs = pr.definitions || {};
  const defs = Array.isArray(rawDefs)
    ? rawDefs.map((d, i) => [String(d.terme || d.mot || `Terme ${i+1}`), String(d.definition || d.def || d)])
    : Object.entries(rawDefs).map(([k, v]) => [String(k), String(v)]);
  if (defs.length === 0) return;

  // Grille 2 colonnes de cartes
  const cols = 2;
  const cardW = (W - 0.8) / cols;
  const cardH = Math.min(1.2, (H - 1.6) / Math.ceil(defs.length / cols));

  defs.forEach(([terme, def], idx) => {
    if (!terme) return;
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const x = 0.4 + col * (cardW + 0.1);
    const y = 1.45 + row * (cardH + 0.08);

    // Carte fond clair avec bordure bordeaux gauche
    sl.addShape(prs.ShapeType.rect, {
      x, y, w: cardW, h: cardH,
      fill: { color: SAND2 }, line: { color: "CCCCCC", pt: 0.5 },
    });
    sl.addShape(prs.ShapeType.rect, {
      x, y, w: 0.06, h: cardH,
      fill: { color: RED }, line: { color: RED },
    });

    // Terme en bleu marine
    sl.addText(terme, {
      x: x + 0.12, y: y + 0.06, w: cardW - 0.18, h: 0.28,
      fontSize: 11, bold: true, color: NAVY, fontFace: "Arial",
    });

    // Définition
    sl.addText(def || "", {
      x: x + 0.12, y: y + 0.33, w: cardW - 0.18, h: cardH - 0.38,
      fontSize: 9.5, color: DARK, fontFace: "Arial", wrap: true,
    });
  });
}

/** Slide 4 — Contexte */
function slide04_Contexte(prs, pr, n) {
  const sl = prs.addSlide();
  addSlideLayout(prs, sl, "CONTEXTE (RAPPEL)");
  addPageNum(sl, n);

  sl.addText(pr.contexte_rappel || "", {
    x: 0.5, y: 1.45, w: W - 1.0, h: H - 1.9,
    fontSize: 13, color: DARK, fontFace: "Times New Roman",
    align: "justify", valign: "top", wrap: true, lineSpacingMultiple: 1.4,
  });
}

/** Slide 5 — Besoins */
function slide05_Besoins(prs, pr, n) {
  const sl = prs.addSlide();
  addSlideLayout(prs, sl, "BESOINS");
  addPageNum(sl, n);
  addBullets(sl, pr.besoins, 0.5, 1.45, W - 1.0, H - 1.9);
}

/** Slide 6 — Contraintes */
function slide06_Contraintes(prs, pr, n) {
  const sl = prs.addSlide();
  addSlideLayout(prs, sl, "CONTRAINTES");
  addPageNum(sl, n);
  addBullets(sl, pr.contraintes, 0.5, 1.45, W - 1.0, H - 1.9);
}

/** Slide 7 — Problématique (citation encadrée) */
function slide07_Problematique(prs, pr, n) {
  const sl = prs.addSlide();
  addSlideLayout(prs, sl, "PROBLÉMATIQUE");
  addPageNum(sl, n);

  // Cadre citation bordeaux
  sl.addShape(prs.ShapeType.rect, {
    x: 1.0, y: 1.8, w: W - 2.0, h: 3.5,
    fill: { color: SAND2 }, line: { color: RED, pt: 2 },
  });

  // Guillemets décoratifs
  sl.addText("«", {
    x: 1.2, y: 1.85, w: 0.8, h: 0.9,
    fontSize: 60, color: RED, fontFace: "Georgia", opacity: 30,
  });

  sl.addText(pr.problematique || "", {
    x: 1.5, y: 2.2, w: W - 3.0, h: 2.8,
    fontSize: 16, color: NAVY, fontFace: "Times New Roman",
    align: "center", valign: "middle", italic: true, bold: true,
    lineSpacingMultiple: 1.5, wrap: true,
  });
}

/** Slide 8 — Généralisation (box navy) */
function slide08_Generalisation(prs, pr, n) {
  const sl = prs.addSlide();
  addSlideLayout(prs, sl, "GÉNÉRALISATION");
  addPageNum(sl, n);

  sl.addShape(prs.ShapeType.rect, {
    x: 1.0, y: 1.8, w: W - 2.0, h: 3.5,
    fill: { color: NAVY }, line: { color: NAVY },
  });

  sl.addText(pr.generalisation || "", {
    x: 1.4, y: 1.9, w: W - 2.8, h: 3.3,
    fontSize: 16, color: WHITE, fontFace: "Times New Roman",
    align: "center", valign: "middle", italic: true,
    lineSpacingMultiple: 1.5, wrap: true,
  });
}

/** Slide 9 — Validation des hypothèses */
function slide09_Validation(prs, pr, n) {
  const sl = prs.addSlide();
  addSlideLayout(prs, sl, "VALIDATION DES HYPOTHÈSES");
  addPageNum(sl, n);

  const items = pr.validation_hypotheses || [];

  sl.addText("Avons-nous validé nos pistes de solution ?", {
    x: 0.5, y: 1.4, w: W - 1.0, h: 0.4,
    fontSize: 12, bold: true, color: NAVY, fontFace: "Arial", italic: true,
  });

  items.forEach((h, i) => {
    const y = 1.85 + i * 0.75;
    if (y + 0.65 > H) return; // éviter débordement

    const valide = (h.statut || "").toLowerCase().startsWith("valid") &&
                   !(h.statut || "").toLowerCase().includes("in");

    // Fond de ligne alterné
    sl.addShape(prs.ShapeType.rect, {
      x: 0.35, y, w: W - 0.7, h: 0.65,
      fill: { color: i % 2 === 0 ? SAND : SAND2 },
      line: { color: "DDDDDD", pt: 0.5 },
    });

    // Icône ✓/✗
    sl.addText(valide ? "✓" : "✗", {
      x: 0.4, y: y + 0.05, w: 0.55, h: 0.55,
      fontSize: 20, bold: true, color: valide ? "15803D" : "B91C1C",
      fontFace: "Arial", align: "center", valign: "middle",
    });

    // Hypothèse
    sl.addText(h.hypothese || "", {
      x: 1.05, y: y + 0.03, w: 6.5, h: 0.3,
      fontSize: 12, bold: true, color: DARK, fontFace: "Arial",
    });

    // Justification
    if (h.justification) {
      sl.addText(h.justification, {
        x: 1.05, y: y + 0.33, w: W - 1.5, h: 0.3,
        fontSize: 9.5, color: GRAY, fontFace: "Arial", italic: true,
      });
    }
  });
}

/** Slide 10 — Plan d'action */
function slide10_PlanAction(prs, pr, n) {
  const sl = prs.addSlide();
  addSlideLayout(prs, sl, "PLAN D'ACTION");
  addPageNum(sl, n);

  (pr.plan_action || []).forEach((step, i) => {
    const y = 1.45 + i * 0.82;
    if (y + 0.7 > H) return;

    // Numéro bordeaux
    sl.addShape(prs.ShapeType.rect, {
      x: 0.35, y, w: 0.52, h: 0.52,
      fill: { color: RED }, line: { color: RED },
    });
    sl.addText(String(i + 1), {
      x: 0.35, y, w: 0.52, h: 0.52,
      fontSize: 16, bold: true, color: WHITE, fontFace: "Arial",
      align: "center", valign: "middle",
    });

    // Texte de l'étape
    sl.addText(step || "", {
      x: 1.0, y: y + 0.04, w: W - 1.4, h: 0.48,
      fontSize: 13, color: DARK, fontFace: "Arial", valign: "middle",
    });
  });
}

/** Slide 11 — Solutions (cartes 2 colonnes) */
function slide11_Solutions(prs, pr, n) {
  const sl = prs.addSlide();
  addSlideLayout(prs, sl, "SOLUTIONS PROPOSÉES");
  addPageNum(sl, n);

  const solutions = pr.solutions || [];
  const cols = 2;
  const cardW = (W - 0.9) / cols;

  solutions.forEach((sol, idx) => {
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const cardH = (H - 1.7) / Math.ceil(solutions.length / cols) - 0.1;
    const x = 0.35 + col * (cardW + 0.2);
    const y = 1.45 + row * (cardH + 0.1);

    // Fond carte
    sl.addShape(prs.ShapeType.rect, {
      x, y, w: cardW, h: cardH,
      fill: { color: SAND2 }, line: { color: "CCCCCC", pt: 0.5 },
    });

    // En-tête carte bleu marine
    sl.addShape(prs.ShapeType.rect, {
      x, y, w: cardW, h: 0.42,
      fill: { color: NAVY }, line: { color: NAVY },
    });
    sl.addText(sol.titre || `Solution ${idx + 1}`, {
      x: x + 0.1, y: y + 0.04, w: cardW - 0.2, h: 0.34,
      fontSize: 11, bold: true, color: WHITE, fontFace: "Arial",
    });

    // Corps description
    sl.addText(sol.description || "", {
      x: x + 0.1, y: y + 0.48, w: cardW - 0.2, h: cardH - 0.56,
      fontSize: 10.5, color: DARK, fontFace: "Arial", wrap: true, valign: "top",
    });
  });
}

/** Slide 12 — Bilan */
function slide12_Bilan(prs, pr, n) {
  const sl = prs.addSlide();
  addSlideLayout(prs, sl, "BILAN");
  addPageNum(sl, n);

  sl.addText(pr.bilan || "", {
    x: 0.5, y: 1.45, w: W - 1.0, h: H - 1.9,
    fontSize: 13, color: DARK, fontFace: "Times New Roman",
    align: "justify", valign: "top", wrap: true, lineSpacingMultiple: 1.4,
  });
}

// ── Export principal ──────────────────────────────────────────────────────────
/**
 * Génère le fichier PPTX du Prosit Retour et l'écrit sur disque.
 * @param {object} pr         - Données du Prosit Retour (JSON structuré de l'agent)
 * @param {object} memory     - Mémoire partagée (student, promotion, annee...)
 * @param {string} outputPath - Chemin complet du fichier .pptx à créer
 */
async function generatePrositRetourPptx(pr, memory, outputPath) {
  const prs = new PptxGenJS();
  prs.layout = "LAYOUT_WIDE"; // 13.33 × 7.5 pouces

  // Génération des 12 slides
  slide01_Cover(prs, pr, memory);
  slide02_Sommaire(prs, 2);
  slide03_Definitions(prs, pr, 3);
  slide04_Contexte(prs, pr, 4);
  slide05_Besoins(prs, pr, 5);
  slide06_Contraintes(prs, pr, 6);
  slide07_Problematique(prs, pr, 7);
  slide08_Generalisation(prs, pr, 8);
  slide09_Validation(prs, pr, 9);
  slide10_PlanAction(prs, pr, 10);
  slide11_Solutions(prs, pr, 11);
  slide12_Bilan(prs, pr, 12);

  await prs.writeFile({ fileName: outputPath });
}

module.exports = { generatePrositRetourPptx };
