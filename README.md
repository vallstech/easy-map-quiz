# Map Quiz

Seterra-style world map quiz in a flat "esports / max-minimal" design. The finished game is a single `dist/index.html` (no server, no internet).

## Sources

    src/template.html     page shell: markup + the base (engine) stylesheet. No behaviour.
    src/skin.css          the design ("esports / max-minimal" skin)
    src/js/               behaviour, one file per concern
      core/config.js      map data, regions, view boxes, UI strings EN/RU, score rules, saved state
      core/map.js         builds the SVG for an embedded map; owns els/dots
      core/camera.js      pan/zoom, easing, mouse & wheel input
      game/game.js        rules of a running game: rounds, scoring, timers, finish flow
      game/keys.js        restart button + rebindable restart key, Escape
      ui/screens.js       start / pause / end screens, settings controls
      ui/panel.js         Interface panel (button UI, F2) + performance tweaks
      main.js             boot: apply settings, load a map, restore a saved game
    src/panel.js          legacy monolith — unused; build.py falls back to it only if src/js/ is gone
    build.py              inlines everything into dist/index.html

`build.py` concatenates the modules in the order listed in `LAYOUT` / `JS_ORDER` / `JS_FILES`
at the top of the file and inserts each one under a banner naming its source file, so the
built `index.html` can still be read as a whole. The modules share one function scope
(classic scripts, not ES modules) — hence `const`/`let` are not redeclared across files.
Load order matters: config first, main.js last.

## 1. Get the map data (once)
Download Natural Earth **Admin 0 – Countries** as GeoJSON (110m and 50m) and put them in `data/geojson/` under these names:
- `data/geojson/110.geojson` — low detail: small and fast
- `data/geojson/50.geojson` — high detail: better for zooming, but heavier and may slow the game down; it also contains a different set of countries

Source: https://github.com/nvkelso/natural-earth-vector (folder `geojson/`, files `ne_110m_admin_0_countries.geojson` / `ne_50m_admin_0_countries.geojson`; rename them).
One file is enough: the game shows only the detail levels that are present.

## 2. Build
    python build.py                                   # embeds every file in data/geojson/
    python build.py 110=a.geojson 50=b.geojson        # or pass files explicitly (key=path)

Result: `dist/index.html` — open it by double-click. Python 3 stdlib only.
In the game, **Map detail** on the start screen switches between the embedded maps; the choice is saved. Micro-states missing from a file are added by `build.py` as marker-only dots.

## Interface panel (button `UI` bottom-right, or F2; Esc closes)
Colours (11 variables), 4 presets (Cyber / Stealth / Amber / Light), font, UI scale, task name/flag size, corner radius, border width, map borders, micro-state dot size/visibility, click tolerance, rendering mode, HUD opacity, task and zoom-button position, show/hide of score / progress / attempts / zoom / menu / restart, free-form **Custom CSS**, Reset, JSON Export/Import. Saved in `localStorage` (`mapquiz.exp.ui.v1`).
Performance: no shadows, no per-path transitions, micro-state dot radius is one CSS variable per frame; optional "Hide borders while moving", "Reduce motion", "Crisp edges / Speed" rendering and an FPS counter.

## Clicks and camera
- A press only becomes a camera drag after the mouse travels more than the *click tolerance* (default 8 px, Interface panel); below that the camera does not move and the click counts. The country is the one under the spot where the press started, and it is picked on mouse-up, so sliding a few pixels over a border does not lose the click.
- Right click does nothing (no browser menu).
- Pause menu → **Lock camera**: wheel, drag, +/−, Reset, Zoom to region, the jump to a missed country and the camera return are all disabled; the view stays where it is (a new game still starts at its region view).

## 3. Flags
Flag emoji are drawn with the bundled font `data/fonts/flags.ttf` (a subset of Segoe UI Emoji with Twemoji flags, inlined into `index.html` by `build.py`), so they work on Windows too. Twemoji graphics are CC-BY 4.0 (https://github.com/twitter/twemoji). To use another font, replace the file; to skip it, delete the file.
Alternatively (instead of the font), put SVGs named by lower-case ISO2 code (`fr.svg`, `ru.svg`, …) into `data/flags/`
(e.g. from the MIT-licensed `flag-icons` package) and rebuild — they are inlined automatically.

## Where to change things
- Regions, view boxes for "Zoom to region": `VIEWS` in `src/js/core/config.js`
- Scoring: constants `BASE, PEN, BONUS, BTIME` (100 base, −25 per wrong try, up to +50 speed bonus fading over 10 s; skipped country = 0) — same file
- UI strings EN/RU: object `T` in the same file. Country names come from the browser's `Intl.DisplayNames` (offline), fallback — name from GeoJSON.
- Camera feel: `smoothF()` in `src/js/core/camera.js`
- On-screen timer: readout and its host panel in `src/js/ui/panel.js`, placement in the `/* ---- on-screen timer ---- */` block of `src/skin.css`
- Micro-state fallback coordinates and filters (which Natural Earth `TYPE`s count as countries): top of `build.py`

## Decisions made on ambiguous points
- Regions use Natural Earth's `CONTINENT` (Russia → Europe, Turkey/Cyprus → Asia). Disputed territories are used as in the source; only entities with an ISO2 code and type Sovereign/Country/Disputed are playable.
- Micro-states: any country whose bounding box is < 6 deg² (or missing geometry) gets an always-visible dot with a ~2.4× larger invisible hit area.
- Global-attempts mode: when the pool runs out the overlay appears; **Continue** then ends the game.
- Game time excludes pauses (menu, miss overlay). Dark theme only (no theme switch).
- Esc opens the pause menu. State is stored in `localStorage` key `mapquiz.v1`.
- Hard mode (checkbox on the start screen): found countries are not highlighted — they flash green and fade out over 1 s — and clicking an already-found country counts as a wrong try.
- Regions are multi-select (e.g. Europe + Asia); "Whole World" is exclusive. "Zoom to region" fits the union of the chosen regions' boxes.
- Repetitions (1–10): every country is asked that many times, as that many shuffled rounds; a round never starts with the country that ended the previous one, so the same country never comes twice in a row. Colours of found countries reset at the start of each round. Progress and "first try %" count every question.
- Optional switch "Show name of the wrongly clicked country": the −25 popup also shows the clicked country's name.
- Start screen is split into sections (What to play / Rules / Display & hints / Site).
- Sub-regions: the "Sub-regions" button opens a picker with UN sub-regions (from the GeoJSON `SUBREGION` field; micro-states added by `build.py` have their own mapping in `SUB`) plus Africa north/south of the Equator (decided by the centre of each country's main landmass, so countries that straddle the equator go where most of their centre lies). They combine (union) with the selected continents. "Central Africa" is Natural Earth's "Middle Africa".
- On Continue the camera stays where it is.
- "Mistake popup size" (Small / Medium / Large = 17 / 24 / 32 px, default Medium): clicking an option shows a live preview. Values are in `pop()` in `src/js/game/game.js`.
- "Return camera after a correct answer" (start screen and pause menu, same setting, default off): when on, the camera flies back to the starting view of the selected region(s) after each correct answer; when off it stays where you left it.
- "Camera smoothness" slider (0–10, default 3; start screen and pause menu share it): easing for every camera movement — wheel, drag, +/−, Reset, Zoom to region, focus on a missed country, camera return. 0 = instant, 10 = very floaty (dragging then glides after you release). Easing is frame-rate independent; formula in `smoothF()`.
- Game time in the final stats starts at the first click on a country (thinking time before it is not counted; pauses are never counted). The speed bonus is unaffected: it still measures time from the moment each country is shown.
- Restart: a "Restart (R)" button next to Menu during the game, and a configurable key (default R). Rebind it in the "Controls" section of the start screen or in the pause menu: click the key button, press the new key (Esc cancels, modifiers alone are ignored). Stored by physical key (`KeyboardEvent.code`), so it works on any keyboard layout. Ctrl/Alt/Cmd combos and typing in input fields do not trigger it. Restart uses the same regions and settings.

- Timer: the reported game time starts at the first click and never runs while the game is paused. Setting **"Stop timer when a country is lost"** (default on; start screen and pause menu): when a country runs out of tries and the Continue / Restart panel appears, the timer stops (on) or keeps running (off). Wrong tries while tries are left never stop it.
- On-screen timer (Interface panel → Timer): show/hide, position, size, tenths. It shows the same time as the final stats.
- The on-screen timer lives inside the HUD panel chosen as its position — **Under score** (default), **Under task**, **Under menu** — instead of being pinned to fixed pixel coordinates, so a big Task name / Task flag size or a big UI scale can never overlap it. Hundredths show by default ("Tenths" drops to one decimal); the seconds part keeps a fixed width so the digits do not make it jump.
