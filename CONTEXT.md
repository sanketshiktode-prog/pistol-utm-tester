# Search Ops Toolkit — what a new session needs to know

Read this first, then `index.html` and `backend.gs`. Everything below is
settled: it was decided, built and tested, and reversing any of it will
break something that already works.

## What this is

A single-page tool for PropertyPistol's paid search and Demand Gen launches.
It builds tracking URLs, keywords, ad copy, creatives and the full campaign
structure, and deploys straight into Google Ads through the API.

- **`index.html`** — the whole product. Markup, one stylesheet, one script.
  Served from GitHub Pages at `sanketshiktode-prog.github.io/pistol-utm-tester/`.
- **`backend.gs`** — every bit of Google Ads logic. Fetched at runtime by a
  small loader in the user's Apps Script, so the script itself is never pasted
  again.
- **`Code.gs`** — NOT in this repo and must never be. It holds the developer
  token, client ID, Gemini key and account IDs, and lives only in Apps Script.
  This repo is public.

Build stamp is in `#buildTag` near the top of `index.html`. Bump it with every
push, or the user cannot tell whether a hard refresh picked up the change.

## The eight tabs

1. Tracking URLs · 2. Keyword wrapper · 3. Ad copy · 4. Assets ·
5. Full structure · 6. Meta ads · 7. Deploy to Google Ads · 8. Creative studio

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
- **One URL or one keyword per custom segment.** Mixing signals makes a
  segment match neither well.
- **Location goes on the campaign** for both channels.
- **RERA is a legal notice.** It appears on every creative, in the same place,
  at the same size relative to the width — one navy band at the foot, drawn
  after the layout, never by the layout.

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

Six layouts in `CR_DRAW` (`header` is the default), four sizes: square
1200×1200, portrait 960×1200, landscape 1200×628, story 1080×1920.

- Scale is `S`. On a wide canvas it comes off the **width**, not
  `min(W,H)` — sizing for height left 1.91:1 type at about half size.
- `crFit` reads the **px value** out of the font string. Parsing the weight as
  the size silently wrecked every fitted line once.
- The layout is handed `H - crBandH(W)`; the legal band owns the rest.
- Several heroes upload at once. Each is adapted to all four sizes and becomes
  its own Demand Gen ad. The logo is uploaded once and shared.
- Sets live in memory only — four JPEGs are megabytes and localStorage is
  about five in total.

## What this session cannot reach

The container's egress allows package registries and GitHub, nothing else.
Blocked: `script.googleapis.com`, `oauth2.googleapis.com`, `accounts.google.com`,
`cdnjs.cloudflare.com`, `fonts.googleapis.com`, `cdn.propertypistol.com`.

So: **the map, the fonts and any Google call cannot be exercised here.** Their
data paths can be simulated and must be; the rendering cannot. Say which of
the two was actually tested rather than implying both.

## How to test before pushing

Playwright drives the real page; Chromium is at
`/opt/pw-browsers/chromium-1194/chrome-linux/chrome` (`--no-sandbox`).
`jsdom` works too but is slow.

Every push should clear all of these:

- 6 layouts × 4 sizes render, 0 failures, 0 page errors
- Search ZIP still 11,512 bytes
- Demand Gen plan builds; no demographic left as a criterion
- Both-channel build returns to the channel it started on
- Project save and reopen rebuilds the structure

A simulation against a stubbed API proves the request shape, not that Google
accepts it. Those are different claims; keep them apart when reporting.

## Working style

Hinglish, direct, decisive. One consolidated answer, not options.
Build it, test it, push it, then say what changed — and say plainly what was
verified and what was only simulated.
