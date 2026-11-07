import React from 'react';
import { AbsoluteFill, Img, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig, Easing } from 'remotion';

export type Scene = { file: string; caption: string };
export type PromoProps = { title: string; cta: string; scenes: Scene[] };

const HOOK = 50;          // frames for the opening line
const PER = 105;          // frames each screenshot stays
const OUTRO = 75;         // frames for the end card
export const promoLength = (n: number) => HOOK + Math.max(1, n) * PER + OUTRO;

const ink = '#f4f6fb';
const bg = '#05070f';
const accent = '#7c5cff';
const font = 'Inter, "Helvetica Neue", Arial, sans-serif';

const Hook: React.FC<{ text: string }> = ({ text }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: f, fps, config: { damping: 200 } });
  return (
    <AbsoluteFill style={{ background: bg, justifyContent: 'center', padding: 90 }}>
      <div style={{ fontFamily: font, color: ink, fontSize: 96, fontWeight: 800, lineHeight: 1.05, letterSpacing: -2,
        opacity: s, transform: `translateY(${(1 - s) * 40}px)` }}>{text}</div>
    </AbsoluteFill>
  );
};

const Shot: React.FC<{ scene: Scene }> = ({ scene }) => {
  const f = useCurrentFrame();
  const zoom = interpolate(f, [0, PER], [1.0, 1.08], { easing: Easing.inOut(Easing.cubic), extrapolateRight: 'clamp' });
  const fade = interpolate(f, [0, 10, PER - 10, PER], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const cap = interpolate(f, [8, 22], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ background: bg, opacity: fade }}>
      <AbsoluteFill style={{ transform: `scale(${zoom})` }}>
        <Img src={staticFile(scene.file)} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top center' }} />
      </AbsoluteFill>
      {scene.caption ? (
        <div style={{ position: 'absolute', left: 60, right: 60, bottom: 260, opacity: cap, transform: `translateY(${(1 - cap) * 20}px)`,
          background: 'rgba(5,7,15,0.82)', borderRadius: 28, padding: '30px 38px', fontFamily: font, color: ink, fontSize: 56, fontWeight: 700, lineHeight: 1.15 }}>
          {scene.caption}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

const Outro: React.FC<{ cta: string }> = ({ cta }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: f, fps, config: { damping: 200 } });
  return (
    <AbsoluteFill style={{ background: bg, justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ fontFamily: font, color: ink, fontSize: 84, fontWeight: 800, opacity: s, transform: `scale(${0.9 + s * 0.1})` }}>{cta}</div>
      <div style={{ marginTop: 28, height: 10, width: 260 * s, borderRadius: 10, background: accent }} />
    </AbsoluteFill>
  );
};

export const Promo: React.FC<PromoProps> = ({ title, cta, scenes }) => (
  <AbsoluteFill style={{ background: bg }}>
    <Sequence durationInFrames={HOOK}><Hook text={title} /></Sequence>
    {scenes.map((s, i) => (
      <Sequence key={s.file + i} from={HOOK + i * PER} durationInFrames={PER}><Shot scene={s} /></Sequence>
    ))}
    <Sequence from={HOOK + scenes.length * PER} durationInFrames={OUTRO}><Outro cta={cta} /></Sequence>
  </AbsoluteFill>
);
