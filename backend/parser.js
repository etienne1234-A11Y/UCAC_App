/**
 * parser.js — Extraction de texte depuis différents formats
 *
 * Supporte : JSON, TXT, DOCX, PPTX, PPT
 */

"use strict";
const { parseOffice } = require("officeparser");
const path = require("path");
const os   = require("os");
const fs   = require("fs");

async function extractText(buffer, filename) {
  const ext = (filename || "").split(".").pop().toLowerCase();

  if (ext === "json") {
    const text = buffer.toString("utf-8");
    return { text, type: "json", isJson: true };
  }

  if (ext === "txt") {
    const text = buffer.toString("utf-8");
    return { text, type: "txt", isJson: false };
  }

  if (["docx", "pptx", "ppt", "doc"].includes(ext)) {
    const tmp = path.join(os.tmpdir(), `ucac_parse_${Date.now()}.${ext}`);
    try {
      fs.writeFileSync(tmp, buffer);
      const raw  = await parseOffice(tmp);
      // parseOffice retourne un objet avec une méthode toText()
      const text = (raw && typeof raw.toText === "function")
        ? raw.toText()
        : typeof raw === "string" ? raw : String(raw ?? "");
      return { text, type: ext, isJson: false };
    } finally {
      try { fs.unlinkSync(tmp); } catch { /* ignore */ }
    }
  }

  // Fallback UTF-8
  const text = buffer.toString("utf-8");
  const couldBeJson = text.trimStart().startsWith("{") || text.trimStart().startsWith("[");
  return { text, type: ext, isJson: couldBeJson };
}

module.exports = { extractText };
