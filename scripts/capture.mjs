// Uses teckgrowth.com like a real person on this runner, never on anyone's computer, and keeps what it saw.
// JOB (env, JSON) or job.json, see README. Every scene opens a page at a desktop size by default (1440 by 900, sharp at
// 1920 wide) or a phone size, then either takes a still or records the steps it is told to do (click, type, scroll,
// wait) as a video clip, the way a reviewer would use the site.
// A teckgrowth.com url gets ?robot=<ROBOT_TOKEN> when that secret is set, the site signs the robot account in (its own
// account with its own projects, never Selwyn's login).
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, readFileSync, existsSync, renameSync, readdirSync } from 'node:fs';

const job = JSON.parse(process.env.JOB || (existsSync('job.json') ? readFileSync('job.json', 'utf8') : '{}'));
if (!job.scenes?.length) { console.error('job has no scenes'); process.exit(1); }
mkdirSync('public/shots', { recursive: true });
mkdirSync('/tmp/rec', { recursive: true });

const SIZES = { desktop: { width: 1440, height: 900, scale: 1.3334 }, phone: { width: 390, height: 844, scale: 3 }, tablet: { width: 1024, height: 768, scale: 1.875 } };
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const out = [];

async function act(page, step) {
  if (step.wait) return page.waitForTimeout(step.wait);
  if (step.scroll) { await page.mouse.wheel(0, step.scroll); return page.waitForTimeout(step.pause ?? 900); }
  const target = step.text ? page.getByText(step.text, { exact: !!step.exact }).first() : step.role ? page.getByRole(step.role, { name: step.name }).first() : page.locator(step.selector).first();
  await target.scrollIntoViewIfNeeded({ timeout: 15_000 });
  if (step.type !== undefined) { await target.click(); await target.pressSequentially(String(step.type), { delay: step.delay ?? 45 }); }
  else await target.click({ timeout: 15_000 });
  await page.waitForTimeout(step.pause ?? 1200);
}

for (const [i, s] of job.scenes.entries()) {
  const size = SIZES[s.device || (job.format === 'vertical' ? 'phone' : 'desktop')] || SIZES.desktop;
  const vp = { width: s.width || size.width, height: s.height || size.height };
  const record = Array.isArray(s.steps) && s.steps.length > 0;
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: s.scale || size.scale, colorScheme: s.dark === false ? 'light' : 'dark',
    ...(record ? { recordVideo: { dir: '/tmp/rec', size: { width: vp.width, height: vp.height } } } : {}) });
  const page = await ctx.newPage();
  const url = new URL(s.url);
  if (process.env.ROBOT_TOKEN && url.hostname.endsWith('teckgrowth.com')) url.searchParams.set('robot', process.env.ROBOT_TOKEN);
  try {
    await page.goto(url.toString(), { waitUntil: 'load', timeout: 60_000 });
    await page.waitForTimeout(s.wait_ms ?? 3000);
    if (record) for (const st of s.steps) await act(page, st);
    else if (s.scroll) { await page.mouse.wheel(0, s.scroll); await page.waitForTimeout(1500); }
    const still = `shots/scene-${i}.png`;
    await page.screenshot({ path: `public/${still}` });
    const v = record ? page.video() : null;
    await ctx.close();
    let clip = null;
    if (v) { const p = await v.path(); clip = `shots/scene-${i}.webm`; renameSync(p, `public/${clip}`); }
    out.push({ file: still, clip, caption: s.caption || '', device: s.device || (job.format === 'vertical' ? 'phone' : 'desktop'), seconds: s.seconds || null });
    console.log('scene', i, record ? 'recorded' : 'captured', s.url.replace(/[?#].*$/, ''));
  } catch (e) {
    console.error('scene failed', i, s.url.replace(/[?#].*$/, ''), String(e.message).slice(0, 160));
    await ctx.close().catch(() => {});
  }
}
await browser.close();
if (!out.length) { console.error('no scene captured'); process.exit(1); }
writeFileSync('public/shots/scenes.json', JSON.stringify({ id: job.id || 'job', format: job.format || 'landscape', title: job.title || '', subtitle: job.subtitle || '', cta: job.cta || 'teckgrowth.com', scenes: out }, null, 1));
