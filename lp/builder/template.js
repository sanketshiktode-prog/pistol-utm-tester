/* =====================================================================
   Landing Page Template Engine
   renderSite(cfg, resolve) -> { 'index.html', 'thank-you.html', 'privacy-policy.html' }
   `resolve(ref)` turns an asset reference into a URL (dataURL in preview,
   relative path "assets/xxx.webp" on export).
   Section order mirrors the reference microsite:
   Header > Hero (+ price card) > About > Pricing > Master Plan > Unit Plans >
   Amenities > Gallery > Location > Site Visit > FAQ > About Agent > Footer
   + desktop sticky side form, mobile bottom bar, enquiry modal, OTP step.
   ===================================================================== */
(function (global) {
  'use strict';

  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const nl2p = (s) => String(s || '').split(/\n{2,}/).map(p => p.trim()).filter(Boolean)
    .map(p => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('');
  const has = (a) => Array.isArray(a) && a.length > 0;
  const digits = (s) => String(s || '').replace(/[^\d]/g, '');
  const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const ICON = {
    phone: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1z"/></svg>',
    wa: '<svg viewBox="0 0 32 32" aria-hidden="true"><path fill="currentColor" d="M16 3a13 13 0 0 0-11.2 19.6L3 29l6.6-1.7A13 13 0 1 0 16 3zm0 23.7a10.7 10.7 0 0 1-5.5-1.5l-.4-.2-3.9 1 1-3.8-.3-.4A10.7 10.7 0 1 1 16 26.7zm5.9-8c-.3-.2-1.9-.9-2.2-1s-.5-.2-.7.2-.8 1-1 1.2-.4.2-.7 0a8.8 8.8 0 0 1-2.6-1.6 9.8 9.8 0 0 1-1.8-2.2c-.2-.3 0-.5.1-.7l.5-.6.3-.5a.6.6 0 0 0 0-.6l-1-2.4c-.3-.6-.5-.5-.7-.5h-.6a1.2 1.2 0 0 0-.9.4 3.6 3.6 0 0 0-1.1 2.7 6.3 6.3 0 0 0 1.3 3.3 14.4 14.4 0 0 0 5.5 4.9c2 .9 2.8.9 3.8.8a3.2 3.2 0 0 0 2.1-1.5 2.6 2.6 0 0 0 .2-1.5c-.1-.2-.3-.3-.6-.4z"/></svg>',
    check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/></svg>',
    pin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a7 7 0 0 0-7 7c0 5.3 7 13 7 13s7-7.7 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"/></svg>',
    lock: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M17 9h-1V7a4 4 0 0 0-8 0v2H7a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2zm-7-2a2 2 0 0 1 4 0v2h-4zm2 11a2 2 0 1 1 2-2 2 2 0 0 1-2 2z"/></svg>',
    mail: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm0 4-8 5-8-5V6l8 5 8-5z"/></svg>',
    close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M19 6.4 17.6 5 12 10.6 6.4 5 5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12z"/></svg>',
    arrowL: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M15.4 7.4 14 6l-6 6 6 6 1.4-1.4L10.8 12z"/></svg>',
    arrowR: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M8.6 16.6 10 18l6-6-6-6-1.4 1.4 4.6 4.6z"/></svg>',
    download: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M5 20h14v-2H5zm7-18-5.5 5.5 1.4 1.4L11 5.8V16h2V5.8l3.1 3.1 1.4-1.4z"/></svg>'
  };

  const COUNTRY_CODES = [
    ['+91', 'IN +91'], ['+971', 'AE +971'], ['+974', 'QA +974'], ['+966', 'SA +966'],
    ['+968', 'OM +968'], ['+973', 'BH +973'], ['+965', 'KW +965'], ['+1', 'US +1'],
    ['+44', 'UK +44'], ['+65', 'SG +65'], ['+61', 'AU +61'], ['+49', 'DE +49']
  ];

  function defaults(cfg) {
    const c = JSON.parse(JSON.stringify(cfg || {}));
    c.brand = Object.assign({ primary: '#0e5a43', accent: '#c8a24a', dark: '#14231d', font: 'Poppins' }, c.brand);
    c.project = Object.assign({ badge: 'New Launch', priceSuffix: 'Onwards', priceLabel: 'Starts at', stats: [], usps: [] }, c.project);
    c.contact = Object.assign({}, c.contact);
    c.lead = Object.assign({ popupDelay: 10, otp: false, exitIntent: true, countryCode: '+91' }, c.lead);
    c.tracking = Object.assign({}, c.tracking);
    c.sections = Object.assign({ about: 1, pricing: 1, masterplan: 1, unitplans: 1, amenities: 1, gallery: 1, location: 1, sitevisit: 1, faq: 1, agent: 1 }, c.sections);
    c.gating = Object.assign({ masterplan: true, unitplans: true, locationMap: true }, c.gating);
    c.meta = Object.assign({}, c.meta);
    c.agent = Object.assign({}, c.agent);
    return c;
  }

  /* ---------- head / tracking ---------- */
  function headTags(c, R, page) {
    const p = c.project, m = c.meta;
    const title = m.title || `${p.name} | ${p.location || ''} | Price, Floor Plans, Brochure`;
    const desc = m.description || `Explore ${p.name}${p.location ? ' at ' + p.location : ''}${p.developer ? ' by ' + p.developer : ''}. Get price list, brochure, floor plans & book your free site visit today.`;
    const og = m.ogImage ? R(m.ogImage, true) : (has(c.hero && c.hero.images) ? R(c.hero.images[0], true) : '');
    const canonical = m.domain ? `https://${m.domain.replace(/^https?:\/\//, '').replace(/\/$/, '')}/${page === 'index' ? '' : page + '.html'}` : '';
    const font = encodeURIComponent(c.brand.font || 'Poppins');
    const t = c.tracking;
    let h = `<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(page === 'index' ? title : (page === 'thank-you' ? 'Thank You | ' + p.name : 'Privacy Policy | ' + p.name))}</title>
<meta name="description" content="${esc(desc)}">
<meta name="robots" content="${page === 'thank-you' ? 'noindex, nofollow' : 'index, follow'}">
<meta name="theme-color" content="${esc(c.brand.primary)}">
${canonical ? `<link rel="canonical" href="${esc(canonical)}">` : ''}
<meta property="og:type" content="website"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}">
${og ? `<meta property="og:image" content="${esc(og)}"><meta name="twitter:image" content="${esc(og)}">` : ''}
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(title)}"><meta name="twitter:description" content="${esc(desc)}">
${c.brand.favicon ? `<link rel="icon" href="${esc(R(c.brand.favicon))}"><link rel="apple-touch-icon" href="${esc(R(c.brand.favicon))}">` : ''}
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=${font}:wght@300;400;500;600;700&display=swap" rel="stylesheet">`;
    h = h.replace('viewport-fit=cover', 'viewport-fit=cover');
    if (t.gtm) h += `\n<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${esc(t.gtm)}');</script>`;
    const gtagIds = [t.ga4, t.gadsId].filter(Boolean);
    if (gtagIds.length) h += `\n<script async src="https://www.googletagmanager.com/gtag/js?id=${esc(gtagIds[0])}"></script><script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());${gtagIds.map(id => `gtag('config','${esc(id)}');`).join('')}</script>`;
    if (t.metaPixel) h += `\n<script>!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${esc(t.metaPixel)}');fbq('track','PageView');</script>`;
    if (t.headCode) h += '\n' + t.headCode;
    return h;
  }
  const gtmBody = (c) => c.tracking.gtm ? `<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=${esc(c.tracking.gtm)}" height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>` : '';

  /* ---------- CSS ---------- */
  function css(c) {
    const b = c.brand;
    return `
:root{--p:${b.primary};--a:${b.accent};--d:${b.dark};--bg:#ffffff;--soft:#f5f7f6;--line:#e3e8e6;--txt:#1d2522;--mut:#5d6b66;--r:14px;--side:340px;--hh:68px}
*{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth;scroll-padding-top:calc(var(--hh) + 10px)}
body{font-family:'${esc(b.font)}',system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:var(--txt);background:var(--bg);line-height:1.6;-webkit-font-smoothing:antialiased;overflow-x:hidden}
img{max-width:100%;display:block}
a{color:inherit;text-decoration:none}
button,input,select,textarea{font:inherit;color:inherit}
svg{width:1em;height:1em;flex:none}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;border:0;cursor:pointer;border-radius:999px;padding:12px 22px;font-weight:600;font-size:15px;transition:transform .15s,box-shadow .2s,background .2s;white-space:nowrap}
.btn:active{transform:scale(.97)}
.btn-p{background:var(--p);color:#fff;box-shadow:0 6px 18px color-mix(in srgb,var(--p) 35%,transparent)}
.btn-p:hover{background:color-mix(in srgb,var(--p) 85%,#000)}
.btn-a{background:var(--a);color:#1a1405;box-shadow:0 6px 18px color-mix(in srgb,var(--a) 40%,transparent)}
.btn-a:hover{background:color-mix(in srgb,var(--a) 88%,#000)}
.btn-o{background:transparent;color:var(--p);border:1.5px solid var(--p)}
.btn-o:hover{background:var(--p);color:#fff}
.btn-w{background:#fff;color:var(--p)}
.btn-block{width:100%}
.pulse{animation:pulse 2s infinite}
@keyframes pulse{0%{box-shadow:0 0 0 0 color-mix(in srgb,var(--a) 70%,transparent)}70%{box-shadow:0 0 0 14px transparent}100%{box-shadow:0 0 0 0 transparent}}

/* header */
.hdr{position:fixed;inset:0 0 auto 0;height:var(--hh);background:#fff;z-index:50;box-shadow:0 1px 0 var(--line);transition:box-shadow .2s}
.hdr.sc{box-shadow:0 6px 24px rgba(0,0,0,.08)}
.hdr .in{height:100%;display:flex;align-items:center;gap:18px;padding:0 20px}
.logo img{height:46px;width:auto;object-fit:contain}
.logo .txt{font-weight:700;font-size:18px;color:var(--p)}
.nav{display:flex;gap:4px;margin-left:auto}
.nav a{padding:8px 10px;border-radius:8px;font-size:14px;font-weight:500;color:var(--mut);white-space:nowrap}
.nav a:hover,.nav a.on{color:var(--p);background:color-mix(in srgb,var(--p) 8%,transparent)}
.hdr .cta{display:flex;gap:8px;align-items:center}
.hdr .ph{display:flex;align-items:center;gap:6px;font-weight:600;color:var(--p);font-size:15px;white-space:nowrap}
@media(max-width:1380px){.hdr .ph span{display:none}.hdr .ph{width:40px;height:40px;border-radius:50%;justify-content:center;background:color-mix(in srgb,var(--p) 10%,transparent);font-size:18px}.hdr .cta .btn{padding:10px 16px;font-size:14px}}
@media(max-width:1240px) and (min-width:1100px){.nav a{padding:8px 7px;font-size:13px}}
.burger{display:none;background:none;border:0;width:40px;height:40px;cursor:pointer;margin-left:auto}
.burger span{display:block;width:22px;height:2px;background:var(--d);margin:5px auto;transition:.2s}
.mnav{display:none}

/* layout with desktop side form */
.wrap{padding-top:var(--hh)}
@media(min-width:1100px){.wrap{margin-right:var(--side)}.hdr{right:var(--side)}}
.side{display:none}
@media(min-width:1100px){
 .side{display:flex;flex-direction:column;position:fixed;top:0;right:0;bottom:0;width:var(--side);background:#fff;border-left:1px solid var(--line);z-index:60;overflow:auto}
 .side .top{background:var(--p);color:#fff;padding:14px 20px;display:flex;flex-direction:column;gap:8px}
 .side .top .row{display:flex;gap:8px}
 .side .top .btn{flex:1;padding:10px 12px;font-size:13px}
 .side .body{padding:20px}
 .side h3{font-size:18px;margin-bottom:4px}
 .side .sub{font-size:13px;color:var(--mut);margin-bottom:14px}
 .side .prom{margin-top:18px;border-top:1px dashed var(--line);padding-top:14px;display:grid;gap:8px;font-size:13px}
 .side .prom div{display:flex;gap:8px;align-items:center}
 .side .prom svg{color:var(--p);font-size:18px}
}

/* hero */
.hero{position:relative;min-height:calc(100svh - var(--hh));display:flex;align-items:stretch;overflow:hidden;background:var(--d)}
.hero .bg{position:absolute;inset:0}
.hero .bg img,.hero .bg video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0;transition:opacity 1.2s ease}
.hero .bg .on{opacity:1}
.hero::after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,rgba(0,0,0,.55) 0%,rgba(0,0,0,.15) 55%,rgba(0,0,0,0) 100%);pointer-events:none}
.hero .card{position:relative;z-index:2;margin:28px;align-self:center;width:min(420px,100%);background:rgba(255,255,255,.97);border-radius:18px;box-shadow:0 20px 60px rgba(0,0,0,.25);overflow:hidden;text-align:center}
.hero .badge{background:var(--p);color:#fff;font-size:12px;letter-spacing:.14em;text-transform:uppercase;font-weight:600;padding:8px}
.hero .ci{padding:18px 22px 20px}
.hero h1{font-size:26px;line-height:1.2;color:var(--d)}
.hero .loc{font-size:15px;color:var(--mut);margin-top:4px;display:flex;align-items:center;justify-content:center;gap:4px}
.hero .dev{font-size:13px;color:var(--p);font-weight:600;margin-top:2px}
.stats{display:grid;grid-template-columns:repeat(var(--n,2),1fr);margin:14px 0;border:1px solid var(--line);border-radius:10px;overflow:hidden}
.stats div{padding:8px 6px;border-right:1px solid var(--line)}
.stats div:last-child{border-right:0}
.stats b{display:block;font-size:16px;color:var(--d)}
.stats small{font-size:11px;color:var(--mut);text-transform:uppercase;letter-spacing:.05em}
.usps{list-style:none;display:grid;gap:6px;text-align:left;margin:12px 0}
.usps li{display:flex;gap:8px;align-items:flex-start;font-size:14px}
.usps svg{color:var(--p);margin-top:4px}
.pricebox{background:linear-gradient(135deg,color-mix(in srgb,var(--p) 10%,#fff),color-mix(in srgb,var(--a) 18%,#fff));border-radius:12px;padding:12px;margin:12px 0}
.pricebox .lbl{font-size:13px;color:var(--mut)}
.pricebox .amt{font-size:28px;font-weight:700;color:var(--p);line-height:1.2}
.pricebox .amt small{font-size:13px;color:var(--mut);font-weight:500}
.rera{font-size:11px;color:var(--mut);margin-top:10px;line-height:1.5}
.hero .row2{display:flex;gap:8px;margin-top:12px}
.hero .row2 .btn{flex:1;padding:10px;font-size:13px}
.offer{position:relative;z-index:3;background:var(--a);color:#1a1405;text-align:center;font-weight:600;font-size:14px;padding:8px 12px}
.dots{position:absolute;z-index:3;bottom:16px;right:20px;display:flex;gap:6px}
.dots button{width:9px;height:9px;border-radius:50%;border:0;background:rgba(255,255,255,.5);cursor:pointer}
.dots button.on{background:#fff;width:22px;border-radius:6px}

/* sections */
.sec{padding:64px 24px}
.sec:nth-of-type(even){background:var(--soft)}
.ct{max-width:1180px;margin:0 auto}
.st{text-align:center;margin-bottom:32px}
.st h2{font-size:clamp(22px,3vw,32px);line-height:1.25;color:var(--d)}
.st h2 span{color:var(--p)}
.st .bar{width:60px;height:3px;background:var(--a);margin:12px auto 0;border-radius:3px}
.st p{color:var(--mut);margin-top:10px}
.about{display:grid;grid-template-columns:1.1fr .9fr;gap:40px;align-items:center}
.about .txt p{margin-bottom:12px;color:#3a4541}
.about .more{max-height:210px;overflow:hidden;position:relative;transition:max-height .4s}
.about .more:not(.open)::after{content:"";position:absolute;left:0;right:0;bottom:0;height:70px;background:linear-gradient(transparent,var(--bg))}
.sec:nth-of-type(even) .about .more:not(.open)::after{background:linear-gradient(transparent,var(--soft))}
.linkbtn{display:block;background:none;border:0;color:var(--p);font-weight:600;cursor:pointer;margin:6px 0 16px;padding:0}
.about .img{border-radius:var(--r);overflow:hidden;box-shadow:0 16px 40px rgba(0,0,0,.12);aspect-ratio:4/3}
.about .img img{width:100%;height:100%;object-fit:cover}

.prices{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:18px}
.pc{background:#fff;border:1px solid var(--line);border-radius:var(--r);padding:22px;text-align:center;transition:transform .2s,box-shadow .2s;position:relative;overflow:hidden}
.pc::before{content:"";position:absolute;inset:0 0 auto 0;height:4px;background:linear-gradient(90deg,var(--p),var(--a))}
.pc:hover{transform:translateY(-4px);box-shadow:0 16px 36px rgba(0,0,0,.1)}
.pc .ty{font-size:20px;font-weight:700;color:var(--d)}
.pc .sz{font-size:14px;color:var(--mut);margin:4px 0 10px}
.pc .pr{font-size:20px;font-weight:700;color:var(--p);margin-bottom:14px;line-height:1.3}
.pc .btn{font-size:13px;padding:10px 12px;white-space:normal}
.pc .pr small{font-size:12px;color:var(--mut);font-weight:500}

.gate{position:relative;border-radius:var(--r);overflow:hidden;background:#dfe5e2;cursor:pointer}
.gate img{width:100%;height:100%;object-fit:cover;transition:filter .4s}
.gate.locked img{filter:blur(7px) saturate(.8);transform:scale(1.05)}
.gate .ov{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;background:rgba(0,0,0,.18)}
.gate:not(.locked) .ov{display:none}
.gate .ov .lk{width:48px;height:48px;border-radius:50%;background:#fff;color:var(--p);display:grid;place-items:center;font-size:22px}
.mp{max-width:980px;margin:0 auto;aspect-ratio:16/9}
.plans{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:18px}
.plan{background:#fff;border-radius:var(--r);border:1px solid var(--line);overflow:hidden}
.plan .gate{aspect-ratio:4/3;border-radius:0}
.plan .lb{padding:12px;text-align:center;font-weight:600}

.hs{position:relative}
.track{display:flex;gap:18px;overflow-x:auto;scroll-snap-type:x mandatory;padding:4px 2px 12px;scrollbar-width:none}
.track::-webkit-scrollbar{display:none}
.am{flex:0 0 calc((100% - 54px)/4);scroll-snap-align:start;border-radius:var(--r);overflow:hidden;position:relative;aspect-ratio:4/5;background:#ccc}
.am img{width:100%;height:100%;object-fit:cover;transition:transform .5s}
.am:hover img{transform:scale(1.06)}
.am span{position:absolute;inset:auto 0 0 0;padding:40px 14px 14px;color:#fff;font-weight:600;background:linear-gradient(transparent,rgba(0,0,0,.75))}
.am.noimg{background:#fff;border:1px solid var(--line);aspect-ratio:auto;display:flex;align-items:center;gap:10px;padding:16px}
.am.noimg span{position:static;background:none;color:var(--d);padding:0}
.am.noimg svg{color:var(--p);font-size:20px}
.arr{position:absolute;top:50%;transform:translateY(-50%);width:44px;height:44px;border-radius:50%;border:0;background:#fff;box-shadow:0 6px 18px rgba(0,0,0,.15);cursor:pointer;display:grid;place-items:center;font-size:22px;z-index:2;color:var(--d)}
.arr.l{left:-12px}.arr.r{right:-12px}

.tabs{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-bottom:22px}
.tabs button{border:1px solid var(--line);background:#fff;border-radius:999px;padding:8px 18px;cursor:pointer;font-weight:500;font-size:14px}
.tabs button.on{background:var(--p);color:#fff;border-color:var(--p)}
.gal{display:grid;grid-template-columns:repeat(4,1fr);grid-auto-rows:200px;gap:12px}
.gal a{border-radius:12px;overflow:hidden;position:relative}
.gal a:first-child{grid-column:span 2;grid-row:span 2}
.gal img{width:100%;height:100%;object-fit:cover;transition:transform .5s}
.gal a:hover img{transform:scale(1.06)}
.gal a[hidden]{display:none}

.locg{display:grid;grid-template-columns:1.1fr .9fr;gap:30px;align-items:start}
.locg .gate,.locg iframe{aspect-ratio:4/3;width:100%;border:0;border-radius:var(--r)}
.conn{list-style:none;display:grid;gap:10px;max-height:460px;overflow:auto;padding-right:6px}
.conn li{display:flex;justify-content:space-between;gap:12px;background:#fff;border:1px solid var(--line);border-radius:10px;padding:12px 14px;font-size:14px}
.conn li span{display:flex;gap:8px;align-items:center}
.conn li svg{color:var(--p)}
.conn li b{color:var(--p);white-space:nowrap}

.sv{display:grid;grid-template-columns:1fr 1fr;border-radius:20px;overflow:hidden;background:#fff;box-shadow:0 20px 50px rgba(0,0,0,.1);max-width:1000px;margin:0 auto}
.sv .im{min-height:360px;background:var(--p) center/cover}
.sv .fm{padding:32px}
.sv h3{font-size:24px;color:var(--d)}
.sv p{color:var(--mut);font-size:14px;margin:4px 0 18px}

.faq{max-width:860px;margin:0 auto;display:grid;gap:10px}
.faq details{background:#fff;border:1px solid var(--line);border-radius:12px;padding:0 18px}
.faq summary{cursor:pointer;padding:16px 0;font-weight:600;list-style:none;display:flex;justify-content:space-between;gap:12px}
.faq summary::after{content:"+";color:var(--p);font-size:22px;line-height:1}
.faq details[open] summary::after{content:"–"}
.faq details p{padding-bottom:16px;color:var(--mut)}

.agent{max-width:900px;margin:0 auto;text-align:center}
.agent p{color:#3a4541}
.agent .reg{margin-top:14px;font-size:13px;color:var(--mut)}

/* forms */
.lf{display:grid;gap:12px}
.fld{position:relative}
.fld input,.fld select,.fld textarea{width:100%;border:1.5px solid var(--line);border-radius:10px;padding:12px 14px;background:#fff;font-size:15px;outline:none;transition:border-color .2s}
.fld input:focus,.fld select:focus,.fld textarea:focus{border-color:var(--p)}
.phn{display:flex;gap:8px}
.phn select{width:108px;flex:none;padding:12px 8px}
.fld.err input,.fld.err select{border-color:#d33}
.fld .em{display:none;color:#d33;font-size:12px;margin-top:4px}
.fld.err .em{display:block}
.cons{display:flex;gap:8px;font-size:11px;color:var(--mut);line-height:1.45;align-items:flex-start}
.cons input{margin-top:2px;accent-color:var(--p);flex:none}
.cons a{color:var(--p);text-decoration:underline}
.hp{position:absolute!important;left:-9999px!important;opacity:0}
.lf .btn[disabled]{opacity:.7;pointer-events:none}
.fmsg{font-size:13px;text-align:center}
.fmsg.bad{color:#d33}
.otp{display:none}
.lf.otp-mode>*:not(.otp):not(.fmsg){display:none}
.lf.otp-mode .otp{display:grid;gap:12px}
.otp p{font-size:13px;color:var(--mut)}
.otp input{width:100%;border:1.5px solid var(--line);border-radius:10px;padding:12px;outline:none;letter-spacing:.5em;text-align:center;font-size:20px;font-weight:600}
.otp input:focus{border-color:var(--p)}

/* modal */
.mdl{position:fixed;inset:0;z-index:100;display:none;align-items:center;justify-content:center;padding:16px;background:rgba(10,20,16,.6);backdrop-filter:blur(3px)}
.mdl.open{display:flex;animation:fi .25s}
@keyframes fi{from{opacity:0}to{opacity:1}}
.mdl .box{background:#fff;border-radius:18px;width:min(760px,100%);display:grid;grid-template-columns:.85fr 1.15fr;overflow:hidden;position:relative;max-height:calc(100svh - 32px);animation:su .3s}
@keyframes su{from{transform:translateY(20px)}to{transform:none}}
.mdl .lp{background:linear-gradient(160deg,var(--p),color-mix(in srgb,var(--p) 60%,#000));color:#fff;padding:28px 24px;display:flex;flex-direction:column;gap:16px}
.mdl .lp h4{font-size:15px;opacity:.85;text-transform:uppercase;letter-spacing:.1em}
.mdl .lp ul{list-style:none;display:grid;gap:12px}
.mdl .lp li{display:flex;gap:10px;align-items:center;font-size:15px}
.mdl .lp li i{width:34px;height:34px;border-radius:50%;background:rgba(255,255,255,.15);display:grid;place-items:center;font-style:normal;font-size:16px}
.mdl .lp .ctx{margin-top:auto;background:rgba(255,255,255,.1);border-radius:12px;padding:12px;font-size:13px}
.mdl .lp .ctx b{display:block;font-size:14px;margin-bottom:4px}
.mdl .rp{padding:28px 24px;overflow:auto}
.mdl .rp h3{font-size:20px;color:var(--d)}
.mdl .rp .sub{font-size:13px;color:var(--mut);margin:2px 0 16px}
.mdl .x{position:absolute;top:10px;right:10px;width:36px;height:36px;border-radius:50%;border:0;background:var(--soft);cursor:pointer;display:grid;place-items:center;font-size:20px;z-index:2}
.lbx{position:fixed;inset:0;z-index:110;background:rgba(0,0,0,.92);display:none;align-items:center;justify-content:center}
.lbx.open{display:flex}
.lbx img{max-width:92vw;max-height:86vh;border-radius:8px}
.lbx button{position:absolute;background:rgba(255,255,255,.15);border:0;color:#fff;width:48px;height:48px;border-radius:50%;cursor:pointer;display:grid;place-items:center;font-size:26px}
.lbx .x{top:16px;right:16px}.lbx .pv{left:16px;top:50%}.lbx .nx{right:16px;top:50%}

/* footer */
footer{background:var(--d);color:rgba(255,255,255,.75);padding:44px 24px 110px;font-size:13px}
footer .ct{display:grid;gap:22px}
footer .top{display:flex;justify-content:space-between;align-items:center;gap:20px;flex-wrap:wrap}
footer .flogo img{height:50px;width:auto;background:#fff;border-radius:8px;padding:6px}
footer .qr img{width:96px;height:96px;background:#fff;border-radius:8px;padding:4px}
footer .reg b{color:#fff}
footer .disc{font-size:11.5px;line-height:1.7;opacity:.8}
footer .bt{border-top:1px solid rgba(255,255,255,.12);padding-top:16px;display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap}
footer a{text-decoration:underline}
@media(min-width:1100px){footer{padding-bottom:44px;margin-right:var(--side)}}

/* floating + mobile bar */
.fwa{position:fixed;right:calc(var(--side) + 20px);bottom:24px;width:56px;height:56px;border-radius:50%;background:#25d366;color:#fff;display:grid;place-items:center;font-size:30px;box-shadow:0 10px 24px rgba(37,211,102,.45);z-index:40}
.mbar{display:none}
@media(max-width:1099px){.fwa{display:none}}

/* responsive */
@media(max-width:1099px){
 .nav,.hdr .cta .ph{display:none}
 .burger{display:block}
 .hdr .cta{display:none}
 .mnav{position:fixed;top:var(--hh);left:0;right:0;background:#fff;box-shadow:0 20px 30px rgba(0,0,0,.12);z-index:49;flex-direction:column;padding:8px 16px 16px}
 .mnav.open{display:flex}
 .mnav a{padding:12px 6px;border-bottom:1px solid var(--line);font-weight:500}
 .mbar{display:grid;grid-template-columns:1fr 1.3fr 1fr;position:fixed;left:0;right:0;bottom:0;z-index:45;background:#fff;box-shadow:0 -6px 20px rgba(0,0,0,.1);padding-bottom:env(safe-area-inset-bottom)}
 .mbar a,.mbar button{display:flex;align-items:center;justify-content:center;gap:6px;padding:14px 6px;font-weight:600;font-size:14px;border:0;background:none;cursor:pointer}
 .mbar .e{background:var(--p);color:#fff}
 .mbar .w{color:#128c4b}
 .mbar .c{color:var(--p)}
 .mbar.two{grid-template-columns:1fr 1fr}
 .mbar .v{background:var(--a);color:#1a1405}
 .mbar.two button{font-size:14px;padding:15px 6px;white-space:nowrap}
 .am{flex-basis:calc((100% - 18px)/2)}
}
@media(max-width:860px){
 .hero{flex-direction:column;min-height:auto}
 .hero .bg{position:relative;height:56vw;min-height:240px;max-height:420px}
 .hero::after{display:none}
 .hero{background:var(--bg)}
 .hero .card{margin:-50px 14px 20px;width:auto;align-self:stretch}
 .dots{top:14px;bottom:auto}
 .about,.locg,.sv{grid-template-columns:1fr}
 .about .img{order:-1}
 .sv .im{min-height:200px}
 .gal{grid-template-columns:repeat(2,1fr);grid-auto-rows:150px}
 .sec{padding:48px 16px}
 .mdl{padding:0;align-items:flex-end}
 .mdl .box{grid-template-columns:1fr;border-radius:18px 18px 0 0;max-height:94svh}
 .mdl .lp{padding:18px 20px;gap:10px}
 .mdl .lp ul{grid-template-columns:repeat(3,1fr);gap:6px}
 .mdl .lp li{flex-direction:column;text-align:center;font-size:12px;gap:4px}
 .mdl .lp .ctx,.mdl .lp h4{display:none}
 .arr{display:none}
}
@media(max-width:520px){
 .am{flex-basis:78%}
 .hero h1{font-size:23px}
 .logo img{height:38px}
}
@media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
`;
  }

  /* ---------- form markup ---------- */
  function formHTML(c, id, source, btn) {
    const cc = c.lead.countryCode || '+91';
    const opts = COUNTRY_CODES.map(([v, l]) => `<option value="${v}"${v === cc ? ' selected' : ''}>${l}</option>`).join('');
    const cfgOpts = has(c.pricing && c.pricing.rows)
      ? [...new Set(c.pricing.rows.map(r => r.type).filter(Boolean))] : [];
    const privacy = c.meta.privacyUrl || 'privacy-policy.html';
    const agent = c.agent.name || 'the advertiser';
    return `<form class="lf" id="${id}" data-source="${esc(source)}" novalidate>
  <div class="fld"><input name="name" type="text" placeholder="Full Name*" autocomplete="name" required maxlength="80"><div class="em">Please enter your name</div></div>
  <div class="fld"><div class="phn"><select name="cc" aria-label="Country code">${opts}</select><input name="phone" type="tel" inputmode="numeric" placeholder="Mobile Number*" autocomplete="tel-national" required maxlength="15"></div><div class="em">Please enter a valid mobile number</div></div>
  <div class="fld"><input name="email" type="email" placeholder="Email Address${c.lead.emailRequired ? '*' : ' (optional)'}" autocomplete="email"${c.lead.emailRequired ? ' required' : ''} maxlength="120"><div class="em">Please enter a valid email</div></div>
  ${c.lead.askConfig && cfgOpts.length ? `<div class="fld"><select name="config"><option value="">Interested In</option>${cfgOpts.map(o => `<option>${esc(o)}</option>`).join('')}</select></div>` : ''}
  <input class="hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
  <label class="cons"><input type="checkbox" name="consent" checked required><span>I consent to the processing of provided data according to <a href="${esc(privacy)}" target="_blank" rel="noopener">Privacy Policy | Terms &amp; Conditions</a>. I authorize ${esc(agent)} and its representatives to Call, SMS, Email or WhatsApp me about its products and offers. This consent overrides any registration for DNC/NDNC.</span></label>
  <button class="btn btn-p btn-block" type="submit">${esc(btn || 'Submit')}</button>
  <div class="otp"><p>Enter the 4-digit OTP sent to <b class="otp-no"></b></p><input name="otp" inputmode="numeric" maxlength="6" placeholder="• • • •" autocomplete="one-time-code"><button class="btn btn-p btn-block otp-go" type="button">Verify &amp; Submit</button><button class="linkbtn otp-re" type="button">Resend OTP</button></div>
  <div class="fmsg" role="status"></div>
</form>`;
  }

  /* ---------- sections ---------- */
  function renderIndex(c, R) {
    const p = c.project, ct = c.contact, S = c.sections;
    const name = p.name || 'Project Name';
    const titleSuffix = (t) => `${esc(p.shortName || name)} <span>${esc(t)}</span>`;
    const tel = digits(ct.phone);
    const waNum = digits(ct.whatsapp || ct.phone);
    const waText = ct.whatsappText || `Hi! I'm interested in ${name}${p.developer ? ' by ' + p.developer : ''}${p.location ? ' at ' + p.location : ''}. Please share details.`;
    const waHref = waNum ? `https://wa.me/${waNum}?text=${encodeURIComponent(waText)}` : '#';
    const heroImgs = (c.hero && c.hero.images) || [];
    const nav = [
      ['home', 'Home', true], ['pricing', 'Price', S.pricing && has(c.pricing && c.pricing.rows)],
      ['plans', 'Site Plan', (S.masterplan && has(c.masterPlan && c.masterPlan.images)) || (S.unitplans && has(c.unitPlans))],
      ['amenities', 'Amenities', S.amenities && has(c.amenities)], ['gallery', 'Gallery', S.gallery && has(c.gallery)],
      ['location', 'Location', S.location && ((c.location && has(c.location.items)) || (c.location && (c.location.mapImage || c.location.mapEmbed)))],
      ['faq', 'FAQs', S.faq && has(c.faq)]
    ].filter(n => n[2]);
    const cta = (label, ctx, cls = 'btn btn-p') => `<button class="${cls}" type="button" data-enq="${esc(ctx)}">${label}</button>`;
    const logo = c.brand.logo ? `<img src="${esc(R(c.brand.logo))}" alt="${esc(name)} logo" width="160" height="46">` : `<span class="txt">${esc(name)}</span>`;

    let html = '';
    // HEADER
    html += `<header class="hdr" id="hdr"><div class="in">
  <a class="logo" href="#home">${logo}</a>
  <nav class="nav" aria-label="Primary">${nav.map(n => `<a href="#${n[0]}">${n[1]}</a>`).join('')}${c.lead.brochure !== false ? `<a href="#" data-enq="brochure">Brochure</a>` : ''}</nav>
  <div class="cta">${tel ? `<a class="ph" href="tel:+${tel}" data-track="call" aria-label="Call">${ICON.phone}<span>${esc(ct.phone)}</span></a>` : ''}${cta('Enquire Now', 'enquire', 'btn btn-a pulse')}</div>
  <button class="burger" id="burger" aria-label="Menu"><span></span><span></span><span></span></button>
</div></header>
<nav class="mnav" id="mnav">${nav.map(n => `<a href="#${n[0]}">${n[1]}</a>`).join('')}<a href="#" data-enq="brochure">Download Brochure</a>${tel ? `<a href="tel:+${tel}">${ICON.phone} ${esc(ct.phone)}</a>` : ''}</nav>`;

    // SIDE FORM (desktop)
    html += `<aside class="side" aria-label="Enquiry">
  <div class="top"><div class="row">${cta('Organize Site Visit', 'sitevisit', 'btn btn-a')}${tel ? `<a class="btn btn-w" href="tel:+${tel}" data-track="call">${ICON.phone} Call</a>` : ''}</div>${cta(`${ICON.download} Download Brochure`, 'brochure', 'btn btn-w')}</div>
  <div class="body"><h3>Request Call Back</h3><div class="sub">Get the best price &amp; offers directly from our experts</div>${formHTML(c, 'f-side', 'side-form', 'Get Call Back')}
  <div class="prom"><div>${ICON.check} Instant Call Back</div><div>${ICON.check} Free Site Visit</div><div>${ICON.check} Best Price Guaranteed</div></div></div>
</aside>`;

    html += `<main class="wrap">`;
    // HERO
    const stats = (p.stats || []).filter(s => s && (s.label || s.value));
    html += `${p.offer ? `<div class="offer">${esc(p.offer)}</div>` : ''}<section class="hero" id="home">
  <div class="bg" id="heroBg">${c.hero && c.hero.video ? `<video class="on" src="${esc(R(c.hero.video))}" autoplay muted loop playsinline ${heroImgs[0] ? `poster="${esc(R(heroImgs[0]))}"` : ''}></video>` :
      heroImgs.map((im, i) => `<img src="${esc(R(im))}" alt="${esc(name)} ${i ? 'view ' + (i + 1) : 'elevation'}" ${i === 0 ? 'class="on" fetchpriority="high"' : 'loading="lazy"'} decoding="async">`).join('')}</div>
  ${!(c.hero && c.hero.video) && heroImgs.length > 1 ? `<div class="dots" id="heroDots">${heroImgs.map((_, i) => `<button aria-label="Slide ${i + 1}" ${i === 0 ? 'class="on"' : ''}></button>`).join('')}</div>` : ''}
  <div class="card">
    ${p.badge ? `<div class="badge">${esc(p.badge)}</div>` : ''}
    <div class="ci">
      <h1>${esc(name)}</h1>
      ${p.location ? `<div class="loc">${ICON.pin} ${esc(p.location)}</div>` : ''}
      ${p.developer ? `<div class="dev">By ${esc(p.developer)}</div>` : ''}
      ${stats.length ? `<div class="stats" style="--n:${Math.min(stats.length, 3)}">${stats.slice(0, 3).map(s => `<div><b>${esc(s.value)}</b><small>${esc(s.label)}</small></div>`).join('')}</div>` : ''}
      ${has(p.usps) ? `<ul class="usps">${p.usps.filter(Boolean).map(u => `<li>${ICON.check}<span>${esc(u)}</span></li>`).join('')}</ul>` : ''}
      ${p.price ? `<div class="pricebox"><div class="lbl">${esc(p.priceLabel)}</div><div class="amt">${esc(p.price)} <small>${esc(p.priceSuffix)}</small></div></div>` : ''}
      ${cta('Enquire Now', 'enquire', 'btn btn-a btn-block pulse')}
      <div class="row2">${cta('Site Visit', 'sitevisit', 'btn btn-o')}${tel ? `<a class="btn btn-p" href="tel:+${tel}" data-track="call">${ICON.phone} Call Now</a>` : ''}</div>
      ${p.reraProject || c.agent.rera ? `<div class="rera">${p.reraProject ? `${esc(p.reraLabel || 'RERA')}: ${esc(p.reraProject)}` : ''}${p.reraProject && c.agent.rera ? '<br>' : ''}${c.agent.rera ? `Agent ${esc(p.reraLabel || 'RERA')} No.: ${esc(c.agent.rera)}` : ''}</div>` : ''}
    </div>
  </div>
</section>`;

    // ABOUT
    if (S.about && c.about && c.about.text) {
      const long = c.about.text.length > 700;
      html += `<section class="sec" id="about"><div class="ct"><div class="st"><h2>About <span>${esc(name)}</span></h2><div class="bar"></div></div>
<div class="about"><div class="txt"><div class="more${long ? '' : ' open'}" id="aboutMore">${nl2p(c.about.text)}</div>${long ? `<button class="linkbtn" id="aboutBtn" type="button">Read more</button>` : ''}
${cta(`${ICON.download} Download Brochure`, 'brochure', 'btn btn-p')}</div>
${c.about.image ? `<div class="img"><img src="${esc(R(c.about.image))}" alt="${esc(name)} overview" loading="lazy" decoding="async"></div>` : ''}</div></div></section>`;
    }

    // PRICING
    if (S.pricing && has(c.pricing && c.pricing.rows)) {
      html += `<section class="sec" id="pricing"><div class="ct"><div class="st"><h2>${titleSuffix('Area & Pricing')}</h2><div class="bar"></div>${c.pricing.note ? `<p>${esc(c.pricing.note)}</p>` : ''}</div>
<div class="prices">${c.pricing.rows.map(r => `<div class="pc"><div class="ty">${esc(r.type)}</div><div class="sz">${esc(r.size)}</div><div class="pr">${esc(r.price)} <small>${r.price && !/on\s*request/i.test(r.price) ? 'Onwards' : ''}</small></div>${cta('Complete Costing Details', 'costing:' + (r.type || '') + ' ' + (r.size || ''), 'btn btn-o btn-block')}</div>`).join('')}</div>
</div></section>`;
    }

    // MASTER PLAN + UNIT PLANS
    const mpImgs = (c.masterPlan && c.masterPlan.images) || [];
    const ups = (c.unitPlans || []).filter(u => u && u.image);
    if ((S.masterplan && mpImgs.length) || (S.unitplans && ups.length)) {
      html += `<section class="sec" id="plans"><div class="ct">`;
      if (S.masterplan && mpImgs.length) {
        const g = c.gating.masterplan;
        html += `<div class="st"><h2>${titleSuffix('Master Plan')}</h2><div class="bar"></div></div>
<div class="gate mp${g ? ' locked' : ''}" ${g ? 'data-enq="masterplan"' : `data-lb="${esc(R(mpImgs[0]))}"`}><img src="${esc(R(mpImgs[0]))}" alt="${esc(name)} master plan" loading="lazy" decoding="async"><div class="ov"><div class="lk">${ICON.lock}</div><span class="btn btn-a">Request Master Plan Layout</span></div></div>`;
      }
      if (S.unitplans && ups.length) {
        const g = c.gating.unitplans;
        html += `<div class="st" style="margin-top:${mpImgs.length && S.masterplan ? '56px' : '0'}"><h2>${titleSuffix(c.unitPlansTitle || 'Floor Plans')}</h2><div class="bar"></div></div>
<div class="plans">${ups.map(u => `<div class="plan"><div class="gate${g ? ' locked' : ''}" ${g ? `data-enq="unitplan:${esc(u.label || '')}"` : `data-lb="${esc(R(u.image))}"`}><img src="${esc(R(u.image))}" alt="${esc(name)} ${esc(u.label || 'unit plan')}" loading="lazy" decoding="async"><div class="ov"><div class="lk">${ICON.lock}</div><span class="btn btn-a">Request Unit Plan</span></div></div><div class="lb">${esc(u.label || '')}</div></div>`).join('')}</div>`;
      }
      html += `</div></section>`;
    }

    // AMENITIES
    if (S.amenities && has(c.amenities)) {
      html += `<section class="sec" id="amenities"><div class="ct"><div class="st"><h2>${titleSuffix('Amenities')}</h2><div class="bar"></div></div>
<div class="hs"><button class="arr l" type="button" data-scroll="-1" aria-label="Previous">${ICON.arrowL}</button><div class="track" id="amTrack">${c.amenities.filter(a => a && a.name).map(a => a.image ? `<div class="am"><img src="${esc(R(a.image))}" alt="${esc(a.name)} at ${esc(name)}" loading="lazy" decoding="async"><span>${esc(a.name)}</span></div>` : `<div class="am noimg">${ICON.check}<span>${esc(a.name)}</span></div>`).join('')}</div><button class="arr r" type="button" data-scroll="1" aria-label="Next">${ICON.arrowR}</button></div>
<div style="text-align:center;margin-top:18px">${cta('Get Complete Amenities List', 'amenities', 'btn btn-p')}</div></div></section>`;
    }

    // GALLERY
    if (S.gallery && has(c.gallery)) {
      const cats = [...new Set(c.gallery.map(g => g.category || 'Gallery'))];
      html += `<section class="sec" id="gallery"><div class="ct"><div class="st"><h2>${titleSuffix('Gallery')}</h2><div class="bar"></div></div>
${cats.length > 1 ? `<div class="tabs" id="galTabs"><button class="on" data-cat="*">All</button>${cats.map(k => `<button data-cat="${esc(slug(k))}">${esc(k)}</button>`).join('')}</div>` : ''}
<div class="gal" id="gal">${c.gallery.filter(g => g.image).map((g, i) => `<a href="${esc(R(g.image))}" data-cat="${esc(slug(g.category || 'Gallery'))}" data-i="${i}"><img src="${esc(R(g.image))}" alt="${esc(name)} ${esc(g.category || '')} image ${i + 1}" loading="lazy" decoding="async"></a>`).join('')}</div></div></section>`;
    }

    // LOCATION
    const L = c.location || {};
    if (S.location && (has(L.items) || L.mapImage || L.mapEmbed)) {
      let map = '';
      if (L.mapEmbed) {
        const src = /src="([^"]+)"/.exec(L.mapEmbed);
        map = `<iframe src="${esc(src ? src[1] : L.mapEmbed)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade" title="${esc(name)} location map" allowfullscreen></iframe>`;
      } else if (L.mapImage) {
        const g = c.gating.locationMap;
        map = `<div class="gate${g ? ' locked' : ''}" ${g ? 'data-enq="location"' : `data-lb="${esc(R(L.mapImage))}"`}><img src="${esc(R(L.mapImage))}" alt="${esc(name)} location map" loading="lazy" decoding="async"><div class="ov"><div class="lk">${ICON.lock}</div><span class="btn btn-a">Request Location Map</span></div></div>`;
      }
      html += `<section class="sec" id="location"><div class="ct"><div class="st"><h2>${titleSuffix('Location Advantage')}</h2><div class="bar"></div>${L.address ? `<p>${ICON.pin} ${esc(L.address)}</p>` : ''}</div>
<div class="locg"${map ? '' : ' style="grid-template-columns:1fr"'}>${map ? `<div>${map}</div>` : ''}<div>${has(L.items) ? `<ul class="conn">${L.items.filter(i => i && i.place).map(i => `<li><span>${ICON.pin}${esc(i.place)}</span><b>${esc(i.distance || '')}</b></li>`).join('')}</ul>` : ''}
<div style="margin-top:16px">${cta('Request Location Details', 'location', 'btn btn-p btn-block')}</div></div></div></div></section>`;
    }

    // SITE VISIT
    if (S.sitevisit) {
      const svImg = (c.siteVisit && c.siteVisit.image) || heroImgs[1] || heroImgs[0];
      html += `<section class="sec" id="visit"><div class="ct"><div class="sv"><div class="im" role="img" aria-label="Site visit" ${svImg ? `style="background-image:url('${esc(R(svImg))}')"` : ''}></div>
<div class="fm"><h3>Schedule a Site Visit</h3><p>Free pick-up &amp; drop · Meet our relationship manager at site</p>${formHTML(c, 'f-visit', 'site-visit-form', 'Book Free Site Visit')}</div></div></div></section>`;
    }

    // FAQ
    if (S.faq && has(c.faq)) {
      html += `<section class="sec" id="faq"><div class="ct"><div class="st"><h2>Frequently Asked <span>Questions</span></h2><div class="bar"></div></div>
<div class="faq">${c.faq.filter(f => f && f.q).map((f, i) => `<details${i === 0 ? ' open' : ''}><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join('')}</div></div></section>`;
    }

    // AGENT
    if (S.agent && (c.agent.about || c.agent.name)) {
      html += `<section class="sec" id="agent"><div class="ct agent"><div class="st"><h2>About <span>${esc(c.agent.name || '')}</span></h2><div class="bar"></div></div>
${nl2p(c.agent.about)}${c.agent.rera || c.agent.gst ? `<div class="reg">${c.agent.rera ? `${esc(p.reraLabel || 'RERA')} Authorised Advertiser: ${esc(c.agent.name || '')}, Registration No. ${esc(c.agent.rera)}` : ''}${c.agent.gst ? ` · GST: ${esc(c.agent.gst)}` : ''}</div>` : ''}</div></section>`;
    }
    html += `</main>`;

    // FOOTER
    const year = new Date().getFullYear();
    html += `<footer class="wrapf"><div class="ct">
<div class="top"><div class="flogo">${c.brand.logo ? `<img src="${esc(R(c.brand.logo))}" alt="${esc(name)} logo" loading="lazy">` : `<b style="color:#fff;font-size:18px">${esc(name)}</b>`}</div>
${c.agent.qr ? `<div class="qr"><img src="${esc(R(c.agent.qr))}" alt="QR code for ${esc(name)}" loading="lazy"></div>` : ''}</div>
<div class="reg">${c.agent.rera ? `<b>Agent ${esc(p.reraLabel || 'RERA')} No.:</b> ${esc(c.agent.rera)} &nbsp; ` : ''}${p.reraProject ? `<b>Project ${esc(p.reraLabel || 'RERA')} No.:</b> ${esc(p.reraProject)}` : ''}${p.reraUrl ? ` (<a href="${esc(p.reraUrl)}" target="_blank" rel="noopener">${esc(p.reraUrl.replace(/^https?:\/\//, ''))}</a>)` : ''}</div>
<div class="disc"><b>Disclaimer:</b> ${esc(c.meta.disclaimer || defaultDisclaimer(c))}</div>
<div class="bt"><a href="${esc(c.meta.privacyUrl || 'privacy-policy.html')}">Privacy Policy | Terms &amp; Conditions</a><span>All Rights Reserved. © ${year} ${esc(c.agent.name || name)}</span></div>
</div></footer>`;

    // FLOATING / MOBILE BAR
    html += `${waNum ? `<a class="fwa" href="${esc(waHref)}" target="_blank" rel="noopener" aria-label="WhatsApp" data-track="whatsapp">${ICON.wa}</a>` : ''}
${!/^call/i.test(c.lead.mobileBar || '')
      ? `<div class="mbar two"><button class="e" type="button" data-enq="enquire">${ICON.mail} Enquire Now</button><button class="v" type="button" data-enq="sitevisit">${ICON.pin} Schedule Site Visit</button></div>`
      : `<div class="mbar">${tel ? `<a class="c" href="tel:+${tel}" data-track="call">${ICON.phone} Call</a>` : '<span></span>'}<button class="e" type="button" data-enq="enquire">${ICON.mail} Enquire Now</button>${waNum ? `<a class="w" href="${esc(waHref)}" target="_blank" rel="noopener" data-track="whatsapp">${ICON.wa} WhatsApp</a>` : '<span></span>'}</div>`}`;

    // MODAL
    html += `<div class="mdl" id="mdl" role="dialog" aria-modal="true" aria-labelledby="mdlT"><div class="box"><button class="x" type="button" data-close aria-label="Close">${ICON.close}</button>
<div class="lp"><h4>We Promise</h4><ul><li><i>📞</i><span><b>Instant</b> Call Back</span></li><li><i>🚗</i><span><b>Free</b> Site Visit</span></li><li><i>₹</i><span><b>Unmatched</b> Price</span></li></ul><div class="ctx" id="mdlCtx"></div></div>
<div class="rp"><h3 id="mdlT">Enquire Now</h3><div class="sub" id="mdlS">Share your details and our expert will call you back shortly.</div>${formHTML(c, 'f-modal', 'popup', 'Submit')}</div></div></div>
<div class="lbx" id="lbx"><button class="x" type="button" aria-label="Close">${ICON.close}</button><button class="pv" type="button" aria-label="Previous">${ICON.arrowL}</button><img alt=""><button class="nx" type="button" aria-label="Next">${ICON.arrowR}</button></div>`;

    const runtimeCfg = {
      api: (c.lead.apiUrl || '').replace(/\/$/, ''),
      project: name, code: c.lead.projectCode || slug(name), developer: p.developer || '', location: p.location || '',
      otp: !!c.lead.otp, popup: Number(c.lead.popupDelay) || 0, exit: c.lead.exitIntent !== false,
      brochure: c.lead.brochureUrl ? R(c.lead.brochureUrl) : '', thanks: c.lead.noRedirect ? '' : 'thank-you.html',
      unlockOnSubmit: true, preview: !!c.__preview
    };
    const ld = {
      '@context': 'https://schema.org', '@type': 'Residence', name,
      description: (c.about && c.about.text || '').slice(0, 300),
      address: { '@type': 'PostalAddress', addressLocality: p.city || p.location || '', addressCountry: p.country || 'IN' },
      image: heroImgs[0] && !c.__preview ? R(heroImgs[0], true) : undefined
    };
    const faqLd = has(c.faq) ? { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: c.faq.filter(f => f.q).map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) } : null;

    return `<!doctype html><html lang="en"><head>
${headTags(c, R, 'index')}
<style>${css(c)}</style>
<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>
${faqLd ? `<script type="application/ld+json">${JSON.stringify(faqLd).replace(/</g, '\\u003c')}</script>` : ''}
</head><body>${gtmBody(c)}
${html}
<script>window.LP=${JSON.stringify(runtimeCfg).replace(/</g, '\\u003c')};</script>
<script>${RUNTIME}</script>
${c.tracking.bodyCode || ''}
</body></html>`;
  }

  function defaultDisclaimer(c) {
    const a = c.agent.name || 'the advertiser';
    return `The information provided on this website is intended exclusively for informational purposes and should not be construed as an offer of services. This site is managed by a RERA authorised real estate agent, namely ${a}. Pricing information presented on this website is subject to alteration without advance notification, and the assurance of property availability cannot be guaranteed. Images showcased on this website are for representational purposes only and may not accurately reflect the actual properties. We may share your data with RERA-registered developers for further processing as necessary, and may send updates to the mobile number or email address registered with us. For accurate and up-to-date information regarding pricing, availability and other details, please contact us directly.`;
  }

  /* ---------- landing page runtime (vanilla JS, ~7KB) ---------- */
  const RUNTIME = `(function(){'use strict';
var C=window.LP||{},d=document,$=function(s,r){return(r||d).querySelector(s)},$$=function(s,r){return Array.prototype.slice.call((r||d).querySelectorAll(s))};
function ss(k,v){try{if(v===undefined)return sessionStorage.getItem(k);sessionStorage.setItem(k,v)}catch(e){return null}}
function ls(k,v){try{if(v===undefined)return localStorage.getItem(k);localStorage.setItem(k,v)}catch(e){return null}}
function dl(o){window.dataLayer=window.dataLayer||[];window.dataLayer.push(o)}
/* attribution capture (first touch per session) */
var q=new URLSearchParams(location.search),adk=/^(utm_|gclid$|gbraid$|wbraid$|fbclid$|msclkid$|campaignid$|adgroupid$|extensionid$|creative$|keyword$|matchtype$|network$|device$|placement$|adposition$|targetid$|strategy$|loc_physical|loc_interest|adgroup$|ad$|campaign$|source$|source_key$|ads_id$|ads_group_id$|ads_extension_id$|ads_set_name$|campaign_id$|campaign_name$|keyword_type$|physical_location$|ad_strategy$)/i;
var attr={};try{attr=JSON.parse(ss('lp_attr')||'{}')}catch(e){}
var fresh=false;q.forEach(function(v,k){if(v&&adk.test(k))fresh=true});
if(fresh)attr={};var n=0;q.forEach(function(v,k){if(v&&n<60){attr[k.slice(0,40)]=v.slice(0,300);n++}});
if(fresh||!attr.landing_url){attr.landing_url=location.href;attr.referrer=d.referrer||''}ss('lp_attr',JSON.stringify(attr));
/* header */
var hdr=$('#hdr');addEventListener('scroll',function(){hdr&&hdr.classList.toggle('sc',scrollY>10)},{passive:true});
var bg=$('#burger'),mn=$('#mnav');bg&&bg.addEventListener('click',function(){mn.classList.toggle('open')});$$('#mnav a').forEach(function(a){a.addEventListener('click',function(){mn.classList.remove('open')})});
/* nav highlight */
if('IntersectionObserver' in window){var links=$$('.nav a[href^="#"]');var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){links.forEach(function(l){l.classList.toggle('on',l.getAttribute('href')==='#'+e.target.id)})}})},{rootMargin:'-45% 0px -50% 0px'});$$('main section[id]').forEach(function(s){io.observe(s)})}
/* hero slider */
var hs=$$('#heroBg img'),dots=$$('#heroDots button'),hi=0,ht;function go(i){if(!hs.length)return;hs[hi].classList.remove('on');dots[hi]&&dots[hi].classList.remove('on');hi=(i+hs.length)%hs.length;hs[hi].classList.add('on');dots[hi]&&dots[hi].classList.add('on')}
if(hs.length>1){ht=setInterval(function(){go(hi+1)},5000);dots.forEach(function(b,i){b.addEventListener('click',function(){clearInterval(ht);go(i)})})}
/* about read more */
var ab=$('#aboutBtn');ab&&ab.addEventListener('click',function(){var m=$('#aboutMore');m.classList.toggle('open');ab.textContent=m.classList.contains('open')?'Read less':'Read more';m.style.maxHeight=m.classList.contains('open')?m.scrollHeight+'px':''});
/* amenities scroller */
$$('[data-scroll]').forEach(function(b){b.addEventListener('click',function(){var t=$('#amTrack');t.scrollBy({left:t.clientWidth*0.8*Number(b.dataset.scroll),behavior:'smooth'})})});
/* gallery tabs + lightbox */
$$('#galTabs button').forEach(function(b){b.addEventListener('click',function(){$$('#galTabs button').forEach(function(x){x.classList.toggle('on',x===b)});$$('#gal a').forEach(function(a){a.hidden=!(b.dataset.cat==='*'||a.dataset.cat===b.dataset.cat)})})});
var lb=$('#lbx'),li=$('#lbx img'),set=[],si=0;function lbo(list,i){set=list;si=i;li.src=set[si];lb.classList.add('open')}function lbm(n){si=(si+n+set.length)%set.length;li.src=set[si]}
$$('#gal a').forEach(function(a){a.addEventListener('click',function(e){e.preventDefault();var vis=$$('#gal a').filter(function(x){return!x.hidden});lbo(vis.map(function(x){return x.getAttribute('href')}),vis.indexOf(a))})});
d.addEventListener('click',function(e){var g=e.target.closest('[data-lb]');if(g&&!g.classList.contains('locked'))lbo([g.dataset.lb],0)});
if(lb){$('.x',lb).onclick=function(){lb.classList.remove('open')};$('.pv',lb).onclick=function(){lbm(-1)};$('.nx',lb).onclick=function(){lbm(1)};lb.addEventListener('click',function(e){if(e.target===lb)lb.classList.remove('open')})}
/* gated content */
function unlock(){$$('.gate.locked').forEach(function(g){g.classList.remove('locked');g.removeAttribute('data-enq');g.dataset.lb=$('img',g).getAttribute('src')})}
if(ls('lp_unlocked_'+C.code))unlock();
/* modal */
var M=$('#mdl'),CTX={enquire:['Enquire Now','Share your details and our expert will call you back shortly.','Get the best price','Pre-launch offers, availability & payment plans'],brochure:['Download Brochure','Get the e-brochure instantly on WhatsApp & email.','Descriptive brochure','Lifestyle · Master plan · Gallery · Floor plans'],sitevisit:['Book a Free Site Visit','Free pick-up & drop. Pick a slot that suits you.','Free site visit','Guided tour with our relationship manager'],costing:['Get Complete Costing','Receive the detailed price breakup for this configuration.','Price breakup','Base price · Charges · Payment plan'],masterplan:['Request Master Plan','Unlock the detailed master plan layout.','Master plan layout','Tower positions, open spaces & amenities'],unitplan:['Request Unit Plan','Unlock detailed floor plans with carpet areas.','Floor plans','Room dimensions & carpet areas'],location:['Request Location Details','Get the location map and nearby landmarks.','Location advantage','Connectivity, schools, hospitals, offices'],amenities:['Get Amenities List','Receive the full list of lifestyle amenities.','Lifestyle amenities','Clubhouse, sports & leisure facilities'],popup:['Get Exclusive Offers','Register now for the best launch price & offers.','Limited period offers','Pre-launch price · Flexible payment plan']};
var mctx='enquire';function openM(ctx){ctx=ctx||'enquire';mctx=ctx;var base=ctx.split(':')[0],t=CTX[base]||CTX.enquire,det=ctx.indexOf(':')>-1?ctx.split(':').slice(1).join(':').trim():'';$('#mdlT').textContent=t[0];$('#mdlS').textContent=det?t[1]+' ('+det+')':t[1];$('#mdlCtx').innerHTML='<b>'+t[2]+'</b>'+t[3];var f=$('#f-modal');f.dataset.source=ctx;$('button[type=submit]',f).textContent=base==='brochure'?'Download Now':base==='sitevisit'?'Book Site Visit':'Submit';M.classList.add('open');d.body.style.overflow='hidden';ss('lp_popup','1');dl({event:'lp_modal_open',lp_context:ctx});setTimeout(function(){var n=$('input[name=name]',f);n&&innerWidth>860&&n.focus()},200)}
function closeM(){M.classList.remove('open');d.body.style.overflow=''}
d.addEventListener('click',function(e){var b=e.target.closest('[data-enq]');if(b){e.preventDefault();openM(b.dataset.enq);mn&&mn.classList.remove('open')}if(e.target===M||e.target.closest('[data-close]'))closeM();var t=e.target.closest('[data-track]');if(t)dl({event:'lp_click_'+t.dataset.track})});
d.addEventListener('keydown',function(e){if(e.key==='Escape'){closeM();lb&&lb.classList.remove('open')}});
if(C.popup>0&&!ss('lp_popup')&&!ls('lp_done_'+C.code))setTimeout(function(){if(!ss('lp_popup')&&!M.classList.contains('open'))openM('popup')},C.popup*1000);
if(C.exit&&innerWidth>1024)d.addEventListener('mouseout',function(e){if(!e.relatedTarget&&e.clientY<5&&!ss('lp_exit')&&!ls('lp_done_'+C.code)&&!M.classList.contains('open')){ss('lp_exit','1');openM('popup')}});
/* forms */
function vPhone(cc,p){p=p.replace(/\\D/g,'');if(cc==='+91'){p=p.replace(/^(91|0)(?=\\d{10}$)/,'');return/^[6-9]\\d{9}$/.test(p)?p:null}return p.length>=6&&p.length<=13?p:null}
function err(f,n,on){var el=f.elements[n];if(!el)return;var w=el.closest('.fld');w&&w.classList.toggle('err',!!on)}
function msg(f,t,bad){var m=$('.fmsg',f);m.textContent=t||'';m.classList.toggle('bad',!!bad)}
function post(path,body){return fetch(C.api.indexOf('.php')>-1?C.api+(C.api.indexOf('?')>-1?'&':'?')+'r='+encodeURIComponent(path):C.api+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}).then(function(r){return r.json().catch(function(){return{}}).then(function(j){if(!r.ok||j.ok===false)throw new Error(j.error||('HTTP '+r.status));return j})})}
function done(f,src,lead){ls('lp_done_'+C.code,'1');ls('lp_unlocked_'+C.code,'1');unlock();dl({event:'lead_submit',lp_form:f.id,lp_source:src,lp_project:C.code,lead_id:lead&&lead.id});try{window.fbq&&fbq('track','Lead',{content_name:C.project})}catch(e){}
var base=String(src).split(':')[0];if(C.thanks&&!C.preview){location.href=C.thanks+'?src='+encodeURIComponent(base)+(lead&&lead.id?'&lid='+encodeURIComponent(lead.id):'');return}
msg(f,'Thank you! Our expert will call you shortly.');if(base==='brochure'&&C.brochure)window.open(C.brochure,'_blank');setTimeout(function(){closeM();msg(f,'');f.reset();f.classList.remove('otp-mode')},2200)}
$$('form.lf').forEach(function(f){var btn=$('button[type=submit]',f),lead=null;
function phoneFull(){return f.elements.cc.value+vPhone(f.elements.cc.value,f.elements.phone.value)}
f.addEventListener('input',function(e){if(e.target.name)err(f,e.target.name,false)});
f.addEventListener('submit',function(e){e.preventDefault();msg(f,'');var ok=true,nm=f.elements.name.value.trim(),cc=f.elements.cc.value,ph=vPhone(cc,f.elements.phone.value),em=f.elements.email.value.trim();
if(nm.length<2||/\\d/.test(nm)){err(f,'name',1);ok=false}if(!ph){err(f,'phone',1);ok=false}if((em||f.elements.email.required)&&!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}$/.test(em)){err(f,'email',1);ok=false}
if(!f.elements.consent.checked){msg(f,'Please accept the consent to proceed',1);ok=false}if(!ok)return;
if(f.elements.website.value)return done(f,f.dataset.source,null);
var src=f.dataset.source||'form',body={project_code:C.code,project_name:C.project,developer:C.developer,location:C.location,name:nm,country_code:cc,phone:ph,email:em,config:f.elements.config?f.elements.config.value:'',form_source:src,otp:C.otp,page_url:location.href,attribution:JSON.parse(ss('lp_attr')||'{}'),screen:innerWidth+'x'+innerHeight};
if(!C.api){console.warn('[LP] No API URL configured - lead not stored',body);return done(f,src,null)}
btn.disabled=true;btn.dataset.t=btn.textContent;btn.textContent='Please wait...';
post('/api/leads',body).then(function(j){lead=j;if(j.otp_required){f.classList.add('otp-mode');$('.otp-no',f).textContent=cc+' '+ph;var o=f.elements.otp;o.value='';setTimeout(function(){o.focus()},100)}else done(f,src,j)}).catch(function(x){msg(f,'Something went wrong. Please call us or try again.',1);console.error(x)}).then(function(){btn.disabled=false;btn.textContent=btn.dataset.t})});
var go=$('.otp-go',f),re=$('.otp-re',f);
go&&go.addEventListener('click',function(){var o=f.elements.otp.value.replace(/\\D/g,'');if(o.length<4){msg(f,'Enter the OTP',1);return}go.disabled=true;post('/api/otp/verify',{lead_id:lead.id,token:lead.token,otp:o}).then(function(){done(f,f.dataset.source,lead)}).catch(function(x){msg(f,x.message==='invalid_otp'?'Incorrect OTP, please try again':'Could not verify OTP',1)}).then(function(){go.disabled=false})});
re&&re.addEventListener('click',function(){post('/api/otp/resend',{lead_id:lead.id,token:lead.token}).then(function(){msg(f,'OTP resent')}).catch(function(){msg(f,'Please wait before resending',1)})})});
})();`;

  /* ---------- thank you ---------- */
  function renderThanks(c, R) {
    const p = c.project, t = c.tracking, tel = digits(c.contact.phone);
    const waNum = digits(c.contact.whatsapp || c.contact.phone);
    const bro = c.lead.brochureUrl ? R(c.lead.brochureUrl) : '';
    const conv = t.gadsId && t.gadsLabel ? `gtag('event','conversion',{send_to:'${esc(t.gadsId)}/${esc(t.gadsLabel)}',transaction_id:new URLSearchParams(location.search).get('lid')||''});` : '';
    return `<!doctype html><html lang="en"><head>${headTags(c, R, 'thank-you')}
<style>:root{--p:${c.brand.primary};--a:${c.brand.accent}}*{box-sizing:border-box;margin:0}body{font-family:'${esc(c.brand.font)}',system-ui,sans-serif;min-height:100svh;display:grid;place-items:center;background:linear-gradient(160deg,color-mix(in srgb,var(--p) 12%,#fff),#fff);padding:20px;color:#1d2522}
.c{background:#fff;max-width:520px;width:100%;border-radius:20px;box-shadow:0 20px 60px rgba(0,0,0,.1);padding:40px 28px;text-align:center}.ok{width:76px;height:76px;border-radius:50%;background:var(--p);color:#fff;display:grid;place-items:center;margin:0 auto 18px;font-size:38px}
img.l{height:48px;margin:0 auto 18px;display:block}h1{font-size:26px;margin-bottom:8px}p{color:#5d6b66;line-height:1.6}.b{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:24px}
a.btn{display:inline-flex;align-items:center;gap:6px;padding:12px 20px;border-radius:999px;font-weight:600;text-decoration:none;background:var(--p);color:#fff}a.o{background:#fff;color:var(--p);border:1.5px solid var(--p)}a.w{background:#25d366}</style>
</head><body>${gtmBody(c)}
<div class="c">${c.brand.logo ? `<img class="l" src="${esc(R(c.brand.logo))}" alt="${esc(p.name)}">` : ''}<div class="ok">✓</div>
<h1>Thank You!</h1><p>Your enquiry for <b>${esc(p.name)}</b> has been received. Our property expert will call you within the next 30 minutes.</p>
<div class="b">${bro ? `<a class="btn" id="bro" href="${esc(bro)}" target="_blank" rel="noopener" style="display:none">⬇ Download Brochure</a>` : ''}${tel ? `<a class="btn o" href="tel:+${tel}">📞 Call Now</a>` : ''}${waNum ? `<a class="btn w" href="https://wa.me/${waNum}?text=${encodeURIComponent('Hi, I just enquired for ' + p.name + '. Please share details.')}" target="_blank" rel="noopener">WhatsApp</a>` : ''}<a class="btn o" href="./">← Back to site</a></div></div>
<script>(function(){var q=new URLSearchParams(location.search);var b=document.getElementById('bro');if(b&&q.get('src')==='brochure'){b.style.display='inline-flex';}else if(b){b.style.display='inline-flex';b.textContent='⬇ Brochure'}
window.dataLayer=window.dataLayer||[];dataLayer.push({event:'lead_thankyou',lp_source:q.get('src')||'',lead_id:q.get('lid')||''});${conv ? `try{${conv}}catch(e){}` : ''}})();</script>
${t.thankYouCode || ''}</body></html>`;
  }

  function renderPrivacy(c, R) {
    const a = c.agent.name || 'the advertiser', p = c.project;
    return `<!doctype html><html lang="en"><head>${headTags(c, R, 'privacy-policy')}
<style>body{font-family:'${esc(c.brand.font)}',system-ui,sans-serif;max-width:860px;margin:0 auto;padding:40px 20px;line-height:1.7;color:#1d2522}h1{color:${esc(c.brand.primary)};margin-bottom:16px}h2{font-size:18px;margin:22px 0 6px}a{color:${esc(c.brand.primary)}}</style></head><body>
<p><a href="./">← Back to ${esc(p.name)}</a></p><h1>Privacy Policy &amp; Terms</h1>
${c.meta.privacyText ? nl2p(c.meta.privacyText) : `
<p>This website is operated by ${esc(a)} ("we", "us"). By submitting your details on this website you agree to the terms below.</p>
<h2>Information we collect</h2><p>Name, mobile number, email address, your property preferences and technical information such as pages visited, campaign source (UTM parameters), device and browser details.</p>
<h2>How we use it</h2><p>To respond to your enquiry, share project information, arrange site visits, and send you updates and offers by call, SMS, email or WhatsApp. Your consent to be contacted overrides any registration on the DNC/NDNC registry.</p>
<h2>Sharing</h2><p>We may share your details with the RERA-registered developer of the project you enquired about, and with service providers that help us operate (CRM, telephony, messaging). We do not sell your personal data.</p>
<h2>Retention &amp; your rights</h2><p>We retain data only as long as needed for the purposes above or as required by law. You may request access, correction or deletion of your data by contacting us.</p>
<h2>Disclaimer</h2><p>${esc(c.meta.disclaimer || defaultDisclaimer(c))}</p>`}
</body></html>`;
  }

  function renderSite(cfg, resolve) {
    const c = defaults(cfg);
    const R = (ref, abs) => {
      const u = resolve(ref);
      if (abs && u && !/^(https?:|data:)/.test(u) && c.meta.domain) return `https://${c.meta.domain.replace(/^https?:\/\//, '').replace(/\/$/, '')}/${u}`;
      return u || '';
    };
    return {
      'index.html': renderIndex(c, R),
      'thank-you.html': renderThanks(c, R),
      'privacy-policy.html': renderPrivacy(c, R)
    };
  }

  global.LPTemplate = { renderSite, defaults, slug };
})(typeof window !== 'undefined' ? window : globalThis);
