import * as THREE from 'three';
import { FlightPath, Timeline } from './flight.js';
import { SCENES } from './scenes.js';

// Builds all scenes up front (ponytail: 10 light scenes — stream when 54 exist),
// owns global progress, scene switching, veil transition, fog/sun blending.
export class Journey {
  constructor(scene, sky) {
    this.scene = scene;
    this.sky = sky;
    this.timeline = new Timeline(SCENES);
    this.path = new FlightPath(SCENES.flatMap((s) => s.path));
    this.t = 0;
    this.speed = 1;
    this.playing = false;
    this.currentIndex = -1;
    this.time = 0;
    this.ready = false;
    this.SECONDS = 240; // full journey at 1x
    this.veil = document.getElementById('veil');
    this.onScene = null; // set by main; called with (index) on scene change
  }

  async buildAll(onProgress) {
    for (let i = 0; i < SCENES.length; i++) {
      const s = SCENES[i];
      s.group = new THREE.Group();
      await s.build(s.group);
      this.scene.add(s.group);
      onProgress?.((i + 1) / SCENES.length);
      await new Promise((r) => setTimeout(r)); // let the UI breathe between scenes
    }
    this.ready = true;
  }

  seek(t) { this.t = THREE.MathUtils.clamp(t, 0, 0.9999); }

  update(dt) {
    if (!this.ready) return this.path.at(this.t);
    this.time += dt;
    if (this.playing) this.t = Math.min(0.9999, this.t + (dt / this.SECONDS) * this.speed);
    const { index, localT } = this.timeline.at(this.t);
    if (index !== this.currentIndex) this.enterScene(index);
    SCENES[index].update?.(dt, localT, { time: this.time });
    return this.path.atScene(index, localT);
  }

  enterScene(index) {
    this.currentIndex = index;
    const s = SCENES[index];
    // veil flash
    this.veil.style.opacity = '0.9';
    setTimeout(() => { this.veil.style.opacity = '0'; }, 250);
    // environment
    this.scene.fog = new THREE.FogExp2(s.fog.color, s.fog.density);
    this.scene.background = new THREE.Color(s.fog.color);
    this.sky.setSun(s.sun, 25, new THREE.Vector3(0, 0, -index * 800));
    this.onScene?.(index);
  }
}
