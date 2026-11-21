// 画面確認用：体験版の状態を注入したコピーを一時ファイルに作る（配布物には触れない）
const fs = require("fs");
const path = require("path");
const os = require("os");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

const demo = `
setTimeout(function(){
  var iv=document.getElementById("intro"); if(iv&&iv.parentNode) iv.parentNode.removeChild(iv);
  S.day = 3; S.dew = 320; S.renown = 120; S.compost = 4; S.clothN = 2; S.can = 2; S.legacy = 1;
  for(var i=0;i<12;i++){ S.bedOpen[i] = i < 10; S.soil[i] = 0.55 + (i%4)*0.12; }
  S.orn = {pond:1,lantern:1,arch:1,well:1,birdhouse:1,chime:1,weathervane:1,mossstone:1,compost:1,birdbath:1};
  S.wx = {today:"clear",tomA:"rain",tomS:"rain"};
  var put = [
    ["rose",1,true,false,.92],["tulip",1,false,false,.55],["moss",1,false,false,1],
    ["crocus",.55,false,false,.3],["cherry",1,true,false,.8],["lavender",.85,false,false,.72],
    ["pansy",1,false,false,.2],["bluebell",1,false,true,.95],["dandelion",1,true,false,.6],
    ["susuki",.55,false,false,.45],[null],[null]];
  for(var i=0;i<put.length;i++){
    var d=put[i];
    if(!d[0]){ S.plots[i]=null; continue; }
    S.plots[i]={sp:d[0],prog:d[1],bloomAge:d[1]>=1?2:0,blooming:d[1]>=1,seeded:!!d[2],
      dead:!!d[3],water:d[4],dormant:false,pruned:false,ext:1};
    S.disc[d[0]]=true; S.bloomed[d[0]]=3;
  }
  S.pouch={rose:2,tulip:3,dandelion:5,cosmos:1,botan:1,moss:2,lavender:4,yuri:1};
  S.visited={butterfly:12,bee:9,whiteeye:4,calico:2};
  S.chron.push({t:"bloom1",p:{sp:"botan"},c:1,y:1,s:0,d:3},{t:"visitor",p:{vis:"butterfly"},c:1,y:1,s:0,d:3},
    {t:"event",p:{ev:"e_rainbow"},c:1,y:1,s:0,d:2},{t:"hybrid",p:{sp:"moonflower"},c:1,y:1,s:3,d:6});
  S.todaySeen=Math.floor(S.day); S.awayDays=0;
  view=VIEW; Scene.weather="clear"; Scene.seed(true);
  render(); renderBeds(true);
  document.title = "庭つむぎ (demo " + VIEW + ")";
}, 2200);`;

const VIEW = process.argv[2] || "garden";
const body = VIEW === "first"
  ? `setTimeout(function(){
  var iv=document.getElementById("intro"); if(iv&&iv.parentNode) iv.parentNode.removeChild(iv);
  S.intro=false; view="garden"; render(); renderToday();
}, 2200);`
  : demo.replace(/VIEW/g, JSON.stringify(VIEW === "sheet" ? "garden" : VIEW)) +
    (VIEW === "sheet" ? "\nsetTimeout(function(){ bedSheet(0); Scene.creature('butterfly'); }, 3000);\n" : "");
const out = path.join(os.tmpdir(), "niwatsumugi-shot-" + VIEW + ".html");
const seeded = VIEW === "first" ? html :
  html.replace("var S=null,lang=\"ja\",view=\"garden\"", "var S=null,lang=\"ja\",view=\"" + VIEW + "\"");
fs.writeFileSync(out, seeded.replace("</body>", "<script>" + body + "</scr" + "ipt>\n</body>"), "utf8");
console.log(out);
