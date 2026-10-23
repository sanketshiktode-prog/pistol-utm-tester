# Trigger — what a new session needs to know

The tool is called **Trigger**, by PropertyPistol. It was "Search Ops Toolkit"
until 23 Oct 2026; the repository is still `pistol-utm-tester` and renaming it
would break the GitHub Pages URL, so it stays. Brand files are in `brand/`.

Read this first, then `index.html` and `backend.gs`. Everything below is
settled: it was decided, built and tested, and reversing any of it will
break something that already works.

## What this is

A single-page tool for PropertyPistol's paid search and Demand Gen launches,
called Trigger.
It builds tracking URLs, keywords, ad copy, creatives and the full campaign
structure, and deploys straight into Google Ads through the API.

- **`index.html`** — the whole product. Markup, one stylesheet, one script.
  Served from GitHub Pages at `sanketshiktode-prog.github.io/pistol-utm-tester/`.
- **`backend.gs`** — every bit of Google Ads logic. Fetched at runtime by a
  small loader in the user's Apps Script, so the script itself is never pasted
  again.
- **`lp/`** — the landing page builder, served from `/lp/` on the same Pages
  site so it shares the domain and the sign-in. It was a separate repository
  until 23 Oct 2026.
- **`Code.gs`** — NOT in this repo and must never be. It holds the developer
  token, client ID, Gemini key and account IDs, and lives only in Apps Script.
  This repo is public.

Build stamp is in `#buildTag` near the top of `index.html`. Bump it with every
push, or the user cannot tell whether a hard refresh picked up the change.

## The nine tabs

1. Tracking URLs · 2. Keyword wrapper · 3. Ad copy · 4. Assets ·
5. Full structure · 6. Meta ads · 7. Deploy to Google Ads · 8. Creative studio ·
9. Landing page

## Things learned the hard way — do not re-litigate

**Demand Gen is not Search with a different `advertisingChannelType`.**

- No `networkSettings` at all. The API rejects the Search network block.
- `demandGenCampaignSettings.upgradedTargeting` is a real, settable, and
  **immutable-after-creation** bool. It defaults to true, which moves location
  and language onto the ad group. This account targets on the campaign for
  both channels, so it is created `false`.
- `ProximityInfo` (radius) exists **only** on `CampaignCriterion`. There is no
  such field on `AdGroupCriterion`. That alone forces `upgradedTargeting:false`.
- A demographic **exclusion** is illegal at every level, whichever way
  targeting is set. Campaign: *"The Criterion is not allowed to be excluded"*.
  Ad group: *"Audience segment attachment is not allowed when use audience
  grouped bit is set to true"*. They go inside an `Audience` resource as
  **inclusions** — the toolkit inverts the exclusions on the way in.
- Household income enums count percentiles **from the bottom**:
  `INCOME_RANGE_90_UP` is the top 10%, `INCOME_RANGE_0_50` is Lower 50%.
  Never print the raw boundaries; the UI shows Google's own band labels.
- A custom segment is created through `customAudiences:mutate`, its own
  endpoint — `custom_audience_operation` does not exist in `MutateOperation`.
  Always send `partialFailure: true`, and dedupe names before sending: Google
  refuses an entire batch that carries one name twice.

**Operation ordering.** Temporary resource names are negative integers,
parents must come before children, and operations of the same type must be
contiguous — the API starts a new backend call wherever the type changes.

**Nothing is claimed until the API confirms it.** Everything is created
paused by default. Whatever a campaign type refused is reported as a note,
never dropped silently between the plan and what Google received.

## House rules that come from the user, not from Google

- **Search nomenclature is frozen.** It is the account's SOP. The Search ZIP
  export is byte-identical at **11,512 bytes** for the standard test brief —
  that number is the regression check. If it moves, something broke.
- **Search headlines**: pinned position 1 is the ad group's own keywords.
  Pinned position 2 is reserved for configuration and price, using ₹,
  "Starting At", "From", "Onwards" or "|" — never generic nouns like Homes,
  Flats or Apartments.
- **Search descriptions**: pin 1 is project + configuration + price +
  location in a proper sentence. Pin 2 is USP + CTA.
- **Demand Gen headlines** must each carry brand, project AND location inside
  40 characters. One that cannot is flagged, never quietly dropped.
- **Spacing loses the whole campaign.** Google treats a comma with no space
  after it as `UNACCEPTABLE_SPACING`, a PROHIBITED policy topic: the ad is
  refused and the campaign is all-or-nothing, so it rolls back with it. Every
  string that ships as ad text goes through `adText()`. An Indian number keeps
  its commas (1,70,000) and a colon is left alone (30:70); a list does not
  (2,3 & 3.5 BHK becomes 2, 3 & 3.5 BHK). Anything that reads ad text straight
  off an input rather than through `brief()` — `locList()` is the one that
  caught us — has to tidy it itself.
- **One URL or one keyword per custom segment.** Mixing signals makes a
  segment match neither well.
- **Location goes on the campaign** for both channels.
- **RERA is a legal notice, and it goes top right.** The Creative Guidelines
  say so outright: number top-right, QR beside it, portal URL directly below
  the number, "consistent placement across every creative format". It is drawn
  after the layout by `crReraTop`, never by a layout, and every layout caps its
  lockup out of that corner with `crReraW(W)`.
- **The price is the strongest element on the creative.** The deck says it
  every time. It carries the palette accent on dark, the ink on light.

## The mini CRM — removed

There was one, briefly, on 23 Oct 2026, because the internal development team
had not given us a POST API for the company CRM. It was taken out the same day:
the user does not want lead storage here. Do not bring it back without being
asked. What survived the removal, and should stay:

- `lp/builder/template.js` keeps the **widened attribution capture**. Trigger's
  tracking templates use PropertyPistol's SOP parameter names — `ads_set_name`,
  `campaign_name`, `keyword_type`, `physical_location`, `ad_strategy`,
  `source_key`, `ads_group_id` — not Google's ValueTrack names, and the page's
  original capture regex matched almost none of them. The PHP connector and the
  Cloudflare Worker both flatten `attribution` on the way to TeleCRM, so
  anything the page drops is lost to the real CRM too. The cap went from 40
  parameters to 60: that one template alone sends 15.

## The landing page builder

`lp/` builds the project microsite and exports a folder for GitHub Pages or
cPanel. Two lead backends, picked per project under **Leads, OTP & CRM**:
**cPanel PHP** and **Cloudflare Worker**. Both are tested on every change.

The builder is **also still live at its old standalone URL**, from the
`lpbuilder` repo. That copy is old code: no two-way link, no keyword FAQs, and
the narrow attribution capture that drops PropertyPistol's own parameters.
Anyone reaching for the builder should use `/lp/`.

## Landing page relevance, and the link between the two tools

Both apps are served from one GitHub Pages site — Trigger at the root, the
builder at `/lp/` — so they **share an origin, and therefore localStorage**.
That is the whole mechanism of the link between them. No server, nothing
uploaded, and no URL length limit:

- `pp_lp_handover` — Trigger → builder. Written when "Send this project to the
  builder" is pressed; the builder reads it only when opened with
  `#handover=1`, then deletes it. **Used once on purpose**: a plain reload must
  not overwrite what has since been typed.
- `pp_lp_fromBuilder` — builder → Trigger. Written on every save, so there is
  nothing to press on that side. "Pull back from the builder" fills the
  campaign brief from it, splitting `location` back into micro-market and city.

Images never travel in either direction — far too large, and they belong in the
builder anyway.

**The FAQs are written from the keywords, not from the project.** Quality Score
is three things, and landing page experience is the one the page can be made to
earn: the page has to answer what was searched, in the words it was searched in.
So `faqBuild` reads the keywords out of `PLAN` — what will actually deploy, not
the wrapper output — matches each against `FAQ_INTENTS` (price, configurations,
floor plans, location, amenities, offer, RERA, possession, developer, review,
brochure, about), and writes one question per intent carrying the searcher's own
terms.

- **Answers come only from the brief.** A question the brief cannot answer is
  listed as unanswered and left out, never filled with a guess. A wrong
  possession date on a landing page is a legal problem, not a typo — and it is
  the same house rule as everywhere else: never invent a price, a date or a
  registration number.
- `faqSubject` has to name the project. "3 bhk flats in vadgaon" leaves only
  "vadgaon" once the intent words and filler go, and a question about Vadgaon is
  a question about nothing in particular, so the project goes back in front:
  "Vyana Vadgaon". An intent marked `fix:true` (the developer one) always names
  the project outright — "kolte patil builder pune" is asking about the project,
  not about the builder's own builder.
- `FAQ_STOP` is for coverage, `FAQ_FILLER` only for naming the subject. A page
  that says "flats" IS more relevant to "flats", so filler words still count
  when coverage is measured.
- **`faqCoverage` is the pre-deploy check.** It builds the text the page will
  actually carry — brief, USPs, amenities, landmarks and the FAQs — and reports
  which of each keyword's own words are missing from it. Those are the keywords
  Google marks down for landing page experience, and the list is worth acting on
  before the campaign goes live, by putting the term on the page or dropping the
  keyword.

Possession lives in two places now, because it belongs to the page rather than
the campaign: `#lpPoss` on Trigger's Landing page tab, and `about.possession` in
the builder. It travels both ways with everything else.

## The strategy codes

`Op` (open, no segment) · `In`, `luxury`, `invest`, `avid` (library segments) ·
`KB` keyword brand · `KC` keyword competitor · `KG` keyword generic ·
`UB` URL brand · `UC` URL competitor · `YB` YouTube brand ·
`YC` YouTube competitor · `news-portal`, `property-portal-url` (URLs) ·
`news-app`, `property-portal-app` (apps)

Several strategies share a signal type, so the **box is the strategy** —
`CS_BUCKETS` in `index.html`. One box, one strategy, one signal type, and the
segment name is built, never typed.

## The creative renderer

Nine layouts in `CR_DRAW` (`header` is the default), four sizes: square
1200×1200, portrait 960×1200, landscape 1200×628, story 1080×1920.

Palettes (`CR_PALETTES`) and typefaces (`CR_FONTS`) are picked per project and
are taken from the Creative Guidelines deck, not invented — each palette is one
of the colour schemes that deck states in words, each typeface pair one of the
four registers it keeps asking for. `crRenderOne` sets `INK`, `PAPER`, `RED`,
`CR_DISP` and `CR_BODY` for the duration of a render. Never name a face
directly in a `g.font` string; go through `F_H` / `F_B`, or the picker stops
working for that one line. `crFontsReady()` is awaited before a render: a
webfont that has not finished loading is silently swapped for the fallback and
nothing anywhere reports it.

- Scale is `S`. On a wide canvas it comes off the **width**, not
  `min(W,H)` — sizing for height left 1.91:1 type at about half size.
- `crFit` reads the **px value** out of the font string. Parsing the weight as
  the size silently wrecked every fitted line once.
- `crHero` never paints flat sky-and-ground gradient bands. That treatment put
  visible horizontal seams across the elevation and left the picture marooned
  in the middle of a 9:16. A full-bleed box past `CR_MAX_ZOOM` is filled with a
  blurred, darkened copy of the same picture with the sharp copy feathered into
  it; a column or an arch (`bleed` false) still cover-crops, because cropping
  the sides of a wide render to fill a tall column is exactly right there.
- The RERA mark has no plate behind it — it is set straight onto the picture
  with a shadow of the opposite tone. The QR keeps its white quiet zone; a
  scanner needs that one.
- An uploaded logo almost always carries the developer and the project, so the
  typed names are not printed beside it unless the toggle is turned off.
- The header row holds the logo and the legal mark. Nothing else goes there —
  the location belongs with the copy.
- Several heroes upload at once. Each is adapted to all four sizes and becomes
  its own Demand Gen ad. The logo is uploaded once and shared.
- A developer lockup is wide and short. Sizing a logo by height alone and
  trusting the width tears one apart — `crLogoBox` fits it into the real space
  between the left margin and the legal mark. The logo is never recoloured,
  faded or filtered: contrast comes from a scrim across the top of the canvas,
  never from touching the mark. A logo saved as a JPEG carries a white box,
  which is flood-filled out from the edges.
- Nothing promotional sits on the elevation. Badges go in a header or a band.
- A band's height is measured from what goes in it (`crBandNeed`) and its
  contents are laid out in order down it (`crBandFill`). Positioning them
  independently is what made them print on top of each other.
- Sets live in memory only — four JPEGs are megabytes and localStorage is
  about five in total.

## The design agent

The split is the whole point and must not drift:

- **The canvas draws everything exact.** RERA number, scannable QR, price,
  configuration, the developer's own logo pixels, the four exact sizes. None of
  it is sent to be re-imagined. An image model cannot reproduce an uploaded
  logo, cannot be trusted with a digit of a registration number, and cannot
  draw a QR that scans.
- **The model judges only craft**, from the finished picture: collisions,
  cropping, legibility, badges over the elevation, balance, and which of the
  toolkit's own layouts and palettes suit this render.
- **It may only pick settings the toolkit already offers.** `AI_ALLOWED` in
  `backend.gs` whitelists layout, palette and font by id and clamps scrim and
  fill to 0-100; everything else it tries to set is dropped before the answer
  reaches the page. It has no way to change a word of copy.
- **The engine is Gemini**, through `generativelanguage.googleapis.com/v1beta`
  `:generateContent`, because the Apps Script already carries a `GEMINI_KEY` for
  the landing-page reader — one key, one bill. Renders go up as `inline_data`
  JPEG parts, the brief goes in `system_instruction`, and
  `generationConfig.responseMimeType` is `application/json` so the answer parses.
- **No model name is hard-coded, ever.** `gemini-2.0-flash` and `gemini-2.5-flash`
  were both retired under us and the 404 in the browser was the first anyone
  heard of it. `aiModels_()` asks `v1beta/models` what this key can actually run,
  ranks the answers (newest stable flash first; preview, lite, embedding, gemma,
  aqa and image models lose or are excluded), caches the pick in
  `GEMINI_MODEL_CACHE` for a day, and on a 404 forgets the cache and
  re-discovers once. Both the design agent and the landing-page reader go
  through it. A 403 or a 429 does not retry, because retrying cannot help.
- **Every failed attempt is reported, not just the last.** The first version
  kept only the final error, so a retired model two rungs up was invisible.
- The key is read from a `GEMINI_KEY` Script Property first, then from the
  `GEMINI_KEY` in `Code.gs`. Never in this repository, which is public.
  `GEMINI_MODEL` pins one model and skips discovery.
- Renders are shrunk to a 1024px long edge before they are sent — about a
  quarter of the tokens, and no worse at spotting a collision.

A reviewer cannot catch what it is not shown: the logo bugs survived three
rounds because the renders had no logo in them. Fix the input first.

## What this session cannot reach

The container's egress allows package registries and GitHub, nothing else.
Blocked: `script.googleapis.com`, `oauth2.googleapis.com`, `accounts.google.com`,
`cdnjs.cloudflare.com`, `fonts.googleapis.com`, `cdn.propertypistol.com`,
`generativelanguage.googleapis.com`. (`storage.googleapis.com` was opened by the
user for ElevenLabs downloads.)

So the design agent's request **shape** can be proved here and is, against a
stubbed `UrlFetchApp` — four `inline_data` parts, JSON mode, the whitelist
dropping off-menu keys, the model fallback, 403/429 not retrying. Whether
Gemini accepts it is a separate claim and can only be settled in the browser.

So: **the map, the fonts and any Google call cannot be exercised here.** Their
data paths can be simulated and must be; the rendering cannot. Say which of
the two was actually tested rather than implying both.

## How to test before pushing

Playwright drives the real page; Chromium is at
`/opt/pw-browsers/chromium-1194/chrome-linux/chrome` (`--no-sandbox`).
`jsdom` works too but is slow.

**Render with a logo uploaded.** Three rounds of creative bugs came back about
the logo — cropped, oversized, faded, in the wrong corner — and every one of
them survived because the test harness set the developer and project as TEXT
and never put an image in `CR.logo`. A logo-less render exercises a code path
the user never uses. `/home/claude/logo-wide.png` (a wide two-mark lockup, the
shape that actually breaks things) and `logo-white.jpg` (a logo with a white
box baked in) exist for this. A creative change is not tested until both have
been through all nine layouts.

**Look at the renders.** Not "0 failures" — the picture. Every defect in the
issue decks was visible at a glance in an image the harness had already
written to disk.

Every push should clear all of these:

- 9 layouts × 4 sizes render, 0 failures, 0 page errors, with a logo loaded
  and again without one
- Search ZIP still 11,512 bytes
- The FAQ generator: one question per intent, answers only from the brief, a
  missing field reported rather than invented, and coverage flagging a term the
  page never says
- The round trip in one browser context, both ways: Trigger → builder → Trigger,
  with the handover used once and a reload keeping the edit
- The page still captures PropertyPistol's own tracking template, all 15
  parameters, as well as Google's auto-tagging
- Demand Gen plan builds; no demographic left as a criterion
- Both-channel build returns to the channel it started on
- Project save and reopen rebuilds the structure

A simulation against a stubbed API proves the request shape, not that Google
accepts it. Those are different claims; keep them apart when reporting.

## Working style

Hinglish, direct, decisive. One consolidated answer, not options.
Build it, test it, push it, then say what changed — and say plainly what was
verified and what was only simulated.
