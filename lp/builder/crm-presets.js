/* =====================================================================
   CRM presets for the Universal Lead Connector.
   Each preset = one "destination": where to send the lead and in what shape.
   {{variable}} placeholders are filled on the server for every lead
   (full list: docs/CRM-INTEGRATION-GUIDE.md). PASTE_… = fill on the server.
   body: "__ALL__" sends every variable as flat JSON.
   drop_empty: true removes empty values so an update never blanks CRM data.
   ===================================================================== */
(function (g) {
  const TRACK = {
    source: '{{source}}', medium: '{{medium}}', campaign: '{{campaign}}', ad_group: '{{ad_group}}', ad: '{{ad}}',
    keyword: '{{keyword}}', match_type: '{{match_type}}', strategy: '{{strategy}}', network: '{{network}}', device: '{{device}}',
    placement: '{{placement}}', campaign_id: '{{campaign_id}}', ad_group_id: '{{ad_group_id}}', ad_id: '{{ad_id}}',
    gclid: '{{click_id}}', click_id_type: '{{click_id_type}}', ip_address: '{{ip_address}}', location: '{{visitor_location}}',
    google_location_id: '{{google_location_id}}', landing_page: '{{landing_page}}', form_name: '{{form_name}}', project: '{{project}}'
  };
  g.LP_CRM_PRESETS = {
    'TeleCRM': {
      notes: 'Async token only. Create the custom fields in TeleCRM with these exact API names (or rename the keys). Docs: docs.telecrm.in/async-api',
      url: 'https://next-api.telecrm.in/enterprise/PASTE_ENTERPRISE_ID/autoupdatelead',
      method: 'POST', format: 'json',
      headers: { Authorization: 'Bearer PASTE_ASYNC_TOKEN' },
      body: { fields: Object.assign({ name: '{{name}}', phone: '{{phone_with_cc}}', email: '{{email}}' }, TRACK) },
      success: 'QUEUED', drop_empty: true
    },
    'LeadSquared': {
      notes: 'API host is region specific (e.g. api-in21.leadsquared.com) — see LSQ → Settings → API and Webhooks. Custom fields start with mx_ and must exist.',
      url: 'https://PASTE_API_HOST/v2/LeadManagement.svc/Lead.Capture?accessKey=PASTE_ACCESS_KEY&secretKey=PASTE_SECRET_KEY',
      method: 'POST', format: 'json', headers: {},
      body: [
        { Attribute: 'FirstName', Value: '{{first_name}}' }, { Attribute: 'LastName', Value: '{{last_name}}' },
        { Attribute: 'EmailAddress', Value: '{{email}}' }, { Attribute: 'Phone', Value: '+{{country_code}}-{{phone}}' },
        { Attribute: 'Source', Value: '{{source}}' }, { Attribute: 'SourceMedium', Value: '{{medium}}' },
        { Attribute: 'SourceCampaign', Value: '{{campaign}}' }, { Attribute: 'SourceContent', Value: '{{ad}}' },
        { Attribute: 'mx_Ad_Group', Value: '{{ad_group}}' }, { Attribute: 'mx_Keyword', Value: '{{keyword}}' },
        { Attribute: 'mx_Strategy', Value: '{{strategy}}' }, { Attribute: 'mx_GCLID', Value: '{{click_id}}' },
        { Attribute: 'mx_IP_Address', Value: '{{ip_address}}' }, { Attribute: 'mx_Location', Value: '{{visitor_location}}' },
        { Attribute: 'mx_Project', Value: '{{project}}' }, { Attribute: 'mx_Form', Value: '{{form_name}}' },
        { Attribute: 'SearchBy', Value: 'Phone' }
      ],
      success: 'Success', drop_empty: true
    },
    'Sell.Do': {
      notes: 'Get api_key and the campaign SRD from Sell.Do. Confirm field names with Sell.Do support for your account.',
      url: 'https://app.sell.do/api/leads/create',
      method: 'POST', format: 'form', headers: {},
      body: {
        api_key: 'PASTE_API_KEY',
        sell_do: {
          form: { lead: { name: '{{name}}', email: '{{email}}', phone: '{{phone}}' }, note: { content: '{{summary}}' } },
          campaign: { srd: 'PASTE_SRD' },
          analytics: { utm_source: '{{source}}', utm_medium: '{{medium}}', utm_campaign: '{{campaign}}', utm_term: '{{keyword}}', utm_content: '{{ad}}' }
        }
      },
      success: '', drop_empty: true
    },
    'HubSpot Forms': {
      notes: 'Create a HubSpot form containing these fields; use its Portal ID and Form GUID. No token needed.',
      url: 'https://api.hsforms.com/submissions/v3/integration/submit/PASTE_PORTAL_ID/PASTE_FORM_GUID',
      method: 'POST', format: 'json', headers: {},
      body: {
        fields: [
          { name: 'firstname', value: '{{first_name}}' }, { name: 'lastname', value: '{{last_name}}' },
          { name: 'email', value: '{{email}}' }, { name: 'phone', value: '{{full_phone}}' },
          { name: 'utm_source', value: '{{source}}' }, { name: 'utm_medium', value: '{{medium}}' },
          { name: 'utm_campaign', value: '{{campaign}}' }, { name: 'utm_term', value: '{{keyword}}' }
        ],
        context: { pageUri: '{{landing_page}}', pageName: '{{project}}', ipAddress: '{{ip_address}}' }
      },
      success: '', drop_empty: true
    },
    'Salesforce Web-to-Lead': {
      notes: 'Setup → Web-to-Lead → copy your Org ID (oid). Custom fields use their field IDs (00N…).',
      url: 'https://webto.salesforce.com/servlet/servlet.WebToLead?encoding=UTF-8',
      method: 'POST', format: 'form', headers: {},
      body: { oid: 'PASTE_ORG_ID', first_name: '{{first_name}}', last_name: '{{last_name_or_name}}', email: '{{email}}', mobile: '{{full_phone}}', lead_source: '{{source}}', company: '{{project}}', description: '{{summary}}' },
      success: '', drop_empty: true
    },
    'Webhook (Zapier / Make / Pabbly / n8n)': {
      notes: 'Paste the webhook URL. Every variable is sent as flat JSON — map fields inside Zapier/Make.',
      url: 'PASTE_WEBHOOK_URL', method: 'POST', format: 'json', headers: {}, body: '__ALL__', success: '', drop_empty: false
    },
    'Google Sheet (Apps Script)': {
      notes: 'Deploy docs/google-sheet-apps-script.js as a Web App and paste its URL.',
      url: 'PASTE_APPS_SCRIPT_URL', method: 'POST', format: 'json', headers: {}, body: '__ALL__', success: '', drop_empty: false
    },
    'Custom (edit in config)': {
      notes: 'Fill url, headers and body from your CRM API docs. See docs/CRM-INTEGRATION-GUIDE.md.',
      url: 'PASTE_CRM_ENDPOINT', method: 'POST', format: 'json', headers: { Authorization: 'Bearer PASTE_TOKEN' },
      body: { name: '{{name}}', phone: '{{phone_with_cc}}', email: '{{email}}', source: '{{source}}', campaign: '{{campaign}}' },
      success: '', drop_empty: true
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);

/* ---------- config generators used by the builder export ---------- */
(function (g) {
  const clone = (o) => JSON.parse(JSON.stringify(o));
  function destinations(c) {
    const P = g.LP_CRM_PRESETS, key = (c.lead && c.lead.crm) || 'TeleCRM';
    const out = [];
    const main = clone(P[key] || P['Custom (edit in config)']);
    const notes = main.notes; delete main.notes;
    out.push(Object.assign({ name: key, enabled: true, _help: notes }, main));
    if (c.lead && c.lead.sheetBackup && key !== 'Google Sheet (Apps Script)') {
      const s = clone(P['Google Sheet (Apps Script)']); const n = s.notes; delete s.notes;
      out.push(Object.assign({ name: 'Google Sheet backup', enabled: true, _help: n }, s));
    }
    return out;
  }
  g.LP_connectorConfigPhp = function (c) {
    const dom = ((c.meta && c.meta.domain) || '').replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, '');
    const conf = {
      settings: {
        allowed_origins: dom ? `https://${dom},https://www.${dom}` : '',
        rate_limit_per_10min: 8,
        geo_lookup: true
      },
      destinations: destinations(c)
    };
    return `<?php
/* =====================================================================
   Lead connector settings — edit THIS file on the server
   (cPanel → File Manager → api/config.php → Edit)

   1. Replace every PASTE_… value with the CRM's keys.
   2. JSON rules: keep the "double quotes", no comma after the last item.
   3. Check:  https://${dom || 'your-domain'}/api/lead.php?health=1
      → every destination must show "ready": true

   destinations = where each lead goes (you can add more blocks, e.g. a 2nd CRM).
   {{variables}} are filled per lead — full list in docs/CRM-INTEGRATION-GUIDE.md
   "enabled": false switches a destination off without deleting it.
   ===================================================================== */
$json = <<<'JSON'
${JSON.stringify(conf, null, 2)}
JSON;
return json_decode($json, true);
`;
  };
  g.LP_cloudflareSettings = function (c) {
    const d = destinations(c)[0];
    const hdr = d.headers && Object.keys(d.headers).length ? JSON.stringify(d.headers) : '';
    return `Cloudflare Worker (pp-leads) → Settings → Variables and Secrets
CRM: ${d.name}
${d._help}

CRM_URL (Secret)          = ${d.url}
CRM_METHOD (Text)         = ${d.method}
CRM_FORMAT (Text)         = ${d.format}
${hdr ? `CRM_HEADERS (Secret)      = ${hdr}\n` : ''}CRM_FIELD_MAP (Text)      = ${typeof d.body === 'string' ? '(leave empty — sends every variable)' : JSON.stringify(d.body)}
${d.success ? `CRM_SUCCESS_MATCH (Text)  = ${d.success}\n` : ''}CRM_DROP_EMPTY (Text)     = ${d.drop_empty ? 'true' : 'false'}

Replace every PASTE_… value. Then submit a test lead and check the Leads Console (CRM column).
`;
  };
  g.LP_rootHtaccess = function (dom) {
    dom = dom.replace(/^www\./, '');
    return `# Force HTTPS + non-www. Run AutoSSL in cPanel BEFORE uploading.
<IfModule mod_rewrite.c>
RewriteEngine On
RewriteCond %{HTTPS} off [OR]
RewriteCond %{HTTP_HOST} ^www\\. [NC]
RewriteRule ^ https://${dom}%{REQUEST_URI} [L,R=301]
</IfModule>
Options -Indexes
<IfModule mod_expires.c>
ExpiresActive On
ExpiresByType image/webp "access plus 30 days"
ExpiresByType image/png "access plus 30 days"
ExpiresByType image/jpeg "access plus 30 days"
</IfModule>
`;
  };
})(typeof window !== 'undefined' ? window : globalThis);
