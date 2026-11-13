# fitty

Picks your outfit so you don't have to. Works on desktop and phones, installs like an app, runs offline, and keeps all your data on your own device.

## How it works

- **Wardrobe:** every piece (top, bottom, outerwear, shoes, accessory) is saved once and can be reused in many fits.
- **Fits:** an outfit made of pieces. Each fit has a **weight** from 0 (light, for hot days) to 5 (heaviest, for cold days) and an optional **group**.
- **Recommendation** (Today / Tomorrow): `score = weather match × cooldown × shared-piece penalty`, then a weighted-random pick so you get variety.
  - **Weather:** the average of the day's high and low "feels like" temperature (from Open-Meteo) gives a target weight. The default mapping is ≥33° → 0, 27–32° → 1, 21–26° → 2, 15–20° → 3, 8–14° → 4, <8° → 5, and you can edit it in Settings.
  - **Cooldown:** a fit you wear is blocked for 2 days, then fades back in over 7 days. A fit already planned for tomorrow is also blocked for today.
  - **Shared pieces:** wearing the jeans in one fit also lowers other fits that use them. Tops, bottoms and outerwear count fully, shoes count half, accessories don't count.
  - **Accept** logs the date. **Skip** hides that fit until the next day.
- **History:** a calendar of what you wore. Tap a past day to log a fit you forgot, or to remove an entry.
- **Photos:** drag-and-drop, Ctrl+V, gallery, or phone camera. Backgrounds are removed on your device, in a background worker. The first time, this downloads an AI model of about 40 MB; after that it works offline.
- **How did it feel? (v2):** rate past days as too cold, just right, or too hot. Fitty learns a personal temperature bias and per-fit weight corrections.
- **Combo ideas (v2):** new top + bottom pairings from your own pieces, with matching shoes and outerwear, ranked by color, weather and how little the pieces get worn.
- **Color matching (v2):** colors come from photos or names, or you pick them, and each fit gets a Great match / Good match / Bold / Might clash verdict.
- **Week planner (v2):** a 7-day plan from the forecast that follows the cooldown rules. Swap any day.
- **Stats (v2):** most worn, collecting dust, category usage, color palette, cost per wear, and comfort.

See `CHANGELOG.md` for version history.

## Run locally

Any static server works:

```bash
cd fitty
python -m http.server 8000
# open http://localhost:8000
```

(Opening `index.html` directly from disk won't work, because ES modules and the service worker need a server.)

## Publish on GitHub Pages

1. Create a repo (for example `fitty`) and push the contents of this folder to the root of the `main` branch.
2. In the repo, go to **Settings → Pages → Source: Deploy from a branch → `main` / root**.
3. Open `https://<your-username>.github.io/fitty/` on any device.
   - **Android/Chrome:** menu → *Install app*.
   - **iPhone/Safari:** Share → *Add to Home Screen*.
   - **Desktop Chrome/Edge:** the install icon in the address bar, or Settings → *Install Fitty*.

**After you change any file**, bump `VERSION` in `sw.js` so installed copies pick up the update.

## Moving data between devices

Go to Settings → **Export backup** to get a `.json` file. On the other device, use **Import backup**. Records are matched by ID and the newer copy wins, so importing never wipes anything. Deleting something doesn't carry over through an import.

## Files

```
index.html            app shell
styles.css            all styling
js/app.js             UI: Today/Week, Fits, Ideas, Wardrobe, History/Stats, Settings, editors
js/recommend.js       scoring + picking (pure functions)
js/planner.js         week plan built on the recommender
js/learn.js           "How did it feel?" learning
js/colors.js          color detection, naming, harmony rules
js/ideas.js           new-combo generator
js/bg-worker.js       background removal worker
js/weather.js         Open-Meteo forecast + temperature → weight mapping
js/db.js              IndexedDB storage + export/import
js/images.js          resize, background removal, image cache
sw.js                 offline cache
manifest.webmanifest  install info
icons/                app icons
```

## Credits

- Weather: [Open-Meteo](https://open-meteo.com) (free, no API key).
- Background removal: [@imgly/background-removal](https://github.com/imgly/background-removal-js), loaded from a CDN at runtime. It's AGPL-licensed, which is fine for personal use. Check the license before using it in a commercial product.
