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
function cfgList_(key, fallback) {
  return String(cfg_(key, fallback || '')).split(',').map(function (x) { return x.trim(); })
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

/* The audit tab. write() creates one if the name does not match, which is
   not destructive but silently splits the trail in two. So when the
   property is not set, the existing tab is found by its header row and
   remembered — one spreadsheet read, once, never again. A script that is
   not bound to a spreadsheet, or any error at all, falls back to 'Log'
   without disturbing the request. */
function logSheetName_() {
  const named = cfg_('SHEET_NAME', '');
  if (named) return named;
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) return 'Log';
    const sheets = ss.getSheets();
    for (var i = 0; i < sheets.length; i++) {
      const sh = sheets[i];
      if (sh.getLastRow() < 1 || sh.getLastColumn() < 4) continue;
      const head = sh.getRange(1, 1, 1, 4).getValues()[0].join('|');
      if (head === 'Time|Email|Name|Role') {
        try { PropertiesService.getScriptProperties()
                .setProperty('SHEET_NAME', sh.getName()); } catch (e) {}
        return sh.getName();
      }
    }
  } catch (e) { /* no spreadsheet, or no scope yet — 'Log' is fine */ }
  return 'Log';
}
const SHEET = logSheetName_();

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
/* Five minutes meant every push was followed by "run clearBackendCache or
   wait", and when that was forgotten the script answered with the previous
   copy of the code — which looks exactly like the fix not working. A fetch
   from raw.githubusercontent costs a fraction of a second and happens once
   a minute at most, so the trap is not worth the saving. */
const BACKEND_CACHE_SECONDS = 60;

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

/* A GET is one of three things: Google returning somebody from the OAuth
   consent screen, somebody opening the URL to check it is alive, or a POST
   that got turned into a GET by a redirect — and the last used to surface
   as "Unexpected token 'S'", because the page tried to read a sentence of
   prose as JSON.

   The OAuth callback has to be handled by the backend, which owns the
   token exchange, and its answer is a page for a person to read. Anything
   else answers in JSON and says what it is. */
function doGet(e) {
  const isCallback = !!(e && e.parameter &&
    (e.parameter.code || e.parameter.state || e.parameter.error));
  if (isCallback) {
    try { return backend_().handleGet(e); }
    catch (err) {
      return HtmlService.createHtmlOutput(
        '<!doctype html><meta charset="utf-8">' +
        '<div style="font:15px/1.6 system-ui,sans-serif;max-width:520px;margin:12vh auto;padding:0 20px">' +
        '<h1 style="font-size:19px">Not connected</h1><p>The backend did not load: ' +
        String(err).replace(/[<>]/g, '') + '</p></div>');
    }
  }

  var body = { ok: true, service: 'trigger-apps-script', method: 'GET',
               note: 'This is the health check. Trigger calls this script with POST; ' +
                     'if an app shows this message, its POST arrived as a GET.' };
  try {
    backend_();                       /* proves the backend loads */
    body.backend = 'loaded';
  } catch (err) {
    body.ok = false;
    body.backend = 'failed';
    body.error = String(err);
  }
  return ContentService.createTextOutput(JSON.stringify(body))
    .setMimeType(ContentService.MimeType.JSON);
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

/* Apps Script decides which permissions to ask for by READING this
   project's source. backend.gs is fetched and evaluated at run time, so
   nothing it calls is ever seen — the first DriveApp call from there
   would come back "You do not have permission to call DriveApp", with
   no prompt and nothing to click.

   This function is never called. It exists so the scanner sees the
   calls the backend makes, and the authorisation screen asks for them.
   Saved projects live in a Drive folder, which is why Drive is here.

   After adding this, redeploy and open the web app once: it will ask
   for Drive, and projects will not save until it has been granted. */
function scopesTheBackendNeeds_() {
  if (true) return;                       /* never runs; only read */
  DriveApp.getRootFolder();
  SpreadsheetApp.getActiveSpreadsheet();
  UrlFetchApp.fetch('https://example.com');
  ScriptApp.getService().getUrl();
}

/* Run this one from the editor to grant Drive.

   scopesTheBackendNeeds_ ends in an underscore, which is how Apps Script
   marks a function private — it is deliberately hidden from the Run
   menu, so it could not be used to trigger the consent screen. This one
   has no underscore, so it is in the list, and it actually touches Drive
   rather than only being read: pick it, press Run, allow the permissions,
   then redeploy. The log says what it found. */
function grantDrivePermission() {
  const name = 'Trigger — saved projects';
  const it = DriveApp.getFoldersByName(name);
  const folder = it.hasNext() ? it.next() : DriveApp.createFolder(name);
  PropertiesService.getScriptProperties().setProperty('PROJ_FOLDER', folder.getId());
  var n = 0;
  const files = folder.getFiles();
  while (files.hasNext()) { files.next(); n++; }
  Logger.log('Drive is granted. Folder "%s" (%s) holds %s file(s).',
             folder.getName(), folder.getId(), n);
  Logger.log('Now: Deploy -> Manage deployments -> pencil -> New version -> Deploy.');
  return folder.getId();
}
