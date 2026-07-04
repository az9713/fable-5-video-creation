# Glider Through Time — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a browser-based, continuous 3D flythrough where the viewer rides a hang-glider across
54 scenes of history (primordial soup → post-WWII), guided-tour with free-look, procedural nature +
curated CC0/Mixamo assets.

**Architecture:** Vanilla JavaScript + Three.js, bundled with Vite. A single global flight curve
drives a follow-camera; a timeline maps global progress to a scene index. Scenes are lazy-imported
modules implementing `build/update/dispose`; a streaming SceneManager keeps only the current + next
scene resident so 54 scenes never blow the GPU memory budget. Procedural world systems (sky, sun,
terrain, water, clouds, fog) are shared; scenes layer landmarks, instanced crowds, and Mixamo-animated
hero characters on top.

**Tech Stack:** Three.js (r16x), Vite, Vitest (unit tests for math/logic), GLTFLoader, Mixamo FBX→GLTF
animations, EffectComposer postprocessing, Howler.js (audio), simplex-noise (terrain).

**Testing philosophy for a graphics project:** Pure logic (curve sampling, progress→scene mapping,
terrain height functions, streaming load/dispose bookkeeping, crowd instancing counts) is covered by
**Vitest unit tests, TDD-style**. Rendering/aesthetics can't be unit-tested; those tasks end with an
explicit **Visual Checkpoint** (what to look for in the browser) plus, where practical, a headless
smoke test that the scene builds without throwing.

**Conventions:**
- ES modules, one system per file under `src/`.
- Every scene lives in `src/scenes/NN-slug.js` and default-exports a factory returning
  `{ build, update, dispose, meta }`.
- Commit after every green step. Messages: `feat:`, `test:`, `chore:`, `fix:`.
- Run `npm run dev` for the live browser; `npm test` for Vitest.

---

## Phase 0 — Project Scaffold

### Task 0.1: Initialize project

**Files:**
- Create: `package.json`, `vite.config.js`, `index.html`, `src/main.js`, `.gitignore`

**Step 1: Scaffold with Vite (non-interactive) and install deps**
```bash
cd C:/Users/simon/Downloads/fable_5_game_2_me
npm create vite@latest . -- --template vanilla --yes 2>/dev/null || true
npm install three simplex-noise howler
npm install -D vite vitest
```

**Step 2: Replace `index.html`** with a full-viewport canvas host:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Glider Through Time</title>
    <style>
      html, body { margin: 0; height: 100%; overflow: hidden; background: #000; }
      #app { position: fixed; inset: 0; }
    </style>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.js"></script>
  </body>
</html>
```

**Step 3: Minimal `src/main.js`** — spinning cube to prove the toolchain:
```js
import * as THREE from 'three';

const app = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.z = 4;

const cube = new THREE.Mesh(
  new THREE.BoxGeometry(),
  new THREE.MeshNormalMaterial()
);
scene.add(cube);

renderer.setAnimationLoop((t) => {
  cube.rotation.x = cube.rotation.y = t / 1000;
  renderer.render(scene, camera);
});
```

**Step 4: Add `.gitignore`**: `node_modules`, `dist`, `.DS_Store`.

**Step 5: Verify** — `npm run dev`, open the URL, confirm a spinning cube renders.
**Visual Checkpoint:** rainbow-normal cube spinning on black.

**Step 6: Commit**
```bash
git init && git add -A && git commit -m "chore: scaffold Vite + Three.js project"
```

### Task 0.2: Set up Vitest

**Files:** Modify `package.json` (add `"test": "vitest run"`, `"test:watch": "vitest"`), Create `src/math/lerp.js`, `src/math/lerp.test.js`.

**Step 1 (test first):** `src/math/lerp.test.js`
```js
import { describe, it, expect } from 'vitest';
import { clamp01, lerp } from './lerp.js';

describe('math helpers', () => {
  it('clamp01 bounds to [0,1]', () => {
    expect(clamp01(-2)).toBe(0);
    expect(clamp01(0.5)).toBe(0.5);
    expect(clamp01(9)).toBe(1);
  });
  it('lerp interpolates', () => {
    expect(lerp(0, 10, 0.25)).toBe(2.5);
  });
});
```
**Step 2:** Run `npm test` → FAIL (module missing).
**Step 3:** `src/math/lerp.js`
```js
export const clamp01 = (x) => Math.min(1, Math.max(0, x));
export const lerp = (a, b, t) => a + (b - a) * t;
```
**Step 4:** `npm test` → PASS.
**Step 5:** Commit `test: add math helpers with vitest`.

---

## Phase 1 — Engine Core

### Task 1.1: Engine class (renderer, loop, resize, clock)

**Files:** Create `src/engine/Engine.js`, `src/engine/Engine.test.js`; Modify `src/main.js`.

**Step 1 (test):** Engine is constructable in a headless/jsdom-ish way — test the *loop bookkeeping*,
not WebGL. Design `Engine` so update callbacks are registered and driven by an injectable time source:
```js
import { describe, it, expect, vi } from 'vitest';
import { Loop } from './Loop.js';

describe('Loop', () => {
  it('calls subscribers with delta seconds', () => {
    const loop = new Loop();
    const cb = vi.fn();
    loop.add(cb);
    loop.tick(1000); // ms
    loop.tick(1016);
    expect(cb).toHaveBeenCalledTimes(2);
    const dt = cb.mock.calls[1][0];
    expect(dt).toBeCloseTo(0.016, 3);
  });
});
```
**Step 2:** Run → FAIL.
**Step 3:** Implement `src/engine/Loop.js`:
```js
export class Loop {
  constructor() { this.subs = []; this.last = null; }
  add(fn) { this.subs.push(fn); }
  tick(nowMs) {
    const dt = this.last == null ? 0 : (nowMs - this.last) / 1000;
    this.last = nowMs;
    for (const fn of this.subs) fn(dt, nowMs / 1000);
  }
}
```
**Step 4:** Run → PASS. **Step 5:** Commit.

**Step 6:** Implement `src/engine/Engine.js` wrapping renderer + camera + scene + `Loop`, with
`onResize` bound to `window`, tone mapping `ACESFilmicToneMapping`, `renderer.setPixelRatio(Math.min(devicePixelRatio, 2))`.
Wire `renderer.setAnimationLoop((t) => loop.tick(t))`.
**Step 7:** Rewrite `src/main.js` to instantiate `Engine`, still showing the cube via a registered updater.
**Visual Checkpoint:** cube still spins; resizing the window keeps it centered and un-stretched.
**Step 8:** Commit `feat: engine core (renderer, loop, resize, tone mapping)`.

---

## Phase 2 — Procedural Sky, Sun & Fog

### Task 2.1: Sky dome + directional sun + fog

**Files:** Create `src/world/Sky.js`, `src/world/Lighting.js`; Modify `main.js`.

- Use Three's `Sky` shader (`three/examples/jsm/objects/Sky.js`) for atmospheric scattering.
- `Lighting.js`: a `DirectionalLight` (the sun) + `HemisphereLight` for sky/ground ambient; expose
  `setSunPosition(elevationDeg, azimuthDeg)` that positions both the Sky sun uniform and the light.
- Add `scene.fog = new THREE.FogExp2(color, density)`; expose a setter.

**Visual Checkpoint:** a believable daytime sky with a sun; moving elevation toward 0 reddens it
(sunset). No cube needed anymore — replace with a ground plane placeholder.
**Commit:** `feat: procedural sky, sun, hemisphere light, exponential fog`.

---

## Phase 3 — Procedural Terrain & Water

### Task 3.1: Terrain height field (TDD the math)

**Files:** Create `src/world/terrain/heightField.js` + test; `src/world/Terrain.js`.

**Step 1 (test):** deterministic height function, seedable, returns finite numbers and respects amplitude:
```js
import { describe, it, expect } from 'vitest';
import { makeHeightField } from './heightField.js';

describe('heightField', () => {
  it('is deterministic for a seed', () => {
    const h1 = makeHeightField({ seed: 42, amplitude: 100 });
    const h2 = makeHeightField({ seed: 42, amplitude: 100 });
    expect(h1(12.3, -4.5)).toBeCloseTo(h2(12.3, -4.5), 6);
  });
  it('stays within amplitude bounds', () => {
    const h = makeHeightField({ seed: 1, amplitude: 50 });
    for (let i = 0; i < 200; i++) {
      const y = h(i * 3.1, i * -2.7);
      expect(Math.abs(y)).toBeLessThanOrEqual(50 + 1e-6);
    }
  });
});
```
**Step 2:** FAIL. **Step 3:** Implement with `simplex-noise` (seedable), summing 4 fractal octaves,
normalized to `[-1,1]`, scaled by `amplitude`. **Step 4:** PASS. **Step 5:** Commit.

**Step 6:** `Terrain.js` builds a `PlaneGeometry` (e.g. 512×512 segments over a large area),
displaces vertices by the height field, recomputes normals, applies a `MeshStandardMaterial` with
slope/height-based vertex colors (green valleys → grey peaks → white caps). Add a second large,
low-detail "far terrain" ring for horizon.
**Visual Checkpoint:** rolling hills to the horizon that read as real land from altitude.
**Commit:** `feat: procedural displaced terrain with slope-based coloring`.

### Task 3.2: Water

**Files:** Create `src/world/Water.js`.
- Use Three's `Water` (`three/examples/jsm/objects/Water.js`) with a normal map, or a custom
  gerstner-wave shader for open ocean (needed for Acts I ocean scenes).
- Expose `setLevel(y)` and `setColor()`.
**Visual Checkpoint:** reflective animated water plane; sun glints on it.
**Commit:** `feat: animated reflective water`.

---

## Phase 4 — The Glider & Follow Camera

### Task 4.1: Glider rig

**Files:** Create `src/glider/Glider.js`; add asset `public/assets/glider.glb` (CC0 hang-glider, or
build a simple delta-wing from geometry as a placeholder).
- `Glider` is a `THREE.Group`: wing mesh + a small pilot figure hanging below.
- Expose `object3D`, and `setBank(angle)` / `setPitch(angle)` for lean into turns.
**Visual Checkpoint:** a hang-glider silhouette hovering over the terrain.
**Commit:** `feat: glider rig (wing + pilot)`.

### Task 4.2: Follow camera

**Files:** Create `src/glider/FollowCamera.js` + test.
**Step 1 (test):** given a glider position + forward vector, camera sits a fixed distance behind and
above and looks ahead:
```js
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { computeFollow } from './FollowCamera.js';

it('places camera behind and above the glider', () => {
  const pos = new THREE.Vector3(0, 100, 0);
  const forward = new THREE.Vector3(0, 0, -1);
  const { camPos, lookAt } = computeFollow(pos, forward, { back: 12, up: 4 });
  expect(camPos.z).toBeCloseTo(12, 3);   // behind (opposite -z)
  expect(camPos.y).toBeCloseTo(104, 3);  // above
  expect(lookAt.z).toBeLessThan(pos.z);  // looks forward
});
```
**Step 2:** FAIL → **Step 3:** implement `computeFollow` (pure) → **Step 4:** PASS → **Step 5:** Commit.
**Step 6:** `FollowCamera` applies smoothed (damped) follow each frame.
**Commit:** `feat: damped follow camera`.

---

## Phase 5 — Flight Path System

### Task 5.1: Global flight curve + arc-length sampling (TDD)

**Files:** Create `src/flight/FlightPath.js` + test.
**Step 1 (test):**
```js
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { FlightPath } from './FlightPath.js';

it('samples position and tangent along the curve at t in [0,1]', () => {
  const fp = new FlightPath([
    new THREE.Vector3(0,100,0), new THREE.Vector3(100,120,-50),
    new THREE.Vector3(200,90,-200), new THREE.Vector3(300,110,-400),
  ]);
  const a = fp.at(0), b = fp.at(1);
  expect(a.position.distanceTo(b.position)).toBeGreaterThan(0);
  expect(fp.at(0.5).tangent.length()).toBeCloseTo(1, 3); // normalized
});
```
**Step 2:** FAIL → **Step 3:** wrap `CatmullRomCurve3`, use `getPointAt`/`getTangentAt`
(arc-length parametrized) → **Step 4:** PASS → **Step 5:** Commit.
**Step 6:** Drive the glider + follow camera along `fp` at a configurable speed in `main.js`.
Bank the glider proportional to tangent curvature.
**Visual Checkpoint:** the glider flies a smooth banking path over the terrain; camera trails it.
**Commit:** `feat: flight path curve driving glider + camera`.

---

## Phase 6 — Free-Look

### Task 6.1: Mouse free-look offset (TDD the mapping)

**Files:** Create `src/controls/FreeLook.js` + test; wire into `FollowCamera`.
- Free-look adds a yaw/pitch **offset** to the follow orientation (clamped, e.g. ±35°), auto-recentering
  when the mouse is idle, so the guided framing is never lost.
**Step 1 (test):** pointer at screen center → zero offset; at edges → clamped max offset; idle →
decays toward 0.
**Steps 2–5:** FAIL → implement pure `mapPointerToOffset` + decay → PASS → Commit.
**Step 6:** Wire pointer events; apply offset as a rotation around the follow look-vector.
**Visual Checkpoint:** moving the mouse looks around while still flying the path; releasing recenters.
**Commit:** `feat: free-look camera offset with recentering`.

---

## Phase 7 — Scene Interface & Streaming SceneManager

### Task 7.1: Scene contract + registry

**Files:** Create `src/scenes/sceneContract.md` (doc), `src/journey/journey.js` (the 54-entry manifest,
data only), `src/journey/journey.test.js`.
- A **scene descriptor**: `{ id, index, title, year, tier: 'hero'|'flythrough', load: () => import('...'),
  duration, palette, sunElevation, audio }`.
- A **scene module** default-exports `() => ({ meta, build(ctx), update(dt, localT), dispose() })` where
  `ctx = { scene, worldSystems, assets, gliderPathSegment }`.
**Step 1 (test):** journey has ≥54 entries, indices are 0..N-1 contiguous, years are monotonically
non-decreasing, every entry has a `load` function.
```js
import { describe, it, expect } from 'vitest';
import { journey } from './journey.js';
it('journey is well-formed', () => {
  expect(journey.length).toBeGreaterThanOrEqual(54);
  journey.forEach((s, i) => { expect(s.index).toBe(i); expect(typeof s.load).toBe('function'); });
  for (let i = 1; i < journey.length; i++)
    expect(journey[i].year).toBeGreaterThanOrEqual(journey[i-1].year);
});
```
**Step 2:** FAIL → **Step 3:** author the 54-entry manifest (years from `-3.8e9` to `1945`) with
`load` pointing at (initially non-existent) modules → **Step 4:** PASS (load fns not yet called) →
**Step 5:** Commit.

### Task 7.2: Timeline — global progress → {sceneIndex, localT} (TDD)

**Files:** Create `src/journey/Timeline.js` + test.
**Step 1 (test):**
```js
import { describe, it, expect } from 'vitest';
import { Timeline } from './Timeline.js';

it('maps global progress to scene + local progress by duration weights', () => {
  const tl = new Timeline([{ duration: 1 }, { duration: 3 }]); // total 4
  expect(tl.at(0)).toEqual({ index: 0, localT: 0 });
  expect(tl.at(0.125)).toMatchObject({ index: 0 });      // 0.5/1 into scene 0
  const mid = tl.at(0.625); // 2.5/4 -> 1.5 into scene1 (len3) -> localT .5
  expect(mid.index).toBe(1);
  expect(mid.localT).toBeCloseTo(0.5, 3);
});
```
**Steps 2–5:** FAIL → implement cumulative-duration lookup → PASS → Commit.

### Task 7.3: Streaming SceneManager (TDD the load/dispose bookkeeping)

**Files:** Create `src/journey/SceneManager.js` + test.
- Keeps a window of resident scenes: **current + next** (and briefly the previous during a transition).
- On entering scene `i`: ensure `i` and `i+1` are built; dispose anything outside `[i-1, i+1]`.
- `load` returns a module; `build(ctx)` adds objects to a per-scene `THREE.Group`; `dispose()` removes
  the group and frees geometries/materials/textures.
**Step 1 (test):** feed a fake loader/builder; advance current index through 0→1→2→3 and assert which
scenes are `built` and which are `disposed` at each step (window invariant), and that a scene is never
built twice without a dispose in between.
```js
it('keeps only a sliding window of scenes resident', async () => {
  const built = [], disposed = [];
  const fake = (i) => async () => ({ default: () => ({
    meta: { index: i }, build: () => built.push(i), update() {}, dispose: () => disposed.push(i),
  })});
  const sm = new SceneManager({ descriptors: [0,1,2,3].map(i => ({ index: i, load: fake(i) })) });
  await sm.setCurrent(0); expect(built).toEqual([0,1]);
  await sm.setCurrent(1); expect(built).toEqual([0,1,2]);
  await sm.setCurrent(2); expect(disposed).toContain(0); expect(built).toContain(3);
});
```
**Steps 2–5:** FAIL → implement → PASS → Commit `feat: streaming scene manager with sliding window`.

---

## Phase 8 — Journey Driver & Transitions

### Task 8.1: Wire Timeline + SceneManager + FlightPath into main

**Files:** Modify `src/main.js`; Create `src/journey/Journey.js`.
- `Journey` owns global progress `t` (advances by `speed * dt`, pausable), asks `Timeline.at(t)` for
  `{index, localT}`, tells `SceneManager` to `setCurrent(index)`, and calls the current scene's
  `update(dt, localT)`.
- Each scene owns a segment of the global flight path (its control points concatenated in `journey.js`).
**Commit:** `feat: journey driver ties timeline, scenes, and flight path together`.

### Task 8.2: Time-stream transition veil

**Files:** Create `src/journey/Transition.js`.
- On scene change, run a ~1.5s veil: ramp fog density up + a full-screen additive "light bloom" plane
  + cloud layer sweep, swap scenes at peak opacity, ramp back down. Crossfade audio here too.
**Visual Checkpoint:** moving `t` across a scene boundary dissolves through light/cloud, never a hard pop.
**Commit:** `feat: time-stream transition between scenes`.

---

## Phase 9 — Asset Pipeline

### Task 9.1: Loaders + cache

**Files:** Create `src/assets/AssetCache.js`, `src/assets/loadGLTF.js`, `src/assets/loadAnim.js`.
- Wrap `GLTFLoader` with a promise cache keyed by URL (never load the same GLB twice).
- Mixamo animations: download as FBX, convert once to GLB with animations (document the conversion
  step in `docs/assets.md`), load clips and retarget onto characters.
- `AssetCache.dispose(url)` frees when no scene references it (refcount).
**Step 1 (test):** refcount logic — acquire twice, release once → still cached; release twice → freed.
**Steps 2–5:** TDD the refcount (pure) → Commit.
**Commit:** `feat: asset cache with refcounted GLTF/animation loaders`.

### Task 9.2: Instanced crowd helper (TDD counts)

**Files:** Create `src/assets/Crowd.js` + test.
- Given a base mesh + N transforms, produce one `InstancedMesh`; support a shared animation via
  per-instance time offset (texture-baked vertex animation or simple bobbing for distant figures).
**Step 1 (test):** `Crowd.build(mesh, transforms)` yields an `InstancedMesh` with `count === transforms.length`
and each instance matrix set.
**Steps 2–5:** FAIL → implement → PASS → Commit `feat: instanced crowd helper`.

### Task 9.3: LOD helper

**Files:** Create `src/assets/lod.js`.
- Thin wrapper over `THREE.LOD` to register {distance → mesh} tiers; used by landmarks and characters.
**Commit:** `feat: LOD helper`.

---

## Phase 10 — UI

### Task 10.1: HUD (captions, progress, controls)

**Files:** Create `src/ui/HUD.js`, `src/ui/hud.css`; Modify `index.html`.
- Scene caption card (fades in per scene): big year + title + one-line blurb (from `journey.js`).
- Bottom progress scrubber (draggable to seek → sets `Journey.t`), play/pause, speed 0.5×/1×/2×.
- Intro overlay: title "Glider Through Time", a Start button (needed to unlock audio via user gesture),
  short "move mouse to look around" hint.
**Step 1 (test):** caption formatter — turns `year: -2500` into "2500 BCE", `year: 80` into "80 CE",
`year: -3.8e9` into "3.8 billion years ago". TDD this pure formatter.
**Steps 2–5:** FAIL → implement `formatYear` → PASS → Commit.
**Step 6:** Build the DOM HUD; wire to `Journey`.
**Visual Checkpoint:** captions match scenes; scrubber seeks; Start unlocks audio.
**Commit:** `feat: HUD with captions, seek scrubber, speed controls, intro overlay`.

---

## Phase 11 — Audio

### Task 11.1: Per-scene ambient + music with crossfade

**Files:** Create `src/audio/AudioDirector.js`; assets under `public/assets/audio/` (CC0/CC-BY tracks —
credit in `docs/credits.md`).
- Howler-based: each scene declares `audio: { music, ambient }`; on transition, crossfade over the veil
  duration. Master mute toggle in HUD.
**Commit:** `feat: audio director with per-scene crossfade`.

---

## Phase 12 — Postprocessing

### Task 12.1: EffectComposer (bloom, vignette, subtle grade)

**Files:** Create `src/engine/Post.js`; Modify `Engine` to render via composer.
- `RenderPass` + `UnrealBloomPass` (sun glints, fire, the time-stream veil) + a vignette/grade pass.
- Keep it toggle-able and cheap; expose intensity for the transition to spike bloom.
**Visual Checkpoint:** sun and highlights bloom; overall image reads cinematic, not flat.
**Commit:** `feat: postprocessing (bloom + vignette + tone grade)`.

---

## Phase 13 — Vertical Slice: First Three Scenes (the templates)

Build three *end-to-end* scenes that become copy-paste templates for the other 51. Do these fully
before mass production so the pattern is proven.

### Task 13.1: Scene 01 — Primordial Soup (flythrough / ocean template)

**Files:** Create `src/scenes/01-primordial-soup.js`.
- World: dark volcanic ocean (`Water` with hot palette), steaming vents (particle plumes), lightning
  flashes (timed emissive + light spike), glowing stromatolite mounds (instanced).
- Flight segment: low, slow, weaving between vents.
- `update(dt, localT)`: drive lightning timing and steam.
**Visual Checkpoint:** brooding, alive primordial sea; reads as "the beginning".
**Headless smoke test:** `build(ctx)` runs without throwing given a mock ctx (add to `scenes.smoke.test.js`).
**Commit:** `feat(scene): 01 primordial soup (ocean flythrough template)`.

### Task 13.2: Scene 18 — Pyramids of Giza (hero / crowd + landmark template)

**Files:** Create `src/scenes/18-pyramids-of-giza.js`; assets: pyramid GLB, worker (Mixamo) GLB, Nile.
- World: desert terrain palette, the Nile (`Water`) flooding green banks.
- Landmark: three pyramids at LOD; ramps with **instanced** workers hauling stone (Crowd + a hauling
  animation), a pharaoh's procession as a hero animated character near the flight low-point.
- Flight segment: sweep down the Giza plateau, bank around the Great Pyramid.
**Visual Checkpoint:** thousands of workers legible from altitude; landmark unmistakable; not blocky.
**Headless smoke test** added.
**Commit:** `feat(scene): 18 pyramids of giza (hero crowd+landmark template)`.

### Task 13.3: Scene 09 — Cretaceous Hunt (hero / animated creatures + companions template)

**Files:** Create `src/scenes/09-cretaceous-hunt.js`; assets: T. rex, triceratops, pterosaur GLBs w/ anims.
- World: lush cretaceous forest terrain, volcanic haze on horizon.
- Below: a T. rex chase (two hero animated creatures on a short scripted ground path). Pterosaurs fly
  **alongside** the glider (companions parented near the flight path).
- Flight segment: skim the treetops, dip toward the chase.
**Visual Checkpoint:** creatures move believably (mocap-quality), pterosaurs escort the glider.
**Commit:** `feat(scene): 09 cretaceous hunt (animated-creature template)`.

### Task 13.4: Play the slice end-to-end

Temporarily set `journey.js` to just `[01, 09, 18]` and fly all three with transitions, audio, HUD.
**Visual Checkpoint:** three scenes, two transitions, continuous flight, captions + audio all correct.
**Commit:** `chore: verify 3-scene vertical slice end-to-end`.

---

## Phase 14 — Scene Production (remaining 51)

Each scene = one task following the nearest template (ocean / desert-crowd / creature / city / battle /
somber). Per scene, in a fresh subagent:

1. Pick template + assets (landmark GLB + any Mixamo animations). List sources in `docs/credits.md`.
2. Create `src/scenes/NN-slug.js` with `meta`, `build`, `update`, `dispose`.
3. Author its flight-path control points into `journey.js`.
4. Set palette, sun elevation, fog, audio.
5. Add a headless smoke test (builds without throwing on mock ctx).
6. **Visual Checkpoint** in-browser by seeking to that scene.
7. Commit `feat(scene): NN slug`.

**Production order (group by reused template to minimize asset churn):**
- **Ocean/deep-time template:** 02 first life, 03 Cambrian, 04 Ordovician (reuse 01).
- **Creature template:** 05 Carboniferous, 06 Permian, 07 Triassic, 08 Jurassic, 11 Ice Age (reuse 09).
- **Sky-event beat:** 10 asteroid (bespoke — impact flash + shockwave shader).
- **Crowd+landmark template:** 14 agri revolution, 15 Göbekli Tepe, 16 Stonehenge, 17 Sumer, 19 Egypt
  life, 20 Knossos, 21 Babylon, 22 Olympia, 23 Athens, 25 Alexandria, 26 Great Wall, 27 Terracotta,
  28 Rome, 29 aqueducts, 32 Constantinople, 33 Tikal, 35 Angkor, 36 Baghdad, 38 cathedral, 41 Mali,
  42 Florence, 44 Tenochtitlan, 45 printing press, 46 Galileo, 47 Versailles/balloon (reuse 18).
- **Battle/motion template:** 24 Alexander's army, 34 Vikings, 37 medieval siege, 40 Mongols,
  43 Age of Sail, 48 revolutions, 52 WWII, 53 the Blitz (reuse 18 crowds + projectile/vehicle motion).
- **Character-cameo template:** 12 first humans, 13 mammoth hunt (reuse 09 + 18).
- **Somber/atmosphere beat:** 30 Pompeii (eruption), 31 fall of Rome, 39 Black Death, 54 dawn of peace
  (light-heavy, few figures).
- **Vehicle flyby beat:** 49 Industrial Revolution, 50 Wright Flyer, 51 Roaring Twenties.

> Note on scope: this phase is ~51 scenes. Treat each as an independent, parallelizable task. Ship in
> **act batches** (Act I, then II, …), verifying a continuous flight through each completed act before
> moving on. Keep a running `docs/asset-manifest.md` so no GLB is downloaded twice.

---

## Phase 15 — Performance & Compatibility

### Task 15.1: Budget & instrument
- Add `stats.js` FPS meter (dev only). Establish budgets: ≤2M triangles on screen, ≤150 draw calls,
  scene build < 1 frame hitch (build off the critical path / spread over frames).

### Task 15.2: Streaming polish
- Prefetch `i+1` assets during scene `i` (idle-time). Verify no hitch at transitions via the FPS meter.

### Task 15.3: Quality tiers
- Detect device; expose Low/Med/High (pixel ratio, shadow on/off, crowd density, draw distance/fog).
- **Test:** the tier selector is a pure function of a capabilities object — TDD it.

### Task 15.4: Mobile/touch
- Touch drag = free-look; hide keyboard hints; lower default tier.
**Commit each:** `perf: ...`.

---

## Phase 16 — Polish & Deploy

### Task 16.1: Polish pass
- Title/credits scene, consistent color grade per act, ambient particles (dust, birds, embers),
  subtle glider wind SFX, ensure every caption/blurb is accurate.

### Task 16.2: Build & deploy
- `npm run build` → `dist/`. Deploy to Vercel (static). Add `docs/credits.md` (all CC0/CC-BY asset
  and audio attributions) — **required** before public sharing.
**Commit:** `chore: production build + deploy config`.

---

## Milestones / Definition of Done

- **M0 (Phases 0–1):** engine renders, resizes, loops. ✅ toolchain proven.
- **M1 (Phases 2–6):** you can fly a glider along a path over procedural land/sea with free-look.
- **M2 (Phases 7–12):** streaming journey with transitions, HUD, audio, postprocessing — using stub scenes.
- **M3 (Phase 13):** three real scenes end-to-end — the look is locked, templates exist.
- **M4 (Phase 14):** all 54 scenes, act by act.
- **M5 (Phases 15–16):** performant, compatible, deployed at a shareable URL.

**Done =** continuous ~10–12 min flight through 54 scenes, 60 fps desktop, free-look + speed/pause,
painterly-realistic, live on a public URL with full asset credits.
