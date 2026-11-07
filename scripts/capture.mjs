// Takes the screenshots a job asks for, on this runner, never on anyone's computer.
// JOB (env, JSON) or job.json: { id, title, scenes: [{ url, caption, scroll, width, height, wait_ms, dark }] , cta }
// A scene url on teckgrowth.com can be opened as the recorder (read only) when RECORDER_TOKEN is set, the site turns
// it into a view only session cookie, it can never change anything.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';

const job = JSON.parse(process.env.JOB || (existsSync('job.json') ? readFileSync('job.json', 'utf8') : '{}'));
if (!job.scenes?.length) { console.error('job has no scenes'); process.exit(1); }
mkdirSync('public/shots', { recursive: true });

const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const out = [];
for (const [i, s] of job.scenes.entries()) {
  const page = await browser.newPage({ viewport: { width: s.width || 1080, height: s.height || 1920 }, deviceScaleFactor: 1, colorScheme: s.dark === false ? 'light' : 'dark' });
  const url = new URL(s.url);
  if (process.env.RECORDER_TOKEN && url.hostname.endsWith('teckgrowth.com')) url.searchParams.set('recorder', process.env.RECORDER_TOKEN);
  try {
    await page.goto(url.toString(), { waitUntil: 'load', timeout: 60_000 });
    await page.waitForTimeout(s.wait_ms ?? 3500);
    if (s.scroll) { await page.mouse.wheel(0, s.scroll); await page.waitForTimeout(1500); }
    const file = `shots/scene-${i}.png`;
    await page.screenshot({ path: `public/${file}` });
    out.push({ file, caption: s.caption || '' });
    console.log('captured', s.url.replace(/[?#].*$/, ''));
  } catch (e) {
    console.error('scene failed', s.url.replace(/[?#].*$/, ''), e.message.slice(0, 120));
  }
  await page.close();
}
await browser.close();
if (!out.length) { console.error('no scene captured'); process.exit(1); }
writeFileSync('public/shots/scenes.json', JSON.stringify({ id: job.id || 'job', title: job.title || '', cta: job.cta || 'teckgrowth.com', scenes: out }, null, 1));
