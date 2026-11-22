# Gabor Pattern Puzzle

A compact match-three puzzle with procedural Gabor-pattern graphics. Play in a browser or install it as an offline-capable PWA.

## Play

- Drag a patch to an adjacent cell to swap it. Matching three or more clears them.
- Matching extends the timer; the score tracks play time.
- The right-hand controls switch visual modes, tint, size, and hints.
- Keyboard: Arrow keys move the selection, Shift+Arrow swaps, H shows a hint.

## Run locally

```sh
npm ci
npm run check
python3 -m http.server 8000
```

Visit `http://localhost:8000/`. Service workers require a secure context (HTTPS or localhost).

## Architecture

- `src/game.ts`: game state, rules, timing, matching, and cascades.
- `src/gabor.ts`: mathematical generation of high-resolution Gabor textures.
- `src/render.ts`: canvas rendering and controls.
- `src/main.ts`: browser lifecycle, touch/pointer and keyboard events.
- `manifest.webmanifest`, `service-worker.js`, `icons/`: installation and offline app shell.
- `.github/workflows/pages.yml`: build, test, and GitHub Pages deployment.

## Notes

No account, server API, analytics, tracking or remote game assets are needed to play. Game preferences are stored locally in the browser. This game is not a medical treatment or a claim of vision improvement.
