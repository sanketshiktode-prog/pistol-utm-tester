/* ═══ exports ═══ */
on("#btnCsvVar","click",()=>{
  if(!VARIANTS.length)return toast("Nothing to export");
  dl("utm-variants.csv","campaign,adgroup,strategy,url\n"+
    VARIANTS.map(v=>[v.names.campaign,v.names.adgroup,v.names.strategy,v.url].map(csvq).join(",")).join("\n"));});
on("#btnCopyVar","click",()=>{
  if(!VARIANTS.length)return toast("Nothing to copy");
  copy("campaign\tadgroup\tstrategy\turl\n"+
    VARIANTS.map(v=>[v.names.campaign,v.names.adgroup,v.names.strategy,v.url].join("\t")).join("\n"));});
on("#btnCPtsv","click",()=>{
  const v=VARIANTS[PICK]; if(!v)return toast("No variant selected");
  copy(`{_adgroup}\t${paramVal(v.names.adgroup)}\n{_campaign}\t${paramVal(v.names.campaign)}\n{_strategy}\t${paramVal(v.names.strategy)}`);});
on("#btnCPall","click",()=>{
  if(!VARIANTS.length)return toast("Nothing to copy");
  copy(VARIANTS.map(v=>`${v.names.strategy}\n  {_adgroup}\t${paramVal(v.names.adgroup)}\n  {_campaign}\t${paramVal(v.names.campaign)}\n  {_strategy}\t${paramVal(v.names.strategy)}`).join("\n\n"));});
on("#btnOpen","click",()=>{
  const v=VARIANTS[PICK]; if(!v||!v.url)return toast("No URL yet");
  window.open(v.url,"_blank","noopener");});
document.addEventListener("click",e=>{
  const c=e.target.closest("[data-copy]"); if(c)copy($("#"+c.dataset.copy).textContent);
  const t=e.target.closest("[data-copytext]"); if(t)copy(t.dataset.copytext);});
["inLp","inEnq","inStrat","inMatch"].forEach(id=>{
  $("#"+id).addEventListener("input",build); $("#"+id).addEventListener("change",build);});
on("#inStrat","change",rememberStrats);

/* ═══ strategy manager ═══ */
function openModal(){
  DRAFT=STRATS[CH].map(r=>[...r]);
  $("#mTitle").textContent=CH==="search"?"Search":"Demand Gen";
  drawRows(); $("#modal").classList.add("on");
}
function drawRows(){
  $("#mRows").innerHTML=DRAFT.map((r,i)=>`<div class="srow">
    <input type="text" data-mn="${i}" value="${esc(r[0])}" placeholder="Enter strategy name">
    <input type="text" data-ms="${i}" value="${esc(r[1])}" placeholder="Shortform">
    <button class="del" data-md="${i}" aria-label="Remove">×</button></div>`).join("")
    ||`<div class="empty">No strategies. Add one.</div>`;
}
on("#mRows","input",e=>{
  const n=e.target.dataset.mn, s=e.target.dataset.ms;
  if(n!==undefined)DRAFT[+n][0]=e.target.value;
  if(s!==undefined)DRAFT[+s][1]=e.target.value;});
on("#mRows","click",e=>{
  const d=e.target.dataset.md; if(d===undefined)return;
  DRAFT.splice(+d,1); drawRows();});
on("#btnManage","click",openModal);
on("#mClose","click",()=>$("#modal").classList.remove("on"));
on("#modal","click",e=>{if(e.target.id==="modal")$("#modal").classList.remove("on");});
on("#mAdd","click",()=>{DRAFT.push(["",""]);drawRows();
  const last=$("#mRows").querySelector('.srow:last-child input'); if(last)last.focus();});
on("#mReset","click",()=>{
  if(!confirm("Reset this channel's strategies to the original list?"))return;
  DRAFT=DEFAULTS[CH].map(r=>[...r]); drawRows();});
on("#mSave","click",()=>{
  const clean=DRAFT.map(([n,s])=>[n.trim(),slug(s)]).filter(([n,s])=>n&&s);
  if(!clean.length)return toast("At least one strategy is needed");
  const seen=new Set();
  for(const [,s] of clean){ if(seen.has(s.toLowerCase()))return toast(`Duplicate shortform: ${s}`); seen.add(s.toLowerCase()); }
  STRATS[CH]=clean; store.set("pp_strats2",STRATS);
  $("#modal").classList.remove("on"); fillStrategies(); build(); toast("Saved");});
on("#mExport","click",()=>{copy(JSON.stringify(STRATS,null,2));toast("JSON copied — share it with the team");});
on("#mImport","click",()=>{
  const raw=prompt("Paste the exported JSON:"); if(!raw)return;
  try{
    const o=JSON.parse(raw);
    if(!o.search||!o.demandgen)throw 0;
    STRATS={search:o.search.map(r=>[String(r[0]),slug(r[1])]).filter(r=>r[0]&&r[1]),
            demandgen:o.demandgen.map(r=>[String(r[0]),slug(r[1])]).filter(r=>r[0]&&r[1])};
    store.set("pp_strats2",STRATS); DRAFT=STRATS[CH].map(r=>[...r]); drawRows();
    fillStrategies(); build(); toast("Imported");
  }catch(e){toast("That JSON didn't parse");}});
document.addEventListener("keydown",e=>{if(e.key==="Escape")$("#modal").classList.remove("on");});

/* ═══ boot ═══ */
fillStrategies(); fillUnits(); syncTicket();
/* The set strip and the places list used to be painted only by the map's
   own setup, so if Leaflet failed to load — a blocked CDN, a dead network —
   the whole Locations card came up blank and looked broken rather than
   simply mapless. They are drawn here, before and regardless of the map. */
onBoot(()=>{ drawLocSets(); drawTargets(); });   /* both live in a later file */

/* ═══════════ tabs ═══════════ */
/* Every panel carries the heading its tab used to be, so the page reads
   as one document rather than nine unlabelled slabs. The headings are
   built from the tabs themselves — one list, no second place to update. */
$$(".tab").forEach(t=>{
  const panel=$("#"+t.dataset.panel); if(!panel||panel.querySelector(".sec-head"))return;
  const num=(t.querySelector(".num")||{}).textContent||"";
  const name=t.textContent.replace(num,"").trim();
  const h=document.createElement("div");
  h.className="sec-head";
  h.innerHTML=`<span class="n">${num}</span><h1>${esc(name)}</h1><span class="rule"></span>`;
  panel.insertBefore(h,panel.firstChild);
});

const goTo=id=>{
  const el=$("#"+id); if(!el)return;
  el.scrollIntoView({behavior:"smooth",block:"start"});
};
$$(".tab").forEach(t=>t.addEventListener("click",()=>goTo(t.dataset.panel)));

/* The rail follows the scroll instead of being clicked into place. The
   topmost visible section wins, so a short section at the end of the page
   still lights up when you reach it. */
/* measured, not assumed: the top bar wraps on a narrow window or a long name */
(function measureBars(){
  const bar=$(".topbar"), rail=$(".tabs");
  if(!bar||!rail)return;
  const set=()=>{
    const r=document.documentElement.style;
    r.setProperty("--barh",Math.round(bar.getBoundingClientRect().height)+"px");
    r.setProperty("--railh",Math.round(rail.getBoundingClientRect().height)+"px");
  };
  set();
  if("ResizeObserver" in window){
    const ro=new ResizeObserver(set); ro.observe(bar); ro.observe(rail);
  }
  window.addEventListener("resize",set);
  /* webfonts land after first paint and change the bar's height with them */
  if(document.fonts&&document.fonts.ready)document.fonts.ready.then(set);
})();

(function railFollowsScroll(){
  const tabs=$$(".tab"), panels=tabs.map(t=>$("#"+t.dataset.panel)).filter(Boolean);
  if(!panels.length||!("IntersectionObserver" in window))return;
  const seen=new Map();
  const paint=()=>{
    let best=null, bestTop=Infinity;
    panels.forEach(p=>{
      if(!seen.get(p))return;
      const top=p.getBoundingClientRect().top;
      if(top<bestTop){ bestTop=top; best=p; }
    });
    if(!best)return;
    tabs.forEach(t=>{
      const on=t.dataset.panel===best.id;
      t.setAttribute("aria-selected",String(on));
      if(on&&t.scrollIntoView)t.scrollIntoView({block:"nearest",inline:"nearest"});
    });
  };
  const io=new IntersectionObserver(es=>{
    es.forEach(e=>seen.set(e.target,e.isIntersecting));
    paint();
  },{rootMargin:(()=>{
    const h=parseInt(getComputedStyle(document.documentElement)
      .getPropertyValue("--barh")||"55")+
      parseInt(getComputedStyle(document.documentElement)
      .getPropertyValue("--railh")||"44");
    return `-${h+8}px 0px -55% 0px`;
  })(),threshold:0});
  panels.forEach(p=>io.observe(p));
})();

/* kept so the dozen call sites that jump between sections still work */
const goTab=id=>goTo(id);

/* ═══════════ 02 keyword wrapper ═══════════ */
const MTNAME={E:"Exact",P:"Phrase",B:"Broad"};
function kwList(){
  let arr=$("#kwRaw").value.split(/[\n,]/).map(s=>s.trim()).filter(Boolean);
  if($("#kwPunct").checked) arr=arr.map(s=>s.replace(/[.!?,;:"'()\[\]{}]/g,"").replace(/\s+/g," ").trim());
  if($("#kwLower").checked) arr=arr.map(s=>s.toLowerCase());
  if($("#kwDedupe").checked){const seen=new Set();arr=arr.filter(s=>{const k=s.toLowerCase();
    if(seen.has(k))return false;seen.add(k);return true;});}
  return arr.filter(Boolean);
}
const wrapKw=(k,mt)=> mt==="E"?`[${k}]` : mt==="P"?`"${k}"` : k;
function renderKw(){
  const arr=kwList();
  const mts=$$(".kwmt").filter(c=>c.checked).map(c=>c.value);
  $("#kwIn").textContent=`${$("#kwRaw").value.split(/[\n,]/).filter(s=>s.trim()).length} lines`;
  if(!arr.length||!mts.length){
    $("#kwOut").textContent=!mts.length?"Pick at least one match type.":"Paste some keywords to get started.";
    $("#kwStat").textContent="—"; $("#kwFlags").innerHTML=`<div class="empty">Nothing to check yet.</div>`; return;
  }
  $("#kwOut").textContent = $("#kwGroup").checked
    ? mts.map(mt=>`# ${MTNAME[mt]}\n`+arr.map(k=>wrapKw(k,mt)).join("\n")).join("\n\n")
    : arr.map(k=>mts.map(mt=>wrapKw(k,mt)).join("\n")).join("\n");
  $("#kwStat").textContent=`${arr.length} unique × ${mts.length} = ${arr.length*mts.length}`;

  const f=[], add=(l,ic,h)=>f.push(`<div class="check c-${l}"><span class="ic">${ic}</span><span>${h}</span></div>`);
  const long=arr.filter(k=>k.split(/\s+/).length>10);
  const chars=arr.filter(k=>k.length>80);
  const src=$("#kwRaw").value.split(/[\n,]/).filter(s=>s.trim()).length;
  const removed=src-arr.length;
  if(removed>0) add("ok","✓",`<b>${removed}</b> duplicate or empty line${removed===1?"":"s"} removed.`);
  if(long.length) add("bad","✕",`<b>${long.length} keyword${long.length===1?"":"s"} over 10 words.</b> Google rejects these: <code>${esc(long[0])}</code>`);
  if(chars.length) add("bad","✕",`<b>${chars.length} keyword${chars.length===1?"":"s"} over 80 characters.</b> Google rejects these.`);
  const one=arr.filter(k=>k.split(/\s+/).length===1);
  if(one.length&&mts.includes("B")) add("warn","!",`<b>${one.length} single-word broad keyword${one.length===1?"":"s"}.</b> Expect loose matching and wasted spend.`);
  if(!f.length) add("ok","✓","All keywords are within Google's limits.");
  $("#kwFlags").innerHTML=f.join("");
}
["kwRaw","kwLower","kwDedupe","kwPunct","kwGroup"].forEach(id=>{
  $("#"+id).addEventListener("input",renderKw); $("#"+id).addEventListener("change",renderKw);});
$$(".kwmt").forEach(c=>c.addEventListener("change",renderKw));
function fillVariantPickers(){
  const sel=$("#kwPick"), keep=sel.value;
  sel.innerHTML=`<option value="">— pick a variant —</option>`+
    VARIANTS.map((v,i)=>`<option value="${i}">${esc(v.names.adgroup)}</option>`).join("");
  if([...sel.options].some(o=>o.value===keep))sel.value=keep;
}
on("#kwPick","change",()=>{
  const v=VARIANTS[+$("#kwPick").value]; if(!v)return;
  $("#kwCamp").value=v.names.campaign; $("#kwAdg").value=v.names.adgroup;});
on("#kwCsv","click",()=>{
  const arr=kwList(), mts=$$(".kwmt").filter(c=>c.checked).map(c=>c.value);
  if(!arr.length||!mts.length)return toast("Nothing to export");
  const camp=$("#kwCamp").value.trim(), adg=$("#kwAdg").value.trim();
  if(!camp||!adg)return toast("Campaign and ad group are needed for the editor file");
  const rows=[]; arr.forEach(k=>mts.forEach(mt=>rows.push([camp,adg,k,MTNAME[mt]])));
  dl("keywords-ads-editor.csv","Campaign,Ad group,Keyword,Match type\n"+rows.map(r=>r.map(csvq).join(",")).join("\n"));});
on("#kwSheet","click",()=>{
  const arr=kwList(); if(!arr.length)return toast("Nothing to copy");
  copy("Keywords\n"+arr.join("\n"));});

