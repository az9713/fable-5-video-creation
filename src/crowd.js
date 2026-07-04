import * as THREE from 'three';

// Instanced simple humans (capsule body + sphere head merged visually by scale).
// ponytail: capsule figures with CPU bob, not skinned Mixamo crowds — upgrade
// via vertex-animation textures if close-ups ever matter. From glider altitude
// (~60m+) these read as people.
export function makeCrowd({ positions, colors = [0xc9b28a, 0x8a5a3a, 0x6a6a8a, 0x9a4a4a], scale = 1 }) {
  const geo = new THREE.CapsuleGeometry(0.35, 1.1, 3, 6);
  geo.translate(0, 0.9, 0);
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.9 });
  const mesh = new THREE.InstancedMesh(geo, mat, positions.length);
  const m = new THREE.Matrix4();
  const c = new THREE.Color();
  positions.forEach((p, i) => {
    m.makeRotationY(Math.random() * Math.PI * 2);
    m.scale(new THREE.Vector3(scale, scale * (0.9 + Math.random() * 0.2), scale));
    m.setPosition(p.x, p.y, p.z);
    mesh.setMatrixAt(i, m);
    mesh.setColorAt(i, c.setHex(colors[i % colors.length]));
  });
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const base = positions;
  const phase = positions.map(() => Math.random() * Math.PI * 2);
  // Bob a working/walking crowd; cheap CPU update, only called for the active scene.
  mesh.userData.update = (t) => {
    const s = new THREE.Vector3(), q = new THREE.Quaternion(), pos = new THREE.Vector3();
    for (let i = 0; i < base.length; i++) {
      mesh.getMatrixAt(i, m);
      m.decompose(pos, q, s);
      pos.y = base[i].y + Math.abs(Math.sin(t * 3 + phase[i])) * 0.25;
      m.compose(pos, q, s);
      mesh.setMatrixAt(i, m);
    }
    mesh.instanceMatrix.needsUpdate = true;
  };
  return mesh;
}

export function scatter(count, cx, cz, radius, heightAt = () => 0) {
  const pts = [];
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * radius;
    const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
    pts.push(new THREE.Vector3(x, heightAt(x, z), z));
  }
  return pts;
}
