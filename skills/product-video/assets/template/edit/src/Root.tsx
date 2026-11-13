import type { FC } from "react";
import { Composition } from "remotion";

import { FPS, HEIGHT, WIDTH } from "./brand";
import type { Edl } from "./edl";
import edlJson from "./edl.json";
import { TOTAL_FRAMES } from "./hype/grid";
import { Hype } from "./hype/Hype";
import { Video } from "./Video";

const edl = edlJson as Edl;

/** "Video" is the narrated tour built from edl.json; "Hype" is the silent cut on the beat grid. */
export const Root: FC = () => (
  <>
    <Composition
      id="Video"
      component={Video}
      durationInFrames={Math.max(1, Math.round(edl.totalDuration * FPS))}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
      defaultProps={{ edl }}
    />
    <Composition id="Hype" component={Hype} durationInFrames={TOTAL_FRAMES} fps={FPS} width={WIDTH} height={HEIGHT} />
  </>
);
