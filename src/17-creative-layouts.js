/* ═══════════ creative layouts ═══════════
   Six layout families, read off the reference sets. They share the same
   material — logo lockup, RERA block, location, configuration, price, offer,
   disclaimer — and differ in where that material sits and whether it sits on
   the render or on paper beside it.

   Type is sized from the references, not from what fits: on a 1200px canvas
   the configuration runs 52–62px and the price numeral 72–86px in every one
   of them. The earlier renderer set those at 44 and 70, which is why it read
   as a web card rather than a creative. */

/* Header stack first, because it is the house default \u2014 the picker takes
   the first entry when nothing has been chosen. */
/* id, name, note, whether the FOOT of the canvas is light (the disclaimer
   needs it) and whether the TOP is (the RERA mark needs it) */
const CR_LAYOUTS=[
  ["header","Header stack", "Copy above on light, arched render below \u2014 the default",false,true],
  ["frame", "Gold frame",   "Dark plaques on the render inside a hairline notched frame",false,false],
  ["card",  "White card",   "Render full bleed, scalloped white panel at the foot",false,false],
  ["footer","Light footer", "Render full bleed, light band carrying configuration and price",true,false],
  ["panel", "Centre panel", "Deco panel centred on the render",false,false],
  ["arch",  "Arch",         "Light ground, arched render, ornament rules",true,false],
  ["band",  "Dark band",    "Render full bleed, deep band at the foot with the price in accent",false,false],
  ["strip", "Feature strip","Three claims in a row above a light band \u2014 the deck's workhorse",true,false],
  ["split", "Split panel",  "Render one side, information panel the other",true,true]
];
var INK="#14213D", PAPER="#F6F4EF", RED="#E2231A";

/* ── palettes ─────────────────────────────────────────────────────────────
   Not invented. Each of these is one of the colour schemes the Creative
   Guidelines deck states in so many words, in the deck's own wording:
   "deep navy blue, royal blue, white, and gold/yellow accents", "deep forest
   green, black, muted olive, white, and champagne gold", and so on. They are
   written out as four working colours the renderer actually uses:
     ink    the dark — panels, bands, body type on light
     paper  the light — bands and panels on the render
     accent the metal — price, rules, frames
     pin    the marker colour; the deck keeps this red almost everywhere */
const CR_PALETTES=[
  ["navy-gold","Navy & Gold","Deep navy, royal blue, white, gold \u2014 the deck's most used",
    {ink:"#14213D",paper:"#F6F4EF",accent:"#D4AF61",pin:"#E2231A",
     price:"#D4AF61",badge:"#14213D",badgeText:"#FFFFFF"}],
  ["black-gold","Black & Gold","Black, charcoal, muted blue-grey, white, gold",
    {ink:"#121212",paper:"#F2F1EE",accent:"#C9A227",pin:"#E2231A",
     price:"#C9A227",badge:"#121212",badgeText:"#F5E6B8"}],
  ["white-gold","White & Gold","Warm white ground, charcoal type, gold accents",
    {ink:"#2A2A2A",paper:"#FFFFFF",accent:"#B9975B",pin:"#C0392B",
     price:"#B9975B",badge:"#B9975B",badgeText:"#1A1A1A"}],
  ["maroon-gold","Maroon & Gold","Deep maroon, charcoal, ivory, muted gold",
    {ink:"#4A1B22",paper:"#F8F2EC",accent:"#C19A5B",pin:"#E2231A",
     price:"#C19A5B",badge:"#4A1B22",badgeText:"#F6E8D5"}],
  ["navy-sky","Navy & Sky","Deep navy, sky blue, white, charcoal \u2014 daylight renders",
    {ink:"#102A43",paper:"#F4F8FB",accent:"#2E86C1",pin:"#E2231A",
     price:"#102A43",badge:"#102A43",badgeText:"#FFFFFF"}],
  ["forest","Forest & Champagne","Deep forest green, black, muted olive, white, champagne gold",
    {ink:"#17352A",paper:"#F3F1E7",accent:"#C7B178",pin:"#D23A2E",
     price:"#C7B178",badge:"#17352A",badgeText:"#F3F1E7"}],
  ["coastal","Coastal Teal","Turquoise, cyan, deep teal, white, minimal gold",
    {ink:"#0B3C49",paper:"#F2FAFB",accent:"#17A2B8",pin:"#E2231A",
     price:"#0B3C49",badge:"#0B3C49",badgeText:"#FFFFFF"}],
  ["river","River Blue","White, river blue, teal, dark navy, red pins",
    {ink:"#123A5C",paper:"#F5F9FC",accent:"#3E8EDE",pin:"#E2231A",
     price:"#123A5C",badge:"#123A5C",badgeText:"#FFFFFF"}],
  ["sunset","Sunset","Deep navy, sunset orange, charcoal, white, champagne gold",
    {ink:"#1B2238",paper:"#FBF4EC",accent:"#E07A28",pin:"#C0392B",
     price:"#E07A28",badge:"#1B2238",badgeText:"#FFFFFF"}],
  ["amber","Amber Night","Deep navy, black, warm amber, white, subtle gold",
    {ink:"#0E1424",paper:"#F7F3EA",accent:"#E0A42E",pin:"#E2231A",
     price:"#E0A42E",badge:"#0E1424",badgeText:"#FFFFFF"}],
  ["ivory","Ivory & Gold","Champagne beige, warm ivory, white, black, subtle gold",
    {ink:"#2A241C",paper:"#FAF6EE",accent:"#B9975B",pin:"#C0392B",
     price:"#B9975B",badge:"#2A241C",badgeText:"#FAF6EE"}]
];
/* the element each custom control drives, in the order the issue deck asked
   for them */
const CR_COLS=[
  ["crPaper","Background",       "paper"],
  ["crInk",  "Header & footer",  "ink"],
  ["crAccent","Borders & rules", "accent"],
  ["crPrice2","Pricing",         "price"],
  ["crBadge","Offer badge",      "badge"],
  ["crBadgeT","Offer badge text","badgeText"],
  ["crPin",  "Location pin",     "pin"]
];
function crPalette(){
  const id=(($("#crPalette")&&$("#crPalette").value)||"navy-gold");
  if(id==="custom"){
    const out={};
    CR_COLS.forEach(([el,,key])=>{ out[key]=val(el)||CR_PALETTES[0][3][key]; });
    return out;
  }
  const row=CR_PALETTES.find(p=>p[0]===id);
  return row?row[3]:CR_PALETTES[0][3];
}

/* Whether the uploaded logo already says the developer and the project. It
   nearly always does, so when a logo is up this defaults to yes and the typed
   names are kept for the ad copy rather than printed twice on the picture. */
function crLogoCarriesName(){
  const el=$("#crLogoName");
  return el?el.checked:!!CR.logo;
}
function crLogoPlate(){
  const el=$("#crLogoPlate");
  return el?el.checked:true;
}
/* ── the logo's own background ────────────────────────────────────────────
   Logos arrive as often as JPEGs as PNGs, and a JPEG cannot be transparent:
   it comes with a white box baked in, which then sits on the creative as a
   white box. The near-white border is knocked out here, flood-filled inward
   from the edges so a white building or a white letter inside the mark is
   left alone. Done once per upload and cached — it is a per-pixel pass. */
let CR_LOGO_CUT=null, CR_LOGO_SRC=null;
function crLogoImage(){
  if(!CR.logo)return null;
  if(!crLogoKnockout())return CR.logo;
  if(CR_LOGO_SRC===CR.logo.src&&CR_LOGO_CUT)return CR_LOGO_CUT;
  try{
    const im=CR.logo, w=im.naturalWidth, h=im.naturalHeight;
    const cv=document.createElement("canvas"); cv.width=w; cv.height=h;
    const g=cv.getContext("2d",{willReadFrequently:true});
    g.drawImage(im,0,0);
    const d=g.getImageData(0,0,w,h), p=d.data;
    const near=i=>p[i+3]>8&&p[i]>236&&p[i+1]>236&&p[i+2]>236;
    /* nothing to do if the corners are not white already */
    const corners=[0,(w-1)*4,(h-1)*w*4,((h-1)*w+(w-1))*4];
    if(!corners.every(near))return (CR_LOGO_SRC=im.src,CR_LOGO_CUT=im);
    const seen=new Uint8Array(w*h), stack=[];
    const push=(x,y)=>{ if(x<0||y<0||x>=w||y>=h)return;
      const k=y*w+x; if(seen[k])return; seen[k]=1;
      if(near(k*4))stack.push(k); };
    for(let x=0;x<w;x++){ push(x,0); push(x,h-1); }
    for(let y=0;y<h;y++){ push(0,y); push(w-1,y); }
    while(stack.length){
      const k=stack.pop(), x=k%w, y=(k/w)|0;
      p[k*4+3]=0;
      push(x+1,y); push(x-1,y); push(x,y+1); push(x,y-1);
    }
    g.putImageData(d,0,0);
    const out=new Image(); out.src=cv.toDataURL("image/png");
    CR_LOGO_SRC=im.src; CR_LOGO_CUT=out;
    /* the new Image decodes asynchronously; until it has, use the original */
    return out.complete?out:im;
  }catch(e){ return CR.logo; }
}
function crLogoKnockout(){
  const el=$("#crLogoCut");
  return el?el.checked:true;
}
function crLayoutId(){
  const el=$("#crLayout");
  return (el&&el.value)||"header";
}
function crCtx(W,H){
  /* Sizing off min(W,H) is right for a square or a tall canvas, where the
     width is the constraint. On 1.91:1 it halves every size while the canvas
     is still 1200 wide, which is why the landscape read as microscopic. */
  const S=(W/H>=1.7) ? (W/1200)*0.72 : Math.min(W,H)/1200;
  const loc=(val("crLoc")||"").toUpperCase();
  const P=crPalette();
  return {W,H,S, wide:W/H>=1.7, tall:H/W>=1.5,
    ink:P.ink, paper:P.paper, pin:P.pin,
    accent:P.accent, price:P.price||P.accent,
    badge:P.badge||P.ink, badgeText:P.badgeText||"#FFFFFF",
    feats:lines(val("crFeats")).slice(0,3).map(x=>x.toUpperCase()),
    scrim:(parseInt(val("crScrim"),10)||62)/100,
    dev:(val("crDev")||"").toUpperCase(),
    proj:(val("crProj")||"").toUpperCase(),
    loc, micro:((loc.split(",")[0])||"").trim(),
    cfg:(val("crCfg")||"").toUpperCase(),
    money:crMoneyParts(val("crPrice")),
    offer:(val("crOffer")||"").toUpperCase(),
    rera:val("crRera"), disc:val("crDisc")};
}
/* ── type ─────────────────────────────────────────────────────────────────
   The deck names four registers and uses them over and over: "bold sans-serif
   for project names, configurations and pricing", "condensed uppercase
   sans-serif for promotional headlines", "elegant serif for the emotional
   headline", "elegant lightweight uppercase for luxury descriptors", with
   "clean sans-serif" underneath all of them for supporting detail. These are
   those registers, as pairs: a display face and the body face beneath it.
   The script face is for a tagline only — the deck says "selectively" and
   "sparingly" every single time it mentions one. */
const CR_FONTS=[
  ["archivo","Archivo · Inter","Bold geometric sans — the house default",
   "Archivo","Inter","Archivo"],
  ["oswald","Oswald · Inter","Condensed uppercase — promotional headlines, payment plans",
   "Oswald","Inter","Oswald"],
  ["playfair","Playfair · Inter","Elegant serif — emotional headlines, launches",
   "Playfair Display","Inter","Playfair Display"],
  ["cormorant","Cormorant · Inter","Refined light serif — the quietest, most premium",
   "Cormorant Garamond","Inter","Cormorant Garamond"],
  ["marcellus","Marcellus · Inter","Lightweight uppercase — luxury descriptors",
   "Marcellus","Inter","Marcellus"],
  ["cinzel","Cinzel · Inter","Inscriptional caps — the most formal",
   "Cinzel","Inter","Cinzel"]
];
function crFontPair(){
  const id=($("#crFont")&&$("#crFont").value)||"archivo";
  return CR_FONTS.find(f=>f[0]===id)||CR_FONTS[0];
}
/* Canvas draws with whatever is loaded at the moment fillText runs. A webfont
   that has not finished loading is silently replaced by the fallback, so the
   render comes out in the wrong face with no error anywhere. Every weight the
   renderer asks for is loaded and awaited before a render starts. */
async function crFontsReady(){
  const [,,,disp,body]=crFontPair();
  if(!document.fonts||!document.fonts.load)return;
  const want=[];
  [300,400,500,600,700,800].forEach(w=>{
    want.push(`${w} 40px "${disp}"`);
    want.push(`${w} 40px "${body}"`);
  });
  try{
    await Promise.all(want.map(f=>document.fonts.load(f).catch(()=>{})));
    await document.fonts.ready;
  }catch(e){}
}
var CR_DISP="Archivo", CR_BODY="Inter";
const F_H=(w,s)=>`${w} ${Math.round(s)}px "${CR_DISP}", Archivo, Inter, sans-serif`;
const F_B=(w,s)=>`${w} ${Math.round(s)}px "${CR_BODY}", Inter, sans-serif`;

/* ── shapes ──────────────────────────────────────────────────────────────── */
function crArch(g,x,y,w,h,r){
  g.beginPath();
  g.moveTo(x,y+h); g.lineTo(x,y+r);
  g.quadraticCurveTo(x,y,x+Math.min(r,w/2),y);
  g.lineTo(x+w-Math.min(r,w/2),y);
  g.quadraticCurveTo(x+w,y,x+w,y+r);
  g.lineTo(x+w,y+h); g.closePath();
}
/* the scalloped top edge on the white panel */
function crScallopTop(g,x,y,w,h,r){
  const n=Math.max(4,Math.round(w/(r*2)));
  const step=w/n;
  g.beginPath(); g.moveTo(x,y+h); g.lineTo(x,y);
  for(let i=0;i<n;i++){
    const cx=x+step*(i+.5);
    g.arc(cx,y,step/2,Math.PI,0,false);
  }
  g.lineTo(x+w,y+h); g.closePath();
}
function crDiamond(g,cx,cy,r,fill){
  g.save(); g.fillStyle=fill; g.beginPath();
  g.moveTo(cx,cy-r); g.lineTo(cx+r*.62,cy); g.lineTo(cx,cy+r); g.lineTo(cx-r*.62,cy);
  g.closePath(); g.fill(); g.restore();
}
/* a rule broken in the middle by a small ornament, as on the light layouts */
function crOrnRule(g,cx,y,w,S,colour){
  g.save(); g.strokeStyle=colour; g.lineWidth=Math.max(1,1.2*S); g.globalAlpha=.75;
  const gap=18*S;
  g.beginPath(); g.moveTo(cx-w/2,y); g.lineTo(cx-gap,y); g.stroke();
  g.beginPath(); g.moveTo(cx+gap,y); g.lineTo(cx+w/2,y); g.stroke();
  g.restore();
  crDiamond(g,cx,y,7*S,colour);
}
function crPin(g,x,baseY,size,colour){
  const r=size*.34, cx=x+r, cy=baseY-size*.40;
  g.save(); g.fillStyle=colour;
  g.beginPath(); g.arc(cx,cy,r,Math.PI,0); g.lineTo(cx,cy+r*1.85); g.closePath(); g.fill();
  g.fillStyle="rgba(255,255,255,.92)";
  g.beginPath(); g.arc(cx,cy,r*.38,0,Math.PI*2); g.fill();
  g.restore();
  return r*2.25;
}

/* ── blocks ──────────────────────────────────────────────────────────────── */
/* the location set against the right edge. It is drawn first and reports its
   width, so the lockup on the left can be given only the room that is left \u2014
   otherwise a long project name runs straight into a long location. */
function crTopRightLoc(g,c,rightX,baseY,size,pinColour,maxW){
  if(!c.loc)return 0;
  g.font=F_H(700,size);
  const s2=crFit(g,c.loc,g.font,maxW); g.font=F_H(700,s2);
  const tw=g.measureText(c.loc).width, pw=s2*.80;
  const x0=rightX-tw-pw;
  crPin(g,x0,baseY+s2*.34,s2,pinColour);
  g.fillStyle="#FFFFFF"; g.textAlign="left"; g.textBaseline="alphabetic";
  g.fillText(c.loc,x0+pw,baseY+s2*.34);
  return tw+pw;
}
/* ── the logo ─────────────────────────────────────────────────────────────
   A developer lockup is usually very wide and short — two marks side by side.
   Sizing it by height alone and trusting the width worked for a square mark
   and tore a lockup apart: at 98px tall a 1400×150 lockup wants 1140px of a
   1200px canvas, so it ran under the RERA mark and off the edge. It is fitted
   into a box now, by whichever of width or height runs out first, and it is
   never scaled up past its own size. */
function crLogoBox(c,maxW){
  const W=c.W;
  /* The real space a logo has is everything between the left margin and the
     legal mark. Capping it at a flat fraction instead made a wide lockup come
     out a smudge — fitted, but far too small to read, which is the other
     half of the same complaint. */
  const avail=W-W*0.045-crReraW(W)-W*0.035;
  return {w:Math.max(80,Math.min(maxW||avail,avail)),
          h:Math.round(W*(c.wide?0.086:0.100))};
}
function crDrawLogo(g,c,x,y,maxW,light){
  const im=crLogoImage(); if(!im)return 0;
  const box=crLogoBox(c,maxW);
  const k=Math.min(box.w/im.naturalWidth,box.h/im.naturalHeight,1);
  const w=Math.round(im.naturalWidth*k), h=Math.round(im.naturalHeight*k);
  const S=c.W/1200;
  /* A gold-and-grey lockup on a pale sky is unreadable, and so is a dark one
     on a dark render. Rather than touch the logo — its colours are the
     brand's — a soft plate is laid under it when the backdrop cannot carry
     it, and nothing is laid under it when the backdrop can. */
  if(crLogoPlate()&&!light){
    /* Not a plate behind the logo — that read as a grey box pasted on the
       picture, which is the thing he keeps asking me to stop doing. A soft
       darkening across the whole top of the canvas instead: it has no edge,
       so there is nothing to see, and it carries the legal mark on the right
       as well as the logo on the left. */
    const deep=y+h/2+Math.round(28*S);
    const gr=g.createLinearGradient(0,0,0,deep);
    gr.addColorStop(0,"rgba(6,10,18,.56)");
    gr.addColorStop(.62,"rgba(6,10,18,.30)");
    gr.addColorStop(1,"rgba(6,10,18,0)");
    g.save(); g.fillStyle=gr; g.fillRect(0,0,c.W,deep); g.restore();
  }
  g.save();
  g.globalAlpha=1;                      /* never faded: these are brand marks */
  g.drawImage(im,x,y-h/2,w,h);
  g.restore();
  return w;
}
function crLockup(g,c,x,y,maxW,light){
  const S=c.S, fg=light?INK:"#FFFFFF";
  const logoH=crLogoBox(c,maxW).h;
  let lx=x;
  if(crLogoImage()){
    const w=crDrawLogo(g,c,x,y,maxW,light);
    lx+=w+26*S;
    /* The logo almost always carries the developer and the project already.
       Printing the typed names beside it said everything twice and is what
       made the headers look cluttered. */
    if(crLogoCarriesName())return;
  }else if(c.dev){
    g.font=F_H(800,48*S); g.fillStyle=fg; g.textAlign="left"; g.textBaseline="middle";
    g.fillText(c.dev,lx,y); lx+=g.measureText(c.dev).width+26*S;
  }
  if(!c.proj)return;
  if(lx>x){
    g.save(); g.strokeStyle=light?"rgba(20,33,61,.45)":"rgba(255,255,255,.55)";
    g.lineWidth=Math.max(1,1.5*S);
    g.beginPath(); g.moveTo(lx,y-logoH*.44); g.lineTo(lx,y+logoH*.44); g.stroke();
    g.restore(); lx+=26*S;
  }
  let ps=(c.wide?50:60)*S;
  g.font=F_H(700,ps); ps=crFit(g,c.proj,g.font,Math.max(60,x+maxW-lx));
  g.font=F_H(700,ps); g.fillStyle=fg; g.textAlign="left"; g.textBaseline="alphabetic";
  const by=c.micro?y+ps*.16:y+ps*.35;
  g.fillText(c.proj,lx,by);
  if(c.micro){
    const pw=g.measureText(c.proj).width, ms=ps*.38, tr=ms*.26;
    g.font=F_B(500,ms); g.fillStyle=light?"rgba(20,33,61,.80)":"rgba(255,255,255,.90)";
    const mw=[...c.micro].reduce((a,ch)=>a+g.measureText(ch).width,0)+tr*(c.micro.length-1);
    const mcx=lx+pw/2, myy=by+ms*1.6;
    crTrack(g,c.micro,mcx,myy,tr,"center");
    g.save(); g.strokeStyle=light?"rgba(20,33,61,.40)":"rgba(255,255,255,.45)";
    g.lineWidth=Math.max(1,1.2*S);
    const ry=myy-ms*.32, rl=34*S, gp=14*S;
    g.beginPath(); g.moveTo(mcx-mw/2-gp-rl,ry); g.lineTo(mcx-mw/2-gp,ry); g.stroke();
    g.beginPath(); g.moveTo(mcx+mw/2+gp,ry); g.lineTo(mcx+mw/2+gp+rl,ry); g.stroke();
    g.restore();
  }
}
/* the location line, pin and all, centred on cx */
function crLocLine(g,c,cx,baseY,size,pinColour,textColour,maxW){
  if(!c.loc)return 0;
  g.font=F_H(700,size);
  const s2=crFit(g,c.loc,g.font,maxW*.88); g.font=F_H(700,s2);
  const tw=g.measureText(c.loc).width, pw=s2*.80;
  const x0=cx-(tw+pw)/2;
  crPin(g,x0,baseY,s2,pinColour);
  g.fillStyle=textColour; g.textAlign="left"; g.textBaseline="alphabetic";
  g.fillText(c.loc,x0+pw,baseY);
  return s2;
}
/* configuration beside the price, split by a hairline — the light layouts */
/* maxW is the box this has to live inside. Without it the block is laid out
   at its natural size and simply runs past the border it sits in. */
function crCfgPriceSplit(g,c,cx,baseY,light,sub,maxW){
  const S=c.S, m=c.money;
  var k=1;
  if(maxW){
    /* measure once at full size, then shrink everything by one factor so the
       proportions hold */
    const probe=crCfgPriceWidth(g,c,sub,1);
    if(probe>maxW)k=maxW/probe;
  }
  const cfgS=(c.wide?48:60)*S*k, subS=cfgS*.46, numS=(c.wide?66:84)*S*k;
  const unitS=numS*.42, tailS=numS*.21, gapK=k;
  const fg=light?INK:"#FFFFFF";
  g.font=F_H(700,cfgS); const cfgW=c.cfg?g.measureText(c.cfg).width:0;
  g.font=F_B(500,subS);
  const subW=sub?[...sub].reduce((a,ch)=>a+g.measureText(ch).width,0)+subS*.22*(sub.length-1):0;
  const leftW=Math.max(cfgW,subW);
  g.font=F_H(800,numS);
  const amt=(m&&m.amount)||"", numW=amt?g.measureText(amt).width:0;
  g.font=F_H(700,unitS);
  const unitW=(m&&m.unit)?g.measureText(m.unit).width:0;
  g.font=F_B(600,tailS);
  /* ONWARDS sits under the unit and is often the wider of the two, so it has
     to be measured too or it runs out past the box */
  const tailW=(m&&m.tail)
    ?[...m.tail].reduce((a,ch)=>a+g.measureText(ch).width,0)+tailS*.3*(m.tail.length-1):0;
  const stackW=Math.max(unitW,tailW);
  const rightW=numW+(stackW?stackW+8*S:0);
  const gap=40*S*gapK, total=leftW+(leftW&&rightW?gap*2:0)+rightW;
  let x=cx-total/2;
  if(leftW){
    g.textAlign="left"; g.textBaseline="alphabetic"; g.fillStyle=fg;
    if(sub==="PREMIUM"){
      g.font=F_B(600,subS); g.fillStyle=light?"rgba(20,33,61,.78)":"rgba(255,255,255,.84)";
      crTrack(g,sub,x+leftW/2,baseY-cfgS*1.02,subS*.26,"center");
      g.font=F_H(700,cfgS); g.fillStyle=light?INK:"#FFFFFF";
      g.fillText(c.cfg,x+(leftW-cfgW)/2,baseY);
    }else{
      g.font=F_H(700,cfgS); g.fillText(c.cfg,x+(leftW-cfgW)/2,baseY);
      if(sub){ g.font=F_B(500,subS); g.fillStyle=light?"rgba(20,33,61,.82)":"rgba(255,255,255,.86)";
        crTrack(g,sub,x+leftW/2,baseY+subS*1.5,subS*.22,"center"); }
    }
    x+=leftW+gap;
  }
  if(leftW&&rightW){
    g.save(); g.strokeStyle=light?"rgba(20,33,61,.35)":"rgba(255,255,255,.45)";
    g.lineWidth=Math.max(1,1.4*S);
    g.beginPath(); g.moveTo(x,baseY-cfgS*.95); g.lineTo(x,baseY+subS*1.8); g.stroke();
    g.restore(); x+=gap;
  }
  if(rightW){
    g.textAlign="left"; g.textBaseline="alphabetic";
    /* the price is the strongest element on the creative, and the deck
       says so every time: it carries the palette accent. */
    g.fillStyle=light?(c.price||INK):(c.price||c.accent||GOLD_HI); g.font=F_H(800,numS);
    g.fillText(amt,x,baseY);
    const ux=x+numW+8*S;
    if(m.unit){ g.font=F_H(700,unitS); g.fillStyle=light?INK:"#FFFFFF";
      g.fillText(m.unit,ux,baseY-numS*.30); }
    if(m.tail){ g.font=F_B(600,tailS);
      g.fillStyle=light?"rgba(20,33,61,.75)":"rgba(255,255,255,.80)";
      crTrack(g,m.tail,ux,baseY,tailS*.3,"left"); }
  }
  return numS;
}
/* the width crCfgPriceSplit would take at a given scale, measured the same
   way it lays out, so the two can never disagree */
function crCfgPriceWidth(g,c,sub,k){
  const S=c.S, m=c.money;
  const cfgS=(c.wide?48:60)*S*k, subS=cfgS*.46, numS=(c.wide?66:84)*S*k;
  const unitS=numS*.42, tailS=numS*.21;
  g.font=F_H(700,cfgS); const cfgW=c.cfg?g.measureText(c.cfg).width:0;
  g.font=F_B(500,subS);
  const subW=sub?[...sub].reduce((a,ch)=>a+g.measureText(ch).width,0)+subS*.22*(sub.length-1):0;
  const leftW=Math.max(cfgW,subW);
  g.font=F_H(800,numS);
  const numW=(m&&m.amount)?g.measureText(m.amount).width:0;
  g.font=F_H(700,unitS);
  const unitW=(m&&m.unit)?g.measureText(m.unit).width:0;
  g.font=F_B(600,tailS);
  const tailW=(m&&m.tail)
    ?[...m.tail].reduce((a,ch)=>a+g.measureText(ch).width,0)+tailS*.3*(m.tail.length-1):0;
  const stackW=Math.max(unitW,tailW);
  const rightW=numW+(stackW?stackW+8*S:0);
  return leftW+(leftW&&rightW?80*S*k:0)+rightW;
}

/* configuration over price, centred — the panel layout */
/* configuration above the price. `light` draws it on a pale panel, `maxW`
   caps it to the column it has to live in. */
function crCfgPriceStack(g,c,cx,topY,sub,light,maxW){
  const S=c.S, m=c.money;
  const box=maxW||c.W*.52;
  const fg=light?INK:"#FFFFFF";
  const dim=light?"rgba(20,33,61,":"rgba(255,255,255,";
  const cfgS=(c.wide?48:62)*S, subS=cfgS*.42;
  const numS=(c.wide?66:86)*S, unitS=numS*.44, tailS=numS*.2;
  let y=topY+cfgS;
  if(c.cfg){
    g.font=F_H(700,cfgS); const s2=crFit(g,c.cfg,g.font,box); g.font=F_H(700,s2);
    g.fillStyle=fg; g.textAlign="center"; g.textBaseline="alphabetic";
    g.fillText(c.cfg,cx,y); y+=subS*1.6;
  }
  if(sub){ g.font=F_B(500,subS); g.fillStyle=dim+".86)";
    crTrack(g,sub,cx,y,subS*.3,"center"); y+=subS*1.1; }
  crOrnRule(g,cx,y+subS*.5,Math.min(box*.72,c.W*.30),S,c.accent); y+=subS*1.5+numS*.72;
  if(m&&m.amount){
    g.font=F_H(800,numS); const nw=g.measureText(m.amount).width;
    g.font=F_H(700,unitS); const uw=m.unit?g.measureText(m.unit).width:0;
    const tot=nw+(uw?uw+8*S:0);
    /* shrink the whole price block rather than let it run out of the panel */
    const k=tot>box?box/tot:1;
    const nS=numS*k, uS=unitS*k, tS=tailS*k;
    g.font=F_H(800,nS); const nw2=g.measureText(m.amount).width;
    g.font=F_H(700,uS); const uw2=m.unit?g.measureText(m.unit).width:0;
    let x=cx-(nw2+(uw2?uw2+8*S:0))/2;
    g.textAlign="left"; g.fillStyle=c.price||(light?INK:GOLD_HI); g.font=F_H(800,nS);
    g.fillText(m.amount,x,y); x+=nw2+8*S;
    if(m.unit){ g.font=F_H(700,uS); g.fillStyle=fg; g.fillText(m.unit,x,y-nS*.30); }
    if(m.tail){ g.font=F_B(600,tS); g.fillStyle=dim+".80)";
      crTrack(g,m.tail,x,y,tS*.3,"left"); }
  }
  return y;
}
/* a gold gradient ribbon carrying the offer */
function crRibbon(g,c,cx,cy,text){
  if(!text)return 0;
  const S=c.S, fs=(c.wide?34:42)*S;
  g.font=F_H(700,fs); const s2=crFit(g,text,g.font,c.W*.70); g.font=F_H(700,s2);
  const tw=g.measureText(text).width, padX=42*S, h=s2*1.9, w=tw+padX*2;
  const x=cx-w/2, y=cy-h/2, cut=h*.26;
  const grad=g.createLinearGradient(x,0,x+w,0);
  grad.addColorStop(0,"#B8912F"); grad.addColorStop(.5,"#F0D693"); grad.addColorStop(1,"#B8912F");
  g.save();
  g.beginPath();
  g.moveTo(x,y); g.lineTo(x+w,y); g.lineTo(x+w-cut,y+h/2); g.lineTo(x+w,y+h);
  g.lineTo(x,y+h); g.lineTo(x+cut,y+h/2); g.closePath();
  g.fillStyle=grad; g.fill();
  g.fillStyle=INK; g.textAlign="center"; g.textBaseline="middle";
  g.font=F_H(700,s2); g.fillText(text,cx,cy+s2*.04);
  g.restore();
  return h;
}
function crScrims(g,c){
  const {W,H,scrim,wide,tall}=c;
  const t=H*(wide?.34:.30);
  const tg=g.createLinearGradient(0,0,0,t);
  tg.addColorStop(0,`rgba(5,8,14,${.62*scrim})`); tg.addColorStop(1,"rgba(5,8,14,0)");
  g.fillStyle=tg; g.fillRect(0,0,W,t);
  const b=H*(tall?.60:wide?.56:.58);
  const bg=g.createLinearGradient(0,b,0,H);
  bg.addColorStop(0,"rgba(5,8,14,0)");
  bg.addColorStop(.45,`rgba(5,8,14,${.46*scrim})`);
  bg.addColorStop(.78,`rgba(5,8,14,${.80*scrim})`);
  bg.addColorStop(1,`rgba(5,8,14,${.95*scrim})`);
  g.fillStyle=bg; g.fillRect(0,b,W,H-b);
}
/* How far a cover-crop may zoom past a plain fit before it starts cutting the
   building in half. Past this the picture is fitted whole instead. */
const CR_MAX_ZOOM=1.40;
function crFillPct(){
  const el=$("#crFill");
  const v=el?Number(el.value):35;
  return Math.max(0,Math.min(1,(isFinite(v)?v:35)/100));
}
let CR_CAN_BLUR=null;
function crBlurOk(){
  if(CR_CAN_BLUR===null){
    try{ const t=document.createElement("canvas").getContext("2d");
      t.filter="blur(4px)"; CR_CAN_BLUR=(t.filter!=="none"); }
    catch(e){ CR_CAN_BLUR=false; }
  }
  return CR_CAN_BLUR;
}
/* the render, fitted into its box */
function crHero(g,c,x,y,w,h,bleed){
  const hero=CR.hero;
  if(!hero){ g.fillStyle="#0B1020"; g.fillRect(x,y,w,h); return; }
  const iw=hero.naturalWidth, ih=hero.naturalHeight;
  if(!iw||!ih){ g.fillStyle="#0B1020"; g.fillRect(x,y,w,h); return; }
  const cover=Math.max(w/iw,h/ih), contain=Math.min(w/iw,h/ih);
  /* A developer's render is wide; a story is very tall. Forcing one into the
     other either crops most of the building away, or — as this used to —
     paints flat sky-and-ground gradient bands above and below a squeezed
     strip, which is what put visible horizontal seams across the elevation
     and left the picture marooned in the middle of the canvas. Neither is
     acceptable. Past a point the picture is fitted whole and the space around
     it is filled with a blurred, darkened copy of the same picture: no seam,
     nothing cropped, and the colour comes from the render itself. */
  /* Only a FULL-BLEED box gets this treatment. A column or an arch is a
     deliberate crop of the picture — cropping the sides of a wide render to
     fill a tall column is exactly right there, and blurring it would waste
     half the column on a smear. */
  /* Only a box TALLER than the picture gets the blurred treatment. A wide
     box fed a squarish render was being filled with blur down both sides
     while the building sat small in the middle — cropping its top and
     bottom instead is what that shape wants, and what every reference
     landscape creative does. */
  const boxTaller=(h/w)>(ih/iw);
  if(!bleed||!boxTaller||cover/contain<=CR_MAX_ZOOM){
    crCover(g,hero,c.W,c.H,x,y,w,h); return; }
  g.save();
  g.beginPath(); g.rect(x,y,w,h); g.clip();
  if(crBlurOk()){
    g.filter=`blur(${Math.round(Math.max(w,h)*0.045)}px) brightness(0.70) saturate(0.85)`;
    /* over-draw, or the blur's own soft edge shows at the rim */
    const o=Math.max(w,h)*0.12;
    crCover(g,hero,c.W,c.H,x-o,y-o,w+o*2,h+o*2);
    g.filter="none";
  }else{
    crCover(g,hero,c.W,c.H,x,y,w,h);
    g.fillStyle="rgba(5,8,14,.45)"; g.fillRect(x,y,w,h);
  }
  /* Between the whole picture floating in blur and a crop that cuts the
     building in half there is no single right answer — it depends on the
     render. So it is a dial, not a guess. 0 keeps the picture whole; 100
     fills the frame and crops whatever that costs. */
  const k=contain+(cover-contain)*crFillPct(), dw=iw*k, dh=ih*k;
  /* a tower reads better with more room under it than over it */
  const dx=x+(w-dw)/2, dy=y+(h-dh)*(c.tall?0.40:0.50);
  /* A hard edge where the sharp picture meets the blurred backdrop reads as
     two photographs stacked. The sharp copy is faded out over its last few
     per cent instead, so the two become one picture. */
  const feather=Math.round(Math.min(dh*0.10,Math.max(w,h)*0.07));
  if(feather>4){
    const t=document.createElement("canvas");
    t.width=Math.max(1,Math.round(dw)); t.height=Math.max(1,Math.round(dh));
    const tg=t.getContext("2d");
    tg.drawImage(hero,0,0,t.width,t.height);
    tg.globalCompositeOperation="destination-in";
    const mask=tg.createLinearGradient(0,0,0,t.height);
    const f=feather/dh;
    mask.addColorStop(0,"rgba(0,0,0,0)");
    mask.addColorStop(f,"rgba(0,0,0,1)");
    mask.addColorStop(1-f,"rgba(0,0,0,1)");
    mask.addColorStop(1,"rgba(0,0,0,0)");
    tg.fillStyle=mask; tg.fillRect(0,0,t.width,t.height);
    g.drawImage(t,dx,dy,dw,dh);
  }else g.drawImage(hero,dx,dy,dw,dh);
  g.restore();
}

/* ── the band at the foot ─────────────────────────────────────────────────
   Three layouts put an offer badge, a location line and the configuration
   and price into a band. Each used to size the band by eye and position the
   three independently, so whenever the offer was long or the ratio short
   they printed on top of one another. The band is measured from what has to
   go in it instead, and the three are laid out down it in order. */
function crBandFill(g,c,bandY,bandH,light,sub){
  const {W,S,wide}=c;
  const inner=bandH-crFootH(c);
  const pad=inner*.09;
  let y=bandY+pad;
  if(c.offer){
    const fs=(wide?26:34)*S;
    g.font=F_H(700,fs); const s2=crFit(g,c.offer,g.font,W*.70); g.font=F_H(700,s2);
    const tw=g.measureText(c.offer).width, bh=s2*1.75, bw=tw+50*S;
    g.fillStyle=c.badge||(light?INK:c.accent); g.fillRect(W/2-bw/2,y,bw,bh);
    g.fillStyle=c.badgeText||(light?"#FFFFFF":INK); g.textAlign="center"; g.textBaseline="middle";
    g.fillText(c.offer,W/2,y+bh/2+s2*.04);
    y+=bh+pad*.8;
  }
  if(c.loc){
    const locS=(wide?32:42)*S;
    y+=locS;
    crLocLine(g,c,W/2,y,locS,RED,light?INK:"#FFFFFF",W*.84);
    y+=pad*.7;
  }
  /* the configuration's label hangs BELOW its baseline, so the baseline has
     to sit that much higher or the label lands in the disclaimer's foot */
  const subDrop=(wide?48:60)*S*.46*1.7;
  crCfgPriceSplit(g,c,W/2,bandY+inner-pad*.5-subDrop,light,sub||"APARTMENTS",W*.86);
}
/* how tall that band has to be for what is going into it */
function crBandNeed(c){
  const {W,S,wide}=c;
  const badge=c.offer?(wide?26:34)*S*1.75:0;
  const loc=c.loc?(wide?32:42)*S*1.45:0;
  const price=(wide?150:188)*S;
  const pads=(c.offer?1.8:1)*(wide?22:30)*S;
  return badge+loc+price+pads+crFootH(c);
}
/* ── the six layouts ─────────────────────────────────────────────────────── */
const CR_DRAW={

/* 1. Gold frame — dark plaques on the render, hairline notched frame */
frame(g,c){
  const {W,H,S,wide,tall}=c;
  crHero(g,c,0,0,W,H,true); crScrims(g,c);
  const fx=W*.082, fw=W*.836;
  const fy=H*(tall?.315:wide?.215:.179), fy2=H*(tall?.775:wide?.872:.898);
  if(!$("#crFrame")||$("#crFrame").checked)crFrame(g,fx,fy,fw,fy2-fy,S,c.accent);
  const lockY=H*(tall?.225:wide?.075:.072);
  crLockup(g,c,fx,lockY,fw-crReraW(W),false);
  /* The badge used to sit on the frame's top edge, which is halfway down the
     building. It goes just under the header row instead, clear of the
     elevation — the deck is explicit that promotional furniture must not
     cover the architecture. */
  if(c.offer)crPlaque(g,W/2,Math.max(lockY+crLogoBox(c,0).h*0.9,H*(tall?.165:wide?.20:.145)),
                      c.offer,S,c.accent);
  const barH=Math.round(104*S), barTop=Math.round(fy2-barH/2);
  crPriceBar(g,W/2,barTop,c.cfg,c.money&&c.money.amount,c.money&&c.money.unit,
             c.money&&c.money.tail,S,c.accent);
  crLocLine(g,c,W/2,barTop-44*S,(wide?44:54)*S,c.accent,"#FFFFFF",fw);
},

/* 2. White card — render full bleed, scalloped white panel at the foot */
card(g,c){
  const {W,H,S,wide,tall}=c;
  crHero(g,c,0,0,W,H,true); crScrims(g,c);
  const lockY=H*(tall?.10:.072);
  /* the logo sits in its own white chip here, as on the reference */
  const _lg=crLogoImage();
  const chipH=(wide?84:100)*S, chipW=Math.min(W*.46,(_lg
    ? chipH*_lg.naturalWidth/_lg.naturalHeight+56*S : W*.40));
  g.fillStyle="#FFFFFF"; g.fillRect(W*.045,lockY-chipH/2,chipW,chipH);
  g.save(); g.beginPath(); g.rect(W*.045,lockY-chipH/2,chipW,chipH); g.clip();
  crLockup(g,c,W*.045+24*S,lockY,chipW-48*S,true); g.restore();
  /* On 1.91:1 a centred panel at 80% of the width sat squarely over the
     elevation. On that ratio only it moves to the right-hand third, which is
     what the reference landscapes do. Square, portrait and story keep the
     centred panel they already had. */
  const pw=wide?W*.40:W*.80, px=wide?W*.565:(W-W*.80)/2;
  const ph=tall?H*.26:wide?(H-Math.max(H*.13,W*.135)-H*.08):H*.33;
  /* on a wide canvas the panel's top was level with the legal mark and the
     two printed over each other */
  const py=tall?H*.70:wide?Math.max(H*.13,W*.135):H*.63;
  const cx=px+pw/2;                      /* the panel moved; its contents follow */
  const r=pw/22;
  g.save();
  crScallopTop(g,px,py,pw,ph,r);
  g.fillStyle="#FFFFFF"; g.globalAlpha=.97; g.fill(); g.globalAlpha=1;
  g.restore();
  const offH=c.offer?(wide?30:38)*S*1.8+(wide?18:26)*S:0;
  /* the block is centred in what is left of the panel rather than pinned to
     its top, which is what pushed the copy off a tall narrow landscape panel */
  const bodyTop=py+r+(wide?26:48)*S, bodyBot=py+ph-offH;
  let y=wide?bodyTop+(bodyBot-bodyTop)*.30:bodyTop+(wide?48:62)*S;
  y+=crLocLine(g,c,cx,y,(wide?38:52)*S,RED,INK,pw*.9)*.5;
  crOrnRule(g,cx,y+18*S,pw*.42,S,RED); y+=56*S;
  crCfgPriceSplit(g,c,cx,y+(wide?40:56)*S,true,"PREMIUM",pw*.86);
  if(c.offer){
    const t=c.offer, fs=(wide?30:38)*S;
    g.font=F_H(700,fs); const s2=crFit(g,t,g.font,pw*.82); g.font=F_H(700,s2);
    const tw=g.measureText(t).width, bh=s2*1.8, bw=Math.min(pw*.9,tw+52*S);
    const by=py+ph-bh-(wide?18:26)*S;
    g.fillStyle=RED; g.fillRect(cx-bw/2,by,bw,bh);
    g.fillStyle="#FFFFFF"; g.textAlign="center"; g.textBaseline="middle";
    g.fillText(t,cx,by+bh/2+s2*.04);
  }
  c.footBox={cx:wide?cx:W/2,w:(wide?pw*.94:W*.90),light:wide};
},

/* 3. Light footer — render full bleed, light band under it */
footer(g,c){
  const {W,H,S,wide,tall}=c;
  const bandH=Math.max(H*(tall?.17:wide?.26:.22),Math.min(H*.46,crBandNeed(c)));
  const bandY=H-bandH;
  crHero(g,c,0,0,W,bandY+2,true);
  const tg=g.createLinearGradient(0,0,0,H*.30);
  tg.addColorStop(0,`rgba(5,8,14,${.52*c.scrim})`); tg.addColorStop(1,"rgba(5,8,14,0)");
  g.fillStyle=tg; g.fillRect(0,0,W,H*.30);
  g.fillStyle=PAPER; g.fillRect(0,bandY,W,bandH);
  /* the header row holds the logo and the legal mark and nothing else */
  crLockup(g,c,W*.05,H*(tall?.10:.072),W*.90-crReraW(W),false);
  crBandFill(g,c,bandY,bandH,true,"APARTMENTS");
},

/* 4. Centre panel — a deco panel set on the render */
panel(g,c){
  const {W,H,S,wide,tall}=c;
  crHero(g,c,0,0,W,H,true);
  const vg=g.createRadialGradient(W/2,H*.45,W*.12,W/2,H*.45,W*.72);
  vg.addColorStop(0,`rgba(5,10,8,${.30*c.scrim})`);
  vg.addColorStop(1,`rgba(5,10,8,${.62*c.scrim})`);
  g.fillStyle=vg; g.fillRect(0,0,W,H);
  const lockY=H*(tall?.09:.068);
  crLockup(g,c,W*.05,lockY,W*.90-crReraW(W),false);
  const pw=W*(wide?.48:.56), px=(W-pw)/2;
  const ph=H*(tall?.34:wide?.56:.46), py=H*(tall?.30:wide?.24:.24);
  /* the panel needs its own ground, or the copy sits on whatever the render
     happens to be doing underneath it */
  g.save();
  g.fillStyle="rgba(8,14,12,.46)"; g.fillRect(px,py,pw,ph);
  g.strokeStyle=c.accent; g.lineWidth=Math.max(2,2.4*S); g.globalAlpha=.95;
  g.strokeRect(px,py,pw,ph);
  /* the sunburst that tops the panel in the reference */
  const rays=11, rayLen=pw*.34;
  for(let i=0;i<rays;i++){
    const t=i/(rays-1), ang=-Math.PI/2+(t-.5)*Math.PI*.78;
    g.beginPath(); g.moveTo(px+pw/2,py);
    g.lineTo(px+pw/2+Math.cos(ang)*rayLen,py+Math.sin(ang)*rayLen+rayLen*.92); g.stroke();
  }
  g.restore();
  let y=py+ph*(tall?.22:.20);
  y+=crLocLine(g,c,W/2,y,(wide?38:46)*S,c.accent,"#FFFFFF",pw*.86);
  crCfgPriceStack(g,c,W/2,y+16*S,"RESIDENCES");
  if(c.offer){
    const fs=(wide?30:38)*S;
    g.font=F_H(700,fs); const s2=crFit(g,c.offer,g.font,W*.72); g.font=F_H(700,s2);
    const bh=s2*2.0;
    g.fillStyle="#FFFFFF"; g.fillRect(W*.14,H-bh-(tall?H*.04:24*S),W*.72,bh);
    g.fillStyle=INK; g.textAlign="center"; g.textBaseline="middle";
    g.fillText(c.offer,W/2,H-bh/2-(tall?H*.04:24*S)+s2*.04);
  }
},

/* 5. Arch — light ground, arched render, gold ribbon */
arch(g,c){
  const {W,H,S,wide,tall}=c;
  const sky=g.createLinearGradient(0,0,0,H*.55);
  sky.addColorStop(0,"#1C4C8B"); sky.addColorStop(1,"#5E9BD6");
  g.fillStyle=PAPER; g.fillRect(0,0,W,H);
  const lockY=H*(tall?.09:.068);

  if(wide){
    /* A 1.91:1 arch spanning the full width is a 3.2:1 box, and a render is
       nowhere near that shape — covering it cut the top and bottom off the
       building. On this ratio the arch takes the right half at close to the
       render's own proportions and the copy takes the left, which keeps the
       elevation whole. */
    const aw=W*.46, ax=W*.50, ah=H*.80, ay=H*.10, r=aw*.22;
    g.fillStyle=sky; g.fillRect(0,0,W,H*.46);
    crLockup(g,c,W*.05,lockY,W*.44,false);
    g.save(); crArch(g,ax,ay,aw,ah,r); g.clip();
    crHero(g,c,ax,ay,aw,ah); g.restore();
    g.save(); g.strokeStyle=c.accent; g.lineWidth=Math.max(2,3*S);
    crArch(g,ax,ay,aw,ah,r); g.stroke(); g.restore();
    const colW=W*.40, cx=W*.05+colW/2;
    let y=H*.40;
    y+=crLocLine(g,c,cx,y,42*S,RED,INK,colW)*.5;
    crOrnRule(g,cx,y+16*S,colW*.6,S,c.accent);
    crCfgPriceSplit(g,c,cx,y+70*S,true,"LUXURIOUS APARTMENTS",colW*.96);
    if(c.offer){
      const fs=30*S;
      g.font=F_H(700,fs); const s2=crFit(g,c.offer,g.font,colW*.94); g.font=F_H(700,s2);
      const tw=g.measureText(c.offer).width, bh=s2*1.8, bw=Math.min(colW,tw+46*S);
      const by=H*.72;
      g.fillStyle=c.accent; g.fillRect(cx-bw/2,by,bw,bh);
      g.fillStyle=INK; g.textAlign="center"; g.textBaseline="middle";
      g.fillText(c.offer,cx,by+bh/2+s2*.04);
    }
    c.footBox={cx:cx,w:colW,light:true};
    return;
  }

  const ax=W*.0, aw=W, ah=H*(tall?.52:.52), ay=H*(tall?.20:.22);
  g.fillStyle=sky; g.fillRect(0,0,W,ay+ah*.5);
  crLockup(g,c,W*.05,lockY,W*.90-crReraW(W),false);
  if(c.offer){
    const fs=44*S;
    g.font=F_H(700,fs); const s2=crFit(g,c.offer,g.font,W*.72); g.font=F_H(700,s2);
    const oy=ay-36*S;
    g.fillStyle="#FFFFFF"; g.textAlign="center"; g.textBaseline="alphabetic";
    g.fillText(c.offer,W/2,oy);
    crOrnRule(g,W/2,oy-s2*1.5,W*.42,S,"rgba(255,255,255,.7)");
    crOrnRule(g,W/2,oy+s2*.55,W*.42,S,"rgba(255,255,255,.7)");
  }
  const r=aw*.16;
  g.save(); crArch(g,ax,ay,aw,ah,r); g.clip();
  crHero(g,c,ax,ay,aw,ah); g.restore();
  g.save(); g.strokeStyle=c.accent; g.lineWidth=Math.max(2,3*S);
  crArch(g,ax,ay,aw,ah,r); g.stroke(); g.restore();
  let y=ay+ah+76*S;
  y+=crLocLine(g,c,W/2,y-28*S,46*S,RED,INK,W*.84)*.55;
  crOrnRule(g,W/2,y-20*S,W*.56,S,c.accent);
  crCfgPriceSplit(g,c,W/2,y+60*S,true,"LUXURIOUS APARTMENTS",W*.80);
  crOrnRule(g,W/2,y+110*S,W*.56,S,c.accent);
},

/* 6. Header stack — copy above on light, arched render below */
header(g,c){
  const {W,H,S,wide,tall}=c;
  g.fillStyle=PAPER; g.fillRect(0,0,W,H);
  /* A 9:16 canvas is narrow and very long: scaling off min(W,H) sizes the
     header for the width and leaves the copy marooned at the top. The whole
     header band is scaled up on a tall canvas instead. */
  const TS=tall?S*1.35:S;
  const ct=tall?Object.assign({},c,{S:TS}):c;
  const lockY=H*(tall?.085:.062);
  crLockup(g,ct,W*.05,lockY,W*.90-crReraW(W),true);
  if(wide){
    /* Stacking copy above a picture needs vertical room a 1.91:1 canvas does
       not have. Wide sits them side by side: copy on the left, the arched
       render filling the right. */
    const colW=W*.44, cx=W*.045+colW/2;
    const ax=W*.54, aw=W*.42, ay2=H*.10, ah2=H*.80, r2=aw*.22;
    g.save(); crArch(g,ax,ay2,aw,ah2,r2); g.clip();
    crHero(g,c,ax,ay2,aw,ah2); g.restore();
    g.save(); g.strokeStyle=c.accent; g.lineWidth=Math.max(1,2*S);
    crArch(g,ax,ay2,aw,ah2,r2); g.stroke(); g.restore();
    let yy=H*.36;
    yy+=crLocLine(g,c,cx,yy,46*S,RED,INK,colW);
    const bw2=colW, bx2=W*.045, bh2=108*S, by2=yy+20*S;
    g.save(); g.strokeStyle=c.accent; g.lineWidth=Math.max(1,1.6*S);
    g.strokeRect(bx2,by2,bw2,bh2); g.restore();
    crCfgPriceSplit(g,c,cx,by2+bh2*.60,true,"LUXURY APARTMENTS",bw2*.88);
    if(c.offer){
      const fs=32*S;
      g.font=F_H(700,fs); const s2=crFit(g,c.offer,g.font,colW); g.font=F_H(700,s2);
      const tw=g.measureText(c.offer).width, th=s2*1.8;
      g.fillStyle=c.accent; g.fillRect(cx-(tw+44*S)/2,by2+bh2+18*S,tw+44*S,th);
      g.fillStyle=INK; g.textAlign="center"; g.textBaseline="middle";
      g.fillText(c.offer,cx,by2+bh2+18*S+th/2+s2*.04);
    }
    return;
  }
  let y=H*(tall?.245:.22);
  y+=crLocLine(g,ct,W/2,y,58*TS,RED,INK,W*.86);
  const bw=W*.86, bx=(W-bw)/2, bh=124*TS, by=y+26*TS;
  g.save(); g.strokeStyle=c.accent; g.lineWidth=Math.max(1,1.6*S);
  g.strokeRect(bx,by,bw,bh);
  g.globalAlpha=.6;
  g.beginPath(); g.moveTo(bx-W*.045,by+bh/2); g.lineTo(bx,by+bh/2); g.stroke();
  g.beginPath(); g.moveTo(bx+bw,by+bh/2); g.lineTo(bx+bw+W*.045,by+bh/2); g.stroke();
  g.restore();
  crCfgPriceSplit(g,ct,W/2,by+bh*.60,true,"LUXURY APARTMENTS",bw*.88);
  /* the offer tab straddles the arch's top edge, so the arch needs to start
     clear of the box or the tab lands on its border */
  const ay=by+bh+(tall?70:44)*TS, ah=H-ay, r=W*.14;
  g.save(); crArch(g,W*.04,ay,W*.92,ah,r); g.clip();
  crHero(g,c,W*.04,ay,W*.92,ah); g.restore();
  g.save(); g.strokeStyle=c.accent; g.lineWidth=Math.max(1,2*S);
  crArch(g,W*.04,ay,W*.92,ah,r); g.stroke(); g.restore();
  if(c.offer){
    const fs=36*TS;
    g.font=F_H(700,fs); const s2=crFit(g,c.offer,g.font,W*.72); g.font=F_H(700,s2);
    const tw=g.measureText(c.offer).width, th=s2*1.8, tw2=tw+48*TS;
    g.fillStyle=c.accent; g.fillRect(W/2-tw2/2,ay-th/2,tw2,th);
    g.fillStyle=INK; g.textAlign="center"; g.textBaseline="middle";
    g.fillText(c.offer,W/2,ay+s2*.04);
  }
},

/* 7. Dark band — the single most common shape in the reference deck:
   render full bleed, a deep band across the foot, configuration on the left,
   the price on the right in accent. "Display the price in large, bold
   yellow/gold text against a dark-blue panel." */
band(g,c){
  const {W,H,S,wide,tall}=c;
  const bandH=Math.max(H*(tall?.155:wide?.30:.21),Math.min(H*.46,crBandNeed(c)));
  const bandY=H-bandH;
  crHero(g,c,0,0,W,H,true);
  const tg=g.createLinearGradient(0,0,0,H*.26);
  tg.addColorStop(0,`rgba(5,8,14,${.55*c.scrim})`); tg.addColorStop(1,"rgba(5,8,14,0)");
  g.fillStyle=tg; g.fillRect(0,0,W,H*.26);
  g.fillStyle=INK; g.fillRect(0,bandY,W,bandH);
  g.fillStyle=c.accent; g.fillRect(0,bandY,W,Math.max(2,3*S));
  crLockup(g,c,W*.05,H*(tall?.085:.068),W*.90-crReraW(W),false);
  crBandFill(g,c,bandY,bandH,false,"APARTMENTS");
},

/* 8. Feature strip — three claims in a row above a light band. The deck runs
   this constantly: "EOI Tokens Opening Soon · 70% Open-to-Sky · Riverside
   Township Lifestyle" sitting between the render and the price. */
strip(g,c){
  const {W,H,S,wide,tall}=c;
  const feats=(c.feats||[]).filter(Boolean).slice(0,3);
  const stripH=feats.length?(wide?48:60)*S:0;
  const bandH=Math.max(H*(tall?.165:wide?.30:.225),Math.min(H*.46,crBandNeed(c)));
  const bandY=H-bandH, stripY=bandY-stripH;
  crHero(g,c,0,0,W,stripY+2,true);
  const tg=g.createLinearGradient(0,0,0,H*.28);
  tg.addColorStop(0,`rgba(5,8,14,${.52*c.scrim})`); tg.addColorStop(1,"rgba(5,8,14,0)");
  g.fillStyle=tg; g.fillRect(0,0,W,H*.28);
  if(stripH){
    g.fillStyle=INK; g.fillRect(0,stripY,W,stripH);
    const fs=(wide?18:22)*S, cellW=W/feats.length;
    feats.forEach((t,i)=>{
      const cx=cellW*i+cellW/2;
      const s2=crFit(g,t,F_B(600,fs),cellW*.86);
      g.font=F_B(600,s2);
      g.fillStyle="#FFFFFF"; g.textAlign="center"; g.textBaseline="middle";
      g.fillText(t,cx,stripY+stripH/2+s2*.04);
      if(i){ g.strokeStyle=c.accent; g.globalAlpha=.5; g.lineWidth=Math.max(1,1.4*S);
        g.beginPath(); g.moveTo(cellW*i,stripY+stripH*.24);
        g.lineTo(cellW*i,stripY+stripH*.76); g.stroke(); g.globalAlpha=1; }
    });
  }
  g.fillStyle=PAPER; g.fillRect(0,bandY,W,bandH);
  crLockup(g,c,W*.05,H*(tall?.085:.068),W*.90-crReraW(W),false);
  crBandFill(g,c,bandY,bandH,true,"APARTMENTS");
},

/* 9. Split panel — "a split-panel composition with rounded or curved image
   boundaries, consistent margins, aligned text blocks". Render on one side,
   everything else on the other. On a tall canvas a side-by-side split leaves
   two thin columns, so there it splits top and bottom instead. */
split(g,c){
  const {W,H,S,wide,tall}=c;
  g.fillStyle=PAPER; g.fillRect(0,0,W,H);
  const r=Math.round(W*.045);
  var ix,iy,iw,ih, px,py,pw,ph;
  if(tall){
    /* The 9:16 used to give the picture half the canvas and the panel a
       third, which left a quarter of a very tall creative blank. The picture
       takes more of it and the panel takes all of what is left. */
    ix=0; iy=0; iw=W; ih=H*.58;
    px=W*.06; pw=W*.88;
    py=ih+H*.025; ph=H-py-crFootH(c)-H*.02;
  }else{
    /* the panel sits under the RERA corner, so it starts below it rather
       than fighting it for the same inch. It is also wider than it was —
       a third of the canvas was not enough for a stacked price. */
    ix=0; iy=0; iw=W*.52; ih=H;
    px=W*.56; pw=W*.40;
    py=Math.max(H*.12,W*.135); ph=H-py-crFootH(c)-H*.05;
  }
  g.save();
  g.beginPath();
  if(tall)g.rect(ix,iy,iw,ih);
  else{ g.moveTo(ix,iy); g.lineTo(ix+iw-r,iy);
        g.quadraticCurveTo(ix+iw,iy,ix+iw,iy+r);
        g.lineTo(ix+iw,iy+ih-r);
        g.quadraticCurveTo(ix+iw,iy+ih,ix+iw-r,iy+ih);
        g.lineTo(ix,iy+ih); g.closePath(); }
  g.clip(); crHero(g,c,ix,iy,iw,ih); g.restore();
  const cx=px+pw/2;
  c.footBox={cx:tall?W/2:cx,w:(tall?W*.90:pw*.98),light:true};

  /* everything in the panel, measured first so it can be spread down the
     panel instead of bunched at the top with a hole underneath */
  const feats=(c.feats||[]).filter(Boolean).slice(0,3);
  const offerH=c.offer?(wide?26:34)*S*1.85:0;
  const featH=feats.length?feats.length*(wide?17:22)*S*1.9:0;
  const lockH=(wide?80:98)*S;
  const locH=c.loc?(wide?34:46)*S*1.5:0;
  const priceH=(wide?150:200)*S;          /* configuration stacked over price */
  const need=locH+priceH+featH+offerH;
  const slack=Math.max(0,ph-need);
  const gap=slack/5;

  /* The logo goes top-left of the canvas, not into the middle of the panel.
     Every other layout puts it there and the reference creatives all do. */
  crLockup(g,c,W*.045,Math.round(W*.030)+lockH*.5,
           Math.max(W*.20,(tall?W*.90:ix+iw)-W*.045-(tall?crReraW(W):0)),!tall);
  let y=py+gap*.5;

  if(c.loc){ y+=crLocLine(g,c,cx,y+locH*.6,(wide?34:46)*S,RED,INK,pw*.96)*.2+locH*.6; }
  crOrnRule(g,cx,y+gap*.3,pw*.52,S,c.accent);
  y+=gap*.6;

  /* configuration above the price, not beside it — a panel this narrow
     squeezed both to nothing when they shared a line */
  y=crCfgPriceStack(g,c,cx,y,"APARTMENTS",true,pw*.96);
  y+=gap;

  if(feats.length){
    const fs=(wide?17:22)*S;
    feats.forEach(t=>{
      const s2=crFit(g,t,F_B(500,fs),pw*.90);
      g.font=F_B(500,s2);
      g.fillStyle="rgba(20,33,61,.72)"; g.textAlign="center"; g.textBaseline="middle";
      g.fillText(t,cx,y+s2*.9);
      y+=s2*1.9;
    });
    y+=gap*.6;
  }
  if(c.offer){
    const fs=(wide?26:34)*S;
    g.font=F_H(700,fs); const s2=crFit(g,c.offer,g.font,pw*.92); g.font=F_H(700,s2);
    const tw=g.measureText(c.offer).width, bh=s2*1.85, bw=Math.min(pw,tw+48*S);
    const by=Math.min(y,py+ph-bh);
    g.fillStyle=c.accent; g.fillRect(cx-bw/2,by,bw,bh);
    g.fillStyle=INK; g.textAlign="center"; g.textBaseline="middle";
    g.fillText(c.offer,cx,by+bh/2+s2*.04);
  }

}
};

/* ── the legal strip ──────────────────────────────────────────────────────
   RERA is a legal notice, not a design element: it has to be on every
   creative, in the same place, legible. Letting each layout place it meant
   two layouts never drew it at all, and on a 9:16 it landed under the project
   name. It is drawn here instead, after the layout, in its own navy band at
   the foot of every creative — same position, same size relative to the
   width, on all six layouts and all four ratios. The layout is handed a
   shorter canvas so nothing of its own lands underneath. */
/* ── RERA, top right ──────────────────────────────────────────────────────
   The Creative Guidelines are explicit about this and every reference
   creative follows it: "Display the project's applicable RERA registration
   number in the top-right corner", "Place the project's official RERA QR code
   in the top-right corner, alongside the registration number", "Display the
   official RERA website URL directly below the registration number",
   "Maintain consistent placement ... across every creative format."

   So it is drawn here, after the layout, in the top right, at the same size
   relative to the width on every layout and every ratio. It used to be each
   layout's own job, which is how two layouts never drew it at all and a 9:16
   put it under the project name. The layouts keep their hands off it now; the
   lockup is simply capped so it cannot reach this corner.

   The sizing is off W, not c.S, so the legal mark is the same fraction of
   every creative rather than tiny on one ratio and large on another. */
function crReraW(W){ return Math.round(W*0.33); }
function crReraTop(g,c,W,light){
  if(!c.rera&&!CR.qr)return;
  const S=W/1200, padX=W*.045, top=Math.round(W*.030);
  g.save();
  g.textAlign="right"; g.textBaseline="top";
  let right=W-padX;
  if(CR.qr){
    const q=Math.round(104*S), pad=Math.round(q*.07);
    g.fillStyle="#FFFFFF";
    g.fillRect(right-q-pad,top-pad,q+pad*2,q+pad*2);
    g.drawImage(CR.qr,right-q,top,q,q);
    right-=q+pad*2+12*S;
  }
  if(c.rera){
    /* No white plate. It read as a sticker pasted on the creative and it was
       the first thing called out. The mark is set straight onto the picture
       and carries a soft shadow of the opposite tone instead, which keeps it
       legible over a bright sky and over a dark one without boxing it in.
       The QR above keeps its white quiet zone — that one is not decoration,
       a scanner needs it. */
    const ls=15*S, ns=31*S, us=14*S;
    const num=String(c.rera);
    const x=right-(CR.qr?0:0);
    let y=top+3*S;
    g.shadowColor=light?"rgba(255,255,255,.85)":"rgba(0,0,0,.55)";
    g.shadowBlur=Math.max(2,6*S);
    const dim=light?"rgba(20,33,61,":"rgba(255,255,255,";
    g.fillStyle=dim+".66)"; g.font=F_B(500,ls);
    g.fillText("MahaRERA",x,y); y+=ls*1.25;
    g.fillStyle=light?"#14213D":"#FFFFFF"; g.font=F_H(700,ns);
    g.fillText(num,x,y); y+=ns*1.18;
    g.fillStyle=dim+".72)"; g.font=F_B(400,us);
    g.fillText("maharera.mahaonline.gov.in",x,y);
    g.shadowBlur=0;
  }
  g.restore();
}
/* how much of the foot the disclaimer needs. The band layouts put their price
   near the bottom edge, and without reserving this the two printed on top of
   each other. */
function crFootH(c){ return c.disc?Math.round(c.W*0.044):0; }
/* the disclaimer, its own thin strip at the very foot */
function crDiscFoot(g,c,W,H,light){
  if(!c.disc)return;
  /* a split layout has a dark half and a light half at the foot, so it says
     which box the disclaimer belongs in rather than taking the full width and
     landing invisible over the render */
  const box=c.footBox||{cx:W/2,w:W*.90,light:light};
  const S=W/1200, ds=14*S;
  g.save();
  g.font=F_B(400,ds);
  const d2=crFit(g,c.disc,g.font,box.w); g.font=F_B(400,d2);
  g.fillStyle=box.light?"rgba(20,33,61,.58)":"rgba(255,255,255,.70)";
  g.textAlign="center"; g.textBaseline="bottom";
  g.fillText(c.disc,box.cx,H-Math.round(W*.018));
  g.restore();
}
function crRenderOne(W,H){
  /* INK, PAPER and RED are read all over the layouts; the palette sets them
     for the duration of the render rather than threading four more arguments
     through every drawing primitive. */
  const P=crPalette();
  INK=P.ink; PAPER=P.paper; RED=P.pin;
  const F=crFontPair(); CR_DISP=F[3]; CR_BODY=F[4];
  const cv=document.createElement("canvas"); cv.width=W; cv.height=H;
  const g=cv.getContext("2d");
  g.fillStyle="#07090F"; g.fillRect(0,0,W,H);
  const id=crLayoutId();
  const c=crCtx(W,H);
  (CR_DRAW[id]||CR_DRAW.frame)(g,c);
  /* both of these belong to every layout equally, so neither is a layout's
     job: the legal mark top right, the disclaimer at the foot */
  const row=CR_LAYOUTS.find(r=>r[0]===id);
  crReraTop(g,c,W,!!(row&&row[4]));
  crDiscFoot(g,c,W,H,!!(row&&row[3]));
  return cv;
}


on("#crRender","click",async()=>{
  if(!HEROES.length)return toast("Upload at least one hero image first");
  /* a webfont that has not finished loading is silently swapped for the
     fallback mid-render, so it is waited for rather than hoped for */
  await crFontsReady();
  crFill();
  CR_OUT=[]; CR_SETS=[];
  const box=$("#crOut"); box.innerHTML="";
  const lg=dgLogo();
  let html="";
  HEROES.forEach((hero,hi)=>{
    /* the layout draws whatever CR.hero currently is, so each pass puts its
       own render there and takes it out again at the end */
    CR.hero=hero.img;
    const set={name:hero.name,images:{},thumb:"",sizes:[],layout:crLayoutId()};
    const mine=[];
    CR_SIZES.forEach(([name,w,h,ratio])=>{
      const c=crRenderOne(w,h);
      const url=c.toDataURL("image/jpeg",0.92);
      const bytes=Math.round((url.length-url.indexOf(",")-1)*3/4);
      const o={name,w,h,ratio,url,bytes,hero:hero.name,k:CR_OUT.length};
      CR_OUT.push(o); mine.push(o);
      const b64=url.split(",")[1];
      if(b64){ set.images[name]={data:b64}; set.sizes.push(name); }
      if(name==="square")set.thumb=url;
    });
    if(lg)set.images.logo=lg;
    if(!set.thumb)set.thumb=mine[0]?mine[0].url:"";
    CR_SETS.push(set);
    html+=`<div class="f-lab" style="margin:${hi?18:4}px 0 8px">
        <span class="tgt-kind k-city">AD ${hi+1}</span> ${esc(hero.name)}</div>`+
      `<div class="row2">`+mine.map(o=>`
      <div style="margin-bottom:14px">
        <img src="${o.url}" alt="${esc(o.name)}" data-k="${o.k}" class="cr-open"
          style="width:100%;border:1px solid var(--line);border-radius:11px;display:block">
        <div class="mini" style="margin-top:6px">${esc(o.name)} · ${o.w}×${o.h} · ${o.ratio}
          <span class="p-mute">${(o.bytes/1024).toFixed(0)} KB</span></div>
      </div>`).join("")+`</div>`;
  });
  CR.hero=HEROES[0].img;
  box.innerHTML=html;
  $("#crSizes").innerHTML=`<span class="pill p-ok">${HEROES.length} hero${
    HEROES.length===1?"":"es"} × 4 = ${CR_OUT.length} rendered</span>`;
  drawSets(); crChecks(); drawApSettings(); drawApPlan();
  logEvent("creative",`${HEROES.length} heroes, ${CR_OUT.length} sizes`);
});

