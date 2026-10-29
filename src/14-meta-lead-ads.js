/* ═══════════ 06 Meta lead ads ═══════════
   No landing page means no tracking parameters and no pinning. What carries
   the weight instead is the copy itself and the closing line, because the
   form opens in place and the reader never leaves the feed. */
const MT_P=125, MT_H=40, MT_D=30;
let MT={p:[],h:[],d:[]};
function mtGenerate(){
  const b=brief();
  if(!b.proj)return toast("Fill in the project name first");
  const u=b.usps.map(tc), m=b.marks.map(tc), a=b.amen.map(tc);
  const place=placeOf(b)||b.city||b.micro||"";
  const where=place?` at ${place}`:"";
  const price=pricePhrase();
  const cfg=b.cfg||"";
  const close=($("#mtClose")&&$("#mtClose").value.trim())||"Fill the form for floor plans and pricing.";
  const tick=$("#mtTicks")&&$("#mtTicks").checked?"\u2714 ":"\u2022 ";
  const emo=$("#mtEmoji")&&$("#mtEmoji").checked;
  const pin=emo?"\ud83d\udccd ":"";
  const nl="\n";

  const bullets=[cfg&&`${cfg}`, price, u[0], u[1], m[0]].filter(Boolean).slice(0,4);
  const fitJoin=(parts,max)=>{
    const p=parts.filter(Boolean);
    for(let n=p.length;n>0;n--){
      const s=p.slice(0,n).join(" ").replace(/\s{2,}/g," ").trim();
      if(s.length<=max)return s;
    }
    return p[0]||"";
  };
  const P=[
    fitJoin([`${b.proj}${where}.`, cfg&&price?`${cfg} ${price}.`:(cfg||price||""), u[0]?`${u[0]}.`:"", close],MT_P),
    `${pin}${b.proj}${where}${nl}${bullets.slice(0,3).map(x=>tick+x).join(nl)}${nl}${close}`,
    fitJoin([cfg?`Looking for ${cfg}${place?` in ${place}`:""}?`:`Looking for a home${place?` in ${place}`:""}?`,
     b.dev?`${b.proj} by ${b.dev}.`:`${b.proj}.`,
     u[0]?`${u[0]}.`:"", close],MT_P),
    fitJoin([m[0]?`${m[0]}.`:"", m[1]?`${m[1]}.`:"", `${b.proj}${where}.`,
     cfg&&price?`${cfg} ${price}.`:"", close],MT_P),
    `${b.offer||"Now launching"}: ${b.proj}${where}${nl}${[cfg,price,u[0]].filter(Boolean).map(x=>tick+x).join(nl)}${nl}${close}`
  ].filter(Boolean);

  const H=[
    joinParts(b.proj,b.micro),
    cfg&&price?`${cfg} ${price}`:"",
    b.proj,
    price?`${price}${place?` | ${place.split(",")[0]}`:""}`:"",
    cfg&&place?`${cfg} in ${place.split(",")[0]}`:"",
    b.dev?`${b.proj} by ${b.dev}`:"",
    u[0]||""
  ].filter(Boolean);

  const D=[
    place, u[0], price, b.dev?`By ${b.dev}`:"", cfg?`${cfg} available`:"", a[0]||"", m[0]||""
  ].filter(Boolean);

  const seen=new Set();
  MT.p=P.filter(x=>{const k=x.toLowerCase();if(seen.has(k))return false;seen.add(k);return true;})
    .sort((a,b2)=>a.length-b2.length).slice(0,5);
  MT.h=dedupe(H).map(x=>fit(x,MT_H)).filter(Boolean).slice(0,5);
  MT.d=dedupe(D).map(x=>fit(x,MT_D)).filter(Boolean).slice(0,5);
  drawMeta(); toast("Meta copy generated");
}
function mtLen(n,max){return n>max?"bad":n>max-4?"edge":"";}
function drawMeta(){
  $("#mtPrimary").innerHTML=MT.p.length?MT.p.map((t,i)=>{
    const n=t.length;
    return `<div style="margin-bottom:10px">
      <div class="acrow" style="grid-template-columns:26px 1fr 70px 30px;margin-bottom:4px">
        <span class="sr">${i+1}</span>
        <span class="mini">variant ${i+1}</span>
        <span class="len ${mtLen(n,MT_P)}">${n}/${MT_P}</span>
        <button class="del" data-mpx="${i}" aria-label="Remove">\u00d7</button></div>
      <textarea data-mp="${i}" rows="${Math.min(7,t.split("\n").length+2)}"
        style="font-family:var(--ui);font-size:13.5px">${esc(t)}</textarea>
      ${n>MT_P?`<div class="f-note" style="margin-top:4px">Shown before <b>See more</b>: \u201c${esc(t.slice(0,MT_P).replace(/\n/g," "))}\u2026\u201d</div>`:""}</div>`;}).join("")
    :`<div class="empty">Nothing yet. Generate from the brief.</div>`;
  $("#mtPStat").textContent=`${MT.p.length} variant${MT.p.length===1?"":"s"}`;

  const rows=(list,key,max)=>list.length?list.map((t,i)=>{
    const n=t.length;
    return `<div class="acrow" style="grid-template-columns:26px 1fr 62px 30px">
      <span class="sr">${i+1}</span>
      <input type="text" data-${key}="${i}" value="${esc(t)}" class="${n>max?"over":""}">
      <span class="len ${mtLen(n,max)}">${n}/${max}</span>
      <button class="del" data-${key}x="${i}" aria-label="Remove">\u00d7</button></div>`;}).join("")
    :`<div class="empty">Nothing yet.</div>`;
  $("#mtHeads").innerHTML=rows(MT.h,"mth",MT_H);
  $("#mtDescs").innerHTML=rows(MT.d,"mtd",MT_D);
  $("#mtHStat").textContent=`${MT.h.length} \u00b7 max ${MT_H}`;
  $("#mtDStat").textContent=`${MT.d.length} \u00b7 max ${MT_D}`;
}
on("#mtGen","click",mtGenerate);
on("#mtAddP","click",()=>{MT.p.push("");drawMeta();});
on("#mtAddH","click",()=>{MT.h.push("");drawMeta();});
on("#mtAddD","click",()=>{MT.d.push("");drawMeta();});
on("#mtPrimary","input",e=>{const i=e.target.dataset.mp;if(i===undefined)return;
  MT.p[+i]=e.target.value;
  const el=e.target.closest("div").previousElementSibling;
  const s=e.target.parentElement.querySelector(".len");
  if(s){s.textContent=`${e.target.value.length}/${MT_P}`;s.className="len "+mtLen(e.target.value.length,MT_P);}});
on("#mtPrimary","click",e=>{const i=e.target.dataset.mpx;if(i===undefined)return;MT.p.splice(+i,1);drawMeta();});
on("#mtHeads","input",e=>{const i=e.target.dataset.mth;if(i===undefined)return;
  MT.h[+i]=e.target.value;const s=e.target.nextElementSibling;
  s.textContent=`${e.target.value.length}/${MT_H}`;s.className="len "+mtLen(e.target.value.length,MT_H);
  e.target.classList.toggle("over",e.target.value.length>MT_H);});
on("#mtHeads","click",e=>{const i=e.target.dataset.mthx;if(i===undefined)return;MT.h.splice(+i,1);drawMeta();});
on("#mtDescs","input",e=>{const i=e.target.dataset.mtd;if(i===undefined)return;
  MT.d[+i]=e.target.value;const s=e.target.nextElementSibling;
  s.textContent=`${e.target.value.length}/${MT_D}`;s.className="len "+mtLen(e.target.value.length,MT_D);
  e.target.classList.toggle("over",e.target.value.length>MT_D);});
on("#mtDescs","click",e=>{const i=e.target.dataset.mtdx;if(i===undefined)return;MT.d.splice(+i,1);drawMeta();});
["mtTicks","mtEmoji","mtClose","mtCta"].forEach(id=>on("#"+id,"change",()=>{ if(MT.p.length)mtGenerate(); }));

function mtRows(){
  const b=brief(), cta=$("#mtCta")?$("#mtCta").value:"Learn More";
  const name=slug(b.proj||"project");
  const out=[];
  const n=Math.max(MT.p.length,MT.h.length,MT.d.length);
  for(let i=0;i<n;i++){
    const p=MT.p[i]||MT.p[0]||"", hd=MT.h[i]||MT.h[0]||"", ds=MT.d[i]||MT.d[0]||"";
    if(!p&&!hd)continue;
    out.push([`${name}-lead-v${i+1}`,p,hd,ds,cta,p.length,hd.length,ds.length]);
  }
  return out;
}
on("#mtCsv","click",()=>{
  const rows=mtRows(); if(!rows.length)return toast("Generate the copy first");
  dl("meta-lead-ad-copy.csv",
    ["Ad name","Primary text","Headline","Description","Call to action",
     "Primary length","Headline length","Description length"].map(csvq).join(",")+"\n"+
    rows.map(r=>r.map(csvq).join(",")).join("\n"));
  logEvent("export","meta copy");
});
on("#mtCopy","click",()=>{
  const rows=mtRows(); if(!rows.length)return toast("Generate the copy first");
  copy("Ad name\tPrimary text\tHeadline\tDescription\tCTA\n"+
    rows.map(r=>r.slice(0,5).join("\t")).join("\n"));
});
drawMeta();

/* ═══════════ 07 deploy to Google Ads ═══════════
   The browser never talks to Google Ads directly: there is no CORS on the
   API and a developer token in a page would be a token anyone can read. The
   Apps Script holds it and does the calling, as the account that deployed
   the script, so there is no refresh token anywhere either. */
/* The radius circles and any pincode that has found its criterion ID. The
   account puts location on the campaign for both channels, so a Demand Gen
   campaign is created with upgraded targeting off \u2014 which is also the only
   way a radius can be used, since ProximityInfo is a campaign criterion and
   does not exist on an ad group at all. */
function mapTargets(){
  return {
    proximity:TARGETS.filter(t=>t.kind==="radius").map(t=>({
      lat:t.lat,lng:t.lng,radius:t.radius,units:t.units||"KILOMETERS"})),
    /* a city and a pincode are the same thing to the API: a geo target
       constant. Only the way they were found here differs. */
    pinIds:TARGETS.filter(t=>t.kind!=="radius"&&t.id).map(t=>String(t.id)),
    missing:TARGETS.filter(t=>t.kind!=="radius"&&!t.id).length
  };
}
function apSettings(){
  const S={
    dailyBudget : num($("#cgBudget").value)||1000,
    cpc         : num($("#cgCpc").value)||null,
    status      : ($("#cgStatus").value||"Paused").toUpperCase()==="ENABLED"?"ENABLED":"PAUSED",
    bidStrategy : $("#cgBid").value||"Maximize conversions",
    presence    : ($("#cgPresence")&&$("#cgPresence").value)||"PRESENCE",
    euPolitical : ($("#cgEuPol")&&$("#cgEuPol").value)||"DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING",
    locationIds : lines($("#apLocIds").value).map(x=>x.replace(/[^0-9]/g,"")).filter(Boolean),
    languageIds : ["1000"],
    negKeywords : lines($("#negExtra")?$("#negExtra").value:""),
    sharedSets  : [...($("#negLists")?$("#negLists").selectedOptions:[])].map(o=>o.value).filter(Boolean),
    exAge       : demoPicked("age"),
    exGender    : demoPicked("gen"),
    exIncome    : demoPicked("inc"),
    exParental  : demoPicked("par"),
    /* This account targets on the campaign for both channels, so Demand Gen
       is created with upgraded targeting off. That is also what makes a
       radius possible at all. */
    upgradedTargeting : false
  };
  const t=mapTargets();
  if(t.proximity.length)S.proximity=t.proximity;
  t.pinIds.forEach(id=>{ if(S.locationIds.indexOf(id)===-1)S.locationIds.push(id); });
  S.radiusCount=t.proximity.length;
  S.noIdCount=t.missing;
  return S;
}
function drawApSettings(){
  const S=apSettings();
  const row=(l,v,good)=>`<div class="apg"><span>${esc(l)}</span>
    <span class="pill ${good===false?"p-warn":"p-ok"}">${esc(v)}</span></div>`;
  const dg=CH==="demandgen";
  const common=
    row("Campaign type",dg?"Demand Gen":"Search")+
    row("Status on creation",S.status==="ENABLED"?"Enabled":"Paused")+
    row("Daily budget",S.dailyBudget)+
    row("Bid strategy",dg&&/manual/i.test(S.bidStrategy)?"Maximize conversions (Manual CPC n/a)":S.bidStrategy,
      !(dg&&/manual/i.test(S.bidStrategy)))+
    row("Location setting",S.presence==="PRESENCE"?"Presence only":"Presence or interest",S.presence==="PRESENCE")+
    row("EU political ads",S.euPolitical.indexOf("DOES_NOT")===0?"Declared No":"Declared Yes",S.euPolitical.indexOf("DOES_NOT")===0)+
    row("Locations",S.locationIds.length?S.locationIds.join(", "):"none set",
      !!(S.locationIds.length||(S.proximity||[]).length))+
    (S.noIdCount?row("Without a criterion ID",`${S.noIdCount} not targeted`,false):"")+
    row("Radius targets",(S.proximity||[]).length
      ?(S.proximity||[]).map(x=>`${x.radius}${x.units==="MILES"?"mi":"km"}`).join(", ")
      :"none")+
    row("Tracking template","Ad group level")+
    row("Age excluded",S.exAge.length?S.exAge.map(x=>x.replace("AGE_RANGE_","").replace("_UP","+").replace("_","-")).join(", "):"none")+
    row("Income excluded",S.exIncome.length?`${S.exIncome.length} band${S.exIncome.length===1?"":"s"}`:"none")+
    row("Gender excluded",S.exGender.length?S.exGender.join(", ").toLowerCase():"none");
  if(dg){
    /* what a Demand Gen deploy actually carries \u2014 pictures on the ad, and
       the two Search-only things it cannot take, named rather than hidden */
    const cre=typeof CR_OUT!=="undefined"?CR_OUT.length:0;
    const hasLogo=typeof CR!=="undefined"&&!!CR.logo;
    const bn=($("#asBizName")&&$("#asBizName").value.trim())||"";
    const auds=pickedAudiences();
    const withId=auds.filter(a=>a[2]).length;
    $("#apSettings").innerHTML=common+
      row("Surfaces","All Demand Gen placements")+
      row("Creative sizes",cre?`${cre} rendered`:"none \u2014 render on tab 08",!!cre)+
      (()=>{const n=typeof CR_SETS!=="undefined"?CR_SETS.length:0;
        return row("Ads per ad group",n?`${n} \u2014 one per kept set`:"1 \u2014 what is on screen",true);})()+
      row("Logo image",hasLogo?"uploaded":"missing \u2014 required",hasLogo)+
      row("Business name",bn||"not set",!!bn)+
      row("Audience segments",auds.length?`${auds.length} picked, ${withId} with an ID`:"none",
        !auds.length||!!withId)+
      row("Negative keywords","not supported on Demand Gen",false)+
      row("Negative lists","not supported on Demand Gen",false)+
      row("Demographics",(S.exAge.length||S.exGender.length||S.exIncome.length)
        ?"as an audience on the ad group":"all, no audience needed")+
      row("Location & language","on the campaign \u2014 upgraded targeting off")+
      `<div class="f-note" style="margin-top:10px">Demand Gen hangs its images off the ad, so the
        Creative studio renders and the logo are sent with the campaign. The campaign is created with
        <b>upgraded targeting off</b>, which keeps location, language and the demographic exclusions on
        the campaign the way Search has them \u2014 and is the only way a radius can be used, since
        ProximityInfo is a campaign criterion and does not exist on an ad group. Audience segments
        still attach to the ad group; ones without an ID are skipped rather than guessed.</div>`;
    return;
  }
  $("#apSettings").innerHTML=common+
    row("Search partners","Off")+
    row("Display network","Off")+
    row("Negative lists",S.sharedSets.length?`${S.sharedSets.length} attached`:"none")+
    row("Extra negatives",S.negKeywords.length||"none")+
    row("Exact negated in phrase",
      ($("#negExactInPhrase")&&$("#negExactInPhrase").checked)?"yes":"no")+
    row("Business name",($("#asBizName")&&$("#asBizName").value.trim())||"not set",
      !!($("#asBizName")&&$("#asBizName").value.trim()))+
    row("Images",Object.keys(IMGS).filter(k=>IMGS[k]&&IMGS[k].data).length||"none")+
    `<div class="f-note" style="margin-top:10px">Presence and the EU political declaration are set on the
      campaign itself through the API \u2014 neither has an Editor CSV column, which is why they had to be
      clicked by hand before.</div>`;
}
["cgBudget","cgCpc","cgStatus","cgBid","cgPresence","cgEuPol","apLocIds"].forEach(id=>{
  const el=$("#"+id); if(el)el.addEventListener("change",drawApSettings);
  if(el)el.addEventListener("input",drawApSettings);
});
function apPlan(){
  if(!PLAN.length)return null;
  const lp=PROJ.url||$("#inLp").value.trim();
  return {
    /* the paths ride inside the ad, so the same spacing rule applies */
    channel:CH, finalUrl:lp, path1:adText(PROJ.p1), path2:adText(PROJ.p2),
    settings:apSettings(),
    campaigns:PLAN.map(p=>({
      name:p.campaign,
      strategy:p.strat||"",
      /* Google puts location on the campaign, so this is where it belongs.
         With one set these are the same for every campaign and the backend
         cannot tell the difference. */
      locationIds:locCriteria(locSetFor(p.campaign)).locationIds,
      proximity:locCriteria(locSetFor(p.campaign)).proximity,
      locationSet:locSetName(locSetFor(p.campaign)),
      adgroups:p.groups.map((g,gi)=>({
        name:g.name, matchType:g.mt||"B",
        trackingTemplate:TPL[CH],
        params:{adgroup:paramVal(g.n.adgroup),campaign:paramVal(g.n.campaign),strategy:paramVal(g.n.strategy)},
        keywords:g.kws,
        /* the exact ad group's own list, negated inside the phrase one */
        negExact:(g.mt==="P"&&$("#negExactInPhrase")&&$("#negExactInPhrase").checked)
          ? (p.groups.find(x=>x.mt==="E")||{kws:[]}).kws : [],
        /* Each strategy is meant to reach different people \u2014 that is why four
           of them are run. Handing every campaign the same audience made them
           four copies of one campaign. */
        audiences:CH==="demandgen" ? audiencesFor(p.strat) : [],
        /* Demand Gen ads are not responsive search ads: five headlines under 40
           carrying brand, project and location, and five descriptions under 90.
           The build fills g.ad with the Search copy, so the Demand Gen copy is
           taken from the same generator the export uses. */
        /* the last thing before it leaves the browser: one comma without a
           space behind it is a PROHIBITED policy topic and loses the campaign */
        headlines:adTextRows(CH==="demandgen"
          ? dgAdFinal(gi).h.filter(Boolean).map(t=>[t,""])
          : (ADG[g.name]?ADG[g.name].h:g.ad.h).filter(r=>r&&r[0]&&r[0].trim())),
        descriptions:adTextRows(CH==="demandgen"
          ? dgAdFinal(gi).d.filter(Boolean).map(t=>[t,""])
          : (ADG[g.name]?ADG[g.name].d:g.ad.d).filter(r=>r&&r[0]&&r[0].trim()))
      }))
    })),
    assets:{
      callouts:AS.co.filter(Boolean),
      sitelinks:AS.sl.filter(x=>x[0]).map(x=>[x[0],x[1],x[2],slUrl(x[0],x[3])||lp]),
      snippets:AS.sn.map(([h,v])=>[h,v.filter(x=>x.trim())]).filter(x=>x[1].length>=3),
      businessName:($("#asBizName")&&$("#asBizName").value.trim())||"",
      /* the preview data URL stays in the browser; only the bytes travel */
      logo:      IMGS.logo      ?{data:IMGS.logo.data}      :null,
      square:    IMGS.square    ?{data:IMGS.square.data}    :null,
      landscape: IMGS.landscape ?{data:IMGS.landscape.data} :null
    },
    /* Demand Gen hangs its pictures off the ad, not the campaign, so the
       Creative studio renders travel with the plan. Search ignores them. */
    creatives: CH==="demandgen"?dgCreatives():null,
    creativeSets: CH==="demandgen"?dgCreativeSets():null,

    businessName:($("#asBizName")&&$("#asBizName").value.trim())||dgAdFinal(0).bn||"",
    cta:"Learn more"
  };
}
/* the logo is an uploaded image, not a render, so it is drawn to a square
   canvas first \u2014 Google wants a 1:1 logo and refuses an odd ratio */
function dgLogo(){
  if(typeof CR==="undefined"||!CR.logo)return null;
  try{
    const c=document.createElement("canvas"); c.width=c.height=1200;
    const g=c.getContext("2d");
    g.fillStyle="#FFFFFF"; g.fillRect(0,0,1200,1200);
    const im=CR.logo, r=Math.min(1080/im.naturalWidth,1080/im.naturalHeight);
    const w=im.naturalWidth*r, h=im.naturalHeight*r;
    g.drawImage(im,(1200-w)/2,(1200-h)/2,w,h);
    return {data:c.toDataURL("image/jpeg",0.92).split(",")[1]};
  }catch(e){ return null; }
}
/* the four rendered sizes plus the logo, as raw base64 */
function dgCreatives(){
  const out={};
  (typeof CR_OUT!=="undefined"?CR_OUT:[]).forEach(o=>{
    const b64=String(o.url||"").split(",")[1];
    if(b64)out[o.name]={data:b64};
  });
  const lg=dgLogo(); if(lg)out.logo=lg;
  return out;
}
/* Every kept set, each of which becomes its own ad. Nothing kept and
   something on screen means he rendered and went straight to deploy, so what
   is on screen is used as the single set rather than refusing. */
function dgCreativeSets(){
  const all=(typeof allSets==="function")?allSets():[];
  if(all.length)return all.map(s=>({name:s.name,images:s.images}));
  const one=dgCreatives();
  return Object.keys(one).length?[{name:"Creative",images:one}]:[];
}
/* the campaign -> set dropdowns are redrawn constantly, so the handler
   lives on the container rather than on each select */
on("#apPlan","change",e=>{
  const sel=e.target&&e.target.closest("select[data-cset]");
  if(!sel)return;
  LOCPICK[sel.dataset.cset]=sel.value; saveLocPick();
  drawApPlan();
});

function drawApPlan(){
  const pl=apPlan();
  if(!pl){ $("#apPlan").innerHTML=`<div class="empty">Build the structure on tab 05 first.</div>`;
    $("#apPlanStat").textContent="no structure built"; return; }
  const ags=pl.campaigns.reduce((a,c)=>a+c.adgroups.length,0);
  const kws=pl.campaigns.reduce((a,c)=>a+c.adgroups.reduce((b,g)=>b+g.keywords.length,0),0);
  const imgN=["logo","square","landscape"].filter(k=>pl.assets[k]).length;
  const bizN=pl.assets.businessName?1:0;
  const extra=pl.settings.negKeywords.length+pl.settings.sharedSets.length+
    pl.settings.exAge.length+pl.settings.exGender.length+pl.settings.exIncome.length;
  /* each campaign's own places, since that is what will be sent for it */
  const ops=pl.campaigns.map(c=>2+(c.locationIds||[]).length+(c.proximity||[]).length+1+extra+
    c.adgroups.length*2+c.adgroups.reduce((b,g)=>b+g.keywords.length+(g.negExact||[]).length,0)+
    (pl.assets.callouts.length+pl.assets.sitelinks.length+pl.assets.snippets.length+imgN+bizN)*2);
  $("#apPlanStat").textContent=`${pl.campaigns.length} campaigns \u00b7 ${ags} ad groups`;
  const thin=[];
  const dg=CH==="demandgen";
  /* Demand Gen wants at least one of each; Search needs 3 and 2 */
  const minH=dg?1:3, minD=dg?1:2;
  pl.campaigns.forEach(c=>c.adgroups.forEach(g=>{
    if(g.headlines.length<minH||g.descriptions.length<minD)
      thin.push(`${g.name} \u2014 ${g.headlines.length} headlines, ${g.descriptions.length} descriptions`);
  }));
  /* With more than one set, each campaign chooses its own places here —
     which is the only level Google accepts them at. */
  const manySets=LOCSETS.length>1;
  $("#apPlan").innerHTML=
    pl.campaigns.map((c,i)=>{
      const crit=locCriteria(locSetFor(c.name));
      const where=crit.locationIds.length||crit.proximity.length
        ? `${crit.locationIds.length?`${crit.locationIds.length} place${crit.locationIds.length===1?"":"s"}`:""}${
            crit.locationIds.length&&crit.proximity.length?" · ":""}${
            crit.proximity.length?`${crit.proximity.length} radius`:""}`
        : "nothing targeted";
      return manySets
        ? `<div class="cmpset">
             <div><div class="nm">${esc(c.name)}</div>
               <div class="sub">${c.adgroups.length} ad groups · ${ops[i]} operations · ${esc(where)}</div></div>
             <select class="hdr-sel" data-cset="${esc(c.name)}" style="max-width:100%">${
               LOCSETS.map(st=>`<option value="${esc(st.id)}"${
                 st.id===locSetFor(c.name)?" selected":""}>${esc(st.name)}</option>`).join("")}</select>
           </div>`
        : `<div class="apg"><span style="font-family:var(--mono);font-size:12px">${esc(c.name)}</span>
             <span class="pill p-mute">${c.adgroups.length} ad groups \u00b7 ${ops[i]} operations</span></div>`;
    }).join("")+
    (dg?"":`<div class="apg"><span>Keywords</span><span class="pill p-mute">${kws}</span></div>`)+
    (dg?"":`<div class="apg"><span>Assets, on every campaign</span><span class="pill p-mute">${pl.assets.callouts.length} callouts \u00b7 ${pl.assets.sitelinks.length} sitelinks \u00b7 ${pl.assets.snippets.length} snippets${imgN?` \u00b7 ${imgN} image${imgN===1?"":"s"}`:""}${bizN?" \u00b7 business name":""}</span></div>`)+
    (dg?"":`<div class="apg"><span>Negatives</span><span class="pill p-mute">${pl.settings.negKeywords.length} typed \u00b7 ${pl.settings.sharedSets.length} list${pl.settings.sharedSets.length===1?"":"s"} \u00b7 ${pl.campaigns.reduce((a2,c)=>a2+c.adgroups.reduce((b2,g)=>b2+(g.negExact||[]).length,0),0)} exact-in-phrase</span></div>`)+
    /* On Demand Gen the business name and logo live inside the ad, so none of
       the Search account-verification story applies \u2014 they are simply
       required, and the deploy refuses without them. */
    (dg?(()=>{
      const cre=(pl.creatives&&Object.keys(pl.creatives).length)||0;
      const hasLogo=!!(pl.creatives&&pl.creatives.logo);
      const miss=[];
      if(!pl.businessName)miss.push("business name (Assets tab)");
      if(!hasLogo)miss.push("logo (Creative studio tab)");
      if(!cre||(!(pl.creatives.landscape)&&!(pl.creatives.square)))
        miss.push("a landscape or square image (Creative studio tab)");
      return miss.length
        ? `<div class="check c-bad" style="margin-top:10px"><span class="ic">\u2715</span><span>
            <b>Demand Gen will not deploy without ${miss.length===1?"this":"these"}:</b>
            ${miss.map(esc).join(", ")}. They go inside the ad itself.</span></div>`
        : `<div class="check c-ok" style="margin-top:10px"><span class="ic">\u2713</span><span>
            <b>Business name, logo and ${cre-1} image${cre-1===1?"":"s"} ride inside the ad.</b>
            No account verification is involved on Demand Gen.</span></div>`;
    })():
    ((bizN||pl.assets.logo)?`<div class="check c-warn" style="margin-top:10px"><span class="ic">!</span><span>
      <b>Business name and logo need a verified account.</b> They are sent in their own call after the
      campaign, so a refusal on a test account leaves everything else standing.</span></div>`:"")+
    (bizN&&!pl.assets.logo?`<div class="check c-warn" style="margin-top:10px"><span class="ic">!</span><span>
      <b>Business name set but no logo.</b> Google shows the two together or not at all, so neither will appear.</span></div>`:"")+
    (!bizN&&pl.assets.logo?`<div class="check c-warn" style="margin-top:10px"><span class="ic">!</span><span>
      <b>Logo set but no business name.</b> Google needs both before either shows.</span></div>`:""))+
    /* a radius is a location too — warning about "no location" while circles
       sit on the map was simply wrong */
    ((()=>{
      /* a campaign with an empty set runs everywhere, which is the expensive
         mistake this whole section exists to prevent */
      const bare=pl.campaigns.filter(c=>{
        const cr=locCriteria(locSetFor(c.name));
        return !cr.locationIds.length&&!cr.proximity.length;
      });
      if(!bare.length)return "";
      return `<div class="check c-warn" style="margin-top:10px"><span class="ic">!</span><span>
        <b>${bare.length===pl.campaigns.length?"Nothing targeted."
          :`${bare.length} campaign${bare.length===1?"":"s"} with no location.`}</b>
        Without a city, a pincode or a radius ${bare.length===pl.campaigns.length?"the campaign runs":"they run"}
        everywhere.${bare.length===pl.campaigns.length?"":` <span class="p-mute">${
          esc(bare.map(c=>c.name).join(", "))}</span>`}
        Set it under Locations on the left.</span></div>`;
    })())+
    (pl.settings.noIdCount?`<div class="check c-warn" style="margin-top:10px"><span class="ic">!</span><span>
      <b>${pl.settings.noIdCount} location${pl.settings.noIdCount===1?"":"s"} without a criterion ID.</b>
      Those are not being targeted. Press <b>Look up the missing IDs again</b> under Locations.</span></div>`:"")+
    /* spacing is a PROHIBITED topic, so it does not warn — it loses the whole
       campaign. Caught here, before it costs a deploy. */
    (()=>{ const bad=[];
      pl.campaigns.forEach(c2=>c2.adgroups.forEach(g=>{
        [...(g.headlines||[]),...(g.descriptions||[])].forEach(r=>{
          const t=(r&&r[0])||""; if(t&&adText(t)!==t)bad.push(t);
        });
      }));
      if(!bad.length)return "";
      return `<div class="check c-bad" style="margin-top:10px"><span class="ic">✕</span><span>
        <b>${bad.length} line${bad.length===1?"":"s"} would be refused for spacing.</b> Google treats a
        comma with no space after it as a PROHIBITED policy topic and rolls the whole campaign back.
        <code>${esc(bad.slice(0,3).join(" · "))}</code></span></div>`;
    })()+
    (thin.length?`<div class="check c-bad" style="margin-top:10px"><span class="ic">\u2715</span><span>
      <b>Google will reject these ad groups</b> \u2014 it needs ${minH} headline${minH===1?"":"s"} and
      ${minD} description${minD===1?"":"s"}:<br>${thin.map(esc).join("<br>")}</span></div>`:"");
}
async function adsCall(action,extra){
  if(!AUTH.logUrl)return {error:"No Apps Script URL is set."};
  if(!USER)return {error:"Sign in first."};
  if(!tokenLive()){
    /* try to replace it quietly before giving up on the call */
    const ok=await renewToken();
    if(!ok||!tokenLive()){
      tokenPanel();
      return {error:"Your Google sign-in expired and could not be renewed. Sign in again, then retry."};
    }
  }
  try{
    /* A read can wait on Gemini retrying a busy model, so it is given longer
       than the other calls — and when it does run out, it says so in words. */
    const slow=/^(ai-|extract|read-|classify-)/.test(action);
    const ctl=new AbortController(), bail=setTimeout(()=>ctl.abort(),slow?300000:120000);
    const r=await fetch(AUTH.logUrl,{method:"POST",signal:ctl.signal,
      headers:{"Content-Type":"text/plain;charset=utf-8"},
      body:JSON.stringify(Object.assign({action,credential:USER.credential},extra||{}))});
    clearTimeout(bail);
    if(!r.ok)return {error:`Apps Script returned ${r.status}. Redeploy it as a new version.`};
    return await r.json();
  }catch(e){
    if(e&&(e.name==="AbortError"||/abort/i.test(String(e.message||e))))
      return {error:"The Apps Script took too long and the request was given up on. "+
        "Gemini was probably retrying a busy model \u2014 press it again."};
    return {error:"Could not reach the Apps Script: "+((e&&e.message)||e)};
  }
}
const apLine=(l,ic,h)=>`<div class="check c-${l}"><span class="ic">${ic}</span><span>${h}</span></div>`;
/* One real failure makes every operation that referenced it fail too, so the
   API answers with the cause once and "Resource was not found" eighty times.
   The cascade is noise \u2014 the first real message is the whole story. */
function explainErr(raw){
  const parts=String(raw||"").split(" | ").map(x=>x.trim()).filter(Boolean);
  const real=parts.filter(x=>!/Resource was not found/i.test(x));
  const cascade=parts.length-real.length;
  const first=real[0]||parts[0]||"";
  let plain="";
  if(/Customer is not verified/i.test(first))
    plain=`<b>The account is not verified with Google.</b> Business name, logo and images need advertiser
      verification, and a test account can never pass it \u2014 there is no business to verify. These will
      work on a real client account once it is verified. Everything else deployed normally.`;
  else if(/field type is incompatible with the given campaign type/i.test(first))
    plain=`<b>That asset type does not belong on a Search campaign.</b> Build b-19oct-4 moved images to
      <code>AD_IMAGE</code> and business name and logo to account level. If you still see this, you are on
      an older build \u2014 hard refresh with Ctrl+Shift+R.`;
  else if(/name is already assigned to another active or paused campaign/i.test(first))
    plain=`<b>These campaigns already exist in this account.</b> Nothing was created again \u2014 Google will not
      allow two campaigns with the same name. Check the account first: if the earlier deploy worked, you are done.
      To build them again, rename them (change the enquiry name or ticket size on tab 01) or remove the old ones.`;
  else if(/policy summary includes policy topics|disapproved since the policy/i.test(first)){
    /* The campaign, the ad group and the keywords were all fine — Google
       refused the AD, on policy. The operation is all-or-nothing, so the
       campaign was rolled back with it. */
    const topics=/POLICY:/.test(first)?first.split("POLICY:")[1].trim():"";
    plain=`<b>Google refused the ad on policy grounds, not the toolkit.</b> Everything up to the ad was
      accepted; a campaign is all or nothing, so it was rolled back with the ad.`+
      (topics?`<br><br><b>The policy topic:</b> <code>${esc(topics)}</code>`
            :`<br><br>Google did not name the topic in this answer. The build below surfaces it when
              Google sends it — hard refresh and run <b>Validate</b> again to see which one.`)+
      `<br><br>A <b>PROHIBITED</b> topic cannot be appealed away from here; the copy, the landing page or
      the account has to change. The usual three on Indian real estate are the landing page being
      unreachable or redirecting from the domain in the ad, a trademark the account is not cleared to
      use, and a claim that reads as a guarantee. The landing page is the one to check first.`;
  }
  else if(/RESOURCE_EXHAUSTED|quota/i.test(first))
    plain=`<b>Daily operation limit reached.</b> A Test or Basic developer token allows 15,000 operations a day.`;
  else if(/CUSTOMER_NOT_ENABLED|account is not active/i.test(first))
    plain=`<b>That account is not active.</b> Check its status in Google Ads.`;
  const detail=real.slice(0,4).map(esc).join("<br>");
  return (plain?plain+`<div class="mini" style="margin-top:8px">${detail}</div>`:detail)+
    (cascade?`<div class="mini" style="margin-top:6px">and ${cascade} follow-on error${cascade===1?"":"s"}
      caused by the one above \u2014 nothing partial was created.</div>`:"");
}
on("#apCheck","click",async()=>{
  gaConnStatus();
  const cid=$("#apCid").value.replace(/[^0-9]/g,"");
  if(!cid)return toast("Put the customer ID in first");
  $("#apStat").innerHTML=`<span class="pill p-mute">checking\u2026</span>`;
  $("#apCheckOut").innerHTML=apLine("warn","\u2026","Asking Google\u2026");
  const r=await adsCall("ads-check",{customerId:cid});
  if(r.error){
    $("#apStat").innerHTML=`<span class="pill p-bad">not connected</span>`;
    $("#apCheckOut").innerHTML=apLine("bad","\u2715",`<b>Not connected.</b> ${esc(r.error)}`)+
      apLine("warn","!","Work through <b>Set up once</b> on the right. The step people miss is the adwords scope in <code>appsscript.json</code> and running <code>adsSelfTest()</code>.");
    return;
  }
  const c=r.customer||{};
  $("#apStat").innerHTML=`<span class="pill p-ok">connected</span>`;
  $("#apCheckOut").innerHTML=
    apLine("ok","\u2713",`<b>${esc(c.name||cid)}</b> \u2014 ${esc(c.currency||"?")}, status ${esc(c.status||"?")}, API ${esc(r.version)}`)+
    (c.test?apLine("ok","\u2713","<b>This is a test account.</b> It never serves an ad and never spends \u2014 the right place to trial this.")
           :apLine("warn","!","<b>This is a live account.</b> Campaigns are created paused, but they are real. Deploy only when you mean it."))+
    ((r.notes||[]).length?apLine("warn","!",(r.notes||[]).map(esc).join("<br>")):"")+
    apLine("ok","\u2713",`${(r.accessible||[]).length} account${(r.accessible||[]).length===1?"":"s"} reachable with these credentials.`);
});
