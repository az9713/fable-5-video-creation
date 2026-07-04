// Quick GLB inspector: prints node names + animation clips for each model.
// GLB layout: 12-byte header, then chunks of [length(u32), type(u32), data].
// First chunk is always the JSON scene description.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const dir = new URL('./public/models', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
for (const file of readdirSync(dir).filter((f) => f.endsWith('.glb'))) {
  const buf = readFileSync(join(dir, file));
  const jsonLen = buf.readUInt32LE(12);
  const json = JSON.parse(buf.subarray(20, 20 + jsonLen).toString('utf8'));
  const names = (json.nodes ?? []).map((n) => n.name).filter(Boolean);
  const anims = (json.animations ?? []).map((a) => a.name);
  console.log(`${file}`);
  console.log(`  top nodes: ${names.slice(0, 4).join(', ')}`);
  console.log(`  animations (${anims.length}): ${anims.join(', ')}`);
}
