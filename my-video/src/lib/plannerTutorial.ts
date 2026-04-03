import type { Caption } from "@remotion/captions";

export const PLANNER_TUTORIAL_FPS = 30;
export const PLANNER_TUTORIAL_AUDIO_MANIFEST = "tutorial/planner-tutorial-audio.json";
export const PLANNER_TUTORIAL_BACKGROUND_AUDIO = "tutorial/audio/background-bed.wav";
export const PLANNER_TUTORIAL_BOOKEND_IMAGE = "tutorial/thumbnail.png";
export const PLANNER_TUTORIAL_END_HOLD_FRAMES = 10;

export type PlannerTutorialCallout = {
  label: string;
  x: number;
  y: number;
  width?: number;
  align?: "left" | "right";
};

export type PlannerTutorialScene = {
  id: string;
  eyebrow: string;
  headline: string;
  subtitle: string;
  voiceoverText: string;
  hindiVoiceoverText?: string;
  screenshot: string;
  accent: string;
  fallbackDurationInFrames: number;
  zoomStart: number;
  zoomEnd: number;
  panStartX: number;
  panEndX: number;
  panStartY: number;
  panEndY: number;
  callouts: PlannerTutorialCallout[];
};

export type PlannerTutorialAudioScene = {
  sceneId: string;
  audioFile: string;
  durationInFrames: number;
  captions: Caption[];
};

export type PlannerTutorialAudioManifest = {
  fps: number;
  backgroundMusicFile: string;
  totalDurationInFrames: number;
  generatedWith: string;
  scenes: PlannerTutorialAudioScene[];
};

export const plannerTutorialScenes: PlannerTutorialScene[] = [
  {
    id: "intro",
    eyebrow: "Wedding planning, minus the chaos",
    headline: "One place for your full shaadi plan.",
    subtitle: "Countdown, guests, budget, tasks.",
    voiceoverText:
      "Wedding planning can get messy fast with spreadsheets and scattered WhatsApp chats. VivahGo brings your full wedding plan into one clean, phone first workspace.",
    hindiVoiceoverText:
      "शादी की प्लानिंग जब अलग-अलग जगह बिखर जाती है, तभी chaos शुरू होता है। VivahGo इसे एक ही phone-first workspace में समेट देता है।",
    screenshot: "tutorial/screens/dashboard.png",
    accent: "#f97316",
    fallbackDurationInFrames: 7 * PLANNER_TUTORIAL_FPS,
    zoomStart: 1.08,
    zoomEnd: 1.03,
    panStartX: -14,
    panEndX: 0,
    panStartY: -60,
    panEndY: -18,
    callouts: [
      { label: "Everything in one place", x: 0.5, y: 0.13, width: 320, align: "left" },
    ],
  },
  {
    id: "demo-entry",
    eyebrow: "Instant demo access",
    headline: "Tap Explore Demo Planner.",
    subtitle: "The sample workspace opens instantly.",
    voiceoverText:
      "Just tap Explore Demo Planner and the seeded sample workspace opens instantly. Aarohi and Pranav's ready wedding plan makes the full product flow easy to understand in seconds.",
    hindiVoiceoverText:
      "शुरू करना भी आसान है। बस Explore Demo Planner पर tap कीजिए, और ready demo workspace तुरंत खुल जाता है।",
    screenshot: "tutorial/screens/login.png",
    accent: "#38bdf8",
    fallbackDurationInFrames: 8 * PLANNER_TUTORIAL_FPS,
    zoomStart: 1.02,
    zoomEnd: 1.06,
    panStartX: 0,
    panEndX: 0,
    panStartY: -28,
    panEndY: 6,
    callouts: [
      { label: "Tap here to enter demo mode", x: 0.5, y: 0.73, width: 320, align: "left" },
    ],
  },
  {
    id: "dashboard",
    eyebrow: "Daily snapshot",
    headline: "See the key wedding numbers fast.",
    subtitle: "Countdown, budget, guests, calendar.",
    voiceoverText:
      "The home dashboard shows the most important details at a glance: your wedding countdown, budget progress, guest confirmations, and upcoming ceremonies. Daily check-ins become fast and stress free.",
    hindiVoiceoverText:
      "होम डैशबोर्ड पर सबसे ज़रूरी चीज़ें एक नज़र में दिखती हैं। Countdown, budget, guest confirmations और upcoming functions, सब यहीं।",
    screenshot: "tutorial/screens/dashboard.png",
    accent: "#22c55e",
    fallbackDurationInFrames: 9 * PLANNER_TUTORIAL_FPS,
    zoomStart: 1.04,
    zoomEnd: 1.1,
    panStartX: 0,
    panEndX: 0,
    panStartY: -22,
    panEndY: -52,
    callouts: [
      { label: "Countdown at a glance", x: 0.5, y: 0.17, width: 250, align: "left" },
      { label: "Budget and RSVP stats", x: 0.5, y: 0.35, width: 250, align: "right" },
      { label: "Your wedding calendar below", x: 0.5, y: 0.54, width: 300, align: "left" },
    ],
  },
  {
    id: "events",
    eyebrow: "Ceremony control",
    headline: "Each ceremony stays organized.",
    subtitle: "Date, venue, status, spend.",
    voiceoverText:
      "In the events tab, every ceremony has its own date, time, venue, status, and linked spend. From haldi to reception, the full celebration sequence stays organized and easy to edit.",
    hindiVoiceoverText:
      "अब events पर आइए। हर ceremony की date, time, venue और spend साफ दिखता है, ताकि haldi से reception तक flow organized रहे।",
    screenshot: "tutorial/screens/events.png",
    accent: "#f59e0b",
    fallbackDurationInFrames: 8 * PLANNER_TUTORIAL_FPS,
    zoomStart: 1.04,
    zoomEnd: 1.12,
    panStartX: 0,
    panEndX: 0,
    panStartY: -20,
    panEndY: -58,
    callouts: [
      { label: "Ceremonies stay sequenced", x: 0.49, y: 0.28, width: 260, align: "left" },
      { label: "Linked spend stays visible", x: 0.5, y: 0.5, width: 250, align: "right" },
    ],
  },
  {
    id: "tasks",
    eyebrow: "Checklist momentum",
    headline: "Tasks stay clear and trackable.",
    subtitle: "Timeline groups and quick updates.",
    voiceoverText:
      "The tasks screen lets you manage your wedding checklist through clear timeline groups. One tap marks work complete, updates progress instantly, and keeps everyone aligned on what is still pending.",
    hindiVoiceoverText:
      "Tasks screen पूरी checklist को timeline में रखती है। एक tap में task complete कीजिए, और progress तुरंत update हो जाती है।",
    screenshot: "tutorial/screens/tasks.png",
    accent: "#a855f7",
    fallbackDurationInFrames: 8 * PLANNER_TUTORIAL_FPS,
    zoomStart: 1.02,
    zoomEnd: 1.08,
    panStartX: 0,
    panEndX: 0,
    panStartY: -18,
    panEndY: -50,
    callouts: [
      { label: "Progress ring updates live", x: 0.52, y: 0.2, width: 280, align: "left" },
      { label: "Grouped tasks keep the timeline clear", x: 0.5, y: 0.48, width: 310, align: "right" },
    ],
  },
  {
    id: "budget",
    eyebrow: "Spend visibility",
    headline: "Budget tracking stays simple.",
    subtitle: "Spend, remaining, category breakdowns.",
    voiceoverText:
      "The budget tab shows your total spend, remaining amount, and breakdowns by area, ceremony, and category. It helps you catch overspending early instead of discovering it at the last minute.",
    hindiVoiceoverText:
      "Budget tab में total spend, remaining amount और category-wise breakdown साथ में दिखता है। इससे overspending पहले ही पकड़ में आ जाती है।",
    screenshot: "tutorial/screens/budget.png",
    accent: "#fb7185",
    fallbackDurationInFrames: 8 * PLANNER_TUTORIAL_FPS,
    zoomStart: 1.02,
    zoomEnd: 1.09,
    panStartX: 0,
    panEndX: 0,
    panStartY: -16,
    panEndY: -46,
    callouts: [
      { label: "Total budget versus spend", x: 0.5, y: 0.19, width: 280, align: "left" },
      { label: "Breakdowns make decisions faster", x: 0.5, y: 0.47, width: 310, align: "right" },
    ],
  },
  {
    id: "guests",
    eyebrow: "RSVP management",
    headline: "Guest tracking stays actionable.",
    subtitle: "RSVPs, families, reminders.",
    voiceoverText:
      "The guests tab brings your invitation list, RSVP status, family groups, and reminder actions into one place. When you need confirmations quickly, this screen makes guest tracking much lighter.",
    hindiVoiceoverText:
      "Guests tab में RSVP status, family groups और reminders एक ही जगह मिलते हैं। Guest tracking manual follow-up से कहीं ज़्यादा आसान हो जाता है।",
    screenshot: "tutorial/screens/guests.png",
    accent: "#2dd4bf",
    fallbackDurationInFrames: 9 * PLANNER_TUTORIAL_FPS,
    zoomStart: 1.02,
    zoomEnd: 1.07,
    panStartX: 0,
    panEndX: 0,
    panStartY: -14,
    panEndY: -38,
    callouts: [
      { label: "Filter RSVP progress fast", x: 0.5, y: 0.24, width: 260, align: "left" },
      { label: "Guest records stay easy to action", x: 0.5, y: 0.47, width: 310, align: "right" },
    ],
  },
  {
    id: "outro",
    eyebrow: "Ready to plan smarter?",
    headline: "Plan your wedding with less chaos.",
    subtitle: "Explore the demo and get started.",
    voiceoverText:
      "If you want wedding planning to feel simple, shareable, and phone first, VivahGo is built for that. Open the planner, explore the demo, and start organizing with less chaos.",
    hindiVoiceoverText:
      "अगर आप wedding planning को simple और organized रखना चाहते हैं, तो VivahGo try कीजिए। Demo explore कीजिए और अपनी planning को कम chaos के साथ शुरू कीजिए।",
    screenshot: "tutorial/screens/dashboard.png",
    accent: "#f97316",
    fallbackDurationInFrames: 7 * PLANNER_TUTORIAL_FPS,
    zoomStart: 1.06,
    zoomEnd: 1.02,
    panStartX: 0,
    panEndX: 0,
    panStartY: -44,
    panEndY: -16,
    callouts: [
      { label: "Built for phone-first planning", x: 0.5, y: 0.62, width: 320, align: "left" },
    ],
  },
];

const createFallbackCaption = (
  text: string,
  durationInFrames: number,
): Caption[] => [
  {
    text,
    startMs: 0,
    endMs: Math.round((durationInFrames / PLANNER_TUTORIAL_FPS) * 1000),
    timestampMs: 0,
    confidence: null,
  },
];

export const getPlannerTutorialNarration = (
  scene: PlannerTutorialScene,
  provider: string,
) => {
  if (provider === "sarvam" && scene.hindiVoiceoverText) {
    return scene.hindiVoiceoverText;
  }

  return scene.voiceoverText;
};

export const defaultPlannerTutorialAudioManifest: PlannerTutorialAudioManifest = {
  fps: PLANNER_TUTORIAL_FPS,
  backgroundMusicFile: PLANNER_TUTORIAL_BACKGROUND_AUDIO,
  generatedWith: "fallback",
  totalDurationInFrames: plannerTutorialScenes.reduce(
    (sum, scene) => sum + scene.fallbackDurationInFrames,
    0,
  ) + PLANNER_TUTORIAL_END_HOLD_FRAMES,
  scenes: plannerTutorialScenes.map((scene) => ({
    sceneId: scene.id,
    audioFile: "",
    durationInFrames: scene.fallbackDurationInFrames,
    captions: createFallbackCaption(
      getPlannerTutorialNarration(scene, "fallback"),
      scene.fallbackDurationInFrames,
    ),
  })),
};

const sanitizeCaption = (candidate: Caption): Caption | null => {
  if (!candidate || typeof candidate.text !== "string") {
    return null;
  }

  const startMs = Number(candidate.startMs);
  const endMs = Number(candidate.endMs);

  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
    return null;
  }

  return {
    text: candidate.text.trim(),
    startMs,
    endMs,
    timestampMs:
      candidate.timestampMs === null || Number.isFinite(candidate.timestampMs)
        ? candidate.timestampMs
        : null,
    confidence:
      candidate.confidence === null || Number.isFinite(candidate.confidence)
        ? candidate.confidence
        : null,
  };
};

export const resolvePlannerTutorialManifest = (
  manifest?: Partial<PlannerTutorialAudioManifest> | null,
): PlannerTutorialAudioManifest => {
  const fps = Number(manifest?.fps) || PLANNER_TUTORIAL_FPS;
  const sceneOverrides = Array.isArray(manifest?.scenes) ? manifest.scenes : [];

  const scenes = plannerTutorialScenes.map((scene) => {
    const override = sceneOverrides.find((entry) => entry?.sceneId === scene.id);
    const durationInFrames =
      Number(override?.durationInFrames) || scene.fallbackDurationInFrames;
    const captions = Array.isArray(override?.captions)
      ? override.captions
          .map((candidate) => sanitizeCaption(candidate as Caption))
          .filter((candidate): candidate is Caption => Boolean(candidate))
      : [];

    return {
      sceneId: scene.id,
      audioFile:
        typeof override?.audioFile === "string" ? override.audioFile : "",
      durationInFrames,
      captions:
        captions.length > 0
          ? captions
          : createFallbackCaption(
              getPlannerTutorialNarration(scene, "fallback"),
              durationInFrames,
            ),
    };
  });

  return {
    fps,
    backgroundMusicFile:
      typeof manifest?.backgroundMusicFile === "string" &&
      manifest.backgroundMusicFile
        ? manifest.backgroundMusicFile
        : PLANNER_TUTORIAL_BACKGROUND_AUDIO,
    generatedWith:
      typeof manifest?.generatedWith === "string" && manifest.generatedWith
        ? manifest.generatedWith
        : defaultPlannerTutorialAudioManifest.generatedWith,
    totalDurationInFrames: scenes.reduce(
      (sum, scene) => sum + scene.durationInFrames,
      0,
    ) + PLANNER_TUTORIAL_END_HOLD_FRAMES,
    scenes,
  };
};
