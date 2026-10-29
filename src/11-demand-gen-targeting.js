/* ═══════════ Demand Gen targeting ═══════════
   Demographics and existing audience segments can be imported. Creating a
   custom segment from URLs, channels or apps cannot \u2014 there is no CSV or
   Editor route for it, only the interface or the API. So sources are
   exported as a build list for whoever creates them. */
const DEMO_GROUPS=[
  ["Age",["18-24","25-34","35-44","45-54","55-64","65 or more","Undetermined"],["18-24","65 or more"]],
  ["Gender",["Male","Female","Undetermined"],[]],
  ["Household income",["Top 10%","11-20%","21-30%","31-40%","41-50%","Lower 50%","Undetermined"],
    ["31-40%","41-50%","Lower 50%"]],
  ["Parental status",["Parent","Not a parent","Undetermined"],[]]
];
let DEMO=store.get("pp_demo",null);
if(!DEMO){ DEMO={}; DEMO_GROUPS.forEach(([g,,def])=>DEMO[g]=[...def]); store.set("pp_demo",DEMO); }
function drawDemo(){
  const el=$("#dgDemo"); if(!el)return;
  el.innerHTML=DEMO_GROUPS.map(([g,vals])=>`
    <div style="margin-bottom:10px">
      <div class="f-note" style="margin:0 0 4px;font-weight:600">${esc(g)}</div>
      ${vals.map(v=>`<label class="chk" style="display:inline-flex;margin:0 12px 4px 0;font-size:12.5px">
        <input type="checkbox" data-dm="${esc(g)}" value="${esc(v)}" ${(DEMO[g]||[]).includes(v)?"checked":""}>
        <span>${esc(v)}</span></label>`).join("")}
    </div>`).join("");
}
on("#dgDemo","change",e=>{
  const g=e.target.dataset.dm; if(!g)return;
  const set=new Set(DEMO[g]||[]);
  e.target.checked?set.add(e.target.value):set.delete(e.target.value);
  DEMO[g]=[...set]; store.set("pp_demo",DEMO);
});

let AUD=store.get("pp_aud",null)||[
  ["Real Estate \u2014 In-Market","In-market",""],
  ["Home Decor Enthusiasts \u2014 Affinity","Affinity",""],
  ["Luxury Shoppers \u2014 Affinity","Affinity",""]
];
let AUD_DRAFT=null;
function fillAudPick(){
  const s=$("#audPick"); if(!s)return;
  const keep=new Set([...s.selectedOptions].map(o=>o.value));
  s.innerHTML=AUD.map((a,i)=>`<option value="${i}">${esc(a[0])} \u2014 ${esc(a[1])}${a[2]?" \u00b7 "+esc(a[2]):""}</option>`).join("")
    ||`<option value="">\u2014 library is empty \u2014</option>`;
  [...s.options].forEach(o=>{if(keep.has(o.value))o.selected=true;});
}
function drawAudRows(){
  $("#audRows").innerHTML=AUD_DRAFT.map((a,i)=>`
    <div class="srow" style="grid-template-columns:1fr 150px 120px 34px">
      <input type="text" data-an="${i}" value="${esc(a[0])}" placeholder="Segment name as it appears in Google Ads">
      <select data-at="${i}">${["In-market","Affinity","Custom segment","Detailed demographic","Remarketing","Life event"]
        .map(t=>`<option${t===a[1]?" selected":""}>${t}</option>`).join("")}</select>
      <input type="text" data-ai="${i}" value="${esc(a[2]||"")}" placeholder="Criterion ID">
      <button class="del" data-ax="${i}" aria-label="Remove">\u00d7</button></div>`).join("")
    ||`<div class="empty">Nothing in the library yet.</div>`;
}
on("#audManage","click",()=>{ AUD_DRAFT=AUD.map(a=>[...a]); drawAudRows(); $("#audModal").classList.add("on"); });
on("#audClose","click",()=>$("#audModal").classList.remove("on"));
on("#audModal","click",e=>{ if(e.target.id==="audModal")$("#audModal").classList.remove("on"); });
on("#audRows","input",e=>{
  const n=e.target.dataset.an,i=e.target.dataset.ai;
  if(n!==undefined)AUD_DRAFT[+n][0]=e.target.value;
  if(i!==undefined)AUD_DRAFT[+i][2]=e.target.value;
});
on("#audRows","change",e=>{ const t=e.target.dataset.at; if(t!==undefined)AUD_DRAFT[+t][1]=e.target.value; });
on("#audRows","click",e=>{ const x=e.target.dataset.ax; if(x===undefined)return; AUD_DRAFT.splice(+x,1); drawAudRows(); });
on("#audAdd","click",()=>{ AUD_DRAFT.push(["","In-market",""]); drawAudRows(); });
on("#audSave","click",()=>{
  AUD=AUD_DRAFT.map(a=>[a[0].trim(),a[1],String(a[2]||"").trim()]).filter(a=>a[0]);
  store.set("pp_aud",AUD); $("#audModal").classList.remove("on"); fillAudPick(); toast("Library saved");
});
on("#audExport","click",()=>{ copy(JSON.stringify(AUD,null,2)); toast("JSON copied"); });
on("#audImport","click",()=>{
  const raw=prompt("Paste the exported JSON:"); if(!raw)return;
  try{ const a=JSON.parse(raw); if(!Array.isArray(a))throw 0;
    AUD_DRAFT=a.map(x=>[String(x[0]||""),String(x[1]||"In-market"),String(x[2]||"")]).filter(x=>x[0]);
    drawAudRows(); toast("Imported");
  }catch(e){ toast("That JSON didn't parse"); }
});
const pickedAudiences=()=>{
  const s=$("#audPick"); if(!s)return [];
  return [...s.selectedOptions].map(o=>AUD[+o.value]).filter(Boolean);
};
function showDGCard(){
  const c=$("#cardDG"); if(c)c.classList.toggle("hidden",CH!=="demandgen");
}

/* ═══════════ Demand Gen ═══════════
   Different asset shape from Search: five 40-character headlines, a 90
   character long headline, five 90-character descriptions and a business
   name. No pinning, and images are attached by hand \u2014 Editor cannot take
   them from a CSV. */
const DG_H=40, DG_LH=90, DG_D=90, DG_BN=25;
const creativeFormats=()=>{
  const raw=($("#cgFormats")&&$("#cgFormats").value)||"";
  const list=raw.split("\n").map(s=>s.trim()).filter(Boolean);
  return list.length?list:["Format A"];
};
/* ── the team's BPL rule ────────────────────────────────────────────────
   Every Demand Gen headline must carry brand, project AND location inside
   40 characters. Rather than quietly dropping one of the three when it will
   not fit, the shortest honest form is tried in turn and what still does not
   fit is reported, so a human decides what gives. */
/* Brand, project and location as they should actually be said together.
   A project name usually already carries some of the other two \u2014 "Lifespaces
   Mahalunge" under "Mahindra Lifespaces" in Mahalunge names the developer's
   second word and the location \u2014 so each component is reduced to the words
   the project does not already say. Without this you get "Mahindra Lifespaces
   Lifespaces Mahalunge Mahalunge". */
function bplParts(b){
  const key=x=>String(x||"").toLowerCase().replace(/[^a-z0-9]/g,"");
  const proj=(b.proj||"").trim();
  const said=new Set(proj.split(/\s+/).map(key).filter(Boolean));
  const brand=(b.dev||"").trim().split(/\s+/).filter(w=>!said.has(key(w))).join(" ").trim();
  const loc=(b.micro||b.city||"").trim();
  const city=(b.city||"").trim();
  return {
    brand, proj,
    place: loc&&!said.has(key(loc))?loc:"",
    city:  city&&!said.has(key(city))?city:"",
    brandShort: brand.split(/\s+/)[0]||brand
  };
}
/* plain brand + project + location joins, longest first \u2014 descriptions use [0] */
function bplForms(b){
  const p=bplParts(b), out=[];
  const add=(...parts)=>{
    const t=parts.filter(Boolean).join(" ").replace(/\s+/g," ").trim();
    if(t&&!out.some(x=>x.toLowerCase()===t.toLowerCase()))out.push(t);
  };
  add(p.brand,p.proj,p.place);
  add(p.brandShort,p.proj,p.place);
  add(p.brand,p.proj);
  add(p.proj,p.place);
  add(p.proj);
  return out.sort((x,y)=>y.length-x.length);
}
/* true when a line names all three of brand, project and location */
function isBPL(text,b){
  const low=x=>String(x||"").toLowerCase();
  const t=low(text);
  const dev=(b.dev||"").trim(), proj=(b.proj||"").trim();
  const loc=(b.micro||b.city||"").trim();
  const devHit=!dev||dev.split(/\s+/).some(w=>w.length>2&&t.includes(low(w)));
  const projHit=!proj||proj.split(/\s+/).some(w=>w.length>2&&t.includes(low(w)));
  const locHit=!loc||t.includes(low(loc));
  return devHit&&projHit&&locHit;
}
function bplHeadlines(b,limit){
  const p=bplParts(b);
  const j=(...parts)=>parts.filter(Boolean).join(" ")
    .replace(/\s+/g," ").replace(/\s+([,.])/g,"$1").replace(/[\s\u2014:,]+$/,"").trim();
  /* Variety comes from how the lockup is said, not from dropping the brand or
     the location: at 40 characters a full lockup leaves almost no room for a
     tail, and every headline is meant to name all three. */
  const shapes=[
    (B,P,L)=>j(B,P,L),
    (B,P,L)=>j(P,L)+(B?" By "+B:""),
    (B,P,L)=>B?B+" \u2014 "+j(P,L):"",
    (B,P,L)=>"New: "+j(B,P,L),
    (B,P,L)=>L?j(B,P)+" In "+L:"",
    (B,P,L)=>L?L+": "+j(B,P):"",
    (B,P,L)=>j(B,P,L)+" \u2014 Book Now",
    (B,P,L)=>j(B,P,L)+" \u2014 New Launch",
    (B,P,L)=>j(B,P,L)+" \u2014 Enquire Now",
    (B,P,L)=>j(B,P,L)+" \u2014 Limited Homes"
  ];
  /* the full developer name first, its short form only if the full one
     will not fit \u2014 trim the brand's extra words before losing a component */
  const brands=[p.brand,p.brandShort].filter((v,i,a)=>v&&a.indexOf(v)===i);
  if(!brands.length)brands.push("");
  const out=[], seen=new Set();
  const take=(t,ok)=>{
    const k=String(t||"").toLowerCase();
    if(!t||t.length>limit||seen.has(k))return false;
    seen.add(k); out.push([t,ok]); return true;
  };
  /* first pass: only lines that name brand, project and location */
  shapes.forEach(f=>{
    if(out.length>=5)return;
    for(const B of brands){
      const t=f(B,p.proj,p.place);
      if(t&&isBPL(t,b)&&take(t,true))return;
    }
  });
  /* second pass: the limit will not carry all three, so ship the best partial
     lines and flag them rather than silently handing Google fewer than five */
  shapes.forEach(f=>{
    if(out.length>=5)return;
    for(const B of brands.concat([""])){
      const t=f(B,p.proj,p.place||p.city);
      if(t&&take(t,isBPL(t,b)))return;
    }
  });
  bplForms(b).forEach(f=>{ if(out.length<5)take(f,isBPL(f,b)); });
  return out.slice(0,5);
}
function devOnly(x){ return String(x||"").split(/\s+/)[0]||""; }

/* Descriptions 1 and 2 carry brand, project, location, configuration and the
   verified price. 3 to 5 carry USPs, the offer, connectivity and amenities —
   never an invented one. */
function bplDescriptions(b,limit){
  const loc=b.micro||b.city||"";
  const forms=bplForms(b);
  const base=forms[0]||b.proj||"";
  /* a long developer + project + location will not fit behind a list of USPs,
     and a description with no project name in it is worse than a shorter one */
  const fitBase=room=>forms.find(f=>f.length<=room)||forms[forms.length-1]||base;
  const price=pricePhrase()||b.price||"";
  const u=b.usps.map(tc), m=b.marks.map(tc), a=b.amen.map(tc);
  const cand=[
    compose([base,b.cfg,price],limit),
    compose([`${b.cfg} at ${base}`,price,"Enquire for the price list"],limit),
    u.length?compose([u.slice(0,2).join(" \u00b7 "),`at ${fitBase(limit-u.slice(0,2).join(" \u00b7 ").length-7)}`],limit):"",
    m.length?compose([m.slice(0,2).join(" \u00b7 "),`${b.proj} puts you minutes away`],limit):"",
    compose([b.offer||"",a.slice(0,2).join(" \u00b7 "),
      fitBase(limit-(b.offer||"").length-a.slice(0,2).join(" \u00b7 ").length-5)],limit)
  ].filter(Boolean);
  const seen=new Set(), out=[];
  cand.forEach(c=>{ const k=c.toLowerCase();
    if(c&&!seen.has(k)){ seen.add(k); out.push(c); } });
  /* top up only from real project material, never invented */
  [...u,...a,...m].forEach(x=>{
    if(out.length>=5)return;
    const c=compose([x,base],limit);
    if(c&&!seen.has(c.toLowerCase())){ seen.add(c.toLowerCase()); out.push(c); }
  });
  return out.slice(0,5);
}

/* Each format gets its own ad, and the copy is rotated so the two ads are
   not identical text on different pictures. */
function dgAd(variant){
  const v=variant||0;
  const rot=a=>a.length?a.slice(v%a.length).concat(a.slice(0,v%a.length)):a;
  const b=brief(), used=new Set();
  const place=placeOf(b), where=place||b.city||b.micro||"";
  const price=pricePhrase(), cfg=b.cfg||"";
  const u=b.usps.map(tc), m=b.marks.map(tc), a=b.amen.map(tc);
  /* the BPL rule, not a free pick: every headline carries brand, project and
     location, and the ones that could not are flagged rather than dropped */
  const bpl=bplHeadlines(b,DG_H);
  const H=rot(bpl.map(x=>x[0]));
  const hOk=bpl.map(x=>x[1]);
  const LH=pick([
    compose([joinParts(b.proj,b.micro), cfg, price],DG_LH),
    compose([`${cfg} at ${b.proj}${place?", "+place:""}`, price],DG_LH),
    compose([joinParts(b.proj,b.micro), u[0], price],DG_LH)
  /* pick() returns an ARRAY. Asking it for two and then using the result as
     the long headline turned it into a string with a comma in the middle and
     twice the length — "…Starting At 89L*.,2, 3 & 4 BHK at…", 126 characters
     against a limit of 90. One is wanted here, and one is what is taken. */
  ].filter(Boolean),DG_LH,1,new Set())[0]||"";
  const D=rot(bplDescriptions(b,DG_D));
  return {h:H, hOk, lh:LH, d:D,
          bn:fit(b.dev||b.proj,DG_BN)||String(b.dev||b.proj||"").slice(0,DG_BN)};
}
/* ── Demand Gen copy, reviewed before it goes ────────────────────────────
   Search copy has a whole tab; Demand Gen copy was generated straight into
   the deploy and never shown. DGC holds whatever has been edited by hand,
   keyed by variant, and anything untouched falls through to the generator. */
let DGC=store.get("pp_dgcopy",{})||{};
const saveDGC=()=>store.set("pp_dgcopy",DGC);
function dgAdFinal(i){
  const gen=dgAd(i), ov=DGC[i]||{};
  return {
    h : (ov.h&&ov.h.length?ov.h:gen.h).slice(0,5),
    hOk: ov.h&&ov.h.length?ov.h.map(t=>bplCarries(t)):gen.hOk,
    lh: ov.lh!==undefined?ov.lh:gen.lh,
    d : (ov.d&&ov.d.length?ov.d:gen.d).slice(0,5),
    bn: ov.bn!==undefined&&ov.bn!==""?ov.bn:gen.bn,
    edited: !!(ov.h||ov.d||ov.lh!==undefined||ov.bn)
  };
}
/* a hand-written headline is held to the same rule as a generated one */
function bplCarries(t){
  const b=brief(), p=bplParts(b), s=String(t||"").toLowerCase();
  const has=x=>!x||s.indexOf(String(x).toLowerCase())>-1;
  return has(p.proj)&&(has(p.brand)||has(p.brandShort))&&(has(p.place)||has(p.city));
}
function dgcVariants(){
  return VARIANTS.length?VARIANTS.map((v,i)=>({i,name:v.names.adgroup||v.names.campaign||`Variant ${i+1}`}))
    :[{i:0,name:"Variant 1"}];
}
let DGC_AT=0;
function dgcFill(){
  const sel=$("#dgcPick"); if(!sel)return;
  const vs=dgcVariants();
  if(DGC_AT>=vs.length)DGC_AT=0;
  sel.innerHTML=vs.map(v=>`<option value="${v.i}">${esc(v.name)}</option>`).join("");
  sel.value=String(DGC_AT);
}
function dgcDraw(){
  const box=$("#dgcBody"); if(!box)return;
  const a=dgAdFinal(DGC_AT);
  const st=$("#dgcStat");
  const over=a.h.filter(t=>t.length>DG_H).length+a.d.filter(t=>t.length>DG_D).length+
             (a.lh.length>DG_LH?1:0)+(a.bn.length>DG_BN?1:0);
  const flagged=a.hOk.filter(x=>!x).length;
  if(st)st.innerHTML=`<span class="pill ${over?"p-bad":flagged?"p-warn":"p-ok"}">${
    over?`${over} over the limit`:flagged?`${flagged} headline${flagged===1?"":"s"} missing B·P·L`:"all good"
  }${a.edited?" · edited":""}</span>`;
  const field=(label,val,lim,key,idx,flag)=>{
    const n=String(val||"").length;
    return `<div class="dgc-row">
      <span class="dgc-lab">${esc(label)}</span>
      <textarea class="dgc-in${n>lim?" over":""}" rows="1" data-k="${key}"${
        idx===undefined?"":` data-i="${idx}"`}>${esc(val||"")}</textarea>
      <span class="dgc-n ${n>lim?"bad":""}">${n}/${lim}</span>
      <span class="dgc-f">${flag===false?`<span class="pill p-warn" title="This headline does not carry brand, project and location">B·P·L</span>`:""}</span>
    </div>`;
  };
  box.innerHTML=
    `<div class="f-lab" style="margin-bottom:6px">Headlines · max ${DG_H}</div>`+
    a.h.map((t,i)=>field(`H${i+1}`,t,DG_H,"h",i,a.hOk[i])).join("")+
    `<div class="f-lab" style="margin:12px 0 6px">Long headline · max ${DG_LH}</div>`+
    field("LH",a.lh,DG_LH,"lh")+
    `<div class="f-lab" style="margin:12px 0 6px">Descriptions · max ${DG_D}</div>`+
    a.d.map((t,i)=>field(`D${i+1}`,t,DG_D,"d",i)).join("")+
    `<div class="f-lab" style="margin:12px 0 6px">Business name · max ${DG_BN}</div>`+
    field("BN",a.bn,DG_BN,"bn");
}
function dgcShow(){
  const c=$("#cardDGCopy"), s=$("#cardSearchH");
  if(c)c.classList.toggle("hidden",CH!=="demandgen");
  if(CH==="demandgen"){ dgcFill(); dgcDraw(); }
}
on("#dgcPick","change",e=>{ DGC_AT=+e.target.value||0; dgcDraw(); });
on("#dgcBody","input",e=>{
  const el=e.target.closest("[data-k]"); if(!el)return;
  const k=el.dataset.k, i=el.dataset.i===undefined?null:+el.dataset.i;
  const cur=DGC[DGC_AT]||(DGC[DGC_AT]={});
  if(k==="h"||k==="d"){
    if(!cur[k])cur[k]=dgAdFinal(DGC_AT)[k].slice();
    cur[k][i]=el.value;
  }else cur[k]=el.value;
  saveDGC();
  /* the counts and the B·P·L flag have to move with the typing, but redrawing
     the whole block would take the caret with it */
  const n=el.value.length, lim=k==="h"?DG_H:k==="d"?DG_D:k==="lh"?DG_LH:DG_BN;
  const row=el.closest(".dgc-row");
  row.querySelector(".dgc-n").textContent=`${n}/${lim}`;
  row.querySelector(".dgc-n").className="dgc-n "+(n>lim?"bad":"");
  el.classList.toggle("over",n>lim);
  if(k==="h")row.querySelector(".dgc-f").innerHTML=bplCarries(el.value)?"":
    `<span class="pill p-warn" title="This headline does not carry brand, project and location">B·P·L</span>`;
  drawApPlan();
});
on("#dgcReset","click",()=>{ delete DGC[DGC_AT]; saveDGC(); dgcDraw(); drawApPlan();
  toast("Back to the generated copy"); });
on("#dgcResetAll","click",()=>{
  if(!Object.keys(DGC).length)return toast("Nothing has been edited");
  if(!confirm("Throw away every hand-edited Demand Gen line?"))return;
  DGC={}; saveDGC(); dgcDraw(); drawApPlan(); toast("Every variant reset");
});
on("#dgcCopy","click",()=>{
  const a=dgAdFinal(DGC_AT);
  copy([`Headlines`,...a.h,``,`Long headline`,a.lh,``,`Descriptions`,...a.d,``,
        `Business name`,a.bn].join("\n"));
  toast("Ad copied");
});

/* every campaign-level setting from the reference account, so the Open
   campaign is built the same way every time and can then be duplicated */
function dgSettings(){
  const b=brief();
  const loc=($("#cgLoc")&&$("#cgLoc").value.trim())||canonLocation(PROJ.city);
  const budget=$("#cgBudget")?$("#cgBudget").value.trim():"";
  return [
    ["Campaign type","Demand Gen"],
    ["Status","Paused"],
    ["Budget type","Avg. daily"],
    ["Budget",budget],
    ["Bid strategy",($("#cgBid")&&$("#cgBid").value)||"Maximize conversions"],
    ["Goal level setting","Campaign-specific"],
    ["Customer acquisition","Bid equally for new and existing customers"],
    ["EU political ads","No, doesn't have EU political ads"],
    ["Location targeting",loc],
    ["Targeting method","People in or regularly in your targeted locations"],
    ["Exclusion method","People in your excluded locations"],
    ["Language targeting","All"],
    ["Ages","Exclude 18-24"],
    ["Genders / Parental status / Household income","Observation"],
    ["Flexible reach \u2014 Placements","Targeting"],
    ["Flexible reach \u2014 Topics","Targeting"],
    ["Flexible reach \u2014 Audience segments","Targeting"],
    ["Optimized targeting","Disabled"],
    ["View-through conversion optimization","Disabled"],
    ["TV screen bid adjustment","-100"],
    ["Include Google TV","Disabled"],
    ["Include video partners","Enabled"],
    ["Ad rotation","Optimize: prefer best performing ads"],
    ["Default max CPC / Max CPM / Target CPV","0.01"],
    ["Call to action text","Learn more"],
    ["Language (ad level)","English (United Kingdom)"],
    ["Business name",dgAdFinal(0).bn],
    ["Audience",pickedAudiences().map(a=>a[0]).join("; ")||"None selected"],
    ["Images and logo","Attach by hand \u2014 see sheet 10 for the exact sizes"],
    ["Creative formats",creativeFormats().join(", ")]
  ];
}

