/* ═══════════ Launch — one click, every platform ═══════════
   "There should be separate tabs for drafting Demandgen and Search after
   brief is completed but deployment should be one click. Like select
   platforms Search, Demandgen and Meta and Deploy at once."

   Drafting stays where it is: the channel toggle on the brief for the two
   Google campaign types, the Meta tab for Meta. What was missing is the
   end — three places to press Deploy, in an order you had to remember,
   with no single answer at the end of it.

   This ticks the platforms and runs them one after another. Never
   together: the second must not start while the first could still be half
   way through creating campaigns, and a Google failure must not leave a
   Meta campaign live with nothing pointing at it. */
const LAUNCH_KEY="pp_launch_pick";
const LAUNCH=[
  {id:"search",    label:"Search",     kind:"google"},
  {id:"demandgen", label:"Demand Gen", kind:"google"},
  {id:"meta",      label:"Meta",       kind:"meta"}
];
let LAUNCH_PICK=store.get(LAUNCH_KEY,{search:true,demandgen:false,meta:false})||{};
let LAUNCH_BUSY=false;

function drawLaunch(){
  const box=$("#lnPick"); if(!box)return;
  box.innerHTML=LAUNCH.map(p=>`
    <label class="ln-tick${LAUNCH_PICK[p.id]?" on":""}">
      <input type="checkbox" data-ln="${p.id}"${LAUNCH_PICK[p.id]?" checked":""}>
      <span class="nm">${esc(p.label)}</span>
      <span class="sub">${esc(launchReady(p).short)}</span>
    </label>`).join("");
  const n=LAUNCH.filter(p=>LAUNCH_PICK[p.id]).length;
  const st=$("#lnStat");
  if(st)st.innerHTML=n
    ? `<span class="pill p-live">${n} platform${n===1?"":"s"}</span>`
    : `<span class="pill p-mute">nothing ticked</span>`;
  ["lnValidate","lnDeploy"].forEach(id=>{
    const b=$("#"+id); if(b)b.disabled=!n||LAUNCH_BUSY;
  });
}

/* What each platform still needs, said before anything is sent rather
   than discovered three calls in. */
function launchReady(p){
  if(p.kind==="google"){
    const cid=($("#apCid")&&$("#apCid").value||"").replace(/[^0-9]/g,"");
    if(!cid)return {ok:false,short:"needs the customer ID",why:"No Google customer ID on the Deploy tab."};
    if(typeof planForChannel!=="function")return {ok:false,short:"not built",why:"The structure builder is not loaded."};
    const r=planForChannel(p.id);
    if(r.error)return {ok:false,short:"not ready",why:r.error};
    const n=r.plan.campaigns.length;
    return {ok:true,short:`${n} campaign${n===1?"":"s"}`,plan:r.plan,cid};
  }
  const b=typeof mdBody==="function"?mdBody():null;
  if(!b||!b.settings||!b.settings.accountId)
    return {ok:false,short:"needs the ad account",why:"No Meta ad account on the Meta tab."};
  if(!b.settings.pageId||!b.settings.formId)
    return {ok:false,short:"needs page and form",why:"The Meta page and lead form are not both chosen."};
  const auds=typeof audPayload==="function"?audPayload().length:0;
  return {ok:true,short:auds?`${auds} ad sets`:"1 ad set",auds};
}

on("#lnPick","change",e=>{
  const t=e.target&&e.target.closest("[data-ln]"); if(!t)return;
  LAUNCH_PICK[t.dataset.ln]=t.checked;
  store.set(LAUNCH_KEY,LAUNCH_PICK);
  drawLaunch();
});

const lnLine=(k,ic,h)=>`<div class="check c-${k}"><span class="ic">${ic}</span><span>${h}</span></div>`;

async function launchRun(mode){
  if(LAUNCH_BUSY)return;
  const picked=LAUNCH.filter(p=>LAUNCH_PICK[p.id]);
  if(!picked.length)return toast("Tick a platform first");
  const out=$("#lnOut");

  /* everything is checked before anything is sent, so a half-launched
     project is not the way you find out the customer ID is missing */
  const checks=picked.map(p=>({p,r:launchReady(p)}));
  const bad=checks.filter(x=>!x.r.ok);
  if(bad.length){
    out.innerHTML=lnLine("bad","✕",`<b>Nothing was sent.</b> `+
      bad.map(x=>`${esc(x.p.label)}: ${esc(x.r.why)}`).join("<br>"));
    return;
  }
  if(mode==="deploy"){
    const cid=checks.find(x=>x.p.kind==="google");
    const meta=checks.find(x=>x.p.kind==="meta");
    const lines=checks.map(x=>`    ${x.p.label}: ${x.r.short}`).join("\n");
    if(!confirm(`Launch ${picked.length} platform${picked.length===1?"":"s"}?\n\n${lines}\n\n`+
      (cid?`Google account ${cid.r.cid}${acctName(cid.r.cid)?" — "+acctName(cid.r.cid):""}\n`:"")+
      (meta?`Meta account ${(mdBody().settings||{}).accountId}\n`:"")+
      `\nEverything is created paused. Nothing spends until you turn it on.`))return;
  }

  LAUNCH_BUSY=true; drawLaunch();
  let html="", trouble=0, done=0;
  const verb=mode==="deploy"?"Deploying":"Validating";
  try{
    for(const {p,r} of checks){
      out.innerHTML=html+lnLine("warn","…",`${verb} ${esc(p.label)}…`);
      let res;
      if(p.kind==="google"){
        res=await adsCall("ads-deploy",{customerId:r.cid,mode,plan:r.plan});
      }else{
        const body=mdBody();
        if(mode==="deploy"){
          body.creatives=await mdCreativeSets();
          if(!body.creatives.length)res={error:"No render was found. Render in the Creative studio first."};
        }
        if(!res)res=await adsCall(mode==="deploy"?"meta-deploy":"meta-validate",body);
      }
      html+=`<div class="f-lab" style="margin:14px 0 6px">${esc(p.label)}</div>`;
      if(res&&res.error){
        trouble++;
        html+=lnLine("bad","✕",`<b>Failed.</b> ${esc(res.error)}`);
        /* A Google channel that fails does not stop the rest — each
           campaign is all or nothing, so nothing half-made is left. Meta
           rolls its own campaign back, and says so in that same message. */
        out.innerHTML=html;
        continue;
      }
      done++;
      if(p.kind==="google"){
        trouble+=res.failed||0;
        html+=(typeof apResultRows==="function"?apResultRows(res).join(""):"");
      }else{
        const made=res.made||{};
        html+=lnLine("ok","✓",made.campaign
          ? `Campaign <code>${esc(made.campaign)}</code>, ${(made.ads||[]).length} ad${
              (made.ads||[]).length===1?"":"s"}, paused.`
          : `Validated. Meta accepted every field and created nothing.`);
        (res.notes||[]).forEach(n=>{ html+=lnLine("warn","!",esc(n)); });
      }
      out.innerHTML=html;
    }
  }finally{ LAUNCH_BUSY=false; drawLaunch(); }

  out.innerHTML=(trouble
    ? lnLine("bad","✕",`<b>${done} of ${checks.length} went through.</b> The failures are below,
        each with what the platform said. Nothing half-made was left behind — a campaign is all
        or nothing on both.`)
    : lnLine("ok","✓",mode==="deploy"
        ? `<b>Launched on ${checks.map(x=>esc(x.p.label)).join(", ")}.</b> Everything is paused.
           Open each account and check before turning anything on.`
        : `<b>Validated on ${checks.map(x=>esc(x.p.label)).join(", ")}.</b> Both platforms accepted
           every field and created nothing.`))+html;
  logEvent(mode==="deploy"?"launch":"launch-validate",
    checks.map(x=>x.p.label).join("+")+(trouble?` — ${trouble} failed`:""));
}
on("#lnValidate","click",()=>launchRun("validate").catch(e=>
  $("#lnOut").innerHTML=lnLine("bad","✕",esc(String(e&&e.message||e)))));
on("#lnDeploy","click",()=>launchRun("deploy").catch(e=>
  $("#lnOut").innerHTML=lnLine("bad","✕",esc(String(e&&e.message||e)))));

onBoot(()=>drawLaunch());
