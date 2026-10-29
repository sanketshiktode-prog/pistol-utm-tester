/* ═══════════ the landing page builder ═══════════════════════════════════
   The builder is served from /lp/ on this same site, so the two share an
   origin. That is what makes the link between them work with no server at
   all: whatever either side writes to localStorage, the other can read.

   It goes both ways on purpose. The campaign is usually started first, so
   the project is pushed into the builder; but the page is where possession,
   the real USP wording and the amenity list get finished, so that comes
   back. Neither side overwrites the other without being asked. */

const LP_KEY="pp_lp_handover";      /* Trigger  → builder */
const LP_BACK="pp_lp_fromBuilder";  /* builder  → Trigger */
const LP_AUTH="pp_auth";            /* so the builder can reach Gemini too */

/* The builder is on this same origin, so it can be handed the session rather
   than asking for a second sign-in. It is the same short-lived Google token
   that already lives in this tab, it expires on its own, and it never leaves
   the origin. Without it the builder still works — it just sorts photographs
   by their file names instead of looking at them. */
function publishAuth(){
  try{
    if(USER&&tokenLive()&&AUTH.logUrl)
      localStorage.setItem(LP_AUTH,JSON.stringify({
        url:AUTH.logUrl,credential:USER.credential,exp:USER.exp,email:USER.email}));
    else localStorage.removeItem(LP_AUTH);
  }catch(e){ /* a blocked or full localStorage must not stop the handover */ }
}

function lpBrief(){
  const kw=(id,n)=>val(id).split("\n").map(x=>x.trim()).filter(Boolean).slice(0,n||20);
  const b=faqBrief();
  const faq=(FAQ_OUT.faqs||[]).map(f=>({q:f.q,a:f.a}));
  return {
    v:2, at:Date.now(),
    project:{ name:b.proj, developer:b.dev,
              location:b.loc, config:b.cfg, price:b.price,
              rera:b.rera, possession:b.possession, offer:b.offer },
    usps:kw("acUsps",8), amenities:kw("acAmen",24), landmarks:kw("acMarks",12),
    faq:faq,
    lead:{ projectCode:(b.proj||"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,""),
           countryCode:"+91" },
    tracking:{}
  };
}
function lpDraw(){
  const b=lpBrief(), box=$("#lpOut");
  if(!b.project.name){
    box.innerHTML=`<div class="empty">Fill the brief on the Ad copy tab first.</div>`;
    $("#lpStat").innerHTML=`<span class="pill p-warn">no project</span>`; return; }
  const rows=[["Project",b.project.name],["Developer",b.project.developer],
    ["Location",b.project.location],["Configuration",b.project.config],
    ["Price",b.project.price],["Offer",b.project.offer],
    ["RERA",b.project.rera],["Possession",b.project.possession],
    ["Project code",b.lead.projectCode],
    ["USPs",b.usps.join(" · ")],["Amenities",b.amenities.join(" · ")],
    ["Landmarks",b.landmarks.join(" · ")],
    ["FAQs",b.faq.length?`${b.faq.length} written from the keywords`:"none built yet"]];
  box.innerHTML=rows.filter(r=>r[1]).map(([k,v])=>
    `<div class="dpair"><span>${esc(k)}</span><span>${esc(v)}</span></div>`).join("");
  $("#lpStat").innerHTML=`<span class="pill p-ok">ready</span>`;
}

function lpGo(withBrief){
  const base=location.href.replace(/[^/]*$/,"")+"lp/";
  if(!withBrief){ window.open(base,"_blank","noopener"); return; }
  const b=lpBrief();
  if(!b.project.name)return toast("Add a project name on the Ad copy tab first");
  publishAuth();
  try{ localStorage.setItem(LP_KEY,JSON.stringify(b)); }
  catch(e){ console.warn("Could not stage the brief",e); }
  window.open(base+"#handover=1","_blank","noopener");
  toast(b.faq.length?`Sent with ${b.faq.length} FAQs`:"Sent — build the FAQs to send those too");
}

/* Whatever the builder last had open. It writes this on every change, so
   there is nothing to press on that side. */
function lpPull(){
  let d=null;
  try{ d=JSON.parse(localStorage.getItem(LP_BACK)||"null"); }catch(e){}
  if(!d||!d.project||!d.project.name)
    return toast("Nothing from the builder yet — open a project there first");
  const put=(id,v)=>{ const el=$("#"+id);
    if(el&&v&&el.value!==String(v)){ el.value=String(v);
      el.dispatchEvent(new Event("input",{bubbles:true}));
      el.dispatchEvent(new Event("change",{bubbles:true})); return 1; } return 0; };
  let n=0;
  n+=put("acProj",d.project.name);
  n+=put("acDev",d.project.developer);
  n+=put("acMicro",d.project.micro);
  n+=put("acCity",d.project.city);
  n+=put("acCfg",d.project.config);
  n+=put("acPrice",d.project.price);
  n+=put("acOffer",d.project.offer);
  n+=put("crRera",d.project.rera);
  n+=put("lpPoss",d.project.possession);
  if((d.usps||[]).length)       n+=put("acUsps",d.usps.join("\n"));
  if((d.amenities||[]).length)  n+=put("acAmen",d.amenities.join("\n"));
  if((d.landmarks||[]).length)  n+=put("acMarks",d.landmarks.join("\n"));
  if(d.lp)                      n+=put("inLp",d.lp);
  lpDraw();
  toast(n?`Pulled ${n} field${n===1?"":"s"} from the builder`:"Everything already matches the builder");
}

on("#lpOpen","click",()=>lpGo(true));
on("#lpPlain","click",()=>lpGo(false));
on("#lpPull","click",()=>lpPull());

/* The tab only makes sense once its inputs exist, so it refreshes when it
   is opened rather than on a timer. */
document.addEventListener("click",e=>{
  const t=e.target.closest('[data-panel]');
  if(t&&t.dataset.panel==="p-lp"){ publishAuth(); setTimeout(lpDraw,0); }
});

drawProjects(); projectRestore(); drawSets();
initAuth();
/* Catch any button that lost its handler during an edit. */
(function(){
  const loose=[...document.querySelectorAll("button[id]")].filter(b=>!b.__bound&&!b.onclick)
    .map(b=>b.id).filter(id=>!BOUND.has(id));
  if(loose.length)console.warn("buttons with no handler:",loose.join(", "));
})();
