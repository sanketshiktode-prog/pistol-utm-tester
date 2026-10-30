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
  if (String(body.action || '') === 'history') {
    if (!v.ok) return json({ error: 'Sign in again — ' + v.reason });
    return json(historyRead(body, v));
  }

  if (String(body.action || '').indexOf('proj-') === 0) {
    if (!v.ok) return json({ error: 'Sign in again — ' + v.reason });
    return json(projRoute(body, v) || { error: 'Unknown action: ' + body.action });
  }

  if (String(body.action || '').indexOf('ads-') === 0) {
    if (!v.ok) return json({ error: 'Sign in again \u2014 ' + v.reason });
    if (typeof adsRoute !== 'function')
      return json({ error: 'apps-script-ads-api.gs is not in this project yet.' });
    var out = adsRoute(body, v);
    return json(out || { error: 'Unknown ads action: ' + body.action });
  }

  /* The design agent. The split is deliberate: everything that has to be
     EXACT — the RERA number, the QR, the price, the configuration, the
     logo's own pixels — is drawn by the canvas and never leaves it. The
     model is handed a finished picture and asked only what a designer would
     be asked: does anything collide, is anything cut off, can it be read,
     and which of these layouts and palettes suits this render. It chooses
     settings; it never draws, and it never supplies a word of copy. */
  if (String(body.action || '').indexOf('ai-') === 0) {
    if (!v.ok) return json({ error: 'Sign in again — ' + v.reason });
    return json(aiRoute(body, v) || { error: 'Unknown action: ' + body.action });
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

  /* A sales WhatsApp blast is where most projects actually arrive. It is not
     a landing page: no headings, emoji for bullets, the broker's own footer
     mixed in with the project's facts. It gets its own reader. */
  if (body.action === 'extract-wa') {
    if (!v.ok) return json({ error: 'Sign in again \u2014 ' + v.reason });
    if (!aiKey_()) return json({ error: 'Gemini key not set in the Apps Script' });
    const out = extractWa(body.text || '');
    write([new Date(), v.email, v.name, role(v.email), 'wa-read',
           (body.text || '').slice(0, 60), out.error || '']);
    return json(out);
  }

  /* Meta. Same shape as the Google Ads route above: the token lives in a
     Script Property, the browser never sees it, and nothing is created
     unless the API says it was. */
  if (String(body.action || '').indexOf('meta-') === 0) {
    if (!v.ok) return json({ error: 'Sign in again \u2014 ' + v.reason });
    return json(metaRoute(body, v) || { error: 'Unknown Meta action: ' + body.action });
  }

  /* A brochure whose pages are pictures — most of them are — has no text to
     pull, so the pages themselves are read. */
  if (body.action === 'read-brochure') {
    if (!v.ok) return json({ error: 'Sign in again \u2014 ' + v.reason });
    if (!aiKey_()) return json({ error: 'Gemini key not set in the Apps Script' });
    const out = readBrochure(body);
    write([new Date(), v.email, v.name, role(v.email), 'pdf-read',
           String(body.name || '').slice(0, 60), out.error || '']);
    return json(out);
  }

  /* Photographs arrive as a folder with names like IMG_2043.jpg, so the file
     name usually says nothing. The model is shown each picture and asked only
     which section of a landing page it belongs in. */
  if (body.action === 'classify-images') {
    if (!v.ok) return json({ error: 'Sign in again \u2014 ' + v.reason });
    if (!aiKey_()) return json({ error: 'Gemini key not set in the Apps Script' });
    return json(classifyImages(body));
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

  const models = aiModels_();
  if (!models.length)
    return { error: 'Could not list the Gemini models for this key. Check GEMINI_KEY, ' +
      'or set GEMINI_MODEL in Script Properties to a model name it can use.' };

  var fails = [];
  for (let i = 0; i < models.length; i++) {
    try {
      const res = UrlFetchApp.fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/' +
        encodeURIComponent(models[i]) + ':generateContent?key=' + encodeURIComponent(aiKey_()),
        { method: 'post', contentType: 'application/json', muteHttpExceptions: true,
          payload: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0, maxOutputTokens: 1200,
                                responseMimeType: 'application/json' }
          }) });
      const code = res.getResponseCode();
      if (code !== 200) {
        var e1 = {}; try { e1 = JSON.parse(res.getContentText()); } catch (e) {}
        fails.push(models[i] + ': ' + code + ' ' +
                   (((e1.error || {}).message) || '').slice(0, 160));
        if (code === 404) aiForget_();          /* this name has been retired */
        continue;
      }
      const j = JSON.parse(res.getContentText());
      const t = j.candidates[0].content.parts[0].text.replace(/```json|```/g, '').trim();
      return JSON.parse(t);
    } catch (err) { fails.push(models[i] + ': ' + err); }
  }
  return { error: 'Gemini did not answer. Tried — ' + fails.join(' | ') };
}

/* ── the WhatsApp reader ──────────────────────────────────────────────────
   Everything that has to be EXACT — the RERA number, the price, the
   configuration — is pulled by the browser with a pattern before this is
   called, and overrides whatever the model says. The model is here for the
   judgement a pattern cannot make: which line is the project name and which
   is the developer, what is a selling point and what is the broker's own
   sign-off, which "5 mins" belongs to which landmark. Same split as the
   design agent: exact things by code, reading by the model. */
function extractWa(text) {
  const t = String(text || '').slice(0, 12000);
  if (t.trim().length < 20) return { error: 'That message is too short to read.' };

  const system =
    'You read WhatsApp announcements that Indian and UAE real estate sales teams ' +
    'forward to each other, and return the project facts as JSON. These are not ' +
    'web pages: lines are short, emoji are used as bullets, and the message often ' +
    'ends with the sender\'s own footer — their name, phone number, agency, "call ' +
    'now", "site visit booking", RERA of the AGENCY rather than the project. That ' +
    'footer is never project information: ignore it entirely. Never invent a ' +
    'value. If the message does not say it, return an empty string or an empty ' +
    'array. Do not round, convert or tidy a price or a registration number — ' +
    'copy it exactly as written.';

  const schema =
    'Reply with ONLY this JSON object:\n' +
    '{"proj":"","dev":"","micro":"","city":"","cfg":"","price":"","allIn":"",' +
    '"possession":"","rera":"","usps":[],"amenities":[],"landmarks":[]}\n' +
    'proj is the project name alone, without the developer. dev is the developer ' +
    'or builder. micro is the locality or micro-market, city is the city.\n' +
    'cfg is the configuration as written, e.g. "2, 2.5 & 3 BHK" or "Studio, 1 & 2 BR".\n' +
    'price is the starting price exactly as written, e.g. "88 L" or "\u20b91.2 Cr".\n' +
    'allIn is "yes" if it says all inclusive, "no" if charges are extra, else "".\n' +
    'possession is what it says, e.g. "Dec 2028". rera is the PROJECT registration ' +
    'number, never the agency\'s.\n' +
    'usps are selling points under 30 characters each, in the message\'s own words, ' +
    'with the emoji stripped. amenities are single amenity names. landmarks are ' +
    '"Name - 15 Mins" style entries.\n' +
    'Leave out anything that is about the sender rather than the project.\n\nMESSAGE:\n';

  const out = aiCall_(system, [{ text: schema + t }], 1200);
  if (out.error) return out;
  ['proj', 'dev', 'micro', 'city', 'cfg', 'price', 'allIn', 'possession', 'rera']
    .forEach(function (k) { if (typeof out[k] !== 'string') out[k] = ''; });
  ['usps', 'amenities', 'landmarks']
    .forEach(function (k) { if (!Array.isArray(out[k])) out[k] = []; });
  return out;
}

/* ── the brochure reader ─────────────────────────────────────────────────
   A developer's brochure is a design file exported to PDF: the text is
   usually outlines, so there is nothing to copy out. The browser tries the
   text layer first and only sends page images when that comes back empty.
   Here they are read the same way the WhatsApp message is, and with the same
   rule: nothing is invented. A prelaunch brochure genuinely has no project
   name and no registration number, and must be allowed to say so. */
function readBrochure(body) {
  const pages = (body.pages || []).slice(0, 6);   /* [{data}] base64 JPEG */
  if (!pages.length) return { error: 'No pages were sent.' };

  const system =
    'You read Indian and UAE real estate project brochures and return the ' +
    'project facts as JSON. Read only what is printed on these pages. Never ' +
    'invent a value and never carry one over from another project you know: ' +
    'if a page does not state something, return an empty string or an empty ' +
    'array. Copy a price and a registration number exactly as printed, without ' +
    'rounding or converting. Many brochures are for a prelaunch, where the ' +
    'project has no released name and no registration number yet — that is ' +
    'normal, and the developer and locality are then the only identity there ' +
    'is. Ignore the agency or channel partner footer.';

  const schema =
    'Reply with ONLY this JSON object:\n' +
    '{"proj":"","dev":"","micro":"","city":"","cfg":"","price":"","allIn":"",' +
    '"possession":"","rera":"","usps":[],"amenities":[],"landmarks":[],' +
    '"prelaunch":false}\n' +
    'proj is the project name alone, empty if the brochure does not name one. ' +
    'dev is the developer. micro is the locality, city is the city.\n' +
    'cfg is the configuration as printed. price is the starting price as ' +
    'printed. rera is the project registration number, never the agency\'s.\n' +
    'usps are selling points under 30 characters each. amenities are single ' +
    'amenity names. landmarks are "Name - 15 Mins" style entries.\n' +
    'prelaunch is true when the brochure names no project or states that the ' +
    'name is yet to be revealed.';

  const parts = [{ text: schema }];
  pages.forEach(function (p, i) {
    parts.push({ text: 'Page ' + (i + 1) });
    parts.push({ inline_data: { mime_type: 'image/jpeg', data: p.data } });
  });

  const out = aiCall_(system, parts, 1600);
  if (out.error) return out;
  ['proj', 'dev', 'micro', 'city', 'cfg', 'price', 'allIn', 'possession', 'rera']
    .forEach(function (k) { if (typeof out[k] !== 'string') out[k] = ''; });
  ['usps', 'amenities', 'landmarks']
    .forEach(function (k) { if (!Array.isArray(out[k])) out[k] = []; });
  out.prelaunch = !!out.prelaunch;
  return out;
}

/* ── the image sorter ─────────────────────────────────────────────────────
   One call for the whole batch: the model sees every picture in order and
   answers with one row each. It may only choose a section this builder
   actually has — anything else it says is dropped before the answer reaches
   the page, exactly like the design agent's whitelist. */
const IMG_SECTIONS = ['hero', 'amenity', 'exterior', 'interior',
                      'masterplan', 'floorplan', 'logo', 'other'];

function classifyImages(body) {
  const shots = (body.images || []).slice(0, 20);   /* [{name,data}] base64 JPEG */
  if (!shots.length) return { error: 'No images were sent.' };

  const system =
    'You sort photographs for a real estate project landing page. For each ' +
    'image, say which section it belongs in and give it a short caption. ' +
    'hero: the building exterior or elevation, a render or drone shot of the ' +
    'whole project — what belongs at the top of the page. amenity: a single ' +
    'facility such as a pool, gym, clubhouse, play area or jogging track. ' +
    'exterior: grounds, landscaping, entrance, podium. interior: a room, ' +
    'kitchen, bathroom or show flat. masterplan: a site layout drawing. ' +
    'floorplan: a unit plan drawing. logo: a brand mark on a plain background. ' +
    'other: anything that does not belong on the page, including price lists, ' +
    'screenshots, photographs of people and WhatsApp forwards. Judge only what ' +
    'you can see; never guess a project or developer name.';

  const schema =
    'Reply with ONLY this JSON object:\n' +
    '{"images":[{"i":0,"section":"","caption":"","confident":true}]}\n' +
    'One entry per image, in the order given, with i as its position starting ' +
    'at 0. section must be one of: ' + IMG_SECTIONS.join(', ') + '. caption is ' +
    'two or three words describing what is shown, e.g. "Swimming Pool" or ' +
    '"Tower Elevation". confident is false when the picture is unclear.';

  const parts = [{ text: schema }];
  shots.forEach(function (s, i) {
    parts.push({ text: 'Image ' + i + (s.name ? ' (file name: ' + s.name + ')' : '') });
    parts.push({ inline_data: { mime_type: 'image/jpeg', data: s.data } });
  });

  const out = aiCall_(system, parts, 1600);
  if (out.error) return out;

  const rows = Array.isArray(out.images) ? out.images : [];
  const clean = [];
  rows.forEach(function (r) {
    const i = Number(r && r.i);
    if (!isFinite(i) || i < 0 || i >= shots.length) return;
    const sec = String((r && r.section) || '').toLowerCase().trim();
    clean.push({
      i: i,
      section: IMG_SECTIONS.indexOf(sec) > -1 ? sec : 'other',
      caption: String((r && r.caption) || '').replace(/[^\w &'.-]/g, ' ')
                 .replace(/\s{2,}/g, ' ').trim().slice(0, 40),
      confident: r && r.confident !== false
    });
  });
  return { ok: true, images: clean, model: out._model || '', _usage: out._usage || null };
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

/* ═══════════ who deployed what ═══════════
   Every action has been written to a spreadsheet since the beginning, but
   only whoever owns that spreadsheet could read it. With twenty people
   sharing one tool, "who created this campaign" is a question asked inside
   the tool, by the people asking it, not a reason to go and open a sheet.

   Deploys are what the question is about, so those come back by default
   and everything else only when asked for. The newest row first, because
   that is the one being asked about. */
const HIST_DEPLOY = ['ads-deploy', 'meta-deploy'];

/* Whether a deploy row records a success. Guessing from the prose of an
   error does not work — "Meta 400: something went wrong" contains none of
   the words one would look for. So it is the other way round: a success
   note is one of the three shapes this file writes, and a deploy row that
   is not one of them failed. New wording on an error therefore shows as a
   failure, which is the safe direction. */
function histOk_(action, note) {
  if (HIST_DEPLOY.indexOf(action) === -1) return null;   /* not a deploy */
  const n = String(note || '').trim();
  if (!n) return false;
  return /^customers\/\d+\/campaigns\/\d+/.test(n)      /* Google resource name */
      || /^campaign\s+\d+/.test(n)                       /* Meta: campaign <id> */
      || /^\d+\s+operations$/.test(n);                    /* a dry run */
}

/* ═══════════ saved projects, on the server ═══════════
   They lived in the browser's own storage, so a project saved on the
   office desktop did not exist on the laptop, nobody could pick up
   somebody else's work, and an admin could not see what the team had
   built. They live in a Drive folder now, one file per project and a
   second file for its pictures, which are far too large to sit beside
   the brief in something that gets listed.

   Each file carries its owner and its real name in the description, so
   listing never has to open one. A user sees their own; the admin sees
   everybody's. */
const PROJ_FOLDER_NAME = 'Trigger — saved projects';
const PROJ_PREFIX = 'pp.';

function projFolder_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('PROJ_FOLDER');
  if (id) {
    try { return DriveApp.getFolderById(id); }
    catch (e) { /* deleted or moved to another account — make a new one */ }
  }
  const it = DriveApp.getFoldersByName(PROJ_FOLDER_NAME);
  const f = it.hasNext() ? it.next() : DriveApp.createFolder(PROJ_FOLDER_NAME);
  props.setProperty('PROJ_FOLDER', f.getId());
  return f;
}
const projSlug_ = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '').slice(0, 60) || 'x';
/* A slug alone is not a name. "Greenscapes — Phase 2" and "Greenscapes
   Phase 2" slug to the same thing, and the second save would have
   silently replaced the first. The tag is of the exact name, so two
   names that look alike still get two files. */
function projTag_(s) {
  const str = String(s || '');
  let h = 5381;
  for (var i = 0; i < str.length; i++) h = ((h * 33) ^ str.charCodeAt(i)) >>> 0;
  return h.toString(36).slice(0, 7);
}
function projFile_(owner, name, kind) {
  return PROJ_PREFIX + projSlug_(owner) + '.' + projSlug_(name) + '-' + projTag_(name) +
         (kind === 'assets' ? '.assets' : '') + '.json';
}
/* The description is the index: owner, the name as it was typed, when, and
   whether there are pictures. Reading it costs nothing next to opening a
   file that may be eight megabytes. */
function projMeta_(file) {
  try { return JSON.parse(file.getDescription() || '{}'); }
  catch (e) { return {}; }
}
function projWrite_(folder, fname, body, meta) {
  const it = folder.getFilesByName(fname);
  let f = it.hasNext() ? it.next() : null;
  if (f) f.setContent(body);
  else f = folder.createFile(fname, body, 'application/json');
  if (meta) f.setDescription(JSON.stringify(meta));
  return f;
}
function projFind_(folder, fname) {
  const it = folder.getFilesByName(fname);
  return it.hasNext() ? it.next() : null;
}
const projMayTouch_ = (v, owner) =>
  !owner || String(owner).toLowerCase() === String(v.email || '').toLowerCase() ||
  (typeof role === 'function' && role(v.email) === 'admin');

function projRoute(body, v) {
  if (!v || !v.ok) return { error: 'Sign in again.' };
  const action = String(body.action || '');
  const me = String(v.email || '').toLowerCase();
  const admin = typeof role === 'function' && role(v.email) === 'admin';
  let folder;
  try { folder = projFolder_(); }
  catch (e) { return { error: 'Could not reach the projects folder in Drive: ' + e }; }

  if (action === 'proj-list') {
    const out = [];
    const it = folder.getFiles();
    while (it.hasNext()) {
      const f = it.next();
      const fname = f.getName();
      if (fname.indexOf(PROJ_PREFIX) !== 0) continue;
      if (fname.indexOf('.assets.json') > -1) continue;
      const m = projMeta_(f);
      if (!m.name) continue;
      const owner = String(m.owner || '').toLowerCase();
      if (!admin && owner !== me) continue;
      out.push({
        name: m.name, owner: m.owner || '', ownerName: m.ownerName || '',
        saved: m.saved || 0, hasAssets: !!m.hasAssets,
        heroCount: m.heroCount || 0, mine: owner === me
      });
    }
    out.sort(function (a, b) { return (b.saved || 0) - (a.saved || 0); });
    return { ok: true, projects: out, you: v.email, admin: admin };
  }

  if (action === 'proj-put') {
    const name = String(body.name || '').trim();
    if (!name) return { error: 'Name the project before saving it.' };
    const project = body.project;
    if (!project || typeof project !== 'object') return { error: 'Nothing to save.' };
    const assets = body.assets && typeof body.assets === 'object' ? body.assets : null;
    const meta = {
      name: name, owner: v.email, ownerName: v.name || '',
      saved: Date.now(), hasAssets: !!assets,
      heroCount: assets && assets.heroes ? assets.heroes.length : 0
    };
    try {
      projWrite_(folder, projFile_(v.email, name), JSON.stringify(project), meta);
    } catch (e) { return { error: 'Could not save the project: ' + e }; }
    /* The brief is safe by here. The pictures are a second, much larger
       write that can fail on its own, and if it does the project is still
       a project — just without them, which is what the answer says. */
    if (!assets) {
      const old = projFind_(folder, projFile_(v.email, name, 'assets'));
      if (old) { try { old.setTrashed(true); } catch (e) {} }
      return { ok: true, saved: meta.saved, assets: false };
    }
    try {
      projWrite_(folder, projFile_(v.email, name, 'assets'), JSON.stringify(assets), null);
    } catch (e) {
      meta.hasAssets = false; meta.heroCount = 0;
      try { projWrite_(folder, projFile_(v.email, name), JSON.stringify(project), meta); }
      catch (e2) {}
      return { ok: true, saved: meta.saved, assets: false,
               note: 'The project was saved, but its images could not be: ' + e };
    }
    return { ok: true, saved: meta.saved, assets: true, heroCount: meta.heroCount };
  }

  if (action === 'proj-get' || action === 'proj-assets') {
    const name = String(body.name || '').trim();
    const owner = String(body.owner || v.email || '');
    if (!name) return { error: 'Which project?' };
    if (!projMayTouch_(v, owner))
      return { error: 'That project belongs to ' + owner + '.' };
    const f = projFind_(folder, projFile_(owner, name, action === 'proj-assets' ? 'assets' : ''));
    if (!f) return action === 'proj-assets'
      ? { ok: true, assets: null }
      : { error: 'No project called "' + name + '" is saved.' };
    let data;
    try { data = JSON.parse(f.getBlob().getDataAsString()); }
    catch (e) { return { error: 'That project could not be read back: ' + e }; }
    return action === 'proj-assets'
      ? { ok: true, assets: data }
      : { ok: true, project: data, meta: projMeta_(f) };
  }

  if (action === 'proj-del') {
    const name = String(body.name || '').trim();
    const owner = String(body.owner || v.email || '');
    if (!name) return { error: 'Which project?' };
    if (!projMayTouch_(v, owner))
      return { error: 'That project belongs to ' + owner + '.' };
    let gone = 0;
    ['', 'assets'].forEach(function (k) {
      const f = projFind_(folder, projFile_(owner, name, k));
      if (f) { try { f.setTrashed(true); gone++; } catch (e) {} }
    });
    if (!gone) return { error: 'No project called "' + name + '" is saved.' };
    return { ok: true, deleted: name };
  }

  return { error: 'Unknown project action: ' + action };
}

function historyRead(body, v) {
  if (!v || !v.ok) return { error: 'Sign in again.' };
  if (typeof write !== 'function') return { error: 'No log sheet in this project.' };

  var sh;
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    sh = ss && ss.getSheetByName(SHEET);
    if (!sh) return { ok: true, rows: [], note: 'Nothing has been logged yet.' };
  } catch (e) { return { error: 'Could not open the log: ' + e }; }

  const limit = Math.min(Math.max(Number(body.limit) || 60, 1), 400);
  const want  = String(body.scope || 'deploys');
  const mine  = !!body.mine;
  const last  = sh.getLastRow();
  if (last < 2) return { ok: true, rows: [], note: 'Nothing has been logged yet.' };

  /* Read backwards in chunks rather than reading the sheet: a year of use is
     tens of thousands of rows and all anybody wants is the last page of
     them. A single guessed window does not work — deploys are sparse among
     the reads, so one guess either reads far too much or comes back half
     empty. This keeps asking for the next chunk back until the page is full
     or the sheet runs out, and never reads more than it has to. */
  const rows = [];
  var bottom = last;        /* the lowest row not yet read; row 1 is the header */
  var scanned = 0;
  const CHUNK = Math.max(limit * 4, 200), CEILING = 20000;

  while (bottom >= 2 && rows.length < limit && scanned < CEILING) {
    const take = Math.min(CHUNK, bottom - 1);
    const top  = bottom - take + 1;
    const vals = sh.getRange(top, 1, take, 7).getValues();
    scanned += take;
    for (var i = vals.length - 1; i >= 0 && rows.length < limit; i--) {
      const r = vals[i];
      const action = String(r[4] || '');
      if (!action) continue;
      if (want === 'deploys' && HIST_DEPLOY.indexOf(action) === -1) continue;
      const email = String(r[1] || '');
      if (mine && email.toLowerCase() !== String(v.email || '').toLowerCase()) continue;
      /* instanceof Date is not reliable across execution contexts, and the
         cell may be a string anyway if somebody has edited the sheet */
      const when = r[0];
      rows.push({
        at    : (when && typeof when.getTime === 'function' && !isNaN(when.getTime()))
                  ? when.toISOString() : String(when || ''),
        email : email,
        name  : String(r[2] || ''),
        role  : String(r[3] || ''),
        action: action,
        detail: String(r[5] || ''),
        note  : String(r[6] || ''),
        ok    : histOk_(action, r[6])
      });
    }
    bottom = top - 1;     /* always moves, so this cannot read a row twice */
  }

  /* Who has been deploying at all, so a name can be recognised without
     reading every row. Counted over the window that was read, and said so. */
  const by = {};
  rows.forEach(function (x) {
    const k = x.email || '(unknown)';
    by[k] = by[k] || { email: k, name: x.name, count: 0 };
    by[k].count++;
  });
  const people = Object.keys(by).map(function (k) { return by[k]; })
    .sort(function (a, b) { return b.count - a.count; });

  return { ok: true, rows: rows, people: people, scope: want,
           you: v.email, scanned: scanned,
           truncated: rows.length === limit && bottom >= 2 };
}

/* The OAuth callback lands here: Google sends the browser back to this web
   app's own URL with a code. The page it gets is the last thing the person
   sees of this, so it says plainly whether it worked. */
function oauthCallback_(e) {
  const p = (e && e.parameter) || {};
  const page = function (title, body, good) {
    return HtmlService.createHtmlOutput(
      '<!doctype html><meta charset="utf-8">' +
      '<meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<div style="font:15px/1.6 system-ui,sans-serif;max-width:520px;margin:12vh auto;padding:0 20px">' +
      '<div style="font-size:28px;margin-bottom:10px">' + (good ? '\u2713' : '\u2715') + '</div>' +
      '<h1 style="font-size:19px;margin:0 0 10px">' + title + '</h1>' +
      '<p style="color:#4A5160;margin:0">' + body + '</p>' +
      '<p style="color:#8F8A82;font-size:13px;margin-top:22px">You can close this tab.</p></div>');
  };

  if (p.error)
    return page('Not connected', 'Google said: ' + String(p.error).slice(0, 200) +
      '. Nothing was changed \u2014 you can try again from Trigger.', false);

  var email = '';
  try { email = CacheService.getScriptCache().get('oauth-state-' + String(p.state || '')) || ''; }
  catch (err) {}
  if (!email)
    return page('That link has expired',
      'Start again from Trigger. The link is good for fifteen minutes, which ' +
      'is what stops somebody else\u2019s account being attached to yours.', false);

  const got = oauthExchange_(String(p.code || ''));
  if (got.error) return page('Not connected', got.error, false);

  try {
    PropertiesService.getScriptProperties().setProperty(oauthKey_(email), got.refresh);
    CacheService.getScriptCache().remove('oauth-state-' + String(p.state || ''));
  } catch (err) { return page('Not connected', 'Could not store it: ' + err, false); }

  try { if (typeof write === 'function')
    write([new Date(), email, '', '', 'ads-connect', 'connected their Google Ads', '']); } catch (err) {}

  return page('Connected',
    'Campaigns you deploy will now be created by <b>' + email +
    '</b>, so Google Ads\u2019 own change history names you. ' +
    'You still need access to the account you are deploying into.', true);
}

function handleGet(e) {
  if (e && e.parameter && (e.parameter.code || e.parameter.state || e.parameter.error))
    return oauthCallback_(e);
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
  /* the three connection actions are about the person, not an account, so
     they come before the deploy gate */
  if (body.action === 'ads-connect') {
    if (!v || !v.ok) return { error: 'Sign in again.' };
    return oauthUrl_(v.email);
  }
  if (body.action === 'ads-connection') {
    const own = !!metaProp_(oauthKey_(v.email), '');
    return { ok: true, connected: own, email: v.email,
             possible: oauthReady_(),
             redirect: oauthRedirect_(), clientId: oauthClientId_(),
             required: metaProp_('ADS_REQUIRE_OWN', '') === '1' };
  }
  if (body.action === 'ads-disconnect') {
    if (!v || !v.ok) return { error: 'Sign in again.' };
    try {
      PropertiesService.getScriptProperties().deleteProperty(oauthKey_(v.email));
      CacheService.getScriptCache().remove('gads-at-' + oauthKey_(v.email));
    } catch (e) {}
    return { ok: true, connected: false };
  }

  const stop = adsGate(v, body.action, body.customerId);
  if (stop) return { error: stop };

  /* Everything below talks to Google Ads, so it acts as the person when
     they have connected and as the script otherwise. */
  const own = adsActAs_(v);
  if (!own && metaProp_('ADS_REQUIRE_OWN', '') === '1' &&
      (body.action === 'ads-deploy' || body.action === 'ads-validate'))
    return { error: 'This account is set to require each person to deploy as ' +
      'themselves. Press \u201cConnect my Google Ads\u201d first \u2014 your campaigns ' +
      'will then appear under your own name in the change history.' };

  if (body.action === 'ads-check')  return adsCheck(body);
  if (body.action === 'ads-geo')    return adsGeo(body);
  if (body.action === 'ads-accounts') return adsAccounts(body);
  if (body.action === 'ads-lists')    return adsSharedSets(body);
  if (body.action === 'ads-segments') return adsSegments(body, v);
  if (body.action === 'ads-deploy') {
    const out = adsDeploy(body, v);
    if (out && typeof out === 'object') {
      out.deployedAs = own ? v.email : 'the shared credential';
      out.ownCredential = own;
    }
    return out;
  }
  return null;
}

/* ── plumbing ─────────────────────────────────────────────────────────────── */

/* ═══════════ deploying as yourself ═══════════
   Every campaign used to be created with the script owner's credential, so
   Google Ads' own change history named one person for work done by twenty.
   Trigger's log knew who pressed the button; Google did not, and Google's
   is the history an account audit reads.

   Each person can connect their own Google Ads here. Their refresh token is
   kept in Script Properties and exchanged for a short-lived access token as
   needed. Somebody who has not connected still deploys — with the shared
   credential, said so plainly in the result and recorded as such in the
   log — unless ADS_REQUIRE_OWN is set, which refuses instead. That switch
   is for once everybody has connected; blocking twenty people on the first
   day would just mean nobody deploys.

   The person must also have access to the Google Ads account itself. A
   connection proves who they are, not what they may touch. */
const OAUTH_SCOPE = 'https://www.googleapis.com/auth/adwords';
const oauthKey_   = e => 'gads-rt-' + String(e || '').toLowerCase();

function oauthClientId_()  { return metaProp_('ADS_OAUTH_CLIENT_ID', '') || CLIENT_ID; }
function oauthSecret_()    { return metaProp_('ADS_OAUTH_SECRET', ''); }
function oauthRedirect_()  {
  const set = metaProp_('ADS_OAUTH_REDIRECT', '');
  if (set) return set;
  var u = '';
  try { u = ScriptApp.getService().getUrl() || ''; } catch (e) { return ''; }
  /* Inside a Workspace account getUrl() answers with the domain-scoped form,
     script.google.com/a/<domain>/macros/s/<id>/exec, while the Console lists
     the plain one — and redirect_uri has to match to the character. Both
     reach the same script, so the plain form is used and the /a/<domain>
     segment dropped. ADS_OAUTH_REDIRECT still overrides all of this. */
  return u.replace(/^(https:\/\/script\.google\.com)\/a\/[^\/]+\//, '$1/');
}
function oauthReady_() {
  return !!(oauthClientId_() && oauthSecret_() && oauthRedirect_());
}

function oauthUrl_(email) {
  if (!oauthReady_()) return { error:
    'Connecting your own account needs ADS_OAUTH_SECRET in Script Properties, ' +
    'and this web app’s /exec URL listed as an authorised redirect URI on ' +
    'the OAuth client. Until then everyone deploys with the shared credential.' };
  /* The state is checked on the way back, so a link cannot be made to
     attach somebody else's Google account to this address. */
  const nonce = Utilities.getUuid();
  try { CacheService.getScriptCache().put('oauth-state-' + nonce,
        String(email || '').toLowerCase(), 900); } catch (e) {}
  const p = {
    client_id: oauthClientId_(), redirect_uri: oauthRedirect_(),
    response_type: 'code', scope: OAUTH_SCOPE,
    access_type: 'offline', prompt: 'consent',
    include_granted_scopes: 'true', state: nonce,
    login_hint: String(email || '')
  };
  const q = Object.keys(p).map(function (k) {
    return encodeURIComponent(k) + '=' + encodeURIComponent(p[k]);
  }).join('&');
  /* redirect_uri_mismatch is the commonest failure here and the message
     Google shows never says what was sent. It is returned so the two can
     be compared character for character instead of guessed at. */
  return { ok: true, url: 'https://accounts.google.com/o/oauth2/v2/auth?' + q,
           redirect: oauthRedirect_(), clientId: oauthClientId_() };
}

function oauthExchange_(code) {
  const res = UrlFetchApp.fetch('https://oauth2.googleapis.com/token', {
    method: 'post', muteHttpExceptions: true,
    payload: { code: code, client_id: oauthClientId_(), client_secret: oauthSecret_(),
               redirect_uri: oauthRedirect_(), grant_type: 'authorization_code' }
  });
  var b = {};
  try { b = JSON.parse(res.getContentText()); } catch (e) {}
  if (res.getResponseCode() !== 200 || !b.refresh_token)
    return { error: (b.error_description || b.error || res.getContentText()).toString().slice(0, 300) };
  return { ok: true, refresh: b.refresh_token };
}

/* A short-lived token, cached well inside its hour so a long build does not
   stop halfway through for a refresh. */
function oauthAccessToken_(email) {
  const key = oauthKey_(email);
  const rt = metaProp_(key, '');
  if (!rt) return '';
  const ck = 'gads-at-' + key;
  try { const hit = CacheService.getScriptCache().get(ck); if (hit) return hit; } catch (e) {}

  const res = UrlFetchApp.fetch('https://oauth2.googleapis.com/token', {
    method: 'post', muteHttpExceptions: true,
    payload: { refresh_token: rt, client_id: oauthClientId_(),
               client_secret: oauthSecret_(), grant_type: 'refresh_token' }
  });
  var b = {};
  try { b = JSON.parse(res.getContentText()); } catch (e) {}
  if (res.getResponseCode() !== 200 || !b.access_token) {
    /* A revoked or expired grant is not a transient failure: the stored
       token is dead and keeping it only produces this error again on every
       call. It is dropped so the person is asked to connect again. */
    if (/invalid_grant/i.test(String(b.error || ''))) {
      try { PropertiesService.getScriptProperties().deleteProperty(key); } catch (e) {}
    }
    return '';
  }
  try { CacheService.getScriptCache().put(ck, b.access_token,
        Math.max(60, Math.min(3000, (Number(b.expires_in) || 3600) - 600))); } catch (e) {}
  return b.access_token;
}

/* Who the next Google Ads call acts as. Set per request, never left over
   from the one before. */
var ADS_ACTING = null;
function adsActAs_(v) {
  ADS_ACTING = null;
  if (!v || !v.ok) return false;
  const t = oauthAccessToken_(v.email);
  if (!t) return false;
  ADS_ACTING = { token: t, email: v.email };
  return true;
}

function adsHeaders() {
  const h = {
    Authorization    : 'Bearer ' + ((ADS_ACTING && ADS_ACTING.token) || ScriptApp.getOAuthToken()),
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
        var line = (where ? where + ': ' : '') + (x.message || JSON.stringify(x.errorCode || {}));
        /* "The resource has been disapproved since the policy summary includes
           policy topics of type PROHIBITED" does not say WHICH policy, and
           without that it is unactionable. Google does send the topics, one
           level further down in the error details, and they were being thrown
           away here. They are the whole answer, so they are pulled out. */
        const pf = x.details && (x.details.policyFindingDetails || x.details.policy_finding_details);
        const entries = pf && (pf.policyTopicEntries || pf.policy_topic_entries);
        if (entries && entries.length) {
          const topics = entries.map(function (t) {
            const name = t.topic || '(unnamed)';
            const type = t.type || '';
            const bits = [];
            (t.evidences || []).forEach(function (ev) {
              const tl = ev.textList || ev.text_list;
              if (tl && tl.texts) bits.push(tl.texts.join(', '));
              const site = ev.websiteList || ev.website_list;
              if (site && site.websites) bits.push(site.websites.join(', '));
              if (ev.text) bits.push(String(ev.text));
              const dest = ev.destinationNotWorking || ev.destination_not_working;
              if (dest) bits.push(String(dest.expandedUrl || dest.expanded_url || '') + ' ' +
                                  String(dest.reason || dest.dnsErrorType || ''));
            });
            return name + (type ? ' (' + type + ')' : '') +
                   (bits.length ? ' — ' + bits.join('; ').slice(0, 200) : '');
          });
          line += ' → POLICY: ' + topics.join(' | ');
        }
        out.push(line);
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
  const taken = {};
  rows.forEach(function (r) {
    var name = String(r.name || '').trim();
    const kind = String(r.kind || '').trim();
    const input = String(r.input || '').trim();
    if (!input || !CS_TYPE[kind]) return;
    if (!name) { out.push({ name: input, error: 'This line produced an empty name.' }); return; }
    /* Google refuses a batch outright if two members of it carry the same
       name, and two different inputs can slug down to the same thing
       ("99acres.com/pune" and "99acres.com/pune/") — so a repeat inside this
       batch gets a number rather than taking the whole press down with it. */
    var key = name.toLowerCase();
    if (taken[key]) {
      var n = 2;
      while (taken[(name + ' ' + n).toLowerCase()]) n++;
      name = name + ' ' + n; key = name.toLowerCase();
    }
    taken[key] = true;
    const existing = have[key];
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
    /* CustomAudienceService.MutateCustomAudiences has no partialFailure field
       — that one belongs to GoogleAdsService.Mutate. Sending it comes back
       "Unknown name partialFailure: Cannot find field" and nothing is created.
       So the batch is tried whole, and only if it fails is each operation sent
       on its own: one call on the happy path, and on a failure every line gets
       its own verdict instead of one wall of text with no line named. */
    const ep = 'customers/' + cid + '/customAudiences:mutate';
    const r = adsCall(ep, { operations: ops });
    if (!r.error) {
      (r.body.results || []).forEach(function (res, i) {
        const id = String(res.resourceName || '').split('/').pop();
        if (!id || id === 'null') { out.push({ name: pending[i], error: 'Google refused this one.' }); return; }
        out.push({ name: pending[i], id: id, made: true });
      });
    } else {
      for (var i = 0; i < ops.length; i++) {
        const one = adsCall(ep, { operations: [ops[i]] });
        /* "operations[0] > " is noise when the call carried one operation */
        if (one.error) {
          out.push({ name: pending[i],
                     error: String(one.error).replace(/^operations\[0\]\s*>\s*/, '') });
          continue;
        }
        const res = (one.body.results || [])[0] || {};
        const id = String(res.resourceName || '').split('/').pop();
        if (!id || id === 'null') out.push({ name: pending[i], error: 'Google refused this one.' });
        else out.push({ name: pending[i], id: id, made: true });
      }
    }
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
  const isDGPlan = String(plan.channel || '') === 'demandgen';

  /* The pictures are uploaded ONCE, before the campaigns, and every campaign
     then points at the assets that came back. Eight Demand Gen campaigns used
     to carry the same four images eight times over — thirty-two uploads of
     the same bytes in one deploy, and Google refusing all but the first. */
  var assetRn = {}, assetNote = '';
  if (isDGPlan && !dry) {
    const up = dgUploadAssets(cid, plan);
    if (up.error) return { error: 'The images could not be uploaded, so nothing was created. ' + up.error };
    assetRn = up.map;
    if (up.count) assetNote = up.count + ' image' + (up.count === 1 ? '' : 's') +
      ' uploaded once and shared by every campaign.';
  }

  for (var i = 0; i < plan.campaigns.length; i++) {
    const c = plan.campaigns[i];
    var ops, notes = [];
    const isDG = isDGPlan;
    if (assetNote) notes.push(assetNote);
    try { ops = isDG ? buildDgOps(cid, plan, c, notes, assetRn) : buildOps(cid, plan, c); }
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
               cid + ' / ' + c.name +
                 (ADS_ACTING ? '' : ' (shared credential)'),
               results[results.length - 1].error ||
                 (r.error ? '' : (firstCampaign(r.body) ||
                   (ops.length + ' operations')))]);
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

  /* Locations, then language.

     Location targeting in Google Ads lives on the campaign, not the ad
     group, so a project that wants Vadgaon in one campaign and Wakad in
     another needs two campaigns with different criteria — which is what
     per-campaign locations are. A campaign that names its own set uses it;
     one that does not falls back to the settings, so an existing plan that
     knows nothing about sets deploys exactly as it did before. */
  const campLocs = (c.locationIds && c.locationIds.length) ? c.locationIds : (S.locationIds || []);
  const campProx = (c.proximity   && c.proximity.length)   ? c.proximity   : (S.proximity   || []);

  campLocs.forEach(function (id) {
    if (!digits(id)) return;
    ops.push({ campaignCriterionOperation: { create: {
      campaign: campRn,
      location: { geoTargetConstant: 'geoTargetConstants/' + digits(id) }
    }}});
  });
  campProx.forEach(function (pr) {
    if (!pr || !pr.lat || !pr.lng) return;
    ops.push({ campaignCriterionOperation: { create: {
      campaign: campRn,
      proximity: {
        geoPoint: {
          latitudeInMicroDegrees : Math.round(Number(pr.lat) * 1e6),
          longitudeInMicroDegrees: Math.round(Number(pr.lng) * 1e6)
        },
        radius: Number(pr.radius || 5),
        radiusUnits: pr.units || 'KILOMETERS'
      }
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

/* Upload every distinct picture in the plan in one call and hand back the
   resource names, keyed by the same deterministic name the campaign builder
   will ask for. */
function dgUploadAssets(cid, plan) {
  var SETS = plan.creativeSets;
  if (!SETS || !SETS.length) SETS = [{ name: 'Creative', images: plan.creatives || {} }];
  const ops = [], keys = [], seen = {};
  SETS.forEach(function (st, i) {
    const src = st.images || {};
    DG_IMAGE_SLOTS.forEach(function (slot) {
      const img = src[slot[0]];
      if (!img || !img.data) return;
      const key = assetName_(slot[0] === 'logo' ? 'Logo' : slot[2], img.data);
      if (seen[key]) return;
      seen[key] = 1; keys.push(key);
      ops.push({ assetOperation: { create: {
        resourceName: 'customers/' + cid + '/assets/-' + keys.length,
        name: key, imageAsset: { data: img.data }
      }}});
    });
  });
  if (!ops.length) return { map: {}, count: 0 };
  const r = adsCall('customers/' + cid + '/googleAds:mutate',
    { mutateOperations: ops, responseContentType: 'RESOURCE_NAME_ONLY' });
  if (r.error) return { error: r.error };
  const map = {};
  (r.body.mutateOperationResponses || []).forEach(function (res, i) {
    const rn = ((res.assetResult || {}).resourceName) || '';
    if (rn && keys[i]) map[keys[i]] = rn;
  });
  return { map: map, count: keys.length };
}

/* Real resource names for images already created in this deploy, keyed by
   the deterministic name. Filled once before the campaign loop. */
var ASSET_RN = {};
/* A short, stable fingerprint of the bytes. The whole base64 string is far
   too long to walk for every campaign, so it is sampled: length, plus a
   rolling hash over an even spread of the characters. Two different images
   agreeing on all of that is not a thing that happens here. */
function assetHash_(data) {
  const s = String(data || '');
  var h = 2166136261, step = Math.max(1, Math.floor(s.length / 4096));
  for (var i = 0; i < s.length; i += step) {
    h ^= s.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return s.length.toString(36) + '-' + h.toString(36);
}
function assetName_(label, data) {
  return 'PP ' + label + ' ' + assetHash_(data);
}

function buildDgOps(cid, plan, c, notes, assetRn) {
  ASSET_RN = assetRn || {};
  var S = plan.settings || {};
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
    },
    /* Demand Gen defaults to upgraded targeting, which moves location and
       language onto the ad group. Two reasons to turn it off: the account
       sets location on the campaign for Search and Demand Gen alike, and
       radius targeting only exists as a CAMPAIGN criterion \u2014 ProximityInfo
       is not a field on AdGroupCriterion at all. The setting is immutable
       after creation, so it is decided here. */
    demandGenCampaignSettings: { upgradedTargeting: S.upgradedTargeting === true }
    /* no networkSettings: Demand Gen picks its own surfaces and the API
       rejects the Search network block outright */
  };
  applyDgBidding(camp, S, notes);
  ops.push({ campaignOperation: { create: camp } });

  const upgraded = S.upgradedTargeting === true;
  /* With upgraded targeting OFF, a Demand Gen campaign takes its targeting the
     same way a Search campaign does, which is how this account works. With it
     ON, Google moves location and language to the ad group and refuses them
     here: a location or language comes back as an unmapped error code, and an
     age or income exclusion as "The Criterion is not allowed to be excluded". */
  if (!upgraded) {
    (S.locationIds || []).forEach(function (id) {
      if (!digits(id)) return;
      ops.push({ campaignCriterionOperation: { create: {
        campaign: campRn,
        location: { geoTargetConstant: 'geoTargetConstants/' + digits(id) }
      }}});
    });
    (S.proximity || []).forEach(function (pr) {
      if (!pr || !pr.lat || !pr.lng) return;
      ops.push({ campaignCriterionOperation: { create: {
        campaign: campRn,
        proximity: {
          geoPoint: {
            latitudeInMicroDegrees : Math.round(Number(pr.lat) * 1e6),
            longitudeInMicroDegrees: Math.round(Number(pr.lng) * 1e6)
          },
          radius: Number(pr.radius || 5),
          radiusUnits: pr.units || 'KILOMETERS'
        }
      }}});
    });
    (S.languageIds && S.languageIds.length ? S.languageIds : ['1000']).forEach(function (id) {
      ops.push({ campaignCriterionOperation: { create: {
        campaign: campRn,
        language: { languageConstant: 'languageConstants/' + digits(id) }
      }}});
    });
    /* The demographics are deliberately NOT here. A Demand Gen campaign uses
       audience-grouped targeting, and that makes an age, gender or income
       EXCLUSION illegal at every level: as a campaign criterion Google answers
       "The Criterion is not allowed to be excluded", and as an ad group
       criterion "Audience segment attachment is not allowed when use audience
       grouped bit is set to true". The only place they are accepted is inside
       the Audience resource below, written as inclusions. Turning upgraded
       targeting off buys location, radius and language on the campaign; it
       does not buy demographic exclusions. */
  } else if ((S.proximity || []).length) {
    notes.push('Radius targeting was not sent \u2014 it only exists as a campaign ' +
               'criterion, and upgraded targeting puts this campaign\u2019s targeting ' +
               'on the ad group. Turn upgraded targeting off to use a radius.');
  }

  /* Said plainly rather than sent and refused: Demand Gen takes neither
     campaign negative keywords nor the manager account's negative lists. */
  if ((S.negKeywords || []).length)
    notes.push((S.negKeywords || []).length + ' negative keywords were not sent \u2014 ' +
               'Demand Gen campaigns do not take negative keywords.');
  if ((S.sharedSets || []).length)
    notes.push('The negative keyword lists were not attached \u2014 Demand Gen does not take them.');

  /* The artwork. A project is usually shot more than once — a different hero
     render, a different elevation — and each of those is its own ad, so the
     plan carries a LIST of creative sets rather than one set of four images.
     plan.creatives (one set) is still read, so an older plan still deploys.
     The logo is uploaded once and shared: it is the same logo on every ad. */
  var SETS = plan.creativeSets;
  if (!SETS || !SETS.length)
    SETS = [{ name: 'Creative', images: plan.creatives || {} }];
  /* Google identifies an image asset by its CONTENT. Every campaign used to
     build its own asset operations for the same four pictures, each with a
     name carrying a timestamp and a running index, so the second campaign
     asked Google to create bytes it already had under a different name:
     "Duplicate assets across mutates cannot have different asset level
     fields", and the campaign was lost. The name is derived from the bytes
     now, so every campaign asks for exactly the same asset and Google hands
     back the one it already has. */
  var logoRn = '';
  const seenAsset = {};
  const upload = function (data, label) {
    const key = assetName_(label, data);
    if (seenAsset[key]) return seenAsset[key];
    if (ASSET_RN[key]) { seenAsset[key] = ASSET_RN[key]; return ASSET_RN[key]; }
    const rn = base + 'assets/' + next();
    ops.push({ assetOperation: { create: {
      resourceName: rn, name: key, imageAsset: { data: data }
    }}});
    seenAsset[key] = rn;
    return rn;
  };
  (function () {
    for (var i = 0; i < SETS.length; i++) {
      const lg = (SETS[i].images || {}).logo;
      if (lg && lg.data) { logoRn = upload(lg.data, 'Logo'); return; }
    }
  })();
  /* a set with neither a square nor a landscape cannot become an ad, so its
     images are not uploaded at all rather than left orphaned in the account */
  SETS = SETS.filter(function (st, i) {
    const im = st.images || {};
    if ((im.square && im.square.data) || (im.landscape && im.landscape.data)) return true;
    notes.push('"' + (st.name || ('Set ' + (i + 1))) + '" has neither a landscape nor a square ' +
               'image, so no ad was made from it and nothing was uploaded.');
    return false;
  });
  if (!SETS.length) SETS = [{ name: 'Creative', images: {} }];
  const sets = SETS.map(function (st, i) {
    const src = st.images || {}, out = {};
    DG_IMAGE_SLOTS.forEach(function (slot) {
      if (slot[0] === 'logo') { if (logoRn) out.logo = logoRn; return; }
      const s = src[slot[0]];
      /* the asset IS the picture, so its name must not carry the set's name
         as well — that made a campaign ask for a name the pre-upload had
         never created, and every campaign uploaded its own copy again */
      if (s && s.data) out[slot[0]] = upload(s.data, slot[2]);
    });
    return { name: st.name || ('Creative ' + (i + 1)), img: out };
  });
  /* the first set still answers the "is there any artwork at all" checks */
  const img = sets[0].img;

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

  /* The demographics always live here, whichever way targeting is set: see
     the note above the campaign criteria. */
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
  const exPar = S.exParental || [];
  if (exPar.length) {
    const par = keep(['PARENT','NOT_A_PARENT'], exPar);
    if (!par.length) throw new Error('Both parental statuses are excluded, so the campaign could reach nobody.');
    dims.push({ parentalStatus: {
      parentalStatuses: par,
      includeUndetermined: exPar.indexOf('UNDETERMINED') === -1
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
    if (upgraded) {
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
    }
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

    /* one ad per creative set, same copy, different artwork — which is how
       two renders of the same project get tested against each other */
    sets.forEach(function (st) {
      const ad = {
        headlines       : h.slice(0, 5).map(function (t) { return { text: t }; }),
        descriptions    : d.slice(0, 5).map(function (t) { return { text: t }; }),
        businessName    : bn,
        callToActionText: String(plan.cta || 'Learn more')
      };
      DG_IMAGE_SLOTS.forEach(function (slot) {
        if (st.img[slot[0]]) ad[slot[1]] = [{ asset: st.img[slot[0]] }];
      });
      ops.push({ adGroupAdOperation: { create: {
        adGroup: x.rn, status: 'ENABLED',
        ad: { name: st.name, finalUrls: [plan.finalUrl], demandGenMultiAssetAd: ad }
      }}});
    });
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

/* ═══════════ the design agent ═══════════════════════════════════════════
   What this is for, and what it is deliberately not for.

   The canvas draws everything that has to be exact and stays exact: the RERA
   number, the scannable QR, the price, the configuration, the developer's own
   logo pixels, the four pixel sizes Google asks for. None of that is a matter
   of taste and none of it is sent anywhere to be re-imagined. An image model
   cannot reproduce an uploaded logo, cannot be trusted with a digit of a
   registration number and cannot draw a QR that scans.

   What IS a matter of taste is which layout suits a particular render, which
   palette suits the project, whether the type is big enough to read, and
   whether anything is colliding. That is what the model is asked, and the
   only thing it may change is a setting the toolkit already offers.

   The key lives in the Apps Script's own Script Properties, never in this
   repository, which is public. Project Settings -> Script Properties ->
   GEMINI_KEY. Nothing to paste into the code.

   Gemini is the engine: the Apps Script already carries a GEMINI_KEY for the
   landing-page reader, so the agent needs no second key and no second bill. */

const AI_ALLOWED = {
  layout : ['header','frame','card','footer','panel','arch','band','strip','split'],
  palette: ['navy-gold','black-gold','white-gold','maroon-gold','navy-sky','forest',
            'coastal','river','sunset','amber','ivory'],
  font   : ['archivo','oswald','playfair','cormorant','marcellus','cinzel']
};

/* A Script Property wins, so the key can be rotated without touching Code.gs;
   otherwise the GEMINI_KEY already declared there is used. */
function aiKey_() {
  try {
    var p = PropertiesService.getScriptProperties().getProperty('GEMINI_KEY');
    if (p) return p;
  } catch (e) {}
  try { return (typeof GEMINI_KEY === 'string' && GEMINI_KEY) ? GEMINI_KEY : ''; }
  catch (e) { return ''; }
}
function aiModel_() {
  const m = aiModels_();
  return m.length ? m[0] : '';
}

/* Model names get retired — gemini-2.0-flash went away under us and the 404
   was the first anyone heard of it. So the name is not hard-coded: the API is
   asked what this key can actually run, the answer is cached for a day, and a
   GEMINI_MODEL Script Property pins one when a specific model is wanted. */
function aiProp_(k) {
  try { return PropertiesService.getScriptProperties().getProperty(k) || ''; }
  catch (e) { return ''; }
}
function aiForget_() {
  try { PropertiesService.getScriptProperties().deleteProperty('GEMINI_MODELS'); }
  catch (e) {}
}

function aiModels_() {
  const pinned = aiProp_('GEMINI_MODEL');
  if (pinned) return [pinned];
  /* The whole shortlist is cached, not just the winner. A single name left
     nowhere to go when Google answered 503 on it, which is a thing that
     happens to the newest flash model several times a day. */
  const cached = aiProp_('GEMINI_MODELS').split('|');
  if (cached[0] && (Date.now() - Number(cached[1] || 0)) < 86400000)
    return cached[0].split(',').filter(String);
  const found = aiDiscover_();
  if (found.length) {
    try {
      PropertiesService.getScriptProperties()
        .setProperty('GEMINI_MODELS', found.join(',') + '|' + Date.now());
    } catch (e) {}
  }
  return found;
}

function aiDiscover_() {
  var res;
  try {
    res = UrlFetchApp.fetch(
      'https://generativelanguage.googleapis.com/v1beta/models?pageSize=200&key=' +
      encodeURIComponent(aiKey_()), { muteHttpExceptions: true });
  } catch (e) { return []; }
  if (res.getResponseCode() !== 200) return [];
  var b = {};
  try { b = JSON.parse(res.getContentText()); } catch (e) { return []; }
  const usable = (b.models || []).filter(function (m) {
    return (m.supportedGenerationMethods || []).indexOf('generateContent') > -1;
  }).map(function (m) {
    return String(m.name || '').replace(/^models\//, '');
  }).filter(function (n) {
    /* these cannot do what the reviewer needs, whatever their version */
    return n && !/embedding|aqa|tts|audio|image-generation|gemma|learnlm/i.test(n);
  });
  usable.sort(function (a, b2) { return aiRank_(b2) - aiRank_(a); });
  return usable.slice(0, 3);
}

/* Prefer the newest stable flash model: cheap, fast, and quite enough to spot a
   collision or unreadable type. A preview or lite build loses to a stable one. */
function aiRank_(n) {
  const v = parseFloat((n.match(/gemini-([0-9]+(?:\.[0-9]+)?)/) || [])[1] || '0');
  var s = v * 100;
  if (/flash/i.test(n)) s += 40;
  else if (/pro/i.test(n)) s += 20;
  if (/lite/i.test(n)) s -= 15;
  if (/preview|[-_]exp|experimental|thinking/i.test(n)) s -= 25;
  if (/latest/i.test(n)) s += 5;
  return s;
}

function aiRoute(body, v) {
  if (body.action === 'ai-check')  return { ok: true, ready: !!aiKey_(), model: aiModel_() };
  if (!aiKey_()) return { error: 'No Gemini key in the Apps Script. Put your AI Studio key ' +
    'in GEMINI_KEY in Code.gs, or under Project Settings → Script Properties → GEMINI_KEY. ' +
    'It is never put in the repository.' };
  if (body.action === 'ai-review') return aiReview(body, v);
  return null;
}

/* One call to Gemini with whatever renders were sent. Every attempt that fails
   is reported, not just the last — the retired-model 404 was invisible because
   only the final error survived. A cached name that has since been retired is
   forgotten and discovery is run again, once. */
function aiCall_(system, parts, maxTokens) {
  var models = aiModels_();
  if (!models.length)
    return { error: 'Could not list the Gemini models for this key. Check the key, ' +
      'or set GEMINI_MODEL in Script Properties to a model name it can use.' };

  var r = aiCall1_(system, parts, maxTokens, models);
  if (r.error && r._retired && !aiProp_('GEMINI_MODEL')) {
    aiForget_();
    const fresh = aiModels_();
    if (fresh.length && fresh.join() !== models.join())
      r = aiCall1_(system, parts, maxTokens, fresh);
  }
  return r;
}

function aiCall1_(system, parts, maxTokens, models) {
  const key = aiKey_();
  /* Retrying a busy model is worth doing, but not for longer than the browser
     is prepared to wait: six slow attempts in a row once ran past the client's
     own timeout, which turned a recoverable 503 into "signal is aborted". So
     the whole thing runs to a budget and gives up honestly inside it. */
  const started = Date.now(), BUDGET = 70000;
  var fails = [], retired = false, busy = false;
  for (var i = 0; i < models.length; i++) {
    var res, attempt = 0;
    while (true) {
    try {
      res = UrlFetchApp.fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/' +
        encodeURIComponent(models[i]) + ':generateContent?key=' + encodeURIComponent(key), {
          method: 'post', contentType: 'application/json', muteHttpExceptions: true,
          payload: JSON.stringify({
            system_instruction: { parts: [{ text: system }] },
            contents: [{ role: 'user', parts: parts }],
            generationConfig: {
              temperature: 0.2,
              maxOutputTokens: maxTokens || 1400,
              responseMimeType: 'application/json'
            }
          })
        });
    } catch (err) { fails.push(models[i] + ': could not be reached (' + err + ')'); break; }

    var code = res.getResponseCode(), text = res.getContentText(), b = {};
    try { b = JSON.parse(text); }
    catch (e) { fails.push(models[i] + ': answered with something that is not JSON'); break; }

    if (code !== 200) {
      const why = ((b.error || {}).message) || text.slice(0, 200);

      /* Google saying it is busy is not a failure yet. The model is tried
         once more after a pause before moving on, because that is usually
         all a spike in demand needs. */
      if ((code === 503 || code === 500 || code === 502 || code === 504) &&
          attempt < 1 && (Date.now() - started) < BUDGET - 15000) {
        attempt++;
        try { Utilities.sleep(1200); } catch (e) {}
        continue;
      }

      fails.push(models[i] + ': ' + code + ' ' + why);
      if (code === 503 || code === 500 || code === 502 || code === 504) busy = true;
      if (code === 404) retired = true;
      /* a wrong key or a blocked project cannot be fixed by another model */
      if (code === 403 || (code === 400 && /API key|API_KEY/i.test(why))) return {
        error: 'Gemini refused the key: ' + why, _fatal: true };
      break;                                   /* otherwise try the next model */
    }

    var cand = (b.candidates || [])[0] || {};
    var msg  = ((cand.content || {}).parts || [])
                 .map(function (p) { return p.text || ''; }).join('');
    if (!msg) {
      fails.push(models[i] + ': answered with nothing' +
                 (cand.finishReason ? ' (' + cand.finishReason + ')' : ''));
      break;
    }

    var out = null;
    try { out = JSON.parse(msg); }
    catch (e) {
      var m = msg.match(/\{[\s\S]*\}/);          /* a fenced answer still has the object */
      if (m) { try { out = JSON.parse(m[0]); } catch (e2) {} }
    }
    if (!out) return { error: 'The model did not answer in JSON.', raw: msg.slice(0, 600) };

    var u = b.usageMetadata || null;
    out._usage = u ? { total_tokens: u.totalTokenCount, prompt_tokens: u.promptTokenCount } : null;
    out._model = models[i];
    return out;
    }                                          /* end retry loop */
    if ((Date.now() - started) > BUDGET) {
      fails.push('ran out of time after ' + Math.round((Date.now() - started) / 1000) + 's');
      break;
    }
  }
  /* Busy is worth saying plainly: there is nothing to fix, only to redo. */
  if (busy && fails.length === models.length)
    return { error: 'Google is busy right now — every model it offered answered ' +
             '"high demand". Nothing is wrong with the key or the setup. ' +
             'Press the button again in a few seconds.', _busy: true, _retired: retired };
  return { error: 'Gemini did not answer. Tried — ' + fails.join(' | '), _retired: retired };
}

function aiReview(body, v) {
  const shots = body.shots || [];                 /* [{name,data}] base64 JPEG */
  if (!shots.length) return { error: 'No renders were sent to review.' };
  const brief = body.brief || {};
  const now = body.settings || {};

  const system =
    'You are a senior art director reviewing finished real estate performance ads. ' +
    'You are NOT writing copy and you are NOT redrawing anything. Every word, the ' +
    'price, the RERA registration number and the QR code are fixed and correct ' +
    'already; never comment on their wording or their accuracy, only on whether ' +
    'they are legible and well placed. Judge only craft: collisions and overlaps, ' +
    'anything cropped or running off the edge, type too small or too low in ' +
    'contrast to read at a glance, promotional badges covering the building, ' +
    'unbalanced space, and whether the chosen layout and palette suit this ' +
    'particular render. Be specific about where a problem is. If a size is ' +
    'clean, say so plainly rather than inventing something. Answer as JSON.';

  const schema =
    'Answer with this exact shape:\n' +
    '{"verdict":"clean"|"minor"|"bad",' +
    '"sizes":[{"name":"<the size name given>","verdict":"clean"|"minor"|"bad",' +
    '"issues":[{"severity":"minor"|"bad","what":"<one sentence>"}]}],' +
    '"suggest":{"layout":"<id or empty>","palette":"<id or empty>","font":"<id or empty>",' +
    '"scrim":<0-100 or null>,"fill":<0-100 or null>,"why":"<one sentence>"}}\n' +
    'layout must be one of: ' + AI_ALLOWED.layout.join(', ') + '\n' +
    'palette must be one of: ' + AI_ALLOWED.palette.join(', ') + '\n' +
    'font must be one of: ' + AI_ALLOWED.font.join(', ') + '\n' +
    'Leave a suggestion empty or null when what is already set is right. ' +
    'scrim is how hard the render is darkened under the type. fill is how much ' +
    'of the frame the render fills on a ratio far from its own shape: 0 keeps the ' +
    'whole picture with a blurred surround, 100 crops to fill.';

  const parts = [{ text:
    schema + '\n\nThe project: ' + JSON.stringify({
      developer: brief.dev || '', project: brief.proj || '', location: brief.loc || ''
    }) + '\nCurrently set: ' + JSON.stringify({
      layout: now.layout || '', palette: now.palette || '', font: now.font || '',
      scrim: now.scrim, fill: now.fill
    }) + '\nThe sizes below are, in order: ' +
    shots.map(function (s) { return s.name; }).join(', ') }];

  shots.slice(0, 4).forEach(function (s) {
    parts.push({ text: 'Size: ' + s.name });
    parts.push({ inline_data: { mime_type: 'image/jpeg', data: s.data } });
  });

  const out = aiCall_(system, parts, 1400);
  if (out.error) return out;

  /* The model may only pick from what the toolkit already has. Anything else
     it says to set is dropped rather than passed through to the renderer. */
  const sug = out.suggest || {};
  const clean = {};
  ['layout','palette','font'].forEach(function (k) {
    const want = String(sug[k] || '').trim();
    if (want && AI_ALLOWED[k].indexOf(want) > -1) clean[k] = want;
  });
  ['scrim','fill'].forEach(function (k) {
    const n = Number(sug[k]);
    if (isFinite(n) && n >= 0 && n <= 100) clean[k] = Math.round(n);
  });
  clean.why = String(sug.why || '').slice(0, 300);
  out.suggest = clean;

  try {
    if (v && v.ok && typeof write === 'function')
      write([new Date(), v.email, v.name, typeof role === 'function' ? role(v.email) : '',
             'ai-review', shots.length + ' sizes', String(out.verdict || '')]);
  } catch (e) {}
  return out;
}


/* =====================================================================
   Meta — campaigns, ad sets and ads through the Marketing API
   =====================================================================

   The account's own way of doing this is written down in
   Meta_Campaign_Creation.pptx, and this follows it rather than inventing
   a structure: Leads objective, budget on the AD SET, Instant Forms as the
   conversion location, residents within a radius, 28-64, all genders,
   broker lists excluded, Facebook and Instagram feeds, stories and reels,
   Dynamic Creative off, Advantage+ campaign budget off.

   Everything is created PAUSED. Nothing is reported as created unless the
   API returned an id for it.

   SET UP, ONCE
     Business Settings -> Users -> System Users -> Add, give it access to
     the ad account and the Page, then Generate token with ads_management
     and pages_show_list. Put it in Script Properties as META_TOKEN.
     Managing your OWN ad accounts needs only Standard Access; App Review
     is for managing other people's.

   The Graph API version moves. It is a Script Property, META_API_VERSION,
   so it can be bumped without touching this file. A version Meta has
   retired comes back as a clear error naming the property.
   ===================================================================== */

/* Which copy of this file the Apps Script is actually running. The tab
   shows it beside its own build, because "the fix is pushed" and "the fix
   is running" were indistinguishable from the screen for an hour. */
const BACKEND_BUILD = 'b-30oct-4';

const META_DEFAULT_VERSION = 'v23.0';
const META_AGE_MIN = 28, META_AGE_MAX = 64;

function metaProp_(k, dflt) {
  try { return PropertiesService.getScriptProperties().getProperty(k) || dflt || ''; }
  catch (e) { return dflt || ''; }
}
const metaToken_   = () => metaProp_('META_TOKEN', '');
const metaVersion_ = () => metaProp_('META_API_VERSION', META_DEFAULT_VERSION);

/* What Meta itself can see with this token. The point is that the Business
   Suite and the API do not always agree — a Page can read "Accepted" on
   the Lead Ad Terms page while the token still cannot run lead ads on it,
   because the token is looking at a different Page, or cannot see that one
   at all. Asking outright beats guessing from a deploy that failed. */
function metaLook_(settings) {
  const s = settings || {};
  const out = {};
  const acct = String(s.accountId || '').replace(/^act_/, '').trim();
  const page = String(s.pageId || '').trim();
  const form = String(s.formId || '').trim();

  if (acct) {
    const r = metaCall_('act_' + acct + '?fields=name,account_status,currency,timezone_name', {}, 'get');
    out.account = r.error ? { error: r.error }
      : { id: acct, name: r.name, status: r.account_status, currency: r.currency };
  }
  if (page) {
    var r = metaCall_(page + '?fields=name,leadgen_tos_accepted,access_token', {}, 'get');
    /* The System User's own token often cannot see a Page's lead-gen state.
       The Page's own token can. Asking the Page about itself is the only
       reading that settles whether the terms are accepted, so when one
       comes back the question is put again with it. */
    if (!r.error && r.access_token) {
      const asPage = metaCall_(page + '?fields=name,leadgen_tos_accepted' +
        '&access_token=' + encodeURIComponent(r.access_token), {}, 'get');
      if (!asPage.error &&
          Object.prototype.hasOwnProperty.call(asPage, 'leadgen_tos_accepted')) {
        asPage._viaPageToken = true;
        r = asPage;
      }
    }
    if (r.error) out.page = { error: r.error };
    else {
      /* Absent is not false. Meta leaves the field out when the token may
         not read it — a Page owned by another business, typically — and
         treating that as "has not accepted" sends people to accept terms
         that are already accepted. Say which of the two it is. */
      const known = Object.prototype.hasOwnProperty.call(r, 'leadgen_tos_accepted');
      out.page = { id: page, name: r.name,
                   leadgenTos: r.leadgen_tos_accepted === true, tosKnown: known,
                   /* whether that reading came from the Page itself, which
                      is the authoritative one */
                   viaPageToken: r._viaPageToken === true };
    }
  }
  if (form) {
    const r = metaCall_(form + '?fields=id,name,status,page', {}, 'get');
    if (r.error) {
      /* Reading a form needs leads_retrieval, which is Advanced Access and
         is NOT needed to create an ad that points at one. So a refusal
         here says nothing about whether the deploy will work. */
      const permission = /does not exist|missing permission|cannot be loaded|\(#100\)/i.test(r.error);
      out.form = { error: r.error, unreadableOnly: permission };
    } else {
      out.form = { id: r.id, name: r.name, status: r.status,
        pageId: r.page && r.page.id, pageName: r.page && r.page.name,
        /* a form belongs to one Page; pointing an ad set at a form from
           another Page fails with an error that names neither */
        matchesPage: !page || !(r.page && r.page.id) || String(r.page.id) === page };
    }
  }
  return out;
}

/* Everything the token can reach, so the three ids can be picked from a
   list instead of typed. Typing them is where most of an evening went:
   an ad account from one business, a Page from another, and a form that
   belonged to neither — each failing with an error that named none of
   them. A list cannot be mistyped and cannot offer what is not there. */
/* What the token is actually allowed to do.

   Meta refuses lead ads with "your Facebook Page accepts Facebook's Lead
   Generation Terms of Service" when the acting token has no lead-gen
   permission on the Page — whatever the Page's own terms say. So the Terms
   get accepted again, and again, and the error does not move. The
   permission is pages_manage_ads, and asking for the list outright is the
   difference between a minute and an evening. */
const META_NEED = {
  ads_management     : 'create campaigns, ad sets and ads',
  pages_show_list    : 'see your Pages at all',
  pages_manage_ads   : 'run lead ads on a Page — WITHOUT THIS, Meta reports it ' +
                       'as the Page not having accepted the Lead Ad Terms',
  pages_read_engagement: 'read a Page’s own details'
};
function metaPerms_() {
  const r = metaCall_('me/permissions?limit=200', {}, 'get');
  if (r.error) return { error: r.error };
  const granted = [], declined = [];
  (r.data || []).forEach(function (p) {
    (p.status === 'granted' ? granted : declined).push(p.permission);
  });
  const missing = Object.keys(META_NEED).filter(function (k) {
    return granted.indexOf(k) === -1;
  });
  return { ok: true, granted: granted, declined: declined, missing: missing,
           why: META_NEED };
}

/* ═══════════ interest names to ids ═══════════
   The audience library is written in names — "Luxury Watches", "HDFC
   Bank" — because a name can be read and checked and an id copied by hand
   cannot. Meta will turn a whole list into ids in one call, and says which
   it did not recognise, which is the part worth showing somebody.

   The answers are stable, so they are cached: a project with thirteen
   audiences and five hundred names otherwise re-asks on every deploy. */
/* Meta: "Select an Instagram account or Facebook Page to represent your
   business on Instagram." The creative runs on Instagram placements, and
   an Instagram placement needs something to post AS. The Page alone is
   not enough once the creative names instagram_positions.

   Every Page can have one: either a real Instagram business account
   connected to it, or a page-backed one, which Meta makes from the Page
   itself and which is what an advertiser without an Instagram account
   is meant to use. Both are looked for, and the page-backed one is
   created if neither exists. The answer is cached — it does not change
   between deploys, and it is two calls every time if it is not. */
/* A city or a region is a Google geo target id on this side, and Meta has
   never heard of those — they were being dropped, so "city level targeting
   is not being taken". Meta has its own list and its own keys, and this
   turns a name into one. Cached: the key for Pune does not change. */
function metaGeoKeys_(labels, only) {
  const want = (labels || []).map(function (x) { return String(x || '').trim(); })
    .filter(Boolean);
  if (!want.length) return { ok: true, found: [], missing: [] };

  const types = only ? [only] : ['city', 'region', 'country', 'zip'];
  const found = [], missing = [];
  const cache = CacheService.getScriptCache();
  const key = function (n) { return 'geo-' + (only || 'any') + '-' + n.toLowerCase().slice(0, 180); };

  want.forEach(function (label) {
    const hit = cache.get(key(label));
    if (hit === '-') { missing.push(label); return; }
    if (hit) { try { found.push(JSON.parse(hit)); return; } catch (e) {} }

    /* the first part is the place; "Pune, Maharashtra, India" searches
       far better as "Pune" and Meta returns it with its own region */
    const q = label.split(',')[0].trim() || label;
    const r = metaCall_('search?type=adgeolocation&location_types=' +
      encodeURIComponent(JSON.stringify(types)) +
      '&limit=10&q=' + encodeURIComponent(q), {}, 'get');
    if (r.error) return { error: r.error };
    const hits = (r.data || []).filter(function (d) { return d && d.key && d.type; });
    if (!hits.length) { cache.put(key(label), '-', 21600); missing.push(label); return; }
    /* prefer one whose country the label also mentions, so "Hyderabad,
       India" does not land on Hyderabad, Pakistan */
    const low = label.toLowerCase();
    const best = hits.filter(function (d) {
      return d.country_name && low.indexOf(String(d.country_name).toLowerCase()) > -1;
    })[0] || hits[0];
    const one = { type: best.type, key: String(best.key),
                  name: best.name || label, country: best.country_code || '' };
    cache.put(key(label), JSON.stringify(one), 21600);
    found.push(one);
  });
  return { ok: true, found: found, missing: missing };
}

/* Meta groups geography by type, each under its own plural. */
function metaGeoBuckets_(found) {
  const geo = {};
  const put = function (k, v) { (geo[k] = geo[k] || []).push(v); };
  (found || []).forEach(function (g) {
    if (g.type === 'city')         put('cities', { key: g.key, distance_unit: 'kilometer' });
    else if (g.type === 'region')  put('regions', { key: g.key });
    else if (g.type === 'country') (geo.countries = geo.countries || []).push(g.key);
    else if (g.type === 'zip')     put('zips', { key: g.key });
    else if (g.type === 'subcity') put('geo_markets', { key: g.key });
  });
  return geo;
}

/* Meta: "(#190) This method must be called with a Page Access Token."
   Everything else here runs on the System User token, but a Page's own
   edges will not take it. The page token is asked for with the System
   User token - which is allowed - and used for the calls that need it. */
function metaPageToken_(pageId) {
  const cache = CacheService.getScriptCache(), key = 'pt-' + pageId;
  const hit = cache.get(key);
  if (hit) return hit;
  const r = metaCall_(pageId + '?fields=access_token', {}, 'get');
  if (r.error || !r.access_token) return '';
  cache.put(key, String(r.access_token), 3000);
  return String(r.access_token);
}

function metaInstagram_(pageId) {
  const id = String(pageId || '').trim();
  if (!id) return { error: 'No Facebook page is set.' };
  const cache = CacheService.getScriptCache(), key = 'ig-' + id;
  const hit = cache.get(key);
  if (hit) return { ok: true, id: hit, from: 'cache' };

  /* a real Instagram account connected to the Page */
  const linked = metaCall_(id + '?fields=instagram_business_account', {}, 'get');
  if (!linked.error && linked.instagram_business_account && linked.instagram_business_account.id) {
    const got = String(linked.instagram_business_account.id);
    cache.put(key, got, 21600);
    return { ok: true, id: got, from: 'connected' };
  }

  const pt = metaPageToken_(id);
  const asPage = pt ? { access_token: pt } : {};

  /* one Meta makes from the Page itself */
  const backed = metaCall_(id + '/page_backed_instagram_accounts', asPage, 'get');
  if (!backed.error && backed.data && backed.data.length && backed.data[0].id) {
    const got = String(backed.data[0].id);
    cache.put(key, got, 21600);
    return { ok: true, id: got, from: 'page-backed' };
  }

  const made = metaCall_(id + '/page_backed_instagram_accounts', asPage);
  if (!made.error && made.id) {
    cache.put(key, String(made.id), 21600);
    return { ok: true, id: String(made.id), from: 'created' };
  }
  const why = made.error || backed.error || linked.error ||
    'the page has no Instagram account and one could not be made for it';
  return { error: /#190|Page Access Token/i.test(String(why)) && !pt
    ? 'the page access token could not be read with the System User token \u2014 ' +
      'give the System User a role on the page in Business Settings'
    : why };
}

/* The sheet writes a disambiguator after the name - "Property investing
   (investing)", "BMW (vehicles)". That is the sheet telling a human which
   BMW it means; it is not part of Meta's name, and an exact-match lookup
   on it fails. Fifty-four of a hundred and seven Vehicles interests came
   back unknown for this reason alone, and they were names like BMW and
   Mercedes-Benz, which Meta plainly has. */
const metaBareName_ = n => String(n || '').replace(/\s*\([^()]*\)\s*$/, '').trim();

/* Meta's exact-match endpoint answers yes or no and nothing else. When it
   says no, this asks the ordinary interest search, which matches the way
   Ads Manager's own box does, and takes the top hit when it is the same
   name. That is the difference between "Luxury Watches: unknown" and the
   interest Ads Manager finds for the same words. */
function metaInterestSearch_(name) {
  const r = metaCall_('search?type=adinterest&limit=8&q=' +
    encodeURIComponent(name), {}, 'get');
  if (r.error) return null;
  const want = name.toLowerCase();
  const hits = (r.data || []).filter(function (d) { return d && d.id && d.name; });
  if (!hits.length) return null;
  const exact = hits.filter(function (d) { return String(d.name).toLowerCase() === want; })[0];
  if (exact) return { id: String(exact.id), name: String(exact.name) };
  /* not an exact match: take the top hit only when it is the same WORDS
     with more after them. A letter-by-letter prefix is not enough -
     "Banks" must not quietly become "Banksy". */
  const top = hits[0];
  if (metaSameWords_(want, String(top.name).toLowerCase()))
    return { id: String(top.id), name: String(top.name) };
  return null;
}

/* one is the other plus whole words, not plus letters */
function metaSameWords_(a, b) {
  if (a === b) return true;
  const longer = a.length > b.length ? a : b;
  const shorter = a.length > b.length ? b : a;
  return longer.indexOf(shorter) === 0 && /[^a-z0-9]/.test(longer.charAt(shorter.length));
}

/* A job title is not an interest, and neither is an employer. Searching
   the interest list for "Founder" or "Godrej Properties Limited" finds
   nothing, which is why the JobTitles audience came back with nineteen
   unknowns. These are their own targeting categories. */
function metaCategory_(name, cls) {
  const r = metaCall_('search?type=adTargetingCategory&class=' + encodeURIComponent(cls) +
    '&limit=8&q=' + encodeURIComponent(name), {}, 'get');
  if (r.error) return null;
  const want = name.toLowerCase();
  const hits = (r.data || []).filter(function (d) { return d && d.id && d.name; });
  if (!hits.length) return null;
  const exact = hits.filter(function (d) { return String(d.name).toLowerCase() === want; })[0];
  const pick = exact || hits[0];
  if (!exact && !metaSameWords_(want, String(pick.name).toLowerCase())) return null;
  return { id: String(pick.id), name: String(pick.name) };
}

function metaInterests_(names) {
  const want = (names || []).map(function (n) { return String(n || '').trim(); })
    .filter(Boolean);
  if (!want.length) return { ok: true, found: [], missing: [] };

  const found = [], missing = [], ask = [];
  const cache = CacheService.getScriptCache();
  const key = function (n) { return 'int-' + n.toLowerCase().slice(0, 180); };

  var hits = {};
  try { hits = cache.getAll(want.map(key)) || {}; } catch (e) {}
  want.forEach(function (n) {
    const hit = hits[key(n)];
    if (hit === undefined) { ask.push(n); return; }
    if (hit === '-') missing.push(n);
    else found.push({ id: hit, name: n });
  });

  /* Meta takes the list in one go and answers for each entry. Chunked
     because the URL is a GET and a list of five hundred will not fit.
     The bare name is what is asked about - the sheet's "(investing)" is
     for the reader, not for Meta. */
  const bareOf = {};
  ask.forEach(function (n) { bareOf[n] = metaBareName_(n) || n; });
  const stillOut = [];

  for (var i = 0; i < ask.length; i += 40) {
    const chunk = ask.slice(i, i + 40);
    const bare = chunk.map(function (n) { return bareOf[n]; });
    const r = metaCall_('search?type=adinterestvalid&interest_list=' +
      encodeURIComponent(JSON.stringify(bare)), {}, 'get');
    if (r.error) return { error: r.error, found: found, missing: missing.concat(ask.slice(i)) };
    const byBare = {};
    (r.data || []).forEach(function (d) {
      if (d && d.valid && d.id) byBare[String(d.name || '').toLowerCase()] = String(d.id);
    });
    const put = {};
    chunk.forEach(function (n) {
      const id = byBare[bareOf[n].toLowerCase()];
      if (id) { found.push({ id: id, name: n }); put[key(n)] = id; }
      else stillOut.push(n);
    });
    try { cache.putAll(put, 21600); } catch (e) {}
  }

  /* Anything the exact list refused gets one search each, the way a person
     would type it into Ads Manager. Capped, because this is one call per
     name and five hundred names would take the request past its time. */
  const CAP = 120;
  const put2 = {};
  stillOut.forEach(function (n, idx) {
    if (idx >= CAP) { missing.push(n); return; }
    const hit = metaInterestSearch_(bareOf[n]);
    if (hit) { found.push({ id: hit.id, name: n }); put2[key(n)] = hit.id; }
    else { missing.push(n); put2[key(n)] = '-'; }
  });
  try { cache.putAll(put2, 21600); } catch (e) {}
  return { ok: true, found: found, missing: missing };
}

/* Job titles and employers, which are not interests at all. An audience
   says which it holds; anything it does not claim is looked up as an
   interest, as before. */
function metaTargetingByKind_(names, kind) {
  const want = (names || []).map(function (n) { return String(n || '').trim(); }).filter(Boolean);
  if (!want.length) return { ok: true, found: [], missing: [] };
  const cls = kind === 'employers' ? 'work_employer' : 'work_position';
  const field = kind === 'employers' ? 'work_employers' : 'work_positions';
  const cache = CacheService.getScriptCache();
  const key = function (n) { return cls + '-' + n.toLowerCase().slice(0, 180); };
  const found = [], missing = [], put = {};
  want.forEach(function (n) {
    const bare = metaBareName_(n) || n;
    const hit = cache.get(key(n));
    if (hit === '-') { missing.push(n); return; }
    if (hit) { found.push({ id: hit, name: n }); return; }
    const got = metaCategory_(bare, cls);
    if (got) { found.push({ id: got.id, name: n }); put[key(n)] = got.id; }
    else { missing.push(n); put[key(n)] = '-'; }
  });
  try { cache.putAll(put, 21600); } catch (e) {}
  return { ok: true, found: found, missing: missing, field: field };
}

function metaAssets_() {
  const out = { accounts: [], pages: [], notes: [] };

  const ac = metaCall_('me/adaccounts?fields=name,account_id,account_status,currency' +
                       '&limit=200', {}, 'get');
  if (ac.error) out.notes.push('Ad accounts: ' + ac.error);
  else (ac.data || []).forEach(function (a) {
    out.accounts.push({ id: String(a.account_id || '').replace(/^act_/, ''),
                        name: a.name || '(unnamed)',
                        active: a.account_status === 1,
                        currency: a.currency || '' });
  });

  /* The Page token that comes back here is what makes the form list and
     the lead-gen check readable at all, so it is asked for once and used
     straight away rather than fetched again per Page. */
  const pg = metaCall_('me/accounts?fields=name,id,access_token&limit=200', {}, 'get');
  if (pg.error) out.notes.push('Pages: ' + pg.error);
  else (pg.data || []).forEach(function (p) {
    out.pages.push({ id: String(p.id), name: p.name || '(unnamed)',
                     hasToken: !!p.access_token });
  });

  out.accounts.sort(function (x, y) { return x.name.localeCompare(y.name); });
  out.pages.sort(function (x, y) { return x.name.localeCompare(y.name); });
  return out;
}

/* The Instant Forms on one Page. Listing them needs the Page's own token,
   which is why this is a second call rather than part of the first. */
function metaForms_(pageId) {
  const id = String(pageId || '').trim();
  if (!id) return { error: 'No Page chosen.' };

  var token = '';
  const pg = metaCall_(id + '?fields=access_token', {}, 'get');
  if (!pg.error && pg.access_token) token = pg.access_token;

  const path = id + '/leadgen_forms?fields=id,name,status,leadgen_export_csv_url' +
               '&limit=200' + (token ? '&access_token=' + encodeURIComponent(token) : '');
  const r = metaCall_(path, {}, 'get');
  if (r.error) return { error: r.error, needsPageToken: !token };
  const forms = (r.data || []).map(function (f) {
    return { id: String(f.id), name: f.name || '(unnamed)', status: f.status || '' };
  });
  /* an archived form takes an ad set but never shows, so the live ones
     are offered first rather than mixed in by name */
  forms.sort(function (a, b) {
    const live = function (x) { return x.status === 'ACTIVE' ? 0 : 1; };
    return live(a) - live(b) || a.name.localeCompare(b.name);
  });
  return { ok: true, forms: forms, viaPageToken: !!token };
}

function metaRoute(body, v) {
  const a = String(body.action || '');
  if (a === 'meta-assets') {
    if (!metaToken_()) return { error: 'No META_TOKEN in the Apps Script.' };
    return Object.assign({ ok: true }, metaAssets_());
  }
  if (a === 'meta-forms') {
    if (!metaToken_()) return { error: 'No META_TOKEN in the Apps Script.' };
    return metaForms_(body.pageId);
  }
  if (a === 'meta-check') {
    const base = { ok: true, ready: !!metaToken_(), version: metaVersion_(),
                   backendBuild: BACKEND_BUILD };
    if (!base.ready) return base;
    try { base.look = metaLook_(body.settings); }
    catch (e) { base.look = { error: String(e) }; }
    try { base.perms = metaPerms_(); }
    catch (e) { base.perms = { error: String(e) }; }
    return base;
  }
  if (!metaToken_()) return { error:
    'No META_TOKEN in the Apps Script. Business Settings → System Users → ' +
    'Generate token with ads_management, then Project Settings → Script ' +
    'Properties → META_TOKEN. It is never put in the repository.' };
  if (a === 'meta-validate') return metaRun(body, v, true);
  if (a === 'meta-deploy')   return metaRun(body, v, false);
  return null;
}

/* ---------------- the plan ---------------- */

const metaClean_ = function (x, max) {
  return (x == null ? '' : String(x)).replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s{2,}/g, ' ').trim().slice(0, max || 200);
};
/* Meta counts money in the minor unit, so rupees arrive as paise. */
function metaMinor_(n) {
  const x = Math.round(Number(n) * 100);
  return isFinite(x) && x > 0 ? String(x) : '';
}

/* Built as a plain object first, with no network anywhere near it, so the
   whole structure can be checked before anything is sent. */
function metaPlan(body) {
  const b = body.brief || {}, s = body.settings || {};
  const notes = [];

  const proj = metaClean_(b.proj, 80);
  if (!proj) return { error: 'No project name.' };
  const place = metaClean_(b.micro || b.city, 60);

  /* The deck names things Project_Location_LeadGen, and the ad set carries
     the same with the objective spelled out. */
  /* The campaign is called after the CRM enquiry, because that is the name
     the lead comes back under and the two have to be matched by hand
     otherwise. Underscores are out: they were an artefact of joining the
     parts together and nobody wanted them. */
  /* The naming convention, from the bug report: the campaign is the FULL
     enquiry name, then Leadgen, then the date it was built — which is how
     two launches of the same enquiry are told apart in Ads Manager. The
     ad set leads with the audience, because the audience is what is being
     compared when ad sets are read side by side, and the enquiry follows
     it. */
  const enquiry = metaClean_(b.enquiry, 80).replace(/_+/g, ' ').replace(/\s{2,}/g, ' ').trim();
  const today = (function () {
    const d = new Date();
    const pad = function (n) { return (n < 10 ? '0' : '') + n; };
    return pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + String(d.getFullYear()).slice(2);
  })();
  const base = enquiry || [proj, place].filter(Boolean).join(' ') || 'Lead Generation';
  const campaignName = metaClean_(base + ' - Leadgen - ' + today, 100);
  const adsetName = base;

  /* A pincode is a pincode. It was being sent as a 5 km circle around the
     pincode's centre, which targets whatever falls in that circle and
     misses the parts of the pincode outside it - not what "target these
     pincodes" means. Meta has postal codes of its own, so the pincode is
     looked up there and sent as one. Only a pin dropped on the map is a
     radius, because a radius is what it is. */
  const radii = (body.targets || []).filter(function (t) {
    return t && t.kind === 'radius' &&
           isFinite(Number(t.lat)) && isFinite(Number(t.lng)) &&
           (Number(t.lat) || Number(t.lng));
  }).map(function (t) {
    return {
      latitude: Number(t.lat), longitude: Number(t.lng),
      radius: Math.max(1, Math.min(80, Number(t.radius) || 7)),
      distance_unit: 'kilometer'
    };
  });

  const pinCodes = (body.targets || []).filter(function (t) {
    return t && t.kind === 'pin' && String(t.pin || '').trim();
  }).map(function (t) { return String(t.pin).trim(); });

  /* A city or region is a Google id here and means nothing to Meta, so it
     was being dropped without a word. Its name is looked up in Meta's own
     list instead. */
  const cityLabels = (body.targets || []).filter(function (t) {
    return t && t.kind === 'geo' && String(t.label || '').trim();
  }).map(function (t) { return String(t.label).trim(); });
  /* The pincodes go through the same lookup, as postal codes. A pincode
     Meta has never heard of falls back to a circle around it, which is
     better than dropping it, and says so. */
  var zipFound = [], zipMissing = [];
  if (pinCodes.length) {
    const zl = metaGeoKeys_(pinCodes, 'zip');
    if (zl.error) return { error: 'Meta could not be asked about the pincodes: ' + zl.error };
    zipFound = zl.found; zipMissing = zl.missing;
    if (zipMissing.length) {
      notes.push('Meta has no postal code for ' + zipMissing.join(', ') +
        ', so ' + (zipMissing.length === 1 ? 'it is' : 'they are') + ' targeted as a 5 km circle instead.');
      (body.targets || []).forEach(function (t) {
        if (t && t.kind === 'pin' && zipMissing.indexOf(String(t.pin || '').trim()) > -1 &&
            (Number(t.lat) || Number(t.lng)))
          radii.push({ latitude: Number(t.lat), longitude: Number(t.lng),
                       radius: 5, distance_unit: 'kilometer' });
      });
    }
  }

  var places = { found: [], missing: [] };
  if (cityLabels.length) {
    const look = metaGeoKeys_(cityLabels);
    if (look.error) return { error: 'Meta could not be asked about the locations: ' + look.error };
    places = look;
    if (places.missing.length)
      notes.push('Meta does not recognise ' + places.missing.length + ' location' +
        (places.missing.length === 1 ? '' : 's') + ': ' + places.missing.join(', ') +
        '. Drop a pin for ' + (places.missing.length === 1 ? 'it' : 'them') + ' instead.');
  }
  const buckets = metaGeoBuckets_(places.found.concat(zipFound));
  const anyPlace = Object.keys(buckets).length > 0;

  /* Meta has no concept of an ad set that runs everywhere: with no
     geo_locations it is refused outright. Catching it here says which tab
     to go to, instead of a Graph error after the campaign already exists. */
  if (!radii.length && !anyPlace)
    return { error: 'No location is set. Add a pin, a pincode or a city on the ' +
                    'Targeting tab — Meta refuses an ad set with no geography.' };
  {
    const bits = [];
    if (radii.length) bits.push(radii.length + ' radius pin' + (radii.length === 1 ? '' : 's'));
    if (zipFound.length) bits.push(zipFound.length + ' pincode' + (zipFound.length === 1 ? '' : 's'));
    if (places.found.length) bits.push(places.found.map(function (g) { return g.name; }).join(', '));
    if (bits.length) notes.push('Targeting ' + bits.join(' and ') + '.');
  }

  const excl = (s.excludeAudiences || []).map(function (x) { return String(x).trim(); })
    .filter(Boolean).map(function (id) { return { id: id }; });
  if (!excl.length) notes.push('No broker list is being excluded. The deck says to exclude Broker Data and All Location Broker Data.');

  /* One audience, built from the tab's own settings overlaid with whatever
     this particular one names. An audience that says nothing is the tab's
     settings exactly, which is how a project with no audiences at all still
     produces the single ad set it always did. */
  function buildTargeting(a) {
    a = a || {};
    const t = {
      /* pins and pincodes as points, cities and regions as Meta's own
         keys, and both together when both are set */
      geo_locations: (function () {
        const g = {};
        if (radii.length) g.custom_locations = radii;
        for (var k in buckets) if (Object.prototype.hasOwnProperty.call(buckets, k)) g[k] = buckets[k];
        if (!Object.keys(g).length) return undefined;
        g.location_types = ['home'];                              /* residents */
        return g;
      })(),
      age_min: Number(a.ageMin) || Number(s.ageMin) || META_AGE_MIN,
      age_max: Number(a.ageMax) || Number(s.ageMax) || META_AGE_MAX,
      /* all genders, per the deck. That is the ABSENCE of the field — an
         empty genders array is not "everyone", it is a list naming nobody. */
      publisher_platforms: ['facebook', 'instagram'],
      facebook_positions: ['feed', 'story', 'facebook_reels'],
      instagram_positions: ['stream', 'story', 'reels'],
      targeting_automation: {
        advantage_audience: (a.advantageAudience !== undefined
          ? a.advantageAudience : s.advantageAudience) ? 1 : 0 }
    };
    /* 1 is male and 2 is female to Meta; both, or neither, is the field
       left out rather than a list naming everyone */
    const g = (a.genders || []).map(Number).filter(function (x) { return x === 1 || x === 2; });
    if (g.length === 1) t.genders = g;

    const ex = (a.exclude && a.exclude.length ? a.exclude : (s.excludeAudiences || []))
      .map(function (x) { return String(x).trim(); }).filter(Boolean)
      .map(function (id) { return { id: id }; });
    if (ex.length) t.excluded_custom_audiences = ex;

    const inc = (a.include || []).map(function (x) { return String(x).trim(); })
      .filter(Boolean).map(function (id) { return { id: id }; });
    if (inc.length) t.custom_audiences = inc;

    var ints = ((a.interests && a.interests.length) ? a.interests : (s.interests || []))
      .filter(Boolean)
      .map(function (i) { return { id: String(i.id), name: metaClean_(i.name, 60) }; });
    var extra = null;
    /* an audience written in names — which is how the library is written */
    if (!ints.length && a.interestNames) {
      const list = String(a.interestNames).split(',')
        .map(function (x) { return x.trim(); }).filter(Boolean);
      /* An audience says what its list holds. JobTitles holds job titles,
         which are not interests - searching the interest list for
         "Founder" finds nothing, which is why nineteen of them came back
         unknown. */
      const kind = String(a.kind || 'interests');
      const look = kind === 'interests'
        ? metaInterests_(list)
        : metaTargetingByKind_(list, kind);
      if (look.error) notes.push('Audience \u201c' + (a.name || '?') +
        '\u201d: could not look up its ' + kind + ' \u2014 ' + look.error);
      else {
        const got = look.found.map(function (f) { return { id: f.id, name: f.name }; });
        if (kind === 'interests') ints = got;
        else if (got.length) extra = { field: look.field, list: got };
        /* The report called the old wording clutter, and it was: thirteen
           full-width blocks naming every miss. One line, a count, and the
           first few, and the panel folds the rest away. */
        if (look.missing.length) notes.push('MISS\u001f' + (a.name || '?') + '\u001f' +
          look.missing.length + '\u001f' + list.length + '\u001f' + look.missing.join(', '));
      }
    }
    if (ints.length) t.flexible_spec = [{ interests: ints }];
    if (extra) t[extra.field] = extra.list;
    return t;
  }

  const targeting = buildTargeting(null);

  const budget = metaMinor_(s.dailyBudget);
  if (!budget) return { error: 'Set a daily budget.' };
  const pageId = String(s.pageId || '').trim();
  if (!pageId) return { error: 'Set the Facebook Page id.' };
  const formId = String(s.formId || '').trim();
  if (!formId) return { error: 'Set the Instant Form id — this is a lead form campaign.' };

  const campaign = {
    name: campaignName,
    objective: 'OUTCOME_LEADS',
    status: 'PAUSED',
    buying_type: 'AUCTION',
    /* The budget sits on the ad set, not the campaign. Meta refuses to
       assume what that means and asks to be told in so many words: false
       keeps each ad set on its own budget, which is the deck's setup.
       Leaving it out is a 400, not a default. */
    is_adset_budget_sharing_enabled: false,
    /* Housing and finance declarations differ by country and are the
       advertiser's call, so this is never guessed — it is passed through
       exactly as chosen on the tab. */
    special_ad_categories: (s.specialCategories || [])
  };

  /* One ad set per audience. An audience is what Meta splits on and what
     a report is read by, so two of them in one ad set is one number where
     two were wanted. The budget is per ad set, so an audience may carry
     its own; the tab's figure is what the rest use. */
  const audiences = (s.audiences || []).filter(function (a) { return a && a.name; });
  const specs = audiences.length ? audiences : [null];

  const adsets = specs.map(function (a, i) {
    const nm = a ? metaClean_(a.name, 60) : '';
    const one = {
      /* audience first, then the enquiry */
      name: metaClean_(nm ? (nm + ' - ' + adsetName) : adsetName, 100),
      status: 'PAUSED',
      billing_event: 'IMPRESSIONS',
      optimization_goal: 'LEAD_GENERATION',
      destination_type: 'ON_AD',                     /* Instant Forms */
      promoted_object: { page_id: pageId },
      daily_budget: (a && metaMinor_(a.dailyBudget)) || budget,
      /* The budget is here, so the bid strategy has to be here too. Without
         it Meta falls through to asking for a bid cap or a ROAS floor and
         rejects the ad set. Highest volume for the money is the deck's
         setup — no cap, no target cost. */
      bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
      targeting: buildTargeting(a),
      is_dynamic_creative: false
    };
    if (s.startTime) one.start_time = String(s.startTime);
    one._audience = nm || '(the tab\u2019s settings)';
    return one;
  });
  /* kept so anything reading a single ad set still does */
  const adset = adsets[0];

  /* One ad per creative image. The Creative studio already renders the
     shapes Meta wants, so the square goes to feeds and the story to
     stories and reels. */
  const ads = (body.creatives || []).slice(0, 10).map(function (c, i) {
    return {
      /* The ad was named after the hero image's FILE, so Ads Manager
         showed "riverfront high rise oasis z0dx 1400w (1 - Developers
         Dev". A file name is not an ad name. The enquiry leads, and what
         follows is the name typed in the Creative studio when there was
         one, or the ad's number when there was not. */
      name: metaClean_(base + ' - ' + (metaClean_(c.label, 60) || ('Ad ' + (i + 1))), 100),
      /* one ad per hero: its shapes go to the placements they were drawn
         for. `image` is the single-image fallback, kept for anything that
         still sends one. */
      shapes: c.images || null,
      image: c.data || (c.images && (c.images.square || c.images.portrait || c.images.story)) || '',
      primary: metaClean_(c.primary || (body.copy || {}).primary, 1000),
      headline: metaClean_(c.headline || (body.copy || {}).headline, 40),
      description: metaClean_(c.description || (body.copy || {}).description, 30),
      cta: String(s.cta || 'LEARN_MORE').toUpperCase().replace(/[^A-Z_]/g, '')
    };
  });
  if (!ads.length) notes.push('No creative was sent, so the campaign and ad set are made but no ad is.');
  ads.forEach(function (a, i) {
    if (!a.headline) notes.push('Ad ' + (i + 1) + ' has no headline.');
    if (!a.primary)  notes.push('Ad ' + (i + 1) + ' has no primary text.');
  });

  /* ═══ the rules Meta enforces, checked before anything is sent ═══

     Every one of these was found the same way: a deploy that half-built a
     campaign, failed on the next call, rolled back, and reported a Graph
     error naming none of the fields the person could see. They cost an
     evening each. They are cheap to check here and they never reach Meta
     again.

     A rule only belongs in this list once Meta has actually refused
     something for it, with the wording it used. Guessing at rules would
     block deploys that would have worked. */
  const link = metaClean_(body.link || s.link || '', 400);
  const stop = [];

  if (!link)
    stop.push('No landing page URL. A lead ad has to link to external content — ' +
      'Meta refuses one that points at a Facebook Page — so set the landing page ' +
      'on the Brief, or publish one on step 02.');
  else if (!/^https?:\/\//i.test(link))
    stop.push('The landing page URL has to start with http:// or https:// — got "' +
      link.slice(0, 60) + '".');
  else if (/(^|\/\/)(www\.)?(facebook|fb)\.(com|me)\b/i.test(link))
    stop.push('The landing page points at Facebook. Meta refuses a lead ad whose ' +
      'creative links to a Page rather than to the advertiser’s own site.');

  if (Number(s.ageMin) && Number(s.ageMin) < 18)
    stop.push('The minimum age is ' + s.ageMin + '. Meta does not allow under 18.');
  if (Number(s.ageMin) && Number(s.ageMax) && Number(s.ageMin) > Number(s.ageMax))
    stop.push('The age range runs backwards: ' + s.ageMin + ' to ' + s.ageMax + '.');

  (s.audiences || []).forEach(function (a) {
    if (a && a.dailyBudget !== undefined && !metaMinor_(a.dailyBudget))
      stop.push('Audience “' + (a.name || '?') + '” has a daily budget of ' +
        a.dailyBudget + ', which is not a number Meta will take.');
  });

  if (stop.length)
    return { error: stop[0], blocked: stop,
             note: 'Nothing was sent to Meta — these are checked here first.' };

  if (audiences.length) {
    const seen = {};
    audiences.forEach(function (a) {
      const k = metaClean_(a.name, 60).toLowerCase();
      if (seen[k]) notes.push('Two audiences are both called \u201c' + a.name +
        '\u201d \u2014 their ad sets will be hard to tell apart in reporting.');
      seen[k] = 1;
    });
    notes.push(audiences.length + ' audiences, so ' + audiences.length +
      ' ad sets, each with its own budget and ' + ads.length + ' ad' +
      (ads.length === 1 ? '' : 's') + '.');
  }

  if (metaProp_('META_ASSET_FEED', '') !== '1' && ads.length)
    notes.push('One ad per hero image, carrying the 4:5. Meta crops it for stories and reels — ' +
      'a per-placement image is its asset feed, which this objective does not support.');

  /* Instagram has to be posted AS something. If the Page has no account
     and none can be made, Instagram is dropped rather than the deploy —
     a Facebook-only campaign is worth far more than a 400. */
  var igId = '';
  const ig = metaInstagram_(pageId);
  if (ig.ok) { igId = ig.id; if (ig.from === 'created')
    notes.push('Meta had no Instagram account for this page, so a page-backed one was made from the page itself.'); }
  else {
    notes.push('Instagram was left out: ' + ig.error + ' The campaign runs on Facebook only.');
    [adset].concat(adsets).forEach(function (a) {
      if (!a || !a.targeting) return;
      a.targeting.publisher_platforms = ['facebook'];
      delete a.targeting.instagram_positions;
    });
  }

  return {
    ok: true, campaign: campaign, adset: adset, adsets: adsets, ads: ads, link: link,
    pageId: pageId, formId: formId, igId: igId, notes: notes,
    accountId: String(s.accountId || '').replace(/^act_/, '')
  };
}

/* ---------------- the calls ---------------- */

function metaCall_(path, payload, method) {
  const verb = (method || 'post').toLowerCase();
  var url = 'https://graph.facebook.com/' + metaVersion_() + '/' + path;
  const form = { access_token: metaToken_() };
  for (var k in payload) if (Object.prototype.hasOwnProperty.call(payload, k)) {
    const v2 = payload[k];
    form[k] = (v2 !== null && typeof v2 === 'object') ? JSON.stringify(v2) : String(v2);
  }

  /* A GET carries nothing in a body — a payload there is dropped, and the
     call goes out with no token at all and comes back as "an access token
     is required", which reads like a dead token rather than a wrong verb.
     So for GET and DELETE the parameters go in the query string, after
     whatever is already in the path. */
  const opts = { method: verb, muteHttpExceptions: true };
  if (verb === 'get' || verb === 'delete') {
    const parts = [];
    for (var q in form) if (Object.prototype.hasOwnProperty.call(form, q))
      parts.push(encodeURIComponent(q) + '=' + encodeURIComponent(form[q]));
    url += (url.indexOf('?') === -1 ? '?' : '&') + parts.join('&');
  } else {
    opts.payload = form;
  }

  var res;
  try {
    res = UrlFetchApp.fetch(url, opts);
  } catch (err) { return { error: 'Could not reach Meta: ' + err }; }

  const code = res.getResponseCode(), text = res.getContentText();
  var b = {};
  try { b = JSON.parse(text); } catch (e) {
    return { error: 'Meta returned something that is not JSON: ' + text.slice(0, 300) };
  }
  if (code !== 200 || b.error) {
    const e = b.error || {};
    var msg = e.error_user_msg || e.message || text.slice(0, 300);
    if (/Unsupported.*version|Unknown version/i.test(msg))
      msg += ' — bump META_API_VERSION in Script Properties.';
    if (/(^|\W)190(\W|$)/.test(String(e.code)) || /token/i.test(msg))
      msg += ' — the System User token may have been revoked.';
    return { error: 'Meta ' + code + ': ' + msg, _code: e.code, _sub: e.error_subcode };
  }
  return b;
}

/* A deploy that stops halfway leaves a real campaign sitting in the
   account. Left alone it is invisible work for whoever notices it next,
   and the run after this one makes a second copy beside it. Deleting the
   campaign takes its ad sets and ads with it. Uploaded images are left
   where they are: they cost nothing, and another ad may share the hash. */
/* Creatives are built before the campaign now, so a failure there has
   creatives to clear up and no campaign. They serve nothing on their own
   and cost nothing, but leaving them behind fills the library with the
   wreckage of every failed attempt. */
function metaUndoCreatives_(built) {
  if (!built || !built.length) return '';
  var gone = 0;
  built.forEach(function (b) {
    const r = metaCall_(String(b.id), {}, 'delete');
    if (!r.error) gone++;
  });
  return gone === built.length
    ? ' No campaign was created, and the creatives built so far were removed.'
    : ' No campaign was created. ' + (built.length - gone) +
      ' unused creative(s) were left in the library.';
}

function metaUndo_(made) {
  if (!made || !made.campaign || made.campaign === '(validated)') return '';
  const d = metaCall_(String(made.campaign), {}, 'delete');
  if (d.error)
    return ' A campaign was created before this failed and could not be removed (' +
           d.error + '). Delete ' + made.campaign + ' in Ads Manager before trying again.';
  return ' The half-built campaign was deleted, so nothing was left behind.';
}

/* One creative body, used by the deploy and by the dry run, so what the
   check approves is what the deploy sends. Two copies of this drifted
   apart once already. */
/* Which shape belongs on which placement. The 4:5 is what a feed wants
   and the 9:16 is what a story wants; the square is the fallback for
   anything that has neither. */
const META_PLACEMENTS = [
  { label: 'feed', shapes: ['portrait', 'square'],
    spec: { publisher_platforms: ['facebook', 'instagram'],
            facebook_positions: ['feed'], instagram_positions: ['stream'] } },
  { label: 'vertical', shapes: ['story'],
    spec: { publisher_platforms: ['facebook', 'instagram'],
            facebook_positions: ['story', 'facebook_reels'],
            instagram_positions: ['story', 'reels'] } }
];

/* One ad carrying every shape, instead of one ad per shape.

   This is Meta's asset feed, and Meta counts it as DYNAMIC CREATIVE:
   "The campaign objective is not currently supported by dynamic
   creative." A lead ad that opens an instant form — OUTCOME_LEADS with
   destination_type ON_AD, which is every campaign this tool builds — is
   one of the objectives it does not support. There is no shape of this
   request that gets round that; it is the objective, not the request.

   So it is off. One ad per hero still happens, and it carries ONE image:
   the 4:5, which Meta crops itself for stories and reels. That is what
   an advertiser does by hand for a lead ad, and it is the same single ad
   per hero either way.

   META_ASSET_FEED=1 turns it back on, for the day Meta supports it or
   for a campaign built with another objective. */
function metaCreativeMulti_(plan, ad, hashes) {
  if (metaProp_('META_ASSET_FEED', '') !== '1') return null;
  const images = [], rules = [];
  META_PLACEMENTS.forEach(function (p) {
    const shape = p.shapes.filter(function (sn) { return hashes[sn]; })[0];
    if (!shape) return;
    images.push({ hash: hashes[shape], adlabels: [{ name: p.label }] });
    rules.push({
      customization_spec: p.spec,
      image_label: { name: p.label },
      body_label: { name: 'body' },
      title_label: { name: 'title' },
      description_label: { name: 'desc' },
      link_url_label: { name: 'url' }
    });
  });
  /* one shape only, or none that mapped: the plain single-image creative
     does the job and is far less to get wrong */
  if (images.length < 2) return null;

  /* Meta: "The language asset feed must include a default rule in the asset
     customisation rules." Every rule above names placements, so a placement
     Meta adds later — or one it decides to deliver on anyway — matches no
     rule and the whole feed is refused. The last rule is the catch-all: it
     names no placement, takes the feed shape, and is flagged the default. */
  /* Meta, second time of asking: "Default asset customisation rule (with
     lowest priority) with empty customisation_spec is required." An age
     band is not empty — the spec has to be {} outright, and the rule has
     to be last, which is what makes it the lowest priority. */
  rules.push({
    customization_spec: {},
    is_default: true,
    image_label: { name: META_PLACEMENTS[0].label },
    body_label: { name: 'body' },
    title_label: { name: 'title' },
    description_label: { name: 'desc' },
    link_url_label: { name: 'url' }
  });

  return {
    name: ad.name,
    /* an Instagram placement has to post AS something; the Page alone is
       what Meta refuses with "Select an Instagram account or Facebook
       Page to represent your business on Instagram" */
    object_story_spec: plan.igId
      ? { page_id: plan.pageId, instagram_user_id: plan.igId }
      : { page_id: plan.pageId },
    asset_feed_spec: {
      images: images,
      bodies:       [{ text: ad.primary,     adlabels: [{ name: 'body'  }] }],
      titles:       [{ text: ad.headline,    adlabels: [{ name: 'title' }] }],
      descriptions: [{ text: ad.description, adlabels: [{ name: 'desc'  }] }],
      link_urls:    [{ website_url: plan.link, adlabels: [{ name: 'url' }] }],
      call_to_action_types: [ad.cta || 'LEARN_MORE'],
      ad_formats: ['SINGLE_IMAGE'],
      asset_customization_rules: rules
    }
  };
}

function metaCreative_(plan, ad, hash) {
  const c = {
    name: ad.name,
    object_story_spec: {
      page_id: plan.pageId,
      instagram_user_id: plan.igId || undefined,
      link_data: {
        image_hash: hash,
        /* Meta: "Lead Generation ads should always link to external content
           (e.g. an advertiser's website), but this ad does not (e.g. it
           links to a Facebook Page)." A Page URL here is exactly what it
           refuses, which is what used to be here. */
        link: plan.link,
        message: ad.primary,
        name: ad.headline,
        description: ad.description,
        call_to_action: {
          type: ad.cta || 'LEARN_MORE',
          value: { lead_gen_form_id: plan.formId }
        }
      }
    }
  };
  /* Meta has retired standard_enhancements — sending it is now a 400,
     "Including standard enhancements field in creative has been
     deprecated. Please choose to set individual features instead."

     The individual features that replaced it are a list Meta edits
     whenever it likes, and naming one that has moved is the same 400
     again. So nothing was sent, and the account's own setting decided -
     which meant Meta rewrote the copy and touched up the artwork:
     "the text enhancements ruining my ads and making them look ugly".

     These are the named ones that change what was written or drawn. They
     are opted out by default now. If Meta retires one of these names the
     creative is refused, and that refusal now happens before the
     campaign exists, so it costs a message rather than a rollback.
     META_CREATIVE_OPTOUT replaces the list outright; META_CREATIVE_KEEP
     set to 1 sends none of it and leaves the account to decide. */
  const OPTOUT_DEFAULT = [
    'text_generation',        /* writes its own primary text */
    'text_optimizations',     /* moves the copy between the fields */
    'image_templates',        /* drops the artwork into a frame of its own */
    'image_touchups',         /* crops, brightens, relights the render */
    'image_brightness_and_contrast',
    'enhance_cta',            /* rewrites the button and the headline */
    'description_automation',
    'adapt_to_placement',
    'media_liquidity_animated_image'
  ];
  const named = metaProp_('META_CREATIVE_OPTOUT', '')
    .split(',').map(function (x) { return x.trim(); }).filter(Boolean);
  const optOut = metaProp_('META_CREATIVE_KEEP', '') === '1' ? []
    : (named.length ? named : OPTOUT_DEFAULT);
  if (optOut.length) {
    const feats = {};
    optOut.forEach(function (f) { feats[f] = { enroll_status: 'OPT_OUT' }; });
    c.degrees_of_freedom_spec = { creative_features_spec: feats };
  }
  return c;
}

function metaRun(body, v, validateOnly) {
  const plan = metaPlan(body);
  if (plan.error) return plan;
  if (!plan.accountId) return { error: 'Set the ad account id.' };
  const act = 'act_' + plan.accountId;
  const made = { campaign: null, adset: null, ads: [], images: [] };

  const opts = validateOnly ? { execution_options: ['validate_only'] } : {};
  const withOpts = function (o) {
    const out = {};
    for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) out[k] = o[k];
    for (var k2 in opts) out[k2] = opts[k2];
    return out;
  };

  /* 0. the images and the creatives, before anything exists.

     Three nights running a deploy built a campaign, then an ad set, and
     then fell over on the creative — and each time the campaign had to
     be rolled back and the whole thing started over. The creative is the
     part Meta argues with and it was being built last.

     It is built first now. A creative is an account-level object: it
     belongs to no campaign, serves nothing on its own, and the ads that
     follow point at it. So if Meta is going to refuse one, it refuses it
     here, with no campaign to undo. Nothing extra is sent — this is the
     same upload and the same creative that used to happen further down,
     moved in front of the campaign. */
  const BUILT = [];
  if (!validateOnly) {
    for (var ci = 0; ci < plan.ads.length; ci++) {
      const cad = plan.ads[ci];
      if (!cad.image) { plan.notes.push('Ad ' + (ci + 1) + ' had no image and was skipped.'); continue; }

      /* One image per hero, not one per shape. The asset feed that used
         all of them is dynamic creative, which this objective does not
         support, so the other two would be uploads nothing can use. The
         4:5 is the one to keep: Meta crops it for stories and reels, and
         it is the shape the feeds want. */
      const hashes = {};
      const all = cad.shapes && Object.keys(cad.shapes).length
        ? cad.shapes : { square: cad.image };
      var shapes = all;
      if (metaProp_('META_ASSET_FEED', '') !== '1') {
        const best = ['portrait', 'square', 'story'].filter(function (k) { return all[k]; })[0];
        shapes = {}; if (best) shapes[best] = all[best];
      }
      for (var sn in shapes) {
        if (!shapes[sn]) continue;
        const up = metaCall_(act + '/adimages', { bytes: shapes[sn] });
        if (up.error) return { error: 'Image (' + sn + ') for ad ' + (ci + 1) + ': ' +
          up.error + metaUndoCreatives_(BUILT), plan: plan, made: made };
        var h = '';
        const imgs = up.images || {};
        for (var key in imgs) if (imgs[key] && imgs[key].hash) { h = imgs[key].hash; break; }
        if (!h) return { error: 'Meta accepted the ' + sn + ' image for ad ' + (ci + 1) +
          ' but returned no hash.' + metaUndoCreatives_(BUILT), plan: plan, made: made };
        hashes[sn] = h;
        made.images.push(h);
      }
      const hash = hashes.portrait || hashes.square || hashes.story;
      if (!hash) return { error: 'Ad ' + (ci + 1) + ' had no usable image.' +
        metaUndoCreatives_(BUILT), plan: plan, made: made };

      const cr = metaCall_(act + '/adcreatives',
        metaCreativeMulti_(plan, cad, hashes) || metaCreative_(plan, cad, hash));
      if (cr.error) return { error: 'Creative for ad ' + (ci + 1) + ': ' + cr.error +
        metaUndoCreatives_(BUILT) +
        ' No campaign was created \u2014 the creative is built before the campaign now.',
        plan: plan, made: made };
      BUILT.push({ ad: cad, id: cr.id, index: ci });
    }
  }

  /* 1. campaign */
  const c = metaCall_(act + '/campaigns', withOpts(plan.campaign));
  if (c.error) return { error: 'Campaign: ' + c.error, plan: plan, made: made };
  made.campaign = validateOnly ? '(validated)' : c.id;

  /* 2. ad set. On a validate pass there is no campaign id to point at, so
     the ad set is checked on its own merits with the campaign left out —
     Meta refuses an ad set with no parent, which would be a false failure. */
  const PLAN_SETS = plan.adsets && plan.adsets.length ? plan.adsets : [plan.adset];
  const stripInternal = function (o) {
    const out = {};
    for (var k2 in o) if (k2.charAt(0) !== '_') out[k2] = o[k2];
    return out;
  };

  if (validateOnly) {
    /* Every audience gets its own ad set, and any one of them can be the
       one Meta refuses — a bad interest id, a budget under the floor. All
       of them are checked, not just the first, or a dry run passes and the
       deploy stops halfway through. */
    for (var si = 0; si < PLAN_SETS.length; si++) {
      const probe = metaCall_(act + '/adsets', withOpts(stripInternal(PLAN_SETS[si])));
      const which = PLAN_SETS.length > 1
        ? 'Ad set \u201c' + (PLAN_SETS[si]._audience || (si + 1)) + '\u201d: ' : 'Ad set: ';
    /* The ONLY error to forgive here is the missing parent, because there
       is no campaign id to give on a dry run.

       This has been wrong in both directions. Forgiving anything that
       mentioned "campaign" swallowed a real rejection ending "...your
       account and campaign objective", so the check went green and the
       deploy then failed with a campaign already created. Forgiving only
       "campaign_id" then rejected Meta's other way of saying the same
       thing — "Choose a campaign to create this ad set." — and called a
       dry run a failure.

       So it is a list of the exact ways Meta reports a missing parent,
       and nothing else is forgiven. A phrasing not on this list shows up
       as a failure, which is the safe direction to be wrong in. */
    const PARENT_MISSING = [
      /\bcampaign_id\b/i,
      /choose a campaign to create this ad\s?set/i,
      /missing\s+(?:required\s+)?(?:parameter\s+)?campaign\b/i
    ];
      const msg = probe.error || '';
      const parentOnly = PARENT_MISSING.some(function (re) { return re.test(msg); });
      if (probe.error && !parentOnly)
        return { error: which + probe.error, plan: plan, made: made };
      if (probe.error && si === 0) plan.notes.push(
        'The ad set could only be checked without its campaign, so anything ' +
        'that depends on the parent is still unchecked.');
    }
    made.adset = '(validated)';
    made.adsets = PLAN_SETS.map(function () { return '(validated)'; });

    /* The creative and the ad were never checked, so "validated" meant the
       campaign and the ad sets only — and the deploy then failed on the
       creative, having already built a campaign. Everything the deploy
       will create is checked here, with validate_only, so nothing is made.

       The image is the one thing that cannot be dry-run: a creative needs
       a hash, and a hash comes from an upload. Uploading one is harmless —
       it is an asset in the library, costs nothing and serves nothing —
       so the FIRST image goes up and the creative is checked against it.
       The rest are left alone. */
    if (plan.ads.length) {
      const ad0 = plan.ads[0];
      if (!ad0.image) {
        plan.notes.push('The creative could not be checked: ad 1 has no image yet.');
      } else {
        const up = metaCall_(act + '/adimages', { bytes: ad0.image });
        if (up.error) return { error: 'Image for ad 1: ' + up.error, plan: plan, made: made };
        var h0 = '';
        const im0 = up.images || {};
        for (var ik in im0) if (im0[ik] && im0[ik].hash) { h0 = im0[ik].hash; break; }
        if (!h0) {
          plan.notes.push('Meta took the image but returned no hash, so the creative is unchecked.');
        } else {
          const probe = metaCall_(act + '/adcreatives',
            withOpts(metaCreativeMulti_(plan, ad0, { square: h0, portrait: h0, story: h0 })
              || metaCreative_(plan, ad0, h0)));
          if (probe.error)
            return { error: 'Creative: ' + probe.error, plan: plan, made: made };
          made.creative = '(validated)';
          plan.notes.push('The creative was checked too, against a real uploaded image.');
        }
      }
    }

    return { ok: true, validated: true, plan: plan, made: made, notes: plan.notes };
  }

  /* 2b. the real ad sets, one per audience */
  made.adsets = [];
  for (var sj = 0; sj < PLAN_SETS.length; sj++) {
    const body = stripInternal(PLAN_SETS[sj]);
    body.campaign_id = made.campaign;
    const r = metaCall_(act + '/adsets', body);
    const label = PLAN_SETS.length > 1
      ? 'Ad set \u201c' + (PLAN_SETS[sj]._audience || (sj + 1)) + '\u201d: ' : 'Ad set: ';
    if (r.error) return { error: label + r.error + metaUndo_(made), plan: plan, made: made };
    made.adsets.push({ id: r.id, audience: PLAN_SETS[sj]._audience || '' });
  }
  made.adset = made.adsets[0] && made.adsets[0].id;

  /* 3. the ads, pointing at the creatives that already exist */
  for (var i = 0; i < BUILT.length; i++) {
    const ad = BUILT[i].ad, cr = { id: BUILT[i].id }, n = BUILT[i].index + 1;

    /* The creative is an account-level object, so the same one is put under
       every ad set rather than uploaded and built again per audience. The
       ad carries the audience in its name, because in reporting the ad name
       is often all there is to tell two of them apart. */
    for (var sk = 0; sk < made.adsets.length; sk++) {
      const into = made.adsets[sk];
      const adName = into.audience ? (ad.name + ' \u2013 ' + into.audience) : ad.name;
      const a2 = metaCall_(act + '/ads', {
        name: adName, adset_id: into.id, creative: { creative_id: cr.id }, status: 'PAUSED'
      });
      if (a2.error) return { error: 'Ad ' + n +
        (into.audience ? ' in \u201c' + into.audience + '\u201d' : '') + ': ' +
        a2.error + metaUndo_(made), plan: plan, made: made };
      made.ads.push({ id: a2.id, name: adName, adset: into.id, audience: into.audience });
    }
  }

  try {
    if (v && v.ok && typeof write === 'function')
      write([new Date(), v.email, v.name, typeof role === 'function' ? role(v.email) : '',
             'meta-deploy', act + ' / ' + plan.campaign.name,
             'campaign ' + made.campaign + ' \u00b7 ' + made.ads.length + ' ads']);
  } catch (e) {}

  return { ok: true, made: made, plan: plan, notes: plan.notes };
}
