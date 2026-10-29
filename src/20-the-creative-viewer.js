/* ═══════════ the creative viewer ═══════════ */
let LB_AT=0;
function lbShow(i){
  if(!CR_OUT.length)return;
  LB_AT=(i+CR_OUT.length)%CR_OUT.length;
  const o=CR_OUT[LB_AT];
  $("#lbImg").src=o.url;
  $("#lbName").innerHTML=`<b>${esc(o.name)}</b>`;
  $("#lbMeta").textContent=`${o.w}×${o.h} · ${o.ratio} · ${(o.bytes/1024).toFixed(0)} KB`;
  const dl=$("#lbDl");
  dl.href=o.url;
  dl.download=`${slug(brief().proj||"creative")}-${o.w}x${o.h}.jpg`;
  $("#lbDots").innerHTML=CR_OUT.map((x,k)=>
    `<span class="lb-dot${k===LB_AT?" on":""}" data-k="${k}" title="${esc(x.name)}"></span>`).join("");
  $("#lb").classList.add("on");
}
function lbClose(){ $("#lb").classList.remove("on"); $("#lbImg").src=""; }
on("#lbX","click",lbClose);
on("#lbPrev","click",()=>lbShow(LB_AT-1));
on("#lbNext","click",()=>lbShow(LB_AT+1));
on("#lbDots","click",e=>{ const d=e.target.closest(".lb-dot"); if(d)lbShow(+d.dataset.k); });
$("#lb").addEventListener("click",e=>{ if(e.target.id==="lb")lbClose(); });
document.addEventListener("keydown",e=>{
  if(!$("#lb").classList.contains("on"))return;
  if(e.key==="Escape")lbClose();
  else if(e.key==="ArrowLeft")lbShow(LB_AT-1);
  else if(e.key==="ArrowRight")lbShow(LB_AT+1);
});
/* the thumbnails open it */
on("#crOut","click",e=>{
  const img=e.target.closest("img[data-k]");
  if(img)lbShow(+img.dataset.k);
});

/* ═══════════ deploying to Meta ══════════════════════════════════════════
   The structure is not invented: it is the account's own, written down in
   Meta_Campaign_Creation.pptx. Leads objective, budget on the ad set,
   Instant Forms, residents inside the radius, 28-64, all genders, broker
   lists excluded, feeds and stories and reels, Dynamic Creative off.

   Everything is created paused, and nothing is reported as created unless
   Meta returned an id for it. */

const mdLine=(l,ic,h)=>`<div class="check c-${l}"><span class="ic">${ic}</span><span>${h}</span></div>`;

/* The renders that belong in a Meta ad. The square carries the feeds and
   the story carries stories and reels; the two wide Google sizes have no
   placement here and are left out rather than squeezed in. */
/* One ad per hero, not one per size.

   Three renders of the same artwork used to become three ads, which is
   three sets of numbers for one creative and three things to switch off.
   They are one ad now, and the shapes go to the placements they were drawn
   for: the 4:5 to the feeds, the 9:16 to stories and reels. */
async function mdCreativeSets(){
  const want=["square","portrait","story"];
  const out=[];
  const shrink=async b64=>{
    const small=await aiShrink("data:image/jpeg;base64,"+b64,1200);
    return small||b64;
  };
  const sets=(typeof allSets==="function"?allSets():[])||[];
  for(const st of sets){
    const imgs=(st&&st.images)||{};
    const one={name:String(st.name||"Ad").slice(0,60), images:{}};
    for(const nm of want) if(imgs[nm]&&imgs[nm].data)
      one.images[nm]=await shrink(imgs[nm].data);
    if(Object.keys(one.images).length){ out.push(one); if(out.length>=10)break; }
  }
  if(out.length)return out;

  /* nothing kept as a set — group the loose renders by the hero they came
     from, which is what CR_OUT records */
  const byHero={};
  for(const o of (CR_OUT||[])){
    const nm=String(o.name||"").toLowerCase();
    const shape=want.find(w=>nm.indexOf(w)>-1);
    if(!shape||!o.url)continue;
    const hero=String(o.hero||"Ad").slice(0,60);
    (byHero[hero]=byHero[hero]||{name:hero,images:{}});
    if(!byHero[hero].images[shape])
      byHero[hero].images[shape]=await shrink(String(o.url).split(",")[1]||"");
  }
  return Object.keys(byHero).slice(0,10).map(k=>byHero[k]);
}

async function mdCreatives(){
  /* A set keeps its renders in an object keyed by size, not a list, and the
     two wide Google shapes have no Meta placement — so only the square, the
     portrait and the story are taken, in that order. */
  const want=["square","portrait","story"];
  const out=[];
  const push=async(name,b64)=>{
    if(!b64||out.length>=10)return;
    const small=await aiShrink("data:image/jpeg;base64,"+b64,1200);
    out.push({name:String(name).slice(0,60),data:small||b64});
  };
  const sets=(typeof allSets==="function"?allSets():[])||[];
  for(const st of sets){
    const imgs=(st&&st.images)||{};
    for(const nm of want) if(imgs[nm]&&imgs[nm].data)
      await push(`${st.name?st.name+" ":""}${nm}`.trim(),imgs[nm].data);
  }
  if(out.length)return out;

  /* nothing kept as a set yet — take the loose renders instead */
  for(const o of (CR_OUT||[])){
    const nm=String(o.name||"").toLowerCase();
    if(!want.some(w=>nm.indexOf(w)>-1))continue;
    const data=await aiShrink(o.url,1200);
    if(data)out.push({name:o.name,data});
    if(out.length>=10)break;
  }
  return out;
}

/* ═══════════ audiences, one ad set each ═══════════
   Meta splits delivery and reports results on the ad set. Two audiences
   inside one ad set is therefore one number where two were wanted, and no
   way to turn the weaker one off. Each audience here becomes its own ad
   set under the one campaign, carrying the same ads.

   An audience states only what it changes. Everything it leaves alone —
   age, exclusions, budget, Advantage+ — comes from the fields above, so a
   project that never touches this behaves exactly as it always did. */
const AUD_KEY="pp_meta_auds";
let AUDS=store.get(AUD_KEY,[])||[];
const saveAuds=()=>store.set(AUD_KEY,AUDS);
const audNewId=()=>"a"+Date.now().toString(36)+Math.random().toString(36).slice(2,5);
const audIds=t=>String(t||"").split(/[\n,]/).map(x=>x.trim()).filter(Boolean);

function audSummary(a){
  const bits=[];
  if(a.interestNames&&a.interestNames.trim())
    bits.push(audIds(a.interestNames).length+" interests by name");
  if(a.interests&&a.interests.trim())bits.push(audIds(a.interests).length+" interest ids");
  if(a.include&&a.include.trim())bits.push(audIds(a.include).length+" included");
  if(a.exclude&&a.exclude.trim())bits.push(audIds(a.exclude).length+" excluded");
  if(a.ageMin||a.ageMax)bits.push(`${a.ageMin||val("mdAgeMin")}–${a.ageMax||val("mdAgeMax")}`);
  if(a.genders&&a.genders!=="all")bits.push(a.genders==="1"?"men":"women");
  bits.push(`₹${a.dailyBudget||val("mdBudget")||0}/day`);
  if(a.advantage==="on")bits.push("Advantage+");
  return bits.join(" · ")+" — anything not set here comes from the fields above";
}
/* An audience is OFF when a.off is set, so everything saved before this
   existed stays on, which is what those projects already did. */
const audOn=a=>!a.off;
const audPicked=()=>AUDS.filter(audOn);

/* the summary appears twice — open underneath, collapsed on the row */
function audRetitle(card,a){
  if(!card||!a)return;
  const full=audSummary(a);
  const sum=card.querySelector(".mdaud-sum"); if(sum)sum.textContent=full;
  const one=card.querySelector(".mdaud-oneline"); if(one)one.textContent=full.split(" — ")[0];
}
function drawAuds(){
  const box=$("#mdAudList"); if(!box)return;
  box.innerHTML=AUDS.map((a,i)=>`
    <div class="mdaud${a.open?" open":""}${audOn(a)?"":" off"}" data-ai="${i}">
      <div class="mdaud-hd">
        <input type="checkbox" class="tick" data-ac="${i}"${audOn(a)?" checked":""}
          title="Build an ad set for this audience">
        <input class="nm" data-af="name" value="${esc(a.name||"")}" placeholder="Name this audience">
        <span class="mdaud-oneline">${esc(audSummary(a).split(" — ")[0])}</span>
        <button class="ed" data-ae="${i}" title="Edit this audience">${a.open?"Done":"Edit"}</button>
        <button class="x" data-ax="${i}" title="Remove">✕</button>
      </div>
      <div class="mdaud-g">
        <label class="wide"><span class="l">Interests
            <span class="p-mute" style="text-transform:none;letter-spacing:0;font-weight:400">by name</span></span>
          <input data-af="interestNames" value="${esc(a.interestNames||"")}"
            placeholder="Luxury Watches, HDFC Bank…"></label>
        <label><span class="l">Interest ids
            <span class="p-mute" style="text-transform:none;letter-spacing:0;font-weight:400">if you have them</span></span>
          <input data-af="interests" value="${esc(a.interests||"")}" placeholder="6003… , 6004…"></label>
        <label><span class="l">Custom audiences in</span>
          <input data-af="include" value="${esc(a.include||"")}" placeholder="lookalike ids"></label>
        <label><span class="l">Custom audiences out</span>
          <input data-af="exclude" value="${esc(a.exclude||"")}" placeholder="broker list ids"></label>
        <label class="wide"><span class="l">Age</span>
          <div class="agepair">
            <input data-af="ageMin" inputmode="numeric" value="${esc(a.ageMin||"")}" placeholder="${esc(val("mdAgeMin")||"28")}">
            <span class="dash">–</span>
            <input data-af="ageMax" inputmode="numeric" value="${esc(a.ageMax||"")}" placeholder="${esc(val("mdAgeMax")||"64")}">
          </div></label>
        <label><span class="l">Gender</span>
          <select data-af="genders">
            <option value="all"${a.genders==="all"||!a.genders?" selected":""}>Everyone</option>
            <option value="1"${a.genders==="1"?" selected":""}>Men</option>
            <option value="2"${a.genders==="2"?" selected":""}>Women</option>
          </select></label>
        <label><span class="l">Daily budget</span>
          <input data-af="dailyBudget" inputmode="decimal" value="${esc(a.dailyBudget||"")}"
            placeholder="${esc(val("mdBudget")||"450")}"></label>
        <label><span class="l">Advantage+</span>
          <select data-af="advantage">
            <option value=""${!a.advantage?" selected":""}>As set above</option>
            <option value="on"${a.advantage==="on"?" selected":""}>On</option>
            <option value="off"${a.advantage==="off"?" selected":""}>Off</option>
          </select></label>
      </div>
      <div class="mdaud-sum">${esc(audSummary(a))}</div>
    </div>`).join("");

  const note=$("#mdAudNote"), n=audPicked().length;
  if(note)note.textContent=!AUDS.length
    ? "None yet — one ad set is built from the fields above. Add audiences to split it."
    : n
      ? `${n} of ${AUDS.length} ticked — ${n} ad set${n===1?"":"s"} under one campaign, each with the same ads.`
      : `${AUDS.length} here, none ticked — one ad set is built from the fields above instead.`;
  const pick=$("#mdAudPick");
  if(pick)pick.textContent=AUDS.length?(n===AUDS.length?"untick all":"tick all"):"";
}
/* tick or untick every one of them — the whole point of loading thirteen
   is to run three of them this week */
on("#mdAudPick","click",()=>{
  if(!AUDS.length)return;
  const all=audPicked().length===AUDS.length;
  AUDS.forEach(a=>{ a.off=all; });
  saveAuds(); drawAuds();
});
on("#mdAudAdd","click",()=>{
  AUDS.push({id:audNewId(),name:""}); saveAuds(); drawAuds();
  const last=$("#mdAudList").lastElementChild;
  if(last){ const nm=last.querySelector("input.nm"); if(nm)nm.focus(); }
});
on("#mdAudList","input",e=>{
  const f=e.target&&e.target.closest("[data-af]"); if(!f)return;
  const i=+f.closest(".mdaud").dataset.ai;
  if(!AUDS[i])return;
  AUDS[i][f.dataset.af]=f.value;
  saveAuds();
  audRetitle(f.closest(".mdaud"),AUDS[i]);     /* redrawing would lose the caret */
});
on("#mdAudList","change",e=>{
  const f=e.target&&e.target.closest("select[data-af]"); if(!f)return;
  const i=+f.closest(".mdaud").dataset.ai;
  if(!AUDS[i])return;
  AUDS[i][f.dataset.af]=f.value; saveAuds();
  audRetitle(f.closest(".mdaud"),AUDS[i]);
});
on("#mdAudList","click",e=>{
  const t=e.target;
  const tick=t&&t.closest("[data-ac]");
  if(tick){ const i=+tick.dataset.ac; if(AUDS[i]){ AUDS[i].off=!tick.checked; saveAuds(); drawAuds(); } return; }
  const ed=t&&t.closest("[data-ae]");
  if(ed){ const i=+ed.dataset.ae; if(AUDS[i]){ AUDS[i].open=!AUDS[i].open; saveAuds(); drawAuds(); } return; }
  const x=t&&t.closest("[data-ax]"); if(!x)return;
  const i=+x.dataset.ax;
  const nm=(AUDS[i]&&AUDS[i].name)||"this audience";
  if(!confirm(`Remove “${nm}”? Its ad set will not be built.`))return;
  AUDS.splice(i,1); saveAuds(); drawAuds();
});

/* what the backend wants: only the fields this audience actually sets */
function audPayload(){
  return AUDS.filter(a=>audOn(a)&&a.name&&a.name.trim()).map(a=>{
    const o={name:a.name.trim()};
    const ints=audIds(a.interests);
    if(ints.length)o.interests=ints.map(id=>({id,name:""}));
    /* names are looked up server side, where the answer is cached and the
       ones Meta does not know can be reported */
    else if(a.interestNames&&a.interestNames.trim())o.interestNames=a.interestNames.trim();
    const inc=audIds(a.include); if(inc.length)o.include=inc;
    const exc=audIds(a.exclude); if(exc.length)o.exclude=exc;
    if(a.ageMin)o.ageMin=Number(a.ageMin)||undefined;
    if(a.ageMax)o.ageMax=Number(a.ageMax)||undefined;
    if(a.genders&&a.genders!=="all")o.genders=[Number(a.genders)];
    if(a.dailyBudget)o.dailyBudget=Number(a.dailyBudget)||undefined;
    if(a.advantage==="on")o.advantageAudience=true;
    if(a.advantage==="off")o.advantageAudience=false;
    return o;
  });
}

/* drawn here rather than at the top of the file: AUDS is declared just
   above, and a call before that line is in the temporal dead zone — it
   threw, was swallowed by the boot's try/catch, and the cards from a saved
   project simply never appeared. */
drawAuds();

function mdBody(){
  const b=brief();
  const copy={
    primary:(MT.p&&MT.p[0])||"", headline:(MT.h&&MT.h[0])||"", description:(MT.d&&MT.d[0])||""
  };
  return {
    /* the CRM enquiry name is what the campaign is called: it is the name
       the lead will come back under, so the two match in reporting */
    brief:{proj:b.proj,dev:b.dev,micro:b.micro,city:b.city,
           enquiry:(val("inEnq")||"").trim()},
    /* Meta takes the set it was given on the Targeting tab, the same way
       each Google campaign does. It used to take every target there was,
       whichever set they belonged to. */
    targets:(typeof locTargetsForMeta==="function"?locTargetsForMeta():TARGETS),
    copy,
    settings:{
      accountId:val("mdAcct"), pageId:val("mdPage"), formId:val("mdForm"),
      /* Meta refuses a lead ad whose creative links to a Facebook Page:
         "Lead Generation ads should always link to external content."
         So the project's own landing page goes with it. */
      link:(PROJ&&PROJ.url)||val("inLp")||"",
      dailyBudget:Number(val("mdBudget"))||0,
      ageMin:Number(val("mdAgeMin"))||28, ageMax:Number(val("mdAgeMax"))||64,
      cta:val("mdCta"),
      advantageAudience:$("#mdAdv")&&$("#mdAdv").checked,
      specialCategories:val("mdSpecial")?[val("mdSpecial")]:[],
      excludeAudiences:val("mdExcl").split("\n").map(x=>x.trim()).filter(Boolean),
      audiences:audPayload()
    }
  };
}

function mdShow(r,what){
  const box=$("#mdOut");
  if(r.error){
    $("#mdStat").innerHTML=`<span class="pill p-bad">failed</span>`;
    let h=mdLine("bad","✕",`<b>${esc(what)} stopped.</b> ${esc(r.error)}`);
    /* The server undoes a half-built campaign itself and says so in the
       message above, naming the id only when the cleanup also failed.
       Repeating it here told people to go and delete something that was
       already gone. */
    box.innerHTML=h; return;
  }
  const made=r.made||{}, notes=r.notes||[];
  let h="";
  if(r.validated){
    $("#mdStat").innerHTML=`<span class="pill p-ok">validated</span>`;
    h=mdLine("ok","✓","<b>Meta accepted the campaign and the ad set.</b> Nothing was created — "+
      "this only checked that it would be.");
  }else{
    $("#mdStat").innerHTML=`<span class="pill p-ok">deployed</span>`;
    h=mdLine("ok","✓",`<b>Created, paused.</b> Campaign <code>${esc(made.campaign||"")}</code>, `+
      `ad set <code>${esc(made.adset||"")}</code>, ${(made.ads||[]).length} ad`+
      ((made.ads||[]).length===1?"":"s")+".");
    (made.ads||[]).forEach(a=>{ h+=mdLine("ok","✓",`${esc(a.name)} — <code>${esc(a.id)}</code>`); });
    h+=mdLine("warn","!","Nothing is spending yet. Turn the campaign on in Ads Manager when the "+
      "copy and the form have been read once more.");
  }
  const p=r.plan||{};
  if(p.campaign)h+=`<div class="f-lab" style="margin-top:14px">What was sent</div>`+
    `<div class="dpair"><span>Campaign</span><span>${esc(p.campaign.name)}</span></div>`+
    `<div class="dpair"><span>Ad set</span><span>${esc(p.adset.name)}</span></div>`+
    `<div class="dpair"><span>Daily budget</span><span>₹${esc(String(Number(p.adset.daily_budget)/100))}</span></div>`+
    `<div class="dpair"><span>Radius</span><span>${
      ((p.adset.targeting.geo_locations||{}).custom_locations||[]).map(c=>c.radius+" km").join(", ")||"—"}</span></div>`+
    `<div class="dpair"><span>Age</span><span>${p.adset.targeting.age_min}–${p.adset.targeting.age_max}</span></div>`+
    `<div class="dpair"><span>Excluded</span><span>${
      (p.adset.targeting.excluded_custom_audiences||[]).length} custom audience(s)</span></div>`;
  notes.forEach(n=>{ h+=mdLine("warn","!",esc(n)); });
  box.innerHTML=h;
}

async function mdRun(action,what){
  const box=$("#mdOut");
  $("#mdStat").innerHTML=`<span class="pill p-mute">${esc(what)}…</span>`;
  box.innerHTML=mdLine("warn","…",`${esc(what)}…`);
  const body=mdBody();
  if(action==="meta-deploy"){
    box.innerHTML=mdLine("warn","…","Shrinking the creatives…");
    body.creatives=await mdCreativeSets();
    if(!body.creatives.length)
      return mdShow({error:"No render was found. Render in the Creative studio first."},what);
  }
  const r=await adsCall(action,body);
  mdShow(r,what);
}

