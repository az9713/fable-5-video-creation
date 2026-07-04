import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { makeSky, makeClouds } from './world.js';
import { makeCockpit, PilotCam } from './glider.js';
import { Journey } from './journey.js';
import { initHUD } from './hud.js';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.6; // Sky shader blows out to white above ~0.7
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 4000);
scene.add(camera);
const sky = makeSky(scene, renderer);
scene.add(makeClouds({}));
camera.add(makeCockpit());
const pilotCam = new PilotCam(camera, renderer.domElement);
const journey = new Journey(scene, sky);
window.J = journey; // dev/debug handle
window.R = renderer;
const hud = initHUD(journey);
journey.onScene = (i) => hud.setScene(i);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.2, 0.5, 0.92);
composer.addPass(bloom);
composer.addPass(new OutputPass());

// --- transport bar wiring ---
const playBtn = document.getElementById('play');
const seek = document.getElementById('seek');
const speedBtn = document.getElementById('speed');
const muteBtn = document.getElementById('mute');
const startBtn = document.getElementById('start');
const intro = document.getElementById('intro');

playBtn.onclick = () => {
  journey.playing = !journey.playing;
  playBtn.textContent = journey.playing ? '⏸' : '▶';
};
seek.oninput = () => journey.seek(seek.value / 1000);
const speeds = [1, 2, 0.5];
let si = 0;
speedBtn.onclick = () => {
  si = (si + 1) % speeds.length;
  journey.speed = speeds[si];
  speedBtn.textContent = `${speeds[si]}×`;
};

// Procedural wind audio — filtered noise, no asset files.
let audio = null;
function makeWind() {
  const ctx = new AudioContext();
  const len = ctx.sampleRate * 2;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf; src.loop = true;
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass'; filter.frequency.value = 480; filter.Q.value = 0.6;
  const gain = ctx.createGain();
  gain.gain.value = 0.05;
  src.connect(filter).connect(gain).connect(ctx.destination);
  src.start();
  return { ctx, gain };
}
muteBtn.onclick = () => {
  if (!audio) return;
  const muted = audio.gain.gain.value === 0;
  audio.gain.gain.value = muted ? 0.05 : 0;
  muteBtn.textContent = muted ? '🔊' : '🔇';
};

startBtn.onclick = async () => {
  startBtn.disabled = true;
  startBtn.textContent = 'PREPARING THE WINDS…';
  await journey.buildAll((p) => {
    startBtn.textContent = `PREPARING THE WINDS… ${Math.round(p * 100)}%`;
  });
  audio = makeWind();
  intro.classList.add('hidden');
  journey.playing = true;
};

// --- render loop ---
const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.1);
  const { position, tangent } = journey.update(dt);
  // bank from horizontal curvature (compare with tangent slightly ahead)
  const { index, localT } = journey.timeline.at(journey.t);
  const ahead = journey.path.atScene(index, Math.min(1, localT + 0.02)).tangent;
  const bank = THREE.MathUtils.clamp((tangent.x - ahead.x) * 12, -0.32, 0.32);
  position.y += Math.sin(journey.time * 1.6) * 0.35; // gentle thermal float
  pilotCam.update(dt, position, tangent, bank);
  sky.sky.position.copy(camera.position); // keep the atmosphere dome around the pilot
  hud.update(dt, position, tangent);
  if (journey.playing) seek.value = String(Math.round(journey.t * 1000));
  composer.render();
});

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
});
