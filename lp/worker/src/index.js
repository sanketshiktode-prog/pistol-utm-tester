/* =====================================================================
   Lead Capture API — Cloudflare Worker + D1
   Public:
     POST /api/leads          store lead (+ optional OTP), push to CRM
     POST /api/otp/verify     verify OTP, then push to CRM
     POST /api/otp/resend     resend OTP (30s cooldown, max 4 sends)
   Admin (Authorization: Bearer <ADMIN_TOKEN>):
     GET    /api/admin/leads        ?project=&q=&from=&to=&status=&limit=&offset=
     GET    /api/admin/leads.csv    same filters, CSV download
     GET    /api/admin/stats        ?from=&to=
     POST   /api/admin/leads/:id/push   re-push one lead to CRM
     POST   /api/admin/retry            re-push all failed leads
     DELETE /api/admin/leads/:id
   Cron: retries failed CRM pushes (see wrangler.toml [triggers]).
   ===================================================================== */

const MAX_ATTEMPTS = 5;
const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'gbraid', 'wbraid', 'fbclid', 'msclkid', 'keyword', 'matchtype', 'network', 'adgroup', 'placement'];

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    const cors = corsHeaders(req, env);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    try {
      const p = url.pathname.replace(/\/+$/, '') || '/';
      if (p === '/' || p === '/health') return json({ ok: true, service: 'lead-api', time: new Date().toISOString() }, 200, cors);

      if (req.method === 'POST' && p === '/api/leads') return await createLead(req, env, ctx, cors);
      if (req.method === 'POST' && p === '/api/otp/verify') return await verifyOtp(req, env, ctx, cors);
      if (req.method === 'POST' && p === '/api/otp/resend') return await resendOtp(req, env, cors);

      if (p.startsWith('/api/admin/')) {
        if (!isAdmin(req, env)) return json({ ok: false, error: 'unauthorized' }, 401, cors);
        if (req.method === 'GET' && p === '/api/admin/leads') return await listLeads(url, env, cors);
        if (req.method === 'GET' && p === '/api/admin/leads.csv') return await csvLeads(url, env, cors);
        if (req.method === 'GET' && p === '/api/admin/stats') return await stats(url, env, cors);
        if (req.method === 'POST' && p === '/api/admin/retry') { const n = await retryFailed(env, 200, true); return json({ ok: true, retried: n }, 200, cors); }
        let m = p.match(/^\/api\/admin\/leads\/([\w-]+)\/push$/);
        if (req.method === 'POST' && m) {
          const lead = await env.DB.prepare('SELECT * FROM leads WHERE id=?').bind(m[1]).first();
          if (!lead) return json({ ok: false, error: 'not_found' }, 404, cors);
          const r = await pushLead(env, lead, true);
          return json({ ok: true, crm: r }, 200, cors);
        }
        m = p.match(/^\/api\/admin\/leads\/([\w-]+)$/);
        if (req.method === 'DELETE' && m) {
          await env.DB.batch([env.DB.prepare('DELETE FROM leads WHERE id=?').bind(m[1]), env.DB.prepare('DELETE FROM otps WHERE lead_id=?').bind(m[1])]);
          return json({ ok: true }, 200, cors);
        }
      }
      return json({ ok: false, error: 'not_found' }, 404, cors);
    } catch (e) {
      console.error('Unhandled', e && e.stack || e);
      return json({ ok: false, error: 'server_error' }, 500, cors);
    }
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(retryFailed(env, 100, false));
  }
};

/* ---------------- helpers ---------------- */
function json(obj, status = 200, headers = {}) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers } });
}
function corsHeaders(req, env) {
  const origin = req.headers.get('Origin') || '';
  const allowed = (env.ALLOWED_ORIGINS || '*').split(',').map(s => s.trim()).filter(Boolean);
  let allow = '';
  if (allowed.includes('*')) allow = origin || '*';
  else if (allowed.some(a => a === origin || (a.startsWith('*.') && origin.endsWith(a.slice(1))))) allow = origin;
  const h = { 'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Max-Age': '86400', Vary: 'Origin' };
  if (allow) h['Access-Control-Allow-Origin'] = allow;
  return h;
}
function originAllowed(req, env) {
  const allowed = (env.ALLOWED_ORIGINS || '*').split(',').map(s => s.trim()).filter(Boolean);
  if (allowed.includes('*')) return true;
  const origin = req.headers.get('Origin') || '';
  return allowed.some(a => a === origin || (a.startsWith('*.') && origin.endsWith(a.slice(1))));
}
function isAdmin(req, env) {
  const h = req.headers.get('Authorization') || '';
  const tok = h.replace(/^Bearer\s+/i, '');
  return !!env.ADMIN_TOKEN && tok.length > 0 && timingSafeEq(tok, env.ADMIN_TOKEN);
}
function timingSafeEq(a, b) { if (a.length !== b.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0; }
const clean = (v, max = 300) => (v == null ? '' : String(v)).replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
const newId = () => Date.now().toString(36) + '-' + crypto.getRandomValues(new Uint32Array(1))[0].toString(36);
const randToken = () => [...crypto.getRandomValues(new Uint8Array(16))].map(b => b.toString(16).padStart(2, '0')).join('');
async function sha256(s) { const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)); return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join(''); }
const bool = (v, d = false) => v == null || v === '' ? d : /^(1|true|yes|on)$/i.test(String(v));
function parseJSON(s, d) { try { return s ? JSON.parse(s) : d; } catch (e) { console.error('Bad JSON env var', s); return d; } }

function normPhone(cc, phone) {
  const ccd = clean(cc, 6).replace(/\D/g, '');
  cc = ccd ? '+' + ccd : '+91';
  let p = clean(phone, 20).replace(/\D/g, '');
  if (cc === '+91') { p = p.replace(/^(91|0)(?=\d{10}$)/, ''); if (!/^[6-9]\d{9}$/.test(p)) return null; }
  else if (p.length < 6 || p.length > 13) return null;
  return { cc, phone: p };
}

/* ---------------- create lead ---------------- */
async function createLead(req, env, ctx, cors) {
  if (!originAllowed(req, env)) return json({ ok: false, error: 'origin_not_allowed' }, 403, cors);
  let b;
  try { b = await req.json(); } catch (e) { return json({ ok: false, error: 'invalid_json' }, 400, cors); }
  if (b.website) return json({ ok: true, id: 'hp' }, 200, cors); // honeypot

  const name = clean(b.name, 80);
  if (name.length < 2) return json({ ok: false, error: 'invalid_name' }, 400, cors);
  const ph = normPhone(b.country_code, b.phone);
  if (!ph) return json({ ok: false, error: 'invalid_phone' }, 400, cors);
  const email = clean(b.email, 120).toLowerCase();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return json({ ok: false, error: 'invalid_email' }, 400, cors);

  const ip = req.headers.get('CF-Connecting-IP') || '';
  const cf = req.cf || {};
  const now = new Date();

  // rate limit: max N leads per IP per 10 minutes
  const limit = Number(env.RATE_LIMIT_PER_10MIN || 8);
  if (ip && limit > 0) {
    const since = new Date(now.getTime() - 10 * 60e3).toISOString();
    const r = await env.DB.prepare('SELECT COUNT(*) AS n FROM leads WHERE ip=? AND created_at>?').bind(ip, since).first();
    if (r && r.n >= limit) return json({ ok: false, error: 'rate_limited' }, 429, cors);
  }

  const project_code = clean(b.project_code, 80) || 'default';
  // duplicate: same phone + project within DEDUPE_HOURS
  const dh = Number(env.DEDUPE_HOURS || 24);
  let dup = null;
  if (dh > 0) {
    const since = new Date(now.getTime() - dh * 3600e3).toISOString();
    dup = await env.DB.prepare('SELECT id FROM leads WHERE phone=? AND project_code=? AND created_at>? AND is_duplicate=0 ORDER BY created_at DESC LIMIT 1').bind(ph.phone, project_code, since).first();
  }

  const a = (b.attribution && typeof b.attribution === 'object') ? b.attribution : {};
  const ua = clean(req.headers.get('User-Agent'), 400);
  const smsReady = !!env.SMS_URL;
  const wantsOtp = bool(b.otp) && smsReady && !dup;

  const lead = {
    id: newId(), created_at: now.toISOString(), project_code,
    project_name: clean(b.project_name, 120), developer: clean(b.developer, 120), location: clean(b.location, 160),
    name, country_code: ph.cc, phone: ph.phone, email, config: clean(b.config, 80), form_source: clean(b.form_source, 120),
    landing_url: clean(a.landing_url, 1000), page_url: clean(b.page_url, 1000), referrer: clean(a.referrer, 500),
    device_param: clean(a.device, 40),
    ip, country: clean(cf.country || req.headers.get('CF-IPCountry'), 8), region: clean(cf.region, 80), city: clean(cf.city, 80),
    user_agent: ua, is_mobile: /Mobi|Android|iPhone/i.test(ua) ? 1 : 0,
    is_duplicate: dup ? 1 : 0, otp_required: wantsOtp ? 1 : 0, otp_verified: 0,
    crm_status: dup && !bool(env.CRM_PUSH_DUPLICATES) ? 'skipped' : (wantsOtp ? 'awaiting_otp' : 'pending'),
    crm_attempts: 0, crm_response: dup ? 'duplicate of ' + dup.id : null, crm_pushed_at: null,
    extra: JSON.stringify({ screen: clean(b.screen, 20), dup_of: dup ? dup.id : undefined, attr: cleanAttr(a) })
  };
  UTM_KEYS.forEach(k => { lead[k] = clean(a[k], 300); });

  const cols = Object.keys(lead);
  await env.DB.prepare(`INSERT INTO leads (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`).bind(...cols.map(k => lead[k] ?? null)).run();

  if (wantsOtp) {
    const token = randToken();
    const sent = await issueOtp(env, lead, token, true);
    if (sent) return json({ ok: true, id: lead.id, token, otp_required: true }, 200, cors);
    // SMS failed: don't block the user — push lead unverified
    await env.DB.prepare("UPDATE leads SET otp_required=0, crm_status='pending' WHERE id=?").bind(lead.id).run();
    lead.crm_status = 'pending';
  }
  if (lead.crm_status === 'pending') ctx.waitUntil(pushLead(env, lead));
  return json({ ok: true, id: lead.id, duplicate: !!dup }, 200, cors);
}

/* ---------------- OTP ---------------- */
async function issueOtp(env, lead, token, first) {
  const len = Number(env.OTP_LENGTH || 4);
  const otp = String(crypto.getRandomValues(new Uint32Array(1))[0] % (10 ** len)).padStart(len, '0');
  const hash = await sha256(lead.id + ':' + otp);
  const now = Date.now();
  if (first) await env.DB.prepare('INSERT OR REPLACE INTO otps (lead_id, token, otp_hash, expires_at, attempts, sends, last_sent) VALUES (?,?,?,?,0,1,?)').bind(lead.id, token, hash, now + 10 * 60e3, now).run();
  else await env.DB.prepare('UPDATE otps SET otp_hash=?, expires_at=?, attempts=0, sends=sends+1, last_sent=? WHERE lead_id=?').bind(hash, now + 10 * 60e3, now, lead.id).run();
  return await sendSms(env, lead, otp);
}
async function sendSms(env, lead, otp) {
  // Generic HTTP SMS gateway. Placeholders: {phone} {cc} {ccphone} {otp} {name} {project}
  const fill = (s) => String(s || '')
    .replace(/\{phone\}/g, encodeURIComponent(lead.phone)).replace(/\{cc\}/g, encodeURIComponent(lead.country_code.replace('+', '')))
    .replace(/\{ccphone\}/g, encodeURIComponent(lead.country_code.replace('+', '') + lead.phone)).replace(/\{otp\}/g, otp)
    .replace(/\{name\}/g, encodeURIComponent(lead.name)).replace(/\{project\}/g, encodeURIComponent(lead.project_name || ''));
  const fillRaw = (s) => String(s || '').replace(/\{phone\}/g, lead.phone).replace(/\{cc\}/g, lead.country_code.replace('+', ''))
    .replace(/\{ccphone\}/g, lead.country_code.replace('+', '') + lead.phone).replace(/\{otp\}/g, otp).replace(/\{name\}/g, lead.name).replace(/\{project\}/g, lead.project_name || '');
  try {
    const method = (env.SMS_METHOD || 'GET').toUpperCase();
    const headers = parseJSON(env.SMS_HEADERS, {});
    const init = { method, headers };
    if (method !== 'GET' && env.SMS_BODY) { init.body = fillRaw(env.SMS_BODY); if (!headers['Content-Type']) headers['Content-Type'] = 'application/json'; }
    const r = await fetch(fill(env.SMS_URL), init);
    const t = await r.text();
    if (!r.ok) console.error('SMS failed', r.status, t.slice(0, 300));
    return r.ok;
  } catch (e) { console.error('SMS error', e); return false; }
}
async function verifyOtp(req, env, ctx, cors) {
  let b; try { b = await req.json(); } catch (e) { return json({ ok: false, error: 'invalid_json' }, 400, cors); }
  const id = clean(b.lead_id, 40), token = clean(b.token, 64), otp = clean(b.otp, 8).replace(/\D/g, '');
  const row = await env.DB.prepare('SELECT * FROM otps WHERE lead_id=?').bind(id).first();
  if (!row || !timingSafeEq(row.token, token)) return json({ ok: false, error: 'invalid_request' }, 400, cors);
  if (row.attempts >= 5) return json({ ok: false, error: 'too_many_attempts' }, 429, cors);
  if (Date.now() > row.expires_at) return json({ ok: false, error: 'otp_expired' }, 400, cors);
  if (await sha256(id + ':' + otp) !== row.otp_hash) {
    await env.DB.prepare('UPDATE otps SET attempts=attempts+1 WHERE lead_id=?').bind(id).run();
    return json({ ok: false, error: 'invalid_otp' }, 400, cors);
  }
  await env.DB.batch([
    env.DB.prepare("UPDATE leads SET otp_verified=1, crm_status='pending' WHERE id=?").bind(id),
    env.DB.prepare('DELETE FROM otps WHERE lead_id=?').bind(id)
  ]);
  const lead = await env.DB.prepare('SELECT * FROM leads WHERE id=?').bind(id).first();
  ctx.waitUntil(pushLead(env, lead));
  return json({ ok: true, id }, 200, cors);
}
async function resendOtp(req, env, cors) {
  let b; try { b = await req.json(); } catch (e) { return json({ ok: false, error: 'invalid_json' }, 400, cors); }
  const id = clean(b.lead_id, 40), token = clean(b.token, 64);
  const row = await env.DB.prepare('SELECT * FROM otps WHERE lead_id=?').bind(id).first();
  if (!row || !timingSafeEq(row.token, token)) return json({ ok: false, error: 'invalid_request' }, 400, cors);
  if (Date.now() - row.last_sent < 30e3 || row.sends >= 4) return json({ ok: false, error: 'wait' }, 429, cors);
  const lead = await env.DB.prepare('SELECT * FROM leads WHERE id=?').bind(id).first();
  const ok = await issueOtp(env, lead, token, false);
  return json({ ok }, ok ? 200 : 502, cors);
}

/* ---------------- CRM push ----------------
   CRM_URL            endpoint (required to push)
   CRM_METHOD         POST (default) | GET | PUT
   CRM_FORMAT         json (default) | form | query
   CRM_HEADERS        JSON, e.g. {"Authorization":"Bearer xxx"}
   CRM_FIELD_MAP      JSON {crmField: "template with {{lead_field}}"}; omitted = send whole lead
   CRM_STATIC         JSON of constant fields merged in (api keys, source ids ...)
   CRM_SUCCESS_MATCH  optional substring/regex the response body must contain to count as success
   CRM_ROUTES         optional JSON {project_code: {url, headers, map, static}} per-project overrides
   SHEET_WEBHOOK_URL  optional Google Apps Script web-app URL (mirror every lead into a Sheet)
*/
function crmConfig(env, lead) {
  const routes = parseJSON(env.CRM_ROUTES, {});
  const r = routes[lead.project_code] || {};
  return {
    url: r.url || env.CRM_URL, method: (r.method || env.CRM_METHOD || 'POST').toUpperCase(), format: r.format || env.CRM_FORMAT || 'json',
    headers: Object.assign({}, parseJSON(env.CRM_HEADERS, {}), r.headers || {}),
    map: r.map || parseJSON(env.CRM_FIELD_MAP, null), stat: Object.assign({}, parseJSON(env.CRM_STATIC, {}), r.static || {}),
    success: r.success || env.CRM_SUCCESS_MATCH || '', dropEmpty: bool(r.drop_empty ?? env.CRM_DROP_EMPTY, true)
  };
}
function cleanAttr(a) {
  const o = {}; let n = 0;
  for (const [k, v] of Object.entries(a || {})) { if (n++ >= 40) break; const x = clean(v, 1000); if (x) o[clean(k, 40)] = x; }
  return o;
}
/* Same variable set as the PHP connector — see docs/CRM-INTEGRATION-GUIDE.md */
function leadVars(lead) {
  let ex = {}; try { ex = JSON.parse(lead.extra || '{}'); } catch (e) {}
  const a = Object.assign({}, ex.attr || {});
  UTM_KEYS.forEach(k => { if (lead[k] && !a[k]) a[k] = lead[k]; });
  const g = (...ks) => { for (const k of ks) { const x = clean(a[k], 300); if (x && !/^\{.*\}$/.test(x)) return x; } return ''; };
  const gclid = g('gclid'), gbraid = g('gbraid'), wbraid = g('wbraid'), fbclid = g('fbclid'), msclkid = g('msclkid');
  const ref = clean(lead.referrer || a.referrer, 300);
  let source = g('utm_source', 'source');
  if (!source) source = (gclid || gbraid || wbraid) ? 'google' : fbclid ? 'facebook' : msclkid ? 'bing' : ref ? (() => { try { return new URL(ref).hostname.replace(/^www\./, ''); } catch (e) { return 'referral'; } })() : 'direct';
  const net = g('network');
  let medium = g('utm_medium', 'medium');
  if (!medium && (gclid || gbraid || wbraid)) medium = (net === 'g' || net === 's') ? 'search' : net ? 'demandgen' : 'cpc';
  const mt = g('matchtype'), dev = g('device') || lead.device_param || '';
  const parts = (lead.name || '').trim().split(/\s+/); const first = parts.shift() || ''; const last = parts.join(' ');
  const cc = (lead.country_code || '+91').replace('+', '');
  const ist = new Date(new Date(lead.created_at).getTime() + 5.5 * 3600e3).toISOString().replace('T', ' ').slice(0, 19);
  const v = {
    lead_id: lead.id, created_at_ist: ist, created_at_iso: lead.created_at, epoch_ms: String(new Date(lead.created_at).getTime()),
    name: lead.name, first_name: first, last_name: last, last_name_or_name: last || lead.name,
    phone: lead.phone, country_code: cc, phone_with_cc: cc + lead.phone, full_phone: '+' + cc + lead.phone, email: lead.email || '',
    config: lead.config || '', form_name: lead.form_source || '', project: lead.project_name || '', project_code: lead.project_code || '',
    developer: lead.developer || '', project_location: lead.location || '',
    source, medium,
    campaign: g('utm_campaign', 'campaign') || g('campaignid'), ad_group: g('utm_adgroup', 'adgroup') || g('adgroupid'),
    ad: g('utm_ad', 'ad', 'utm_content') || g('creative'), keyword: g('utm_term', 'keyword'),
    match_type: ({ e: 'exact', p: 'phrase', b: 'broad' })[mt] || mt, strategy: g('strategy', 'utm_strategy'),
    network: ({ g: 'google_search', s: 'search_partner', d: 'display', ytv: 'youtube', gtv: 'google_tv', x: 'pmax' })[net] || net,
    device: ({ m: 'mobile', t: 'tablet', c: 'desktop' })[dev] || dev, placement: g('placement'),
    campaign_id: g('campaignid', 'utm_id'), ad_group_id: g('adgroupid'), ad_id: g('creative'),
    utm_source: g('utm_source'), utm_medium: g('utm_medium'), utm_campaign: g('utm_campaign'), utm_term: g('utm_term'), utm_content: g('utm_content'),
    gclid, gbraid, wbraid, fbclid, msclkid,
    click_id: gclid || gbraid || wbraid || fbclid || msclkid,
    click_id_type: gclid ? 'gclid' : gbraid ? 'gbraid' : wbraid ? 'wbraid' : fbclid ? 'fbclid' : msclkid ? 'msclkid' : '',
    ip_address: lead.ip || '', city: lead.city || '', region: lead.region || '', country: lead.country || '',
    visitor_location: [lead.city, lead.region, lead.country].filter(Boolean).join(', '),
    google_location_id: g('loc_physical', 'loc_physical_ms') || g('loc_interest'),
    landing_page: lead.landing_url || lead.page_url || '', referrer: ref, user_agent: lead.user_agent || '',
    otp_verified: lead.otp_verified ? 'yes' : 'no', is_duplicate: lead.is_duplicate ? 'yes' : 'no'
  };
  const L = { Project: 'project', Form: 'form_name', Source: 'source', Medium: 'medium', Campaign: 'campaign', 'Ad group': 'ad_group', Ad: 'ad', Keyword: 'keyword', 'Match type': 'match_type', Strategy: 'strategy', Network: 'network', Device: 'device', 'Click ID': 'click_id', IP: 'ip_address', Location: 'visitor_location', 'Landing page': 'landing_page' };
  v.summary = Object.entries(L).filter(([, k]) => v[k]).map(([l, k]) => `${l}: ${v[k]}`).join('\n');
  return v;
}
function prune(x) {
  if (Array.isArray(x)) return x.map((o) => [o, prune(o)]).filter(([o, p]) => !isEmpty(p) && !lostValue(o, p)).map(([, p]) => p);
  if (x && typeof x === 'object') { const o = {}; for (const [k, v0] of Object.entries(x)) { const p = prune(v0); if (!isEmpty(p) && !lostValue(v0, p)) o[k] = p; } return o; }
  return x;
}
function isEmpty(v) { return v === '' || v == null || (Array.isArray(v) && !v.length) || (v && typeof v === 'object' && !Array.isArray(v) && !Object.keys(v).length); }
function lostValue(o, p) { return o && typeof o === 'object' && !Array.isArray(o) && (('Value' in o && !('Value' in p)) || ('value' in o && !('value' in p))); }
function flatten(obj, prefix, out) { // {a:{b:1}} -> a[b]=1  (form / query encoding, e.g. Sell.Do)
  out = out || [];
  for (const [k, v] of Object.entries(obj || {})) {
    const key = prefix ? `${prefix}[${k}]` : k;
    if (v && typeof v === 'object') flatten(v, key, out); else out.push([key, v == null ? '' : String(v)]);
  }
  return out;
}
function buildPayload(cfg, lead) {
  const v = leadVars(lead);
  let out;
  if (cfg.map && cfg.map !== '__ALL__') {
    const fillT = (t) => typeof t === 'string' ? t.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => v[k] == null ? '' : String(v[k])) : t;
    const walk = (o) => Array.isArray(o) ? o.map(walk) : (o && typeof o === 'object') ? Object.fromEntries(Object.entries(o).map(([k, x]) => [k, walk(x)])) : fillT(o);
    out = walk(cfg.map);
    if (cfg.dropEmpty) out = prune(out);
  } else out = v;
  return Array.isArray(out) ? out : Object.assign(out, cfg.stat);
}
async function pushLead(env, lead, force) {
  const tasks = [];
  if (env.SHEET_WEBHOOK_URL && !force) tasks.push(fetch(env.SHEET_WEBHOOK_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(leadVars(lead)) }).catch(e => console.error('sheet', e)));
  const cfg = crmConfig(env, lead);
  if (!cfg.url) {
    await env.DB.prepare("UPDATE leads SET crm_status='skipped', crm_response='CRM_URL not configured' WHERE id=?").bind(lead.id).run();
    await Promise.all(tasks);
    return { status: 'skipped' };
  }
  const payload = buildPayload(cfg, lead);
  let url = cfg.url, body;
  const headers = Object.assign({}, cfg.headers);
  if (cfg.format === 'query' || cfg.method === 'GET') {
    const u = new URL(url); flatten(payload).forEach(([k, x]) => u.searchParams.set(k, x)); url = u.toString();
  } else if (cfg.format === 'form') {
    body = new URLSearchParams(flatten(payload)).toString();
    headers['Content-Type'] = headers['Content-Type'] || 'application/x-www-form-urlencoded';
  } else {
    body = JSON.stringify(payload); headers['Content-Type'] = headers['Content-Type'] || 'application/json';
  }
  let status = 'failed', resp = '';
  try {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 15000);
    const r = await fetch(url, { method: cfg.method, headers, body, signal: ctl.signal });
    clearTimeout(t);
    resp = `${r.status} ${(await r.text()).slice(0, 900)}`;
    let ok = r.ok;
    if (ok && cfg.success) { try { ok = new RegExp(cfg.success, 'i').test(resp); } catch (e) { ok = resp.includes(cfg.success); } }
    status = ok ? 'sent' : 'failed';
  } catch (e) { resp = 'ERR ' + (e && e.message || e); }
  await env.DB.prepare('UPDATE leads SET crm_status=?, crm_attempts=crm_attempts+1, crm_response=?, crm_pushed_at=? WHERE id=?')
    .bind(status, resp, new Date().toISOString(), lead.id).run();
  await Promise.all(tasks);
  if (status !== 'sent') console.error('CRM push failed', lead.id, resp);
  return { status, response: resp };
}
async function retryFailed(env, max, includeSkipped) {
  const since = new Date(Date.now() - 3 * 86400e3).toISOString();
  const statuses = includeSkipped ? "('failed','pending','skipped')" : "('failed','pending')";
  const { results } = await env.DB.prepare(`SELECT * FROM leads WHERE crm_status IN ${statuses} AND is_duplicate=0 AND crm_attempts<? AND created_at>? AND created_at<? ORDER BY created_at LIMIT ?`)
    .bind(MAX_ATTEMPTS, since, new Date(Date.now() - 60e3).toISOString(), max).all();
  for (const l of results || []) await pushLead(env, l, true);
  return (results || []).length;
}

/* ---------------- admin ---------------- */
function filters(url) {
  const w = [], a = [];
  const g = (k) => url.searchParams.get(k);
  if (g('project')) { w.push('project_code=?'); a.push(g('project')); }
  if (g('status')) { w.push('crm_status=?'); a.push(g('status')); }
  if (g('source')) { w.push('utm_source=?'); a.push(g('source')); }
  if (g('from')) { w.push('created_at>=?'); a.push(istToUtc(g('from'), false)); }
  if (g('to')) { w.push('created_at<?'); a.push(istToUtc(g('to'), true)); }
  if (g('dupes') === '0') w.push('is_duplicate=0');
  if (g('q')) { w.push('(name LIKE ? OR phone LIKE ? OR email LIKE ? OR utm_campaign LIKE ?)'); const q = '%' + g('q') + '%'; a.push(q, q, q, q); }
  return { where: w.length ? 'WHERE ' + w.join(' AND ') : '', args: a };
}
// date "YYYY-MM-DD" interpreted in IST
function istToUtc(d, endOfDay) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  const t = Date.parse(d + 'T00:00:00+05:30') + (endOfDay ? 86400e3 : 0);
  return new Date(t).toISOString();
}
async function listLeads(url, env, cors) {
  const { where, args } = filters(url);
  const limit = Math.min(500, Number(url.searchParams.get('limit') || 100)), offset = Number(url.searchParams.get('offset') || 0);
  const [rows, cnt] = await env.DB.batch([
    env.DB.prepare(`SELECT * FROM leads ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`).bind(...args, limit, offset),
    env.DB.prepare(`SELECT COUNT(*) AS n FROM leads ${where}`).bind(...args)
  ]);
  return json({ ok: true, total: cnt.results[0].n, leads: rows.results }, 200, cors);
}
async function csvLeads(url, env, cors) {
  const { where, args } = filters(url);
  const { results } = await env.DB.prepare(`SELECT * FROM leads ${where} ORDER BY created_at DESC LIMIT 50000`).bind(...args).all();
  const cols = ['id', 'created_at_ist', 'project_code', 'project_name', 'name', 'country_code', 'phone', 'email', 'config', 'form_source', ...UTM_KEYS, 'device_param', 'landing_url', 'referrer', 'country', 'city', 'is_mobile', 'is_duplicate', 'otp_verified', 'crm_status', 'crm_attempts', 'crm_response'];
  const q = (v) => { v = v == null ? '' : String(v); if (/^(=|@|[+\-](?!\d+$))/.test(v)) v = "'" + v; return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
  const lines = [cols.join(',')].concat((results || []).map(r => { const v = leadVars(r); return cols.map(c => q(v[c])).join(','); }));
  return new Response('﻿' + lines.join('\n'), { headers: { ...cors, 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="leads-${new Date().toISOString().slice(0, 10)}.csv"` } });
}
async function stats(url, env, cors) {
  const { where, args } = filters(url);
  const q = (sql) => env.DB.prepare(sql).bind(...args);
  const [tot, byProj, bySrc, byStatus, byDay, byForm] = await env.DB.batch([
    q(`SELECT COUNT(*) n, SUM(is_duplicate=0) uniq, SUM(otp_verified) verified, SUM(crm_status='sent') sent, SUM(crm_status='failed') failed FROM leads ${where}`),
    q(`SELECT project_code k, COUNT(*) n, SUM(is_duplicate=0) uniq FROM leads ${where} GROUP BY 1 ORDER BY 2 DESC LIMIT 50`),
    q(`SELECT COALESCE(NULLIF(utm_source,''),'(direct)') k, COUNT(*) n FROM leads ${where} GROUP BY 1 ORDER BY 2 DESC LIMIT 20`),
    q(`SELECT crm_status k, COUNT(*) n FROM leads ${where} GROUP BY 1`),
    q(`SELECT substr(datetime(created_at,'+330 minutes'),1,10) k, COUNT(*) n FROM leads ${where} GROUP BY 1 ORDER BY 1 DESC LIMIT 31`),
    q(`SELECT CASE WHEN instr(form_source,':')>0 THEN substr(form_source,1,instr(form_source,':')-1) ELSE form_source END k, COUNT(*) n FROM leads ${where} GROUP BY 1 ORDER BY 2 DESC LIMIT 20`)
  ]);
  return json({ ok: true, totals: tot.results[0], by_project: byProj.results, by_source: bySrc.results, by_status: byStatus.results, by_day: byDay.results, by_form: byForm.results }, 200, cors);
}
