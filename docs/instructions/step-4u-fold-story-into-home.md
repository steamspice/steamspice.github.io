# Step 4u — Fold Our story into the home page (decision D-075)

Small step. Merge `origin/main` first. Read D-074 and D-075. Write the code, run the build once, run only the tests for files you changed, look at your own 390 px and 1440 px screenshots of the home story block.

1. Remove the "Read our story" button from the home story block.
2. Remove the `about` page completely: its file, header and footer links, sitemap entry, link-check entries, structured data and any build step for it. Nothing else may link to it. No redirect is needed (it was never public or indexed).
3. Keep all of the story text on the home page. If anything that was only on the page (for example the "Made by hand at home, with fresh ingredients" line) is missing from the block, add it there as one short line under the paragraphs. Do not add facts, photos or new sections. Keep the block's look and the text size; let it grow in height as needed.
4. Update the FAQ or any other text that pointed to the story page.
5. Update `docs/progress-tracker.md`, commit, merge to `main`, confirm the deploy.

Report in under 8 lines.
