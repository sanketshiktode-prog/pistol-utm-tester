/* =====================================================================
   Trigger — the Apps Script loader
   =====================================================================

   This is the ONLY file that belongs in Apps Script. It is deliberately
   small. The actual backend — every bit of Google Ads, Gemini and Meta
   logic — lives in backend.gs in the repository and is fetched and run
   from here, so a backend fix ships by being pushed instead of pasted.

   Do NOT paste backend.gs over this file. It defines handlePost and
   handleGet, not doPost and doGet, so the web app loses its entry point
   and every call from Trigger comes back as "Failed to fetch".

   Nothing secret is written here. The developer token, the manager
   account id and the Gemini key are Script Properties:

     Project Settings -> Script Properties
       ADS_DEV_TOKEN    the Google Ads developer token
       ADS_LOGIN_CID    the manager account id, digits only
       GEMINI_KEY       the AI Studio key
       META_TOKEN       the Meta System User token

   Two more control this loader:

       BACKEND_REF      a branch or a commit SHA. Defaults to main.
                        Set it to a SHA to pin the backend to that commit
                        so a later push cannot move what runs here.
       BACKEND_OFF      set to anything to stop remote loading outright.

   AFTER EDITING THIS FILE: Deploy -> Manage deployments -> pencil ->
   Version: New version -> Deploy. Saving alone does not change what the
   live URL runs. Editing backend.gs needs none of that.
   ===================================================================== */

/* =====================================================================
   Configuration
   =====================================================================
   backend.gs reads these by name and deliberately does not declare them,
   because it is public and these are not. Everything secret is read from
   Script Properties; the values written here are only the fallback for a
   property that is not set.

   Project Settings -> Script Properties:

     ADS_DEV_TOKEN      Google Ads developer token          (required)
     ADS_LOGIN_CID      manager account id, digits only     (required)
     GEMINI_KEY         AI Studio key                       (for reading
                                                             pages and
                                                             brochures)
     META_TOKEN         Meta System User token              (for Meta)
     ADMIN_EMAIL        whose sign-in shows as admin
     ADS_ALLOW_EMAILS   comma separated — who may DEPLOY. Empty means
                        deploying is switched off for everyone.
     ADS_ALLOW_CIDS     comma separated customer ids, digits only. Empty
                        means any account the token can reach.
     SHEET_NAME         the tab the audit trail is written to
   ===================================================================== */

function cfg_(key, fallback) {
  try {
    const v = PropertiesService.getScriptProperties().getProperty(key);
    return (v === null || v === '') ? fallback : v;
  } catch (e) { return fallback; }
}
function cfgList_(key) {
  return String(cfg_(key, '')).split(',').map(function (x) { return x.trim(); })
    .filter(Boolean);
}

/* Public: this is the browser-side Google Sign-In client id and it already
   sits in index.html in the public repository. It is here so the backend
   can check that a token was issued for THIS app. */
const CLIENT_ID = cfg_('CLIENT_ID',
  '779938081992-vecfdvvm61lalugpo3sa64bvqlhjfjqq.apps.googleusercontent.com');

/* Only a signed-in account on this domain may use the toolkit at all. */
const DOMAIN = cfg_('DOMAIN', 'propertypistol.com');

const ADMIN  = cfg_('ADMIN_EMAIL', '');
const SHEET  = cfg_('SHEET_NAME', 'Log');

const GEMINI_KEY = cfg_('GEMINI_KEY', '');

const ADS = {
  devToken          : cfg_('ADS_DEV_TOKEN', ''),
  loginCid          : cfg_('ADS_LOGIN_CID', ''),
  host              : cfg_('ADS_HOST', 'https://googleads.googleapis.com'),
  version           : cfg_('ADS_VERSION', 'v26'),
  /* Validating costs nothing and creates nothing, so everyone signed in
     may do it. Creating campaigns is this list and nobody else. */
  allowEmails       : cfgList_('ADS_ALLOW_EMAILS'),
  allowCustomerIds  : cfgList_('ADS_ALLOW_CIDS'),
  maxDeploysPerDay  : Number(cfg_('ADS_MAX_DEPLOYS_PER_DAY', '20')) || 20
};

/* ===================== the loader, nothing to edit ===================== */

const BACKEND_REPO = 'sanketshiktode-prog/pistol-utm-tester';
const BACKEND_FILE = 'backend.gs';
const BACKEND_CACHE_SECONDS = 300;

/* Apps Script caches at most 100 KB per entry and the backend is larger
   than that, so it is stored in pieces with a count beside them. A
   missing piece simply means a cold fetch, never a half-loaded backend. */
function backendSource_() {
  const sp = PropertiesService.getScriptProperties();
  if (sp.getProperty('BACKEND_OFF'))
    throw new Error('Remote backend loading is switched off (BACKEND_OFF is set).');

  const ref = sp.getProperty('BACKEND_REF') || 'main';
  const cache = CacheService.getScriptCache();
  const head = 'bk-' + ref + '-n';

  const n = Number(cache.get(head) || 0);
  if (n > 0) {
    const keys = [];
    for (var i = 0; i < n; i++) keys.push('bk-' + ref + '-' + i);
    const got = cache.getAll(keys);
    var joined = '', whole = true;
    for (var j = 0; j < n; j++) {
      const piece = got['bk-' + ref + '-' + j];
      if (piece == null) { whole = false; break; }
      joined += piece;
    }
    if (whole) return joined;
  }

  const url = 'https://raw.githubusercontent.com/' + BACKEND_REPO + '/' +
              encodeURIComponent(ref) + '/' + BACKEND_FILE;
  const res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200)
    throw new Error('Could not fetch ' + BACKEND_FILE + ' at ' + ref +
                    ' (HTTP ' + res.getResponseCode() + ').');
  const src = res.getContentText();
  if (!/function\s+handlePost/.test(src))
    throw new Error('What came back does not look like the backend — no handlePost in it.');

  try {
    const size = 90000, parts = {};
    var count = 0;
    for (var k = 0; k < src.length; k += size)
      parts['bk-' + ref + '-' + (count++)] = src.slice(k, k + size);
    cache.putAll(parts, BACKEND_CACHE_SECONDS);
    cache.put(head, String(count), BACKEND_CACHE_SECONDS);
  } catch (e) { /* a cache that refuses only costs a fetch next time */ }

  return src;
}

/* eval() inside a function keeps its declarations local, so the backend
   is built as a function body that hands its two entry points back. */
function backend_() {
  return new Function(backendSource_() +
    '\nreturn { handlePost: handlePost, handleGet: handleGet };')();
}

function doPost(e) {
  try {
    return backend_().handlePost(e);
  } catch (err) {
    /* Trigger reads JSON, so an error here has to arrive as JSON too —
       an HTML error page is what makes a real fault look like a dead
       endpoint at the other end. */
    return ContentService
      .createTextOutput(JSON.stringify({ error: 'Backend failed to load: ' + err }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet() {
  try {
    return backend_().handleGet();
  } catch (err) {
    return ContentService.createTextOutput('Loader is running, but the backend did not load: ' + err);
  }
}

/* Run this from the editor after a change to confirm the loader can
   still reach the backend. It prints the ref, the size and the first
   line, and throws if anything is wrong. */
function loaderSelfTest() {
  const ref = PropertiesService.getScriptProperties().getProperty('BACKEND_REF') || 'main';
  const src = backendSource_();
  const api = backend_();

  Logger.log('backend: %s at %s, %s characters', BACKEND_FILE, ref, src.length);
  Logger.log('entry points: handlePost=%s handleGet=%s', typeof api.handlePost, typeof api.handleGet);

  /* A missing property does not throw until somebody uses the feature, so
     it is reported here instead of being discovered in the middle of a
     deploy. */
  const show = function (label, value, needed) {
    Logger.log('%s %s: %s', value ? ' set ' : (needed ? 'MISSING' : ' --  '),
               label, value ? (String(value).length > 12 ? '(set)' : value) : '');
  };
  Logger.log('--- configuration ---');
  show('CLIENT_ID',        CLIENT_ID,        true);
  show('DOMAIN',           DOMAIN,           true);
  show('SHEET_NAME',       SHEET,            true);
  show('ADMIN_EMAIL',      ADMIN,            false);
  show('GEMINI_KEY',       GEMINI_KEY,       false);
  show('ADS_DEV_TOKEN',    ADS.devToken,     true);
  show('ADS_LOGIN_CID',    ADS.loginCid,     true);
  show('META_TOKEN',       cfg_('META_TOKEN', ''), false);
  Logger.log('%s ADS_ALLOW_EMAILS: %s', ADS.allowEmails.length ? ' set ' : 'MISSING',
             ADS.allowEmails.length ? ADS.allowEmails.join(', ')
                                    : 'empty — deploying to Google Ads is switched off');
  Logger.log('      ADS_ALLOW_CIDS: %s', ADS.allowCustomerIds.length
             ? ADS.allowCustomerIds.join(', ') : 'any account the token can reach');

  if (typeof api.handlePost !== 'function') throw new Error('handlePost did not come back.');
  Logger.log('OK — the loader can run the backend.');
}

/* Forces the next call to fetch again, for when a push should take
   effect before the five minutes are up. */
function clearBackendCache() {
  const ref = PropertiesService.getScriptProperties().getProperty('BACKEND_REF') || 'main';
  const cache = CacheService.getScriptCache();
  const n = Number(cache.get('bk-' + ref + '-n') || 0);
  const keys = ['bk-' + ref + '-n'];
  for (var i = 0; i < n; i++) keys.push('bk-' + ref + '-' + i);
  cache.removeAll(keys);
  Logger.log('Cache cleared for %s. The next call fetches afresh.', ref);
}
