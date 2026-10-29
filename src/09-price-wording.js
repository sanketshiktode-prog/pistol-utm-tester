/* ═══════════ price wording ═══════════ */
/* The qualifier and the asterisk are not optional. When a line runs out of
   room the unit shortens (Lacs to L, Crore to Cr) and the qualifier falls
   back to "From", but neither is ever dropped entirely. */
function priceUnitShort(p){
  return String(p||"")
    .replace(/\bLakhs?\b/gi,"L").replace(/\bLacs?\b/gi,"L")
    .replace(/\bCrores?\b/gi,"Cr").replace(/\bCr\./gi,"Cr")
    .replace(/\bMillion\b/gi,"M").replace(/\bThousand\b/gi,"K")
    .replace(/\s+/g," ").trim();
}
function priceForms(){
  const p=(PROJ.price||"").trim().replace(/\*+$/,"");
  if(!p)return [];
  const short=priceUnitShort(p);
  const mode=($("#acPriceMode")&&$("#acPriceMode").value)||"Starting At";
  const allIn=($("#acAllIn")&&$("#acAllIn").value)||"";
  const f=[];
  if(mode==="All Inclusive"||allIn==="yes")
    f.push(`${p} All Inclusive*`,`${short} All Inclusive*`,`${short} All-In*`);
  else if(mode==="Onwards")
    f.push(`${p} Onwards*`,`${short} Onwards*`);
  else
    f.push(`${mode} ${p}*`,`${mode} ${short}*`);
  f.push(`From ${p}*`,`From ${short}*`);
  return [...new Set(f.filter(Boolean))];
}
/* longest form that still fits the space left over */
function priceFit(room){
  const f=priceForms(); if(!f.length)return "";
  for(const x of f) if(x.length<=room) return x;
  return f[f.length-1];
}
function pricePhrase(){ const f=priceForms(); return f.length?f[0]:""; }
const priceShort=()=>{const f=priceForms();return f.length?f[f.length-1]:"";};

/* ═══════════ keyword review inside an ad group ═══════════ */
function kwOf(){ return (cur().kw||"").split("\n").map(s=>s.trim()).filter(Boolean); }
function setKw(list){
  if(!ADCUR)return;
  kwLedger(ADCUR,list);
  const n=mirrorKw(ADCUR);
  saveAd(); drawKwList(); syncPlanKw();
  if(n)toast(`Mirrored into ${n} other ad group${n===1?"":"s"}`);
}
function drawKwList(){
  if(!ADCUR||!ADG[ADCUR]){ $("#acKwList").innerHTML=`<div class="empty">No ad group selected.</div>`;
    $("#acKwStat").textContent="0"; return; }
  const list=kwOf();
  $("#acKwStat").textContent=`${list.length} keyword${list.length===1?"":"s"}`;
  $("#acKwList").innerHTML=list.length
    ? list.map((k,i)=>`<div class="acrow" style="grid-template-columns:26px 1fr 30px;margin-bottom:5px">
        <span class="sr">${i+1}</span>
        <input type="text" data-kwi="${i}" value="${esc(k)}" spellcheck="false" style="font-family:var(--mono);font-size:12.5px">
        <button class="del" data-kwx="${i}" aria-label="Remove">\u00d7</button></div>`).join("")
    : `<div class="empty">No keywords yet. Build the structure or add them below.</div>`;
  $("#acKw").value=list.join("\n");
}
const kwFromRows=()=>[...document.querySelectorAll("#acKwList [data-kwi]")]
  .map(el=>el.value.trim()).filter(Boolean);
on("#acKwList","input",e=>{ if(e.target.dataset.kwi===undefined)return;
  $("#acKwStat").textContent=`${kwFromRows().length} keywords`; });
/* a renamed row is a delete plus an add, so the ledger is written when the
   field is left rather than on every keystroke */
on("#acKwList","change",e=>{ if(e.target.dataset.kwi===undefined)return;
  setKw(kwFromRows()); });
on("#acKwList","click",e=>{ const i=e.target.dataset.kwx; if(i===undefined)return;
  const l=kwOf(); l.splice(+i,1); setKw(l); });
function addKw(){
  const v=$("#acKwNew").value.trim(); if(!v)return;
  const l=kwOf();
  v.split(/[\n,]/).map(s=>s.trim()).filter(Boolean).forEach(k=>{ if(!l.some(x=>x.toLowerCase()===k.toLowerCase()))l.push(k); });
  $("#acKwNew").value=""; setKw(l);
}
on("#acKwAdd","click",addKw);
on("#acKwNew","keydown",e=>{ if(e.key==="Enter"){e.preventDefault();addKw();} });
on("#acKwEdit","click",()=>{
  const ta=$("#acKw"), open=!ta.classList.contains("hidden");
  if(open){ setKw(ta.value.split("\n").map(s=>s.trim()).filter(Boolean)); ta.classList.add("hidden"); }
  else { ta.value=kwOf().join("\n"); ta.classList.remove("hidden"); ta.focus(); }
});
/* edits made here must reach the export */
function syncPlanKw(){
  PLAN.forEach(p=>p.groups.forEach(g=>{
    if(ADG[g.name]) g.kws=(ADG[g.name].kw||"").split("\n").map(s=>s.trim()).filter(Boolean);
  }));
  if(typeof drawPlan==="function")drawPlan();
}

/* ═══════════ keyword sets per strategy ═══════════ */
const BLOCK_DEFAULT="reviews, review, resale, rent, rental, complaints, scam, fraud, jobs, careers, brochure, price list, floor plan, payment plan, possession, emi, loan";
function blockWords(){
  const el=$("#kwBlock");
  return (el&&el.value||BLOCK_DEFAULT).split(",").map(s=>s.trim().toLowerCase()).filter(Boolean);
}
function blocked(s){
  const t=" "+String(s).toLowerCase()+" ";
  return blockWords().some(w=>t.includes(" "+w+" ")||t.includes(" "+w));
}
function locList(){
  /* These feed keywords AND headlines, and they come straight off the inputs
     rather than through brief(), so "Vadgaon,Pune" typed here reached a
     headline untouched. Tidied on the way out, like everything else that
     ends up in ad text. */
  const main=adText($("#locMain").value)||PROJ.micro;
  const alt=lines($("#locAlt").value).map(adText);
  return [main,...alt].filter(Boolean);
}
/* "Mahindra Lifespaces" also gets searched as plain "Mahindra". The short
   form is added for the location-led sets, not for brand-broad, where it
   would pull in every other Mahindra business. */
/* Developers write their own name closed up — Bramhacorp, Godrejproperties,
   Rustomjee — and the public types it open: "bramha corp bavdhan". Both have
   to be bid on or the open spelling goes to a competitor. The split is made
   on a trade word at the end of the name, or on a capital in the middle. */
const COMPOUND_TAIL=["corporation","corp","constructions","construction","developments",
  "development","developers","developer","properties","property","lifespaces","lifespace",
  "infrastructure","infratech","infra","realtors","realestate","realty","enterprises",
  "ventures","venture","buildcon","builders","builder","landmarks","projects","associates",
  "foundations","habitat","housing","shelters","estates","estate","heights","spaces",
  "abodes","groups","group","homes","world","land","city"];
function deCompound(word){
  const w=String(word||"").trim();
  if(!w||/\s/.test(w))return "";
  const camel=w.replace(/([a-z])([A-Z])/g,"$1 $2");
  if(camel!==w)return camel;
  const low=w.toLowerCase();
  for(const t of COMPOUND_TAIL){
    if(low.length>=t.length+4&&low.endsWith(t))
      return w.slice(0,w.length-t.length)+" "+w.slice(w.length-t.length);
  }
  return "";
}
/* "Mahindra Lifespaces" also gets searched as plain "Mahindra", and
   "Bramhacorp" as "Bramha corp" and "Bramha". The short forms are added for
   the location-led sets, not for brand-broad, where a bare first word would
   pull in every other business of that name. */
function devForms(dev,broad){
  const full=String(dev||"").trim(); if(!full)return [];
  const parts=full.split(/\s+/), short=parts[0];
  const weak=/^(the|shri|sri|m|s|new)$/i.test(short)||short.length<4;
  const base=(broad||weak||parts.length<2)?[full]:[full,short];
  const out=[];
  base.forEach(f=>{
    out.push(f);
    const w=f.split(/\s+/), split=deCompound(w[0]);
    if(!split)return;
    out.push([split,...w.slice(1)].join(" ").trim());
    /* the bare stem on its own — "bramha bavdhan" is a real query */
    const stem=split.split(/\s+/)[0];
    if(!broad&&stem.length>=4)out.push([stem,...w.slice(1)].join(" ").trim());
  });
  const seen=new Set();
  return out.filter(x=>x&&!seen.has(x.toLowerCase())&&seen.add(x.toLowerCase()));
}
function kwForStrategy(code){
  const b=brief(), P=b.proj, D=b.dev||P, C=b.city, locs=locList();
  const c=String(code).toUpperCase(), out=[];
  /* intent words like brochure, price and floor plan pull in research
     traffic that rarely converts. Brand and location only. */
  const tails=["","new launch"];
  if(c.includes("BPL")){
    const devPrefix=P.toLowerCase().startsWith(D.toLowerCase());
    devForms(D,false).slice(1).forEach(sd=>{
      const shortProj=P.replace(new RegExp("^"+D.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"),"i"),sd).trim();
      if(shortProj&&shortProj.toLowerCase()!==P.toLowerCase()){
        out.push(shortProj); locs.forEach(L=>out.push(`${shortProj} ${L}`));
      }
    });
    /* the project's own name can be closed up too — "Avantacity Bavdhan" */
    const pw=P.split(/\s+/), pSplit=deCompound(pw[0]);
    if(pSplit){
      const alt=[pSplit,...pw.slice(1)].join(" ").trim();
      out.push(alt); locs.forEach(L=>out.push(`${alt} ${L}`));
    }
    locs.forEach(L=>{ out.push(P, `${P} ${L}`, `${P} ${L} ${C}`);
      if(!devPrefix) devForms(D,false).forEach(dv=>out.push(`${dv} ${P} ${L}`));
      tails.forEach(t=>t&&out.push(`${P} ${L} ${t}`)); });
    tails.forEach(t=>t&&out.push(`${P} ${t}`));
    if(C)out.push(`${P} ${C}`);
  } else if(c.includes("BB")){
    out.push(D, `${D} ${C}`, `${D} projects`, `${D} new launch`,
      `${D} properties`, `${D} upcoming projects`, `${D} new project ${C}`);
    tails.forEach(t=>t&&out.push(`${D} ${t}`));
  } else { /* BL and anything else: brand + location */
    devForms(D,false).forEach(dv=>locs.forEach(L=>{
      out.push(`${dv} ${L}`, `${dv} new launch ${L}`, `${dv} projects ${L}`,
        `${dv} flats ${L}`, `new project by ${dv} ${L}`, `${dv} apartments ${L}`);
      tails.forEach(t=>t&&out.push(`${dv} ${L} ${t}`)); }));
  }
  const seen=new Set();
  return out.map(s=>String(s).toLowerCase().replace(/\s+/g," ").trim())
    .filter(s=>s&&s.split(" ").length<=10&&s.length<=80&&!blocked(s)&&!seen.has(s)&&seen.add(s));
}

