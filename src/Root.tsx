import React from 'react';
import { Composition } from 'remotion';
import { Promo, promoLength, type PromoProps } from './Promo';

const sample: PromoProps = {
  title: 'Day 8 of building TeckGrowth',
  cta: 'teckgrowth.com',
  scenes: [{ file: 'shots/scene-0.png', caption: 'Type one sentence' }],
};

export const Root: React.FC = () => (
  <>
    <Composition
      id="Promo"
      component={Promo}
      width={1080}
      height={1920}
      fps={30}
      durationInFrames={promoLength(sample.scenes.length)}
      defaultProps={sample}
      calculateMetadata={({ props }) => ({ durationInFrames: promoLength(props.scenes.length) })}
    />
  </>
);
