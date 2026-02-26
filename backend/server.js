/**
 * server.js — UCAC-ICAM Multi-Agents v3.0
 * POST /api/parse  → import DOCX/PPTX/PDF/JSON
 * POST /api/run    → pipeline agents (SSE)
 * GET  /api/status
 * GET  /api/download/:filename
 */
"use strict";
require("dotenv").config();
const express = require("express");
const cors    = require("cors");
const path    = require("path");
const fs      = require("fs");
const { createMemory, run } = require("./orchestrator");
const { extractText }       = require("./parser");
const { structureDocument } = require("./structurer");

const app  = express();
const PORT = process.env.PORT || 3001;
const OUT  = path.join(__dirname, "output");
fs.mkdirSync(OUT, { recursive: true });

app.use(cors());
app.use(express.json({ limit: "20mb" }));

app.get("/api/status", (_req, res) =>
  res.json({ ok: true, version: "3.0", formats: ["docx","pptx","pdf","json","txt"] }));

// ── /api/parse : extrait et structure un fichier importé ─────────────────────
app.post("/api/parse", async (req, res) => {
  const { filename, data: b64, hint = "auto" } = req.body;
  if (!filename || !b64)
    return res.status(400).json({ ok: false, error: "filename et data (base64) requis" });
  try {
    const buffer = Buffer.from(b64, "base64");
    const { text, type, isJson } = await extractText(buffer, filename);

    if (isJson) {
      let parsed; try { parsed = JSON.parse(text); } catch { parsed = null; }
      if (parsed && typeof parsed === "object") {
        const docType = hint !== "auto" ? hint : detectJsonType(parsed);
        return res.json({ ok: true, docType, preview: buildPreview(parsed, docType), rawText: text.slice(0,400), data: parsed });
      }
    }

    const { data, docType, preview } = await structureDocument(text, hint);
    res.json({ ok: true, docType, preview, rawText: text.slice(0, 400) + (text.length > 400 ? "…" : ""), data });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

function detectJsonType(obj) {
  if (obj.validation_hypotheses && obj.definitions) return "prosit_retour";
  if (obj.objectifs_savoir || obj.realisation)      return "cer";
  return "prosit_aller";
}
function buildPreview(data, type) {
  return [
    `📌 Thème : ${data.theme || "—"}`,
    data.mots_cles?.length   ? `🔑 Mots clés (${data.mots_cles.length}) : ${data.mots_cles.slice(0,4).join(", ")}` : null,
    data.definitions         ? `📖 Définitions : ${Object.keys(data.definitions).slice(0,3).join(", ")}` : null,
    data.problematique       ? `❓ ${data.problematique.slice(0,100)}` : null,
    data.plan_action?.length ? `📋 Plan : ${data.plan_action.length} étapes` : null,
    data.realisation?.length ? `⚙️ Réalisation : ${data.realisation.length} sections` : null,
  ].filter(Boolean).join("\n");
}

// ── /api/run : pipeline SSE ───────────────────────────────────────────────────
app.post("/api/run", async (req, res) => {
  const { theme, rawInput, mode = "full", skipPR = false,
          student, promotion, annee, prositAller = null, prositRetour = null } = req.body;
  if (!theme && !prositAller && !prositRetour)
    return res.status(400).json({ error: "theme ou données importées requis" });

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const send = (type, data) => res.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
  const resolvedTheme = theme || (prositRetour || prositAller || {}).theme || "Prosit UCAC-ICAM";

  const memory = createMemory({
    theme: resolvedTheme, rawInput: rawInput || "",
    student: student || "MAYACK ETIENNE", promotion: promotion || "X2027",
    annee: annee || "2025 – 2026", outputDir: OUT, prositAller, prositRetour,
  });

  try {
    await run(memory, mode, skipPR,
      (agent, type, msg) => send("log",  { agent, type, msg }),
      (msg)              => send("step", { msg }),
    );
    const files = {};
    Object.entries(memory.files).forEach(([k, v]) => { if (v) files[k] = path.basename(v); });
    send("done", { files, warnings: memory.coherenceWarnings,
                   prositAller: memory.prositAller, prositRetour: memory.prositRetour, cer: memory.cer });
  } catch (err) { send("error", { message: err.message }); }
  res.end();
});

// ── /api/download ─────────────────────────────────────────────────────────────
app.get("/api/download/:filename", (req, res) => {
  const filename = path.basename(req.params.filename);
  const filePath = path.join(OUT, filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: "Fichier non trouvé" });
  const ext  = path.extname(filename).toLowerCase();
  const mime = ext === ".docx"
    ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    : "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  res.setHeader("Content-Type", mime);
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  fs.createReadStream(filePath).pipe(res);
});

app.listen(PORT, () => {
  console.log(`\n${"═".repeat(52)}`);
  console.log(` UCAC-ICAM Multi-Agent Server v3.0`);
  console.log(` Port   : http://localhost:${PORT}`);
  console.log(` Formats: DOCX · PPTX · PDF · JSON`);
  console.log(`${"═".repeat(52)}\n`);
});
