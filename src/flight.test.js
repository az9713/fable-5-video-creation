import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { FlightPath, Timeline, formatYear } from './flight.js';

describe('FlightPath', () => {
  it('samples normalized tangents along the curve', () => {
    const fp = new FlightPath([
      new THREE.Vector3(0, 100, 0), new THREE.Vector3(100, 120, -200),
      new THREE.Vector3(-50, 90, -500), new THREE.Vector3(0, 110, -900),
    ]);
    expect(fp.at(0).position.distanceTo(fp.at(1).position)).toBeGreaterThan(500);
    expect(fp.at(0.5).tangent.length()).toBeCloseTo(1, 5);
    expect(fp.at(-1).position.y).toBeCloseTo(100, 3); // clamps
  });
});

describe('Timeline', () => {
  const tl = new Timeline([{ duration: 1 }, { duration: 3 }]);
  it('maps global progress by duration weights', () => {
    expect(tl.at(0)).toEqual({ index: 0, localT: 0 });
    expect(tl.at(0.625)).toEqual({ index: 1, localT: expect.closeTo(0.5, 3) });
    expect(tl.at(1).index).toBe(1);
    expect(tl.at(1).localT).toBe(1);
  });
});

describe('formatYear', () => {
  it('formats eras', () => {
    expect(formatYear(-3.8e9)).toBe('3.8 billion years ago');
    expect(formatYear(-66e6)).toBe('66 million years ago');
    expect(formatYear(-40000)).toBe('40,000 years ago');
    expect(formatYear(-2500)).toBe('2500 BCE');
    expect(formatYear(80)).toBe('80 CE');
  });
});
