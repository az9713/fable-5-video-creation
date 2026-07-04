import * as THREE from 'three';

// First-person hang-glider cockpit, parented to the camera.
// Geometry mirrors the real pilot POV: sail overhead with visible trailing
// edge, keel line receding to the nose, two down-tubes converging to the
// base bar low in frame, hands gripping the bar.
export function makeCockpit() {
  const g = new THREE.Group();

  const tubeMat = new THREE.MeshStandardMaterial({ color: 0x2e2a26, metalness: 0.5, roughness: 0.45 });
  function tube(a, b, r) {
    const dir = b.clone().sub(a);
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, dir.length(), 8), tubeMat);
    mesh.position.copy(a).addScaledVector(dir, 0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    return mesh;
  }

  // Sail overhead — swept delta, trailing edge dips into the top of the view
  const sailMat = new THREE.MeshStandardMaterial({
    color: 0xd8452e, roughness: 0.8, side: THREE.DoubleSide,
  });
  const sail = new THREE.Shape();
  sail.moveTo(0, 1.5);
  sail.quadraticCurveTo(2.2, 0.55, 3.1, -0.75);
  sail.quadraticCurveTo(1.4, -0.3, 0, -0.12);
  sail.quadraticCurveTo(-1.4, -0.3, -3.1, -0.75);
  sail.quadraticCurveTo(-2.2, 0.55, 0, 1.5);
  const wing = new THREE.Mesh(new THREE.ShapeGeometry(sail, 14), sailMat);
  wing.scale.setScalar(0.8);
  wing.rotation.x = Math.PI / 2 - 0.16;
  wing.position.set(0, 0.42, -0.55);

  // Keel line to the nose (visible above, like the reference)
  const keel = tube(new THREE.Vector3(0, 0.4, 0.1), new THREE.Vector3(0, 0.32, -1.45), 0.008);

  // A-frame: down-tubes converging to the base bar, low and ahead
  const barL = new THREE.Vector3(-0.16, -0.3, -0.62);
  const barR = new THREE.Vector3(0.16, -0.3, -0.62);
  const downL = tube(new THREE.Vector3(-0.4, 0.42, -0.5), barL, 0.009);
  const downR = tube(new THREE.Vector3(0.4, 0.42, -0.5), barR, 0.009);
  const bar = tube(barL, barR, 0.011);

  // Hands on the bar
  const skin = new THREE.MeshStandardMaterial({ color: 0x9a6a44, roughness: 0.9 });
  function hand(x) {
    const h = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), skin);
    h.scale.set(1.15, 0.85, 1.4);
    h.position.set(x, -0.285, -0.62);
    return h;
  }

  g.add(wing, keel, downL, downR, bar, hand(-0.1), hand(0.1));
  return g;
}

// Head camera: rides the flight path, looks along the tangent,
// mouse adds clamped yaw/pitch, curvature adds roll. Smoothed.
export class PilotCam {
  constructor(camera, dom) {
    this.camera = camera;
    this.yaw = 0; this.pitch = 0;
    this.targetYaw = 0; this.targetPitch = 0;
    this.roll = 0;
    this.q = new THREE.Quaternion();
    this.m = new THREE.Matrix4();
    dom.addEventListener('pointermove', (e) => {
      const nx = (e.clientX / innerWidth) * 2 - 1;
      const ny = (e.clientY / innerHeight) * 2 - 1;
      this.targetYaw = -nx * 1.1;
      this.targetPitch = -ny * 0.6;
    });
  }
  update(dt, position, tangent, bank) {
    this.yaw += (this.targetYaw - this.yaw) * Math.min(1, dt * 2.5);
    this.pitch += (this.targetPitch - this.pitch) * Math.min(1, dt * 2.5);
    this.roll += (bank - this.roll) * Math.min(1, dt * 2);
    this.camera.position.copy(position);
    this.m.lookAt(position, position.clone().add(tangent), THREE.Object3D.DEFAULT_UP);
    this.q.setFromRotationMatrix(this.m);
    this.camera.quaternion.copy(this.q);
    this.camera.rotateY(this.yaw);
    this.camera.rotateX(this.pitch);
    this.camera.rotateZ(this.roll);
  }
}
