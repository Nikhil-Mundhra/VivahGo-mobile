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
  defaultVendorTutorialAudioManifest,
  type VendorTutorialAudioManifest,
  type VendorTutorialCallout,
  resolveVendorTutorialManifest,
  vendorTutorialScenes,
  VENDOR_TUTORIAL_BOOKEND_IMAGE,
  VENDOR_TUTORIAL_END_HOLD_FRAMES,
} from "../lib/vendorTutorial";

const { fontFamily: headingFontFamily } = loadHeadingFont("normal", {
  weights: ["400"],
  subsets: ["latin"],
});
const { fontFamily: bodyFontFamily } = loadBodyFont("normal", {
  weights: ["400", "700"],
  subsets: ["latin"],
  ignoreTooManyRequestsWarning: true,
});

export type VendorTutorialVideoProps = {
  audioManifest?: VendorTutorialAudioManifest | null;
};

const CANVAS_WIDTH = 1920;
const BROWSER_WIDTH = 1465;
const BROWSER_HEIGHT = 900;
const CONTENT_TOP = 56;
const BROWSER_LEFT = -160;
const BROWSER_TOP = CONTENT_TOP;
const INFO_PANEL_WIDTH = 330;
const SHOWCASE_LEFT = -120;
const SHOWCASE_WIDTH = CANVAS_WIDTH - 108;
const RIGHT_CALLOUT_LEFT = 1328 - SHOWCASE_LEFT;
const RIGHT_CALLOUT_MAX_WIDTH = 220;
const RIGHT_CALLOUT_START_TOP = 560;
const RIGHT_CALLOUT_STACK_GAP = 54;
const RIGHT_CALLOUT_SLOT_HEIGHT = 208;
const CALLOUT_SIDE_MARGIN = 32;
const CALLOUT_TOP_MARGIN = 26;
const CALLOUT_BOTTOM_MARGIN = 26;
const CALLOUT_HEIGHT = 94;
const SUBTITLE_RESERVED_HEIGHT = 214;
const CALLOUT_MIN_TOP = CALLOUT_TOP_MARGIN;
const CALLOUT_MAX_TOP = BROWSER_HEIGHT - CALLOUT_HEIGHT - CALLOUT_BOTTOM_MARGIN;
const SCENE_CALLOUT_MAX_TOP = 1080 - CONTENT_TOP - SUBTITLE_RESERVED_HEIGHT;
const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));
const estimateCalloutHeight = (label: string) => {
  const textLines = Math.max(1, Math.ceil(label.length / 18));
  return Math.max(CALLOUT_HEIGHT, 30 + textLines * 34);
};
const BRAND_IVORY = "#f6efe2";
const BRAND_MAROON_DEEP = "#551313";
const BRAND_INK = "#2b1b1b";
const BRAND_GOLD = "#d8a93a";

const StoryBackdrop: React.FC = () => {
  const frame = useCurrentFrame();
  const driftA = interpolate(frame, [0, 240], [0, 40], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.sin),
  });
  const driftB = interpolate(frame, [0, 240], [0, -40], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });

  return (
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(140% 120% at 12% 0%, #f7eddc 0%, #e8d4bd 32%, #c88e67 62%, #7a231a 100%)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          width: 840,
          height: 840,
          top: -220 + driftA,
          left: -150,
          borderRadius: 9999,
          background:
            "radial-gradient(circle, rgba(216,169,58,0.26) 0%, rgba(216,169,58,0) 72%)",
          filter: "blur(24px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 760,
          height: 760,
          right: -160,
          bottom: -230 + driftB,
          borderRadius: 9999,
          background:
            "radial-gradient(circle, rgba(191,107,67,0.26) 0%, rgba(191,107,67,0) 70%)",
          filter: "blur(30px)",
        }}
      />
    </AbsoluteFill>
  );
};

const getBrowserTransform = (
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

const BrowserShell: React.FC<{
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
    durationInFrames: 24,
    config: { damping: 200, stiffness: 120 },
  });
  const browserScale = interpolate(enter, [0, 1], [0.95, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const browserY = interpolate(enter, [0, 1], [30, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const { screenshotScale, screenshotX, screenshotY } = getBrowserTransform(
    frame,
    zoomStart,
    zoomEnd,
    panStartX,
    panEndX,
    panStartY,
    panEndY,
  );

  return (
    <div
      style={{
        width: BROWSER_WIDTH,
        height: BROWSER_HEIGHT,
        borderRadius: 28,
        overflow: "hidden",
        position: "relative",
        transform: `translateY(${browserY}px) scale(${browserScale})`,
        boxShadow: "0 34px 90px rgba(85, 19, 19, 0.22)",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: -28,
          borderRadius: 42,
          background: `radial-gradient(circle at 50% 0%, ${accent}20 0%, rgba(255,255,255,0) 74%)`,
          filter: "blur(24px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: 28,
          background: "linear-gradient(180deg, rgba(255,255,255,0.82), rgba(255,255,255,0.42))",
          padding: 2,
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: 28,
            border: "1px solid rgba(127,29,29,0.12)",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 2,
            borderRadius: 26,
            background: "rgba(255,255,255,0.95)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: 54,
              background: "linear-gradient(180deg, #fdf7ef, #f5eadc)",
              borderBottom: "1px solid rgba(127,29,29,0.12)",
              display: "flex",
              alignItems: "center",
              padding: "0 18px",
              gap: 12,
            }}
          >
            <div style={{ display: "flex", gap: 8 }}>
              {["#ef4444", "#f59e0b", "#10b981"].map((color) => (
                <div
                  key={color}
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: 9999,
                    background: color,
                    opacity: 0.8,
                  }}
                />
              ))}
            </div>
            <div
              style={{
                flex: 1,
                height: 34,
                borderRadius: 9999,
                background: "rgba(127,29,29,0.06)",
                border: `1px solid ${accent}33`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#7b5b4d",
                fontFamily: bodyFontFamily,
                fontSize: 16,
                fontWeight: 700,
              }}
            >
              vivahgo.com/vendor
            </div>
          </div>
          <div
            style={{
              position: "absolute",
              inset: "54px 0 0 0",
              overflow: "hidden",
              background: "#fff",
            }}
          >
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
          </div>
        </div>
      </div>
    </div>
  );
};

const getTrackedPoint = (
  x: number,
  y: number,
  scale: number,
  translateX: number,
  translateY: number,
) => {
  const safeX = clamp(x, 0.04, 0.96);
  const safeY = clamp(y, 0.06, 0.94);

  return {
    x:
      BROWSER_LEFT - SHOWCASE_LEFT +
      (safeX * BROWSER_WIDTH - BROWSER_WIDTH / 2) * scale +
      BROWSER_WIDTH / 2 +
      translateX,
    y: safeY * BROWSER_HEIGHT * scale + translateY,
  };
};

const Callout: React.FC<{
  callout: VendorTutorialCallout;
  accent: string;
  index: number;
  total: number;
  durationInFrames: number;
  screenshotScale: number;
  screenshotX: number;
  screenshotY: number;
  stackTop: number;
}> = ({
  callout,
  accent,
  index,
  total,
  durationInFrames,
  screenshotScale,
  screenshotX,
  screenshotY,
  stackTop,
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
  const entryDelay = 12 + index * 8;
  const exitLead = 18 + (total - index - 1) * 4;
  const reveal = spring({
    frame: Math.max(frame - entryDelay, 0),
    fps,
    durationInFrames: 18,
    config: { damping: 200, stiffness: 120 },
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
  const side = "right";
  const panelWidth = Math.min(callout.width ?? 300, RIGHT_CALLOUT_MAX_WIDTH);
  const preferredBubbleLeft = RIGHT_CALLOUT_LEFT;
  const minBubbleLeft = CALLOUT_SIDE_MARGIN - SHOWCASE_LEFT;
  const maxBubbleLeft =
    CANVAS_WIDTH - CALLOUT_SIDE_MARGIN - panelWidth - SHOWCASE_LEFT;
  const safeBubbleLeft = clamp(
    preferredBubbleLeft,
    minBubbleLeft,
    maxBubbleLeft,
  );
  const bubbleHeight = estimateCalloutHeight(callout.label);
  const slottedTop =
    RIGHT_CALLOUT_START_TOP + index * RIGHT_CALLOUT_SLOT_HEIGHT;
  const stackedTop = Math.max(stackTop, slottedTop);
  const preferredBelowTop = Math.max(anchor.y + 64, stackedTop);
  const preferredAboveTop = Math.max(anchor.y - bubbleHeight - 64, stackedTop);
  const bubbleTop = clamp(
    preferredBelowTop <= BROWSER_HEIGHT - bubbleHeight - CALLOUT_BOTTOM_MARGIN
      ? preferredBelowTop
      : preferredAboveTop,
    CALLOUT_MIN_TOP,
    Math.min(CALLOUT_MAX_TOP + 220, SCENE_CALLOUT_MAX_TOP - bubbleHeight),
  );
  const bubbleCenterY = bubbleTop + bubbleHeight / 2;
  const connectorStartX =
    side === "right" ? safeBubbleLeft : safeBubbleLeft + panelWidth;
  const connectorLength = Math.max(
    Math.abs(anchor.x - connectorStartX) - 18,
    26,
  );
  const connectorAngle =
    (Math.atan2(anchor.y - bubbleCenterY, anchor.x - connectorStartX) * 180) /
    Math.PI;

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
          left: safeBubbleLeft,
          top: bubbleTop,
          display: "inline-flex",
          alignItems: "flex-start",
          gap: 10,
          width: panelWidth,
          minHeight: bubbleHeight,
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
          transform: `translateY(${interpolate(reveal, [0, 1], [18, 0])}px)`,
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
        <span style={{ textWrap: "balance" }}>{callout.label}</span>
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

  return (
    <div
      style={{
        position: "absolute",
        left: 36,
        right: 36,
        bottom: 30,
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: "100%",
          padding: "20px 28px",
          borderRadius: 26,
          background:
            "linear-gradient(180deg, rgba(127,29,29,0.94), rgba(85,19,19,0.9))",
          border: `1px solid ${BRAND_GOLD}66`,
          color: BRAND_IVORY,
          textAlign: "center",
          fontFamily: bodyFontFamily,
          fontSize: 30,
          lineHeight: 1.25,
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
    durationInFrames: 20,
    config: { damping: 200, stiffness: 120 },
  });

  return (
    <div
      style={{
        width: INFO_PANEL_WIDTH,
        borderRadius: 28,
        padding: "24px 26px",
        background:
          "linear-gradient(180deg, rgba(246,239,226,0.97), rgba(242,231,213,0.92))",
        border: `1px solid ${accent}44`,
        boxShadow: "0 26px 70px rgba(85, 19, 19, 0.12)",
        opacity: reveal,
        transform: `translateY(${interpolate(reveal, [0, 1], [18, 0])}px)`,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 8,
        }}
      >
        <div
          style={{
            fontSize: 15,
            letterSpacing: 1.2,
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
            color: BRAND_MAROON_DEEP,
            fontFamily: bodyFontFamily,
            fontSize: 14,
            fontWeight: 700,
          }}
        >
          {String(sceneIndex + 1).padStart(2, "0")} /{" "}
          {String(vendorTutorialScenes.length).padStart(2, "0")}
        </div>
      </div>
      <div
        style={{
          fontFamily: headingFontFamily,
          color: BRAND_MAROON_DEEP,
          fontSize: 34,
          lineHeight: 1.08,
          marginBottom: 10,
        }}
      >
        {headline}
      </div>
      <div
        style={{
          fontFamily: bodyFontFamily,
          color: "#6b4a40",
          fontSize: 20,
          lineHeight: 1.42,
        }}
      >
        {subtitle}
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
    mode === "start" ? frame + 8 : frame + VENDOR_TUTORIAL_END_HOLD_FRAMES;
  const reveal = spring({
    frame: normalizedFrame,
    fps,
    durationInFrames: mode === "start" ? 8 : 14,
    config: { damping: 200, stiffness: 120 },
  });

  return (
    <AbsoluteFill
      style={{
        alignItems: "center",
        justifyContent: "center",
        zIndex: 20,
        pointerEvents: "none",
        opacity: interpolate(reveal, [0, 1], [0, 1]),
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: mode === "start" ? 22 : 28,
          borderRadius: 46,
          background:
            "linear-gradient(180deg, rgba(246,239,226,0.92), rgba(246,239,226,0.72))",
          border: "2px solid rgba(216,169,58,0.55)",
          boxShadow:
            "0 28px 70px rgba(85, 19, 19, 0.2), inset 0 0 0 1px rgba(255,255,255,0.55)",
          transform: `scale(${interpolate(reveal, [0, 1], mode === "start" ? [1.14, 1] : [0.82, 1])})`,
        }}
      >
        <Img
          src={staticFile(VENDOR_TUTORIAL_BOOKEND_IMAGE)}
          style={{
            width: mode === "start" ? 820 : 980,
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

const VendorScene: React.FC<{
  sceneIndex: number;
  durationInFrames: number;
  captions: Caption[];
}> = ({ sceneIndex, durationInFrames, captions }) => {
  const frame = useCurrentFrame();
  const scene = vendorTutorialScenes[sceneIndex];
  const primaryFocus = scene.callouts[0] ?? { x: 0.5, y: 0.32 };
  const screenshotTransform = getBrowserTransform(
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
      <AbsoluteFill style={{ padding: "32px 72px 140px" }}>
        <div
          style={{
            position: "relative",
            height: "100%",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "flex-start",
            paddingTop: 10,
            paddingBottom: 160,
          }}
        >
          <div
            style={{
              position: "relative",
              width: SHOWCASE_WIDTH,
              height: BROWSER_HEIGHT,
              overflow: "visible",
            }}
          >
            <div
              style={{
                position: "absolute",
                left: BROWSER_LEFT - SHOWCASE_LEFT,
                top: BROWSER_TOP - CONTENT_TOP,
              }}
            >
              <BrowserShell
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
                stackTop={
                  RIGHT_CALLOUT_START_TOP +
                  scene.callouts
                    .slice(0, index)
                    .reduce(
                      (sum, item) =>
                        sum +
                        estimateCalloutHeight(item.label) +
                        RIGHT_CALLOUT_STACK_GAP,
                      0,
                    )
                }
              />
            ))}
          </div>
          <div
            style={{
              position: "absolute",
              left: BROWSER_WIDTH,
              top: 10,
              width: INFO_PANEL_WIDTH,
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
        </div>
      </AbsoluteFill>
      <SubtitleChip captions={captions} />
    </AbsoluteFill>
  );
};

export const VendorTutorialVideo: React.FC<VendorTutorialVideoProps> = ({
  audioManifest = defaultVendorTutorialAudioManifest,
}) => {
  const resolvedAudioManifest = resolveVendorTutorialManifest(audioManifest);
  const { fps, durationInFrames } = useVideoConfig();
  const frame = useCurrentFrame();
  const outroStart = durationInFrames - (VENDOR_TUTORIAL_END_HOLD_FRAMES + 2);
  const contentOpacity = interpolate(
    frame,
    [outroStart, durationInFrames - 1],
    [1, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    },
  );
  const fadeOutStart = Math.max(
    durationInFrames - VENDOR_TUTORIAL_END_HOLD_FRAMES - 14,
    0,
  );

  return (
    <AbsoluteFill>
      <StoryBackdrop />

      {resolvedAudioManifest.backgroundMusicFile ? (
        <Audio
          src={staticFile(resolvedAudioManifest.backgroundMusicFile)}
          volume={(currentFrame) => {
            const fadeInVolume = interpolate(
              currentFrame,
              [0, fps * 2],
              [0, 0.16],
              {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              },
            );
            const fadeOutVolume = interpolate(
              currentFrame,
              [fadeOutStart, durationInFrames],
              [0.16, 0],
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
        {vendorTutorialScenes.map((scene, index) => {
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
              <VendorScene
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
