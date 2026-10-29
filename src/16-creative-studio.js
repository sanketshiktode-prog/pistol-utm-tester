/* ═══════════ 08 creative studio ═══════════
   The hero render belongs to the developer, so it is uploaded. Everything
   over it is drawn here on a canvas: one layout, four aspect ratios, each
   laid out for its own shape rather than scaled from a single master. */
const CR_SIZES=[
  ["square",   1200,1200,"1:1"],
  ["portrait",  960,1200,"4:5"],
  ["landscape",1200, 628,"1.91:1"],
  ["story",    1080,1920,"9:16"]
];
let CR={hero:null,logo:null,qr:null};   /* HTMLImageElement per slot */
let CR_OUT=[];                          /* [{name,w,h,ratio,url,bytes}] \u2014 bytes is the SIZE */
/* the actual JPEG bytes out of the data URL the canvas produced; o.bytes is
   only the size, and writing that into a file gives a six-byte "image" */
function crBytes(o){
  const b64=String(o&&o.url||"").split(",")[1]||"";
  return b64?Uint8Array.from(atob(b64),ch=>ch.charCodeAt(0)):null;
}

function crLoad(file){
  return new Promise((res,rej)=>{
    const fr=new FileReader();
    fr.onerror=()=>rej(new Error("Could not read that file"));
    fr.onload=()=>{ const im=new Image();
      im.onload=()=>res(im);
      im.onerror=()=>rej(new Error("That file is not an image the browser can open"));
      im.src=fr.result; };
    fr.readAsDataURL(file);
  });
}
/* \u2500\u2500 the heroes \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
   A project is shot more than once \u2014 elevation, interior, amenities \u2014 and
   each of those is a different ad, not a different project. They are all
   loaded here, adapted to the four sizes each, and each becomes its own ad. */
let HEROES=[];
const heroName=f=>String(f.name||"Hero").replace(/\.[a-z0-9]+$/i,"")
  .replace(/[_-]+/g," ").replace(/\s+/g," ").trim().slice(0,40)||"Hero";
function drawHeroes(){
  const box=$("#heroList"); if(!box)return;
  box.innerHTML=HEROES.length?HEROES.map((h,i)=>`
    <div class="tgt-row">
      <img src="${h.img.src}" alt="" style="width:34px;height:34px;object-fit:cover;border-radius:4px;flex:0 0 auto">
      <span class="tgt-kind k-city">AD ${i+1}</span>
      <input class="hero-nm" value="${esc(h.name)}" data-hn="${i}" spellcheck="false">
      <span class="cid${h.img.naturalWidth<1200?" miss":""}">${h.img.naturalWidth}\u00d7${h.img.naturalHeight}</span>
      <button class="x" data-hx="${i}" title="Remove">\u2715</button>
    </div>`).join(""):"";
  CR.hero=HEROES.length?HEROES[0].img:null;
  crStat();
}
on("#heroList","input",e=>{
  const n=e.target.closest("[data-hn]"); if(!n)return;
  HEROES[+n.dataset.hn].name=n.value.trim()||`Hero ${+n.dataset.hn+1}`;
});
on("#heroList","click",e=>{
  const x=e.target.closest("[data-hx]"); if(!x)return;
  HEROES.splice(+x.dataset.hx,1); drawHeroes();
  if(!HEROES.length){ CR_OUT=[]; CR_SETS=[]; drawSets();
    $("#crOut").innerHTML=`<div class="empty">Upload at least one hero image, then render.</div>`; }
});
(function(){
  const el=$("#crHero"); if(!el)return;
  const take=async files=>{
    const list=files&&files.length?[...files]:(files?[files]:[]);
    if(!list.length)return;
    let bad=0;
    for(const f of list){
      try{
        const img=await crLoad(f);
        const nm=heroName(f);
        /* the same file dropped twice is one ad, not two */
        if(HEROES.some(h=>h.name.toLowerCase()===nm.toLowerCase()&&h.img.src===img.src))continue;
        HEROES.push({name:HEROES.some(h=>h.name.toLowerCase()===nm.toLowerCase())
          ?`${nm} ${HEROES.length+1}`:nm, img});
      }catch(err){ bad++; }
    }
    el.value=""; drawHeroes();
    dropFilled("dropHero",
      `${HEROES.length} hero${HEROES.length===1?"":"es"}`,
      HEROES.map(h=>h.name).join(" \u00b7 ").slice(0,90),
      HEROES.length?HEROES[0].img.src:"");
    toast(bad?`${HEROES.length} loaded, ${bad} could not be read`
             :`${HEROES.length} hero${HEROES.length===1?"":"es"} loaded \u2014 press Render`);
  };
  el.addEventListener("change",e=>take(e.target.files));
  dropWire("dropHero",take);
})();
["logo","qr"].forEach(k=>{
  const cap=k.charAt(0).toUpperCase()+k.slice(1);
  const el=$("#cr"+cap);
  if(!el)return;
  const take=async f=>{
    if(f&&f.length!==undefined)f=f[0];
    if(!f)return;
    try{
      CR[k]=await crLoad(f); crStat();
      dropFilled("drop"+cap,f.name,
        CR[k].naturalWidth+"\u00d7"+CR[k].naturalHeight+" \u00b7 "+kbSize(f.size),CR[k].src);
    }catch(err){ el.value=""; toast(String(err.message||err)); }
  };
  el.addEventListener("change",e=>take(e.target.files&&e.target.files[0]));
  dropWire("drop"+cap,take);
});
function crStat(){
  const el=$("#crStat"); if(!el)return;
  el.innerHTML=CR.hero
    ? `<span class="pill p-ok">${CR.hero.naturalWidth}×${CR.hero.naturalHeight}</span>`
    : `<span class="pill p-mute">no hero image</span>`;
}
on("#crClearImgs","click",()=>{
  CR={hero:null,logo:null,qr:null};
  ["crHero","crLogo","crQr"].forEach(i2=>{const e=$("#"+i2); if(e)e.value="";});
  [["dropHero","Choose the project render","or drop it here \u2014 1920px wide or more"],
   ["dropLogo","Choose a logo","PNG, transparent"],
   ["dropQr","Choose a QR","PNG or JPG"]].forEach(a=>dropReset(a[0],a[1],a[2]));
  CR_OUT=[]; crStat(); $("#crOut").innerHTML=`<div class="empty">Upload a hero image, then render.</div>`;
});

/* the fields come from the brief, so nothing is typed twice */
function crFill(){
  const b=brief();
  const put=(id,v)=>{ const e=$("#"+id); if(e&&!e.value.trim())e.value=v; };
  put("crDev",b.dev); put("crProj",b.proj);
  put("crLoc",[b.micro,b.city].filter(Boolean).join(", ").toUpperCase());
  put("crCfg",b.cfg.toUpperCase());
  put("crPrice",(b.price||"").toUpperCase());
  put("crOffer",b.offer?b.offer.toUpperCase():"");
}
on("#crFromBrief","click",()=>{
  ["crDev","crProj","crLoc","crCfg","crPrice","crOffer"].forEach(i=>{const e=$("#"+i); if(e)e.value="";});
  crFill(); toast("Refilled from the brief");
});

/* ── drawing helpers ───────────────────────────────────────────────────── */
const crF=(w,px)=>`${Math.round(px)}px Archivo, Inter, system-ui, sans-serif`;
/* ═══════════ creative renderer ═══════════
   Rebuilt against the reference sets. The house layout is a system, not a
   stack of centred text:

     · a thin gold frame inset 8.2% of the width, with notched corners, the
       lockup sitting above it and the disclaimer below it
     · developer logo | hairline divider | project in large caps, with the
       micro-market under it in letterspaced small caps between two short rules
     · the RERA block top right: label, number, portal, QR
     · the offer as a chamfered black plaque straddling the frame's top edge
     · the price as a TWO CELL bar — "PREMIUM" over the configuration on the
       left, the numeral large on the right with its unit stacked beside it
     · a tall canvas places the render as a band over a gradient sampled from
       the render itself, rather than cover-cropping it to the full height

   Measured off the 1200×1200 reference: frame at x 0.082–0.917, y 0.179–0.930. */

const GOLD="#C9A24B", GOLD_HI="#E8CC8A", PLAQUE="#0D0D0F";
const val=id=>(($("#"+id)&&$("#"+id).value)||"").trim();

function crFit(g,text,font,maxW){
  /* the size is the px value, not the first number in the string \u2014 a font
     written weight-first ("700 62px Archivo") made this read 700 */
  const m=/(\d+(?:\.\d+)?)px/.exec(font);
  let size=m?Math.round(parseFloat(m[1])):32;
  g.font=font;
  while(size>8&&g.measureText(text).width>maxW){
    size-=1; g.font=font.replace(/\d+px/,size+"px");
  }
  return size;
}
function crCover(g,im,W,H,dx,dy,dw,dh){
  const r=Math.max(dw/im.naturalWidth,dh/im.naturalHeight);
  const w=im.naturalWidth*r, h=im.naturalHeight*r;
  g.drawImage(im,dx+(dw-w)/2,dy+(dh-h)/2,w,h);
}
/* letterspaced caps — canvas has no letter-spacing, so it is drawn by hand */
function crTrack(g,text,x,y,track,align){
  const chars=[...String(text||"")];
  const total=chars.reduce((a,c)=>a+g.measureText(c).width,0)+track*(chars.length-1);
  let cx = align==="center" ? x-total/2 : align==="right" ? x-total : x;
  chars.forEach(c=>{ g.fillText(c,cx,y); cx+=g.measureText(c).width+track; });
  return total;
}
/* a rectangle with its corners cut off, as on every plaque in the samples */
function crChamfer(g,x,y,w,h,c){
  g.beginPath();
  g.moveTo(x+c,y); g.lineTo(x+w-c,y); g.lineTo(x+w,y+c);
  g.lineTo(x+w,y+h-c); g.lineTo(x+w-c,y+h); g.lineTo(x+c,y+h);
  g.lineTo(x,y+h-c); g.lineTo(x,y+c); g.closePath();
}
/* the frame: a hairline rectangle broken at the corners by short brackets */
function crFrame(g,x,y,w,h,S,accent){
  const n=Math.round(26*S);
  g.save(); g.strokeStyle=accent; g.lineWidth=Math.max(2,Math.round(2.6*S));
  g.globalAlpha=1;
  g.shadowColor="rgba(0,0,0,.55)"; g.shadowBlur=Math.round(6*S);
  [[x+n,y,x+w-n,y],[x+w,y+n,x+w,y+h-n],
   [x+w-n,y+h,x+n,y+h],[x,y+h-n,x,y+n]].forEach(([a,b,c,d])=>{
    g.beginPath(); g.moveTo(a,b); g.lineTo(c,d); g.stroke();
  });
  /* the corner brackets themselves */
  const k=Math.round(16*S);
  [[x,y+n,x,y+n-k,x+n-k,y,x+n,y],
   [x+w,y+n,x+w,y+n-k,x+w-n+k,y,x+w-n,y],
   [x,y+h-n,x,y+h-n+k,x+n-k,y+h,x+n,y+h],
   [x+w,y+h-n,x+w,y+h-n+k,x+w-n+k,y+h,x+w-n,y+h]].forEach(p=>{
    g.beginPath(); g.moveTo(p[0],p[1]); g.lineTo(p[2],p[3]); g.lineTo(p[4],p[5]); g.stroke();
  });
  g.restore();
}
/* the offer plaque: black, gold hairline, chamfered, centred on a given line */
function crPlaque(g,cx,cy,text,S,accent){
  if(!text)return 0;
  const fs=Math.round(38*S);
  g.font=F_H(700,fs);
  const size=crFit(g,text,g.font,g.canvas.width*0.70);
  g.font=F_H(700,size);
  const tw=g.measureText(text).width;
  const padX=Math.round(34*S), h=Math.round(size*1.85), w=tw+padX*2;
  const x=cx-w/2, y=cy-h/2, c=Math.round(12*S);
  g.save();
  crChamfer(g,x,y,w,h,c); g.fillStyle=PLAQUE; g.globalAlpha=.94; g.fill();
  g.globalAlpha=1; g.strokeStyle=accent; g.lineWidth=Math.max(1,Math.round(1.4*S)); g.stroke();
  g.fillStyle="#FFFFFF"; g.textAlign="center"; g.textBaseline="middle";
  g.fillText(text,cx,cy+size*0.04);
  g.restore();
  return h;
}
/* the price bar: configuration on the left under a small PREMIUM label, the
   amount on the right with its unit stacked beside the numeral */
function crPriceBar(g,cx,topY,cfg,amount,unit,tail,S,accent){
  if(!cfg&&!amount)return 0;
  const h=Math.round(96*S), c=Math.round(14*S);
  const padX=Math.round(30*S), gap=Math.round(26*S);
  const cfgSize=Math.round(44*S), kickSize=Math.round(17*S);
  const numSize=Math.round(70*S), unitSize=Math.round(23*S), tailSize=Math.round(15*S);
  g.font=F_H(700,cfgSize);
  const cfgW=cfg?g.measureText(cfg).width:0;
  g.font=F_H(800,numSize);
  const numW=amount?g.measureText(amount).width:0;
  g.font=F_H(700,unitSize);
  const unitW=Math.max(unit?g.measureText(unit).width:0,
                       tail?g.measureText(tail).width*0.9:0);
  const rightW=amount?numW+(unitW?unitW+Math.round(8*S):0):0;
  const w=padX*2+cfgW+(cfgW&&rightW?gap*2:0)+rightW;
  const x=cx-w/2, y=topY;
  g.save();
  crChamfer(g,x,y,w,h,c); g.fillStyle=PLAQUE; g.globalAlpha=.94; g.fill();
  g.globalAlpha=1; g.strokeStyle=accent; g.lineWidth=Math.max(1,Math.round(1.4*S)); g.stroke();
  let cur=x+padX;
  if(cfgW){
    g.textAlign="left"; g.textBaseline="alphabetic";
    g.fillStyle=accent; g.font=`600 ${kickSize}px Inter, sans-serif`;
    crTrack(g,"PREMIUM",cur,y+h*0.33,Math.round(5*S),"left");
    g.fillStyle="#FFFFFF"; g.font=F_H(700,cfgSize);
    g.fillText(cfg,cur,y+h*0.78);
    cur+=cfgW+gap;
  }
  if(cfgW&&rightW){
    g.strokeStyle=accent; g.globalAlpha=.6; g.lineWidth=Math.max(1,Math.round(1.2*S));
    g.beginPath(); g.moveTo(cur,y+h*0.18); g.lineTo(cur,y+h*0.82); g.stroke();
    g.globalAlpha=1; cur+=gap;
  }
  if(rightW){
    g.textAlign="left"; g.textBaseline="alphabetic";
    g.fillStyle=accent||GOLD_HI; g.font=F_H(800,numSize);
    g.fillText(amount,cur,y+h*0.74);
    const ux=cur+numW+Math.round(8*S);
    if(unit){ g.fillStyle="#FFFFFF"; g.font=F_H(700,unitSize);
      g.fillText(unit,ux,y+h*0.52); }
    if(tail){ g.fillStyle="#D8D8D8"; g.font=`600 ${tailSize}px Inter, sans-serif`;
      crTrack(g,tail,ux,y+h*0.74,Math.round(2*S),"left"); }
  }
  g.restore();
  return h;
}
/* "₹89 LACS* ONWARDS" split into the parts the bar lays out separately */
function crMoneyParts(raw){
  const t=String(raw||"").trim();
  if(!t)return null;
  const m=/^([^\d]*[\d.,]+)\s*([A-Za-z]+\*?)?\s*(.*)$/.exec(t);
  if(!m)return {amount:t,unit:"",tail:""};
  return {amount:(m[1]||"").trim(), unit:(m[2]||"").trim().toUpperCase(),
          tail:(m[3]||"").trim().toUpperCase()};
}
/* average colour of a horizontal strip, used to build the backdrop a tall
   canvas needs: the render is a band on it, not something stretched to fill */
function crStrip(im,frac,top){
  const c=document.createElement("canvas"); c.width=32; c.height=8;
  const g=c.getContext("2d");
  const sh=Math.max(1,Math.round(im.naturalHeight*frac));
  g.drawImage(im,0,top?0:im.naturalHeight-sh,im.naturalWidth,sh,0,0,32,8);
  const d=g.getImageData(0,0,32,8).data;
  let r=0,gr=0,b=0;
  for(let i=0;i<d.length;i+=4){ r+=d[i]; gr+=d[i+1]; b+=d[i+2]; }
  const n=d.length/4;
  return [Math.round(r/n),Math.round(gr/n),Math.round(b/n)];
}
const crRgb=a=>`rgb(${a[0]},${a[1]},${a[2]})`;
const crDark=(a,k)=>`rgb(${Math.round(a[0]*k)},${Math.round(a[1]*k)},${Math.round(a[2]*k)})`;

