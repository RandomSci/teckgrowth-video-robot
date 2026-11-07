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

let urls = (process.argv[2] || '').split(',').map((s) => s.trim()).filter((u) => /^https?:\/\//.test(u)).slice(0, 5);
const out = process.argv[3] || 'scan';
const query = process.argv[4] || '';   // the idea in a few words, searched on Awwwards first
mkdirSync(out, { recursive: true });
const PORT = 9222;
const b = await chromium.launch({ args: ['--remote-debugging-port=' + PORT, '--use-gl=angle', '--use-angle=swiftshader'] });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36' });

// Awwwards search for the idea, the award winning sites closest to it, then their live addresses
async function awwwards(q, n = 3) {
  const p = await ctx.newPage(), found = [];
  try {
    let links = [];
    for (const u of ['https://www.awwwards.com/websites/?text=', 'https://www.awwwards.com/websites/search/?text=']) {
      if (links.length) break;
      await p.goto(u + encodeURIComponent(q), { waitUntil: 'commit', timeout: 60000 }).catch((e) => console.log('  goto', e.message.slice(0, 80)));
    for (let t = 0; t < 5 && !links.length; t++) {
      await p.waitForTimeout(3000);
      try { await p.waitForLoadState('networkidle', { timeout: 15000 }); } catch {}
      links = await p.evaluate(() => [...new Set([...document.querySelectorAll('a[href^="/sites/"]')].map((a) => a.getAttribute('href').split('#')[0]))]).catch(() => []);
    }
    }
    console.log('awwwards', q, links.length, 'results');
    for (const l of links.slice(0, 8)) {
      if (found.length >= n) break;
      await p.goto('https://www.awwwards.com' + l, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
      await p.waitForTimeout(1500);
      const u = await p.evaluate(() => { const a = [...document.querySelectorAll('a[href^="http"]')].find((x) => /visit/i.test(x.textContent) && !/awwwards\.com/.test(x.href)); return a ? a.href : null; }).catch(() => null);
      if (u) { found.push(u.replace(/[?#].*$/, '')); console.log('  award site', u); }
    }
  } catch (e) { console.log('awwwards failed', e.message); }
  await p.close();
  return found;
}
if (query) urls = [...new Set([...(await awwwards(query)), ...urls])].slice(0, 5);

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
    // close cookie and consent banners so the screenshot shows the design
    for (const re of [/^(accept|accept all|allow all|agree|i agree|got it|ok|okay|continue|accept cookies|accept all cookies)$/i]) {
      for (const el of await p.getByRole('button', { name: re }).all().catch(() => [])) await el.click({ timeout: 1500 }).catch(() => {});
    }
    await p.waitForTimeout(800);
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
