import { AbsoluteFill, Audio, staticFile, useVideoConfig } from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";

import { DARK } from "./brand";
import { Captions } from "./components/Captions";
import { SceneView } from "./components/SceneView";
import type { Edl, Scene } from "./edl";

export interface VideoProps extends Record<string, unknown> {
  edl: Edl;
}

function sceneSeconds(scene: Scene): number {
  return scene.shots.reduce((sum, shot) => sum + shot.duration, 0);
}

/** Music level: about -24 dB under the voice, -18 dB over the cards. The bed peaks at -6 dBFS. */
function musicGain(t: number, total: number, cardIn: number, cardOutStart: number): number {
  const under = Math.pow(10, -21 / 20);
  const cards = Math.pow(10, -15 / 20);
  let level = t < cardIn || t >= cardOutStart ? cards : under;
  // Smooth the step between card and under-voice levels over 1 s.
  if (t >= cardIn - 0.5 && t < cardIn + 0.5) {
    const p = (t - (cardIn - 0.5)) / 1;
    level = cards + (under - cards) * p;
  }
  if (t >= cardOutStart - 0.5 && t < cardOutStart + 0.5) {
    const p = (t - (cardOutStart - 0.5)) / 1;
    level = under + (cards - under) * p;
  }
  const fadeIn = Math.min(1, t / 2);
  const fadeOut = Math.min(1, Math.max(0, (total - t) / 3));
  return level * fadeIn * fadeOut;
}

export const Video: React.FC<VideoProps> = ({ edl }) => {
  const { fps } = useVideoConfig();
  const T = edl.transitionFrames;
  const scenes = edl.scenes;

  const children: React.ReactNode[] = [];
  scenes.forEach((scene, i) => {
    children.push(
      <TransitionSeries.Sequence key={`s${scene.number}`} durationInFrames={Math.round(sceneSeconds(scene) * fps)}>
        <SceneView scene={scene} titleCard={edl.titleCard} endCard={edl.endCard} />
      </TransitionSeries.Sequence>,
    );
    if (i < scenes.length - 1) {
      children.push(
        <TransitionSeries.Transition
          key={`t${scene.number}`}
          presentation={fade()}
          timing={linearTiming({ durationInFrames: T })}
        />,
      );
    }
  });

  const firstSceneEnd = sceneSeconds(scenes[0]);
  const lastScene = scenes[scenes.length - 1];
  const endCard = lastScene.shots[lastScene.shots.length - 1];
  const endCardStart = edl.totalDuration - endCard.duration;
  const titleCardEnd = scenes[0].shots[0].duration;

  return (
    <AbsoluteFill style={{ backgroundColor: DARK }}>
      <TransitionSeries>{children}</TransitionSeries>
      <Captions captions={edl.captions} />
      {edl.musicSrc !== null && (
        <Audio
          src={staticFile(edl.musicSrc)}
          volume={(f) => musicGain(f / fps, edl.totalDuration, titleCardEnd, endCardStart)}
        />
      )}
      <div style={{ display: "none" }}>{firstSceneEnd}</div>
    </AbsoluteFill>
  );
};
