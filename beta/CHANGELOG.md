# Fitty changelog

## v2.7 (beta)
- **Seasonal storage:** Wardrobe → Storage. Put pieces away (one tap for all summer or all winter pieces, or toggle one in its editor). Fits that need a stored piece sit out of suggestions, the week plan and combo ideas. When the weather turns, Today tells you which stored fits suit it.
- **Share a fit:** a share button on suggestions and in the fit editor makes an image card (Post 4:5 or Story 9:16) with the pieces, weight and colors. It follows your language and theme.
- **Device to device:** Settings → Send / Receive. Scan a QR code on each device and everything (photos included) copies directly over your Wi-Fi. No files, no server. If there's no camera, you can paste the code as text instead.
- **Fixed:** on narrow phones the Settings page was slightly wider than the screen, so windows opened from it had buttons cut off.
- The beta runs at /fitty/beta/ with its own copy of your data, so testing never changes the main app.

## v2.6
- **Arabic (العربية):** switch in Settings → Language. The whole app is translated: screens, windows, toasts, weather, color names, What's new.
- **Right-to-left layout:** in Arabic, menus, cards, sliders, the calendar and movable windows all flip to read right to left.
- **Arabic fonts:** IBM Plex Sans Arabic for text and Noto Naskh Arabic for headings. Numbers stay as 0–9.
- Dates use Iraqi month names (تشرين الثاني…). City search returns Arabic place names.
- Your choice is remembered on this device. Fit and piece names you typed are not translated.

## v2.5
- **Best-quality cut-outs by default:** the full-detail AI model (~88 MB) replaces the compressed one (~44 MB). It gives more accurate edges and handles tricky backgrounds better.
- **Settings → Cut-out quality:** Best or Fast.
- **Full resolution:** photos are kept at 1024 px, the AI's own working size, instead of 900 px.
- **No more outlines:** edge pixels that mix garment and floor are unmixed (recolored to the garment, made partly transparent). That removes the thin light or dark line around clothes.
- **True colors:** kept pixels take their color from the original photo, so areas the AI was unsure about no longer look smudged.
- **Fixed:** the cleanup now learns background colors from the original photo. Before, it only worked on dark backgrounds, because the AI blanks the color of pixels it removes.
- Switching to Best needs a one-time ~88 MB download (Settings → Download now, best on Wi-Fi). After that it works offline.

## v2.4
- **Cleaner background removal on busy backgrounds** (speckled floors, patterned rugs, textured stone). After the AI runs, Fitty now:
  - learns the background colors and drops pixels the AI was unsure about that match them;
  - keeps only the shape(s) that look like the clothing (solid and fairly central), removing scattered leftovers and frame-like rings around the garment;
  - makes the garment fully solid where the AI left it half see-through;
  - keeps pairs together (e.g. both shoes).
- Runs in the background worker and adds less than 0.1 s.
- **Redo cut-out** button on pieces that already have a cut-out. It re-runs from the original photo, so older cut-outs can get the new cleanup.

## v2.3
- **Log what you're actually wearing.** Under the suggestion, tap **Wearing something else? Log it**, then pick one of your fits or **New outfit**.
- A new outfit opens the editor as *Today's outfit*. **Save & wear today** adds it to your Fits and logs it for the day in one step.
- Works for **Tomorrow** too, and from **History**: tap an empty past day, then **New outfit**, to log a day you forgot.
- Logging a different outfit for a day replaces what was logged before, so it's always one outfit per day.

## v2.2
- **Fixed: photos turning into "?" after editing a piece on iPhone/Safari.** Photos are now stored as raw bytes instead of Blobs, which avoids a Safari bug that deleted the photo data when a piece was saved again.
- Existing photos are converted automatically the first time v2.2 opens.
- Photos the browser had already lost can't be recovered. Those pieces show **📷 add photo again**; tap one and add the photo once.

## v2.1
- **Piece window** (new/edit piece) can be dragged and minimized like the fit editor, and the page behind stays usable. On phones, a minimized window sits above the tab bar.
- **Offline background removal fixed:**
  - The AI model is now always saved for offline use. Before, the first download could be missed.
  - Settings shows **Ready offline** or a **Download now** button.
- **Photos added without internet** show "⏳ cut-out when online" and get cut out automatically when you reconnect.
- **Wardrobe always shows the cut-out:**
  - "Remove background" on an existing piece is saved right away, even if you close the window without pressing Save.
  - Pages refresh when a cut-out finishes.
- **Pages refresh** with fresh data every time you switch tabs, tap the current tab, or come back to the app.
- **Removed:** the price field, cost-per-wear stats and the currency setting.

## v2.0.1
- Renamed from FitBud to **Fitty** (logo, app name, home-screen name, backup files). Your data and old backups still work.

## v2.0
**How did it feel?**
- After you wear a fit, the Today screen asks: 🥶 too cold, 👌 just right, or 🥵 too hot. You can also rate any past day from the History calendar.
- Fitty learns from your answers:
  - **Personal bias:** if you're often cold, every day is treated a little colder (up to ±5 °C), so heavier fits get picked.
  - **Per-fit correction:** a fit that keeps leaving you cold counts as lighter than its label (up to ±1.5).
- The weather card shows the "for you" temperature, and the fit editor shows a fit's learned weight.
- Settings → *Learn from "How did it feel?"* lets you turn learning off or start over.

**Combo ideas**
- Fits → **Ideas** mixes tops and bottoms you've never worn together. It adds matching shoes, and outerwear on cold days.
- Ideas are ranked by color match, tomorrow's weather, and how under-used the pieces are.
- **Save as fit** opens the editor already filled in. **Not for me** hides that combo for good.

**Color matching**
- Each piece's main color is detected from its photo, or from its name ("Black jeans", "قميص أبيض"). You can also pick it yourself from 21 clothing colors.
- Every fit gets a verdict (*Great match / Good match / Bold / Might clash*) with a reason, e.g. "Navy + beige — easy neutrals".
- Color dots appear on pieces, fit cards, suggestions, and in the fit editor.
- Pieces saved before v2 get their colors filled in automatically.

**Week planner**
- Today → **Week** plans the next 7 days from the 7-day forecast.
- The usual cooldown and shared-piece rules apply across the whole week.
- **Swap** any day. **Wear** today's or tomorrow's planned fit straight from the list.
- The Today/Tomorrow suggestion follows your plan.

**Wardrobe stats**
- History → **Stats** shows:
  - days logged, fits/pieces, % of wardrobe worn in 30 days, % "just right" days
  - most worn fits and pieces
  - **collecting dust** (pieces not worn in 30+ days)
  - usage by category
  - your color palette
  - a comfort summary

**Also**
- A one-time "What's new" popup after updating.

## v1.2.1
- Theme switch moved to Settings → Appearance (Light / Dark / System).

## v1.2
- The fit editor can be dragged and minimized (⌄), and the page behind stays usable.
- Light and dark mode.

## v1.1.x
- Background removal runs in a background worker, so the page no longer freezes.
- Photos are decoded off the main thread.
- The pieces window can be dragged and minimized.
- Updates install reliably and reload automatically.

## v1.0
- First release: wardrobe, fits, weather-aware recommendations, cooldown, groups, history, export/import, offline install.
