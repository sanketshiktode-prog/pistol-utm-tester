/* ═══════════ one file: campaigns, ad groups, keywords, ads, assets ═══════════
   Ads Editor reads a single CSV where every row shares the same columns and
   the populated cells decide the row type. Empty cells are expected. */
/* Editor rejects brackets and quotes inside keyword text. Google's spec
   wants plain text plus a match-type column. */
const MT_CRIT={E:"Exact",P:"Phrase",B:"Broad"};
function masterCsv(){
  const H=[];
  H.push("Campaign","Campaign Type","Campaign Status","Budget","Budget type","Bid Strategy Type","Networks",
    "Ad group","Ad Group Status","Max CPC","Tracking template","Custom parameter",
    "Keyword","Match type","Status","Final URL","Path 1","Path 2");
  for(let i=1;i<=H_CAP;i++)H.push(`Headline ${i}`,`Headline ${i} position`);
  for(let i=1;i<=D_CAP;i++)H.push(`Description ${i}`,`Description ${i} position`);
  H.push("Callout text","Link text","Description line 1","Description line 2",
    "Structured snippet header","Structured snippet values");
  const idx={}; H.forEach((k,i)=>{ if(!(k in idx))idx[k]=i; });
  const blank=()=>new Array(H.length).fill("");
  const put=(r,k,v)=>{ if(idx[k]!==undefined)r[idx[k]]=v==null?"":String(v); };
  const rows=[];
  const lp=PROJ.url||$("#inLp").value.trim();
  const budget=$("#cgBudget")?$("#cgBudget").value.trim():"";
  const cpc=$("#cgCpc")?$("#cgCpc").value.trim():"";
  const cstat=$("#cgStatus")?$("#cgStatus").value:"Paused";
  const bid=$("#cgBid")?$("#cgBid").value:"Maximize conversions";
  const seenCamp=new Set();

  PLAN.forEach(p=>{
    if(!seenCamp.has(p.campaign)){
      seenCamp.add(p.campaign);
      const r=blank();
      put(r,"Campaign",p.campaign); put(r,"Campaign Type","Search");
      put(r,"Campaign Status",cstat); put(r,"Budget",budget);
      put(r,"Budget type","Daily"); put(r,"Bid Strategy Type",bid);
      put(r,"Networks","Google Search");
      rows.push(r);
    }
    p.groups.forEach(g=>{
      const a=blank();
      put(a,"Campaign",p.campaign); put(a,"Ad group",g.name);
      put(a,"Ad Group Status","Enabled"); put(a,"Max CPC",cpc);
      put(a,"Tracking template",TPL[CH]); put(a,"Custom parameter",custParam(g.n));
      rows.push(a);

      g.kws.forEach(k=>{
        const r=blank();
        put(r,"Campaign",p.campaign); put(r,"Ad group",g.name);
        put(r,"Keyword",k);
        put(r,"Match type",MT_CRIT[g.mt]||"Broad");
        put(r,"Status","Enabled");
        rows.push(r);
      });

      const ad=blank();
      put(ad,"Campaign",p.campaign); put(ad,"Ad group",g.name);
      put(ad,"Status","Enabled"); put(ad,"Final URL",lp);
      put(ad,"Path 1",PROJ.p1); put(ad,"Path 2",PROJ.p2);
      for(let i=0;i<H_CAP;i++){ const x=g.ad.h[i];
        if(x&&x[0]){ put(ad,`Headline ${i+1}`,x[0]); put(ad,`Headline ${i+1} position`,x[1]||""); } }
      for(let i=0;i<D_CAP;i++){ const x=g.ad.d[i];
        if(x&&x[0]){ put(ad,`Description ${i+1}`,x[0]); put(ad,`Description ${i+1} position`,x[1]||""); } }
      rows.push(ad);
    });
  });

  /* assets go against the first campaign only — copy them across in Editor */
  [...seenCamp].slice(0,1).forEach(camp=>{
    AS.co.filter(Boolean).forEach(t=>{
      const r=blank(); put(r,"Campaign",camp); put(r,"Callout text",t);
      put(r,"Status","Enabled"); rows.push(r);
    });
    AS.sl.filter(x=>x[0]).forEach(s=>{
      const r=blank(); put(r,"Campaign",camp);
      put(r,"Link text",s[0]); put(r,"Description line 1",s[1]);
      put(r,"Description line 2",s[2]); put(r,"Final URL",slUrl(s[0],s[3])||lp);
      put(r,"Status","Enabled"); rows.push(r);
    });
    AS.sn.forEach(([hd,vals])=>{
      const v=vals.filter(x=>x.trim()); if(v.length<3)return;
      const r=blank(); put(r,"Campaign",camp);
      put(r,"Structured snippet header",hd);
      put(r,"Structured snippet values",v.join(";"));
      put(r,"Status","Enabled"); rows.push(r);
    });
  });
  return H.map(csvq).join(",")+"\n"+rows.map(r=>r.map(csvq).join(",")).join("\n");
}
/* One combined sheet forces Editor to guess each row's entity from which
   cells are filled, and it guessed wrong: keyword rows came back as
   "Ambiguous row type" because the file also carried a Campaign Type
   column. Separate files remove the guesswork — each one holds a single
   entity and only the columns that entity uses. */
function entityFiles(){
  const lp=PROJ.url||$("#inLp").value.trim();
  const budget=$("#cgBudget")?$("#cgBudget").value.trim():"";
  const cpc=$("#cgCpc")?$("#cgCpc").value.trim():"";
  const cstat=$("#cgStatus")?$("#cgStatus").value:"Paused";
  const bid=$("#cgBid")?$("#cgBid").value:"Maximize conversions";
  const mk=(hdr,rows)=>hdr.map(csvq).join(",")+"\n"+rows.map(r=>r.map(csvq).join(",")).join("\n");
  const files=[];

  const camps=[...new Set(PLAN.map(p=>p.campaign))];
  const isDG=CH==="demandgen";
  const euVal=($("#cgEuPol")&&$("#cgEuPol").value)||"DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING";
  const EUPOL=euVal==="CONTAINS_EU_POLITICAL_ADVERTISING"
    ? "Yes, has EU political ads" : "No, doesn't have EU political ads";
  const presence=($("#cgPresence")&&$("#cgPresence").value)||"PRESENCE";
  files.push(["1-campaigns.csv",isDG
    ? mk(["Campaign","Campaign Type","Campaign Status","Budget","Budget type","Bid Strategy Type","EU political ads"],
        camps.map(c=>[c,"Demand Gen",cstat,budget,"Daily",bid,EUPOL]))
    : mk(["Campaign","Campaign Type","Campaign Status","Budget","Budget type","Bid Strategy Type","Networks","EU political ads"],
        camps.map(c=>[c,"Search",cstat,budget,"Daily",bid,"Google Search",EUPOL]))]);

  const ag=[]; PLAN.forEach(p=>p.groups.forEach(g=>
    ag.push([p.campaign,g.name,"Enabled",cpc,TPL[CH],custParam(g.n)])));
  files.push(["2-adgroups.csv",mk(
    ["Campaign","Ad group","Ad Group Status","Max CPC","Tracking template","Custom parameter"],ag)]);

  if(!isDG){
    const kw=[]; PLAN.forEach(p=>p.groups.forEach(g=>g.kws.forEach(k=>
      kw.push([p.campaign,g.name,k,MT_CRIT[g.mt]||"Broad","Enabled"]))));
    files.push(["3-keywords.csv",mk(
      ["Campaign","Ad group","Keyword","Match type","Status"],kw)]);
  }

  const adHdr=["Campaign","Ad group","Status","Final URL","Path 1","Path 2"];
  for(let i=1;i<=H_CAP;i++)adHdr.push(`Headline ${i}`,`Headline ${i} position`);
  for(let i=1;i<=D_CAP;i++)adHdr.push(`Description ${i}`,`Description ${i} position`);
  const ads=[]; PLAN.forEach(p=>p.groups.forEach(g=>{
    const r=[p.campaign,g.name,"Enabled",lp,PROJ.p1,PROJ.p2];
    for(let i=0;i<H_CAP;i++)r.push(g.ad.h[i]&&g.ad.h[i][0]?g.ad.h[i][0]:"",g.ad.h[i]&&g.ad.h[i][0]?(g.ad.h[i][1]||""):"");
    for(let i=0;i<D_CAP;i++)r.push(g.ad.d[i]&&g.ad.d[i][0]?g.ad.d[i][0]:"",g.ad.d[i]&&g.ad.d[i][0]?(g.ad.d[i][1]||""):"");
    ads.push(r);}));
  if(isDG){
    const ad=dgAdFinal(0);
    const hdr=["Campaign","Ad group","Ad name","Business name"];
    for(let i=1;i<=5;i++)hdr.push(`Headline ${i}`);
    hdr.push("Long headline");
    for(let i=1;i<=5;i++)hdr.push(`Description ${i}`);
    hdr.push("Final URL","Call to action text","Status");
    const fmts=creativeFormats(), rows=[];
    PLAN.forEach(p=>p.groups.forEach(g=>{
      fmts.forEach((fmt,fi)=>{
        /* the same copy the deploy sends, hand edits included \u2014 the export
           and the API must not disagree about what the ad says */
        const a2=dgAdFinal(fi);
        const r=[p.campaign,g.name,`Ad ${fi+1} \u2014 ${fmt}`,a2.bn];
        for(let i=0;i<5;i++)r.push(a2.h[i]||"");
        r.push(a2.lh||"");
        for(let i=0;i<5;i++)r.push(a2.d[i]||"");
        r.push(lp,"Learn more","Enabled"); rows.push(r);
      });
    }));
    files.push(["3-ads.csv",mk(hdr,rows)]);
  } else {
    files.push(["4-ads.csv",mk(adHdr,ads)]);
  }

  /* City-level targeting so nothing runs nationwide by mistake. Executives
     narrow it later; Presence-only is set in Editor, it has no CSV column. */
  /* Name plus criterion ID. With the ID present Editor matches on the ID and
     the name can no longer be read as a US city. */
  const locName=($("#cgLoc")&&$("#cgLoc").value.trim())||canonLocation(PROJ.city);
  const locId=($("#cgLocId")&&$("#cgLocId").value.trim())||"";
  if(locName||locId){
    const locRows=[]; camps.forEach(c=>locRows.push([c,locName,locId,"Enabled"]));
    files.push(["5-locations.csv",mk(["Campaign","Location","Location ID","Status"],locRows)]);
  }
  if(isDG){
    /* Editor cannot attach images from a CSV, so the file that matters here
       is the one telling whoever uploads exactly what to prepare. */
    /* Editor cannot attach an image from a CSV, so the checklist is what
       whoever uploads works from. When the Creative studio has rendered the
       artwork, the same ZIP carries it and each row names its file instead of
       only describing what to prepare. */
    const specs=[
      ["Landscape image","1.91:1","1200 x 628","Required","Feed and Discover","landscape"],
      ["Square image","1:1","1200 x 1200","Required","Feed, Gmail","square"],
      ["Portrait image","4:5","960 x 1200","Recommended","Shorts and mobile feed","portrait"],
      ["Vertical image","9:16","1080 x 1920","Optional","Shorts and vertical inventory","story"],
      ["Logo square","1:1","1200 x 1200","Required","All placements",""],
      ["Logo landscape","4:1","1200 x 300","Recommended","Some placements",""],
      ["Video","16:9 / 1:1 / 9:16","min 10 seconds","Optional","Adds video inventory",""]
    ];
    const crLabel=`${slug(brief().proj||"project")}-${slug(brief().micro||brief().city||"creative")}`;
    const crFile={};
    (typeof CR_OUT!=="undefined"?CR_OUT:[]).forEach(o=>{
      crFile[o.name]=`creatives/${crLabel}-${o.w}x${o.h}.jpg`;
    });
    const crows=[];
    creativeFormats().forEach((fmt,fi)=>{
      PLAN.forEach(p=>p.groups.forEach(g=>{
        specs.forEach(sp=>{
          const f=sp[5]?crFile[sp[5]]:"";
          crows.push([p.campaign,g.name,`Ad ${fi+1} \u2014 ${fmt}`,sp[0],sp[1],sp[2],sp[3],sp[4],
                      f?"In this ZIP":"To prepare", f||""]);
        });
      }));
    });
    files.push(["10-creative-checklist.csv",mk(
      ["Campaign","Ad group","Ad name","Asset","Ratio","Size (px)","Requirement","Where it shows",
       "Status","File in this ZIP"],crows)]);
    /* the rendered artwork itself, once, not once per ad group */
    (typeof CR_OUT!=="undefined"?CR_OUT:[]).forEach(o=>{
      const bin=crBytes(o);
      if(bin)files.push([crFile[o.name],bin]);
    });
    const dRows=[];
    PLAN.forEach(p=>p.groups.forEach(g=>{
      DEMO_GROUPS.forEach(([grp])=>(DEMO[grp]||[]).forEach(v=>
        dRows.push([p.campaign,g.name,grp,v,"Excluded"])));
    }));
    if(dRows.length)files.push(["11-demographics.csv",mk(
      ["Campaign","Ad group","Criterion type","Value","Status"],dRows)]);

    const auds=pickedAudiences(), aRows=[];
    PLAN.forEach(p=>p.groups.forEach(g=>auds.forEach(a=>
      aRows.push([p.campaign,g.name,a[0],a[1],a[2]||"","Enabled"]))));
    if(aRows.length)files.push(["12-audiences.csv",mk(
      ["Campaign","Ad group","Audience name","Audience type","Audience ID","Status"],aRows)]);

    const segRows=customSegments();
    if(segRows.length){
      files.push(["13-custom-segments-to-create.csv",mk(
        ["Segment name","Signal type","The one input","Field in the interface","Where to create","Segment ID"],
        segRows)]);
    }
    files.push(["9-demandgen-settings.csv",
      mk(["Setting","Value"],dgSettings())]);
  }

  /* Two settings have no Editor CSV column, so they travel as a checklist
     instead of silently defaulting to Google's choice. The API deploy sets
     both for real; this file is for whoever imports by hand. */
  files.unshift(["0-settings-to-set-by-hand.csv",mk(
    ["Setting","Set it to","Where","Why it matters"],
    [["Location options",
      presence==="PRESENCE"?"Presence - people regularly in your targeted locations"
                           :"Presence or interest",
      "Editor \u2192 campaign \u2192 Locations \u2192 Location options",
      "Google defaults to Presence or interest, which serves to anyone searching about the city from anywhere in the world"],
     ["EU political ads",EUPOL,
      "Editor \u2192 campaign \u2192 EU political advertising",
      "Editor blocks posting until it is declared"],
     ["Campaign objective",($("#cgObj")&&$("#cgObj").value)||"Leads",
      "Google Ads interface \u2192 campaign settings","No CSV column exists"],
     ["Conversion goals",($("#cgGoals")&&$("#cgGoals").value)||"",
      "Google Ads interface \u2192 campaign settings","No CSV column exists"],
     ["Search partners",isDG?"n/a":"Off",
      "Editor \u2192 campaign \u2192 Networks","Partner traffic converts far worse on these campaigns"]])]);

  /* Assets go on every campaign. They used to carry one campaign name and be
     copied across inside Editor; one row per campaign removes that step and
     the chance of forgetting it. */
  const co=[]; camps.forEach(c=>AS.co.filter(Boolean).forEach(t=>co.push([c,t,"Enabled"])));
  if(co.length)files.push(["6-callouts.csv",mk(["Campaign","Callout text","Status"],co)]);
  const sl=[]; camps.forEach(c=>AS.sl.filter(x=>x[0]).forEach(x=>
    sl.push([c,x[0],x[1],x[2],slUrl(x[0],x[3])||lp,"Enabled"])));
  if(sl.length)files.push(["7-sitelinks.csv",mk(
    ["Campaign","Link text","Description line 1","Description line 2","Final URL","Status"],sl)]);
  const sn=[]; camps.forEach(c=>AS.sn.forEach(([hd,v])=>{
    const vv=v.filter(x=>x.trim()); if(vv.length>=3)sn.push([c,hd,vv.join(";"),"Enabled"]); }));
  if(sn.length)files.push(["8-snippets.csv",mk(
    ["Campaign","Structured snippet header","Structured snippet values","Status"],sn)]);
  /* Editor has no column for a business name or an image asset, so they
     travel as a note for whoever imports by hand. The API deploy sets them. */
  const bizName=($("#asBizName")&&$("#asBizName").value.trim())||"";
  const imgKeys=Object.keys(IMGS).filter(k=>IMGS[k]&&IMGS[k].data);
  if(bizName||imgKeys.length){
    const rows=[];
    camps.forEach(c=>{
      if(bizName)rows.push([c,"Business name",bizName,"Google Ads \u2192 Assets \u2192 Business name"]);
      imgKeys.forEach(k=>rows.push([c,IMG_SPEC[k].label,
        `${IMGS[k].w}\u00d7${IMGS[k].h} prepared in the toolkit`,
        "Google Ads \u2192 Assets \u2192 Images"]));
    });
    files.push(["9-business-and-images.csv",mk(
      ["Campaign","Asset","Value","Where to add it"],rows)]);
  }
  return files;
}
const LOC_PRESETS=[
 "Mumbai,Maharashtra,India","Navi Mumbai,Maharashtra,India","Thane,Maharashtra,India",
 "Pune,Maharashtra,India","Nashik,Maharashtra,India","Nagpur,Maharashtra,India",
 "Bengaluru,Karnataka,India","Hyderabad,Telangana,India","Chennai,Tamil Nadu,India",
 "Delhi,India","Noida,Uttar Pradesh,India","Greater Noida,Uttar Pradesh,India",
 "Ghaziabad,Uttar Pradesh,India","Gurugram,Haryana,India","Faridabad,Haryana,India",
 "Lucknow,Uttar Pradesh,India","Ahmedabad,Gujarat,India","Surat,Gujarat,India",
 "Vadodara,Gujarat,India","Gandhinagar,Gujarat,India","Kochi,Kerala,India",
 "Thiruvananthapuram,Kerala,India","Kozhikode,Kerala,India","Thrissur,Kerala,India",
 "Goa,India","Jaipur,Rajasthan,India","Indore,Madhya Pradesh,India","Kolkata,West Bengal,India",
 "Chandigarh,India","Dubai,Dubai,United Arab Emirates","Abu Dhabi,Abu Dhabi,United Arab Emirates",
 "Sharjah,Sharjah,United Arab Emirates","Ajman,Ajman,United Arab Emirates"];
(()=>{const s=$("#cgLocPreset"); if(!s)return;
  s.innerHTML='<option value="">\u2014 pick a market \u2014</option>'+
    LOC_PRESETS.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join("");})();
on("#cgLocPreset","change",()=>{
  const v=$("#cgLocPreset").value; if(!v)return;
  $("#cgLoc").value=v; $("#cgLoc").dataset.touched="1";
});
on("#cgLoc","input",()=>{ $("#cgLoc").dataset.touched="1"; });
on("#acCity","input",()=>{
  const cl=$("#cgLoc");
  if(cl&&!cl.dataset.touched)cl.value=canonLocation($("#acCity").value);
});
on("#segRegion","click",()=>{
  const cl=$("#cgLoc");
  if(cl&&!cl.dataset.touched)cl.value=canonLocation(PROJ.city||$("#acCity").value);
});
on("#stAllLoose","click",()=>{
  if(!PLAN.length)return toast("Build the structure first");
  const files=entityFiles();
  files.forEach(([n,t],k)=>setTimeout(()=>dl(n,t),k*500));
  toast(`${files.length} files`);
  logEvent("export","import files loose");
});
on("#stAll","click",()=>{
  if(!PLAN.length)return toast("Build the structure first");
  const files=entityFiles();
  const stamp=new Date().toISOString().slice(0,10);
  const label=slug(brief().proj||$("#inEnq").value||"campaign");
  /* numbered files in their number order, artwork after them \u2014 the folder
     is read top to bottom by whoever imports it */
  const rank=n=>{ const m=/^(\d+)-/.exec(n); return m?parseInt(m[1],10):900; };
  files.sort((a,b)=>rank(a[0])-rank(b[0])||a[0].localeCompare(b[0]));
  dlZip(`${label}-${stamp}.zip`,files);
  logEvent("export",`zip ${label}`);
  const goals=$("#cgGoals")?$("#cgGoals").value:"";
  const art=files.filter(f=>f[1] instanceof Uint8Array).length;
  toast(art
    ? `${files.length-art} files and ${art} creatives zipped. Set objective and goals in the interface: ${goals}`
    : `${files.length} files zipped. No creatives \u2014 render them on the Creative studio tab. Set objective and goals in the interface: ${goals}`);
});

/* Assets are the same for every campaign, so the file carries one name
   and you paste it across the rest. */
on("#stAssetsCsv","click",()=>{
  if(!PLAN.length)return toast("Build the structure first");
  const camps=[...new Set(PLAN.map(p=>p.campaign))];
  const lp=PROJ.url||$("#inLp").value.trim();
  const H=["Campaign","Callout text","Link text","Description line 1","Description line 2",
    "Final URL","Structured snippet header","Structured snippet values","Status"];
  const rows=[];
  camps.forEach(camp=>{
    AS.co.filter(Boolean).forEach(t=>rows.push([camp,t,"","","","","","","Enabled"]));
    AS.sl.filter(x=>x[0]).forEach(s=>rows.push([camp,"",s[0],s[1],s[2],slUrl(s[0],s[3])||lp,"","","Enabled"]));
    AS.sn.forEach(([hd,v])=>{ const vv=v.filter(x=>x.trim()); if(vv.length<3)return;
      rows.push([camp,"","","","","",hd,vv.join(";"),"Enabled"]); });
  });
  if(!rows.length)return toast("No assets yet — generate them on the Assets tab");
  dl("assets-all-campaigns.csv",H.map(csvq).join(",")+"\n"+rows.map(r=>r.map(csvq).join(",")).join("\n"));
  logEvent("export","assets");
});
on("#stSheet","click",()=>{
  if(!PLAN.length)return toast("Build the structure first");
  const pv=($("#cgPresence")&&$("#cgPresence").value)==="PRESENCE"
    ? "Presence - people regularly in your targeted locations" : "Presence or interest";
  const ev=($("#cgEuPol")&&$("#cgEuPol").value)==="CONTAINS_EU_POLITICAL_ADVERTISING"?"Yes":"No";
  let out=`OBJECTIVE\t${$("#cgObj")?$("#cgObj").value:""}\nCONVERSION GOALS\t${$("#cgGoals")?$("#cgGoals").value:""}\nBUDGET\t${$("#cgBudget")?$("#cgBudget").value:""}\nBID STRATEGY\t${$("#cgBid")?$("#cgBid").value:""}\nLOCATION OPTIONS\t${pv}\nEU POLITICAL ADS\t${ev}\n\n`;
  PLAN.forEach(p=>{ out+=`CAMPAIGN\t${p.campaign}\n`;
    p.groups.forEach(g=>{ out+=`\nAD GROUP\t${g.name}\n`;
      out+=`SR\tHeadline\tLength\tMax\tPin\tKeyword\n`;
      const n=Math.max(g.ad.h.length,g.kws.length);
      for(let i=0;i<n;i++){ const x=g.ad.h[i];
        out+= x&&x[0] ? `${i+1}\t${x[0]}\t${x[0].length}\t${H_MAX}\t${x[1]}\t${g.kws[i]||""}\n`
                      : `\t\t\t\t\t${g.kws[i]||""}\n`; }
      out+=`\nSR\tDescription\tLength\tMax\tPin\n`;
      g.ad.d.filter(x=>x[0]).forEach((x,i)=>out+=`${i+1}\t${x[0]}\t${x[0].length}\t${D_MAX}\t${x[1]}\n`);
      out+="\n";});
    out+="\n";});
  copy(out);});

$("#asBase").value=AS.base||"";
drawAll();



/* the earlier build wrote project data to localStorage, so clear it once */
if(!store.get("pp_migrated",false)){ clearProject(); store.set("pp_migrated",true); }
