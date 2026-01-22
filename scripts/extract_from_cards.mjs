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
if (!fs.existsSync(xmlPath)) throw new Error("cards.xml not found inside .cards");
const xml = fs.readFileSync(xmlPath, "utf8");

const re = /<p_1>([\s\S]*?)<\/p_1>/g;
const raw = [];
let m;
while ((m = re.exec(xml))) {
  const s = m[1]
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\r/g, "")
    .replace(/[ 	　]+/g, " ")
    .trim();
  if (s) raw.push(s);
}

const seen = new Set();
const uniq = [];
for (const s of raw) {
  if (seen.has(s)) continue;
  seen.add(s);
  uniq.push(s);
}

fs.mkdirSync("public", { recursive: true });
fs.writeFileSync("public/questions.json", JSON.stringify(uniq, null, 2) + "\n", "utf8");
console.log(`extracted: ${raw.length}, unique: ${uniq.length}`);
