// Assemble the film: caption + HUD each clip, intro/outro cards,
// fadewhite "time-warp" transitions, procedural wind audio.
// Run: node film/assemble.mjs
import { execFileSync } from 'child_process';
import fs from 'fs';

const FONT = 'C\\:/Windows/Fonts/georgia.ttf';
const FONTB = 'C\\:/Windows/Fonts/georgiab.ttf';

const SEGS = [
  { id: '01-primordial', year: '3.8 BILLION YEARS AGO', title: 'The Primordial Soup' },
  { id: '02-dinosaurs', year: '66 MILLION YEARS AGO', title: 'The Age of Dinosaurs' },
  { id: '03-asteroid', year: '66 MILLION YEARS AGO', title: 'The Sky Falls' },
  { id: '04-first-humans', year: '40,000 YEARS AGO', title: 'The First Fires' },
  { id: '05-giza', year: '2500 BCE', title: 'The Pyramids Rise' },
  { id: '06-rome', year: '80 CE', title: 'Games Day in Rome' },
  { id: '07-siege', year: '1200 CE', title: 'The Siege' },
  { id: '08-florence', year: '1502', title: 'Florence, and a Man Looking Up' },
  { id: '09-industrial', year: '1850', title: 'The Machine Age' },
  { id: '10-kittyhawk', year: '1903', title: 'Twelve Seconds That Changed Everything' },
];

const SEG_D = 5.0, XF = 1.2, INTRO_D = 3.5, OUTRO_D = 5.0;
fs.mkdirSync('film/tmp', { recursive: true });
const run = (args) => execFileSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', ...args], { stdio: 'inherit' });
const tf = (name, text) => { const p = `film/tmp/${name}.txt`; fs.writeFileSync(p, text); return p; };

// 1) Label each clip: era caption (fades in/out) + subtle HUD pills.
for (const s of SEGS) {
  const yearFile = tf(s.id + '-y', s.year);
  const titleFile = tf(s.id + '-t', s.title);
  const cap = `[0:v]scale=1920:1080,fps=30,setsar=1,trim=duration=${SEG_D},setpts=PTS-STARTPTS` +
    `,drawtext=fontfile='${FONT}':textfile='${yearFile}':fontsize=30:fontcolor=white:alpha='clip((t-0.7)/0.7,0,1)*clip((4.6-t)/0.7,0,1)*0.85':x=(w-text_w)/2:y=h-215:shadowcolor=black@0.7:shadowx=0:shadowy=2` +
    `,drawtext=fontfile='${FONTB}':textfile='${titleFile}':fontsize=58:fontcolor=white:alpha='clip((t-0.9)/0.7,0,1)*clip((4.6-t)/0.7,0,1)*0.95':x=(w-text_w)/2:y=h-172:shadowcolor=black@0.7:shadowx=0:shadowy=2` +
    `,drawtext=fontfile='${FONT}':text='ALT  118 M':fontsize=24:fontcolor=white@0.75:box=1:boxcolor=black@0.32:boxborderw=12:x=60:y=h-92` +
    `,drawtext=fontfile='${FONT}':text='SPD  42 KM/H':fontsize=24:fontcolor=white@0.75:box=1:boxcolor=black@0.32:boxborderw=12:x=w-text_w-60:y=h-92[v]`;
  run(['-i', `film/clips/${s.id}.mp4`, '-filter_complex', cap, '-map', '[v]', '-an', '-c:v', 'libx264', '-crf', '17', '-preset', 'medium', `film/tmp/${s.id}-labeled.mp4`]);
  console.log('labeled', s.id);
}

// 2) Intro and outro cards.
run(['-f', 'lavfi', '-i', `color=c=0x05070f:s=1920x1080:d=${INTRO_D},fps=30`, '-filter_complex',
  `[0:v]drawtext=fontfile='${FONTB}':text='GLIDER THROUGH TIME':fontsize=92:fontcolor=white:alpha='clip((t-0.4)/0.8,0,1)':x=(w-text_w)/2:y=(h-text_h)/2-40` +
  `,drawtext=fontfile='${FONT}':text='a flight across history':fontsize=34:fontcolor=white@0.7:alpha='clip((t-1.0)/0.8,0,1)':x=(w-text_w)/2:y=(h-text_h)/2+70[v]`,
  '-map', '[v]', '-c:v', 'libx264', '-crf', '17', 'film/tmp/intro.mp4']);
run(['-f', 'lavfi', '-i', `color=c=0x05070f:s=1920x1080:d=${OUTRO_D},fps=30`, '-filter_complex',
  `[0:v]drawtext=fontfile='${FONT}':text='The sky belongs to everyone.':fontsize=52:fontcolor=white:alpha='clip((t-0.4)/0.9,0,1)*clip((${OUTRO_D}-0.4-t)/0.9,0,1)':x=(w-text_w)/2:y=(h-text_h)/2-20` +
  `,drawtext=fontfile='${FONT}':text='made with fal.ai — Seedream V4 + Kling 2.5':fontsize=24:fontcolor=white@0.55:alpha='clip((t-1.2)/0.9,0,1)*clip((${OUTRO_D}-0.4-t)/0.9,0,1)':x=(w-text_w)/2:y=(h-text_h)/2+60[v]`,
  '-map', '[v]', '-c:v', 'libx264', '-crf', '17', 'film/tmp/outro.mp4']);
console.log('cards done');

// 3) Chain everything with xfade (fade for cards, fadewhite between eras).
const files = ['film/tmp/intro.mp4', ...SEGS.map((s) => `film/tmp/${s.id}-labeled.mp4`), 'film/tmp/outro.mp4'];
const durs = [INTRO_D, ...SEGS.map(() => SEG_D), OUTRO_D];
const inputs = files.flatMap((f) => ['-i', f]);
let fc = '', prev = '[0:v]', offset = 0;
for (let i = 1; i < files.length; i++) {
  offset += durs[i - 1] - XF;
  const trans = 'fade'; // moving dissolve: both worlds glide during the blend — reads as continuous flight
  const out = i === files.length - 1 ? '[vout]' : `[x${i}]`;
  fc += `${prev}[${i}:v]xfade=transition=${trans}:duration=${XF}:offset=${offset.toFixed(2)}${out};`;
  prev = `[x${i}]`;
}
const total = durs.reduce((a, b) => a + b, 0) - XF * (files.length - 1);
// wind: pink noise, lowpassed, slow gusts, gentle fades.
fc += `anoisesrc=color=pink:sample_rate=44100:duration=${total.toFixed(2)},lowpass=f=420,tremolo=f=0.13:d=0.6,volume=0.30,afade=t=in:d=2,afade=t=out:st=${(total - 3).toFixed(2)}:d=3[aout]`;
run([...inputs, '-filter_complex', fc, '-map', '[vout]', '-map', '[aout]', '-c:v', 'libx264', '-crf', '18', '-preset', 'medium', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', 'film/glider_through_time.mp4']);
console.log('FILM DONE:', total.toFixed(1) + 's');
