import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';

export function makeSky(scene, renderer) {
  const sky = new Sky();
  sky.scale.setScalar(2000); // must sit inside the camera far plane; recentered on camera each frame
  scene.add(sky);
  const sun = new THREE.DirectionalLight(0xfff1dc, 2.5);
  const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x8a7a55, 1.0);
  scene.add(sun, hemi);
  const u = sky.material.uniforms;
  u.turbidity.value = 3; u.rayleigh.value = 3;
  u.mieCoefficient.value = 0.003; u.mieDirectionalG.value = 0.8;

  scene.add(sun.target);
  // ponytail: no shadow maps — sun follows the active scene, a correct shadow
  // frustum per scene isn't worth it at glider altitude. Revisit if grounding
  // characters visually ever matters.
  function setSun(elevationDeg, azimuthDeg = 25, center = new THREE.Vector3()) {
    const phi = THREE.MathUtils.degToRad(90 - elevationDeg);
    const theta = THREE.MathUtils.degToRad(azimuthDeg);
    const dir = new THREE.Vector3().setFromSphericalCoords(1, phi, theta);
    u.sunPosition.value.copy(dir);
    sun.position.copy(center).addScaledVector(dir, 1000);
    sun.target.position.copy(center);
    sun.intensity = 0.6 + 2.6 * Math.max(0, Math.sin(THREE.MathUtils.degToRad(elevationDeg)));
    hemi.intensity = 0.45 + 1.0 * Math.max(0.05, Math.sin(THREE.MathUtils.degToRad(elevationDeg)));
  }
  setSun(35);
  return { sky, sun, hemi, setSun };
}

// Deterministic value-noise heightfield (no dependency needed at this fidelity).
// ponytail: 3-octave value noise, swap for simplex if terrain reads too soft.
export function heightField(seed, amplitude) {
  const rand = (ix, iz) => {
    const s = Math.sin(ix * 127.1 + iz * 311.7 + seed * 74.7) * 43758.5453;
    return s - Math.floor(s);
  };
  const smooth = (x, z) => {
    const ix = Math.floor(x), iz = Math.floor(z);
    const fx = x - ix, fz = z - iz;
    const sx = fx * fx * (3 - 2 * fx), sz = fz * fz * (3 - 2 * fz);
    const a = rand(ix, iz), b = rand(ix + 1, iz), c = rand(ix, iz + 1), d = rand(ix + 1, iz + 1);
    return a + (b - a) * sx + (c - a) * sz + (a - b - c + d) * sx * sz;
  };
  return (x, z) => {
    let v = 0, amp = 1, freq = 0.008, norm = 0;
    for (let o = 0; o < 5; o++) {
      v += smooth(x * freq, z * freq) * amp; norm += amp;
      amp *= 0.48; freq *= 2.2;
    }
    const n = (v / norm) * 2 - 1;
    return Math.sign(n) * Math.pow(Math.abs(n), 1.25) * amplitude; // sharper ridges, flatter valleys
  };
}

// Terrain patch centered at (cx, cz), vertex-colored by height between two palettes.
export function makeTerrain({ cx = 0, cz = 0, size = 900, seed = 1, amplitude = 22,
                              lowColor = 0x5e8c4f, highColor = 0x8c8578, waterY = null }) {
  const seg = 140;
  const geo = new THREE.PlaneGeometry(size, size, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const h = heightField(seed, amplitude);
  const detail = heightField(seed + 999, 1); // color-variation noise
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const lo = new THREE.Color(lowColor), hi = new THREE.Color(highColor), c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) + cx, z = pos.getZ(i) + cz;
    let y = h(x, z);
    if (waterY !== null && y < waterY + 2) y = Math.min(y, waterY - 1.5); // carve shores
    pos.setY(i, y);
    c.lerpColors(lo, hi, THREE.MathUtils.clamp((y + amplitude) / (2 * amplitude), 0, 1));
    const j = detail(x * 6, z * 6) * 0.09; // break up flat color
    colors.set([c.r + j, c.g + j, c.b + j], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }));
  mesh.position.set(cx, 0, cz);
  mesh.receiveShadow = true;
  mesh.userData.heightAt = (x, z) => h(x, z);
  return mesh;
}

// ponytail: scrolling-normal "water" via opacity+env color, not reflective Water shader —
// upgrade to three/addons Water if the flat look bothers anyone from altitude.
export function makeWater({ cx = 0, cz = 0, size = 1000, y = 0, color = 0x2a5d8a, opacity = 0.92 }) {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(size, size, 24, 24),
    new THREE.MeshStandardMaterial({ color, transparent: true, opacity, roughness: 0.15, metalness: 0.6 })
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(cx, y, cz);
  const base = mesh.geometry.attributes.position.array.slice();
  mesh.userData.update = (t) => {
    const p = mesh.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) {
      p.setZ(i, base[i * 3 + 2] + Math.sin(t * 1.2 + base[i * 3] * 0.05 + base[i * 3 + 1] * 0.07) * 0.8);
    }
    p.needsUpdate = true;
  };
  return mesh;
}

// Soft billboard clouds: radial-gradient sprites scattered along the whole journey.
export function makeClouds({ count = 140, zMin = -7800, zMax = 300 }) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const ctx = cv.getContext('2d');
  const grad = ctx.createRadialGradient(64, 64, 8, 64, 64, 62);
  grad.addColorStop(0, 'rgba(255,255,255,0.95)');
  grad.addColorStop(0.55, 'rgba(255,255,255,0.45)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(cv);
  const group = new THREE.Group();
  for (let i = 0; i < count; i++) {
    const mat = new THREE.SpriteMaterial({
      map: tex, transparent: true, opacity: 0.5 + Math.random() * 0.35,
      depthWrite: false, fog: false,
    });
    const s = new THREE.Sprite(mat);
    const w = 90 + Math.random() * 220;
    s.scale.set(w, w * (0.28 + Math.random() * 0.18), 1);
    s.position.set(
      (Math.random() - 0.5) * 1600,
      130 + Math.random() * 130,
      zMin + Math.random() * (zMax - zMin)
    );
    group.add(s);
  }
  return group;
}

// Instanced cone trees for green eras.
export function makeTrees({ count = 200, area = 380, cx = 0, cz = 0, heightAt = () => 0, color = 0x2f6b33 }) {
  const geo = new THREE.ConeGeometry(3, 12, 6);
  geo.translate(0, 6, 0);
  const mesh = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 1 }), count);
  const m = new THREE.Matrix4();
  for (let i = 0; i < count; i++) {
    const x = cx + (Math.random() - 0.5) * area * 2;
    const z = cz + (Math.random() - 0.5) * area * 2;
    const s = 0.6 + Math.random() * 1.2;
    m.makeScale(s, s, s).setPosition(x, heightAt(x, z), z);
    mesh.setMatrixAt(i, m);
  }
  mesh.castShadow = true;
  return mesh;
}
