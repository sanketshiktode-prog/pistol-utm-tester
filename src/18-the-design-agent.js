/* ═══════════ the design agent ═══════════════════════════════════════════
   It is handed the finished pictures and asked what a designer would be
   asked. Everything exact — the RERA number, the QR, the price, the logo —
   was drawn here and is not up for discussion; the model only ever picks
   from settings this page already offers, and the backend drops anything
   else it tries to set. */
let AI_SUGGEST=null;
function aiLine(kind,ic,html){
  return `<div class="check c-${kind}"><span class="ic">${ic}</span><span>${html}</span></div>`;
}
/* A full-size render is half a megabyte of base64 and the model is being
   asked about collisions and legibility, not about pixels. They go down to
   a long edge of 1024, which is about a quarter of the tokens and makes no
   difference to anything it is being asked. */
function aiShrink(url,max){
  return new Promise(res=>{
    const im=new Image();
    im.onload=()=>{
      const k=Math.min(1,max/Math.max(im.naturalWidth,im.naturalHeight));
      const c=document.createElement("canvas");
      c.width=Math.round(im.naturalWidth*k); c.height=Math.round(im.naturalHeight*k);
      c.getContext("2d").drawImage(im,0,0,c.width,c.height);
      res(c.toDataURL("image/jpeg",0.82).split(",")[1]);
    };
    im.onerror=()=>res(String(url||"").split(",")[1]);
    im.src=url;
  });
}
async function aiShots(){
  /* the first hero's four sizes — one set is what a review is about */
  const first=CR_OUT.length?CR_OUT[0].hero:null;
  const mine=CR_OUT.filter(o=>!first||o.hero===first).slice(0,4);
  const out=[];
  for(const o of mine){
    const data=await aiShrink(o.url,1024);
    if(data)out.push({name:`${o.name} ${o.w}x${o.h}`,data});
  }
  return out;
}
async function aiRun(){
  if(!CR_OUT.length){ toast("Render first"); return null; }
  const st=$("#aiStat"), out=$("#aiOut");
  st.innerHTML=`<span class="pill p-mute">looking…</span>`;
  out.innerHTML=aiLine("warn","…","Sending the four sizes to Gemini…");
  const r=await adsCall("ai-review",{
    shots:await aiShots(),
    brief:{dev:val("crDev"),proj:val("crProj"),loc:val("crLoc")},
    settings:{layout:crLayoutId(),palette:$("#crPalette").value,font:$("#crFont").value,
              scrim:Number($("#crScrim").value),fill:Number($("#crFill").value)}
  });
  if(r.error){
    st.innerHTML=`<span class="pill p-bad">failed</span>`;
    out.innerHTML=aiLine("bad","✕",esc(r.error));
    return null;
  }
  AI_SUGGEST=r.suggest&&Object.keys(r.suggest).filter(k=>k!=="why"&&r.suggest[k]!=="").length
    ? r.suggest : null;
  $("#aiApply").disabled=!AI_SUGGEST;
  const V={clean:["ok","✓"],minor:["warn","!"],bad:["bad","✕"]};
  const v=V[r.verdict]||V.minor;
  st.innerHTML=`<span class="pill ${r.verdict==="clean"?"p-ok":r.verdict==="bad"?"p-bad":"p-warn"}">${
    esc(r.verdict||"reviewed")}</span>`;
  let html=aiLine(v[0],v[1],`<b>${r.verdict==="clean"?"Nothing to fix.":
    r.verdict==="bad"?"Serious problems.":"Minor problems."}</b>`);
  (r.sizes||[]).forEach(sz=>{
    const issues=(sz.issues||[]).filter(i=>i&&i.what);
    html+=`<div class="f-lab" style="margin:10px 0 4px">${esc(sz.name||"")}</div>`;
    html+=issues.length
      ? issues.map(i=>aiLine(i.severity==="bad"?"bad":"warn",i.severity==="bad"?"✕":"!",esc(i.what))).join("")
      : aiLine("ok","✓","Clean.");
  });
  if(AI_SUGGEST){
    const bits=["layout","palette","font","scrim","fill"]
      .filter(k=>AI_SUGGEST[k]!==undefined&&AI_SUGGEST[k]!=="")
      .map(k=>`${k} → <b>${esc(String(AI_SUGGEST[k]))}</b>`);
    html+=aiLine("warn","→",`<b>It would change:</b> ${bits.join(" · ")}<br>
      ${esc(AI_SUGGEST.why||"")}`);
  }
  if(r._usage)html+=`<div class="f-note" style="margin-top:8px">${r._usage.total_tokens||"?"} tokens</div>`;
  out.innerHTML=html;
  return r;
}
function aiApply(){
  if(!AI_SUGGEST)return false;
  let moved=false;
  const put=(id,v)=>{ const el=$("#"+id); if(el&&v!==undefined&&v!==""&&el.value!==String(v)){
    el.value=String(v); el.dispatchEvent(new Event("change",{bubbles:true})); moved=true; } };
  put("crLayout",AI_SUGGEST.layout);
  put("crPalette",AI_SUGGEST.palette);
  put("crFont",AI_SUGGEST.font);
  if(AI_SUGGEST.scrim!==undefined)put("crScrim",AI_SUGGEST.scrim);
  if(AI_SUGGEST.fill!==undefined)put("crFill",AI_SUGGEST.fill);
  return moved;
}
on("#aiReview","click",()=>aiRun());
on("#aiApply","click",async()=>{
  if(!aiApply())return toast("Nothing it suggested is different from what is set");
  $("#crRender").click();
  toast("Applied — re-rendered");
});
on("#aiLoop","click",async()=>{
  for(let i=0;i<3;i++){
    const r=await aiRun();
    if(!r)return;
    if(r.verdict==="clean"){ toast(`Clean after ${i+1} pass${i?"es":""}`); return; }
    if(!AI_SUGGEST){ toast("It found problems but nothing to change automatically — read them"); return; }
    if(!aiApply()){ toast("It keeps suggesting what is already set — read the issues"); return; }
    $("#crRender").click();
    await new Promise(r2=>setTimeout(r2,700));
  }
  toast("Three passes done — read what is left");
});

/* ── the ad set ───────────────────────────────────────────────────────────
   One project is rarely one picture. Each kept set is four renders plus the
   logo, and each becomes its own Demand Gen ad under the same ad groups.
   They are held in memory, not localStorage: four JPEGs come to a couple of
   megabytes and the whole store is about five. */
let CR_SETS=[];      /* rebuilt on every render, one per hero image */
let CR_KEPT=[];      /* held by hand, across renders */
function allSets(){ return CR_KEPT.concat(CR_SETS); }
/* Repaints the gallery from whatever is in CR_OUT, for renders that came
   back from a saved project rather than from pressing Render. Without it a
   reopened project shows its heroes and its set list but an empty canvas,
   which reads as if nothing was restored. */
function crShowSaved(){
  const box=$("#crOut"); if(!box||!CR_OUT.length)return;
  const byHero={};
  CR_OUT.forEach(o=>{ (byHero[o.hero]=byHero[o.hero]||[]).push(o); });
  box.innerHTML=Object.keys(byHero).map((hero,hi)=>
    `<div class="f-lab" style="margin:${hi?18:4}px 0 8px">
       <span class="tgt-kind k-city">AD ${hi+1}</span> ${esc(hero)}</div>
     <div class="row2">`+byHero[hero].map(o=>`
      <div style="margin-bottom:14px">
        <img src="${o.url}" alt="${esc(o.name)}" data-k="${o.k}" class="cr-open"
          style="width:100%;border:1px solid var(--line);border-radius:10px;display:block">
        <div class="mini" style="margin-top:6px">${esc(o.name)}
          <span class="p-mute">${(o.bytes/1024).toFixed(0)} KB · from the saved project</span></div>
      </div>`).join("")+`</div>`).join("");
  const sz=$("#crSizes");
  if(sz)sz.innerHTML=`<span class="pill p-ok">${CR_OUT.length} restored — press Render to redraw them</span>`;
}

function drawSets(){
  const all=allSets(), st=$("#setStat");
  if(st)st.innerHTML=all.length
    ? `<span class="pill p-ok">${all.length} ad${all.length===1?"":"s"} per ad group${
        CR_KEPT.length?` · ${CR_KEPT.length} kept`:""}</span>`
    : `<span class="pill p-mute">nothing rendered</span>`;
  const box=$("#setList"); if(!box)return;
  box.innerHTML=all.length?all.map((s,i)=>{
    const kept=i<CR_KEPT.length;
    return `<div class="tgt-row">
      ${s.thumb?`<img src="${s.thumb}" alt="" style="width:34px;height:34px;object-fit:cover;border-radius:4px;flex:0 0 auto">`:""}
      <span class="tgt-kind ${kept?"k-rad":"k-city"}">AD ${i+1}</span>
      <span class="nm">${esc(s.name)}</span>
      <span class="cid">${s.sizes.length} size${s.sizes.length===1?"":"s"} · ${esc(s.layout||"")}${
        kept?" · kept":""}</span>
      ${kept?`<button class="x" data-sk="${i}" title="Remove">✕</button>`
            :`<span class="cid">from the hero</span>`}
    </div>`;}).join(""):`<div class="empty">Upload a hero and render.</div>`;
  /* the whole plan travels to the Apps Script as one request, pictures and
     all, so the size is worth saying out loud before a deploy fails on it */
  const mb=allSets().reduce((a,s)=>a+Object.keys(s.images)
    .reduce((b,k)=>b+(s.images[k].data||"").length,0),0)/1048576;
  if(mb>9)box.innerHTML+=`<div class="check c-warn" style="margin-top:8px"><span class="ic">!</span><span>
    <b>${mb.toFixed(0)} MB of artwork.</b> Everything travels to the script in one request. Four sets
    is comfortable; past that, deploy in two runs.</span></div>`;
}
on("#setKeep","click",()=>{
  if(!CR_OUT.length)return toast("Render first");
  /* whatever is on screen, held as an extra ad — so one hero can run twice
     under two different looks */
  const first=CR_OUT[0].hero;
  const mine=CR_OUT.filter(o=>o.hero===first);
  const im={};
  mine.forEach(o=>{ const d=String(o.url||"").split(",")[1]; if(d)im[o.name]={data:d}; });
  const lg=dgLogo(); if(lg)im.logo=lg;
  const auto=`${first||"Creative"} · ${crLayoutId()}`;
  let nm=($("#setName").value||"").trim()||auto;
  if(allSets().some(x=>x.name.toLowerCase()===nm.toLowerCase())){
    let n=2; while(allSets().some(x=>x.name.toLowerCase()===`${nm} ${n}`.toLowerCase()))n++;
    nm=`${nm} ${n}`;
  }
  CR_KEPT.push({name:nm,images:im,
    thumb:(mine.find(o=>o.name==="square")||mine[0]||{}).url||"",
    sizes:mine.map(o=>o.name),layout:crLayoutId()});
  $("#setName").value="";
  drawSets(); drawApSettings(); drawApPlan();
  toast(`"${nm}" kept — ${allSets().length} ads per ad group`);
});
on("#setList","click",e=>{
  const x=e.target.closest("[data-sk]"); if(!x)return;
  const [s]=CR_KEPT.splice(+x.dataset.sk,1);
  drawSets(); drawApSettings(); drawApPlan();
  toast(`"${s.name}" removed`);
});

/* Google's own limits for Demand Gen image assets */
function crChecks(){
  const out=$("#crChecksOut"); if(!out)return;
  if(!CR_OUT.length){ out.innerHTML=`<div class="empty">Nothing rendered yet.</div>`; return; }
  const line=(l,ic,h)=>`<div class="check c-${l}"><span class="ic">${ic}</span><span>${h}</span></div>`;
  const c=[];
  const hw=CR.hero?CR.hero.naturalWidth:0, hh=CR.hero?CR.hero.naturalHeight:0;
  if(hw<1200||hh<1200)
    c.push(line("warn","!",`<b>Hero is ${hw}×${hh}.</b> Below 1200 on a side the square and story
      crops get soft. Use a larger render if you have one.`));
  else c.push(line("ok","✓",`<b>Hero is ${hw}×${hh}.</b> Large enough for every crop.`));
  CR_OUT.forEach(o=>{
    const mb=o.bytes/1048576;
    if(mb>5) c.push(line("bad","✕",`<b>${o.name} is ${mb.toFixed(1)} MB.</b> Google's limit is 5 MB.`));
  });
  c.push(line("ok","✓","All four Demand Gen sizes rendered: 1200×1200, 960×1200, 1200×628, 1080×1920."));
  if(!CR.logo) c.push(line("warn","!","<b>No developer logo.</b> The developer name is drawn as text instead."));
  if(!CR.qr&&!($("#crRera")&&$("#crRera").value.trim()))
    c.push(line("warn","!","<b>No RERA number or QR.</b> Required on Indian real estate creative."));
  const price=($("#crPrice")&&$("#crPrice").value)||"";
  if(price&&!/\*/.test(price))
    c.push(line("warn","!","<b>Price has no asterisk.</b> House style is <code>₹89 LACS*</code>."));
  out.innerHTML=c.join("");
}
on("#crChecks","click",crChecks);

on("#crZip","click",()=>{
  if(!CR_OUT.length)return toast("Render first");
  const b=brief();
  const label=slug(b.proj||"project");
  const files=CR_OUT.map(o=>[`${label}-${o.w}x${o.h}.jpg`,crBytes(o)])
    .filter(f=>f[1]);
  files.push(["creative-spec.csv",
    "Size,Pixels,Ratio,Where it runs\n"+
    CR_SIZES.map(([n,w,h,r])=>`${n},${w}x${h},${r},Demand Gen`).join("\n")]);
  dlZip(`${label}-creatives.zip`,files);
  logEvent("export","creatives zip");
});

/* the layout picker, filled from the registry so a new layout only has to be
   added in one place */
(function(){
  const sel=$("#crLayout"); if(!sel)return;
  sel.innerHTML=CR_LAYOUTS.map(([id,name])=>`<option value="${id}">${esc(name)}</option>`).join("");
  const note=()=>{ const row=CR_LAYOUTS.find(r=>r[0]===sel.value);
    if($("#crLayoutNote"))$("#crLayoutNote").textContent=row?row[2]:""; };
  note(); sel.addEventListener("change",()=>{ note();
    if(typeof CR_OUT!=="undefined"&&CR_OUT.length&&$("#crRender"))$("#crRender").click(); });
})();

/* the palette and typeface pickers, filled from their registries for the
   same reason — a new palette is one row, nothing else */
(function(){
  const ps=$("#crPalette"), fs=$("#crFont");
  if(!ps||!fs)return;
  ps.innerHTML=CR_PALETTES.map(p=>`<option value="${p[0]}">${esc(p[1])}</option>`).join("")+
    `<option value="custom">Custom — pick the four colours</option>`;
  fs.innerHTML=CR_FONTS.map(f=>`<option value="${f[0]}">${esc(f[1])}</option>`).join("");
  const rerender=()=>{ if(typeof CR_OUT!=="undefined"&&CR_OUT.length&&$("#crRender"))$("#crRender").click(); };
  /* the custom controls are built from the same table the renderer reads, so
     a new knob is one row and nothing else */
  const grid=$("#crColGrid");
  if(grid&&!grid.childNodes.length){
    const base=CR_PALETTES[0][3];
    grid.innerHTML=CR_COLS.map(([id,label,key])=>
      `<label class="f"><span class="f-lab">${esc(label)}</span>
        <input type="color" id="${id}" value="${base[key]}" style="height:38px;padding:4px"></label>`).join("");
  }
  const drawPal=()=>{
    const custom=ps.value==="custom";
    $("#crCustomCols").classList.toggle("hidden",!custom);
    const p=crPalette(), row=CR_PALETTES.find(r=>r[0]===ps.value);
    $("#crSwatch").innerHTML=["paper","ink","accent","price","badge","pin"]
      .map(k=>`<i style="background:${p[k]}" title="${k} ${p[k]}"></i>`).join("");
    $("#crPaletteNote").textContent=custom
      ? "Ink is the dark panels and bands, paper the light ones, accent the price and rules."
      : (row?row[2]:"");
    $("#crLookHint").textContent=custom?"Custom":(row?row[1]:"");
  };
  const drawType=()=>{
    const f=crFontPair();
    $("#crFontNote").textContent=f[2];
    $("#crTypePrev").innerHTML=
      `<div class="tp-d" style="font-family:'${f[3]}',serif">${esc((val("crProj")||"PROJECT NAME").toUpperCase())}</div>`+
      `<div class="tp-p" style="font-family:'${f[3]}',serif">${esc(val("crPrice")||"₹ 1.70 Cr*")}</div>`+
      `<div class="tp-b" style="font-family:'${f[4]}',sans-serif">${esc((val("crCfg")||"2, 3 & 4 BHK").toUpperCase())} · ${esc((val("crLoc")||"LOCATION").toUpperCase())}</div>`;
  };
  ps.addEventListener("change",()=>{
    const row=CR_PALETTES.find(r=>r[0]===ps.value);
    if(row)CR_COLS.forEach(([id,,key])=>{ const el=$("#"+id); if(el&&row[3][key])el.value=row[3][key]; });
    drawPal(); rerender(); });
  fs.addEventListener("change",()=>{ drawType(); rerender(); });
  ["crScrim","crFill"].forEach(id=>{
    const el=$("#"+id); if(el)el.addEventListener("change",rerender); });
  ["crLogoName","crLogoCut","crLogoPlate"].forEach(id=>{
    const el=$("#"+id); if(el)el.addEventListener("change",rerender); });
  CR_COLS.forEach(([id])=>{
    const el=$("#"+id); if(el)el.addEventListener("change",()=>{ drawPal(); rerender(); }); });
  ["crProj","crPrice","crCfg","crLoc"].forEach(id=>{
    const el=$("#"+id); if(el)el.addEventListener("input",drawType); });
  drawPal(); drawType();
})();

drawDemoBoxes(); drawImgs();
if($("#asBizName")&&PROJ.bizName)$("#asBizName").value=PROJ.bizName;
["negExtra","negLists","negExactInPhrase"].forEach(id=>{
  const el=$("#"+id); if(el)el.addEventListener("change",drawApSettings); });
$$("#demoAge input,#demoInc input,#demoGen input,#demoPar input").forEach(el=>el.addEventListener("change",drawApSettings));
drawApSettings(); drawApPlan();
