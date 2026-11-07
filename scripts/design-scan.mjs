// Per idea design scan (Selwyn, Nov 8). The builder's research finds the best real websites for ONE idea (a yacht
// broker, a dentist, anything) and sends their addresses here. For each site, REA (morluto/rea, MIT) inspects the live
// page over the Chrome DevTools Protocol for its structure (landmarks, headings, nav, sections), and our measurement
// reads the design (colors and where they sit, fonts and sizes, sections, menu, photos, effects, motion). Only a short
// design summary and a screenshot per site leave the runner, never the site's text or code, so PLAN gets a few
// thousand input tokens, not millions.
// node scripts/design-scan.mjs "url1,url2,url3" outdir
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { MEASURE } from './measure.mjs';

const urls = (process.argv[2] || '').split(',').map((s) => s.trim()).filter((u) => /^https?:\/\//.test(u)).slice(0, 5);
const out = process.argv[3] || 'scan';
mkdirSync(out, { recursive: true });
const PORT = 9222;
const b = await chromium.launch({ args: ['--remote-debugging-port=' + PORT, '--use-gl=angle', '--use-angle=swiftshader'] });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36' });

// REA's passive page capture, reduced to what says something about the design
function rea(url) {
  try {
    const list = JSON.parse(execFileSync('curl', ['-s', `http://127.0.0.1:${PORT}/json/list`], { encoding: 'utf8' }));
    const t = list.find((x) => x.type === 'page' && x.url.startsWith(new URL(url).origin));
    if (!t) return { error: 'no target' };
    const raw = execFileSync('npx', ['-y', 'rea-agents@6.8.0', 'inspect-web-page', `http://127.0.0.1:${PORT}`, t.id, '--observation-ms', '1500', '--json'], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, timeout: 120000 });
    const j = JSON.parse(raw);
    const text = JSON.stringify(j);
    const count = (re) => (text.match(re) || []).length;
    // roles REA saw in the accessibility tree, the page's real structure
    const roles = {};
    for (const m of text.matchAll(/"role"\s*:\s*\{?[^}]*?"value"\s*:\s*"([a-zA-Z]+)"/g)) roles[m[1]] = (roles[m[1]] || 0) + 1;
    for (const m of text.matchAll(/"role"\s*:\s*"([a-zA-Z]+)"/g)) roles[m[1]] = (roles[m[1]] || 0) + 1;
    const keep = ['banner', 'navigation', 'main', 'region', 'contentinfo', 'heading', 'link', 'button', 'img', 'list', 'listitem', 'form', 'textbox', 'combobox', 'search', 'dialog', 'menu', 'menuitem', 'tab', 'figure', 'article'];
    return {
      roles: Object.fromEntries(keep.filter((k) => roles[k]).map((k) => [k, roles[k]])),
      scripts: count(/"script_id"|"scriptId"/g),
      resources: count(/"resource_type"|"resourceType"/g),
      raw_kb: Math.round(raw.length / 1024),
    };
  } catch (e) { return { error: String(e.message).slice(0, 200) }; }
}

const sites = [];
for (const [i, url] of urls.entries()) {
  const p = await ctx.newPage();
  const site = { url };
  try {
    await p.goto(url, { waitUntil: 'load', timeout: 45000 });
    await p.waitForTimeout(3500);
    await p.screenshot({ path: `${out}/site-${i + 1}.jpg`, type: 'jpeg', quality: 60 });
    site.shot = `site-${i + 1}.jpg`;
    site.rea = rea(url);
    for (let y = 0; y < 12; y++) { await p.mouse.wheel(0, 800); await p.waitForTimeout(250); }
    await p.screenshot({ path: `${out}/site-${i + 1}-mid.jpg`, type: 'jpeg', quality: 55 });
    await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(800);
    Object.assign(site, await p.evaluate(MEASURE));
  } catch (e) { site.error = String(e.message).slice(0, 200); }
  await p.close();
  sites.push(site);
  console.log(url, site.error || `${site.sections} sections ${site.screens} screens rea ${JSON.stringify(site.rea).slice(0, 160)}`);
}
writeFileSync(`${out}/scan.json`, JSON.stringify({ at: new Date().toISOString(), sites }, null, 1));
await b.close();
