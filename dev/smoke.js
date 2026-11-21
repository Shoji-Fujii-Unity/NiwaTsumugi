// ヘッドレス・スモークテスト：DOM を模した環境でエンジンを動かし、庭の 100 年を回す
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const m = /<script>\n"use strict";([\s\S]*?)\n<\/script>/.exec(html);
if (!m) { console.log("engine script not found"); process.exit(1); }
const code = '"use strict";' + m[1];

/* ---- DOM stub ---- */
function mkCtx2D() {
  const noop = () => {};
  return { globalAlpha: 1, fillStyle: "", strokeStyle: "", lineWidth: 1,
    clearRect: noop, setTransform: noop, beginPath: noop, arc: noop, ellipse: noop,
    fill: noop, moveTo: noop, lineTo: noop, stroke: noop, save: noop, restore: noop, translate: noop, rotate: noop };
}
function mkEl(tag) {
  const e = {
    tagName: (tag || "div").toUpperCase(), _h: "", children: [], parentNode: null,
    style: { setProperty: () => {}, removeProperty: () => {} },
    classList: { add: () => {}, remove: () => {}, toggle: () => {}, contains: () => false },
    firstElementChild: null, hidden: false, value: "", textContent: "",
    get firstChild() { return this.children[0] || null; },
    clientWidth: 120, clientHeight: 120, offsetWidth: 120, offsetHeight: 120,
    setAttribute() {}, getAttribute() { return null; }, hasAttribute() { return false; },
    appendChild(c) { this.children.push(c); c.parentNode = this; return c; },
    removeChild(c) { const i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); return c; },
    querySelector() { return mkEl(); }, querySelectorAll() { return []; },
    addEventListener() {}, removeEventListener() {}, closest() { return null; }, click() {}, focus() {},
    getBoundingClientRect() { return { left: 20, top: 40, width: 110, height: 110, right: 130, bottom: 150 }; },
    getContext() { return mkCtx2D(); },
    get innerHTML() { return this._h; }, set innerHTML(v) { this._h = String(v); },
  };
  return e;
}
const els = {};
const doc = {
  readyState: "complete", hidden: false, lang: "ja",
  documentElement: mkEl("html"), body: mkEl("body"),
  getElementById(id) { return els[id] || (els[id] = mkEl("div")); },
  querySelector(sel) { return this.getElementById(String(sel).replace(/[#.]/g, "")); },
  querySelectorAll() { return []; },
  createElement(t) { return mkEl(t); },
  addEventListener() {}, removeEventListener() {},
};
const store = {};
let timers = [];
const sandbox = {
  console, Math, Date, JSON, Object, Array, String, Number, Boolean, RegExp, Error, isFinite, parseInt, parseFloat,
  document: doc,
  window: { devicePixelRatio: 1, innerWidth: 400, innerHeight: 820, addEventListener() {} },
  navigator: { language: "ja-JP" },
  localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } },
  setTimeout: (f, ms) => { timers.push(f); return timers.length; },
  clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {},
  requestAnimationFrame: () => 0,
  atob: (s) => Buffer.from(s, "base64").toString("binary"),
  btoa: (s) => Buffer.from(s, "binary").toString("base64"),
};
sandbox.window.document = doc;
sandbox.globalThis = sandbox;
const ctx = vm.createContext(sandbox);

/* データ本体をスタブの #TXT へ流し込んでからエンジンを走らせる */
const txtBlock = /<script id="TXT" type="text\/plain">([\s\S]*?)<\/script>/.exec(html);
els.TXT = mkEl("div");
els.TXT.textContent = txtBlock ? txtBlock[1] : "";

/* ---- 起動 ---- */
let fatal = null;
try { new vm.Script(code, { filename: "engine.js" }).runInContext(ctx); }
catch (e) { fatal = e; }
if (fatal) { console.log("✗ boot threw:", fatal.message, "\n", (fatal.stack || "").split("\n").slice(0, 6).join("\n")); process.exit(1); }

const g = sandbox;
if (!g.S) { console.log("✗ state not initialised (boot did not run)"); process.exit(1); }
console.log("boot ok — species", g.SPIDS.length, "| ui keys", Object.keys(g.U).length, "| day", g.S.day);

/* ---- テキスト生成路过を全部叩く ---- */
function renderAll(where) {
  g.render();
  g.renderSeedPanel(doc.getElementById("pSeed"));
  ["species", "cross", "cmp", "vis"].forEach((tb) => { g.bookTab = tb; g.renderBookPanel(doc.getElementById("pBook")); });
  g.renderLogPanel(doc.getElementById("pLog"));
  g.renderSetPanel(doc.getElementById("pSet"));
  g.renderCrossSection();
  for (let i = 0; i < g.NBED; i++) g.bedSheet(i);
  g.speciesSheet("rose"); g.speciesSheet("centgrass");
  g.showAway(); g.doExport();
  g.chronText({ t: "haiku", p: {}, s: 1, y: 1, d: 1, c: 1 });
  g.buildNav(); g.uiSoundBtn();
}

/* ---- 100 年回す ---- */
const YEARS = 100;
let errors = [];
function guard(label, fn) { try { fn(); } catch (e) { errors.push(label + ": " + e.message + " @" + (e.stack || "").split("\n")[1]); if (errors.length > 8) throw new Error("too many errors"); } }

const t0 = Date.now();
let budgetHit = false, simDays = 0, maxDay = 0;
for (let y = 0; y < YEARS; y++) {
  if (Date.now() - t0 > 70000) { budgetHit = true; console.log("  (time budget hit at year " + (y + 1) + ")"); break; }
  if (y % 20 === 19) console.log("  … year " + (y + 1) + "  day " + g.S.day.toFixed(0) + "  disc " + Object.keys(g.S.disc).length);
  for (let dday = 0; dday < g.DPY; dday++) {
    guard("advance", () => g.advance(1));
    simDays++; if (g.S.day > maxDay) maxDay = g.S.day;
    /* 玩家のふるまい */
    guard("act", () => {
      for (let i = 0; i < g.NBED; i++) {
        const p = g.S.plots[i];
        if (!g.S.bedOpen[i]) { if (g.S.renown >= g.PLOTREQ[i]) g.openBed(i); continue; }
        if (!p) {
          const own = g.ownList();
          if (own.length) { const pick = own[Math.floor(Math.random() * own.length)]; g.plantAt(i, pick); }
          continue;
        }
        if (p.dead) { g.clearAt(i); continue; }
        if (p.blooming && p.seeded) { g.harvestAt(i); continue; }
        if (p.blooming && !p.pruned && Math.random() < 0.4) { g.pruneAt(i); continue; }
        if (p.water < 0.4) g.waterAt(i);
        if (g.S.soil[i] < 0.4 && g.S.compost > 0) g.compostAt(i);
      }
      if (Math.random() < 0.5) g.waterAll();
      if (Math.random() < 0.2) g.buyItem("compost");
      if (Math.random() < 0.08) g.buyCan();
      const shopIds = g.SPIDS.filter((id) => !g.isHyb(id) && (g.SP[id].rar - 1) * 12 <= g.S.renown);
      if (shopIds.length && Math.random() < 0.6) g.buySeed(shopIds[Math.floor(Math.random() * shopIds.length)]);
      const buyable = g.ORN.filter((o) => !g.S.orn[o[0]] && +o[3] <= g.S.dew);
      if (buyable.length && Math.random() < 0.25) g.buyOrn(buyable[0][0]);
      if (Math.random() < 0.05) g.buyHint(g.HYB[0][0]);
      if (Math.random() < 0.1) g.useHG();
      if (Math.random() < 0.3) g.tick();
    });
  }
  guard("render", () => renderAll("y" + y));
  if (g.S.centDone) { guard("legacy", () => { sandbox.confirm = () => true; g.doLegacy(); delete sandbox.confirm; }); }
}
const dt = Date.now() - t0;

/* ---- 検証 ---- */
const S = g.S;
const chk = (cond, msg) => { if (!cond) errors.push("assert: " + msg); };
chk(!errors.length, "errors during run");
chk(!budgetHit && simDays === YEARS * g.DPY, "days simulated (" + simDays + "/" + YEARS * g.DPY + ")");
chk(maxDay >= YEARS * g.DPY - g.DPY, "century reached (max day " + maxDay.toFixed(0) + ")");
chk(S.stats.plant > 100, "planted a lot (" + S.stats.plant + ")");
chk(S.stats.bloom > 100, "blooms (" + S.stats.bloom + ")");
chk(S.stats.harvest > 20, "harvests (" + S.stats.harvest + ")");
chk(S.stats.water > 50, "waterings (" + S.stats.water + ")");
chk(Object.keys(S.disc).length >= 20, "species discovered (" + Object.keys(S.disc).length + ")");
chk(g.hybCount() >= 1, "at least one hybrid (" + g.hybCount() + ")");
chk(Object.keys(S.ms).length >= 8, "milestones (" + Object.keys(S.ms).length + ")");
chk(S.stats.evt > 10, "events fired (" + S.stats.evt + ")");
chk(S.stats.storm >= 0 && S.stats.cmp > 0, "storm/cmp counters");
chk(Object.keys(S.wxHist).length >= 5, "weather variety (" + Object.keys(S.wxHist).length + ")");
chk(isFinite(S.dew) && S.dew >= 0, "dew sane (" + S.dew + ")");
chk(isFinite(S.renown) && S.renown > 0, "renown sane (" + S.renown + ")");
chk(S.chron.length <= 600, "chronicle capped (" + S.chron.length + ")");
chk(S.century >= 2, "century rolled over (" + S.century + ")");
chk(S.bloomY && Object.keys(S.bloomY).length > 5, "bloomY chart data");
for (const k in S.stats) if (!isFinite(S.stats[k])) errors.push("stat NaN: " + k);
for (let i = 0; i < g.NBED; i++) {
  const p = S.plots[i];
  if (p) { chk(isFinite(p.prog) && p.prog >= 0 && p.prog <= 1.0001, "bed " + i + " prog " + p.prog);
           chk(isFinite(p.water) && p.water >= 0 && p.water <= 1.0001, "bed " + i + " water " + p.water); }
  chk(isFinite(S.soil[i]) && S.soil[i] >= 0 && S.soil[i] <= 1, "soil " + i);
}
/* 保存と復元 */
g.save();
const back = g.loadLocal();
chk(back && back.stats.bloom === S.stats.bloom, "save/load round-trip");
const io = doc.getElementById("ioBox");
chk(io.value.length > 50, "export payload");

console.log("sim done in " + dt + "ms — day " + S.day.toFixed(0) + " (year " + g.yearOf(S.day) + ", " + g.seasonName(g.seasonOf(S.day)) + ")" +
  " | plant " + S.stats.plant + " bloom " + S.stats.bloom + " harvest " + S.stats.harvest +
  " | disc " + Object.keys(S.disc).length + "/" + g.SPIDS.length + " hyb " + g.hybCount() +
  " | ms " + Object.keys(S.ms).length + "/" + g.MILE.length + " | orn " + Object.keys(S.orn).length +
  " | visitors " + Object.keys(S.visited).length + " | evt " + S.stats.evt +
  " | century " + S.century);
console.log("weather hist:", Object.keys(S.wxHist).map((k) => k + "×" + S.wxHist[k]).join(" "));
if (errors.length) { console.log("\n✗ " + errors.length + " problem(s):"); errors.slice(0, 10).forEach((e) => console.log("  - " + e)); process.exit(1); }
console.log("\nRESULT: clean");
