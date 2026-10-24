<?php
/* =====================================================================
   Trigger — publish endpoint
   =====================================================================

   Uploaded once to the hosting account. After that the builder publishes
   straight to it over HTTPS, so a change is live in seconds and nobody
   touches FTP or re-uploads a ZIP.

   This writes files into a web root, so it is deliberately narrow:

     - a long shared secret, compared in constant time, kept in
       publish-config.php which never goes near the repository
     - HTTPS only
     - one project folder per site, its name validated against a strict
       pattern, and every path resolved and checked to be inside it
     - an extension allowlist. Anything executable — php, phtml, cgi, pl,
       py, sh, htaccess — is refused outright, whatever else is true
     - size caps per file and per request
     - writes are atomic: a temporary file, then a rename

   It cannot create a file outside the project folder, cannot write code
   the server would execute, and does nothing at all without the secret.

   SET UP, ONCE
     1. Upload this file and publish-config.php to  public_html/api/
     2. Open publish-config.php and put a long random string in 'token'
     3. Open  https://yourdomain.com/api/publish.php?health=1
        It should answer {"ok":true,...}. That is the whole setup.
   ===================================================================== */

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

/* The builder runs on a different origin to this hosting, so the browser
   will not let it read the answer unless this says who may. Without it the
   upload still happens and the reply is thrown away, which looks exactly
   like a failure and is the worst of both. */
function cors(array $CFG) {
  $allow = trim((string)($CFG['allow_origin'] ?? ''));
  if ($allow === '') return;
  $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
  $send = '';
  if ($allow === '*') $send = $origin !== '' ? $origin : '*';
  else {
    foreach (array_map('trim', explode(',', $allow)) as $a)
      if ($a !== '' && strcasecmp($a, $origin) === 0) { $send = $origin; break; }
  }
  if ($send === '') return;
  header('Access-Control-Allow-Origin: ' . $send);
  header('Vary: Origin');
  header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
  header('Access-Control-Allow-Headers: Content-Type');
  header('Access-Control-Max-Age: 86400');
}

const MAX_FILE  = 15728640;   /* 15 MB  */
const MAX_BODY  = 41943040;   /* 40 MB  */
const OK_EXT = ['html','htm','css','js','mjs','json','txt','xml','svg','webp',
                'jpg','jpeg','png','gif','ico','avif','pdf','woff','woff2','ttf','map','webmanifest'];
/* refused whatever else is true — these are the ones the server would run */
const NO_EXT = ['php','php3','php4','php5','php7','php8','phtml','phar','phps',
                'cgi','pl','py','sh','bash','rb','jsp','asp','aspx','exe','so','htaccess','htpasswd','ini','user'];

function out($o, $code = 200) { http_response_code($code); echo json_encode($o); exit; }

$CFG = @include __DIR__ . '/publish-config.php';
if (!is_array($CFG)) out(['ok' => false, 'error' => 'publish-config.php is missing or invalid'], 500);
cors($CFG);

/* the preflight, when one is sent at all */
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') { http_response_code(204); exit; }

$token = (string)($CFG['token'] ?? '');
if ($token === '' || strpos($token, 'PASTE_') === 0 || strlen($token) < 24)
  out(['ok' => false, 'error' => 'Set a long random token in publish-config.php'], 500);

/* The project folders live beside api/, i.e. in the web root, unless the
   config says otherwise. */
$baseCfg = (string)($CFG['root'] ?? dirname(__DIR__));
$base = realpath($baseCfg);
if ($base === false) out(['ok' => false, 'error' => 'root in publish-config.php does not exist'], 500);

$https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
      || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https')
      || (($_SERVER['SERVER_PORT'] ?? '') == 443);

if (isset($_GET['health'])) {
  out(['ok' => true, 'service' => 'trigger-publish', 'https' => $https,
       'root' => basename($base), 'php' => PHP_VERSION,
       'max_file_mb' => round(MAX_FILE / 1048576),
       'post_max_size' => ini_get('post_max_size'),
       'upload_max_filesize' => ini_get('upload_max_filesize')]);
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST')
  out(['ok' => false, 'error' => 'POST only'], 405);
if (!$https)
  out(['ok' => false, 'error' => 'HTTPS only — the token must not travel in the clear'], 400);

$raw = file_get_contents('php://input');
if ($raw === false || strlen($raw) === 0) out(['ok' => false, 'error' => 'empty body'], 400);
if (strlen($raw) > MAX_BODY)
  out(['ok' => false, 'error' => 'that batch is too large — the builder should send fewer files at a time'], 413);

$b = json_decode($raw, true);
if (!is_array($b)) out(['ok' => false, 'error' => 'invalid JSON'], 400);

/* constant time, so the token cannot be guessed a character at a time */
$given = (string)($b['token'] ?? '');
if (!hash_equals($token, $given)) out(['ok' => false, 'error' => 'unauthorized'], 401);

$project = (string)($b['project'] ?? '');
if (!preg_match('/^[a-z0-9][a-z0-9-]{1,48}$/', $project))
  out(['ok' => false, 'error' => 'project must be a slug: lowercase letters, numbers and hyphens'], 400);

/* "." publishes to the web root itself, for a site on its own domain */
$dirName = ($project === 'root' || ($b['at_root'] ?? false)) ? '' : $project;
$target  = $dirName === '' ? $base : $base . DIRECTORY_SEPARATOR . $dirName;
if (!is_dir($target) && !@mkdir($target, 0755, true))
  out(['ok' => false, 'error' => 'could not create ' . $project], 500);
$target = realpath($target);
if ($target === false || strpos($target, $base) !== 0)
  out(['ok' => false, 'error' => 'refused: outside the configured root'], 400);

$files = $b['files'] ?? null;
if (!is_array($files) || !count($files)) out(['ok' => false, 'error' => 'no files'], 400);
if (count($files) > 120) out(['ok' => false, 'error' => 'too many files in one batch'], 400);

$written = []; $skipped = [];

foreach ($files as $f) {
  $path = (string)($f['path'] ?? '');

  /* a path is a relative, lowercase-ish, boring thing. Anything with a
     backslash, a drive letter, a leading slash, a traversal, a null byte or
     a control character is simply not one. */
  if ($path === '' || strlen($path) > 160) { $skipped[] = [$path, 'bad path']; continue; }
  if (preg_match('#[\x00-\x1f\\\\:]#', $path)) { $skipped[] = [$path, 'bad character']; continue; }
  if ($path[0] === '/' || $path[0] === '.') { $skipped[] = [$path, 'must be relative']; continue; }
  if (strpos($path, '..') !== false) { $skipped[] = [$path, 'traversal']; continue; }
  if (!preg_match('#^[A-Za-z0-9][A-Za-z0-9._/-]*$#', $path)) { $skipped[] = [$path, 'bad path']; continue; }

  $ext = strtolower(pathinfo($path, PATHINFO_EXTENSION));
  if ($ext === '' || in_array($ext, NO_EXT, true) || !in_array($ext, OK_EXT, true)) {
    $skipped[] = [$path, 'refused file type']; continue;
  }
  /* a file whose name starts with a dot is config, not content */
  if (preg_match('#(^|/)\.#', $path)) { $skipped[] = [$path, 'hidden file']; continue; }

  $data = (string)($f['data'] ?? '');
  $bin  = !empty($f['b64']);
  $body = $bin ? base64_decode($data, true) : $data;
  if ($body === false) { $skipped[] = [$path, 'bad base64']; continue; }
  if (strlen($body) > MAX_FILE) { $skipped[] = [$path, 'too large']; continue; }

  $full = $target . DIRECTORY_SEPARATOR . $path;
  $dir  = dirname($full);
  if (!is_dir($dir) && !@mkdir($dir, 0755, true)) { $skipped[] = [$path, 'could not create folder']; continue; }

  /* the folder must still be inside the project after the filesystem has
     had its say about symlinks */
  $rdir = realpath($dir);
  if ($rdir === false || strpos($rdir, $target) !== 0) { $skipped[] = [$path, 'outside the project']; continue; }

  $tmp = $full . '.part';
  if (@file_put_contents($tmp, $body, LOCK_EX) === false) { $skipped[] = [$path, 'could not write']; continue; }
  if (!@rename($tmp, $full)) { @unlink($tmp); $skipped[] = [$path, 'could not replace']; continue; }
  @chmod($full, 0644);
  $written[] = $path;
}

$logLine = gmdate('c') . "\t" . $project . "\t" . count($written) . " written\t"
         . count($skipped) . " skipped\t" . ($_SERVER['REMOTE_ADDR'] ?? '') . "\n";
@file_put_contents(__DIR__ . '/publish.log', $logLine, FILE_APPEND | LOCK_EX);

$url = rtrim((string)($CFG['site_url'] ?? ''), '/');
out(['ok' => true, 'project' => $project,
     'written' => $written, 'skipped' => $skipped,
     'url' => $url === '' ? null : ($dirName === '' ? $url . '/' : $url . '/' . $dirName . '/')]);
