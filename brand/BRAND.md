# Trigger — brand guidelines
*by PropertyPistol*

## The name

**Trigger.** Not "Trigger by PropertyPistol" in running text — it is **Trigger**,
and PropertyPistol is the house it comes from. The endorsement appears in the
lockup and on the sign-in screen, not in every sentence.

- Correct: "Build it in Trigger." "Trigger deploys straight to Google Ads."
- Wrong: "TRIGGER", "trigger" (lower case), "Trigger®", "The Trigger Tool"

The name is the pistol's trigger. That is the only joke in the brand and it
does not need explaining anywhere in the product.

## The mark

A crosshair: a ring, four ticks, a solid centre. It says targeting, which is
what the tool does — keywords, audiences, locations, radii — and it sits
naturally beside a pistol.

It is drawn with four parts and nothing else, because anything finer turns to
mud at 16px. Do not add a shadow, a gradient, an outline or a fifth element.

**Files**

| File | What it is |
|---|---|
| `trigger-mark.svg` | The mark on its navy tile. The default. |
| `trigger-mark-glyph.svg` | The mark with no tile, for your own background. |
| `trigger-mark-mono.svg` | One colour, inherits `currentColor`. Embroidery, stamps, single-ink print. |
| `trigger-lockup.svg` | Mark + wordmark + endorsement, horizontal. |
| `trigger-mark-{16,32,64,192,512}.png` | Favicon and app icon sizes. |
| `trigger-lockup-{760,1520}.png` | The lockup, raster. Use these anywhere the font cannot be guaranteed. |

## Colour

| Role | Hex | Where |
|---|---|---|
| Pistol Orange | `#FB6A02` | The mark's ring and ticks. Primary buttons. One accent at a time. |
| Deep Navy | `#14213D` | The tile, the wordmark, body type, dark bands. |
| Paper | `#F6F4EF` | Light grounds. |
| White | `#FFFFFF` | The mark's centre. Type on navy. |
| Muted | `#6B7280` | The endorsement line, secondary notes. |

Orange is an accent, never a field colour behind long text. Navy carries the
weight; orange says where to look.

## Type

- **Display and wordmark** — Archivo, 800 weight, letter-spacing −0.02em.
- **Body and UI** — Inter, 400/500/600.
- **Code, IDs, numbers you check** — IBM Plex Mono.

All three are free on Google Fonts. The lockup SVG asks for Archivo; if it is
not installed the spacing is wrong, so use the PNG for anything that leaves
your machine.

## Clear space and minimum size

- **Clear space** on all four sides of the mark: the width of one tick
  (one tenth of the mark). Nothing enters it.
- **Minimum size**: the mark 16px, the full lockup 120px wide. Below that, use
  the mark alone.

## Using it with PropertyPistol

Trigger is endorsed, not co-branded. The Trigger mark leads; "by
PropertyPistol" sits under the wordmark at roughly a third of its size, in
Muted. Do not set the two logos side by side at equal weight, and do not put
the Trigger mark inside the PropertyPistol logo or the other way round.

## What not to do

- Do not recolour the mark outside the palette above.
- Do not stretch it. It is square; keep it square.
- Do not rotate it. A tilted crosshair reads as an error state.
- Do not place it on a busy photograph without its navy tile.
- Do not outline the wordmark or set it in another face.
- Do not add a tagline to the lockup. If you need one, it goes beside the
  lockup, not inside it.

## If you would rather generate your own

Here is a brief you can hand to an image model. Expect to redraw whatever it
gives you as vectors — a model will not produce a mark that survives 16px, and
it cannot be trusted with the exact hexes.

> A flat vector app icon, 1:1, for a Google Ads campaign tool called
> "Trigger" by an Indian real estate brokerage. A rounded-square tile in deep
> navy #14213D with a 23% corner radius. Centred on it, a crosshair in bright
> orange #FB6A02: one heavy ring, four short ticks at top, bottom, left and
> right, not touching the ring, and a solid white dot at the centre. Even
> stroke weight throughout, no gradient, no shadow, no texture, no text.
> Generous margin between the crosshair and the tile edge. Must stay legible
> at 16 pixels.
