# Fitty changelog

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
  - **cost per wear** (add a price to pieces; currency in Settings, default IQD)
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
