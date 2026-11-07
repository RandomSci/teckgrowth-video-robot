// Renders the Promo composition from public/shots/scenes.json to out/<id>.mp4 (H.264, 1080 by 1920).
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import { readFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const props = JSON.parse(readFileSync('public/shots/scenes.json', 'utf8'));
const serveUrl = await bundle({ entryPoint: path.resolve('src/index.ts'), publicDir: path.resolve('public') });
const composition = await selectComposition({ serveUrl, id: 'Promo', inputProps: props });
mkdirSync('out', { recursive: true });
const out = `out/${String(props.id).replace(/[^a-z0-9-]/gi, '-')}.mp4`;
await renderMedia({ composition, serveUrl, codec: 'h264', outputLocation: out, inputProps: props, crf: 20, x264Preset: 'veryfast' });
console.log('rendered', out);
