# Architecture

The application runs entirely in the browser, with no server-side gameplay.

- Core game state and match resolution are in `Game`, independent of DOM/Canvas.
- Gabor textures are generated from frequency, phase, contrast and radial transparency parameters.
- A high-DPI Canvas renderer maps a fixed 960×540 logical coordinate system to the device viewport.
- Input coordinates are translated to the logical coordinate system before game operations.
- A scoped service worker pre-caches the app shell, ES modules, manifest, and icons.
- GitHub Pages hosts the static files under a repository subpath; all references are relative to the current path.

## PWA behavior

The app installs from the HTTPS origin. It caches only same-origin, same-scope GET resources. Navigation falls back to cached `index.html` when offline, while static assets are served cache-first. A new service-worker cache version removes older app caches at activation.
