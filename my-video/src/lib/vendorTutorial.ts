import type { Caption } from "@remotion/captions";

export const VENDOR_TUTORIAL_FPS = 30;
export const VENDOR_TUTORIAL_AUDIO_MANIFEST =
  "tutorial/vendor/vendor-tutorial-audio.json";
export const VENDOR_TUTORIAL_BACKGROUND_AUDIO =
  "tutorial/vendor/audio/background-bed.wav";
export const VENDOR_TUTORIAL_BOOKEND_IMAGE = "tutorial/vendor/thumbnail.png";
export const VENDOR_TUTORIAL_END_HOLD_FRAMES = 10;

export type VendorTutorialCallout = {
  label: string;
  x: number;
  y: number;
  width?: number;
  align?: "left" | "right";
};

export type VendorTutorialScene = {
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
  callouts: VendorTutorialCallout[];
};

export type VendorTutorialAudioScene = {
  sceneId: string;
  audioFile: string;
  durationInFrames: number;
  captions: Caption[];
};

export type VendorTutorialAudioManifest = {
  fps: number;
  backgroundMusicFile: string;
  totalDurationInFrames: number;
  generatedWith: string;
  scenes: VendorTutorialAudioScene[];
};

export const vendorTutorialScenes: VendorTutorialScene[] = [
  {
    id: "login",
    eyebrow: "Vendor Workspace",
    headline: "Sign in to the vendor portal.",
    subtitle: "Access your business workspace in one place.",
    voiceoverText:
      "Sign in to the VivahGo vendor portal and continue into your business workspace.",
    hindiVoiceoverText:
      "Yahan se vendor portal sign in hota hai. Ek click mein apne business workspace mein aa jaiye.",
    screenshot: "tutorial/vendor/screens/login.png",
    accent: "#b45309",
    fallbackDurationInFrames: 7 * VENDOR_TUTORIAL_FPS,
    zoomStart: 1.03,
    zoomEnd: 1.08,
    panStartX: 0,
    panEndX: -20,
    panStartY: 0,
    panEndY: -18,
    callouts: [
      {
        label: "Direct vendor sign-in",
        x: 0.71,
        y: 0.46,
        width: 260,
        align: "left",
      },
    ],
  },
  {
    id: "registration",
    eyebrow: "Business Setup",
    headline: "Complete your business profile once.",
    subtitle: "Category, pricing, coverage, and contact details.",
    voiceoverText:
      "Complete your business profile once with category, pricing, service areas, and contact details.",
    hindiVoiceoverText:
      "Is registration flow mein business basics, pricing, service area, aur contact details ek hi jagah fill hote hain.",
    screenshot: "tutorial/vendor/screens/registration.png",
    accent: "#d97706",
    fallbackDurationInFrames: 8 * VENDOR_TUTORIAL_FPS,
    zoomStart: 1.02,
    zoomEnd: 1.08,
    panStartX: 0,
    panEndX: 18,
    panStartY: -10,
    panEndY: -36,
    callouts: [
      {
        label: "Structured onboarding form",
        x: 0.57,
        y: 0.31,
        width: 280,
        align: "right",
      },
    ],
  },
  {
    id: "dashboard",
    eyebrow: "Vendor Dashboard",
    headline: "Track profile strength and lead readiness.",
    subtitle: "Completion, portfolio depth, price tier, and lead previews.",
    voiceoverText:
      "From the dashboard, track profile completion, portfolio strength, price tier, and lead readiness.",
    hindiVoiceoverText:
      "Dashboard par profile completion, portfolio count, price band, aur lead readiness turant dikh jaati hai.",
    screenshot: "tutorial/vendor/screens/dashboard.png",
    accent: "#ca8a04",
    fallbackDurationInFrames: 9 * VENDOR_TUTORIAL_FPS,
    zoomStart: 1.02,
    zoomEnd: 1.1,
    panStartX: 0,
    panEndX: -26,
    panStartY: 0,
    panEndY: -44,
    callouts: [
      {
        label: "Completion and analytics",
        x: 0.43,
        y: 0.28,
        width: 250,
        align: "left",
      },
      {
        label: "Lead preview and next tasks",
        x: 0.7,
        y: 0.54,
        width: 250,
        align: "right",
      },
    ],
  },
  {
    id: "preview",
    eyebrow: "Live Preview",
    headline: "Review how couples see your listing.",
    subtitle: "Check both the directory card and detailed listing view.",
    voiceoverText:
      "Use live preview to review exactly how couples will see your directory card and detail page.",
    hindiVoiceoverText:
      "Live Preview mein dekhiye ki couples ko aapka card aur full listing exactly kaise nazar aayegi.",
    screenshot: "tutorial/vendor/screens/preview.png",
    accent: "#0f766e",
    fallbackDurationInFrames: 8 * VENDOR_TUTORIAL_FPS,
    zoomStart: 1.02,
    zoomEnd: 1.08,
    panStartX: 0,
    panEndX: -16,
    panStartY: -4,
    panEndY: -42,
    callouts: [
      {
        label: "Directory card view",
        x: 0.23,
        y: 0.25,
        width: 220,
        align: "left",
      },
      {
        label: "Detailed listing preview",
        x: 0.59,
        y: 0.68,
        width: 240,
        align: "right",
      },
    ],
  },
  {
    id: "portfolio",
    eyebrow: "Media Manager",
    headline: "Manage portfolio media in one workspace.",
    subtitle: "Upload, organize, and control what stays visible.",
    voiceoverText:
      "Use the media manager to upload portfolio assets, organize them, and control what stays visible.",
    hindiVoiceoverText:
      "Media Manager se portfolio, cover image, aur verification documents sab ek jagah control hote hain.",
    screenshot: "tutorial/vendor/screens/portfolio.png",
    accent: "#7c3aed",
    fallbackDurationInFrames: 8 * VENDOR_TUTORIAL_FPS,
    zoomStart: 1.02,
    zoomEnd: 1.09,
    panStartX: 0,
    panEndX: -18,
    panStartY: 0,
    panEndY: -38,
    callouts: [
      {
        label: "Portfolio gallery controls",
        x: 0.76,
        y: 0.33,
        width: 230,
        align: "right",
      },
    ],
  },
  {
    id: "availability",
    eyebrow: "Availability",
    headline: "Control booking capacity by date.",
    subtitle: "Set defaults, open dates, and specific exceptions.",
    voiceoverText:
      "Manage booking capacity by date, with default availability and specific exceptions where required.",
    hindiVoiceoverText:
      "Availability view mein date wise capacity set kijiye, selected day ko edit kijiye, aur exceptions turant apply kijiye.",
    screenshot: "tutorial/vendor/screens/availability.png",
    accent: "#059669",
    fallbackDurationInFrames: 8 * VENDOR_TUTORIAL_FPS,
    zoomStart: 1.02,
    zoomEnd: 1.08,
    panStartX: 0,
    panEndX: 16,
    panStartY: 0,
    panEndY: -28,
    callouts: [
      {
        label: "Selected day controls",
        x: 0.82,
        y: 0.45,
        width: 220,
        align: "right",
      },
      {
        label: "Calendar status at a glance",
        x: 0.27,
        y: 0.38,
        width: 240,
        align: "left",
      },
    ],
  },
  {
    id: "details",
    eyebrow: "Business Details",
    headline: "Update business details anytime.",
    subtitle: "Edit locations, contact fields, services, and defaults.",
    voiceoverText:
      "Business details lets you update locations, contact fields, bundled services, and profile defaults at any time.",
    hindiVoiceoverText:
      "Business Details mein description, pricing, capacity, location, aur contact information kabhi bhi update kar sakte hain.",
    screenshot: "tutorial/vendor/screens/details.png",
    accent: "#dc2626",
    fallbackDurationInFrames: 8 * VENDOR_TUTORIAL_FPS,
    zoomStart: 1.02,
    zoomEnd: 1.08,
    panStartX: 0,
    panEndX: 22,
    panStartY: 0,
    panEndY: -34,
    callouts: [
      {
        label: "Editable business profile",
        x: 0.45,
        y: 0.34,
        width: 220,
        align: "right",
      },
    ],
  },
  {
    id: "outro",
    eyebrow: "Vendor Network",
    headline: "Build a stronger vendor presence on VivahGo.",
    subtitle: "Sign in, complete your profile, and stay market-ready.",
    voiceoverText:
      "Join VivahGo Vendor Network, complete your profile, and stay ready for discovery and future enquiries.",
    hindiVoiceoverText:
      "Portal simple hai, direct hai, aur vendor operations ko organized rakhta hai. Sign in kijiye, profile complete rakhiye, aur listing ready rakhiye.",
    screenshot: "tutorial/vendor/screens/dashboard.png",
    accent: "#b45309",
    fallbackDurationInFrames: 7 * VENDOR_TUTORIAL_FPS,
    zoomStart: 1.05,
    zoomEnd: 1.01,
    panStartX: 0,
    panEndX: 0,
    panStartY: -18,
    panEndY: -6,
    callouts: [
      {
        label: "Professional vendor workspace",
        x: 0.5,
        y: 0.3,
        width: 250,
        align: "left",
      },
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
    endMs: Math.round((durationInFrames / VENDOR_TUTORIAL_FPS) * 1000),
    timestampMs: 0,
    confidence: null,
  },
];

export const getVendorTutorialNarration = (
  scene: VendorTutorialScene,
  provider: string,
) => {
  if (provider === "sarvam" && scene.hindiVoiceoverText) {
    return scene.hindiVoiceoverText;
  }

  return scene.voiceoverText;
};

export const defaultVendorTutorialAudioManifest: VendorTutorialAudioManifest = {
  fps: VENDOR_TUTORIAL_FPS,
  backgroundMusicFile: VENDOR_TUTORIAL_BACKGROUND_AUDIO,
  generatedWith: "fallback",
  totalDurationInFrames:
    vendorTutorialScenes.reduce(
      (sum, scene) => sum + scene.fallbackDurationInFrames,
      0,
    ) + VENDOR_TUTORIAL_END_HOLD_FRAMES,
  scenes: vendorTutorialScenes.map((scene) => ({
    sceneId: scene.id,
    audioFile: "",
    durationInFrames: scene.fallbackDurationInFrames,
    captions: createFallbackCaption(
      getVendorTutorialNarration(scene, "fallback"),
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

export const resolveVendorTutorialManifest = (
  manifest?: Partial<VendorTutorialAudioManifest> | null,
): VendorTutorialAudioManifest => {
  const fps = Number(manifest?.fps) || VENDOR_TUTORIAL_FPS;
  const sceneOverrides = Array.isArray(manifest?.scenes) ? manifest.scenes : [];

  const scenes = vendorTutorialScenes.map((scene) => {
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
              getVendorTutorialNarration(scene, "fallback"),
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
        : VENDOR_TUTORIAL_BACKGROUND_AUDIO,
    generatedWith:
      typeof manifest?.generatedWith === "string" && manifest.generatedWith
        ? manifest.generatedWith
        : defaultVendorTutorialAudioManifest.generatedWith,
    totalDurationInFrames:
      scenes.reduce((sum, scene) => sum + scene.durationInFrames, 0) +
      VENDOR_TUTORIAL_END_HOLD_FRAMES,
    scenes,
  };
};
