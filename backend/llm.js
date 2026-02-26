/**
 * llm.js — Module LLM partagé (Google Gemini)
 *
 * Fournit une interface unique pour tous les agents.
 * Inclut un retry automatique sur rate-limit (jusqu'à 3 tentatives).
 */

"use strict";

const GEMINI_MODEL = "gemini-2.5-flash-lite";

async function callLLM(system, messages, maxTokens = 2000) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY manquante dans .env");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  const contents = messages.map(m => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: String(m.content || "") }],
  }));

  const body = {
    systemInstruction: { parts: [{ text: system }] },
    contents,
    generationConfig: { maxOutputTokens: maxTokens, temperature: 0.7 },
  };

  const MAX_RETRIES = 3;
  let lastErr;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res  = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (data.error) {
        const msg = data.error.message || JSON.stringify(data.error);
        const isRateLimit = msg.includes("quota") || msg.includes("retry") || res.status === 429;
        if (isRateLimit && attempt < MAX_RETRIES) {
          const wait = attempt * 8000; // 8s, 16s
          console.warn(`[llm] Rate limit (tentative ${attempt}/${MAX_RETRIES}) — retry dans ${wait/1000}s…`);
          await new Promise(r => setTimeout(r, wait));
          continue;
        }
        throw new Error(`Gemini API Error: ${msg}`);
      }

      const candidate = data.candidates?.[0];
      // Vérifier le finish_reason pour détecter la troncature
      if (candidate?.finishReason === "MAX_TOKENS") {
        console.warn("[llm] Réponse tronquée (MAX_TOKENS) — le JSON sera réparé par parseJSON");
      }
      if (!candidate?.content?.parts?.length) {
        throw new Error("Gemini: réponse vide ou bloquée par le filtre de sécurité");
      }

      return candidate.content.parts.map(p => p.text).join("\n");
    } catch (err) {
      lastErr = err;
      const isTransient = err.message.includes("quota") || err.message.includes("retry") || err.message.includes("fetch");
      if (isTransient && attempt < MAX_RETRIES) {
        const wait = attempt * 8000;
        console.warn(`[llm] Erreur transitoire (tentative ${attempt}/${MAX_RETRIES}) — retry dans ${wait/1000}s…`);
        await new Promise(r => setTimeout(r, wait));
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

module.exports = { callLLM };
