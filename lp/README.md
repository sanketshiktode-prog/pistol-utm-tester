# PropertyPistol Landing Page Builder

This repo builds real-estate project landing pages in minutes. Its structure mirrors the PropertyPistol microsite template (see `docs/ANALYSIS.md`), and every page sends leads to your own database and CRM.

```
index.html            ← the Builder app (host on GitHub Pages)
builder/              ← builder logic, page template, sample project
admin/index.html      ← Leads Console (view, filter, CSV export, re-push to CRM)
vendor/jszip.min.js   ← ZIP export
php-connector/        ← Universal Lead Connector for cPanel/PHP hosting (source of api/lead.php)
worker/               ← Lead API for GitHub Pages hosting: Cloudflare Worker + D1 + CRM push + OTP
docs/                 ← CRM-INTEGRATION-GUIDE.md (any CRM), page analysis, Google Sheet script
scripts/              ← build-php-bundle.js (run after editing php-connector)
```

---

## 1. Put the builder on GitHub (5 min)

1. Create a repo (for example `lp-builder`) and upload everything **except** the `worker/` folder. Including it is harmless.
2. Go to **Settings → Pages → Deploy from a branch → `main` / root**.
3. Open `https://<you>.github.io/lp-builder/` for the builder, or `…/lp-builder/admin/` for the Leads Console.

Projects auto-save in your browser (IndexedDB). Use **Save .json** to back up a project or share it with a colleague, and **Import** to load one.

## 2. Where leads go — pick per project in the builder (Leads, OTP & CRM)

**cPanel / PHP hosting (easiest):** the exported ZIP already contains `api/lead.php` + `api/config.php`.
Upload → Extract → fill the `PASTE_…` keys in `api/config.php` → open `/api/lead.php?health=1`.
Presets: TeleCRM, LeadSquared, Sell.Do, HubSpot, Salesforce Web-to-Lead, Zapier/Make webhook, Google Sheet, Custom.
Any other CRM: **docs/CRM-INTEGRATION-GUIDE.md**. Every lead is also saved to `api/logs/leads-YYYY-MM.csv`.

**GitHub Pages + Cloudflare Worker:** deploy the Worker below once; the ZIP includes `cloudflare-crm-settings.txt` with the exact CRM variables.

### Deploy the Cloudflare Worker (one time, about 10 min)

### Option A: Cloudflare dashboard (no terminal)
1. Go to **Storage & Databases → D1 → Create** and name it `pp-leads`. Open **Console**, paste the contents of `worker/schema.sql`, and run it.
2. Go to **Workers & Pages → Create → Worker**, name it `pp-leads`, then **Edit code** and replace everything with `worker/src/index.js`. Deploy.
3. Open the Worker's **Settings → Bindings → Add → D1 database**. Set the variable name to `DB` and choose `pp-leads`.
4. Under **Settings → Variables and Secrets**, add:
   | Name | Type | Example |
   |---|---|---|
   | `ADMIN_TOKEN` | Secret | a long random string (used by the Leads Console) |
   | `ALLOWED_ORIGINS` | Text | `https://godrejforestestatenagpur.com,https://*.github.io` (or `*`) |
   | `CRM_URL` | Secret | your CRM's lead-create endpoint |
   | `CRM_HEADERS` | Secret | `{"Authorization":"Bearer xxxx"}` |
   | `CRM_FIELD_MAP` | Text | see below |
5. Under **Settings → Triggers → Cron**, add `*/15 * * * *`. This automatically retries failed CRM pushes.
6. Copy the Worker URL (`https://pp-leads.<account>.workers.dev`) into the builder under **Leads, OTP & CRM → Lead API URL**.

### Option B: wrangler (for the dev who deploys)
```bash
cd worker && npm i
npx wrangler d1 create pp-leads        # paste database_id into wrangler.toml
npm run db:init                        # creates tables
npx wrangler secret put ADMIN_TOKEN
npx wrangler secret put CRM_URL        # + CRM_HEADERS, SMS_URL … as needed
npm run deploy
```

## 3. CRM integration

The Worker stores every lead first. It then pushes the lead to your CRM without blocking the visitor. Failed pushes are retried up to 5 times: by the cron, by **Retry failed** in the console, or one lead at a time with ↻.

| Variable | Purpose |
|---|---|
| `CRM_URL` | Endpoint. Leave empty to only store leads. |
| `CRM_METHOD` | `POST` (default), `PUT`, or `GET` |
| `CRM_FORMAT` | `json` (default), `form` (x-www-form-urlencoded), or `query` |
| `CRM_HEADERS` | JSON of headers (auth keys) |
| `CRM_FIELD_MAP` | JSON template that maps CRM field names to `{{lead_field}}`. If empty, the whole lead is sent. |
| `CRM_STATIC` | JSON of constant fields merged into every payload (for example `{"source_id":"42"}`) |
| `CRM_SUCCESS_MATCH` | Text/regex the response must contain to count as success (for CRMs that return 200 on errors) |
| `CRM_ROUTES` | Per-project override: `{"project_code":{"url":"…","headers":{…},"map":{…}}}` |
| `CRM_PUSH_DUPLICATES` | `false` (default). A repeat submission from the same phone for the same project within `DEDUPE_HOURS` is stored but not pushed. |
| `SHEET_WEBHOOK_URL` | Optional. Mirrors every lead into a Google Sheet (`docs/google-sheet-apps-script.js`). |

**Example `CRM_FIELD_MAP`:**
```json
{"name":"{{name}}","mobile":"{{phone}}","country_code":"{{country_code}}","email":"{{email}}",
 "project":"{{project_name}}","project_code":"{{project_code}}","source":"{{source}}",
 "campaign":"{{utm_campaign}}","keyword":"{{utm_term}}","gclid":"{{gclid}}","remarks":"{{form_source}}",
 "enquired_at":"{{created_at_ist}}"}
```
**Fields you can use:** `name first_name last_name phone country_code full_phone phone_with_cc email config form_source project_code project_name developer location utm_source utm_medium utm_campaign utm_term utm_content gclid gbraid wbraid fbclid msclkid keyword matchtype network adgroup placement landing_url page_url referrer country city is_mobile is_duplicate otp_verified source created_at created_at_ist id`

`source` resolves to `utm_source`. If there is no UTM, it falls back to google (when there is a gclid), then facebook (when there is an fbclid), then direct.

## 4. OTP (optional)
Tick **OTP verification** in the builder and set these secrets on the Worker. Any HTTP SMS gateway works (MSG91, 2Factor, Exotel, Gupshup, and others):

| Variable | Example |
|---|---|
| `SMS_URL` | `https://2factor.in/API/V1/<KEY>/SMS/{phone}/{otp}/<TEMPLATE>` |
| `SMS_METHOD` | `GET` (default) or `POST` |
| `SMS_BODY` | For POST: `{"mobiles":"{ccphone}","otp":"{otp}"}` |
| `SMS_HEADERS` | `{"authkey":"xxx"}` |

**Placeholders:** `{phone} {cc} {ccphone} {otp} {name} {project}`.

The lead is saved **before** the OTP step, so an abandoned OTP doesn't lose the lead. It stays `awaiting_otp` in the console so you can call it. If the SMS gateway fails, the lead goes straight to the CRM as unverified.

## 5. Build a page

1. In the builder, click **+ New**, or **Load Sample** to see the full example.
2. Fill in each panel: Basics → Branding (logo, favicon) → Hero images → Pricing → Plans → Amenities → Gallery → Location → Contact → Leads → Tracking.
   - The **Bulk paste** buttons take whole lists at once (pricing as `Type | Size | Price`, connectivity as `Place: distance`, amenities as one per line).
   - **Upload multiple** turns a folder of amenity or gallery photos into rows. Captions come from the file names.
   - **✨ Auto-generate** writes FAQs from your project data.
   - Watch **Launch readiness** for anything missing.
3. Click **Export ZIP for GitHub**. You get `index.html`, `thank-you.html`, `privacy-policy.html`, `assets/`, `CNAME` (if you set a domain), `robots.txt`, `sitemap.xml`, and `project.lpb.json`.
4. Create a new repo, upload the ZIP **contents**, and turn on Pages. For a custom domain, point a DNS CNAME at `<you>.github.io`.

### Conversion tracking
- **Google Ads:** set *Google Ads ID* + *Conversion label*. The conversion fires on `thank-you.html` with the lead ID as `transaction_id`.
- **GTM:** use the trigger *Custom Event `lead_submit`*, or the page view of `/thank-you.html`. The `dataLayer` also receives `lp_modal_open` (with `lp_context`), `lp_click_call`, and `lp_click_whatsapp`.
- **Meta:** `fbq('track','Lead')` fires on submit.

## 6. Leads Console
Open `admin/`, enter the Worker URL and `ADMIN_TOKEN`, and click Connect. It shows KPIs, breakdowns by project, source, form and day, search and filters (dates in IST), a CSV export, ↻ re-push to CRM, and delete.

## Security notes
- Keep `ADMIN_TOKEN` secret. Anyone with it can read leads.
- Set `ALLOWED_ORIGINS` to your real domains once you go live.
- Spam protection: per-IP rate limit (`RATE_LIMIT_PER_10MIN`, default 8), a honeypot field, and server-side phone and email validation.
