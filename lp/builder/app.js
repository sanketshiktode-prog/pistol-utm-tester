/* =====================================================================
   LP Builder — app logic
   - Schema-driven form -> cfg object
   - Images compressed client-side (WebP) and stored as assets
   - Projects autosaved in IndexedDB (multiple projects)
   - Live preview (iframe srcdoc) + ZIP / single-HTML export
   ===================================================================== */
(function () {
  'use strict';
  const $ = (s, r) => (r || document).querySelector(s);
  const el = (tag, attrs, ...kids) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (k === 'class') n.className = v;
      else if (k === 'html') n.innerHTML = v;
      else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
      else if (v !== undefined && v !== null && v !== false) n.setAttribute(k, v === true ? '' : v);
    }
    kids.flat().forEach(k => k != null && n.append(k.nodeType ? k : document.createTextNode(k)));
    return n;
  };
  const uid = () => Math.random().toString(36).slice(2, 10);
  const getP = (o, p) => p.split('.').reduce((a, k) => (a == null ? undefined : a[k]), o);
  const setP = (o, p, v) => { const ks = p.split('.'); let a = o; ks.slice(0, -1).forEach(k => { if (a[k] == null || typeof a[k] !== 'object') a[k] = {}; a = a[k]; }); a[ks[ks.length - 1]] = v; };
  const toast = (m, ms = 2600) => { const t = $('#toast'); t.textContent = m; t.classList.add('on'); clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('on'), ms); };

  /* ---------------- state ---------------- */
  let P = null; // current project {id,name,updated,cfg,assets}
  const blank = () => ({
    project: { stats: [], usps: [], badge: 'New Launch', priceLabel: 'Starts at', priceSuffix: 'Onwards', reraLabel: 'RERA' },
    brand: { primary: '#0e5a43', accent: '#c8a24a', dark: '#14231d', font: 'Poppins' },
    hero: { images: [] }, about: {}, pricing: { rows: [] }, masterPlan: { images: [] }, unitPlans: [],
    amenities: [], gallery: [], location: { items: [] }, siteVisit: {}, faq: [], contact: {}, agent: {},
    lead: { popupDelay: 10, exitIntent: true, otp: false, countryCode: '+91', hosting: 'cPanel / PHP hosting', crm: 'TeleCRM', mobileBar: 'Enquire Now + Schedule Site Visit' }, tracking: {}, meta: {},
    gating: { masterplan: true, unitplans: true, locationMap: true },
    sections: { about: 1, pricing: 1, masterplan: 1, unitplans: 1, amenities: 1, gallery: 1, location: 1, sitevisit: 1, faq: 1, agent: 1 }
  });
  const newProject = (name) => ({ id: uid(), name: name || 'Untitled project', updated: Date.now(), cfg: blank(), assets: {} });

  /* ---------------- IndexedDB ---------------- */
  const DB = {
    db: null,
    open() {
      return new Promise((res) => {
        try {
          const r = indexedDB.open('lp-builder', 1);
          r.onupgradeneeded = () => r.result.createObjectStore('projects', { keyPath: 'id' });
          r.onsuccess = () => { this.db = r.result; res(true); };
          r.onerror = () => res(false);
        } catch (e) { res(false); }
      });
    },
    tx(mode) { return this.db.transaction('projects', mode).objectStore('projects'); },
    all() { return new Promise(res => { if (!this.db) return res([]); const r = this.tx('readonly').getAll(); r.onsuccess = () => res(r.result || []); r.onerror = () => res([]); }); },
    put(p) { return new Promise(res => { if (!this.db) return res(false); const r = this.tx('readwrite').put(p); r.onsuccess = () => res(true); r.onerror = () => res(false); }); },
    del(id) { return new Promise(res => { if (!this.db) return res(false); const r = this.tx('readwrite').delete(id); r.onsuccess = () => res(true); r.onerror = () => res(false); }); }
  };
  let saveT;
  function touch() {
    P.updated = Date.now();
    P.name = getP(P.cfg, 'project.name') || P.name;
    clearTimeout(saveT);
    saveT = setTimeout(async () => {
      const ok = await DB.put(P);
      pushBack();        /* keep what Trigger can pull in step with the form */
      $('#savedAt').textContent = ok ? 'Saved ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Not saved (storage blocked) — use Save .json';
      try { localStorage.setItem('lpb_last', P.id); } catch (e) {}
      refreshProjects();
    }, 600);
    schedulePreview();
    updateScore();
  }

  /* ---------------- images ---------------- */
  const readAsDataURL = (f) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f); });
  const loadImg = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
  async function processImage(file, maxW = 1600, opts = {}) {
    const raw = await readAsDataURL(file);
    if (/svg|gif/.test(file.type) || opts.raw) return { data: raw, mime: file.type, ext: (file.name.split('.').pop() || 'bin').toLowerCase() };
    const img = await loadImg(raw);
    let w = img.naturalWidth, h = img.naturalHeight;
    if (opts.square) { w = h = opts.square; }
    else if (w > maxW) { h = Math.round(h * maxW / w); w = maxW; }
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const cx = cv.getContext('2d');
    if (opts.square) {
      const s = Math.min(img.naturalWidth, img.naturalHeight);
      cx.drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 2, s, s, 0, 0, w, h);
    } else cx.drawImage(img, 0, 0, w, h);
    if (opts.png) return { data: cv.toDataURL('image/png'), mime: 'image/png', ext: 'png' };
    let data = cv.toDataURL('image/webp', opts.q || 0.82), mime = 'image/webp', ext = 'webp';
    if (!data.startsWith('data:image/webp')) { data = cv.toDataURL('image/jpeg', 0.82); mime = 'image/jpeg'; ext = 'jpg'; }
    return { data, mime, ext };
  }
  async function addAsset(file, maxW, opts) {
    const r = await processImage(file, maxW, opts);
    const id = uid();
    const base = (file.name || 'image').replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40) || 'img';
    P.assets[id] = { name: `${base}-${id}.${r.ext}`, mime: r.mime, data: r.data };
    return 'a:' + id;
  }
  const pick = (accept, multiple) => new Promise(res => {
    const i = el('input', { type: 'file', accept, multiple: multiple || undefined });
    i.onchange = () => res(Array.from(i.files || [])); i.click();
  });
  const refURL = (ref) => (typeof ref === 'string' && ref.startsWith('a:')) ? (P.assets[ref.slice(2)] || {}).data || '' : (ref || '');
  function gcAssets() {
    const json = JSON.stringify(P.cfg);
    Object.keys(P.assets).forEach(id => { if (!json.includes('a:' + id)) delete P.assets[id]; });
  }

  /* placeholder generator for sample */
  function placeholder(label, w, h, hue) {
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const c = cv.getContext('2d');
    const g = c.createLinearGradient(0, 0, w, h); g.addColorStop(0, `hsl(${hue},45%,38%)`); g.addColorStop(1, `hsl(${(hue + 40) % 360},50%,62%)`);
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    c.fillStyle = 'rgba(255,255,255,.08)'; for (let i = 0; i < 9; i++) { c.beginPath(); c.arc(Math.random() * w, Math.random() * h, 40 + Math.random() * w / 5, 0, 7); c.fill(); }
    c.fillStyle = 'rgba(255,255,255,.92)'; c.font = `600 ${Math.round(Math.min(w, h) / 11)}px Poppins, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(label, w / 2, h / 2);
    const id = uid(); P.assets[id] = { name: `${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${id}.jpg`, mime: 'image/jpeg', data: cv.toDataURL('image/jpeg', .8) };
    return 'a:' + id;
  }
  function logoPH(text) {
    const cv = document.createElement('canvas'); cv.width = 420; cv.height = 120; const c = cv.getContext('2d');
    c.fillStyle = '#0e5a43'; c.beginPath(); c.moveTo(20, 100); c.lineTo(60, 20); c.lineTo(100, 100); c.fill();
    c.fillStyle = '#c8a24a'; c.beginPath(); c.moveTo(55, 100); c.lineTo(85, 45); c.lineTo(115, 100); c.fill();
    c.fillStyle = '#14231d'; c.font = '700 34px Poppins, sans-serif'; c.textBaseline = 'middle'; c.fillText(text, 130, 50);
    c.fillStyle = '#5d6b66'; c.font = '500 18px Poppins, sans-serif'; c.fillText('ESTATE · NAGPUR', 132, 86);
    const id = uid(); P.assets[id] = { name: `logo-${id}.png`, mime: 'image/png', data: cv.toDataURL('image/png') }; return 'a:' + id;
  }

  /* ---------------- form schema ---------------- */
  const FONTS = ['Poppins', 'Montserrat', 'Inter', 'Lato', 'Open Sans', 'Raleway', 'Playfair Display', 'Nunito Sans', 'DM Sans', 'Outfit', 'Jost', 'Manrope'];
  const SCHEMA = [
    { title: 'Project Basics', hint: 'Hero card content', open: true, fields: [
      { k: 'project.name', l: 'Project Name *', ph: 'Godrej Rivershore Estate' },
      { row: [{ k: 'project.developer', l: 'Developer', ph: 'Godrej Properties' }, { k: 'project.badge', l: 'Badge', ph: 'New Launch' }] },
      { row: [{ k: 'project.location', l: 'Location line', ph: 'Samruddhi Mahamarg, Nagpur' }, { k: 'project.city', l: 'City', ph: 'Nagpur' }] },
      { k: 'project.shortName', l: 'Section heading prefix', ph: 'Godrej Samruddhi Mahamarg', hint: 'Used in headings like "<prefix> Area & Pricing" — put your SEO keyword here. Defaults to project name.' },
      { row: [{ k: 'project.priceLabel', l: 'Price label', ph: 'Premium Plots Starts at' }, { k: 'project.price', l: 'Starting price', ph: '₹ 55 Lacs*' }] },
      { row: [{ k: 'project.priceSuffix', l: 'Price suffix', ph: 'Onwards' }, { k: 'project.offer', l: 'Offer strip (top)', ph: 'Pre-launch offer: 20:40:40' }] },
      { k: 'project.stats', l: 'Key stats (max 3 shown)', type: 'list', sub: [{ k: 'value', ph: '115 Acres' }, { k: 'label', ph: 'Land Parcel' }] },
      { k: 'project.usps', l: 'USP bullets', type: 'list', simple: true, ph: 'Gated & planned infrastructure', bulk: 'One USP per line' },
      { row: [{ k: 'project.reraLabel', l: 'RERA label', type: 'select', opts: ['RERA', 'MahaRERA', 'K-RERA', 'HRERA', 'UP-RERA', 'TS-RERA', 'GujRERA', 'TNRERA', 'RERA (DLD)'] }, { k: 'project.reraProject', l: 'Project RERA No.', ph: 'PP1190002600809' }] },
      { k: 'project.reraUrl', l: 'RERA website', ph: 'https://maharera.maharashtra.gov.in/' }
    ] },
    { title: 'Branding', hint: 'Logo, favicon, colours', fields: [
      { k: 'brand.logo', l: 'Logo', type: 'image', max: 600, contain: true, keepPng: true },
      { k: 'brand.favicon', l: 'Favicon', type: 'image', square: 192, contain: true, hint: 'Square image, auto-resized to 192×192 PNG' },
      { row: [{ k: 'brand.primary', l: 'Primary colour', type: 'color' }, { k: 'brand.accent', l: 'Accent (CTA) colour', type: 'color' }] },
      { row: [{ k: 'brand.dark', l: 'Dark (footer/text)', type: 'color' }, { k: 'brand.font', l: 'Font', type: 'select', opts: FONTS }] }
    ] },
    { title: 'Hero Banner', hint: 'Slider images or video', fields: [
      { k: 'hero.images', l: 'Hero images (slider)', type: 'images', max: 1920, hint: 'Landscape 1920×1080 recommended. First image loads first — make it the best one.' },
      { k: 'hero.video', l: 'Hero video (optional, replaces slider)', type: 'file', accept: 'video/mp4,video/webm', hint: 'MP4 under ~8 MB, or paste a URL.' }
    ] },
    { title: 'About Project', fields: [
      { k: 'about.possession', l: 'Possession', ph: 'December 2028', hint: 'Answers the possession FAQ. Left empty, that question is dropped rather than guessed.' },
      { k: 'about.text', l: 'About text', type: 'textarea', rows: 7, hint: 'Blank line = new paragraph. Long text gets a "Read more".' },
      { k: 'about.image', l: 'About image', type: 'image', max: 1400 }
    ] },
    { title: 'Area & Pricing', fields: [
      { k: 'pricing.rows', l: 'Configurations', type: 'list', sub: [{ k: 'type', ph: '2 BHK / Plot' }, { k: 'size', ph: '750 sq.ft.' }, { k: 'price', ph: '₹ 1.2 Cr*' }], bulk: 'One per line: Type | Size | Price', parse: l => { const [type, size, price] = l.split('|').map(s => s.trim()); return { type, size, price }; } },
      { k: 'pricing.note', l: 'Note under heading', ph: 'All-inclusive price breakup on request' }
    ] },
    { title: 'Master Plan & Floor Plans', fields: [
      { k: 'masterPlan.images', l: 'Master plan', type: 'images', max: 2000, single: true },
      { k: 'gating.masterplan', l: 'Blur master plan until lead submits', type: 'check' },
      { k: 'unitPlansTitle', l: 'Floor plan section title', ph: 'Floor Plans' },
      { k: 'unitPlans', l: 'Unit / floor plans', type: 'list', sub: [{ k: 'image', type: 'image', max: 1600 }, { k: 'label', ph: '2 BHK – 750 sq.ft.' }], multiAdd: 'image' },
      { k: 'gating.unitplans', l: 'Blur floor plans until lead submits', type: 'check' }
    ] },
    { title: 'Amenities', fields: [
      { k: 'amenities', l: 'Amenities', type: 'list', sub: [{ k: 'image', type: 'image', max: 900 }, { k: 'name', ph: 'Swimming Pool' }], bulk: 'One amenity name per line (add photos after)', parse: l => ({ name: l.trim() }), multiAdd: 'image', hint: 'Amenities without a photo render as icon tiles.' }
    ] },
    { title: 'Gallery', fields: [
      { k: 'gallery', l: 'Gallery images', type: 'list', sub: [{ k: 'image', type: 'image', max: 1600 }, { k: 'category', type: 'select', opts: ['Exterior', 'Interior', 'Amenities', 'Actual Site', 'Sample Flat', 'Gallery'] }], multiAdd: 'image', hint: 'Multiple categories create filter tabs.' }
    ] },
    { title: 'Location', fields: [
      { k: 'location.address', l: 'Address line', ph: 'Hingna, Nagpur, Maharashtra' },
      { k: 'location.mapEmbed', l: 'Google Map embed (iframe code or URL)', type: 'textarea', rows: 2, hint: 'Google Maps → Share → Embed a map → copy HTML. Leave empty to use a map image.' },
      { k: 'location.mapImage', l: 'Location map image', type: 'image', max: 1600 },
      { k: 'gating.locationMap', l: 'Blur map image until lead submits', type: 'check' },
      { k: 'location.items', l: 'Connectivity', type: 'list', sub: [{ k: 'place', ph: 'Nagpur Airport' }, { k: 'distance', ph: '13 km' }], bulk: 'One per line: Place: distance', parse: l => { const i = l.lastIndexOf(':'); return i > 0 ? { place: l.slice(0, i).trim(), distance: l.slice(i + 1).trim() } : { place: l.trim(), distance: '' }; } }
    ] },
    { title: 'Site Visit & FAQ', fields: [
      { k: 'siteVisit.image', l: 'Site visit section image', type: 'image', max: 1200, hint: 'Defaults to 2nd hero image' },
      { k: 'faq', l: 'FAQs', type: 'list', sub: [{ k: 'q', ph: 'Question' }, { k: 'a', type: 'textarea', ph: 'Answer' }], autoFaq: true, hint: 'FAQs add FAQ rich-results schema for SEO.' }
    ] },
    { title: 'Contact & Agent', hint: 'Phone, WhatsApp, RERA', fields: [
      { row: [{ k: 'contact.phone', l: 'Call number', ph: '+91 96069 70821', type: 'tel' }, { k: 'contact.whatsapp', l: 'WhatsApp number', ph: '918976900177', type: 'tel' }] },
      { k: 'contact.whatsappText', l: 'WhatsApp pre-filled message', ph: 'Auto-generated if empty' },
      { k: 'agent.name', l: 'Agent / company name', ph: 'Propertypistol Realty Pvt. Ltd.' },
      { k: 'agent.about', l: 'About agent', type: 'textarea', rows: 4 },
      { row: [{ k: 'agent.rera', l: 'Agent RERA No.', ph: 'A51700000043' }, { k: 'agent.gst', l: 'GST No.', ph: '27AAGCP7489P2ZA' }] },
      { k: 'agent.qr', l: 'Footer QR code', type: 'image', max: 400, contain: true, keepPng: true }
    ] },
    { title: 'Leads, OTP & CRM', hint: 'Where leads go', fields: [
      { k: 'lead.hosting', l: 'Where will this page be hosted?', type: 'select', opts: ['cPanel / PHP hosting', 'GitHub Pages + Cloudflare Worker', 'Test mode (no backend)'], hint: 'cPanel: ZIP includes api/lead.php \u2014 edit api/config.php on the server with the CRM keys. Nothing secret is stored in the builder.' },
      { k: 'lead.crm', l: 'Send leads to CRM', type: 'select', opts: Object.keys(window.LP_CRM_PRESETS || {}), hint: 'Presets for TeleCRM, LeadSquared, Sell.Do, HubSpot, Salesforce, Zapier/Make webhooks. Any other CRM: "Custom" — see docs/CRM-INTEGRATION-GUIDE.md.' },
      { k: 'lead.sheetBackup', l: 'Also copy every lead to a Google Sheet', type: 'check' },
      { k: 'lead.apiUrl', l: 'Cloudflare Worker URL (only for GitHub Pages hosting)', ph: 'https://pp-leads.<you>.workers.dev' },
      { row: [{ k: 'lead.projectCode', l: 'Project code (CRM)', ph: 'godrej-rivershore-nagpur' }, { k: 'lead.countryCode', l: 'Default country code', type: 'select', opts: ['+91', '+971', '+974', '+966', '+968', '+973', '+965', '+1', '+44', '+65', '+61'] }] },
      { row: [{ k: 'lead.popupDelay', l: 'Auto-popup after (sec, 0=off)', type: 'number' }, { k: 'lead.brochureUrl', l: 'Brochure PDF', type: 'file', accept: 'application/pdf' }] },
      { k: 'lead.otp', l: 'OTP verification on mobile number', type: 'check', hint: 'Cloudflare Worker hosting only (needs SMS provider on the Worker).' },
      { k: 'lead.exitIntent', l: 'Exit-intent popup on desktop', type: 'check' },
      { k: 'lead.emailRequired', l: 'Make email mandatory', type: 'check' },
      { k: 'lead.askConfig', l: 'Show "Interested in" dropdown (from pricing types)', type: 'check' },
      { k: 'lead.mobileBar', l: 'Mobile bottom bar', type: 'select', opts: ['Enquire Now + Schedule Site Visit', 'Call + Enquire + WhatsApp'], hint: 'Both Enquire and Site Visit open the same lead form (Site Visit gets its own heading + form_name).' },
      { k: 'lead.noRedirect', l: 'Do NOT redirect to thank-you page (inline message instead)', type: 'check' }
    ] },
    { title: 'Tracking & SEO', fields: [
      { row: [{ k: 'tracking.gtm', l: 'GTM container ID', ph: 'GTM-XXXXXXX' }, { k: 'tracking.ga4', l: 'GA4 ID', ph: 'G-XXXXXXX' }] },
      { row: [{ k: 'tracking.gadsId', l: 'Google Ads ID', ph: 'AW-123456789' }, { k: 'tracking.gadsLabel', l: 'Conversion label', ph: 'AbC-dEfGhIj' }] },
      { k: 'tracking.metaPixel', l: 'Meta Pixel ID', ph: '1234567890' },
      { k: 'meta.domain', l: 'Custom domain', ph: 'godrejforestestatenagpur.com', hint: 'Adds CNAME file for GitHub Pages + canonical/OG URLs.' },
      { k: 'meta.title', l: 'SEO title', ph: 'Auto: Name | Location | Price, Floor Plans, Brochure' },
      { k: 'meta.description', l: 'Meta description', type: 'textarea', rows: 2 },
      { k: 'meta.ogImage', l: 'Social share image (OG)', type: 'image', max: 1200 },
      { k: 'meta.disclaimer', l: 'Footer disclaimer (auto if empty)', type: 'textarea', rows: 3 },
      { k: 'meta.privacyText', l: 'Privacy policy text (auto if empty)', type: 'textarea', rows: 3 },
      { k: 'tracking.headCode', l: 'Extra <head> code', type: 'textarea', rows: 2, mono: true },
      { k: 'tracking.bodyCode', l: 'Extra end-of-body code', type: 'textarea', rows: 2, mono: true },
      { k: 'tracking.thankYouCode', l: 'Extra thank-you page code', type: 'textarea', rows: 2, mono: true }
    ] },
    { title: 'Show / Hide Sections', fields: [
      { checks: [['sections.about', 'About'], ['sections.pricing', 'Pricing'], ['sections.masterplan', 'Master plan'], ['sections.unitplans', 'Floor plans'], ['sections.amenities', 'Amenities'], ['sections.gallery', 'Gallery'], ['sections.location', 'Location'], ['sections.sitevisit', 'Site visit form'], ['sections.faq', 'FAQ'], ['sections.agent', 'About agent']] }
    ] }
  ];

  /* ---------------- form rendering ---------------- */
  function thumbFor(ref, contain) {
    const u = refURL(ref);
    const t = el('div', { class: 'thumb' + (u ? ' has' : '') + (contain ? ' contain' : '') });
    if (u) { if (/^data:image|^https?:.*\.(png|jpe?g|webp|gif|svg)/i.test(u)) t.style.backgroundImage = `url("${u}")`; else t.textContent = 'FILE'; } else t.textContent = 'none';
    return t;
  }
  function imgOpts(f) { return { square: f.square, png: f.keepPng || !!f.square }; }

  function fieldEl(f) {
    if (f.row) return el('div', { class: 'two' }, f.row.map(fieldEl));
    if (f.checks) return el('div', { class: 'two' }, f.checks.map(([k, l]) => checkEl({ k, l })));
    if (f.type === 'check') return checkEl(f);
    const wrap = el('div', { class: 'f' }, el('label', {}, f.l || ''));
    const v = getP(P.cfg, f.k);
    const set = (val) => { setP(P.cfg, f.k, val); touch(); };
    let input;
    switch (f.type) {
      case 'textarea':
        input = el('textarea', { rows: f.rows || 3, placeholder: f.ph || '', style: f.mono ? 'font-family:ui-monospace,monospace;font-size:12px' : null, oninput: e => set(e.target.value) }); input.value = v || ''; break;
      case 'select':
        input = el('select', { onchange: e => set(e.target.value) }, f.opts.map(o => el('option', { value: o, selected: o === v ? true : null }, o))); break;
      case 'number':
        input = el('input', { type: 'number', min: 0, value: v ?? '', oninput: e => set(e.target.value === '' ? '' : Number(e.target.value)) }); break;
      case 'color': {
        const c = el('input', { type: 'color', value: v || '#000000' });
        const t = el('input', { type: 'text', value: v || '' });
        c.oninput = () => { t.value = c.value; set(c.value); };
        t.oninput = () => { if (/^#[0-9a-f]{6}$/i.test(t.value)) { c.value = t.value; set(t.value); } };
        input = el('div', { class: 'color' }, c, t); break;
      }
      case 'image': {
        const box = el('div', { class: 'img' });
        const draw = () => {
          box.innerHTML = '';
          const cur = getP(P.cfg, f.k);
          box.append(thumbFor(cur, f.contain), el('div', { class: 'btns' },
            el('button', { class: 'b sm', type: 'button', onclick: async () => { const [file] = await pick('image/*'); if (!file) return; setP(P.cfg, f.k, await addAsset(file, f.max, imgOpts(f))); gcAssets(); touch(); draw(); } }, cur ? 'Replace' : 'Upload'),
            cur ? el('button', { class: 'b sm danger', type: 'button', onclick: () => { setP(P.cfg, f.k, ''); gcAssets(); touch(); draw(); } }, 'Remove') : null));
        };
        draw(); input = box; break;
      }
      case 'file': {
        const box = el('div', { class: 'img' });
        const draw = () => {
          box.innerHTML = '';
          const cur = getP(P.cfg, f.k) || '';
          const url = el('input', { type: 'url', placeholder: 'https://… or upload', value: cur.startsWith('a:') ? '' : cur, style: 'flex:1;border:1px solid var(--line);border-radius:8px;padding:7px 9px', oninput: e => set(e.target.value) });
          box.append(...[url, cur.startsWith('a:') ? el('span', { class: 'hint' }, '📎 ' + ((P.assets[cur.slice(2)] || {}).name || 'file')) : null,
            el('button', { class: 'b sm', type: 'button', onclick: async () => { const [file] = await pick(f.accept || '*/*'); if (!file) return; if (file.size > 15e6) return toast('File too large (max 15 MB). Host it elsewhere and paste the URL.'); const id = uid(); const ext = (file.name.split('.').pop() || 'bin').toLowerCase(); P.assets[id] = { name: file.name.replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + id + '.' + ext, mime: file.type, data: await readAsDataURL(file) }; setP(P.cfg, f.k, 'a:' + id); gcAssets(); touch(); draw(); } }, 'Upload'),
            cur ? el('button', { class: 'b sm danger', type: 'button', onclick: () => { setP(P.cfg, f.k, ''); gcAssets(); touch(); draw(); } }, '✕') : null].filter(Boolean));
        };
        draw(); input = box; break;
      }
      case 'images': input = imagesEl(f); break;
      case 'list': input = listEl(f); break;
      default:
        input = el('input', { type: f.type || 'text', placeholder: f.ph || '', oninput: e => set(e.target.value) }); input.value = v ?? '';
    }
    wrap.append(input);
    if (f.hint) wrap.append(el('div', { class: 'hint' }, f.hint));
    return wrap;
  }
  function checkEl(f) {
    const v = getP(P.cfg, f.k);
    const w = el('div', { class: 'f' }, el('label', { class: 'chk' }, el('input', { type: 'checkbox', checked: v ? true : null, onchange: e => { setP(P.cfg, f.k, e.target.checked ? (f.k.startsWith('sections.') ? 1 : true) : (f.k.startsWith('sections.') ? 0 : false)); touch(); } }), f.l));
    if (f.hint) w.append(el('div', { class: 'hint' }, f.hint));
    return w;
  }
  function imagesEl(f) {
    const box = el('div', { style: 'display:grid;gap:8px' });
    const draw = () => {
      box.innerHTML = '';
      const arr = getP(P.cfg, f.k) || [];
      const grid = el('div', { class: 'grid' });
      arr.forEach((ref, i) => {
        const gi = el('div', { class: 'gi' }); gi.style.backgroundImage = `url("${refURL(ref)}")`;
        gi.append(el('div', { class: 'ctl' },
          el('button', { type: 'button', title: 'Move left', onclick: () => { if (i) { [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]]; touch(); draw(); } } }, '◀'),
          el('button', { type: 'button', title: 'Remove', onclick: () => { arr.splice(i, 1); gcAssets(); touch(); draw(); } }, '✕'),
          el('button', { type: 'button', title: 'Move right', onclick: () => { if (i < arr.length - 1) { [arr[i + 1], arr[i]] = [arr[i], arr[i + 1]]; touch(); draw(); } } }, '▶')));
        grid.append(gi);
      });
      if (arr.length) box.append(grid);
      if (!f.single || !arr.length) box.append(dropZone(async files => {
        const cur = getP(P.cfg, f.k) || []; setP(P.cfg, f.k, cur);
        for (const file of (f.single ? files.slice(0, 1) : files)) cur.push(await addAsset(file, f.max));
        touch(); draw();
      }, f.single ? 'Click or drop an image' : 'Click or drop images (multiple)', !f.single));
    };
    draw(); return box;
  }
  function dropZone(onFiles, label, multiple) {
    const d = el('div', { class: 'drop' }, label);
    d.onclick = async () => { const fs = await pick('image/*', multiple); if (fs.length) { d.textContent = 'Processing…'; await onFiles(fs); } };
    d.ondragover = e => { e.preventDefault(); d.classList.add('over'); };
    d.ondragleave = () => d.classList.remove('over');
    d.ondrop = async e => { e.preventDefault(); d.classList.remove('over'); const fs = Array.from(e.dataTransfer.files).filter(x => x.type.startsWith('image/')); if (fs.length) { d.textContent = 'Processing…'; await onFiles(fs); } };
    return d;
  }
  function listEl(f) {
    const box = el('div', { class: 'list' });
    const arr = () => { let a = getP(P.cfg, f.k); if (!Array.isArray(a)) { a = []; setP(P.cfg, f.k, a); } return a; };
    const draw = () => {
      box.innerHTML = '';
      const a = arr();
      a.forEach((item, i) => {
        const row = el('div', { class: 'row' });
        row.append(el('div', { class: 'mv' },
          el('button', { type: 'button', title: 'Up', onclick: () => { if (i) { [a[i - 1], a[i]] = [a[i], a[i - 1]]; touch(); draw(); } } }, '▲'),
          el('button', { type: 'button', title: 'Down', onclick: () => { if (i < a.length - 1) { [a[i + 1], a[i]] = [a[i], a[i + 1]]; touch(); draw(); } } }, '▼')));
        if (f.simple) {
          const inp = el('input', { type: 'text', placeholder: f.ph || '', oninput: e => { a[i] = e.target.value; touch(); } }); inp.value = item || ''; row.append(inp);
        } else {
          const txtFields = f.sub.filter(s => s.type !== 'image');
          const imgField = f.sub.find(s => s.type === 'image');
          if (imgField) {
            const th = thumbFor(item[imgField.k]); th.title = 'Click to upload/replace';
            th.onclick = async () => { const [file] = await pick('image/*'); if (!file) return; item[imgField.k] = await addAsset(file, imgField.max); gcAssets(); touch(); draw(); };
            row.append(th);
          }
          const col = el('div', { class: txtFields.some(s => s.type === 'textarea') ? 'col' : 'col', style: txtFields.length > 1 && !txtFields.some(s => s.type === 'textarea') ? 'display:flex;gap:4px' : null });
          txtFields.forEach(s => {
            let inp;
            if (s.type === 'select') { inp = el('select', { onchange: e => { item[s.k] = e.target.value; touch(); } }, s.opts.map(o => el('option', { selected: o === item[s.k] ? true : null }, o))); if (!item[s.k]) item[s.k] = s.opts[0]; }
            else if (s.type === 'textarea') { inp = el('textarea', { placeholder: s.ph || '', oninput: e => { item[s.k] = e.target.value; touch(); } }); inp.value = item[s.k] || ''; }
            else { inp = el('input', { type: 'text', placeholder: s.ph || '', oninput: e => { item[s.k] = e.target.value; touch(); } }); inp.value = item[s.k] || ''; }
            col.append(inp);
          });
          row.append(col);
        }
        row.append(el('button', { class: 'rm', type: 'button', title: 'Remove', onclick: () => { a.splice(i, 1); gcAssets(); touch(); draw(); } }, '✕'));
        box.append(row);
      });
      const acts = el('div', { class: 'listacts' },
        el('button', { class: 'b sm', type: 'button', onclick: () => { a.push(f.simple ? '' : {}); touch(); draw(); const ins = box.querySelectorAll('.row input'); ins.length && ins[ins.length - 1].focus(); } }, '+ Add'));
      if (f.multiAdd) acts.append(el('button', { class: 'b sm', type: 'button', onclick: async () => {
        const fs = await pick('image/*', true); if (!fs.length) return; toast('Processing ' + fs.length + ' image(s)…');
        const imgField = f.sub.find(s => s.type === 'image');
        for (const file of fs) { const o = {}; o[imgField.k] = await addAsset(file, imgField.max); const nameField = f.sub.find(s => s.type !== 'image' && s.type !== 'select'); if (nameField) o[nameField.k] = file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').replace(/\b\w/g, m => m.toUpperCase()); const sel = f.sub.find(s => s.type === 'select'); if (sel) o[sel.k] = (a[a.length - 1] || {})[sel.k] || sel.opts[0]; a.push(o); }
        touch(); draw();
      } }, '+ Upload multiple'));
      let bulkBox;
      if (f.bulk) {
        const ta = el('textarea', { rows: 4, placeholder: f.bulk, style: 'width:100%;border:1px solid var(--line);border-radius:8px;padding:8px' });
        bulkBox = el('div', { class: 'bulk' }, ta, el('button', { class: 'b sm primary', type: 'button', onclick: () => {
          ta.value.split('\n').map(s => s.trim()).filter(Boolean).forEach(l => a.push(f.simple ? l : (f.parse ? f.parse(l) : { [f.sub[0].k]: l })));
          touch(); draw();
        } }, 'Add lines'));
        acts.append(el('button', { class: 'b sm', type: 'button', onclick: () => bulkBox.classList.toggle('open') }, 'Bulk paste'));
      }
      if (f.autoFaq) acts.append(el('button', { class: 'b sm', type: 'button', onclick: () => { autoFaq().forEach(x => a.push(x)); touch(); draw(); } }, '✨ Auto-generate from project data'));
      if (a.length) acts.append(el('button', { class: 'b sm danger', type: 'button', onclick: () => { if (confirm('Clear all items?')) { a.length = 0; gcAssets(); touch(); draw(); } } }, 'Clear'));
      box.append(acts); if (bulkBox) box.append(bulkBox);
    };
    draw(); return box;
  }
  function autoFaq() {
    const c = P.cfg, p = c.project || {}, n = p.name || 'the project', out = [];
    if (p.price) out.push({ q: `What is the starting price of ${n}?`, a: `Prices at ${n} start at ${p.price} ${p.priceSuffix || 'onwards'}. Submit an enquiry to get the complete price breakup and current offers.` });
    if (p.location) out.push({ q: `Where is ${n} located?`, a: `${n} is located at ${p.location}.${(c.location && c.location.items || []).length ? ' Nearby: ' + c.location.items.slice(0, 4).map(i => `${i.place} (${i.distance})`).join(', ') + '.' : ''}` });
    const types = [...new Set((c.pricing && c.pricing.rows || []).map(r => r.type).filter(Boolean))];
    if (types.length) out.push({ q: `What configurations are available at ${n}?`, a: `${n} offers ${types.join(', ')} options. Sizes range ${c.pricing.rows[0].size} to ${c.pricing.rows[c.pricing.rows.length - 1].size}.` });
    if (p.developer) out.push({ q: `Who is the developer of ${n}?`, a: `${n} is developed by ${p.developer}.` });
    if (p.reraProject) out.push({ q: `Is ${n} RERA registered?`, a: `Yes. ${p.reraLabel || 'RERA'} No. ${p.reraProject}.` });
    if ((c.amenities || []).length) out.push({ q: `What amenities does ${n} offer?`, a: `Key amenities include ${c.amenities.slice(0, 8).map(a => a.name).filter(Boolean).join(', ')} and more.` });
    out.push({ q: `How can I book a site visit?`, a: `Fill the enquiry form or call us — we arrange a free site visit with pick-up and drop at your preferred time.` });
    return out;
  }

  function renderForm() {
    const root = $('#form'); root.innerHTML = '';
    const openSet = (() => { try { return JSON.parse(localStorage.getItem('lpb_open') || '[]'); } catch (e) { return []; } })();
    SCHEMA.forEach((sec, i) => {
      const d = el('details', { class: 'acc', open: (openSet.length ? openSet.includes(i) : sec.open) ? true : null },
        el('summary', {}, el('span', {}, sec.title, sec.hint ? el('small', {}, sec.hint) : null)),
        el('div', { class: 'body' }, sec.fields.map(fieldEl)));
      d.addEventListener('toggle', () => { const s = [...document.querySelectorAll('.acc')].map((x, j) => x.open ? j : -1).filter(j => j >= 0); try { localStorage.setItem('lpb_open', JSON.stringify(s)); } catch (e) {} });
      root.append(d);
    });
    updateScore();
  }

  /* ---------------- conversion checklist ---------------- */
  function updateScore() {
    const c = P.cfg, g = (k) => getP(c, k);
    const checks = [
      ['Project name', g('project.name')], ['Logo', g('brand.logo')], ['Favicon', g('brand.favicon')],
      ['Hero image(s)', (g('hero.images') || []).length || g('hero.video')], ['Starting price', g('project.price')],
      ['3–5 USPs', (g('project.usps') || []).filter(Boolean).length >= 3], ['Pricing table', (g('pricing.rows') || []).length],
      ['Floor/master plans', (g('unitPlans') || []).length || (g('masterPlan.images') || []).length],
      ['Amenities', (g('amenities') || []).length >= 4], ['Gallery', (g('gallery') || []).length >= 3],
      ['Connectivity', (g('location.items') || []).length >= 4], ['Call number', g('contact.phone')], ['WhatsApp number', g('contact.whatsapp') || g('contact.phone')],
      ['Project RERA No.', g('project.reraProject')], ['Agent RERA No.', g('agent.rera')],
      ['Lead backend (cPanel or Worker URL)', /^cPanel/.test(g('lead.hosting') || '') || (/Cloudflare/.test(g('lead.hosting') || '') && g('lead.apiUrl'))], ['GTM / GA4 / Ads tag', g('tracking.gtm') || g('tracking.ga4') || g('tracking.gadsId')],
      ['FAQs (SEO)', (g('faq') || []).length], ['Brochure', g('lead.brochureUrl')]
    ];
    const ok = checks.filter(x => x[1]).length, pct = Math.round(ok / checks.length * 100);
    const s = $('#score');
    const wasOpen = s.classList.contains('open');
    s.innerHTML = `<div class="h"><span>Launch readiness</span><span>${pct}% · ${ok}/${checks.length} ▾</span></div><div class="bar"><i style="width:${pct}%"></i></div><ul>${checks.map(([l, v]) => `<li class="${v ? 'ok' : 'no'}">${v ? '✓' : '✕'} ${l}</li>`).join('')}</ul>`;
    if (wasOpen) s.classList.add('open');
    s.firstChild.onclick = () => s.classList.toggle('open');
  }

  /* ---------------- preview ---------------- */
  let pvT;
  function schedulePreview() { clearTimeout(pvT); pvT = setTimeout(renderPreview, 350); }
  function renderPreview() {
    const iframe = $('#pv');
    let y = 0; try { y = iframe.contentWindow.scrollY; } catch (e) {}
    const cfg = previewCfg();
    const files = LPTemplate.renderSite(cfg, refURL);
    iframe.onload = () => { try { iframe.contentWindow.scrollTo(0, y); } catch (e) {} };
    iframe.srcdoc = files['index.html'];
  }
  let devW = 1440;
  function fitFrame() {
    const wrap = $('.frame-wrap'), f = $('#pv');
    const aw = wrap.clientWidth - 28, ah = wrap.clientHeight - 28;
    const sc = Math.min(1, aw / devW);
    f.style.width = devW + 'px'; f.style.height = (ah / sc) + 'px';
    f.style.transform = `scale(${sc})`; f.style.transformOrigin = 'top center';
    f.style.marginBottom = (-(ah / sc) * (1 - sc)) + 'px';
  }
  document.querySelectorAll('#devs button').forEach(b => b.onclick = () => {
    document.querySelectorAll('#devs button').forEach(x => x.classList.toggle('on', x === b));
    devW = parseInt(b.dataset.w, 10); fitFrame();
  });
  addEventListener('resize', fitFrame);
  $('#btnOpen').onclick = () => {
    const files = LPTemplate.renderSite(previewCfg(), refURL);
    const url = URL.createObjectURL(new Blob([files['index.html']], { type: 'text/html' }));
    window.open(url, '_blank');
  };

  /* ---------------- export ---------------- */
  const slugName = () => LPTemplate.slug(getP(P.cfg, 'project.name') || 'landing-page');
  const b64ToU8 = (dataUrl) => { const b = atob(dataUrl.split(',')[1]); const u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; };
  function download(blob, name) { const a = el('a', { href: URL.createObjectURL(blob), download: name }); document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500); }
  const hosting = () => { const h = getP(P.cfg, 'lead.hosting') || ''; return /^cPanel/.test(h) ? 'cpanel' : /Cloudflare/.test(h) ? 'cloudflare' : (h ? 'test' : (getP(P.cfg, 'lead.apiUrl') ? 'cloudflare' : 'cpanel')); };
  function exportCfg() {
    const c = JSON.parse(JSON.stringify(P.cfg)); c.lead = c.lead || {};
    const h = hosting();
    c.lead.apiUrl = h === 'cpanel' ? 'api/lead.php' : h === 'cloudflare' ? (c.lead.apiUrl || '') : '';
    if (h === 'cpanel') c.lead.otp = false;
    return c;
  }
  function previewCfg() { const c = exportCfg(); c.lead.apiUrl = ''; c.__preview = true; return c; }
  function validate() {
    if (!getP(P.cfg, 'project.name')) { toast('Add a project name first'); return false; }
    const h = hosting();
    if (h === 'test' && !confirm('Test mode — form submissions will NOT be stored anywhere. Export anyway?')) return false;
    if (h === 'cloudflare' && !getP(P.cfg, 'lead.apiUrl') && !confirm('Cloudflare Worker URL is empty — leads will NOT be stored. Export anyway?')) return false;
    return true;
  }
  $('#btnZip').onclick = async () => {
    if (!validate()) return;
    gcAssets();
    const zip = new JSZip();
    const resolve = (ref) => (typeof ref === 'string' && ref.startsWith('a:')) ? (P.assets[ref.slice(2)] ? 'assets/' + P.assets[ref.slice(2)].name : '') : (ref || '');
    const XC = exportCfg(), H = hosting();
    const files = LPTemplate.renderSite(XC, resolve);
    Object.entries(files).forEach(([n, html]) => zip.file(n, html));
    if (H === 'cpanel') {
      zip.file('api/lead.php', window.LP_PHP.lead);
      zip.file('api/.htaccess', window.LP_PHP.htaccess);
      zip.file('api/config.php', LP_connectorConfigPhp(XC));
    } else if (H === 'cloudflare') {
      zip.file('cloudflare-crm-settings.txt', LP_cloudflareSettings(XC));
    }
    Object.values(P.assets).forEach(a => zip.file('assets/' + a.name, b64ToU8(a.data)));
    const dom = (getP(P.cfg, 'meta.domain') || '').replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    if (dom && H !== 'cpanel') zip.file('CNAME', dom + '\n');
    if (dom && H === 'cpanel') zip.file('.htaccess', LP_rootHtaccess(dom));
    zip.file('.nojekyll', '');
    zip.file('robots.txt', `User-agent: *\nAllow: /\nDisallow: /thank-you.html\n${dom ? `Sitemap: https://${dom}/sitemap.xml\n` : ''}`);
    if (dom) zip.file('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://${dom}/</loc><lastmod>${new Date().toISOString().slice(0, 10)}</lastmod><priority>1.0</priority></url></urlset>\n`);
    zip.file('README.md', H === 'cpanel'
      ? `# ${getP(P.cfg, 'project.name')}\n\nGenerated with LP Builder on ${new Date().toISOString().slice(0, 10)}.\n\n## Publish on cPanel\n1. ${dom ? 'Run AutoSSL for ' + dom + ' first (cPanel → SSL/TLS Status) — the .htaccess forces https.' : 'Enable SSL for your domain.'}\n2. File Manager → public_html → Upload this ZIP → Extract (turn on Show Hidden Files to see .htaccess).\n3. Edit **api/config.php** → replace every PASTE_… value with the CRM keys → Save.\n4. Open https://${dom || 'your-domain'}/api/lead.php?health=1 → every destination should show ready: true.\n5. Submit a test lead; check the CRM and api/logs/leads-YYYY-MM.csv (every lead + CRM response).\n\nCRM: ${getP(P.cfg, 'lead.crm') || 'TeleCRM'}${getP(P.cfg, 'lead.sheetBackup') ? ' + Google Sheet backup' : ''}\n`
      : `# ${getP(P.cfg, 'project.name')}\n\nGenerated with LP Builder on ${new Date().toISOString().slice(0, 10)}.\n\n## Publish on GitHub Pages\n1. Create a new repository and upload **all files in this folder** (keep the \`assets\` folder).\n2. Settings → Pages → Source: *Deploy from a branch* → \`main\` / root.\n3. ${dom ? `Point your domain \`${dom}\` DNS: CNAME → \`<username>.github.io\`. Tick *Enforce HTTPS*.` : 'Optional: add a custom domain in Settings → Pages.'}\n\nLeads post to: ${XC.lead.apiUrl || '(not configured)'}${H === 'cloudflare' ? '\nCRM settings for the Worker: cloudflare-crm-settings.txt' : ''}\n`);
    zip.file('project.lpb.json', JSON.stringify({ v: 1, name: P.name, cfg: P.cfg, assets: P.assets }));
    toast('Building ZIP…');
    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
    download(blob, slugName() + '-site.zip');
    toast(H === 'cpanel' ? 'ZIP downloaded — upload to cPanel, then fill api/config.php on the server.' : 'ZIP downloaded — upload its contents to a GitHub repo and enable Pages.', 6000);
  };
  $('#btnHtml').onclick = () => {
    if (!validate()) return;
    const files = LPTemplate.renderSite(exportCfg(), refURL);
    download(new Blob([files['index.html']], { type: 'text/html' }), slugName() + '.html');
    toast('Single-file HTML downloaded (thank-you page not included — inline message used if you tick "Do NOT redirect").', 5000);
  };
  $('#btnSave').onclick = () => { gcAssets(); download(new Blob([JSON.stringify({ v: 1, name: P.name, cfg: P.cfg, assets: P.assets })], { type: 'application/json' }), slugName() + '.lpb.json'); };
  $('#fileImport').onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const j = JSON.parse(await f.text());
      if (!j.cfg) throw new Error('Not a project file');
      P = { id: uid(), name: j.name || 'Imported', updated: Date.now(), cfg: Object.assign(blank(), j.cfg), assets: j.assets || {} };
      await DB.put(P); renderForm(); touch(); toast('Project imported');
    } catch (err) { toast('Import failed: ' + err.message); }
    e.target.value = '';
  };

  /* ---------------- projects ---------------- */
  async function refreshProjects() {
    const all = (await DB.all()).sort((a, b) => b.updated - a.updated);
    if (!all.find(x => x.id === P.id)) all.unshift(P);
    const sel = $('#projSel'); sel.innerHTML = '';
    all.forEach(p => sel.append(el('option', { value: p.id, selected: p.id === P.id ? true : null }, (p.id === P.id ? (getP(P.cfg, 'project.name') || P.name) : p.name) || 'Untitled')));
  }
  $('#projSel').onchange = async (e) => {
    await DB.put(P);
    const p = (await DB.all()).find(x => x.id === e.target.value);
    if (p) { P = p; P.cfg = Object.assign(blank(), P.cfg); renderForm(); renderPreview(); try { localStorage.setItem('lpb_last', P.id); } catch (err) {} }
  };
  $('#btnNew').onclick = async () => { await DB.put(P); P = newProject(); renderForm(); touch(); toast('New project created'); };
  $('#btnDup').onclick = async () => { await DB.put(P); P = JSON.parse(JSON.stringify(P)); P.id = uid(); setP(P.cfg, 'project.name', (getP(P.cfg, 'project.name') || 'Project') + ' (copy)'); renderForm(); touch(); toast('Duplicated — edit and export'); };
  $('#btnDel').onclick = async () => {
    if (!confirm('Delete "' + (getP(P.cfg, 'project.name') || P.name) + '"? This cannot be undone (export .json first if unsure).')) return;
    await DB.del(P.id);
    const rest = (await DB.all()).sort((a, b) => b.updated - a.updated);
    P = rest[0] || newProject(); P.cfg = Object.assign(blank(), P.cfg); renderForm(); touch();
  };
  $('#btnSample').onclick = async () => {
    if (getP(P.cfg, 'project.name') && !confirm('Load the sample into a NEW project?')) return;
    await DB.put(P);
    P = newProject('Sample');
    const S = JSON.parse(JSON.stringify(window.LP_SAMPLE));
    const names = S.amenityNames; delete S.amenityNames;
    Object.assign(P.cfg, S);
    P.cfg.brand.logo = logoPH('Rivershore');
    P.cfg.hero = { images: [placeholder('Hero Elevation', 1600, 900, 150), placeholder('Clubhouse View', 1600, 900, 190), placeholder('Aerial View', 1600, 900, 110)] };
    P.cfg.about.image = placeholder('Project Overview', 1000, 750, 170);
    P.cfg.masterPlan = { images: [placeholder('Master Plan', 1600, 900, 90)] };
    P.cfg.unitPlans = [{ label: 'Plot 1,401 – 1,600 sq.ft.', image: placeholder('Unit Plan A', 800, 600, 200) }, { label: 'Plot 1,800 – 2,000 sq.ft.', image: placeholder('Unit Plan B', 800, 600, 220) }, { label: 'Plot 2,400+ sq.ft.', image: placeholder('Unit Plan C', 800, 600, 240) }];
    P.cfg.amenities = names.map((n, i) => ({ name: n, image: placeholder(n, 600, 750, (i * 29) % 360) }));
    P.cfg.gallery = [['Exterior', 130], ['Exterior', 160], ['Exterior', 100], ['Interior', 30], ['Interior', 20], ['Amenities', 200]].map(([c, h], i) => ({ category: c, image: placeholder(c + ' ' + (i + 1), 1200, 800, h) }));
    P.cfg.location.mapImage = placeholder('Location Map', 1200, 900, 60);
    renderForm(); touch(); toast('Sample loaded (placeholder images) — replace with real content');
  };

  /* ---------------- boot ---------------- */
  /* ---- the link with Trigger ---------------------------------------------
     Trigger is served from the parent folder of this one, so the two share
     an origin and can simply hand things to each other through
     localStorage. Nothing is uploaded anywhere to make this work, and no
     server is involved.

     In: Trigger stages the project it already has — developer, project,
     location, configuration, price, RERA, possession, USPs, amenities,
     landmarks, and the FAQs it wrote from the campaign keywords.
     Out: everything typed here is written back on every change, so the
     campaign brief can pull the finished wording without anyone exporting
     or pasting. Images never travel either way: far too large. */
  const LP_KEY = 'pp_lp_handover';
  const LP_BACK = 'pp_lp_fromBuilder';

  function readHandover() {
    const asked = /[#&]handover=1/.test(location.hash || '');
    let raw = null;
    try { raw = localStorage.getItem(LP_KEY); } catch (e) { return null; }
    if (!raw) return null;
    try {
      const o = JSON.parse(raw);
      if (!o || !o.project || !o.project.name) return null;
      /* only act on it when this tab was opened for it, and only once */
      if (!asked) return null;
      try { localStorage.removeItem(LP_KEY); } catch (e) {}
      return o;
    } catch (e) { console.warn('Unreadable handover from Trigger', e); return null; }
  }

  function applyBrief(o) {
    const p = newProject(o.project.name);
    const c = p.cfg;
    c.project.name        = o.project.name || '';
    c.project.developer   = o.project.developer || '';
    c.project.location    = o.project.location || '';
    c.project.price       = o.project.price || '';
    c.project.offer       = o.project.offer || '';
    c.project.reraProject = o.project.rera || '';
    c.project.usps        = (o.usps || []).slice(0, 8);
    if (o.project.config)
      c.pricing.rows = String(o.project.config).split(/\s*(?:,|&|and)\s*/)
        .map(t => t.trim()).filter(Boolean)
        .map(t => ({ type: /bhk|br\b|plot|villa|studio/i.test(t) ? t : t + ' BHK', size: '', price: '' }));
    c.amenities = (o.amenities || []).map(n => ({ name: n, image: '' }));
    c.location.items = (o.landmarks || []).map(l => {
      const m2 = String(l).split(/\s*[-:]\s*/);
      return { place: (m2[0] || '').trim(), distance: (m2[1] || '').trim() };
    }).filter(x => x.place);
    /* the FAQs are the point of the handover: they were written from the
       keywords this campaign will actually bid on */
    if ((o.faq || []).length)
      c.faq = o.faq.filter(f => f && f.q).map(f => ({ q: f.q, a: f.a || '' }));
    if (o.project.possession) c.about = Object.assign({}, c.about,
      { possession: o.project.possession });
    Object.assign(c.lead, o.lead || {});
    Object.assign(c.tracking, o.tracking || {});
    return p;
  }

  /* What Trigger can pull back. Written on every change, so there is
     nothing to press on this side. */
  function pushBack() {
    try {
      const c = P && P.cfg; if (!c) return;
      const name = getP(c, 'project.name') || '';
      if (!name) return;
      const loc = getP(c, 'project.location') || '';
      const city = getP(c, 'project.city') || '';
      /* "Vadgaon, Pune" splits back into the micro-market and the city the
         campaign brief keeps apart */
      const bits = loc.split(/\s*,\s*/);
      localStorage.setItem(LP_BACK, JSON.stringify({
        v: 2, at: Date.now(),
        project: {
          name: name,
          developer: getP(c, 'project.developer') || '',
          location: loc,
          micro: bits.length > 1 ? bits[0] : loc,
          city: city || (bits.length > 1 ? bits[bits.length - 1] : ''),
          config: (getP(c, 'pricing.rows') || []).map(r => r && r.type).filter(Boolean).join(', '),
          price: getP(c, 'project.price') || '',
          offer: getP(c, 'project.offer') || '',
          rera: getP(c, 'project.reraProject') || '',
          possession: getP(c, 'about.possession') || ''
        },
        usps: (getP(c, 'project.usps') || []).filter(Boolean),
        amenities: (getP(c, 'amenities') || []).map(a => a && a.name).filter(Boolean),
        landmarks: (getP(c, 'location.items') || [])
          .filter(x => x && x.place)
          .map(x => x.place + (x.distance ? ' - ' + x.distance : '')),
        faq: (getP(c, 'faq') || []).filter(f => f && f.q).map(f => ({ q: f.q, a: f.a || '' })),
        lp: getP(c, 'meta.domain') || ''
      }));
    } catch (e) { /* a full or blocked localStorage must not break the builder */ }
  }

  /* ---- sorting a folder of photographs -----------------------------------
     A project arrives as a folder from the developer: IMG_2043.jpg,
     DJI_0094.jpg, WhatsApp Image 2026-10-23 at 14.02.11.jpeg. The names say
     nothing, so the pictures have to be looked at.

     Two passes, cheapest first. A file actually named "clubhouse" or
     "elevation" is filed on the name alone and never sent anywhere. Only
     what is left goes to the model, shrunk to 512px — a quarter of the
     tokens, and no worse at telling a swimming pool from a floor plan.

     The model only ever chooses a section. It never names the project, never
     writes copy, and anything it answers that is not one of these sections is
     dropped before it reaches the form. */

  const SORT_HINTS = [
    [/\b(elevation|exterior view|facade|tower|building|render|aerial|drone|night ?view|hero|banner|cover)\b/i, 'hero'],
    [/\b(master ?plan|site ?plan|layout ?plan|masterlayout)\b/i, 'masterplan'],
    [/\b(floor ?plan|unit ?plan|typical ?plan|\d\s*bhk\s*plan)\b/i, 'floorplan'],
    [/\b(pool|swimming|gym|fitness|clubhouse|club ?house|amenity|amenities|play ?area|kids|jogging|track|yoga|spa|court|lawn|garden|party ?hall|library|cafe)\b/i, 'amenity'],
    [/\b(living|bedroom|kitchen|bath|washroom|interior|show ?flat|sample ?flat|lobby)\b/i, 'interior'],
    [/\b(entrance|gate|landscape|podium|avenue|walkway|street|clubhouse ?exterior)\b/i, 'exterior'],
    [/\b(logo|brandmark|wordmark)\b/i, 'logo']
  ];
  function hintFor(name) {
    const n = String(name || '').replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ');
    for (const [re, sec] of SORT_HINTS) if (re.test(n)) return sec;
    return '';
  }
  const titleCase = s2 => String(s2 || '').replace(/\.[^.]+$/, '')
    .replace(/[-_]+/g, ' ').replace(/\s{2,}/g, ' ').trim()
    .replace(/\b\w/g, m => m.toUpperCase()).slice(0, 40);

  /* The credential Trigger left for us, on the origin both pages share. It
     expires on its own; a missing or stale one is not an error, it just means
     the file names have to carry the whole job. */
  function triggerAuth() {
    try {
      const a = JSON.parse(localStorage.getItem('pp_auth') || 'null');
      if (!a || !a.url || !a.credential) return null;
      if (a.exp && a.exp * 1000 < Date.now() + 30000) return null;
      return a;
    } catch (e) { return null; }
  }

  async function thumb(file, px) {
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((res, rej) => {
        const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url;
      });
      const k = Math.min(1, px / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(img.width * k));
      c.height = Math.max(1, Math.round(img.height * k));
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      return c.toDataURL('image/jpeg', 0.72).split(',')[1];
    } finally { URL.revokeObjectURL(url); }
  }

  async function askSorter(auth, batch) {
    const images = [];
    for (const f of batch) images.push({ name: f.name, data: await thumb(f, 512) });
    const r = await fetch(auth.url, {
      method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'classify-images', credential: auth.credential, images })
    });
    if (!r.ok) throw new Error('Trigger answered ' + r.status);
    const j = await r.json();
    if (j.error) throw new Error(j.error);
    return j.images || [];
  }

  async function sortImages() {
    const files = await pick('image/*', true);
    if (!files.length) return;
    const auth = triggerAuth();
    toast('Looking at ' + files.length + ' image' + (files.length === 1 ? '' : 's') + '…', 4000);

    const plan = files.map(f => ({ file: f, section: hintFor(f.name), caption: titleCase(f.name) }));
    const unknown = plan.filter(p => !p.section);

    if (unknown.length && auth) {
      try {
        /* the model is shown at most twenty at a time */
        for (let i = 0; i < unknown.length; i += 20) {
          const batch = unknown.slice(i, i + 20);
          const rows = await askSorter(auth, batch.map(p => p.file));
          rows.forEach(r => {
            const p = batch[r.i];
            if (!p) return;
            p.section = r.section || 'other';
            if (r.caption) p.caption = r.caption;
          });
        }
      } catch (e) {
        console.warn('Sorter unavailable', e);
        toast('Could not reach Trigger — sorting by file name only. ' + (e.message || ''), 6000);
      }
    } else if (unknown.length && !auth) {
      toast('Open this from Trigger to have the unnamed photos looked at — sorting by file name only', 6000);
    }

    const c = P.cfg, counts = {};
    const bump = k => { counts[k] = (counts[k] || 0) + 1; };
    for (const p of plan) {
      const sec = p.section || 'other';
      if (sec === 'other') { bump('skipped'); continue; }
      if (sec === 'hero') {
        c.hero = c.hero || {}; c.hero.images = c.hero.images || [];
        c.hero.images.push(await addAsset(p.file, 1920)); bump('hero');
      } else if (sec === 'amenity') {
        c.amenities = c.amenities || [];
        c.amenities.push({ image: await addAsset(p.file, 900), name: p.caption }); bump('amenity');
      } else if (sec === 'exterior' || sec === 'interior') {
        c.gallery = c.gallery || [];
        c.gallery.push({ image: await addAsset(p.file, 1600),
                         category: sec === 'interior' ? 'Interior' : 'Exterior',
                         caption: p.caption });
        bump('gallery');
      } else if (sec === 'masterplan') {
        c.masterPlan = c.masterPlan || {}; c.masterPlan.images = c.masterPlan.images || [];
        c.masterPlan.images.push(await addAsset(p.file, 2000)); bump('master plan');
      } else if (sec === 'floorplan') {
        c.unitPlans = c.unitPlans || [];
        c.unitPlans.push({ image: await addAsset(p.file, 1600), label: p.caption }); bump('floor plan');
      } else if (sec === 'logo') {
        /* a logo already chosen by hand is not replaced */
        if (!getP(c, 'brand.logo')) { setP(c, 'brand.logo', await addAsset(p.file, 600,
          { contain: true, keepPng: true })); bump('logo'); }
        else bump('skipped');
      }
    }
    gcAssets(); touch(); renderForm(); renderPreview();
    const said = Object.keys(counts).filter(k => k !== 'skipped')
      .map(k => counts[k] + ' ' + k).join(', ');
    toast(said ? said + (counts.skipped ? ' · ' + counts.skipped + ' left out' : '')
               : 'Nothing could be placed — check the files', 7000);
  }
  $('#btnSort').onclick = () => sortImages().catch(e => toast('Sorting failed: ' + (e.message || e), 6000));

  /* ---- publishing straight to the hosting ---------------------------------
     Export ZIP, upload, extract, repeat is the slowest part of making a
     landing page, and it is the part you do twenty times while the copy is
     still moving. publish.php sits on the hosting once; after that every
     change goes up over HTTPS and is live in seconds.

     The token is a secret, so it lives in this browser's localStorage and
     nowhere else — not in the exported site, not in the repository, which is
     public. It is sent in the body over HTTPS, never in a URL. */

  const PUB_KEY = 'pp_publish_cfg';
  const pubCfg = () => { try { return JSON.parse(localStorage.getItem(PUB_KEY) || 'null') || {}; }
                         catch (e) { return {}; } };
  const pubSave = c => { try { localStorage.setItem(PUB_KEY, JSON.stringify(c)); } catch (e) {} };

  function pubAsk(then) {
    const c = pubCfg();
    const wrap = el('div', { style: 'position:fixed;inset:0;background:rgba(15,20,30,.55);z-index:90;display:flex;align-items:center;justify-content:center;padding:24px' });
    const row = (label, key, ph, type) => {
      const i = el('input', { type: type || 'text', value: c[key] || '', placeholder: ph,
        style: 'width:100%;border:1px solid var(--line);border-radius:8px;padding:9px;font-size:13px' });
      return { el: el('label', { style: 'display:block;margin-bottom:12px' },
        el('div', { style: 'font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;opacity:.65;margin-bottom:5px' }, label), i), i };
    };
    const api = row('Publish endpoint', 'api', 'https://yourdomain.com/api/publish.php');
    const tok = row('Token', 'token', 'the long random string from publish-config.php', 'password');
    const prj = row('Folder on the site', 'project', 'vyana — or "root" for the domain itself');
    const note = el('div', { style: 'font-size:12px;opacity:.7;line-height:1.55;margin:4px 0 14px' },
      'The token is kept in this browser only. Upload api/publish.php and api/publish-config.php to your hosting once, put a long random string in the config, then open the endpoint with ?health=1 to check it.');
    const stat = el('div', { style: 'font-size:12.5px;margin-top:10px;min-height:18px' });
    const box = el('div', { style: 'background:var(--surface,#fff);border-radius:12px;max-width:520px;width:100%;padding:22px;box-shadow:0 24px 70px rgba(0,0,0,.3)' },
      el('h3', { style: 'margin:0 0 14px;font-size:16px' }, 'Publish settings'),
      api.el, tok.el, prj.el, note,
      el('div', { style: 'display:flex;gap:8px;justify-content:flex-end' },
        el('button', { class: 'b ghost', type: 'button', onclick: () => wrap.remove() }, 'Cancel'),
        el('button', { class: 'b', type: 'button', onclick: async () => {
          stat.textContent = 'Checking…';
          try {
            const u = api.i.value.trim();
            const r = await fetch(u + (u.indexOf('?') > -1 ? '&' : '?') + 'health=1');
            const j = await r.json();
            stat.textContent = j.ok
              ? 'Reachable. PHP ' + j.php + ', post_max_size ' + j.post_max_size + (j.https ? '' : ' — but it answered over plain HTTP, so publishing will refuse')
              : 'It answered: ' + (j.error || 'something unexpected');
          } catch (e) { stat.textContent = 'Could not reach it: ' + (e.message || e); }
        } }, 'Test'),
        el('button', { class: 'b primary', type: 'button', onclick: () => {
          const next = { api: api.i.value.trim(), token: tok.i.value.trim(), project: prj.i.value.trim().toLowerCase() };
          if (!next.api || !next.token || !next.project) { stat.textContent = 'All three are needed.'; return; }
          pubSave(next); wrap.remove(); if (then) then(next);
        } }, 'Save')),
      stat);
    wrap.append(box); document.body.append(wrap);
    (c.api ? tok.i : api.i).focus();
  }
  $('#btnPublishCfg').onclick = () => pubAsk();

  /* The same file set the ZIP would contain, as plain objects. */
  function siteFiles() {
    gcAssets();
    const resolve = ref => (typeof ref === 'string' && ref.startsWith('a:'))
      ? (P.assets[ref.slice(2)] ? 'assets/' + P.assets[ref.slice(2)].name : '') : (ref || '');
    const XC = exportCfg(), H = hosting();
    const out = [];
    Object.entries(LPTemplate.renderSite(XC, resolve))
      .forEach(([n, html]) => out.push({ path: n, data: html }));
    if (H === 'cpanel') {
      /* lead.php cannot be published through this endpoint — it refuses
         anything the server would execute, on purpose. It goes up with the
         ZIP once, like publish.php itself. */
      out.__needsPhp = true;
    }
    Object.values(P.assets).forEach(a => out.push({ path: 'assets/' + a.name, data: a.data.split(',')[1], b64: true }));
    const robots = 'User-agent: *\nAllow: /\n';
    out.push({ path: 'robots.txt', data: robots });
    return out;
  }

  const bytesOf = f => f.b64 ? Math.ceil(f.data.length * 0.75) : (f.data.length * 1.1);

  async function publishLive() {
    const c = pubCfg();
    if (!c.api || !c.token || !c.project) return pubAsk(() => publishLive());
    if (!validate()) return;

    /* size the batches to what this particular host will accept */
    let cap = 3 * 1024 * 1024;
    try {
      const r = await fetch(c.api + (c.api.indexOf('?') > -1 ? '&' : '?') + 'health=1');
      const j = await r.json();
      const m = String(j.post_max_size || '').match(/^(\d+)([MKG]?)/i);
      if (m) {
        const n = Number(m[1]) * ({ K: 1024, M: 1048576, G: 1073741824 }[(m[2] || '').toUpperCase()] || 1);
        if (n > 0) cap = Math.max(512 * 1024, Math.floor(n * 0.55));
      }
    } catch (e) { /* the default stands */ }

    const files = siteFiles();
    const batches = [];
    let cur = [], size = 0;
    for (const f of files) {
      const b = bytesOf(f);
      if (b > cap) { toast(f.path + ' is larger than this host accepts in one request — shrink that image', 7000); continue; }
      if (cur.length && (size + b > cap || cur.length >= 100)) { batches.push(cur); cur = []; size = 0; }
      cur.push(f); size += b;
    }
    if (cur.length) batches.push(cur);
    if (!batches.length) return toast('Nothing to publish');

    let done = 0, skipped = [], url = null;
    for (let i = 0; i < batches.length; i++) {
      toast('Publishing ' + (i + 1) + ' of ' + batches.length + '…', 4000);
      let j;
      try {
        /* text/plain keeps this a simple request, so no CORS preflight is
           sent — some shared hosts drop OPTIONS entirely. PHP reads the body
           the same way whatever the type says. */
        const r = await fetch(c.api, { method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ token: c.token, project: c.project, files: batches[i] }) });
        j = await r.json();
      } catch (e) { toast('Publishing stopped: ' + (e.message || e), 8000); return; }
      if (!j.ok) {
        toast('The hosting refused it: ' + (j.error || 'unknown') +
          (j.error === 'unauthorized' ? ' — check the token in Publish settings' : ''), 9000);
        return;
      }
      done += (j.written || []).length;
      skipped = skipped.concat(j.skipped || []);
      url = j.url || url;
    }
    if (siteFiles().__needsPhp)
      toast('Published, but api/lead.php is not sent this way — upload it once with Export ZIP', 8000);
    const extra = skipped.length ? ' · ' + skipped.length + ' refused (' + skipped.slice(0, 2).map(s => s[0]).join(', ') + ')' : '';
    toast(done + ' file' + (done === 1 ? '' : 's') + ' live' + extra, 8000);
    if (url) window.open(url, '_blank', 'noopener');
  }
  $('#btnPublish').onclick = () => publishLive()
    .catch(e => toast('Publishing failed: ' + (e.message || e), 7000));

  (async function boot() {
    await DB.open();
    const all = (await DB.all()).sort((a, b) => b.updated - a.updated);
    const handed = readHandover();
    if (handed) {
      history.replaceState(null, '', location.pathname + location.search);
      P = applyBrief(handed);
      await DB.put(P);
      try { localStorage.setItem('lpb_last', P.id); } catch (e) {}
      renderForm(); renderPreview(); refreshProjects(); fitFrame(); pushBack();
      toast((handed.faq || []).length
        ? 'Loaded from Trigger with ' + handed.faq.length + ' keyword FAQs — add the images and export'
        : 'Loaded from Trigger — add the images and export', 5000);
      return;
    }
    let last = null; try { last = localStorage.getItem('lpb_last'); } catch (e) {}
    P = all.find(p => p.id === last) || all[0] || newProject();
    P.cfg = Object.assign(blank(), P.cfg);
    renderForm(); renderPreview(); refreshProjects(); fitFrame(); pushBack();
    if (!all.length) toast('Tip: click "Load Sample" to see a complete example', 4000);
  })();
})();
