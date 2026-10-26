# Jay Damask art portfolio

Open `/admin/#upload` on the published site to upload one or more images or videos from your browser. Sign in with the repository token described below, choose files, then select **Upload and publish**. The upload page accepts `.jpg`, `.jpeg`, `.png`, `.webp`, `.gif`, `.avif`, `.mp4`, `.webm`, and `.mov` files up to 90 MB each. MP4 with H.264 video is the most broadly playable format. A batch is saved in one GitHub commit. Existing filenames are kept safe by adding a number to new files when necessary.

You can also add those files directly to `art/`, then commit and push them to the GitHub Pages branch. The home page lists each file automatically after GitHub Pages rebuilds and links to its larger artwork view. Videos play with controls on their detail page. Files are ordered by filename, so prefixes like `01-`, `02-` set the order.

Titles come from filenames by default (`01-blue-sky.jpg` becomes “blue sky”). To edit an artwork page in the browser, open `/admin/` on the published site. This page is unlinked and excluded from search indexes. Sign in with a [fine-grained GitHub personal access token](https://github.com/settings/personal-access-tokens/new) scoped only to `Jayquavius/jaydamask`, with **Contents: Read and write**. The site keeps the token in the browser tab's memory, never in site files or local storage. Choose a work, add its title, details, and formatted page text, and select **Save and publish**. All pieces are included in **Selected Works** by default; uncheck **Include in Selected Works** and save to exclude one from the default home gallery. Visitors can uncheck **Selected Works** on the home page to see the full collection. The editor commits `_data/artworks.json` to GitHub; GitHub Pages updates after its next build. Reload the editor after an upload to see the new work in the editing list.

You can also edit `_data/artworks.json` directly. Entries are keyed by exact image filename:

```json
{
  "01-blue-sky.jpg": {
    "title": "Blue Sky",
    "year": "2026",
    "medium": "Oil on canvas",
    "dimensions": "24 × 30 in",
    "selected": true,
    "body": "<p>A note about the work.</p>"
  }
}
```

The `/admin/` address is only unlisted. GitHub checks the token when saving; do not put a password or token into this public repository. Use the editor on the HTTPS site, and revoke the token in GitHub settings if it is lost.
