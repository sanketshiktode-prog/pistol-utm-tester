# LP Builder: master guide
*PropertyPistol real-estate landing page system. Save this file together with `lp-builder.zip`.*

---

## 0. What you have

| File | What it is | Where it goes |
|---|---|---|
| `lp-builder.zip` | The builder app, the Leads Console, the PHP connector, the Cloudflare Worker and the docs | **GitHub** (once) |
| `<project>-site.zip` | One landing page exported from the builder | **cPanel** (one per project) |
| `docs/CRM-INTEGRATION-GUIDE.md` | How to connect any CRM | Reference |
| `docs/ANALYSIS.md` | Section-by-section breakdown of the reference page (godrejforestestatenagpur.com) | Reference |

**Rule of thumb:** the builder goes on GitHub. Each landing page goes on cPanel, because GitHub Pages can't run PHP, and the lead form needs PHP to send leads to the CRM.

---

## 1. One-time setup: put the builder on GitHub
1. Extract `lp-builder.zip`.
2. On GitHub, create a new repo (for example `lp-builder`) and upload **all** files and folders.
3. Go to **Settings → Pages → Deploy from a branch → `main` / `/ (root)`** and save.
4. After about a minute the builder opens at `https://<username>.github.io/lp-builder/`.

Notes:
- Projects auto-save in **your browser**. Use **Save .json** to back up a project or move it to another computer, and **Import** to load it back.
- **Load Sample** fills in a complete example (Godrej Rivershore) so you can see the structure.

---

## 2. Build a new landing page (10–15 min)
Open the builder and click **+ New**, then fill the panels on the left. The preview on the right updates live; switch between Desktop, Tablet and Mobile at the top.

| Panel | What to fill |
|---|---|
| **Project Basics** | Name, developer, location, badge ("New Launch"), starting price, offer strip, 3 key stats, 3–5 USPs, RERA number |
| **Branding** | Logo, favicon (square), primary and accent colours, font |
| **Hero Banner** | 2–4 landscape images (1920×1080). The first image is the most important. A video is optional. |
| **About** | Project description. A blank line starts a new paragraph. |
| **Area & Pricing** | Rows of Type \| Size \| Price. **Bulk paste** accepts one row per line. |
| **Master Plan & Floor Plans** | Upload the images and keep "blur until lead submits" ON. Blurred plans are a lead magnet. |
| **Amenities** | Use **Upload multiple**; names are taken from the file names. Or bulk paste the names. |
| **Gallery** | Use **Upload multiple** and pick a category for each image. |
| **Location** | Address, a Google Maps embed or a map image, and connectivity lines as "Place: distance" (bulk paste) |
| **Site Visit & FAQ** | Click **✨ Auto-generate** for FAQs (they also help SEO) |
| **Contact & Agent** | Call and WhatsApp numbers, agent name, RERA, GST, QR code |
| **Leads, OTP & CRM** | **Hosting = cPanel / PHP hosting**, **CRM = the client's CRM**, optional Google Sheet copy, project code, popup timing, **Mobile bottom bar = Enquire Now + Schedule Site Visit** |
| **Tracking & SEO** | GTM, GA4, Google Ads ID and conversion label, Meta Pixel, **custom domain**, SEO title and description |

Watch **Launch readiness** at the top left for anything missing. When done, click **Export ZIP**.

What every page includes automatically:
- Sticky header with a desktop side form.
- Hero card with price, a "Complete Costing" button on each price row, and blurred plans.
- Popup after N seconds, plus an exit-intent popup on desktop.
- Mobile bottom bar with Enquire and Site Visit buttons.
- Thank-you page, which fires the Google Ads conversion.
- Privacy page, sitemap, robots.txt and FAQ schema.
- Full capture of UTMs, gclid, gbraid, wbraid and fbclid.

---

## 3. Publish the landing page on cPanel
1. **First**, go to cPanel → **SSL/TLS Status → Run AutoSSL** for the domain. The page forces https, so SSL must already be active.
2. Go to cPanel → **File Manager → `public_html`** (or the domain's folder) → **Upload** the site ZIP → select it → **Extract**. Turn on Settings → *Show Hidden Files* so you can see `.htaccess`.
3. Right-click **`api/config.php` → Edit**. Replace every `PASTE_…` value with the client's CRM keys and save.
   - Keep the "double quotes", and put no comma after the last item.
4. Open `https://<domain>/api/lead.php?health=1`. Every destination should show `"ready": true`. If one doesn't, the `missing` list names the `PASTE_` values still to fill.
5. Run a test lead (section 6).

The page folder then looks like this:
```
index.html  thank-you.html  privacy-policy.html  assets/  .htaccess  robots.txt  sitemap.xml
api/lead.php     ← connector (don't edit)
api/config.php   ← CRM keys (the ONLY file you edit)
api/logs/        ← leads-YYYY-MM.csv backup of every lead + each CRM's reply (download from File Manager)
```
cPanel needs PHP 7.4 or newer with curl, which is the default almost everywhere. You can check under cPanel → Select PHP Version.

---

## 4. CRM setup

### Built-in presets: what to get from the client
| CRM | Needed |
|---|---|
| **TeleCRM** | Enterprise ID and an **Async** access token (a Sync token gives 401) |
| LeadSquared | API host (for example `api-in21.leadsquared.com`), Access Key and Secret Key |
| Sell.Do | api_key and campaign SRD (confirm the field names with Sell.Do) |
| HubSpot | Portal ID and Form GUID |
| Salesforce | Org ID (Web-to-Lead) |
| Zapier / Make / Pabbly / n8n | Webhook URL. Use this for Zoho, Freshsales, Pipedrive or anything with OAuth. |
| Google Sheet | Apps Script URL (`docs/google-sheet-apps-script.js`) |

### TeleCRM specifics
- **Custom fields:** the client must create these fields in TeleCRM with exactly these API names. TeleCRM silently drops unknown fields.
  `source, medium, campaign, ad_group, ad, keyword, match_type, strategy, network, device, placement, campaign_id, ad_group_id, ad_id, gclid, click_id_type, ip_address, location, google_location_id, landing_page, form_name, project`
- **Different names:** if the client's names differ, rename the **left side** of each field in `api/config.php`.
- **Timeline note (optional):** get a custom action code from the client (for example `ACTION_1001`). Then add this after `"fields": {...}` inside `body`:
  ```json
  "actions": [ { "type": "ACTION_1001", "fields": { "note": "{{summary}}" } } ]
  ```
- **Matching:** TeleCRM matches leads on phone number. If the same number comes in again, the existing lead is updated. Empty values are never sent, so existing data isn't wiped.

### Any other CRM
See `docs/CRM-INTEGRATION-GUIDE.md`. In short:
1. From the CRM's API docs, note six things: endpoint, auth, body format, field names, phone format, and what a success reply looks like.
2. Copy the **Custom** destination block in `config.php` and fill it in. `{{variables}}` insert lead data (for example `{{name}}`, `{{phone_with_cc}}`, `{{source}}`, `{{campaign}}`, `{{summary}}`).
3. To send one lead to more than one CRM, add more destination blocks.

---

## 5. Google Ads tracking (Search and Demand Gen)
Put these in **Campaign → Settings → Campaign URL options → Final URL suffix**.

**Search**
```
utm_source=google&utm_medium=search&utm_campaign={_campaign}&utm_adgroup={_adgroup}&utm_term={keyword}&utm_content={creative}&strategy={_strategy}&matchtype={matchtype}&network={network}&device={device}&campaignid={campaignid}&adgroupid={adgroupid}&creative={creative}&loc_physical={loc_physical_ms}&loc_interest={loc_interest_ms}
```
**Demand Gen**
```
utm_source=google&utm_medium=demandgen&utm_campaign={_campaign}&utm_adgroup={_adgroup}&utm_content={creative}&strategy={_strategy}&placement={placement}&network={network}&device={device}&campaignid={campaignid}&adgroupid={adgroupid}&creative={creative}&loc_physical={loc_physical_ms}
```
- **Custom parameters:** at campaign level set `_campaign` (for example `satvam_search_brand`) and `_strategy` (for example `max_conversions`). At ad group level set `_adgroup`. If one is left empty, the numeric ID is sent instead.
- **Tracking template instead of suffix:** use `{lpurl}?` followed by the same string.
- **Auto-tagging:** keep it ON. Google adds gclid, gbraid and wbraid itself, so don't add them manually.
- **Conversion tracking:** set the Google Ads ID and conversion label in the builder. The conversion fires on `thank-you.html`, and GTM receives a `lead_submit` event.
- **Captured automatically:** IP address and city/state (added by the server).

---

## 6. Test before spending (every new LP)
1. Open `https://<domain>/api/lead.php?health=1` and check that everything shows `ready: true`.
2. Open `https://<domain>/?utm_source=google&utm_medium=search&utm_campaign=test&utm_adgroup=test_ag&utm_term=test+kw&strategy=test&matchtype=e&network=g&device=m&gclid=TEST123`
3. Submit the form with a real number. The thank-you page should open.
4. Check the CRM: the lead should have all its fields filled.
5. Download `api/logs/leads-YYYY-MM.csv`. The `crm_results` column should show `ok 200`.
6. On mobile, check that both bottom buttons open the form.

| Problem | Fix |
|---|---|
| Form says "Something went wrong" | The `api` folder is missing or PHP is off. Re-upload and check the PHP version. |
| CSV shows `FAILED 401` | Wrong or expired key, or a TeleCRM Sync token was used (you need Async) |
| CSV shows `FAILED 400/422` | Field name or body format is wrong. Compare against the CRM's example request. |
| `ok 200` but the lead isn't in the CRM | Field API names don't match (the CRM drops them), or the phone format is wrong |
| `not_configured` | `PASTE_` values are still in `config.php` |
| Site shows an SSL error | Run AutoSSL. The `.htaccess` forces https. |
| Page didn't update after changes | Re-export from the builder, re-upload `index.html`, then hard refresh |

---

## 7. Alternative: GitHub Pages + Cloudflare Worker (no cPanel)
Choose **Hosting = GitHub Pages + Cloudflare Worker** in the builder.
1. Deploy `worker/` once using the Cloudflare dashboard. The steps are in the README: D1 database plus `schema.sql`, paste the Worker code, bind `DB`, add `ADMIN_TOKEN`.
2. The exported ZIP includes `cloudflare-crm-settings.txt`. Copy those values into the Worker's variables.
3. Put the Worker URL into the builder and export. Upload the ZIP to a GitHub repo with Pages turned on.
4. Leads Console (`/admin` on the builder site) shows every lead, lets you filter, export CSV and re-push to the CRM.

---

## 8. Projects done so far
- **Satvam Hills Mulshi** (Synergy Properties): `satvamhills.in` on cPanel with TeleCRM.
  - This LP uses the earlier TeleCRM-only connector. Its `api/config.php` has `ENTERPRISE_ID`, `TOKEN` and `NOTE_ACTION` fields.
  - It works as it is. To move it to the universal connector, import its `project.lpb.json` into the builder and re-export.

## 9. Changing the connector code (rarely needed)
The builder packs `php-connector/api/lead.php` into `builder/php-bundle.js`.
1. Edit `php-connector/api/lead.php`.
2. Run `node scripts/build-php-bundle.js`.
3. Commit both files.

---

## 10. Rebuild prompt
Save this. If you ever need to rebuild or extend the system in a new chat, attach `lp-builder.zip` (and a project's `.lpb.json` if relevant) and paste the prompt in `docs/REBUILD-PROMPT.md`.
