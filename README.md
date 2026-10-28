# CONCITO — The Big Climate Database

## Sprint 2: Figma design integrated into the working project

This is the existing Team 6 Node.js project with its frontend adapted to the **Agile_TEAM-6 / Prototype sprint 2** Figma design. The UI is in English, matching the mockup.

**Figma source:** https://www.figma.com/design/ydOlutiTy0osqqfftnJeQY/Agile_TEAM-6?node-id=169-119

### Four implemented screens

- `landingpage` / `#home`: illustrated hero, country/category filters, searchable food table, colored CO₂ badges, expandable food information and an **Add to meal** action.
- `meal_calculator` / `#calculator`: ingredient auto-suggestions, add/remove rows, numerical quantity entry, grams/kilograms selector, validation, and Calculate button.
- `meal_calculator_results` / `#results`: calculated per-ingredient climate emissions and a recipe total, with a back control to edit the recipe.
- `about` / `#about`: original information layout, documentation link, and CONCITO context.

All screens share the original cream/yellow/orange/green color palette from Figma, a desktop 1440px reference layout, responsive styling, and a common header and footer. The original illustration assets were exported from the supplied Figma file into `public/assets/`, including the hero foods, meal plate, footer illustration, category imagery and CONCITO/2-0 LCA logos. The interface requests the Satoshi typeface from Fontshare; when offline it falls back to local fonts.

### Requirements and start

Node.js **18 or newer**, without any additional npm packages.

From the project directory:

```bash
npm start
```

Open **http://localhost:3000** in your browser. On Windows, `start.bat` is an alternative; on macOS, `start.command`; on Linux/macOS, `./start.sh`.

### Where the data comes from

The backend `server.js` retains the original official data integration. It downloads published food rows from https://thebigclimatedatabase.com and caches successful downloads under `cache/`. Values from the official source use kg CO₂e per kg of food; the calculated emission is:

```
kg CO₂e for one ingredient = quantity in grams / 1000 × total kg CO₂e per kg
recipe kg CO₂e = sum of all ingredient emissions
```

A live internet connection may be needed the first time the official database loads. **If the official database cannot be fetched and there is no existing cache, the UI falls back to seven illustrative examples taken from the Figma mockup.** A visible alert and source label identify this as **demo mode**, not official data. Calculations in demo mode should not be used as authoritative estimates.

The code preserves the official backend rather than replacing it with static fake records. The meal editor stores entered rows in browser local storage to avoid losing work when navigating between screens.

### Files changed / retained

- `public/index.html`: all four page templates and shared site navigation.
- `public/css/styles.css`: Figma visual system and responsive layouts.
- `public/js/app.js`: UI navigation, search/filter, ingredient editor and score rendering.
- `public/assets/*.png`: genuine Figma-exported visual assets.
- `server.js`: original server, parser and database/cache integration **retained**.
- `tests/`: original parser test **retained**.

### Tests

```bash
npm test
node --check public/js/app.js
```

The browser flow was also smoke-tested: search suggestions, select food, enter 250g, calculate and display the resulting CO₂ score. Mobile/tablet CSS is included, but the 1440px Figma desktop frames remain the reference for exact placement.

### Official sources

- Food database: https://thebigclimatedatabase.com
- CONCITO: https://concito.dk/denstoreklimadatabase
- Methodology PDF: https://www.thebigclimatedatabase.com/static/core/pdfs/Methodology_report_the_big_CLIMATE_DATABASE_FINAL.pdf
- CC BY 4.0: https://creativecommons.org/licenses/by/4.0/


## Visual illustrations — Sprint 2 v4

The former gray-and-white checkerboard placeholders now contain two decorative animated scenes. The calculator features an animated ingredient crate with a selected-ingredient counter and progress bar; the About page features a food-to-climate illustration. Original Figma food assets are reused and animated with CSS. Both panels respect `prefers-reduced-motion`, and no external libraries are required for the effects. These decorative scenes do not alter the CO₂ calculations.
