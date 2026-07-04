import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const MODELS = [
  '34eed102-48f0-43dd-bc6f-ef7a6dfddfbb',
  '47b9d0bd-cddb-49be-b072-12201def24a9',
  '6aa1f3ff-b9b3-4bb5-9d85-b2ffa514f0cc', // Triceratops (known)
  '6f8f4ac6-f9e8-488d-97a8-220b9b2fd02a',
  '7b873860-f23f-4266-b341-5c5e6770cfa0',
  'c1f0c4cb-c84f-415c-8323-d8cb871a2126',
];

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87b5d6);
scene.fog = new THREE.Fog(0x87b5d6, 30, 120);

const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 500);
camera.position.set(8, 5, 10);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 2, 0);

const sun = new THREE.DirectionalLight(0xfff2dd, 3);
sun.position.set(10, 20, 10);
sun.castShadow = true;
scene.add(sun, new THREE.HemisphereLight(0xbfd9ff, 0x8a7a55, 1.2));

const ground = new THREE.Mesh(
  new THREE.CircleGeometry(200, 48),
  new THREE.MeshStandardMaterial({ color: 0x6e9e58 })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const loader = new GLTFLoader();
let mixer = null, current = null;
const modelSel = document.getElementById('model');
const animSel = document.getElementById('anim');
const info = document.getElementById('info');

async function show(uuid) {
  if (current) { scene.remove(current); }
  const gltf = await loader.loadAsync(`/models/${uuid}.glb`);
  current = gltf.scene;
  current.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });
  scene.add(current);
  mixer = new THREE.AnimationMixer(current);
  animSel.replaceChildren();
  for (const clip of gltf.animations) {
    const opt = document.createElement('option');
    opt.value = opt.textContent = clip.name;
    animSel.appendChild(opt);
  }
  const nodeName = gltf.scene.children[0]?.name ?? uuid.slice(0, 8);
  info.textContent = `${nodeName} — ${gltf.animations.length} clips`;
  playClip(gltf, gltf.animations.find((c) => /walk/i.test(c.name)) ?? gltf.animations[0]);
  animSel.onchange = () => playClip(gltf, gltf.animations.find((c) => c.name === animSel.value));
}

function playClip(gltf, clip) {
  if (!clip) return;
  mixer.stopAllAction();
  mixer.clipAction(clip).play();
  animSel.value = clip.name;
}

for (const u of MODELS) {
  const opt = document.createElement('option');
  opt.value = u;
  opt.textContent = u.slice(0, 8);
  modelSel.appendChild(opt);
}
modelSel.onchange = () => show(modelSel.value);
show(MODELS[0]);

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  mixer?.update(clock.getDelta());
  controls.update();
  renderer.render(scene, camera);
});
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
