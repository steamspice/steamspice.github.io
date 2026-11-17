# Step 4s — Ingredient pills, one customisation fee, change password (decision D-073)

Run this **before Step 4l**. Prerequisite: Step 4n is merged. Merge `origin/main` first. Read `CLAUDE.md`, D-031, D-052, D-054, D-062, D-065, D-066, D-073, `backend/README.md`, the migrations (ingredients, options, order functions), `place_order`, the product editor, the shop product dialog, the cart, the receipt, the prep list and `scripts/build.mjs`. Owner rules: write the code; run the build once and only the tests for what you changed (database tests once); look at your own 390 px screenshots; the owner tests the live site.

## Goal

Ingredients are managed like allergens (pills), in two kinds per product. Customers see them in the product window; they can leave out only the removable ones. Customising adds one flat fee she sets. She can change her own password in the admin.

## 1. Data (new forward-only migration; never edit older ones; keep explicit grants and RLS)

- A shared **ingredient library** (`ingredients`: id, name unique case-insensitively, sort_order) that she can add to, rename and delete, filled from ingredient names already used by products.
- Per product: the product's ingredients with a **`removable` boolean** (default false = always included) and an order. Keep the existing product ingredient data and migrate it: existing ingredient tags become always included; options that were in a "Leave out" group become removable ingredients of that product (create library rows as needed). Report exactly how many of each you migrated and anything you could not map.
- **Customisation fee:** setting `customisation_fee_pence` (integer, default 0) and an optional text setting `customisation_note` (her own wording for the shop, can be empty), readable by the public site like the other public settings.
- Order lines keep a **snapshot** of the ingredients left out (names) and, per order, the fee charged on each line (`customisation_fee_pence` on the line, 0 if not customised), so later edits never change old orders.
- Per-option prices (`price_delta_pence`) are retired: stop using them in the UI and in `place_order` (the server ignores them and the fee is the only customisation price). Keep the column; do not drop anything. Old orders keep their snapshots.

## 2. Order rules (server is the authority; client previews)

- A cart line is **customised** if any removable ingredient is left out or any non-default option is chosen. Customised lines use the customised lead time (D-031) as today.
- The server rejects a left-out ingredient that is not a removable ingredient of that product.
- The fee is charged **once per customised line**, regardless of quantity and of how many changes it has; two lines of different products each pay it; two separate customised lines of the same product each pay it. Fee 0 means no extra charge. Prices, totals, stock, limits and pickup rules otherwise unchanged. The total shown to the customer, the stored total and the receipt all agree to the penny.

## 3. Admin

- **Product editor (single page, stays one page):** replace the ingredients card with two pill groups: **Always included** and **Can be left out**. Add by typing with suggestions from the library (Enter adds the pill, a new name creates a library entry); each pill has a remove (x), and a small control to move it to the other group. Keep the permanent allergen reminder and the "I have checked the allergen and ingredient information" safeguard. Remove the "Leave out" option-group editing from the editor; other option groups stay as they are.
- **Ingredient library screen:** Products, Manage menu gets **Ingredients** (the Manage menu comes with Step 4l; if 4l is not merged, add a quiet "Manage ingredients" link in the product editor and move it into the Manage menu when 4l runs). Add, rename, delete (shows how many products use it), search. Renaming updates products.
- **Settings, Ordering section:** a "Customisation fee" field (pounds, shown and saved as pence), with help: "An extra amount added once for each customised item type in an order, however many changes. Leave empty for no extra charge." and an optional "Note shown to customers" text field with the placeholder showing the default wording the shop uses when empty (see section 4).
- **Settings, new Account section:** shows the signed-in email and **Change password**: current password, new password, confirm new password, show/hide on each, Save with a loading state. Verify the current password by signing in again with it, then update the password through Supabase Auth; plain-words errors (wrong current password, passwords do not match, too short); minimum length is a named constant (12). Success toast. No email flow. Add a small line: "Forgot your password? Ask the owner to reset it." (the email reset only reaches Supabase org members, D-059). Log out stays reachable. Never log or store the password anywhere.
- Orders, prep list and receipts show "Without: onion, coriander" on the line and a separate "Customisation +£X" line.

## 4. Shop

- **Product window:** a section "What's in it" with pills. Always-included pills are greyed with a small lock; tapping shows a short note under the pills: "Part of the recipe, so it can't be left out." (no popups, no alert). Can-be-left-out pills are toggles: tap to leave out (the pill shows a clear left-out state, such as struck through, with the word "Left out" for screen readers); tap again to put it back. All pills are keyboard accessible and real buttons.
- A customised choice shows one small line "Customisation +£X" using the fee from settings; the Add button total includes it once. If the fee is 0 or unset, show nothing about price. The note shown under the pills is her `customisation_note` if set, otherwise the default "Leaving something out or choosing a different option adds £X once for this item, however many changes you make." shown only when the fee is above 0. Nothing about the fee is hard-coded.
- **Cart and checkout:** each customised line shows "Without: ..." and, below the items, the fee as its own line "Customisation +£X (Chicken momo)". Receipt (page, download, print) likewise.
- No ingredient or allergen text is invented: when a product has no ingredients entered, hide the section (D-052).
- Mock/demo backend and seed data follow the same rules.

## Do not

Add accounts, change allergen handling, invent ingredients or fees, touch the pickup, stock, pre-order or messaging code, or drop old tables or columns.

## Tests (database tests once)

Fee once per customised line independent of quantity and change count; different products charge separately; fee 0 charges nothing; left-out ingredient must be removable and belong to the product; tampered price or fee rejected; old order snapshots survive renaming and deleting an ingredient; migration produced the same shop result for existing products; RLS (anonymous cannot write).

## Report (under 25 lines)

Migration names, how many ingredients migrated as fixed and as removable and anything unmapped; how the fee works with two examples checked (one line quantity 3 with 2 changes, and chicken plus veg both customised); screenshot-based notes at 390 px of the product window and the cart; the password change tested against the real project with the owner's test account only if you can, otherwise say it needs the owner; the deploy runs. Update the tracker, merge to `main`, confirm both deploys.
