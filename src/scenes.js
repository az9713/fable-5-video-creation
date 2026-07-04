import * as THREE from 'three';
import { makeTerrain, makeWater, makeTrees } from './world.js';
import { makeCrowd, scatter } from './crowd.js';
import { spawnDino } from './dinos.js';

// Scene i owns world-space z in [-i*L - L/2, -i*L + L/2], centered at (0, 0, -i*L).
export const L = 800;
const cz = (i) => -i * L;

// Helper: standard flight control points through scene i (gentle S-curve, given altitude).
function sPath(i, alt = 60, sway = 90) {
  return [
    new THREE.Vector3(sway, alt + 8, cz(i) + L * 0.38),
    new THREE.Vector3(-sway, alt, cz(i)),
    new THREE.Vector3(sway * 0.5, alt + 12, cz(i) - L * 0.38),
  ];
}

function fire(x, y, z) {
  const g = new THREE.Group();
  const light = new THREE.PointLight(0xff7722, 40, 60, 1.8);
  light.position.set(0, 2, 0);
  const glow = new THREE.Mesh(new THREE.SphereGeometry(0.8, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0xffaa33 }));
  g.add(light, glow);
  g.position.set(x, y, z);
  g.userData.update = (t) => { light.intensity = 34 + Math.sin(t * 9 + x) * 8; };
  return g;
}

export const SCENES = [
  { // 1 — Primordial Soup
    title: 'The Primordial Soup', year: -3.8e9,
    blurb: 'Lightning stirs a young, restless ocean. Something is beginning.',
    duration: 1, sun: 14, fog: { color: 0xa8c0d4, density: 0.00126 },
    path: sPath(0, 45),
    async build(g) {
      this.water = makeWater({ cz: cz(0), size: 1000, y: 6, color: 0x1d3a3f, opacity: 1 });
      g.add(this.water);
      const volcano = new THREE.Mesh(new THREE.ConeGeometry(60, 90, 24),
        new THREE.MeshStandardMaterial({ color: 0x3a3230, roughness: 1 }));
      volcano.position.set(-160, 0, cz(0) - 180);
      const glow = new THREE.Mesh(new THREE.SphereGeometry(12, 12, 8),
        new THREE.MeshBasicMaterial({ color: 0xff4400 }));
      glow.position.set(-160, 92, cz(0) - 180);
      const mounds = new THREE.InstancedMesh(new THREE.SphereGeometry(3, 8, 6),
        new THREE.MeshStandardMaterial({ color: 0x4a6a52, emissive: 0x1a3a22 }), 60);
      const m = new THREE.Matrix4();
      for (let i = 0; i < 60; i++) {
        m.makeScale(1, 0.4, 1).setPosition((Math.random() - 0.5) * 500, 6.2, cz(0) + (Math.random() - 0.5) * 500);
        mounds.setMatrixAt(i, m);
      }
      this.flash = new THREE.DirectionalLight(0xccddff, 0);
      g.add(volcano, glow, mounds, this.flash);
    },
    update(dt, t, { time }) {
      this.flash.intensity = (Math.sin(time * 0.7) > 0.985 || Math.sin(time * 1.31 + 4) > 0.99) ? 8 : 0;
      this.water?.userData.update?.(time);
    },
  },
  { // 2 — Cretaceous Hunt
    title: 'The Age of Dinosaurs', year: -66e6,
    blurb: 'A tyrant king hunts. Giants graze the fern plains, unbothered.',
    duration: 1.2, sun: 40, fog: { color: 0xb4cee0, density: 0.00092 },
    path: sPath(1, 55),
    async build(g) {
      const terr = makeTerrain({ cz: cz(1), seed: 7, amplitude: 14, lowColor: 0x4d7a3e, highColor: 0x7a6f52 });
      const h = terr.userData.heightAt;
      g.add(terr, makeTrees({ cx: 0, cz: cz(1), count: 260, heightAt: h }));
      this.dinos = [];
      const put = (d, x, z, rotY = 0) => {
        d.object.position.set(x, h(x, z), z);
        d.object.rotation.y = rotY;
        g.add(d.object);
        this.dinos.push(d);
        return d;
      };
      this.trex = put(await spawnDino('trex', { scale: 2.2 }), 30, cz(1) - 40, -0.4);
      this.trike = put(await spawnDino('triceratops', { scale: 1.8 }), 10, cz(1) - 70, -0.5);
      this.trex.play(/Run/); this.trike.play(/Run/);
      put(await spawnDino('apatosaurus', { scale: 3 }), -120, cz(1) + 100, 0.8).play(/Idle/);
      put(await spawnDino('stegosaurus', { scale: 1.6 }), -90, cz(1) + 160, 2.1).play(/Walk/);
      put(await spawnDino('parasaurolophus', { scale: 1.5 }), 130, cz(1) + 140, -1.2).play(/Walk/);
      put(await spawnDino('velociraptor', { scale: 1.2 }), 60, cz(1) - 20, -0.4).play(/Run/);
      this.h = h;
    },
    update(dt, t, { time }) {
      // circular chase: trike flees on a wide circle, trex trails it
      const R = 55, w = 0.22, center = { x: 0, z: cz(1) - 45 };
      const place = (d, ang) => {
        const x = center.x + Math.cos(ang) * R, z = center.z + Math.sin(ang) * R;
        d.object.position.set(x, this.h(x, z), z);
        d.object.rotation.y = -ang - Math.PI / 2 + 0.3;
      };
      place(this.trike, time * w);
      place(this.trex, time * w - 0.55);
      for (const d of this.dinos) d.mixer.update(dt);
    },
  },
  { // 3 — The Asteroid
    title: 'The Sky Falls', year: -66e6,
    blurb: 'Sixty-six million years ago, the sky chose new kings.',
    duration: 0.8, sun: 8, fog: { color: 0xb0a294, density: 0.00126 },
    path: sPath(2, 70),
    async build(g) {
      g.add(makeTerrain({ cz: cz(2), seed: 7, amplitude: 14, lowColor: 0x5a6a48, highColor: 0x7a6f52 }));
      this.meteor = new THREE.Mesh(new THREE.SphereGeometry(4, 10, 8),
        new THREE.MeshBasicMaterial({ color: 0xffdd88 }));
      const trailMat = new THREE.MeshBasicMaterial({ color: 0xff8833, transparent: true, opacity: 0.6 });
      this.trail = new THREE.Mesh(new THREE.ConeGeometry(2.5, 60, 8), trailMat);
      this.flashRing = new THREE.Mesh(new THREE.RingGeometry(1, 1.35, 48),
        new THREE.MeshBasicMaterial({ color: 0xffcc99, transparent: true, opacity: 0, side: THREE.DoubleSide }));
      this.flashRing.rotation.x = -Math.PI / 2;
      this.flashRing.position.set(-250, 4, cz(2) - 700);
      g.add(this.meteor, this.trail, this.flashRing);
    },
    update(dt, t) {
      // meteor descends across the scene during localT 0..0.55, impact at 0.55
      const k = Math.min(1, t / 0.55);
      this.meteor.position.set(-250 + 500 * (1 - k) + 120, 500 * (1 - k) + 8, cz(2) - 700 + 300 * (1 - k));
      this.trail.position.copy(this.meteor.position).add(new THREE.Vector3(18, 22, 10));
      this.trail.lookAt(this.meteor.position);
      this.trail.rotateX(Math.PI / 2);
      const boom = THREE.MathUtils.clamp((t - 0.55) / 0.45, 0, 1);
      this.meteor.visible = this.trail.visible = t < 0.55;
      this.flashRing.material.opacity = boom > 0 ? (1 - boom) * 0.9 : 0;
      this.flashRing.scale.setScalar(1 + boom * 600);
    },
  },
  { // 4 — First Humans
    title: 'The First Fires', year: -40000,
    blurb: 'Small bands under a big dusk. They have stories already.',
    duration: 0.9, sun: 6, fog: { color: 0x8a86a4, density: 0.00118 },
    path: sPath(3, 42),
    async build(g) {
      const terr = makeTerrain({ cz: cz(3), seed: 21, amplitude: 10, lowColor: 0x6a5f45, highColor: 0x8a7a5f });
      const h = terr.userData.heightAt;
      g.add(terr);
      this.fires = [];
      const camps = [[-40, cz(3) - 30], [35, cz(3) + 60], [90, cz(3) - 120]];
      for (const [x, z] of camps) {
        const f = fire(x, h(x, z) + 0.5, z);
        this.fires.push(f);
        g.add(f);
        g.add(makeCrowd({ positions: scatter(9, x, z, 8, h) }));
        const tent = new THREE.Mesh(new THREE.ConeGeometry(4, 5, 7),
          new THREE.MeshStandardMaterial({ color: 0x7a6248, roughness: 1 }));
        tent.position.set(x + 8, h(x + 8, z + 4) + 2.4, z + 4);
        g.add(tent);
      }
      this.crowds = g.children.filter((c) => c.userData.update && c.isInstancedMesh);
    },
    update(dt, t, { time }) {
      for (const f of this.fires) f.userData.update(time);
      for (const c of this.crowds) c.userData.update(time * 0.5);
    },
  },
  { // 5 — Pyramids of Giza
    title: 'The Pyramids Rise', year: -2500,
    blurb: 'Ten thousand hands, one pharaoh’s dream, stone by stone.',
    duration: 1.2, sun: 55, fog: { color: 0xd8d2c0, density: 0.00076 },
    path: sPath(4, 65),
    async build(g) {
      const terr = makeTerrain({ cz: cz(4), seed: 33, amplitude: 5, lowColor: 0xd9c08a, highColor: 0xc4a86e });
      const h = terr.userData.heightAt;
      g.add(terr);
      const stone = new THREE.MeshStandardMaterial({ color: 0xd8c69a, roughness: 0.9 });
      const pyr = (x, z, s, complete = 1) => {
        const p = new THREE.Mesh(new THREE.ConeGeometry(s, s * 0.9 * complete, 4), stone);
        p.rotation.y = Math.PI / 4;
        p.position.set(x, h(x, z) + (s * 0.9 * complete) / 2, z);
        p.castShadow = true;
        g.add(p);
      };
      pyr(-60, cz(4) - 80, 70);
      pyr(50, cz(4) + 30, 55);
      pyr(130, cz(4) + 130, 40, 0.55); // under construction
      // ramp + worker lines to the unfinished one
      const ramp = new THREE.Mesh(new THREE.BoxGeometry(6, 2, 90),
        new THREE.MeshStandardMaterial({ color: 0xc9b083 }));
      ramp.position.set(130, h(130, cz(4) + 180) + 6, cz(4) + 180);
      ramp.rotation.x = -0.18;
      g.add(ramp);
      this.crowd = makeCrowd({ positions: scatter(420, 100, cz(4) + 150, 90, h) });
      g.add(this.crowd);
      // Nile
      g.add(makeWater({ cx: -320, cz: cz(4), size: 700, y: 1.5, color: 0x3a6a5a }));
      const green = makeTrees({ cx: -280, cz: cz(4), count: 90, area: 200, heightAt: h, color: 0x4a7a3a });
      g.add(green);
    },
    update(dt, t, { time }) { this.crowd.userData.update(time); },
  },
  { // 6 — Rome
    title: 'Games Day in Rome', year: 80,
    blurb: 'Fifty thousand voices. The Colosseum swallows them whole.',
    duration: 1, sun: 48, fog: { color: 0xc4d2de, density: 0.00084 },
    path: sPath(5, 58),
    async build(g) {
      const terr = makeTerrain({ cz: cz(5), seed: 45, amplitude: 7, lowColor: 0x8a915e, highColor: 0x9a8a6a });
      const h = terr.userData.heightAt;
      g.add(terr);
      const y0 = h(0, cz(5)) + 1;
      // Colosseum: two concentric arched walls from instanced columns + ring floors
      const wallMat = new THREE.MeshStandardMaterial({ color: 0xd9cdb0, roughness: 0.85 });
      const ring = (r, ht, segs) => {
        const cols = new THREE.InstancedMesh(new THREE.BoxGeometry(3, ht, 2), wallMat, segs);
        const m = new THREE.Matrix4();
        for (let i = 0; i < segs; i++) {
          const a = (i / segs) * Math.PI * 2;
          m.makeRotationY(-a).setPosition(Math.cos(a) * r * 1.25, y0 + ht / 2, cz(5) + Math.sin(a) * r);
          cols.setMatrixAt(i, m);
        }
        return cols;
      };
      g.add(ring(45, 26, 72), ring(38, 22, 64), ring(31, 18, 56));
      const arena = new THREE.Mesh(new THREE.CircleGeometry(30, 36),
        new THREE.MeshStandardMaterial({ color: 0xd9b98a }));
      arena.rotation.x = -Math.PI / 2;
      arena.scale.x = 1.25;
      arena.position.set(0, y0 + 0.2, cz(5));
      g.add(arena);
      this.crowd = makeCrowd({ positions: scatter(500, 0, cz(5), 52, () => y0 + 15) });
      g.add(this.crowd);
      // city blocks around
      const houses = new THREE.InstancedMesh(new THREE.BoxGeometry(8, 6, 10),
        new THREE.MeshStandardMaterial({ color: 0xc9a884 }), 160);
      const m = new THREE.Matrix4();
      for (let i = 0; i < 160; i++) {
        const x = (Math.random() - 0.5) * 600, z = cz(5) + (Math.random() - 0.5) * 600;
        if (Math.hypot(x, z - cz(5)) < 90) continue;
        m.makeRotationY(Math.random() * 3).setPosition(x, h(x, z) + 3, z);
        houses.setMatrixAt(i, m);
      }
      g.add(houses);
    },
    update(dt, t, { time }) { this.crowd.userData.update(time * 1.5); },
  },
  { // 7 — Medieval Siege
    title: 'The Siege', year: 1200,
    blurb: 'Stone walls, iron will, and arithmetic done with trebuchets.',
    duration: 1, sun: 30, fog: { color: 0xb0c4d8, density: 0.00101 },
    path: sPath(6, 60),
    async build(g) {
      const terr = makeTerrain({ cz: cz(6), seed: 52, amplitude: 16, lowColor: 0x5e7a4a, highColor: 0x8a8578 });
      const h = terr.userData.heightAt;
      g.add(terr, makeTrees({ cx: -200, cz: cz(6) + 200, count: 120, area: 180, heightAt: h }));
      const stoneMat = new THREE.MeshStandardMaterial({ color: 0x9a9a94, roughness: 0.95 });
      const castleY = h(-40, cz(6) - 60);
      const keep = new THREE.Mesh(new THREE.BoxGeometry(26, 30, 26), stoneMat);
      keep.position.set(-40, castleY + 15, cz(6) - 60);
      g.add(keep);
      for (const [dx, dz] of [[-22, -22], [22, -22], [-22, 22], [22, 22]]) {
        const tow = new THREE.Mesh(new THREE.CylinderGeometry(6, 7, 38, 10), stoneMat);
        tow.position.set(-40 + dx, castleY + 19, cz(6) - 60 + dz);
        const roof = new THREE.Mesh(new THREE.ConeGeometry(7.5, 9, 10),
          new THREE.MeshStandardMaterial({ color: 0x5a3a2a }));
        roof.position.set(-40 + dx, castleY + 42, cz(6) - 60 + dz);
        g.add(tow, roof);
      }
      // trebuchets + attacker/defender crowds
      this.trebs = [];
      for (const x of [60, 90, 120]) {
        const t = new THREE.Group();
        const frame = new THREE.Mesh(new THREE.BoxGeometry(3, 8, 6),
          new THREE.MeshStandardMaterial({ color: 0x6a4a2a }));
        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.8, 14, 0.8),
          new THREE.MeshStandardMaterial({ color: 0x7a5a3a }));
        arm.position.y = 7;
        t.add(frame, arm);
        t.position.set(x, h(x, cz(6) + 40) + 4, cz(6) + 40);
        t.userData.arm = arm;
        this.trebs.push(t);
        g.add(t);
      }
      this.rock = new THREE.Mesh(new THREE.SphereGeometry(1.2, 8, 6),
        new THREE.MeshStandardMaterial({ color: 0x555 }));
      g.add(this.rock);
      this.attackers = makeCrowd({ positions: scatter(220, 100, cz(6) + 60, 60, h), colors: [0x8a2a2a, 0x6a6a6a] });
      this.defenders = makeCrowd({ positions: scatter(60, -40, cz(6) - 60, 30, (x, z) => castleY + 31) , colors: [0x2a4a8a] });
      g.add(this.attackers, this.defenders);
      this.h = h;
    },
    update(dt, t, { time }) {
      const cycle = (time % 4) / 4;
      for (const tr of this.trebs) tr.userData.arm.rotation.z = cycle < 0.15 ? -1.4 * (cycle / 0.15) : -1.4 + 1.4 * Math.min(1, (cycle - 0.15) / 0.2);
      const k = THREE.MathUtils.clamp((cycle - 0.15) / 0.5, 0, 1); // rock arc
      this.rock.visible = k > 0 && k < 1;
      this.rock.position.set(60 - 100 * k, this.h(60, cz(6) + 40) + 8 + 60 * Math.sin(k * Math.PI), cz(6) + 40 - 100 * k);
      this.attackers.userData.update(time * 2);
    },
  },
  { // 8 — Renaissance Florence
    title: 'Florence, and a Man Looking Up', year: 1502,
    blurb: 'Leonardo sketches wings. He would have envied yours.',
    duration: 1, sun: 42, fog: { color: 0xccd6dc, density: 0.0008 },
    path: sPath(7, 48),
    async build(g) {
      const terr = makeTerrain({ cz: cz(7), seed: 61, amplitude: 9, lowColor: 0x8a9158, highColor: 0x9a8a6a });
      const h = terr.userData.heightAt;
      g.add(terr);
      const y0 = h(0, cz(7));
      // Duomo: drum + dome + lantern
      const drum = new THREE.Mesh(new THREE.CylinderGeometry(16, 16, 14, 8),
        new THREE.MeshStandardMaterial({ color: 0xe8dcc4 }));
      drum.position.set(0, y0 + 12, cz(7));
      const dome = new THREE.Mesh(new THREE.SphereGeometry(16, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2),
        new THREE.MeshStandardMaterial({ color: 0xa84a2a, roughness: 0.7 }));
      dome.position.set(0, y0 + 19, cz(7));
      dome.scale.y = 1.15;
      const lantern = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 8, 8),
        new THREE.MeshStandardMaterial({ color: 0xe8dcc4 }));
      lantern.position.set(0, y0 + 40, cz(7));
      g.add(drum, dome, lantern);
      // red-roofed city
      const walls = new THREE.InstancedMesh(new THREE.BoxGeometry(7, 5, 9),
        new THREE.MeshStandardMaterial({ color: 0xe0d2b0 }), 240);
      const roofs = new THREE.InstancedMesh(new THREE.ConeGeometry(6, 3.5, 4),
        new THREE.MeshStandardMaterial({ color: 0xa8502e }), 240);
      const m = new THREE.Matrix4();
      for (let i = 0; i < 240; i++) {
        const x = (Math.random() - 0.5) * 500, z = cz(7) + (Math.random() - 0.5) * 500;
        if (Math.hypot(x, z - cz(7)) < 34) continue;
        const y = h(x, z);
        const rot = Math.floor(Math.random() * 4) * Math.PI / 2;
        m.makeRotationY(rot).setPosition(x, y + 2.5, z);
        walls.setMatrixAt(i, m);
        m.makeRotationY(rot + Math.PI / 4).setPosition(x, y + 6.5, z);
        roofs.setMatrixAt(i, m);
      }
      g.add(walls, roofs);
      // Leonardo on a tower, waving (one articulated arm)
      const tower = new THREE.Mesh(new THREE.BoxGeometry(8, 24, 8),
        new THREE.MeshStandardMaterial({ color: 0xd0c0a0 }));
      tower.position.set(50, y0 + 12, cz(7) + 40);
      const leo = new THREE.Group();
      const robe = new THREE.Mesh(new THREE.CapsuleGeometry(0.9, 2.2, 4, 8),
        new THREE.MeshStandardMaterial({ color: 0x8a2a5a }));
      robe.position.y = 2;
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 8),
        new THREE.MeshStandardMaterial({ color: 0xd9a066 }));
      head.position.y = 3.9;
      this.arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 1.6, 3, 6),
        new THREE.MeshStandardMaterial({ color: 0x8a2a5a }));
      this.arm.geometry.translate(0, 0.9, 0);
      this.arm.position.set(0.9, 2.9, 0);
      leo.add(robe, head, this.arm);
      leo.position.set(50, y0 + 24, cz(7) + 40);
      leo.scale.setScalar(2.2); // legible from altitude
      g.add(tower, leo);
      this.crowd = makeCrowd({ positions: scatter(150, 0, cz(7) + 90, 70, h) });
      g.add(this.crowd);
    },
    update(dt, t, { time }) {
      this.arm.rotation.z = 2.4 + Math.sin(time * 6) * 0.5; // enthusiastic wave
      this.crowd.userData.update(time);
    },
  },
  { // 9 — Industrial Revolution
    title: 'The Machine Age', year: 1850,
    blurb: 'Smoke, steel and steam — the world learns to hurry.',
    duration: 0.9, sun: 24, fog: { color: 0xaab4ba, density: 0.00134 },
    path: sPath(8, 55),
    async build(g) {
      const terr = makeTerrain({ cz: cz(8), seed: 77, amplitude: 8, lowColor: 0x6a7055, highColor: 0x7a7568 });
      const h = terr.userData.heightAt;
      g.add(terr);
      const brick = new THREE.MeshStandardMaterial({ color: 0x7a4a3a, roughness: 1 });
      this.smokes = [];
      for (const [x, z] of [[-60, cz(8) - 40], [-20, cz(8) - 90], [40, cz(8) - 30], [80, cz(8) - 110], [0, cz(8) + 40]]) {
        const mill = new THREE.Mesh(new THREE.BoxGeometry(24, 12, 14), brick);
        mill.position.set(x, h(x, z) + 6, z);
        const stack = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 2.4, 30, 8), brick);
        stack.position.set(x + 8, h(x, z) + 25, z);
        g.add(mill, stack);
        const puffs = new THREE.InstancedMesh(new THREE.SphereGeometry(2.4, 7, 6),
          new THREE.MeshStandardMaterial({ color: 0x8a8a8a, transparent: true, opacity: 0.55 }), 14);
        puffs.userData.base = [x + 8, h(x, z) + 40, z];
        this.smokes.push(puffs);
        g.add(puffs);
      }
      // train on a loop
      this.train = new THREE.Group();
      const loco = new THREE.Mesh(new THREE.BoxGeometry(8, 4, 3.4),
        new THREE.MeshStandardMaterial({ color: 0x2a2a2a }));
      this.train.add(loco);
      for (let i = 1; i <= 4; i++) {
        const car = new THREE.Mesh(new THREE.BoxGeometry(7, 3, 3.2),
          new THREE.MeshStandardMaterial({ color: 0x5a3a2a }));
        car.position.x = -i * 8.5;
        this.train.add(car);
      }
      g.add(this.train);
      this.h = h;
    },
    update(dt, t, { time }) {
      const m = new THREE.Matrix4();
      for (const s of this.smokes) {
        const [bx, by, bz] = s.userData.base;
        for (let i = 0; i < 14; i++) {
          const k = ((time * 0.28 + i / 14) % 1);
          m.makeScale(1 + k * 2.2, 1 + k * 2.2, 1 + k * 2.2)
            .setPosition(bx + k * 16 + Math.sin(i) * 2, by + k * 42, bz + Math.cos(i * 3) * 2);
          s.setMatrixAt(i, m);
        }
        s.instanceMatrix.needsUpdate = true;
      }
      const a = time * 0.15, R = 190;
      this.train.position.set(Math.cos(a) * R, this.h(Math.cos(a) * R, cz(8) + Math.sin(a) * R) + 2.2, cz(8) + Math.sin(a) * R);
      this.train.rotation.y = -a - Math.PI / 2;
    },
  },
  { // 10 — Kitty Hawk
    title: 'Twelve Seconds That Changed Everything', year: 1903,
    blurb: 'Below you, two brothers prove the sky belongs to everyone.',
    duration: 1.1, sun: 20, fog: { color: 0xc6d4de, density: 0.00076 },
    path: [
      new THREE.Vector3(80, 55, cz(9) + L * 0.38),
      new THREE.Vector3(-40, 32, cz(9)),           // dip low over the flyer
      new THREE.Vector3(30, 70, cz(9) - L * 0.42), // climb out into the ending
    ],
    async build(g) {
      const terr = makeTerrain({ cz: cz(9), seed: 90, amplitude: 4, lowColor: 0xd9c9a0, highColor: 0xc9b890 });
      const h = terr.userData.heightAt;
      g.add(terr);
      g.add(makeWater({ cx: 300, cz: cz(9), size: 800, y: 1, color: 0x4a6a8a }));
      // Wright Flyer: two thin wings, struts, skids
      const flyer = new THREE.Group();
      const wingMat = new THREE.MeshStandardMaterial({ color: 0xe8e0cc, side: THREE.DoubleSide });
      for (const y of [0, 2.4]) {
        const w = new THREE.Mesh(new THREE.BoxGeometry(12, 0.15, 2), wingMat);
        w.position.y = y;
        flyer.add(w);
      }
      for (const x of [-5, -2.5, 0, 2.5, 5]) {
        const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.4),
          new THREE.MeshStandardMaterial({ color: 0x6a5a4a }));
        strut.position.set(x, 1.2, 0);
        flyer.add(strut);
      }
      const pilot = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 1.2, 3, 6),
        new THREE.MeshStandardMaterial({ color: 0x3a3a3a }));
      pilot.rotation.x = Math.PI / 2;
      pilot.position.set(0, 0.5, 0);
      flyer.add(pilot);
      this.flyer = flyer;
      g.add(flyer);
      // small watching crowd
      g.add(makeCrowd({ positions: scatter(6, -60, cz(9) + 30, 10, h) }));
      this.h = h;
    },
    update(dt, t) {
      // the flyer travels its famous 37 metres... then a bit more, for the camera
      const k = (t * 2.2) % 1;
      this.flyer.position.set(-45 + k * 110, this.h(-45, cz(9)) + 3.5 + Math.sin(k * Math.PI) * 4, cz(9) + 5);
      this.flyer.rotation.z = Math.sin(k * 7) * 0.06;
    },
  },
];
