import fs from "node:fs";

const API_KEY = process.env.GEMINI_API_KEY;
const MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";
if (!API_KEY) throw new Error("GEMINI_API_KEY is required");

const questionsPath = "docs/questions.json";
const todayPath = "docs/today.json";

const archive = JSON.parse(fs.readFileSync(questionsPath, "utf8"));
if (!Array.isArray(archive) || archive.length < 50) {
  throw new Error("questions.json seems too small or invalid");
}

function sample(arr, n) {
  const out = [];
  const used = new Set();
  while (out.length < n) {
    const i = Math.floor(Math.random() * arr.length);
    if (used.has(i)) continue;
    used.add(i);
    out.push(arr[i]);
  }
  return out;
}

function sanitize(q) {
  return String(q || "").replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim();
}

function looksBad(q) {
  if (!q) return true;
  if (q.length < 6) return true;
  if (q.length > 140) return true;
  if (/^\d+[.)]/.test(q)) return true;
  if (/^\d{4}[/-]\d{1,2}[/-]\d{1,2}/.test(q)) return true;
  if (/[#＃]/.test(q)) return true;
  if (/https?:\/\//.test(q)) return true;
  if (/[\u{1F000}-\u{1FAFF}]/u.test(q)) return true;
  return false;
}

const samples = sample(archive, 12).map(s => `- ${s}`).join("\n");

const prompt = `あなたは「日本語オブリーク・ストラテジーズ」的な短い問いを1つだけ生成する装置です。
目的は“答え”を出すことではなく、人間の思考を開始させる「異物としての問い」を置くことです。

# 出力ルール（厳守）
- 出力は問いを1つだけ。余計な前置き・解説・タイトル・注釈は禁止。
- 番号・日付・作者名・引用元・ハッシュタグは禁止。
- 箇条書き禁止。絵文字禁止。
- 1文（長くても2文）。日本語として自然。
- 固有名詞（企業名、SNS、時事、人物名）を避ける。
- 既存の問いをそのままコピーしない（同文禁止）。

# 作風参照（この系列に揃える。内容をコピーしない）
${samples}

それでは、問いを1つだけ出力せよ。`;

const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`;

const res = await fetch(url, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.9, topP: 0.95, maxOutputTokens: 120 }
  })
});

if (!res.ok) {
  const t = await res.text();
  throw new Error(`Gemini API error: ${res.status}\n${t}`);
}

const data = await res.json();
const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
const q = sanitize(text);

if (looksBad(q)) throw new Error("Generated question failed validation: " + q);
if (archive.includes(q)) throw new Error("Generated question is duplicate: " + q);

fs.writeFileSync(todayPath, JSON.stringify({ q }, null, 2) + "\n", "utf8");
archive.push(q);
fs.writeFileSync(questionsPath, JSON.stringify(archive, null, 2) + "\n", "utf8");
console.log("generated:", q);
