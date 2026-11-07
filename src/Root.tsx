import React from 'react';
import { Composition } from 'remotion';
import { Promo, promoLength, type PromoProps } from './Promo';

const sample: PromoProps = {
  title: 'Create anything you can imagine',
  subtitle: 'Real, working web apps from one sentence',
  cta: 'teckgrowth.com',
  format: 'landscape',
  scenes: [{ file: 'shots/scene-0.png', caption: 'Type one sentence' }],
};

// Landscape 1920 by 1080 for YouTube, X and ads by default, vertical 1080 by 1920 when the job asks for it.
export const Root: React.FC = () => (
  <Composition
    id="Promo"
    component={Promo}
    width={1920}
    height={1080}
    fps={30}
    durationInFrames={promoLength(sample.scenes)}
    defaultProps={sample}
    calculateMetadata={({ props }) => ({
      durationInFrames: promoLength(props.scenes),
      ...(props.format === 'vertical' ? { width: 1080, height: 1920 } : { width: 1920, height: 1080 }),
    })}
  />
);
