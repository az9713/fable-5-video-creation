import { SCENES, L } from './scenes.js';
import { formatYear } from './flight.js';

// Game-style HUD: compass strip, speed/altitude dials, quest card, minimap.
// Pure DOM/canvas — crisp at any resolution, zero GPU cost.
export function initHUD(journey) {
  const $ = (id) => document.getElementById(id);
  const compass = $('compass').getContext('2d');
  const minimap = $('minimap').getContext('2d');
  const speedEl = $('speed-val'), altEl = $('alt-val');
  const questTitle = $('quest-title'), questYear = $('quest-year'), questBlurb = $('quest-blurb');

  // Pre-plot the flight path onto the minimap (x spans ~±120, z spans 0..-9*L)
  const mapPts = [];
  for (let i = 0; i <= 200; i++) {
    const p = journey.path.at(i / 200).position;
    mapPts.push([p.x, p.z]);
  }

  function drawCompass(headingRad) {
    const w = compass.canvas.width, h = compass.canvas.height;
    compass.clearRect(0, 0, w, h);
    compass.fillStyle = 'rgba(255,255,255,0.9)';
    compass.strokeStyle = 'rgba(255,255,255,0.55)';
    compass.font = '13px Georgia';
    compass.textAlign = 'center';
    const degPerPx = 0.35;
    const heading = ((headingRad * 180 / Math.PI) % 360 + 360) % 360;
    for (let d = -90; d <= 90; d += 5) {
      const deg = ((heading + d) % 360 + 360) % 360;
      const x = w / 2 + d / degPerPx * 0.35 * 3.5;
      if (x < 0 || x > w) continue;
      const major = deg % 45 === 0;
      compass.beginPath();
      compass.moveTo(x, 0);
      compass.lineTo(x, major ? 10 : 5);
      compass.stroke();
      if (major) {
        const names = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' };
        compass.fillText(names[deg] ?? '', x, 24);
      }
    }
    // center marker
    compass.fillStyle = '#ffd27a';
    compass.beginPath();
    compass.moveTo(w / 2 - 5, 0); compass.lineTo(w / 2 + 5, 0); compass.lineTo(w / 2, 7);
    compass.fill();
  }

  function drawMinimap(pos) {
    const w = minimap.canvas.width, h = minimap.canvas.height;
    minimap.clearRect(0, 0, w, h);
    minimap.save();
    minimap.beginPath();
    minimap.arc(w / 2, h / 2, w / 2 - 2, 0, Math.PI * 2);
    minimap.fillStyle = 'rgba(10,20,30,0.55)';
    minimap.fill();
    minimap.clip();
    // world→map: center on current position, north = up (-z)
    const scale = 0.14;
    const toMap = ([x, z]) => [w / 2 + (x - pos.x) * scale, h / 2 + (z - pos.z) * scale];
    minimap.strokeStyle = 'rgba(255,210,122,0.85)';
    minimap.lineWidth = 1.5;
    minimap.beginPath();
    mapPts.forEach((p, i) => {
      const [mx, my] = toMap(p);
      i ? minimap.lineTo(mx, my) : minimap.moveTo(mx, my);
    });
    minimap.stroke();
    // scene markers
    minimap.fillStyle = 'rgba(255,255,255,0.8)';
    for (let i = 0; i < SCENES.length; i++) {
      const [mx, my] = toMap([0, -i * L]);
      minimap.beginPath(); minimap.arc(mx, my, 2.2, 0, Math.PI * 2); minimap.fill();
    }
    // you
    minimap.fillStyle = '#ffd27a';
    minimap.beginPath(); minimap.arc(w / 2, h / 2, 3.5, 0, Math.PI * 2); minimap.fill();
    minimap.restore();
    minimap.strokeStyle = 'rgba(255,255,255,0.35)';
    minimap.beginPath();
    minimap.arc(w / 2, h / 2, w / 2 - 2, 0, Math.PI * 2);
    minimap.stroke();
  }

  let lastPos = null;
  return {
    setScene(index) {
      const s = SCENES[index];
      questYear.textContent = formatYear(s.year);
      questTitle.textContent = s.title;
      questBlurb.textContent = s.blurb;
      const card = $('quest');
      card.classList.remove('flash');
      void card.offsetWidth; // restart CSS animation
      card.classList.add('flash');
    },
    update(dt, position, tangent) {
      if (dt > 0 && lastPos) {
        const v = position.distanceTo(lastPos) / dt;
        speedEl.textContent = String(Math.round(v * 3.6)); // pretend units≈m → km/h
      }
      lastPos = position.clone();
      altEl.textContent = String(Math.round(position.y * 4)); // display metres
      drawCompass(Math.atan2(-tangent.x, -tangent.z));
      drawMinimap(position);
    },
  };
}
