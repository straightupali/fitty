# Fitty beta

This folder is a test copy of Fitty, served at https://straightupali.github.io/fitty/beta/.
It keeps its own data (database `fitty-beta`), so testing never touches the main app.
Settings → Beta → "Copy data from the main app" brings in a fresh copy of your real data.

To merge into the main app, copy these files over the main ones, then change:
1. `js/config.js`: `BETA = false`
2. `sw.js`: `CACHE_PREFIX = 'fitty-v'`
3. `manifest.webmanifest`: name and short_name back to `fitty`; drop `id`
4. Delete `BETA.md`
