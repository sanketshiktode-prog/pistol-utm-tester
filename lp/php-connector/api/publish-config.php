<?php
/* Trigger — publish settings. This file holds a secret: it must never be
   committed anywhere public, and the repository this shipped from is public.

   token        a long random string. Make one up, 40+ characters, letters and
                digits. It is the only thing standing between the internet and
                the ability to write files here, so do not reuse a password.
   root         where project folders are created. The default is the folder
                above this one, which on Hostinger is public_html.
   site_url     your site, so the builder can show you the live link.
   allow_origin the origin the builder is served from, so the browser is
                allowed to read the answer. Several may be listed, separated
                by commas. '*' echoes whatever origin asked.
*/
return [
  'token'        => 'PASTE_A_LONG_RANDOM_STRING_HERE',
  'root'         => dirname(__DIR__),
  'site_url'     => 'https://example.com',
  'allow_origin' => 'https://sanketshiktode-prog.github.io',
];
