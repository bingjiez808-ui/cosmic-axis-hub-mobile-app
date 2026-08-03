# Static Asset Provenance

## `public/assets/life-guidance/`

| File | Origin | Licence / usage |
| --- | --- | --- |
| `destiny-library-hero.png` (+ `.webp`, `-mobile.webp`) | OpenAI ImageGen original asset, created for Fate Nexus (Destiny Library). | Project-owned original artwork — used as the immersive backdrop for the Curator's Letter on the landing page. Not stock photography; do NOT claim photographic copyright. |
| `historical-echo-gallery.png` (+ `.webp`, `-mobile.webp`) | OpenAI ImageGen original asset, created for Fate Nexus (Destiny Library). | Project-owned original artwork — used as the backdrop for the "Historical Echoes" gallery on `/me/home`. Same licence as above. |

WebP variants are 78–72 quality re-encodes of the PNG originals (`cwebp -q 78` /
`cwebp -q 72 -resize 900 0` for the `-mobile` variants). PNGs are kept as the
`<img src>` fallback so browsers without WebP still get the artwork.

Any future assets in this folder must follow the same recipe: keep the PNG as a
fallback, ship a WebP (and an `-mobile` variant when the asset is used above the
fold), record the origin here, and never assert stock-photography copyright.
