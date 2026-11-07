// Design references for TeckGrowth's builder (Selwyn, Nov 8). For each kind of site, find award winning sites on
// Awwwards, open each live site in a real Chrome and measure its design: where each color is used, fonts and sizes,
// how many sections and screens, the nav, photos and video, glass, shadows, rounding and motion, plus a screenshot.
// Output refs/<kind>.json and refs/shots/<kind>-<n>.jpg. Only measurements and our own notes are kept, never copy.
// node scripts/design-refs.mjs [kinds comma list] [per kind]
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { MEASURE } from './measure.mjs';

const KINDS = {
  restaurant: ['websites/sites_of_the_day/', ['food & drink', 'restaurant', 'food', 'coffee']],
  'local-service': ['websites/winner_category_business-services/', ['business', 'health', 'beauty', 'services']],
  store: ['websites/winner_category_ecommerce/', ['e-commerce', 'fashion', 'shop', 'food']],
  company: ['websites/winner_category_product/', ['business', 'technology', 'saas', 'web & interactive']],
  studio: ['websites/winner_category_portfolio/', ['architecture', 'interior', 'design agencies', 'portfolio', 'photography']],
  education: ['websites/sites_of_the_day/', ['culture & education', 'education']],
  listings: ['websites/winner_category_business-services/', ['real estate', 'architecture', 'hotel', 'travel']],
  editorial: ['websites/sites_of_the_day/', ['magazine', 'news', 'storytelling', 'blog']],
  event: ['websites/sites_of_the_day/', ['events', 'music', 'festival']],
  community: ['websites/sites_of_the_day/', ['social', 'culture & education', 'non-profit']],
  app: ['websites/winner_category_product/', ['technology', 'mobile & apps', 'app']],
  experience: ['websites/sites_of_the_day/', ['games & entertainment', '3d', 'webgl', 'web & interactive']],
};
const want = (process.argv[2] || '').split(',').filter(Boolean);
const PER = Number(process.argv[3]) || 6;
const kinds = want.length ? want : Object.keys(KINDS);
mkdirSync('refs/shots', { recursive: true });

const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader'] });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36 TeckGrowthDesignRefs' });

async function cards(path, words) {
  const p = await ctx.newPage();
  const out = [];
  for (const pg of [1, 2]) {
    await p.goto('https://www.awwwards.com/' + path + (pg > 1 ? '?page=' + pg : ''), { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
    let list = [];
    for (let t = 0; t < 4; t++) {
      await p.waitForTimeout(3000);
      try { await p.waitForLoadState('networkidle', { timeout: 15000 }); } catch {}
      try { list = await p.evaluate(() => [...document.querySelectorAll('[data-collectable-model-value]')].map((el) => {
      let m = {}; try { m = JSON.parse(el.getAttribute('data-collectable-model-value')); } catch {}
      const a = el.querySelector('a[href^="/sites/"]') || el.parentElement?.querySelector('a[href^="/sites/"]') || el.closest('li,article,div')?.querySelector('a[href^="/sites/"]');
      return { title: m.title, tags: m.tags || [], detail: a ? a.getAttribute('href') : null };
    }).filter((x) => x.title && x.detail)); } catch (e) { console.log('  retry', t, e.message.slice(0, 80)); continue; }
      if (list.length) break;
      console.log('  no cards yet, title', await p.title().catch(() => '?'));
    }
    if (!list.length) await p.screenshot({ path: 'refs/shots/listing-' + path.replace(/\W+/g, '-') + '.jpg', type: 'jpeg', quality: 50 }).catch(() => {});
    out.push(...list);
  }
  await p.close();
  const seen = new Set();
  return out.filter((c) => !seen.has(c.detail) && seen.add(c.detail))
    .map((c, i) => ({ c, s: c.tags.reduce((n, t) => n + (words.some((w) => String(t).toLowerCase().includes(w)) ? 1 : 0), 0) - i * 0.01 }))
    .sort((a, z) => z.s - a.s).map((x) => x.c);
}

async function liveUrl(detail) {
  const p = await ctx.newPage();
  try {
    await p.goto('https://www.awwwards.com' + detail, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await p.waitForTimeout(1500);
    return await p.evaluate(() => {
      const a = [...document.querySelectorAll('a[href^="http"]')].find((x) => /visit/i.test(x.textContent) && !/awwwards\.com/.test(x.href));
      const hex = [...new Set([...document.body.innerHTML.matchAll(/#([0-9A-Fa-f]{6})\b/g)].map((m) => '#' + m[1].toUpperCase()))].slice(0, 8);
      return { url: a ? a.href : null, awwwards_palette: hex };
    });
  } catch { return { url: null }; } finally { await p.close(); }
}

async function measure(url, kind, n) {
  const p = await ctx.newPage();
  try {
    await p.goto(url, { waitUntil: 'load', timeout: 45000 });
    await p.waitForTimeout(3500);
    await p.screenshot({ path: `refs/shots/${kind}-${n}.jpg`, type: 'jpeg', quality: 55 });
    for (let y = 0; y < 12; y++) { await p.mouse.wheel(0, 800); await p.waitForTimeout(250); }
    await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(800);
    return await p.evaluate(MEASURE);
  } catch (e) { return { error: String(e.message).slice(0, 160) }; } finally { await p.close(); }
}

for (const kind of kinds) {
  const [path, words] = KINDS[kind] || [];
  if (!path) continue;
  const list = await cards(path, words).catch((e) => { console.log(kind, 'listing failed', e.message); return []; });
  console.log(kind, list.length, 'cards');
  const refs = [];
  for (const c of list) {
    if (refs.length >= PER) break;
    const d = await liveUrl(c.detail);
    if (!d.url) continue;
    const m = await measure(d.url, kind, refs.length + 1);
    if (m.error || !m.sections) { console.log('  skip', d.url, m.error || 'no sections'); continue; }
    refs.push({ title: c.title, tags: c.tags, url: d.url, awwwards: 'https://www.awwwards.com' + c.detail, awwwards_palette: d.awwwards_palette, shot: `shots/${kind}-${refs.length + 1}.jpg`, ...m });
    console.log('  ok', d.url, m.sections, 'sections', m.screens, 'screens');
  }
  writeFileSync(`refs/${kind}.json`, JSON.stringify({ kind, at: new Date().toISOString(), refs }, null, 1));
}
await b.close();
