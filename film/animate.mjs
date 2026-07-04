// Animate all approved stills via Kling 2.5 Turbo Pro i2v ($0.35/5s each).
// Run: node film/animate.mjs submit|poll
import fs from 'fs';

const KEY = fs.readFileSync('.env', 'utf8').match(/FAL_KEY=(.+)/)[1].trim();
const H = { 'Authorization': `Key ${KEY}`, 'Content-Type': 'application/json' };
const MODEL = 'https://queue.fal.run/fal-ai/kling-video/v2.5-turbo/pro/image-to-video';
const STATE = 'film/anim.json';

const CAM = 'Smooth steady first-person hang glider flight gliding gently forward, soft floating motion, the pilot\'s gloved hands steady on the control bar with tiny corrections, wing fabric rippling lightly in the wind. Cinematic, realistic natural motion, consistent speed, no camera shake, no morphing, no new objects appearing.';

const batch1 = JSON.parse(fs.readFileSync('film/batch1.json', 'utf8'));
const urlOf = (f) => JSON.parse(fs.readFileSync(f, 'utf8')).images[0].url;

const CLIPS = [
  { id: '01-primordial', image: batch1['01-primordial'].url,
    motion: 'Forked lightning strikes the dark ocean repeatedly with bright flashes, volcanoes erupt slowly on the horizon with billowing ash columns, glowing lava rivers flow into the steaming sea, steam plumes and bubbles rise from the glowing vents, water churns.' },
  { id: '03-asteroid', image: batch1['03-asteroid'].url,
    motion: 'The blazing asteroid streaks slowly across the sky trailing fire and thick smoke, the massed dinosaur herds stampede away below in chaotic waves kicking up dust clouds, pterosaurs flap past the glider urgently, trees bend in the rising wind.' },
  { id: '04-first-humans', image: batch1['04-first-humans'].url,
    motion: 'Campfires flicker and crackle sending sparks upward, fur-clad people walk between the tents and children run playing, the woolly mammoths wade slowly across the river, smoke columns drift into the starry sky, reindeer trot at the camp edge.' },
  { id: '05-giza', image: urlOf('film/res_req5c.json'),
    motion: 'The long columns of workers haul the stone sledges forward in slow rhythmic unison, ropes straining, overseers gesture, sailing boats glide along the Nile, ox carts roll along the causeway, farmers work in the green fields, gentle heat shimmer.' },
  { id: '06-rome', image: batch1['06-rome'].url,
    motion: 'The packed stadium crowd roars waving colored cloth and arms, the gladiators circle each other on the sand below, dense streams of people flow through the arches and along the streets, awnings ripple in the breeze, smoke drifts from distant rooftops.' },
  { id: '07-siege', image: batch1['07-siege'].url,
    motion: 'The trebuchets swing their arms and hurl flaming projectiles arcing across the sky with smoke trails, the massed army advances slowly in formation with banners waving, cavalry gallops along the flank, defenders on the battlements loose arrows, fires flicker in the camp.' },
  { id: '08-florence', image: batch1['08-florence'].url,
    motion: 'The bearded man in the purple robe waves enthusiastically up at the glider with a joyful expression, his papers fluttering, the festival crowd moves and mingles in the piazza with banners swaying, boats drift along the river, doves flit between rooftops.' },
  { id: '09-industrial', image: batch1['09-industrial'].url,
    motion: 'The steam locomotive chugs across the viaduct trailing white steam, the coal barge glides along the canal leaving a wake, dense crowds bustle along the streets and bridge, thick smoke pours and drifts from the forest of chimneys, gaslights glow warmly.' },
  { id: '10-kittyhawk', image: urlOf('film/res_req10c.json'),
    motion: 'The Wright Flyer skims forward just above the sand flying steadily ahead, the men in suits chase after it cheering and waving their hats, seagulls wheel and glide past, long waves roll in and break with foam, beach grass ripples in wind streaks.' },
];

if (process.argv[2] === 'submit') {
  const state = fs.existsSync(STATE) ? JSON.parse(fs.readFileSync(STATE, 'utf8')) : {};
  for (const c of CLIPS) {
    if (state[c.id]?.status_url) { console.log(c.id, 'already submitted'); continue; }
    const r = await fetch(MODEL, { method: 'POST', headers: H, body: JSON.stringify({
      prompt: `${CAM} ${c.motion}`,
      image_url: c.image,
      duration: '5',
    }) }).then((x) => x.json());
    state[c.id] = { status_url: r.status_url, response_url: r.response_url };
    console.log(c.id, r.request_id ? 'submitted' : JSON.stringify(r).slice(0, 200));
    fs.writeFileSync(STATE, JSON.stringify(state, null, 2));
  }
}

if (process.argv[2] === 'poll') {
  const state = JSON.parse(fs.readFileSync(STATE, 'utf8'));
  let pending = Object.entries(state).filter(([, v]) => !v.file);
  while (pending.length) {
    await new Promise((r) => setTimeout(r, 20000));
    for (const [id, v] of pending) {
      try {
        const st = await fetch(v.status_url, { headers: H }).then((x) => x.json());
        if (st.status === 'COMPLETED') {
          const res = await fetch(v.response_url, { headers: H }).then((x) => x.json());
          const url = res.video?.url;
          if (!url) { console.log(id, 'ERROR', JSON.stringify(res).slice(0, 150)); v.file = 'ERROR'; continue; }
          const buf = Buffer.from(await fetch(url).then((x) => x.arrayBuffer()));
          fs.writeFileSync(`film/clips/${id}.mp4`, buf);
          v.file = `film/clips/${id}.mp4`; v.url = url;
          console.log(id, 'saved', (buf.length / 1e6).toFixed(1) + 'MB');
        }
      } catch (e) { console.log(id, 'poll error', e.message); }
    }
    fs.writeFileSync(STATE, JSON.stringify(state, null, 2));
    pending = Object.entries(state).filter(([, v]) => !v.file);
    console.log(new Date().toISOString().slice(11, 19), 'pending:', pending.map(([id]) => id).join(',') || 'none');
  }
}
