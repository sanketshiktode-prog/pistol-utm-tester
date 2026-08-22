
/* ═══ config from the tracking sheet ═══ */
const TPL={
 search:"{lpurl}&source_key=Website&utm_source=Website&utm_medium=ppmcc&utm_campaign=google-search&Keyword={keyword}&Device={device}&ads_id=TBD&ads_group_id={adgroupid}&ads_extension_id={extensionid}&ads_set_name={_adgroup}&campaign_id={campaignid}&campaign_name={_campaign}&keyword_type={matchtype}&physical_location={loc_physical_ms}&ad_strategy={_strategy}",
 demandgen:"{lpurl}&source_key=google-discovery&utm_source=google-discovery&utm_medium=ppmcc&utm_campaign=google-discovery&Keyword={keyword}&Device={device}&ads_id=TBD&ads_group_id={adgroupid}&ads_extension_id={extensionid}&ads_set_name={_adgroup}&campaign_id={campaignid}&campaign_name={_campaign}&keyword_type={matchtype}&physical_location={loc_physical_ms}&ad_strategy={_strategy}"};
const STRATS={
 search:[["Search Brand Location","S-BL"],["Search Brand Project Location","S-BPL"],["Search Brand Broad","S-BB"]],
 demandgen:[["Open","Op"],["Inmarket","In"],["Luxury","luxury"],["Investment","invest"],["Avid","avid"],
  ["News Portal","news-portal"],["News App","news-app"],["Property Portal URL","property-portal-url"],
  ["Property Portal Apps","property-portal-app"],["URL Brand","ub"],["Youtube Brand","yb"],
  ["Keywords Brand","kb"],["Keywords Competitors","kc"],["Keywords Generic","kg"],
  ["Youtube Competitors","yc"],["URL Competitors","uc"]]};
const MATCH=[["Exact","E"],["Phrase","P"],["Broad","B"]];
const SEGMENT="d";
const VT_DEFAULTS={keyword:"qa-test-keyword",device:"m",adgroupid:"170000000001",extensionid:"0",
  campaignid:"220000000001",matchtype:"e",loc_physical_ms:"9061686"};

/* ═══ helpers ═══ */
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const slug=s=>String(s||"").trim().replace(/\s+/g,"-").replace(/[^A-Za-z0-9\-_.]/g,"").replace(/-{2,}/g,"-").replace(/^-|-$/g,"");
function toast(m){const t=$("#toast");t.textContent=m;t.classList.add("on");clearTimeout(t._t);t._t=setTimeout(()=>t.classList.remove("on"),1900);}
function fallbackCopy(x,cb){const ta=document.createElement("textarea");ta.value=x;ta.style.cssText="position:fixed;opacity:0";
  document.body.appendChild(ta);ta.select();try{document.execCommand("copy");cb();}catch(e){toast("Copy failed");}ta.remove();}
function copy(x){const d=()=>toast("Copied");
  if(navigator.clipboard&&window.isSecureContext)navigator.clipboard.writeText(x).then(d).catch(()=>fallbackCopy(x,d));else fallbackCopy(x,d);}
const store={get(k,d){try{const v=localStorage.getItem(k);return v?JSON.parse(v):d;}catch(e){return d;}},
             set(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}}};
const csvq=v=>`"${String(v??"").replace(/"/g,'""')}"`;
function dl(name,text){const b=new Blob([text],{type:"text/csv;charset=utf-8"});const a=document.createElement("a");
  a.href=URL.createObjectURL(b);a.download=name;document.body.appendChild(a);a.click();
  setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},400);}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

/* ═══ state ═══ */
let CH="search", VT={...VT_DEFAULTS};
let VARIANTS=[], PICK=0, FIRING=false;
let LOG=store.get("pp_utm_log",[]);
let FIELDS=store.get("pp_utm_fields",null)||[["enq_name","{{name}}"],["mobile","{{phone}}"]];

/* ═══ tabs ═══ */
$$(".tab").forEach(t=>t.addEventListener("click",()=>{
  $$(".tab").forEach(x=>x.setAttribute("aria-selected",String(x===t)));
  $$(".panel").forEach(p=>p.classList.toggle("on",p.id===t.dataset.panel));
  window.scrollTo(0,0);
}));
const goTab=id=>$$(".tab").find(t=>t.dataset.panel===id).click();

/* ═══ inputs ═══ */
function fillStrategies(){
  const sel=$("#inStrat"),keep=new Set([...sel.selectedOptions].map(o=>o.value));
  sel.innerHTML=STRATS[CH].map(([n,s])=>`<option value="${esc(s)}">${esc(n)} — ${esc(s)}</option>`).join("");
  [...sel.options].forEach(o=>{if(keep.has(o.value))o.selected=true;});
  if(![...sel.selectedOptions].length&&sel.options.length) sel.options[0].selected=true;
  $("#wrapMatch").classList.toggle("hidden",CH!=="search");
}
$("#inMatch").innerHTML=MATCH.map(([n,s])=>`<option value="${s}"${s==="E"?" selected":""}>${n} — ${s}</option>`).join("");
$("#vtGrid").innerHTML=Object.keys(VT_DEFAULTS).map(k=>
  `<label class="f"><span class="f-lab">{${esc(k)}}</span><input type="text" data-vt="${k}" value="${esc(VT_DEFAULTS[k])}"></label>`).join("");
$$("[data-vt]").forEach(i=>i.addEventListener("input",()=>{VT[i.dataset.vt]=i.value;build();}));
$("#segChannel").addEventListener("click",e=>{const b=e.target.closest("button[data-ch]");if(!b)return;
  CH=b.dataset.ch;$$("#segChannel button").forEach(x=>x.setAttribute("aria-pressed",String(x===b)));
  fillStrategies();build();});
$$("[data-all]").forEach(b=>b.addEventListener("click",()=>{
  const s=$("#"+b.dataset.all);const on=[...s.selectedOptions].length<s.options.length;
  [...s.options].forEach(o=>o.selected=on);
  if(!on&&s.options.length)s.options[0].selected=true;
  b.textContent=on?"clear":"select all";build();}));
fillStrategies();

/* ═══ naming + assembly ═══ */
function names(enq,strat,ticket,mt,ch){
  const e=slug(enq)||"ENQUIRY",t=slug(ticket)||"ticketsize";
  const search=ch==="search";
  const campaign=search?`${e}-${strat}`:`${e}-${SEGMENT}-${strat}`;
  return {campaign,
    adgroup: search?`${campaign}-${t}-${mt}`:`${campaign}-${t}`,
    strategy: search?`${strat}-${mt}`:`${SEGMENT}-${strat}`};
}
function assemble(lp,tplRaw,n){
  const hasQ=lp.includes("?"), tail=tplRaw.replace("{lpurl}","").replace(/^&/,"");
  const joiner=hasQ?"&":"?";
  const parts=tail.split("&").map(p=>{
    const i=p.indexOf("="),k=p.slice(0,i),raw=p.slice(i+1);
    let kind="static",val=raw;
    if(raw.startsWith("{_")){kind="custom";
      val=raw==="{_adgroup}"?n.adgroup:raw==="{_campaign}"?n.campaign:raw==="{_strategy}"?n.strategy:raw;}
    else if(raw.startsWith("{")){kind="valuetrack";val=VT[raw.slice(1,-1)]??raw;}
    return {k,raw,val,kind};});
  return {parts,hasQ,testUrl:lp+joiner+parts.map(p=>`${p.k}=${encodeURIComponent(p.val)}`).join("&")};
}

/* ═══ build the variant matrix ═══ */
function build(){
  const lp=$("#inLp").value.trim(), enq=$("#inEnq").value.trim(), ticket=$("#inTicket").value.trim();
  const strats=[...$("#inStrat").selectedOptions].map(o=>o.value);
  const mts=CH==="search"?[...$("#inMatch").selectedOptions].map(o=>o.value):[""];
  $("#outTpl").textContent=TPL[CH];

  VARIANTS=[];
  if(enq&&strats.length){
    strats.forEach(s=>mts.forEach(mt=>{
      const n=names(enq,s,ticket,mt,CH);
      const a=lp?assemble(lp,TPL[CH],n):null;
      VARIANTS.push({enq,strat:s,mt,ch:CH,lp,names:n,parts:a?a.parts:[],testUrl:a?a.testUrl:"",hasQ:a?a.hasQ:false});
    }));
  }
  if(PICK>=VARIANTS.length)PICK=0;
  $("#cntVar").textContent=VARIANTS.length;
  $("#varHint").textContent=VARIANTS.length
    ? `${strats.length} strateg${strats.length===1?"y":"ies"}${CH==="search"?` × ${mts.length} match type${mts.length===1?"":"s"}`:""} = ${VARIANTS.length}`
    : "—";

  const tb=$("#tblVar").querySelector("tbody");
  tb.innerHTML=VARIANTS.length
    ? VARIANTS.map((v,i)=>`<tr class="pick${i===PICK?" sel":""}" data-i="${i}">
        <td style="padding-left:16px" class="m">${i+1}</td>
        <td class="m">${esc(v.names.campaign)}</td>
        <td class="m">${esc(v.names.adgroup)}</td>
        <td class="m">${esc(v.names.strategy)}</td>
        <td class="right" style="padding-right:16px">
          ${v.testUrl?`<button class="btn btn-sm" data-copytext="${esc(v.testUrl)}">Copy</button>
          <button class="btn btn-sm" data-open="${i}">Open</button>`:`<span class="pill p-mute">no LP</span>`}
        </td></tr>`).join("")
    : `<tr><td colspan="5"><div class="empty">Enter an enquiry name and pick at least one strategy.</div></td></tr>`;

  renderCP(); renderAnat(); renderChecks(); renderQueue(); renderPayload(); previewIdentity();
}
$("#tblVar").addEventListener("click",e=>{
  const o=e.target.closest("[data-open]"); if(o){window.open(VARIANTS[+o.dataset.open].testUrl,"_blank","noopener");return;}
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
  tb.innerHTML=[["{_adgroup}",v.names.adgroup],["{_campaign}",v.names.campaign],["{_strategy}",v.names.strategy]]
    .map(([p,val])=>`<tr>
      <td><span class="param-name">${esc(p)}</span></td>
      <td class="m" style="font-size:12.5px">${esc(val)}</td>
      <td class="right"><span class="count${val.length>250?" bad":""}">${val.length}/250</span>
        <button class="btn btn-sm" style="margin-left:8px" data-copytext="${esc(val)}">Copy</button></td></tr>`).join("");
}
function renderAnat(){
  const v=VARIANTS[PICK];
  if(!v||!v.testUrl){$("#anatBase").textContent="—";$("#anatList").innerHTML="";$("#anatWho").textContent="select a variant";return;}
  $("#anatWho").textContent=v.names.strategy;
  $("#anatBase").textContent=v.lp;
  $("#anatList").innerHTML=v.parts.map(p=>`<div class="anat-row k-${p.kind}">
    <span class="dot"></span><span class="anat-k">${esc(p.k)}</span><span class="anat-v">${esc(p.val)}</span></div>`).join("");
}

function renderChecks(){
  const lp=$("#inLp").value.trim(), enq=$("#inEnq").value.trim(), c=[];
  const add=(l,ic,h)=>c.push(`<div class="check c-${l}"><span class="ic">${ic}</span><span>${h}</span></div>`);
  let u=null; try{u=new URL(lp);}catch(e){}

  if(!lp) add("bad","✕","<b>No landing page URL.</b> Variants are named but no test URL can be built.");
  else if(!u) add("bad","✕","<b>Landing page URL is not valid.</b> It needs a scheme — <code>https://…</code>.");
  else if(u.protocol!=="https:") add("bad","✕","<b>Not HTTPS.</b> Google Ads rejects insecure final URLs.");
  else add("ok","✓","Landing page URL parses and is HTTPS.");

  if(!enq) add("bad","✕","<b>No enquiry name.</b>");
  else if(slug(enq)!==enq.replace(/\s+/g,"-"))
    add("warn","!",`Enquiry name cleaned to <code>${esc(slug(enq))}</code>. Confirm the CRM enquiry matches exactly.`);
  else add("ok","✓","Enquiry name is clean — no characters that break a query string.");

  if(VARIANTS.length){
    if(!VARIANTS[0].hasQ&&lp) add("warn","!","Landing page has no query string, so the template's leading <code>&amp;</code> becomes <code>?</code>. <b>Google does the same substitution</b> — the sheet template is safe as written.");
    else if(lp) add("ok","✓","Landing page already carries a query string; the leading <code>&amp;</code> is correct.");

    if(u){
      const own=[...new URLSearchParams(u.search).keys()];
      const dup=own.filter(k=>VARIANTS[0].parts.some(p=>p.k.toLowerCase()===k.toLowerCase()));
      if(dup.length) add("bad","✕",`<b>Duplicate parameters:</b> <code>${esc(dup.join(", "))}</code> exist on the landing page and the template adds them again.`);
      else add("ok","✓","No parameter collides with the landing page's own query string.");
    }
    const over=VARIANTS.filter(v=>v.names.adgroup.length>250||v.names.campaign.length>250);
    if(over.length) add("bad","✕",`<b>${over.length} variant(s) exceed the 250-character custom-parameter limit.</b>`);
    add("ok","✓",`<b>${VARIANTS.length} variant${VARIANTS.length===1?"":"s"}</b> ready — one test lead each.`);
  }
  if(TPL[CH].includes("ads_id=TBD")) add("warn","!","<code>ads_id</code> is still <code>TBD</code> in the sheet template. Replace it with the real account identifier before this goes live.");

  $("#checks").innerHTML=c.join("");
}

$("#btnCPtsv").addEventListener("click",()=>{
  const v=VARIANTS[PICK]; if(!v)return toast("No variant selected");
  copy(`{_adgroup}\t${v.names.adgroup}\n{_campaign}\t${v.names.campaign}\n{_strategy}\t${v.names.strategy}`);
});
$("#btnCPall").addEventListener("click",()=>{
  if(!VARIANTS.length)return toast("Nothing to copy");
  copy(VARIANTS.map(v=>`${v.names.strategy}\n  {_adgroup}\t${v.names.adgroup}\n  {_campaign}\t${v.names.campaign}\n  {_strategy}\t${v.names.strategy}`).join("\n\n"));
});
$("#btnCsvVar").addEventListener("click",()=>{
  if(!VARIANTS.length)return toast("Nothing to export");
  dl("utm-variants.csv","campaign,adgroup,strategy,test_url\n"+
    VARIANTS.map(v=>[v.names.campaign,v.names.adgroup,v.names.strategy,v.testUrl].map(csvq).join(",")).join("\n"));
});
$("#btnCopyVar").addEventListener("click",()=>{
  if(!VARIANTS.length)return toast("Nothing to copy");
  copy("campaign\tadgroup\tstrategy\ttest_url\n"+
    VARIANTS.map(v=>[v.names.campaign,v.names.adgroup,v.names.strategy,v.testUrl].join("\t")).join("\n"));
});
$("#btnToLead").addEventListener("click",()=>{if(!VARIANTS.length)return toast("Build variants first");goTab("p-lead");});
["inLp","inEnq","inStrat","inTicket","inMatch"].forEach(id=>{
  $("#"+id).addEventListener("input",build);$("#"+id).addEventListener("change",build);});

/* ═══ test identity ═══ */
function seq(){ return store.get("pp_utm_seq", null) ?? ($("#tlSeq").value.trim()||"0000001"); }
function phoneAt(offset){
  const pfx=($("#tlPfx").value.trim()||"981").replace(/\D/g,"");
  const width=Math.max(1,10-pfx.length);
  const n=(parseInt(seq(),10)||1)+offset;
  return pfx+String(n).padStart(width,"0").slice(-width);
}
function bumpSeq(by){
  const n=(parseInt(seq(),10)||1)+by;
  store.set("pp_utm_seq",String(n)); $("#tlSeq").value=String(n).padStart(7,"0"); previewIdentity();
}
const fill=(s,bag)=>String(s).replace(/\{\{(\w+)\}\}/g,(m,k)=>k in bag?bag[k]:m);

function bagFor(i){
  const v=VARIANTS[i]||{names:{campaign:"",adgroup:"",strategy:""},parts:[],lp:"",testUrl:"",enq:""};
  const phone=phoneAt(i);
  const bag={
    campaign:v.names.campaign, adgroup:v.names.adgroup, strategy:v.names.strategy,
    enquiry:slug(v.enq||$("#inEnq").value), lpurl:v.lp, testurl:v.testUrl,
    phone, cc:$("#tlCc").value.trim()||"+91", ts:new Date().toISOString()
  };
  bag.name=fill($("#tlName").value||"Test {{campaign}}",bag);
  bag.email=fill($("#tlEmail").value||"test.{{phone}}@propertypistol.com",bag);
  v.parts.forEach(p=>{bag[p.k]=p.val;});
  return bag;
}
function previewIdentity(){
  const b=bagFor(0);
  $("#egName").textContent=b.name||"Test …";
  $("#egPhone").textContent=b.phone;
  $("#egPfx").textContent=($("#tlPfx").value.trim()||"981");
  const ok=/^[6-9]\d{9}$/.test(b.phone);
  $("#phoneWarn").innerHTML=ok?`<span class="pill p-ok" style="margin-left:6px">valid 10-digit</span>`
    :`<span class="pill p-bad" style="margin-left:6px">${b.phone.length} digits — CRM will reject</span>`;
}
["tlName","tlPfx","tlSeq","tlCc","tlEmail"].forEach(id=>
  $("#"+id).addEventListener("input",()=>{ if(id==="tlSeq")store.set("pp_utm_seq",$("#tlSeq").value.trim());
    previewIdentity();renderQueue();renderPayload();}));
$("#tokenList").textContent="{{name}} {{phone}} {{cc}} {{email}} {{campaign}} {{adgroup}} {{strategy}} {{enquiry}} {{lpurl}} {{testurl}} {{ts}} — plus every URL parameter: {{source_key}} {{utm_source}} {{utm_medium}} {{utm_campaign}} {{campaign_name}} {{ads_set_name}} {{ad_strategy}} {{Keyword}} {{Device}} {{campaign_id}} {{ads_group_id}} {{keyword_type}} {{physical_location}} {{ads_id}}";

/* ═══ queue ═══ */
function renderQueue(){
  const tb=$("#tblQueue").querySelector("tbody");
  $("#queueHint").textContent=`${VARIANTS.length} lead${VARIANTS.length===1?"":"s"}`;
  tb.innerHTML=VARIANTS.length
    ? VARIANTS.map((v,i)=>{const b=bagFor(i);return `<tr data-q="${i}">
        <td style="padding-left:16px" class="m">${i+1}</td>
        <td class="m">${esc(b.name)}</td><td class="m">${esc(b.phone)}</td>
        <td class="m">${esc(v.names.strategy)}</td>
        <td class="right" style="padding-right:16px"><span class="pill p-mute" data-st="${i}">Queued</span></td></tr>`;}).join("")
    : `<tr><td colspan="5"><div class="empty">Build variants on tab 01 first.</div></td></tr>`;
}
const setSt=(i,txt,cls)=>{const el=document.querySelector(`[data-st="${i}"]`); if(el){el.textContent=txt;el.className="pill "+cls;}};

/* ═══ cURL import ═══ */
function parseCurl(src){
  const out={url:"",method:"",headers:{},body:""},toks=[];let i=0;
  while(i<src.length){const c=src[i];
    if(c==="'"||c==='"'){const q=c;let j=i+1,s="";while(j<src.length&&src[j]!==q){if(src[j]==="\\"&&src[j+1]===q){s+=q;j+=2;continue;}s+=src[j++];}toks.push(s);i=j+1;}
    else if(/\s/.test(c))i++;
    else if(c==="\\"&&/\s/.test(src[i+1]||""))i+=2;
    else{let j=i,s="";while(j<src.length&&!/\s/.test(src[j]))s+=src[j++];toks.push(s);i=j;}}
  for(let k=0;k<toks.length;k++){const t=toks[k];
    if(t==="curl")continue;
    if(t==="-X"||t==="--request"){out.method=(toks[++k]||"").toUpperCase();continue;}
    if(t==="-H"||t==="--header"){const h=toks[++k]||"",p=h.indexOf(":");if(p>0)out.headers[h.slice(0,p).trim().toLowerCase()]=h.slice(p+1).trim();continue;}
    if(["-d","--data","--data-raw","--data-binary","--data-urlencode"].includes(t)){out.body+=(out.body?"&":"")+(toks[++k]||"");continue;}
    if(t.startsWith("-")){if(["-b","--cookie","-A","--user-agent","-e","--referer","-u","--user"].includes(t))k++;continue;}
    if(!out.url&&/^https?:\/\//.test(t))out.url=t;}
  if(!out.method)out.method=out.body?"POST":"GET";
  const ct=(out.headers["content-type"]||"").toLowerCase();
  out.type=(ct.includes("json")||/^\s*[\{\[]/.test(out.body))?"json":"form";
  out.fields=[];
  if(out.type==="json"){try{const o=JSON.parse(out.body);
    Object.entries(o).forEach(([k,v])=>out.fields.push([k,typeof v==="object"?JSON.stringify(v):String(v)]));}catch(e){out.type="form";}}
  if(out.type==="form"&&out.body)out.body.split("&").forEach(p=>{if(!p)return;const i=p.indexOf("=");
    out.fields.push([decodeURIComponent(p.slice(0,i<0?p.length:i).replace(/\+/g," ")),
                     i<0?"":decodeURIComponent(p.slice(i+1).replace(/\+/g," "))]);});
  if(out.method==="GET"&&out.url.includes("?")){try{new URL(out.url).searchParams.forEach((v,k)=>out.fields.push([k,v]));
    out.url=out.url.split("?")[0];}catch(e){}}
  return out;
}
const GUESS=[
  [/^(full_?)?name$|^customer_?name$|^lead_?name$|^fname$/i,"{{name}}"],
  [/phone|mobile|contact_?no|msisdn/i,"{{phone}}"],[/email|mail/i,"{{email}}"],
  [/source_?key/i,"{{source_key}}"],[/utm_?source/i,"{{utm_source}}"],
  [/utm_?medium/i,"{{utm_medium}}"],[/utm_?campaign/i,"{{utm_campaign}}"],
  [/campaign_?name/i,"{{campaign}}"],[/ads?_?set_?name|adgroup_?name/i,"{{adgroup}}"],
  [/ad_?strategy/i,"{{strategy}}"],[/^keyword$/i,"{{Keyword}}"],[/device/i,"{{Device}}"],
  [/campaign_?id/i,"{{campaign_id}}"],[/ads?_?group_?id/i,"{{ads_group_id}}"],
  [/keyword_?type|match/i,"{{keyword_type}}"],[/physical_?location|loc/i,"{{physical_location}}"],
  [/remark|message|comment|note|query/i,"Tracking QA — {{strategy}}"],
  [/project|enquiry/i,"{{enquiry}}"],[/page_?url|landing|referrer|source_?url/i,"{{testurl}}"]];
const guess=(k,v)=>{for(const[re,t]of GUESS)if(re.test(k))return t;return v||"";};

$("#btnParseCurl").addEventListener("click",()=>{
  const s=$("#curlIn").value.trim(); if(!s)return toast("Paste a cURL command first");
  const p=parseCurl(s); if(!p.url)return toast("Couldn't find a URL in that");
  $("#epUrl").value=p.url;$("#epMethod").value=p.method==="GET"?"GET":"POST";$("#epType").value=p.type;
  FIELDS=p.fields.map(([k,v])=>[k,guess(k,v)]);renderFields();toast(`Imported ${FIELDS.length} fields`);
});
$("#btnClearCurl").addEventListener("click",()=>{$("#curlIn").value="";});

function renderFields(){
  const tb=$("#tblFields").querySelector("tbody");
  tb.innerHTML=(FIELDS&&FIELDS.length)
    ? FIELDS.map(([k,v],i)=>`<tr>
        <td><input type="text" data-fk="${i}" value="${esc(k)}"></td>
        <td><input type="text" data-fv="${i}" value="${esc(v)}"></td>
        <td class="right"><button class="btn btn-sm" data-fx="${i}">✕</button></td></tr>`).join("")
    : `<tr><td colspan="3"><div class="empty">Paste a cURL command above, or add fields by hand.</div></td></tr>`;
  store.set("pp_utm_fields",FIELDS);renderPayload();
}
$("#tblFields").addEventListener("input",e=>{
  const k=e.target.dataset.fk,v=e.target.dataset.fv;
  if(k!==undefined)FIELDS[+k][0]=e.target.value;
  if(v!==undefined)FIELDS[+v][1]=e.target.value;
  store.set("pp_utm_fields",FIELDS);renderPayload();});
$("#tblFields").addEventListener("click",e=>{const x=e.target.dataset.fx;if(x===undefined)return;
  FIELDS.splice(+x,1);renderFields();});
$("#btnAddField").addEventListener("click",()=>{FIELDS=FIELDS||[];FIELDS.push(["",""]);renderFields();});
$("#btnAutoTrack").addEventListener("click",()=>{
  FIELDS=FIELDS||[];
  [["name","{{name}}"],["mobile","{{phone}}"],["email","{{email}}"],
   ["source_key","{{source_key}}"],["utm_source","{{utm_source}}"],["utm_medium","{{utm_medium}}"],
   ["utm_campaign","{{utm_campaign}}"],["campaign_name","{{campaign}}"],["ads_set_name","{{adgroup}}"],
   ["ad_strategy","{{strategy}}"],["campaign_id","{{campaign_id}}"],["ads_group_id","{{ads_group_id}}"],
   ["ads_id","{{ads_id}}"],["Keyword","{{Keyword}}"],["Device","{{Device}}"],
   ["keyword_type","{{keyword_type}}"],["physical_location","{{physical_location}}"]]
   .forEach(([k,v])=>{if(!FIELDS.some(f=>f[0].toLowerCase()===k.toLowerCase()))FIELDS.push([k,v]);});
  renderFields();toast("Tracking fields added");});

/* ═══ payload + fire ═══ */
const payloadRows=bag=>(FIELDS||[]).filter(f=>f[0]).map(([k,v])=>[k,fill(v,bag)]);
function leadUrl(i){
  const base=$("#epUrl").value.trim(); if(!base)return "";
  const q=payloadRows(bagFor(i)).map(([k,v])=>`${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&");
  return base+(base.includes("?")?"&":"?")+q;
}
function renderPayload(){
  const rows=payloadRows(bagFor(0));
  $("#payloadOut").textContent=!rows.length?"No fields mapped yet."
    :($("#epType").value==="json"?JSON.stringify(Object.fromEntries(rows),null,2):rows.map(([k,v])=>`${k}=${v}`).join("\n"));
  const isGet=$("#epMethod").value==="GET";
  $("#cardGet").classList.toggle("hidden",!isGet);
  $("#epType").disabled=isGet;
  if(isGet){
    const list=VARIANTS.map((_,i)=>leadUrl(i)).filter(Boolean);
    $("#getUrls").textContent=list.length?list.join("\n\n"):"Add the endpoint URL and map at least one field.";
  }
}
document.addEventListener("DOMContentLoaded",()=>{});
["epUrl","epMethod","epType"].forEach(id=>{
  $("#"+id).addEventListener("input",renderPayload);$("#"+id).addEventListener("change",renderPayload);});

function submit(rows,i){
  const url=$("#epUrl").value.trim(),method=$("#epMethod").value,type=$("#epType").value;
  if(type==="json"){
    const body=JSON.stringify(Object.fromEntries(rows));
    return fetch(url,{method,headers:{"Content-Type":"application/json"},body})
      .then(r=>r.ok?"Accepted "+r.status:"Rejected "+r.status)
      .catch(()=>fetch(url,{method,mode:"no-cors",headers:{"Content-Type":"text/plain"},body})
        .then(()=>"Sent").catch(()=>"Failed"));
  }
  const f=document.createElement("form");
  f.method=method;f.action=url;f.target="pp_qa_sink";f.acceptCharset="UTF-8";f.style.display="none";
  rows.forEach(([k,v])=>{const inp=document.createElement("input");inp.type="hidden";inp.name=k;inp.value=v;f.appendChild(inp);});
  document.body.appendChild(f);
  try{f.submit();}catch(e){f.remove();return Promise.resolve("Failed");}
  setTimeout(()=>f.remove(),1500);
  return Promise.resolve("Sent");
}

/* ── cross-domain form driver (Chrome extension APIs) ──────
   Attribution is read from the referring URL, not the form body,
   so only a real navigation to the test URL produces the right
   Referer. The extension opens each test URL in a background tab,
   fills the page's own form and submits it. No hosting needed. */
const EXT = typeof chrome!=="undefined" && chrome.tabs && chrome.scripting;
function fmode(){const r=document.querySelector('input[name="fmode"]:checked');return r?r.value:"drive";}
function checkOrigin(){
  const el=$("#originState"), note=$("#originNote");
  if(EXT){
    el.innerHTML='<span class="pill p-ok">extension active</span>';
    note.innerHTML="Running as a Chrome extension — it can drive the form on <b>any</b> landing page domain. Nothing to host.";
    return true;
  }
  el.innerHTML='<span class="pill p-bad">not installed</span>';
  note.innerHTML="This page is open as a plain file, so it can't reach another domain's form. Load the folder in <code>chrome://extensions</code> → Developer mode → <b>Load unpacked</b>, then open the tool from the extension.";
  return false;
}
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function tabSettled(id,ignoreUrl,limitMs){
  const t0=Date.now();
  while(Date.now()-t0<limitMs){
    await wait(400);
    let t; try{t=await chrome.tabs.get(id);}catch(e){return null;}
    if(t.status==="complete" && t.url && t.url!==ignoreUrl && !t.url.startsWith("about:")) return t;
  }
  return null;
}
/* injected into the landing page — no outer scope available */
function pageFill(rows,sel){
  const form=(sel&&document.querySelector(sel))||document.querySelector("form");
  if(!form) return {ok:false,err:"No form"};
  let hit=0;
  for(const [k,v] of rows){
    const el=form.querySelector('[name="'+k+'"]');
    if(!el) continue;
    hit++;
    try{el.focus();}catch(e){}
    const setter=Object.getOwnPropertyDescriptor(el.constructor.prototype,"value");
    if(setter&&setter.set) setter.set.call(el,v); else el.value=v;
    el.dispatchEvent(new Event("input",{bubbles:true}));
    el.dispatchEvent(new Event("change",{bubbles:true}));
    el.dispatchEvent(new Event("blur",{bubbles:true}));
  }
  if(!hit) return {ok:false,err:"No fields"};
  setTimeout(()=>{const b=form.querySelector('[type="submit"]');if(b)b.click();else form.submit();},450);
  return {ok:true};
}
async function driveOne(i){
  if(!EXT) return "Not installed";
  const v=VARIANTS[i], bag=bagFor(i);
  const rows=(FIELDS||[]).filter(f=>f[0]).map(([k,t])=>[k,fill(t,bag)]);
  let tab=null;
  try{
    tab=await chrome.tabs.create({url:v.testUrl,active:false});
    const loaded=await tabSettled(tab.id,null,30000);
    if(!loaded) return "Timeout";
    const [res]=await chrome.scripting.executeScript({
      target:{tabId:tab.id}, func:pageFill, args:[rows,$("#dvForm").value.trim()||"form"]});
    if(!res||!res.result||!res.result.ok) return (res&&res.result&&res.result.err)||"Inject failed";
    const after=await tabSettled(tab.id,loaded.url,30000);
    if(!after) return "No redirect";
    const mode=$("#dvVerify").value, pname=$("#dvParam").value.trim()||"em";
    if(mode==="landed") return "Sent";
    let echoed=null; try{echoed=new URL(after.url).searchParams.get(pname);}catch(e){}
    if(echoed==null) return "Sent";
    let val=echoed;
    if(mode==="b64phone"){try{val=atob(echoed);}catch(e){}}
    return val.replace(/\D/g,"").endsWith(bag.phone)?"Verified":"Mismatch";
  }catch(e){ return "Failed"; }
  finally{ if(tab) try{await chrome.tabs.remove(tab.id);}catch(e){} }
}

async function fireRange(list){
  if(FIRING)return;
  const drive=fmode()==="drive";
  const url=$("#epUrl").value.trim();
  if(!VARIANTS.length)return toast("Build variants on tab 01 first");
  if(!(FIELDS||[]).some(f=>f[0]))return toast("Map at least one field");
  if(drive){
    if(!VARIANTS[0].testUrl)return toast("Add a landing page URL on tab 01");
    if(!checkOrigin())return toast("Load the folder as a Chrome extension first");
  } else if(!url) return toast("Add the endpoint URL");
  let host=drive?(()=>{try{return new URL(VARIANTS[0].lp).host;}catch(e){return VARIANTS[0].lp;}})():url;
  try{if(!drive)host=new URL(url).host;}catch(e){}
  if(!confirm(`Fire ${list.length} test lead${list.length===1?"":"s"} at ${host}?\n\nThese are real writes.`))return;

  FIRING=true;$("#btnFire").disabled=true;$("#btnFireOne").disabled=true;
  const gap=Math.max(0,parseInt($("#tlGap").value,10)||900);
  let done=0;
  for(const i of list){
    const bag=bagFor(i);
    setSt(i,"Sending…","p-live");
    const status=drive?await driveOne(i):await submit(payloadRows(bag),i);
    setSt(i,status,/Accepted|Verified/.test(status)?"p-ok"
      :/Failed|Rejected|Mismatch|Timeout|No form|No fields|No redirect|Inject|Not installed/.test(status)?"p-bad":"p-warn");
    LOG.unshift({time:new Date().toISOString(),name:bag.name,phone:bag.phone,
      campaign:bag.campaign,strategy:bag.strategy,status,url});
    done++;$("#fireBar").style.width=Math.round(done/list.length*100)+"%";
    if(done<list.length)await sleep(gap);
  }
  LOG=LOG.slice(0,800);store.set("pp_utm_log",LOG);renderLog();
  bumpSeq(list.length);renderQueue();
  FIRING=false;$("#btnFire").disabled=false;$("#btnFireOne").disabled=false;
  setTimeout(()=>$("#fireBar").style.width="0",1200);
  toast(`${list.length} test lead${list.length===1?"":"s"} fired — verify in CRM`);
}
$("#btnOpenAll").addEventListener("click",()=>{
  const list=VARIANTS.map((_,i)=>leadUrl(i)).filter(Boolean);
  if(!list.length)return toast("Nothing to open");
  if(!confirm(`Open ${list.length} tabs? Each one creates a real lead.`))return;
  list.forEach((u,i)=>setTimeout(()=>window.open(u,"_blank","noopener"),i*250));
});
$("#btnFire").addEventListener("click",()=>fireRange(VARIANTS.map((_,i)=>i)));
$("#btnFireOne").addEventListener("click",()=>fireRange([0]));

/* ═══ log ═══ */
function renderLog(){
  $("#logCount").textContent=`${LOG.length} run${LOG.length===1?"":"s"}`;
  const tb=$("#tblLog").querySelector("tbody");
  tb.innerHTML=LOG.length?LOG.map(r=>{
    const cls=/Accepted|Verified/.test(r.status)?"p-ok"
      :/Failed|Rejected|Mismatch|Timeout|No form|No fields|No redirect|Inject|Not installed/.test(r.status)?"p-bad":"p-warn";
    return `<tr><td class="m">${esc(new Date(r.time).toLocaleString())}</td>
      <td class="m">${esc(r.name)}</td><td class="m">${esc(r.phone)}</td>
      <td class="m">${esc(r.campaign)}</td><td class="m">${esc(r.strategy)}</td>
      <td class="right"><span class="pill ${cls}">${esc(r.status)}</span></td></tr>`;}).join("")
    :`<tr><td colspan="6"><div class="empty">No test leads fired yet.</div></td></tr>`;
}
$("#btnLogCsv").addEventListener("click",()=>{
  if(!LOG.length)return toast("Nothing to export");
  dl("test-lead-log.csv","time,name,phone,campaign,strategy,status,endpoint\n"+
    LOG.map(r=>[r.time,r.name,r.phone,r.campaign,r.strategy,r.status,r.url].map(csvq).join(",")).join("\n"));});
$("#btnLogClear").addEventListener("click",()=>{if(!LOG.length)return;
  LOG=[];store.set("pp_utm_log",LOG);renderLog();toast("Log cleared");});

document.addEventListener("click",e=>{
  const c=e.target.closest("[data-copy]");if(c)copy($("#"+c.dataset.copy).textContent);
  const t=e.target.closest("[data-copytext]");if(t)copy(t.dataset.copytext);});

/* ═══ mode wiring ═══ */
$$('input[name="fmode"]').forEach(r=>r.addEventListener("change",()=>{
  const drive=fmode()==="drive";
  $("#mcDrive").dataset.on=drive?"1":"0"; $("#mcPost").dataset.on=drive?"0":"1";
  $("#cardDrive").classList.toggle("hidden",!drive);
  $("#cardGet").classList.add("hidden");
  $("#epUrl").closest(".card").classList.toggle("hidden",drive);
  $("#payloadOut").closest(".card").classList.toggle("hidden",drive);
  checkOrigin(); renderPayload();
}));

/* ═══ boot ═══ */
const savedSeq=store.get("pp_utm_seq",null); if(savedSeq)$("#tlSeq").value=String(savedSeq).padStart(7,"0");
renderFields();renderLog();build();
$("#epUrl").closest(".card").classList.add("hidden");
$("#payloadOut").closest(".card").classList.add("hidden");
checkOrigin();
