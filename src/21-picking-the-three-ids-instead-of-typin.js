/* ═══════════ picking the three ids instead of typing them ═══════════
   The ids have to agree with one another: the form belongs to the Page,
   the Page and the ad account have to be reachable by the same token. Typed
   by hand they disagree silently and Meta reports it with an error naming
   none of the three. Chosen from the token's own lists they cannot. */
const mdPickers={acct:"mdAcctPick",page:"mdPagePick",form:"mdFormPick"};
function mdShowPick(which,on){
  const sel=$("#"+mdPickers[which]), inp=$("#md"+which[0].toUpperCase()+which.slice(1));
  if(!sel||!inp)return;
  sel.hidden=!on; inp.hidden=on;
  const link=$("#md"+which[0].toUpperCase()+which.slice(1)+"Type");
  if(link)link.textContent=on?"type the id instead":"choose from a list";
}
function mdFill(which,items,chosen,label){
  const sel=$("#"+mdPickers[which]); if(!sel)return;
  sel.innerHTML=`<option value="">— ${label} —</option>`+
    items.map(i=>`<option value="${esc(i.id)}"${i.id===chosen?" selected":""}>${
      esc(i.text)}</option>`).join("");
  mdShowPick(which,true);
}
/* the select is what a person touches; the input stays the single source
   the rest of the tab reads, so nothing downstream had to change */
["acct","page","form"].forEach(which=>{
  on("#"+mdPickers[which],"change",()=>{
    const sel=$("#"+mdPickers[which]);
    const inp=$("#md"+which[0].toUpperCase()+which.slice(1));
    if(!sel||!inp)return;
    inp.value=sel.value;
    inp.dispatchEvent(new Event("change",{bubbles:true}));
    if(which==="page")mdLoadForms(sel.value);
  });
  on("#md"+which[0].toUpperCase()+which.slice(1)+"Type","click",()=>{
    const sel=$("#"+mdPickers[which]);
    mdShowPick(which,!sel||sel.hidden);
  });
});

async function mdLoadForms(pageId){
  const sel=$("#mdFormPick"); if(!sel||!pageId)return;
  sel.innerHTML=`<option value="">— loading forms —</option>`; sel.hidden=false;
  const r=await adsCall("meta-forms",{pageId});
  if(r.error||!r.forms||!r.forms.length){
    mdShowPick("form",false);
    const why=r.error?`: ${r.error}`:" — this Page has none yet";
    $("#mdLoadStat").innerHTML=`<span class="p-mute">Could not list the forms${esc(why)}. `+
      `Type the id, or make one in Meta Business Suite → Instant Forms.</span>`;
    return;
  }
  mdFill("form",r.forms.map(f=>({id:f.id,
    text:f.name+(f.status&&f.status!=="ACTIVE"?` · ${f.status.toLowerCase()}`:"")})),
    val("mdForm"),"choose a form");
}

on("#mdLoad","click",async()=>{
  const st=$("#mdLoadStat");
  st.innerHTML=`<span class="p-mute">Asking Meta what this token can reach…</span>`;
  const r=await adsCall("meta-assets",{});
  if(r.error){ st.innerHTML=`<span class="p-bad">${esc(r.error)}</span>`; return; }
  const n=(r.accounts||[]).length, m=(r.pages||[]).length;
  if(n)mdFill("acct",r.accounts.map(a=>({id:a.id,
    text:a.name+(a.currency?` · ${a.currency}`:"")+(a.active?"":" · inactive")})),
    val("mdAcct").replace(/^act_/,""),"choose an ad account");
  if(m)mdFill("page",r.pages.map(p=>({id:p.id,text:p.name})),val("mdPage"),"choose a Page");
  const notes=(r.notes||[]).length?` <span class="p-mute">${esc(r.notes.join(" · "))}</span>`:"";
  st.innerHTML=(n||m)
    ? `<span class="p-ok">${n} ad account${n===1?"":"s"}, ${m} Page${m===1?"":"s"}.</span>`+
      ` <span class="p-mute">Choosing a Page loads its forms.</span>`+notes
    : `<span class="p-bad">This token can reach no ad accounts or Pages.</span>`+notes;
  if(val("mdPage"))mdLoadForms(val("mdPage"));
});

on("#mdCheck","click",async()=>{
  const b=mdBody();
  const r=await adsCall("meta-check",{settings:b.settings});
  if(r.error)return mdShow(r,"The check");
  $("#mdStat").innerHTML=`<span class="pill ${r.ready?"p-ok":"p-bad"}">${r.ready?"token present":"no token"}</span>`;
  if(!r.ready)
    return $("#mdOut").innerHTML=mdLine("bad","✕",
      "<b>No META_TOKEN on the server.</b> Business Settings → Users → System Users → "+
      "add one, give it the ad account and the Page, Generate token with <code>ads_management</code>, "+
      "then Apps Script → Project Settings → Script Properties → <code>META_TOKEN</code>.");

  /* What Meta sees with this token, which is not always what the Business
     Suite shows the person logged in. A Page can read "Accepted" on the
     Lead Ad Terms page while the token cannot run lead ads on it. */
  let h=mdLine("ok","✓",`A Meta token is on the server, talking to <code>${esc(r.version)}</code>.`);

  /* "The fix is pushed" and "the fix is running" were indistinguishable
     from this screen: the Apps Script keeps a cached copy of the backend,
     so a deploy could still be using the previous code and reporting the
     bug that had just been fixed. */
  const mine=(($("#buildTag")||{}).textContent||"").trim();
  const theirs=(r.backendBuild||"").trim();
  if(theirs&&mine&&theirs!==mine) h+=mdLine("warn","!",
    `<b>The Apps Script is running an older copy of the backend.</b> `+
    `This page is <code>${esc(mine)}</code>, the script has <code>${esc(theirs)}</code>. `+
    `It refreshes itself within a minute — wait and press this again, or run `+
    `<code>clearBackendCache</code> in the Apps Script to do it now.`);
  else if(theirs) h+=mdLine("ok","✓",
    `<span class="p-mute">Backend <code>${esc(theirs)}</code> — same as this page.</span>`);
  const L=r.look||{};

  if(L.account) h+= L.account.error
    ? mdLine("bad","✕",`<b>Ad account:</b> ${esc(L.account.error)}`)
    : mdLine("ok","✓",`<b>Ad account:</b> ${esc(L.account.name||L.account.id)}`+
        (L.account.currency?` · ${esc(L.account.currency)}`:"")+
        (L.account.status!==1?` · <b>status ${esc(String(L.account.status))}</b> — not an active account`:""));

  if(L.page){
    if(L.page.error) h+=mdLine("bad","✕",`<b>Page:</b> ${esc(L.page.error)} — the token may not have this Page.`);
    else if(!L.page.tosKnown) h+=mdLine("warn","!",
      `<b>Page:</b> ${esc(L.page.name||L.page.id)} — the token cannot read whether the Lead Ad Terms `+
      `are accepted. That usually means the Page is owned by another business and only shared with yours. `+
      `It does not by itself mean the terms are missing.`);
    else if(!L.page.leadgenTos) h+=mdLine("bad","✕",
      `<b>${esc(L.page.name||L.page.id)} has not accepted the Lead Ad Terms.</b> `+
      `Open <code>facebook.com/legal/leadgen/tos/?page_id=${esc(L.page.id)}</code> as a Page admin. `+
      `If it already says Accepted there, it was accepted in a different business than the one this `+
      `token belongs to — the Page's owning business is the one that counts.`);
    else h+=mdLine("ok","✓",`<b>Page:</b> ${esc(L.page.name||L.page.id)} · Lead Ad Terms accepted`+
      (L.page.viaPageToken?" <span class=\"hint\">(asked the Page itself)</span>":""));
  }

  if(L.form){
    if(L.form.unreadableOnly) h+=mdLine("warn","!",
      `<b>Instant Form:</b> the token cannot read this form. Reading one needs `+
      `<code>leads_retrieval</code>, which is Advanced Access — and which creating an ad that `+
      `points at the form does <b>not</b> need. So this says nothing about whether the deploy works.`);
    else if(L.form.error) h+=mdLine("bad","✕",`<b>Instant Form:</b> ${esc(L.form.error)}`);
    else if(!L.form.matchesPage) h+=mdLine("bad","✕",
      `<b>That form belongs to a different Page.</b> "${esc(L.form.name||L.form.id)}" sits on `+
      `${esc(L.form.pageName||L.form.pageId)}, not on the Page above. A form cannot be used by another Page.`);
    else h+=mdLine("ok","✓",`<b>Instant Form:</b> ${esc(L.form.name||L.form.id)}`+
      (L.form.status&&L.form.status!=="ACTIVE"?` · <b>${esc(L.form.status)}</b>`:""));
  }

  /* The permission list is what turns "the Page has not accepted the Terms"
     — which it has — into the actual missing scope. */
  const pm=r.perms||{};
  if(pm.error) h+=mdLine("warn","!",`<b>Permissions:</b> could not read them — ${esc(pm.error)}`);
  else if((pm.missing||[]).length) h+=mdLine("bad","✕",
    `<b>The token is missing ${pm.missing.length} permission${pm.missing.length===1?"":"s"}:</b> `+
    pm.missing.map(k=>`<code>${esc(k)}</code> — ${esc((pm.why||{})[k]||"")}`).join("<br>")+
    `<br><span class="p-mute">Business Settings → System Users → your user → `+
    `<b>Generate new token</b>, tick the missing ones, and put the new token in `+
    `<code>META_TOKEN</code>. Asset access alone does not grant these.</span>`);
  else if((pm.granted||[]).length) h+=mdLine("ok","✓",
    `<b>Permissions:</b> everything lead ads need. `+
    `<span class="p-mute">${esc(pm.granted.join(", "))}</span>`);

  h+=mdLine("warn","!","This is what Meta reports. <b>Validate against Meta</b> is what proves the whole structure.");
  $("#mdOut").innerHTML=h;
});
on("#mdValidate","click",()=>mdRun("meta-validate","Validating").catch(e=>mdShow({error:String(e&&e.message||e)},"Validating")));
on("#mdDeploy","click",async()=>{
  const b=mdBody();
  if(!confirm(`Create the campaign, ad set and ads in ad account ${b.settings.accountId||"(not set)"}?\n\n`+
    `Everything is created PAUSED, so nothing spends until you turn it on.`))return;
  mdRun("meta-deploy","Deploying").catch(e=>mdShow({error:String(e&&e.message||e)},"Deploying"));
});
/* the ids are worth remembering between sessions; they are not secrets */
["mdAcct","mdPage","mdForm","mdBudget","mdExcl","mdCta","mdSpecial"].forEach(id=>{
  const el=$("#"+id); if(!el)return;
  const k="pp_meta_"+id;
  const saved=store.get(k,null); if(saved!==null&&saved!=="")el.value=saved;
  el.addEventListener("change",()=>store.set(k,el.value));
});

/* ═══════════ FAQs built from the keywords ═══════════════════════════════
   Quality Score is three things, and landing page experience is the one a
   page can actually be made to earn: the page has to answer what the
   keyword asked, in the words it was asked in. So these FAQs are not
   written from the project and hoped to match the keywords — they are
   written FROM the keywords, one question per intent, each carrying the
   searcher's own terms.

   Answers come only from the brief. Nothing is invented: a keyword asking
   about possession when no possession date was entered produces a question
   that is reported as unanswered rather than a date someone made up. That
   is the house rule, and it is also the only safe way to do this — a wrong
   possession date on a landing page is a legal problem, not a typo. */

const FAQ_STOP=new Set(["in","at","near","the","a","an","for","of","on","by","to",
  "is","are","with","and","or","my","your","best","top","new","latest","list",
  "india","project","projects","property","properties","real","estate"]);

/* Words that are never part of a name. Stripped only when naming the
   subject of a question — "vyana pune possession date" is about Vyana Pune,
   not about "Vyana Pune Date". They still count for coverage, because a
   page that says "flats" is more relevant to "flats" than one that does
   not. */
const FAQ_FILLER=new Set(["date","dates","details","detail","number","numbers",
  "download","pdf","sheet","flats","flat","apartments","apartment","homes","home",
  "house","houses","booking","buy","sale","resale","today","now","online","info",
  "information","contact","enquiry","enquire","available","availability"]);

/* Each intent: how to spot it, how to ask it, how to answer it from the
   brief, and which brief field it needs. Order matters — the first match
   wins, so the specific ones come before the general. */
const FAQ_INTENTS=[
  { id:"price", lab:"Price",
    re:/\b(price|prices|pricing|cost|costs|rate|rates|budget|psf|per\s*sq\.?\s*ft|sq\.?ft\s*rate)\b/i,
    q:(sub)=>`What is the price of ${sub}?`,
    need:"price",
    a:(b)=>`${b.proj} starts at ${b.price}${b.cfg?` for ${b.cfg}`:""}${
      b.loc?`, ${b.loc}`:""}. The complete cost sheet, including all charges, is shared on request.` },

  { id:"config", lab:"Configurations",
    re:/\b(\d+(\.\d+)?\s*(bhk|br|bed|bedroom|bedrooms)|studio|villa|villas|plot|plots|penthouse|duplex)\b/i,
    q:(sub)=>`What configurations are available at ${sub}?`,
    need:"cfg",
    a:(b)=>`${b.proj} offers ${b.cfg}${b.loc?` at ${b.loc}`:""}${
      b.price?`, starting at ${b.price}`:""}.` },

  { id:"floorplan", lab:"Floor plans",
    re:/\b(floor\s*plan|floorplan|layout|unit\s*plan|master\s*plan|masterplan|site\s*plan)\b/i,
    q:(sub)=>`What floor plans are available at ${sub}?`,
    need:"cfg",
    a:(b)=>`Floor plans at ${b.proj} cover ${b.cfg}. The unit plans and the master layout are available on request.` },

  { id:"location", lab:"Location",
    re:/\b(location|address|where|map|connectivity|distance|nearby|metro|airport|station|road)\b/i,
    q:(sub)=>`Where is ${sub} located?`,
    need:"loc",
    a:(b)=>`${b.proj} is at ${b.loc}.${b.marks.length?` ${b.marks.slice(0,4).join(", ")}.`:""}` },

  { id:"amenities", lab:"Amenities",
    re:/\b(amenit\w*|facilit\w*|clubhouse|club\s*house|swimming|pool|gym|garden|sports|lifestyle)\b/i,
    q:(sub)=>`What amenities does ${sub} offer?`,
    need:"amen",
    a:(b)=>`${b.proj} offers ${b.amen.slice(0,8).join(", ")}.` },

  { id:"offer", lab:"Offer",
    re:/\b(offer|offers|discount|deal|booking|eoi|token|pre\s*launch|prelaunch|launch\s*price)\b/i,
    q:(sub)=>`What offers are running at ${sub}?`,
    need:"offer",
    a:(b)=>`${b.offer} Terms apply — the current offer is confirmed at the time of booking.` },

  { id:"rera", lab:"RERA",
    re:/\b(rera|maharera|registration|registered|approval|approved|legal)\b/i,
    q:(sub)=>`Is ${sub} RERA registered?`,
    need:"rera",
    a:(b)=>`Yes. ${b.proj} is registered under RERA number ${b.rera}.` },

  { id:"possession", lab:"Possession",
    re:/\b(possession|ready\s*to\s*move|rtm|completion|handover|delivery|occupancy)\b/i,
    q:(sub)=>`When is possession at ${sub}?`,
    need:"possession",
    a:(b)=>`Possession at ${b.proj} is scheduled for ${b.possession}.` },

  { id:"developer", lab:"Developer",
    re:/\b(builder|developer|group|developers|reputation|track\s*record)\b/i,
    q:(sub)=>`Who is the developer of ${sub}?`,
    /* "kolte patil builder pune" is asking about the project, not about the
       builder's own builder — so this one always names the project. */
    fix:true, need:"dev",
    a:(b)=>`${b.proj} is developed by ${b.dev}${b.loc?` at ${b.loc}`:""}.` },

  { id:"review", lab:"Is it worth it",
    re:/\b(review|reviews|rating|ratings|worth|good|genuine|should\s*i|invest\w*)\b/i,
    q:(sub)=>`Is ${sub} a good project to buy?`,
    need:"usps",
    a:(b)=>`${b.proj}${b.loc?` at ${b.loc}`:""}: ${b.usps.slice(0,4).join(", ")}.${
      b.price?` Pricing starts at ${b.price}.`:""} Book a site visit to judge it for yourself.` },

  { id:"brochure", lab:"Brochure",
    re:/\b(brochure|pdf|download|cost\s*sheet|price\s*list|details)\b/i,
    q:(sub)=>`How do I get the ${sub} brochure?`,
    need:"",
    a:(b)=>`Fill the enquiry form on this page and the ${b.proj} brochure, floor plans and full cost sheet are sent across straight away.` },

  { id:"about", lab:"About",
    re:/.*/,
    q:(sub)=>`What should I know about ${sub}?`,
    need:"usps",
    a:(b)=>`${b.proj} is ${b.dev?`a ${b.dev} development `:""}${b.loc?`at ${b.loc}`:""}${
      b.cfg?`, offering ${b.cfg}`:""}${b.price?` from ${b.price}`:""}. ${b.usps.slice(0,3).join(", ")}.` }
];

/* The brief as the FAQ writer needs it: everything it may quote, and
   nothing it may not. possession and rera are not on the campaign brief, so
   they come from the creative tab, where they are already typed. */
function faqBrief(){
  const b=brief();
  return {
    proj:b.proj, dev:b.dev, cfg:b.cfg, price:b.price, offer:b.offer,
    loc:b.loc||[b.micro,b.city].filter(Boolean).join(", "),
    micro:b.micro, city:b.city,
    usps:b.usps.filter(Boolean), amen:b.amen.filter(Boolean), marks:b.marks.filter(Boolean),
    rera:val("crRera"), possession:val("lpPoss")
  };
}
const faqHas=(b,need)=>{
  if(!need)return true;
  const v=b[need];
  return Array.isArray(v)?v.length>0:!!String(v||"").trim();
};

/* The subject of the question is the searcher's own phrase with the intent
   word taken out — "kolte patil vyana price" asks about "Kolte Patil Vyana".
   If that leaves nothing to name, the project name stands in. */
function faqSubject(kw,re,b){
  const left=String(kw||"").replace(re," ")
    .split(/\s+/).map(w=>w.replace(/[^\w.&-]/g,"")).filter(Boolean)
    .filter(w=>{ const L=w.toLowerCase(); return !FAQ_STOP.has(L)&&!FAQ_FILLER.has(L); });
  const sub=left.join(" ").trim();
  if(sub.length<3)return b.proj;
  if(sub.toLowerCase()===String(b.proj||"").toLowerCase())return b.proj;
  /* The subject has to name the project. "3 bhk flats in vadgaon" leaves
     only "vadgaon", and a question about Vadgaon is a question about
     nothing in particular — so the project is put back in front of it. */
  const known=(String(b.proj||"")+" "+String(b.dev||"")).toLowerCase()
    .split(/\s+/).filter(Boolean);
  const names=known.length&&left.some(w=>known.indexOf(w.toLowerCase())>-1);
  return tc(names?sub:((b.proj?b.proj+" ":"")+sub)).slice(0,70).trim();
}

function faqBuild(keywords,b){
  const seen=new Map(), unanswered=[];
  (keywords||[]).forEach(raw=>{
    const kw=String(raw||"").replace(/^[+\[\]"]+|[+\[\]"]+$/g,"").trim();
    if(!kw)return;
    const hit=FAQ_INTENTS.filter(x=>x.re.test(kw))[0];
    if(!hit)return;
    if(!seen.has(hit.id)){
      const sub=faqSubject(kw,hit.re,b);
      seen.set(hit.id,{intent:hit.id,lab:hit.lab,need:hit.need,
        q:hit.q(hit.fix?b.proj:sub),a:faqHas(b,hit.need)?hit.a(b):"",kws:[]});
    }
    seen.get(hit.id).kws.push(kw);
  });
  const faqs=[...seen.values()];
  faqs.forEach(f=>{ if(!f.a)unanswered.push(f); });
  return { faqs:faqs.filter(f=>f.a), unanswered };
}

/* What the finished page will actually say, so a keyword can be checked
   against it rather than against a hope. */
function faqPageText(b,faqs){
  return [b.proj,b.dev,b.loc,b.micro,b.city,b.cfg,b.price,b.offer,b.rera,b.possession]
    .concat(b.usps,b.amen,b.marks)
    .concat(faqs.map(f=>f.q+" "+f.a))
    .join(" ").toLowerCase();
}
/* A keyword earns landing page relevance when its own words are on the
   page. This reports the ones that are not, which is the list worth acting
   on before the campaign goes live. */
function faqCoverage(keywords,b,faqs){
  const page=faqPageText(b,faqs);
  const out=[];
  (keywords||[]).forEach(raw=>{
    const kw=String(raw||"").replace(/^[+\[\]"]+|[+\[\]"]+$/g,"").trim();
    if(!kw)return;
    const words=kw.toLowerCase().split(/\s+/).map(w=>w.replace(/[^\w.&-]/g,""))
      .filter(w=>w&&!FAQ_STOP.has(w));
    if(!words.length)return;
    const miss=words.filter(w=>page.indexOf(w)===-1);
    out.push({kw,total:words.length,miss,
      pct:Math.round(((words.length-miss.length)/words.length)*100)});
  });
  return out.sort((x,y)=>x.pct-y.pct);
}

/* Every keyword in the plan, deduplicated. The plan is the truth here, not
   the wrapper output: what matters is what will actually be deployed. */
function faqKeywords(){
  const out=[], seen=new Set();
  (PLAN||[]).forEach(c=>(c.groups||[]).forEach(g=>(g.kws||[]).forEach(k=>{
    const L=String(k||"").toLowerCase().replace(/^[+\[\]"]+|[+\[\]"]+$/g,"").trim();
    if(L&&!seen.has(L)){ seen.add(L); out.push(k); }
  })));
  if(out.length)return out;
  /* nothing built yet — fall back to whatever is pasted in the wrapper */
  return val("kwIn").split("\n").map(x=>x.trim()).filter(Boolean);
}

let FAQ_OUT={faqs:[],unanswered:[],cov:[]};
function faqRun(){
  const b=faqBrief();
  if(!b.proj){ toast("Fill the project name on the Ad copy tab first"); return null; }
  const kws=faqKeywords();
  if(!kws.length){ toast("Build the structure on tab 05, or paste keywords on tab 02"); return null; }
  const r=faqBuild(kws,b);
  FAQ_OUT={faqs:r.faqs,unanswered:r.unanswered,cov:faqCoverage(kws,b,r.faqs),kws};
  faqDraw();
  return FAQ_OUT;
}
function faqDraw(){
  const box=$("#faqOut");
  if(!box)return;
  const {faqs,unanswered,cov,kws}=FAQ_OUT;
  if(!faqs.length&&!unanswered.length){
    box.innerHTML=`<div class="empty">Press <b>Build FAQs from the keywords</b>.</div>`;
    return;
  }
  const weak=cov.filter(c=>c.pct<100);
  let h=`<div class="kpis" style="grid-template-columns:repeat(3,1fr)">
    <div class="kpi"><b>${faqs.length}</b><span>FAQs written</span></div>
    <div class="kpi ${weak.length?"bad":"good"}"><b>${kws.length-weak.length}/${kws.length}</b>
      <span>keywords fully on page</span></div>
    <div class="kpi ${unanswered.length?"bad":"good"}"><b>${unanswered.length}</b>
      <span>questions unanswered</span></div></div>`;

  if(unanswered.length)
    h+=`<div class="callout" style="border-left:3px solid var(--bad)">
      <b>These questions have no answer in the brief, so they are left out.</b>
      Nothing here is invented — fill the field and build again.
      ${unanswered.map(u=>`<div style="margin-top:6px">${esc(u.q)}
        <span class="pill p-bad">needs ${esc(u.need)}</span></div>`).join("")}</div>`;

  h+=faqs.map(f=>`<div style="padding:11px 0;border-bottom:1px solid var(--line-soft)">
      <div style="font-weight:600;font-size:13.5px">${esc(f.q)}</div>
      <div style="font-size:12.5px;color:var(--ink-soft);margin-top:4px">${esc(f.a)}</div>
      <div class="sub mono" style="font-size:10.5px;color:var(--ink-soft);margin-top:5px">
        covers: ${f.kws.slice(0,6).map(esc).join(" · ")}${f.kws.length>6?` +${f.kws.length-6}`:""}</div>
    </div>`).join("");

  h+=`<div class="f-lab" style="margin-top:18px">Keyword coverage on the page</div>
    <div class="tblwrap"><table class="lt"><tbody>
    <tr><th>Keyword</th><th>On page</th><th>Words still missing</th></tr>`+
    cov.slice(0,60).map(c=>`<tr>
      <td class="mono">${esc(c.kw)}</td>
      <td><span class="pill ${c.pct===100?"p-ok":c.pct>=60?"p-warn":"p-bad"}">${c.pct}%</span></td>
      <td class="mono">${c.miss.map(esc).join(", ")||"—"}</td></tr>`).join("")+
    `</tbody></table></div>
    <div class="f-note" style="margin-top:8px">A keyword whose words are missing from the page is
      the one Google marks down for landing page experience. Add the term to a USP, an amenity or
      the About copy in the builder, or drop the keyword.</div>`;
  box.innerHTML=h;
}
on("#faqBuild","click",()=>faqRun());
on("#faqCopy","click",()=>{
  if(!FAQ_OUT.faqs.length)return toast("Build the FAQs first");
  const t=FAQ_OUT.faqs.map(f=>f.q+"\n"+f.a).join("\n\n");
  navigator.clipboard.writeText(t).then(()=>toast("FAQs copied"),()=>toast("Could not copy"));
});

