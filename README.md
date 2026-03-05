# Endfield Gacha Planner (Svelte)

## Run

```bash
npm install
npm run dev
```

## Project structure

- `index.html`: Vite app entry.
- `src/main.js`: Svelte bootstrap.
- `src/App.svelte`: Main page layout and DOM template.
- `src/styles/planner.css`: Global planner styles.
- `src/lib/planner/runtime.js`: Runtime logic (window management, URL state, rendering).
- `src/lib/planner/constants.js`: Shared constants and strategy presets.
- `src/lib/planner/gacha-engine.worker.js`: Worker entry.

## Note

The simulation worker is bundled from `src/lib/planner/gacha-engine.worker.js`.
