# How to connect landing pages to any CRM

Every landing page sends its leads to a small **connector** on your server. The connector reads the CRM keys, adds tracking data and forwards each lead to one or more CRMs.

```
Visitor fills form ──► api/lead.php (cPanel)  ──► CRM #1 (TeleCRM / LSQ / Sell.Do / …)
                   or pp-leads Worker (Cloudflare) ├► CRM #2 / Google Sheet / Zapier (optional)
                                                   └► api/logs/leads-YYYY-MM.csv (every lead + each CRM's reply)
```

The connector keeps the CRM token on the server. It never goes into the page, where anyone could read it and push junk into (or overwrite leads in) the client's CRM. The connector also adds what a browser can't know, such as the visitor's IP address and city.

---

## 1. The fast path: CRMs that already have a preset

In the builder, open **Leads, OTP & CRM**. Set **Hosting** to cPanel, pick the CRM, then click **Export ZIP**. On the server, fill in the `PASTE_…` values in `api/config.php`.

| Preset | Get this from the client |
|---|---|
| TeleCRM | Enterprise ID and **Async** access token |
| LeadSquared | API host (for example `api-in21.leadsquared.com`), Access Key and Secret Key |
| Sell.Do | api_key and campaign SRD |
| HubSpot Forms | Portal ID and Form GUID (create a form that contains the fields) |
| Salesforce Web-to-Lead | Org ID (oid) |
| Webhook (Zapier / Make / Pabbly / n8n) | Webhook URL. Use this for **any CRM with no simple API** (Zoho, Dynamics, Freshsales, Pipedrive and similar); the mapping happens inside Zapier or Make. |
| Google Sheet | Apps Script web-app URL (`docs/google-sheet-apps-script.js`) |
| Custom | See section 2 |

---

## 2. Any other CRM: answer these 6 questions from its API docs

Open the CRM's "create lead" API page (sometimes called "Lead capture", "Add lead" or "Webhook") and write down:

1. **Endpoint URL.** Does it contain an account or workspace ID?
2. **Auth.** Which of these does it use?
   - `Authorization: Bearer <token>`
   - An API key in a header (for example `x-api-key: …`)
   - A key inside the URL (`?accessKey=…`)
   - A key inside the body
   - None (form-style endpoints)
3. **Body format.** Is it JSON, form (`a=1&b=2`) or URL query? What is its shape? The usual shapes are:
   - Flat: `{"name":..,"phone":..}`
   - Nested: `{"fields":{..}}`
   - A list of pairs: `[{"Attribute":"FirstName","Value":".."}]`
4. **Field names.** List the exact API names, including case. Custom fields usually **must already exist** in the CRM; most CRMs silently drop unknown ones.
5. **Phone format.** Common options are `919876543210`, `+919876543210`, `+91-9876543210`, or a separate country code plus `9876543210`.
6. **What "success" looks like.** Is a 200 status enough? Or must the reply contain a word, like `"Success"` or `"QUEUED"`? Also note what happens when the same phone number submits twice (update or duplicate).

Then write one **destination** block in `api/config.php`:

```json
{
  "name": "My CRM",
  "enabled": true,
  "url": "https://api.mycrm.com/v1/leads",
  "method": "POST",
  "format": "json",
  "headers": { "Authorization": "Bearer PASTE_TOKEN" },
  "body": {
    "full_name": "{{name}}",
    "mobile": "{{phone_with_cc}}",
    "email": "{{email}}",
    "lead_source": "{{source}}",
    "utm_campaign": "{{campaign}}",
    "remarks": "{{summary}}"
  },
  "success": "",
  "drop_empty": true
}
```

| Key | Meaning |
|---|---|
| `url` | Endpoint. `{{variables}}` are allowed here too. |
| `method` | `POST` (most CRMs), `PUT` or `GET` |
| `format` | `json`; `form` (x-www-form-urlencoded, where nested objects become `a[b][c]=`, as used by Sell.Do and PHP-style CRMs); or `query` (values appended to the URL) |
| `headers` | Any headers, including the auth header |
| `body` | Template in the CRM's shape. Values are filled from the variables in section 4. `"__ALL__"` sends every variable as flat JSON. |
| `success` | Optional word the reply must contain. Leave it empty if a 2xx status is enough. |
| `drop_empty` | `true` (recommended) removes empty values, so an update never blanks data the CRM already has. It also removes `{"Attribute":..,"Value":""}` pairs whose value is empty. |
| `enabled` | Set to `false` to switch this destination off without deleting it |

**Multiple CRMs:** add more blocks to `destinations`, for example the client's CRM plus PropertyPistol's CRM plus a Sheet. Every lead goes to all enabled destinations.

**Turning a curl example from the CRM docs into a block:**
```
curl -X POST "https://next-api.telecrm.in/enterprise/{enterpriseId}/autoupdatelead" \
  -H "Authorization: Bearer YOUR_ASYNC_TOKEN" -H "Content-Type: application/json" \
  -d '{"fields":{"name":"Jane Doe","phone":"919999999999"}}'
```
Each part of the curl command maps to one key:
- the URL → `url`
- each `-H` → `headers` (skip Content-Type; the connector sets it)
- the `-d` JSON → `body`, with sample values replaced by variables (`"Jane Doe"` becomes `{{name}}`, `"919999999999"` becomes `{{phone_with_cc}}`)

---

## 3. Check and test (always, before ads go live)
1. Open `https://domain/api/lead.php?health=1`. Every destination should show `"ready": true`. The `missing` list names any `PASTE_…` value you haven't filled in yet.
2. Open the page with a test URL:
   `https://domain/?utm_source=google&utm_medium=search&utm_campaign=test&utm_adgroup=test_ag&utm_term=test+kw&strategy=test&matchtype=e&network=g&device=m&gclid=TEST123`
3. Submit the form with a real number, then check the CRM.
4. Open `api/logs/leads-YYYY-MM.csv` (File Manager). The `crm_results` column shows each CRM's reply.

| Reply in the CSV | Meaning | Fix |
|---|---|---|
| `ok 200` but the lead is missing in the CRM | Queued but rejected later, or a field name is wrong | Check the field API names and type (TeleCRM and LSQ drop unknown fields). Check the phone format. |
| `FAILED 401` / `403` | Wrong key, or the wrong token type | Re-copy the key. For TeleCRM, use an **Async** token, not a Sync one. |
| `FAILED 400` / `422` | Body shape or a field value is wrong | Compare the body against the CRM's example request |
| `FAILED 404` | Wrong URL or account ID | Check the region host and the enterprise/portal ID |
| `FAILED 200 (reply had no "…")` | Reached the CRM, but it didn't say success | Read the reply text. It usually names the bad field. |
| `not_configured` | `PASTE_…` values are still in the config | Fill them in |
| `FAILED 0 ERR …` | The server couldn't reach the CRM | Hosting firewall or an outbound block; ask the host to allow outbound HTTPS |
| Form shows "Something went wrong" | `api/lead.php` is unreachable (404/500) | Check that the `api` folder was uploaded and that PHP 7.4+ with curl is on (cPanel → Select PHP Version) |

Dates: if a CRM needs a date field, use `{{epoch_ms}}` (TeleCRM), `{{created_at_iso}}` or `{{created_at_ist}}`, whichever format its docs specify.

---

## 4. Variables you can use in `url`, `headers` and `body`

| Variable | Example |
|---|---|
| `name` `first_name` `last_name` `last_name_or_name` | Rahul Kumar Sharma / Rahul / Kumar Sharma |
| `phone` `country_code` `phone_with_cc` `full_phone` | 9876543210 / 91 / 919876543210 / +919876543210 |
| `email` `config` | r@x.com / 2 BHK (if the "Interested in" dropdown is on) |
| `form_name` | enquire / sitevisit / brochure / popup / `costing:2 BHK 750 sq.ft.` |
| `project` `project_code` `developer` `project_location` | Satvam Hills Mulshi … |
| `source` `medium` | google / search (with automatic fallbacks from gclid, fbclid or the referrer) |
| `campaign` `ad_group` `ad` `keyword` `match_type` `strategy` | Names; they fall back to IDs when the names are empty |
| `network` `device` `placement` | google_search / mobile / youtube.com |
| `campaign_id` `ad_group_id` `ad_id` | Google IDs |
| `utm_source` `utm_medium` `utm_campaign` `utm_term` `utm_content` | Raw UTMs |
| `click_id` `click_id_type` | Whichever click ID arrived (gclid, gbraid, wbraid, fbclid or msclkid) and its name |
| `gclid` `gbraid` `wbraid` `fbclid` `msclkid` | The individual click IDs |
| `ip_address` `city` `region` `country` `visitor_location` | From the visitor's IP |
| `google_location_id` | Google `{loc_physical_ms}` |
| `landing_page` `referrer` `user_agent` | Full URLs |
| `lead_id` `created_at_ist` `created_at_iso` `epoch_ms` | Time and ID |
| `summary` | Multi-line text of all the tracking above. Good for a CRM "notes" or "remarks" field. |

The Cloudflare Worker (pp-leads) fills exactly the same variables, so one template works on both.

---

## 5. Hosting on GitHub Pages with the Cloudflare Worker instead of cPanel
Pick **GitHub Pages + Cloudflare Worker** in the builder. The ZIP then includes `cloudflare-crm-settings.txt`, which lists the exact Worker variables:

| config.php key | Worker variable |
|---|---|
| url | `CRM_URL` |
| method | `CRM_METHOD` |
| format | `CRM_FORMAT` |
| headers | `CRM_HEADERS` (JSON, set as a secret) |
| body | `CRM_FIELD_MAP` (JSON) |
| success | `CRM_SUCCESS_MATCH` |
| drop_empty | `CRM_DROP_EMPTY` |

For a different CRM per project on the same Worker, use `CRM_ROUTES`: `{"project_code": {"url": "...", "headers": {...}, "map": {...}}}`.

---

## 6. CRMs that need OAuth (Zoho CRM API, Salesforce REST, Dynamics)
These CRMs issue tokens that expire every hour, so a fixed key in the config won't keep working. Use one of these instead:
- the CRM's own **web-to-lead / webform** endpoint (the Salesforce Web-to-Lead preset, or a Zoho Webform URL with the `form` format)
- the **Webhook** preset → Zapier or Make, which handle OAuth for you
