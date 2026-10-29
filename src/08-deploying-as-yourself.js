/* ═══════════ deploying as yourself ═══════════
   Google Ads records who made a change, and without this it records the
   script owner for everybody. Connecting puts your own name on your own
   campaigns in the account's change history — which is the history an
   audit reads, not this tool's. */
async function gaConnStatus(){
  const stat=$("#gaStat"), go=$("#gaConnect"), off=$("#gaDisconnect");
  if(!stat)return;
  const r=await adsCall("ads-connection",{});
  if(!r||r.error){ stat.innerHTML=`<span class="p-mute">${esc((r&&r.error)||"could not check")}</span>`; return; }
  if(r.connected){
    go.hidden=true; off.hidden=false;
    stat.innerHTML=`<span class="p-ok">Connected as ${esc(r.email)}.</span> `+
      `<span class="p-mute">Your campaigns are created by you, so the account’s `+
      `change history names you.</span>`;
    return;
  }
  go.hidden=false; off.hidden=true;
  stat.innerHTML=r.possible
    ? (r.required
        ? `<span class="p-bad">This account requires it.</span> <span class="p-mute">Connect before deploying.</span>`
        : `<span class="p-mute">Not connected — your campaigns will be created by the `+
          `shared credential, and Google’s change history will say so.</span>`)
    : `<span class="p-mute">Not set up on this script yet, so everyone deploys with the `+
      `shared credential. It needs <code>ADS_OAUTH_SECRET</code> in Script Properties.</span>`;
}
on("#gaConnect","click",async()=>{
  const stat=$("#gaStat");
  stat.innerHTML=`<span class="p-mute">Asking Google…</span>`;
  const r=await adsCall("ads-connect",{});
  if(!r||r.error)return stat.innerHTML=`<span class="p-bad">${esc((r&&r.error)||"no answer")}</span>`;
  /* opened rather than navigated, so a half-built campaign on this page is
     not thrown away by leaving it */
  const w=window.open(r.url,"_blank","noopener");
  /* redirect_uri_mismatch is the usual failure and Google's page never says
     what was sent, so it is printed here to compare against the Console. */
  const sent=`<div class="f-note" style="margin-top:6px">Sending redirect URI
    <code>${esc(r.redirect||"(none)")}</code> — if Google says
    <b>redirect_uri_mismatch</b>, this exact string has to be under
    <b>Authorized redirect URIs</b> on client <code>${esc((r.clientId||"").slice(0,24))}…</code></div>`;
  stat.innerHTML=(w
    ? `<span class="p-mute">Finish in the new tab, then press <b>Check the connection</b> here.</span>`
    : `<span class="p-mute">Pop-up blocked. <a href="${esc(r.url)}" target="_blank" rel="noopener">Open it here</a>, then come back.</span>`)+sent;
});
on("#gaDisconnect","click",async()=>{
  if(!confirm("Disconnect your Google Ads?\n\nYour campaigns will go back to being created by the shared credential."))return;
  await adsCall("ads-disconnect",{});
  gaConnStatus();
});

/* ═══════════ who deployed what ═══════════
   The log has always been written; it has never been readable by the people
   it is about. Twenty of them share this tool, so the question "who made
   this campaign" is asked here rather than by opening a spreadsheet one
   person owns. */
let HIST_SCOPE="deploys";
const histWhen=iso=>{
  const d=new Date(iso); if(isNaN(d))return ["",""];
  const now=new Date(), sameDay=d.toDateString()===now.toDateString();
  const t=d.toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"});
  return [sameDay?"today":d.toLocaleDateString([], {day:"2-digit",month:"short"}), t];
};
function histDraw(r){
  const box=$("#histOut");
  if(r.error)return box.innerHTML=`<div class="empty">${esc(r.error)}</div>`;
  if(!r.rows||!r.rows.length)
    return box.innerHTML=`<div class="empty">${esc(r.note||"Nothing here yet.")}</div>`;

  const who=(r.people||[]).length>1
    ? `<div class="hist-who">`+r.people.map(p=>
        `<span>${esc(p.name||p.email)}<b>${p.count}</b></span>`).join("")+`</div>`
    : "";
  box.innerHTML=who+r.rows.map(x=>{
    const [day,time]=histWhen(x.at);
    /* the server says whether it worked; the page does not guess from prose */
    const failed=x.ok===false;
    const kind=failed?"bad":(x.action.indexOf("meta")===0?"meta":"");
    const mine=x.email&&r.you&&x.email.toLowerCase()===r.you.toLowerCase();
    return `<div class="hist-row">
      <div class="hist-when">${esc(day)}<br>${esc(time)}</div>
      <div class="hist-main">
        <b>${esc(x.name||x.email||"somebody")}</b>${mine?` <span class="pill p-mute">you</span>`:""}
        <span class="hist-act ${kind}">${esc(x.action)}</span>
        <div class="hist-what">${esc(x.detail||"")}${
          x.note?` · <code>${esc(x.note)}</code>`:""}</div>
      </div></div>`;
  }).join("")+(r.truncated
    ? `<div class="empty">Showing the most recent ${r.rows.length}. Older rows are in the sheet.</div>`:"");
}
async function histLoad(){
  const box=$("#histOut");
  box.innerHTML=`<div class="empty">Reading the log…</div>`;
  const r=await adsCall("history",{scope:HIST_SCOPE,mine:$("#histMine").checked,limit:80});
  histDraw(r||{error:"No answer from the Apps Script."});
}
on("#histOpen","click",()=>{ $("#histWrap").hidden=false; histLoad(); });
on("#histClose","click",()=>{ $("#histWrap").hidden=true; });
on("#histRefresh","click",histLoad);
on("#histMine","change",histLoad);
on("#histWrap","click",e=>{ if(e.target&&e.target.id==="histWrap")$("#histWrap").hidden=true; });
document.addEventListener("keydown",e=>{
  if(e.key==="Escape"&&!$("#histWrap").hidden)$("#histWrap").hidden=true;
});
$$("#histScope button").forEach(b=>b.addEventListener("click",()=>{
  HIST_SCOPE=b.dataset.scope;
  $$("#histScope button").forEach(x=>x.setAttribute("aria-pressed",String(x===b)));
  histLoad();
}));

on("#signOut","click",()=>{
  clearProject();
  logEvent("sign-out","");
  try{sessionStorage.removeItem("pp_user");}catch(e){}
  if(window.google&&google.accounts&&google.accounts.id)google.accounts.id.disableAutoSelect();
  location.reload();
});

/* ═══════════ landing page capture ═══════════
   Four passes over the page: structured data, meta tags, labelled
   fields, then free text. Whatever each pass finds is shown with its
   source so you can see what is solid and what is a guess. */
const READERS=[
  u=>`https://r.jina.ai/${u}`,
  u=>`https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
  u=>`https://corsproxy.io/?${encodeURIComponent(u)}`,
  u=>`https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`
];
const AMEN_DICT=["Swimming Pool","Infinity Pool","Kids Pool","Gymnasium","Gym","Clubhouse","Club House",
 "Grand Clubhouse","Jogging Track","Cycling Track","Jogging & Cycling Track","Yoga Deck","Yoga Zone",
 "Kids Play Area","Children's Play Area","Childrens Play Area","Amphitheatre","Amphitheater",
 "Landscaped Garden","Landscaped Gardens","Sky Lounge","Multipurpose Hall","Multipurpose Court",
 "Tennis Court","Badminton Court","Basketball Court","Cricket Net","Skating Rink","Co-Working","Coworking",
 "Banquet Hall","Party Lawn","Senior Citizen","Pet Park","Spa","Sauna","Steam Room","Concierge",
 "Barbecue","Barbeque","Rooftop Deck","Meditation Zone","Indoor Games","Indoor Games Room","Squash Court",
 "Library","Creche","Day Care","Business Centre","Sports Court","Open Gym","Reflexology","Pergola",
 "Gazebo","Water Feature","Toddler Zone","Wellness Centre","Fitness Centre","Sports Facilities"];
/* Chat widgets, nav bars and cookie banners are all text too. Left in, they
   turn into headlines. */
/* Anchored to the whole line. "Home" is a nav item; "Home Theatre" is an
   amenity, and matching on the word alone threw the second one away. */
const NOISE=/^(home|gallery|location|brochure|contact|menu|close|next|prev|previous|submit|send|ok|yes|no|search|login|sign in|privacy policy|terms|cookie|accept|hello,?|hi,?|chat|whatsapp|call now|request call back|enquire now|express your interest|organize site visit|schedule a site visit|name|mobile number|email|artistic impression|keyboard shortcuts|map data|report a map error|open in maps|read more|know more|view more|download|apply now|price|site plan|amenities|enquire|submit)[\s.!?]*$/i;
function stripTags(html){
  return html.replace(/<script[\s\S]*?<\/script>/gi," ").replace(/<style[\s\S]*?<\/style>/gi," ")
    .replace(/<\/(p|div|li|h[1-6]|tr|td|br|section|span)>/gi,"\n").replace(/<br\s*\/?>/gi,"\n")
    .replace(/<[^>]+>/g," ").replace(/&nbsp;/gi," ").replace(/&amp;/gi,"&")
    .replace(/&#8377;|&rupee;/gi,"\u20b9").replace(/&[a-z]+;/gi," ")
    .replace(/[ \t]{2,}/g," ").replace(/\n{2,}/g,"\n");
}
function norm(t){ return String(t||"").replace(/\r/g,"\n").replace(/[ \t]+/g," ").replace(/\n{2,}/g,"\n").trim(); }
function jsonLd(html){
  const out=[]; const re=/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi; let m;
  while((m=re.exec(html))){ try{ const j=JSON.parse(m[1].trim());
    (Array.isArray(j)?j:[j]).forEach(x=>{ out.push(x); if(x["@graph"])x["@graph"].forEach(y=>out.push(y)); }); }catch(e){} }
  return out;
}
function metaOf(html,prop){
  const a=html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]*content=["']([^"']+)["']`,"i"));
  if(a)return a[1].trim();
  const b=html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']${prop}["']`,"i"));
  return b?b[1].trim():"";
}
const cutTail=v=>String(v||"").split(/\s{2,}|\s(?=[A-Z][A-Za-z ]{2,22}\s*:)/)[0]
  .replace(/[\s,;|.\u2022-]+$/,"").trim();
const clean1=v=>String(v||"").replace(/\b(logo|official|website|home|new project)\b/gi,"")
  .replace(/\s{2,}/g," ").replace(/[\s|\-\u2013]+$/,"").trim();

/* Prices: a page carries several. Token and booking amounts are the trap \u2014
   they are the smallest number on the page and the most prominent. */
function rupees(n,unit){
  const v=parseFloat(String(n).replace(/,/g,""));
  if(!isFinite(v))return 0;
  return /^c/i.test(unit)?v*1e7:v*1e5;
}
/* The lookback stays inside the line. A token amount sitting on the line
   above must not disqualify the real price on this one. */
function findPrice(T){
  const out=[];
  const re=/(?:\u20b9|Rs\.?|INR)\s*([\d.,]+)\s*(Lakhs?|Lacs?|Cr\.?|Crores?)/gi; let m;
  while((m=re.exec(T))){
    const lineStart=T.lastIndexOf("\n",m.index)+1;
    const before=T.slice(lineStart,m.index).toLowerCase();
    if(/token|booking amount|eoi|application money|advance|emi|per month|per sq|psf|registration/.test(before))continue;
    const val=rupees(m[1],m[2]);
    if(val<1500000)continue;                       // below 15 lakh is not a home price here
    out.push({val,text:`\u20b9${m[1].replace(/[.,]$/,"")} ${/^l/i.test(m[2])?"Lacs":"Cr"}`});
  }
  if(!out.length){
    const a=T.match(/AED\s*([\d.,]+)\s*(M|Million|K|Thousand)?/i);
    if(a)return `AED ${a[1]}${a[2]?" "+a[2][0].toUpperCase():""}`;
    return "";
  }
  out.sort((x,y)=>x.val-y.val);                    // starting price is the lowest real one
  return out[0].text;
}
/* "2, 3 & 4 BHK" is three values, not "2", "3" and "4 BHK". */
function cfgList(cfg){
  const s=String(cfg||"").trim(); if(!s)return [];
  const m=s.match(/^(.*?)\s*(BHK|BR)\b/i);
  if(!m)return s.split(/[,&\/]|\band\b/i).map(x=>x.trim()).filter(Boolean);
  const unit=m[2].toUpperCase();
  return m[1].split(/[,&\/]|\band\b/i).map(x=>x.trim()).filter(Boolean)
    .map(x=>/^[\d.]+$/.test(x)?`${x} ${unit}`:x);
}
const dedupe=a=>{const seen=new Set();return a.filter(x=>{const k=String(x).toLowerCase().replace(/[^a-z0-9]/g,"");
  if(!k||seen.has(k))return false;seen.add(k);return true;});};
/* ── PropertyPistol microsite template ──────────────────────────────
   Every one of our own landing pages is the same template, so the layout
   is known rather than guessed: project, then "Micro, City", then
   "By Developer", then the USP bullets, then "... Starts From" and the
   price. Rules beat a language model here because they cannot invent a
   field, and they cost nothing. AI stays for third-party sites. */
const PP_TEMPLATE=/microsites\.images|temp_assets\/temp-|propertypistol realty/i;
/* The nav bar also says "Amenities", so the heading is found from the end
   of the page rather than the start. */
function sectionList(LINES,re,max){
  let i=-1;
  for(let k=LINES.length-1;k>=0;k--){ if(re.test(LINES[k])&&LINES[k].length<40){ i=k; break; } }
  if(i<0)return [];
  const out=[];
  for(let j=i+1;j<LINES.length&&out.length<(max||12);j++){
    const l=LINES[j];
    if(!l||l.length>34)break;
    if(/^(request|submit|enquire|explore|view|read|about|gallery|location|schedule)\b/i.test(l))break;
    if(/\d{1,3}\s*(mins?|minutes?)/i.test(l))break;
    out.push(l);
  }
  return out;
}
function templateRead(LINES,raw){
  const g={},src={};
  const set=(k,v,s)=>{ if(v&&!g[k]){ g[k]=String(v).trim(); src[k]=s||"template"; } };

  /* "By Tayal Corp." is the anchor everything else is measured from */
  const bi=LINES.findIndex(l=>/^By\s+[A-Z][\w&.\- ]{2,40}\.?$/.test(l));
  if(bi>=0){
    set("dev",LINES[bi].replace(/^By\s+/,"").replace(/\.$/,""),"template: By line");
    for(let j=bi-1;j>=Math.max(0,bi-4);j--){
      const m=LINES[j].match(/^([A-Z][\w .'\-]{2,30}),\s*([A-Z][\w .'\-]{2,25})$/);
      if(m){ set("micro",m[1],"template"); set("city",m[2],"template");
        set("loc",`${m[1].trim()}, ${m[2].trim()}`,"template");
        for(let k=j-1;k>=Math.max(0,j-3);k--){
          const t=LINES[k];
          if(t&&t.length<=40&&!/^(near |ready |new |now )/i.test(t)){ set("proj",t,"template: heading"); break; }
        }
        break;
      }
    }
  }
  /* "Luxury 3 & 4 BHK Starts From" */
  const cf=LINES.find(l=>/starts?\s+(from|at)\b/i.test(l));
  if(cf){
    const m=cf.replace(/^(luxury|premium|spacious)\s+/i,"").match(/^(.+?)\s+starts?\s+(from|at)/i);
    if(m)set("cfg",m[1],"template");
  }
  const poss=LINES.find(l=>/^(near possession|ready to move|possession\b)/i.test(l)&&l.length<40);
  if(poss)set("possession",poss,"template");

  /* the bullets between the developer line and the price line */
  let usps=[];
  if(bi>=0){
    for(let j=bi+1;j<LINES.length&&usps.length<6;j++){
      const l=LINES[j];
      if(/starts?\s+(from|at)\b/i.test(l)||/\u20b9|Rs\.?\s*\d|AED/i.test(l))break;
      if(l.length>40||l.length<6)continue;
      if(/^(enquire|request|submit|organize|home|price|gallery|location|brochure|site plan|amenities)\b/i.test(l))continue;
      usps.push(l);
    }
  }
  const amen=sectionList(LINES,/^[\w ]*amenities$/i,12);
  return {g,src,usps,amen};
}
/* A dictionary hit that is already contained in a template amenity is the
   same thing said shorter — "Spa" inside "Spa & Salon". Drop it. */
function mergeAmenities(fromTemplate,fromDict){
  const keep=[...fromTemplate];
  fromDict.forEach(d=>{
    const dl=d.toLowerCase();
    if(!keep.some(t=>t.toLowerCase().includes(dl)))keep.push(d);
  });
  return dedupe(keep);
}
function capture(raw){
  const isHtml=/<\s*(html|head|body|div|meta|section)\b/i.test(raw);
  const html=isHtml?raw:"";
  const T=norm(isHtml?stripTags(raw):raw);
  const LINES=T.split("\n").map(s=>s.trim()).filter(s=>s&&!NOISE.test(s));
  const g={},src={};
  const take=(k,v,from)=>{ v=cutTail(v); if(v&&v.length<=80&&!g[k]){ g[k]=v; src[k]=from; } };
  const isPP=PP_TEMPLATE.test(raw);
  let tplUsps=[], tplAmen=[];
  if(isPP){
    const t=templateRead(LINES,raw);
    Object.keys(t.g).forEach(k=>take(k,t.g[k],t.src[k]));
    tplUsps=t.usps; tplAmen=t.amen;
  }

  jsonLd(html).forEach(j=>{
    if(j.name&&/Residence|Product|Place|Organization|LocalBusiness|Apartment/i.test(j["@type"]||""))
      take("proj",clean1(j.name),"structured data");
    if(j.address){ take("micro",j.address.addressLocality,"structured data");
      take("city",j.address.addressRegion||j.address.addressLocality,"structured data"); }
    if(j.brand)take("dev",typeof j.brand==="string"?j.brand:j.brand.name,"structured data");
  });

  /* project name: the About heading is the most reliable, then the title */
  let m=T.match(/\bAbout\s+([A-Z][\w'&.\- ]{3,45})/);
  if(m)take("proj",clean1(m[1]),"about heading");
  if(!g.proj){
    let head=html?(metaOf(html,"og:title")||(html.match(/<title[^>]*>([^<]+)<\/title>/i)||[])[1]||"")
                 :((T.match(/^Title:\s*(.+)$/mi)||[])[1]||LINES[0]||"");
    head=head.replace(/^Title:\s*/i,"").split(/\s*[|\u2013\u2014]\s*|\s-\s/)[0];
    take("proj",clean1(head),"page title");
  }
  if(html)take("desc",metaOf(html,"og:description")||metaOf(html,"description"),"meta description");

  const label=(names,key,from)=>{
    const mm=T.match(new RegExp(`(?:^|\\n)\\s*(?:${names})\\s*[:\\-\u2013]\\s*([^\\n|\u2022]{2,70})`,"i"));
    if(mm)take(key,mm[1],from||"labelled field");
  };
  label("configurations?|typology|unit types?|apartment types?","cfg");
  label("locations?|address|micro ?market","loc");
  label("developers?|builder","dev");
  label("possession|handover","possession");

  /* "At Mahalunge, Pune" under the hero */
  if(!g.micro||!g.city){
    m=T.match(/\bAt\s+([A-Z][A-Za-z .\-]{2,28}),\s*([A-Z][A-Za-z .\-]{2,20})\b/);
    if(m){ take("micro",m[1],"page text"); take("city",m[2],"page text");
           take("loc",`${m[1].trim()}, ${m[2].trim()}`,"page text"); }
  }
  if(!g.city){ m=T.match(/\b(Mumbai|Navi Mumbai|Thane|Pune|Bengaluru|Bangalore|Hyderabad|Chennai|Lucknow|Noida|Gurugram|Gurgaon|Ahmedabad|Surat|Kochi|Dubai|Abu Dhabi)\b/i);
    if(m)take("city",tc(m[1]),"page text"); }

  if(!g.dev){
    m=T.match(/\bby\s+([A-Z][A-Za-z&.]+(?:\s+[A-Z][A-Za-z&.]+){0,2})\s+(Group|Developers?|Developments?|Realty|Builders?|Properties|Lifespaces?|Infra\w*|Corp\.?|Corporation|Estates?|Ventures?|Habitat|Constructions?|Homes|Associates|Landmarks?)/i);
    if(m)take("dev",`${m[1]} ${m[2]}`,"page text");
  }
  if(!g.dev){ m=T.match(/\b([A-Z][A-Za-z&.]+(?:\s+[A-Z][A-Za-z&.]+)?)\s+(?:Group|Developers|Realty|Builders|Lifespaces)\b/);
    if(m)take("dev",m[0],"page text"); }

  const p=findPrice(T); if(p)take("price",p,"page text");
  g.allIn = /all[\s-]?inclusive|inclusive of all/i.test(T) ? "yes"
          : /\+\s*(?:gst|stamp duty|registration|other charges)|plus\s+(?:gst|taxes|charges)/i.test(T) ? "no" : "";

  if(!g.cfg){
    m=T.match(/((?:\d+(?:\.\d+)?\s*(?:,|&|and|\/)\s*)*\d+(?:\.\d+)?)\s*BHK/i);
    if(m)take("cfg",`${m[1].replace(/\s*,\s*/g,", ").replace(/\s*&\s*/g," & ").trim()} BHK`,"page text");
  }
  if(!g.cfg){ const br=[...new Set((T.match(/\b(?:Studio|\d\s?BR)\b/gi)||[]).map(s=>s.replace(/\s+/g,"").toUpperCase()))];
    if(br.length)take("cfg",br.slice(0,4).join(", "),"page text"); }

  const amen=[...new Set(AMEN_DICT.filter(a=>new RegExp("\\b"+a.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")+"\\b","i").test(T)))]
    .filter(a=>!AMEN_DICT.some(b=>b!==a&&b.length>a.length&&b.toLowerCase().includes(a.toLowerCase())&&new RegExp("\\b"+b.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")+"\\b","i").test(T)));

  /* "Hinjewadi IT Park \u2013 6 km (15 mins)" and "Airport - 45 Mins" both land here */
  const marks=[];
  LINES.forEach(l=>{
    [...l.matchAll(/([A-Z][A-Za-z .'&\-]{3,32}?)\s*[\u2013\u2014\-:]\s*(?:[\d.]+\s*kms?\s*)?\(?\s*(\d{1,3})\s*(?:mins?|minutes?)\)?/gi)]
      .forEach(x=>marks.push(`${x[1].trim()} - ${x[2]} Mins`));
    [...l.matchAll(/([A-Z][A-Za-z .'&\-]{3,32}?)\s*[\u2013\u2014\-:]\s*([\d.]+\s*kms?)\b(?!\s*\()/gi)]
      .forEach(x=>marks.push(`${x[1].trim()} - ${x[2].replace(/\s+/g," ")}`));
  });

  const usps=[];
  LINES.forEach(l=>{
    [...l.matchAll(/\b(\d{1,4}(?:\.\d+)?\+?)\s*(Acres?|Towers?|Storeys?|Floors?|Units?)\b/gi)]
      .forEach(x=>{ if(!/G\s?\+\s?$/i.test(l.slice(0,x.index)))usps.push(tc(`${x[1]} ${x[2]}`)); });
    [...l.matchAll(/\b(\d{1,3}\+?)\s*([A-Za-z-]+\s+)?Amenities\b/gi)]
      .forEach(x=>usps.push(tc(x[0].trim())));
    [...l.matchAll(/\bG\s?\+\s?(\d{1,2})\s*(Floors?|Storeys?)?/gi)].forEach(x=>usps.push(`G+${x[1]}${x[2]?" "+tc(x[2]):" Floors"}`));
    [...l.matchAll(/\b(\d{1,3})%\s*([A-Za-z- ]{3,22})/g)].forEach(x=>usps.push(tc(x[0].trim())));
  });
  const amenAll=tplAmen.length?mergeAmenities(tplAmen,amen):dedupe(amen);
  return {g,src,amen:amenAll.slice(0,14),template:isPP,
    marks:dedupe(marks).slice(0,8),
    usps:dedupe([...tplUsps,...usps]).filter(s=>s.length<=34).slice(0,8),
    chars:T.length};
}
/* The Gemini key lives in the Apps Script, never in this page. The browser
   sends the page text and its sign-in token; the script checks the token,
   calls Gemini, and sends back the fields. Content-Type stays text/plain so
   the browser treats it as a simple request and skips the preflight that
   Apps Script cannot answer. */
let AI_ERR="";
/* Apps Script fetches the page server-side, where CORS does not apply and
   the public proxies' blocks do not either, then reads it with Gemini. This
   is the strongest path; the browser proxies are the fallback. */
async function serverRead(url){
  AI_ERR="";
  if(!AUTH.logUrl)return null;
  if(!USER){ AI_ERR="Sign in first — the reader runs on the server as you."; return null; }
  if(!tokenLive()){ tokenPanel();
    AI_ERR="Your Google sign-in expired an hour after you signed in. Press Sign in again above, then read the page."; return null; }
  try{
    const ctl=new AbortController();
    const bail=setTimeout(()=>ctl.abort(),45000);
    const r=await fetch(AUTH.logUrl,{method:"POST",signal:ctl.signal,
      headers:{"Content-Type":"text/plain;charset=utf-8"},
      body:JSON.stringify({action:"read",credential:USER.credential,url})});
    clearTimeout(bail);
    if(!r.ok){ AI_ERR=`Apps Script returned ${r.status}. Redeploy it as a new version.`; return null; }
    const j=await r.json();
    if(j.error){ AI_ERR=j.error; return null; }
    return j;
  }catch(e){ AI_ERR="Could not reach the Apps Script: "+((e&&e.message)||e); return null; }
}
async function askAI(text){
  AI_ERR="";
  if(!AUTH.logUrl)return null;
  if(!USER){ AI_ERR="Sign in first — the reader runs on the server as you."; return null; }
  if(!tokenLive()){ tokenPanel();
    AI_ERR="Your Google sign-in expired. Press Sign in again above, then read the page."; return null; }
  try{
    const ctl=new AbortController();
    const bail=setTimeout(()=>ctl.abort(),25000);
    const r=await fetch(AUTH.logUrl,{method:"POST",signal:ctl.signal,
      headers:{"Content-Type":"text/plain;charset=utf-8"},
      body:JSON.stringify({action:"extract",credential:USER.credential,text:text.slice(0,26000)})});
    clearTimeout(bail);
    if(!r.ok){ AI_ERR=`Apps Script returned ${r.status}. Redeploy it as a new version.`; return null; }
    const j=await r.json();
    if(j.error){ AI_ERR=j.error; return null; }
    return j;
  }catch(e){ AI_ERR="Could not reach the Apps Script: "+((e&&e.message)||e); return null; }
}
/* When the reader fails there are only four things it can be, and guessing
   between them wastes a day. This asks the server a question it must answer
   and prints exactly what came back. */
on("#impTest","click",async()=>{
  const box=$("#impDiag"), say=h=>box.innerHTML=h;
  const line=(l,ic,h)=>`<div class="check c-${l}"><span class="ic">${ic}</span><span>${h}</span></div>`;
  if(!AUTH.logUrl)return say(line("bad","\u2715","No Apps Script URL is set in <code>AUTH.logUrl</code>."));
  if(!USER)return say(line("bad","\u2715","Not signed in. Sign in with your propertypistol.com account first."));
  if(!tokenLive()){ tokenPanel();
    return say(line("bad","\u2715","<b>Your sign-in expired.</b> That is almost certainly why reading never worked. Press <b>Sign in again</b> above and test once more.")); }
  const mins=Math.round(tokenLeft()/60000);
  say(line("warn","\u2026","Asking the server\u2026"));
  const t0=Date.now();
  const ai=await askAI("Project: Testwell Residency by Testwell Group, Bavdhan, Pune. 2 & 3 BHK starting at \u20b990 Lacs. 21 acre township.");
  const ms=Date.now()-t0;
  if(ai&&ai.proj) return say(
    line("ok","\u2713",`<b>Working.</b> Gemini answered in ${ms} ms and read the project as <code>${esc(ai.proj)}</code>.`)+
    line("ok","\u2713",`Your sign-in has about ${mins} minutes left.`));
  say(line("bad","\u2715",`<b>The AI reader did not answer.</b> The server said: <code>${esc(AI_ERR||"nothing")}</code>`)+
    line("warn","!","If that mentions the <b>Gemini key</b>, paste your AI Studio key into <code>GEMINI_KEY</code> in the Apps Script, then <b>Deploy \u2192 Manage deployments \u2192 pencil \u2192 Version: New version \u2192 Deploy</b>. Saving the script alone does not change the live URL.")+
    line("warn","!","If it mentions <b>sign in</b> or a token, press Sign in again above.")+
    line("warn","!","If it mentions a <b>status code</b>, the deployment URL in <code>AUTH.logUrl</code> is pointing at an old version."));
});

let LAST_READ=null;
const FOUND_ROWS=[["proj","Project","acProj"],["dev","Developer","acDev"],
  ["micro","Micro-market","acMicro"],["city","City","acCity"],
  ["cfg","Configuration","acCfg"],["price","Price","acPrice"],
  ["loc","Location line","acLoc"],["possession","Possession","lpPoss"],
  ["rera","RERA number","crRera"]];
const FOUND_LISTS=[["usps","USPs","acUsps"],["amen","Amenities","acAmen"],["marks","Landmarks","acMarks"]];
function drawFound(){
  const r=LAST_READ; if(!r)return;
  const cell=(k,label,v,s)=>`<tr>
    <td style="width:120px">${esc(label)}</td>
    <td><input type="text" data-fx="${k}" value="${esc(v||"")}" placeholder="not found"
      style="font-family:var(--mono);font-size:12px;padding:6px 8px"></td>
    <td class="right" style="width:110px"><span class="pill ${v?"p-ok":"p-mute"}">${v?esc(s||"page text"):"\u2014"}</span></td></tr>`;
  const list=(k,label,arr)=>`<tr>
    <td style="width:120px">${esc(label)}</td>
    <td><textarea data-fl="${k}" rows="${Math.max(2,Math.min(6,arr.length))}"
      style="font-family:var(--mono);font-size:12px;padding:6px 8px">${esc(arr.join("\n"))}</textarea></td>
    <td class="right" style="width:110px"><span class="pill ${arr.length?"p-ok":"p-mute"}">${arr.length||"\u2014"}</span></td></tr>`;
  $("#impFound").innerHTML=`<table class="kv"><tbody>
    ${FOUND_ROWS.map(([k,l])=>cell(k,l,r.g[k],r.src[k])).join("")}
    ${FOUND_LISTS.map(([k,l])=>list(k,l,r[k]||[])).join("")}
    </tbody></table>
    ${r.aiNote?`<div class="check c-warn" style="margin-top:10px"><span class="ic">!</span><span>${esc(r.aiNote)}</span></div>`:""}
    <details style="margin-top:10px"><summary class="f-note" style="cursor:pointer">Show what was read</summary>
      <div class="out sm" style="margin-top:8px;max-height:220px;overflow:auto;white-space:pre-wrap">${esc((r.rawSample||"").slice(0,1500)||"nothing captured")}</div>
    </details>
    <div class="btnrow" style="margin-top:12px">
      <button class="btn btn-pri btn-sm" id="foundApply">Apply to brief</button>
      <span class="f-note" style="margin:0">Read ${r.chars.toLocaleString()} characters via ${esc(r.via)} using
        <b>${r.aiUsed?"Gemini":"the pattern reader"}</b>. Edit anything wrong, then apply.</span>
    </div>`;
}
on("#impFound","input",e=>{
  const k=e.target.dataset.fx, l=e.target.dataset.fl;
  if(!LAST_READ)return;
  if(k){ LAST_READ.g[k]=e.target.value; LAST_READ.src[k]="edited"; }
  if(l){ LAST_READ[l]=e.target.value.split("\n").map(s=>s.trim()).filter(Boolean); }
});
on("#impFound","click",e=>{
  if(e.target.id!=="foundApply"||!LAST_READ)return;
  const over=$("#impOverwrite")&&$("#impOverwrite").checked;
  const put=(id,v)=>{ const el=$("#"+id); if(el&&v&&(over||!el.value)){
    el.value=v; el.dispatchEvent(new Event("input",{bubbles:true})); } };
  FOUND_ROWS.forEach(([k,,id])=>{ if(id)put(id,LAST_READ.g[k]); });
  FOUND_LISTS.forEach(([k,,id])=>put(id,(LAST_READ[k]||[]).join("\n")));
  if(LAST_READ.g.allIn){ const e2=$("#acAllIn"); if(e2&&(over||!e2.value)){
    e2.value=LAST_READ.g.allIn; e2.dispatchEvent(new Event("change",{bubbles:true})); } }
  toast("Brief updated");
});
/* ── reading a WhatsApp announcement ──────────────────────────────────────
   This is how a project actually arrives: a sales person forwards the
   builder's blast. It is not a landing page. There are no headings, emoji
   stand in for bullets, and the last few lines are the sender's own footer —
   their name, their number, their agency's RERA — which is not project
   information at all.

   The split is the same one the design agent uses. Anything that has to be
   EXACT is pulled here by pattern and overrides the model: the price, the
   configuration and the registration number are copied, never interpreted.
   The model is left with the judgement a pattern cannot make — which line is
   the project and which is the developer, what is a selling point and what is
   the broker signing off. */

const WA_PHONE=/(?:\+?91[\s-]?)?[6-9]\d{9}\b/g;
const WA_FOOTER=/\b(agent|agency|broker|channel partner|cp\b|rera reg\w* of|our rera|propertypistol|call now|whatsapp now|site visit booking|regards|thanks)\b/i;

function waFacts(raw){
  const out={}, txt=String(raw||"");
  const lines=txt.split(/\n/);

  /* RERA: the project's, not the sender's. Every candidate is judged by the
     words immediately before it rather than by its line, because a brochure's
     text comes out of the PDF as one long run with no line breaks at all —
     and a whole-line test then reads the entire page as a sign-off and throws
     the project's own number away with the agency's. */
  const RERA=/(?:maha\s*rera|k[\s-]?rera|up\s*rera|rera|registration|reg)\b[^A-Za-z0-9]{0,4}(?:no\.?|number|#|id)?[^A-Za-z0-9]{0,6}([A-Z0-9][A-Z0-9\/\-]{6,32})/ig;
  const SIGNER=/\b(agent|agency|broker|channel\s*partner|marketed\s*by|cp)\b[^.]{0,40}$/i;
  let m2;
  while((m2=RERA.exec(txt))!==null){
    const before=txt.slice(Math.max(0,m2.index-60),m2.index);
    if(SIGNER.test(before))continue;
    out.rera=m2[1].replace(/[.,;]+$/,"");
    break;
  }
  if(!out.rera){
    /* nothing survived the filter — a line-by-line pass is the fallback */
    for(const ln of lines){
      if(WA_FOOTER.test(ln))continue;
      const m=ln.match(new RegExp(RERA.source,"i"));
      if(m){ out.rera=m[1].replace(/[.,;]+$/,""); break; }
    }
  }

  /* Configuration. Two shapes turn up and both have to work: a run on one
     line, "2, 2.5 & 3 BHK", and a price table where each size has its own
     line — "2 BHK 1115 sq.ft - 1.65 Cr", "3 BHK 1237 sq.ft - 1.89 Cr". The
     first version took the first match and called a four-size project a
     2 BHK. Every size is collected and they are written out once. */
  const CFG=/((?:\d(?:\.\d)?\s*(?:,|&|\/|\+|and|to)\s*)*\d(?:\.\d)?)\s*(bhk|br|rk)\b/ig;
  const sizes=[]; let unit="", cm;
  while((cm=CFG.exec(txt))!==null){
    unit=unit||cm[2].toUpperCase();
    cm[1].split(/[,&\/+]|\band\b|\bto\b/i).map(x=>x.trim()).filter(Boolean)
      .forEach(nn=>{ if(/^\d+(?:\.\d)?$/.test(nn)&&sizes.indexOf(nn)===-1)sizes.push(nn); });
  }
  if(sizes.length){
    sizes.sort((x,y)=>parseFloat(x)-parseFloat(y));
    out.cfg=sizes.length===1
      ? sizes[0]+" "+unit
      : sizes.slice(0,-1).join(", ")+" & "+sizes[sizes.length-1]+" "+unit;
  }

  /* Price: the one that is actually the asking price, so a figure next to
     "starting", "onwards" or "from" wins over any other number in the text. */
  const P="(?:\\u20b9|rs\\.?|inr)?\\s*(\\d+(?:\\.\\d+)?)\\s*(l|lac|lacs|lakh|lakhs|cr|crore|crores|mn|m)\\b";
  const near=txt.match(new RegExp("(?:start\\w*|onward\\w*|from|just|only)[^\\n]{0,24}?"+P,"i"))
          ||txt.match(new RegExp(P+"[^\\n]{0,20}?(?:onward\\w*|\\*)","i"))
          ||txt.match(new RegExp(P,"i"));
  if(near){
    const n=near[near.length-2], u=near[near.length-1].toLowerCase();
    const unit=/^c/.test(u)?"Cr":/^(mn|m)$/.test(u)?"Mn":"L";
    out.price=n+" "+unit;
  }
  if(/all[\s-]?inclusive/i.test(txt))out.allIn="yes";
  else if(/\b(plus|extra|excl\w*)\b[^\n]{0,24}(gst|charges|stamp)/i.test(txt))out.allIn="no";

  const pos=txt.match(/possession[^A-Za-z0-9]{0,14}((?:[A-Za-z]{3,9}[\s'-]*)?(?:20)?\d{2})/i);
  if(pos)out.possession=pos[1].trim();
  else if(/ready\s*to\s*move/i.test(txt))out.possession="Ready to move";

  const pin=txt.match(/(?:^|[^\d])([1-9]\d{5})(?![\d])/);
  if(pin)out.pin=pin[1];
  return out;
}

/* The sender's sign-off is not a selling point. */
function waClean(list){
  return (list||[]).filter(x=>{
    const raw=String(x||"");
    /* judged before the number is stripped: "Call Rahul 98765 43210" with the
       digits removed still reads like a selling point, and is not one */
    WA_PHONE.lastIndex=0;
    if(WA_PHONE.test(raw))return false;
    if(WA_FOOTER.test(raw))return false;
    if(/^\s*(call|contact|visit|book|dm|ping|for\s+(details|booking|site))\b/i.test(raw))return false;
    return raw.trim().length>2;
  }).map(x=>String(x).replace(/\s{2,}/g," ").trim()).slice(0,14);
}

/* A prelaunch has no released name and no registration number. Lodha Wakad,
   Mahindra Mahalunge — the developer and the locality ARE the identity, and
   that is what the account's naming already does for this stage. So an
   unnamed project is not a failed read: it is a prelaunch, and it is marked
   as one rather than left blank for someone to puzzle over. */
const WA_PRE=/\b(pre[\s-]?launch|prelaunch|name\s*(?:yet\s*)?to\s*be\s*(?:revealed|announced)|coming\s*soon|name\s*not\s*revealed|under\s*approval|rera\s*(?:applied|awaited|in\s*process))\b/i;

function waPrelaunch(g,txt,flag){
  const named=!!String(g.proj||"").trim();
  const pre=flag||WA_PRE.test(txt||"")||(!named&&!!String(g.dev||"").trim());
  if(!pre)return false;
  if(!named){
    const where=g.micro||g.city||"";
    g.proj=[g.dev,where].filter(Boolean).join(" ").trim();
  }
  const st=$("#inStage");
  if(st&&st.value!=="prelaunch"){ st.value="prelaunch";
    st.dispatchEvent(new Event("change",{bubbles:true})); }
  return true;
}

/* Both readers end the same way, so the review table, the tags and the
   prelaunch handling cannot drift apart between them. */
function readDone(g,src,lists,meta){
  ["rera","cfg","price","possession","allIn"].forEach(k=>{
    if(meta.facts&&meta.facts[k]){ g[k]=meta.facts[k]; src[k]="pattern"; } });
  const pre=waPrelaunch(g,meta.raw,meta.prelaunch);
  if(pre&&!src.proj)src.proj="prelaunch";
  if(!g.loc)g.loc=[g.micro,g.city].filter(Boolean).join(", ");
  LAST_READ={g,src,usps:lists.usps,amen:lists.amen,marks:lists.marks,
    chars:(meta.raw||"").length||meta.chars||0,via:meta.via,
    aiUsed:meta.aiUsed,aiNote:meta.aiNote,template:false,rawSample:meta.raw||""};
  drawFound();
  const tag=meta.aiUsed?meta.okLabel:"pattern read only";
  $("#startStat").innerHTML=`<span class="pill ${meta.aiUsed?"p-ok":"p-warn"}">${esc(tag)}</span>`;
  const bits=[tag];
  if(pre)bits.push("prelaunch \u2014 named from the developer and locality");
  if(meta.facts&&meta.facts.pin)bits.push("pincode "+meta.facts.pin);
  toast(bits.join(" \u00b7 ")+" \u2014 check the fields, then Apply");
  return pre;
}

async function runWa(){
  const txt=$("#impPaste").value.trim();
  if(txt.length<20){ $("#impWaBox").classList.remove("hidden"); $("#impPaste").focus();
    return toast("Paste the WhatsApp message first"); }
  $("#startStat").innerHTML='<span class="pill p-mute">reading the message\u2026</span>';

  const facts=waFacts(txt);
  const g={proj:"",dev:"",micro:"",city:"",cfg:"",price:"",loc:"",possession:"",rera:"",allIn:""};
  const src={};
  let usps=[],amen=[],marks=[],aiUsed=false,aiNote="";

  const ai=await adsCall("extract-wa",{text:txt.slice(0,12000)});
  if(ai&&!ai.error){
    ["proj","dev","micro","city","cfg","price","possession","rera","allIn"]
      .forEach(k=>{ if(ai[k]){ g[k]=String(ai[k]).trim(); src[k]="Gemini"; } });
    usps=waClean(ai.usps); amen=waClean(ai.amenities); marks=waClean(ai.landmarks);
    aiUsed=true;
  } else aiNote=(ai&&ai.error)||"Gemini did not answer.";

  readDone(g,src,{usps,amen,marks},
    {facts,raw:txt,via:"WhatsApp message",aiUsed,aiNote,
     okLabel:"read the message",prelaunch:false});
  logEvent("wa-read",g.proj||"");
}

/* ── reading a brochure PDF ───────────────────────────────────────────────
   A developer's brochure is a design file exported to PDF. Sometimes the
   text is real and can simply be copied out, for nothing; far more often it
   is outlines, and there is no text at all. So the text layer is tried
   first, and only when it comes back empty are the pages themselves rendered
   and read. The pattern pass runs over whatever text was recovered, so a
   price or a registration number that WAS selectable is still copied rather
   than interpreted. */
let PDFJS=null;
async function pdfLib(){
  if(PDFJS)return PDFJS;
  const base="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174";
  await new Promise((res,rej)=>{
    const sc=document.createElement("script");
    sc.src=base+"/pdf.min.js"; sc.onload=res;
    sc.onerror=()=>rej(new Error("Could not load the PDF reader"));
    document.head.appendChild(sc);
  });
  PDFJS=window.pdfjsLib;
  if(!PDFJS)throw new Error("The PDF reader did not load");
  PDFJS.GlobalWorkerOptions.workerSrc=base+"/pdf.worker.min.js";
  return PDFJS;
}

async function runPdf(file){
  if(!file)return;
  if(file.size>25e6)return toast("That brochure is over 25 MB \u2014 send a smaller export");
  $("#startStat").innerHTML='<span class="pill p-mute">opening the brochure\u2026</span>';
  const lib=await pdfLib();
  const buf=await file.arrayBuffer();
  const doc=await lib.getDocument({data:new Uint8Array(buf)}).promise;
  const n=Math.min(doc.numPages,6);

  /* Items come out in reading order but with no line breaks. Their baseline
     is in the transform, so a change in it is a new line — which is what
     makes the brochure read like a brochure rather than one long sentence. */
  let txt="";
  for(let i=1;i<=n;i++){
    const pg=await doc.getPage(i);
    const c=await pg.getTextContent();
    let lastY=null, line=[];
    const flush=()=>{ if(line.length){ txt+=line.join(" ").replace(/\s{2,}/g," ").trim()+"\n"; line=[]; } };
    c.items.forEach(it=>{
      const y=it.transform&&it.transform[5];
      if(lastY!==null&&y!==null&&Math.abs(y-lastY)>3)flush();
      if(it.str&&it.str.trim())line.push(it.str);
      if(y!==null)lastY=y;
    });
    flush();
  }
  txt=txt.replace(/[ \t]{2,}/g," ").replace(/\n{3,}/g,"\n\n").trim();

  const g={proj:"",dev:"",micro:"",city:"",cfg:"",price:"",loc:"",possession:"",rera:"",allIn:""};
  const src={}; let usps=[],amen=[],marks=[],aiUsed=false,aiNote="",flag=false;
  const facts=txt.length>40?waFacts(txt):{};
  let via="brochure text", ai=null;

  if(txt.length>200){
    $("#startStat").innerHTML='<span class="pill p-mute">reading the text\u2026</span>';
    ai=await adsCall("extract-wa",{text:txt.slice(0,12000)});
  }
  if(!ai||ai.error){
    /* the pages are pictures — render them and have them read */
    $("#startStat").innerHTML=`<span class="pill p-mute">reading ${n} page${n===1?"":"s"}\u2026</span>`;
    const pages=[];
    for(let i=1;i<=n;i++){
      const pg=await doc.getPage(i);
      const vp0=pg.getViewport({scale:1});
      const scale=Math.min(1600/vp0.width,2);
      const vp=pg.getViewport({scale});
      const cv=document.createElement("canvas");
      cv.width=Math.round(vp.width); cv.height=Math.round(vp.height);
      await pg.render({canvasContext:cv.getContext("2d"),viewport:vp}).promise;
      pages.push({data:cv.toDataURL("image/jpeg",0.78).split(",")[1]});
    }
    via=`brochure pages (${n})`;
    ai=await adsCall("read-brochure",{pages,name:file.name});
  }

  if(ai&&!ai.error){
    ["proj","dev","micro","city","cfg","price","possession","rera","allIn"]
      .forEach(k=>{ if(ai[k]){ g[k]=String(ai[k]).trim(); src[k]="Gemini"; } });
    usps=waClean(ai.usps); amen=waClean(ai.amenities); marks=waClean(ai.landmarks);
    aiUsed=true; flag=!!ai.prelaunch;
  } else aiNote=(ai&&ai.error)||"Gemini did not answer.";

  readDone(g,src,{usps,amen,marks},
    {facts,raw:txt,via,aiUsed,aiNote,chars:txt.length,
     okLabel:"read the brochure",prelaunch:flag});
  logEvent("pdf-read",file.name);
}
/* Four things can be wrong and guessing between them wastes an afternoon:
   no key, a key the models endpoint rejects, an old deployment that does not
   have these routes yet, or a signed-out session. This asks the server a
   question it must answer and prints exactly what came back. */
on("#impKey","click",async()=>{
  const box=$("#impKeyOut");
  const line=(l,ic,h)=>`<div class="check c-${l}"><span class="ic">${ic}</span><span>${h}</span></div>`;
  box.innerHTML=line("warn","\u2026","Asking the Apps Script\u2026");
  if(!AUTH.logUrl)return box.innerHTML=line("bad","\u2715","No Apps Script URL is set in <code>AUTH.logUrl</code>.");
  if(!USER)return box.innerHTML=line("bad","\u2715","Sign in first \u2014 the key is read on the server, as you.");

  const chk=await adsCall("ai-check",{});
  if(chk.error)
    return box.innerHTML=line("bad","\u2715",`<b>The server said:</b> <code>${esc(chk.error)}</code>`)+
      line("warn","!","If that mentions an unknown action, the deployment is older than these routes. <b>Deploy \u2192 Manage deployments \u2192 pencil \u2192 Version: New version \u2192 Deploy.</b>");
  if(!chk.ready)
    return box.innerHTML=line("bad","\u2715","<b>No Gemini key on the server.</b> Apps Script \u2192 Project Settings \u2192 Script Properties \u2192 add <code>GEMINI_KEY</code>. Never put it in the repository \u2014 it is public.");

  box.innerHTML=line("ok","\u2713",`Key present. It will use <code>${esc(chk.model||"\u2014")}</code>.`)+
    line("warn","\u2026","Now sending it a real message\u2026");
  const probe=await adsCall("extract-wa",{text:
    "NEW LAUNCH\nTESTWELL HEIGHTS by Testwell Group\nBavdhan, Pune\n2 & 3 BHK\nStarting 90 L onwards\nMahaRERA: P52100099999"});
  if(probe.error)
    return box.innerHTML=line("ok","\u2713",`Key present, model <code>${esc(chk.model||"\u2014")}</code>.`)+
      line("bad","\u2715",`<b>But the call failed:</b> <code>${esc(probe.error)}</code>`)+
      (/API key|403|refused the key/i.test(probe.error)
        ? line("warn","!","That is about the key itself. An AI Studio key is the one from <b>aistudio.google.com \u2192 Get API key</b>.")
        : /took too long|abort/i.test(probe.error)
        ? line("warn","!","It ran out of time rather than failing. Press it again \u2014 the model it settles on is remembered.")
        : /busy|high demand|503/i.test(probe.error)
        ? line("warn","!","Google is busy, not broken. Press it again in a few seconds.")
        : line("warn","!","If it mentions an unknown action, redeploy the Apps Script as a <b>new version</b>."));
  box.innerHTML=line("ok","\u2713",`<b>Working.</b> Model <code>${esc(chk.model||"\u2014")}</code> read the test message as `+
    `<b>${esc(probe.proj||"(no project)")}</b>${probe.dev?` by <b>${esc(probe.dev)}</b>`:""}`+
    `${probe.price?`, ${esc(probe.price)}`:""}.`)+
    line("ok","\u2713","Paste a real WhatsApp message or drop a brochure \u2014 it is ready.");
});

on("#impPdfFile","change",e=>{
  const f=e.target.files&&e.target.files[0];
  e.target.value="";
  if(!f)return;
  runPdf(f).catch(err=>{
    $("#startStat").innerHTML='<span class="pill p-bad">failed</span>';
    toast("Could not read the brochure: "+((err&&err.message)||err));
  });
});
/* Opening the box and reading what is in it are two different things. They
   were one button once, which meant pressing it twice to do one job. */
on("#impWa","click",()=>{
  $("#impWaBox").classList.remove("hidden");
  $("#impPaste").focus();
});
on("#impPaste","input",()=>{
  const n=$("#impPaste").value.trim().length;
  $("#impWaCount").textContent=n?`${n.toLocaleString()} characters`:"";
});
on("#impWaClear","click",()=>{
  $("#impPaste").value=""; $("#impWaCount").textContent="";
  $("#impPaste").focus();
});
on("#impWaGo","click",()=>{
  runWa().catch(e=>{
    $("#startStat").innerHTML='<span class="pill p-bad">failed</span>';
    toast("Could not read it: "+((e&&e.message)||e));
  });
});

async function readLp(){
  try{ await runRead(); }
  catch(err){
    $("#impStat").innerHTML='<span class="pill p-bad">failed</span>';
    $("#impFound").innerHTML=`<div class="check c-bad"><span class="ic">\u2715</span><span><b>Reading failed.</b> ${esc(String((err&&err.message)||err))}</span></div>`;
    toast("Read failed \u2014 see the panel");
  }
}
async function runRead(){
  const url=$("#inLp").value.trim(), pasted=$("#impPageText").value.trim();
  let txt=pasted, via=pasted?"pasted text":"";
  let server=null;
  if(!txt&&url&&AUTH.logUrl&&USER){
    $("#impStat").innerHTML='<span class="pill p-mute">reading on the server\u2026</span>';
    server=await serverRead(url);
    if(server&&server._text){ txt=server._text; via="Apps Script"; }
  }
  if(!txt){
    if(!url)return toast("Put the landing page URL in first");
    $("#impStat").innerHTML='<span class="pill p-mute">reading\u2026</span>';
    for(let i=0;i<READERS.length;i++){
      const target=READERS[i](url);
      $("#impStat").innerHTML=`<span class="pill p-mute">reader ${i+1} of ${READERS.length}\u2026</span>`;
      try{
        const ctl=new AbortController();
        const bail=setTimeout(()=>ctl.abort(),12000);
        const r=await fetch(target,{signal:ctl.signal});
        clearTimeout(bail);
        if(!r.ok)continue;
        const t=await r.text();
        if(t&&t.length>400){txt=t;via=new URL(target).hostname;break;}
      }catch(e){}
    }
  }
  if(!txt||txt.length<200){
    $("#impStat").innerHTML='<span class="pill p-bad">blocked</span>';
    $("#impPageText").classList.remove("hidden");
    $("#impFound").innerHTML=`<div class="callout warn">Every reader was blocked by the site. Open the page, select all, copy, and paste it into the box above \u2014 the parser treats pasted HTML and plain text the same way.</div>`;
    return;
  }
  let r=capture(txt);
  let aiNote="", aiUsed=false;
  if(server&&!server.error){
    Object.keys(server).forEach(k=>{
      if(k.charAt(0)==="_")return;
      if(server[k]&&!Array.isArray(server[k])){ r.g[k]=server[k]; r.src[k]="Gemini"; }
    });
    if(Array.isArray(server.usps)&&server.usps.length)r.usps=server.usps.slice(0,8);
    if(Array.isArray(server.amenities)&&server.amenities.length)r.amen=server.amenities.slice(0,14);
    if(Array.isArray(server.landmarks)&&server.landmarks.length)r.marks=server.landmarks.slice(0,8);
    aiUsed=true;
  } else if(AI_ERR) aiNote=AI_ERR;
  if(!AUTH.logUrl) aiNote="AI reader off: no Apps Script URL is configured.";
  else if(!USER) aiNote="AI reader off: sign in first.";
  if(!aiUsed&&AUTH.logUrl&&USER){
    $("#impStat").innerHTML='<span class="pill p-mute">reading with AI\u2026</span>';
    const ai=await askAI(txt);
    if(ai){
      Object.keys(ai).forEach(k=>{ if(ai[k]&&!Array.isArray(ai[k])){ r.g[k]=ai[k]; r.src[k]="Gemini"; } });
      if(Array.isArray(ai.usps)&&ai.usps.length)r.usps=ai.usps.slice(0,8);
      if(Array.isArray(ai.amenities)&&ai.amenities.length)r.amen=ai.amenities.slice(0,14);
      if(Array.isArray(ai.landmarks)&&ai.landmarks.length)r.marks=ai.landmarks.slice(0,8);
      aiUsed=true;
    } else aiNote=AI_ERR||"AI reader did not answer. Check that GEMINI_KEY is set in the Apps Script and that you redeployed it as a new version.";
  }
  r.aiUsed=aiUsed; r.aiNote=aiNote;
  /* The table is the brief, not a report of it. Type here and it lands in
     the fields below. */
  LAST_READ={g:r.g,src:r.src,usps:r.usps,amen:r.amen,marks:r.marks,chars:r.chars,via,
    aiUsed:r.aiUsed,aiNote:r.aiNote,template:r.template,rawSample:txt};
  drawFound();
  const how=r.aiUsed?"read with AI":(r.template?"template read":"pattern read");
  $("#impStat").innerHTML=`<span class="pill ${r.aiUsed||r.template?"p-ok":"p-warn"}">${how}</span>`;
  logEvent("lp-read",url);
  toast(`${how} \u2014 check the fields, then Apply`);
}


on("#impFetch","click",readLp);
on("#impPasteBtn","click",()=>{ const t=$("#impPageText");
  t.classList.toggle("hidden"); if(!t.classList.contains("hidden"))t.focus(); });
on("#impManual","click",()=>{
  $("#impStat").innerHTML='<span class="pill p-mute">manual</span>';
  $("#impFound").innerHTML='<div class="callout">Type the brief into the fields below. Project name is the only one really needed \u2014 the more you fill, the better the generated copy.</div>';
  const el=$("#acProj"); if(el){ if(el.scrollIntoView)el.scrollIntoView({block:"center",behavior:"smooth"}); el.focus(); }
});

