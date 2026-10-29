/* ═══════════ ad builder with the pin plan ═══════════
   Pin 1  5 headlines drawn from the ad group's own keywords
   Pin 2  5 headlines on configuration and price
   Pin 3  4 USPs and 1 call to action                       */
/* ═══════════ configuration and price copy ═══════════
   "2, 3 & 3.5 BHK" is one label but several products. Splitting it lets a
   30 character headline name one configuration AND its price, which is what
   the pinned-2 slot is for — the generic nouns it used to fall back on
   ("Homes", "Flats", "Spacious Apartments") carry no information at all. */
function cfgParts(cfg){
  const s=String(cfg||"").trim();
  if(!s)return [];
  const m=/^(.*?)\s*\b(BHK|RK)\b\s*(.*)$/i.exec(s);
  if(!m)return [s];
  const unit=m[2].toUpperCase(), tail=(m[3]||"").trim();
  const nums=m[1].split(/[,&\/]|\band\b/i).map(x=>x.trim()).filter(Boolean);
  if(nums.length<2)return [s];
  const out=nums.map(n=>`${n} ${unit}${tail?" "+tail:""}`);
  if(nums.length>=2)out.push(`${nums[0]} & ${nums[1]} ${unit}`);
  return out;
}
/* "2, 3 or 3.5 BHK" — reads as a sentence where "&" reads as a label */
function cfgOr(cfg){
  const s=String(cfg||"").trim();
  const m=/^(.*?)\s*\b(BHK|RK)\b\s*(.*)$/i.exec(s);
  if(!m)return s;
  const nums=m[1].split(/[,&\/]|\band\b/i).map(x=>x.trim()).filter(Boolean);
  if(nums.length<2)return s;
  const unit=m[2].toUpperCase(), tail=(m[3]||"").trim();
  const last=nums.pop();
  return `${nums.join(", ")} or ${last} ${unit}${tail?" "+tail:""}`;
}
/* The price as a buyer reads it, whatever was typed. "1.70CR" becomes
   "\u20B91.70 Cr" \u2014 the currency mark is the whole point of putting a price
   in a headline, and the unit is written the way the market writes it. */
function barePrice(){
  let p=String(PROJ.price||"").trim().replace(/\*+$/,"").trim();
  if(!p)return "";
  /* anchored on the digit, because "1.70CR" has no word boundary before the
     unit and a \\b there simply never matches */
  p=p.replace(/(\d)\s*(crores?|cr)\b/i,"$1 Cr")
     .replace(/(\d)\s*(lakhs?|lacs?|l)\b/i,"$1 Lacs")
     .replace(/(\d)\s*(k|thousand)\b/i,"$1 K")
     .replace(/\s+/g," ").trim();
  if(REGION==="ae"){ if(!/aed/i.test(p))p="AED "+p; }
  else if(!/[\u20B9]/.test(p)&&/^[\d.,]/.test(p))p="\u20B9"+p;
  return p;
}
/* Pinned 2 is reserved for configuration and price. Every line here names a
   real configuration, a real price, or both — never a generic noun. The
   connectors are the ones that fit: "|", "From", "Starting At", "Onwards". */
function moneyHeadlines(b,max){
  const bare=barePrice();
  const short=bare?priceUnitShort(bare):"";
  const cfgs=[b.cfg,...cfgParts(b.cfg)].filter(Boolean);
  const out=[];
  const add=t=>{ const f=fit(t,max); if(f&&!out.some(x=>x.toLowerCase()===f.toLowerCase()))out.push(f); };
  if(bare)cfgs.forEach(c=>{
    add(`${c} | ${bare}*`);
    add(`${c} | ${short}*`);
    add(`${c} From ${bare}*`);
    add(`${c} From ${short}*`);
    add(`${c} At ${short}*`);
  });
  priceForms().forEach(add);        /* "Starting At X*", "From X*", "X Onwards*" */
  cfgs.forEach(add);                /* a real configuration still beats a noun */
  return out;
}
/* Pinned 1 descriptions carry project, configuration, price and location in
   a sentence, rather than four fragments stapled together with full stops. */
function sentenceD1(b,max){
  const where=placeOf(b)||b.micro||b.city||"";
  const bare=barePrice(), cfg=b.cfg||"", orCfg=cfgOr(cfg);
  const city=(b.city||"").trim();
  /* placeOf already returns "Micro, City" for some briefs, so the city is
     only added when it is not in there already \u2014 otherwise the sentence
     reads "Koregaon Park, Pune, Pune". */
  const wide=where&&city&&!where.toLowerCase().includes(city.toLowerCase())
    ?`${where}, ${city}`:where;
  const cands=[];
  if(cfg&&bare&&wide)cands.push(
    `${b.proj} in ${wide} offers ${cfg} residences starting at ${bare}*.`,
    `Own a ${orCfg} at ${b.proj}, ${wide}, from ${bare}*.`,
    `${cfg} at ${b.proj} in ${where}, priced from ${bare}*.`);
  if(cfg&&bare)cands.push(
    `${b.proj} offers ${cfg} residences from ${bare}*.`,
    `${cfg} at ${b.proj}${where?" in "+where:""} from ${bare}*.`);
  if(cfg&&wide)cands.push(`${b.proj} in ${wide} offers ${cfg} residences.`);
  if(bare)cands.push(`${b.proj}${where?" in "+where:""}, starting at ${bare}*.`);
  return cands.filter(Boolean);
}
/* Pinned 2 descriptions carry what the project actually offers and the ask. */
function sentenceD2(b,max){
  const u=b.usps.map(tc), m=b.marks.map(tc), a=b.amen.map(tc);
  const out=[];
  if(u[0]&&u[1])out.push(`${u[0]} and ${u[1]}. Book a free site visit today.`);
  if(u[0])out.push(`${u[0]}. Download the brochure for floor plans and pricing.`);
  if(u[1]&&u[2])out.push(`${u[1]} with ${u[2]}. Enquire now for the full price list.`);
  if(m[0]&&m[1])out.push(`${m[0]} and ${m[1]}. Request a call back from our team.`);
  if(m[0])out.push(`${m[0]}. Book a site visit and see the location for yourself.`);
  if(a[0]&&a[1])out.push(`${a[0]}, ${a[1]} and more. Get the price list instantly.`);
  if(u[2])out.push(`${u[2]}. Enquire today for floor plans and availability.`);
  if(b.offer)out.push(`${tc(b.offer)}. Limited homes — book your site visit now.`);
  return out;
}
function adFor(kws){
  const b=brief(), used=new Set(), H=[];
  const kwH=kws.filter(k=>!blocked(k)).slice(0,14).map(k=>tc(k));
  pick(kwH,H_MAX,5,used).forEach(t=>H.push([t,"1"]));
  const place=placeOf(b), where=place||b.city||b.micro||"";
  /* Pinned 2 is the configuration-and-price slot. It used to fall back on
     "Homes", "Spacious ... Homes" and the like, which say nothing a buyer
     can act on; now every line carries a real configuration, a real price,
     or both. */
  pick(scrub(moneyHeadlines(b,H_MAX)),H_MAX,5,used).forEach(t=>H.push([t,"2"]));
  const usp=pick(b.usps.map(tc),H_MAX,4,used);
  usp.forEach(t=>H.push([t,"3"]));
  const cta=pick(["Book A Free Site Visit","Download Brochure Now","Get Price List Instantly",
    "Enquire For Floor Plans"],H_MAX,1,used);
  cta.forEach(t=>H.push([t,"3"]));
  const fillers=pick([...b.marks.map(tc),...b.amen.map(tc)],H_MAX,H_CAP-H.length,used);
  fillers.forEach(t=>H.push([t,"3"]));
  while(H.length<H_CAP)H.push(["",""]);

  const u=b.usps.map(tc), m=b.marks.map(tc);
  const dUsed=new Set();
  const price=pricePhrase();
  const CTA=["Book A Free Site Visit","Download The Brochure","Enquire For Floor Plans","Get The Price List"];
  /* pinned 1 — project, configuration, price and location, as a sentence */
  const p1=pick(sentenceD1(b,D_MAX).filter(x=>!banned(x)),D_MAX,2,dUsed).map(t=>[t,"1"]);
  /* pinned 2 — what the project offers, and the ask */
  const p2=pick(sentenceD2(b,D_MAX).concat([
    compose([u[0]&&u[1]?`${u[0]} & ${u[1]}`:(u[0]||""), CTA[0]],D_MAX),
    compose([u[2]||u[1]||u[0]||"", m[0], CTA[1]],D_MAX)
  ].filter(Boolean)).filter(x=>!banned(x)),D_MAX,2,dUsed).map(t=>[t,"2"]);
  const D=[...p1,...p2]; while(D.length<D_CAP)D.push(["",""]);
  return {h:H.slice(0,H_CAP),d:D.slice(0,D_CAP)};
}



/* One line in, one segment out. Google builds a custom segment from a single
   kind of signal — searched terms, browsed sites, watched channels or used
   apps — so a segment carrying a URL and a keyword at once matches neither
   well. Each row below is therefore one segment with exactly one input.
   These are created through the API by "Create these in the account", which
   writes each new ID back beside its line. */
/* One box per strategy, not one per signal type. Two strategies share a
   signal — yb and yc both run on channels — so a box per type meant both got
   the same lines, and tagging them by hand was worse. The strategy is the box,
   the signal type comes with it, and the segment name is built, never typed. */
const CS_BUCKETS=[
  /* code, box label, signal type, placeholder, core */
  ["kb","KB — Keyword · Brand",      "Search terms",     "goelganga global riverfront\nglobal riverfront mundhwa",true],
  ["kc","KC — Keyword · Competitor", "Search terms",     "kolte patil life republic\ngodrej park greens",true],
  ["ub","UB — URL · Brand",          "Website URLs",     "https://www.goelganga.com/global-riverfront",true],
  ["uc","UC — URL · Competitor",     "Website URLs",     "https://www.koltepatil.com/life-republic",true],
  ["yb","YB — YouTube · Brand",      "YouTube channels", "https://www.youtube.com/@goelgangadevelopments",true],
  ["yc","YC — YouTube · Competitor", "YouTube channels", "https://www.youtube.com/@koltepatil",true],
  ["kg","KG — Keyword · Generic",         "Search terms",     "3 bhk flats in mundhwa\nluxury apartments pune",false],
  ["news-portal","News portal · URLs",    "Website URLs",     "https://timesofindia.indiatimes.com/city/pune",false],
  ["property-portal-url","Property portal · URLs","Website URLs","https://www.99acres.com/property-in-pune",false],
  ["news-app","News · Apps",              "Apps",             "com.toi.reader.activities",false],
  ["property-portal-app","Property portal · Apps","Apps",      "com.til.magicbricks\ncom.nnacres.app",false]
];
const csId=code=>"cs_"+String(code).replace(/[^a-z0-9]/gi,"_");
let CS_SHOW_ALL=store.get("pp_csall",false)||false;
function drawCsBoxes(){
  const box=$("#csBoxes"); if(!box)return;
  const live=new Set((STRATS.demandgen||[]).map(r=>String(r[1]||r[0]||"").toLowerCase()));
  /* the six he runs are always there; the rest appear when they are in use,
     or when he asks for them */
  const show=CS_BUCKETS.filter(b=>b[4]||CS_SHOW_ALL||live.has(b[0]));
  box.innerHTML=`<div class="row2">`+show.map(b=>{
    const [code,label,kind,ph]=b;
    const off=live.size&&!live.has(code);
    return `<label class="f">
      <span class="f-lab">${esc(label)}
        ${off?`<span class="pill p-mute" title="This strategy is not picked on tab 01">not in this build</span>`:""}</span>
      <textarea id="${csId(code)}" rows="4" spellcheck="false" placeholder="${esc(ph)}"></textarea>
      <span class="f-note">${esc(kind)} · one per line · goes only to <b>${esc(code)}</b></span></label>`;
  }).join("")+`</div>`;
  const btn=$("#csMore");
  if(btn)btn.textContent=CS_SHOW_ALL?"Just the six":"More signal types";
  /* the fields are rebuilt, so what was typed has to be put back */
  CS_BUCKETS.forEach(b=>{ const el=$("#"+csId(b[0]));
    if(el&&CS_TEXT[b[0]]!==undefined)el.value=CS_TEXT[b[0]]; });
}
let CS_TEXT=store.get("pp_csv2",{})||{};
function csRead(){
  CS_BUCKETS.forEach(b=>{ const el=$("#"+csId(b[0])); if(el)CS_TEXT[b[0]]=el.value; });
  store.set("pp_csv2",CS_TEXT);
}
function csLabel(v){
  let t=String(v||"").trim();
  /* a channel is best named by its handle, not by "youtube-com-..." */
  const yt=/youtube\.com\/(?:@|c\/|channel\/|user\/)?([^\/?#]+)/i.exec(t);
  if(yt) t=yt[1];
  else t=t.replace(/^https?:\/\/(www\.)?/i,"").replace(/\/+$/,"");
  /* dots and slashes need a separator of their own, or "99acres.com/pune"
     collapses into "99acrescompune" */
  return t.replace(/[\/._@]+/g,"-").replace(/-+/g,"-").replace(/^-|-$/g,"").slice(0,44);
}
/* Which audience a strategy gets. These are the account's own codes, matched
   exactly rather than by prefix \u2014 "invest" begins with "in" but is not the
   Inmarket strategy. A segment with no ID yet is still listed, so the deploy
   reports it as skipped instead of quietly targeting everyone. */
/* Which kind of signal each strategy runs on. Several strategies share a
   kind — yb and yc both run on channels — so the kind alone cannot decide
   which lines a strategy gets. A line tagged with a strategy goes to that
   one only; an untagged line goes to every strategy of its kind. */
const STRAT_KIND={
  yb:"YouTube channels", yc:"YouTube channels",
  ub:"Website URLs", uc:"Website URLs",
  "news-portal":"Website URLs", "property-portal-url":"Website URLs",
  kb:"Search terms", kc:"Search terms", kg:"Search terms",
  "news-app":"Apps", "property-portal-app":"Apps"
};
const STRAT_LIB=["in","luxury","invest","avid"];
function audiencesFor(strat){
  const code=String(strat||"").toLowerCase();
  const picked=pickedAudiences().map(a=>({name:a[0],type:a[1],id:a[2]||""}));
  if(code==="op")return [];
  if(STRAT_LIB.indexOf(code)>-1)return picked;
  if(!STRAT_KIND[code])return picked;
  /* each line already belongs to exactly one strategy — the box it was typed
     into — so there is nothing to work out here */
  return customSegments()
    .filter(r=>(r[6]||[]).indexOf(code)>-1)
    .map(r=>({name:r[0],type:"Custom segment",id:r[5]||""}));
}
/* the live answer to "which strategy gets what", read off the same lines */
function drawCsMap(){
  const box=$("#csMap"); if(!box)return;
  const codes=(STRATS.demandgen||[]).map(r=>String(r[1]||r[0]||"").toLowerCase()).filter(Boolean);
  const seen=[]; codes.forEach(c=>{ if(seen.indexOf(c)===-1)seen.push(c); });
  if(!seen.length)return box.innerHTML=`<div class="empty">No Demand Gen strategies set up yet.</div>`;
  box.innerHTML=seen.map(c=>{
    const a=audiencesFor(c);
    const lib=STRAT_LIB.indexOf(c)>-1, none=c==="op";
    const what=none?`<span class="p-mute">no segment — the open campaign</span>`
      :lib?`<span class="p-mute">library segments</span> · ${a.length} picked`
      :`<span class="p-mute">${esc(STRAT_KIND[c]||"library")}</span> · ${a.length} line${a.length===1?"":"s"}`;
    const miss=a.filter(x=>!x.id).length;
    return `<div class="tgt-row">
      <span class="tgt-kind ${none?"":lib?"k-city":"k-pin"}">${esc(c.toUpperCase())}</span>
      <span class="nm">${what}${a.length?` — ${esc(a.map(x=>x.name).join(", "))}`:""}</span>
      ${miss?`<span class="cid miss">${miss} without an ID</span>`:""}
    </div>`;
  }).join("");
}
/* One line of a custom segment field. Two optional markers:
   "yb | thing"   hands the line to those strategies only
   "thing ::1234" carries back the ID of a segment already created
   The pipe is only read as a tag when what precedes it is a strategy this
   account actually has, so a URL containing a pipe survives unharmed. */
function csParse(v){
  const bits=String(v).split("::");
  var input=bits[0].trim();
  const id=(bits[1]||"").replace(/[^0-9]/g,"");
  var strats=[];
  const bar=input.indexOf("|");
  if(bar>0){
    const want=input.slice(0,bar).trim().toLowerCase().split(/[,\s]+/).filter(Boolean);
    if(want.length&&want.every(w=>!!STRAT_KIND[w]||STRAT_LIB.indexOf(w)>-1)){
      strats=want; input=input.slice(bar+1).trim();
    }
  }
  return {input,id,strats};
}
const CS_FIELD={
  "Search terms"    :"People who searched any of these terms",
  "Website URLs"    :"People who browse types of websites",
  "YouTube channels":"People who browse types of websites (channel URL)",
  "Apps"            :"People who use types of apps"
};
function customSegments(){
  const b=brief(), rows=[];
  /* [Developer] [Project] [Location], except the developer is dropped when
     the project already carries any part of it \u2014 "Global Group Global
     Riverfront" names the same company twice, and trimming it down to the
     leftover word gives a worse name still ("Group Global Riverfront"). */
  const key=x=>String(x||"").toLowerCase().replace(/[^a-z0-9]/g,"");
  const projWords=new Set(String(b.proj||"").split(/\s+/).map(key).filter(Boolean));
  const devCarried=String(b.dev||"").split(/\s+/).some(w=>projWords.has(key(w)));
  const stem=[devCarried?"":slug(b.dev||""), slug(b.proj||"project"),
              slug(b.micro||b.city||"")].filter(Boolean).join("-");
  const seen={};
  CS_BUCKETS.forEach(([code,label,kind])=>{
    const el=$("#"+csId(code));
    const txt=el?el.value:(CS_TEXT[code]||"");
    lines(txt).forEach(v=>{
      /* "the input  ::1234567" lets a segment that has been created carry its
         ID back in, so the deploy attaches it instead of reporting it skipped */
      const {input,id}=csParse(v);
      if(!input)return;
      /* the name is built, never typed: project, strategy, then the thing
         itself. Two inputs that slug down to the same name get a number,
         because Google refuses a whole batch that carries one name twice —
         which is how a naming error used to mean nothing got created. */
      /* 78 characters cut the input off mid-word once the project stem had
         taken its share; Google's own field is far longer than that. */
      var nm=`${stem}-${code}-${slug(csLabel(input))}`.slice(0,110);
      if(seen[nm.toLowerCase()]){ var n=2;
        while(seen[`${nm} ${n}`.toLowerCase()])n++;
        nm=`${nm} ${n}`; }
      seen[nm.toLowerCase()]=true;
      rows.push([nm, kind, input, CS_FIELD[kind]||"",
                 "Google Ads → Tools → Audience manager → Custom segments → New custom segment",
                 id, [code]]);
    });
  });
  return rows;
}

