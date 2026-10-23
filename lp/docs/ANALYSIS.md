# Reference page analysis: godrejforestestatenagpur.com

This is a section-by-section breakdown of the PropertyPistol microsite template (Godrej Rivershore Estate), showing how the builder reproduces and improves each section.

| # | Section | What the reference does | Conversion job | Builder implementation |
|---|---------|------------------------|----------------|------------------------|
| 1 | **Sticky header** | Logo, anchor nav (Home, Price, Site Plan, Amenities, Gallery, Location, Brochure), phone, WhatsApp | Keeps call and brochure CTAs visible at all times | Fixed header with scroll-spy nav, phone, and a pulsing "Enquire Now" button. On mobile it becomes a burger menu. |
| 2 | **Hero** | Video banner plus a card with "New Launch" badge, name, "at <location>", "By <developer>", a stats table (Land Parcel / Units), 4 USP bullets, "Starts at ₹55 Lacs* Onwards", Enquire Now, RERA numbers, and Site Visit / Call buttons | Qualifies the visitor in 5 seconds: brand, location, price, and trust | Image slider or video, the same card structure (up to 3 stats), a gradient price box, RERA lines, and an optional offer strip above the hero. |
| 3 | **Right-side "Request Call Back" form** | A form that is always visible on desktop | Captures leads at any scroll depth | Fixed 340px side panel (≥1100px) with Site Visit, Call, and Brochure buttons, the form, and a "We promise" list. |
| 4 | **About** | Long SEO copy with "Read more" and a Request Brochure CTA | SEO keywords plus a brochure lead | Text collapses when it is longer than 700 characters. A brochure CTA opens the gated modal. |
| 5 | **Area & Pricing** | Cards showing Type, Size range, Price range + "Onwards", and a "Complete Costing Details" button | Captures the highest-intent lead (price breakup) | Pricing cards. Each CTA opens the modal with the configuration attached to the lead's `form_source` (for example `costing:Plot 1,401–1,600`). |
| 6 | **Master Plan** | Image with a "Request Master Plan Layout" button | Gated content that pulls a lead | Blurred image with a lock overlay. It unlocks for that visitor after any submission. |
| 7 | **Unit Plan** | Image with a "Request Unit Plan Layout" button | Gated content | Grid of blurred plans with labels. They unlock after submission. |
| 8 | **Amenities** | Image carousel with captions (12 items) | Shows lifestyle proof | Horizontal snap carousel with arrows. Amenities without a photo show as icon tiles. Includes a "Get Complete Amenities List" CTA. |
| 9 | **Gallery** | Tabs (Exterior…) and image grid | Visual proof | Category tabs, a masonry-style grid, and a lightbox with next/prev. |
| 10 | **Location Advantage** | Map image with a "Request Location Map" button, plus a connectivity list (place: distance) | Removes location objections | Gated map image or a Google Maps embed, a scrollable connectivity list, and a "Request Location Details" CTA. |
| 11 | **Schedule a Site Visit** | Image + inline form | Captures bottom-funnel leads | Split card with an image and a form. The source is tagged `site-visit-form`. |
| 12 | **About PropertyPistol** | Agent copy, RERA number, GST | Trust and compliance | Agent section with RERA/GST line. |
| 13 | **Mobile sticky bar** | Call, Enquire, and WhatsApp buttons | One-tap action on mobile | Bottom bar with a safe-area inset. |
| 14 | **Enquiry modal** | "We Promise: Instant Call Back / Free Site Visit / Unmatched Price". The side panel text changes with the CTA ("Get information on availabilities", "Descriptive brochure") | One modal serves every CTA | A context-aware modal: title, subtitle, side-panel text, and button label change for each of 9 contexts. It becomes a bottom sheet on mobile. |
| 15 | **OTP verification** | "Verify OTP" step | Filters out junk numbers | Optional OTP step. The lead is stored **before** OTP, so no lead is lost, and it is pushed to the CRM only after verification. |
| 16 | **Footer** | Logo, QR code, agent and project RERA numbers with the RERA link, long disclaimer, privacy link | Compliance | Same structure. The disclaimer is auto-generated if left empty. |
| 17 | **Tracking** | GTM (`PGB66GRZ`) and WhatsApp redirect with UTM/IP | Attribution | GTM, GA4, Google Ads conversion (fired on the thank-you page), and Meta Pixel. UTMs, gclid, gbraid, wbraid, fbclid, and msclkid are captured into every lead. `dataLayer` events are pushed: `lead_submit`, `lp_modal_open`, and `lp_click_call` / `lp_click_whatsapp`. |

## Improvements over the reference

- **Thank-you page redirect.** This gives clean Google Ads and Meta conversion tracking. The lead ID is passed as `transaction_id` so conversions are not double-counted.
- **Auto popup and exit-intent popup.** Each fires once per session and never fires after a visitor has converted.
- **Validation.** Indian mobile numbers must match `[6-9]XXXXXXXXX`, and a leading `0` or `91` is stripped. Country-code selector covers India and the GCC. Includes a honeypot field against bots.
- **SEO.** FAQ section with FAQPage schema, Residence JSON-LD, canonical and OG tags, and a sitemap and robots.txt in the export.
- **Performance.** Images are compressed to WebP in the browser. The hero image has `fetchpriority=high` and everything else is lazy-loaded. There is no jQuery and no framework; the page runtime is about 7 KB.
