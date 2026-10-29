/* ═══════ business name and images ═══════
   Google rejects an image whose shape is wrong, and nobody wants to open
   Photoshop for every project. The browser crops: centre-crop to the ratio,
   scale to the size Google recommends, re-encode as JPEG. What goes to the
   API is already the right shape, so nothing comes back rejected. */
const IMG_SPEC={
  logo      :{w:1200,h:1200,minW:128,minH:128,label:"Logo"},
  square    :{w:1200,h:1200,minW:300,minH:300,label:"Square image"},
  landscape :{w:1200,h:628, minW:600,minH:314,label:"Landscape image"}
};
let IMGS=sess.get("pp_imgs",null)||{};
const saveImgs=()=>sess.set("pp_imgs",IMGS);
function cropTo(file,spec){
  return new Promise((resolve,reject)=>{
    const fr=new FileReader();
    fr.onerror=()=>reject(new Error("Could not read that file"));
    fr.onload=()=>{
      const im=new Image();
      im.onerror=()=>reject(new Error("That file is not an image the browser can open"));
      im.onload=()=>{
        if(im.width<spec.minW||im.height<spec.minH)
          return reject(new Error(`Too small — ${im.width}\u00d7${im.height}. Google needs at least ${spec.minW}\u00d7${spec.minH}.`));
        const want=spec.w/spec.h, have=im.width/im.height;
        let sw=im.width, sh=im.height, sx=0, sy=0;
        if(have>want){ sw=im.height*want; sx=(im.width-sw)/2; }   /* trim the sides */
        else         { sh=im.width/want;  sy=(im.height-sh)/2; }  /* trim top and bottom */
        const c=document.createElement("canvas");
        c.width=spec.w; c.height=spec.h;
        const g=c.getContext("2d");
        g.fillStyle="#fff"; g.fillRect(0,0,spec.w,spec.h);
        g.drawImage(im,sx,sy,sw,sh,0,0,spec.w,spec.h);
        const url=c.toDataURL("image/jpeg",0.9);
        resolve({data:url.split(",")[1],mime:"image/jpeg",w:spec.w,h:spec.h,
                 src:`${im.width}\u00d7${im.height}`,preview:url});
      };
      im.src=fr.result;
    };
    fr.readAsDataURL(file);
  });
}
function drawImgs(){
  const keys=Object.keys(IMGS).filter(k=>IMGS[k]&&IMGS[k].data);
  const st=$("#imgStat");
  if(st)st.innerHTML=keys.length?`<span class="pill p-ok">${keys.length} ready</span>`:`<span class="pill p-mute">none</span>`;
  const box=$("#imgPreview"); if(!box)return;
  box.innerHTML=keys.length?keys.map(k=>`<div>
      <img src="${IMGS[k].preview}" alt="${esc(IMG_SPEC[k].label)}"
        style="width:100%;border:1px solid var(--line);border-radius:11px;display:block">
      <div class="mini" style="margin-top:5px">${esc(IMG_SPEC[k].label)} \u00b7 ${IMGS[k].w}\u00d7${IMGS[k].h}
        <span class="p-mute">from ${esc(IMGS[k].src)}</span></div></div>`).join("")
    :`<div class="empty" style="padding:14px">No images yet.</div>`;
}
/* Shows what was picked on the control itself: name, size, thumbnail. Shared
   by both tabs so they cannot drift apart. */
function dropFilled(zoneId,name,sub,thumbSrc){
  const z=$("#"+zoneId); if(!z)return;
  z.classList.add("has");
  const t=z.querySelector(".drop-txt");
  if(t)t.innerHTML=`<b>${esc(name)}</b><span class="drop-sub">${esc(sub)}</span>`;
  if(thumbSrc){
    let th=z.querySelector(".drop-thumb");
    if(!th){ th=document.createElement("img"); th.className="drop-thumb"; z.appendChild(th); }
    th.src=thumbSrc;
  }
}
function dropReset(zoneId,head,sub){
  const z=$("#"+zoneId); if(!z)return;
  z.classList.remove("has");
  const t=z.querySelector(".drop-txt");
  if(t)t.innerHTML=`<b>${head}</b><span class="drop-sub">${sub}</span>`;
  const th=z.querySelector(".drop-thumb"); if(th)th.remove();
}
const kbSize=n=>n<1024?n+" B":n<1048576?(n/1024).toFixed(0)+" KB":(n/1048576).toFixed(1)+" MB";
function dropWire(zoneId,take){
  const z=$("#"+zoneId); if(!z)return;
  ["dragenter","dragover"].forEach(ev=>z.addEventListener(ev,e=>{
    e.preventDefault(); z.classList.add("over"); }));
  ["dragleave","drop"].forEach(ev=>z.addEventListener(ev,e=>{
    e.preventDefault(); z.classList.remove("over"); }));
  z.addEventListener("drop",e=>take(e.dataTransfer&&e.dataTransfer.files&&e.dataTransfer.files[0]));
}
Object.keys(IMG_SPEC).forEach(k=>{
  const cap=k.charAt(0).toUpperCase()+k.slice(1);
  const el=$("#img"+cap), zone="dropImg"+cap;
  if(!el)return;
  const take=async f=>{
    if(!f)return;
    try{
      IMGS[k]=await cropTo(f,IMG_SPEC[k]);
      saveImgs(); drawImgs();
      dropFilled(zone,f.name,
        IMG_SPEC[k].w+"\u00d7"+IMG_SPEC[k].h+" \u00b7 "+kbSize(f.size),IMGS[k].preview);
      toast(IMG_SPEC[k].label+" cropped to "+IMG_SPEC[k].w+"\u00d7"+IMG_SPEC[k].h);
    }catch(err){ el.value=""; toast(String(err.message||err)); }
  };
  el.addEventListener("change",e=>take(e.target.files&&e.target.files[0]));
  dropWire(zone,take);
});
on("#imgClear","click",()=>{
  IMGS={}; saveImgs(); drawImgs();
  Object.keys(IMG_SPEC).forEach(k=>{
    const cap=k.charAt(0).toUpperCase()+k.slice(1);
    const el=$("#img"+cap); if(el)el.value="";
    dropReset("dropImg"+cap,"Choose "+IMG_SPEC[k].label.toLowerCase(),
      "cropped to "+IMG_SPEC[k].w+"\u00d7"+IMG_SPEC[k].h);});
  toast("Images cleared");
});
on("#asBizName","input",()=>{ PROJ.bizName=$("#asBizName").value; sess.set("pp_proj",PROJ); });

/* ═══════ demographics ═══════ */
const DEMO_AGE=[["AGE_RANGE_18_24","18-24",true],["AGE_RANGE_25_34","25-34",false],
  ["AGE_RANGE_35_44","35-44",false],["AGE_RANGE_45_54","45-54",false],
  ["AGE_RANGE_55_64","55-64",false],["AGE_RANGE_65_UP","65+",true],
  ["AGE_RANGE_UNDETERMINED","Unknown",false]];
/* The API counts household income as a percentile from the BOTTOM, so
   INCOME_RANGE_90_UP is the top 10% and INCOME_RANGE_50_60 is the 41-50%
   band. Printing those raw boundaries put "60-70%" and "70-80%" on screen,
   which are not bands Google Ads shows anywhere. The labels below are what
   the interface says, in the order the interface lists them; the values are
   the API's own, untouched. */
const DEMO_INC=[["INCOME_RANGE_90_UP","Top 10%",false],["INCOME_RANGE_80_90","11-20%",false],
  ["INCOME_RANGE_70_80","21-30%",false],["INCOME_RANGE_60_70","31-40%",false],
  ["INCOME_RANGE_50_60","41-50%",false],["INCOME_RANGE_0_50","Lower 50%",true],
  ["INCOME_RANGE_UNDETERMINED","Unknown",false]];
const DEMO_GEN=[["FEMALE","Female",false],["MALE","Male",false],["UNDETERMINED","Unknown",false]];
const DEMO_PAR=[["PARENT","Parent",false],["NOT_A_PARENT","Not a parent",false],
  ["UNDETERMINED","Unknown",false]];
function drawDemoBoxes(){
  const put=(sel,list,kind)=>{ const el=$(sel); if(!el)return;
    el.innerHTML=list.map(([v,label,def])=>
      `<label class="chk" style="display:inline-flex;margin-right:14px">
         <input type="checkbox" data-demo="${kind}" value="${v}"${def?" checked":""}><span>${esc(label)}</span></label>`).join("");
  };
  put("#demoAge",DEMO_AGE,"age"); put("#demoInc",DEMO_INC,"inc");
  put("#demoGen",DEMO_GEN,"gen");  put("#demoPar",DEMO_PAR,"par");
}
const demoPicked=kind=>[...document.querySelectorAll(`[data-demo="${kind}"]`)]
  .filter(b=>b.checked).map(b=>b.value);

/* ═══════ negative keyword lists ═══════ */
let NEGLISTS=[];
on("#negLoadLists","click",async()=>{
  const cid=$("#apCid").value.replace(/[^0-9]/g,"");
  if(!cid)return toast("Pick the client account first");
  const sel=$("#negLists");
  sel.innerHTML=`<option value="">loading\u2026</option>`;
  const r=await adsCall("ads-lists",{customerId:cid});
  if(r.error){ sel.innerHTML=""; return $("#negStat").innerHTML=`<span class="pill p-bad">${esc(r.error.slice(0,60))}</span>`; }
  NEGLISTS=r.lists||[];
  sel.innerHTML=NEGLISTS.length
    ? NEGLISTS.map(l=>`<option value="${esc(l.rn)}">${esc(l.name)} \u00b7 ${l.members} keyword${l.members===1?"":"s"}</option>`).join("")
    : `<option value="">\u2014 no negative lists in this account \u2014</option>`;
  $("#negStat").innerHTML=`<span class="pill p-ok">${NEGLISTS.length} list${NEGLISTS.length===1?"":"s"}</span>`;
});

let ACCTS=[];
const acctName=id=>{ const a=ACCTS.find(x=>x.id===String(id)); return a?a.name:""; };
function drawAcctPick(){
  const sel=$("#apAcct"), cur=$("#apCid").value.replace(/[^0-9]/g,"");
  if(!ACCTS.length){ sel.innerHTML=`<option value="">\u2014 load the list, or type the ID below \u2014</option>`; return; }
  sel.innerHTML=`<option value="">\u2014 pick an account \u2014</option>`+
    ACCTS.map(a=>`<option value="${esc(a.id)}"${a.id===cur?" selected":""}>${esc(a.name)} \u00b7 ${esc(a.id)}${a.test?" \u00b7 test":""}</option>`).join("");
}
on("#apLoadAccts","click",async()=>{
  const sel=$("#apAcct");
  sel.innerHTML=`<option value="">loading\u2026</option>`;
  const r=await adsCall("ads-accounts",{});
  if(r.error){ sel.innerHTML=`<option value="">\u2014 could not load \u2014</option>`;
    return $("#apCheckOut").innerHTML=apLine("bad","\u2715",`<b>Could not list the accounts.</b> ${esc(r.error)}`); }
  ACCTS=r.accounts||[]; drawAcctPick();
  toast(`${ACCTS.length} client account${ACCTS.length===1?"":"s"} loaded`);
});
on("#apAcct","change",()=>{
  const v=$("#apAcct").value; if(!v)return;
  $("#apCid").value=v;
  $("#apStat").innerHTML=`<span class="pill p-mute">not checked</span>`;
  $("#apCheckOut").innerHTML=apLine("warn","!",
    `Now set to <b>${esc(acctName(v))}</b> \u00b7 <code>${esc(v)}</code>. Press <b>Check the connection</b> to confirm.`);
});
on("#apCid","input",()=>{ const sel=$("#apAcct");
  if(sel&&sel.value&&sel.value!==$("#apCid").value.replace(/[^0-9]/g,""))sel.value=""; });
/* One search, used by the box and by the "use the project's location" button.
   Google returns the criterion ID with each match; the map pin is a separate
   lookup through Nominatim, because Google does not hand back coordinates. */
async function geoSearch(name,cc){
  const out=$("#apGeoOut");
  if(!name)return toast("Type a place first");
  out.innerHTML=apLine("warn","\u2026",`Looking up <b>${esc(name)}</b>\u2026`);
  const r=await adsCall("ads-geo",{names:[name],countryCode:cc||"IN"});
  if(r.error)return out.innerHTML=apLine("bad","\u2715",esc(r.error));
  const list=(r.suggestions||[]).filter(x=>x.id).slice(0,10);
  if(!list.length)return out.innerHTML=apLine("warn","!",
    "Google returned nothing for that name. Try a shorter one, or paste the ID by hand below.");
  out.innerHTML=`<div class="f-note" style="margin-bottom:8px">Pick what matches. A city targets the
    city; a province targets the whole state.</div>`+
    list.map(x=>{
      const on=TARGETS.some(t=>String(t.id)===String(x.id));
      return `<div class="apg"><span>${esc(x.canonical||x.name)}
        <span class="pill p-mute">${esc(x.type||"")}</span> <code>${esc(x.id)}</code></span>
      <button class="btn btn-sm${on?"":" btn-pri"}" data-geo="${esc(x.id)}"
        data-nm="${esc(x.canonical||x.name)}"${on?" disabled":""}>${on?"already added":"Add"}</button></div>`;
    }).join("");
}
on("#geoGo","click",()=>geoSearch(($("#geoQ").value||"").trim(),$("#geoCc").value));
on("#geoQ","keydown",e=>{ if(e.key==="Enter"){e.preventDefault();$("#geoGo").click();} });
on("#apGeo","click",()=>{
  const name=($("#cgLoc")&&$("#cgLoc").value.trim())||PROJ.city||"";
  if(!name)return toast("Set the target location on tab 01 first");
  const cc=/united arab emirates|dubai|abu dhabi|sharjah|ajman/i.test(name)?"AE":"IN";
  const first=name.split(",")[0].trim();
  $("#geoQ").value=first; $("#geoCc").value=cc;
  geoSearch(first,cc);
});
on("#apGeoOut","click",async e=>{
  const b=e.target.closest("[data-geo]"); if(!b)return;
  const id=b.dataset.geo, nm=b.dataset.nm||id;
  if(TARGETS.some(t=>String(t.id)===String(id)))return toast("Already on the list");
  TARGETS.push({kind:"geo",id:String(id),label:nm,lat:0,lng:0,set:LOCSET_ON});
  saveTargets(); drawTargets(); drawApSettings(); drawApPlan();
  b.disabled=true; b.className="btn btn-sm"; b.textContent="already added";
  toast(`${nm} added`);
  /* a pin on the map so he can see where it is \u2014 the ID is already in hand,
     so a failed geocode costs nothing but the marker */
  const g=await geocodePlace(nm+", "+($("#geoCc").value==="AE"?"UAE":"India"));
  const t=TARGETS.find(x=>String(x.id)===String(id));
  if(g&&t){ t.lat=g.lat; t.lng=g.lng; saveTargets(); drawTargets(); }
});
async function apRun(mode){
  const cid=$("#apCid").value.replace(/[^0-9]/g,"");
  if(!cid)return toast("Put the customer ID in first");
  const pl=apPlan();
  if(!pl)return toast("Build the structure on tab 05 first");
  /* An older Apps Script has no Demand Gen builder and would create a Search
     campaign under these names without complaining, so the script is asked
     what it can build before a Demand Gen plan is sent to it. */
  if(CH==="demandgen"){
    $("#apOut").innerHTML=apLine("warn","\u2026","Checking the Apps Script version\u2026");
    const chk=await adsCall("ads-check",{customerId:cid});
    const chans=(chk&&chk.capabilities&&chk.capabilities.channels)||[];
    if(chans.indexOf("demandgen")===-1){
      $("#apOut").innerHTML=apLine("bad","\u2715",
        `<b>The Apps Script is an older version.</b> It cannot build Demand Gen campaigns, and
         sending this plan to it would create <b>Search</b> campaigns under Demand Gen names.
         Paste the new <code>search-ops-toolkit.gs</code> into the script, then
         <b>Deploy \u2192 Manage deployments \u2192 pencil \u2192 Version: New version \u2192 Deploy</b>.
         Saving the script alone does not change the live URL.`);
      return toast("Update the Apps Script first");
    }
  }
  const who=acctName(cid);
  if(mode==="deploy"&&!confirm(
    `Create ${pl.campaigns.length} campaign${pl.campaigns.length===1?"":"s"} in\n\n`+
    `    ${who?who+"\n    ":""}${cid}\n\n`+
    `They are created ${pl.settings.status==="ENABLED"?"ENABLED and will start serving":"paused"}.\n`+
    `Check the account name before you press OK.`))return;
  $("#apOut").innerHTML=apLine("warn","\u2026",mode==="deploy"?"Deploying\u2026 this can take a minute.":"Validating against Google\u2026");
  const r=await adsCall("ads-deploy",{customerId:cid,mode,plan:pl});
  if(r.error)return $("#apOut").innerHTML=apLine("bad","\u2715",`<b>Failed.</b> ${esc(r.error)}`);
  const rows=apResultRows(r);
  const head=r.failed
    ? apLine("bad","\u2715",`<b>${r.failed} of ${(r.campaigns||[]).length} failed.</b> Nothing partial was created \u2014 each campaign is all or nothing.`)
    : apLine("ok","\u2713",r.mode==="deploy"
        ? `<b>Deployed to ${esc(who||r.customerId)}</b>${who?` <code>${esc(r.customerId)}</code>`:""}. Open the account and check before enabling.`
        : `<b>Everything validated.</b> Google accepted every field and created nothing. Press Deploy when ready.`);
  $("#apOut").innerHTML=head+rows.join("");
  logEvent(mode==="deploy"?"ads-deploy":"ads-validate",`${cid} ${(r.campaigns||[]).length} campaigns`);
}
/* one campaign per row, with whatever the campaign type refused said out loud
   rather than dropped quietly between the plan and what Google actually got */
function apResultRows(r){
  return (r.campaigns||[]).map(c=>{
    if(c.error) return apLine("bad","\u2715",`<b>${esc(c.campaign)}</b><br>${explainErr(c.error)}`);
    const main=apLine("ok","\u2713",`<b>${esc(c.campaign)}</b> \u2014 ${c.operations} operations ${r.mode==="deploy"?"created":"checked, nothing created"}`)
      /* things the campaign type could not take, said out loud rather than
         dropped quietly between the plan and what Google actually got */
      +(c.notes||[]).map(n=>apLine("warn","!",esc(n))).join("");
    if(!c.brand) return main;
    return main+(c.brand.ok
      ? apLine("ok","\u2713",`Business name and logo attached to the account.`)
      : apLine("warn","!",`<b>The campaign is fine.</b> Business name and logo were refused, and nothing
          else was affected.<br>${explainErr(c.brand.error)}`));
  });
}
/* Creating the segments is what makes them attachable: a segment with no ID
   can only be reported as skipped at deploy time. */
on("#csBuild","click",async()=>{
  const rows=customSegments();
  if(!rows.length)return toast("Add some lines to the custom segment fields first");
  const cid=$("#apCid").value.replace(/[^0-9]/g,"");
  if(!cid)return toast("Pick the client account on tab 07 first");
  const todo=rows.filter(r=>!r[5]);
  if(!todo.length)return toast("Every segment already has an ID");
  const st=$("#csStat");
  if(st)st.innerHTML=`<span class="pill p-mute">creating ${todo.length}…</span>`;
  const r=await adsCall("ads-segments",{customerId:cid,
    segments:rows.map(x=>({name:x[0],kind:x[1],input:x[2]}))});
  if(r.error){ if(st)st.innerHTML=`<span class="pill p-bad">failed</span>`;
    return toast(explainErr?String(r.error).slice(0,160):r.error); }
  /* write each ID back beside the line that produced it */
  const byName={}, errByName={};
  (r.segments||[]).forEach(x=>{ if(x.id)byName[x.name]=x.id; if(x.error)errByName[x.name]=x.error; });
  let wrote=0;
  CS_BUCKETS.forEach(([code])=>{
    const el=$("#"+csId(code)); if(!el)return;
    const out=lines(el.value).map(v=>{
      const p=csParse(v);
      if(!p.input||p.id)return v;                       /* empty, or already has one */
      const row=rows.find(x=>(x[6]||[])[0]===code&&x[2]===p.input);
      const nid=row&&byName[row[0]];
      if(nid){ wrote++; return `${v.split("::")[0].trim()} ::${nid}`; }
      return v;
    });
    el.value=out.join("\n");
  });
  csRead();
  const made=(r.segments||[]).filter(x=>x.made).length;
  const bad=(r.segments||[]).filter(x=>x.error);
  if(st)st.innerHTML=`<span class="pill ${bad.length?"p-warn":"p-ok"}">${made} created · ${
    (r.segments||[]).length-made-bad.length} already there${bad.length?` · ${bad.length} refused`:""}</span>`;
  /* a refused line used to take the whole press down with it and say nothing
     about which one it was. Now the others are created and each refusal is
     named, under the box it came from. */
  const em=$("#csErrs");
  if(em)em.innerHTML=bad.length?bad.map(x=>{
    const row=rows.find(y=>y[0]===x.name);
    return `<div class="check c-bad"><span class="ic">✕</span><span>
      <b>${esc(((row||[])[6]||[""])[0].toUpperCase())} · ${esc((row||[])[2]||x.name)}</b><br>${esc(x.error)}</span></div>`;
  }).join(""):"";
  toast(`${made} segments created, ${wrote} IDs written back${bad.length?`, ${bad.length} refused`:""}`);
  drawCsMap(); drawApSettings(); drawApPlan();
  logEvent("ads-segments",`${cid} ${made} created`);
});
on("#apValidate","click",()=>apRun("validate"));
on("#apDeploy","click",()=>apRun("deploy"));

/* ── both channels in one run ──────────────────────────────────────────────
   A project is launched on Search and on Demand Gen together, and doing that
   meant switching the channel by hand, rebuilding, and deploying twice. The
   plan is built for each channel in turn here instead. The channel drives the
   whole page — names, strategies, copy, assets — so it is switched, the
   structure rebuilt, the plan snapshotted, and the page put back exactly as
   it was found. Each channel's strategy picks are remembered separately, so
   nothing is guessed on the way through. */
function planForChannel(ch){
  const was=CH;
  try{
    CH=ch; fillStrategies();
    if(!(STRAT_SEL[ch]||[]).length)return {error:`No strategies picked for ${CHANNEL[ch].full}. Pick them on tab 01 with that channel selected.`};
    doBuild(false);
    if(!PLAN.length)return {error:`Nothing to build for ${CHANNEL[ch].full}.`};
    const pl=apPlan();
    if(!pl)return {error:`${CHANNEL[ch].full} produced no plan.`};
    return {plan:pl};
  }catch(e){ return {error:`${CHANNEL[ch].full}: ${e.message}`}; }
  finally{
    CH=was; fillStrategies(); doBuild(false);
    showDGCard(); dgcShow(); drawApSettings(); drawApPlan();
  }
}
async function apRunBoth(mode){
  const cid=$("#apCid").value.replace(/[^0-9]/g,"");
  if(!cid)return toast("Put the customer ID in first");
  $("#apOut").innerHTML=apLine("warn","…","Building both channels…");
  const made=[];
  for(const ch of ["search","demandgen"]){
    const r=planForChannel(ch);
    if(r.error)return $("#apOut").innerHTML=apLine("bad","✕",esc(r.error));
    made.push({ch,plan:r.plan});
  }
  /* the Demand Gen builder has to exist in the script before anything is sent */
  const chk=await adsCall("ads-check",{customerId:cid});
  const chans=(chk&&chk.capabilities&&chk.capabilities.channels)||[];
  if(chans.indexOf("demandgen")===-1)
    return $("#apOut").innerHTML=apLine("bad","✕",
      `<b>The Apps Script is an older version.</b> It cannot build Demand Gen, and sending this
       would create Search campaigns under Demand Gen names. Run <code>reloadBackend()</code> in
       the script editor, then try again.`);
  const total=made.reduce((a,x)=>a+x.plan.campaigns.length,0);
  const who=acctName(cid);
  if(mode==="deploy"&&!confirm(
    `Create ${total} campaigns in\n\n    ${who?who+"\n    ":""}${cid}\n\n`+
    made.map(x=>`    ${CHANNEL[x.ch].full}: ${x.plan.campaigns.length}`).join("\n")+`\n\n`+
    `They are created ${made[0].plan.settings.status==="ENABLED"?"ENABLED and will start serving":"paused"}.\n`+
    `Check the account name before you press OK.`))return;
  /* run one after the other, never together: the second run must not start
     while the first could still be half way through creating campaigns */
  let html="", failed=0, ran=0;
  for(const x of made){
    $("#apOut").innerHTML=html+apLine("warn","…",
      `${mode==="deploy"?"Deploying":"Validating"} ${CHANNEL[x.ch].full}…`);
    const r=await adsCall("ads-deploy",{customerId:cid,mode,plan:x.plan});
    html+=`<div class="f-lab" style="margin:14px 0 6px">${esc(CHANNEL[x.ch].full)}</div>`;
    if(r.error){ failed++; html+=apLine("bad","✕",`<b>Failed.</b> ${esc(r.error)}`); continue; }
    failed+=r.failed||0; ran+=(r.campaigns||[]).length;
    html+=apResultRows(r).join("");
    $("#apOut").innerHTML=html;
  }
  $("#apOut").innerHTML=(failed
    ? apLine("bad","✕",`<b>${failed} campaign${failed===1?"":"s"} failed.</b> Each campaign is all
        or nothing, so a failed one created nothing at all. The rest are in the account.`)
    : apLine("ok","✓",mode==="deploy"
        ? `<b>Both channels deployed to ${esc(who||cid)}</b> — ${ran} campaigns. Open the account and check before enabling.`
        : `<b>Both channels validated.</b> Google accepted every field and created nothing.`))+html;
  logEvent(mode==="deploy"?"ads-deploy":"ads-validate",`${cid} both channels, ${ran} campaigns`);
}
on("#apBothVal","click",()=>apRunBoth("validate"));
on("#apBothDep","click",()=>apRunBoth("deploy"));
on("#apPayload","click",()=>{
  const pl=apPlan(); if(!pl)return toast("Build the structure first");
  copy(JSON.stringify(pl,null,2)); toast("Request copied");
});
on("#cgLocId","input",()=>{
  const v=$("#cgLocId").value.replace(/[^0-9]/g,"");
  const ta=$("#apLocIds"); if(!ta||!v)return;
  if(!lines(ta.value).length){ ta.value=v; drawApSettings(); drawApPlan(); }
});

drawDemo(); fillAudPick(); showDGCard(); dgcShow(); drawCsMap();
drawCsBoxes();
on("#csBoxes","input",()=>{ csRead(); drawCsMap(); });
on("#csMore","click",()=>{ CS_SHOW_ALL=!CS_SHOW_ALL; store.set("pp_csall",CS_SHOW_ALL);
  drawCsBoxes(); drawCsMap(); });
on("#audPick","change",drawCsMap);
