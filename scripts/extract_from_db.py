#!/usr/bin/env python3
import sys, json, sqlite3, re, os

DB = sys.argv[1] if len(sys.argv) > 1 else None
if not DB:
    raise SystemExit("Usage: python scripts/extract_from_db.py <path-to.db>")

con = sqlite3.connect(DB)
cur = con.cursor()

candidates = []

def fetch_text(table, col):
    try:
        for (v,) in cur.execute(f"SELECT {col} FROM {table}"):
            if v is None:
                continue
            if isinstance(v, bytes):
                v = v.decode("utf-8", errors="ignore")
            s = str(v).strip()
            if s:
                candidates.append(s)
    except Exception:
        pass

for table, cols in [("cards", ["question","answer"]), ("data_for_fact", ["value"])]:
    for col in cols:
        fetch_text(table, col)

con.close()

stop = {"インスピレーション", "Oblique"}
out = []
for s in candidates:
    s = s.replace("\r","").strip()
    if s in stop:
        continue
    s = re.sub(r"^(インスピレーション|Oblique)\s*$","", s).strip()
    if s:
        out.append(s)

seen = set()
uniq = []
for s in out:
    if s in seen:
        continue
    seen.add(s)
    uniq.append(s)

os.makedirs("docs", exist_ok=True)
with open("docs/questions.json","w",encoding="utf-8") as f:
    json.dump(uniq, f, ensure_ascii=False, indent=2)
    f.write("\n")
print(f"extracted_cells={len(candidates)} unique_questions={len(uniq)}")
