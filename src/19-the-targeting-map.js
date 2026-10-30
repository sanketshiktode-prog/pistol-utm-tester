/* ═══════════ the targeting map ═══════════
   Radius and pincode targeting, drawn rather than typed. Both end up as
   campaign criteria: a radius as ProximityInfo, a pincode as its own geo
   target constant. Tiles come from OpenStreetMap and the geocoding from
   Nominatim, both in the browser — nothing here reaches Google. */
let MAP=null, MAP_LAYER=null;        /* OpenStreetMap, through Leaflet */
let GMAP=null, GOVL=[], GINFO=null;  /* Google, when there is a key for it */
let MAPKEY="", MAPKEY_TRIED=false;
const gmapOn=()=>!!GMAP;

/* Two maps behind one set of calls. OpenStreetMap needs nothing and is
   what runs by default; Google looks far better but needs a key, which
   needs billing on a Cloud project. So the key is not in this
   repository — it is a Script Property the server hands over after
   sign-in, and the moment it arrives the map is rebuilt as a Google
   one. Without it nothing breaks; the OSM map stays. */
const MAPX={
  ready(){ return gmapOn() || !!(window.L && $("#map")); },
  click:null,
  clear(){
    if(gmapOn()){ GOVL.forEach(o=>o.setMap(null)); GOVL=[]; return; }
    if(MAP_LAYER)MAP_LAYER.clearLayers();
  },
  circle(lat,lng,metres){
    if(gmapOn()){
      GOVL.push(new google.maps.Circle({map:GMAP,center:{lat,lng},radius:metres,
        strokeColor:"#FB6A02",strokeWeight:2,strokeOpacity:.9,
        fillColor:"#FB6A02",fillOpacity:.12,clickable:false}));
      return;
    }
    L.circle([lat,lng],{radius:metres,color:"#FB6A02",weight:2,fillOpacity:.12}).addTo(MAP_LAYER);
  },
  marker(lat,lng,o){
    o=o||{};
    if(gmapOn()){
      const m=new google.maps.Marker({map:GMAP,position:{lat,lng},
        draggable:!!o.drag, title:o.tip||"",
        icon:{path:google.maps.SymbolPath.CIRCLE,scale:7,fillColor:o.colour||"#FB6A02",
              fillOpacity:1,strokeColor:"#fff",strokeWeight:2}});
      if(o.drag)m.addListener("dragend",e=>o.drag(e.latLng.lat(),e.latLng.lng()));
      if(o.popup)m.addListener("click",()=>{
        if(!GINFO)GINFO=new google.maps.InfoWindow();
        GINFO.setContent(o.popup); GINFO.open({anchor:m,map:GMAP});
      });
      GOVL.push(m);
      return;
    }
    const icon=L.divIcon({className:"",iconSize:[14,14],iconAnchor:[7,7],
      html:`<div style="width:14px;height:14px;border-radius:50%;background:${
        o.colour||"#FB6A02"};border:2px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.3)"></div>`});
    const mk=L.marker([lat,lng],{draggable:!!o.drag,icon}).addTo(MAP_LAYER);
    if(o.tip)mk.bindTooltip(o.tip);
    if(o.popup)mk.bindPopup(o.popup,{closeButton:true,className:"pinpopw"});
    if(o.drag)mk.on("dragend",e=>{const p2=e.target.getLatLng();o.drag(p2.lat,p2.lng);});
  },
  fit(pts){
    if(!pts.length)return;
    if(gmapOn()){
      const b=new google.maps.LatLngBounds();
      pts.forEach(p2=>b.extend({lat:p2[0],lng:p2[1]}));
      GMAP.fitBounds(b,60);
      if(pts.length===1)google.maps.event.addListenerOnce(GMAP,"idle",()=>{
        if(GMAP.getZoom()>14)GMAP.setZoom(13); });
      return;
    }
    try{ MAP.fitBounds(L.latLngBounds(pts).pad(.35),{maxZoom:13}); }catch(e){}
  },
  centre(lat,lng,z){
    if(gmapOn()){ GMAP.setCenter({lat,lng}); GMAP.setZoom(z||12); return; }
    if(MAP)MAP.setView([lat,lng],z||12);
  },
  /* Leaflet measures its container, and a hidden tab has no size */
  resize(){ if(!gmapOn()&&MAP)setTimeout(()=>MAP.invalidateSize(),60); }
};

function mapReady(){ return MAPX.ready(); }
function mapClicked(lat,lng){
  addTarget({kind:"radius",lat,lng,
    radius:Number($("#radKm").value)||5,units:$("#radUnit").value||"KILOMETERS",
    label:`Radius ${(Number($("#radKm").value)||5)} ${$("#radUnit").value==="MILES"?"mi":"km"}`});
}
function mapInit(){
  if(GMAP)return;
  if(MAPKEY&&!MAP){ gmapBuild(); return; }
  if(MAP||!window.L||!$("#map"))return;
  MAP=L.map("map",{scrollWheelZoom:false}).setView([18.5204,73.8567],11);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    {maxZoom:18,attribution:"\u00a9 OpenStreetMap"}).addTo(MAP);
  MAP_LAYER=L.layerGroup().addTo(MAP);
  MAP.on("click",e=>mapClicked(e.latlng.lat,e.latlng.lng));
  setTimeout(()=>MAP.invalidateSize(),120);
  drawTargets();
}

function gmapBuild(){
  const el=$("#map");
  if(!el||!window.google||!google.maps)return;
  /* tear the OSM one down first, or two maps share one box */
  if(MAP){ try{ MAP.remove(); }catch(e){} MAP=null; MAP_LAYER=null; }
  el.innerHTML="";
  GMAP=new google.maps.Map(el,{
    center:{lat:18.5204,lng:73.8567}, zoom:11,
    mapTypeControl:false, streetViewControl:false, fullscreenControl:true,
    scrollwheel:false, gestureHandling:"cooperative", clickableIcons:false
  });
  GMAP.addListener("click",e=>mapClicked(e.latLng.lat(),e.latLng.lng()));
  GOVL=[]; GINFO=null;
  drawTargets();
}

/* The key lives in the Apps Script, not in this repository, which is
   public. It is asked for once, after sign-in. */
function mapsKeyApply(key){
  key=String(key||"").trim();
  if(!key||key===MAPKEY)return;
  MAPKEY=key;
  if(window.google&&google.maps)return gmapBuild();
  if(document.getElementById("gmapsjs"))return;
  const sc=document.createElement("script");
  sc.id="gmapsjs"; sc.async=true;
  sc.src="https://maps.googleapis.com/maps/api/js?v=weekly&key="+encodeURIComponent(key);
  sc.onload=()=>gmapBuild();
  sc.onerror=()=>toast("Google Maps would not load with that key \u2014 staying on the plain map",7000);
  document.head.appendChild(sc);
}
async function mapsKeyFetch(){
  if(MAPKEY_TRIED||typeof adsCall!=="function"||typeof USER==="undefined"||!USER)return;
  MAPKEY_TRIED=true;
  try{
    const r=await adsCall("app-config",{});
    if(r&&r.mapsKey)mapsKeyApply(r.mapsKey);
  }catch(e){}
}

/* whatever is added lands in the set the map is editing */
function addTarget(t){ TARGETS.push(Object.assign({set:LOCSET_ON},t)); saveTargets(); drawTargets();
  try{ drawApSettings(); drawApPlan(); }catch(e){} }
function removeTarget(i){ TARGETS.splice(i,1); saveTargets(); drawTargets(); }

const TGT_KIND={ geo:["CITY","k-city"], pin:["PINCODE","k-pin"], radius:["RADIUS","k-rad"] };
/* ═══ which campaign gets which places ═══
   This used to appear only once there were two sets AND a structure had
   been built, inside the Google deploy card. So the answer to "how do I
   give campaigns different places" was a control nobody could find. It is
   its own panel now and it is always drawn: with one set it says so and
   offers to add another; with no structure yet it lists the campaigns the
   brief will produce rather than nothing at all. */
function drawCampaignSets(){
  const box=$("#cmpSetList"), st=$("#cmpSetStat");
  if(!box)return;

  /* names from the built plan when there is one, from the brief when not */
  let names=[], built=true;
  try{
    const pl=apPlan();
    names=(pl&&pl.campaigns||[]).map(c=>c.name);
  }catch(e){}
  if(!names.length){
    built=false;
    try{ names=(PLAN||[]).map(p=>p.campaign).filter(Boolean); }catch(e){}
  }

  /* Meta sits in this list too. It is one more thing that gets a set, and
     putting it anywhere else would have meant two controls for one idea. */
  names=names.concat([META_SET]);

  if(st)st.textContent=LOCSETS.length===1
    ? "one set, every campaign and Meta"
    : `${LOCSETS.length} sets · ${names.length-1} campaign${names.length-1===1?"":"s"} + Meta`;

  /* With one set there was nothing to choose, so this showed a sentence
     and a button instead of the control — which read as the control
     being missing. The dropdowns are always drawn now; with one set
     every row simply shows it, and the button to add a second sits
     above them. */
  const addBtn=LOCSETS.length===1
    ? `<div class="f-note" style="margin-bottom:10px">One set so far, so every campaign is on it.
         <button class="btn btn-sm" id="cmpSetAdd" style="margin-left:6px">
           + Add a second set</button></div>`
    : "";
  box.innerHTML=addBtn+
    names.map(n=>{
      const cr=locCriteria(locSetFor(n));
      const where=cr.locationIds.length||cr.proximity.length
        ? `${cr.locationIds.length?cr.locationIds.length+" place"+(cr.locationIds.length===1?"":"s"):""}${
            cr.locationIds.length&&cr.proximity.length?" · ":""}${
            cr.proximity.length?cr.proximity.length+" radius":""}`
        : "nothing targeted";
      return `<div class="cmpset${n===META_SET?" meta":""}">
        <div><div class="nm">${esc(n)}</div><div class="sub">${esc(where)}</div></div>
        <select class="hdr-sel" data-cset="${esc(n)}" style="max-width:100%">${
          LOCSETS.map(s2=>`<option value="${esc(s2.id)}"${
            s2.id===locSetFor(n)?" selected":""}>${esc(s2.name)}</option>`).join("")}</select>
      </div>`;
    }).join("");
}
on("#cmpSetList","change",e=>{
  const sel=e.target&&e.target.closest("select[data-cset]"); if(!sel)return;
  LOCPICK[sel.dataset.cset]=sel.value; saveLocPick();
  drawCampaignSets();
  try{ drawApPlan(); }catch(e2){}
});
on("#cmpSetList","click",e=>{
  if(e.target&&e.target.id==="cmpSetAdd"){ const b=$("#locAdd"); if(b)b.click(); }
});

/* ═══ the set strip, and which set the map is editing ═══ */
function drawLocSets(){
  const box=$("#locChips");
  if(box)box.innerHTML=LOCSETS.map(s=>{
    const n=locTargets(s.id).length;
    return `<button class="setchip" data-set="${esc(s.id)}"
      aria-pressed="${s.id===LOCSET_ON}">${esc(s.name)}<b>${n}</b></button>`;
  }).join("");

  const mv=$("#tgtMove");
  if(mv)mv.innerHTML=`<option value="">Move selected to…</option>`+
    LOCSETS.filter(s=>s.id!==LOCSET_ON)
      .map(s=>`<option value="${esc(s.id)}">${esc(s.name)}</option>`).join("");

  const hint=$("#locHint");
  if(hint)hint.textContent=LOCSETS.length===1
    ? "One set, used by every campaign. Add another to give campaigns different places."
    : `Places you add go into “${locSetName(LOCSET_ON)}”. Each campaign picks a set on the Deploy card.`;
}
$$("#locChips").forEach(()=>{});
on("#locChips","click",e=>{
  const b=e.target.closest(".setchip"); if(!b)return;
  LOCSET_ON=b.dataset.set;
  drawLocSets(); drawTargets(); drawCampaignSets(); drawApSettings(); drawApPlan();
});
on("#locAdd","click",()=>{
  const name=(prompt("Name this set of places:","")||"").trim();
  if(!name)return;
  if(LOCSETS.some(s=>s.name.toLowerCase()===name.toLowerCase()))
    return toast("There is already a set with that name");
  const id=locNewId();
  LOCSETS.push({id,name}); saveLocSets(); LOCSET_ON=id;
  drawLocSets(); drawTargets(); drawCampaignSets(); drawApPlan();
  toast(`“${name}” added — places you add now go into it`);
});
on("#locRename","click",()=>{
  const cur=locSet(LOCSET_ON);
  const name=(prompt("Rename this set:",cur.name)||"").trim();
  if(!name||name===cur.name)return;
  cur.name=name; saveLocSets(); drawLocSets(); drawApPlan();
});
on("#locDrop","click",()=>{
  if(LOCSETS.length===1)return toast("There has to be one set");
  const cur=locSet(LOCSET_ON);
  const n=locTargets(cur.id).length;
  const used=Object.keys(LOCPICK).filter(k=>LOCPICK[k]===cur.id);
  if(!confirm(`Delete “${cur.name}”?`+
    (n?`\n\n${n} place${n===1?"":"s"} in it will be deleted too.`:"")+
    (used.length?`\n${used.length} campaign${used.length===1?"":"s"} using it will fall back to “${
      LOCSETS.find(s=>s.id!==cur.id).name}”.`:"")))return;
  TARGETS=TARGETS.filter(t=>locOf(t)!==cur.id);
  LOCSETS=LOCSETS.filter(s=>s.id!==cur.id);
  used.forEach(k=>{delete LOCPICK[k];});
  LOCSET_ON=LOCSETS[0].id;
  saveLocSets(); saveTargets(); saveLocPick();
  drawLocSets(); drawTargets(); drawCampaignSets(); drawApSettings(); drawApPlan();
  toast(`“${cur.name}” deleted`);
});
on("#tgtMove","change",()=>{
  const to=$("#tgtMove").value; if(!to)return;
  const moved=TARGETS.filter(t=>t.sel&&locOf(t)===LOCSET_ON);
  if(!moved.length){ $("#tgtMove").value=""; return toast("Tick some places first"); }
  moved.forEach(t=>{t.set=to;t.sel=false;});
  saveTargets(); $("#tgtMove").value="";
  drawLocSets(); drawTargets(); drawCampaignSets(); drawApSettings(); drawApPlan();
  toast(`${moved.length} moved to “${locSetName(to)}”`);
});

function drawTargets(){
  const st=$("#mapStat");
  /* The list shows the set being edited. Everything still lives in one
     TARGETS array, so the row keeps its REAL index — the remove and radius
     controls address that array, and renumbering them to the filtered view
     would delete the wrong place. */
  const many=LOCSETS.length>1;
  const n=k=>TARGETS.filter(t=>t.kind===k).length;
  const miss=TARGETS.filter(t=>t.kind!=="radius"&&!t.id).length;
  const bits=[];
  if(n("geo"))bits.push(`${n("geo")} cit${n("geo")===1?"y":"ies"}`);
  if(n("pin"))bits.push(`${n("pin")} pincode${n("pin")===1?"":"s"}`);
  if(n("radius"))bits.push(`${n("radius")} radius`);
  if(st)st.innerHTML=TARGETS.length
    ? `<span class="pill ${miss?"p-warn":"p-ok"}">${bits.join(" \u00b7 ")}${
        miss?` \u00b7 ${miss} without an ID`:""}</span>`
    : `<span class="pill p-mute">nothing targeted yet</span>`;
  const box=$("#tgtList");
  const shown=TARGETS.map((t,i)=>({t,i})).filter(x=>!many||locOf(x.t)===LOCSET_ON);
  if(box)box.innerHTML=shown.length?shown.map(({t,i})=>{
    const K=TGT_KIND[t.kind]||TGT_KIND.pin;
    return `<div class="tgt-row">
      <input type="checkbox" data-sel="${i}"${t.sel?" checked":""}>
      <span class="tgt-kind ${K[1]}">${K[0]}</span>
      <span class="nm">${esc(t.kind==="radius"
        ? `${Number(t.lat).toFixed(4)}, ${Number(t.lng).toFixed(4)}` : (t.label||""))}</span>
      ${t.kind==="radius"
        ? `<input class="rad" type="number" min="1" max="80" value="${t.radius}" data-r="${i}">
           <span class="cid">${t.units==="MILES"?"mi":"km"}</span>`
        : `<span class="cid${t.id?"":" miss"}">${t.id?"ID "+esc(t.id):"no ID \u2014 not targetable"}</span>`}
      ${many?`<span class="setname">${esc(locSetName(locOf(t)))}</span>`:""}
      <button class="x" data-x="${i}" title="Remove">\u2715</button>
    </div>`;}).join("")
    :`<div class="empty">${many
        ? `Nothing in \u201c${esc(locSetName(LOCSET_ON))}\u201d yet. Search a city, paste pincodes, or click the map.`
        : "Nothing targeted. Search a city, paste pincodes, or click the map."}</div>`;
  drawLocSets();
  if(!MAPX.ready()||(!MAP&&!GMAP))return;
  MAPX.clear();
  const pts=[];
  TARGETS.forEach((t,i)=>{
    if(t.kind==="radius"){
      MAPX.circle(t.lat,t.lng,t.units==="MILES"?t.radius*1609.34:t.radius*1000);
      /* The circle could only be changed from the row underneath the map,
         and could only be removed from there too — "the radius pin needs
         an option to cancel the location, increase or decrease the
         distance". It is on the pin now: click it. */
      MAPX.marker(t.lat,t.lng,{colour:"#FB6A02",popup:pinPopupHtml(t,i),
        drag:(la,ln)=>{ TARGETS[i].lat=la; TARGETS[i].lng=ln; saveTargets(); drawTargets(); }});
      pts.push([t.lat,t.lng]);
    }else if(t.lat&&t.lng){
      MAPX.marker(t.lat,t.lng,{colour:t.kind==="geo"?"#14213D":"#2E86C1",
        tip:`${TGT_KIND[t.kind][0]} · ${t.label||""}`});
      pts.push([t.lat,t.lng]);
    }
  });
  MAPX.fit(pts);
}
/* Built here rather than inline so it can be read without a map: the
   map needs Leaflet off a CDN, and what matters about this is the
   arithmetic underneath it. */
function pinPopupHtml(t,i){
  const u=t.units==="MILES"?"mi":"km";
  return `<div class="pinpop">
    <div class="t">${esc(t.label||"Radius")}</div>
    <div class="r"><button data-pin="-" data-i="${i}">\u2212</button>
      <b>${t.radius} ${u}</b>
      <button data-pin="+" data-i="${i}">+</button></div>
    <div class="q"><button data-pin="5" data-i="${i}">5</button>
      <button data-pin="10" data-i="${i}">10</button>
      <button data-pin="15" data-i="${i}">15</button>
      <button data-pin="25" data-i="${i}">25</button></div>
    <button class="del" data-pin="x" data-i="${i}">Remove this circle</button>
  </div>`;
}
/* the popup is built by Leaflet, so the handler lives on the map itself */
on("#mapWrap","click",e=>{
  const b=e.target&&e.target.closest("[data-pin]"); if(!b)return;
  e.preventDefault();
  const i=+b.dataset.i, t=TARGETS[i];
  if(!t||t.kind!=="radius")return;
  const what=b.dataset.pin;
  if(what==="x"){ removeTarget(i); drawApSettings(); drawApPlan();
    return toast("Circle removed"); }
  const step=t.radius>=20?5:t.radius>=10?2:1;
  if(what==="+")t.radius=Math.min(80,t.radius+step);
  else if(what==="-")t.radius=Math.max(1,t.radius-step);
  else t.radius=Number(what)||t.radius;
  saveTargets(); drawTargets(); drawApSettings(); drawApPlan();
});
on("#tgtList","click",e=>{
  const x=e.target.closest("[data-x]"); if(x){ removeTarget(+x.dataset.x); drawApSettings(); drawApPlan(); }
  const s=e.target.closest("[data-sel]");
  if(s){ TARGETS[+s.dataset.sel].sel=s.checked; saveTargets(); }
});
on("#tgtAll","click",()=>{
  const none=TARGETS.every(t=>t.sel);
  TARGETS.forEach(t=>t.sel=!none); saveTargets(); drawTargets();
});
on("#tgtDelSel","click",()=>{
  const n=TARGETS.filter(t=>t.sel).length;
  if(!n)return toast("Tick the ones to remove first");
  TARGETS=TARGETS.filter(t=>!t.sel); saveTargets(); drawTargets();
  drawApSettings(); drawApPlan();
  toast(`${n} target${n===1?"":"s"} removed`);
});
on("#radAll","click",()=>{
  const v=Math.max(1,Math.min(80,Number($("#radKm").value)||5));
  const u=$("#radUnit").value||"KILOMETERS";
  const n=TARGETS.filter(t=>t.kind==="radius").length;
  if(!n)return toast("No circles on the map yet");
  TARGETS.forEach(t=>{ if(t.kind!=="radius")return;
    t.radius=v; t.units=u; t.label=`Radius ${v} ${u==="MILES"?"mi":"km"}`; });
  saveTargets(); drawTargets(); drawApSettings(); drawApPlan();
  toast(`${n} circle${n===1?"":"s"} set to ${v} ${u==="MILES"?"mi":"km"}`);
});
$$(".locbar-b").forEach(b=>b.addEventListener("click",()=>{
  $$(".locbar-b").forEach(x=>x.classList.toggle("on",x===b));
  $$(".locpane").forEach(p=>p.classList.toggle("on",p.dataset.pane===b.dataset.loc));
  MAPX.resize();
}));
on("#tgtList","change",e=>{
  const r=e.target.closest("[data-r]"); if(!r)return;
  const i=+r.dataset.r, v=Math.max(1,Math.min(80,Number(r.value)||5));
  TARGETS[i].radius=v;
  TARGETS[i].label=`Radius ${v} ${TARGETS[i].units==="MILES"?"mi":"km"}`;
  saveTargets(); drawTargets();
});
/* Nominatim geocodes a pincode, one a second as their policy asks. */
async function geocodePin(pin,country){
  const u=`https://nominatim.openstreetmap.org/search?postalcode=${encodeURIComponent(pin)}`+
          `&country=${encodeURIComponent(country||"India")}&format=json&limit=1`;
  try{
    const r=await fetch(u,{headers:{"Accept":"application/json"}});
    const j=await r.json();
    if(j&&j[0])return {lat:Number(j[0].lat),lng:Number(j[0].lon),name:j[0].display_name||pin};
  }catch(e){}
  return null;
}
/* the free-text version, for a city or locality name */
async function geocodePlace(q){
  try{
    const r=await fetch(`https://nominatim.openstreetmap.org/search?q=${
      encodeURIComponent(q)}&format=json&limit=1`);
    const j=await r.json();
    if(j&&j[0])return {lat:Number(j[0].lat),lng:Number(j[0].lon)};
  }catch(e){}
  return null;
}
/* A pincode is only targetable once Google has given it a criterion ID, so
   this is offered on its own as well as after an add — the first attempt
   needs the customer ID to be filled in, and often it is not yet. */
async function pinLookupIds(){
  const cid=$("#apCid")?$("#apCid").value.replace(/[^0-9]/g,""):"";
  const todo=TARGETS.filter(t=>t.kind==="pin"&&!t.id);
  if(!todo.length)return {found:0,left:0};
  if(!cid){ toast("Put the customer ID in first — the lookup runs through the account"); return null; }
  let found=0;
  for(let i=0;i<todo.length;i+=10){
    const chunk=todo.slice(i,i+10);
    const r=await adsCall("ads-geo",{names:chunk.map(t=>t.pin),countryCode:"IN"});
    if(r&&r.suggestions)r.suggestions.forEach(sg=>{
      const t=TARGETS.find(x=>x.kind==="pin"&&!x.id&&String(sg.name||"").indexOf(x.pin)>-1);
      if(t){ t.id=String(sg.id||""); if(t.id)found++; }
    });
  }
  saveTargets(); drawTargets(); drawApSettings(); drawApPlan();
  return {found,left:TARGETS.filter(t=>t.kind==="pin"&&!t.id).length};
}
on("#pinRetry","click",async()=>{
  const r=await pinLookupIds();
  if(!r)return;
  if(!r.found&&!r.left)return toast("Every pincode already has its ID");
  toast(`${r.found} ID${r.found===1?"":"s"} found${r.left?`, ${r.left} still missing`:""}`);
});
on("#pinAdd","click",async()=>{
  const raw=($("#pinList")&&$("#pinList").value)||"";
  const pins=[...new Set(raw.split(/[\s,;]+/).map(x=>x.trim()).filter(x=>/^\d{4,8}$/.test(x)))];
  if(!pins.length)return toast("Put some pincodes in first");
  const have=new Set(TARGETS.filter(t=>t.kind==="pin").map(t=>t.pin));
  const todo=pins.filter(p2=>!have.has(p2));
  if(!todo.length)return toast("Those pincodes are already on the map");
  const st=$("#mapStat");
  let done=0, missed=[];
  for(const pin of todo){
    if(st)st.innerHTML=`<span class="pill p-mute">locating ${pin}\u2026 ${done}/${todo.length}</span>`;
    const g=await geocodePin(pin,($("#acCity")&&$("#acCity").value)?"India":"India");
    if(g){ TARGETS.push({kind:"pin",pin,lat:g.lat,lng:g.lng,set:LOCSET_ON,
      label:`${pin} \u2014 ${String(g.name).split(",").slice(0,2).join(",")}`,id:""}); done++; }
    else missed.push(pin);
    await new Promise(r=>setTimeout(r,1100));   /* Nominatim asks for one a second */
  }
  saveTargets(); drawTargets();
  /* a pincode needs its criterion ID to be targetable, and that comes from Google */
  const ids=done?await pinLookupIds():null;
  drawApSettings(); drawApPlan();
  toast(`${done} pincode${done===1?"":"s"} added${missed.length?`, ${missed.length} not found`:""}${
    ids&&ids.left?`, ${ids.left} without an ID`:""}`);
});
on("#mapClear","click",()=>{
  if(TARGETS.length&&!confirm("Remove every city, pincode and radius target?"))return;
  TARGETS=[]; saveTargets(); drawTargets(); drawApSettings(); drawApPlan();
});
on("#mapCentre","click",async()=>{
  if(!MAP&&!GMAP)return;
  const where=[($("#acMicro")&&$("#acMicro").value)||"",($("#acCity")&&$("#acCity").value)||""]
    .filter(Boolean).join(", ");
  if(!where)return toast("Fill in the micro-market or city on tab 03 first");
  try{
    const r=await fetch(`https://nominatim.openstreetmap.org/search?q=${
      encodeURIComponent(where+", India")}&format=json&limit=1`);
    const j=await r.json();
    if(j&&j[0]){ MAPX.centre(Number(j[0].lat),Number(j[0].lon),12); toast(`Centred on ${where}`); }
    else toast("Could not find that place");
  }catch(e){ toast("Could not reach the map service"); }
});
/* Leaflet measures the container, and a hidden panel has no size, so the map
   is built and re-measured when its tab comes on screen. */
(function(){
  const bar=document.querySelector(".tabs");
  if(bar)bar.addEventListener("click",()=>setTimeout(()=>{
    mapInit(); MAPX.resize(); mapsKeyFetch(); },180));
})();
window.addEventListener("load",()=>setTimeout(()=>{ mapInit(); mapsKeyFetch(); },500));

