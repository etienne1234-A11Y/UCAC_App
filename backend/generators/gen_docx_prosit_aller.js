/**
 * generators/gen_docx_prosit_aller.js
 *
 * Génère un vrai fichier DOCX (Word) pour le Prosit Aller UCAC-ICAM.
 * Structure fidèle au template original :
 *   - Page de garde : logos, bannière bleue, cadre thème, infos étudiant
 *   - 8 sections numérotées avec bannières bleu marine
 *   - En-tête / pied de page avec numéros de page
 *   - Typographie Times New Roman, accents bordeaux
 *
 * Usage :
 *   const { generatePrositAllerDocx } = require('./gen_docx_prosit_aller');
 *   await generatePrositAllerDocx(paData, memoryContext, '/chemin/sortie.docx');
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

// ── Palette couleurs ──────────────────────────────────────────────────────────
const C = {
  NAVY:  "1F3864",   // Bleu marine UCAC-ICAM (titres, bannières)
  BLUE:  "2E75B6",   // Bleu moyen (sous-titres, accents)
  RED:   "B71E42",   // Bordeaux (puces, décoration)
  WHITE: "FFFFFF",
  GRAY:  "555555",   // Corps du texte
};

// ── Helpers typographiques ────────────────────────────────────────────────────

/** Bannière de section : fond bleu marine, texte blanc */
function sectionBanner(roman, title) {
  return new Paragraph({
    shading: { fill: C.NAVY, type: ShadingType.CLEAR, color: C.NAVY },
    spacing: { before: 360, after: 140 },
    indent: { left: 220 },
    children: [
      new TextRun({
        text: `${roman}   ${title.toUpperCase()}`,
        bold: true, size: 26, color: C.WHITE, font: "Arial",
      }),
    ],
  });
}

/** Paragraphe corps justifié */
function bodyPara(text) {
  if (!text?.trim()) return null;
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { before: 80, after: 80, line: 280 },
    children: [
      new TextRun({ text, size: 22, font: "Times New Roman", color: C.GRAY }),
    ],
  });
}

/** Paragraphe italique (généralisation, problématique) */
function italicPara(text) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { before: 80, after: 80, line: 280 },
    indent: { left: 360 },
    children: [
      new TextRun({
        text: text || "", size: 22, font: "Times New Roman",
        color: C.NAVY, italics: true, bold: true,
      }),
    ],
  });
}

/** Item puce avec bullet bordeaux */
function bulletItem(text) {
  return new Paragraph({
    numbering: { reference: "bullets", level: 0 },
    spacing: { before: 60, after: 60, line: 280 },
    children: [
      new TextRun({ text: text || "", size: 22, font: "Times New Roman", color: C.GRAY }),
    ],
  });
}

/** Item numéroté */
function numberedItem(text) {
  return new Paragraph({
    numbering: { reference: "numbers", level: 0 },
    spacing: { before: 60, after: 60, line: 280 },
    children: [
      new TextRun({ text: text || "", size: 22, font: "Times New Roman", color: C.GRAY }),
    ],
  });
}

/** Piste de solution avec flèche indentée */
function pistePara(text) {
  return new Paragraph({
    spacing: { before: 80, after: 80, line: 280 },
    indent: { left: 400 },
    children: [
      new TextRun({ text: "→  ", size: 22, font: "Arial", color: C.RED, bold: true }),
      new TextRun({ text: text || "", size: 22, font: "Times New Roman", color: C.GRAY }),
    ],
  });
}

/** Ligne vide */
function spacer(size = 160) {
  return new Paragraph({ children: [new TextRun("")], spacing: { before: size, after: 0 } });
}

// ── Page de garde ─────────────────────────────────────────────────────────────
async function buildCoverPage(pa, memory) {
  const assetsDir = path.join(__dirname, "../assets");
  const elems = [];

  // Logos en haut (table 2 colonnes)
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
    // Si logos absents, ligne de substitution
    elems.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: "UCAC-ICAM", bold: true, size: 28, color: C.NAVY, font: "Arial" })],
    }));
  }

  elems.push(spacer(400));

  // Bannière titre PROSIT ALLER
  elems.push(new Paragraph({
    shading: { fill: C.NAVY, type: ShadingType.CLEAR, color: C.NAVY },
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 0 },
    children: [new TextRun({ text: "PROSIT ALLER", bold: true, size: 52, color: C.WHITE, font: "Arial" })],
  }));

  // Ligne bordeaux décorative sous la bannière
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
    spacing: { before: 200, after: 200 },
    indent: { left: 600, right: 600 },
    children: [
      new TextRun({ text: "THÈME :  ", size: 26, font: "Arial", bold: true, color: C.NAVY }),
      new TextRun({ text: (pa.theme || "").toUpperCase(), size: 26, font: "Arial", bold: true, color: C.RED }),
    ],
  }));

  elems.push(spacer(600));

  // Informations étudiant
  const infoStyle = { size: 24, font: "Times New Roman", color: C.GRAY };
  const boldBlue  = { size: 24, font: "Times New Roman", color: C.NAVY, bold: true };
  const lines = [
    { label: "Élève ingénieur :", value: memory.student || "MAYACK ETIENNE" },
    { label: "École :",           value: "Institut Catholique de l'Art et des Métiers (UCAC-ICAM)" },
    { label: "Promotion :",       value: memory.promotion || "X2027" },
    { label: "Année académique :", value: memory.annee || "2025 – 2026" },
  ];

  lines.forEach(({ label, value }) => {
    elems.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 60, after: 60 },
      children: [
        new TextRun({ text: label + "  ", ...infoStyle }),
        new TextRun({ text: value, ...boldBlue }),
      ],
    }));
  });

  // Saut de page en fin de couverture
  elems.push(new Paragraph({
    pageBreakBefore: true,
    children: [new TextRun("")],
  }));

  return elems;
}

// ── Corps du document ─────────────────────────────────────────────────────────
function buildBody(pa) {
  const elems = [];

  // I — Mots clés
  elems.push(sectionBanner("I.", "Mots Clés"));
  (pa.mots_cles || []).forEach(m => elems.push(bulletItem(m)));
  elems.push(spacer());

  // II — Contexte
  elems.push(sectionBanner("II.", "Contexte"));
  (pa.contexte || "").split("\n").filter(Boolean).forEach(p => { const bp = bodyPara(p); if (bp) elems.push(bp); });
  elems.push(spacer());

  // III — Définition des besoins
  elems.push(sectionBanner("III.", "Définition des Besoins"));
  (pa.definition_besoins || []).forEach(b => elems.push(bulletItem(b)));
  elems.push(spacer());

  // IV — Problématique
  elems.push(sectionBanner("IV.", "Définition de la Problématique"));
  elems.push(italicPara(pa.problematique || ""));
  elems.push(spacer());

  // V — Contraintes
  elems.push(sectionBanner("V.", "Définition des Contraintes"));
  (pa.contraintes || []).forEach(c => elems.push(bulletItem(c)));
  elems.push(spacer());

  // VI — Généralisation
  elems.push(sectionBanner("VI.", "Généralisation"));
  elems.push(italicPara(pa.generalisation || ""));
  elems.push(spacer());

  // VII — Pistes de solution
  elems.push(sectionBanner("VII.", "Pistes de Solution"));
  (pa.pistes_solution || []).forEach(p => elems.push(pistePara(p)));
  elems.push(spacer());

  // VIII — Plan d'action
  elems.push(sectionBanner("VIII.", "Plan d'Action"));
  (pa.plan_action || []).forEach(p => elems.push(numberedItem(p)));

  return elems;
}

// ── En-tête et pied de page ───────────────────────────────────────────────────
function buildHeader(pa, memory) {
  return new Header({
    children: [new Paragraph({
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: C.RED, space: 1 } },
      spacing: { after: 120 },
      tabStops: [{ type: "right", position: 8800 }],
      children: [
        new TextRun({ text: `Prosit Aller — ${pa.theme || ""}`, size: 18, font: "Arial", color: "888888" }),
        new TextRun({ text: `\t${memory.student || ""}`, size: 18, font: "Arial", color: "888888" }),
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
        new TextRun({ text: `${memory.promotion || ""} · UCAC-ICAM · ${memory.annee || "2025–2026"}\t`, size: 18, font: "Arial", color: "888888" }),
        new TextRun({ children: [PageNumber.CURRENT], size: 18, font: "Arial", color: "888888" }),
        new TextRun({ text: " / ", size: 18, font: "Arial", color: "888888" }),
        new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 18, font: "Arial", color: "888888" }),
      ],
    })],
  });
}

// ── Export principal ──────────────────────────────────────────────────────────
/**
 * Génère le fichier DOCX du Prosit Aller et l'écrit sur disque.
 * @param {object} pa         - Données du Prosit Aller (JSON structuré de l'agent)
 * @param {object} memory     - Mémoire partagée (student, promotion, annee...)
 * @param {string} outputPath - Chemin complet du fichier .docx à créer
 */
async function generatePrositAllerDocx(pa, memory, outputPath) {
  const cover  = await buildCoverPage(pa, memory);
  const body   = buildBody(pa);
  const header = buildHeader(pa, memory);
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
          size:   { width: 11906, height: 16838 },  // A4
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

module.exports = { generatePrositAllerDocx };
