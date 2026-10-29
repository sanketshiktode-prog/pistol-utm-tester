/* ═══════════ the boot queue ═══════════
   This file used to be one script, where every function declaration was
   hoisted above every line that called it. Split across files that is no
   longer true: a call at the top level of an early file cannot see a
   function declared in a later one, and the failure is silent when it sits
   inside a try/catch.

   So load-time work is queued and run after the last file, in the order it
   was queued. Anything reaching across files belongs here. */
const BOOT = [];
const onBoot = fn => BOOT.push(fn);
function runBoot(){
  while (BOOT.length) {
    const fn = BOOT.shift();
    try { fn(); } catch (e) { console.error('boot step failed:', e); }
  }
}


/* ═══ tracking templates from the sheet ═══ */
const TPL={
 search:"{lpurl}&source_key=Website&utm_source=Website&utm_medium=ppmcc&utm_campaign=google-search&Keyword={keyword}&Device={device}&ads_id=TBD&ads_group_id={adgroupid}&ads_extension_id={extensionid}&ads_set_name={_adgroup}&campaign_id={campaignid}&campaign_name={_campaign}&keyword_type={matchtype}&physical_location={loc_physical_ms}&ad_strategy={_strategy}",
 demandgen:"{lpurl}&source_key=google-discovery&utm_source=google-discovery&utm_medium=ppmcc&utm_campaign=google-discovery&Keyword={keyword}&Device={device}&ads_id=TBD&ads_group_id={adgroupid}&ads_extension_id={extensionid}&ads_set_name={_adgroup}&campaign_id={campaignid}&campaign_name={_campaign}&keyword_type={matchtype}&physical_location={loc_physical_ms}&ad_strategy={_strategy}"};

const CHANNEL={search:{full:"Search",short:"S"},demandgen:{full:"Demand Gen",short:"D"}};
const DEFAULTS={
 search:[["Search Brand Location","BL"],["Search Brand Project Location","BPL"],["Search Brand Broad","BB"]],
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
/* Binds only if the element is there — a missing node warns instead of
   halting the script and silently killing every listener after it. */
const BOUND=new Set();
function on(sel,ev,fn){
  const e=$(sel);
  if(e){ e.addEventListener(ev,fn); if(e.id)BOUND.add(e.id); e.__bound=true; }
  else console.warn("missing element",sel);
}
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const slug=s=>String(s||"").trim().replace(/\s+/g,"-").replace(/[^A-Za-z0-9\-_.]/g,"").replace(/-{2,}/g,"-").replace(/^-|-$/g,"");
function toast(m){const t=$("#toast");t.textContent=m;t.classList.add("on");clearTimeout(t._t);t._t=setTimeout(()=>t.classList.remove("on"),1900);}
function fbCopy(x,cb){const ta=document.createElement("textarea");ta.value=x;ta.style.cssText="position:fixed;opacity:0";
  document.body.appendChild(ta);ta.select();try{document.execCommand("copy");cb();}catch(e){toast("Copy failed");}ta.remove();}
function copy(x){const d=()=>toast("Copied");
  if(navigator.clipboard&&window.isSecureContext)navigator.clipboard.writeText(x).then(d).catch(()=>fbCopy(x,d));else fbCopy(x,d);}
/* Two stores on purpose. Settings you configure once live in localStorage.
   Everything about the project you are working on lives in sessionStorage,
   so closing the tab leaves no residue for the next project to inherit. */
const store={get(k,d){try{const v=localStorage.getItem(k);return v?JSON.parse(v):d;}catch(e){return d;}},
             set(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}}};
const PROJECT_KEYS=["pp_proj","pp_adgroups","pp_adcur","pp_assets","pp_locmain","pp_localt","pp_campaign"];
const sess={get(k,d){try{const v=sessionStorage.getItem(k);return v?JSON.parse(v):d;}catch(e){return d;}},
            set(k,v){try{sessionStorage.setItem(k,JSON.stringify(v));}catch(e){}}};
function clearProject(){
  PROJECT_KEYS.forEach(k=>{try{sessionStorage.removeItem(k);localStorage.removeItem(k);}catch(e){}});
}

/* ═══════════ saved projects ═══════════
   Everything a project is made of lives across a handful of storage keys and
   a set of fields. A save copies all of it under a name; opening one puts it
   back and reloads, so every panel redraws from the restored state rather
   than being patched up in place.

   The uploaded images are deliberately NOT saved. A hero render is several
   megabytes and localStorage holds about five in total, so one project would
   fill it and every later save would fail silently. They are re-chosen. */
const PROJ_STORE="pp_projects";
const SAVE_FIELDS=["inLp","inEnq","acUrl","acProj","acDev","acMicro","acCity","acCfg","acPrice",
  "acOffer","acUsps","acAmen","acMarks","acPriceMode","acAllIn","acP1","acP2","acLoc",
  "tkA","tkB","locMain","locAlt","cgLoc","cgLocId","cgBudget","cgCpc","cgStatus","cgBid",
  "cgPresence","cgEuPol","cgGoals","apCid","apLocIds","negExtra","negLists",
  "asBizName","csKw","csUrl","csYt","csApp","audSources","crDev","crProj","crLoc","crCfg",
  "crPrice","crOffer","crRera","crDisc","crAccent","crScrim","crLayout","kwRaw","kwCamp","kwAdg"];
const projects=()=>store.get(PROJ_STORE,{})||{};

/* ═══════════ the pictures a project is made of ═══════════
   Hero photographs and rendered creatives are megabytes, and localStorage
   gives about five for everything. So a saved project used to carry the
   brief, the keywords and the copy, and then said "the images are not
   saved, choose them again" — which meant opening a project a week later
   began by hunting for the same photographs.

   They live in IndexedDB instead, which has no such ceiling, keyed by the
   project's name. The brief still goes to localStorage: it is small, it is
   read synchronously all over the page, and it is what has to survive even
   if the pictures cannot be written. */
const ASSET_DB="pp-trigger", ASSET_STORE="projectAssets";
const AssetDB={
  _open(){
    return new Promise((res,rej)=>{
      let rq; try{ rq=indexedDB.open(ASSET_DB,1); }catch(e){ return rej(e); }
      rq.onupgradeneeded=()=>{ const db=rq.result;
        if(!db.objectStoreNames.contains(ASSET_STORE))db.createObjectStore(ASSET_STORE); };
      rq.onsuccess=()=>res(rq.result);
      rq.onerror=()=>rej(rq.error||new Error("IndexedDB refused to open"));
      setTimeout(()=>rej(new Error("IndexedDB did not answer")),8000);
    });
  },
  async put(name,value){
    const db=await this._open();
    return new Promise((res,rej)=>{
      const tx=db.transaction(ASSET_STORE,"readwrite");
      tx.objectStore(ASSET_STORE).put(value,name);
      tx.oncomplete=()=>res(true);
      tx.onerror=()=>rej(tx.error||new Error("could not write"));
      tx.onabort=()=>rej(tx.error||new Error("the write was refused — disk or quota"));
    });
  },
  async get(name){
    const db=await this._open();
    return new Promise((res,rej)=>{
      const rq=db.transaction(ASSET_STORE,"readonly").objectStore(ASSET_STORE).get(name);
      rq.onsuccess=()=>res(rq.result||null);
      rq.onerror=()=>rej(rq.error||new Error("could not read"));
    });
  },
  async del(name){
    const db=await this._open();
    return new Promise(res=>{
      const tx=db.transaction(ASSET_STORE,"readwrite");
      tx.objectStore(ASSET_STORE).delete(name);
      tx.oncomplete=()=>res(true); tx.onerror=()=>res(false); tx.onabort=()=>res(false);
    });
  }
};

/* What is worth keeping, and what is cheap to rebuild. The hero photographs
   are irreplaceable — they came off somebody's desktop. The renders are
   derived from them, but re-rendering costs a click and a wait, so they are
   kept too. CR_OUT is rebuilt from the sets on the way back in rather than
   stored twice. */
function assetSnapshot(){
  const heroes=(typeof HEROES!=="undefined"?HEROES:[])
    .map(h=>({name:h.name, src:(h.img&&h.img.src)||""}))
    .filter(h=>h.src.indexOf("data:")===0);
  const sets=(typeof CR_SETS!=="undefined"?CR_SETS:[]);
  return heroes.length||sets.length ? {heroes, sets, saved:Date.now()} : null;
}
const loadImg=src=>new Promise(res=>{
  const im=new Image();
  im.onload=()=>res(im); im.onerror=()=>res(null);
  im.src=src;
});
async function assetApply(a){
  if(!a)return 0;
  if(typeof HEROES==="undefined")return 0;
  HEROES.length=0;
  for(const h of (a.heroes||[])){
    const im=await loadImg(h.src);
    if(im)HEROES.push({name:h.name,img:im});
  }
  if(typeof CR_SETS!=="undefined"){ CR_SETS.length=0; (a.sets||[]).forEach(s=>CR_SETS.push(s)); }
  /* the gallery reads CR_OUT, which is the same pictures flattened */
  if(typeof CR_OUT!=="undefined"){
    CR_OUT.length=0;
    (a.sets||[]).forEach(s=>{
      (s.sizes||[]).forEach(nm=>{
        const im=s.images&&s.images[nm];
        if(im&&im.data)CR_OUT.push({name:nm,url:"data:image/jpeg;base64,"+im.data,
          hero:s.name,k:CR_OUT.length,w:0,h:0,ratio:"",bytes:Math.round(im.data.length*3/4)});
      });
    });
  }
  return HEROES.length;
}
function projectSnapshot(){
  const f={};
  SAVE_FIELDS.forEach(id=>{ const el=$("#"+id); if(el)f[id]=el.value; });
  const multi={};
  ["inStrat","inMatch","audPick"].forEach(id=>{
    const el=$("#"+id);
    if(el&&el.multiple)multi[id]=[...el.selectedOptions].map(o=>o.value);
  });
  const checks={};
  $$("input[type=checkbox][id]").forEach(el=>{ checks[el.id]=el.checked; });
  const keys={};
  PROJECT_KEYS.forEach(k=>{
    const v=sessionStorage.getItem(k)||localStorage.getItem(k);
    if(v!==null)keys[k]=v;
  });
  return {saved:Date.now(), channel:CH, fields:f, multi, checks, keys};
}
function projectApply(p,name){
  if(!p)return;
  if(name)p=Object.assign({},p,{name});
  PROJECT_KEYS.forEach(k=>{try{sessionStorage.removeItem(k);localStorage.removeItem(k);}catch(e){}});
  Object.keys(p.keys||{}).forEach(k=>{try{sessionStorage.setItem(k,p.keys[k]);}catch(e){}});
  try{sessionStorage.setItem("pp_restore",JSON.stringify(p));}catch(e){}
  location.reload();
}
/* applied after the page has built itself, so nothing overwrites it */
function projectRestore(){
  let p=null;
  try{ const raw=sessionStorage.getItem("pp_restore");
       if(raw){ p=JSON.parse(raw); sessionStorage.removeItem("pp_restore"); } }catch(e){}
  if(!p)return;
  if(p.channel&&p.channel!==CH){
    const b=$(`#segChannel button[data-ch="${p.channel}"]`); if(b)b.click();
  }
  Object.keys(p.fields||{}).forEach(id=>{
    const el=$("#"+id); if(!el)return;
    el.value=p.fields[id];
    el.dispatchEvent(new Event("input",{bubbles:true}));
    el.dispatchEvent(new Event("change",{bubbles:true}));
  });
  Object.keys(p.multi||{}).forEach(id=>{
    const el=$("#"+id); if(!el)return;
    [...el.options].forEach(o=>o.selected=p.multi[id].indexOf(o.value)>-1);
    el.dispatchEvent(new Event("change",{bubbles:true}));
  });
  Object.keys(p.checks||{}).forEach(id=>{
    const el=$("#"+id); if(!el||el.type!=="checkbox")return;
    if(el.checked!==p.checks[id]){ el.checked=p.checks[id];
      el.dispatchEvent(new Event("change",{bubbles:true})); }
  });
  /* PLAN is derived, not stored. Rebuilding it from the restored brief also
     merges the ad copy and keyword edits that came back in pp_adgroups, so
     the project opens with the structure it was saved with. */
  if(($("#acProj")&&$("#acProj").value.trim())||($("#inEnq")&&$("#inEnq").value.trim())){
    const b=$("#stBuild"); if(b)setTimeout(()=>b.click(),60);
  }
  if(!p.name||!p.hasAssets)return toast("Project opened");
  toast("Project opened \u2014 fetching its images\u2026");
  AssetDB.get(p.name).then(async a=>{
    const n=await assetApply(a);
    if(!n)return toast("Project opened \u2014 its images could not be read, choose them again",7000);
    if(typeof drawHeroes==="function")drawHeroes();
    if(typeof drawSets==="function")drawSets();
    if(typeof crShowSaved==="function")crShowSaved();
    toast(`Project opened with ${n} hero image${n===1?"":"s"}`);
  }).catch(()=>toast("Project opened \u2014 its images could not be read, choose them again",7000));
}
function drawProjects(){
  const sel=$("#projPick"); if(!sel)return;
  const all=projects();
  const names=Object.keys(all).sort((a,b2)=>(all[b2].saved||0)-(all[a].saved||0));
  sel.innerHTML=`<option value="">\u2014 saved projects \u2014</option>`+
    names.map(n=>`<option value="${esc(n)}">${esc(n)}</option>`).join("")+
    (names.length?`<option value="__del">Delete a saved project\u2026</option>`:"");
}
const csvq=v=>`"${String(v??"").replace(/"/g,'""')}"`;

/* ── copy helpers, declared before anything calls them ── */
const ABBR=[[/\bApartments\b/gi,"Apts"],[/\bMinutes\b/gi,"Mins"],[/\bBedroom\b/gi,"BR"],
  [/\band\b/g,"&"],[/\bAnd\b/g,"&"],[/\bWith\b/gi,"With"],[/\s{2,}/g," "]];
/* A token here is a run of word characters, not a run of non-spaces: with
   the latter, "Vadgaon,Pune" is one token and only the V is lifted, which is
   how "Vadgaon, pune" reached a headline. */
const tc=s=>String(s||"").trim().replace(/\s+/g," ")
  .replace(/[A-Za-z\u00C0-\u024F][A-Za-z\u00C0-\u024F']*/g,
           w=>w[0].toUpperCase()+w.slice(1));
function fit(s,max){
  s=String(s||"").replace(/\s+/g," ").trim();
  if(!s)return null;
  if(s.length<=max)return s;
  let t=s; for(const [re,rep] of ABBR){ t=t.replace(re,rep); if(t.length<=max)return t.trim(); }
  return null;
}
function pick(cands,max,n,used){
  const out=[];
  for(const c of cands){
    const f=fit(c,max); if(!f)continue;
    const k=f.toLowerCase(); if(used.has(k))continue;
    used.add(k); out.push(f); if(out.length>=n)break;
  }
  return out;
}
const lines=s=>String(s||"").split("\n").map(x=>x.trim()).filter(Boolean);
const FMAP={url:"acUrl",cfg:"acCfg",price:"acPrice",loc:"acLoc",p1:"acP1",p2:"acP2",
  proj:"acProj",dev:"acDev",micro:"acMicro",city:"acCity",offer:"acOffer",
  usps:"acUsps",marks:"acMarks",amen:"acAmen",priceMode:"acPriceMode",allIn:"acAllIn"};
/* Pull straight from the inputs every time. Nothing downstream can then
   run on a stale copy of the brief. */
function syncProj(){
  if(typeof PROJ==="undefined")return {};
  for(const k in FMAP){ const e=$("#"+FMAP[k]); if(e)PROJ[k]=e.value; }
  try{sess.set("pp_proj",PROJ);}catch(e){}
  return PROJ;
}
/* "Mahindra Lifespaces Mahalunge" + " Mahalunge" reads like a stutter.
   Nothing already inside the project name gets appended again. */
const hasWord=(s,t)=>{
  t=String(t||"").trim(); if(!t)return false;
  return new RegExp("\\b"+t.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")+"\\b","i").test(String(s||""));
};
const addPart=(base,part)=> part&&!hasWord(base,part) ? `${base} ${part}`.trim() : String(base||"").trim();
const withPlace=(base,place)=> place&&!hasWord(base,place) ? `${base}, ${place}` : String(base||"").trim();
function placeOf(b){
  return [b.micro,b.city].filter(Boolean).filter(x=>!hasWord(b.proj,x)).join(", ");
}
/* "Mahindra Lifespaces Mahalunge" + micro-market "Mahalunge" was producing
   "Mahindra Lifespaces Mahalunge Mahalunge". Any part whose words are
   already present is dropped. */
/* Phrases that must never reach ad copy, callouts or sitelinks, wherever
   they are generated from. Checked in one place so a preset or a template
   cannot smuggle one back in. */
const BANNED=[/brokerage/i,/hidden charge/i,/\bno hidden\b/i,/0%\s*commission/i,/zero commission/i];
const banned=t=>BANNED.some(re=>re.test(String(t||"")));
const scrub=list=>(list||[]).filter(t=>!banned(t));
/* "Pune, India" is still ambiguous enough for Editor to reach for a US
   match. The canonical City,State,Country form is what Google's own geo
   target list uses. */
const STATE_OF={
 "mumbai":"Maharashtra","navi mumbai":"Maharashtra","thane":"Maharashtra","pune":"Maharashtra",
 "nashik":"Maharashtra","nagpur":"Maharashtra","aurangabad":"Maharashtra",
 "bengaluru":"Karnataka","bangalore":"Karnataka","mysuru":"Karnataka",
 "hyderabad":"Telangana","secunderabad":"Telangana",
 "chennai":"Tamil Nadu","coimbatore":"Tamil Nadu",
 "lucknow":"Uttar Pradesh","noida":"Uttar Pradesh","greater noida":"Uttar Pradesh",
 "ghaziabad":"Uttar Pradesh","kanpur":"Uttar Pradesh",
 "gurugram":"Haryana","gurgaon":"Haryana","faridabad":"Haryana",
 "delhi":"Delhi","new delhi":"Delhi",
 "ahmedabad":"Gujarat","surat":"Gujarat","vadodara":"Gujarat","gandhinagar":"Gujarat","rajkot":"Gujarat",
 "kochi":"Kerala","cochin":"Kerala","thiruvananthapuram":"Kerala","kozhikode":"Kerala","thrissur":"Kerala",
 "jaipur":"Rajasthan","indore":"Madhya Pradesh","bhopal":"Madhya Pradesh",
 "kolkata":"West Bengal","chandigarh":"Chandigarh","goa":"Goa","panaji":"Goa"
};
function canonLocation(city){
  const c=String(city||"").trim(); if(!c)return "";
  if(c.includes(","))return c.replace(/\s*,\s*/g,",");
  if(typeof REGION!=="undefined"&&REGION==="ae"){
    const em=/abu dhabi/i.test(c)?"Abu Dhabi":/sharjah/i.test(c)?"Sharjah":"Dubai";
    return tc(c)+","+em+",United Arab Emirates";
  }
  const st=STATE_OF[c.toLowerCase()];
  return st?tc(c)+","+st+",India":tc(c)+",India";
}
function joinParts(){
  const out=[];
  [...arguments].filter(Boolean).forEach(p=>{
    const acc=out.join(" ").toLowerCase();
    const words=String(p).toLowerCase().split(/[\s,]+/).filter(Boolean);
    if(words.length&&words.every(w=>acc.includes(w)))return;
    out.push(String(p).trim());
  });
  return out.join(" ").replace(/\s{2,}/g," ").trim();
}
/* the location clause, minus anything the project name already says */
function placeOf(b){
  const proj=String(b.proj||"").toLowerCase();
  const out=[];
  [b.micro,b.city].filter(Boolean).forEach(x=>{
    const t=String(x).toLowerCase();
    if(proj.includes(t))return;
    /* "Vadgaon, Pune" typed into the micro-market already carries the city,
       and appending it again gave "Vadgaon, Pune, Pune" */
    if(out.some(y=>String(y).toLowerCase().split(/[\s,]+/).includes(t)))return;
    out.push(x);
  });
  return out.join(", ");
}
function brief(){
  const p=syncProj();
  if(isPrelaunch()){
    const dev=tc(p.dev)||tc(p.proj), loc=tc(p.micro)||tc(p.city);
    p.proj=[dev,loc].filter(Boolean).join(" ")||tc(p.proj);
  }
  const price=(p.price||"").trim();
  /* tidied here rather than at the end: what he sees on the Ad copy tab is
     then exactly what gets sent, and a comma typed without a space never
     reaches a headline in the first place */
  return {
    proj:tc(adText(p.proj))||"", dev:tc(adText(p.dev)),
    micro:tc(adText(p.micro)), city:tc(adText(p.city)),
    cfg:adText(p.cfg), price:adText(price), offer:tc(adText(p.offer)),
    loc:adText(p.loc),
    usps:lines(p.usps).map(adText), marks:lines(p.marks).map(adText),
    amen:lines(p.amen).map(adText)
  };
}
/* ── spacing ──────────────────────────────────────────────────────────────
   Google refuses an ad outright for this one. "UNACCEPTABLE_SPACING
   (PROHIBITED)" with the evidence ",Pune" and "Vadgaon,Pune": a comma with
   no space after it, and a leading comma left behind where the micro-market
   was empty. It is a PROHIBITED topic, so the whole campaign is rolled back
   with the ad — one missing space costs the entire deploy.

   Every string that ships as ad text goes through here. An Indian number
   keeps its commas ("1,70,000" must not become "1, 70, 000") and a colon is
   left alone ("30:70 payment plan"). */
function adText(s){
  let t=String(s||"").replace(/\s+/g," ").trim();
  t=t.replace(/\s+([,;.!?])/g,"$1");                 /* no space before punctuation */
  t=t.replace(/([,;])(?=\S)/g,function(m,p,off,str){
    /* 1,70,000 is a number and keeps its commas; 2,3 & 3.5 BHK is a list and
       wants the spaces. Indian grouping runs in 2s and 3s, so that is the
       test \u2014 a single digit after the comma means a list. */
    if(p===","&&/\d/.test(str[off-1]||"")&&/^\d{2,3}(?!\d)/.test(str.slice(off+1)))return p;
    return p+" ";
  });
  t=t.replace(/\.(?=[A-Za-z])/g,". ");
  t=t.replace(/,\s*(?=,)/g,"").replace(/\s{2,}/g," ");
  t=t.replace(/^[\s,;|–—-]+/,"").replace(/[\s,;|]+$/,"");
  return t.trim();
}
/* the same, for a whole ad: used as the last thing before anything is sent */
function adTextRows(rows){
  return (rows||[]).map(r=>Array.isArray(r)?[adText(r[0]),r[1]]:adText(r));
}
function compose(parts,max){
  const p=parts.map(x=>String(x||"").replace(/\s+/g," ").trim()).filter(Boolean);
  for(let n=p.length;n>0;n--){
    let s=p.slice(0,n).join(". ");
    if(!/[.!?]$/.test(s))s+=".";
    const f=fit(s,max); if(f)return f;
  }
  return null;
}

