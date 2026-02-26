/**
 * generators/gen_docx_cer.js
 *
 * Génère un vrai fichier DOCX (Word) pour le CER (Cahier d'Étude et de Recherche).
 * Structure conforme au template UCAC-ICAM :
 *   - Page de garde : logos, tuteurs, promotion
 *   - Table des matières
 *   - 13 sections numérotées
 *   - En-tête / pied de page avec numéros de page
 *
 * Sections :
 *   I.   Analyse du contexte
 *   II.  Objectifs (savoir + savoir-faire)
 *   III. Analyse des besoins + Problématique
 *   IV.  Contraintes
 *   V.   Généralisation
 *   VI.  Pistes de solution
 *   VII. Plan d'action
 *   VIII. Réalisation du plan d'action (4 sous-sections)
 *   IX.  Validation des hypothèses
 *   X.   Conclusion
 *   XI.  Synthèse du travail effectué
 *   XII. Références des méthodes et outils
 *   XIII. Références bibliographiques
 *
 * Usage :
 *   const { generateCerDocx } = require('./gen_docx_cer');
 *   await generateCerDocx(cerData, memoryContext, '/chemin/sortie.docx');
 */

"use strict";

const fs   = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, AlignmentType,
  LevelFormat, BorderStyle, ShadingType, ImageRun,
  Header, Footer, PageNumber, Table, TableRow, TableCell,
  WidthType, VerticalAlign,
} = require("docx");

// ── Palette ───────────────────────────────────────────────────────────────────
const C = {
  NAVY:   "1F3864",
  BLUE:   "2E75B6",
  RED:    "B71E42",
  GREEN:  "15803D",
  REDERR: "B91C1C",
  WHITE:  "FFFFFF",
  GRAY:   "555555",
  LGRAY:  "888888",
};

// ── Helpers typographiques ────────────────────────────────────────────────────

/** Bannière section principale : fond navy */
function sectionBanner(roman, title) {
  return new Paragraph({
    shading: { fill: C.NAVY, type: ShadingType.CLEAR, color: C.NAVY },
    spacing: { before: 400, after: 160 },
    indent: { left: 220 },
    children: [
      new TextRun({ text: `${roman}   ${title.toUpperCase()}`, bold: true, size: 26, color: C.WHITE, font: "Arial" }),
    ],
  });
}

/** Sous-titre de section : couleur bleue, bordure bordeaux */
function subTitle(text) {
  return new Paragraph({
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: C.RED, space: 1 } },
    spacing: { before: 220, after: 100 },
    children: [
      new TextRun({ text, bold: true, size: 24, color: C.NAVY, font: "Arial" }),
    ],
  });
}

/** Paragraphe corps justifié */
function bodyPara(text) {
  if (!text?.trim()) return null;
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { before: 80, after: 80, line: 290 },
    children: [new TextRun({ text, size: 22, font: "Times New Roman", color: C.GRAY })],
  });
}

/** Paragraphe italique gras (problématique) */
function italicPara(text) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { before: 100, after: 100, line: 290 },
    indent: { left: 400 },
    children: [new TextRun({ text: text || "", size: 22, font: "Times New Roman", color: C.NAVY, italics: true, bold: true })],
  });
}

/** Item puce bordeaux */
function bulletItem(text) {
  return new Paragraph({
    numbering: { reference: "bullets", level: 0 },
    spacing: { before: 60, after: 60, line: 280 },
    children: [new TextRun({ text: text || "", size: 22, font: "Times New Roman", color: C.GRAY })],
  });
}

/** Item numéroté */
function numberedItem(text) {
  return new Paragraph({
    numbering: { reference: "numbers", level: 0 },
    spacing: { before: 60, after: 60, line: 280 },
    children: [new TextRun({ text: text || "", size: 22, font: "Times New Roman", color: C.GRAY })],
  });
}

/** Item objectif (avec identifiant [OBJ_ID_N]) */
function objectifItem(text) {
  return new Paragraph({
    spacing: { before: 60, after: 60, line: 280 },
    indent: { left: 400 },
    children: [
      new TextRun({ text: "►  ", size: 22, font: "Arial", color: C.BLUE, bold: true }),
      new TextRun({ text: text || "", size: 22, font: "Times New Roman", color: C.GRAY }),
    ],
  });
}

/** Piste de solution avec flèche */
function pistePara(text) {
  return new Paragraph({
    spacing: { before: 80, after: 80, line: 280 },
    indent: { left: 360 },
    children: [
      new TextRun({ text: "→  ", size: 22, font: "Arial", color: C.RED, bold: true }),
      new TextRun({ text: text || "", size: 22, font: "Times New Roman", color: C.GRAY }),
    ],
  });
}

/** Ligne de validation (✓ vert / ✗ rouge) */
function validationItem(h) {
  const ok = (h.statut || "").toLowerCase().startsWith("valid") &&
             !(h.statut || "").toLowerCase().includes("in");
  return new Paragraph({
    spacing: { before: 80, after: 80, line: 280 },
    indent: { left: 280 },
    children: [
      new TextRun({ text: ok ? "✓  " : "✗  ", size: 24, font: "Arial", color: ok ? C.GREEN : C.REDERR, bold: true }),
      new TextRun({ text: `${h.hypothese || ""}`, size: 22, font: "Times New Roman", color: C.GRAY }),
      new TextRun({ text: `  (${h.statut || ""})`, size: 22, font: "Times New Roman", color: ok ? C.GREEN : C.REDERR, bold: true }),
    ],
  });
}

/** Référence bibliographique APA */
function refBiblio(text, index) {
  return new Paragraph({
    spacing: { before: 80, after: 60 },
    indent: { left: 500, hanging: 500 },
    children: [
      new TextRun({ text: `[${index}]  `, size: 22, font: "Times New Roman", color: C.NAVY, bold: true }),
      new TextRun({ text: text || "", size: 22, font: "Times New Roman", color: C.GRAY }),
    ],
  });
}

/** Ligne vide */
function spacer(h = 160) {
  return new Paragraph({ children: [new TextRun("")], spacing: { before: h, after: 0 } });
}

// ── Page de garde ─────────────────────────────────────────────────────────────
async function buildCoverPage(cer, memory) {
  const assetsDir = path.join(__dirname, "../assets");
  const elems = [];

  // Logos
  try {
    const logoUcac = fs.readFileSync(path.join(assetsDir, "logo_ucac.jpg"));
    const logoIcam = fs.readFileSync(path.join(assetsDir, "logo_icam.jpg"));
    elems.push(new Table({
      width: { size: 9000, type: WidthType.DXA },
      borders: {
        top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE },
        left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE },
        insideH: { style: BorderStyle.NONE }, insideV: { style: BorderStyle.NONE },
      },
      rows: [new TableRow({
        children: [
          new TableCell({
            width: { size: 4500, type: WidthType.DXA },
            verticalAlign: VerticalAlign.CENTER,
            children: [new Paragraph({
              alignment: AlignmentType.LEFT,
              children: [new ImageRun({ data: logoUcac, type: "jpg", transformation: { width: 110, height: 55 } })],
            })],
          }),
          new TableCell({
            width: { size: 4500, type: WidthType.DXA },
            verticalAlign: VerticalAlign.CENTER,
            children: [new Paragraph({
              alignment: AlignmentType.RIGHT,
              children: [new ImageRun({ data: logoIcam, type: "jpg", transformation: { width: 110, height: 55 } })],
            })],
          }),
        ],
      })],
    }));
  } catch {
    elems.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: "UCAC-ICAM", bold: true, size: 28, color: C.NAVY, font: "Arial" })],
    }));
  }

  elems.push(spacer(400));

  // Bannière CER
  elems.push(new Paragraph({
    shading: { fill: C.NAVY, type: ShadingType.CLEAR, color: C.NAVY },
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 0 },
    children: [new TextRun({ text: "C.E.R.", bold: true, size: 60, color: C.WHITE, font: "Arial" })],
  }));

  elems.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 0 },
    shading: { fill: C.NAVY, type: ShadingType.CLEAR, color: C.NAVY },
    children: [new TextRun({ text: "CAHIER D'ÉTUDE ET DE RECHERCHE", bold: true, size: 22, color: "CADCFC", font: "Arial" })],
  }));

  elems.push(new Paragraph({
    border: { top: { style: BorderStyle.SINGLE, size: 20, color: C.RED, space: 1 } },
    spacing: { before: 0, after: 200 },
    children: [new TextRun("")],
  }));

  // Encadré thème
  elems.push(new Paragraph({
    border: {
      top:    { style: BorderStyle.SINGLE, size: 12, color: C.BLUE, space: 8 },
      bottom: { style: BorderStyle.SINGLE, size: 12, color: C.BLUE, space: 8 },
    },
    alignment: AlignmentType.CENTER,
    spacing: { before: 160, after: 160 },
    indent: { left: 500, right: 500 },
    children: [
      new TextRun({ text: "THÈME :  ", size: 26, font: "Arial", bold: true, color: C.NAVY }),
      new TextRun({ text: (cer.theme || "").toUpperCase(), size: 26, font: "Arial", bold: true, color: C.RED }),
    ],
  }));

  elems.push(spacer(400));

  // Infos étudiant + tuteurs
  const center = { alignment: AlignmentType.CENTER, spacing: { before: 60, after: 60 } };
  const run = (label, value) => new Paragraph({
    ...center,
    children: [
      new TextRun({ text: label + "  ", size: 24, font: "Times New Roman", color: C.GRAY }),
      new TextRun({ text: value, size: 24, font: "Times New Roman", color: C.NAVY, bold: true }),
    ],
  });

  elems.push(run("Étudiant :", memory.student || "MAYACK ETIENNE"));
  elems.push(run("Promotion :", memory.promotion || "X2027"));
  elems.push(run("École :", "Institut Catholique de l'Art et des Métiers (UCAC-ICAM)"));
  elems.push(run("Année académique :", memory.annee || "2025 – 2026"));

  elems.push(spacer(200));

  elems.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 60, after: 30 },
    children: [new TextRun({ text: "Tuteurs :", size: 22, font: "Arial", color: C.GRAY, italic: true })],
  }));
  elems.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 30, after: 30 },
    children: [new TextRun({ text: "Mr. Humphrey ODJONG  ·  Mrs. Mathilde PUTHOD", size: 22, font: "Arial", color: C.NAVY, bold: true })],
  }));

  // Saut de page
  elems.push(new Paragraph({ pageBreakBefore: true, children: [new TextRun("")] }));

  return elems;
}

// ── Corps du document ─────────────────────────────────────────────────────────
function buildBody(cer) {
  const c = [];

  // ── I. Analyse du contexte ────────────────────────────────────────────────
  c.push(sectionBanner("I.", "Analyse du Contexte"));
  (cer.contexte || "").split("\n\n").filter(Boolean).forEach(p => {
    const bp = bodyPara(p); if (bp) c.push(bp);
  });
  c.push(spacer());

  // ── II. Objectifs ─────────────────────────────────────────────────────────
  c.push(sectionBanner("II.", "Objectifs"));
  c.push(subTitle("Objectifs de type Savoir"));
  (cer.objectifs_savoir || []).forEach(o => c.push(objectifItem(o)));
  c.push(spacer(120));
  c.push(subTitle("Objectifs de type Savoir-Faire"));
  (cer.objectifs_savoir_faire || []).forEach(o => c.push(objectifItem(o)));
  c.push(spacer());

  // ── III. Analyse des besoins ──────────────────────────────────────────────
  c.push(sectionBanner("III.", "Analyse des Besoins et Problématique"));
  c.push(subTitle("Besoins identifiés"));
  (cer.besoins || []).forEach(b => c.push(bulletItem(b)));
  c.push(spacer(120));
  c.push(subTitle("Problématique"));
  c.push(italicPara(cer.problematique || ""));
  c.push(spacer());

  // ── IV. Contraintes ───────────────────────────────────────────────────────
  c.push(sectionBanner("IV.", "Contraintes"));
  (cer.contraintes || []).forEach(ct => c.push(bulletItem(ct)));
  c.push(spacer());

  // ── V. Généralisation ─────────────────────────────────────────────────────
  c.push(sectionBanner("V.", "Généralisation"));
  c.push(italicPara(cer.generalisation || ""));
  c.push(spacer());

  // ── VI. Pistes de solution ────────────────────────────────────────────────
  c.push(sectionBanner("VI.", "Pistes de Solution"));
  (cer.pistes_solution || []).forEach(p => c.push(pistePara(p)));
  c.push(spacer());

  // ── VII. Plan d'action ────────────────────────────────────────────────────
  c.push(sectionBanner("VII.", "Plan d'Action"));
  (cer.plan_action || []).forEach(p => c.push(numberedItem(p)));
  c.push(spacer());

  // ── VIII. Réalisation ─────────────────────────────────────────────────────
  c.push(sectionBanner("VIII.", "Réalisation du Plan d'Action"));
  (cer.realisation || []).forEach((section, i) => {
    c.push(subTitle(`${i + 1}. ${section.titre || ""}`));
    (section.contenu || "").split("\n\n").filter(Boolean).forEach(p => {
      const bp = bodyPara(p); if (bp) c.push(bp);
    });
    c.push(spacer(120));
  });

  // ── IX. Validation des hypothèses ─────────────────────────────────────────
  c.push(sectionBanner("IX.", "Validation des Hypothèses"));
  (cer.validation_hypotheses || []).forEach(h => c.push(validationItem(h)));
  c.push(spacer());

  // ── X. Conclusion ─────────────────────────────────────────────────────────
  c.push(sectionBanner("X.", "Conclusion"));
  (cer.conclusion || "").split("\n\n").filter(Boolean).forEach(p => {
    const bp = bodyPara(p); if (bp) c.push(bp);
  });
  c.push(spacer());

  // ── XI. Synthèse ──────────────────────────────────────────────────────────
  c.push(sectionBanner("XI.", "Synthèse du Travail Effectué"));
  (cer.synthese || "").split("\n\n").filter(Boolean).forEach(p => {
    const bp = bodyPara(p); if (bp) c.push(bp);
  });
  c.push(spacer());

  // ── XII. Méthodes et outils ───────────────────────────────────────────────
  c.push(sectionBanner("XII.", "Références des Méthodes et Outils Utilisés"));
  (cer.methodes_utilisees || []).forEach((m, i) => {
    c.push(subTitle(`${i + 1}. ${m.titre || ""}`));
    if (m.reference) {
      c.push(new Paragraph({
        spacing: { before: 60, after: 40 },
        indent: { left: 360 },
        children: [
          new TextRun({ text: "Référence : ", size: 22, font: "Arial", bold: true, color: C.NAVY }),
          new TextRun({ text: m.reference, size: 22, font: "Times New Roman", color: C.GRAY, italic: true }),
        ],
      }));
    }
    const bp = bodyPara(m.description); if (bp) c.push(bp);
    c.push(spacer(80));
  });

  // ── XIII. Bibliographie ───────────────────────────────────────────────────
  c.push(sectionBanner("XIII.", "Références Bibliographiques"));
  (cer.references_bibliographiques || []).forEach((r, i) => c.push(refBiblio(r, i + 1)));

  return c;
}

// ── En-tête et pied de page ───────────────────────────────────────────────────
function buildHeader(cer, memory) {
  return new Header({
    children: [new Paragraph({
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: C.RED, space: 1 } },
      spacing: { after: 120 },
      tabStops: [{ type: "right", position: 8800 }],
      children: [
        new TextRun({ text: `CER — ${cer.theme || ""}`, size: 18, font: "Arial", color: C.LGRAY }),
        new TextRun({ text: `\t${memory.student || ""}`, size: 18, font: "Arial", color: C.LGRAY }),
      ],
    })],
  });
}

function buildFooter(memory) {
  return new Footer({
    children: [new Paragraph({
      border: { top: { style: BorderStyle.SINGLE, size: 6, color: C.RED, space: 1 } },
      spacing: { before: 120 },
      tabStops: [{ type: "right", position: 8800 }],
      children: [
        new TextRun({ text: `${memory.promotion || ""} · UCAC-ICAM · ${memory.annee || "2025–2026"}\t`, size: 18, font: "Arial", color: C.LGRAY }),
        new TextRun({ children: [PageNumber.CURRENT], size: 18, font: "Arial", color: C.LGRAY }),
        new TextRun({ text: " / ", size: 18, font: "Arial", color: C.LGRAY }),
        new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 18, font: "Arial", color: C.LGRAY }),
      ],
    })],
  });
}

// ── Export principal ──────────────────────────────────────────────────────────
/**
 * Génère le fichier DOCX du CER et l'écrit sur disque.
 * @param {object} cer        - Données du CER (JSON structuré de l'agent)
 * @param {object} memory     - Mémoire partagée (student, promotion, annee...)
 * @param {string} outputPath - Chemin complet du fichier .docx à créer
 */
async function generateCerDocx(cer, memory, outputPath) {
  const cover  = await buildCoverPage(cer, memory);
  const body   = buildBody(cer);
  const header = buildHeader(cer, memory);
  const footer = buildFooter(memory);

  const doc = new Document({
    numbering: {
      config: [
        {
          reference: "bullets",
          levels: [{
            level: 0, format: LevelFormat.BULLET, text: "•",
            alignment: AlignmentType.LEFT,
            style: {
              run: { color: C.RED, bold: true },
              paragraph: { indent: { left: 720, hanging: 360 } },
            },
          }],
        },
        {
          reference: "numbers",
          levels: [{
            level: 0, format: LevelFormat.DECIMAL, text: "%1.",
            alignment: AlignmentType.LEFT,
            style: {
              run: { bold: true, color: C.NAVY },
              paragraph: { indent: { left: 720, hanging: 360 } },
            },
          }],
        },
      ],
    },
    styles: {
      default: { document: { run: { font: "Times New Roman", size: 22 } } },
    },
    sections: [{
      properties: {
        page: {
          size:   { width: 11906, height: 16838 },
          margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 },
        },
      },
      headers:  { default: header },
      footers:  { default: footer },
      children: [...cover, ...body],
    }],
  });

  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(outputPath, buffer);
}

module.exports = { generateCerDocx };
