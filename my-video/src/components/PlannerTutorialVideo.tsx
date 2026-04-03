import { loadFont as loadHeadingFont } from "@remotion/google-fonts/BreeSerif";
import { loadFont as loadBodyFont } from "@remotion/google-fonts/Inter";
import { Audio } from "@remotion/media";
import type { Caption } from "@remotion/captions";
import {
  AbsoluteFill,
  Easing,
  Img,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {
  PlannerTutorialAudioManifest,
  PLANNER_TUTORIAL_BOOKEND_IMAGE,
  PLANNER_TUTORIAL_END_HOLD_FRAMES,
  PlannerTutorialCallout,
  plannerTutorialScenes,
  resolvePlannerTutorialManifest,
} from "../lib/plannerTutorial";

const { fontFamily: headingFontFamily } = loadHeadingFont("normal", {
  weights: ["400"],
  subsets: ["latin"],
});
const { fontFamily: bodyFontFamily } = loadBodyFont("normal", {
  weights: ["400", "700"],
  subsets: ["latin"],
  ignoreTooManyRequestsWarning: true,
});

export type PlannerTutorialVideoProps = {
  audioManifest?: PlannerTutorialAudioManifest | null;
};

const PHONE_WIDTH = 692;
const PHONE_HEIGHT = 1460;
const SHOWCASE_SIDE_GUTTER = 250;
const SHOWCASE_WIDTH = PHONE_WIDTH + SHOWCASE_SIDE_GUTTER * 2;
const CANVAS_WIDTH = 1080;
const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));
const BRAND_MAROON = "#7f1d1d";
const BRAND_MAROON_DEEP = "#551313";
const BRAND_GOLD = "#d8a93a";
const BRAND_IVORY = "#f6efe2";
const BRAND_INK = "#27181a";

const StoryBackdrop: React.FC = () => {
  const frame = useCurrentFrame();

  const driftA = interpolate(frame, [0, 240], [0, 70], {
    easing: Easing.inOut(Easing.sin),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const driftB = interpolate(frame, [0, 240], [0, -50], {
    easing: Easing.inOut(Easing.quad),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(135% 120% at 14% 0%, #f4ead8 0%, #ead8c3 34%, #c7906b 58%, #7f1d1d 100%)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          width: 720,
          height: 720,
          top: -180 + driftA,
          left: -140,
          borderRadius: 9999,
          background:
            "radial-gradient(circle, rgba(216,169,58,0.28) 0%, rgba(216,169,58,0) 72%)",
          filter: "blur(22px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 620,
          height: 620,
          right: -120,
          bottom: -180 + driftB,
          borderRadius: 9999,
          background:
            "radial-gradient(circle, rgba(191,107,67,0.3) 0%, rgba(191,107,67,0) 70%)",
          filter: "blur(24px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 980,
          height: 980,
          top: 420,
          left: "50%",
          transform: "translateX(-50%)",
          borderRadius: 9999,
          background:
            "radial-gradient(circle, rgba(246,239,226,0.34) 0%, rgba(246,239,226,0) 68%)",
          filter: "blur(30px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "linear-gradient(rgba(127,29,29,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(127,29,29,0.06) 1px, transparent 1px)",
          backgroundSize: "120px 120px",
          maskImage:
            "linear-gradient(to bottom, transparent 0%, rgba(255,255,255,0.8) 18%, rgba(255,255,255,0.8) 82%, transparent 100%)",
          opacity: 0.22,
        }}
      />
      <div
        style={{
          display: "none",
        }}
      />
    </AbsoluteFill>
  );
};

const PhoneShell: React.FC<{
  screenshot: string;
  accent: string;
  zoomStart: number;
  zoomEnd: number;
  panStartX: number;
  panEndX: number;
  panStartY: number;
  panEndY: number;
  focusX: number;
  focusY: number;
}> = ({
  screenshot,
  accent,
  zoomStart,
  zoomEnd,
  panStartX,
  panEndX,
  panStartY,
  panEndY,
  focusX,
  focusY,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enter = spring({
    frame,
    fps,
    durationInFrames: 28,
    config: {
      damping: 200,
      stiffness: 120,
    },
  });

  const phoneScale = interpolate(enter, [0, 1], [0.92, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const phoneRotate = interpolate(enter, [0, 1], [8, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const screenshotScale = interpolate(frame, [0, 180], [zoomStart, zoomEnd], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });
  const screenshotX = interpolate(frame, [0, 180], [panStartX, panEndX], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });
  const screenshotY = interpolate(frame, [0, 180], [panStartY, panEndY], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });

  return (
    <div
      style={{
        width: PHONE_WIDTH,
        height: PHONE_HEIGHT,
        borderRadius: 72,
        position: "relative",
        transform: `scale(${phoneScale}) rotate(${phoneRotate}deg)`,
        boxShadow: "0 42px 120px rgba(84, 31, 22, 0.26)",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: -34,
          borderRadius: 96,
          background: `radial-gradient(circle at 50% 12%, ${accent}32 0%, rgba(216,169,58,0.18) 28%, rgba(255,255,255,0) 72%)`,
          filter: "blur(28px)",
          opacity: 0.95,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: "50%",
          bottom: -52,
          width: 460,
          height: 66,
          transform: "translateX(-50%)",
          borderRadius: 9999,
          background: "rgba(85, 19, 19, 0.18)",
          filter: "blur(26px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: 72,
          background:
            "linear-gradient(160deg, rgba(246,239,226,0.9), rgba(246,239,226,0.3))",
          padding: 12,
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: 72,
            border: "1px solid rgba(127,29,29,0.12)",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 8,
            borderRadius: 64,
            background:
              "linear-gradient(180deg, rgba(39,24,26,0.96), rgba(68,21,21,0.94))",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 16,
              left: "50%",
              transform: "translateX(-50%)",
              width: 180,
              height: 34,
              borderRadius: 9999,
              background: "rgba(39,24,26,0.94)",
              zIndex: 4,
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: `linear-gradient(180deg, ${accent}26 0%, rgba(39,24,26,0) 18%)`,
              zIndex: 1,
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(110deg, rgba(246,239,226,0.22) 0%, rgba(246,239,226,0.04) 22%, rgba(246,239,226,0) 42%)",
              zIndex: 2,
              pointerEvents: "none",
            }}
          />
          <Img
            src={staticFile(screenshot)}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              transform: `translate(${screenshotX}px, ${screenshotY}px) scale(${screenshotScale})`,
              transformOrigin: `${focusX * 100}% ${focusY * 100}%`,
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(180deg, rgba(39,24,26,0.12) 0%, rgba(39,24,26,0) 28%, rgba(39,24,26,0) 76%, rgba(39,24,26,0.15) 100%)",
              zIndex: 3,
            }}
          />
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          inset: -2,
          borderRadius: 74,
          border: `1px solid ${accent}66`,
          opacity: 0.82,
        }}
      />
      <div
        style={{
          position: "absolute",
          right: -5,
          top: 290,
          width: 5,
          height: 140,
          borderTopRightRadius: 10,
          borderBottomRightRadius: 10,
          background: "rgba(127,29,29,0.18)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: -5,
          top: 236,
          width: 5,
          height: 92,
          borderTopLeftRadius: 10,
          borderBottomLeftRadius: 10,
          background: "rgba(127,29,29,0.18)",
        }}
      />
    </div>
  );
};

const getScreenshotTransform = (
  frame: number,
  zoomStart: number,
  zoomEnd: number,
  panStartX: number,
  panEndX: number,
  panStartY: number,
  panEndY: number,
) => {
  const screenshotScale = interpolate(frame, [0, 180], [zoomStart, zoomEnd], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });
  const screenshotX = interpolate(frame, [0, 180], [panStartX, panEndX], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });
  const screenshotY = interpolate(frame, [0, 180], [panStartY, panEndY], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });

  return {
    screenshotScale,
    screenshotX,
    screenshotY,
  };
};

const getTrackedPoint = (
  x: number,
  y: number,
  scale: number,
  translateX: number,
  translateY: number,
) => {
  return {
    x:
      SHOWCASE_SIDE_GUTTER +
      (x * PHONE_WIDTH - PHONE_WIDTH / 2) * scale +
      PHONE_WIDTH / 2 +
      translateX,
    y: y * PHONE_HEIGHT * scale + translateY,
  };
};

const Callout: React.FC<{
  callout: PlannerTutorialCallout;
  accent: string;
  index: number;
  total: number;
  durationInFrames: number;
  screenshotScale: number;
  screenshotX: number;
  screenshotY: number;
}> = ({
  callout,
  accent,
  index,
  total,
  durationInFrames,
  screenshotScale,
  screenshotX,
  screenshotY,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const anchor = getTrackedPoint(
    callout.x,
    callout.y,
    screenshotScale,
    screenshotX,
    screenshotY,
  );
  const panelWidth = Math.min(callout.width ?? 300, 236);
  const entryDelay = 12 + index * 9;
  const exitLead = 18 + (total - index - 1) * 5;
  const reveal = spring({
    frame: Math.max(frame - entryDelay, 0),
    fps,
    durationInFrames: 20,
    config: {
      damping: 200,
      stiffness: 120,
    },
  });
  const exit = interpolate(
    frame,
    [Math.max(durationInFrames - exitLead, 0), durationInFrames],
    [1, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.cubic),
    },
  );
  const opacity = reveal * exit;
  const side = callout.align === "right" ? "right" : "left";
  const outsideGap = 44;
  const bubbleLeft =
    side === "right"
      ? SHOWCASE_SIDE_GUTTER + PHONE_WIDTH + outsideGap
      : SHOWCASE_SIDE_GUTTER - panelWidth - outsideGap;
  const safeBubbleLeft = clamp(
    bubbleLeft,
    18,
    CANVAS_WIDTH - panelWidth - 18,
  );
  const bubbleTop = clamp(anchor.y + 112, 154, PHONE_HEIGHT - 116);
  const bubbleCenterY = bubbleTop + 50;
  const connectorStartX =
    side === "right" ? safeBubbleLeft : safeBubbleLeft + panelWidth;
  const connectorLength = Math.max(Math.abs(anchor.x - connectorStartX) - 18, 22);
  const connectorAngle =
    (Math.atan2(anchor.y - bubbleCenterY, anchor.x - connectorStartX) * 180) /
    Math.PI;
  const markerScale = interpolate(reveal, [0, 1], [0.72, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const xShift = interpolate(reveal, [0, 1], [side === "right" ? 18 : -18, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        opacity,
      }}
    >
      <div
        style={{
          position: "absolute",
          left: connectorStartX,
          top: bubbleCenterY,
          width: connectorLength,
          height: 3,
          borderRadius: 9999,
          background: accent,
          boxShadow: `0 0 18px ${accent}88`,
          transformOrigin: "0 50%",
          transform: `rotate(${connectorAngle}deg) scaleX(${reveal})`,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: anchor.x - 13,
          top: anchor.y - 13,
          width: 26,
          height: 26,
          borderRadius: 9999,
          border: `2px solid ${accent}`,
          background: `${BRAND_IVORY}cc`,
          boxShadow: `0 0 0 10px ${accent}22, 0 0 28px ${accent}55`,
          transform: `scale(${markerScale})`,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: safeBubbleLeft,
          top: bubbleTop,
          display: "inline-flex",
          alignItems: "flex-start",
          gap: 10,
          width: panelWidth,
          padding: "14px 18px",
          borderRadius: 22,
          background:
            "linear-gradient(180deg, rgba(246,239,226,0.96), rgba(242,231,213,0.92))",
          border: `1px solid ${accent}55`,
          color: BRAND_INK,
          fontSize: 22,
          lineHeight: 1.3,
          fontFamily: bodyFontFamily,
          boxShadow: "0 16px 42px rgba(85, 19, 19, 0.12)",
          transform: `translate(${xShift}px, ${interpolate(reveal, [0, 1], [18, 0])}px)`,
        }}
      >
        <span
          style={{
            width: 10,
            height: 10,
          borderRadius: 9999,
          background: accent,
            boxShadow: `0 0 16px ${accent}88`,
            flexShrink: 0,
            marginTop: 8,
          }}
          />
        <span
          style={{
            textWrap: "balance",
          }}
        >
          {callout.label}
        </span>
      </div>
    </div>
  );
};

const SubtitleChip: React.FC<{ captions: Caption[] }> = ({ captions }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentMs = (frame / fps) * 1000;
  const activeCaption =
    captions.find(
      (caption) => currentMs >= caption.startMs && currentMs < caption.endMs,
    ) ?? captions[captions.length - 1] ?? null;

  if (!activeCaption) {
    return null;
  }

  const enter = spring({
    frame: Math.max(frame - 4, 0),
    fps,
    durationInFrames: 14,
    config: {
      damping: 200,
      stiffness: 140,
    },
  });

  return (
    <div
      style={{
        position: "absolute",
        left: 28,
        right: 28,
        bottom: 72,
        display: "flex",
        justifyContent: "center",
        opacity: enter,
        transform: `translateY(${interpolate(enter, [0, 1], [18, 0])}px)`,
      }}
    >
      <div
        style={{
          width: "100%",
          padding: "20px 28px",
          borderRadius: 26,
          background:
            "linear-gradient(180deg, rgba(127,29,29,0.94), rgba(85,19,19,0.88))",
          border: `1px solid ${BRAND_GOLD}66`,
          color: BRAND_IVORY,
          textAlign: "center",
          fontFamily: bodyFontFamily,
          fontSize: 34,
          lineHeight: 1.3,
          boxShadow: "0 18px 54px rgba(85, 19, 19, 0.22)",
          backdropFilter: "blur(18px)",
        }}
      >
        {activeCaption.text}
      </div>
    </div>
  );
};

const SceneCard: React.FC<{
  eyebrow: string;
  headline: string;
  subtitle: string;
  accent: string;
  sceneIndex: number;
}> = ({ eyebrow, headline, subtitle, accent, sceneIndex }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const reveal = spring({
    frame,
    fps,
    durationInFrames: 22,
    config: {
      damping: 200,
      stiffness: 120,
    },
  });

  return (
    <div
      style={{
        width: "100%",
        borderRadius: 26,
        padding: "18px 24px 18px",
        background:
          "linear-gradient(180deg, rgba(246,239,226,0.97), rgba(242,231,213,0.92))",
        border: `1px solid ${accent}44`,
        boxShadow: "0 26px 70px rgba(85, 19, 19, 0.12)",
        opacity: reveal,
        transform: `translateY(${interpolate(reveal, [0, 1], [18, 0])}px)`,
        backdropFilter: "blur(18px)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 10,
        }}
      >
        <div
          style={{
            fontSize: 15,
            letterSpacing: 1.4,
            textTransform: "uppercase",
          color: accent,
          fontFamily: bodyFontFamily,
          fontWeight: 700,
        }}
        >
          {eyebrow}
        </div>
        <div
          style={{
            padding: "6px 10px",
            borderRadius: 9999,
            background: `${accent}18`,
            color: BRAND_MAROON,
            fontFamily: bodyFontFamily,
            fontSize: 14,
            fontWeight: 700,
          }}
        >
          {String(sceneIndex + 1).padStart(2, "0")} /{" "}
          {String(plannerTutorialScenes.length).padStart(2, "0")}
        </div>
      </div>
      <div
        style={{
          fontFamily: headingFontFamily,
          color: BRAND_MAROON_DEEP,
          fontSize: 28,
          lineHeight: 1.08,
          marginBottom: 8,
          textWrap: "balance",
        }}
      >
        {headline}
      </div>
      <div
        style={{
          fontFamily: bodyFontFamily,
          color: "#6b4a40",
          fontSize: 16,
          lineHeight: 1.35,
          textWrap: "pretty",
        }}
      >
        {subtitle}
      </div>
      <div
        style={{
          marginTop: 16,
          height: 5,
          borderRadius: 9999,
          overflow: "hidden",
          background: "rgba(127,29,29,0.08)",
        }}
      >
        <div
          style={{
            width: `${((sceneIndex + 1) / plannerTutorialScenes.length) * 100}%`,
            height: "100%",
            borderRadius: 9999,
            background: `linear-gradient(90deg, ${accent}, rgba(255,255,255,0.92))`,
            boxShadow: `0 0 24px ${accent}`,
          }}
        />
      </div>
    </div>
  );
};

const BookendCard: React.FC<{ mode: "start" | "end"; frame: number }> = ({
  mode,
  frame,
}) => {
  const { fps } = useVideoConfig();
  const normalizedFrame =
    mode === "start" ? frame + 8 : frame + PLANNER_TUTORIAL_END_HOLD_FRAMES;
  const reveal = spring({
    frame: normalizedFrame,
    fps,
    durationInFrames: mode === "start" ? 8 : 14,
    config: {
      damping: 200,
      stiffness: 120,
    },
  });
  const scale = interpolate(
    reveal,
    [0, 1],
    mode === "start" ? [1.14, 1] : [0.8, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    },
  );
  const opacity = interpolate(reveal, [0, 1], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        alignItems: "center",
        justifyContent: "center",
        zIndex: 20,
        pointerEvents: "none",
        opacity,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: mode === "start" ? 22 : 26,
          borderRadius: 46,
          background:
            "linear-gradient(180deg, rgba(246,239,226,0.92), rgba(246,239,226,0.72))",
          border: "2px solid rgba(216,169,58,0.55)",
          boxShadow:
            "0 28px 70px rgba(85, 19, 19, 0.2), inset 0 0 0 1px rgba(255,255,255,0.55)",
          transform: `scale(${scale})`,
        }}
      >
        <Img
          src={staticFile(PLANNER_TUTORIAL_BOOKEND_IMAGE)}
          style={{
            width: mode === "start" ? 760 : 920,
            height: "auto",
            objectFit: "contain",
            borderRadius: 28,
            boxShadow:
              "0 20px 44px rgba(85, 19, 19, 0.16), 0 0 0 3px rgba(246,239,226,0.92)",
          }}
        />
      </div>
    </AbsoluteFill>
  );
};

const TutorialScene: React.FC<{
  sceneIndex: number;
  durationInFrames: number;
  captions: Caption[];
}> = ({ sceneIndex, durationInFrames, captions }) => {
  const frame = useCurrentFrame();
  const scene = plannerTutorialScenes[sceneIndex];
  const primaryFocus = scene.callouts[0] ?? { x: 0.5, y: 0.32 };
  const screenshotTransform = getScreenshotTransform(
    frame,
    scene.zoomStart,
    scene.zoomEnd,
    scene.panStartX,
    scene.panEndX,
    scene.panStartY,
    scene.panEndY,
  );

  const fadeIn = interpolate(frame, [0, 10], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const fadeOut = interpolate(
    frame,
    [Math.max(durationInFrames - 10, 0), durationInFrames],
    [1, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    },
  );

  return (
    <AbsoluteFill style={{ opacity: fadeIn * fadeOut }}>
      <AbsoluteFill style={{ padding: "92px 62px 140px" }}>
        <div
          style={{
            position: "relative",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            paddingTop: 0,
            paddingBottom: 300,
          }}
        >
          <div
            style={{
              position: "relative",
              width: SHOWCASE_WIDTH,
              height: PHONE_HEIGHT,
              overflow: "visible",
            }}
          >
            <div
              style={{
                position: "absolute",
                left: SHOWCASE_SIDE_GUTTER,
                top: 0,
              }}
            >
              <PhoneShell
                screenshot={scene.screenshot}
                accent={scene.accent}
                zoomStart={scene.zoomStart}
                zoomEnd={scene.zoomEnd}
                panStartX={scene.panStartX}
                panEndX={scene.panEndX}
                panStartY={scene.panStartY}
                panEndY={scene.panEndY}
                focusX={primaryFocus.x}
                focusY={primaryFocus.y}
              />
            </div>
            {scene.callouts.map((callout, index) => (
              <Callout
                key={callout.label}
                callout={callout}
                accent={scene.accent}
                index={index}
                total={scene.callouts.length}
                durationInFrames={durationInFrames}
                screenshotScale={screenshotTransform.screenshotScale}
                screenshotX={screenshotTransform.screenshotX}
                screenshotY={screenshotTransform.screenshotY}
              />
            ))}
          </div>
        </div>
        <div
          style={{
            position: "absolute",
            left: 24,
            right: 24,
            bottom: 210,
            display: "flex",
            justifyContent: "center",
            zIndex: 7,
          }}
        >
          <SceneCard
            eyebrow={scene.eyebrow}
            headline={scene.headline}
            subtitle={scene.subtitle}
            accent={scene.accent}
            sceneIndex={sceneIndex}
          />
        </div>
      </AbsoluteFill>

      <SubtitleChip captions={captions} />
    </AbsoluteFill>
  );
};

export const PlannerTutorialVideo: React.FC<PlannerTutorialVideoProps> = ({
  audioManifest,
}) => {
  const resolvedAudioManifest = resolvePlannerTutorialManifest(audioManifest);
  const { fps, durationInFrames } = useVideoConfig();
  const frame = useCurrentFrame();
  const outroStart = durationInFrames - (PLANNER_TUTORIAL_END_HOLD_FRAMES + 2);
  const contentOpacity = interpolate(
    frame,
    [outroStart, durationInFrames - 1],
    [1, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    },
  );
  const fadeOutStart = Math.max(durationInFrames - PLANNER_TUTORIAL_END_HOLD_FRAMES - 14, 0);

  return (
    <AbsoluteFill>
      <StoryBackdrop />

      {resolvedAudioManifest.backgroundMusicFile ? (
        <Audio
          src={staticFile(resolvedAudioManifest.backgroundMusicFile)}
          volume={(frame) => {
            const fadeInVolume = interpolate(frame, [0, fps * 2], [0, 0.24], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            const fadeOutVolume = interpolate(
              frame,
              [fadeOutStart, durationInFrames],
              [0.24, 0],
              {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              },
            );

            return Math.min(fadeInVolume, fadeOutVolume);
          }}
        />
      ) : null}

      <AbsoluteFill style={{ opacity: contentOpacity }}>
        {plannerTutorialScenes.map((scene, index) => {
        const sceneAudio = resolvedAudioManifest.scenes[index];
        const sceneStart = resolvedAudioManifest.scenes
          .slice(0, index)
          .reduce((sum, item) => sum + item.durationInFrames, 0);

        return (
          <Sequence
            key={scene.id}
            from={sceneStart}
            durationInFrames={sceneAudio.durationInFrames}
          >
            <TutorialScene
              sceneIndex={index}
              durationInFrames={sceneAudio.durationInFrames}
              captions={sceneAudio.captions}
            />
            {sceneAudio.audioFile ? (
              <Audio src={staticFile(sceneAudio.audioFile)} volume={1} />
            ) : null}
          </Sequence>
        );
      })}
      </AbsoluteFill>

      {frame < 2 ? <BookendCard mode="start" frame={frame} /> : null}
      {frame >= outroStart ? (
        <BookendCard mode="end" frame={frame - outroStart} />
      ) : null}
    </AbsoluteFill>
  );
};
