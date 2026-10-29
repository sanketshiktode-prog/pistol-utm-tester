/* ═══════════ generator ═══════════
   Copy is assembled from the brief and filtered by character limit,
   so nothing that overflows ever reaches a row. */
function genHeadlines(){
  const b=brief(); if(!b.proj)return null;
  const used=new Set(), out=[];
  /* Pinned 1 is this ad group's own keywords, so the headline matches the
     query that triggered it. The brand forms are only a fallback for an ad
     group that has no keywords in it yet. */
  const kws=kwOf().filter(k=>!blocked(k)).map(k=>tc(k));
  const brand=[b.proj, addPart(b.proj,b.micro), addPart(b.proj,b.city),
    b.dev?`${b.proj} By ${b.dev}`:"", b.dev?`${b.dev} ${b.micro}`:"",
    `${b.proj} ${b.micro} ${b.city}`].filter(Boolean);
  pick(kws.concat(brand),H_MAX,5,used).forEach(t=>out.push([t,"1"]));
  pick(scrub(moneyHeadlines(b,H_MAX)),H_MAX,5,used).forEach(t=>out.push([t,"2"]));
  const proof=[...b.usps.map(tc), ...b.marks.map(u=>tc(u.replace(/\s*-\s*/," - "))),
    "Book A Free Site Visit","Download Brochure Now","Get Price List Instantly",
    "Limited Units Available","Instant Call Back"];
  pick(proof,H_MAX,H_CAP-out.length,used).forEach(t=>out.push([t,"3"]));
  while(out.length<H_CAP)out.push(["",""]);
  return out.slice(0,H_CAP);
}
function genDescriptions(){
  const b=brief(); if(!b.proj)return null;
  const u1=tc(b.usps[0]||""), u2=tc(b.usps[1]||""), u3=tc(b.usps[2]||"");
  const m1=tc(b.marks[0]||""), m2=tc(b.marks[1]||"");
  const where=placeOf(b);
  const cands=[
    ...sentenceD1(b,D_MAX), ...sentenceD2(b,D_MAX),
    compose([`${addPart(b.proj,b.micro)} \u2014 ${b.cfg}`, b.price&&`From ${b.price}`, "Book A Free Site Visit Today"],D_MAX),
    compose([`${b.cfg} At ${withPlace(b.proj,where)}`, b.price&&`From ${b.price}`, "Enquire For Floor Plans"],D_MAX),
    compose([u1&&u2?`${u1} & ${u2} At ${b.proj}`:`${u1||"Premium Homes"} At ${b.proj}`, "Download The Brochure"],D_MAX),
    compose([`${b.offer||"New Launch"} At ${addPart(b.proj,b.micro)}`, m1, "Get Price List"],D_MAX),
    compose([`Book ${b.cfg} At ${addPart(b.proj,b.micro)}`, "Free Site Visit, Instant Call Back"],D_MAX),
    compose([b.dev?`${addPart(b.proj,b.dev)}${where?" In "+where:""}`:`${where?b.proj+" In "+where:b.proj}`, u3||u1, "Request Pricing"],D_MAX),
    compose([`${b.cfg}${where?" In "+where:""}`, m2||m1, "Instant Call Back From Our Team"],D_MAX)
  ].filter(Boolean);
  const used=new Set(), out=pick(cands,D_MAX,D_CAP,used).map(t=>[t,""]);
  while(out.length<D_CAP)out.push(["",""]);
  return out;
}
function ensureGroup(){
  if(ADCUR&&ADG[ADCUR])return true;
  const name=(VARIANTS[PICK]&&VARIANTS[PICK].names.adgroup)
    || (brief().proj?brief().proj+" Ad Group":"Ad Group 1");
  if(!ADG[name])ADG[name]=blankGroup();
  ADCUR=name; saveAd(); fillAdPicker(); drawAd(); return true;
}
on("#hGen","click",()=>{
  ensureGroup();
  const g=genHeadlines();
  if(!g)return toast("Fill in the project name on this tab first");
  if(cur().h.some(r=>r[0].trim())&&!confirm("Replace the headlines already written here?"))return;
  cur().h=g; cur().edited=true; mirrorAd(ADCUR); saveAd(); drawAd();
  toast(`${g.filter(r=>r[0]).length} headlines generated`);});
on("#dGen","click",()=>{
  ensureGroup();
  const g=genDescriptions();
  if(!g)return toast("Fill in the project name on this tab first");
  if(cur().d.some(r=>r[0].trim())&&!confirm("Replace the descriptions already written here?"))return;
  cur().d=g; cur().edited=true; mirrorAd(ADCUR); saveAd(); drawAd();
  toast(`${g.filter(r=>r[0]).length} descriptions generated`);});
on("#acPriceFromTk","click",()=>{
  const t=ticket(); if(!t)return toast("Set a ticket size on tab 01");
  const label=REGION==="ae"?aedLabel():"\u20b9 "+t.replace("CR"," Cr").replace("L"," Lakhs");
  $("#acPrice").value=label+"*"; $("#acPrice").dispatchEvent(new Event("input",{bubbles:true}));});

/* keywords from the brief */
on("#kwGen","click",()=>{
  const b=brief(); if(!b.proj)return toast("Fill in the project name on the ad copy tab");
  const P=b.proj, D=b.dev, M=b.micro, C=b.city;
  const roots=[P, M&&`${P} ${M}`, C&&`${P} ${C}`, M&&C&&`${P} ${M} ${C}`,
    D&&`${D} ${M||C}`, D&&D!==P?D:""].filter(Boolean);
  /* intent words like brochure, price and floor plan pull in research
     traffic that rarely converts. Brand and location only. */
  const tails=["","new launch"];
  const cfgs=(b.cfg||"").split(/[,&]/).map(s=>s.trim()).filter(Boolean);
  const out=[];
  roots.forEach(r=>tails.forEach(t=>out.push((r+" "+t).trim())));
  cfgs.forEach(c=>{ if(M)out.push(`${c} in ${M}`); if(C)out.push(`${c} in ${C}`);
    out.push(`${c} ${P}`);});
  if(M)out.push(`flats in ${M}`,`apartments in ${M}`,`new projects in ${M}`);
  if(C)out.push(`new launch projects in ${C}`,`ready to move flats in ${C}`);
  const seen=new Set(), clean=out.map(s=>s.toLowerCase().replace(/\s+/g," ").trim())
    .filter(s=>s&&s.split(" ").length<=10&&s.length<=80&&!seen.has(s)&&seen.add(s));
  $("#kwRaw").value=clean.join("\n"); renderKw();
  toast(`${clean.length} keywords generated`);});

/* assets from the brief */
on("#asGen","click",()=>{
  const b=brief(); if(!b.proj)return toast("Fill in the project name on the ad copy tab");
  const where=placeOf(b);
  const u=b.usps.map(tc), m=b.marks.map(tc);
  const d=(a,fb)=>fit(a,SL_D)||fit(fb,SL_D)||"";
  const sl=[
    ["Download Brochure","Get Complete Project Details","Floor Plans, Pricing & Offers"],
    ["Price & Payment Plan", d(`${b.cfg} From ${b.price}`,"Complete Costing Details Inside"),"See The Full Payment Schedule"],
    ["Book A Free Site Visit", d(`Visit ${addPart(b.proj,b.micro)}`,"Pick A Slot That Suits You"),"Instant Call Back From Our Team"],
    ["Master & Floor Plans", d(u[0]||"","Township Layout And Unit Plans"),"See Every Configuration Inside"],
    ["Amenities & Highlights", d(u[1]||u[0]||"","World-Class Modern Amenities"),"Designed For Every Age Group"],
    ["Location & Connectivity", d(m[0]||"","Connected To The Whole City"), d(m[1]||"","Prime Address, Easy Access")]
  ].map(r=>[fit(r[0],SL_T)||r[0].slice(0,SL_T),r[1],r[2]]);
  /* callouts come only from what the project actually offers */
  const coCands=[...u, ...b.amen.map(tc), ...m].filter(Boolean).map(tc);
  const used=new Set(), co=pick(scrub(coCands),CO_MAX,10,used);
  const cfgVals=cfgList(b.cfg).map(s=>fit(tc(s),SN_MAX)).filter(Boolean);
  const sn=[];
  if(cfgVals.length>=3)sn.push(["Types",cfgVals]);
  const amen=(b.amen.length?b.amen:["Swimming Pool","Gymnasium","Clubhouse","Jogging Track","Kids Play Area","Yoga Deck"])
    .map(x=>fit(tc(x),SN_MAX)).filter(Boolean).slice(0,10);
  if(amen.length>=3)sn.push(["Amenities",amen]);
  if(where)sn.push(["Neighborhoods",[b.micro,b.city].filter(Boolean).map(x=>fit(x,SN_MAX)).filter(Boolean)]);
  AS.sl=sl.filter(r=>!banned(r.join(" "))); AS.co=co; AS.sn=sn.filter(s=>s[1].length>=3);
  const baseUrl=PROJ.url||$("#inLp").value.trim();
  if(!AS.base&&baseUrl){AS.base=baseUrl;$("#asBase").value=baseUrl;}
  saveAs(); drawAll(); toast("Sitelinks, callouts and snippets generated");});



/* ═══════════ access control ═══════════
   Google Identity Services gives a real, named sign-in. The gate below is
   client-side, so treat it as a door with a lock, not a vault: anyone able
   to edit the page can walk past it. Real enforcement happens in the Apps
   Script that receives the log — it verifies the token with Google and
   rejects anything outside the domain. Configure both. */
const AUTH={
  clientId : "779938081992-vecfdvvm61lalugpo3sa64bvqlhjfjqq.apps.googleusercontent.com",
  logUrl   : "https://script.google.com/macros/s/AKfycbxOAsPoL6GJ6p8EhhjEk0UroQmSiTaE2coPmgAH8EGDwfN-xaPDggwlkROezmwQ6iV3/exec",
  domain   : "propertypistol.com",
  admin    : "sanket.shiktode@propertypistol.com"
};
let USER=null;
function b64url(s){try{return JSON.parse(decodeURIComponent(atob(s.replace(/-/g,"+").replace(/_/g,"/"))
  .split("").map(c=>"%"+("00"+c.charCodeAt(0).toString(16)).slice(-2)).join("")));}catch(e){return null;}}
function logEvent(action,detail){
  if(!AUTH.logUrl||!USER)return;
  try{
    fetch(AUTH.logUrl,{method:"POST",mode:"no-cors",headers:{"Content-Type":"text/plain"},
      body:JSON.stringify({credential:USER.credential,email:USER.email,name:USER.name,
        action,detail:String(detail||"").slice(0,500),ts:new Date().toISOString()})});
  }catch(e){}
}
function showUser(){
  $("#gate").classList.add("hidden");
  $("#userChip").classList.remove("hidden");
  $("#userName").textContent=USER.name||USER.email;
  const admin=USER.email.toLowerCase()===AUTH.admin.toLowerCase();
  $("#userRole").textContent=admin?"ADMIN":"USER";
  $("#userRole").className="pill "+(admin?"p-ok":"p-mute");
  /* whether this person deploys as themselves is worth knowing before they
     press Deploy, not after */
  try{ gaConnStatus(); }catch(e){}
}
function onCredential(res){
  const p=b64url((res.credential||"").split(".")[1]||"");
  if(!p)return $("#gateMsg").innerHTML='<div class="check c-bad"><span class="ic">\u2715</span><span>Could not read that sign-in.</span></div>';
  const dom=(p.hd||"").toLowerCase(), email=(p.email||"").toLowerCase();
  if(dom!==AUTH.domain&&!email.endsWith("@"+AUTH.domain)){
    $("#gateMsg").innerHTML=`<div class="check c-bad"><span class="ic">\u2715</span><span><b>${esc(email)}</b> is outside ${esc(AUTH.domain)}. Sign in with your work account.</span></div>`;
    return;
  }
  USER={email,name:p.name||email,picture:p.picture,credential:res.credential,exp:Number(p.exp||0)};
  try{sessionStorage.setItem("pp_user",JSON.stringify(USER));}catch(e){}
  showUser(); logEvent("sign-in","");
  const w=$("#expWarn"); if(w)w.classList.add("hidden");
  scheduleRenew();
}
/* A Google sign-in token is good for one hour. The toolkit used to keep the
   expired one in the session and still show the name in the corner, so the
   page looked signed in while every server call came back rejected — which
   is why the landing page reader "never worked". The token is checked before
   it is used, and a stale one is replaced rather than sent. */
const tokenLeft=()=>USER&&USER.exp?USER.exp*1000-Date.now():0;
const tokenLive=()=>!!USER&&tokenLeft()>60000;

/* A Google sign-in token cannot be made to last longer than its hour, but it
   can be replaced before it dies. While the Google session in the browser is
   still good, One Tap re-issues one without showing anything, so a long
   build is never interrupted by a sign-in screen. */
let RENEW_TIMER=null, RENEWING=false;
function renewToken(){
  return new Promise(res=>{
    if(RENEWING)return res(false);
    if(!(window.google&&google.accounts&&google.accounts.id))return res(false);
    RENEWING=true;
    const was=USER&&USER.exp;
    const done=ok=>{ RENEWING=false; res(ok); };
    try{
      google.accounts.id.cancel();
      google.accounts.id.prompt(n=>{
        /* the callback fires on display, not on completion, so the new token
           is detected by watching for a later expiry */
        if(n&&(n.isNotDisplayed&&n.isNotDisplayed()||n.isSkippedMoment&&n.isSkippedMoment()))
          setTimeout(()=>done(!!(USER&&USER.exp&&USER.exp!==was)),400);
      });
      const t0=Date.now();
      const poll=setInterval(()=>{
        if(USER&&USER.exp&&USER.exp!==was){ clearInterval(poll); done(true); }
        else if(Date.now()-t0>6000){ clearInterval(poll); done(false); }
      },250);
    }catch(e){ done(false); }
  });
}
/* renew a few minutes before the hour is up, and keep doing so */
function scheduleRenew(){
  if(RENEW_TIMER)clearTimeout(RENEW_TIMER);
  const left=tokenLeft();
  if(!left)return;
  const when=Math.max(15000,left-4*60*1000);
  RENEW_TIMER=setTimeout(async()=>{
    const ok=await renewToken();
    if(ok)scheduleRenew(); else tokenPanel();
  },when);
}
function tokenPanel(){
  const w=$("#expWarn"); if(!w)return;
  const dead=USER&&!tokenLive();
  w.classList.toggle("hidden",!dead);
  if(dead)w.innerHTML=`<div class="check c-bad"><span class="ic">✕</span><span>
    <b>Your Google sign-in expired.</b> It lasts an hour. Nothing on the server will answer until
    you sign in again — that includes reading landing pages.
    <button class="btn btn-pri btn-sm" id="reSign" style="margin-top:8px">Sign in again</button></span></div>`;
}
on("#expWarn","click",e=>{ if(e.target.id!=="reSign")return; reSignIn(); });
function reSignIn(){
  try{sessionStorage.removeItem("pp_user");}catch(e){}
  USER=null;
  if(window.google&&google.accounts&&google.accounts.id){
    google.accounts.id.disableAutoSelect();
    location.reload();
  } else location.reload();
}
setInterval(tokenPanel,30000);
function initAuth(){
  $("#gateDomain").textContent=AUTH.domain;
  if(!AUTH.clientId){
    $("#gate").classList.remove("hidden");
    $("#gateBtn").innerHTML=`<div class="check c-warn"><span class="ic">!</span><span>
      <b>Sign-in is not switched on yet.</b> It needs a Google OAuth client ID, which has to be
      created inside the PropertyPistol Google Cloud account — nobody outside it can make one.
      Follow SETUP.md, then paste the ID into <code>AUTH.clientId</code> at the top of the script.</span></div>
      <button class="btn btn-pri" id="gateSkip" style="margin-top:14px;width:100%">Continue without signing in</button>`;
    on("#gateSkip","click",()=>{
      $("#gate").classList.add("hidden");
      $("#userChip").classList.remove("hidden");
      $("#userName").textContent="Not signed in";
      $("#userRole").textContent="OPEN"; $("#userRole").className="pill p-bad";
    });
    return;
  }
  let restored=false;
  try{
    const s=sessionStorage.getItem("pp_user");
    if(s){
      const u=JSON.parse(s);
      /* An expired token in the session is worse than none: it hides the
         gate and then fails every call. Only a live one is restored. */
      if(u&&u.exp&&u.exp*1000-Date.now()>60000){ USER=u; showUser(); restored=true; scheduleRenew(); }
      else sessionStorage.removeItem("pp_user");
    }
  }catch(e){}
  if(!restored)$("#gate").classList.remove("hidden");
  /* Initialised either way, so an expiry mid-session can be recovered from
     without the person having to work out that a reload is what is needed. */
  const start=()=>{
    if(!(window.google&&google.accounts&&google.accounts.id))return setTimeout(start,300);
    google.accounts.id.initialize({client_id:AUTH.clientId,callback:onCredential,
      hd:AUTH.domain,auto_select:true});
    if(!restored)google.accounts.id.renderButton($("#gateBtn"),{theme:"outline",size:"large",width:360,text:"signin_with"});
  };
  start();
  tokenPanel();
}
on("#newProject","click",()=>{
  if(!confirm("Clear the brief, ad groups, keywords and assets and start a new project?\n\nYour strategy list, Gemini key and campaign settings are kept."))return;
  clearProject(); logEvent("new-project",""); location.reload();
});
on("#projSave","click",async()=>{
  const guess=($("#acProj")&&$("#acProj").value.trim())||($("#inEnq")&&$("#inEnq").value.trim())||"";
  const name=(prompt("Save this project as:",guess)||"").trim();
  if(!name)return;
  const all=projects();
  if(all[name]&&!confirm(`"${name}" already exists. Replace it?`))return;
  const assets=assetSnapshot();
  all[name]=Object.assign(projectSnapshot(),
    {hasAssets:!!assets, heroCount:assets?assets.heroes.length:0});
  store.set(PROJ_STORE,all);
  if(store.get(PROJ_STORE,{})[name]===undefined)
    return toast("Could not save \u2014 browser storage is full. Delete an old project and retry.");
  drawProjects(); $("#projPick").value=name;

  /* The brief is already safe at this point. The pictures are a second,
     larger write that can fail on its own \u2014 a full disk, a private window
     \u2014 and if it does the project is still a project, just without them.
     Saying so beats a save that silently keeps half of itself. */
  if(!assets)return toast(`Saved as "${name}"`),logEvent("project-save",name);
  toast(`Saved as "${name}" \u2014 storing ${assets.heroes.length} image${
    assets.heroes.length===1?"":"s"}\u2026`);
  try{
    await AssetDB.put(name,assets);
    toast(`Saved as "${name}" with its images`);
  }catch(e){
    all[name].hasAssets=false; store.set(PROJ_STORE,all);
    toast(`Saved as "${name}", but the images could not be stored: ${e.message||e}`,8000);
  }
  logEvent("project-save",name);
});
on("#projPick","change",()=>{
  const sel=$("#projPick"), v=sel.value;
  if(!v)return;
  if(v==="__del"){
    const all=projects();
    const name=(prompt("Delete which project?\n\n"+Object.keys(all).join("\n"))||"").trim();
    sel.value="";
    if(!name||!all[name])return;
    if(!confirm(`Delete "${name}"? This cannot be undone.`))return;
    delete all[name]; store.set(PROJ_STORE,all); drawProjects();
    AssetDB.del(name).catch(()=>{});   /* or its pictures sit there for ever */
    return toast(`Deleted "${name}"`);
  }
  const p=projects()[v];
  if(!p){ sel.value=""; return toast("That project is no longer saved"); }
  if(!confirm(`Open "${v}"?\n\nAnything unsaved in the current project is lost.`)){
    sel.value=""; return; }
  logEvent("project-open",v);
  projectApply(p,v);
});
