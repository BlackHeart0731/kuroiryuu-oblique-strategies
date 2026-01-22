import fs from "node:fs";

const TSV = process.argv[2];
if (!TSV) throw new Error("Usage: node scripts/extract_from_tsv.mjs <path-to.tsv>");

const txt = fs.readFileSync(TSV, "utf8");
const lines = txt.split(/\r?\n/).filter(Boolean);
if (lines.length < 2) throw new Error("TSV seems empty");

const rows = lines.slice(1);
const qs = [];
for (const line of rows) {
  const cols = line.split("\t");
  if (cols.length < 2) continue;
  const q = String(cols[1] || "").trim();
  if (q) qs.push(q);
}

const seen = new Set();
const uniq = [];
for (const q of qs) { if (!seen.has(q)) { seen.add(q); uniq.push(q); } }

fs.mkdirSync("docs", { recursive: true });
fs.writeFileSync("docs/questions.json", JSON.stringify(uniq, null, 2) + "\n", "utf8");
console.log(`rows: ${rows.length}, unique questions: ${uniq.length}`);
