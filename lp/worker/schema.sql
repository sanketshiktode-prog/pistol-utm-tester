-- Leads database (Cloudflare D1 / SQLite)
CREATE TABLE IF NOT EXISTS leads (
  id            TEXT PRIMARY KEY,
  created_at    TEXT NOT NULL,              -- UTC ISO timestamp
  project_code  TEXT,
  project_name  TEXT,
  developer     TEXT,
  location      TEXT,
  name          TEXT NOT NULL,
  country_code  TEXT,
  phone         TEXT NOT NULL,
  email         TEXT,
  config        TEXT,
  form_source   TEXT,                       -- popup / side-form / brochure / costing:2BHK ...
  utm_source    TEXT, utm_medium TEXT, utm_campaign TEXT, utm_term TEXT, utm_content TEXT,
  gclid         TEXT, gbraid TEXT, wbraid TEXT, fbclid TEXT, msclkid TEXT,
  keyword       TEXT, matchtype TEXT, network TEXT, device_param TEXT, adgroup TEXT, placement TEXT,
  landing_url   TEXT,
  page_url      TEXT,
  referrer      TEXT,
  ip            TEXT,
  country       TEXT,
  region        TEXT,
  city          TEXT,
  user_agent    TEXT,
  is_mobile     INTEGER DEFAULT 0,
  is_duplicate  INTEGER DEFAULT 0,
  otp_required  INTEGER DEFAULT 0,
  otp_verified  INTEGER DEFAULT 0,
  crm_status    TEXT DEFAULT 'pending',     -- pending | sent | failed | skipped | awaiting_otp
  crm_attempts  INTEGER DEFAULT 0,
  crm_response  TEXT,
  crm_pushed_at TEXT,
  extra         TEXT                        -- JSON for anything else
);
CREATE INDEX IF NOT EXISTS idx_leads_created ON leads(created_at);
CREATE INDEX IF NOT EXISTS idx_leads_project ON leads(project_code, created_at);
CREATE INDEX IF NOT EXISTS idx_leads_phone   ON leads(phone, project_code);
CREATE INDEX IF NOT EXISTS idx_leads_crm     ON leads(crm_status, crm_attempts);
CREATE INDEX IF NOT EXISTS idx_leads_ip      ON leads(ip, created_at);

CREATE TABLE IF NOT EXISTS otps (
  lead_id    TEXT PRIMARY KEY,
  token      TEXT NOT NULL,
  otp_hash   TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  attempts   INTEGER DEFAULT 0,
  sends      INTEGER DEFAULT 1,
  last_sent  INTEGER NOT NULL
);
