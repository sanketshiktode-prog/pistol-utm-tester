/* ═══ dropdowns ═══ */
const isPrelaunch=()=>$("#inStage")&&$("#inStage").value==="prelaunch";
/* With no project name announced there is nothing for a Brand-Project-Location
   campaign to bid on, so it is taken off the table rather than built empty. */
const blockedStrat=s=>isPrelaunch()&&/BPL/i.test(s);
function drawStratBoxes(){
  const sel=$("#inStrat");
  $("#stratBoxes").innerHTML=[...sel.options].map((o,i)=>{
    const off=blockedStrat(o.value);
    return `<label class="chk" style="${off?"opacity:.45":""}">
      <input type="checkbox" data-sb="${i}" ${o.selected&&!off?"checked":""} ${off?"disabled":""}>
      <span>${esc(o.textContent)}</span>
      ${off?'<span class="pill p-bad" style="margin-left:auto">needs a name</span>':""}</label>`;}).join("")
    ||`<div class="empty">No strategies yet.</div>`;
}
on("#stratBoxes","change",e=>{
  const i=e.target.dataset.sb; if(i===undefined)return;
  $("#inStrat").options[+i].selected=e.target.checked; build();});
on("#inStage","change",()=>{
  $("#stageNote").textContent=isPrelaunch()
    ? "Brand-Project-Location is switched off. Market it as developer plus location, e.g. Mahindra Mahalunge."
    : "Brand-Project-Location runs on the project name.";
  [...$("#inStrat").options].forEach(o=>{ if(blockedStrat(o.value))o.selected=false; });
  drawStratBoxes(); build();});
/* Which strategies are picked, remembered per channel. Without this, moving
   to Demand Gen and back lost the Search picks — and deploying both channels
   in one run needs each channel's own list to still be there. */
let STRAT_SEL=store.get("pp_stratsel",{search:[],demandgen:[]})||{search:[],demandgen:[]};
function rememberStrats(){
  STRAT_SEL[CH]=[...$("#inStrat").selectedOptions].map(o=>o.value);
  store.set("pp_stratsel",STRAT_SEL);
}
function fillStrategies(){
  const sel=$("#inStrat");
  const keep=new Set((STRAT_SEL[CH]&&STRAT_SEL[CH].length)
    ? STRAT_SEL[CH] : [...sel.selectedOptions].map(o=>o.value));
  sel.innerHTML=STRATS[CH].map(([n,s])=>`<option value="${esc(s)}">${esc(n)} — ${esc(s)}</option>`).join("");
  [...sel.options].forEach(o=>{if(keep.has(o.value)&&!blockedStrat(o.value))o.selected=true;});
  if(![...sel.selectedOptions].length){const f=[...sel.options].find(o=>!blockedStrat(o.value)); if(f)f.selected=true;}
  rememberStrats();
  drawStratBoxes();
  try{ drawCsBoxes(); }catch(e){}
  $("#wrapMatch").classList.toggle("hidden",CH!=="search");
  $("#mgLabel").textContent=CH==="search"?"Search":"Demand Gen";
}
$("#inMatch").innerHTML=MATCH.map(([n,s])=>`<option value="${s}"${(s==="E"||s==="P")?" selected":""}>${n} — ${s}</option>`).join("");
$("#vtGrid").innerHTML=Object.keys(VT_DEFAULTS).map(k=>
  `<label class="f"><span class="f-lab">{${esc(k)}}</span><input type="text" data-vt="${k}" value="${esc(VT_DEFAULTS[k])}"></label>`).join("");
$$("[data-vt]").forEach(i=>i.addEventListener("input",()=>{VT[i.dataset.vt]=i.value;build();}));
on("#segChannel","click",e=>{const b=e.target.closest("button[data-ch]");if(!b)return;
  CH=b.dataset.ch;$$("#segChannel button").forEach(x=>x.setAttribute("aria-pressed",String(x===b)));
  fillStrategies();build();showDGCard();dgcShow();drawCsMap();
  const sc=$("#stChannel"); if(sc){sc.textContent=CHANNEL[CH].full;
    sc.className="pill "+(CH==="demandgen"?"p-ok":"p-live");}
  /* the deploy tab describes a different campaign type now */
  drawApSettings(); drawApPlan();});
$$("[data-all]").forEach(b=>b.addEventListener("click",()=>{
  const s=$("#"+b.dataset.all), on=[...s.selectedOptions].length<s.options.length;
  [...s.options].forEach(o=>o.selected=on&&!(s.id==="inStrat"&&blockedStrat(o.value)));
  if(s.id==="inStrat")drawStratBoxes();
  if(!on&&s.options.length)s.options[0].selected=true;
  b.textContent=on?"clear":"select all"; build();}));

/* ═══ naming ═══ */
function clean(s){
  return String(s||"").replace(/\s+/g," ").trim().replace(/[^A-Za-z0-9 \-_.&]/g,"");
}
function names(enq,strat,tk,mt,ch){
  const e=clean(enq)||"ENQUIRY", t=slug(tk)||"ticketsize";
  const C=CHANNEL[ch], search=ch==="search";
  /* Demand Gen in the account reads "Alef Linar Sharjah d-op", lowercase,
     not "Demand Gen Op". */
  const dg=`${C.short.toLowerCase()}-${String(strat).toLowerCase()}`;
  const campaign=search?`${e} ${C.full} ${strat}`:`${e} ${dg}`;
  const adgroup=search ? `${e} ${C.short}-${strat}-${t}-${mt}`
                       : `${e} ${dg}-${t}`;
  const strategy=search ? `${C.short}-${strat}-${mt}` : dg;
  return {campaign,adgroup,strategy};
}
/* Google Ads custom parameter values cannot carry spaces — Ads Editor
   splits on them and reads each token as a new parameter name. Campaign
   and ad group NAMES keep their spaces; only the tracking values are
   hyphenated. */
const paramVal=s=>String(s||"").replace(/\s+/g,"-").replace(/-{2,}/g,"-");
function assemble(lp,tplRaw,n){
  const hasQ=lp.includes("?"), tail=tplRaw.replace("{lpurl}","").replace(/^&/,"");
  const parts=tail.split("&").map(p=>{
    const i=p.indexOf("="), k=p.slice(0,i), raw=p.slice(i+1);
    let kind="static", val=raw;
    if(raw.startsWith("{_")){kind="custom";
      val=raw==="{_adgroup}"?paramVal(n.adgroup):raw==="{_campaign}"?paramVal(n.campaign):raw==="{_strategy}"?paramVal(n.strategy):raw;}
    else if(raw.startsWith("{")){kind="valuetrack";val=VT[raw.slice(1,-1)]??raw;}
    return {k,raw,val,kind};});
  return {parts,hasQ,url:lp+(hasQ?"&":"?")+parts.map(p=>`${p.k}=${encodeURIComponent(p.val)}`).join("&")};
}

/* ═══ build ═══ */
function build(){
  const lp=$("#inLp").value.trim(), enq=$("#inEnq").value.trim(), tk=ticket();
  const strats=[...$("#inStrat").selectedOptions].map(o=>o.value);
  const mts=CH==="search"?[...$("#inMatch").selectedOptions].map(o=>o.value):[""];
  $("#outTpl").textContent=TPL[CH];

  VARIANTS=[];
  if(enq&&strats.length) strats.forEach(s=>mts.forEach(mt=>{
    const n=names(enq,s,tk,mt,CH);
    const a=lp?assemble(lp,TPL[CH],n):null;
    VARIANTS.push({enq,strat:s,mt,ch:CH,lp,names:n,parts:a?a.parts:[],url:a?a.url:"",hasQ:a?a.hasQ:false});
  }));
  if(PICK>=VARIANTS.length)PICK=0;

  $("#varCount").textContent=`${VARIANTS.length} VARIANT${VARIANTS.length===1?"":"S"}`;
  $("#varHint").textContent=VARIANTS.length
    ? `${strats.length} strateg${strats.length===1?"y":"ies"}${CH==="search"?` × ${mts.length} match type${mts.length===1?"":"s"}`:""} = ${VARIANTS.length}`
    : "—";

  $("#tblVar").querySelector("tbody").innerHTML=VARIANTS.length
    ? VARIANTS.map((v,i)=>`<tr class="pick${i===PICK?" sel":""}" data-i="${i}">
        <td style="padding-left:16px" class="m">${i+1}</td>
        <td class="m">${esc(v.names.campaign)}</td>
        <td class="m">${esc(v.names.adgroup)}</td>
        <td class="m">${esc(v.names.strategy)}</td>
        <td class="right" style="padding-right:16px">${v.url
          ?`<button class="btn btn-sm" data-copytext="${esc(v.url)}">Copy</button>`
          :`<span class="pill p-mute">no LP</span>`}</td></tr>`).join("")
    : `<tr><td colspan="5"><div class="empty">Enter an enquiry name and pick at least one strategy.</div></td></tr>`;

  renderCP(); renderAnat(); renderChecks();
  if(typeof fillVariantPickers==="function")fillVariantPickers();
  /* the Demand Gen copy is per variant, so its picker follows the variants */
  if(typeof dgcShow==="function"&&CH==="demandgen"){ dgcFill(); dgcDraw(); }
  /* build() also runs once while the script is still being evaluated, before
     the audience helpers exist, so this one is allowed to be too early */
  try{ drawCsMap(); }catch(e){}
}
on("#tblVar","click",e=>{
  if(e.target.closest("[data-copytext]"))return;
  const r=e.target.closest("tr[data-i]"); if(!r)return;
  PICK=+r.dataset.i;
  $$("#tblVar tbody tr").forEach(x=>x.classList.toggle("sel",x===r));
  renderCP(); renderAnat();
});

function renderCP(){
  const v=VARIANTS[PICK], tb=$("#tblCP").querySelector("tbody");
  if(!v){$("#cpWho").textContent="select a variant";
    tb.innerHTML=`<tr><td colspan="3"><div class="empty">No variants yet.</div></td></tr>`;return;}
  $("#cpWho").textContent=v.names.strategy;
  tb.innerHTML=[["{_adgroup}",paramVal(v.names.adgroup)],["{_campaign}",paramVal(v.names.campaign)],["{_strategy}",paramVal(v.names.strategy)]]
    .map(([p,val])=>`<tr>
      <td><span class="param-name">${esc(p)}</span></td>
      <td class="m" style="font-size:12.5px">${esc(val)}</td>
      <td class="right"><span class="count${val.length>250?" bad":""}">${val.length}/250</span>
        <button class="btn btn-sm" style="margin-left:8px" data-copytext="${esc(val)}">Copy</button></td></tr>`).join("");
}
function renderAnat(){
  const v=VARIANTS[PICK];
  if(!v||!v.url){$("#anatBase").textContent="—";$("#anatList").innerHTML="";
    $("#anatWho").textContent="select a variant";$("#outUrl").textContent="—";$("#urlLen").textContent="";return;}
  $("#anatWho").textContent=v.names.strategy;
  $("#anatBase").textContent=v.lp;
  $("#outUrl").textContent=v.url;
  $("#urlLen").textContent=`${v.url.length} chars`;
  $("#anatList").innerHTML=v.parts.map(p=>`<div class="anat-row k-${p.kind}">
    <span class="dot"></span><span class="anat-k">${esc(p.k)}</span><span class="anat-v">${esc(p.val)}</span></div>`).join("");
}
function renderChecks(){
  const lp=$("#inLp").value.trim(), enq=$("#inEnq").value.trim(), c=[];
  const add=(l,ic,h)=>c.push(`<div class="check c-${l}"><span class="ic">${ic}</span><span>${h}</span></div>`);
  let u=null; try{u=new URL(lp);}catch(e){}

  if(!lp) add("bad","✕","<b>No landing page URL.</b> Variants are named but no URL can be built.");
  else if(!u) add("bad","✕","<b>Landing page URL is not valid.</b> It needs a scheme — <code>https://…</code>.");
  else if(u.protocol!=="https:") add("bad","✕","<b>Not HTTPS.</b> Google Ads rejects insecure final URLs.");
  else add("ok","✓","Landing page URL parses and is HTTPS.");

  if(!enq) add("bad","✕","<b>No enquiry name.</b>");
  else if(clean(enq)!==enq.trim())
    add("warn","!",`Enquiry name cleaned to <code>${esc(clean(enq))}</code>. Confirm the CRM enquiry matches exactly.`);
  else add("ok","✓","Enquiry name is clean — no characters that break a query string.");
  if(CH==="search"){
    const sel=[...$("#inMatch").selectedOptions].map(o=>o.value);
    const missing=["E","P"].filter(x=>!sel.includes(x));
    if(missing.length) add("warn","!",`<b>${missing.map(x=>x==="E"?"Exact":"Phrase").join(" and ")} not selected.</b> Both normally run in every Search campaign.`);
    else add("ok","✓","Phrase and Exact are both covered.");
  }

  if(!ticket()) add("warn","!","<b>No ticket size.</b> Ad group names will read <code>ticketsize</code>.");
  else add("ok","✓",`Ticket size resolves to <code>${esc(ticket())}</code>.`);

  if(VARIANTS.length&&lp){
    if(!VARIANTS[0].hasQ) add("warn","!","Landing page has no query string, so the template's leading <code>&amp;</code> becomes <code>?</code>. <b>Google does the same substitution</b> — the sheet template is safe as written.");
    else add("ok","✓","Landing page already carries a query string; the leading <code>&amp;</code> is correct.");
    if(u){
      const dup=[...new URLSearchParams(u.search).keys()].filter(k=>VARIANTS[0].parts.some(p=>p.k.toLowerCase()===k.toLowerCase()));
      if(dup.length) add("bad","✕",`<b>Duplicate parameters:</b> <code>${esc(dup.join(", "))}</code> exist on the landing page and the template adds them again.`);
      else add("ok","✓","No parameter collides with the landing page's own query string.");
    }
  }
  if(VARIANTS.length&&/\s/.test(VARIANTS[0].names.campaign))
    add("ok","\u2713","Custom parameter values are hyphenated. Google Ads Editor splits these on spaces, so <code>Search BL</code> becomes <code>Search-BL</code> in the tracking value while the campaign name itself keeps its spaces.");
  if(VARIANTS.some(v=>v.names.adgroup.length>250||v.names.campaign.length>250))
    add("bad","✕","<b>Some variants exceed the 250-character custom-parameter limit.</b>");
  if(TPL[CH].includes("ads_id=TBD"))
    add("warn","!","<code>ads_id</code> is still <code>TBD</code> in the sheet template. Replace it with the real account identifier before this goes live.");
  $("#checks").innerHTML=c.join("");
}

