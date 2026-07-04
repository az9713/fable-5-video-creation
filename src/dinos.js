import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as skeletonClone } from 'three/addons/utils/SkeletonUtils.js';

export const DINOS = {
  trex: '34eed102-48f0-43dd-bc6f-ef7a6dfddfbb',
  parasaurolophus: '47b9d0bd-cddb-49be-b072-12201def24a9',
  triceratops: '6aa1f3ff-b9b3-4bb5-9d85-b2ffa514f0cc',
  stegosaurus: '6f8f4ac6-f9e8-488d-97a8-220b9b2fd02a',
  apatosaurus: '7b873860-f23f-4266-b341-5c5e6770cfa0',
  velociraptor: 'c1f0c4cb-c84f-415c-8323-d8cb871a2126',
};

const loader = new GLTFLoader();
const cache = new Map(); // promise-cached; ponytail: no refcounting, 6 small files

export function loadDino(name) {
  if (!cache.has(name)) {
    cache.set(name, loader.loadAsync(`/assets/creatures/${DINOS[name]}.glb`));
  }
  return cache.get(name);
}

// Returns an independently-animated instance: { object, mixer, play(clipRegex) }.
export async function spawnDino(name, { scale = 1 } = {}) {
  const gltf = await loadDino(name);
  const object = skeletonClone(gltf.scene);
  object.scale.setScalar(scale);
  object.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });
  const mixer = new THREE.AnimationMixer(object);
  function play(pattern) {
    const clip = gltf.animations.find((c) => pattern.test(c.name));
    if (clip) { mixer.stopAllAction(); mixer.clipAction(clip).play(); }
  }
  return { object, mixer, play };
}
