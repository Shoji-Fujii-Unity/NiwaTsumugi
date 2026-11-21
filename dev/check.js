// 静的チェック: 構文・データ整合・テキストキーの欠落をみる
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const file = path.join(__dirname, "..", "index.html");
const html = fs.readFileSync(file, "utf8");
let bad = 0;
const fail = (m) => { console.log("  ✗ " + m); bad++; };
const ok = (m) => console.log("  ✓ " + m);

/* 1) inline script の構文 */
const scripts = [];
const re = /<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/g;
let m;
while ((m = re.exec(html))) scripts.push({ attrs: m[1], body: m[2] });
console.log("[1] scripts found:", scripts.length);
let engine = null;
for (const s of scripts) {
  if (/text\/plain/.test(s.attrs)) continue;
  try { new vm.Script(s.body, { filename: "inline.js" }); ok("syntax OK (" + s.body.length + " chars)"); engine = s.body; }
  catch (e) {
    fail("syntax: " + e.message);
    const mm = /inline\.js:(\d+)/.exec(e.stack || "");
    if (mm) {
      const lines = s.body.split("\n");
      const n = +mm[1];
      for (let i = Math.max(0, n - 3); i < Math.min(lines.length, n + 2); i++)
        console.log("      " + (i + 1) + "| " + lines[i]);
    }
  }
}

/* 2) データブロック */
const dm = /<script id="TXT" type="text\/plain">([\s\S]*?)<\/script>/.exec(html);
if (!dm) { console.log("[2] TXT block missing"); process.exit(1); }
const sec = {};
let cur = "";
for (const raw of dm[1].split("\n")) {
  const line = raw.trim();
  if (!line || line[0] === "#") continue;
  if (line[0] === "[") { cur = line.slice(1, -1).trim(); sec[cur] = sec[cur] || []; continue; }
  (sec[cur] = sec[cur] || []).push(line);
}
const sp = {}, lines = sec.sp || [];
let noteTri = 0;
for (const line of lines) {
  const f = line.split(";");
  if (f.length < 17) fail("sp fields " + f.length + " < 17: " + f[0]);
  if (f.length > 17) fail("sp fields " + f.length + " > 17: " + f[0]);
  if (f[1].split("|").length !== 3) fail("sp name langs: " + f[0]);
  if (f[15].split("|").length === 3) noteTri++;
  if (!/^[*wsma]+$/.test(f[10])) fail("sp seasons: " + f[0] + " = " + f[10]);
  if (!(+f[5] > 0) || !(+f[6] > 0)) fail("sp numbers: " + f[0]);
  if (sp[f[0]]) fail("duplicate species: " + f[0]);
  sp[f[0]] = { sh: f[2], flag: f[16] || "" };
}
console.log("[2] species:", Object.keys(sp).length, "| hybrids:", (sec.hyb || []).length,
  "| cmp:", (sec.cmp || []).length, "| visitors:", (sec.vis || []).length,
  "| ornaments:", (sec.orn || []).length, "| milestones:", (sec.mile || []).length,
  "| weather:", (sec.wx || []).length, "| events:", (sec.evt || []).length);
console.log("    species notes in ja|en|zh:", noteTri + "/" + lines.length);

const hybIds = new Set();
for (const line of (sec.hyb || [])) {
  const f = line.split(";");
  if (f.length !== 3) fail("hyb fields: " + line);
  if (!sp[f[0]]) fail("hyb child missing: " + f[0]);
  if (!sp[f[1]] || !sp[f[2]]) fail("hyb parent missing: " + line);
  if (sp[f[0]] && sp[f[0]].flag !== "h") fail("hyb child not flagged h: " + f[0]);
  hybIds.add(f[0]);
}
for (const id of Object.keys(sp)) {
  const isH = sp[id].flag === "h";
  if (isH && !hybIds.has(id)) fail("flagged h but no [hyb] row: " + id);
  if (!isH && hybIds.has(id)) fail("in [hyb] but not flagged: " + id);
}
for (const line of (sec.cmp || [])) {
  const f = line.split(";");
  if (f.length !== 3) fail("cmp fields: " + line);
  if (!sp[f[0]] || !sp[f[1]]) fail("cmp species missing: " + line);
  if (!isFinite(+f[2])) fail("cmp weight: " + line);
}
for (const line of (sec.vis || [])) if (line.split(";").length !== 5) fail("vis fields: " + line);
for (const line of (sec.orn || [])) if (line.split(";").length !== 5) fail("orn fields: " + line);
for (const line of (sec.wx || [])) if (line.split(";").length !== 5) fail("wx fields: " + line);
for (const line of (sec.mile || [])) if (line.split(";").length !== 4) fail("mile fields: " + line);
for (const line of (sec.evt || [])) if (line.split(";").length !== 3) fail("evt fields: " + line);
for (const line of (sec.yp || [])) if (line.split(";").length < 2) fail("yp fields: " + line);

/* ui キー */
const ui = {};
for (const line of (sec.ui || [])) { const k = line.indexOf("="); if (k < 0) { fail("ui no =: " + line); continue; }
  ui[line.slice(0, k)] = line.slice(k + 1); }
let langBad = 0;
for (const k of Object.keys(ui)) if (ui[k].split("|").length !== 3) { fail("ui langs " + k + " => " + ui[k]); langBad++; }
if (!langBad) ok("ui entries all have ja|en|zh (" + Object.keys(ui).length + ")");

/* 3) code から t("key") を拾う */
const want = new Set();
const tre = /\bt\(\s*"([a-z0-9_]+)"/g;
while ((m = tre.exec(engine || ""))) want.add(m[1]);
const DYN = new Set(["stage_", "can_tip"]); // 文字列連結で作るキー（プレフィックス側）
const missing = [...want].filter((k) => !ui[k] && !DYN.has(k));
if (missing.length) fail("missing ui keys: " + missing.join(", "));
else ok("all static t() keys exist (" + want.size + " used)");
for (const k of ["stage_seed", "stage_sprout", "stage_grow", "stage_bud", "stage_bloom",
  "stage_seeded", "stage_dormant", "stage_withered", "can_tip2", "can_tip3"])
  if (!ui[k]) fail("missing dynamic ui key: " + k);

const evIds = new Set((sec.evt || []).map((l) => l.split(";")[0]));
const evUsed = [...(engine || "").matchAll(/"(e_[a-z]+)"/g)].map((x) => x[1]);
for (const e of evUsed) if (!evIds.has(e)) fail("event id not in [evt]: " + e);
if (evUsed.length) ok("events referenced: " + new Set(evUsed).size + " / defined " + evIds.size);

const spUsed = [...(engine || "").matchAll(/"(dandelion|clover|moss|tulip|crocus|cherry|yuri|fuji|botan|snowdrop|camellia|hellebore|centgrass|susuki|lotus|lavender|morningglory|sunflower|mum|poppy|edelweiss|bluebell|gentian|daffodil|spiderlily|wintersweet)"/g)].map((x) => x[1]);
for (const s of new Set(spUsed)) if (!sp[s]) fail("species id referenced in code but absent: " + s);

/* 4) HTML の id 参照 */
const ids = new Set([...html.matchAll(/\bid="([\w-]+)"/g)].map((x) => x[1]));
const used = new Set([...(engine || "").matchAll(/el\("([\w-]+)"\)/g)].map((x) => x[1]));
for (const u of used) if (!ids.has(u)) fail("el() target has no element id: " + u);
if (used.size) ok("el() id references checked (" + used.size + ")");

console.log(bad ? "\nRESULT: " + bad + " problem(s)" : "\nRESULT: clean");
process.exit(bad ? 1 : 0);
