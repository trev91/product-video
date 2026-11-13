import type { FC } from "react";
import { AbsoluteFill, Sequence } from "remotion";

import { bar, TOTAL_BARS } from "./grid";
import { BrowserAct, ColdOpen, Outro, PhoneAct } from "./Scenes";
import { INK, Stage } from "./Stage";

type Scene = { name: string; fromBar: number; bars: number; component: FC };

/**
 * The whole cut, on bar lines: hard cuts land on a bar, words land on beats.
 * Keep the table contiguous and ending on TOTAL_BARS (grid.ts); the cue sheet
 * for whoever adds the music is this table with times.
 */
export const SCENES: Scene[] = [
  { name: "Cold open", fromBar: 1, bars: 2, component: ColdOpen },
  { name: "The app", fromBar: 3, bars: 5, component: PhoneAct },
  { name: "The web app", fromBar: 8, bars: 4, component: BrowserAct },
  { name: "Outro", fromBar: 12, bars: TOTAL_BARS - 11, component: Outro },
];

export const Hype: FC = () => (
  <AbsoluteFill style={{ backgroundColor: INK }}>
    <Stage />
    {SCENES.map(({ name, fromBar, bars, component: SceneComponent }) => (
      <Sequence key={name} name={name} from={bar(fromBar)} durationInFrames={bar(fromBar + bars) - bar(fromBar)}>
        <SceneComponent />
      </Sequence>
    ))}
  </AbsoluteFill>
);
