# GeezTabletop Web

The players' 3D battle map for GeezTabletop, in the browser (three.js). Players open it on a phone
or TV and see the map the GM runs in GeezTabletop, move their own token, and ping.

Spec: [docs/SPEC.md](docs/SPEC.md). Assets are copied from `godot-vtt/assets`.

Run with Node 22+:

```sh
npm ci
npm run serve
```

Open [the offline sample](http://127.0.0.1:8080/?sample=1), choose **Test**, and join. Or use
`http://127.0.0.1:8080/?sample=1&name=Test`. Sample mode reads the hand-authored
[snapshot](tools/sample-map.json), keeps writes in memory, and makes **zero external requests**.
It needs a local static HTTP server; opening `index.html` through `file://` does not work.

For a published map, open `/?camp=world__daddies` with the real campaign id. The page follows
`dmAt.target`. `&bid=MAP_ID` pins a map, and `&name=PC_NAME` selects a character. The PC picker
also supports a typed name and remembers the selection per campaign in localStorage.

Drag your token, or select it then tap a destination cell. Right-click or long-press a cell to
ping. Use **Go up / Go down** while standing on stairs, and **Find me** to recenter. Orbit,
pan and pinch-zoom use OrbitControls. The GM's session movement and ping locks are respected.

There is no build step or runtime server. Serve this directory unchanged on GitHub Pages or
another static host. The import map pins three.js **0.180.0**, vendored with its MIT license
under `vendor/` so even a fresh sample load works without internet access. Firebase **10.14.1**
loads from Google's CDN only in live mode and signs in anonymously. Its public project config
matches GeezSheets. Existing Firebase database rules govern access; this client is not an
authorization boundary. It never accesses the GM-only trap subtree.

```sh
node --test tests/
npm run test:browser
```

The browser check uses Playwright Chromium, either its installed browser, a detected Windows
Playwright Chromium installation, or `PLAYWRIGHT_CHROMIUM_EXECUTABLE`. If needed, install it
with `npx playwright install chromium`. Checks include real mouse/touch input, offline sample
loading, two floors, stairs, fog, roofs, locks, and a 100×100 floor batching check. A second
test runs the actual Firebase adapter against simulated RTDB events, without production writes.
Screenshots go to ignored `test-results/`. These checks do not replace a real Godot/Firebase
round-trip test or a physical phone performance test.

After adding assets, regenerate the tracked inventory with `node tools/asset-manifest.js`.
Unknown props use a neutral box; missing textures fall back to stone (roofs to thatch).
Roofs are flat slabs, decals can use tinted quads, and windows/secrets/double doors use simple
representations. Weather is a lightweight particle layer; point lights are capped at eight.
Exploration is remembered in memory per map and floor until the page closes.
