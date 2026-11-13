import { Audio, Sequence, Series, staticFile, useVideoConfig } from "remotion";

import type { CardText, EndCardText, Scene } from "../edl";
import { EndCard } from "./EndCard";
import { LowerThird } from "./LowerThird";
import { ShotView } from "./ShotView";
import { TitleCard } from "./TitleCard";

interface SceneViewProps {
  scene: Scene;
  titleCard: CardText;
  endCard: EndCardText;
}

/** A scene: its shots back to back (straight cuts), each shot's voice, and the lower third at the start of scenes 2 to 11. */
export const SceneView: React.FC<SceneViewProps> = ({ scene, titleCard, endCard }) => {
  const { fps } = useVideoConfig();
  return (
    <>
      <Series>
        {scene.shots.map((shot) => {
          const frames = Math.round(shot.duration * fps);
          return (
            <Series.Sequence key={shot.id} durationInFrames={frames} name={`shot ${shot.id}`}>
              {shot.kind === "title" ? (
                <TitleCard heading={titleCard.heading} subline={titleCard.subline} />
              ) : shot.kind === "end" ? (
                <EndCard durationInFrames={frames} heading={endCard.heading} subline={endCard.subline} contactLine={endCard.contactLine} />
              ) : (
                <ShotView shot={shot} />
              )}
              {shot.voSrc !== null && (
                <Sequence from={Math.round(shot.voLead * fps)} name={`vo ${shot.id}`}>
                  <Audio src={staticFile(shot.voSrc)} />
                </Sequence>
              )}
            </Series.Sequence>
          );
        })}
      </Series>
      {scene.number >= 2 && (
        <Sequence from={0} durationInFrames={Math.round(3.2 * fps)} name="lower third">
          <LowerThird title={scene.title} subtitle={scene.subtitle} />
        </Sequence>
      )}
    </>
  );
};
