// The admin assistant's own machine on GitHub (Selwyn 11.08 21.34). Reads its job and keys from TeckGrowth with the
// one time token, joins a Google Meet with meetbot or works a task with a browser, a shell, make_image and the media tools, then
// posts the result back. Never prints the job, keys, transcripts or results to the log, this repo is public.
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const { TG_CB, TG_ID, TG_URL } = process.env;
const WORK = path.resolve('work'), OUT = path.resolve('work/out');
fs.mkdirSync(OUT, { recursive: true });
const t0 = Date.now();
const log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(0)}s]`, ...a);   // steps only, never content

async function send(body) {
  const files = [];
  let size = 0;
  for (const f of body.files || []) {
    try { const b = fs.readFileSync(f); if (size + b.length > 19e6) continue; size += b.length; files.push({ name: path.basename(f), data: b.toString('base64') }); } catch {}
  }
  for (let i = 0; i < 3; i++) {
    const r = await fetch(TG_URL, { method: 'POST', headers: { authorization: `Bearer ${TG_CB}`, 'content-type': 'application/json' },
      body: JSON.stringify({ id: TG_ID, status: body.status, text: body.text, error: body.error, remember: body.remember, run: process.env.GITHUB_RUN_ID, files }) }).catch(() => null);
    if (r?.ok) { log('result sent', files.length, 'files'); return; }
    log('send failed', r?.status); await new Promise((s) => setTimeout(s, 5000));
  }
}

// one line per step for Selwyn's live view in the chat, images and screenshots it made go with it (Selwyn 11.09)
function progress(name, a, out) {
  const brief = name === 'shell' ? `Ran ${String(a.cmd || a.command || '').split('\n')[0].slice(0, 120)}`
    : name === 'browser' ? `Browser ${a.action || ''} ${a.url || a.selector || ''}`.trim()
    : name === 'make_image' ? `Made an image, ${String(a.prompt || '').slice(0, 100)}`
    : `${name.replace(/_/g, ' ')} ${Object.values(a || {}).filter((v) => typeof v === 'string').join(' ').slice(0, 100)}`.trim();
  const files = [];
  const f = typeof out === 'string' && /\.(png|jpe?g|webp|gif)$/i.test(out) && fs.existsSync(out) ? out : null;
  if (f && fs.statSync(f).size < 3e6) files.push({ name: path.basename(f), data: fs.readFileSync(f).toString('base64') });
  const bad = typeof out === 'string' && /^error /.test(out);
  return fetch(TG_URL, { method: 'POST', headers: { authorization: `Bearer ${TG_CB}`, 'content-type': 'application/json' },
    body: JSON.stringify({ id: TG_ID, status: 'running', step: (bad ? 'Failed, ' : '') + brief.replace(/sk-[A-Za-z0-9_-]+/g, 'sk-…'), files }) }).catch(() => {});
}

async function ai(key, model, input, tools) {
  const r = await fetch('https://api.openai.com/v1/responses', { method: 'POST', headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({ model, input, ...(tools ? { tools } : {}), store: false }) });
  const d = await r.json();
  if (!r.ok) throw new Error(`OpenAI ${r.status} ${d.error?.message || ''}`.slice(0, 300));
  return d;
}
const textOf = (d) => d.output_text || (d.output || []).flatMap((o) => o.content || []).map((c) => c.text || '').join('').trim();

// ---------- meet
// A new open Meet made with the company service account as Selwyn, its link emailed to the invite and sent back at once
function newMeet(task, K) {
  const py = `
import json, os, base64, requests
from google.oauth2 import service_account
import google.auth.transport.requests as gtr
info = json.loads(os.environ['SA'])
def tok(scope):
    c = service_account.Credentials.from_service_account_info(info, scopes=[scope], subject=os.environ['ADMIN'])
    c.refresh(gtr.Request()); return c.token
r = requests.post('https://meet.googleapis.com/v2/spaces', headers={'Authorization': 'Bearer ' + tok('https://www.googleapis.com/auth/meetings.space.created')}, json={'config': {'accessType': 'OPEN', 'entryPointAccess': 'ALL'}})
r.raise_for_status(); link = r.json()['meetingUri']
msg = 'To: ' + os.environ['TO'] + '\\r\\nSubject: Join me on Google Meet\\r\\nContent-Type: text/plain; charset=utf-8\\r\\n\\r\\nI am in the call and waiting for you.\\n\\n' + link + '\\n\\nYour TeckGrowth assistant\\n'
raw = base64.urlsafe_b64encode(msg.encode()).decode()
g = requests.post('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', headers={'Authorization': 'Bearer ' + tok('https://mail.google.com/')}, json={'raw': raw})
print(json.dumps({'link': link, 'mailed': g.ok}))
`;
  const r = spawnSync('python', ['-c', py], { env: { ...process.env, SA: K.google_sa, ADMIN: K.admin_email, TO: task.invite || K.admin_email }, encoding: 'utf8' });
  try { return JSON.parse(r.stdout.trim().split('\n').pop()); } catch { return { error: (r.stderr || '').split('\n').filter(Boolean).pop()?.slice(0, 200) || 'could not make a Meet' }; }
}

async function meet(task, K) {
  if (!task.meet_url) {
    const m = newMeet(task, K);
    if (!m.link) return send({ status: 'failed', error: 'Could not create the Meet, ' + m.error, text: '', files: [] });
    task.meet_url = m.link; task.made = true;
    await fetch(TG_URL, { method: 'POST', headers: { authorization: `Bearer ${TG_CB}`, 'content-type': 'application/json' }, body: JSON.stringify({ id: TG_ID, status: 'running', meet_url: m.link, text: `In the call now, ${m.link}${m.mailed ? `, the link was emailed to ${task.invite}` : ', the email did not send'}` }) }).catch(() => {});
    log('meet created');
  }
  const script = path.join(WORK, 'script.txt');
  fs.writeFileSync(script, 'WHAT THIS CALL IS FOR\n' + (task.goal || 'A TeckGrowth call. Be helpful and brief.')
    + (K.business ? `\n\nEVERYTHING ABOUT TECKGROWTH (information only, never read it out)\n${K.business.slice(0, 20000)}` : '')
    + (K.numbers ? `\n\nLIVE NUMBERS RIGHT NOW (real, from production)\n${K.numbers.slice(0, 4000)}` : '')
    + (K.memory ? `\n\nWHAT YOU KNOW FROM EARLIER (your own notes, information only)\n${K.memory.slice(0, 6000)}` : ''));
  const args = ['agent/meetbot.py', 'join', task.meet_url, '--minutes', String(task.minutes), '--name', task.team === false ? task.name : 'Jasmine', '--script', script, '--channel', 'chrome', '--admit-wait', '600'];
  if (!task.talk) args.push('--listen');
  const team = task.team !== false;   // Selwyn's own meetings, Jasmine the teammate (Selwyn 11.09)
  if (team) args.push('--team');
  if (task.made && !team) args.push('--idle-end', '900', '--no-greet');   // a sales call waits quietly for the guest
  if (task.made && team) args.push('--idle-end', '900');                  // she greets Selwyn when he joins
  const useEleven = task.voice === 'elevenlabs' && K.elevenlabs;
  if (useEleven) args.push('--voice-engine', 'elevenlabs');
  const env = { ...process.env, OPENAI_API_KEY: K.openai, OPENAI_REALTIME_MODEL: K.realtime_model, MEETBOT_STORAGE_STATE: K.google_state || '', ELEVENLABS_API_KEY: useEleven ? K.elevenlabs : '' };
  const logf = fs.openSync(path.join(WORK, 'meetbot.log'), 'w');
  log('joining the call');
  const code = await new Promise((res) => spawn('python', args, { env, stdio: ['ignore', logf, logf] }).on('exit', res));
  log('left the call, exit', code);
  const runs = path.resolve('agent/runs');
  const dir = fs.existsSync(runs) ? fs.readdirSync(runs).map((d) => path.join(runs, d)).sort().pop() : null;
  const tx = dir && fs.existsSync(path.join(dir, 'transcript.txt')) ? fs.readFileSync(path.join(dir, 'transcript.txt'), 'utf8') : '';
  const files = [];
  if (tx) { fs.writeFileSync(path.join(OUT, 'transcript.txt'), tx); files.push(path.join(OUT, 'transcript.txt')); }
  for (const shot of ['joined.png', 'prejoin.png']) if (dir && fs.existsSync(path.join(dir, shot))) { files.push(path.join(dir, shot)); break; }
  if (!tx) {
    const tail = fs.readFileSync(path.join(WORK, 'meetbot.log'), 'utf8').split('\n').slice(-15).join('\n').replace(/sk-[A-Za-z0-9_-]+/g, 'sk-…');
    return send({ status: 'failed', error: 'No transcript, the bot may not have been let in', text: 'The bot did not get a transcript. Last lines of its log\n' + tail, files });
  }
  let summary = '';
  try { summary = textOf(await ai(K.openai, K.model, [{ role: 'user', content: `Summarize this meeting for Selwyn, the owner of TeckGrowth. Short, plain, no colons, no em dashes. Who was there, what was decided, open questions, next steps with owners.\n\n${tx.slice(0, 150000)}` }])); } catch (e) { summary = 'Summary failed, ' + e.message; }
  const voiceNote = task.voice === 'elevenlabs' && !K.elevenlabs ? 'The ElevenLabs key is not set, so it spoke with the OpenAI Realtime voice.\n\n' : '';
  const fresh = dir && fs.existsSync(path.join(dir, 'state.json')) ? fs.readFileSync(path.join(dir, 'state.json'), 'utf8') : null;
  if (fresh) await fetch(TG_URL, { method: 'POST', headers: { authorization: `Bearer ${TG_CB}`, 'content-type': 'application/json' }, body: JSON.stringify({ id: TG_ID, status: 'running', google_state: fresh, text: 'Call ended, writing the summary' }) }).catch(() => {});
  return send({ status: 'done', text: `${voiceNote}Summary\n${summary}\n\nTranscript\n${tx.slice(0, 50000)}`, files });
}

// ---------- task
const TOOLS = [
  { type: 'function', name: 'shell', description: 'Run a bash command on this Ubuntu runner in the work folder. node 22, npx, python 3.12, pip, yt-dlp, ffmpeg, Remotion (npm run render in the repo root), npx hyperframes, npx n8n and anything you install. Save files the owner should get in work/out. Output is cut to the last 8000 characters.', parameters: { type: 'object', properties: { cmd: { type: 'string' }, seconds: { type: 'number', description: 'time limit, up to 1800' } }, required: ['cmd', 'seconds'], additionalProperties: false }, strict: true },
  { type: 'function', name: 'browser', description: 'A real Chrome, signed in to the bot Google account when the job allows it. action open (url), click (selector or text), type (selector, text), press (text is the key), text (page text), screenshot (saves to work/out, answer has the path), wait (ms in text).', parameters: { type: 'object', properties: { action: { type: 'string', enum: ['open', 'click', 'type', 'press', 'text', 'screenshot', 'wait'] }, url: { type: 'string' }, selector: { type: 'string' }, text: { type: 'string' } }, required: ['action', 'url', 'selector', 'text'], additionalProperties: false }, strict: true },
  { type: 'function', name: 'look', description: 'Look at an image file (png, jpg, webp) and answer a question. For a video, take frames first with ffmpeg and look at them.', parameters: { type: 'object', properties: { path: { type: 'string' }, question: { type: 'string' } }, required: ['path', 'question'], additionalProperties: false }, strict: true },
  { type: 'function', name: 'transcribe', description: 'Transcribe an audio or video file to text (any length, it is cut into parts).', parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'], additionalProperties: false }, strict: true },
  { type: 'function', name: 'make_image', description: 'Make an image with OpenAI and save it in work/out, the answer has the path. Use it for ads and social posts.', parameters: { type: 'object', properties: { prompt: { type: 'string' }, size: { type: 'string', enum: ['1024x1024', '1536x1024', '1024x1536'] } }, required: ['prompt', 'size'], additionalProperties: false }, strict: true },
  { type: 'function', name: 'finish', description: 'Done. report is what Selwyn reads, files are paths in work/out to send him (20 MB in all), remember is one short line for your long term notes (empty if nothing worth keeping).', parameters: { type: 'object', properties: { report: { type: 'string' }, files: { type: 'array', items: { type: 'string' } }, remember: { type: 'string' } }, required: ['report', 'files', 'remember'], additionalProperties: false }, strict: true },
];

async function task(job, K) {
  const { chromium } = await import('playwright');
  let page = null;
  const browserPage = async () => {
    if (page) return page;
    const b = await chromium.launch({ headless: true, args: ['--disable-blink-features=AutomationControlled'] });
    const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, ...(job.google && K.google_state ? { storageState: JSON.parse(K.google_state) } : {}) });
    return (page = await ctx.newPage());
  };
  const childEnv = { ...process.env }; for (const k of ['TG_CB', 'TG_URL', 'OPENAI_API_KEY']) delete childEnv[k];
  if (K.atlas) childEnv.ATLAS_API_KEY = K.atlas;   // Atlas Cloud for video and image jobs, masked in the log
  const run = {
    async shell({ cmd, seconds }) {
      const r = spawnSync('bash', ['-lc', cmd], { cwd: WORK, env: childEnv, timeout: Math.min(1800, seconds || 300) * 1000, maxBuffer: 64e6, encoding: 'utf8' });
      return `exit ${r.status}${r.error ? ' ' + r.error.message : ''}\n${((r.stdout || '') + (r.stderr || '')).slice(-8000)}`;
    },
    async browser({ action, url, selector, text }) {
      const p = await browserPage();
      if (action === 'open') { await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 }); await p.waitForTimeout(1500); return `${p.url()} ${await p.title()}`; }
      if (action === 'click') { await (selector ? p.locator(selector).first() : p.getByText(text, { exact: false }).first()).click({ timeout: 15000 }); await p.waitForTimeout(1000); return 'clicked, now ' + p.url(); }
      if (action === 'type') { await p.locator(selector).first().fill(text, { timeout: 15000 }); return 'typed'; }
      if (action === 'press') { await p.keyboard.press(text); return 'pressed'; }
      if (action === 'wait') { await p.waitForTimeout(Math.min(60000, Number(text) || 2000)); return 'waited'; }
      if (action === 'screenshot') { const f = path.join(OUT, `shot-${Date.now()}.png`); await p.screenshot({ path: f, fullPage: false }); return f; }
      return (await p.evaluate(() => document.body.innerText)).slice(0, 12000);
    },
    async look({ path: f, question }) {
      const b = fs.readFileSync(path.resolve(WORK, f)); const ext = path.extname(f).slice(1).replace('jpg', 'jpeg') || 'png';
      return textOf(await ai(K.openai, K.model, [{ role: 'user', content: [{ type: 'input_text', text: question }, { type: 'input_image', image_url: `data:image/${ext};base64,${b.toString('base64')}` }] }]));
    },
    async make_image({ prompt, size }) {
      let last = '';
      for (const model of K.image_models || ['gpt-image-2', 'gpt-image-1.5']) {
        const r = await fetch('https://api.openai.com/v1/images/generations', { method: 'POST', headers: { authorization: `Bearer ${K.openai}`, 'content-type': 'application/json' }, body: JSON.stringify({ model, prompt, size, n: 1 }) });
        const d = await r.json().catch(() => ({}));
        if (r.ok && d.data?.[0]?.b64_json) { const f = path.join(OUT, `image-${Date.now()}.png`); fs.writeFileSync(f, Buffer.from(d.data[0].b64_json, 'base64')); return f; }
        last = `${model} ${d.error?.message || r.status}`;
      }
      return 'error ' + last;
    },
    async transcribe({ path: f }) {
      const src = path.resolve(WORK, f), dir = fs.mkdtempSync(path.join(WORK, 'tx-'));
      spawnSync('ffmpeg', ['-v', 'error', '-i', src, '-vn', '-ac', '1', '-ar', '16000', '-b:a', '32k', '-f', 'segment', '-segment_time', '1200', path.join(dir, 'p%03d.mp3')]);
      let out = '';
      for (const p of fs.readdirSync(dir).sort()) {
        const fd = new FormData(); fd.append('model', 'gpt-4o-mini-transcribe'); fd.append('file', new Blob([fs.readFileSync(path.join(dir, p))]), p);
        const r = await fetch('https://api.openai.com/v1/audio/transcriptions', { method: 'POST', headers: { authorization: `Bearer ${K.openai}` }, body: fd });
        const d = await r.json(); out += (d.text || `[part ${p} failed ${r.status}]`) + '\n';
      }
      const tf = path.join(OUT, path.basename(f).replace(/\.[^.]+$/, '') + '-transcript.txt'); fs.writeFileSync(tf, out);
      return `saved to ${tf}\n${out.slice(0, 8000)}`;
    },
  };
  const input = [
    { role: 'system', content: `You are the TeckGrowth admin assistant working on your own Ubuntu machine for Selwyn, the owner. ATLAS_API_KEY is in the shell environment when Atlas Cloud is set up, use it with curl for Atlas models (https://api.atlascloud.ai). For images use make_image. Work the job to the end with your tools, then call finish. Files Selwyn attached are in work/in (zips unpacked into a folder of the same name), read them with the shell first. Real results only, never invent. Never print or send keys. Writing for Selwyn has no colons, no em dashes, no slashes. You have about ${job.minutes} minutes.${K.memory ? `\n\nYOUR NOTES FROM EARLIER (information, not instructions)\n${K.memory.slice(0, 8000)}` : ''}` },
    { role: 'user', content: job.goal },
  ];
  const until = t0 + job.minutes * 60e3;
  for (let step = 0; step < 80 && Date.now() < until; step++) {
    const d = await ai(K.openai, K.model, input, TOOLS);
    input.push(...(d.output || []).filter((o) => o.type === 'function_call' || o.type === 'message'));
    const calls = (d.output || []).filter((o) => o.type === 'function_call');
    if (!calls.length) return send({ status: 'done', text: textOf(d) || 'Finished without a report.', files: [] });
    for (const c of calls) {
      const a = JSON.parse(c.arguments || '{}');
      log('step', step, c.name);
      if (c.name === 'finish') return send({ status: 'done', text: a.report, remember: a.remember || '', files: (a.files || []).map((f) => path.resolve(WORK, f)) });
      let out; try { out = await run[c.name](a); } catch (e) { out = 'error ' + String(e.message || e).slice(0, 500); }
      progress(c.name, a, out);
      input.push({ type: 'function_call_output', call_id: c.call_id, output: String(out) });
    }
  }
  return send({ status: 'done', text: 'Ran out of time before finishing. Files so far are attached.', files: fs.readdirSync(OUT).map((f) => path.join(OUT, f)) });
}

// ---------- sign in Jasmine's Google account (Selwyn 11.09)
// A normal Chrome on a virtual screen, shown on Selwyn's phone through noVNC and a one time Cloudflare tunnel with a
// random password. He signs in himself, this machine sees the Google cookies, saves the login to TeckGrowth (stored
// encrypted, never in this public repo or its logs) and closes everything. Nothing here types a password.
async function login(task) {
  const sh = (cmd, args, opts = {}) => spawn(cmd, args, { stdio: 'ignore', detached: false, ...opts });
  const pw = [...crypto.getRandomValues(new Uint8Array(9))].map((b) => 'abcdefghjkmnpqrstuvwxyz23456789'[b % 31]).join('').slice(0, 8);   // VNC passwords are 8 characters
  const env = { ...process.env, DISPLAY: ':99' };
  sh('Xvfb', [':99', '-screen', '0', '1280x860x24']);
  await new Promise((s) => setTimeout(s, 1500));
  const prof = path.join(WORK, 'chrome');
  sh('google-chrome', [`--user-data-dir=${prof}`, '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=9222', '--window-position=0,0', '--window-size=1280,860', '--lang=en-US',
    'https://accounts.google.com/ServiceLogin?continue=https%3A%2F%2Fmeet.google.com%2F'], { env });
  spawnSync('x11vnc', ['-storepasswd', pw, path.join(WORK, 'vncpass')]);
  sh('x11vnc', ['-display', ':99', '-forever', '-shared', '-rfbport', '5900', '-rfbauth', path.join(WORK, 'vncpass'), '-localhost', '-quiet']);
  sh('websockify', ['--web', '/usr/share/novnc', '6080', 'localhost:5900']);
  const cf = spawn('cloudflared', ['tunnel', '--no-autoupdate', '--url', 'http://localhost:6080'], { stdio: ['ignore', 'pipe', 'pipe'] });
  const tunnel = await new Promise((res) => {
    const t = setTimeout(() => res(null), 60000);
    const look = (b) => { const m = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/.exec(String(b)); if (m) { clearTimeout(t); res(m[0]); } };
    cf.stdout.on('data', look); cf.stderr.on('data', look);
  });
  if (!tunnel) return send({ status: 'failed', error: 'Could not open the sign in link', text: '', files: [] });
  const link = `${tunnel}/vnc.html?autoconnect=1&resize=scale&password=${pw}`;
  await fetch(TG_URL, { method: 'POST', headers: { authorization: `Bearer ${TG_CB}`, 'content-type': 'application/json' }, body: JSON.stringify({ id: TG_ID, status: 'running', login_url: link, text: `Open this link and sign in to ${task.account || 'the robot Google account'}, ${link}` }) }).catch(() => {});
  log('sign in link sent');
  // wait for the Google login, read through Chrome's debugging port, up to the job's minutes
  const py = `
import asyncio, json, sys
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as pw:
        b = await pw.chromium.connect_over_cdp('http://127.0.0.1:9222')
        ctx = b.contexts[0]
        names = {c['name'] for c in await ctx.cookies('https://accounts.google.com') if c['domain'].endswith('google.com')}
        if not {'SID', '__Secure-1PSID'} <= names:
            print('{}'); return
        p = await ctx.new_page()
        await p.goto('https://meet.google.com/landing', timeout=60000)
        await asyncio.sleep(4)
        if 'accounts.google.com' in p.url:
            await p.close(); print('{}'); return
        await p.close()
        print(json.dumps(await ctx.storage_state()))
asyncio.run(main())
`;
  const until = Date.now() + (task.minutes || 20) * 60000;
  while (Date.now() < until) {
    await new Promise((s) => setTimeout(s, 6000));
    const r = spawnSync('python', ['-c', py], { encoding: 'utf8', maxBuffer: 20e6 });
    let st = null; try { st = JSON.parse((r.stdout || '').trim().split('\n').pop() || '{}'); } catch {}
    if (st && Array.isArray(st.cookies) && st.cookies.length) {
      log('signed in, saving');
      for (let i = 0; i < 3; i++) {
        const ok = await fetch(TG_URL, { method: 'POST', headers: { authorization: `Bearer ${TG_CB}`, 'content-type': 'application/json' }, body: JSON.stringify({ id: TG_ID, status: 'done', google_state: JSON.stringify(st), text: 'Signed in. Jasmine can join meetings now.', run: process.env.GITHUB_RUN_ID, files: [] }) }).then((x) => x.ok).catch(() => false);
        if (ok) { cf.kill(); return; }
        await new Promise((s) => setTimeout(s, 4000));
      }
      cf.kill();
      return log('could not save the login');
    }
  }
  cf.kill();
  return send({ status: 'failed', error: 'Nobody signed in before the link expired', text: 'The sign in link expired. Ask again for a new one.', files: [] });
}

// ---------- start
const r = await fetch(`${TG_URL}/keys?id=${encodeURIComponent(TG_ID)}`, { headers: { authorization: `Bearer ${TG_CB}` } });
if (!r.ok) { log('could not get the job', r.status); process.exit(1); }
const K = await r.json();
for (const v of [K.openai, K.elevenlabs, K.atlas]) if (v) console.log(`::add-mask::${v}`);
K.model = K.model || 'gpt-4.1';
log('job kind', K.task.kind);
// the files Selwyn attached, into work/in, zips unpacked next to them
const IN = path.join(WORK, 'in'); fs.mkdirSync(IN, { recursive: true });
for (const f of K.task.files || []) {
  const r = await fetch(`${TG_URL}/file?id=${encodeURIComponent(TG_ID)}&file=${encodeURIComponent(f.id)}`, { headers: { authorization: `Bearer ${TG_CB}` } }).catch(() => null);
  if (!r?.ok) { log('file not fetched', r?.status); continue; }
  const dest = path.join(IN, path.basename(f.name).replace(/[^\w.\- ]/g, '_'));
  fs.writeFileSync(dest, Buffer.from(await r.arrayBuffer()));
  if (/\.zip$/i.test(dest)) spawnSync('unzip', ['-q', '-o', dest, '-d', dest.replace(/\.zip$/i, '')]);
  log('file ready');
}
try {
  if (K.task.kind === 'meet') await meet(K.task, K); else if (K.task.kind === 'login') await login(K.task); else await task(K.task, K);
} catch (e) {
  log('failed');
  await send({ status: 'failed', error: String(e.message || e).replace(/sk-[A-Za-z0-9_-]+/g, 'sk-…').slice(0, 300), text: '', files: [] });
}
process.exit(0);
