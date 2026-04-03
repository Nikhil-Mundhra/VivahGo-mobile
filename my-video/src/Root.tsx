import "./index.css";
import { Composition, getStaticFiles, staticFile } from "remotion";
import { AIVideo, aiVideoSchema } from "./components/AIVideo";
import {
  PlannerTutorialVideo,
  PlannerTutorialVideoProps,
} from "./components/PlannerTutorialVideo";
import {
  VendorTutorialVideo,
  VendorTutorialVideoProps,
} from "./components/VendorTutorialVideo";
import { FPS, INTRO_DURATION } from "./lib/constants";
import {
  defaultPlannerTutorialAudioManifest,
  PLANNER_TUTORIAL_AUDIO_MANIFEST,
  resolvePlannerTutorialManifest,
} from "./lib/plannerTutorial";
import {
  defaultVendorTutorialAudioManifest,
  resolveVendorTutorialManifest,
  VENDOR_TUTORIAL_AUDIO_MANIFEST,
} from "./lib/vendorTutorial";
import { getTimelinePath, loadTimelineFromFile } from "./lib/utils";

export const RemotionRoot: React.FC = () => {
  const staticFiles = getStaticFiles();
  const timelines = staticFiles
    .filter((file) => file.name.endsWith("timeline.json"))
    .map((file) => file.name.split("/")[1]);

  return (
    <>
      <Composition
        id="planner-app-tutorial"
        component={PlannerTutorialVideo}
        fps={FPS}
        width={1080}
        height={1920}
        durationInFrames={defaultPlannerTutorialAudioManifest.totalDurationInFrames}
        defaultProps={
          {
            audioManifest: defaultPlannerTutorialAudioManifest,
          } satisfies PlannerTutorialVideoProps
        }
        calculateMetadata={async ({ props, abortSignal }) => {
          const response = await fetch(staticFile(PLANNER_TUTORIAL_AUDIO_MANIFEST), {
            signal: abortSignal,
          }).catch(() => null);
          const manifestJson = response && response.ok ? await response.json() : null;
          const audioManifest = resolvePlannerTutorialManifest(
            manifestJson ?? props.audioManifest,
          );

          return {
            durationInFrames: audioManifest.totalDurationInFrames,
            props: {
              ...props,
              audioManifest,
            },
          };
        }}
      />

      <Composition
        id="vendor-portal-tutorial"
        component={VendorTutorialVideo}
        fps={FPS}
        width={1920}
        height={1080}
        durationInFrames={defaultVendorTutorialAudioManifest.totalDurationInFrames}
        defaultProps={
          {
            audioManifest: defaultVendorTutorialAudioManifest,
          } satisfies VendorTutorialVideoProps
        }
        calculateMetadata={async ({ props, abortSignal }) => {
          const response = await fetch(staticFile(VENDOR_TUTORIAL_AUDIO_MANIFEST), {
            signal: abortSignal,
          }).catch(() => null);
          const manifestJson = response && response.ok ? await response.json() : null;
          const audioManifest = resolveVendorTutorialManifest(
            manifestJson ?? props.audioManifest,
          );

          return {
            durationInFrames: audioManifest.totalDurationInFrames,
            props: {
              ...props,
              audioManifest,
            },
          };
        }}
      />

      {timelines.map((storyName) => (
        <Composition
          id={storyName}
          component={AIVideo}
          fps={FPS}
          width={1080}
          height={1920}
          schema={aiVideoSchema}
          defaultProps={{
            timeline: null,
          }}
          calculateMetadata={async ({ props }) => {
            const { lengthFrames, timeline } = await loadTimelineFromFile(
              getTimelinePath(storyName),
            );

            return {
              durationInFrames: lengthFrames + INTRO_DURATION,
              props: {
                ...props,
                timeline,
              },
            };
          }}
        />
      ))}
    </>
  );
};
