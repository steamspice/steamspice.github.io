# Step 4r — Free chutney with every order, no hot sauce (decision D-072)

Prerequisite: merge `origin/main` first (Steps 4n to 4q may or may not be merged; adapt to what is there, do not redo them). Read `CLAUDE.md`, D-023, D-031, D-052, D-054, D-069, D-072 and the code you change. Owner rules: write the code; run the build once and only the tests for what you changed; look at your own 390 px screenshots; the owner tests the live site.

**Facts from the owner (do not add to them):** one chutney pot comes free with every order; the pot size varies with the size of the order, but the sizes and thresholds are not known yet. Extra chutney pots can be bought, price to be decided later. There is no hot sauce.

## 1. Remove the hot sauce everywhere

Seed data, demo backend, the shop and home product lists, product dialogs, the home Sauces tile copy ("Add our chutney or hot sauce" and similar), the how-to-cook line "Serve with chutney or hot sauce if you have it", the admin fallbacks, tests, `docs/design/image-manifest.md` and structured data. Add a migration that deactivates and hides (does not delete) any live `hot-sauce-pot` product and its stock row, so old order history keeps its name; if there are no orders for it you may delete it, say which. Do not show the red `photo-sauce.webp` anywhere (the chutney is turmeric yellow); keep the file in the repo, unused, until the owner says what it is. In the home Sauces tile show the drawn placeholder or no picture, never the red photo.

## 2. Tell customers what they get

Plain wording, no invented sizes:
- Product cards and dialogs for the momo packs: one short line, "Comes with a free chutney pot".
- Cart and checkout: a visible line "Free chutney pot, included with your order" with price £0.00 (shown as "Free"), placed under the items; if the size list (section 3) has an entry that matches the cart, add its label in brackets, for example "(medium)". It is not removable and not counted in the item total.
- Done page, receipt (download and print) and the admin order card, prep list and WhatsApp item summary: the same line.
- Home Sauces tile: rewrite the copy to say chutney comes free with every order, extra pots can be added. Chutney ingredients and allergens stay `TODO:` (hidden by the existing rule) until supplied.
- `chutney-pot` stays a paid add-on for **extra** pots, with its sample price marked as a sample (D-023).

## 3. Size rule, editable by her (starts empty)

- New setting `included_chutney_tiers`: an ordered list of rows (`min_packs` integer, `label` text, for example "Small"). Empty by default. Packs means lines of kind `pack`, summed by quantity; pre-order lines count.
- Admin: in the Ordering section, a small block "Free chutney pot size": add, edit and delete rows ("From [N] packs: [label]"), with help text "Leave empty to show just 'Free chutney pot'." The label is plain text, trimmed, max length from a named constant.
- The rule picks the row with the highest `min_packs` that is not above the cart's pack count. No match means no label.
- Keep the setting readable by the public site the same way the other public settings are, with explicit grants and RLS; no new secrets.

## 4. Server and orders

The order function adds one free line to every order that contains at least one pack: name "Free chutney pot", price 0, size label if any, `is_included = true` (new column on order lines, default false), so receipts and the admin can tell it apart. It does not change totals, stock, option rules or limits, and cancelling or re-opening an order ignores it. An order with only extra chutney pots (no pack) gets no free pot. Validate on the server; the client is a preview.

## Do not

Invent pot sizes, thresholds, grams, prices or allergens; add stock tracking for the free pot; add a hot-sauce replacement; change the pre-order or messaging code from Step 4q.

## Report (under 15 lines)

Where hot sauce was removed and what the migration did to live data; the new setting and where it is edited; one 390 px screenshot-based note on the cart with and without a size label; migration number; the backend deploy run; any place you could not match the wording. Update the tracker, merge to `main`, confirm both deploys.
