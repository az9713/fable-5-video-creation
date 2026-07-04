import * as THREE from 'three';

// One global curve through all scenes, 3 control points per scene.
// Sampled in KNOT space so scene i's flight stays inside scene i's points,
// keeping the camera in sync with the timeline regardless of segment lengths.
export class FlightPath {
  constructor(points, pointsPerScene = 3) {
    this.curve = new THREE.CatmullRomCurve3(points, false, 'centripetal', 0.5);
    this.pps = pointsPerScene;
    this.segments = points.length - 1;
  }
  // t is global progress; sceneIndex/localT come from the Timeline.
  atScene(sceneIndex, localT) {
    const knot = Math.min(sceneIndex * this.pps + localT * this.pps, this.segments);
    const u = knot / this.segments;
    return {
      position: this.curve.getPoint(u),
      tangent: this.curve.getTangent(u).normalize(),
    };
  }
  at(t) { // kept for tests / simple sampling
    const tt = Math.min(1, Math.max(0, t));
    return {
      position: this.curve.getPointAt(tt),
      tangent: this.curve.getTangentAt(tt).normalize(),
    };
  }
}

// Maps global progress [0,1] -> { index, localT } weighted by scene durations.
export class Timeline {
  constructor(scenes) {
    this.durations = scenes.map((s) => s.duration);
    this.total = this.durations.reduce((a, b) => a + b, 0);
  }
  at(t) {
    let acc = 0;
    const target = Math.min(1, Math.max(0, t)) * this.total;
    for (let i = 0; i < this.durations.length; i++) {
      if (target <= acc + this.durations[i] || i === this.durations.length - 1) {
        return { index: i, localT: Math.min(1, (target - acc) / this.durations[i]) };
      }
      acc += this.durations[i];
    }
  }
}

export function formatYear(y) {
  if (y <= -1e9) return `${(-y / 1e9).toLocaleString()} billion years ago`;
  if (y <= -1e6) return `${(-y / 1e6).toLocaleString()} million years ago`;
  if (y <= -10000) return `${(-y).toLocaleString()} years ago`;
  if (y < 0) return `${-y} BCE`;
  return `${y} CE`;
}
