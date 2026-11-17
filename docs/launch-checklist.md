# Launch checklist

Indexing stays off (`SITE_INDEXABLE=false`) until **the owner** ticks every line below and then sets the repository variable `SITE_INDEXABLE` to `true`.
The indexable build refuses to publish while any unconfirmed value (`data-pending`, `"pending": true`) is left, so a missing item shows up as a failed deploy
and the live site keeps its last good version. Check with a scratch build: `SITE_INDEXABLE=true npm run build` must pass.

## Content the owner must supply or confirm
- [ ] Steam time and cooking instructions (the how-to-cook page and the product windows).
- [ ] Real pack photos for both momo products (the current ones are stand-ins), and a photo of the turmeric yellow chutney (`frontend/assets/img/photo-chutney.webp`).
- [ ] Prices: the two packs, and the price of an extra chutney pot.
- [ ] Pickup hours and the pickup area wording; the private pickup address in Settings, Pickup details.
- [ ] Ingredients and allergens entered for **every** product, and "I have checked the allergen and ingredient information" ticked for each (a product cannot be shown without it).
- [ ] The free chutney pot sizes in Settings, Ordering (or leave empty), and the customisation fee and wording.
- [ ] The final brand name and logo (the name is still a placeholder; if it changes the logo wordmark must be redone and `ORG.name` in `scripts/build.mjs` updated).
- [ ] Her answers to the story questions in `docs/brand-direction.md`, section 7.
- [ ] Instagram address in `siteConfig.socialLinks.instagram` (optional; the line stays hidden while empty).

## Legal and food business
- [ ] Council registration done; hygiene rating, if any, and where it is shown (decision D-018).
- [ ] **Privacy notice** (`/privacy`) and **terms of sale** (`/terms`) read and approved. They are written from what the site really does, but a solicitor or the council
      should confirm: the retention period for order details, whether a named data controller and an address must appear, wording on allergy information and on
      refunds or cancellations (nothing is stated about them), and that the statement about WhatsApp and text messages fits how you really contact customers.
- [ ] Then link both pages in the footer, remove them from `alwaysNoindex` in `scripts/build.mjs` if they should be indexed, and rebuild.

## Working end to end (do these on a phone, on the live address)
- [ ] A real test order from the shop: it appears in the admin Orders page by itself, with the right total, the free chutney pot, any customisation fee and pickup time.
- [ ] Confirm, Ready, Collected and Cancel each open WhatsApp with the right message; the text-message and copy fallbacks work; the return strip looks right.
- [ ] Cancelling returns the stock; a pre-order and a same-day order behave as expected.
- [ ] Publish works (Settings are set: `GITHUB_DISPATCH_TOKEN`, `BUILD_STATUS_TOKEN`, `ALLOWED_ORIGINS`, `GITHUB_REPO`).
- [ ] The WhatsApp number +44 7413 069241 is also her WhatsApp number (decision D-030).
- [ ] Order number format SS-DDMM-NN is as wanted (decision D-032).

## Accounts and safety
- [ ] Supabase: public sign-ups are off and the only user is the owner's admin account; the initial password has been changed (Settings, Account).
- [ ] The repository holds no secrets (checked in Step 5: none found). The Supabase secret key and the GitHub token are only in Supabase secrets and GitHub secrets.
- [ ] Weekly CSV export understood: the free Supabase plan has no automatic backups, so Orders, Export is the backup.
- [ ] The GitHub token expires after one year: the reminder is set.

## Switching on
- [ ] `SITE_INDEXABLE=true` set by the owner; deploy is green; `robots.txt` allows crawling and `sitemap.xml` lists home, shop and how to cook.
- [ ] Only then submit the site to Search Console.
