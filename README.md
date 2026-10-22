# Jay Damask art portfolio

Add `.jpg`, `.jpeg`, `.png`, `.webp`, `.gif`, or `.avif` images to `art/`, then commit and push them to the GitHub Pages branch. The home page lists each image automatically after GitHub Pages rebuilds and links to its larger artwork view. Files are ordered by filename, so prefixes like `01-`, `02-` set the order.

Titles come from filenames by default (`01-blue-sky.jpg` becomes “blue sky”). To edit an image page in the browser, open `/admin/` on the published site. This page is unlinked and excluded from search indexes. Sign in with a [fine-grained GitHub personal access token](https://github.com/settings/personal-access-tokens/new) scoped only to `Jayquavius/jaydamask`, with **Contents: Read and write**. The site keeps the token in the browser tab's memory, never in site files or local storage. Choose an image, add its title, details, and formatted page text, then select **Save and publish**. The editor commits `_data/artworks.json` to GitHub; GitHub Pages updates after its next build.

You can also edit `_data/artworks.json` directly. Entries are keyed by exact image filename:

```json
{
  "01-blue-sky.jpg": {
    "title": "Blue Sky",
    "year": "2026",
    "medium": "Oil on canvas",
    "dimensions": "24 × 30 in",
    "body": "<p>A note about the work.</p>"
  }
}
```

The `/admin/` address is only unlisted. GitHub checks the token when saving; do not put a password or token into this public repository. Use the editor on the HTTPS site, and revoke the token in GitHub settings if it is lost.
