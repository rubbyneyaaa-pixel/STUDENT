/* Student Marks Calculator: single JavaScript file for all pages.
   Sections: 1) shared SQLite layer  2) page modules  3) page dispatcher */

/* ===== 1. Shared SQLite layer (sql.js + IndexedDB) ===== */
/* Shared SQLite layer (sql.js) used by every page. */
const SUBJECTS=[["english","English"],["maths","Mathematics"],["cs","Computer Science"],["cn","Computer Networks"],["dbms","Database Management Systems"]];
const PASS_MARK=40,CDN="https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/";
const $=id=>document.getElementById(id);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let db,SQL;
const SCHEMA=`CREATE TABLE IF NOT EXISTS students(
 id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, reg_no TEXT NOT NULL UNIQUE,
 english INTEGER NOT NULL, maths INTEGER NOT NULL, cs INTEGER NOT NULL, cn INTEGER NOT NULL, dbms INTEGER NOT NULL,
 total INTEGER NOT NULL, percentage REAL NOT NULL, grade TEXT NOT NULL, result TEXT NOT NULL,
 created_at TEXT DEFAULT CURRENT_TIMESTAMP);`;

function idb(){return new Promise((res,rej)=>{const r=indexedDB.open("StudentMarkCalc",1);r.onupgradeneeded=()=>r.result.createObjectStore("files");r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
async function loadFile(){try{const d=await idb();return await new Promise(res=>{const q=d.transaction("files").objectStore("files").get("db");q.onsuccess=()=>res(q.result||null);q.onerror=()=>res(null)})}catch(e){return null}}
async function saveFile(){const d=await idb();const tx=d.transaction("files","readwrite");tx.objectStore("files").put(db.export(),"db");return new Promise((res,rej)=>{tx.oncomplete=res;tx.onerror=()=>rej(tx.error)})}
async function openDB(){
  SQL=await initSqlJs({locateFile:f=>CDN+f});
  const bytes=await loadFile();
  db=bytes?new SQL.Database(bytes):new SQL.Database();
  db.run(SCHEMA);return db}
function all(sql,p=[]){const st=db.prepare(sql);st.bind(p);const out=[];while(st.step())out.push(st.getAsObject());st.free();return out}

function gradeOf(pct,passed){if(!passed)return"F";return pct>=90?"O":pct>=80?"A+":pct>=70?"A":pct>=60?"B+":pct>=50?"B":"C"}
function compute(m){
  const total=Object.values(m).reduce((a,b)=>a+b,0),pct=Math.round(total/SUBJECTS.length*100)/100;
  const passed=Object.values(m).every(v=>v>=PASS_MARK);
  return{total,pct,grade:gradeOf(pct,passed),result:passed?"Pass":"Fail"}}
const badge=r=>`<span class="badge ${r==="Pass"?"pass":"fail"}">${r}</span>`;
function getStats(){
  const s=all("SELECT COUNT(*) n, AVG(percentage) a, MAX(percentage) h, SUM(result='Pass') p FROM students")[0];
  return{n:s.n,avg:s.n?Math.round(s.a*100)/100:null,high:s.n?s.h:null,rate:s.n?Math.round(s.p/s.n*100):null,passed:s.p||0}}
function statCards(s){return[["Students",s.n],["Average",s.n?s.avg+"%":"–"],["Highest",s.n?s.high+"%":"–"],["Pass rate",s.n?s.rate+"%":"–"]].map(([l,v])=>`<div class="stat"><b>${v}</b><span>${l}</span></div>`).join("")}

function renderNav(active){
  const L=[["index.html","Dashboard"],["calculator.html","Calculator"],["students.html","Students"],["reports.html","Reports"]];
  document.body.insertAdjacentHTML("afterbegin",`<nav class="nav"><div class="nav-in"><a class="brand" href="index.html"><span class="logo">SM</span>Student Marks</a><div class="links">${L.map(([h,t])=>`<a href="${h}"${h===active?' class="on" aria-current="page"':""}>${t}</a>`).join("")}</div></div></nav>`)}
function boot(active,init){
  renderNav(active);
  openDB().then(init).catch(e=>{const m=document.querySelector(".wrap");if(m)m.insertAdjacentHTML("afterbegin",`<div class="card msg err">Could not load the SQLite engine. Check your internet connection and reload. (${esc(e.message||e)})</div>`)})}

/* ===== 2. Dashboard page ===== */
function pageDashboard(){
boot("index.html",()=>{
  $("stats").innerHTML=statCards(getStats());
  const rows=all("SELECT name,reg_no,percentage,grade,result FROM students ORDER BY id DESC LIMIT 5");
  $("recent").innerHTML=rows.length?rows.map(r=>`<tr><td>${esc(r.name)}</td><td>${esc(r.reg_no)}</td><td>${r.percentage}%</td><td>${esc(r.grade)}</td><td>${badge(r.result)}</td></tr>`).join(""):`<tr><td colspan="5" class="empty">Nothing here yet. Open the Calculator to add the first student.</td></tr>`});
}

/* ===== 2. Calculator page ===== */
function pageCalculator(){
let editingId=null;
$("marks").innerHTML=SUBJECTS.map(([k,l])=>`<div><label for="m_${k}">${l}</label><div class="mark"><input id="m_${k}" type="number" min="0" max="100" step="1" inputmode="numeric"><span>/ 100</span></div></div>`).join("");
function msg(t,cls){const e=$("msg");e.textContent=t;e.className="msg "+(cls||"")}
function read(){
  const name=$("name").value.trim(),reg=$("reg").value.trim(),m={};
  if(!name)return{error:"Enter the student name."};
  if(!reg)return{error:"Enter the register number."};
  for(const[k,l]of SUBJECTS){const raw=$("m_"+k).value.trim(),v=Number(raw);
    if(raw===""||!Number.isInteger(v)||v<0||v>100)return{error:`${l} must be a whole number from 0 to 100.`};m[k]=v}
  return{name,reg,m,...compute(m)}}
function calculate(){
  const d=read();msg(d.error||"","err");
  if(d.error){$("result").classList.remove("show");return null}
  $("result").innerHTML=`<b>${esc(d.name)}</b> (${esc(d.reg)})<br>Total: <b>${d.total}</b> / ${SUBJECTS.length*100} &nbsp; Percentage: <b>${d.pct}%</b> &nbsp; Grade: <b>${d.grade}</b> &nbsp; ${badge(d.result)}`;
  $("result").classList.add("show");return d}
function reset(){editingId=null;$("name").value=$("reg").value="";SUBJECTS.forEach(([k])=>$("m_"+k).value="");$("result").classList.remove("show");$("save").textContent="Save result";$("cancel").hidden=true}
async function save(){
  const d=calculate();if(!d)return;
  const v=[d.name,d.reg,d.m.english,d.m.maths,d.m.cs,d.m.cn,d.m.dbms,d.total,d.pct,d.grade,d.result];
  try{
    if(editingId)db.run("UPDATE students SET name=?,reg_no=?,english=?,maths=?,cs=?,cn=?,dbms=?,total=?,percentage=?,grade=?,result=? WHERE id=?",[...v,editingId]);
    else db.run("INSERT INTO students(name,reg_no,english,maths,cs,cn,dbms,total,percentage,grade,result) VALUES(?,?,?,?,?,?,?,?,?,?,?)",v);
    await saveFile();
  }catch(e){msg(/UNIQUE/.test(e.message)?"That register number is already saved. Use a different one or edit the existing record.":"Could not save: "+e.message,"err");return}
  if(editingId){location.href="students.html";return}
  reset();msg("Saved. You can view it on the Students page.","good")}
boot("calculator.html",()=>{
  $("calc").onclick=calculate;$("save").onclick=save;$("cancel").onclick=()=>{location.href="students.html"};
  const id=new URLSearchParams(location.search).get("edit");
  if(id){const r=all("SELECT * FROM students WHERE id=?",[Number(id)])[0];
    if(r){editingId=r.id;$("name").value=r.name;$("reg").value=r.reg_no;SUBJECTS.forEach(([k])=>$("m_"+k).value=r[k]);
      $("save").textContent="Update result";$("cancel").hidden=false;$("title").textContent="Edit student";calculate()}}});
}

/* ===== 2. Students page ===== */
function pageStudents(){
function render(){
  const q=$("search").value.trim(),sort=$("sort").value;
  const rows=all(`SELECT * FROM students WHERE name LIKE ?1 OR reg_no LIKE ?1 ORDER BY ${sort}`,["%"+q+"%"]);
  $("rows").innerHTML=rows.length?rows.map(r=>`<tr><td>${esc(r.name)}</td><td>${esc(r.reg_no)}</td><td>${r.total}</td><td>${r.percentage}%</td><td>${esc(r.grade)}</td><td>${badge(r.result)}</td><td class="act"><button class="small" data-view="${r.id}">Marks</button><button class="small" data-edit="${r.id}">Edit</button><button class="small danger" data-del="${r.id}">Delete</button></td></tr><tr class="detail" id="d${r.id}" hidden><td colspan="7">${SUBJECTS.map(([k,l])=>`${l}: <b>${r[k]}</b>`).join(" &nbsp;|&nbsp; ")}</td></tr>`).join(""):`<tr><td colspan="7" class="empty">${q?"No students match your search.":"No saved students yet. Open the Calculator to add one."}</td></tr>`;
  $("count").textContent=rows.length+" record"+(rows.length===1?"":"s")}
boot("students.html",()=>{
  render();$("search").oninput=render;$("sort").onchange=render;
  $("rows").onclick=async e=>{
    const t=e.target.dataset;
    if(t.view){const r=$("d"+t.view);r.hidden=!r.hidden}
    if(t.edit)location.href="calculator.html?edit="+t.edit;
    if(t.del&&confirm("Delete this student record?")){db.run("DELETE FROM students WHERE id=?",[Number(t.del)]);await saveFile();render()}};
  $("expCsv").onclick=()=>{
    const cols=["name","reg_no","english","maths","cs","cn","dbms","total","percentage","grade","result"];
    const rows=all("SELECT "+cols.join(",")+" FROM students ORDER BY id"),q=v=>'"'+String(v).replace(/"/g,'""')+'"';
    const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([[cols.join(","),...rows.map(r=>cols.map(c=>q(r[c])).join(","))].join("\n")],{type:"text/csv"}));a.download="students.csv";a.click()};
  $("clear").onclick=async()=>{if(confirm("Delete ALL saved records? This cannot be undone.")){db.run("DELETE FROM students");db.run("DELETE FROM sqlite_sequence WHERE name='students'");await saveFile();render()}}});
}

/* ===== 2. Reports page ===== */
function pageReports(){
const bar=(l,v,max,suf)=>`<div class="bar"><span>${esc(l)}</span><i><u style="width:${max?Math.round(v/max*100):0}%"></u></i><b>${v}${suf||""}</b></div>`;
boot("reports.html",()=>{
  const s=getStats();$("stats").innerHTML=statCards(s);
  if(!s.n){document.querySelectorAll(".rep").forEach(e=>e.innerHTML='<p class="empty">No data yet. Save a student on the Calculator page to see reports.</p>');return}
  const g=Object.fromEntries(all("SELECT grade, COUNT(*) c FROM students GROUP BY grade").map(r=>[r.grade,r.c]));
  $("grades").innerHTML=["O","A+","A","B+","B","C","F"].map(k=>bar("Grade "+k,g[k]||0,s.n)).join("");
  const q=SUBJECTS.map(([k])=>`ROUND(AVG(${k}),1) a_${k}, MAX(${k}) h_${k}, SUM(${k}<${PASS_MARK}) f_${k}`).join(",");
  const r=all("SELECT "+q+" FROM students")[0];
  $("subjects").innerHTML=SUBJECTS.map(([k,l])=>bar(l,r["a_"+k],100)).join("");
  $("subTable").innerHTML=SUBJECTS.map(([k,l])=>`<tr><td>${l}</td><td>${r["a_"+k]}</td><td>${r["h_"+k]}</td><td>${r["f_"+k]}</td></tr>`).join("");
  $("top").innerHTML=all("SELECT name,reg_no,percentage,grade FROM students WHERE result='Pass' ORDER BY percentage DESC LIMIT 5").map(t=>`<li><span>${esc(t.name)} <small class="sub">${esc(t.reg_no)}</small></span><b>${t.percentage}% (${esc(t.grade)})</b></li>`).join("")||'<li class="sub">No passing students yet.</li>';
  $("pf").innerHTML=bar("Passed",s.passed,s.n)+bar("Failed",s.n-s.passed,s.n)});
}

/* ===== 3. Run the module for the current page ===== */
const PAGES={"index.html":pageDashboard,"calculator.html":pageCalculator,"students.html":pageStudents,"reports.html":pageReports};
const fn=PAGES[document.body.dataset.page];if(fn)fn();
