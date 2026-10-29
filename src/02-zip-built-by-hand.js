/* ═══════════ zip, built by hand ═══════════
   A static page has no zip library, so the archive is assembled from raw
   bytes: local header, data, central directory, end record. Stored, not
   deflated \u2014 CSVs are small and it keeps this to about forty lines. */
const CRC_TABLE=(()=>{const t=new Uint32Array(256);
  for(let i=0;i<256;i++){let c=i;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[i]=c>>>0;}
  return t;})();
function crc32(u8){let c=0xFFFFFFFF;for(let i=0;i<u8.length;i++)c=CRC_TABLE[(c^u8[i])&0xFF]^(c>>>8);
  return (c^0xFFFFFFFF)>>>0;}
function dosTime(d){return ((d.getHours()<<11)|(d.getMinutes()<<5)|(d.getSeconds()/2))&0xFFFF;}
function dosDate(d){return (((d.getFullYear()-1980)<<9)|((d.getMonth()+1)<<5)|d.getDate())&0xFFFF;}
function makeZip(entries){
  const enc=new TextEncoder(), now=new Date();
  const parts=[], central=[]; let offset=0;
  entries.forEach(([name,text])=>{
    /* Text gets the same byte-order mark the single-file download uses —
       without it the rupee sign arrives as â‚¹ and the character count is
       wrong. Binary (an image) is written through untouched: a BOM in front
       of a JPEG makes it unopenable. */
    const nameB=enc.encode(name);
    const data=(text instanceof Uint8Array)?text:enc.encode("\uFEFF"+text);
    const crc=crc32(data);
    const lh=new Uint8Array(30), v=new DataView(lh.buffer);
    v.setUint32(0,0x04034b50,true); v.setUint16(4,20,true); v.setUint16(6,0x0800,true);
    v.setUint16(8,0,true); v.setUint16(10,dosTime(now),true); v.setUint16(12,dosDate(now),true);
    v.setUint32(14,crc,true); v.setUint32(18,data.length,true); v.setUint32(22,data.length,true);
    v.setUint16(26,nameB.length,true); v.setUint16(28,0,true);
    parts.push(lh,nameB,data);
    const cd=new Uint8Array(46), c=new DataView(cd.buffer);
    c.setUint32(0,0x02014b50,true); c.setUint16(4,20,true); c.setUint16(6,20,true);
    c.setUint16(8,0x0800,true); c.setUint16(10,0,true);
    c.setUint16(12,dosTime(now),true); c.setUint16(14,dosDate(now),true);
    c.setUint32(16,crc,true); c.setUint32(20,data.length,true); c.setUint32(24,data.length,true);
    c.setUint16(28,nameB.length,true); c.setUint32(42,offset,true);
    central.push(cd,nameB);
    offset+=lh.length+nameB.length+data.length;
  });
  const cdSize=central.reduce((a,b)=>a+b.length,0);
  const end=new Uint8Array(22), e=new DataView(end.buffer);
  e.setUint32(0,0x06054b50,true);
  e.setUint16(8,entries.length,true); e.setUint16(10,entries.length,true);
  e.setUint32(12,cdSize,true); e.setUint32(16,offset,true);
  const all=[...parts,...central,end];
  const total=all.reduce((a,b)=>a+b.length,0);
  const out=new Uint8Array(total); let p=0;
  all.forEach(b=>{out.set(b,p);p+=b.length;});
  return out;
}
function dlZip(name,entries){
  const b=new Blob([makeZip(entries)],{type:"application/zip"});
  const a=document.createElement("a"); a.href=URL.createObjectURL(b); a.download=name;
  document.body.appendChild(a); a.click();
  setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},400);
}

function dl(name,text){
  /* an image goes out as its own bytes \u2014 the byte-order mark that makes the
     rupee sign survive in a CSV makes a JPEG unopenable */
  const bin=text instanceof Uint8Array;
  const b=bin?new Blob([text],{type:"image/jpeg"})
             :new Blob(["\uFEFF"+text],{type:"text/csv;charset=utf-8"});
  const a=document.createElement("a");
  a.href=URL.createObjectURL(b);a.download=name;document.body.appendChild(a);a.click();
  setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},400);}

/* ═══ state ═══ */
let CH="search", VT={...VT_DEFAULTS}, VARIANTS=[], PICK=0;
/* Declared with the rest of the state rather than beside the map, because
   the deploy panel reads it while drawing and the map block runs later. */
let TARGETS=store.get("pp_targets",[])||[];   /* {kind:'radius'|'pin',lat,lng,radius,units,label,id} */
const saveTargets=()=>store.set("pp_targets",TARGETS);

/* ═══════════ location sets ═══════════
   Google Ads targets location on the CAMPAIGN, never the ad group. So a
   project that wants Vadgaon in one campaign and Wakad in another needs
   two campaigns with different criteria — and one global list of places,
   which is what this was, cannot express that at all.

   A set is a named group of places. Every target belongs to one; every
   campaign points at one. A project that never opens this has a single
   set holding everything, and deploys exactly as it did before. */
const LOCSET_KEY="pp_locsets", LOCPICK_KEY="pp_locpick";
let LOCSETS=store.get(LOCSET_KEY,null);
if(!Array.isArray(LOCSETS)||!LOCSETS.length)
  LOCSETS=[{id:"all",name:"All campaigns"}];
const saveLocSets=()=>store.set(LOCSET_KEY,LOCSETS);
let LOCSET_ON=LOCSETS[0].id;           /* the set being edited on the map */

/* which campaign uses which set: {campaignName: setId} */
let LOCPICK=store.get(LOCPICK_KEY,{})||{};
const saveLocPick=()=>store.set(LOCPICK_KEY,LOCPICK);

const locSet=id=>LOCSETS.find(s=>s.id===id)||LOCSETS[0];
const locSetName=id=>(locSet(id)||{}).name||"";
/* a target written before sets existed has no set and belongs to the first */
const locOf=t=>(t&&t.set&&LOCSETS.some(s=>s.id===t.set))?t.set:LOCSETS[0].id;
const locTargets=id=>TARGETS.filter(t=>locOf(t)===id);
const locSetFor=campaign=>{
  const id=LOCPICK[campaign];
  return (id&&LOCSETS.some(s=>s.id===id))?id:LOCSETS[0].id;
};
function locNewId(){
  let n=2, id;
  do{ id="s"+(n++); }while(LOCSETS.some(s=>s.id===id));
  return id;
}
/* What one set contributes to a campaign, in the shape the API wants. */
function locCriteria(setId){
  const mine=locTargets(setId);
  return {
    locationIds:mine.filter(t=>t.kind!=="radius"&&t.id).map(t=>String(t.id)),
    proximity:mine.filter(t=>t.kind==="radius").map(t=>({
      lat:t.lat,lng:t.lng,radius:t.radius,units:t.units||"KILOMETERS"})),
    missing:mine.filter(t=>t.kind!=="radius"&&!t.id).length
  };
}
let STRATS=store.get("pp_strats2",null);
if(!STRATS){
  const legacy=store.get("pp_strats",null);
  STRATS = legacy
    ? {search:(legacy.search||[]).map(([n,s])=>[n,String(s).replace(/^[SsDd]-/,"")]),
       demandgen:(legacy.demandgen||[]).map(([n,s])=>[n,String(s).replace(/^[Dd]-/,"")])}
    : JSON.parse(JSON.stringify(DEFAULTS));
  store.set("pp_strats2",STRATS);
}
let DRAFT=null;

/* ═══ ticket size — 45L / 6.45CR / 50L-1.2CR ═══ */
let REGION="in";
const UNITS={in:[["L","Lakh"],["CR","Crore"]], ae:[["K","Thousand"],["M","Million"]]};
function num(v){const n=parseFloat(String(v).replace(/[^0-9.]/g,""));return isFinite(n)?parseFloat(n.toFixed(4)):null;}
/* "2.40CR" typed straight into the amount box is a unit, not noise. People
   write the unit they are thinking in and never touch the dropdown, so the
   typed suffix wins and the dropdown is moved to match it. */
function unitFrom(v){
  const t=String(v||"").toLowerCase().replace(/[^a-z]/g,"");
  if(!t)return "";
  if(t.charAt(0)==="c")return "CR";
  if(t.charAt(0)==="l")return "L";
  if(t.charAt(0)==="m")return "M";
  if(t.charAt(0)==="k"||t.slice(0,2)==="th")return "K";
  return "";
}
/* A suffix is only honoured if it belongs to the market in play — "2.4M"
   typed while India is selected is ignored rather than silently switching. */
function unitOf(inputSel,selectSel){
  const typed=unitFrom($(inputSel).value);
  const ok=UNITS[REGION].some(u=>u[0]===typed);
  if(ok&&$(selectSel).value!==typed)$(selectSel).value=typed;
  return ok?typed:$(selectSel).value;
}
const trim=n=>String(parseFloat(Number(n).toFixed(2)));
function fillUnits(){
  const list=UNITS[REGION];
  [["#tkAU",0],["#tkBU",1]].forEach(([sel,def])=>{
    const el=$(sel), keep=el.value;
    el.innerHTML=list.map(([v,n])=>`<option value="${v}">${n}</option>`).join("");
    el.value=list.some(u=>u[0]===keep)?keep:list[def][0];
  });
  $("#tkCur").textContent=REGION==="in"?"INR":"AED";
  $("#fxWrap").classList.toggle("hidden",REGION==="in");
}
function aedToRupees(a,unit){
  const fx=num($("#fxRate").value)||26;
  return a*(unit==="M"?1e6:1e3)*fx;
}
/* The tracking value is always expressed in Lakhs, whatever the input.
   2.40 Cr becomes 240L, 90 Lakh stays 90L, AED 859K converts and becomes
   223L. Keeps every ad group name comparable across markets. */
const inrLabel=r=>{
  const lakhs=r/1e5;
  return (lakhs>=10?Math.round(lakhs):parseFloat(lakhs.toFixed(2)))+"L";
};
function ticket(){
  const a=num($("#tkA").value), b=num($("#tkB").value);
  if(a===null) return "";
  const uA=unitOf("#tkA","#tkAU"), uB=unitOf("#tkB","#tkBU");
  if(REGION==="in"){
    const toR=(v,u)=>v*(u==="CR"?1e7:1e5);
    const one=inrLabel(toR(a,uA));
    return b===null?one:one+"-"+inrLabel(toR(b,uB));
  }
  const one=inrLabel(aedToRupees(a,uA));
  return b===null?one:one+"-"+inrLabel(aedToRupees(b,uB));
}
function aedLabel(){
  const a=num($("#tkA").value), b=num($("#tkB").value);
  if(a===null)return "";
  const one=`AED ${trim(a)}${unitOf("#tkA","#tkAU")}`;
  return b===null?one:one+` – ${trim(b)}${unitOf("#tkB","#tkBU")}`;
}
function syncTicket(){
  $("#tkOut").textContent=ticket()||"ticketsize";
  $("#tkConv").innerHTML = REGION==="ae"&&ticket()
    ? ` &middot; ad copy reads <b>${esc(aedLabel())}</b>` : "";
  build();
}
on("#segRegion","click",e=>{
  const b=e.target.closest("button[data-rg]"); if(!b)return;
  REGION=b.dataset.rg;
  $$("#segRegion button").forEach(x=>x.setAttribute("aria-pressed",String(x===b)));
  fillUnits(); syncTicket();});
on("#fxRate","input",syncTicket);
["tkA","tkB","tkAU","tkBU"].forEach(id=>{
  $("#"+id).addEventListener("input",syncTicket); $("#"+id).addEventListener("change",syncTicket);});

