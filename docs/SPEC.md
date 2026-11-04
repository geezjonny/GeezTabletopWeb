# GeezTabletop Web: the players' 3D battle map (v1)

A static web page (three.js, no build step, no server of our own) that shows players the map the GM
runs in GeezTabletop (the Godot app in `../godot-vtt`), **in 3D**, on a computer browser, including older laptops and Intel MacBooks.
It opens in a new tab from GeezSheets' 2D player battle map using `?camp=<camp>&bid=<bid>&name=<player name>`.

Out of scope for v1: any GM tools, map editing, character sheets, GeezSheets' own 2D editor. The GM
keeps using GeezTabletop (Godot). We do not change GeezSheets.

## Where the data comes from

GeezTabletop already publishes the running map to Firebase Realtime Database. **Read that; change
nothing on the Godot side.** The full data spec is `../godot-vtt/docs/geezsheets_bridge.md`. Read it
first. The writer is `../godot-vtt/scripts/geezsheets_bridge.gd` (`floor_record`, `token_record`,
`meta_record`, `door_states`); use it to settle any ambiguity.

- Firebase project: the config in `../GeezSheets/js/geez-config.js` (databaseURL
  `https://geezsheets-default-rtdb.firebaseio.com`). Use the Firebase JS SDK from a CDN (ES modules,
  v10+), sign in anonymously, same as GeezSheets.
- `<camp>` comes from the URL: `index.html?camp=world__daddies`. Everything lives under
  `geezvtt/live/<camp>/`.
- Which map: `dmAt.target` is the battle id `<bid>` the GM is showing. Follow it live: when it
  changes, load the new map. `?bid=` pins that map. If `dmAt` changes, show 'The GM moved to another map' and a Follow button that clears the pin.
- Map: `table3d/<bid>/meta`, `table3d/<bid>/floors/<f>`, `table3d/<bid>/doors/<f>`,
  `table3d/<bid>/tokenInfo/<tid>`.
- Tokens: `tokens/<bid>/<tid>` = `{x, y, f, light?}`; x, y are 0..1 of `meta.size`, the middle of
  the token's footprint.
- Token names and looks: `tokenInfo/<tid>` for `gh_` ids; otherwise `geezvtt/campaign/things/<tid>`
  (`name`, `traits.pc`, `traits.avatar` if present).
- Session: `session` = `{lockMove, lockPings}`.
- Pings: `pings/<id>` = `{v: "vtt:<bid>", x, y, f, by, ts}`.
- Handouts: `handouts/<id>` = `{title, text, image?, ts}`.
- Never read or write `geezvtt/table3d/...` (GM-only traps).

Coordinates: everything is in grid units, 1 = one 5 ft cell, (0, 0) at the map's top-left. In three.js
use x = grid x, z = grid y, y up. Floor `f` sits at y = f * 3.0 (`MapData.LEVEL_HEIGHT`). Cell height
`elevation["x_y"]` is in grid units on top of that.

## Who the player is

- On first open, the player picks their PC from the campaign's PCs (`geezvtt/campaign/things` where
  `type == "npc"` and `traits.pc`, with `campaign == <camp>`), or types a name. Remember it in
  `localStorage`. `?name=` in the URL sets it.
- "My token": the token whose thing is that PC (match by thing id, or by `tokenInfo.name` /
  `things.name`, case-insensitive, for `gh_` tokens with `pc: true`).

## What the page does

1. **Draws the map in 3D**, one floor group per entry in `meta.floors`:
   - Floors: a tile per cell in `paint`, textured with `assets/textures/floor_<kind>.png`, raised by
     `elevation`. Sides where heights differ get a vertical face. Merge geometry per texture (a city
     map has many thousands of cells: one mesh per material, not per cell).
   - Walls: each segment as an extruded wall (about 2.6 units high, 0.2 thick) with
     `assets/textures/wall_<mat>.png`; missing texture falls back to stone. Posts at joints are
     optional (`assets/kit/post_<mat>.glb`).
   - Doors: `assets/kit/door_<kind>.glb` in a `doorframe_<mat>.glb` where they exist, scaled to the
     segment length; swing open when the door's state in `doors/<f>` is `open`. Windows, arches,
     curtains, secret doors: simple fallbacks are fine.
   - Props: `assets/kit/props/<p>.glb` at x, y, turned by `rot` (degrees, clockwise seen from above:
     check against `floor_record`), scaled by `s`. Load each model once and clone it. Unknown kinds:
     a small neutral box.
   - Stairs come through as props too (`stairs`, `ladder`).
   - Lights: point lights for `lights` (cap the number of live lights for phones; use the nearest
     to the camera, the rest as glow sprites).
   - Roofs: a flat (or simple hipped) roof slab over the roof cells, with `assets/textures/roof_*.png`.
     A whole connected roof hides (lifts) while the player's own token stands under it.
   - Paths, decals and labels: paths as flat ribbons on the floor; decals as flat textured or tinted
     quads; labels as billboard text.
   - How GeezTabletop itself draws these is in `../godot-vtt/scripts/map_view.gd`, `door.gd`,
     `roofs.gd`, `prop_library.gd`, `paint_layer.gd`. Match its look where cheap; don't port it whole.
2. **Floors.** Show the floor the player's own token is on. With no token yet, show floor 0 (or the
   lowest). Floors above the shown one are hidden; floors below may stay visible.
3. **Tokens.** A representative token for every entry in `tokens/<bid>`: a coloured disc (base) with
   a standing billboard of the name's initials or the avatar image, sized by `size` (tiny/small/medium
   1, large 2, huge 3, gargantuan 4 cells). Animate moves smoothly. Only the shown floor's tokens.
   The player's own token is outlined.
4. **Moving my token.** Drag (or tap the token, then tap a cell) to move your own token, unless
   `session.lockMove` is on. Write `tokens/<bid>/<tid>` with `{...existing, x, y, f}`, x, y as the
   middle of the footprint over `meta.size` (see `token_record` / `token_cell` in the bridge), rounded
   to 5 decimals. Snap to cells. Walls and closed doors block the drag path (simple segment test).
   Standing on stairs, a "Go up / Go down" button changes `f` to the stair's `to` (or back).
5. **Pings.** Long-press (touch) or right-click on the floor: push to `pings` with
   `{v: "vtt:<bid>", x, y (0..1), f, by: <player name>, ts: Date.now()}` and remove it after 5 s,
   unless `session.lockPings`. Show every ping for this map and floor that is under 6 s old
   (yours too) as an expanding ring in the sender's colour, raised to the floor's surface and drawn
   on top of everything (`depthTest: false`) so grass and props never hide it.
6. **Vision and fog.** When `meta.light` is `dark` or `meta.time` is `night`: a 2D visibility polygon
   from the player's own token against walls and closed sight-blocking doors (rules in
   `doorRules` in `../GeezSheets/js/table3d-layer.js`), within range of lights; outside it, darken
   the map. Keep explored cells dimmed rather than black (remember them in memory per map). In
   daylight with `lit`, no fog, but walls still block line of sight to *tokens* (hide tokens the
   player can't see). Keep this simple and fast; correctness over looks.
7. **Atmosphere.** `meta.time`: lighting presets (dawn, day, dusk, night). `meta.weather`: a light
   particle layer (rain, snow, leaves, ash) with wind. Respect `prefers-reduced-motion`.
8. **Camera.** Orbit / pan / pinch-zoom (OrbitControls with sensible limits: never under the floor,
   never flat to the horizon). Starts over the player's token. A "Find me" button recentres.
   Walls between the camera and the player's token fade out (cut-away), like GeezTabletop's player
   view.
9. **Handouts.** New handouts (newer than page load) pop up as a dismissible card with title, text
   and image.
10. **Status.** A small corner badge: connected / offline / waiting for the GM to show a map.

## Performance (older laptops and Intel MacBooks are the target)

- One draw call per floor texture, per wall material. Instanced or cloned props.
- Render on demand; an idle map draws zero frames. Camera damping, tweens, doors, pings and weather
  keep drawing only while active; data and asset loads invalidate the view.
- Auto quality only steps down on sustained slow active frames: pixel ratio caps 2 / 1.5 / 1,
  point lights 8 / 3 / 1, weather particles 260 / 130 / 60. Low disables antialiasing and uses
  Lambert materials. Shadows stay off. Auto / High / Low is remembered in localStorage.
- Close 3D calls `window.close()` and shows a manual tab-close notice when the browser keeps it open.
- Rebuild only the floor that changed when `floors/<f>` changes; door state changes only touch doors.
- A 100x100-cell map must load in a few seconds on a mid-range phone.

## Files

```
index.html          the page (loads three.js and Firebase from CDNs via an import map)
src/main.js         start-up, URL params, wiring
src/firebase.js     auth + listeners + the few writes
src/map3d.js        builds a floor's meshes from a floor record
src/tokens.js       token meshes, drag, stairs
src/pings.js
src/vision.js       visibility polygon + fog
src/atmosphere.js   time of day, weather
src/ui.js           PC picker, buttons, handouts, status
assets/             copied from godot-vtt (GLB models, PNG textures, sounds, icons)
tests/              node tests for the pure parts (coordinates, token cell maths, door rules,
                    visibility), runnable with `node --test tests/`
tools/sample-map.json  a recorded table3d snapshot for working offline (`?sample=1` loads it
                    instead of Firebase)
```

Plain ES modules, no bundler, so GitHub Pages can serve it as-is. Pin three.js to one version.

## Done means

- `node --test tests/` passes.
- `?sample=1` renders a sample map with walls, doors, props, two floors, tokens, and lets you move
  your token and ping, with no network.
- Against the live campaign: the map GeezTabletop publishes appears, tokens move when the GM moves
  them, a player's drag moves the token in GeezTabletop, pings go both ways, doors open and close.
