# Step 4q — Messaging fallback, same-day pickup, stock labels and pre-orders (decision D-071)

Prerequisite: merge `origin/main` first; Steps 4n, 4o, 4p may already be merged (4q does not depend on 4l, run it before or after). Read `CLAUDE.md`, D-031, D-034, D-038, D-045, D-056, D-063, D-071 and the code you change (`admin/js/orders.js`, `js/whatsapp.js`, `frontend/js/pickup.js`, the cart, the product card and dialog, the admin product editor, the order and prep functions in `backend/supabase/migrations/` and `place-order`). Owner rules: write the code; run the build once and only the tests for what you changed; look at your own 390 px screenshots; the owner tests real WhatsApp on her phone.

## Part A — Messaging bugs (admin)

**What the owner saw:** she cancelled a test order, WhatsApp opened for a number that has no WhatsApp account and said so; there was no way to message that number another way. After coming back, the browser showed a blank page (`about:blank`) instead of the admin.

Cause (in `changeStatus`): a blank window is opened with `window.open('', '_blank')` before the status is saved and pointed at WhatsApp afterwards. The blank tab stays behind when WhatsApp (app) takes over.

1. **Never pre-open a blank window.** Save the status first, then take her to the message in a way that leaves the admin tab intact: first choice, a normal navigation of the same tab to the WhatsApp link (`location.assign`), so Back returns to the admin; if the platform shows a stray page (such as the wa.me interstitial) instead of the admin when she returns, use the approach that avoids it. The acceptance rule, not the technique, decides: **after sending or abandoning the message, switching back to the browser shows the admin Orders screen, no blank tab, no leftover wa.me page.** Keep one tap per status change (D-056). Where a tab cannot be avoided (desktop), open the link from a real click, never from an empty window.
2. **Return strip:** before leaving, remember in `sessionStorage` which order and message was just opened. When the admin becomes visible again (`pageshow` and `visibilitychange`) show, on that order card, a small strip: "Message to NAME opened. Didn't go through?" with three buttons: **Send as text message**, **Copy message**, **Done**. It disappears on Done, after Send as text or Copy, or after she opens another order message. Wrap storage in try/catch.
3. **Text message link:** `sms:NUMBER?&body=ENCODED` (the `?&body=` form works on iPhone and Android); the number in international form with `+`. The wording is the same message she would have sent on WhatsApp.
4. The order's existing **Message** button opens the same three choices (WhatsApp, Text message, Copy message), plus the existing call link. Reuse one small component for both places.
5. Customers with an invalid phone number: keep today's toast, and also offer Copy message.
6. Do not claim to detect whether a number has WhatsApp (it cannot be detected). Wording: "Didn't go through?".

## Part B — Same-day pickup for in-stock items

1. Set `min_lead_hours` to **1** in `0004`-style seed data and in the live database by a new migration that changes it only while it still has the old default (24); report the old value you found. Standard-only carts use it; customised carts keep `custom_min_lead_hours` (D-031).
2. The admin Ordering section label for this setting: "Minimum notice for in-stock items (hours)" with a short help line: "1 means a customer can order now and collect an hour later, inside your pickup hours. Close a day in Pickup hours if you are away." No other new settings.
3. **Verify** (do not rebuild) that a closed day (D-063) offers no pickup times and that exceptions still block dates, and that the picker offers today's remaining times starting one hour from now, in her windows only.
4. **Show the earliest pickup** on the cart (and the checkout form): "Earliest pickup: today from 6:30 pm" (or the next open day and time), computed from the same rules the picker uses, in `pickup.js`, no duplicate logic. If the rules cannot be loaded, show nothing. No invented times.

## Part C — Stock labels (public site)

Product card and product dialog: nothing when stock is above `low_stock_threshold`; "Only N left" at or below it; "Sold out" at 0 unless the product is open for pre-order (Part D). Make sure the cap in the stepper and the server check (already in place) agree. Do not show the exact stock when plentiful.

## Part D — Pre-order when sold out

**Rules:** only when stock is 0. Per product, off by default.
1. **Data (new migration, next free number):** on `products` add `preorder_enabled boolean not null default false`, `preorder_ready_date date null`, `preorder_limit integer null` (null = no limit); on order lines add `is_preorder boolean not null default false`. Keep explicit grants and RLS as everywhere else; the public product read exposes only the three new product columns if the products read is already public.
2. **Admin product editor** (Availability area, same single page): "Allow pre-orders when sold out" switch; when on, a **Ready from** date (required, today or later) and an optional **Limit** (how many she will take for the batch, blank for no limit); one line of help: "Customers can order for this date or later. Pre-orders do not use your stock." Validation message in plain words. A pre-order product whose date has passed behaves as sold out and the editor shows it in red with "Set a new ready date".
3. **Public:** at stock 0 with pre-order on and a valid date, the card and dialog show "Pre-order · ready from SAT 22 NOV" (UK date style, existing date helper) instead of "Sold out", the button reads "Pre-order" (still Add to cart under the hood), and the line in the cart is labelled "Pre-order, ready from DATE". The pickup picker for a cart containing any pre-order line offers only dates on or after the latest ready date among those lines (and still inside her hours and the usual lead rules); say why in one line above the picker. Mixed carts (in stock plus pre-order) are allowed and use that rule. Quantity per pre-order line is capped by the limit minus pre-orders already taken for that batch (count open pre-order lines; cancelled and collected ones do not count), and by `max_qty_per_item`.
4. **Server (place-order and its database function):** re-check everything the client checked: stock is 0 now, pre-order is on, the date is valid, the pickup date is on or after it, the limit has room, option rules as before. Pre-order lines are saved with `is_preorder = true` and **never touch stock**; cancelling or re-opening an order (D-045b) must skip pre-order lines. A line that was in stock when the customer opened the page but sold out by the time of ordering is rejected with a clear message (existing behaviour), not silently turned into a pre-order.
5. **Admin orders and prep list:** a small "PRE-ORDER, ready from DATE" badge on the order card and on the line; the prep list (D-045a) shows pre-order totals separately from in-stock totals per pickup day. The WhatsApp message templates need no new placeholder; the pickup date is already in them.
6. **Receipt (done page and downloaded text):** pre-order lines say "Pre-order, ready from DATE".
7. Mock/demo backend and seed data follow the same rules so the demo still works. No pre-order is enabled in the seed.

## Do not

Add accounts, notifications or "notify me" lists, change prices, invent opening hours or ready dates, add new settings beyond those above, or touch Part A flows for other messages.

## Report (under 20 lines)

What changed in each part; how you checked Part A (say plainly that real WhatsApp, a number without WhatsApp, and the Back/switch-app return could only be fully tested by the owner on her phone, and list the exact steps for her); the old `min_lead_hours` value you found; one screenshot-based note on the cart's earliest pickup line and on a pre-order card at 390 px; migration number; the workflow run for the backend deploy. Update the tracker, merge to `main`, confirm both deploys.
