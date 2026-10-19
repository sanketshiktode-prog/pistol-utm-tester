/**
 * Search Ops Toolkit — Google Ads API deployment.
 *
 * Paste this as a SECOND file in the same Apps Script project as
 * apps-script-log.gs. One project, one deployment, one URL.
 *
 * Why it lives here rather than on a server: an Apps Script web app deployed
 * with "Execute as: Me" can call ScriptApp.getOAuthToken() and get a token
 * carrying the adwords scope. That means there is no refresh token to store,
 * rotate or leak — the script acts as the Google account that deployed it,
 * which is also the account that owns the Google Ads access. The only secret
 * is the developer token, and it never reaches the browser.
 *
 * ── What you have to do once ────────────────────────────────────────────────
 *
 * 1. Developer token
 *      Google Ads manager (MCC) account -> Admin -> API Center.
 *      Copy the token into ADS.devToken below. A new token starts at Test
 *      access: it works ONLY against test accounts, which is exactly what a
 *      trial needs. Production accounts need Basic access, applied for from
 *      the Google Cloud console once brand verification is done.
 *
 * 2. A test account to trial on
 *      In the MCC, create an account and mark it a test account. Test
 *      accounts never serve ads and never spend, so nothing here can cost
 *      money while it is being proved out.
 *
 * 3. The adwords scope
 *      Apps Script editor -> Project Settings -> tick
 *      "Show appsscript.json manifest file in editor", then open
 *      appsscript.json and set:
 *
 *      "oauthScopes": [
 *        "https://www.googleapis.com/auth/adwords",
 *        "https://www.googleapis.com/auth/script.external_request",
 *        "https://www.googleapis.com/auth/spreadsheets.currentonly",
 *        "https://www.googleapis.com/auth/userinfo.email"
 *      ]
 *
 *      Then run adsSelfTest() once from the editor and accept the new
 *      permission prompt. Without this step every call returns 401.
 *
 * 4. Redeploy
 *      Deploy -> Manage deployments -> pencil -> Version: New version ->
 *      Deploy. Saving alone does not change the live URL.
 *
 * Then press "Validate against Google" in the toolkit. Nothing is created
 * until you press Deploy.
 */

const ADS = {
  version   : 'v26',
  devToken  : '',            // <-- MCC -> Admin -> API Center
  loginCid  : '',            // <-- MCC customer ID, digits only, no dashes
  host      : 'https://googleads.googleapis.com',

  /* ── who is allowed to do this ──────────────────────────────────────────
     The toolkit is served from a public GitHub Pages site, so the /exec URL
     in its source is public too. Signing in with any propertypistol.com
     account is the right gate for building CSV files. It is the wrong gate
     for creating campaigns in live ad accounts as the script owner, which is
     what this file does. So deploying has its own, shorter list.

     Leave allowEmails empty and nobody can deploy at all. */
  allowEmails : [
    'hemant.bajaj@propertypistol.com',
    'sanket.shiktode@propertypistol.com'
  ],

  /* Accounts this script is allowed to touch, 10 digits each. Empty means
     "test accounts only" — a live account has to be named here on purpose,
     so a stray or guessed customer ID cannot be pointed at real money. */
  allowCustomerIds : [],

  /* A runaway loop is the realistic accident, not an attacker. */
  maxDeploysPerDay : 40
};

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
  const q = adsCall('customers/' + cid + '/googleAds:search', {
    query: 'SELECT customer.id, customer.descriptive_name, customer.currency_code, ' +
           'customer.test_account, customer.manager, customer.status FROM customer LIMIT 1'
  });
  if (q.error) return { error: q.error, accessible: list, notes: notes };
  const c = (q.body.results && q.body.results[0] && q.body.results[0].customer) || {};
  return {
    ok: true, version: ADS.version, accessible: list, notes: notes,
    customer: {
      id: c.id, name: c.descriptiveName, currency: c.currencyCode,
      test: !!c.testAccount, manager: !!c.manager, status: c.status
    }
  };
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

/* ── the deploy ───────────────────────────────────────────────────────────── */

const PINS = { '1': 'HEADLINE_1', '2': 'HEADLINE_2', '3': 'HEADLINE_3' };
const DPIN = { '1': 'DESCRIPTION_1', '2': 'DESCRIPTION_2' };
const MT   = { E: 'EXACT', P: 'PHRASE', B: 'BROAD' };

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
    var ops;
    try { ops = buildOps(cid, plan, c); }
    catch (err) { results.push({ campaign: c.name, error: 'Could not build the request: ' + err }); continue; }

    const req = { mutateOperations: ops, validateOnly: dry, responseContentType: 'RESOURCE_NAME_ONLY' };
    const r = adsCall('customers/' + cid + '/googleAds:mutate', req);
    if (r.error) {
      results.push({ campaign: c.name, operations: ops.length, error: r.error });
    } else {
      const made = (r.body.mutateOperationResponses || []).length;
      results.push({ campaign: c.name, operations: ops.length, created: made,
                     resources: resourceNames(r.body) });
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
