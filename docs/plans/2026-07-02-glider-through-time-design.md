# Glider Through Time — Design Document

**Date:** 2026-07-02
**Status:** Validated, ready for implementation

## Concept

A browser-based 3D cinematic experience. The viewer is **the Glider** — a silent hero on a
hang-glider riding a shimmering "time-stream" wind — flying in one continuous, unbroken flight
across the entire arc of history, from the primordial soup (~3.8 billion years ago) to the dawn of
peace after World War II. History unfolds *below* the glider. Between eras the world dissolves and
reforms through clouds and light, so the whole journey reads as a single connected landscape rather
than a slideshow.

**Tone:** Fun, awe-struck, and cinematic. Realistic-but-painterly art (NOT blocky/voxel). Smooth
articulated figures, real motion-captured animation for hero characters, procedural natural beauty
(sky, sun, water, clouds, terrain) that looks great from altitude.

## Delivery & Interaction

- **Medium:** Browser, Three.js / WebGL. Runs anywhere, shareable as a link, buildable entirely in code.
- **Interaction model:** *Guided tour + free look.* The glider follows a scripted flight path (so
  pacing and storytelling stay cinematic), while the viewer can move the mouse to look around and
  adjust speed / pause. It plays like a video but feels alive.

## Art Sourcing

**Procedural + curated free assets:**
- **Procedural (code):** terrain (noise heightmaps), water, sky/atmosphere, sun, clouds, lighting,
  fog. These look best from the air and cost nothing.
- **Curated free assets:** landmarks and hero props from CC0 libraries (Sketchfab CC0, Poly Pizza,
  Smithsonian 3D, Quaternius); animated humans/creatures from **Mixamo** (free rigged + mocap
  animations) and CC0 creature packs.
- All assets baked into the project — no per-request generation, no runtime API costs.

## Scene Tiering (how 54 scenes stay buildable)

- **Hero scenes (~12):** named characters, crowds, set-piece animation, close narrative beats.
- **Flythrough scenes (~42):** rich atmospheric beats — terrain, a few landmarks, instanced
  background figures — flown through more quickly.

Every scene shares one interface and one asset pipeline, so flythrough scenes are cheap variations
of the same machinery that powers hero scenes.

## The 54-Scene Itinerary

**ACT I — Deep Time:** 1 Primordial soup · 2 First life/cyanobacteria · 3 Cambrian seas ·
4 Ordovician reefs · 5 Carboniferous swamp (giant insects) · 6 Permian desert (dimetrodon) ·
7 Triassic dawn of dinosaurs · 8 Jurassic giants · 9 Cretaceous hunt · 10 The asteroid · 11 Ice Age.

**ACT II — Rise of Humanity:** 12 First humans/Lascaux · 13 Mammoth hunt · 14 Agricultural revolution ·
15 Göbekli Tepe · 16 Stonehenge · 17 Sumer/Ur · 18 Pyramids of Giza · 19 Ancient Egypt life.

**ACT III — Classical World:** 20 Minoan Knossos · 21 Babylon · 22 Ancient Olympia · 23 Classical
Athens · 24 Alexander's army · 25 Library of Alexandria · 26 Great Wall of China · 27 Terracotta
Army · 28 Rome/Colosseum · 29 Roman aqueducts & legions · 30 Pompeii/Vesuvius.

**ACT IV — Middle Ages & Beyond:** 31 Fall of Rome · 32 Byzantine Constantinople · 33 Maya Tikal ·
34 Viking longships · 35 Angkor Wat · 36 Islamic Golden Age/Baghdad · 37 Medieval siege · 38 Gothic
cathedral · 39 Black Death · 40 Mongol horde · 41 Mali/Mansa Musa.

**ACT V — Modern World:** 42 Renaissance Florence (Leonardo) · 43 Age of Sail · 44 Aztec
Tenochtitlan · 45 Printing press & Reformation · 46 Scientific Revolution (Galileo) · 47
Enlightenment/Montgolfier balloon · 48 Revolutions · 49 Industrial Revolution · 50 Wright Flyer ·
51 Roaring Twenties · 52 WWII · 53 The Blitz/air battle · 54 Dawn of peace (ending).

## Architecture Summary

- **Engine core:** renderer, render loop, clock, resize, postprocessing.
- **World systems (shared, procedural):** sky/atmosphere, sun+lighting, terrain, water, clouds, fog.
- **Glider rig:** the hang-glider model + follow camera + free-look offset.
- **Flight system:** one global `CatmullRomCurve3` path; a timeline maps global progress `t∈[0,1]`
  to `{sceneIndex, localProgress}`.
- **SceneManager (streaming):** each scene is a lazy-imported module implementing
  `build/update/dispose`. Only the current and next scene are resident in memory; previous scenes
  are disposed. This is what makes 54 scenes possible without exhausting GPU memory.
- **Transitions:** a "time-stream veil" (fog + light + cloud wipe) covers each scene swap.
- **Asset pipeline:** GLTF loader, Mixamo animation loader, `InstancedMesh` crowd helper, LOD.
- **UI:** intro screen, scene captions (year + title), progress scrubber, play/pause, speed.
- **Audio:** ambient bed + music per scene, crossfaded on transition.

## Success Criteria

1. Continuous ~10–12 minute flight through all 54 scenes with no hard loading breaks.
2. Holds a smooth frame rate (target 60 fps desktop, graceful degrade on mobile) via streaming +
   instancing + LOD.
3. Viewer can free-look and control speed/pause at any time.
4. Visuals read as painterly-realistic, never blocky.
5. Shareable as a single deployed URL.
