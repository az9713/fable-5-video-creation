// Storyboard: 10 eras, shared cockpit framing, density-engineered populations.
// Run: node film/storyboard.mjs submit|poll
import fs from 'fs';

const COCKPIT = 'First-person POV from a hang glider in flight: gloved hands gripping the dark control bar at the bottom of the frame, red delta wing edge visible overhead at the top of the frame, no creatures or objects touching the glider.';
const STYLE = 'Ultra-detailed, photorealistic, cinematic aerial photography, epic scale, volumetric light.';

export const SHOTS = [
  {
    id: '01-primordial',
    title: 'The Primordial Soup',
    prompt: `${COCKPIT} Below, a young violent Earth seen from 100 meters: a vast steaming primordial ocean under a bruised purple-orange sky, dozens of erupting volcanoes lining the horizon spewing glowing lava and ash columns, multiple forks of lightning striking the water at once, fields of bubbling hydrothermal vents venting steam, glowing green-teal stromatolite reefs beneath the shallow water surface, rivers of orange lava meeting the sea in explosions of steam. Everything churning, erupting, flashing — a planet being born. Dramatic storm light. ${STYLE}`,
  },
  { id: '02-dinosaurs', title: 'The Age of Dinosaurs', done: 'film/stills/02-dinosaurs-v2.png' },
  {
    id: '03-asteroid',
    title: 'The Sky Falls',
    prompt: `${COCKPIT} Below, a Cretaceous plain in panic seen from 120 meters: a colossal blazing asteroid streaks across half the sky trailing fire and smoke, the horizon glowing orange under an apocalyptic sky. Massive mixed herds of hundreds of dinosaurs stampede away across the plain in chaotic waves kicking up dust, sauropods rearing, flocks of pterosaurs streaming past the glider in terrified flight, trees bending in the shockwave wind. Doom, scale, motion everywhere. ${STYLE}`,
  },
  {
    id: '04-first-humans',
    title: 'The First Fires',
    prompt: `${COCKPIT} Below, an Ice Age valley at deep blue dusk seen from 80 meters: dozens of glowing campfires scattered across the valley floor, each surrounded by clusters of fur-clad humans, hundreds of people total — hunting parties returning with game, children running between hide tents, elders around the flames. A herd of woolly mammoths crossing a river in the middle distance, torchlight visible at the mouth of a painted cave in the cliffside. Smoke columns rising into a star-scattered sky, warm firelight against cold blue snow patches. ${STYLE}`,
  },
  {
    id: '05-giza',
    title: 'The Pyramids Rise',
    prompt: `${COCKPIT} Below, ancient Giza at golden hour seen from 150 meters: a half-built pyramid wrapped in mud-brick ramps swarming with thousands of workers hauling stone blocks in long teeming columns like rivers of people, two completed pyramids gleaming beyond, a sprawling workers' city of hundreds of huts with smoke from countless cooking fires, the Nile crowded with hundreds of cargo boats and barges under sail, ox carts and overseers on causeways, green floodplain fields full of farmers. Human industry at overwhelming scale. ${STYLE}`,
  },
  {
    id: '06-rome',
    title: 'Games Day in Rome',
    prompt: `${COCKPIT} Below, imperial Rome on games day seen from 120 meters: the Colosseum directly below PACKED with fifty thousand spectators — every tier a dense sea of colored togas, arms waving, awnings rippling; gladiators tiny on the sand arena floor; dense crowds streaming through every arch and along every street toward the stadium; the Forum teeming with thousands; endless terracotta rooftops, temples, aqueducts and smoking chimneys stretching to the horizon. A city of a million people, alive everywhere. ${STYLE}`,
  },
  {
    id: '07-siege',
    title: 'The Siege',
    prompt: `${COCKPIT} Below, a medieval siege at amber late afternoon seen from 120 meters: a great stone castle on a crag, and filling the entire valley below it a besieging army — hundreds of tents in sprawling camps, thousands of soldiers in massed formations with banners, a dozen trebuchets mid-launch hurling flaming projectiles trailing smoke arcs, siege towers rolling forward, archers exchanging volleys with defenders crowding the battlements, campfires and cook smoke everywhere, cavalry columns on the move. War at full scale. ${STYLE}`,
  },
  {
    id: '08-florence',
    title: 'Florence, and a Man Looking Up',
    prompt: `${COCKPIT} Below, Renaissance Florence at golden hour seen from 100 meters: the great red Duomo dome rising from a dense sea of terracotta rooftops, the piazza below packed with a festival crowd of thousands — merchants' stalls, banners, processions; every street teeming with people, carts and horses; the Arno river busy with boats; on a rooftop terrace a bearded man in a purple robe looks up from his sketches and waves at the glider, a wooden flying machine prototype beside him. A city bursting with life and invention. ${STYLE}`,
  },
  {
    id: '09-industrial',
    title: 'The Machine Age',
    prompt: `${COCKPIT} Below, an industrial city at smoky sunset seen from 120 meters: a forest of hundreds of brick smokestacks pouring smoke, vast mill buildings with thousands of glowing windows, streets swarming with crowds of workers in caps and long coats, several steam trains crossing iron viaducts trailing white plumes, canals jammed with coal barges, horse omnibuses and carts crowding cobbled bridges, gaslights beginning to glow. The whole world hurrying at once, amber light through coal haze. ${STYLE}`,
  },
  {
    id: '10-kittyhawk',
    title: 'Twelve Seconds That Changed Everything',
    prompt: `${COCKPIT} Below, Kitty Hawk beach on a bright windy morning seen from 60 meters: the Wright Flyer biplane skimming low over the sand directly below the glider, its pilot prone on the lower wing, a small group of witnesses running alongside cheering and holding their hats, long ocean waves rolling in with white foam, seagull flocks wheeling, beach grass rippling in streaks of wind, wooden launch rail and camp shed behind. Bright hopeful morning light, the birth of flight. ${STYLE}`,
  },
];

const KEY = fs.readFileSync('.env', 'utf8').match(/FAL_KEY=(.+)/)[1].trim();
const H = { 'Authorization': `Key ${KEY}`, 'Content-Type': 'application/json' };
const MODEL = 'https://queue.fal.run/fal-ai/bytedance/seedream/v4/text-to-image';
const STATE = 'film/batch1.json';

if (process.argv[2] === 'submit') {
  const state = {};
  for (const s of SHOTS) {
    if (s.done) { state[s.id] = { done: s.done }; continue; }
    const r = await fetch(MODEL, { method: 'POST', headers: H, body: JSON.stringify({ prompt: s.prompt, image_size: 'landscape_16_9' }) }).then((x) => x.json());
    state[s.id] = { status_url: r.status_url, response_url: r.response_url };
    console.log(s.id, r.request_id ? 'submitted' : JSON.stringify(r).slice(0, 200));
  }
  fs.writeFileSync(STATE, JSON.stringify(state, null, 2));
}

if (process.argv[2] === 'poll') {
  const state = JSON.parse(fs.readFileSync(STATE, 'utf8'));
  let pending = Object.entries(state).filter(([, v]) => !v.done && !v.file);
  while (pending.length) {
    await new Promise((r) => setTimeout(r, 5000));
    for (const [id, v] of pending) {
      const st = await fetch(v.status_url, { headers: H }).then((x) => x.json());
      if (st.status === 'COMPLETED') {
        const res = await fetch(v.response_url, { headers: H }).then((x) => x.json());
        const url = res.images?.[0]?.url;
        const file = `film/stills/${id}.png`;
        const buf = Buffer.from(await fetch(url).then((x) => x.arrayBuffer()));
        fs.writeFileSync(file, buf);
        v.file = file; v.url = url;
        console.log(id, 'saved', (buf.length / 1e6).toFixed(1) + 'MB');
      }
    }
    fs.writeFileSync(STATE, JSON.stringify(state, null, 2));
    pending = Object.entries(state).filter(([, v]) => !v.done && !v.file);
    console.log('pending:', pending.map(([id]) => id).join(',') || 'none');
  }
}
