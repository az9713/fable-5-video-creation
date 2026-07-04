# Glider Through Time — Lean First Cut (v1)

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.
> Supersedes the 54-scene plan (`2026-07-02-glider-through-time-plan.md`) for v1. The full plan
> remains the reference for engine tasks and the eventual expansion.

**Goal:** A shippable ~4-minute continuous glider flight through 10 scenes of history, deployed at a
public URL, before building anything else.

**What changed vs the full plan:**
- **10 scenes, not 54.** One strong beat per era. Expansion happens only after people fly v1.
- **No streaming SceneManager.** With 10 lightweight scenes we load everything up front behind one
  loading screen. `ponytail:` sliding-window streaming — add when scene count or GPU memory forces it
  (the scene contract below keeps that door open).
- **No refcounted AssetCache.** One promise-cached GLTF loader function. That's it.
- **Ends at Kitty Hawk, not WWII.** v1 closes on the Wright Flyer — the hang-glider hero meets the
  birth of flight. Thematically perfect, and defers the WWII tonal question entirely.
- **Creatures = the 6 CC0 Quaternius dinosaurs already in `spike-dino-viewer/public/models/`**
  (rigged, animated: idle/walk/run/attack/death/jump). Humans = Mixamo. Nothing else.
- **TDD only where logic lives:** flight-path sampling, timeline mapping, year formatting, free-look
  clamp. No tests for lerp-grade one-liners.

## The 10 Scenes

| # | Scene | Template | Key assets |
|---|-------|----------|------------|
| 1 | Primordial soup | ocean | procedural only (vents, lightning, glow) |
| 2 | Cretaceous hunt | creature | T-Rex + Triceratops + raptor (have them) |
| 3 | The asteroid | sky-event | procedural flash/shockwave |
| 4 | First humans — campfires at dusk | character-cameo | 2-3 Mixamo figures, fire particles |
| 5 | Pyramids of Giza | crowd+landmark | pyramid GLB, instanced workers |
| 6 | Rome — Colosseum games day | crowd+landmark | colosseum GLB, instanced crowd |
| 7 | Medieval castle siege | battle | castle GLB, trebuchet, massed figures |
| 8 | Renaissance Florence — Leonardo waves | hero character | duomo GLB, 1 Mixamo hero + wave anim |
| 9 | Industrial revolution | vehicle/atmosphere | smokestacks, simple train on a spline |
| 10 | Kitty Hawk 1903 — Wright Flyer below you | vehicle flyby + finale | simple flyer model, beach terrain |

~25s per scene ≈ 4 min flight. Each scene = one module `src/scenes/NN-slug.js` exporting
`{ meta, build(ctx), update(dt, localT), dispose() }` — same contract as the full plan, so the
54-scene expansion reuses everything.

## Build Order (phases, from the full plan unless noted)

1. **Scaffold + engine core** — full plan Phases 0–1 as written (skip lerp tests).
2. **Sky/sun/fog, terrain, water** — Phases 2–3 as written.
3. **Glider + follow cam + flight path + free-look** — Phases 4–6 as written.
4. **Journey driver (simplified)** — Timeline (TDD, as Phase 7.2) + a plain array of 10 built scenes;
   transition veil (Phase 8.2). No SceneManager.
5. **Assets** — promise-cached `loadGLTF`; Crowd instancing helper (TDD counts, Phase 9.2); copy the
   6 dino GLBs from `spike-dino-viewer/public/models/` into `public/assets/creatures/`.
6. **HUD + audio + bloom** — Phases 10–12 as written (formatYear TDD kept).
7. **Scenes 1, 2, 5 first** (the three templates: ocean / creature / crowd+landmark), verify
   end-to-end with transitions, then scenes 3, 4, 6, 7, 8, 9, 10.
8. **Perf + deploy** — FPS meter, quality tier toggle (Low/High only), `vite build`, deploy to
   Vercel, `docs/credits.md` (Quaternius CC0, Mixamo, any landmark GLBs).

**Done =** 10-scene continuous flight, free-look + pause/speed, 60fps desktop, public URL, credits.

## Deferred to v2 (add only when v1 proves demand)
Sliding-window streaming · refcounted asset cache · remaining 44 scenes · mobile/touch tier ·
somber-history treatment (WWII decision revisited) · exotic creatures (AI-mesh route, needs credits).
