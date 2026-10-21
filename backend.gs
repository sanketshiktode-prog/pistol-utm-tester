/* ═══════════════════════════════════════════════════════════════════════
   Search Ops Toolkit — backend logic.

   This file is NOT pasted into Apps Script. The small Code.gs loader there
   fetches it from this repository and evaluates it, so the backend updates
   when this file is pushed rather than when somebody copies and pastes.

   Nothing here reads a secret from the repository: the developer token, the
   manager account ID and the Gemini key all come from Script Properties,
   which live in the Apps Script project and never leave it.
   ═══════════════════════════════════════════════════════════════════════ */

/**
 * Search Ops Toolkit — one file, three jobs.
 *
 *   1. Check that whoever is calling is a verified propertypistol.com account,
 *      and record every action in this spreadsheet.
 *   2. Read landing pages with Gemini, so the API key stays here and never
 *      reaches the browser.
 *   3. Create campaigns in Google Ads through the API.
 *
 * ---------------------------------------------------------------------------
 * FILL IN THE SIX VALUES BELOW. Nothing else in this file needs touching.
 * ---------------------------------------------------------------------------
 *
 * Then, once:
 *
 *   A. Project Settings → Google Cloud Project → Change project → 779938081992
 *      (that number is the front half of your OAuth client ID — same project)
 *   B. console.cloud.google.com → that project → APIs & Services → Library
 *      → "Google Ads API" → Enable
 *   C. Project Settings → tick "Show appsscript.json" → open it → set:
 *        "oauthScopes": [
 *          "https://www.googleapis.com/auth/adwords",
 *          "https://www.googleapis.com/auth/script.external_request",
 *          "https://www.googleapis.com/auth/spreadsheets.currentonly",
 *          "https://www.googleapis.com/auth/userinfo.email"
 *        ]
 *   D. Pick adsSelfTest in the function dropdown → Run → accept the prompt.
 *      It should print HTTP 200. This step is the one people skip.
 *   E. Deploy → New deployment → Web app, Execute as: Me, Access: Anyone.
 *      The /exec URL goes in AUTH.logUrl in index.html.
 *
 * AFTER EVERY LATER EDIT TO THIS FILE:
 *   Deploy → Manage deployments → pencil → Version: New version → Deploy.
 *   Saving alone does not change what the live URL runs.
 */

/* ======================= SETTINGS, SET ONCE ===============================

   These live in Project Settings -> Script Properties, NOT in this file, so
   replacing the code never wipes them again.

   Apps Script editor -> gear (Project Settings) -> Script Properties ->
   Add script property. Add these three:

       ADS_DEV_TOKEN    your Google Ads developer token
       ADS_LOGIN_CID    the manager account ID, digits only, no dashes
                        (the TEST manager while trialling: 4540212054)
       GEMINI_KEY       your AI Studio key, for reading landing pages

   Run showSettings() afterwards to confirm all three are in.

   The values written below are only a fallback for anything not set as a
   property, so an existing setup keeps working untouched.
   ========================================================================= */

/* Configuration — cfg_, CLIENT_ID, GEMINI_KEY, DOMAIN, ADMIN, SHEET and ADS —
   is NOT declared here. It lives in the Code.gs loader in the Apps Script
   project, which is where the developer token and the Gemini key belong: this
   file is public. Declaring them again would also collide, because this file
   is evaluated inside that project's scope. */

/* ===================== nothing below needs editing ===================== */

function handlePost(e) {
  let body = {};
  try { body = JSON.parse(e.postData.contents); } catch (err) {
    return json({ error: 'malformed request' });
  }
  const v = verify(body.credential);

  /* Google Ads API work lives in apps-script-ads-api.gs, in this same
     project. Same deployment, same sign-in check, same log. */
  if (String(body.action || '').indexOf('ads-') === 0) {
    if (!v.ok) return json({ error: 'Sign in again \u2014 ' + v.reason });
    if (typeof adsRoute !== 'function')
      return json({ error: 'apps-script-ads-api.gs is not in this project yet.' });
    var out = adsRoute(body, v);
    return json(out || { error: 'Unknown ads action: ' + body.action });
  }

  /* The browser cannot fetch another site directly, and the public text
     proxies are blocked by most landing pages. Apps Script has no such
     restriction, so the page is fetched here, cleaned here, and read here. */
  if (body.action === 'read') {
    if (!v.ok) return json({ error: 'Sign in again — ' + v.reason });
    const page = fetchPage(body.url);
    if (page.error) {
      write([new Date(), v.email, v.name, role(v.email), 'lp-read', body.url, page.error]);
      return json({ error: page.error });
    }
    var out = GEMINI_KEY ? extract(page.text) : { error: 'Gemini key not set in the Apps Script' };
    out._chars = page.text.length;
    out._via = 'Apps Script';
    out._text = page.text.slice(0, 20000);
    write([new Date(), v.email, v.name, role(v.email), 'lp-read', body.url, out.error || '']);
    return json(out);
  }

  if (body.action === 'extract') {
    if (!v.ok) return json({ error: 'Sign in again — ' + v.reason });
    if (!GEMINI_KEY) return json({ error: 'Gemini key not set in the Apps Script' });
    const out = extract(body.text || '');
    write([new Date(), v.email, v.name, role(v.email), 'lp-read',
           (body.text || '').slice(0, 60), out.error || '']);
    return json(out);
  }

  /* The /exec URL sits in a public page, so anyone can post to it. Accepted
     rows need a verified propertypistol.com token, which nothing forged gets
     past. Rejected ones are still worth recording — an outside attempt should
     leave a trace — but not without limit, or the sheet can be filled with
     junk by anyone who finds the URL. Fifty a day is plenty to spot a
     pattern. */
  if (!v.ok && !rejectBudget()) return json({ ok: true });

  write([
    new Date(),
    v.ok ? v.email : (body.email || 'unknown'),
    v.ok ? v.name  : (body.name  || ''),
    v.ok ? role(v.email) : 'REJECTED',
    body.action || '',
    String(body.detail || '').slice(0, 500),
    v.ok ? '' : v.reason
  ]);
  return json({ ok: true });
}

/** Fetch the page as a browser would, then reduce it to readable text. */
function fetchPage(url) {
  if (!url) return { error: 'no URL' };
  try {
    const res = UrlFetchApp.fetch(url, {
      muteHttpExceptions: true,
      followRedirects: true,
      validateHttpsCertificates: false,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
                      '(KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-IN,en;q=0.9'
      }
    });
    const code = res.getResponseCode();
    if (code >= 400) return { error: 'The page returned ' + code };
    const html = res.getContentText();
    if (!html || html.length < 200) return { error: 'The page came back empty' };
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<\/(p|div|li|h[1-6]|tr|td|br|section)>/gi, '\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&')
      .replace(/&#8377;/g, '\u20b9')
      .replace(/&[a-z]+;/gi, ' ')
      .replace(/[ \t]{2,}/g, ' ')
      .replace(/\n{2,}/g, '\n')
      .trim();
    return { text: text };
  } catch (err) {
    return { error: 'Could not fetch the page: ' + err };
  }
}

/** Gemini reads the page. The key never leaves this script. */
function extract(text) {
  const prompt =
    'Extract details of this Indian or UAE real estate project from the page text.\n' +
    'Reply with ONLY a JSON object, no markdown, using exactly these keys:\n' +
    '{"proj":"","dev":"","micro":"","city":"","cfg":"","price":"","allIn":"",' +
    '"possession":"","rera":"","usps":[],"amenities":[],"landmarks":[]}\n' +
    'Rules: proj is the project name only, without the developer. dev is the developer.\n' +
    'micro is the locality, city is the city. cfg is like "2, 2.5 & 3 BHK" or "Studio, 1 & 2 BR".\n' +
    'price is the starting price as written, e.g. "\u20b985 Lakhs" or "AED 1.8 M".\n' +
    'allIn is "yes" if the price is all inclusive, "no" if charges are extra, else "".\n' +
    'usps are selling points under 30 characters each, e.g. "21 Acre Township".\n' +
    'amenities are single amenity names. landmarks are "Name - 25 Mins" style entries.\n' +
    'Use "" or [] for anything not stated. Do not invent anything.\n\nPAGE TEXT:\n' +
    String(text).slice(0, 26000);

  const models = ['gemini-2.0-flash', 'gemini-1.5-flash'];
  for (let i = 0; i < models.length; i++) {
    try {
      const res = UrlFetchApp.fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/' + models[i] +
        ':generateContent?key=' + encodeURIComponent(GEMINI_KEY),
        { method: 'post', contentType: 'application/json', muteHttpExceptions: true,
          payload: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0, maxOutputTokens: 1200,
                                responseMimeType: 'application/json' }
          }) });
      if (res.getResponseCode() !== 200) continue;
      const j = JSON.parse(res.getContentText());
      const t = j.candidates[0].content.parts[0].text.replace(/```json|```/g, '').trim();
      return JSON.parse(t);
    } catch (err) { /* try the next model */ }
  }
  return { error: 'Gemini did not answer' };
}

/** Ask Google whether the token is genuine, then apply our own rules. */
function verify(credential) {
  if (!credential) return { ok: false, reason: 'no token' };
  try {
    const res = UrlFetchApp.fetch(
      'https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(credential),
      { muteHttpExceptions: true });
    if (res.getResponseCode() !== 200) return { ok: false, reason: 'token not valid' };
    const t = JSON.parse(res.getContentText());
    if (CLIENT_ID && t.aud !== CLIENT_ID)  return { ok: false, reason: 'wrong client id' };
    if (Number(t.exp) * 1000 < Date.now()) return { ok: false, reason: 'token expired' };
    const email = String(t.email || '').toLowerCase();
    if (t.hd !== DOMAIN && email.indexOf('@' + DOMAIN) === -1)
      return { ok: false, reason: 'outside ' + DOMAIN + ': ' + email };
    return { ok: true, email: email, name: t.name || email };
  } catch (err) {
    return { ok: false, reason: 'verify failed: ' + err };
  }
}

function role(email) { return email === ADMIN ? 'admin' : 'user'; }

/* Caps how many rejected attempts get written in a day. */
function rejectBudget() {
  const sp = PropertiesService.getScriptProperties();
  const k = 'rej-' + Utilities.formatDate(new Date(), 'UTC', 'yyyy-MM-dd');
  const n = Number(sp.getProperty(k) || 0);
  if (n >= 50) return false;
  sp.setProperty(k, String(n + 1));
  return true;
}

function write(row) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET);
  if (!sh) {
    sh = ss.insertSheet(SHEET);
    sh.appendRow(['Time', 'Email', 'Name', 'Role', 'Action', 'Detail', 'Note']);
    sh.setFrozenRows(1);
  }
  sh.appendRow(row);
}

function json(o) {
  return ContentService.createTextOutput(JSON.stringify(o))
    .setMimeType(ContentService.MimeType.JSON);
}

function handleGet() {
  return ContentService.createTextOutput('Search Ops Toolkit endpoint is running.');
}

/* Validating costs nothing and creates nothing, so it is open to the same
   people as the rest of the toolkit. Deploying is not. */
function adsGate(v, action, cid) {
  const email = String((v && v.email) || '').toLowerCase();
  if (!email) return 'Not signed in.';
  if (action !== 'ads-deploy') return '';

  const list = (ADS.allowEmails || []).map(function (x) { return String(x).toLowerCase(); });
  if (!list.length)
    return 'Deploying is switched off. Add the emails allowed to deploy to ADS.allowEmails in the Apps Script.';
  if (list.indexOf(email) === -1)
    return email + ' is not on the deploy list. Validating works for everyone; creating campaigns does not. ' +
           'Add the address to ADS.allowEmails if that is wrong.';

  const n = Number(PropertiesService.getScriptProperties()
    .getProperty('deploys-' + email + '-' + Utilities.formatDate(new Date(), 'UTC', 'yyyy-MM-dd')) || 0);
  if (n >= ADS.maxDeploysPerDay)
    return 'That is ' + n + ' deploys today, which is the daily cap. Raise ADS.maxDeploysPerDay if it is genuine.';
  return '';
}

function adsCountDeploy(email) {
  const k = 'deploys-' + String(email).toLowerCase() + '-' +
            Utilities.formatDate(new Date(), 'UTC', 'yyyy-MM-dd');
  const sp = PropertiesService.getScriptProperties();
  sp.setProperty(k, String(Number(sp.getProperty(k) || 0) + 1));
}

/* Router entry. apps-script-log.gs calls this from doPost. */
function adsRoute(body, v) {
  const stop = adsGate(v, body.action, body.customerId);
  if (stop) return { error: stop };
  if (body.action === 'ads-check')  return adsCheck(body);
  if (body.action === 'ads-geo')    return adsGeo(body);
  if (body.action === 'ads-accounts') return adsAccounts(body);
  if (body.action === 'ads-lists')    return adsSharedSets(body);
  if (body.action === 'ads-segments') return adsSegments(body, v);
  if (body.action === 'ads-deploy') return adsDeploy(body, v);
  return null;
}

/* ── plumbing ─────────────────────────────────────────────────────────────── */

function adsHeaders() {
  const h = {
    Authorization    : 'Bearer ' + ScriptApp.getOAuthToken(),
    'developer-token': ADS.devToken
  };
  if (ADS.loginCid) h['login-customer-id'] = digits(ADS.loginCid);
  return h;
}

function digits(s) { return String(s || '').replace(/[^0-9]/g, ''); }

function adsCall(path, payload) {
  if (!ADS.devToken) return { error: 'No developer token in the Apps Script. Put it in ADS.devToken.' };
  var res;
  try {
    res = UrlFetchApp.fetch(ADS.host + '/' + ADS.version + '/' + path, {
      method: 'post', contentType: 'application/json',
      headers: adsHeaders(), muteHttpExceptions: true,
      payload: JSON.stringify(payload)
    });
  } catch (err) {
    return { error: 'Could not reach the Google Ads API: ' + err };
  }
  const code = res.getResponseCode();
  const text = res.getContentText();
  var body = {};
  try { body = JSON.parse(text); } catch (e) { body = { raw: text.slice(0, 1200) }; }
  if (code === 200) return { ok: true, body: body };
  return { error: adsError(code, body), code: code, detail: body };
}

/* The API's own message is the only useful one. It names the field that was
   wrong, which is worth more than any wrapper this script could add. */
function adsError(code, body) {
  const out = [];
  const e = body && body.error;
  if (e && e.details) {
    e.details.forEach(function (d) {
      (d.errors || []).forEach(function (x) {
        const where = x.location && x.location.fieldPathElements
          ? x.location.fieldPathElements.map(function (f) {
              return f.fieldName + (f.index === undefined ? '' : '[' + f.index + ']');
            }).join(' > ')
          : '';
        out.push((where ? where + ': ' : '') + (x.message || JSON.stringify(x.errorCode || {})));
      });
    });
  }
  if (!out.length && e && e.message) out.push(e.message);
  if (!out.length) out.push('HTTP ' + code + ' ' + JSON.stringify(body).slice(0, 600));
  if (code === 401) out.push('401 usually means the adwords scope is missing from appsscript.json, ' +
    'or adsSelfTest() has not been run to accept it.');
  if (code === 403) out.push('403 usually means the developer token has Test access and you pointed it ' +
    'at a production account, or the signed-in Google account has no access to that customer ID.');
  if (/login-customer-id|does not have permission to access customer|doesn't have permission to access customer/i.test(out.join(' ')))
    out.push('Most often this is ADS_LOGIN_CID holding a CLIENT account ID. It must hold the MANAGER ' +
      'account that sits above the client \u2014 the test manager while trialling (4540212054), the ' +
      'production MCC once Basic access is approved. The client ID goes in the Customer ID box.');
  return out.join(' | ');
}

/* ── is any of this wired up? ─────────────────────────────────────────────── */

function adsCheck(body) {
  const notes = [];
  if (!ADS.devToken) notes.push('Developer token is not set in ADS.devToken.');
  if (!ADS.loginCid) notes.push('Manager customer ID is not set in ADS.loginCid. Needed when the ' +
    'account sits under an MCC, which is the normal case.');
  const cid = digits(body.customerId);
  if (!cid) return { error: 'No customer ID given.' };
  if (cid.length !== 10) notes.push('A Google Ads customer ID is 10 digits. "' + cid + '" is ' + cid.length + '.');

  /* listAccessibleCustomers is the cheapest call that proves the token, the
     scope and the developer token all work together. */
  var r;
  try {
    r = UrlFetchApp.fetch(ADS.host + '/' + ADS.version + '/customers:listAccessibleCustomers',
      { method: 'get', headers: adsHeaders(), muteHttpExceptions: true });
  } catch (err) { return { error: 'Could not reach the Google Ads API: ' + err }; }
  if (r.getResponseCode() !== 200) {
    var b = {}; try { b = JSON.parse(r.getContentText()); } catch (e) {}
    return { error: adsError(r.getResponseCode(), b), notes: notes };
  }
  var list = [];
  try { list = (JSON.parse(r.getContentText()).resourceNames || [])
    .map(function (x) { return x.split('/').pop(); }); } catch (e) {}

  /* A test account says so on the customer record. Worth surfacing, because
     it is the difference between a trial and real money. */
  /* The commonest setup mistake: the client account ID typed into loginCid.
     Both are ten digits, and Google's own error only hints at it. */
  if (digits(ADS.loginCid) === cid)
    notes.push('ADS_LOGIN_CID is the same as the Customer ID. The manager account goes in ' +
      'ADS_LOGIN_CID; the client account goes in the Customer ID box. They are never the same.');

  const q = adsCall('customers/' + cid + '/googleAds:search', {
    query: 'SELECT customer.id, customer.descriptive_name, customer.currency_code, ' +
           'customer.test_account, customer.manager, customer.status FROM customer LIMIT 1'
  });
  if (q.error) return { error: q.error, accessible: list, notes: notes };
  const c = (q.body.results && q.body.results[0] && q.body.results[0].customer) || {};
  return {
    ok: true, version: ADS.version, accessible: list, notes: notes,
    /* What this copy of the script can build. The toolkit reads it before a
       Demand Gen deploy: an older script has no Demand Gen builder and would
       quietly create a Search campaign under Demand Gen names. */
    capabilities: { channels: ['search', 'demandgen'], build: 'b-21oct-10' },
    customer: {
      id: c.id, name: c.descriptiveName, currency: c.currencyCode,
      test: !!c.testAccount, manager: !!c.manager, status: c.status
    }
  };
}

/* ── every client account under the manager, by name ──────────────────────── */

/* Typing a customer ID by hand is how campaigns end up in the wrong client
   account, and with one account per project that is an expensive mistake to
   find later. One query against the manager returns every child with its
   name, so the account is picked from a list instead of typed. */
function adsAccounts(body) {
  const mgr = digits(body.managerId) || digits(ADS.loginCid);
  if (!mgr) return { error: 'No manager account ID. Set ADS.loginCid in the Apps Script.' };
  const r = adsCall('customers/' + mgr + '/googleAds:search', {
    query: 'SELECT customer_client.id, customer_client.descriptive_name, ' +
           'customer_client.manager, customer_client.test_account, ' +
           'customer_client.status, customer_client.currency_code, ' +
           'customer_client.level FROM customer_client'
  });
  if (r.error) return { error: r.error };
  const out = [];
  (r.body.results || []).forEach(function (x) {
    const c = x.customerClient || {};
    if (c.manager) return;                       /* managers hold no campaigns */
    out.push({
      id: String(c.id || ''),
      name: c.descriptiveName || '(no name)',
      test: !!c.testAccount,
      status: c.status || '',
      currency: c.currencyCode || ''
    });
  });
  out.sort(function (a2, b2) { return a2.name.localeCompare(b2.name); });
  return { ok: true, manager: mgr, accounts: out };
}

/* ── negative keyword lists already in the account ────────────────────────── */

/* Lists built once in the manager account and shared down. They are attached
   by resource name, so nothing is copied and a later edit to the list reaches
   every campaign already using it. */
function adsSharedSets(body) {
  const cid = digits(body.customerId);
  if (!cid) return { error: 'No customer ID given.' };
  const r = adsCall('customers/' + cid + '/googleAds:search', {
    query: 'SELECT shared_set.id, shared_set.name, shared_set.type, ' +
           'shared_set.status, shared_set.member_count, shared_set.resource_name ' +
           "FROM shared_set WHERE shared_set.type = 'NEGATIVE_KEYWORDS' " +
           "AND shared_set.status = 'ENABLED'"
  });
  if (r.error) return { error: r.error };
  const out = (r.body.results || []).map(function (x) {
    const sh = x.sharedSet || {};
    return { rn: sh.resourceName, id: String(sh.id || ''),
             name: sh.name || '(no name)', members: Number(sh.memberCount || 0) };
  });
  out.sort(function (a2, b2) { return a2.name.localeCompare(b2.name); });
  return { ok: true, lists: out };
}

/* ── turn a location name into the ID the API needs ───────────────────────── */

function adsGeo(body) {
  const names = (body.names || []).filter(String).slice(0, 10);
  if (!names.length) return { error: 'No location names given.' };
  const r = adsCall('geoTargetConstants:suggest', {
    locale: 'en',
    countryCode: body.countryCode || 'IN',
    locationNames: { names: names }
  });
  if (r.error) return { error: r.error + ' — paste the location ID by hand instead; ' +
    'Editor shows it in the Locations view.' };
  const out = (r.body.geoTargetConstantSuggestions || []).map(function (s) {
    const g = s.geoTargetConstant || {};
    return { id: g.id, name: g.name, canonical: g.canonicalName,
             type: g.targetType, country: g.countryCode, reach: s.reach };
  });
  return { ok: true, suggestions: out };
}

/* ── build the custom segments in the account ─────────────────────────────── */

/* A custom segment CAN be created through the API, contrary to the note this
   toolkit used to carry: CustomAudience takes KEYWORD, URL and APP members.
   It is not part of googleAds:mutate though \u2014 custom_audience_operation is
   absent from MutateOperation \u2014 so it goes to its own endpoint.

   Creating them here is what lets a Demand Gen deploy actually attach them:
   a segment with no ID can only be reported as skipped. */
const CS_TYPE = {
  'Search terms'    : ['KEYWORD', 'People who searched any of these terms'],
  'Website URLs'    : ['URL',     'People who browse types of websites'],
  'YouTube channels': ['URL',     'People who browse these channels'],
  'Apps'            : ['APP',     'People who use types of apps']
};

function adsSegments(body, v) {
  const cid = digits(body.customerId);
  if (!cid) return { error: 'No customer ID given.' };
  const rows = body.segments || [];
  if (!rows.length) return { error: 'No segments were sent.' };

  /* What is already there, so a second press does not make duplicates. */
  const have = {};
  const q = adsCall('customers/' + cid + '/googleAds:search', {
    query: 'SELECT custom_audience.id, custom_audience.name, custom_audience.status ' +
           "FROM custom_audience WHERE custom_audience.status = 'ENABLED'"
  });
  if (!q.error) (q.body.results || []).forEach(function (x) {
    const ca = x.customAudience || {};
    if (ca.name) have[String(ca.name).toLowerCase()] = String(ca.id);
  });

  const out = [], ops = [], pending = [];
  rows.forEach(function (r) {
    const name = String(r.name || '').trim();
    const kind = String(r.kind || '').trim();
    const input = String(r.input || '').trim();
    if (!name || !input || !CS_TYPE[kind]) return;
    const existing = have[name.toLowerCase()];
    if (existing) { out.push({ name: name, id: existing, made: false }); return; }
    const member = { memberType: CS_TYPE[kind][0] };
    if (CS_TYPE[kind][0] === 'KEYWORD') member.keyword = input;
    else if (CS_TYPE[kind][0] === 'URL') member.url = input;
    else member.app = input;
    ops.push({ create: {
      name: name,
      /* AUTO lets Google read the signal from the members, which is what the
         interface does for a custom segment. */
      type: 'AUTO',
      description: 'Built by the Search Ops Toolkit',
      members: [member]
    }});
    pending.push(name);
  });

  if (ops.length) {
    const r = adsCall('customers/' + cid + '/customAudiences:mutate', { operations: ops });
    if (r.error) return { error: r.error, created: out };
    (r.body.results || []).forEach(function (res, i) {
      const id = String(res.resourceName || '').split('/').pop();
      out.push({ name: pending[i], id: id, made: true });
    });
  }

  try {
    if (v && v.ok && typeof write === 'function')
      write([new Date(), v.email, v.name, typeof role === 'function' ? role(v.email) : '',
             'ads-segments', cid, out.length + ' segments']);
  } catch (e) {}
  return { ok: true, customerId: cid, segments: out };
}

/* ── the deploy ───────────────────────────────────────────────────────────── */

const PINS = { '1': 'HEADLINE_1', '2': 'HEADLINE_2', '3': 'HEADLINE_3' };
const DPIN = { '1': 'DESCRIPTION_1', '2': 'DESCRIPTION_2' };
const MT   = { E: 'EXACT', P: 'PHRASE', B: 'BROAD' };
/* Search campaigns take image assets as AD_IMAGE. SQUARE_MARKETING_IMAGE and
   MARKETING_IMAGE belong to Performance Max and are refused on Search with
   FIELD_TYPE_INCOMPATIBLE_WITH_CAMPAIGN_TYPE. The ratio lives in the image
   itself, so both shapes use the same field type. */
const IMAGE_SLOTS = [
  ['square',    'AD_IMAGE', 'Square image'],
  ['landscape', 'AD_IMAGE', 'Landscape image']
];
/* Business name and logo are account-wide on Search, not per campaign, and
   Google gates them behind advertiser verification. A test account can never
   be verified, so these are attempted separately and never allowed to fail a
   campaign that is otherwise fine. */
const BRAND_SLOTS = [
  ['businessName', 'BUSINESS_NAME', 'Business name'],
  ['logo',         'LOGO',          'Logo']
];

function adsDeploy(body, v) {
  const plan = body.plan || {};
  const cid  = digits(body.customerId);
  const dry  = body.mode !== 'deploy';
  if (!cid) return { error: 'No customer ID given.' };
  if (!plan.campaigns || !plan.campaigns.length) return { error: 'The plan has no campaigns in it.' };

  /* A real deploy checks the account before touching it. An allowlisted ID is
     taken as deliberate; anything else has to be a test account, which cannot
     serve an ad or spend a rupee. */
  if (!dry) {
    const allow = (ADS.allowCustomerIds || []).map(digits).filter(String);
    if (allow.indexOf(cid) === -1) {
      const who = adsCheck({ customerId: cid });
      if (who.error) return { error: 'Could not confirm what account ' + cid + ' is, so nothing was created. ' + who.error };
      if (!(who.customer && who.customer.test))
        return { error: 'Account ' + cid + ' (' + ((who.customer && who.customer.name) || '?') +
          ') is a live account and is not in ADS.allowCustomerIds, so nothing was created. ' +
          'Add it to that list in the Apps Script when you mean to deploy to it. ' +
          'Test accounts need no entry.' };
    }
    adsCountDeploy((v && v.email) || 'unknown');
  }

  const results = [];
  for (var i = 0; i < plan.campaigns.length; i++) {
    const c = plan.campaigns[i];
    var ops, notes = [];
    const isDG = String(plan.channel || '') === 'demandgen';
    try { ops = isDG ? buildDgOps(cid, plan, c, notes) : buildOps(cid, plan, c); }
    catch (err) { results.push({ campaign: c.name, error: 'Could not build the request: ' + err }); continue; }

    const req = { mutateOperations: ops, validateOnly: dry, responseContentType: 'RESOURCE_NAME_ONLY' };
    const r = adsCall('customers/' + cid + '/googleAds:mutate', req);
    if (r.error) {
      results.push({ campaign: c.name, operations: ops.length, error: r.error });
    } else {
      const made = (r.body.mutateOperationResponses || []).length;
      const row = { campaign: c.name, operations: ops.length, created: made,
                    resources: resourceNames(r.body) };
      if (notes.length) row.notes = notes;
      /* Business name and logo sit behind advertiser verification, which a
         test account can never pass. They go in their own call so a refusal
         there leaves the campaign, keywords and ads standing. */
      if (!dry && !isDG) {
        const campRn = firstCampaign(r.body);
        const brand = buildBrandOps(cid, plan, campRn);
        if (brand.length) {
          const r2 = adsCall('customers/' + cid + '/googleAds:mutate',
            { mutateOperations: brand, responseContentType: 'RESOURCE_NAME_ONLY' });
          row.brand = r2.error
            ? { ok: false, count: brand.length, error: r2.error }
            : { ok: true,  count: brand.length };
        }
      }
      results.push(row);
    }
    /* Logging must never be the thing that fails a deploy that already
       happened. write() lives in apps-script-log.gs; if only this file was
       pasted in, the campaigns are still built and the run still reports. */
    try {
      if (v && v.ok && typeof write === 'function') {
        write([new Date(), v.email, v.name,
               typeof role === 'function' ? role(v.email) : '',
               dry ? 'ads-validate' : 'ads-deploy',
               cid + ' / ' + c.name,
               results[results.length - 1].error || (ops.length + ' operations')]);
      }
    } catch (err) { /* nothing here is worth losing a built campaign over */ }
  }
  const failed = results.filter(function (x) { return x.error; }).length;
  return { ok: !failed, mode: dry ? 'validate' : 'deploy', customerId: cid,
           campaigns: results, failed: failed };
}

/* The campaign's real resource name, read back from the first response. */
function firstCampaign(b) {
  const rs = b.mutateOperationResponses || [];
  for (var i = 0; i < rs.length; i++) {
    if (rs[i].campaignResult && rs[i].campaignResult.resourceName)
      return rs[i].campaignResult.resourceName;
  }
  return '';
}

/* Business name and logo, attached to the account rather than the campaign:
   on Search they are account-wide settings, not per-campaign ones. */
function buildBrandOps(cid, plan, campRn) {
  const A = plan.assets || {};
  const base = 'customers/' + cid + '/';
  const ops = [];
  var tmp = -1000;                       /* own range, own request */
  const pairs = [];

  if (A.businessName && String(A.businessName).trim()) {
    const rn = base + 'assets/' + (--tmp);
    ops.push({ assetOperation: { create: {
      resourceName: rn, name: 'Business name ' + new Date().getTime(),
      textAsset: { text: String(A.businessName).trim().slice(0, 25) } } } });
    pairs.push([rn, 'BUSINESS_NAME']);
  }
  if (A.logo && A.logo.data) {
    const rn = base + 'assets/' + (--tmp);
    ops.push({ assetOperation: { create: {
      resourceName: rn, name: 'Logo ' + new Date().getTime(),
      imageAsset: { data: A.logo.data } } } });
    pairs.push([rn, 'LOGO']);
  }
  if (!ops.length) return [];
  pairs.forEach(function (pr) {
    ops.push({ customerAssetOperation: { create: {
      asset: pr[0], fieldType: pr[1] } } });
  });
  return ops;
}

function resourceNames(b) {
  const out = {};
  (b.mutateOperationResponses || []).forEach(function (r) {
    Object.keys(r).forEach(function (k) {
      if (r[k] && r[k].resourceName) {
        out[k] = out[k] || [];
        if (out[k].length < 3) out[k].push(r[k].resourceName);
      }
    });
  });
  return out;
}

/* Operations are grouped by type and parents come before children, because
   alternating types makes the API split the request into separate backend
   calls and large builds then time out. */
function buildOps(cid, plan, c) {
  const S = plan.settings || {};
  const base = 'customers/' + cid + '/';
  var tmp = 0;
  const next = function () { return --tmp; };            // -1, -2, -3 ...
  const ops = [];

  const budgetId = next();
  const budgetRn = base + 'campaignBudgets/' + budgetId;
  ops.push({ campaignBudgetOperation: { create: {
    resourceName  : budgetRn,
    name          : c.name + ' budget ' + new Date().getTime(),
    amountMicros  : String(Math.round(Number(S.dailyBudget || 1000) * 1e6)),
    deliveryMethod: 'STANDARD',
    explicitlyShared: false
  }}});

  const campId = next();
  const campRn = base + 'campaigns/' + campId;
  const camp = {
    resourceName: campRn,
    name        : c.name,
    status      : (S.status || 'PAUSED'),
    advertisingChannelType: 'SEARCH',
    campaignBudget: budgetRn,
    /* Declared on every campaign. Google rejects an undeclared one, and from
       April 2026 one undeclared campaign fails every later mutate on the
       whole account. */
    containsEuPoliticalAdvertising: S.euPolitical || 'DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING',
    /* Presence, not presence-or-interest. Google's default serves to anyone
       searching about the city from anywhere in the world, which is where the
       out-of-market traffic came from. */
    geoTargetTypeSetting: {
      positiveGeoTargetType: S.presence || 'PRESENCE',
      negativeGeoTargetType: 'PRESENCE'
    },
    networkSettings: {
      targetGoogleSearch       : true,
      targetSearchNetwork      : false,   /* search partners off */
      targetContentNetwork     : false,
      targetPartnerSearchNetwork: false
    }
  };
  applyBidding(camp, S);
  ops.push({ campaignOperation: { create: camp } });

  /* locations, then language */
  (S.locationIds || []).forEach(function (id) {
    if (!digits(id)) return;
    ops.push({ campaignCriterionOperation: { create: {
      campaign: campRn,
      location: { geoTargetConstant: 'geoTargetConstants/' + digits(id) }
    }}});
  });
  (S.languageIds && S.languageIds.length ? S.languageIds : ['1000']).forEach(function (id) {
    ops.push({ campaignCriterionOperation: { create: {
      campaign: campRn,
      language: { languageConstant: 'languageConstants/' + digits(id) }
    }}});
  });

  /* Everything that hangs off the campaign goes in one block. The API splits
     the request wherever the operation type changes, so three runs of
     campaignCriterionOperation would become three backend calls. */
  (S.negKeywords || []).forEach(function (k) {
    const t = String(k || '').trim(); if (!t) return;
    const bits = t.match(/^\[(.+)\]$/) ? ['EXACT', t.slice(1, -1)]
               : t.match(/^"(.+)"$/)    ? ['PHRASE', t.slice(1, -1)]
               : ['BROAD', t];
    ops.push({ campaignCriterionOperation: { create: {
      campaign: campRn, negative: true,
      keyword: { text: bits[1].trim(), matchType: bits[0] }
    }}});
  });
  /* demographics, excluded at campaign level so every ad group inherits */
  (S.exAge || []).forEach(function (t) {
    ops.push({ campaignCriterionOperation: { create: {
      campaign: campRn, negative: true, ageRange: { type: t } } } });
  });
  (S.exGender || []).forEach(function (t) {
    ops.push({ campaignCriterionOperation: { create: {
      campaign: campRn, negative: true, gender: { type: t } } } });
  });
  (S.exIncome || []).forEach(function (t) {
    ops.push({ campaignCriterionOperation: { create: {
      campaign: campRn, negative: true, incomeRange: { type: t } } } });
  });

  /* negative keyword lists already built in the manager account */
  (S.sharedSets || []).forEach(function (rn2) {
    if (!rn2) return;
    ops.push({ campaignSharedSetOperation: { create: {
      campaign: campRn, sharedSet: String(rn2)
    }}});
  });

  /* ad groups first, as a block, then their children as blocks */
  const groups = (c.adgroups || []).map(function (g) {
    const id = next(), rn = base + 'adGroups/' + id;
    const ag = {
      resourceName: rn,
      name        : g.name,
      campaign    : campRn,
      status      : 'ENABLED',
      type        : 'SEARCH_STANDARD'
    };
    if (S.cpc) ag.cpcBidMicros = String(Math.round(Number(S.cpc) * 1e6));
    /* The account's convention: tracking template and custom parameters sit
       at ad group level, not campaign level. */
    if (g.trackingTemplate) ag.trackingUrlTemplate = g.trackingTemplate;
    if (g.params) {
      const ps = [];
      Object.keys(g.params).forEach(function (k) {
        if (g.params[k]) ps.push({ key: k, value: String(g.params[k]) });
      });
      if (ps.length) ag.urlCustomParameters = ps;
    }
    ops.push({ adGroupOperation: { create: ag } });
    return { rn: rn, g: g };
  });

  groups.forEach(function (x) {
    (x.g.keywords || []).forEach(function (k) {
      const t = String(k || '').trim(); if (!t) return;
      ops.push({ adGroupCriterionOperation: { create: {
        adGroup: x.rn, status: 'ENABLED',
        keyword: { text: t, matchType: MT[x.g.matchType] || 'BROAD' }
      }}});
    });
    /* The account's rule: a phrase ad group carries its own keywords back as
       EXACT negatives, so a query that matches exactly is served by the exact
       ad group and never by the phrase one. */
    (x.g.negExact || []).forEach(function (k) {
      const t = String(k || '').trim(); if (!t) return;
      ops.push({ adGroupCriterionOperation: { create: {
        adGroup: x.rn, negative: true,
        keyword: { text: t, matchType: 'EXACT' }
      }}});
    });
  });

  groups.forEach(function (x) {
    const h = (x.g.headlines || []).filter(function (r) { return r && r[0] && String(r[0]).trim(); });
    const d = (x.g.descriptions || []).filter(function (r) { return r && r[0] && String(r[0]).trim(); });
    if (h.length < 3 || d.length < 2) {
      throw new Error(x.g.name + ' has ' + h.length + ' headlines and ' + d.length +
        ' descriptions. Google needs at least 3 and 2.');
    }
    const rsa = {
      headlines   : h.slice(0, 15).map(function (r) {
        const a = { text: String(r[0]).trim() };
        if (PINS[r[1]]) a.pinnedField = PINS[r[1]];
        return a; }),
      descriptions: d.slice(0, 4).map(function (r) {
        const a = { text: String(r[0]).trim() };
        if (DPIN[r[1]]) a.pinnedField = DPIN[r[1]];
        return a; })
    };
    if (plan.path1) rsa.path1 = plan.path1;
    if (plan.path2) rsa.path2 = plan.path2;
    ops.push({ adGroupAdOperation: { create: {
      adGroup: x.rn, status: 'ENABLED',
      ad: { finalUrls: [plan.finalUrl], responsiveSearchAd: rsa }
    }}});
  });

  /* assets: create the asset, then attach it to this campaign */
  const A = plan.assets || {};
  const attach = [];
  (A.callouts || []).forEach(function (t) {
    if (!String(t || '').trim()) return;
    const id = next(), rn = base + 'assets/' + id;
    ops.push({ assetOperation: { create: {
      resourceName: rn, calloutAsset: { calloutText: String(t).trim() } } } });
    attach.push([rn, 'CALLOUT']);
  });
  (A.sitelinks || []).forEach(function (s) {
    if (!s || !String(s[0] || '').trim()) return;
    const id = next(), rn = base + 'assets/' + id;
    const a = { resourceName: rn, finalUrls: [s[3] || plan.finalUrl],
                sitelinkAsset: { linkText: String(s[0]).trim() } };
    if (s[1]) a.sitelinkAsset.description1 = String(s[1]).trim();
    if (s[2]) a.sitelinkAsset.description2 = String(s[2]).trim();
    ops.push({ assetOperation: { create: a } });
    attach.push([rn, 'SITELINK']);
  });
  (A.snippets || []).forEach(function (s) {
    const vals = (s[1] || []).filter(function (x) { return String(x || '').trim(); });
    if (!s[0] || vals.length < 3) return;   /* Google needs 3 values minimum */
    const id = next(), rn = base + 'assets/' + id;
    ops.push({ assetOperation: { create: {
      resourceName: rn,
      structuredSnippetAsset: { header: String(s[0]).trim(), values: vals.slice(0, 10) }
    }}});
    attach.push([rn, 'STRUCTURED_SNIPPET']);
  });
  IMAGE_SLOTS.forEach(function (slot) {
    const img = A[slot[0]];
    if (!img || !img.data) return;
    const id = next(), rn = base + 'assets/' + id;
    ops.push({ assetOperation: { create: {
      resourceName: rn,
      name: slot[2] + ' ' + new Date().getTime() + '-' + Math.abs(id),
      imageAsset: { data: img.data } } } });
    attach.push([rn, slot[1]]);
  });

  attach.forEach(function (p) {
    ops.push({ campaignAssetOperation: { create: {
      campaign: campRn, asset: p[0], fieldType: p[1] } } });
  });

  return ops;
}

/* Whatever bid strategy was picked is the one that gets set. Picking Manual
   CPC and finding Maximize conversions in the account is a bug, not a nudge. */
function applyBidding(camp, S) {
  const b = String(S.bidStrategy || '').toLowerCase();
  if (b.indexOf('manual') === 0) {
    camp.manualCpc = { enhancedCpcEnabled: false };
  } else if (b.indexOf('target cpa') === 0 || b.indexOf('tcpa') === 0) {
    camp.targetCpa = { targetCpaMicros: String(Math.round(Number(S.targetCpa || 1000) * 1e6)) };
  } else if (b.indexOf('maximize clicks') === 0 || b.indexOf('maximise clicks') === 0) {
    camp.targetSpend = {};
  } else {
    camp.maximizeConversions = {};
  }
}

/* Run this once from the editor to accept the adwords permission prompt. */
function adsSelfTest() {
  const token = ScriptApp.getOAuthToken();
  Logger.log('OAuth token length: ' + String(token).length);
  if (!ADS.devToken) { Logger.log('ADS.devToken is empty — set it before testing.'); return; }
  const r = UrlFetchApp.fetch(ADS.host + '/' + ADS.version + '/customers:listAccessibleCustomers',
    { method: 'get', headers: adsHeaders(), muteHttpExceptions: true });
  Logger.log('HTTP ' + r.getResponseCode());
  Logger.log(r.getContentText().slice(0, 1500));
}

/* ══════════════════════════════════════════════════════════════════════
   Demand Gen
   A different campaign type, not a Search campaign with other pictures.
   Field names below are taken from the v26 protobuf, not from memory:
     Campaign.advertising_channel_type = DEMAND_GEN, and NO network_settings
     Ad.demand_gen_multi_asset_ad
     DemandGenMultiAssetAdInfo{ marketing_images, square_marketing_images,
       portrait_marketing_images, tall_portrait_marketing_images, logo_images,
       headlines, descriptions, business_name, call_to_action_text }
   Images hang off the AD here, not off the campaign the way Search assets do.
   ══════════════════════════════════════════════════════════════════════ */

/* 1.91:1, 1:1, 4:5 and 9:16 as the Creative studio renders them */
/* Google's age buckets as the Audience resource wants them: a span, not a
   name. 65+ has no upper bound, so max_age is left off. */
const AGE_SEGMENT = {
  AGE_RANGE_18_24: { minAge: 18, maxAge: 24 },
  AGE_RANGE_25_34: { minAge: 25, maxAge: 34 },
  AGE_RANGE_35_44: { minAge: 35, maxAge: 44 },
  AGE_RANGE_45_54: { minAge: 45, maxAge: 54 },
  AGE_RANGE_55_64: { minAge: 55, maxAge: 64 },
  AGE_RANGE_65_UP: { minAge: 65 }
};

const DG_IMAGE_SLOTS = [
  ['landscape', 'marketingImages',            'Landscape 1200x628'],
  ['square',    'squareMarketingImages',      'Square 1200x1200'],
  ['portrait',  'portraitMarketingImages',    'Portrait 960x1200'],
  ['story',     'tallPortraitMarketingImages','Vertical 1080x1920'],
  ['logo',      'logoImages',                 'Logo']
];

function buildDgOps(cid, plan, c, notes) {
  const S = plan.settings || {};
  const base = 'customers/' + cid + '/';
  var tmp = 0;
  const next = function () { return --tmp; };
  const ops = [];
  notes = notes || [];

  const budgetRn = base + 'campaignBudgets/' + next();
  ops.push({ campaignBudgetOperation: { create: {
    resourceName    : budgetRn,
    name            : c.name + ' budget ' + new Date().getTime(),
    amountMicros    : String(Math.round(Number(S.dailyBudget || 1000) * 1e6)),
    deliveryMethod  : 'STANDARD',
    explicitlyShared: false
  }}});

  const campRn = base + 'campaigns/' + next();
  const camp = {
    resourceName  : campRn,
    name          : c.name,
    status        : (S.status || 'PAUSED'),
    advertisingChannelType: 'DEMAND_GEN',
    campaignBudget: budgetRn,
    containsEuPoliticalAdvertising: S.euPolitical || 'DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING',
    geoTargetTypeSetting: {
      positiveGeoTargetType: S.presence || 'PRESENCE',
      negativeGeoTargetType: 'PRESENCE'
    }
    /* no networkSettings: Demand Gen picks its own surfaces and the API
       rejects the Search network block outright */
  };
  applyDgBidding(camp, S, notes);
  ops.push({ campaignOperation: { create: camp } });

  /* NOTHING targeting-related goes on a Demand Gen campaign. It is created
     with upgraded_targeting true, and that setting moves location, language
     and the demographics to the ad group. Sent at campaign level, Google
     answers an age or income exclusion with "The Criterion is not allowed to
     be excluded", and a location or a language with an unmapped error code.
     All of them are attached to each ad group further down. */

  /* Said plainly rather than sent and refused: Demand Gen takes neither
     campaign negative keywords nor the manager account's negative lists. */
  if ((S.negKeywords || []).length)
    notes.push((S.negKeywords || []).length + ' negative keywords were not sent \u2014 ' +
               'Demand Gen campaigns do not take negative keywords.');
  if ((S.sharedSets || []).length)
    notes.push('The negative keyword lists were not attached \u2014 Demand Gen does not take them.');

  /* the artwork, created once and shared by every ad group's ad */
  const img = {};
  const CRE = plan.creatives || {};
  DG_IMAGE_SLOTS.forEach(function (slot) {
    const src = CRE[slot[0]];
    if (!src || !src.data) return;
    const rn = base + 'assets/' + next();
    ops.push({ assetOperation: { create: {
      resourceName: rn,
      name: slot[2] + ' ' + new Date().getTime() + '-' + Math.abs(tmp),
      imageAsset: { data: src.data }
    }}});
    img[slot[0]] = rn;
  });

  const groups = (c.adgroups || []).map(function (g) {
    const rn = base + 'adGroups/' + next();
    const ag = { resourceName: rn, name: g.name, campaign: campRn, status: 'ENABLED' };
    /* no AdGroup.type on Demand Gen, and no channel controls either, so the
       campaign runs on every surface rather than a guessed subset */
    if (g.trackingTemplate) ag.trackingUrlTemplate = g.trackingTemplate;
    if (g.params) {
      const ps = [];
      Object.keys(g.params).forEach(function (k) {
        if (g.params[k]) ps.push({ key: k, value: String(g.params[k]) });
      });
      if (ps.length) ag.urlCustomParameters = ps;
    }
    ops.push({ adGroupOperation: { create: ag } });
    return { rn: rn, g: g };
  });

  /* Demand Gen uses audience-grouped targeting, so an age or income criterion
     on the ad group comes back "Audience segment attachment is not allowed when
     use audience grouped bit is set to true". Demographics and segments go
     inside one Audience resource instead, and that resource is attached to the
     ad group. The Audience is written as INCLUSIONS, so the exclusions picked
     in the toolkit are inverted here. */
  var named = 0;
  const wanted = [];
  groups.forEach(function (x) {
    (x.g.audiences || []).forEach(function (a) {
      const id = digits(a && a.id);
      if (!id) { named++; return; }
      if (wanted.indexOf(id) === -1) wanted.push(id + '|' + String((a && a.type) || ''));
    });
  });
  if (named)
    notes.push(named + ' audience segment' + (named === 1 ? ' was' : 's were') +
               ' skipped because no ID was given \u2014 add them in the interface, ' +
               'or paste the segment ID so they can be attached here.');

  const dims = [];
  const keep = function (all, excluded) {
    const ex = excluded || [];
    return all.filter(function (v) { return ex.indexOf(v) === -1; });
  };
  const exAge = S.exAge || [], exInc = S.exIncome || [], exGen = S.exGender || [];
  if (exAge.length) {
    const ages = keep(['AGE_RANGE_18_24','AGE_RANGE_25_34','AGE_RANGE_35_44',
                       'AGE_RANGE_45_54','AGE_RANGE_55_64','AGE_RANGE_65_UP'], exAge);
    if (!ages.length) throw new Error('Every age band is excluded, so the campaign could reach nobody.');
    dims.push({ age: {
      ageRanges: ages.map(function (a) { return AGE_SEGMENT[a]; }),
      includeUndetermined: exAge.indexOf('AGE_RANGE_UNDETERMINED') === -1
    }});
  }
  if (exInc.length) {
    const inc = keep(['INCOME_RANGE_0_50','INCOME_RANGE_50_60','INCOME_RANGE_60_70',
                      'INCOME_RANGE_70_80','INCOME_RANGE_80_90','INCOME_RANGE_90_UP'], exInc);
    if (!inc.length) throw new Error('Every household income band is excluded, so the campaign could reach nobody.');
    dims.push({ householdIncome: {
      incomeRanges: inc,
      includeUndetermined: exInc.indexOf('INCOME_RANGE_UNDETERMINED') === -1
    }});
  }
  if (exGen.length) {
    const gen = keep(['MALE','FEMALE'], exGen);
    if (!gen.length) throw new Error('Both genders are excluded, so the campaign could reach nobody.');
    dims.push({ gender: {
      genders: gen,
      includeUndetermined: exGen.indexOf('UNDETERMINED') === -1
    }});
  }
  if (wanted.length) {
    dims.push({ audienceSegments: { segments: wanted.map(function (w) {
      const bits = w.split('|'), id = bits[0], type = String(bits[1] || '').toLowerCase();
      if (type.indexOf('custom') === 0) return { customAudience: { customAudience: base + 'customAudiences/' + id } };
      if (type.indexOf('life') === 0)   return { lifeEvent: { lifeEvent: 'lifeEvents/' + id } };
      if (type.indexOf('in-market') === 0 || type.indexOf('affinity') === 0)
        return { userInterest: { userInterestCategory: 'userInterests/' + id } };
      return { userList: { userList: base + 'userLists/' + id } };
    })}});
  }

  var audienceRn = '';
  if (dims.length) {
    audienceRn = base + 'audiences/' + next();
    ops.push({ audienceOperation: { create: {
      resourceName: audienceRn,
      name: c.name + ' audience ' + new Date().getTime(),
      description: 'Built by the Search Ops Toolkit',
      scope: 'CUSTOMER',
      dimensions: dims
    }}});
  }

  /* everything that hangs off an ad group, as one contiguous block: the API
     starts a new backend call wherever the operation type changes */
  groups.forEach(function (x) {
    (S.locationIds || []).forEach(function (id) {
      if (!digits(id)) return;
      ops.push({ adGroupCriterionOperation: { create: {
        adGroup: x.rn,
        location: { geoTargetConstant: 'geoTargetConstants/' + digits(id) }
      }}});
    });
    (S.languageIds && S.languageIds.length ? S.languageIds : ['1000']).forEach(function (id) {
      ops.push({ adGroupCriterionOperation: { create: {
        adGroup: x.rn,
        language: { languageConstant: 'languageConstants/' + digits(id) }
      }}});
    });
    if (audienceRn) {
      ops.push({ adGroupCriterionOperation: { create: {
        adGroup: x.rn, status: 'ENABLED', audience: { audience: audienceRn }
      }}});
    }
  });

  groups.forEach(function (x) {
    const h = (x.g.headlines || [])
      .map(function (r) { return String((r && r[0] !== undefined ? r[0] : r) || '').trim(); })
      .filter(String);
    const d = (x.g.descriptions || [])
      .map(function (r) { return String((r && r[0] !== undefined ? r[0] : r) || '').trim(); })
      .filter(String);
    if (!h.length || !d.length)
      throw new Error(x.g.name + ' has ' + h.length + ' headlines and ' + d.length +
        ' descriptions. Demand Gen needs at least one of each.');
    const bn = String(plan.businessName || '').trim();
    if (!bn)
      throw new Error('Demand Gen needs a business name on the ad. Fill it in on the Assets tab.');
    if (!img.landscape && !img.square)
      throw new Error('Demand Gen needs at least a landscape (1200x628) or square (1200x1200) image. ' +
        'Render them on the Creative studio tab first.');
    if (!img.logo)
      throw new Error('Demand Gen needs a logo image. Upload the developer logo on the Creative studio tab.');

    const ad = {
      headlines       : h.slice(0, 5).map(function (t) { return { text: t }; }),
      descriptions    : d.slice(0, 5).map(function (t) { return { text: t }; }),
      businessName    : bn,
      callToActionText: String(plan.cta || 'Learn more')
    };
    DG_IMAGE_SLOTS.forEach(function (slot) {
      if (img[slot[0]]) ad[slot[1]] = [{ asset: img[slot[0]] }];
    });
    ops.push({ adGroupAdOperation: { create: {
      adGroup: x.rn, status: 'ENABLED',
      ad: { finalUrls: [plan.finalUrl], demandGenMultiAssetAd: ad }
    }}});
  });

  return ops;
}

/* Demand Gen takes Maximize conversions, Maximize conversion value, Target CPA,
   Target ROAS and Maximize clicks. Manual CPC is a Search strategy; rather than
   let Google refuse the whole campaign it is swapped and the swap is reported. */
function applyDgBidding(camp, S, notes) {
  const b = String(S.bidStrategy || '').toLowerCase();
  if (b.indexOf('target cpa') === 0 || b.indexOf('tcpa') === 0) {
    camp.targetCpa = { targetCpaMicros: String(Math.round(Number(S.targetCpa || 1000) * 1e6)) };
  } else if (b.indexOf('maximize clicks') === 0 || b.indexOf('maximise clicks') === 0) {
    camp.targetSpend = {};
  } else {
    camp.maximizeConversions = {};
    if (b.indexOf('manual') === 0 && notes)
      notes.push('Manual CPC is not available on Demand Gen, so the campaign was set to ' +
                 'Maximize conversions.');
  }
}
