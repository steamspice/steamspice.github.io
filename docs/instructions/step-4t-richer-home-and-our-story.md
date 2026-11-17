# Step 4t — Richer home page and Our story (decision D-074)

Prerequisite: merge `origin/main` first; run after Step 4s. Read `CLAUDE.md`, D-017, D-050, D-051, D-052, D-072, D-074, `docs/ui-rulebook.md` (sections 2, 2b and layout), `docs/brand-direction.md` (voice) and `docs/design/type-and-spacing-spec.md`. Owner rules: write the code; run the build once and only the tests for what you changed; look at your own screenshots (see Verify); no invented facts.

**The owner says the site looks empty, the text is small and too short.** Fix that with layout, size and her real facts below. Do not pad with invented claims, new AI images or decoration.

## Facts you may use (owner-supplied, nothing else)

- She has fond memories of cooking momo with her family in Nepal, and missed those moments living abroad.
- She wants to share the momo she learnt from her family with other people who crave momo.
- The aim: let people enjoy momo at home at a manageable cost, without the hassle, the time or the expense of a restaurant.
- Made by hand, at home. Fresh ingredients.
- Frozen, 40 pieces a pack, ready to steam at home. One free chutney pot comes with every order.
- Pickup only, in Leicester. Exact address is shared by WhatsApp after she confirms the order. Pay cash on pickup.
Not available yet and so **hidden, not shown as TODO** (D-052): fillings, steam time and how long to steam, storage and freezer life, allergens, photos of her, her kitchen or her real packs. Do not use the word "healthy". Do not call the AI images her kitchen, her food or her packs.

## 1. Text size and rhythm

Raise body text slightly through the type tokens only (for example 1.0625 to 1.125 rem fluid from phone to desktop) and secondary text no smaller than 0.9375 rem; check line length and heading steps still fit D-050's caps. Update `docs/design/type-and-spacing-spec.md` to match. Make sure no section leaves a blank gap larger than the top of the spacing scale; remove empty bands.

**Scroll-reveal must never hide content:** with JavaScript off, with reduced motion, and in a full-page capture, every section must be visible (reveal is an enhancement only). Fix any case where a section stays invisible.

## 2. Home page

- **Hero:** keep the headline "Taste like Nepal."; a two-sentence paragraph using the facts (made by hand at home, frozen and ready to steam, collect in Leicester, pay cash); the two buttons stay. The trust row becomes five short items at most (homemade, frozen, pickup only, pay cash, free chutney with every order), 2 columns on phones, a single row on wide screens, no row of identical rounded cards.
- **Our momo row:** the two packs are the main row, larger, filling the width (two columns on wide screens, stacked on phones). The chutney pot is a slim horizontal band under them (picture area, name, price marked per D-023, Add button), not a third half-width card. Keep the "Comes with a free chutney pot" line on the packs.
- **What comes in the pack:** a short block, not cards: 40 pieces, frozen, ready to steam at home, a free chutney pot, pickup in Leicester. Pair it with the single-momo cut-out image.
- **Our story (short):** a 3 to 4 sentence version of the story in warm plain UK English from the facts above, with a link "Read our story" to the new page.
- **How ordering works** (exists): keep, make sure the steps read as a clear numbered flow and the pickup line says Leicester and that the address follows on WhatsApp after confirmation.
- **FAQ:** six questions, answers from the facts only: How do I order? Do you deliver? How do I pay? What comes with my order? Are they ready to eat? Where do I collect? ("In Leicester. We send the exact address on WhatsApp once we confirm your order.") Native `<details>` elements, real HTML, plus `FAQPage` structured data built from the same text at build time. Do not add allergen, storage or steam-time questions yet.
- Keep the existing quiet statement band. Do not add reviews, ratings, counts, awards or "since" dates.

## 3. Our story page (`about`, clean URL, no extension)

Header and footer link "Our story". Page title, description and structured data per `docs/seo-rulebook.md` (it stays noindex while `SITE_INDEXABLE` is false). Content: the story in her voice as a short page of three or four short paragraphs from the facts above (memories of cooking with family in Nepal; missing them abroad; wanting to share what she learnt with others who crave momo; momo at home at a manageable cost without the hassle, time or restaurant expense), a small "Made by hand at home, with fresh ingredients" line, and two buttons ("See the momo", "How to cook"). Decorative use of the single-momo cut-out only; no kitchen or portrait image. Add it to the sitemap and the link checks.

## 4. Settings and data

A public setting `pickup_area_text` (default "Leicester") editable in the admin Pickup details; the home hero, tile, FAQ, order flow and receipt read it instead of repeating the word. Keep the exact address in the existing private address setting (shown only in the WhatsApp messages as today). Do not add other settings.

## 5. Do not

Invent any fact (see the list), add photos or AI images, use "healthy", touch checkout, pickup rules, pre-orders, messaging, fees or admin screens other than the one setting, or break clean URLs and the noindex gate.

## Verify

Build once. Open the built site and look at home, Our story and the FAQ at 390 and 1440 px **after scrolling through the whole page** (so reveals have run), check no horizontal scroll, no empty gaps, contrast of text over the blurred background stays at least 4.5:1, and the page works with JavaScript off. Report (under 20 lines): sections added, the new type sizes, the pickup setting, what you saw at each width, any text you could not write because a fact is missing.
