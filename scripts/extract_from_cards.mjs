import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const CARDS = process.argv[2];
if (!CARDS) throw new Error("Usage: node scripts/extract_from_cards.mjs <path-to.cards>");

const outDir = ".tmp_cards";
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

execSync(`unzip -q "${CARDS}" -d "${outDir}"`);

const xmlPath = path.join(outDir, "cards.xml");
if (!fs.existsSync(xmlPath)) throw new Error("cards.xml not found inside .cards (zip)");
const xml = fs.readFileSync(xmlPath, "utf8");

function decodeEntities(s) {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#10;/g, "\n")
    .replace(/&#13;/g, "\r");
}

const re = /<p_1>([\s\S]*?)<\/p_1>/g;
const raw = [];
let m;
while ((m = re.exec(xml))) {
  const s = decodeEntities(m[1]).replace(/\r/g, "").replace(/\n+/g, "\n").replace(/[\t ]+/g, " ").trim();
  if (s) raw.push(s);
}

const cleaned = raw.map(s => s.replace(/^\s*[-–—・●◆■]\s*/g, "").trim()).filter(Boolean);

const seen = new Set();
const uniq = [];
for (const s of cleaned) { if (!seen.has(s)) { seen.add(s); uniq.push(s); } }

fs.mkdirSync("docs", { recursive: true });
fs.writeFileSync("docs/questions.json", JSON.stringify(uniq, null, 2) + "\n", "utf8");
console.log(`extracted p_1: ${raw.length}`);
console.log(`after clean:  ${cleaned.length}`);
console.log(`unique:       ${uniq.length}`);
