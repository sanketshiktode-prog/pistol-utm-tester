/* ═══════════ boot (tabs 02 + 03) ═══════════ */
renderKw();
PROJ_KEYS.forEach(k=>{const el=$("#"+PROJ_FIELDS[k]); if(el)el.value=PROJ[k]||"";});
$("#locMain").value=sess.get("pp_locmain",PROJ.micro||"");
$("#locAlt").value=sess.get("pp_localt","");
on("#locMain","input",()=>{sess.set("pp_locmain",$("#locMain").value);});
on("#locAlt","input",()=>{sess.set("pp_localt",$("#locAlt").value);});
on("#acMicro","input",()=>{ if(!$("#locMain").value.trim()){
  $("#locMain").value=$("#acMicro").value; sess.set("pp_locmain",$("#locMain").value);} });
$("#p1c").textContent=`${(PROJ.p1||"").length}/${PATH_MAX}`;
$("#p2c").textContent=`${(PROJ.p2||"").length}/${PATH_MAX}`;
if(!ADG[ADCUR])ADCUR=Object.keys(ADG)[0]||"";
/* drawAd reaches drawKwList in a later file, and adChecks reaches AS,
   which is declared nineteen lines below this one. With no saved ad
   groups neither is reached and the page looked fine; with saved ones it
   threw at boot and the ad copy came up empty. */
onBoot(()=>{ fillAdPicker(); drawAd(); fillVariantPickers(); echoBrief(); });

/* ═══════════ 04 assets ═══════════ */
const SL_T=25, SL_D=35, CO_MAX=25, SN_MAX=25;
const SN_HEADERS=["Amenities","Brands","Courses","Degree programs","Destinations","Featured hotels",
  "Insurance coverage","Models","Neighborhoods","Service catalog","Shows","Styles","Types"];
let AS=sess.get("pp_assets",null)||{base:"",sl:[],co:[],sn:[]};
const saveAs=()=>sess.set("pp_assets",AS);
const slugLink=s=>String(s||"").toLowerCase().replace(/[^a-z0-9]+/g,"");

const PRESET={
 in:{
  sl:[["Download Brochure","Get Complete Project Details","Floor Plans, Pricing & Offers"],
      ["Price & Payment Plan","Complete Costing Details Inside","Complete Costing Details Inside"],
      ["Book A Free Site Visit","Pick A Slot That Suits You","Instant Call Back From Our Team"],
      ["Master & Floor Plans","Township Layout And Unit Plans","See Every Configuration Inside"],
      ["Amenities & Highlights","50+ World-Class Amenities","70% Open-To-Sky Green Spaces"],
      ["Location & Connectivity","Hinjewadi IT Park In 25 Mins","Airport 45 Mins, NH-48 Access"]],
  co:["RERA Registered","Free Site Visit","Instant Call Back","New Launch Offer",
      "21 Acre Township","70% Open Spaces","50+ Amenities","Riverside Development","Prime Location"],
  sn:[["Types",["2 BHK","2.5 BHK","3 BHK"]],
      ["Amenities",["Swimming Pool","Gymnasium","Clubhouse","Jogging Track","Kids Play Area","Yoga Deck"]]]
 },
 ae:{
  sl:[["Download Brochure","Get Complete Project Details","Floor Plans, Pricing & Offers"],
      ["Payment Plan","60/40 Payment Plan Available","Post-Handover Options Inside"],
      ["Book A Viewing","Private Tour With Our Advisor","Instant Call Back From Our Team"],
      ["Floor Plans & Layouts","Studio To 3 BR Layouts","See Every Configuration Inside"],
      ["Amenities & Lifestyle","Resort-Style Facilities","Pool, Gym And Landscaped Decks"],
      ["Location & Connectivity","Downtown Dubai In 12 Minutes","DIFC 15 Mins, Airport 18 Mins"]],
  co:["Freehold Ownership","Golden Visa Eligible","60/40 Payment Plan","DLD Registered",
      "Post-Handover Plan","Free Consultation","Direct From Developer","Prime Location","Limited Units","Waterfront Living"],
  sn:[["Types",["Studio","1 BR","2 BR","3 BR"]],
      ["Amenities",["Swimming Pool","Gymnasium","Concierge","Kids Play Area","Landscaped Deck"]]]
 }
};

const SL_STOP=new Set(["a","an","the","and","or","for","of","to","in","on","with","your","our",
  "get","see","book","view","free","complete","all","more","now","today","details"]);
const SL_WORD={brochure:"brochure",price:"pricing",pricing:"pricing",payment:"pricing",plan:"floorplan",
  plans:"floorplan",floor:"floorplan",visit:"sitevisit",site:"sitevisit",amenities:"amenities",
  highlights:"amenities",location:"location",connectivity:"location",master:"masterplan",
  gallery:"gallery",offers:"offers",contact:"contact",about:"about",download:"brochure"};
function slugWord(text){
  const w=String(text||"").toLowerCase().replace(/[^a-z0-9 ]/g," ").split(/\s+/)
    .filter(x=>x&&!SL_STOP.has(x));
  for(const x of w) if(SL_WORD[x]) return SL_WORD[x];
  return w[w.length-1]||"";
}
function assetBase(){
  return (AS.base||"").trim() || (PROJ.url||"").trim()
      || (($("#inLp")&&$("#inLp").value.trim())||"");
}
function slUrl(text,manual){
  const base=assetBase(); if(!base)return "";
  const s=(manual&&manual.trim()?manual:slugWord(text)).toLowerCase().replace(/[^a-z0-9]/g,"");
  if(!s)return base;
  return base+(base.includes("?")?"&":"?")+"sitelink="+s;
}
function cls(n,max){return n>max?"bad":n>max-3?"edge":"";}

function drawSl(){
  if(!AS.base){ const b=assetBase(); if(b){ AS.base=b; const e=$("#asBase"); if(e)e.value=b; saveAs(); } }
  $("#slRows").innerHTML=AS.sl.length?AS.sl.map((r,i)=>{
    const [t,d1,d2]=r, u=slUrl(t,r[3]);
    return `<div style="border:1px solid var(--line);border-radius:12px;padding:12px;margin-bottom:10px">
      <div class="acrow" style="grid-template-columns:26px 1fr 62px 30px">
        <span class="sr">${i+1}</span>
        <input type="text" data-slt="${i}" value="${esc(t)}" class="${t.length>SL_T?"over":""}" placeholder="Enter sitelink text">
        <span class="len ${cls(t.length,SL_T)}">${t.length}/${SL_T}</span>
        <button class="del" data-sld="${i}" aria-label="Remove">×</button></div>
      <div class="acrow" style="grid-template-columns:26px 1fr 62px 30px">
        <span class="sr"></span>
        <input type="text" data-sl1="${i}" value="${esc(d1)}" class="${d1.length>SL_D?"over":""}" placeholder="Enter description line 1">
        <span class="len ${cls(d1.length,SL_D)}">${d1.length}/${SL_D}</span><span></span></div>
      <div class="acrow" style="grid-template-columns:26px 1fr 62px 30px;margin-bottom:6px">
        <span class="sr"></span>
        <input type="text" data-sl2="${i}" value="${esc(d2)}" class="${d2.length>SL_D?"over":""}" placeholder="Enter description line 2">
        <span class="len ${cls(d2.length,SL_D)}">${d2.length}/${SL_D}</span><span></span></div>
      <div class="acrow" style="grid-template-columns:26px 1fr 30px;margin-bottom:6px">
        <span class="sr">URL</span>
        <input type="text" data-sls="${i}" value="${esc(r[3]||slugWord(t))}" placeholder="url word" spellcheck="false" style="font-family:var(--mono);font-size:12px">
        <span></span></div>
      <div class="out sm" style="padding:7px 9px">${u?esc(u):"Set the base URL to generate the link"}</div>
    </div>`;}).join(""):`<div class="empty">No sitelinks yet. Add one or load a starter set.</div>`;
  $("#slStat").textContent=`${AS.sl.length} · 4+ recommended`;
  asChecks();
}
function drawCo(){
  $("#coRows").innerHTML=AS.co.length?AS.co.map((t,i)=>
    `<div class="acrow" style="grid-template-columns:26px 1fr 62px 30px">
      <span class="sr">${i+1}</span>
      <input type="text" data-cot="${i}" value="${esc(t)}" class="${t.length>CO_MAX?"over":""}" placeholder="Enter callout">
      <span class="len ${cls(t.length,CO_MAX)}">${t.length}/${CO_MAX}</span>
      <button class="del" data-cod="${i}" aria-label="Remove">×</button></div>`).join("")
    :`<div class="empty">No callouts yet.</div>`;
  $("#coStat").textContent=`${AS.co.length} · 4+ recommended`;
  asChecks();
}
function drawSn(){
  $("#snRows").innerHTML=AS.sn.length?AS.sn.map((s,i)=>{
    const [hd,vals]=s;
    return `<div style="border:1px solid var(--line);border-radius:12px;padding:12px;margin-bottom:10px">
      <div class="acrow" style="grid-template-columns:26px 1fr 30px">
        <span class="sr">${i+1}</span>
        <select data-snh="${i}">${SN_HEADERS.map(x=>`<option value="${esc(x)}"${x===hd?" selected":""}>${esc(x)}</option>`).join("")}</select>
        <button class="del" data-snd="${i}" aria-label="Remove">×</button></div>
      <div style="margin-top:8px">${vals.map((v,j)=>
        `<div class="acrow" style="grid-template-columns:26px 1fr 62px 30px">
          <span class="sr">${j+1}</span>
          <input type="text" data-snv="${i}.${j}" value="${esc(v)}" class="${v.length>SN_MAX?"over":""}" placeholder="Enter value">
          <span class="len ${cls(v.length,SN_MAX)}">${v.length}/${SN_MAX}</span>
          <button class="del" data-snx="${i}.${j}" aria-label="Remove">×</button></div>`).join("")}</div>
      <div class="btnrow" style="margin-top:6px"><button class="btn btn-sm" data-sna="${i}">Add value</button></div>
    </div>`;}).join(""):`<div class="empty">No snippets yet.</div>`;
  $("#snStat").textContent=`${AS.sn.length}`;
  asChecks();
}
function asChecks(){
  const c=[], add=(l,ic,h)=>c.push(`<div class="check c-${l}"><span class="ic">${ic}</span><span>${h}</span></div>`);
  if(!AS.base) add("warn","!","<b>No base URL.</b> Sitelink final URLs can't be generated.");
  const slT=AS.sl.filter(r=>r[0].length>SL_T), slD=AS.sl.filter(r=>r[1].length>SL_D||r[2].length>SL_D);
  if(slT.length) add("bad","✕",`<b>${slT.length} sitelink text${slT.length===1?"":"s"} over ${SL_T} characters.</b>`);
  if(slD.length) add("bad","✕",`<b>${slD.length} sitelink description line${slD.length===1?"":"s"} over ${SL_D} characters.</b>`);
  const half=AS.sl.filter(r=>r[0].trim()&&((r[1].trim()?0:1)+(r[2].trim()?0:1))===1);
  if(half.length) add("warn","!",`<b>${half.length} sitelink${half.length===1?"":"s"} with only one description line.</b> Google shows both lines or neither — fill both.`);
  if(AS.sl.length&&AS.sl.length<4) add("warn","!",`<b>Only ${AS.sl.length} sitelinks.</b> Google needs at least 4 before it will show them.`);
  else if(AS.sl.length>=4) add("ok","✓",`<b>${AS.sl.length} sitelinks.</b> Enough for Google to serve them.`);
  const dupSl=new Set(), dl=[];
  AS.sl.forEach(r=>{const k=slUrl(r[0],r[3]); if(!k)return; if(dupSl.has(k))dl.push(r[0]); else dupSl.add(k);});
  if(dl.length) add("bad","✕",`<b>Two sitelinks slug to the same URL:</b> <code>${esc(dl[0])}</code>`);
  const coOver=AS.co.filter(t=>t.length>CO_MAX);
  if(coOver.length) add("bad","✕",`<b>${coOver.length} callout${coOver.length===1?"":"s"} over ${CO_MAX} characters.</b>`);
  if(AS.co.length&&AS.co.length<4) add("warn","!",`<b>Only ${AS.co.length} callouts.</b> Google needs at least 4.`);
  else if(AS.co.length>=4) add("ok","✓",`<b>${AS.co.length} callouts.</b>`);
  AS.sn.forEach(([hd,vals])=>{
    const v=vals.filter(x=>x.trim());
    if(v.length<3) add("bad","✕",`<b>${esc(hd)} has ${v.length} value${v.length===1?"":"s"}.</b> Google needs at least 3.`);
    if(v.length>10) add("bad","✕",`<b>${esc(hd)} has more than 10 values.</b>`);
    if(v.some(x=>x.length>SN_MAX)) add("bad","✕",`<b>${esc(hd)} has a value over ${SN_MAX} characters.</b>`);
  });
  $("#asChecks").innerHTML=c.length?c.join(""):`<div class="empty">Nothing flagged.</div>`;
}
function drawAll(){drawSl();drawCo();drawSn();}

on("#asBase","input",()=>{AS.base=$("#asBase").value;saveAs();drawSl();});
on("#asFromProj","click",()=>{
  const u=PROJ.url||$("#inLp").value.trim();
  if(!u)return toast("Set the landing page URL first");
  AS.base=u; $("#asBase").value=u; saveAs(); drawSl();});
on("#asLoadSl","click",()=>{AS.sl=PRESET[$("#asPreset").value].sl.map(r=>[...r]).filter(r=>!banned(r.join(" ")));saveAs();drawSl();toast("Sitelinks loaded");});
on("#asLoadCo","click",()=>{AS.co=scrub(PRESET[$("#asPreset").value].co);saveAs();drawCo();toast("Callouts loaded");});
on("#asLoadSn","click",()=>{AS.sn=PRESET[$("#asPreset").value].sn.map(([h,v])=>[h,[...v]]);saveAs();drawSn();toast("Snippets loaded");});

on("#slRows","input",e=>{
  const d=e.target.dataset;
  if(d.slt!==undefined)AS.sl[+d.slt][0]=e.target.value;
  else if(d.sl1!==undefined)AS.sl[+d.sl1][1]=e.target.value;
  else if(d.sl2!==undefined)AS.sl[+d.sl2][2]=e.target.value;
  else if(d.sls!==undefined)AS.sl[+d.sls][3]=e.target.value;
  else return;
  saveAs(); drawSl();
  const key=d.slt!==undefined?"slt":d.sl1!==undefined?"sl1":d.sl2!==undefined?"sl2":"sls";
  const f=document.querySelector(`[data-${key}="${d.slt??d.sl1??d.sl2??d.sls}"]`);
  if(f){f.focus();f.setSelectionRange(f.value.length,f.value.length);}});
on("#slRows","click",e=>{
  const i=e.target.dataset.sld; if(i===undefined)return;
  AS.sl.splice(+i,1); saveAs(); drawSl();});
on("#slAdd","click",()=>{AS.sl.push(["","","",""]);saveAs();drawSl();});

on("#coRows","input",e=>{
  const i=e.target.dataset.cot; if(i===undefined)return;
  AS.co[+i]=e.target.value; saveAs();
  const el=e.target.nextElementSibling, n=e.target.value.length;
  el.textContent=`${n}/${CO_MAX}`; el.className="len "+cls(n,CO_MAX);
  e.target.classList.toggle("over",n>CO_MAX);
  $("#coStat").textContent=`${AS.co.length} · 4+ recommended`; asChecks();});
on("#coRows","click",e=>{
  const i=e.target.dataset.cod; if(i===undefined)return;
  AS.co.splice(+i,1); saveAs(); drawCo();});
on("#coAdd","click",()=>{AS.co.push("");saveAs();drawCo();
  const last=$("#coRows").querySelector(".acrow:last-child input"); if(last)last.focus();});
on("#coPaste","click",()=>{
  const raw=prompt("Paste callouts, one per line:"); if(!raw)return;
  AS.co=raw.split("\n").map(s=>s.trim()).filter(Boolean).slice(0,20); saveAs(); drawCo();});

on("#snRows","input",e=>{
  const v=e.target.dataset.snv; if(v===undefined)return;
  const [i,j]=v.split(".").map(Number); AS.sn[i][1][j]=e.target.value; saveAs();
  const el=e.target.nextElementSibling, n=e.target.value.length;
  el.textContent=`${n}/${SN_MAX}`; el.className="len "+cls(n,SN_MAX);
  e.target.classList.toggle("over",n>SN_MAX); asChecks();});
on("#snRows","change",e=>{
  const i=e.target.dataset.snh; if(i===undefined)return;
  AS.sn[+i][0]=e.target.value; saveAs(); asChecks();});
on("#snRows","click",e=>{
  const d=e.target.dataset;
  if(d.snd!==undefined){AS.sn.splice(+d.snd,1);saveAs();drawSn();return;}
  if(d.sna!==undefined){AS.sn[+d.sna][1].push("");saveAs();drawSn();return;}
  if(d.snx!==undefined){const [i,j]=d.snx.split(".").map(Number);AS.sn[i][1].splice(j,1);saveAs();drawSn();}});
on("#snAdd","click",()=>{AS.sn.push(["Amenities",["","",""]]);saveAs();drawSn();});

/* exports */
on("#slCopy","click",()=>{
  if(!AS.sl.length)return toast("No sitelinks yet");
  copy("SR\tLink text\tLen\tMax\tDescription 1\tLen\tMax\tDescription 2\tLen\tMax\tFinal URL\n"+
    AS.sl.map((r,i)=>[i+1,r[0],r[0].length,SL_T,r[1],r[1].length,SL_D,r[2],r[2].length,SL_D,slUrl(r[0],r[3])].join("\t")).join("\n"));});
on("#slCsv","click",()=>{
  if(!AS.sl.length)return toast("No sitelinks yet");
  const fb=assetBase();
  if(!fb)return toast("Set the base URL first \u2014 sitelinks need somewhere to point");
  dl("sitelinks-ads-editor.csv","Link text,Description line 1,Description line 2,Final URL\n"+
    AS.sl.map(r=>[r[0],r[1],r[2],slUrl(r[0],r[3])||fb].map(csvq).join(",")).join("\n"));});
on("#coCopy","click",()=>{
  if(!AS.co.length)return toast("No callouts yet");
  copy("SR\tCallout\tLen\tMax\n"+AS.co.map((t,i)=>[i+1,t,t.length,CO_MAX].join("\t")).join("\n"));});
on("#coCsv","click",()=>{
  if(!AS.co.length)return toast("No callouts yet");
  dl("callouts-ads-editor.csv","Callout text\n"+AS.co.map(t=>csvq(t)).join("\n"));});
on("#snCopy","click",()=>{
  if(!AS.sn.length)return toast("No snippets yet");
  copy(AS.sn.map(([hd,v])=>`${hd}\n`+v.filter(x=>x.trim()).map((x,i)=>`${i+1}\t${x}\t${x.length}\t${SN_MAX}`).join("\n")).join("\n\n"));});
on("#snCsv","click",()=>{
  if(!AS.sn.length)return toast("No snippets yet");
  const hdr=["Header"]; for(let i=1;i<=10;i++)hdr.push(`Value ${i}`);
  dl("snippets-ads-editor.csv",hdr.map(csvq).join(",")+"\n"+
    AS.sn.map(([hd,v])=>{const vv=v.filter(x=>x.trim()).slice(0,10);
      const r=[hd]; for(let i=0;i<10;i++)r.push(vv[i]||""); return r.map(csvq).join(",");}).join("\n"));});


