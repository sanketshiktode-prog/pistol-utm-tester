/* ═══════════ 03 ad copy ═══════════ */
const H_MAX=30, D_MAX=90, H_CAP=15, D_CAP=4, PATH_MAX=15;
let ADG=sess.get("pp_adgroups",null)||{};
let ADCUR=sess.get("pp_adcur","")||"";
const PROJ_KEYS=["url","cfg","price","loc","p1","p2","proj","dev","micro","city","offer","usps","marks","amen","priceMode","allIn","bizName"];
let PROJ=Object.assign({url:"",cfg:"",price:"",loc:"",p1:"",p2:"",proj:"",dev:"",micro:"",city:"",offer:"",usps:"",marks:"",amen:"",priceMode:"Starting At",allIn:""},sess.get("pp_proj",{}));
const blankGroup=()=>({h:Array.from({length:H_CAP},()=>["",""]),d:Array.from({length:D_CAP},()=>["",""]),
  kw:"",man:[],kill:[],edited:false});
/* Older sessions stored groups without the edit ledger. Fill it in on first
   touch rather than discarding what the person already wrote. */
function fix(g){ if(!g)return g;
  if(!Array.isArray(g.man))g.man=[];
  if(!Array.isArray(g.kill))g.kill=[];
  if(typeof g.edited!=="boolean")g.edited=false;
  return g; }
function cur(){ if(!ADG[ADCUR])ADG[ADCUR]=blankGroup(); return fix(ADG[ADCUR]); }
const mirrorOn=()=>{ const el=$("#acMirror"); return !el||el.checked; };
/* Phrase and Exact are built as a pair from the same keyword set, so an edit
   to one belongs in the other. The pair is found from the built plan, and
   failing that from the name, where only the trailing match-type letter
   differs: "... -85L-P" and "... -85L-E". */
function siblingsOf(name){
  const out=[];
  PLAN.forEach(p=>{ if(p.groups.some(g=>g.name===name))
    p.groups.forEach(g=>{ if(g.name!==name&&ADG[g.name])out.push(g.name); }); });
  if(out.length)return out;
  const m=String(name||"").match(/^(.*-)(E|P|B)$/);
  if(!m)return [];
  const head=m[1].replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
  const re=new RegExp("^"+head+"(E|P|B)$");
  return Object.keys(ADG).filter(k=>k!==name&&re.test(k));
}
function mirrorKw(name){
  if(!mirrorOn()||!ADG[name])return 0;
  const s=fix(ADG[name]), sib=siblingsOf(name);
  sib.forEach(k=>{ const g=fix(ADG[k]);
    g.kw=s.kw; g.man=s.man.slice(); g.kill=s.kill.slice(); });
  return sib.length;
}
function mirrorAd(name){
  if(!mirrorOn()||!ADG[name])return 0;
  const s=fix(ADG[name]), sib=siblingsOf(name);
  sib.forEach(k=>{ const g=fix(ADG[k]);
    g.h=s.h.map(r=>r.slice()); g.d=s.d.map(r=>r.slice()); g.edited=true; });
  return sib.length;
}
/* The ledger is what makes a rebuild safe: every keyword the person added by
   hand is remembered, and so is every one they deleted, so Build can
   regenerate the set and still land on what they wanted. */
function kwLedger(name,next){
  const g=fix(ADG[name]); if(!g)return;
  const prev=(g.kw||"").split("\n").map(s=>s.trim()).filter(Boolean);
  const L=s=>s.toLowerCase();
  const was=new Set(prev.map(L)), now=new Set(next.map(L));
  next.forEach(k=>{ if(!was.has(L(k))){
    if(!g.man.some(x=>L(x)===L(k)))g.man.push(k);
    g.kill=g.kill.filter(x=>L(x)!==L(k)); }});
  prev.forEach(k=>{ if(!now.has(L(k))){
    if(!g.kill.some(x=>L(x)===L(k)))g.kill.push(k);
    g.man=g.man.filter(x=>L(x)!==L(k)); }});
  g.kw=next.join("\n");
}
const saveAd=()=>{sess.set("pp_adgroups",ADG);sess.set("pp_adcur",ADCUR);};
function drawAdList(){
  const el=$("#acList"); if(!el)return;
  const keys=Object.keys(ADG);
  el.innerHTML=keys.length?keys.map((k,i)=>
    `<label class="chk" style="font-family:var(--mono);font-size:11.5px">
       <input type="checkbox" data-agx="${i}" value="${esc(k)}"><span>${esc(k)}</span></label>`).join("")
    :`<div class="empty" style="padding:14px">No ad groups yet.</div>`;
}
on("#acCheckAll","click",()=>{
  const boxes=[...document.querySelectorAll("[data-agx]")];
  const on=boxes.some(b=>!b.checked);
  boxes.forEach(b=>b.checked=on);
  $("#acCheckAll").textContent=on?"clear":"select all";
});
on("#acDelSel","click",()=>{
  const picked=[...document.querySelectorAll("[data-agx]")].filter(b=>b.checked).map(b=>b.value);
  if(!picked.length)return toast("Tick the ad groups to delete");
  if(!confirm(`Delete ${picked.length} ad group${picked.length===1?"":"s"} and everything written in them?`))return;
  picked.forEach(k=>delete ADG[k]);
  if(!ADG[ADCUR])ADCUR=Object.keys(ADG)[0]||"";
  saveAd(); fillAdPicker(); drawAdList(); drawAd(); syncPlanKw();
  toast(`${picked.length} deleted`);
});
on("#acClearAll","click",()=>{
  const n=Object.keys(ADG).length;
  if(!n)return toast("Nothing to clear");
  if(!confirm(`Clear all ${n} ad groups?\n\nHeadlines, descriptions and keywords go with them.`))return;
  ADG={}; ADCUR=""; saveAd(); fillAdPicker(); drawAdList(); drawAd();
  toast("All ad groups cleared");
});
function fillAdPicker(){
  const sel=$("#acPick"), keys=Object.keys(ADG);
  sel.innerHTML=keys.length?keys.map(k=>`<option value="${esc(k)}"${k===ADCUR?" selected":""}>${esc(k)}</option>`).join("")
    :`<option value="">— no ad groups yet —</option>`;
  const src=$("#acCopyFrom");
  if(src){
    const keep=src.value, others=keys.filter(k=>k!==ADCUR);
    src.innerHTML=others.length?others.map(k=>`<option value="${esc(k)}">${esc(k)}</option>`).join("")
      :`<option value="">— nothing to copy from —</option>`;
    if(others.includes(keep))src.value=keep;
  }
  drawAdList();
}
/* Writing fifteen headlines once and copying them across the match types is
   how the work actually goes, so the copy is a button rather than a retype. */
function copyGroup(what){
  if(!ADCUR)return toast("Pick the ad group to copy into first");
  const from=$("#acCopyFrom").value;
  if(!from||!ADG[from])return toast("Pick an ad group to copy from");
  const s=fix(ADG[from]), g=cur();
  if(what!=="kw"){ g.h=s.h.map(r=>r.slice()); g.d=s.d.map(r=>r.slice()); g.edited=true; }
  if(what!=="ad"){ kwLedger(ADCUR,(s.kw||"").split("\n").map(x=>x.trim()).filter(Boolean)); }
  if(what!=="kw")mirrorAd(ADCUR);
  if(what!=="ad")mirrorKw(ADCUR);
  saveAd(); drawAd(); syncPlanKw();
  toast(`Copied ${what==="ad"?"the ad":what==="kw"?"the keywords":"the ad and keywords"} from ${from}`);
}
on("#acCopyAd","click",()=>copyGroup("ad"));
on("#acCopyKw","click",()=>copyGroup("kw"));
on("#acCopyBoth","click",()=>copyGroup("both"));
on("#acMirror","change",()=>{
  if(!mirrorOn())return toast("Mirroring off — match types are now edited separately");
  const n=mirrorKw(ADCUR)+(ADCUR?mirrorAd(ADCUR):0);
  saveAd(); drawAd(); syncPlanKw();
  toast(n?"Mirroring on — the other match types now match this one":"Mirroring on");
});
const lenClass=(n,max)=>n>max?"bad":n>max-3?"edge":"";
function drawAd(){
  if(!ADCUR||!ADG[ADCUR]){
    $("#hRows").innerHTML=`<div class="empty">Create an ad group to start writing.</div>`;
    $("#dRows").innerHTML=""; $("#acKw").value="";
    $("#acPreview").innerHTML=`<div class="empty" style="padding:10px">Nothing yet.</div>`;
    $("#acChecks").innerHTML=`<div class="empty">Create an ad group first.</div>`;
    $("#hStat").textContent=`0 / ${H_CAP} · max ${H_MAX}`;
    $("#dStat").textContent=`0 / ${D_CAP} · max ${D_MAX}`;
    $("#acKwStat").textContent="0"; return;
  }
  const g=cur();
  $("#hRows").innerHTML=g.h.map((r,i)=>{const n=r[0].length;
    return `<div class="acrow"><span class="sr">${i+1}</span>
      <input type="text" data-ht="${i}" value="${esc(r[0])}" maxlength="120" class="${n>H_MAX?"over":""}" placeholder="Enter headline">
      <span class="len ${lenClass(n,H_MAX)}" data-hl="${i}">${n}/${H_MAX}</span>
      <select data-hp="${i}"><option value=""${r[1]===""?" selected":""}>—</option>
        <option value="1"${r[1]==="1"?" selected":""}>Pin 1</option>
        <option value="2"${r[1]==="2"?" selected":""}>Pin 2</option>
        <option value="3"${r[1]==="3"?" selected":""}>Pin 3</option></select>
      <button class="del" data-hd="${i}" aria-label="Remove">×</button></div>`;}).join("");
  $("#dRows").innerHTML=g.d.map((r,i)=>{const n=r[0].length;
    return `<div class="acrow"><span class="sr">${i+1}</span>
      <input type="text" data-dt="${i}" value="${esc(r[0])}" maxlength="200" class="${n>D_MAX?"over":""}" placeholder="Enter description">
      <span class="len ${lenClass(n,D_MAX)}" data-dl="${i}">${n}/${D_MAX}</span>
      <select data-dp="${i}"><option value=""${r[1]===""?" selected":""}>—</option>
        <option value="1"${r[1]==="1"?" selected":""}>Pin 1</option>
        <option value="2"${r[1]==="2"?" selected":""}>Pin 2</option></select>
      <button class="del" data-dd="${i}" aria-label="Remove">×</button></div>`;}).join("");
  drawKwList();
  $("#hStat").textContent=`${g.h.filter(r=>r[0].trim()).length} / ${H_CAP} · max ${H_MAX}`;
  $("#dStat").textContent=`${g.d.filter(r=>r[0].trim()).length} / ${D_CAP} · max ${D_MAX}`;
  drawPreview(); adChecks();
}
function drawPreview(){
  if(!ADCUR||!ADG[ADCUR])return;
  const g=cur();
  const h=g.h.filter(r=>r[0].trim()).map(r=>r[0].trim());
  const d=g.d.filter(r=>r[0].trim()).map(r=>r[0].trim());
  let base=PROJ.url||"example.com"; try{base=new URL(PROJ.url).hostname;}catch(e){}
  const path=[PROJ.p1,PROJ.p2].filter(Boolean).join("/");
  $("#acPreview").innerHTML=h.length
    ?`<div class="pv-url">${esc(base)}${path?"/"+esc(path):""}</div>
      <div class="pv-h">${esc(h.slice(0,3).join(" | "))}</div>
      <div class="pv-d">${esc(d.slice(0,2).join(" "))}</div>`
    :`<div class="empty" style="padding:10px">Add a headline to see the preview.</div>`;
}
function adChecks(){
  if(!ADCUR||!ADG[ADCUR])return;
  const g=cur(), c=[], add=(l,ic,h)=>c.push(`<div class="check c-${l}"><span class="ic">${ic}</span><span>${h}</span></div>`);
  const H=g.h.filter(r=>r[0].trim()), D=g.d.filter(r=>r[0].trim());
  const hOver=H.filter(r=>r[0].length>H_MAX), dOver=D.filter(r=>r[0].length>D_MAX);
  if(hOver.length) add("bad","✕",`<b>${hOver.length} headline${hOver.length===1?"":"s"} over ${H_MAX} characters.</b> Google will reject the ad.`);
  if(dOver.length) add("bad","✕",`<b>${dOver.length} description${dOver.length===1?"":"s"} over ${D_MAX} characters.</b>`);
  if(H.length<3) add("bad","✕",`<b>Only ${H.length} headline${H.length===1?"":"s"}.</b> Google needs at least 3.`);
  else if(H.length<8) add("warn","!",`<b>${H.length} headlines.</b> Ad Strength wants 8 or more — 15 is ideal.`);
  else add("ok","✓",`<b>${H.length} headlines.</b> Good coverage for the asset mix.`);
  if(D.length<2) add("bad","✕",`<b>Only ${D.length} description${D.length===1?"":"s"}.</b> Google needs at least 2.`);
  else add("ok","✓",`<b>${D.length} descriptions.</b>`);
  if(H.length>H_CAP) add("bad","✕",`<b>More than ${H_CAP} headlines.</b>`);
  if(D.length>D_CAP) add("bad","✕",`<b>More than ${D_CAP} descriptions.</b>`);
  const seen=new Set(), dupes=[];
  H.forEach(r=>{const k=r[0].trim().toLowerCase(); if(seen.has(k))dupes.push(r[0]); else seen.add(k);});
  if(dupes.length) add("bad","✕",`<b>Duplicate headline:</b> <code>${esc(dupes[0])}</code>`);
  const p1=H.filter(r=>r[1]==="1").length, free=H.filter(r=>!r[1]).length;
  if(p1&&p1===H.length) add("bad","✕","<b>Every headline is pinned to position 1.</b> Google can't rotate anything and Ad Strength drops to Poor.");
  else if(p1) add("ok","✓",`<b>${p1} headline${p1===1?"":"s"} pinned to position 1</b>, ${free} free to rotate.`);
  if(H.length&&!free) add("warn","!","<b>No unpinned headlines.</b> Pin only what structurally must hold a slot.");
  if([PROJ.p1,PROJ.p2].some(x=>x&&x.length>PATH_MAX)) add("bad","✕",`<b>Display path over ${PATH_MAX} characters.</b>`);
  $("#acChecks").innerHTML=c.length?c.join(""):`<div class="empty">Nothing flagged.</div>`;
}
on("#hRows","input",e=>{
  const t=e.target.dataset.ht; if(t===undefined)return;
  const g=cur(), i=+t; g.h[i][0]=e.target.value;
  const n=e.target.value.length, el=document.querySelector(`[data-hl="${i}"]`);
  el.textContent=`${n}/${H_MAX}`; el.className="len "+lenClass(n,H_MAX);
  e.target.classList.toggle("over",n>H_MAX);
  $("#hStat").textContent=`${g.h.filter(r=>r[0].trim()).length} / ${H_CAP} · max ${H_MAX}`;
  g.edited=true; saveAd(); drawPreview(); adChecks();});
on("#hRows","change",e=>{
  if(e.target.dataset.ht!==undefined){ mirrorAd(ADCUR); saveAd(); return; }
  const p=e.target.dataset.hp; if(p===undefined)return;
  const g=cur(); g.h[+p][1]=e.target.value; g.edited=true;
  mirrorAd(ADCUR); saveAd(); adChecks();});
on("#hRows","click",e=>{
  const d=e.target.dataset.hd; if(d===undefined)return;
  const g=cur(); g.h.splice(+d,1); if(!g.h.length)g.h.push(["",""]);
  g.edited=true; mirrorAd(ADCUR); saveAd(); drawAd();});
on("#dRows","input",e=>{
  const t=e.target.dataset.dt; if(t===undefined)return;
  const g=cur(), i=+t; g.d[i][0]=e.target.value;
  const n=e.target.value.length, el=document.querySelector(`[data-dl="${i}"]`);
  el.textContent=`${n}/${D_MAX}`; el.className="len "+lenClass(n,D_MAX);
  e.target.classList.toggle("over",n>D_MAX);
  $("#dStat").textContent=`${g.d.filter(r=>r[0].trim()).length} / ${D_CAP} · max ${D_MAX}`;
  g.edited=true; saveAd(); drawPreview(); adChecks();});
on("#dRows","change",e=>{
  if(e.target.dataset.dt!==undefined){ mirrorAd(ADCUR); saveAd(); return; }
  const p=e.target.dataset.dp; if(p===undefined)return;
  const g=cur(); g.d[+p][1]=e.target.value; g.edited=true;
  mirrorAd(ADCUR); saveAd(); adChecks();});
on("#dRows","click",e=>{
  const d=e.target.dataset.dd; if(d===undefined)return;
  const g=cur(); g.d.splice(+d,1); if(!g.d.length)g.d.push(["",""]);
  g.edited=true; mirrorAd(ADCUR); saveAd(); drawAd();});
on("#hAdd","click",()=>{
  if(!ADCUR)return toast("Create an ad group first");
  const g=cur(); if(g.h.length>=H_CAP)return toast(`Google accepts ${H_CAP} headlines maximum`);
  g.h.push(["",""]); saveAd(); drawAd();
  const last=$("#hRows").querySelector(".acrow:last-child input"); if(last)last.focus();});
on("#dAdd","click",()=>{
  if(!ADCUR)return toast("Create an ad group first");
  const g=cur(); if(g.d.length>=D_CAP)return toast(`Google accepts ${D_CAP} descriptions maximum`);
  g.d.push(["",""]); saveAd(); drawAd();
  const last=$("#dRows").querySelector(".acrow:last-child input"); if(last)last.focus();});
on("#hPaste","click",()=>{
  if(!ADCUR)return toast("Create an ad group first");
  const raw=prompt("Paste headlines, one per line:"); if(!raw)return;
  const lines=raw.split("\n").map(s=>s.trim()).filter(Boolean).slice(0,H_CAP);
  const g=cur(); g.h=lines.map(l=>[l,""]);
  while(g.h.length<H_CAP)g.h.push(["",""]);
  g.edited=true; mirrorAd(ADCUR); saveAd(); drawAd(); toast(`${lines.length} headlines loaded`);});
on("#acKw","input",()=>{
  if(!ADCUR)return;
  $("#acKwStat").textContent=String($("#acKw").value.split("\n").filter(s=>s.trim()).length);});
on("#acKw","change",()=>{
  if(!ADCUR)return;
  setKw($("#acKw").value.split("\n").map(s=>s.trim()).filter(Boolean));});
on("#acKwSend","click",()=>{
  if(!ADCUR)return toast("Create an ad group first");
  $("#kwRaw").value=cur().kw||""; $("#kwAdg").value=ADCUR;
  const v=VARIANTS.find(v=>v.names.adgroup===ADCUR); if(v)$("#kwCamp").value=v.names.campaign;
  renderKw(); goTab("p-kw");});
on("#acPick","change",()=>{ADCUR=$("#acPick").value;saveAd();fillAdPicker();drawAd();});
on("#acNew","click",()=>{
  const n=prompt("Ad group name:", VARIANTS[PICK]?VARIANTS[PICK].names.adgroup:"");
  if(!n||!n.trim())return;
  const k=n.trim(); if(!ADG[k])ADG[k]=blankGroup();
  ADCUR=k; saveAd(); fillAdPicker(); drawAd();});
on("#acFromVar","click",()=>{
  if(!VARIANTS.length)return toast("Build variants on tab 01 first");
  let n=0; VARIANTS.forEach(v=>{if(!ADG[v.names.adgroup]){ADG[v.names.adgroup]=blankGroup();n++;}});
  if(!ADCUR)ADCUR=VARIANTS[0].names.adgroup;
  saveAd(); fillAdPicker(); drawAd(); toast(`${n} ad group${n===1?"":"s"} added`);});
on("#acDel","click",()=>{
  if(!ADCUR)return;
  if(!confirm(`Delete "${ADCUR}" and everything written in it?`))return;
  delete ADG[ADCUR]; ADCUR=Object.keys(ADG)[0]||""; saveAd(); fillAdPicker(); drawAd();});
const PROJ_FIELDS={url:"acUrl",cfg:"acCfg",price:"acPrice",loc:"acLoc",p1:"acP1",p2:"acP2",
  proj:"acProj",dev:"acDev",micro:"acMicro",city:"acCity",offer:"acOffer",usps:"acUsps",marks:"acMarks",amen:"acAmen"};
Object.values(PROJ_FIELDS).forEach(id=>$("#"+id).addEventListener("input",()=>{
  PROJ_KEYS.forEach(k=>{const e=$("#"+PROJ_FIELDS[k]); if(e)PROJ[k]=e.value;});
  $("#p1c").textContent=`${PROJ.p1.length}/${PATH_MAX}`;
  $("#p1c").className="count"+(PROJ.p1.length>PATH_MAX?" bad":"");
  $("#p2c").textContent=`${PROJ.p2.length}/${PATH_MAX}`;
  $("#p2c").className="count"+(PROJ.p2.length>PATH_MAX?" bad":"");
  sess.set("pp_proj",PROJ); drawPreview(); adChecks(); echoBrief();}));
function echoBrief(){
  let b; try{ b=brief(); }catch(e){ return; }
  const rows=[["Project",b.proj],["Developer",b.dev],["Micro-market",b.micro],["City",b.city],
    ["Configuration",b.cfg],["Price",b.price],["USPs",b.usps.length||""],["Amenities",b.amen.length||""],
    ["Landmarks",b.marks.length||""]];
  const filled=rows.filter(r=>r[1]).length;
  const st=$("#briefEcho"); if(st)st.innerHTML=b.proj
    ? `<span class="pill p-ok">${filled}/9 filled</span>` : `<span class="pill p-bad">not filled</span>`;
  const el=$("#briefSummary"); if(!el)return;
  el.innerHTML=`<table class="kv"><tbody>`+rows.map(([k,v])=>
    `<tr><td>${k}</td><td class="right m">${v?esc(String(v)):'<span class="pill p-mute">\u2014</span>'}</td></tr>`).join("")+`</tbody></table>`;
}

function sheetBlock(name,g){
  const H=g.h.filter(r=>r[0].trim()), D=g.d.filter(r=>r[0].trim());
  const kw=(g.kw||"").split("\n").map(s=>s.trim()).filter(Boolean);
  let out=`${name}\n`;
  out+=`Configuration\t${PROJ.cfg}\nPrice\t${PROJ.price}\nLocation\t${PROJ.loc}\nURL\t${PROJ.url}\n\n`;
  out+=`SR\tHeadline\tLength\tMax Length\tPin\tKeywords\n`;
  const rows=Math.max(H.length,kw.length);
  for(let i=0;i<rows;i++){
    const h=H[i];
    out+= h ? `${i+1}\t${h[0]}\t${h[0].length}\t${H_MAX}\t${h[1]||""}\t${kw[i]||""}\n`
            : `\t\t\t\t\t${kw[i]||""}\n`;
  }
  out+=`\nSR\tDescription\tLength\tMax Length\tPin\n`;
  D.forEach((d,i)=>{out+=`${i+1}\t${d[0]}\t${d[0].length}\t${D_MAX}\t${d[1]||""}\n`;});
  return out;
}
on("#acSheet","click",()=>{
  if(!ADCUR)return toast("Create an ad group first");
  copy(sheetBlock(ADCUR,cur()));});
on("#acAllSheet","click",()=>{
  const keys=Object.keys(ADG); if(!keys.length)return toast("No ad groups yet");
  copy(keys.map(k=>sheetBlock(k,ADG[k])).join("\n\n"));});
on("#acEditor","click",()=>{
  const keys=Object.keys(ADG); if(!keys.length)return toast("No ad groups yet");
  const hdr=["Campaign","Ad group"];
  for(let i=1;i<=H_CAP;i++)hdr.push(`Headline ${i}`,`Headline ${i} position`);
  for(let i=1;i<=D_CAP;i++)hdr.push(`Description ${i}`,`Description ${i} position`);
  hdr.push("Final URL","Path 1","Path 2");
  const campOf=a=>{const v=VARIANTS.find(v=>v.names.adgroup===a);return v?v.names.campaign:"";};
  const rows=keys.map(k=>{
    const g=ADG[k], H=g.h.filter(r=>r[0].trim()), D=g.d.filter(r=>r[0].trim());
    const r=[campOf(k),k];
    for(let i=0;i<H_CAP;i++)r.push(H[i]?H[i][0]:"",H[i]?(H[i][1]||""):"");
    for(let i=0;i<D_CAP;i++)r.push(D[i]?D[i][0]:"",D[i]?(D[i][1]||""):"");
    r.push(PROJ.url,PROJ.p1,PROJ.p2); return r;});
  dl("rsa-ads-editor.csv",hdr.map(csvq).join(",")+"\n"+rows.map(r=>r.map(csvq).join(",")).join("\n"));});

