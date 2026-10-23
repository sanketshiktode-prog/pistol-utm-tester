<?php
/* =====================================================================
   Universal Lead Connector (PHP — cPanel / any shared hosting)
   Landing page form → this file → any CRM(s) defined in config.php

   - Secrets stay on the server (config.php is blocked from the browser)
   - Adds visitor IP + city/state, decodes Google Ads ValueTrack data
   - Sends to one or more "destinations" (CRM, Google Sheet, webhook…)
   - Every lead is saved to api/logs/leads-YYYY-MM.csv with each CRM's response

   Health check:  https://your-domain/api/lead.php?health=1
   Docs:          docs/CRM-INTEGRATION-GUIDE.md in the LP Builder repo
   ===================================================================== */
declare(strict_types=1);
error_reporting(E_ALL & ~E_DEPRECATED & ~E_NOTICE);

$CFG = @include __DIR__ . '/config.php';
$S = is_array($CFG) ? ($CFG['settings'] ?? []) : [];
$DEST = is_array($CFG) ? ($CFG['destinations'] ?? []) : [];
$LOG_DIR = __DIR__ . '/logs';
if (!is_dir($LOG_DIR)) {
  @mkdir($LOG_DIR, 0755, true);
  @file_put_contents($LOG_DIR . '/.htaccess', "<IfModule mod_authz_core.c>\nRequire all denied\n</IfModule>\n<IfModule !mod_authz_core.c>\nOrder allow,deny\nDeny from all\n</IfModule>\n");
}

/* ---------- CORS / headers ---------- */
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$allowed = array_filter(array_map('trim', explode(',', (string)($S['allowed_origins'] ?? ''))));
$originOk = !$allowed || !$origin || in_array($origin, $allowed, true);
if ($origin && $originOk) { header('Access-Control-Allow-Origin: ' . $origin); header('Vary: Origin'); }
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
$M = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($M === 'OPTIONS') { http_response_code(204); exit; }

function out(array $a, int $code = 200): void { http_response_code($code); echo json_encode($a, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT); exit; }
function clean($v, int $max = 300): string { $v = is_scalar($v) ? (string)$v : ''; $v = preg_replace('/[\x00-\x1F\x7F]/u', ' ', $v) ?? ''; return mb_substr(trim($v), 0, $max); }
function dest_ready(array $d): bool { return !empty($d['url']) && strpos(json_encode($d), 'PASTE_') === false && ($d['enabled'] ?? true); }

if ($M === 'GET') {
  if (!is_array($CFG)) out(['ok' => false, 'error' => 'config.php is missing or its JSON is invalid — check commas/quotes']);
  $list = [];
  foreach ($DEST as $d) $list[] = ['name' => $d['name'] ?? 'destination', 'ready' => dest_ready($d), 'missing' => array_values(array_unique(preg_match_all('/PASTE_[A-Z_]+/', json_encode($d), $m) ? $m[0] : []))];
  out(['ok' => true, 'service' => 'universal-lead-connector', 'php' => PHP_VERSION, 'curl' => function_exists('curl_init'), 'logs_writable' => is_writable($LOG_DIR), 'destinations' => $list]);
}
if ($M !== 'POST') out(['ok' => false, 'error' => 'method_not_allowed'], 405);
if (!$originOk) out(['ok' => false, 'error' => 'origin_not_allowed'], 403);

$b = json_decode((string)file_get_contents('php://input'), true);
if (!is_array($b)) out(['ok' => false, 'error' => 'invalid_json'], 400);
if (!empty($b['website'])) out(['ok' => true, 'id' => 'hp']); // honeypot

/* ---------- validation ---------- */
$name = clean($b['name'] ?? '', 80);
if (mb_strlen($name) < 2) out(['ok' => false, 'error' => 'invalid_name'], 400);
$ccd = preg_replace('/\D/', '', clean($b['country_code'] ?? '', 6));
$cc = $ccd !== '' ? $ccd : '91';
$phone = preg_replace('/\D/', '', clean($b['phone'] ?? '', 20));
if ($cc === '91') { $phone = preg_replace('/^(91|0)(?=\d{10}$)/', '', $phone); if (!preg_match('/^[6-9]\d{9}$/', $phone)) out(['ok' => false, 'error' => 'invalid_phone'], 400); }
elseif (strlen($phone) < 6 || strlen($phone) > 13) out(['ok' => false, 'error' => 'invalid_phone'], 400);
$email = strtolower(clean($b['email'] ?? '', 120));
if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) out(['ok' => false, 'error' => 'invalid_email'], 400);

/* ---------- IP + rate limit ---------- */
$ip = clean($_SERVER['HTTP_CF_CONNECTING_IP'] ?? '', 64);
if ($ip === '' && !empty($_SERVER['HTTP_X_FORWARDED_FOR'])) $ip = trim(explode(',', $_SERVER['HTTP_X_FORWARDED_FOR'])[0]);
if ($ip === '') $ip = $_SERVER['REMOTE_ADDR'] ?? '';
$limit = (int)($S['rate_limit_per_10min'] ?? 8);
if ($limit > 0 && $ip !== '') {
  $rf = $LOG_DIR . '/rl-' . md5($ip) . '.txt'; $now = time();
  $hits = array_filter(array_map('intval', @file($rf, FILE_IGNORE_NEW_LINES) ?: []), fn($t) => $t > $now - 600);
  if (count($hits) >= $limit) out(['ok' => false, 'error' => 'rate_limited'], 429);
  $hits[] = $now; @file_put_contents($rf, implode("\n", $hits), LOCK_EX);
}

/* ---------- variables available to templates ---------- */
$a = is_array($b['attribution'] ?? null) ? $b['attribution'] : [];
$g = function (string ...$keys) use ($a): string {
  foreach ($keys as $k) { $x = clean($a[$k] ?? '', 300); if ($x !== '' && !preg_match('/^\{.*\}$/', $x)) return $x; }
  return '';
};
$gclid = $g('gclid'); $gbraid = $g('gbraid'); $wbraid = $g('wbraid'); $fbclid = $g('fbclid'); $msclkid = $g('msclkid');
$ref = clean($a['referrer'] ?? '', 300);
$source = $g('utm_source', 'source');
if ($source === '') $source = ($gclid || $gbraid || $wbraid) ? 'google' : ($fbclid ? 'facebook' : ($msclkid ? 'bing' : ($ref ? (preg_replace('/^www\./', '', (string)parse_url($ref, PHP_URL_HOST)) ?: 'referral') : 'direct')));
$net = $g('network');
$medium = $g('utm_medium', 'medium');
if ($medium === '' && ($gclid || $gbraid || $wbraid)) $medium = in_array($net, ['g', 's'], true) ? 'search' : ($net ? 'demandgen' : 'cpc');
$mt = $g('matchtype'); $dev = $g('device');

$city = clean($_SERVER['HTTP_CF_IPCITY'] ?? '', 80); $region = clean($_SERVER['HTTP_CF_REGION'] ?? '', 80); $country = clean($_SERVER['HTTP_CF_IPCOUNTRY'] ?? '', 40);
if ($city === '' && ($S['geo_lookup'] ?? true) && filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) {
  $geo = http_call('GET', 'http://ip-api.com/json/' . rawurlencode($ip) . '?fields=status,city,regionName,country', [], null, 2);
  $gj = json_decode($geo['body'], true);
  if (($gj['status'] ?? '') === 'success') { $city = (string)$gj['city']; $region = (string)$gj['regionName']; $country = (string)$gj['country']; }
}
$parts = preg_split('/\s+/', $name);
$first = array_shift($parts); $last = implode(' ', $parts);
$id = base_convert((string)time(), 10, 36) . '-' . bin2hex(random_bytes(3));

$V = [
  'lead_id' => $id, 'created_at_ist' => gmdate('Y-m-d H:i:s', time() + 19800), 'created_at_iso' => gmdate('c'), 'epoch_ms' => (string)round(microtime(true) * 1000),
  'name' => $name, 'first_name' => $first, 'last_name' => $last, 'last_name_or_name' => $last !== '' ? $last : $name,
  'phone' => $phone, 'country_code' => $cc, 'phone_with_cc' => $cc . $phone, 'full_phone' => '+' . $cc . $phone, 'email' => $email,
  'config' => clean($b['config'] ?? '', 80), 'form_name' => clean($b['form_source'] ?? '', 120),
  'project' => clean($b['project_name'] ?? '', 120), 'project_code' => clean($b['project_code'] ?? '', 80),
  'developer' => clean($b['developer'] ?? '', 120), 'project_location' => clean($b['location'] ?? '', 160),
  'source' => $source, 'medium' => $medium,
  'campaign' => $g('utm_campaign', 'campaign') ?: $g('campaignid'),
  'ad_group' => $g('utm_adgroup', 'adgroup') ?: $g('adgroupid'),
  'ad' => $g('utm_ad', 'ad', 'utm_content') ?: $g('creative'),
  'keyword' => $g('utm_term', 'keyword'),
  'match_type' => ['e' => 'exact', 'p' => 'phrase', 'b' => 'broad'][$mt] ?? $mt,
  'strategy' => $g('strategy', 'utm_strategy'),
  'network' => ['g' => 'google_search', 's' => 'search_partner', 'd' => 'display', 'ytv' => 'youtube', 'gtv' => 'google_tv', 'x' => 'pmax'][$net] ?? $net,
  'device' => ['m' => 'mobile', 't' => 'tablet', 'c' => 'desktop'][$dev] ?? $dev,
  'placement' => $g('placement'),
  'campaign_id' => $g('campaignid', 'utm_id'), 'ad_group_id' => $g('adgroupid'), 'ad_id' => $g('creative'),
  'utm_source' => $g('utm_source'), 'utm_medium' => $g('utm_medium'), 'utm_campaign' => $g('utm_campaign'), 'utm_term' => $g('utm_term'), 'utm_content' => $g('utm_content'),
  'gclid' => $gclid, 'gbraid' => $gbraid, 'wbraid' => $wbraid, 'fbclid' => $fbclid, 'msclkid' => $msclkid,
  'click_id' => $gclid ?: ($gbraid ?: ($wbraid ?: ($fbclid ?: $msclkid))),
  'click_id_type' => $gclid ? 'gclid' : ($gbraid ? 'gbraid' : ($wbraid ? 'wbraid' : ($fbclid ? 'fbclid' : ($msclkid ? 'msclkid' : '')))),
  'ip_address' => $ip, 'city' => $city, 'region' => $region, 'country' => $country,
  'visitor_location' => implode(', ', array_filter([$city, $region, $country])),
  'google_location_id' => $g('loc_physical', 'loc_physical_ms') ?: $g('loc_interest'),
  'landing_page' => clean($a['landing_url'] ?? ($b['page_url'] ?? ''), 1000), 'referrer' => $ref,
  'user_agent' => clean($_SERVER['HTTP_USER_AGENT'] ?? '', 300),
];
$sum = [];
foreach (['Project' => 'project', 'Form' => 'form_name', 'Source' => 'source', 'Medium' => 'medium', 'Campaign' => 'campaign', 'Ad group' => 'ad_group', 'Ad' => 'ad', 'Keyword' => 'keyword', 'Match type' => 'match_type', 'Strategy' => 'strategy', 'Network' => 'network', 'Device' => 'device', 'Click ID' => 'click_id', 'IP' => 'ip_address', 'Location' => 'visitor_location', 'Landing page' => 'landing_page'] as $lbl => $k)
  if ($V[$k] !== '') $sum[] = "$lbl: " . $V[$k];
$V['summary'] = implode("\n", $sum);

/* ---------- send to every destination ---------- */
$results = [];
foreach ($DEST as $d) {
  $dn = (string)($d['name'] ?? 'destination');
  if (!dest_ready($d)) { $results[$dn] = 'not_configured'; continue; }
  $results[$dn] = send_destination($d, $V);
}

/* ---------- CSV backup ---------- */
$csv = $LOG_DIR . '/leads-' . gmdate('Y-m') . '.csv';
$cols = ['lead_id', 'created_at_ist', 'name', 'phone_with_cc', 'email', 'config', 'form_name', 'project', 'source', 'medium', 'campaign', 'ad_group', 'ad', 'keyword', 'match_type', 'strategy', 'network', 'device', 'placement', 'campaign_id', 'ad_group_id', 'ad_id', 'click_id', 'click_id_type', 'ip_address', 'visitor_location', 'google_location_id', 'landing_page', 'referrer'];
$row = []; foreach ($cols as $c) $row[$c] = $V[$c];
$row['crm_results'] = json_encode($results, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
$new = !file_exists($csv);
if ($fh = @fopen($csv, 'a')) {
  flock($fh, LOCK_EX);
  if ($new) fputcsv($fh, array_keys($row), ',', '"', '');
  fputcsv($fh, array_map(fn($x) => preg_match('/^[=+\-@]/', (string)$x) && !preg_match('/^\+?\d+$/', (string)$x) ? "'" . $x : $x, array_values($row)), ',', '"', '');
  flock($fh, LOCK_UN); fclose($fh);
}
out(['ok' => true, 'id' => $id]); // visitor always gets thanked — lead is safe in the CSV

/* ================= helpers ================= */
function render($tpl, array $V) {
  if (is_array($tpl)) { $o = []; foreach ($tpl as $k => $x) $o[$k] = render($x, $V); return $o; }
  if (!is_string($tpl)) return $tpl;
  return preg_replace_callback('/\{\{\s*(\w+)\s*\}\}/', fn($m) => (string)($V[$m[1]] ?? ''), $tpl);
}
function prune($x) {
  if (!is_array($x)) return $x;
  $isList = $x === [] || array_keys($x) === range(0, count($x) - 1);
  $o = [];
  foreach ($x as $k => $orig) {
    $v = prune($orig);
    if ($v === '' || $v === null || $v === []) continue;
    // drop {Attribute:X, Value:""} / {name:x, value:""} pairs whose value became empty
    if (is_array($orig) && ((array_key_exists('Value', $orig) && !array_key_exists('Value', $v)) || (array_key_exists('value', $orig) && !array_key_exists('value', $v)))) continue;
    if ($isList) $o[] = $v; else $o[$k] = $v;
  }
  return $o;
}
function send_destination(array $d, array $V): string {
  $method = strtoupper((string)($d['method'] ?? 'POST'));
  $format = (string)($d['format'] ?? 'json');
  $url = render((string)$d['url'], $V);
  $body = ($d['body'] ?? '__ALL__') === '__ALL__' ? $V : render($d['body'], $V);
  if (($d['drop_empty'] ?? true) && is_array($body)) $body = prune($body);
  $headers = [];
  foreach ((array)($d['headers'] ?? []) as $k => $v) $headers[] = (is_int($k) ? '' : $k . ': ') . render((string)$v, $V);
  $payload = null;
  if ($format === 'query' || $method === 'GET') {
    $url .= (strpos($url, '?') === false ? '?' : '&') . http_build_query(is_array($body) ? $body : []);
  } elseif ($format === 'form') {
    $payload = http_build_query(is_array($body) ? $body : []); $headers[] = 'Content-Type: application/x-www-form-urlencoded';
  } else {
    $payload = json_encode($body, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE); $headers[] = 'Content-Type: application/json';
  }
  $res = ['code' => 0, 'body' => ''];
  for ($i = 1; $i <= 3; $i++) {
    $res = http_call($method, $url, $headers, $payload, 12);
    $ok = $res['code'] >= 200 && $res['code'] < 300;
    if ($ok && !empty($d['success']) && stripos($res['body'], (string)$d['success']) === false)
      return 'FAILED ' . $res['code'] . ' (reply had no "' . $d['success'] . '") ' . mb_substr($res['body'], 0, 250); // reached CRM — don't resend
    if ($ok) return 'ok ' . $res['code'];
    if (in_array($res['code'], [400, 401, 403, 404, 422], true)) break; // not retryable
    usleep(400000 * $i);
  }
  return 'FAILED ' . $res['code'] . ' ' . mb_substr($res['body'], 0, 250);
}
function http_call(string $method, string $url, array $headers, ?string $payload, int $timeout): array {
  $ch = curl_init($url);
  $o = [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => $timeout, CURLOPT_CONNECTTIMEOUT => min(5, $timeout), CURLOPT_HTTPHEADER => $headers, CURLOPT_CUSTOMREQUEST => $method, CURLOPT_FOLLOWLOCATION => true, CURLOPT_MAXREDIRS => 3];
  if ($payload !== null) $o[CURLOPT_POSTFIELDS] = $payload;
  curl_setopt_array($ch, $o);
  $r = curl_exec($ch); $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE); $err = curl_error($ch); curl_close($ch);
  return ['code' => $code, 'body' => $r === false ? 'ERR ' . $err : (string)$r];
}
