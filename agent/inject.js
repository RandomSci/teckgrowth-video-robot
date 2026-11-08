// Injected into meet.google.com before Meet's own scripts run.
// Gives Meet a fake microphone fed by the AI's audio, and taps every remote audio track
// so the bot can hear the other people. All audio is PCM16 mono at 24 kHz.
(() => {
  if (window.__mb) return;
  if (window.top !== window) return;   // only the main page; iframes would send their own silent streams
  const RATE = 24000;
  const ctx = new AudioContext({ sampleRate: RATE });
  // the bot's voice gets its own audio engine, so the hearing tap
  // (which runs on the busy main thread) can never stall it. Same 24 kHz as OpenAI, so chunks join without resampling clicks
  const out = new AudioContext({ sampleRate: RATE, latencyHint: 'playback' });
  const micDest = out.createMediaStreamDestination();   // what Meet sends as our mic
  const mix = ctx.createGain();                          // all remote voices
  const tap = ctx.createScriptProcessor(2048, 1, 1);
  const sink = ctx.createGain(); sink.gain.value = 0;
  mix.connect(tap); tap.connect(sink); sink.connect(ctx.destination);
  let playHead = 0, sources = [];

  const b64 = (u8) => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };

  tap.onaudioprocess = (e) => {
    if (!window.__mb_audio || seen.size === 0) return;
    const f = e.inputBuffer.getChannelData(0);
    const i16 = new Int16Array(f.length);
    let peak = 0;
    for (let i = 0; i < f.length; i++) { const v = Math.max(-1, Math.min(1, f[i])); i16[i] = v * 0x7fff; peak = Math.max(peak, Math.abs(v)); }
    window.__mb_audio(b64(new Uint8Array(i16.buffer)), peak);
  };

  const seen = new Set();
  const addTrack = (track) => {
    if (track.kind !== 'audio' || seen.has(track.id)) return;
    seen.add(track.id);
    // Chrome only delivers remote WebRTC audio to WebAudio if the stream is also attached to a media element
    const ms = new MediaStream([track]);
    const el = new Audio(); el.muted = true; el.srcObject = ms; el.play().catch(() => {});
    ctx.createMediaStreamSource(ms).connect(mix);
  };

  const RPC = window.RTCPeerConnection;
  const pcs = [], ours = new Set();
  window.RTCPeerConnection = function (...a) {
    const pc = new RPC(...a);
    pcs.push(pc);
    pc.addEventListener('track', (ev) => addTrack(ev.track));
    return pc;
  };
  window.RTCPeerConnection.prototype = RPC.prototype;
  Object.setPrototypeOf(window.RTCPeerConnection, RPC);

  const realGUM = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
  navigator.mediaDevices.getUserMedia = async (c) => {
    ctx.resume(); out.resume();
    const ms2 = new MediaStream();
    if (c && c.audio) micDest.stream.getAudioTracks().forEach(t => { const c = t.clone(); ours.add(c.id); ms2.addTrack(c); });
    if (c && c.video) { try { (await realGUM({ video: c.video })).getVideoTracks().forEach(t => ms2.addTrack(t)); } catch (e) {} }
    return ms2;
  };

  // ---- screen share. Meet's "Share screen" asks getDisplayMedia, we hand it a canvas we draw slides on ----
  const cv = document.createElement('canvas'); cv.width = 1280; cv.height = 720;
  const g = cv.getContext('2d');
  let slide = null, shareStream = null, shot = null;
  const wrap = (text, max, font) => {
    g.font = font; const words = String(text).split(/\s+/), lines = []; let cur = '';
    for (const w of words) { const t = cur ? cur + ' ' + w : w; if (g.measureText(t).width > max && cur) { lines.push(cur); cur = w; } else cur = t; }
    if (cur) lines.push(cur); return lines;
  };
  const draw = () => {
    const W = 1280, H = 720;
    if (shot) { g.drawImage(shot, 0, 0, W, H); return; }   // a live web page is on screen
    const bg = g.createLinearGradient(0, 0, W, H); bg.addColorStop(0, '#070b16'); bg.addColorStop(1, '#101a33');
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(56,189,248,0.10)'; g.beginPath(); g.arc(W - 120, 110, 260, 0, 7); g.fill();
    g.fillStyle = '#38bdf8'; g.fillRect(80, 92, 72, 6);
    g.font = '600 22px Inter, Arial, sans-serif'; g.fillStyle = '#7dd3fc'; g.fillText('TECKGROWTH', 80, 70);
    if (!slide) { g.font = '700 64px Inter, Arial, sans-serif'; g.fillStyle = '#fff'; g.fillText('TeckGrowth', 80, 380); return; }
    let y = 170;
    for (const l of wrap(slide.title || '', 1100, '700 56px Inter, Arial, sans-serif')) { g.fillStyle = '#ffffff'; g.fillText(l, 80, y); y += 66; }
    y += 24;
    for (const b of (slide.bullets || []).slice(0, 6)) {
      const ls = wrap(b, 1040, '400 32px Inter, Arial, sans-serif');
      g.fillStyle = '#38bdf8'; g.beginPath(); g.arc(92, y - 11, 7, 0, 7); g.fill();
      for (const l of ls) { g.fillStyle = '#dbe4f3'; g.fillText(l, 120, y); y += 42; }
      y += 16; if (y > 680) break;
    }
    if (slide.footer) { g.font = '400 22px Inter, Arial, sans-serif'; g.fillStyle = '#7a8aa6'; g.fillText(slide.footer, 80, 690); }
  };
  draw(); setInterval(draw, 250);   // keep frames flowing so Meet never freezes the share
  navigator.mediaDevices.getDisplayMedia = async () => {
    shareStream = cv.captureStream(10);
    return shareStream;
  };

  window.__mb = {
    play(b64pcm) {
      out.resume();
      const bin = atob(b64pcm), n = bin.length >> 1;
      const buf = out.createBuffer(1, n, RATE), ch = buf.getChannelData(0);
      const dv = new DataView(new ArrayBuffer(bin.length));
      for (let i = 0; i < bin.length; i++) dv.setUint8(i, bin.charCodeAt(i));
      for (let i = 0; i < n; i++) ch[i] = dv.getInt16(i * 2, true) / 0x8000;
      const src = out.createBufferSource(); src.buffer = buf; src.connect(micDest);
      // start each answer 250 ms ahead so late chunks don't leave gaps (gaps sound broken)
      if (playHead < out.currentTime + 0.02) playHead = out.currentTime + 0.25;
      src.start(playHead); playHead += buf.duration;
      sources.push(src); src.onended = () => { sources = sources.filter(s => s !== src); };
    },
    stop() { sources.forEach(s => { try { s.stop(); } catch (e) {} }); sources = []; playHead = 0; },
    playing() { return Math.max(0, playHead - out.currentTime); },
    tracks() { return seen.size; },
    // is Meet sending our voice track as is, or a track it made by processing ours (noise cancellation etc)
    senders() { return pcs.flatMap(pc => { try { return pc.getSenders(); } catch (e) { return []; } })
      .filter(x => x.track && x.track.kind === 'audio').map(x => ({ ours: ours.has(x.track.id), label: x.track.label, state: x.track.readyState })); },
    slide(x) { slide = x; shot = null; draw(); },
    image(url) { return new Promise(r => { const im = new Image(); im.onload = () => { shot = im; draw(); r(true); }; im.onerror = () => r(false); im.src = url; }); },
    clearImage() { shot = null; draw(); },
    sharing() { return !!(shareStream && shareStream.getVideoTracks().some(t => t.readyState === 'live')); },
    unshare() { if (shareStream) shareStream.getTracks().forEach(t => { t.stop(); t.dispatchEvent(new Event('ended')); }); shareStream = null; },
  };
})();
