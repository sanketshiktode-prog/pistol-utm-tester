# Rebuild / continue prompt
Copy everything below the line into a new chat. **Attach `lp-builder.zip`** if you still have it. If you've lost it, the prompt is detailed enough to rebuild the system from scratch.

---

I'm Hemant, CBO at PropertyPistol (Indian real-estate brokerage). I use a system called **LP Builder**: a no-code builder for high-converting, responsive real-estate project landing pages, with lead capture and CRM integration. I work through GitHub's web editor and cPanel File Manager, not a terminal, so keep deployment steps dashboard-only. Talk to me in direct Hinglish, make decisions yourself, build directly, and give one consolidated output.

**If I attached `lp-builder.zip`:** extract it, read `docs/MASTER-GUIDE.md` and `docs/CRM-INTEGRATION-GUIDE.md`, and continue from that code. Keep the architecture and variable names. Test every change: render the pages with Playwright at desktop (1440) and mobile (390), and send a mock lead end to end. Then give me an updated ZIP.

**If nothing is attached, rebuild it to this spec:**

1. **Builder app** (static HTML/CSS/JS, no framework, hosted on GitHub Pages)
   - Left panel: accordion form. Right panel: live iframe preview with Desktop (1440), Tablet (820) and Mobile (390) views, scaled to fit.
   - Multiple projects saved in IndexedDB. Save and import project `.json` files. "Load Sample" button. A launch-readiness checklist.
   - Images are compressed to WebP in the browser. Favicon becomes a 192px PNG.
   - Bulk paste for pricing (`Type | Size | Price`), connectivity (`Place: distance`), amenities and USPs. Multi-upload for amenities and gallery, with captions taken from file names. Auto-generated FAQs.
   - **Export ZIP** (via JSZip) contains: `index.html`, `thank-you.html`, `privacy-policy.html`, `assets/`, `robots.txt`, `sitemap.xml`, `project.lpb.json`, and extra files depending on hosting:
     - **cPanel hosting:** `api/lead.php`, `api/config.php`, `api/.htaccess`, plus a root `.htaccess` that forces https and non-www when a domain is set.
     - **GitHub + Cloudflare hosting:** `CNAME` and `cloudflare-crm-settings.txt`.
   - Also a "single-file HTML" export.

2. **Landing page template.** Structure copied from the PropertyPistol microsite godrejforestestatenagpur.com:
   - Sticky header with scroll-spy nav, phone and Enquire button. A fixed 340px request-callback form on the right side on desktop.
   - Hero image slider or video, with a card showing: badge, name, location, developer, up to 3 stats, USPs, "Starts at ₹X Onwards", Enquire, Site Visit and Call buttons, and RERA numbers. Optional offer strip.
   - About section with "Read more". Area & Pricing cards, each with a "Complete Costing Details" CTA.
   - Master plan and unit plans shown **blurred until a lead is submitted**.
   - Amenities carousel. Gallery with category tabs and a lightbox. Location section with a map (gated image or Google embed) and a connectivity list.
   - Site-visit form section. FAQ with FAQPage schema. About-agent section with RERA and GST. Footer with QR code, RERA numbers, disclaimer and privacy link.
   - **Mobile bottom bar:** "Enquire Now" and "Schedule Site Visit" by default, both opening the same form; option for Call + Enquire + WhatsApp instead. Floating WhatsApp button on desktop.
   - **One context-aware modal** for all CTAs: enquire, brochure, sitevisit, costing, masterplan, unitplan, location, amenities, popup. The CTA name becomes `form_source`.
   - Auto popup after N seconds and an exit-intent popup, each once per session and never after the visitor has converted.
   - Form fields: name, country code (+91 and GCC codes) and mobile (Indian numbers validated as `[6-9]` plus 9 digits), optional email, honeypot field, consent text.
   - Capture **every** URL parameter into sessionStorage attribution. Clicks with ad parameters (utm, gclid, gbraid, wbraid, fbclid, campaignid, …) start a fresh attribution.
   - After submit: redirect to `thank-you.html`, which fires the Google Ads conversion with the lead ID as transaction_id. Push `dataLayer` `lead_submit`. Fire Meta `fbq Lead`. Add GTM, GA4 and Meta Pixel tags.
   - When the API URL ends in `.php`, POST to it directly.

3. **Universal Lead Connector** (`php-connector/api/lead.php`, for cPanel)
   - Validates input, applies a per-IP rate limit, and reads the visitor IP (CF-Connecting-IP, then X-Forwarded-For, then REMOTE_ADDR). Looks up city and state via ip-api.com.
   - Decodes ValueTrack values: `matchtype` e/p/b; `network` g/s/d/ytv/x; `device` m/t/c. Ignores unexpanded `{…}` placeholders.
   - Builds variables: name, first_name, last_name, phone, country_code, phone_with_cc, full_phone, email, form_name, project, source, medium, campaign, ad_group, ad, keyword, match_type, strategy, network, device, placement, campaign_id, ad_group_id, ad_id, click_id, click_id_type, ip_address, visitor_location, google_location_id, landing_page, referrer, epoch_ms, created_at_ist, summary.
     - Fallbacks: campaign and ad_group use the name, else the ID. source uses utm_source, else google (if gclid, gbraid or wbraid), else facebook (if fbclid), else the referrer host, else direct.
   - Sends each lead to **multiple destinations** defined in `config.php` (JSON inside a PHP nowdoc). Each destination has: url, method, format (json, form with `a[b][c]` flattening, or query), headers, body template using `{{var}}` (or `"__ALL__"`), a `success` text match, and `drop_empty`, which removes empty values and empty `{Attribute, Value}` pairs.
   - Retries up to 3 times on network errors and 5xx. Does not retry when the reply is 2xx but lacks the success text.
   - Writes a monthly CSV backup of every lead with each CRM's result, in `api/logs/`, blocked from the web via `.htaccess`.
   - `?health=1` shows each destination as ready, plus any missing `PASTE_` values.
   - Presets: TeleCRM, LeadSquared, Sell.Do, HubSpot Forms, Salesforce Web-to-Lead, Webhook (Zapier/Make), Google Sheet (Apps Script), and Custom.
     - TeleCRM: `POST https://next-api.telecrm.in/enterprise/{ENTERPRISE_ID}/autoupdatelead`, header `Authorization: Bearer <ASYNC token>`, body `{"fields":{...}}`, phone like `919876543210`, success text `QUEUED`. Optional `"actions":[{"type":"ACTION_xxxx","fields":{"note":"{{summary}}"}}]`.

4. **Cloudflare alternative** (`worker/`)
   - Worker plus D1 database: leads table, deduplication (same phone and project within 24h), per-IP rate limit, optional OTP through any HTTP SMS gateway.
   - CRM push driven by environment variables: CRM_URL, CRM_METHOD, CRM_FORMAT, CRM_HEADERS, CRM_FIELD_MAP (same `{{var}}` set as the PHP connector), CRM_SUCCESS_MATCH, CRM_DROP_EMPTY, CRM_ROUTES. Cron retries failed pushes.
   - Admin API behind a Bearer token, used by the **Leads Console** at `admin/index.html`: KPIs, breakdowns by project, source, form and day (IST), filters, CSV export, re-push and delete.

5. **Google Ads tracking.** Final URL suffixes:
   - Search: `utm_source=google&utm_medium=search&utm_campaign={_campaign}&utm_adgroup={_adgroup}&utm_term={keyword}&utm_content={creative}&strategy={_strategy}&matchtype={matchtype}&network={network}&device={device}&campaignid={campaignid}&adgroupid={adgroupid}&creative={creative}&loc_physical={loc_physical_ms}&loc_interest={loc_interest_ms}`
   - Demand Gen: the same, but with `utm_medium=demandgen`, plus `placement={placement}`, and without `keyword` and `matchtype`.
   - Custom parameters `_campaign`, `_strategy` and `_adgroup`. Auto-tagging ON.

6. **Docs:** a master guide, a CRM integration guide (6 questions to ask any CRM, the destination block reference, a variables table, a troubleshooting table) and a README.

Build it, test it end to end with a mock CRM, and give me the ZIP plus a short Hinglish summary of what to do next.

**Today's task:** <write what you want, e.g. "new LP for <project>, CRM = LeadSquared, domain = xyz.in" or "add feature X to the builder">
