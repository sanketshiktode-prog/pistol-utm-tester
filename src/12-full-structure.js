/* ═══════════ full structure ═══════════ */
let PLAN=[];
/* Ads Editor takes custom parameters as one semicolon-joined cell */
/* Ads Editor separates custom parameters with a SPACE and each value must
   itself be space-free. A semicolon is read as part of the value. */
const custParam=n=>n?`{_adgroup}=${paramVal(n.adgroup)} {_campaign}=${paramVal(n.campaign)} {_strategy}=${paramVal(n.strategy)}`:"";
/* Ads Editor reads one custom parameter per cell and splits on the first
   "=", so three of them in a single column can never import. The values
   are written straight into the tracking template instead — same final
   URL, nothing left for Editor to mis-parse. */
function inlineTpl(n){
  return TPL[CH]
    .replace("{_adgroup}",paramVal(n.adgroup))
    .replace("{_campaign}",paramVal(n.campaign))
    .replace("{_strategy}",paramVal(n.strategy));
}
/* Build is a refresh, not a reset. Keywords the person added by hand are
   carried forward, keywords they deleted stay deleted, and an ad they have
   touched is left exactly as they left it. "Rebuild and discard my edits" is
   the only thing that throws that away. */
function doBuild(fresh){
  const b=brief();
  if(!b.proj)return toast("Fill in the project name on the Ad copy tab");
  const strats=[...$("#inStrat").selectedOptions].map(o=>o.value);
  if(!strats.length)return toast("Pick at least one strategy on tab 01");
  const mts=CH==="search"?[...$("#inMatch").selectedOptions].map(o=>o.value):[""];
  const enq=$("#inEnq").value.trim()||b.proj;
  const tk=ticket();
  let keptCopy=0, keptKw=0, dropped=0;
  PLAN=[];
  strats.forEach(s=>{
    const gen=kwForStrategy(s);
    const groups=mts.map(mt=>{
      const n=names(enq,s,tk,mt,CH);
      const old=fresh?null:fix(ADG[n.adgroup]);
      const man=old?old.man.slice():[], kill=old?old.kill.slice():[];
      const killL=new Set(kill.map(x=>x.toLowerCase()));
      const seen=new Set(), kws=[];
      [...gen,...man].forEach(k=>{ const L=k.toLowerCase();
        if(!killL.has(L)&&!seen.has(L)){ seen.add(L); kws.push(k); } });
      if(man.length)keptKw+=man.length;
      dropped+=kill.length;
      const hasCopy=old&&old.edited&&old.h&&old.h.some(r=>r[0]&&r[0].trim());
      const ad=hasCopy?{h:old.h,d:old.d}:adFor(kws);
      if(hasCopy)keptCopy++;
      ADG[n.adgroup]={h:ad.h,d:ad.d,kw:kws.join("\n"),man,kill,edited:!!hasCopy};
      return {name:n.adgroup,mt,kws,ad,n};
    });
    PLAN.push({strat:s,campaign:names(enq,s,tk,mts[0],CH).campaign,groups});
  });
  if(!ADG[ADCUR])ADCUR=PLAN[0].groups[0].name;
  saveAd(); fillAdPicker(); drawAd();
  $("#asGen").click();
  drawPlan();
  const ac=$("#stAssetCamp"), keepA=ac.value;
  ac.innerHTML=PLAN.map(p=>`<option value="${esc(p.campaign)}">${esc(p.campaign)}</option>`).join("");
  if([...ac.options].some(o=>o.value===keepA))ac.value=keepA;
  logEvent("build",`${PLAN.length} campaigns${fresh?" (fresh)":""}`);
  const note=[];
  if(keptCopy)note.push(`${keptCopy} ad${keptCopy===1?"":"s"} you wrote kept`);
  if(keptKw)note.push(`${keptKw} keyword${keptKw===1?"":"s"} you added kept`);
  if(dropped)note.push(`${dropped} you deleted stayed out`);
  $("#stStat").innerHTML=`<span class="pill p-ok">${PLAN.length} campaigns \u00b7 `+
    `${PLAN.reduce((a,p)=>a+p.groups.length,0)} ad groups</span>`+
    (note.length?` <span class="pill p-mute">${esc(note.join(" \u00b7 "))}</span>`:"");
  if(typeof drawApPlan==="function"){ drawApSettings(); drawApPlan(); }
  toast(fresh?"Rebuilt from scratch":note.length?"Refreshed \u2014 your edits are still there":"Structure built");
}
on("#stBuild","click",()=>doBuild(false));
on("#stRebuild","click",()=>{
  if(!confirm("Throw away every headline, description and keyword change you made by hand and generate all of it again?"))return;
  doBuild(true);
});
function drawPlan(){
  if(!PLAN.length){$("#stTree").innerHTML=`<div class="empty">Fill the brief, then press Build.</div>`;return;}
  $("#stTree").innerHTML=PLAN.map(p=>`
    <div style="border:1px solid var(--line);border-radius:12px;margin-bottom:14px">
      <div style="padding:11px 13px;background:var(--navy-wash);border-bottom:1px solid var(--line-soft);
        font-family:var(--mono);font-size:12.5px;font-weight:600;color:var(--navy)">${esc(p.campaign)}</div>
      ${p.groups.map(g=>`<div style="padding:11px 13px;border-bottom:1px solid var(--line-soft)">
        <div class="m" style="font-family:var(--mono);font-size:12px;font-weight:600">${esc(g.name)}</div>
        <div class="mini" style="margin-top:4px">${g.kws.length} keywords \u00b7 ${g.ad.h.filter(x=>x[0]).length} headlines \u00b7 ${g.ad.d.filter(x=>x[0]).length} descriptions</div>
        <div class="out sm" style="margin-top:6px;padding:7px 9px">{_campaign}=${esc(paramVal(g.n.campaign))}<br>{_adgroup}=${esc(paramVal(g.n.adgroup))}<br>{_strategy}=${esc(paramVal(g.n.strategy))}</div>
        <div class="out sm" style="margin-top:7px;max-height:110px;overflow:auto">${esc(g.kws.slice(0,8).join("\n"))}${g.kws.length>8?"\n\u2026":""}</div>
      </div>`).join("")}
    </div>`).join("");
}
on("#stKwCsv","click",()=>{
  if(!PLAN.length)return toast("Build the structure first");
  const rows=[];
  PLAN.forEach(p=>p.groups.forEach(g=>g.kws.forEach(k=>
    rows.push([p.campaign,g.name,k,MTNAME[g.mt]||"Broad","Enabled"]))));
  dl("structure-keywords.csv","Campaign,Ad group,Keyword,Match type,Status\n"+
    rows.map(r=>r.map(csvq).join(",")).join("\n"));});
on("#stAdCsv","click",()=>{
  if(!PLAN.length)return toast("Build the structure first");
  const hdr=["Campaign","Ad group"];
  for(let i=1;i<=H_CAP;i++)hdr.push(`Headline ${i}`,`Headline ${i} position`);
  for(let i=1;i<=D_CAP;i++)hdr.push(`Description ${i}`,`Description ${i} position`);
  hdr.push("Final URL","Path 1","Path 2");
  const rows=[];
  PLAN.forEach(p=>p.groups.forEach(g=>{
    const r=[p.campaign,g.name];
    for(let i=0;i<H_CAP;i++)r.push(g.ad.h[i]?g.ad.h[i][0]:"",g.ad.h[i]?g.ad.h[i][1]:"");
    for(let i=0;i<D_CAP;i++)r.push(g.ad.d[i]?g.ad.d[i][0]:"",g.ad.d[i]?g.ad.d[i][1]:"");
    r.push(PROJ.url||$("#inLp").value.trim(),PROJ.p1,PROJ.p2);
    rows.push(r);}));
  dl("structure-ads.csv",hdr.map(csvq).join(",")+"\n"+rows.map(r=>r.map(csvq).join(",")).join("\n"));});
/* Tracking template and custom parameters live at ad group level. */
on("#stCampCsv","click",()=>{
  if(!PLAN.length)return toast("Build the structure first");
  const rows=[];
  PLAN.forEach(p=>p.groups.forEach(g=>rows.push([p.campaign,g.name,"Enabled",inlineTpl(g.n)])));
  dl("structure-adgroups.csv",
    ["Campaign","Ad group","Status","Tracking template"].map(csvq).join(",")+"\n"+
    rows.map(r=>r.map(csvq).join(",")).join("\n"));});

/* ═══════════ one file: campaigns, ad groups, keywords, ads, assets ═══════════
   Ads Editor reads a mixed CSV and decides each row's entity type from
   which columns are filled, so the whole build travels in a single import. */
on("#stAllCsv","click",()=>{
  if(!PLAN.length)return toast("Build the structure first");
  const lp=PROJ.url||$("#inLp").value.trim();
  const budget=($("#stBudget").value||"").trim();
  const bid=$("#stBid").value, obj=$("#stObj").value, goal=$("#stGoal").value;

  const hdr=["Campaign","Campaign type","Campaign status","Campaign daily budget",
    "Bid strategy type","Campaign objective","Conversion goals",
    "Ad group","Ad group status","Tracking template",
    "Keyword","Criterion type","Ad type"];
  for(let i=1;i<=H_CAP;i++)hdr.push(`Headline ${i}`,`Headline ${i} position`);
  for(let i=1;i<=D_CAP;i++)hdr.push(`Description ${i}`,`Description ${i} position`);
  hdr.push("Path 1","Path 2","Final URL",
    "Callout text","Link text","Description line 1","Description line 2","Final URL",
    "Structured snippet header","Structured snippet values");

  const blank=()=>Object.fromEntries(hdr.map(k=>[k,""]));
  const rows=[];
  const chType=CH==="search"?"Search":"Demand Gen";

  PLAN.forEach(p=>{
    /* campaign */
    const c=blank();
    c["Campaign"]=p.campaign; c["Campaign type"]=chType; c["Campaign status"]="Paused";
    c["Campaign daily budget"]=budget; c["Bid strategy type"]=bid;
    c["Campaign objective"]=obj; c["Conversion goals"]=goal;
    rows.push(c);

    p.groups.forEach(g=>{
      /* ad group, carrying its own tracking template */
      const a=blank();
      a["Campaign"]=p.campaign; a["Ad group"]=g.name; a["Ad group status"]="Enabled";
      a["Tracking template"]=inlineTpl(g.n);
      rows.push(a);

      /* keywords */
      g.kws.forEach(k=>{
        const r=blank();
        r["Campaign"]=p.campaign; r["Ad group"]=g.name;
        r["Keyword"]=g.mt==="E"?`[${k}]`:g.mt==="P"?`"${k}"`:k;
        r["Criterion type"]=MTNAME[g.mt]||"Broad";
        rows.push(r);
      });

      /* the responsive search ad */
      const ad=blank();
      ad["Campaign"]=p.campaign; ad["Ad group"]=g.name;
      ad["Ad type"]=CH==="search"?"Responsive search ad":"Responsive display ad";
      g.ad.h.forEach((x,i)=>{ if(x[0]){ ad[`Headline ${i+1}`]=x[0]; ad[`Headline ${i+1} position`]=x[1]||""; } });
      g.ad.d.forEach((x,i)=>{ if(x[0]){ ad[`Description ${i+1}`]=x[0]; ad[`Description ${i+1} position`]=x[1]||""; } });
      ad["Path 1"]=PROJ.p1; ad["Path 2"]=PROJ.p2; ad["Final URL"]=lp;
      rows.push(ad);
    });

    /* assets, attached to each campaign */
    AS.co.filter(Boolean).forEach(t=>{
      const r=blank(); r["Campaign"]=p.campaign; r["Callout text"]=t; rows.push(r);});
    AS.sl.filter(s=>s[0]).forEach(s=>{
      const r=blank(); r["Campaign"]=p.campaign;
      r["Link text"]=s[0]; r["Description line 1"]=s[1]; r["Description line 2"]=s[2];
      r["Final URL"]=slUrl(s[0],s[3])||lp; rows.push(r);});
    AS.sn.forEach(([head,vals])=>{
      const v=vals.filter(x=>x.trim()); if(v.length<3)return;
      const r=blank(); r["Campaign"]=p.campaign;
      r["Structured snippet header"]=head; r["Structured snippet values"]=v.join(";"); rows.push(r);});
  });

  dl("google-ads-full-build.csv",
    hdr.map(csvq).join(",")+"\n"+rows.map(r=>hdr.map(k=>csvq(r[k])).join(",")).join("\n"));
  toast(`${rows.length} rows exported`);
});


