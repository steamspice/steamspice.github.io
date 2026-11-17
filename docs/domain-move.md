# Moving to a custom domain (decision D-015, D-070)

The site lives at `https://steamspice.github.io/` (admin at `/admin/`). A custom domain means the same four changes as the last move. Nothing in the code
hard-codes the host: canonical links, the sitemap, `robots.txt`, the share image and the structured data are all built from `SITE_URL`.

Do not buy or set up a domain until the owner decides. Steps, in order:

1. **Buy the domain** from a registrar of your choice. Keep the registrar login with the owner.
2. **GitHub Pages**: repository `steamspice/steamspice.github.io`, Settings, Pages, Custom domain: type the domain and save. Add the DNS records GitHub shows
   at the registrar (four `A` records for the bare domain, or a `CNAME` for `www`). Wait for the DNS check to go green, then tick **Enforce HTTPS**.
   GitHub redirects the old `steamspice.github.io` address to the new domain by itself.
3. **Repository variable** `SITE_URL` (Settings, Secrets and variables, Actions, Variables): set it to the new address with no trailing slash, for example
   `https://www.example.co.uk`.
4. **Supabase**, so the shop can still place orders and the admin can still log in:
   - Edge Functions, Secrets: add the new address to `ALLOWED_ORIGINS` (comma separated, no path). Keep the old one until the move is finished.
   - Authentication, URL Configuration: set the **Site URL** to the new address and add `<new address>/admin/reset` to the Redirect URLs.
5. **Rebuild**: Actions, "Deploy to GitHub Pages", Run workflow. Then check on a phone: home, shop, an order, the admin login.
6. **After the move**: open `<new address>/sitemap.xml` and `robots.txt` (they must show the new address), view the source of the home page and check the canonical and
   `og:image` lines, then update any profile that links to the shop (Instagram, WhatsApp profile, Google Business). If indexing was already on, add the new
   address to Search Console and use its "Change of address" only if the owner asks.

`GITHUB_REPO` and `GITHUB_DISPATCH_TOKEN` (the Publish button) do not change, because the repository does not move.
