// The design measurement that runs inside a page, shared by design-refs and design-scan.
// runs in the site
export const MEASURE = () => {
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
  const display = [...document.querySelectorAll('h1,h2,h3,p,span,div,a')].filter((e) => vis(e) && [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 2)).sort((a, z) => parseFloat(getComputedStyle(z).fontSize) - parseFloat(getComputedStyle(a).fontSize))[0];
  const h1 = display || document.querySelector('h1'), h2 = document.querySelector('h2'), p = document.querySelector('main p, p');
  const font = (el) => el ? { family: getComputedStyle(el).fontFamily.split(',')[0].replace(/["']/g, '').trim(), size: parseFloat(getComputedStyle(el).fontSize), weight: getComputedStyle(el).fontWeight, line: getComputedStyle(el).lineHeight, tracking: getComputedStyle(el).letterSpacing, upper: getComputedStyle(el).textTransform === 'uppercase' } : null;
  const root = document.querySelector('main') || document.body;
  let blocks = [...root.children].filter((c) => vis(c) && c.getBoundingClientRect().height >= 250);
  for (let depth = 0; depth < 4 && blocks.length <= 2; depth++) { const big = blocks.sort((a, z) => z.getBoundingClientRect().height - a.getBoundingClientRect().height)[0]; if (!big) break; const next = [...big.children].filter((c) => vis(c) && c.getBoundingClientRect().height >= 250); if (!next.length) break; blocks = next; }
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

