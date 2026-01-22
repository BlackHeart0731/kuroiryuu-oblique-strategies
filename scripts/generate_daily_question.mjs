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
  return String(q || "")
    .replace(/\r/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function looksBad(q) {
  if (!q) return true;
  if (q.length < 6) return true;
  if (q.length > 140) return true;
  if (/^\d+[.)]/.test(q)) return true;
  if (/^\d{4}[/-]\d{1,2}[/-]\d{1,2}/.test(q)) return true;
  if (/[#＃]/.test(q)) return true;
  if (/https?:\/\//.test(q)) return true;
  // 絵文字ざっくり検出（広め）
  if (/[\u{1F000}-\u{1FAFF}]/u.test(q)) return true;
  return false;
}

function pickRandomFromArchive(arr) {
  return arr[Math.floor(Math.random() * arr.length)] || "";
}

function writeToday(q) {
  fs.writeFileSync(todayPath, JSON.stringify({ q }, null, 2) + "\n", "utf8");
}

function appendArchive(q) {
  archive.push(q);
  fs.writeFileSync(questionsPath, JSON.stringify(archive, null, 2) + "\n", "utf8");
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Gemini generateContent (v1)
 * - v1beta ではなく v1 を使う（モデル/メソッド対応のトラブル回避）
 */
async function callGemini(promptText) {
  const url = `https://generativelanguage.googleapis.com/v1/models/${MODEL}:generateContent?key=${API_KEY}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: promptText }] }],
      generationConfig: {
        temperature: 0.9,
        topP: 0.95,
        maxOutputTokens: 120
      }
    })
  });

  const text = await res.text(); // 先に取っておく（エラー時にも中身が見える）
  if (!res.ok) {
    const err = new Error(`Gemini API error: ${res.status}\n${text}`);
    err.status = res.status;
    err.body = text;
    throw err;
  }

  const data = JSON.parse(text);
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

function buildPrompt(samples) {
  const ref = samples.map((s) => `- ${s}`).join("\n");
  return `あなたは「黒井流オブリーク・ストラテジーズ」的な短い問いを1つだけ生成する装置です。
目的は“答え”を出すことではなく、人間の思考を開始させる「異物としての問い」を置くことです。

# 出力ルール（厳守）
- 出力は問いを1つだけ。余計な前置き・解説・タイトル・注釈は禁止。
- 番号・日付・作者名・引用元・ハッシュタグは禁止。
- 箇条書き禁止。絵文字禁止。
- 1文（長くても2文）。日本語として自然。
- 固有名詞（企業名、SNS、時事、人物名）を避ける。
- 既存の問いをそのままコピーしない（同文禁止）。同文なら失敗とする。

# 作風参照（この系列に揃える。内容をコピーしない）
${ref}

それでは、問いを1つだけ出力せよ。`;
}

/**
 * 429/5xx は一時的なことがあるので少しリトライ
 * ただし「無料枠が0」みたいな構造的429もあるので、最後はフォールバックする
 */
async function generateWithRetry(promptText, maxAttempts = 3) {
  let lastErr = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const raw = await callGemini(promptText);
      return raw;
    } catch (e) {
      lastErr = e;

      const status = e?.status;
      // 429 or 5xx のときだけ短く待ってリトライ
      if (status === 429 || (status >= 500 && status <= 599)) {
        // exponential-ish backoff
        const wait = 1500 * attempt;
        console.log(`retryable error (${status}), attempt ${attempt}/${maxAttempts}, waiting ${wait}ms`);
        await sleep(wait);
        continue;
      }

      // 404/400 などは設定ミスの可能性が高いので即終了
      throw e;
    }
  }

  throw lastErr;
}

(async () => {
  // 参照サンプル（作風の“芯”）
  const samples = sample(archive, 12);
  const prompt = buildPrompt(samples);

  try {
    const text = await generateWithRetry(prompt, 3);
    const q = sanitize(text);

    if (looksBad(q)) throw new Error("Generated question failed validation: " + q);
    if (archive.includes(q)) throw new Error("Generated question is duplicate: " + q);

    // 成功：today 更新 + archive 追記
    writeToday(q);
    appendArchive(q);
    console.log("generated:", q);
  } catch (e) {
    const status = e?.status;

    // 429（クォータ/無料枠）などで生成できない場合でも「展示を止めない」。
    // → today だけ既存アーカイブから引く（archiveは増やさない）
    if (status === 429) {
      const fallback = pickRandomFromArchive(archive);
      writeToday(fallback);
      console.log("Gemini quota/rate limited (429). Fallback to archive for today:", fallback);
      // 成功扱いにして workflow を落とさない
      process.exit(0);
    }

    // それ以外は設定ミス/重大エラーとして落とす（直すべき）
    console.error(e);
    process.exit(1);
  }
})();
