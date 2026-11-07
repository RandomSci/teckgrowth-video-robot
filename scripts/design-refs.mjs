// Design references for TeckGrowth's builder (Selwyn, Nov 8). For each kind of site, find award winning sites on
// Awwwards, open each live site in a real Chrome and measure its design: where each color is used, fonts and sizes,
// how many sections and screens, the nav, photos and video, glass, shadows, rounding and motion, plus a screenshot.
// Output refs/<kind>.json and refs/shots/<kind>-<n>.jpg. Only measurements and our own notes are kept, never copy.
// node scripts/design-refs.mjs [kinds comma list] [per kind]
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

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
    await p.waitForTimeout(2500);
    const list = await p.evaluate(() => [...document.querySelectorAll('[data-collectable-model-value]')].map((el) => {
      let m = {}; try { m = JSON.parse(el.getAttribute('data-collectable-model-value')); } catch {}
      const a = el.querySelector('a[href^="/sites/"]') || el.parentElement?.querySelector('a[href^="/sites/"]') || el.closest('li,article,div')?.querySelector('a[href^="/sites/"]');
      return { title: m.title, tags: m.tags || [], detail: a ? a.getAttribute('href') : null };
    }).filter((x) => x.title && x.detail));
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

// runs in the site
const MEASURE = () => {
  const vis = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 2 && r.height > 2 && cs.visibility !== 'hidden' && cs.display !== 'none' && +cs.opacity > 0.05; };
  const hex = (c) => { const m = String(c).match(/rgba?\(([^)]+)\)/); if (!m) return null; const [r, g, b, a = 1] = m[1].split(',').map((x) => parseFloat(x)); if (a < 0.5) return null; return '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join(''); };
  const sat = (h) => { const n = parseInt(h.slice(1), 16), r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b); return mx === 0 ? 0 : (mx - mn) / mx; };
  const bg = new Map(), fg = new Map(), act = new Map();
  const all = [...document.querySelectorAll('body *')].slice(0, 6000);
  let glass = 0, shadow = 0, round = new Map(), imgs = 0, videos = 0, canvases = 0;
  for (const el of all) {
    if (!vis(el)) continue;
    const cs = getComputedStyle(el), r = el.getBoundingClientRect(), area = r.width * r.height;
    const b = hex(cs.backgroundColor); if (b) bg.set(b, (bg.get(b) || 0) + area);
    const own = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join('').length;
    if (own) { const f = hex(cs.color); if (f) fg.set(f, (fg.get(f) || 0) + own); }
    if (el.matches('a.button,button,[class*="btn"],[class*="button"],[role="button"]')) { const c = hex(cs.backgroundColor) || hex(cs.color); if (c) act.set(c, (act.get(c) || 0) + 1); }
    if (cs.backdropFilter && cs.backdropFilter !== 'none') glass++;
    if (cs.boxShadow && cs.boxShadow !== 'none') shadow++;
    const rad = parseFloat(cs.borderTopLeftRadius); if (rad >= 4 && area > 4000) round.set(Math.round(rad), (round.get(Math.round(rad)) || 0) + 1);
    if (el.tagName === 'IMG' && r.width > 160) imgs++;
    if (el.tagName === 'VIDEO') videos++;
    if (el.tagName === 'CANVAS' && r.width > 200) canvases++;
  }
  const top = (m, n) => [...m.entries()].sort((a, z) => z[1] - a[1]).slice(0, n);
  const total = [...bg.values()].reduce((a, v) => a + v, 0) || 1;
  const h1 = document.querySelector('h1'), h2 = document.querySelector('h2'), p = document.querySelector('main p, p');
  const font = (el) => el ? { family: getComputedStyle(el).fontFamily.split(',')[0].replace(/["']/g, '').trim(), size: parseFloat(getComputedStyle(el).fontSize), weight: getComputedStyle(el).fontWeight, line: getComputedStyle(el).lineHeight, tracking: getComputedStyle(el).letterSpacing, upper: getComputedStyle(el).textTransform === 'uppercase' } : null;
  const root = document.querySelector('main') || document.body;
  let blocks = [...root.children].filter((c) => vis(c) && c.getBoundingClientRect().height >= 250);
  if (blocks.length <= 2) { const big = blocks.sort((a, z) => z.getBoundingClientRect().height - a.getBoundingClientRect().height)[0]; if (big) blocks = [...big.children].filter((c) => vis(c) && c.getBoundingClientRect().height >= 250); }
  const nav = document.querySelector('header nav, nav, header');
  const navLinks = nav ? [...nav.querySelectorAll('a')].filter(vis).length : 0;
  const dropdown = !!document.querySelector('nav li ul, nav [aria-haspopup], nav [aria-expanded], header [aria-haspopup], header [aria-expanded]');
  const hero = blocks[0] || document.body.firstElementChild;
  const hr = hero ? hero.getBoundingClientRect() : { height: 0 };
  const heroMedia = hero ? !!hero.querySelector('video,img,canvas,picture') || /url\(/.test(getComputedStyle(hero).backgroundImage) : false;
  const accent = top(act, 6).map(([c]) => c).filter((c) => sat(c) > 0.25)[0] || top(fg, 8).map(([c]) => c).find((c) => sat(c) > 0.35) || null;
  return {
    title: document.title.slice(0, 80),
    screens: +(document.documentElement.scrollHeight / innerHeight).toFixed(1),
    sections: blocks.length,
    section_heights: blocks.slice(0, 16).map((x) => Math.round(x.getBoundingClientRect().height / innerHeight * 10) / 10),
    colors: { backgrounds: top(bg, 6).map(([c, a]) => [c, Math.round(a / total * 100)]), text: top(fg, 5).map(([c]) => c), actions: top(act, 4).map(([c]) => c), accent },
    type: { h1: font(h1), h2: font(h2), body: font(p) },
    nav: { links: navLinks, dropdown },
    hero: { screens: +(hr.height / innerHeight).toFixed(2), media: heroMedia, video: hero ? !!hero.querySelector('video') : false },
    media: { images: imgs, videos, canvases },
    effects: { glass, shadow, radius: top(round, 3).map(([r]) => r), animations: document.getAnimations ? document.getAnimations().length : 0, gsap: !!window.gsap, three: !!window.THREE, lenis: !!(window.lenis || window.Lenis) },
  };
};

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
