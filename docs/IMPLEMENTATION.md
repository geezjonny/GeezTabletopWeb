# v1 implementation and verification

The player viewer, Firebase adapter and hand-authored offline sample are implemented. All
changes are confined to GeezTabletopWeb; godot-vtt and GeezSheets were read as references.

Features include textured, batched floors and walls; elevation faces; cached GLB props;
animated doors; stairs both ways; connected roof hiding; billboard tokens and names;
own-token tap/drag movement with wall and door checks; pings and session locks; visibility
polygons with light-aware fog and in-memory exploration; time presets, weather, capped
point lights, reduced motion, camera cutaway, handouts and connection status.

The static import map uses pinned local three.js 0.180.0 rather than requiring a CDN
request, to meet the fresh-load offline sample requirement. Its MIT license is included.
Live mode dynamically imports Firebase 10.14.1 from Google's CDN. No bundler is involved.

Permitted simple representations: flat roof slabs; tinted fallback decals; simplified
windows, secret and double doors; a neutral box for unknown props. Shadows stay disabled.
Weather uses inexpensive points. Exploration resets when the page closes. These are
implemented v1 fallbacks, not placeholder connections or simulated live behavior.

Verification commands:

```sh
node --test tests/
node tools/browser-check.js
```

The Node suite covers coordinates, all token footprint sizes and nonzero origins,
Godot rounding, door kinds, segment collisions, roofs, stairs, identity and visibility.
The headless Chromium suite checks the offline sample with all external requests blocked,
desktop mouse and mobile touch movement/pings, PC selection and persistence, floors,
stairs, roofs, locks, fog, incremental doors and 100×100 floor batching. It also runs the
actual Firebase adapter with stub SDK modules to verify RTDB paths, map follow/override,
unsubscribe, incoming GM changes, outgoing player writes and new handouts.

A real published campaign/Godot round-trip and physical phone performance remain
unverified. The integration tests do not access production Firebase.

Final run on 2026-11-04: **17 Node tests passed**. **Desktop and mobile Chromium checks
passed**, including real tap/drag input, touch long-press pings and the simulated Firebase
adapter tests, with zero console errors. Sample mode made zero external requests. The
100×100 floor geometry built in **109 ms** as **one ground mesh** in desktop headless
Chromium. Screenshots are in `test-results/sample-desktop.png` and
`test-results/sample-mobile.png` (ignored local verification artifacts).

## Git limitation in this session

`git switch -c v1` was attempted before implementation and failed:

```text
fatal: cannot lock ref 'refs/heads/v1': Unable to create
'.../GeezTabletopWeb/.git/refs/heads/v1.lock': Permission denied
```

The session explicitly grants read-only access to `.git`, so no branch or commits could
be created. Nothing was pushed. The implementation is left in the working tree for review.
When Git writes are available, the intended logical commit groups are:

1. Static shell, pinned vendor files, coordinates, rules, sample and asset inventory.
2. Map, token, visibility, atmosphere, ping and Firebase implementation.
3. Node/browser checks and usage documentation.

Each commit message must end with a blank line and:

```text
Co-Authored-By: Codex <noreply@openai.com>
```
