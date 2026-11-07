import React from 'react';
import { AbsoluteFill, Img, OffthreadVideo, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig, Easing } from 'remotion';

export type Scene = { file: string; clip?: string | null; caption: string; device?: string; seconds?: number | null };
export type PromoProps = { title: string; subtitle?: string; cta: string; format?: string; scenes: Scene[] };

const FPS = 30;
const HOOK = 75;
const OUTRO = 90;
export const sceneFrames = (s: Scene) => Math.round((s.seconds || (s.clip ? 9 : 4)) * FPS);
export const promoLength = (scenes: Scene[]) => HOOK + scenes.reduce((n, s) => n + sceneFrames(s), 0) + OUTRO;

const font = 'Inter, "Helvetica Neue", Arial, sans-serif';
const bg = '#070a12';
const ink = '#f4f6fb';
const muted = '#9aa3b5';
const accent = '#7c5cff';

const Hook: React.FC<{ title: string; subtitle?: string; vertical: boolean }> = ({ title, subtitle, vertical }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const a = spring({ frame: f, fps, config: { damping: 200 } });
  const b = spring({ frame: f - 10, fps, config: { damping: 200 } });
  return (
    <AbsoluteFill style={{ background: `radial-gradient(1200px 700px at 30% 20%, #16203a 0%, ${bg} 60%)`, justifyContent: 'center', padding: vertical ? 90 : '0 180px' }}>
      <div style={{ fontFamily: font, color: ink, fontSize: vertical ? 96 : 110, fontWeight: 800, lineHeight: 1.04, letterSpacing: -3, opacity: a, transform: `translateY(${(1 - a) * 40}px)`, maxWidth: 1400 }}>{title}</div>
      {subtitle ? <div style={{ fontFamily: font, color: muted, fontSize: vertical ? 44 : 46, marginTop: 28, opacity: b, maxWidth: 1300 }}>{subtitle}</div> : null}
    </AbsoluteFill>
  );
};

// A clean browser window (desktop) or a phone frame, with the page inside and a caption under it.
const Frame: React.FC<{ scene: Scene; frames: number; vertical: boolean }> = ({ scene, frames, vertical }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame: f, fps, config: { damping: 200 } });
  const fade = interpolate(f, [frames - 12, frames], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const drift = interpolate(f, [0, frames], [1, scene.clip ? 1 : 1.05], { easing: Easing.inOut(Easing.cubic), extrapolateRight: 'clamp' });
  const phone = scene.device === 'phone';
  const W = vertical ? (phone ? 760 : 1000) : phone ? 420 : 1360;
  const H = phone ? W * (844 / 390) : W * (900 / 1440);
  const media = scene.clip
    ? <OffthreadVideo src={staticFile(scene.clip)} muted style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top center' }} />
    : <Img src={staticFile(scene.file)} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top center', transform: `scale(${drift})`, transformOrigin: 'top center' }} />;
  return (
    <AbsoluteFill style={{ background: `radial-gradient(1400px 800px at 70% 0%, #141c33 0%, ${bg} 65%)`, alignItems: 'center', justifyContent: 'center', opacity: fade }}>
      <div style={{ transform: `translateY(${(1 - enter) * 60}px) scale(${0.96 + enter * 0.04})`, opacity: enter, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 30 }}>
        <div style={{ width: W, height: H + (phone ? 0 : 44), borderRadius: phone ? 64 : 18, overflow: 'hidden', background: '#0d1220',
          boxShadow: '0 40px 120px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.08)', padding: phone ? 14 : 0 }}>
          {phone ? null : (
            <div style={{ height: 44, display: 'flex', alignItems: 'center', gap: 9, padding: '0 18px', background: '#111827', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              {['#ff5f57', '#febc2e', '#28c840'].map((c) => <span key={c} style={{ width: 12, height: 12, borderRadius: 6, background: c }} />)}
              <span style={{ marginLeft: 18, fontFamily: font, fontSize: 18, color: muted }}>teckgrowth.com</span>
            </div>
          )}
          <div style={{ width: '100%', height: phone ? H - 28 : H, borderRadius: phone ? 52 : 0, overflow: 'hidden' }}>{media}</div>
        </div>
        {scene.caption ? <div style={{ fontFamily: font, color: ink, fontSize: vertical ? 54 : 46, fontWeight: 700, textAlign: 'center', maxWidth: vertical ? 900 : 1500 }}>{scene.caption}</div> : null}
      </div>
    </AbsoluteFill>
  );
};

const Outro: React.FC<{ cta: string }> = ({ cta }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: f, fps, config: { damping: 200 } });
  return (
    <AbsoluteFill style={{ background: bg, justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ fontFamily: font, color: ink, fontSize: 104, fontWeight: 800, letterSpacing: -2, opacity: s, transform: `scale(${0.92 + s * 0.08})` }}>{cta}</div>
      <div style={{ marginTop: 30, height: 10, width: 300 * s, borderRadius: 10, background: accent }} />
    </AbsoluteFill>
  );
};

export const Promo: React.FC<PromoProps> = ({ title, subtitle, cta, format, scenes }) => {
  const vertical = format === 'vertical';
  let at = HOOK;
  return (
    <AbsoluteFill style={{ background: bg }}>
      <Sequence durationInFrames={HOOK}><Hook title={title} subtitle={subtitle} vertical={vertical} /></Sequence>
      {scenes.map((s, i) => {
        const n = sceneFrames(s), from = at; at += n;
        return <Sequence key={s.file + i} from={from} durationInFrames={n}><Frame scene={s} frames={n} vertical={vertical} /></Sequence>;
      })}
      <Sequence from={at} durationInFrames={OUTRO}><Outro cta={cta} /></Sequence>
    </AbsoluteFill>
  );
};
